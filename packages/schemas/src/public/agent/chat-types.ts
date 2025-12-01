/**
 * @ax-cli/schemas - Agent Chat Types
 *
 * Single Source of Truth (SSOT) for agent chat-related types.
 * These types are used across the agent, UI, checkpoint, and SDK modules.
 *
 * @packageDocumentation
 */

/**
 * LLM Tool Call representation
 *
 * Represents a tool call made by the LLM during a conversation.
 * This is a simplified version that doesn't depend on OpenAI types.
 */
export interface LLMToolCallRef {
  /** Unique identifier for this tool call */
  id: string;
  /** Type of tool call (always "function" for now) */
  type: "function";
  /** Function details */
  function: {
    /** Name of the function to call */
    name: string;
    /** JSON-encoded arguments string */
    arguments: string;
  };
}

/**
 * Tool execution result
 *
 * Represents the result of executing a tool.
 */
export interface ToolResultRef {
  /** Whether the tool execution succeeded */
  success: boolean;
  /** Output from successful execution */
  output?: string;
  /** Error message if execution failed */
  error?: string;
  /** Additional structured data from the tool */
  data?: Record<string, unknown>;
}

/**
 * Chat Entry
 *
 * Represents a single entry in the chat history between user and assistant.
 * This is the canonical definition - DO NOT duplicate this type elsewhere.
 *
 * @example
 * ```typescript
 * const userMessage: ChatEntry = {
 *   type: "user",
 *   content: "Hello, how are you?",
 *   timestamp: new Date(),
 * };
 *
 * const assistantMessage: ChatEntry = {
 *   type: "assistant",
 *   content: "I'm doing well, thank you!",
 *   timestamp: new Date(),
 *   durationMs: 1500,
 * };
 * ```
 */
export interface ChatEntry {
  /** Type of chat entry */
  type: "user" | "assistant" | "tool_result" | "tool_call";

  /** Text content of the entry */
  content: string;

  /** When this entry was created */
  timestamp: Date;

  /** Tool calls made by assistant (for type="assistant") */
  toolCalls?: LLMToolCallRef[];

  /** Single tool call (for type="tool_call") */
  toolCall?: LLMToolCallRef;

  /** Result of tool execution (for type="tool_result") */
  toolResult?: { success: boolean; output?: string; error?: string };

  /** Whether content is currently streaming */
  isStreaming?: boolean;

  /** GLM-4.6 reasoning content (thinking mode) */
  reasoningContent?: string;

  /** Whether reasoning is currently streaming */
  isReasoningStreaming?: boolean;

  /** Response duration in milliseconds */
  durationMs?: number;

  /** Tool execution start time (for elapsed time display while running) */
  executionStartTime?: Date;

  /** Tool execution duration in milliseconds (shown after completion) */
  executionDurationMs?: number;
}

/**
 * Streaming Chunk Types
 *
 * Represents different types of streaming chunks that can be received
 * during a streaming response from the LLM.
 */
export type StreamingChunkType =
  | "content"
  | "reasoning"
  | "tool_calls"
  | "tool_result"
  | "done"
  | "token_count";

/**
 * Streaming Chunk
 *
 * Represents a chunk of data received during streaming response.
 * Used by UI components to render incremental updates.
 *
 * @example
 * ```typescript
 * // Content chunk
 * const contentChunk: StreamingChunk = {
 *   type: "content",
 *   content: "Hello",
 * };
 *
 * // Tool result chunk
 * const toolResultChunk: StreamingChunk = {
 *   type: "tool_result",
 *   toolResult: { success: true, output: "File created" },
 *   executionDurationMs: 150,
 * };
 * ```
 */
export interface StreamingChunk {
  /** Type of streaming chunk */
  type: StreamingChunkType;

  /** Text content (for type="content") */
  content?: string;

  /** GLM-4.6 reasoning content chunk (for type="reasoning") */
  reasoningContent?: string;

  /** Tool calls from LLM (for type="tool_calls") */
  toolCalls?: LLMToolCallRef[];

  /** Single tool call */
  toolCall?: LLMToolCallRef;

  /** Tool execution result (for type="tool_result") */
  toolResult?: ToolResultRef;

  /** Token count (for type="token_count") */
  tokenCount?: number;

  /** Tool execution duration in milliseconds (for type="tool_result") */
  executionDurationMs?: number;
}

/**
 * Accumulated Message
 *
 * Contains the full message content accumulated from streaming response.
 * Used internally by the agent to build complete messages from chunks.
 */
export interface AccumulatedMessage {
  /** Message role (e.g., "assistant") */
  role?: string;

  /** Full accumulated content */
  content?: string;

  /** Tool calls accumulated from the response */
  tool_calls?: LLMToolCallRef[];

  /** Allow additional properties for flexibility */
  [key: string]: unknown;
}

/**
 * Chat History
 *
 * Type alias for an array of chat entries.
 */
export type ChatHistory = ChatEntry[];
