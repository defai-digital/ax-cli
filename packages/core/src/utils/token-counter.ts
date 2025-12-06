import type { ChatCompletionMessageParam } from 'openai/resources/chat.js';
import { get_encoding, encoding_for_model, Tiktoken } from 'tiktoken';
import { TOKEN_CONFIG } from '../constants.js';
import { LRUCache } from './cache.js';
import * as crypto from 'crypto';

export class TokenCounter {
  private encoder: Tiktoken;
  private cache: LRUCache<string, number>;
  private fingerprintToHashCache: Map<string, string> = new Map();
  private model: string; // CACHE FIX: Track model for cache key prefix
  private disposed = false; // Prevent use-after-dispose when singleton is reused

  constructor(model: string = TOKEN_CONFIG.DEFAULT_MODEL) {
    this.model = model;
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
    // LOGIC FIX: Handle edge cases to avoid NaN in fingerprint
    if (text.length === 0) return "0:0:0";
    if (text.length === 1) return `1:${text.charCodeAt(0)}:${text.charCodeAt(0)}`;
    return `${text.length}:${text.charCodeAt(0)}:${text.charCodeAt(text.length - 1)}`;
  }

  /**
   * Create cache key from text
   * For long texts, use hash to avoid storing large keys in memory
   * CACHE FIX: Include model prefix to prevent cross-model cache pollution
   */
  private createCacheKey(text: string): string {
    // CACHE FIX: Prefix all cache keys with model to ensure cache isolation
    const modelPrefix = `${this.model}:`;

    // For short texts (< 1KB), use text directly as key
    if (text.length < 1024) {
      return modelPrefix + text;
    }

    // Use fingerprint to check if we've already hashed this text
    const fingerprint = this.quickFingerprint(text);
    const fingerprintKey = modelPrefix + fingerprint;
    const cached = this.fingerprintToHashCache.get(fingerprintKey);
    if (cached) {
      return cached;
    }

    // For longer texts, use SHA-256 hash to reduce memory footprint
    // A 10KB text becomes a 64-char hash, saving ~9.9KB per cache entry
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    const cacheKey = modelPrefix + hash;

    // Limit fingerprint cache size to prevent unbounded growth
    if (this.fingerprintToHashCache.size > 1000) {
      // More efficient: use iterator instead of Array.from() to avoid creating full array
      let deleted = 0;
      for (const key of this.fingerprintToHashCache.keys()) {
        this.fingerprintToHashCache.delete(key);
        deleted++;
        if (deleted >= 100) break;
      }
    }

    // CACHE FIX: Store with model-prefixed key
    this.fingerprintToHashCache.set(fingerprintKey, cacheKey);
    return cacheKey;
  }

  /**
   * Count tokens in a string with LRU caching for performance
   */
  countTokens(text: string): number {
    if (this.disposed) {
      throw new Error('TokenCounter has been disposed');
    }

    // CRITICAL FIX: Early return for empty strings without caching
    // Prevents cache pollution where all empty strings share same cache key
    if (!text) return 0;

    // Check cache first using efficient key
    const cacheKey = this.createCacheKey(text);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Count tokens
    const count = this.encoder.encode(text).length;

    // CRITICAL FIX: Only cache non-empty strings
    // Empty strings return early above, but this guards against zero-length edge cases
    if (text.length > 0) {
      this.cache.set(cacheKey, count);
    }

    return count;
  }

  /**
   * Count tokens in messages array (for chat completions)
   */
  countMessageTokens(messages: ChatCompletionMessageParam[]): number {
    if (this.disposed) {
      throw new Error('TokenCounter has been disposed');
    }

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
            } else if (part.type === 'image_url') {
              // Images consume approximately 1000 tokens each (based on z.ai docs)
              // This is an estimate as actual cost may vary by image size
              totalTokens += TOKEN_CONFIG.TOKENS_PER_IMAGE ?? 1000;
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
    if (this.disposed) return;
    this.cache.clear();
    this.fingerprintToHashCache.clear();
    this.encoder.free();
    this.disposed = true;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.stats();
  }

  /**
   * Whether this instance has been disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }
}

/**
 * Format token count for display (e.g., 1.2k for 1200)
 * @param count - The token count to format
 * @param options - Formatting options
 * @param options.suffix - Whether to add " tokens" suffix (default: false)
 * @param options.uppercase - Whether to use uppercase K/M (default: false)
 */
export function formatTokenCount(
  count: number,
  options?: { suffix?: boolean; uppercase?: boolean }
): string {
  // CRITICAL FIX: Handle edge cases (NaN, Infinity, negative numbers)
  // Prevents potential issues with invalid token counts
  if (!Number.isFinite(count) || count < 0) {
    return options?.suffix ? '0 tokens' : '0';
  }

  const suffix = options?.suffix ? ' tokens' : '';
  const kChar = options?.uppercase ? 'K' : 'k';
  const mChar = options?.uppercase ? 'M' : 'm';

  if (count <= 999) {
    return `${Math.floor(count)}${suffix}`;
  }

  if (count < 1_000_000) {
    const k = count / 1000;
    const formatted = k % 1 === 0 ? `${Math.floor(k)}${kChar}` : `${k.toFixed(1)}${kChar}`;
    return `${formatted}${suffix}`;
  }

  const m = count / 1_000_000;
  const formatted = m % 1 === 0 ? `${Math.floor(m)}${mChar}` : `${m.toFixed(1)}${mChar}`;
  return `${formatted}${suffix}`;
}

// Singleton instances keyed by model
const tokenCounterInstances = new Map<string, TokenCounter>();

/**
 * Get or create a singleton token counter for the specified model
 * Reuses encoder instances to avoid expensive tiktoken initialization
 *
 * @param model - Model name (defaults to TOKEN_CONFIG.DEFAULT_MODEL)
 * @returns Singleton TokenCounter instance for the model
 */
export function getTokenCounter(model?: string): TokenCounter {
  const key = model || TOKEN_CONFIG.DEFAULT_MODEL;

  let instance = tokenCounterInstances.get(key);
  if (!instance || instance.isDisposed()) {
    instance = new TokenCounter(key);
    tokenCounterInstances.set(key, instance);
  }

  return instance;
}

/**
 * Create a token counter instance
 *
 * @deprecated Use getTokenCounter() instead for better performance (singleton pattern)
 * @param model - Model name
 * @returns New or singleton TokenCounter instance
 */
export function createTokenCounter(model?: string): TokenCounter {
  // Redirect to singleton for backwards compatibility and performance
  return getTokenCounter(model);
}
