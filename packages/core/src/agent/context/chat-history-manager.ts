/**
 * Chat History Manager
 *
 * Manages chat history state including tool call indexing and restoration.
 * Provides O(1) tool call lookups via index map.
 *
 * @packageDocumentation
 */

import type { ChatEntry } from "../core/types.js";
import type { LLMMessage, LLMToolCall } from "../../llm/client.js";
import type { ToolResult } from "../../types/index.js";

/**
 * Configuration for ChatHistoryManager
 */
export interface ChatHistoryManagerConfig {
  /** Maximum entries to keep in history (default: 200) */
  maxEntries?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Manages chat history with tool call indexing for O(1) lookups.
 *
 * Features:
 * - Maintains chat history array
 * - Tool call index map for fast lookup
 * - Tool call args caching for loop detection
 * - Restoration from saved history
 * - Rewind to checkpoint support
 *
 * @example
 * ```typescript
 * const manager = new ChatHistoryManager();
 *
 * // Add entries
 * manager.addEntry({ type: 'user', content: 'Hello', timestamp: new Date() });
 *
 * // Add tool call
 * manager.addToolCall(toolCall);
 *
 * // Update with result
 * manager.updateToolResult(toolCall.id, result, 150);
 *
 * // Restore from saved history
 * manager.restoreFromEntries(savedEntries);
 * ```
 */
export class ChatHistoryManager {
  /** Chat history entries */
  private chatHistory: ChatEntry[] = [];

  /** Tool call ID to chat history index map for O(1) updates */
  private toolCallIndexMap: Map<string, number> = new Map();

  /** Cache for parsed tool call arguments (for loop detection) */
  private toolCallArgsCache: Map<string, Record<string, unknown>> = new Map();

  /** Configuration */
  private config: Required<ChatHistoryManagerConfig>;

  constructor(config?: ChatHistoryManagerConfig) {
    this.config = {
      maxEntries: config?.maxEntries ?? 200,
      debug: config?.debug ?? false,
    };
  }

  /**
   * Get current chat history
   */
  getHistory(): ChatEntry[] {
    return this.chatHistory;
  }

  /**
   * Get the number of entries in history
   */
  getLength(): number {
    return this.chatHistory.length;
  }

  /**
   * Get entry at specific index
   */
  getEntryAt(index: number): ChatEntry | undefined {
    return this.chatHistory[index];
  }

  /**
   * Get the last entry in history
   */
  getLastEntry(): ChatEntry | undefined {
    return this.chatHistory[this.chatHistory.length - 1];
  }

  /**
   * Add a chat entry to history
   * @param entry The chat entry to add
   * @returns Index of the added entry
   */
  addEntry(entry: ChatEntry): number {
    const index = this.chatHistory.length;
    this.chatHistory.push(entry);

    // Index tool calls for O(1) lookup
    if (entry.type === 'tool_call' && entry.toolCall?.id) {
      this.toolCallIndexMap.set(entry.toolCall.id, index);
    }

    return index;
  }

  /**
   * Add a tool call entry
   * @param toolCall The tool call to add
   * @returns Index of the added entry
   */
  addToolCall(toolCall: LLMToolCall): number {
    const entry: ChatEntry = {
      type: 'tool_call',
      content: 'Executing...',
      timestamp: new Date(),
      toolCall,
    };
    return this.addEntry(entry);
  }

  /**
   * Update a tool call entry with its result
   * @param toolCallId The tool call ID to update
   * @param result The tool result
   * @param executionDurationMs Optional execution duration
   * @returns true if update was successful, false if tool call not found
   */
  updateToolResult(
    toolCallId: string,
    result: ToolResult,
    executionDurationMs?: number
  ): boolean {
    const index = this.toolCallIndexMap.get(toolCallId);
    if (index === undefined) {
      return false;
    }

    const entry = this.chatHistory[index];
    if (!entry || entry.type !== 'tool_call') {
      return false;
    }

    // Update entry to tool_result
    this.chatHistory[index] = {
      ...entry,
      type: 'tool_result',
      content: result.success
        ? result.output || 'Success'
        : result.error || 'Error occurred',
      toolResult: result,
      ...(executionDurationMs !== undefined && { executionDurationMs }),
    };

    return true;
  }

  /**
   * Get the index for a tool call ID
   */
  getToolCallIndex(toolCallId: string): number | undefined {
    return this.toolCallIndexMap.get(toolCallId);
  }

  /**
   * Update entry at specific index
   * @param index Index to update
   * @param entry New entry data
   */
  updateEntryAt(index: number, entry: ChatEntry): void {
    if (index >= 0 && index < this.chatHistory.length) {
      this.chatHistory[index] = entry;

      // Update index map if tool call
      if (entry.type === 'tool_call' && entry.toolCall?.id) {
        this.toolCallIndexMap.set(entry.toolCall.id, index);
      }
    }
  }

  /**
   * Get cached tool call arguments
   * @param toolCallId Tool call ID
   */
  getCachedArgs(toolCallId: string): Record<string, unknown> | undefined {
    return this.toolCallArgsCache.get(toolCallId);
  }

  /**
   * Cache tool call arguments
   * @param toolCallId Tool call ID
   * @param args Parsed arguments
   */
  setCachedArgs(toolCallId: string, args: Record<string, unknown>): void {
    this.toolCallArgsCache.set(toolCallId, args);
  }

  /**
   * Clear all history and maps
   */
  clear(): void {
    this.chatHistory = [];
    this.toolCallIndexMap.clear();
    this.toolCallArgsCache.clear();
  }

  /**
   * Prune history to max entries, keeping the most recent
   * @returns Number of entries removed
   */
  prune(): number {
    if (this.chatHistory.length <= this.config.maxEntries) {
      return 0;
    }

    const entriesToRemove = this.chatHistory.length - this.config.maxEntries;
    this.chatHistory = this.chatHistory.slice(entriesToRemove);

    // Rebuild tool call index map
    this.rebuildIndexMap();

    // Clear args cache for removed entries
    this.pruneArgsCache();

    return entriesToRemove;
  }

  /**
   * Rebuild the tool call index map from current history
   */
  private rebuildIndexMap(): void {
    this.toolCallIndexMap.clear();
    this.chatHistory.forEach((entry, index) => {
      if ((entry.type === 'tool_call' || entry.type === 'tool_result') && entry.toolCall?.id) {
        this.toolCallIndexMap.set(entry.toolCall.id, index);
      }
    });
  }

  /**
   * Remove cached args for tool calls no longer in history
   */
  private pruneArgsCache(): void {
    const validIds = new Set(this.toolCallIndexMap.keys());
    for (const id of this.toolCallArgsCache.keys()) {
      if (!validIds.has(id)) {
        this.toolCallArgsCache.delete(id);
      }
    }
  }

  /**
   * Restore history from saved entries
   * @param entries Saved chat entries to restore
   */
  restoreFromEntries(entries: ChatEntry[]): void {
    if (!entries || entries.length === 0) {
      return;
    }

    this.chatHistory = [...entries];
    this.rebuildIndexMap();
    this.toolCallArgsCache.clear();
  }

  /**
   * Rewind history to a checkpoint index
   * @param checkpointIndex Index to rewind to
   * @returns Entries that were removed
   */
  rewindToCheckpoint(checkpointIndex: number): ChatEntry[] {
    if (checkpointIndex < 0 || checkpointIndex >= this.chatHistory.length) {
      return [];
    }

    const removed = this.chatHistory.slice(checkpointIndex + 1);
    this.chatHistory = this.chatHistory.slice(0, checkpointIndex + 1);
    this.rebuildIndexMap();
    this.pruneArgsCache();

    return removed;
  }

  /**
   * Build LLM messages array from chat history.
   * Used for restoring conversation context.
   *
   * @param systemMessage Optional system message to prepend
   * @returns Array of LLM messages
   */
  buildMessagesFromHistory(systemMessage?: LLMMessage): LLMMessage[] {
    const messages: LLMMessage[] = systemMessage ? [systemMessage] : [];

    // Track tool calls to validate tool results
    const toolCallIds = new Set<string>();

    for (const entry of this.chatHistory) {
      if (entry.type === 'user') {
        messages.push({
          role: 'user',
          content: entry.content,
        });
      } else if (entry.type === 'assistant') {
        // Track tool call IDs from assistant messages
        if (entry.toolCalls && Array.isArray(entry.toolCalls)) {
          for (const toolCall of entry.toolCalls) {
            if (toolCall?.id) {
              toolCallIds.add(toolCall.id);
            }
          }
        }

        messages.push({
          role: 'assistant',
          content: entry.content,
          tool_calls: entry.toolCalls,
        } as LLMMessage);
      } else if (entry.type === 'tool_result' && entry.toolCall) {
        // Only add tool result if corresponding tool call exists
        if (toolCallIds.has(entry.toolCall.id)) {
          messages.push({
            role: 'tool',
            content: entry.content,
            tool_call_id: entry.toolCall.id,
          });
        }
      }
    }

    return messages;
  }

  /**
   * Get tool call index map (for external use)
   */
  getToolCallIndexMap(): Map<string, number> {
    return this.toolCallIndexMap;
  }
}

/**
 * Create a new ChatHistoryManager
 */
export function createChatHistoryManager(
  config?: ChatHistoryManagerConfig
): ChatHistoryManager {
  return new ChatHistoryManager(config);
}
