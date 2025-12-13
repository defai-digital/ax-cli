/**
 * Stream Processor
 *
 * Pure functions for processing LLM streaming chunks.
 * Extracted from use-input-handler.ts for testability.
 *
 * @packageDocumentation
 */

import type { ChatEntry } from "../../agent/llm-agent.js";
import type { LLMToolCall } from "../../llm/client.js";
import type { ToolResult } from "../../types/index.js";

/**
 * Stream chunk types from the LLM agent
 */
export type StreamChunkType =
  | "content"
  | "reasoning"
  | "token_count"
  | "tool_calls"
  | "tool_result"
  | "done"
  | "error";

/**
 * Stream chunk data
 */
export interface StreamChunk {
  type: StreamChunkType;
  content?: string;
  reasoningContent?: string;
  tokenCount?: number;
  toolCalls?: LLMToolCall[];
  toolCall?: LLMToolCall;
  toolResult?: ToolResult;
  executionDurationMs?: number;
  error?: Error;
}

/**
 * Chat history update action
 */
export interface ChatHistoryAction {
  type: "add" | "update" | "finalize";
  entry?: ChatEntry;
  updateFn?: (entries: ChatEntry[]) => ChatEntry[];
}

/**
 * Stream processor state
 */
export interface StreamProcessorState {
  /** Current streaming entry (if active) */
  streamingEntry: ChatEntry | null;
  /** Whether streaming is active */
  isStreaming: boolean;
  /** Current token count */
  tokenCount: number;
}

/**
 * Stream processing result
 */
export interface StreamProcessResult {
  /** Actions to apply to chat history */
  historyActions: ChatHistoryAction[];
  /** Updated processor state */
  state: StreamProcessorState;
  /** Whether streaming has completed */
  done: boolean;
  /** Token count update */
  tokenCount?: number;
}

/**
 * Create initial stream processor state
 */
export function createInitialState(): StreamProcessorState {
  return {
    streamingEntry: null,
    isStreaming: false,
    tokenCount: 0,
  };
}

/**
 * Process a stream chunk and return actions to apply
 */
export function processStreamChunk(
  chunk: StreamChunk,
  state: StreamProcessorState,
  processingStartTime: number
): StreamProcessResult {
  const actions: ChatHistoryAction[] = [];
  let newState = { ...state };
  let done = false;

  switch (chunk.type) {
    case "reasoning":
      if (chunk.reasoningContent) {
        const result = processReasoningChunk(chunk.reasoningContent, newState);
        actions.push(...result.actions);
        newState = result.state;
      }
      break;

    case "content":
      if (chunk.content !== undefined) {
        const result = processContentChunk(chunk.content, newState);
        actions.push(...result.actions);
        newState = result.state;
      }
      break;

    case "token_count":
      if (chunk.tokenCount !== undefined) {
        newState.tokenCount = chunk.tokenCount;
      }
      break;

    case "tool_calls":
      if (chunk.toolCalls) {
        const result = processToolCallsChunk(chunk.toolCalls, newState);
        actions.push(...result.actions);
        newState = result.state;
      }
      break;

    case "tool_result":
      if (chunk.toolCall && chunk.toolResult) {
        const result = processToolResultChunk(
          chunk.toolCall,
          chunk.toolResult,
          chunk.executionDurationMs,
          newState
        );
        actions.push(...result.actions);
        newState = result.state;
      }
      break;

    case "done":
      const doneResult = processDoneChunk(newState, processingStartTime);
      actions.push(...doneResult.actions);
      newState = doneResult.state;
      done = true;
      break;

    case "error":
      if (chunk.error) {
        actions.push({
          type: "add",
          entry: {
            type: "assistant",
            content: `Error: ${chunk.error.message}`,
            timestamp: new Date(),
          },
        });
        newState.isStreaming = false;
      }
      done = true;
      break;
  }

  return {
    historyActions: actions,
    state: newState,
    done,
    tokenCount: newState.tokenCount,
  };
}

/**
 * Process reasoning content chunk
 */
export function processReasoningChunk(
  reasoningContent: string,
  state: StreamProcessorState
): { actions: ChatHistoryAction[]; state: StreamProcessorState } {
  const actions: ChatHistoryAction[] = [];
  let newState = { ...state };

  if (!newState.streamingEntry) {
    // Create new streaming entry with reasoning
    const newEntry: ChatEntry = {
      type: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
      reasoningContent: reasoningContent,
      isReasoningStreaming: true,
    };
    actions.push({ type: "add", entry: newEntry });
    newState.streamingEntry = newEntry;
    newState.isStreaming = true;
  } else {
    // Append to existing reasoning
    actions.push({
      type: "update",
      updateFn: (entries) =>
        entries.map((entry, idx) =>
          idx === entries.length - 1 && entry.isStreaming
            ? {
                ...entry,
                reasoningContent: (entry.reasoningContent || "") + reasoningContent,
                isReasoningStreaming: true,
              }
            : entry
        ),
    });
  }

  return { actions, state: newState };
}

/**
 * Process content chunk
 */
export function processContentChunk(
  content: string,
  state: StreamProcessorState
): { actions: ChatHistoryAction[]; state: StreamProcessorState } {
  const actions: ChatHistoryAction[] = [];
  let newState = { ...state };

  // Check if we should ignore this chunk
  if (shouldIgnoreContentChunk(content, !!newState.streamingEntry)) {
    return { actions, state: newState };
  }

  if (!newState.streamingEntry) {
    // Create new streaming entry
    const newEntry: ChatEntry = {
      type: "assistant",
      content: content,
      timestamp: new Date(),
      isStreaming: true,
    };
    actions.push({ type: "add", entry: newEntry });
    newState.streamingEntry = newEntry;
    newState.isStreaming = true;
  } else {
    // Append to existing content
    actions.push({
      type: "update",
      updateFn: (entries) =>
        entries.map((entry, idx) =>
          idx === entries.length - 1 && entry.isStreaming
            ? {
                ...entry,
                content: entry.content + content,
                isReasoningStreaming: false,
              }
            : entry
        ),
    });
  }

  return { actions, state: newState };
}

/**
 * Process tool calls chunk
 */
export function processToolCallsChunk(
  toolCalls: LLMToolCall[],
  state: StreamProcessorState
): { actions: ChatHistoryAction[]; state: StreamProcessorState } {
  const actions: ChatHistoryAction[] = [];
  let newState = { ...state };

  // Finalize streaming entry with tool calls
  actions.push({
    type: "update",
    updateFn: (entries) =>
      entries.map((entry) =>
        entry.isStreaming
          ? { ...entry, isStreaming: false, toolCalls }
          : entry
      ),
  });
  newState.streamingEntry = null;

  // Add individual tool call entries
  for (const toolCall of toolCalls) {
    actions.push({
      type: "add",
      entry: {
        type: "tool_call",
        content: "Executing...",
        timestamp: new Date(),
        toolCall,
      },
    });
  }

  return { actions, state: newState };
}

/**
 * Process tool result chunk
 */
export function processToolResultChunk(
  toolCall: LLMToolCall,
  toolResult: ToolResult,
  executionDurationMs: number | undefined,
  state: StreamProcessorState
): { actions: ChatHistoryAction[]; state: StreamProcessorState } {
  const actions: ChatHistoryAction[] = [];
  let newState = { ...state };

  actions.push({
    type: "update",
    updateFn: (entries) =>
      entries.map((entry) => {
        if (entry.isStreaming) {
          return { ...entry, isStreaming: false };
        }
        if (entry.type === "tool_call" && entry.toolCall?.id === toolCall.id) {
          return {
            ...entry,
            type: "tool_result" as const,
            content: toolResult.success
              ? toolResult.output || "Success"
              : toolResult.error || "Error occurred",
            toolResult,
            executionDurationMs,
          };
        }
        return entry;
      }),
  });
  newState.streamingEntry = null;

  return { actions, state: newState };
}

/**
 * Process done chunk
 */
export function processDoneChunk(
  state: StreamProcessorState,
  processingStartTime: number
): { actions: ChatHistoryAction[]; state: StreamProcessorState } {
  const actions: ChatHistoryAction[] = [];
  let newState = { ...state };

  if (newState.streamingEntry) {
    const durationMs = processingStartTime > 0
      ? Date.now() - processingStartTime
      : undefined;

    actions.push({
      type: "update",
      updateFn: (entries) =>
        entries.map((entry) =>
          entry.isStreaming ? { ...entry, isStreaming: false, durationMs } : entry
        ),
    });
  }

  newState.streamingEntry = null;
  newState.isStreaming = false;

  return { actions, state: newState };
}

/**
 * Determine whether a streaming content chunk should be ignored.
 * We ignore whitespace-only chunks before any assistant content exists to avoid
 * creating empty assistant messages that break tool grouping.
 */
export function shouldIgnoreContentChunk(
  content: string | undefined,
  hasActiveStreamingEntry: boolean
): boolean {
  if (hasActiveStreamingEntry) return false;
  return !content || content.trim() === "";
}

/**
 * Apply chat history actions to entries array
 */
export function applyChatHistoryActions(
  entries: ChatEntry[],
  actions: ChatHistoryAction[]
): ChatEntry[] {
  let result = [...entries];

  for (const action of actions) {
    switch (action.type) {
      case "add":
        if (action.entry) {
          result = [...result, action.entry];
        }
        break;

      case "update":
        if (action.updateFn) {
          result = action.updateFn(result);
        }
        break;

      case "finalize":
        result = result.map((entry) =>
          entry.isStreaming ? { ...entry, isStreaming: false } : entry
        );
        break;
    }
  }

  return result;
}

/**
 * Format error message for display
 */
export function formatStreamError(error: Error, isTimeout: boolean = false): string {
  let message = `Error: ${error.message}`;

  if (isTimeout || error.message?.includes('timeout')) {
    message += `\n\n💡 Tip: For very long conversations, try:\n`;
    message += `   • Use /clear to start fresh and ask a more focused question\n`;
    message += `   • Break down your request into smaller parts\n`;
    message += `   • Use --continue flag to start a new session with history`;
  }

  return message;
}

/**
 * Create an error chat entry
 */
export function createErrorEntry(error: Error | string): ChatEntry {
  const message = error instanceof Error ? error.message : error;
  return {
    type: "assistant",
    content: `Error: ${message}`,
    timestamp: new Date(),
  };
}
