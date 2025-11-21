/**
 * Generic LRU Cache implementation for performance optimization
 * Provides consistent caching across the application
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string, number>({ maxSize: 100 });
 * cache.set('key', 42);
 * const value = cache.get('key'); // 42
 * ```
 */

export interface CacheOptions {
  /** Maximum number of entries in cache (default: 1000) */
  maxSize?: number;
  /** Time to live in milliseconds (optional) */
  ttl?: number;
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

/**
 * Least Recently Used (LRU) Cache with optional TTL
 */
export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private readonly maxSize: number;
  private readonly ttl?: number;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl;
  }

  /**
   * Get value from cache
   * Returns undefined if not found or expired
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set value in cache with LRU eviction
   */
  set(key: K, value: V): void {
    // Remove if already exists (to update position)
    this.cache.delete(key);

    // Evict oldest if at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if key exists and is not expired
   * Unlike get(), this properly handles cached undefined values
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys (in LRU order)
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics
   */
  stats(): {
    size: number;
    maxSize: number;
    ttl?: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }
}

/**
 * Create a memoized version of an async function with caching
 * Prevents cache stampede by tracking pending promises
 */
export function memoizeAsync<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: CacheOptions & { keyFn?: (...args: TArgs) => string } = {}
): (...args: TArgs) => Promise<TReturn> {
  const cache = new LRUCache<string, TReturn>(options);
  const pending = new Map<string, Promise<TReturn>>();
  const keyFn = options.keyFn || ((...args) => {
    try {
      return JSON.stringify(args);
    } catch {
      // Fallback for circular references or non-serializable values
      return args.map((arg, i) => `${i}:${String(arg)}`).join('|');
    }
  });

  return async (...args: TArgs): Promise<TReturn> => {
    const key = keyFn(...args);

    // Check cache first using has() to properly handle cached undefined values
    if (cache.has(key)) {
      return cache.get(key) as TReturn;
    }

    // Check if already pending to prevent cache stampede
    const existingPromise = pending.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    // Create new promise and track it
    const promise = fn(...args)
      .then((result) => {
        cache.set(key, result);
        pending.delete(key);
        return result;
      })
      .catch((error) => {
        pending.delete(key);
        throw error;
      });

    pending.set(key, promise);
    return promise;
  };
}

/**
 * Create a memoized version of a sync function with caching
 */
export function memoize<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  options: CacheOptions & { keyFn?: (...args: TArgs) => string } = {}
): (...args: TArgs) => TReturn {
  const cache = new LRUCache<string, TReturn>(options);
  const keyFn = options.keyFn || ((...args) => {
    try {
      return JSON.stringify(args);
    } catch {
      // Fallback for circular references or non-serializable values
      return args.map((arg, i) => `${i}:${String(arg)}`).join('|');
    }
  });

  return (...args: TArgs): TReturn => {
    const key = keyFn(...args);

    // Check cache first using has() to properly handle cached undefined values
    if (cache.has(key)) {
      return cache.get(key) as TReturn;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
