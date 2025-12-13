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
 *
 * Architecture:
 * - Uses safety-rules.ts as single source of truth for command/file patterns
 * - Uses session-state.ts for centralized session approval management
 * - This module focuses on permission checking logic
 */

import { EventEmitter } from 'events';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { homedir } from 'os';
import { join, dirname } from 'path';
import * as yaml from 'js-yaml';
import { CONFIG_DIR_NAME, TIMEOUT_CONFIG } from '../constants.js';
import {
  getCommandTier,
  isSensitiveFile,
  assessCommandRisk,
  assessFileRisk,
  type CommandTier,
} from '../utils/safety-rules.js';
import { getSessionState, SessionStateManager } from './session-state.js';

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
 *
 * Context fields:
 * - command: Required for bash/execute_bash tools
 * - filePath: Required for file operation tools
 * - riskLevel: Always required
 */
export interface PermissionRequest {
  tool: string;
  args: Record<string, unknown>;
  context: {
    /** File path for file operations */
    filePath?: string;
    /** Command string for bash operations */
    command?: string;
    /** Risk level assessment */
    riskLevel: RiskLevel;
    /** Human-readable description */
    description?: string;
  };
}

// ============================================================================
// Type Guards for more precise typing when needed
// ============================================================================

/**
 * Type guard: Check if request is for a bash command
 */
export function isBashRequest(request: PermissionRequest): request is PermissionRequest & { context: { command: string } } {
  return (request.tool === 'bash' || request.tool === 'execute_bash') && typeof request.context.command === 'string';
}

/**
 * Type guard: Check if request is for a file operation
 */
export function isFileRequest(request: PermissionRequest): request is PermissionRequest & { context: { filePath: string } } {
  return typeof request.context.filePath === 'string';
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

      // Bash - tier depends on command (patterns are in safety-rules.ts)
      bash: {
        tier: PermissionTier.Confirm, // Default tier; safety-rules.ts has specific patterns
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
 * Delegates to:
 * - safety-rules.ts for command/file pattern matching
 * - session-state.ts for session approval management
 */
export class PermissionManager extends EventEmitter {
  private config: PermissionConfig;
  private configPath: string;
  private sessionState: SessionStateManager;

  /** Pending approval requests */
  private pendingApprovals: Map<string, {
    request: PermissionRequest;
    resolve: (approved: boolean) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor() {
    super();
    this.configPath = join(homedir(), CONFIG_DIR_NAME, 'permissions.yaml');
    // Create a copy to avoid mutating the shared DEFAULT_CONFIG
    this.config = {
      permissions: {
        ...DEFAULT_CONFIG.permissions,
        tools: { ...DEFAULT_CONFIG.permissions.tools },
        session_approvals: { ...DEFAULT_CONFIG.permissions.session_approvals },
      },
    };
    this.sessionState = getSessionState();
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
   * Uses safety-rules.ts for pattern matching (single source of truth)
   */
  async checkPermission(request: PermissionRequest): Promise<PermissionResult> {
    const toolConfig = this.getToolConfig(request.tool);
    let tier = toolConfig?.tier || this.config.permissions.default_tier;

    // Check patterns for bash commands using consolidated safety-rules
    if ((request.tool === 'bash' || request.tool === 'execute_bash') && request.context.command) {
      // Use safety-rules.ts as single source of truth
      const commandTier = getCommandTier(request.context.command);
      if (commandTier) {
        tier = this.commandTierToPermissionTier(commandTier);
      } else {
        // Fall back to config-based patterns if no match in safety-rules
        const patternTier = this.checkPatterns(toolConfig?.patterns, request.context.command);
        if (patternTier) {
          tier = patternTier;
        }
      }
    }

    // Check file-specific confirmations using consolidated safety-rules
    // Only upgrade tier (never downgrade from Block/Confirm to less restrictive)
    if (request.context.filePath && tier !== PermissionTier.Block && tier !== PermissionTier.Confirm) {
      // First check using safety-rules (preferred)
      if (isSensitiveFile(request.context.filePath)) {
        tier = PermissionTier.Confirm;
      }
      // Also check legacy config-based patterns
      else if (toolConfig?.confirmFor?.files) {
        if (this.matchesFilePatterns(request.context.filePath, toolConfig.confirmFor.files)) {
          tier = PermissionTier.Confirm;
        }
      }
    }

    // Block tier is NEVER auto-approved, even with session flags
    if (tier !== PermissionTier.Block) {
      // Check session-wide auto-approval flags
      const operationType = this.getOperationType(request);
      if (operationType && this.sessionState.isAutoApproved(operationType)) {
        return {
          allowed: true,
          tier,
          reason: 'Session auto-approval enabled',
          userApproved: true,
        };
      }

      // Check fine-grained session approvals
      const signature = this.getApprovalSignature(request);
      if (this.sessionState.hasApproval(signature)) {
        return {
          allowed: true,
          tier,
          reason: 'Session approval granted',
          userApproved: true,
        };
      }
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
   * Convert CommandTier from safety-rules to PermissionTier
   */
  private commandTierToPermissionTier(commandTier: CommandTier): PermissionTier {
    switch (commandTier) {
      case 'auto_approve':
        return PermissionTier.AutoApprove;
      case 'notify':
        return PermissionTier.Notify;
      case 'confirm':
        return PermissionTier.Confirm;
      case 'block':
        return PermissionTier.Block;
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
    // BUG FIX: Use sessionState.grantApproval() instead of deprecated sessionApprovals.add()
    if (approved && grantSession) {
      const signature = this.getApprovalSignature(pending.request);
      this.sessionState.grantApproval(signature);
    }

    pending.resolve(approved);
  }

  /**
   * Grant session-level approval for a pattern
   * Delegates to shared session state
   */
  grantSessionApproval(pattern: string): void {
    this.sessionState.grantApproval(pattern);
    this.emit('permission:session_granted', pattern);
  }

  /**
   * Revoke session-level approval for a pattern
   * Delegates to shared session state
   */
  revokeSessionApproval(pattern: string): void {
    this.sessionState.revokeApproval(pattern);
    this.emit('permission:session_revoked', pattern);
  }

  /**
   * Clear all session approvals
   * Delegates to shared session state
   */
  clearSessionApprovals(): void {
    this.sessionState.clearApprovals();
    this.emit('permission:session_cleared');
  }

  /**
   * Get current permission configuration
   * Returns a deep copy to prevent external mutation
   */
  getConfig(): PermissionConfig {
    // Deep copy tools - each tool config and nested objects must be copied
    const toolsCopy: Record<string, ToolPermissionConfig> = {};
    for (const [key, value] of Object.entries(this.config.permissions.tools)) {
      toolsCopy[key] = {
        ...value,
        // Deep copy each pattern object, not just the array
        patterns: value.patterns ? value.patterns.map(p => ({ ...p })) : undefined,
        confirmFor: value.confirmFor ? {
          files: value.confirmFor.files ? [...value.confirmFor.files] : undefined,
          commands: value.confirmFor.commands ? [...value.confirmFor.commands] : undefined,
        } : undefined,
      };
    }

    return {
      permissions: {
        ...this.config.permissions,
        tools: toolsCopy,
        session_approvals: { ...this.config.permissions.session_approvals },
      },
    };
  }

  /**
   * Update permission configuration
   * Merges tools and session_approvals instead of replacing them
   */
  async updateConfig(updates: Partial<PermissionConfig['permissions']>): Promise<void> {
    this.config.permissions = {
      ...this.config.permissions,
      ...updates,
      // Deep merge tools if provided (don't replace entire object)
      tools: updates.tools
        ? { ...this.config.permissions.tools, ...updates.tools }
        : this.config.permissions.tools,
      // Deep merge session_approvals if provided
      session_approvals: updates.session_approvals
        ? { ...this.config.permissions.session_approvals, ...updates.session_approvals }
        : this.config.permissions.session_approvals,
    };
    await this.saveConfig();
  }

  /**
   * Assess risk level for a request
   * Uses consolidated risk assessment from safety-rules.ts
   */
  assessRisk(request: PermissionRequest): RiskLevel {
    // Check for dangerous bash patterns using consolidated function
    if ((request.tool === 'bash' || request.tool === 'execute_bash') && request.context.command) {
      return assessCommandRisk(request.context.command);
    }

    // Check for sensitive file operations using consolidated function
    if (request.context.filePath) {
      return assessFileRisk(request.context.filePath);
    }

    return request.context.riskLevel || 'low';
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Determine the operation type for session flag checking
   */
  private getOperationType(request: PermissionRequest): 'file' | 'bash' | null {
    if (request.tool === 'bash' || request.tool === 'execute_bash') {
      return 'bash';
    }
    if (request.context.filePath) {
      return 'file';
    }
    return null;
  }

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
      // BUG FIX: Added fallback for empty/whitespace-only command to prevent undefined access
      const cmdPrefix = request.context.command.split(/\s+/)[0] || request.context.command;
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
      // File doesn't exist or is invalid, use a copy of defaults
      // (Don't assign DEFAULT_CONFIG directly to avoid mutation risk)
      this.config = {
        permissions: {
          ...DEFAULT_CONFIG.permissions,
          tools: { ...DEFAULT_CONFIG.permissions.tools },
          session_approvals: { ...DEFAULT_CONFIG.permissions.session_approvals },
        },
      };
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

  /**
   * Clean up this instance's resources (pending approvals, event listeners).
   * Does NOT affect shared session state - use for instance cleanup without side effects.
   */
  destroy(): void {
    for (const [, pending] of this.pendingApprovals) {
      clearTimeout(pending.timeout);
      pending.resolve(false);
    }
    this.pendingApprovals.clear();
    this.removeAllListeners();
  }

  /**
   * Full cleanup including session approvals.
   * Use when completely resetting the permission system (e.g., singleton reset).
   */
  dispose(): void {
    this.destroy();
    this.sessionState.clearApprovals();
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

/**
 * Reset the permission manager singleton (for testing)
 * Disposes the current instance and clears the reference
 */
export function resetPermissionManager(): void {
  if (permissionManagerInstance) {
    permissionManagerInstance.dispose();
    permissionManagerInstance = null;
  }
}
