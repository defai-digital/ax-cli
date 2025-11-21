import type { ChatCompletionMessageParam } from 'openai/resources/chat.js';
import { get_encoding, encoding_for_model, Tiktoken } from 'tiktoken';
import { TOKEN_CONFIG } from '../constants.js';
import { LRUCache } from './cache.js';
import * as crypto from 'crypto';

export class TokenCounter {
  private encoder: Tiktoken;
  private cache: LRUCache<string, number>;
  private fingerprintToHashCache: Map<string, string> = new Map();

  constructor(model: string = TOKEN_CONFIG.DEFAULT_MODEL) {
    try {
      // Try to get encoding for specific model
      this.encoder = encoding_for_model(model as any);
    } catch {
      // Fallback to cl100k_base (used by GPT-4 and most modern models)
      this.encoder = get_encoding(TOKEN_CONFIG.DEFAULT_ENCODING as any);
    }
    // Initialize cache with configured limit
    this.cache = new LRUCache({ maxSize: TOKEN_CONFIG.CACHE_MAX_SIZE });
  }

  /**
   * Create quick fingerprint to avoid redundant hashing
   * Uses length and first/last chars for fast identity check
   */
  private quickFingerprint(text: string): string {
    return `${text.length}:${text.charCodeAt(0)}:${text.charCodeAt(text.length - 1)}`;
  }

  /**
   * Create cache key from text
   * For long texts, use hash to avoid storing large keys in memory
   */
  private createCacheKey(text: string): string {
    // For short texts (< 1KB), use text directly as key
    if (text.length < 1024) {
      return text;
    }

    // Use fingerprint to check if we've already hashed this text
    const fingerprint = this.quickFingerprint(text);
    const cached = this.fingerprintToHashCache.get(fingerprint);
    if (cached) {
      return cached;
    }

    // For longer texts, use SHA-256 hash to reduce memory footprint
    // A 10KB text becomes a 64-char hash, saving ~9.9KB per cache entry
    const hash = crypto.createHash('sha256').update(text).digest('hex');

    // Limit fingerprint cache size to prevent unbounded growth
    if (this.fingerprintToHashCache.size > 1000) {
      // Clear oldest entries (Map iteration order is insertion order)
      const keysToDelete = Array.from(this.fingerprintToHashCache.keys()).slice(0, 100);
      keysToDelete.forEach(k => this.fingerprintToHashCache.delete(k));
    }

    this.fingerprintToHashCache.set(fingerprint, hash);
    return hash;
  }

  /**
   * Count tokens in a string with LRU caching for performance
   */
  countTokens(text: string): number {
    if (!text) return 0;

    // Check cache first using efficient key
    const cacheKey = this.createCacheKey(text);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Count tokens
    const count = this.encoder.encode(text).length;

    // Add to cache (LRU eviction handled automatically)
    this.cache.set(cacheKey, count);

    return count;
  }

  /**
   * Count tokens in messages array (for chat completions)
   */
  countMessageTokens(messages: ChatCompletionMessageParam[]): number {
    let totalTokens = 0;

    for (const message of messages) {
      // Every message follows <|start|>{role/name}\n{content}<|end|>\n
      totalTokens += TOKEN_CONFIG.TOKENS_PER_MESSAGE;

      if (message.content) {
        if (typeof message.content === 'string') {
          totalTokens += this.countTokens(message.content);
        } else if (Array.isArray(message.content)) {
          for (const part of message.content) {
            if (part.type === 'text' && part.text) {
              totalTokens += this.countTokens(part.text);
            }
          }
        } else {
          // Fallback for unexpected content types - stringify and count
          totalTokens += this.countTokens(String(message.content));
        }
      }

      if (message.role) {
        totalTokens += this.countTokens(message.role);
      }

      // Add extra tokens for tool calls if present
      if ((message.role === 'assistant' || message.role === 'tool') && 'tool_calls' in message && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
        totalTokens += this.countTokens(JSON.stringify(message.tool_calls));
      }
    }

    totalTokens += TOKEN_CONFIG.TOKENS_FOR_REPLY_PRIMING;

    return totalTokens;
  }

  /**
   * Estimate tokens for streaming content
   * This is an approximation since we don't have the full response yet
   */
  estimateStreamingTokens(accumulatedContent: string): number {
    return this.countTokens(accumulatedContent);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.cache.clear();
    this.fingerprintToHashCache.clear();
    this.encoder.free();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.stats();
  }
}

/**
 * Format token count for display (e.g., 1.2k for 1200)
 */
export function formatTokenCount(count: number): string {
  if (count <= 999) {
    return count.toString();
  }
  
  if (count < 1_000_000) {
    const k = count / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  
  const m = count / 1_000_000;
  return m % 1 === 0 ? `${m}m` : `${m.toFixed(1)}m`;
}

/**
 * Create a token counter instance
 */
export function createTokenCounter(model?: string): TokenCounter {
  return new TokenCounter(model);
}