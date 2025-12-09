/**
 * Context management for handling long conversations
 * Prevents context window overflow through intelligent pruning
 */

import { EventEmitter } from 'events';
import type { LLMMessage } from '../llm/client.js';
import type { TokenCounter } from '../utils/token-counter.js';
import { GLM_MODELS, TIMEOUT_CONFIG } from '../constants.js';
import * as crypto from 'crypto';

export interface ContextManagerOptions {
  /** Model being used */
  model: string;
  /** Percentage of context window to trigger pruning (default: 0.75) */
  pruneThreshold?: number;
  /** Percentage of context window for hard limit (default: 0.95) */
  hardLimit?: number;
  /** Number of recent tool rounds to keep (default: 8) */
  keepRecentToolRounds?: number;
  /** Always keep first N user messages (default: 2) */
  keepFirstMessages?: number;
  /** Reserved tokens for system message (default: 3000) */
  reservedTokens?: number;
}

export interface ContextManagerEvents {
  'before_prune': (data: { messageCount: number; tokenCount: number; messages: LLMMessage[] }) => void;
  'after_prune': (data: { beforeCount: number; afterCount: number; tokensSaved: number }) => void;
}

export class ContextManager extends EventEmitter {
  private model: string;
  private contextWindow: number;
  private pruneThreshold: number;
  private hardLimit: number;
  private keepRecentToolRounds: number;
  private keepFirstMessages: number;
  private reservedTokens: number;

  // Memoization cache for token counting
  // Use Map with JSON serialized messages as key for cache lookup
  private tokenCache = new Map<string, { count: number; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute TTL
  private readonly MAX_CACHE_SIZE = 100; // Maximum cache entries before cleanup
  private cleanupTimer: NodeJS.Timeout | null = null;
  private cleanupInProgress = false; // RACE CONDITION FIX: Lock to prevent concurrent cleanup

  constructor(options: ContextManagerOptions) {
    super(); // Initialize EventEmitter
    this.model = options.model;
    const modelConfig = GLM_MODELS[this.model as keyof typeof GLM_MODELS];
    this.contextWindow = modelConfig?.contextWindow || 128000;
    this.pruneThreshold = options.pruneThreshold || 0.75;
    this.hardLimit = options.hardLimit || 0.95;
    this.keepRecentToolRounds = options.keepRecentToolRounds || 8;
    this.keepFirstMessages = options.keepFirstMessages || 2;
    this.reservedTokens = options.reservedTokens || 3000;

    // Periodic cleanup to prevent memory leak (configurable interval)
    this.cleanupTimer = setInterval(() => {
      this.cleanupCache();
    }, TIMEOUT_CONFIG.CONTEXT_CLEANUP_INTERVAL);

    // Don't keep process alive just for cleanup
    this.cleanupTimer.unref();
  }

  /**
   * Memoized token counting with cache and lazy cleanup
   * Uses message content hash as cache key
   */
  private getCachedTokenCount(messages: LLMMessage[], tokenCounter: TokenCounter): number {
    // Create cache key from message array
    // Use a simplified hash based on message count, roles, and content lengths
    const cacheKey = this.createMessageCacheKey(messages);

    // Lazy cleanup: check if cached entry exists and is valid
    const now = Date.now();
    const cached = this.tokenCache.get(cacheKey);

    if (cached) {
      if (now - cached.timestamp < this.CACHE_TTL) {
        return cached.count;
      } else {
        // Expired, remove it
        this.tokenCache.delete(cacheKey);
      }
    }

    // Perform incremental cache cleanup if cache is getting too large
    // Instead of sorting all entries, just remove oldest 10-20% incrementally
    if (this.tokenCache.size >= this.MAX_CACHE_SIZE) {
      // RACE CONDITION FIX: Skip if cleanup already in progress
      if (!this.cleanupInProgress) {
        this.cleanupInProgress = true;
        try {
          this.cleanupCache();
          // If still over limit after cleanup, evict oldest entries to 90% capacity
          if (this.tokenCache.size >= this.MAX_CACHE_SIZE) {
            // Remove entries to get back to 90% capacity for headroom
            const targetSize = Math.floor(this.MAX_CACHE_SIZE * 0.9);
            // CONCURRENCY FIX: Snapshot entries before calculating removals
            // to prevent iterator invalidation from concurrent modifications
            const entries = Array.from(this.tokenCache.entries());
            const entriesToRemove = entries.length - targetSize;

            // Delete using snapshot to avoid race conditions
            for (let i = 0; i < Math.min(entriesToRemove, entries.length); i++) {
              this.tokenCache.delete(entries[i][0]);
            }
          }
        } finally {
          this.cleanupInProgress = false;
        }
      }
    }

    // Count tokens and cache result
    const count = tokenCounter.countMessageTokens(messages);
    this.tokenCache.set(cacheKey, { count, timestamp: now });

    return count;
  }

  /**
   * Create a cache key from messages
   * Uses SHA-256 hash of full content to prevent collisions
   * More reliable than content sampling
   */
  private createMessageCacheKey(messages: LLMMessage[]): string {
    // Serialize messages to a stable string representation
    const messageSignature = messages.map(m => {
      // Get full content
      const content = typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map(part => part.type === 'text' ? part.text : '').join('')
          : '';

      // Include tool calls if present
      const toolCalls = (m.role === 'assistant' || m.role === 'tool') && 'tool_calls' in m && m.tool_calls
        ? JSON.stringify(m.tool_calls)
        : '';

      // Create deterministic string for this message
      return `${m.role}|${content}|${toolCalls}`;
    }).join('||');

    // Hash the signature for efficient cache lookup
    return crypto.createHash('sha256').update(messageSignature).digest('hex').substring(0, 32);
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.tokenCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.tokenCache.delete(key);
      }
    }
  }

  /**
   * Clear the token cache (useful for testing)
   */
  clearCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Dispose of resources (cleanup timer, caches)
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.tokenCache.clear();
  }

  /**
   * Check if context needs pruning (with caching)
   */
  shouldPrune(messages: LLMMessage[], tokenCounter: TokenCounter): boolean {
    const currentTokens = this.getCachedTokenCount(messages, tokenCounter);
    const threshold = this.contextWindow * this.pruneThreshold;
    return currentTokens > threshold;
  }

  /**
   * Check if we're approaching hard limit (with caching)
   */
  isNearHardLimit(messages: LLMMessage[], tokenCounter: TokenCounter): boolean {
    const currentTokens = this.getCachedTokenCount(messages, tokenCounter);
    const limit = this.contextWindow * this.hardLimit;
    return currentTokens > limit;
  }

  /**
   * Get current context usage statistics (with caching)
   */
  getStats(messages: LLMMessage[], tokenCounter: TokenCounter) {
    const currentTokens = this.getCachedTokenCount(messages, tokenCounter);
    // Changed: Show remaining percentage (counting down from 100%)
    const percentage = 100 - (currentTokens / this.contextWindow) * 100;
    const available = this.contextWindow - currentTokens;

    return {
      currentTokens,
      contextWindow: this.contextWindow,
      percentage: percentage, // Remaining percentage (counts down from 100%)
      available,
      shouldPrune: currentTokens > (this.contextWindow * this.pruneThreshold),
      isNearLimit: currentTokens > (this.contextWindow * this.hardLimit),
    };
  }

  /**
   * Prune messages intelligently to reduce context usage
   * Strategy:
   * 1. Keep system message (always first)
   * 2. Keep first N user messages (important context)
   * 3. Keep last N tool rounds (recent work)
   * 4. Remove old tool results (most verbose, least valuable)
   * 5. Apply sliding window if still over threshold
   */
  pruneMessages(messages: LLMMessage[], tokenCounter: TokenCounter): LLMMessage[] {
    // Always keep system message - validate first
    if (messages.length === 0) {
      // Empty messages array - return as-is (edge case protection)
      console.warn('[ContextManager] Cannot prune empty messages array');
      return messages;
    }

    // Check if first message is system message
    if (messages[0].role !== 'system') {
      // Missing system message - log warning but continue with defensive handling
      console.warn('[ContextManager] First message is not system message, proceeding with caution');
      // Don't prune if system message is missing to avoid breaking conversation state
      return messages;
    }

    // If under threshold, no pruning needed
    if (!this.shouldPrune(messages, tokenCounter)) {
      return messages;
    }

    // NEW: Emit event before pruning (so agent can generate summary)
    const currentTokens = this.getCachedTokenCount(messages, tokenCounter);
    this.emit('before_prune', {
      messageCount: messages.length,
      tokenCount: currentTokens,
      messages: [...messages], // Provide copy for summary generation
    });

    const systemMessage = messages[0];
    let workingMessages = messages.slice(1);

    // Step 1: Identify and keep important messages
    const importantMessages = this.identifyImportantMessages(workingMessages);

    // Step 2: Identify tool rounds
    const toolRounds = this.identifyToolRounds(workingMessages);

    // Step 3: Keep recent tool rounds
    const recentRounds = toolRounds.slice(-this.keepRecentToolRounds);
    const recentMessageIndices = new Set(recentRounds.flat());

    // Step 4: Build pruned message list
    const prunedMessages: LLMMessage[] = [systemMessage];

    for (let i = 0; i < workingMessages.length; i++) {
      const message = workingMessages[i];

      // Keep if important or recent
      if (importantMessages.has(i) || recentMessageIndices.has(i)) {
        prunedMessages.push(message);
      }
      // For tool messages, only keep if part of recent rounds
      else if (message.role === 'tool') {
        // Skip old tool results
        continue;
      }
      // Keep user and assistant messages unless they're very old
      else if (message.role === 'user' || message.role === 'assistant') {
        // Keep if in recent half of conversation
        if (i >= workingMessages.length / 2) {
          prunedMessages.push(message);
        }
      }
    }

    // Step 5: Check if still over threshold
    const tokensAfterPruning = tokenCounter.countMessageTokens(prunedMessages);

    // If still over threshold, apply sliding window
    let finalMessages: LLMMessage[];
    if (tokensAfterPruning > this.contextWindow * this.pruneThreshold) {
      finalMessages = this.applySlidingWindow(prunedMessages, tokenCounter);
    } else {
      finalMessages = prunedMessages;
    }

    // NEW: Emit event after pruning
    const afterTokens = tokenCounter.countMessageTokens(finalMessages);
    const beforeCount = messages.length;
    const tokensBefore = currentTokens; // Use the variable from before pruning
    this.emit('after_prune', {
      beforeCount,
      afterCount: finalMessages.length,
      tokensSaved: tokensBefore - afterTokens,
    });

    return finalMessages;
  }

  /**
   * Identify important messages to preserve
   */
  private identifyImportantMessages(messages: LLMMessage[]): Set<number> {
    const important = new Set<number>();

    // Keep first N user messages (important project context)
    let userMessageCount = 0;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'user') {
        if (userMessageCount < this.keepFirstMessages) {
          important.add(i);
          userMessageCount++;
        } else {
          break;
        }
      }
    }

    return important;
  }

  /**
   * Identify tool execution rounds
   * A round is: user -> assistant (with tool_calls) -> tool results -> assistant (response)
   */
  private identifyToolRounds(messages: LLMMessage[]): number[][] {
    const rounds: number[][] = [];
    let currentRound: number[] = [];
    let inRound = false;

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      // Start of round: assistant with tool_calls
      if (message.role === 'assistant' && 'tool_calls' in message && message.tool_calls && message.tool_calls.length > 0) {
        if (currentRound.length > 0) {
          rounds.push(currentRound);
        }
        currentRound = [i];
        inRound = true;
      }
      // Tool results in round
      else if (inRound && message.role === 'tool') {
        currentRound.push(i);
      }
      // End of round: assistant response without tool_calls
      else if (inRound && message.role === 'assistant' && (!('tool_calls' in message) || !message.tool_calls || message.tool_calls.length === 0)) {
        currentRound.push(i);
        rounds.push(currentRound);
        currentRound = [];
        inRound = false;
      }
      // User message ends round
      else if (inRound && message.role === 'user') {
        if (currentRound.length > 0) {
          rounds.push(currentRound);
        }
        currentRound = [];
        inRound = false;
      }
    }

    // Add incomplete round
    if (currentRound.length > 0) {
      rounds.push(currentRound);
    }

    return rounds;
  }

  /**
   * Apply sliding window: keep first few + last many messages
   */
  private applySlidingWindow(messages: LLMMessage[], tokenCounter: TokenCounter): LLMMessage[] {
    // Bounds check: ensure array has at least a system message
    if (messages.length === 0) {
      return messages;
    }

    const systemMessage = messages[0];
    const workingMessages = messages.slice(1);

    // Start with system message + first 2 user messages
    const firstMessages: LLMMessage[] = [systemMessage];
    let userCount = 0;
    let firstMessageEnd = 0;

    for (let i = 0; i < workingMessages.length; i++) {
      if (workingMessages[i].role === 'user') {
        firstMessages.push(workingMessages[i]);
        userCount++;
        firstMessageEnd = i;
        if (userCount >= this.keepFirstMessages) break;
      }
    }

    // Calculate how many recent messages we can keep
    const firstTokens = tokenCounter.countMessageTokens(firstMessages);
    const availableTokens = Math.max(0,
      (this.contextWindow * this.pruneThreshold) - firstTokens - this.reservedTokens
    );

    // If no space left, return minimal context (system + first messages only)
    if (availableTokens <= 0) {
      return firstMessages; // firstMessages already includes systemMessage
    }

    // Add recent messages from the end
    const recentMessages: LLMMessage[] = [];
    let recentTokens = 0;

    for (let i = workingMessages.length - 1; i > firstMessageEnd; i--) {
      const msg = workingMessages[i];
      const msgTokens = tokenCounter.countMessageTokens([msg]);

      if (recentTokens + msgTokens <= availableTokens) {
        recentMessages.unshift(msg);
        recentTokens += msgTokens;
      } else {
        break;
      }
    }

    // Combine: system + first messages + marker + recent messages
    const result = [...firstMessages];

    // Add context marker if we skipped messages
    // Check if there's a gap between first messages and recent messages
    const gapStart = firstMessageEnd + 1;
    const gapEnd = workingMessages.length - recentMessages.length;
    if (recentMessages.length > 0 && gapStart < gapEnd) {
      result.push({
        role: 'system',
        content: '[Previous conversation context pruned to manage token limits]',
      });
    }

    result.push(...recentMessages);

    return result;
  }


  /**
   * Create a warning message for approaching limit
   * Percentage shows remaining capacity (counts down from 100%)
   */
  createWarningMessage(stats: ReturnType<typeof this.getStats>): string {
    if (stats.isNearLimit) {
      return `⚠️  Context: ${stats.currentTokens.toLocaleString()}/${stats.contextWindow.toLocaleString()} tokens (${stats.percentage.toFixed(1)}% remaining)
💡 Near context limit! Consider starting a new conversation soon.`;
    }

    if (stats.shouldPrune) {
      return `ℹ️  Context: ${stats.currentTokens.toLocaleString()}/${stats.contextWindow.toLocaleString()} tokens (${stats.percentage.toFixed(1)}% remaining)
📊 Context pruning active to maintain performance.`;
    }

    return `📊 Context: ${stats.currentTokens.toLocaleString()}/${stats.contextWindow.toLocaleString()} tokens (${stats.percentage.toFixed(1)}% remaining)`;
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}
