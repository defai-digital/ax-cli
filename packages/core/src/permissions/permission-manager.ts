/**
 * Permission System (Phase 3)
 *
 * Based on Claude Code's permission-first architecture.
 * Implements a tiered permission system for tool execution.
 *
 * Permission Tiers:
 * - auto_approve: Safe, read-only operations (view_file, list_files)
 * - notify: Show notification, continue (bash safe commands, create_file)
 * - confirm: Require explicit approval (bash dangerous, str_replace_editor)
 * - block: Never allow (dangerous patterns)
 */

import { EventEmitter } from 'events';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { homedir } from 'os';
import { join, dirname } from 'path';
import * as yaml from 'js-yaml';
import { CONFIG_DIR_NAME, TIMEOUT_CONFIG } from '../constants.js';

/**
 * Permission tiers from most to least restrictive
 */
export enum PermissionTier {
  AutoApprove = 'auto_approve',
  Notify = 'notify',
  Confirm = 'confirm',
  Block = 'block',
}

/**
 * Risk levels for operations
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Permission request for a tool operation
 */
export interface PermissionRequest {
  tool: string;
  args: Record<string, unknown>;
  context: {
    filePath?: string;
    command?: string;
    riskLevel: RiskLevel;
    description?: string;
  };
}

/**
 * Permission check result
 */
export interface PermissionResult {
  allowed: boolean;
  tier: PermissionTier;
  reason?: string;
  userApproved?: boolean;
  requiresNotification?: boolean;
}

/**
 * Pattern-based permission rule
 */
interface PermissionPattern {
  pattern: string;
  tier: PermissionTier;
  description?: string;
}

/**
 * Tool-specific permission configuration
 */
interface ToolPermissionConfig {
  tier: PermissionTier;
  patterns?: PermissionPattern[];
  confirmFor?: {
    files?: string[];
    commands?: string[];
  };
}

/**
 * Full permission configuration
 */
interface PermissionConfig {
  permissions: {
    default_tier: PermissionTier;
    tools: Record<string, ToolPermissionConfig>;
    session_approvals: {
      allow_all_bash: boolean;
      trust_current_directory: boolean;
    };
  };
}

/**
 * Default permission configuration
 */
const DEFAULT_CONFIG: PermissionConfig = {
  permissions: {
    default_tier: PermissionTier.Notify,
    tools: {
      // Read-only operations - auto approve
      view_file: { tier: PermissionTier.AutoApprove },
      read_file: { tier: PermissionTier.AutoApprove },
      list_files: { tier: PermissionTier.AutoApprove },
      search: { tier: PermissionTier.AutoApprove },
      search_files: { tier: PermissionTier.AutoApprove },

      // File creation - notify
      create_file: {
        tier: PermissionTier.Notify,
        confirmFor: {
          files: ['*.config.*', '.env*', 'package.json', '*.key', '*.pem'],
        },
      },

      // File editing - notify with confirmations
      str_replace_editor: {
        tier: PermissionTier.Notify,
        confirmFor: {
          files: ['*.config.*', '.env*', 'package.json', 'tsconfig.json'],
        },
      },

      // Bash - tier depends on command
      bash: {
        tier: PermissionTier.Confirm,
        patterns: [
          // Safe commands - auto approve
          { pattern: '^(ls|cat|echo|pwd|date|whoami|which|type|file)\\b', tier: PermissionTier.AutoApprove },
          { pattern: '^(npm (test|run|list|ls)|npx|node|pnpm|yarn)\\b', tier: PermissionTier.Notify },
          { pattern: '^(git (status|log|diff|branch|show))\\b', tier: PermissionTier.AutoApprove },
          { pattern: '^(git (add|commit|push|pull|checkout|merge))\\b', tier: PermissionTier.Notify },

          // Dangerous commands - confirm
          { pattern: '^(rm|sudo|chmod|chown|mv|cp)\\b', tier: PermissionTier.Confirm, description: 'File system modification' },
          { pattern: '\\|\\s*(sh|bash|zsh)\\b', tier: PermissionTier.Confirm, description: 'Pipe to shell' },
          { pattern: '(&&|;|\\|).*rm\\b', tier: PermissionTier.Confirm, description: 'Chained delete command' },

          // Block dangerous patterns
          { pattern: 'rm\\s+-rf\\s+/', tier: PermissionTier.Block, description: 'Recursive delete from root' },
          { pattern: ':(){ :|:& };:', tier: PermissionTier.Block, description: 'Fork bomb' },
          { pattern: '\\bdd\\b.*of=/dev/', tier: PermissionTier.Block, description: 'Direct disk write' },
        ],
      },

      // MCP tools - confirm by default
      'mcp__*': { tier: PermissionTier.Confirm },
    },
    session_approvals: {
      allow_all_bash: false,
      trust_current_directory: true,
    },
  },
};

/**
 * Permission Manager
 *
 * Manages permission checks for tool execution with configurable tiers.
 */
export class PermissionManager extends EventEmitter {
  private config: PermissionConfig;
  private configPath: string;

  /** Session-level approvals (cleared on session end) */
  private sessionApprovals: Set<string> = new Set();

  /** Pending approval requests */
  private pendingApprovals: Map<string, {
    request: PermissionRequest;
    resolve: (approved: boolean) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor() {
    super();
    this.configPath = join(homedir(), CONFIG_DIR_NAME, 'permissions.yaml');
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Initialize the permission manager (load config)
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
    } catch {
      // Use default config if loading fails
      console.warn('Using default permission configuration');
    }
  }

  /**
   * Check permission for a tool operation
   */
  async checkPermission(request: PermissionRequest): Promise<PermissionResult> {
    const toolConfig = this.getToolConfig(request.tool);
    let tier = toolConfig?.tier || this.config.permissions.default_tier;

    // Check patterns for bash commands
    if ((request.tool === 'bash' || request.tool === 'execute_bash') && request.context.command) {
      const patternTier = this.checkPatterns(toolConfig?.patterns, request.context.command);
      if (patternTier) {
        tier = patternTier;
      }
    }

    // Check file-specific confirmations
    if (request.context.filePath && toolConfig?.confirmFor?.files) {
      if (this.matchesFilePatterns(request.context.filePath, toolConfig.confirmFor.files)) {
        tier = PermissionTier.Confirm;
      }
    }

    // Check session approvals
    const signature = this.getApprovalSignature(request);
    if (this.sessionApprovals.has(signature)) {
      return {
        allowed: true,
        tier,
        reason: 'Session approval granted',
        userApproved: true,
      };
    }

    // Handle based on tier
    switch (tier) {
      case PermissionTier.AutoApprove:
        return {
          allowed: true,
          tier,
          reason: 'Auto-approved (safe operation)',
        };

      case PermissionTier.Notify:
        // Emit notification but allow
        this.emit('permission:notify', request);
        return {
          allowed: true,
          tier,
          reason: 'Allowed with notification',
          requiresNotification: true,
        };

      case PermissionTier.Confirm:
        // Requires explicit user approval
        return {
          allowed: false,
          tier,
          reason: 'Requires user confirmation',
        };

      case PermissionTier.Block:
        return {
          allowed: false,
          tier,
          reason: 'Operation blocked by security policy',
        };

      default:
        return {
          allowed: false,
          tier: PermissionTier.Confirm,
          reason: 'Unknown permission tier',
        };
    }
  }

  /**
   * Request user approval for an operation
   * Returns a promise that resolves when user responds
   */
  async requestUserApproval(request: PermissionRequest): Promise<boolean> {
    // BUG FIX: Replace deprecated substr() with substring()
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    return new Promise((resolve) => {
      // Emit approval request event
      this.emit('permission:approval_required', {
        requestId,
        request,
        risk: this.assessRisk(request),
      });

      // Set timeout (configurable, default 5 minutes)
      const timeout = setTimeout(() => {
        this.pendingApprovals.delete(requestId);
        resolve(false); // Auto-reject on timeout
      }, TIMEOUT_CONFIG.TOOL_APPROVAL);

      // Store pending approval
      this.pendingApprovals.set(requestId, {
        request,
        resolve,
        timeout,
      });
    });
  }

  /**
   * Respond to a pending approval request
   */
  respondToApproval(requestId: string, approved: boolean, grantSession: boolean = false): void {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingApprovals.delete(requestId);

    // Grant session approval if requested
    if (approved && grantSession) {
      const signature = this.getApprovalSignature(pending.request);
      this.sessionApprovals.add(signature);
    }

    pending.resolve(approved);
  }

  /**
   * Grant session-level approval for a pattern
   */
  grantSessionApproval(pattern: string): void {
    this.sessionApprovals.add(pattern);
    this.emit('permission:session_granted', pattern);
  }

  /**
   * Revoke session-level approval for a pattern
   */
  revokeSessionApproval(pattern: string): void {
    this.sessionApprovals.delete(pattern);
    this.emit('permission:session_revoked', pattern);
  }

  /**
   * Clear all session approvals
   */
  clearSessionApprovals(): void {
    this.sessionApprovals.clear();
    this.emit('permission:session_cleared');
  }

  /**
   * Get current permission configuration
   */
  getConfig(): PermissionConfig {
    return { ...this.config };
  }

  /**
   * Update permission configuration
   */
  async updateConfig(updates: Partial<PermissionConfig['permissions']>): Promise<void> {
    this.config.permissions = {
      ...this.config.permissions,
      ...updates,
    };
    await this.saveConfig();
  }

  /**
   * Assess risk level for a request
   */
  assessRisk(request: PermissionRequest): RiskLevel {
    // Check for dangerous bash patterns
    if ((request.tool === 'bash' || request.tool === 'execute_bash') && request.context.command) {
      const cmd = request.context.command.toLowerCase();

      if (cmd.includes('rm -rf') || cmd.includes('sudo')) {
        return 'critical';
      }
      if (cmd.includes('rm ') || cmd.includes('mv ') || cmd.includes('chmod')) {
        return 'high';
      }
      if (cmd.includes('git push') || cmd.includes('npm publish')) {
        return 'medium';
      }
    }

    // Check for sensitive file operations
    if (request.context.filePath) {
      const path = request.context.filePath.toLowerCase();
      if (path.includes('.env') || path.includes('secret') || path.includes('credential')) {
        return 'high';
      }
      if (path.includes('config') || path.includes('package.json')) {
        return 'medium';
      }
    }

    return request.context.riskLevel || 'low';
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getToolConfig(tool: string): ToolPermissionConfig | undefined {
    // Direct match
    if (this.config.permissions.tools[tool]) {
      return this.config.permissions.tools[tool];
    }

    // Wildcard match (e.g., mcp__*)
    for (const [pattern, config] of Object.entries(this.config.permissions.tools)) {
      if (pattern.endsWith('*') && tool.startsWith(pattern.slice(0, -1))) {
        return config;
      }
    }

    return undefined;
  }

  private checkPatterns(patterns: PermissionPattern[] | undefined, command: string): PermissionTier | null {
    if (!patterns) return null;

    for (const { pattern, tier } of patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(command)) {
          return tier;
        }
      } catch {
        // Invalid regex, skip
      }
    }

    return null;
  }

  private matchesFilePatterns(filePath: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      // Simple glob matching with ReDoS prevention
      // SECURITY FIX: Use [^/]* instead of .* to prevent catastrophic backtracking
      // .* can cause exponential time complexity on patterns like "a*b*c*d*"
      const regexPattern = '^' + pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars
        .replace(/\*/g, '[^/]*')  // Non-greedy match that doesn't cross directories
        .replace(/\?/g, '[^/]') + '$';  // Single char that doesn't cross directories

      try {
        const regex = new RegExp(regexPattern, 'i');
        if (regex.test(filePath)) {
          return true;
        }
      } catch {
        // Invalid pattern, skip
      }
    }

    return false;
  }

  private getApprovalSignature(request: PermissionRequest): string {
    if (request.context.command) {
      // For bash, use command prefix (first word)
      const cmdPrefix = request.context.command.split(/\s+/)[0];
      return `${request.tool}:${cmdPrefix}`;
    }

    if (request.context.filePath) {
      return `${request.tool}:${request.context.filePath}`;
    }

    return `${request.tool}:${JSON.stringify(request.args)}`;
  }

  private async loadConfig(): Promise<void> {
    try {
      const content = await readFile(this.configPath, 'utf-8');
      const loaded = yaml.load(content) as PermissionConfig;

      // Merge with defaults
      this.config = {
        permissions: {
          ...DEFAULT_CONFIG.permissions,
          ...loaded?.permissions,
          tools: {
            ...DEFAULT_CONFIG.permissions.tools,
            ...loaded?.permissions?.tools,
          },
          session_approvals: {
            ...DEFAULT_CONFIG.permissions.session_approvals,
            ...loaded?.permissions?.session_approvals,
          },
        },
      };
    } catch {
      // File doesn't exist or is invalid, use defaults
      this.config = DEFAULT_CONFIG;
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const dir = dirname(this.configPath);
      await mkdir(dir, { recursive: true });
      await writeFile(this.configPath, yaml.dump(this.config), 'utf-8');
    } catch (error) {
      console.warn('Failed to save permission config:', error);
    }
  }
}

/**
 * Singleton instance
 */
let permissionManagerInstance: PermissionManager | null = null;

export function getPermissionManager(): PermissionManager {
  if (!permissionManagerInstance) {
    permissionManagerInstance = new PermissionManager();
  }
  return permissionManagerInstance;
}

export async function initializePermissionManager(): Promise<PermissionManager> {
  const manager = getPermissionManager();
  await manager.initialize();
  return manager;
}
