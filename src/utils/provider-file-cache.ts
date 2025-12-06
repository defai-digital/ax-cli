/**
 * Provider-Aware File Cache
 *
 * This module extends FileCache to support provider-specific cache isolation.
 * When running ax-glm and ax-grok in parallel, each has its own cache directory:
 * - ~/.ax-glm/cache/
 * - ~/.ax-grok/cache/
 *
 * Benefits:
 * - No cache collisions between providers
 * - Independent cache eviction per provider
 * - Clear cache separation for debugging
 *
 * @example
 * ```typescript
 * // Get cache for current provider context
 * const cache = await getProviderFileCache<AnalysisResult>('analysis');
 *
 * // Get cache for specific provider
 * const glmCache = await getProviderFileCache<AnalysisResult>('analysis', 'glm');
 * const grokCache = await getProviderFileCache<AnalysisResult>('analysis', 'grok');
 * ```
 */

import { FileCache, createFileCache } from './file-cache.js';
import {
  ProviderContext,
  ProviderType,
  getProviderContext,
} from './provider-context.js';

/**
 * Provider-aware file cache configuration
 */
export interface ProviderFileCacheConfig {
  /** Entry time-to-live in milliseconds (default: 7 days) */
  ttl?: number;
  /** Max cache entries (default: 10000) */
  maxEntries?: number;
  /** Max cache size in bytes (default: 100MB) */
  maxSize?: number;
  /** Enable git-based change detection (default: true) */
  useGit?: boolean;
  /** Tool version for cache invalidation */
  toolVersion?: string;
}

/**
 * Cache instances keyed by provider:namespace
 */
const providerCacheInstances = new Map<string, FileCache<unknown>>();

/**
 * Get or create a provider-aware file cache
 *
 * @param namespace - Cache namespace (e.g., 'analysis', 'dependency', 'security')
 * @param provider - Provider type (default: current context)
 * @param config - Cache configuration
 * @returns Initialized file cache
 */
export async function getProviderFileCache<T = unknown>(
  namespace: string,
  provider?: ProviderType,
  config?: ProviderFileCacheConfig
): Promise<FileCache<T>> {
  // Get provider context
  const ctx = provider
    ? ProviderContext.create(provider)
    : getProviderContext();

  // Create unique key for this provider:namespace combination
  const key = `${ctx.provider}:${namespace}`;

  // Return existing instance if available
  if (providerCacheInstances.has(key)) {
    const cache = providerCacheInstances.get(key) as FileCache<T>;
    await cache.init();
    return cache;
  }

  // Create new cache with provider-specific directory
  const cache = createFileCache<T>({
    cacheDir: ctx.userCacheDir,
    namespace: ctx.getCacheNamespace(namespace),
    ttl: config?.ttl,
    maxEntries: config?.maxEntries,
    maxSize: config?.maxSize,
    useGit: config?.useGit,
    toolVersion: config?.toolVersion,
  });

  // Initialize and store
  await cache.init();
  providerCacheInstances.set(key, cache);

  return cache;
}

/**
 * Get provider-aware file cache synchronously (without init)
 *
 * Use this when you need immediate access and will call init() later
 */
export function getProviderFileCacheSync<T = unknown>(
  namespace: string,
  provider?: ProviderType,
  config?: ProviderFileCacheConfig
): FileCache<T> {
  const ctx = provider
    ? ProviderContext.create(provider)
    : getProviderContext();

  const key = `${ctx.provider}:${namespace}`;

  if (providerCacheInstances.has(key)) {
    return providerCacheInstances.get(key) as FileCache<T>;
  }

  const cache = createFileCache<T>({
    cacheDir: ctx.userCacheDir,
    namespace: ctx.getCacheNamespace(namespace),
    ttl: config?.ttl,
    maxEntries: config?.maxEntries,
    maxSize: config?.maxSize,
    useGit: config?.useGit,
    toolVersion: config?.toolVersion,
  });

  providerCacheInstances.set(key, cache);
  return cache;
}

/**
 * Save all provider cache instances
 */
export async function saveAllProviderCaches(): Promise<void> {
  await Promise.all(
    Array.from(providerCacheInstances.values()).map((cache) => cache.save())
  );
}

/**
 * Clear cache for a specific provider
 */
export async function clearProviderCache(provider: ProviderType): Promise<void> {
  const keysToDelete: string[] = [];

  for (const [key, cache] of providerCacheInstances.entries()) {
    if (key.startsWith(`${provider}:`)) {
      await cache.clear();
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => providerCacheInstances.delete(key));
}

/**
 * Clear all provider caches
 */
export async function clearAllProviderCaches(): Promise<void> {
  await Promise.all(
    Array.from(providerCacheInstances.values()).map((cache) => cache.clear())
  );
  providerCacheInstances.clear();
}

/**
 * Get cache statistics for a provider
 */
export function getProviderCacheStats(provider: ProviderType): {
  namespaces: string[];
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
} {
  const namespaces: string[] = [];
  let totalEntries = 0;
  let totalHits = 0;
  let totalMisses = 0;

  for (const [key, cache] of providerCacheInstances.entries()) {
    if (key.startsWith(`${provider}:`)) {
      const namespace = key.substring(provider.length + 1);
      namespaces.push(namespace);

      const stats = cache.getStats();
      totalEntries += stats.totalEntries;
      totalHits += stats.hits;
      totalMisses += stats.misses;
    }
  }

  const totalRequests = totalHits + totalMisses;
  const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

  return {
    namespaces,
    totalEntries,
    totalHits,
    totalMisses,
    hitRate,
  };
}

/**
 * Get cache statistics for all providers
 */
export function getAllProviderCacheStats(): Map<
  ProviderType,
  {
    namespaces: string[];
    totalEntries: number;
    totalHits: number;
    totalMisses: number;
    hitRate: number;
  }
> {
  const providers: ProviderType[] = ['glm', 'grok', 'generic'];
  const stats = new Map<
    ProviderType,
    {
      namespaces: string[];
      totalEntries: number;
      totalHits: number;
      totalMisses: number;
      hitRate: number;
    }
  >();

  for (const provider of providers) {
    const providerStats = getProviderCacheStats(provider);
    if (providerStats.namespaces.length > 0) {
      stats.set(provider, providerStats);
    }
  }

  return stats;
}

/**
 * Reset all provider cache instances (for testing)
 */
export function resetProviderCaches(): void {
  providerCacheInstances.clear();
}
