/**
 * Analysis Cache
 *
 * LRU cache for analysis results with TTL and content hash validation.
 * Prevents re-analyzing unchanged projects.
 */

interface CacheEntry<T> {
  readonly value: T;
  readonly timestamp: number;
  readonly hash: string; // Content hash for invalidation
}

export class AnalysisCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly ttl: number;
  private readonly maxSize: number;

  /**
   * Create new analysis cache
   * @param ttl Time-to-live in milliseconds (default: 5 minutes)
   * @param maxSize Maximum number of entries (default: 100)
   */
  constructor(ttl: number = 5 * 60 * 1000, maxSize: number = 100) {
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  /**
   * Get cached value if it exists and is valid
   */
  async get(key: string, hash: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Check if content changed
    if (entry.hash !== hash) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set cached value
   */
  set(key: string, value: T, hash: string): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // Remove oldest entry (first in map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hash,
    });
  }

  /**
   * Check if key exists in cache (doesn't validate expiration)
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    ttl: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }
}
