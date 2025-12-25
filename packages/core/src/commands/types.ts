/**
 * Command System Types
 *
 * Defines the types for the slash command registry system.
 * This enables modular, testable command handlers with consistent patterns.
 *
 * @packageDocumentation
 */

import type { LLMAgent, ChatEntry } from "../agent/llm-agent.js";
import type { SettingsManager } from "../utils/settings-manager.js";
import type { ProviderDefinition, ProviderConfigPaths } from "../provider/config.js";

/**
 * Command categories for grouping and organization
 */
export type CommandCategory =
  | "session" // /clear, /exit, /continue, /retry
  | "memory" // /memory commands
  | "tasks" // /tasks, /task, /kill
  | "settings" // /model, /theme, /permissions
  | "project" // /init, /commit-and-push
  | "info" // /help, /usage, /doctor, /shortcuts
  | "mcp" // /mcp commands
  | "plan"; // /plan, /phases, /pause, /resume, /skip, /abandon

/**
 * Context passed to command handlers
 *
 * Contains all dependencies a command handler might need.
 * Handlers should only use what they need from this context.
 */
export interface CommandContext {
  /** The LLM agent instance for AI operations */
  agent: LLMAgent;

  /** Settings manager for user/project configuration */
  settings: SettingsManager;

  /** Current provider definition (GLM, Grok, etc.) */
  provider: ProviderDefinition;

  /** Configuration paths for the active provider */
  configPaths: ProviderConfigPaths;

  /** Current input value */
  input: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // State Setters (for commands that need to update UI state)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Update chat history */
  setChatHistory: (updater: (prev: ChatEntry[]) => ChatEntry[]) => void;

  /** Set processing state */
  setIsProcessing: (value: boolean) => void;

  /** Set streaming state */
  setIsStreaming: (value: boolean) => void;

  /** Clear the input field */
  clearInput: () => void;

  /** Set input field value */
  setInput: (value: string) => void;

  /** Reset chat history */
  resetHistory: () => void;

  // ═══════════════════════════════════════════════════════════════════════════
  // Optional Callbacks (UI notifications)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Called when memory warmup completes */
  onMemoryWarmed?: (tokens: number) => void;

  /** Called when memory refresh completes */
  onMemoryRefreshed?: () => void;

  /** Called to toggle MCP dashboard */
  onMcpDashboardToggle?: () => void;

  /** Called when chat is cleared */
  onChatCleared?: () => void;

  /** Called when an operation is interrupted */
  onOperationInterrupted?: () => void;

  /** Called when external editor succeeds */
  onEditorSuccess?: () => void;

  // ═══════════════════════════════════════════════════════════════════════════
  // Timing (for performance tracking)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Reference to processing start time */
  processingStartTime?: React.MutableRefObject<number>;

  /** Set token count */
  setTokenCount?: (count: number) => void;

  /** Set processing time */
  setProcessingTime?: (time: number) => void;
}

/**
 * Result returned by command handlers
 *
 * Commands return this to indicate what should happen after execution.
 */
export interface CommandResult {
  /** Whether the command was recognized and handled */
  handled: boolean;

  /** Chat entries to add to history */
  entries?: ChatEntry[];

  /** Whether to clear the input field after execution */
  clearInput?: boolean;

  /** Whether to set processing state (for long-running operations) */
  setProcessing?: boolean;

  /** Async action to execute (for deferred/non-blocking operations) */
  asyncAction?: () => Promise<void>;

  /** Error message if command failed */
  error?: string;

  /**
   * Whether the command handled its own state updates
   * If true, the dispatcher won't apply standard state changes
   */
  handledStateUpdates?: boolean;
}

/**
 * Command handler function signature
 *
 * Takes the command arguments (everything after the command name)
 * and the context, returns a result or promise of result.
 */
export type CommandHandler = (
  args: string,
  ctx: CommandContext
) => CommandResult | Promise<CommandResult>;

/**
 * Command definition for registration
 */
export interface CommandDefinition {
  /** Command name without the leading slash (e.g., "model", "help") */
  name: string;

  /** Alternative names for this command */
  aliases?: string[];

  /** Human-readable description for help text */
  description: string;

  /** Category for grouping in help/suggestions */
  category: CommandCategory;

  /** The handler function */
  handler: CommandHandler;

  /**
   * Whether this command requires arguments
   * Used for validation and help text
   */
  requiresArgs?: boolean;

  /**
   * Usage examples for help text
   * e.g., ["/model save", "/model glm-4.7"]
   */
  examples?: string[];

  /**
   * Whether this command is hidden from suggestions
   * Useful for deprecated or internal commands
   */
  hidden?: boolean;
}

/**
 * Command suggestion for autocomplete
 */
export interface CommandSuggestion {
  /** The command string (e.g., "/model") - used for Tab completion */
  command: string;

  /** Display text with aliases (e.g., "/model, /m") - falls back to command if not set */
  displayCommand?: string;

  /** Description for display */
  description: string;

  /** Category for grouping */
  category?: CommandCategory;
}

/**
 * Result of parsing a slash command
 */
export interface ParsedCommand {
  /** The command name without slash (e.g., "model") */
  command: string;

  /** The full command with slash (e.g., "/model") */
  fullCommand: string;

  /** Arguments after the command name */
  args: string;

  /** Whether this looks like a slash command */
  isSlashCommand: boolean;
}

/**
 * Registry statistics for debugging/monitoring
 */
export interface RegistryStats {
  /** Total registered commands */
  commandCount: number;

  /** Total registered aliases */
  aliasCount: number;

  /** Commands by category */
  byCategory: Record<CommandCategory, number>;
}
