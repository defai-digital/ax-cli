/**
 * Hooks System Types
 *
 * Event-driven hooks for customizing tool execution and user interaction.
 *
 * @packageDocumentation
 */

import type { ToolResult } from "../types/index.js";

/**
 * Hook event types
 */
export type HookEventType =
  | "PreToolUse"
  | "PostToolUse"
  | "UserPromptSubmit"
  | "Notification"
  | "Stop";

/**
 * Hook type - shell command or prompt-based
 */
export type HookType = "command" | "prompt";

/**
 * Hook decision for PreToolUse hooks
 */
export interface HookDecision {
  /** Whether to allow the tool execution */
  allow: boolean;
  /** Optional reason for blocking */
  reason?: string;
  /** Optional modified input (for UserPromptSubmit) */
  modifiedInput?: string;
}

/**
 * Base hook configuration
 */
export interface HookConfig {
  /** Unique identifier for this hook */
  id?: string;
  /** Event type that triggers this hook */
  event: HookEventType;
  /** Hook type: command (shell) or prompt (LLM evaluation) */
  type: HookType;
  /** Glob pattern to match tool names (for PreToolUse/PostToolUse) */
  toolPattern?: string;
  /** Whether this hook is enabled */
  enabled?: boolean;
  /** Timeout in milliseconds (default: 60000) */
  timeout?: number;
}

/**
 * Shell command hook configuration
 */
export interface CommandHookConfig extends HookConfig {
  type: "command";
  /** Shell command to execute */
  command: string;
  /** Working directory for the command */
  cwd?: string;
  /** Environment variables to set */
  env?: Record<string, string>;
}

/**
 * Prompt-based hook configuration (uses Claude Haiku for evaluation)
 */
export interface PromptHookConfig extends HookConfig {
  type: "prompt";
  /** Prompt template for LLM evaluation */
  prompt: string;
  /** Model to use (default: haiku for speed) */
  model?: string;
}

/**
 * Union type for all hook configurations
 */
export type AnyHookConfig = CommandHookConfig | PromptHookConfig;

/**
 * Hook input data passed to hook execution
 */
export interface HookInput {
  /** The event type */
  event: HookEventType;
  /** Session ID */
  sessionId?: string;
  /** Project directory */
  projectDir: string;
  /** Timestamp */
  timestamp: string;
  /** Tool call information (for PreToolUse/PostToolUse) */
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
    id: string;
  };
  /** Tool result (for PostToolUse) */
  toolResult?: ToolResult;
  /** User input (for UserPromptSubmit) */
  userInput?: string;
  /** Notification message (for Notification) */
  message?: string;
}

/**
 * Hook output data returned from hook execution
 */
export interface HookOutput {
  /** Exit code (0 = success, 2 = blocking error) */
  exitCode: number;
  /** Standard output */
  stdout?: string;
  /** Standard error */
  stderr?: string;
  /** Permission decision (for PreToolUse) */
  permissionDecision?: "allow" | "deny";
  /** Updated input (for UserPromptSubmit) */
  updatedInput?: string;
  /** Error message */
  error?: string;
}

/**
 * Hooks configuration file structure
 */
export interface HooksConfig {
  /** Version of the hooks config schema */
  version?: string;
  /** Array of hook configurations */
  hooks: AnyHookConfig[];
}

/**
 * Hook execution result
 */
export interface HookExecutionResult {
  /** Whether the hook executed successfully */
  success: boolean;
  /** Hook output */
  output?: HookOutput;
  /** Error if execution failed */
  error?: string;
  /** Execution duration in milliseconds */
  durationMs?: number;
}
