/**
 * Streaming Handler Hook
 *
 * Provides unified streaming chunk handling for the chat interface.
 * Handles content, tool calls, tool results, token counts, and errors.
 *
 * This hook extracts the common streaming pattern used in processUserMessage,
 * /continue, /retry, and MCP prompt execution.
 *
 * @packageDocumentation
 */

import { useRef, useCallback } from "react";
import type { ChatEntry, StreamingChunk } from "../../agent/llm-agent.js";
import type { LLMToolCall } from "../../llm/client.js";
import type { ToolResult } from "../../types/index.js";
import { extractErrorMessage } from "../../utils/error-handler.js";

/**
 * Props for useStreamingHandler hook
 */
export interface UseStreamingHandlerProps {
  /** Function to update chat history */
  setChatHistory: React.Dispatch<React.SetStateAction<ChatEntry[]>>;
  /** Function to set streaming state */
  setIsStreaming: (streaming: boolean) => void;
  /** Function to set token count */
  setTokenCount: (count: number) => void;
}

/**
 * Return type for useStreamingHandler hook
 */
export interface UseStreamingHandlerReturn {
  /** Handle a streaming chunk and update chat history */
  handleChunk: (chunk: StreamingChunk) => void;
  /** Reset streaming state for a new stream */
  resetStream: () => void;
  /** Finalize the current stream */
  finalizeStream: () => void;
  /** Add an error entry to chat history */
  addErrorEntry: (error: unknown) => void;
  /** Check if there's an active streaming entry */
  hasActiveStream: () => boolean;
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
 * Hook for handling streaming chunks in the chat interface.
 *
 * @example
 * ```tsx
 * const { handleChunk, resetStream, finalizeStream, addErrorEntry } = useStreamingHandler({
 *   setChatHistory,
 *   setIsStreaming,
 *   setTokenCount,
 * });
 *
 * // In streaming loop:
 * resetStream();
 * for await (const chunk of agent.processUserMessageStream(message)) {
 *   handleChunk(chunk);
 * }
 * finalizeStream();
 * ```
 */
export function useStreamingHandler({
  setChatHistory,
  setIsStreaming,
  setTokenCount,
}: UseStreamingHandlerProps): UseStreamingHandlerReturn {
  // Track if we have an active streaming entry
  const streamingEntryRef = useRef<boolean>(false);

  /**
   * Reset streaming state for a new stream
   */
  const resetStream = useCallback(() => {
    streamingEntryRef.current = false;
  }, []);

  /**
   * Handle content chunk
   */
  const handleContentChunk = useCallback((content: string | undefined) => {
    if (shouldIgnoreContentChunk(content, streamingEntryRef.current)) {
      return;
    }

    const contentChunk = content || "";

    if (!streamingEntryRef.current) {
      // Create new streaming entry
      const newStreamingEntry: ChatEntry = {
        type: "assistant",
        content: contentChunk,
        timestamp: new Date(),
        isStreaming: true,
      };
      setChatHistory((prev) => [...prev, newStreamingEntry]);
      streamingEntryRef.current = true;
    } else {
      // Append to existing streaming entry
      setChatHistory((prev) =>
        prev.map((entry, idx) =>
          idx === prev.length - 1 && entry.isStreaming
            ? { ...entry, content: entry.content + contentChunk }
            : entry
        )
      );
    }
  }, [setChatHistory]);

  /**
   * Handle tool calls chunk
   */
  const handleToolCallsChunk = useCallback((toolCalls: LLMToolCall[]) => {
    // Stop streaming for the current assistant message
    setChatHistory((prev) =>
      prev.map((entry) =>
        entry.isStreaming
          ? {
              ...entry,
              isStreaming: false,
              toolCalls: toolCalls,
            }
          : entry
      )
    );
    streamingEntryRef.current = false;

    // Add individual tool call entries to show tools are being executed
    toolCalls.forEach((toolCall) => {
      const toolCallEntry: ChatEntry = {
        type: "tool_call",
        content: "Executing...",
        timestamp: new Date(),
        toolCall: toolCall,
      };
      setChatHistory((prev) => [...prev, toolCallEntry]);
    });
  }, [setChatHistory]);

  /**
   * Handle tool result chunk
   */
  const handleToolResultChunk = useCallback((
    toolCall: LLMToolCall,
    toolResult: ToolResult,
    executionDurationMs?: number
  ) => {
    setChatHistory((prev) =>
      prev.map((entry) => {
        if (entry.isStreaming) {
          return { ...entry, isStreaming: false };
        }
        // Update the existing tool_call entry with the result
        if (
          entry.type === "tool_call" &&
          entry.toolCall?.id === toolCall.id
        ) {
          return {
            ...entry,
            type: "tool_result" as const,
            content: toolResult.success
              ? toolResult.output || "Success"
              : toolResult.error || "Error occurred",
            toolResult: toolResult,
            executionDurationMs: executionDurationMs,
          };
        }
        return entry;
      })
    );
    streamingEntryRef.current = false;
  }, [setChatHistory]);

  /**
   * Handle done chunk
   */
  const handleDoneChunk = useCallback(() => {
    if (streamingEntryRef.current) {
      setChatHistory((prev) =>
        prev.map((entry) =>
          entry.isStreaming ? { ...entry, isStreaming: false } : entry
        )
      );
    }
    setIsStreaming(false);
    streamingEntryRef.current = false;
  }, [setChatHistory, setIsStreaming]);

  /**
   * Handle a streaming chunk and update chat history
   */
  const handleChunk = useCallback((chunk: StreamingChunk) => {
    switch (chunk.type) {
      case "content":
        handleContentChunk(chunk.content);
        break;

      case "token_count":
        if (chunk.tokenCount !== undefined) {
          setTokenCount(chunk.tokenCount);
        }
        break;

      case "tool_calls":
        if (chunk.toolCalls) {
          handleToolCallsChunk(chunk.toolCalls);
        }
        break;

      case "tool_result":
        if (chunk.toolCall && chunk.toolResult) {
          handleToolResultChunk(
            chunk.toolCall,
            chunk.toolResult,
            chunk.executionDurationMs
          );
        }
        break;

      case "done":
        handleDoneChunk();
        break;

      case "reasoning":
        // Reasoning chunks are handled separately (thinking mode)
        if (chunk.reasoningContent) {
          // Update or create reasoning entry
          if (!streamingEntryRef.current) {
            const reasoningEntry: ChatEntry = {
              type: "assistant",
              content: "",
              timestamp: new Date(),
              isStreaming: true,
              reasoningContent: chunk.reasoningContent,
              isReasoningStreaming: true,
            };
            setChatHistory((prev) => [...prev, reasoningEntry]);
            streamingEntryRef.current = true;
          } else {
            setChatHistory((prev) =>
              prev.map((entry, idx) =>
                idx === prev.length - 1 && entry.isStreaming
                  ? {
                      ...entry,
                      reasoningContent: (entry.reasoningContent || "") + chunk.reasoningContent,
                      isReasoningStreaming: true,
                    }
                  : entry
              )
            );
          }
        }
        break;
    }
  }, [handleContentChunk, handleToolCallsChunk, handleToolResultChunk, handleDoneChunk, setTokenCount, setChatHistory]);

  /**
   * Finalize the current stream
   */
  const finalizeStream = useCallback(() => {
    if (streamingEntryRef.current) {
      setChatHistory((prev) =>
        prev.map((entry) =>
          entry.isStreaming
            ? { ...entry, isStreaming: false, isReasoningStreaming: false }
            : entry
        )
      );
    }
    setIsStreaming(false);
    streamingEntryRef.current = false;
  }, [setChatHistory, setIsStreaming]);

  /**
   * Add an error entry to chat history
   */
  const addErrorEntry = useCallback((error: unknown) => {
    const errorMessage = extractErrorMessage(error);
    const errorEntry: ChatEntry = {
      type: "assistant",
      content: `Error: ${errorMessage}`,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, errorEntry]);
    setIsStreaming(false);
    streamingEntryRef.current = false;
  }, [setChatHistory, setIsStreaming]);

  /**
   * Check if there's an active streaming entry
   */
  const hasActiveStream = useCallback(() => {
    return streamingEntryRef.current;
  }, []);

  return {
    handleChunk,
    resetStream,
    finalizeStream,
    addErrorEntry,
    hasActiveStream,
  };
}

/**
 * Process a stream and handle all chunks
 * Utility function for simpler streaming scenarios
 */
export async function processStream(
  stream: AsyncIterable<StreamingChunk>,
  handler: UseStreamingHandlerReturn
): Promise<void> {
  handler.resetStream();
  try {
    for await (const chunk of stream) {
      handler.handleChunk(chunk);
    }
    handler.finalizeStream();
  } catch (error) {
    handler.addErrorEntry(error);
    throw error;
  }
}
