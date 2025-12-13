/**
 * Command Handler Types
 *
 * Shared types for slash command handlers.
 *
 * @packageDocumentation
 */

import type { LLMAgent, ChatEntry } from "../../agent/llm-agent.js";

/**
 * Context passed to all command handlers
 */
export interface CommandContext {
  /** The LLM agent instance */
  agent: LLMAgent;

  /** Current chat history */
  chatHistory: ChatEntry[];

  /** Function to update chat history */
  setChatHistory: React.Dispatch<React.SetStateAction<ChatEntry[]>>;

  /** Set processing state */
  setIsProcessing: (processing: boolean) => void;

  /** Set streaming state */
  setIsStreaming: (streaming: boolean) => void;

  /** Set token count */
  setTokenCount: (count: number) => void;

  /** Processing start time ref */
  processingStartTime: React.MutableRefObject<number>;

  /** Clear input function */
  clearInput: () => void;

  /** Current input value */
  input: string;

  /** Current verbosity level */
  verbosityLevel: number;
}

/**
 * Extended context with optional callbacks
 */
export interface CommandContextWithCallbacks extends CommandContext {
  /** Callback when chat is cleared */
  onChatCleared?: () => void;

  /** Callback when memory is warmed */
  onMemoryWarmed?: (tokens: number) => void;

  /** Callback when memory is refreshed */
  onMemoryRefreshed?: () => void;

  /** Callback when MCP dashboard is toggled */
  onMcpDashboardToggle?: () => void;

  /** Callback when keyboard help is requested */
  onKeyboardHelp?: () => void;
}

/**
 * Result of a command handler
 */
export interface CommandResult {
  /** Whether the command was handled */
  handled: boolean;

  /** Optional message to display */
  message?: string;

  /** Whether to clear input after command */
  clearInput?: boolean;
}

/**
 * Command handler function signature
 */
export type CommandHandler = (
  context: CommandContext,
  args?: string
) => Promise<CommandResult> | CommandResult;

/**
 * Add a chat entry helper
 */
export function addChatEntry(
  setChatHistory: React.Dispatch<React.SetStateAction<ChatEntry[]>>,
  entry: ChatEntry
): void {
  setChatHistory((prev) => [...prev, entry]);
}

/**
 * Create an assistant message entry
 */
export function createAssistantMessage(content: string): ChatEntry {
  return {
    type: "assistant",
    content,
    timestamp: new Date(),
  };
}

/**
 * Create a user message entry
 */
export function createUserMessage(content: string): ChatEntry {
  return {
    type: "user",
    content,
    timestamp: new Date(),
  };
}
