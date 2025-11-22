/**
 * Search Cache
 * In-memory cache for web search results
 */

import NodeCache from "node-cache";
import type { WebSearchResult } from "./types.js";

export interface CacheEntry {
  query: string;
  results: WebSearchResult[];
  timestamp: number;
  ttl: number;
}

export class SearchCache {
  private cache: NodeCache;
  private readonly DEFAULT_TTL = 300; // 5 minutes in seconds
  private readonly MAX_KEYS = 500; // Maximum cache entries

  constructor(ttl?: number, maxKeys?: number) {
    this.cache = new NodeCache({
      stdTTL: ttl || this.DEFAULT_TTL,
      checkperiod: 60, // Check for expired entries every 60 seconds
      maxKeys: maxKeys || this.MAX_KEYS,
      useClones: false, // Better performance, but watch for mutations
    });
  }

  /**
   * Generate cache key from query
   */
  private getCacheKey(query: string): string {
    return `search:${query.toLowerCase().trim()}`;
  }

  /**
   * Get cached results for a query
   */
  get(query: string): WebSearchResult[] | null {
    const key = this.getCacheKey(query);
    const entry = this.cache.get<CacheEntry>(key);

    if (!entry) {
      return null;
    }

    // Return the cached results
    return entry.results;
  }

  /**
   * Cache search results for a query
   */
  set(query: string, results: WebSearchResult[], ttl?: number): void {
    const key = this.getCacheKey(query);
    const effectiveTtl = ttl || this.DEFAULT_TTL;
    const entry: CacheEntry = {
      query,
      results,
      timestamp: Date.now(),
      ttl: effectiveTtl,
    };

    this.cache.set(key, entry, effectiveTtl);
  }

  /**
   * Check if query has cached results
   */
  has(query: string): boolean {
    const key = this.getCacheKey(query);
    return this.cache.has(key);
  }

  /**
   * Clear specific query from cache
   */
  delete(query: string): void {
    const key = this.getCacheKey(query);
    this.cache.del(key);
  }

  /**
   * Clear all cached results
   */
  clear(): void {
    this.cache.flushAll();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const stats = this.cache.getStats();
    const total = stats.hits + stats.misses;
    const hitRate = total > 0 ? stats.hits / total : 0;

    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * Get all cached queries (for debugging)
   */
  getCachedQueries(): string[] {
    return this.cache.keys().map((key) => key.replace("search:", ""));
  }

  /**
   * Get cache entry with metadata
   */
  getEntry(query: string): CacheEntry | null {
    const key = this.getCacheKey(query);
    return this.cache.get<CacheEntry>(key) || null;
  }

  /**
   * Get TTL for a cached query
   */
  getTTL(query: string): number | undefined {
    const key = this.getCacheKey(query);
    return this.cache.getTtl(key);
  }
}
