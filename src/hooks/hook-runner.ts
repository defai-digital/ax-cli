/**
 * Hook System (Phase 4)
 *
 * Based on Claude Code's hook architecture.
 * Allows custom logic intercept points for tool execution.
 *
 * Hook Types:
 * - PreToolUse: Before tool execution (validation, permission checks, logging)
 * - PostToolUse: After tool execution (result transformation, analytics)
 * - OnError: On tool failure (custom error handling, retry logic)
 * - SessionStart: On session begin (setup, context loading)
 * - SessionEnd: On session end (cleanup, reporting)
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { readFile, stat } from 'fs/promises';
import { homedir } from 'os';
import { join, dirname, resolve } from 'path';
import * as yaml from 'js-yaml';
import { LLMToolCall } from '../llm/client.js';
import { ToolResult } from '../types/index.js';
import { extractErrorMessage } from '../utils/error-handler.js';
import { CONFIG_DIR_NAME, TIMEOUT_CONFIG } from '../constants.js';

/**
 * Hook execution timing
 */
export enum HookType {
  PreToolUse = 'pre_tool_use',
  PostToolUse = 'post_tool_use',
  OnError = 'on_error',
  SessionStart = 'session_start',
  SessionEnd = 'session_end',
}

/**
 * Input passed to hook scripts (via stdin as JSON)
 */
export interface HookInput {
  event: HookType;
  tool: string;
  args: Record<string, unknown>;
  session: {
    id: string;
    startedAt: string;
    messageCount: number;
  };
  result?: ToolResult;  // Only for PostToolUse
  error?: string;       // Only for OnError
}

/**
 * Output expected from hook scripts (via stdout as JSON)
 */
export interface HookOutput {
  action: 'continue' | 'block' | 'modify';
  reason?: string;
  modifiedArgs?: Record<string, unknown>;  // For modify action
}

/**
 * Hook configuration
 */
interface HookDefinition {
  name: string;
  script: string;
  tools: string[];  // Tool names or '*' for all
  timeout?: number;  // Timeout in ms (default: 30000)
  enabled?: boolean;
}

/**
 * Hook configuration file structure
 */
interface HookConfig {
  hooks: {
    pre_tool_use?: HookDefinition[];
    post_tool_use?: HookDefinition[];
    on_error?: HookDefinition[];
    session_start?: HookDefinition[];
    session_end?: HookDefinition[];
  };
}

/**
 * Default hook configuration
 */
const DEFAULT_CONFIG: HookConfig = {
  hooks: {
    pre_tool_use: [],
    post_tool_use: [],
    on_error: [],
    session_start: [],
    session_end: [],
  },
};

/**
 * Hook exit codes
 */
const EXIT_CODES = {
  CONTINUE: 0,   // Continue (approve)
  ERROR: 1,      // Error (log and continue)
  BLOCK: 2,      // Block execution
};

/**
 * Hook Runner
 *
 * Executes hooks at various points in tool execution lifecycle.
 */
export class HookRunner extends EventEmitter {
  private config: HookConfig;
  private configPath: string;
  private sessionId: string;
  private sessionStartedAt: string;
  private messageCount: number = 0;

  /** Running hook processes for cleanup */
  private runningProcesses: Set<ChildProcess> = new Set();

  constructor() {
    super();
    this.configPath = join(homedir(), CONFIG_DIR_NAME, 'hooks.yaml');
    this.config = DEFAULT_CONFIG;
    this.sessionId = this.generateSessionId();
    this.sessionStartedAt = new Date().toISOString();
  }

  /**
   * Initialize the hook runner (load config)
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
    } catch {
      // Use default config if loading fails
      console.warn('Using default hook configuration');
    }

    // Run session start hooks
    await this.runSessionStartHooks();
  }

  /**
   * Run pre-tool-use hooks
   * Returns modified args or blocks execution
   */
  async runPreToolUse(
    toolCall: LLMToolCall,
    args: Record<string, unknown>
  ): Promise<HookOutput> {
    const hooks = this.getHooksForType(HookType.PreToolUse);
    let currentArgs = { ...args };

    for (const hook of hooks) {
      if (!this.shouldRunHook(hook, toolCall.function.name)) continue;

      const input: HookInput = {
        event: HookType.PreToolUse,
        tool: toolCall.function.name,
        args: currentArgs,
        session: this.getSessionInfo(),
      };

      try {
        const result = await this.executeHook(hook, input);

        if (result.action === 'block') {
          this.emit('hook:blocked', {
            hook: hook.name,
            tool: toolCall.function.name,
            reason: result.reason,
          });
          return result;
        }

        if (result.action === 'modify' && result.modifiedArgs) {
          currentArgs = result.modifiedArgs;
          this.emit('hook:modified', {
            hook: hook.name,
            tool: toolCall.function.name,
            originalArgs: args,
            modifiedArgs: currentArgs,
          });
        }
      } catch (error) {
        this.emit('hook:error', {
          hook: hook.name,
          tool: toolCall.function.name,
          error: extractErrorMessage(error),
        });
        // Continue on hook error (don't block tool execution)
      }
    }

    return {
      action: 'continue',
      modifiedArgs: currentArgs,
    };
  }

  /**
   * Run post-tool-use hooks
   */
  async runPostToolUse(
    toolCall: LLMToolCall,
    args: Record<string, unknown>,
    result: ToolResult
  ): Promise<void> {
    const hooks = this.getHooksForType(HookType.PostToolUse);

    for (const hook of hooks) {
      if (!this.shouldRunHook(hook, toolCall.function.name)) continue;

      const input: HookInput = {
        event: HookType.PostToolUse,
        tool: toolCall.function.name,
        args,
        session: this.getSessionInfo(),
        result,
      };

      try {
        await this.executeHook(hook, input);
      } catch (error) {
        this.emit('hook:error', {
          hook: hook.name,
          tool: toolCall.function.name,
          error: extractErrorMessage(error),
        });
      }
    }
  }

  /**
   * Run on-error hooks
   */
  async runOnError(
    toolCall: LLMToolCall,
    args: Record<string, unknown>,
    error: string
  ): Promise<HookOutput> {
    const hooks = this.getHooksForType(HookType.OnError);

    for (const hook of hooks) {
      if (!this.shouldRunHook(hook, toolCall.function.name)) continue;

      const input: HookInput = {
        event: HookType.OnError,
        tool: toolCall.function.name,
        args,
        session: this.getSessionInfo(),
        error,
      };

      try {
        const result = await this.executeHook(hook, input);

        if (result.action === 'modify' && result.modifiedArgs) {
          // Hook wants to retry with modified args
          return result;
        }
      } catch (hookError) {
        this.emit('hook:error', {
          hook: hook.name,
          tool: toolCall.function.name,
          error: extractErrorMessage(hookError),
        });
      }
    }

    return { action: 'continue' };
  }

  /**
   * Run session start hooks
   */
  private async runSessionStartHooks(): Promise<void> {
    const hooks = this.getHooksForType(HookType.SessionStart);

    for (const hook of hooks) {
      const input: HookInput = {
        event: HookType.SessionStart,
        tool: '',
        args: {},
        session: this.getSessionInfo(),
      };

      try {
        await this.executeHook(hook, input);
        this.emit('hook:session_start', { hook: hook.name });
      } catch (error) {
        this.emit('hook:error', {
          hook: hook.name,
          error: extractErrorMessage(error),
        });
      }
    }
  }

  /**
   * Run session end hooks
   */
  async runSessionEndHooks(): Promise<void> {
    const hooks = this.getHooksForType(HookType.SessionEnd);

    for (const hook of hooks) {
      const input: HookInput = {
        event: HookType.SessionEnd,
        tool: '',
        args: {},
        session: this.getSessionInfo(),
      };

      try {
        await this.executeHook(hook, input);
        this.emit('hook:session_end', { hook: hook.name });
      } catch (error) {
        this.emit('hook:error', {
          hook: hook.name,
          error: extractErrorMessage(error),
        });
      }
    }
  }

  /**
   * Increment message count (for session tracking)
   */
  incrementMessageCount(): void {
    this.messageCount++;
  }

  /**
   * Get current hook configuration
   */
  getConfig(): HookConfig {
    return { ...this.config };
  }

  /**
   * Reload configuration from file
   */
  async reloadConfig(): Promise<void> {
    await this.loadConfig();
    this.emit('hook:config_reloaded');
  }

  /**
   * Cleanup running processes
   */
  async dispose(): Promise<void> {
    // Run session end hooks
    await this.runSessionEndHooks();

    // Kill any running processes
    for (const proc of this.runningProcesses) {
      try {
        proc.kill('SIGTERM');
      } catch {
        // Process may have already exited
      }
    }
    this.runningProcesses.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getHooksForType(type: HookType): HookDefinition[] {
    const hookKey = type as keyof HookConfig['hooks'];
    const hooks = this.config.hooks[hookKey] || [];
    return hooks.filter((h) => h.enabled !== false);
  }

  private shouldRunHook(hook: HookDefinition, toolName: string): boolean {
    if (!hook.tools || hook.tools.length === 0) return true;
    if (hook.tools.includes('*')) return true;
    return hook.tools.some((pattern) => {
      if (pattern.endsWith('*')) {
        return toolName.startsWith(pattern.slice(0, -1));
      }
      return toolName === pattern;
    });
  }

  private async executeHook(hook: HookDefinition, input: HookInput): Promise<HookOutput> {
    const scriptPath = this.resolveScriptPath(hook.script);
    const timeout = hook.timeout || TIMEOUT_CONFIG.HOOK_DEFAULT;

    // Check if script exists
    try {
      await stat(scriptPath);
    } catch {
      throw new Error(`Hook script not found: ${scriptPath}`);
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(scriptPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        shell: true,
      });

      this.runningProcesses.add(proc);

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        this.runningProcesses.delete(proc);

        // Handle exit codes
        if (code === EXIT_CODES.BLOCK) {
          resolve({
            action: 'block',
            reason: stderr || stdout || 'Blocked by hook',
          });
          return;
        }

        if (code === EXIT_CODES.ERROR) {
          // Log error but continue
          this.emit('hook:warning', {
            hook: hook.name,
            message: stderr || stdout || 'Hook returned error',
          });
          resolve({ action: 'continue' });
          return;
        }

        // Try to parse JSON output
        try {
          if (stdout.trim()) {
            const output = JSON.parse(stdout.trim()) as HookOutput;
            resolve(output);
          } else {
            resolve({ action: 'continue' });
          }
        } catch {
          // Non-JSON output, treat as continue
          resolve({ action: 'continue' });
        }
      });

      proc.on('error', (error) => {
        this.runningProcesses.delete(proc);
        reject(error);
      });

      // Send input via stdin
      proc.stdin?.write(JSON.stringify(input));
      proc.stdin?.end();
    });
  }

  private resolveScriptPath(script: string): string {
    // Expand ~ to home directory
    if (script.startsWith('~')) {
      return join(homedir(), script.slice(1));
    }
    // Resolve relative paths from config directory
    if (!script.startsWith('/')) {
      return resolve(dirname(this.configPath), script);
    }
    return script;
  }

  private getSessionInfo(): HookInput['session'] {
    return {
      id: this.sessionId,
      startedAt: this.sessionStartedAt,
      messageCount: this.messageCount,
    };
  }

  private generateSessionId(): string {
    // BUG FIX: Replace deprecated substr() with substring()
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private async loadConfig(): Promise<void> {
    try {
      const content = await readFile(this.configPath, 'utf-8');
      const loaded = yaml.load(content) as HookConfig;

      if (loaded?.hooks) {
        this.config = {
          hooks: {
            ...DEFAULT_CONFIG.hooks,
            ...loaded.hooks,
          },
        };
      }
    } catch {
      // File doesn't exist or is invalid, use defaults
      this.config = DEFAULT_CONFIG;
    }
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }

}

/**
 * Singleton instance
 */
let hookRunnerInstance: HookRunner | null = null;

export function getHookRunner(): HookRunner {
  if (!hookRunnerInstance) {
    hookRunnerInstance = new HookRunner();
  }
  return hookRunnerInstance;
}

export async function initializeHookRunner(): Promise<HookRunner> {
  const runner = getHookRunner();
  await runner.initialize();
  return runner;
}

export async function disposeHookRunner(): Promise<void> {
  if (hookRunnerInstance) {
    await hookRunnerInstance.dispose();
    hookRunnerInstance = null;
  }
}
