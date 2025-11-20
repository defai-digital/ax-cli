/**
 * Context management for handling long conversations
 * Prevents context window overflow through intelligent pruning
 */

import type { LLMMessage } from '../llm/client.js';
import type { TokenCounter } from '../utils/token-counter.js';
import { GLM_MODELS } from '../constants.js';

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

export class ContextManager {
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

  constructor(options: ContextManagerOptions) {
    this.model = options.model;
    const modelConfig = GLM_MODELS[this.model as keyof typeof GLM_MODELS];
    this.contextWindow = modelConfig?.contextWindow || 128000;
    this.pruneThreshold = options.pruneThreshold || 0.75;
    this.hardLimit = options.hardLimit || 0.95;
    this.keepRecentToolRounds = options.keepRecentToolRounds || 8;
    this.keepFirstMessages = options.keepFirstMessages || 2;
    this.reservedTokens = options.reservedTokens || 3000;
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

    // Perform full cache cleanup if cache is getting too large
    if (this.tokenCache.size > this.MAX_CACHE_SIZE) {
      this.cleanupCache();
    }

    // Count tokens and cache result
    const count = tokenCounter.countMessageTokens(messages as any);
    this.tokenCache.set(cacheKey, { count, timestamp: now });

    return count;
  }

  /**
   * Create a cache key from messages
   * Fast hashing without full serialization
   * Includes content sample to prevent collisions
   */
  private createMessageCacheKey(messages: LLMMessage[]): string {
    // Use message count + roles + content lengths + content sample as a fast hash
    return messages.map(m => {
      const contentLen = typeof m.content === 'string' ? m.content.length : 0;
      const toolCallsLen = (m as any).tool_calls?.length || 0;
      // Include first 50 chars of content to prevent hash collisions
      // Increased from 20 to 50 to reduce false cache hits
      const contentSample = typeof m.content === 'string'
        ? m.content.substring(0, 50).replace(/[|:]/g, '') // Remove delimiters
        : '';
      return `${m.role}:${contentLen}:${toolCallsLen}:${contentSample}`;
    }).join('|');
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
    const percentage = (currentTokens / this.contextWindow) * 100;
    const available = this.contextWindow - currentTokens;

    return {
      currentTokens,
      contextWindow: this.contextWindow,
      percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
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
    if (messages.length === 0 || messages[0].role !== 'system') {
      throw new Error('First message must be system message');
    }

    // If under threshold, no pruning needed
    if (!this.shouldPrune(messages, tokenCounter)) {
      return messages;
    }

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
    let currentTokens = tokenCounter.countMessageTokens(prunedMessages as any);

    // If still over threshold, apply sliding window
    if (currentTokens > this.contextWindow * this.pruneThreshold) {
      return this.applySlidingWindow(prunedMessages, tokenCounter);
    }

    return prunedMessages;
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
      if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
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
      else if (inRound && message.role === 'assistant' && (!message.tool_calls || message.tool_calls.length === 0)) {
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
    const firstTokens = tokenCounter.countMessageTokens(firstMessages as any);
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
      const msgTokens = tokenCounter.countMessageTokens([msg] as any);

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
   * Cleanup method to clear cache and prevent memory leaks
   * Should be called when the ContextManager is no longer needed
   */
  dispose(): void {
    this.tokenCache.clear();
  }

  /**
   * Create a warning message for approaching limit
   */
  createWarningMessage(stats: ReturnType<typeof this.getStats>): string {
    if (stats.isNearLimit) {
      return `⚠️  Context: ${stats.currentTokens.toLocaleString()}/${stats.contextWindow.toLocaleString()} tokens (${stats.percentage}%)
💡 Near context limit! Consider starting a new conversation soon.`;
    }

    if (stats.shouldPrune) {
      return `ℹ️  Context: ${stats.currentTokens.toLocaleString()}/${stats.contextWindow.toLocaleString()} tokens (${stats.percentage}%)
📊 Context pruning active to maintain performance.`;
    }

    return `📊 Context: ${stats.currentTokens.toLocaleString()}/${stats.contextWindow.toLocaleString()} tokens (${stats.percentage}%)`;
  }
}
