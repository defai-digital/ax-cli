/**
 * Chat Entry Builder Functions
 *
 * Pure utility functions for creating ChatEntry objects.
 * Centralizes chat entry creation to reduce duplication and improve consistency.
 *
 * @packageDocumentation
 */

import type { ChatEntry, StreamingChunk } from "../../agent/core/types.js";
import type { LLMToolCall } from "../../llm/client.js";
import type { ToolResult } from "../../types/index.js";

/**
 * Create a user message entry
 */
export function createUserEntry(content: string, attachments?: string[]): ChatEntry {
  return {
    type: "user",
    content,
    timestamp: new Date(),
    ...(attachments && attachments.length > 0 && { attachments }),
  };
}

/**
 * Create an assistant message entry
 */
export function createAssistantEntry(content: string): ChatEntry {
  return {
    type: "assistant",
    content,
    timestamp: new Date(),
  };
}

/**
 * Create an empty streaming assistant entry
 */
export function createStreamingEntry(initialContent = ""): ChatEntry {
  return {
    type: "assistant",
    content: initialContent,
    timestamp: new Date(),
    isStreaming: true,
  };
}

/**
 * Create a streaming entry with reasoning content
 */
export function createReasoningStreamingEntry(reasoningContent: string): ChatEntry {
  return {
    type: "assistant",
    content: "",
    timestamp: new Date(),
    isStreaming: true,
    reasoningContent,
    isReasoningStreaming: true,
  };
}

/**
 * Create a tool call entry
 */
export function createToolCallEntry(toolCall: LLMToolCall): ChatEntry {
  return {
    type: "tool_call",
    content: "Executing...",
    timestamp: new Date(),
    toolCall,
  };
}

/**
 * Create a tool result entry from an existing tool call entry
 */
export function createToolResultEntry(
  toolCall: LLMToolCall,
  toolResult: ToolResult,
  executionDurationMs?: number
): ChatEntry {
  return {
    type: "tool_result",
    content: toolResult.success
      ? toolResult.output || "Success"
      : toolResult.error || "Error occurred",
    timestamp: new Date(),
    toolCall,
    toolResult,
    ...(executionDurationMs !== undefined && { executionDurationMs }),
  };
}

/**
 * Create a system/info message entry
 */
export function createSystemEntry(content: string): ChatEntry {
  return {
    type: "assistant",
    content,
    timestamp: new Date(),
  };
}

/**
 * Create an error message entry
 */
export function createErrorEntry(error: string | Error): ChatEntry {
  const errorMessage = error instanceof Error ? error.message : error;
  return {
    type: "assistant",
    content: `Error: ${errorMessage}`,
    timestamp: new Date(),
  };
}

/**
 * Update a streaming entry with new content
 */
export function updateStreamingContent(entry: ChatEntry, newContent: string): ChatEntry {
  return {
    ...entry,
    content: entry.content + newContent,
    isReasoningStreaming: false,
  };
}

/**
 * Update a streaming entry with reasoning content
 */
export function updateStreamingReasoning(entry: ChatEntry, newReasoning: string): ChatEntry {
  return {
    ...entry,
    reasoningContent: (entry.reasoningContent || "") + newReasoning,
    isReasoningStreaming: true,
  };
}

/**
 * Mark a streaming entry as complete
 */
export function completeStreamingEntry(
  entry: ChatEntry,
  toolCalls?: LLMToolCall[]
): ChatEntry {
  return {
    ...entry,
    isStreaming: false,
    isReasoningStreaming: false,
    ...(toolCalls && { toolCalls }),
  };
}

/**
 * Transform a tool_call entry to tool_result entry
 */
export function transformToToolResult(
  entry: ChatEntry,
  toolResult: ToolResult,
  executionDurationMs?: number
): ChatEntry {
  if (entry.type !== "tool_call") {
    return entry;
  }
  return {
    ...entry,
    type: "tool_result",
    content: toolResult.success
      ? toolResult.output || "Success"
      : toolResult.error || "Error occurred",
    toolResult,
    ...(executionDurationMs !== undefined && { executionDurationMs }),
  };
}

/**
 * Check if an entry is actively streaming
 */
export function isStreamingEntry(entry: ChatEntry): boolean {
  return entry.isStreaming === true;
}

/**
 * Check if an entry is a tool call waiting for result
 */
export function isToolCallEntry(entry: ChatEntry): boolean {
  return entry.type === "tool_call";
}

/**
 * Process a streaming chunk and return updated entry (if applicable)
 * Returns null if chunk should be ignored
 */
export function processContentChunk(
  chunk: StreamingChunk,
  currentEntry: ChatEntry | null
): ChatEntry | null {
  if (chunk.type !== "content" || !chunk.content) {
    return null;
  }

  if (!currentEntry) {
    return createStreamingEntry(chunk.content);
  }

  return updateStreamingContent(currentEntry, chunk.content);
}

/**
 * Process a reasoning chunk and return updated entry (if applicable)
 * Returns null if chunk should be ignored
 */
export function processReasoningChunk(
  chunk: StreamingChunk,
  currentEntry: ChatEntry | null
): ChatEntry | null {
  if (chunk.type !== "reasoning" || !chunk.reasoningContent) {
    return null;
  }

  if (!currentEntry) {
    return createReasoningStreamingEntry(chunk.reasoningContent);
  }

  return updateStreamingReasoning(currentEntry, chunk.reasoningContent);
}
