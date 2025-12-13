/**
 * Context Overflow Handler
 *
 * Handles context window overflow by generating summaries and managing pruning.
 * Listens to context manager events and coordinates the overflow response.
 *
 * @packageDocumentation
 */

import { EventEmitter } from "events";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import type { ChatEntry } from "../core/types.js";
import type { LLMMessage } from "../../llm/client.js";
import type { ContextManager } from "../context-manager.js";
import type { TokenCounter } from "../../utils/token-counter.js";
import { extractErrorMessage } from "../../utils/error-handler.js";
import { AGENT_CONFIG } from "../../constants.js";

/**
 * Data passed when context overflow is detected
 */
export interface ContextOverflowData {
  messageCount: number;
  tokenCount: number;
  messages: ChatCompletionMessageParam[];
}

/**
 * Summary result from overflow handling
 */
export interface ContextSummary {
  path: string;
  tokensSaved: number;
  timestamp: Date;
}

/**
 * Interface for status reporter that generates summaries
 */
export interface SummaryGenerator {
  generateContextSummary(
    messages: ChatCompletionMessageParam[],
    chatHistory: ChatEntry[],
    reason: string,
    tokenCount: number
  ): Promise<ContextSummary>;
}

/**
 * Configuration for ContextOverflowHandler
 */
export interface ContextOverflowHandlerConfig {
  /** Maximum chat history entries to keep (default: 200) */
  maxChatHistoryEntries?: number;
  /** Maximum messages array length (safety backstop, default: from AGENT_CONFIG) */
  maxMessages?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Handles context overflow events and manages memory pruning.
 *
 * Features:
 * - Generates summaries when context approaches limit
 * - Prunes chat history to prevent unbounded growth
 * - Provides safety backstop for messages array
 * - Emits events for UI notification
 *
 * @example
 * ```typescript
 * const handler = new ContextOverflowHandler(emitter, {
 *   getSummaryGenerator: () => statusReporter,
 *   getChatHistory: () => chatHistory,
 * });
 *
 * handler.initialize(contextManager);
 *
 * // Later:
 * handler.dispose();
 * ```
 */
export class ContextOverflowHandler {
  /** Event emitter for overflow events */
  private emitter: EventEmitter;

  /** Configuration options */
  private config: Required<ContextOverflowHandlerConfig>;

  /** Stored reference to context overflow listener for proper cleanup */
  private contextOverflowListener: ((data: ContextOverflowData) => void) | undefined;

  /** Reference to context manager */
  private contextManager: ContextManager | undefined;

  /** Track if handler has been disposed */
  private disposed = false;

  /** Callback to get current summary generator */
  private getSummaryGenerator: () => SummaryGenerator | undefined;

  /** Callback to get current chat history */
  private getChatHistory: () => ChatEntry[];

  /** Callback to add chat entry */
  private addChatEntry: (entry: ChatEntry) => void;

  constructor(
    emitter: EventEmitter,
    callbacks: {
      getSummaryGenerator: () => SummaryGenerator | undefined;
      getChatHistory: () => ChatEntry[];
      addChatEntry: (entry: ChatEntry) => void;
    },
    config?: ContextOverflowHandlerConfig
  ) {
    this.emitter = emitter;
    this.getSummaryGenerator = callbacks.getSummaryGenerator;
    this.getChatHistory = callbacks.getChatHistory;
    this.addChatEntry = callbacks.addChatEntry;
    this.config = {
      maxChatHistoryEntries: config?.maxChatHistoryEntries ?? 200,
      maxMessages: config?.maxMessages ?? AGENT_CONFIG.MAX_MESSAGES,
      debug: config?.debug ?? false,
    };
  }

  /**
   * Initialize the handler by attaching to context manager events.
   * @param contextManager The context manager to listen to
   */
  initialize(contextManager: ContextManager): void {
    if (this.disposed) return;

    this.contextManager = contextManager;

    // Create listener with proper async error handling
    this.contextOverflowListener = (data: ContextOverflowData) => {
      if (this.disposed) return;
      this.handleOverflow(data).catch((error) => {
        if (this.disposed) return;
        const errorMsg = extractErrorMessage(error);
        console.error('Error handling context overflow:', errorMsg);
        this.emitter.emit('error', error);
      });
    };

    contextManager.on('before_prune', this.contextOverflowListener);
  }

  /**
   * Handle context overflow by generating a summary.
   * @param data Overflow event data
   */
  private async handleOverflow(data: ContextOverflowData): Promise<void> {
    try {
      const generator = this.getSummaryGenerator();
      if (!generator) {
        if (this.config.debug) {
          console.log('[Context Overflow] No summary generator available');
        }
        return;
      }

      const chatHistory = this.getChatHistory();
      const summary = await generator.generateContextSummary(
        data.messages,
        chatHistory,
        'context_overflow',
        data.tokenCount
      );

      if (this.config.debug) {
        console.log(`[Context Overflow] Summary generated: ${summary.path}`);
      }

      // Add a chat entry to inform user
      const summaryEntry: ChatEntry = {
        type: 'assistant',
        content: `\u26a0\ufe0f Context window approaching limit (${data.tokenCount.toLocaleString()} tokens). Summary saved to:\n\`${summary.path}\``,
        timestamp: new Date(),
      };
      this.addChatEntry(summaryEntry);

      // Emit event for UI/logging
      this.emitter.emit('context:summary', summary);
    } catch (error) {
      // Summary generation failure should not block execution
      const errorMsg = extractErrorMessage(error);
      console.warn('Failed to generate context summary:', errorMsg);
    }
  }

  /**
   * Apply context pruning to messages and chat history.
   * Should be called periodically to prevent unbounded growth.
   *
   * @param messages Current messages array (will be modified)
   * @param chatHistory Current chat history array (will be modified)
   * @param tokenCounter Token counter for pruning decisions
   * @param toolCallIndexMap Map to rebuild after pruning
   * @returns Object with pruned messages and chatHistory
   */
  applyPruning(
    messages: LLMMessage[],
    chatHistory: ChatEntry[],
    tokenCounter: TokenCounter,
    toolCallIndexMap: Map<string, number>
  ): { messages: LLMMessage[]; chatHistory: ChatEntry[] } {
    let prunedMessages = messages;
    let prunedHistory = chatHistory;

    // Prune LLM messages if needed
    if (this.contextManager?.shouldPrune(messages, tokenCounter)) {
      prunedMessages = this.contextManager.pruneMessages(messages, tokenCounter);
    }

    // CRITICAL: Always check and prune chatHistory to prevent unbounded growth
    if (prunedHistory.length > this.config.maxChatHistoryEntries) {
      const entriesToRemove = prunedHistory.length - this.config.maxChatHistoryEntries;
      prunedHistory = prunedHistory.slice(entriesToRemove);

      // Update tool call index map after pruning
      toolCallIndexMap.clear();
      prunedHistory.forEach((entry, index) => {
        if (entry.type === "tool_call" && entry.toolCall?.id) {
          toolCallIndexMap.set(entry.toolCall.id, index);
        } else if (entry.type === "tool_result" && entry.toolCall?.id) {
          toolCallIndexMap.set(entry.toolCall.id, index);
        }
      });
    }

    // CRITICAL: Add hard limit for messages array as safety backstop
    if (prunedMessages.length > this.config.maxMessages) {
      const systemMessages = prunedMessages.filter(m => m.role === 'system');
      const nonSystemMessages = prunedMessages.filter(m => m.role !== 'system');
      const keepMessages = Math.min(nonSystemMessages.length, this.config.maxMessages - systemMessages.length);
      prunedMessages = [
        ...systemMessages,
        ...nonSystemMessages.slice(-keepMessages)
      ];
    }

    return { messages: prunedMessages, chatHistory: prunedHistory };
  }

  /**
   * Check if handler has been disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose the handler and clean up resources.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Remove event listener
    if (this.contextManager && this.contextOverflowListener) {
      this.contextManager.off('before_prune', this.contextOverflowListener);
    }

    this.contextOverflowListener = undefined;
    this.contextManager = undefined;
  }
}

/**
 * Create a new ContextOverflowHandler
 */
export function createContextOverflowHandler(
  emitter: EventEmitter,
  callbacks: {
    getSummaryGenerator: () => SummaryGenerator | undefined;
    getChatHistory: () => ChatEntry[];
    addChatEntry: (entry: ChatEntry) => void;
  },
  config?: ContextOverflowHandlerConfig
): ContextOverflowHandler {
  return new ContextOverflowHandler(emitter, callbacks, config);
}
