/**
 * Hooks Manager
 *
 * Manages loading, registration, and execution of hooks.
 *
 * @packageDocumentation
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as yaml from "js-yaml";
import type {
  AnyHookConfig,
  HooksConfig,
  HookEventType,
  HookInput,
  HookOutput,
  HookExecutionResult,
  CommandHookConfig,
} from "./types.js";
import { extractErrorMessage } from "../utils/error-handler.js";

/** Default hook timeout in milliseconds */
const DEFAULT_HOOK_TIMEOUT = 60000;

/** Config file names to check */
const CONFIG_FILE_NAMES = ["hooks.json", "hooks.yaml", "hooks.yml"];

/**
 * Hooks Manager
 *
 * Singleton that manages hook registration and execution.
 */
export class HooksManager {
  private static instance: HooksManager | null = null;
  private hooks: AnyHookConfig[] = [];
  private registeredHooks: AnyHookConfig[] = []; // Hooks added via registerHook()
  private projectDir: string;
  private userDir: string;
  private initialized: boolean = false;

  private constructor() {
    this.projectDir = process.cwd();
    this.userDir = path.join(os.homedir(), ".ax-cli");
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): HooksManager {
    if (!HooksManager.instance) {
      HooksManager.instance = new HooksManager();
    }
    return HooksManager.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static reset(): void {
    HooksManager.instance = null;
  }

  /**
   * Register a hook programmatically
   * These hooks are preserved across ensureInitialized() calls
   */
  registerHook(hook: AnyHookConfig): void {
    this.registeredHooks.push(hook);
    this.hooks.push(hook);
  }

  /**
   * Ensure hooks are initialized (lazy init)
   */
  private ensureInitialized(): void {
    if (this.initialized) return;

    // Start with programmatically registered hooks (preserve them)
    this.hooks = [...this.registeredHooks];

    // Load hooks from project directory (.ax-cli/hooks.json or .yaml)
    const projectHooksDir = path.join(this.projectDir, ".ax-cli");
    this.loadHooksFromDirectory(projectHooksDir);

    // Load hooks from user directory (~/.ax-cli/hooks.json or .yaml)
    this.loadHooksFromDirectory(this.userDir);

    this.initialized = true;
  }

  /**
   * Load hooks from a directory, trying each config file name
   */
  private loadHooksFromDirectory(dir: string): void {
    for (const fileName of CONFIG_FILE_NAMES) {
      const filePath = path.join(dir, fileName);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const config = this.parseConfigFile(content, fileName);
          if (config?.hooks) {
            this.hooks.push(...config.hooks);
          }
          break; // Stop after first valid config found
        } catch (error) {
          console.warn(`Failed to load hooks from ${filePath}:`, extractErrorMessage(error));
        }
      }
    }
  }

  /**
   * Parse config file content based on file extension
   */
  private parseConfigFile(content: string, fileName: string): HooksConfig | null {
    if (fileName.endsWith(".yaml") || fileName.endsWith(".yml")) {
      return yaml.load(content) as HooksConfig;
    }
    return JSON.parse(content) as HooksConfig;
  }

  /**
   * Get all hooks for a specific event type
   */
  getHooksForEvent(event: HookEventType, toolName?: string): AnyHookConfig[] {
    this.ensureInitialized();
    return this.hooks.filter((hook) => {
      if (hook.event !== event) return false;
      if (hook.enabled === false) return false;

      // For tool-related events, check tool pattern
      if ((event === "PreToolUse" || event === "PostToolUse") && toolName) {
        if (hook.toolPattern) {
          return this.matchToolPattern(toolName, hook.toolPattern);
        }
      }

      return true;
    });
  }

  /**
   * Match a tool name against a glob pattern
   */
  private matchToolPattern(toolName: string, pattern: string): boolean {
    // Simple glob matching: * matches any characters
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
      .replace(/\*/g, ".*"); // Convert * to .*
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(toolName);
  }

  /**
   * Execute hooks for an event
   */
  async executeHooks(
    event: HookEventType,
    input: HookInput
  ): Promise<HookExecutionResult[]> {
    const toolName = input.toolCall?.name;
    const hooks = this.getHooksForEvent(event, toolName);

    if (hooks.length === 0) {
      return [];
    }

    // Execute all matching hooks in parallel
    const results = await Promise.all(
      hooks.map((hook) => this.executeHook(hook, input))
    );

    return results;
  }

  /**
   * Execute a single hook
   */
  private async executeHook(
    hook: AnyHookConfig,
    input: HookInput
  ): Promise<HookExecutionResult> {
    const startTime = Date.now();

    try {
      if (hook.type === "command") {
        return await this.executeCommandHook(hook as CommandHookConfig, input);
      } else {
        // Prompt hooks would require LLM integration
        // For now, return a placeholder
        return {
          success: false,
          error: "Prompt hooks not yet implemented",
          durationMs: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: extractErrorMessage(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a command hook
   */
  private async executeCommandHook(
    hook: CommandHookConfig,
    input: HookInput
  ): Promise<HookExecutionResult> {
    const startTime = Date.now();
    const timeout = hook.timeout || DEFAULT_HOOK_TIMEOUT;

    return new Promise((resolve) => {
      const env = {
        ...process.env,
        ...hook.env,
        AXCLI_PROJECT_DIR: input.projectDir,
        AXCLI_EVENT: input.event,
        AXCLI_HOOK_INPUT: JSON.stringify(input),
      };

      const child = spawn(hook.command, [], {
        shell: true,
        cwd: hook.cwd || input.projectDir,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      // Handle stdin errors (e.g., if child closes stdin early)
      if (child.stdin.on) {
        child.stdin.on("error", () => {
          // Ignore stdin errors - child may have closed before we finished writing
        });
      }

      // Send input as JSON to stdin
      try {
        child.stdin.write(JSON.stringify(input));
        child.stdin.end();
      } catch {
        // Ignore write errors - child may have already exited
      }

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeout);

      // BUG FIX: Handle spawn errors (e.g., command not found, permission denied)
      // Without this handler, spawn errors would be unhandled and could crash the process
      child.on("error", (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: `Hook execution failed: ${error.message}`,
          durationMs: Date.now() - startTime,
        });
      });

      child.on("close", (code) => {
        clearTimeout(timeoutId);

        if (timedOut) {
          resolve({
            success: false,
            error: `Hook timed out after ${timeout}ms`,
            durationMs: Date.now() - startTime,
          });
          return;
        }

        // Parse output for special fields
        let output: HookOutput = {
          exitCode: code || 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        };

        // Try to parse JSON output for structured response
        try {
          if (stdout.trim().startsWith("{")) {
            const parsed = JSON.parse(stdout.trim());
            if (parsed.permissionDecision) {
              output.permissionDecision = parsed.permissionDecision;
            }
            if (parsed.updatedInput) {
              output.updatedInput = parsed.updatedInput;
            }
          }
        } catch {
          // Not JSON, use raw output
        }

        resolve({
          success: code === 0,
          output,
          durationMs: Date.now() - startTime,
        });
      });

      child.on("error", (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: extractErrorMessage(error),
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Check if any PreToolUse hook blocks the tool execution
   */
  async shouldBlockTool(
    toolName: string,
    toolArgs: Record<string, unknown>,
    toolId: string
  ): Promise<{ blocked: boolean; reason?: string }> {
    const input: HookInput = {
      event: "PreToolUse",
      projectDir: this.projectDir,
      timestamp: new Date().toISOString(),
      toolCall: {
        name: toolName,
        arguments: toolArgs,
        id: toolId,
      },
    };

    const results = await this.executeHooks("PreToolUse", input);

    for (const result of results) {
      // Exit code 2 means explicit block (check before success check)
      if (result.output?.exitCode === 2) {
        return {
          blocked: true,
          reason: result.output.stderr || result.output.stdout || "Blocked by hook",
        };
      }

      if (!result.success) {
        // Hook execution failed - treat as non-blocking but log
        console.warn(`PreToolUse hook failed: ${result.error}`);
        continue;
      }

      // Check for explicit denial via JSON output
      if (result.output?.permissionDecision === "deny") {
        return {
          blocked: true,
          reason: result.output.stderr || result.output.stdout || "Blocked by hook",
        };
      }
    }

    return { blocked: false };
  }

  /**
   * Process user input through UserPromptSubmit hooks
   */
  async processUserInput(userInput: string): Promise<string> {
    const input: HookInput = {
      event: "UserPromptSubmit",
      projectDir: this.projectDir,
      timestamp: new Date().toISOString(),
      userInput,
    };

    const results = await this.executeHooks("UserPromptSubmit", input);

    // Check for modified input from any hook
    for (const result of results) {
      if (result.success && result.output?.updatedInput) {
        return result.output.updatedInput;
      }
    }

    return userInput;
  }

  /**
   * Execute PostToolUse hooks (fire-and-forget)
   * BUG FIX: Removed misleading async keyword since this is intentionally fire-and-forget
   * The function dispatches hooks but doesn't wait for completion
   */
  executePostToolHooks(
    toolName: string,
    toolArgs: Record<string, unknown>,
    toolId: string,
    toolResult: import("../types/index.js").ToolResult
  ): void {
    const input: HookInput = {
      event: "PostToolUse",
      projectDir: this.projectDir,
      timestamp: new Date().toISOString(),
      toolCall: {
        name: toolName,
        arguments: toolArgs,
        id: toolId,
      },
      toolResult,
    };

    // Execute hooks but don't wait for them (intentional fire-and-forget)
    // Error handling is done via .catch() to prevent unhandled rejection
    this.executeHooks("PostToolUse", input).catch((error) => {
      console.warn("PostToolUse hook error:", extractErrorMessage(error));
    });
  }

  /**
   * Get the list of registered hooks
   */
  getHooks(): AnyHookConfig[] {
    this.ensureInitialized();
    return [...this.hooks];
  }

  /**
   * Clear all hooks
   */
  clearHooks(): void {
    this.hooks = [];
    this.registeredHooks = [];
    this.initialized = false;
  }
}

/**
 * Get the singleton hooks manager instance
 */
export function getHooksManager(): HooksManager {
  return HooksManager.getInstance();
}
