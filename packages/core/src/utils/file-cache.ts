/**
 * File Cache System for Analysis Results
 *
 * Implements intelligent caching to avoid re-analyzing unchanged files:
 * - Multi-level change detection (mtime, size, hash)
 * - Automatic cache invalidation
 * - Git integration for change detection
 * - Configurable TTL and size limits
 *
 * Best practices:
 * - Uses SHA-256 for content hashing
 * - Stores cache in user directory (~/.ax-cli/cache/)
 * - Includes cache versioning for schema changes
 * - Provides statistics and cache management
 */

import { createHash } from 'crypto';
import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { CONFIG_DIR_NAME } from '../constants.js';

/**
 * Cache entry structure
 */
interface CacheEntry<T = unknown> {
  /** File path (relative to cwd) */
  path: string;
  /** Last modification time (ms since epoch) */
  mtime: number;
  /** File size in bytes */
  size: number;
  /** Content hash (SHA-256) */
  hash: string;
  /** Cached analysis result */
  result: T;
  /** Cache entry creation time */
  cachedAt: number;
  /** Cache entry version (for schema migrations) */
  version: number;
}

/**
 * Cache metadata
 */
interface CacheMetadata {
  /** Cache schema version */
  version: number;
  /** Cache creation time */
  createdAt: number;
  /** Last access time */
  lastAccessedAt: number;
  /** Tool version that created the cache */
  toolVersion?: string;
  /** Total entries */
  totalEntries: number;
  /** Total size of cached data (bytes) */
  totalSize: number;
}

/**
 * Cache statistics
 */
interface CacheStats {
  hits: number;
  misses: number;
  invalidations: number;
  totalEntries: number;
  cacheSize: number;
  hitRate: number;
}

/**
 * File cache configuration
 */
interface FileCacheConfig {
  /** Cache directory (default: ~/.ax-cli/cache) */
  cacheDir?: string;
  /** Cache namespace (allows multiple independent caches) */
  namespace?: string;
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
 * File Cache Manager
 *
 * Provides intelligent file caching with multiple change detection strategies
 */
export class FileCache<T = unknown> {
  private config: Required<FileCacheConfig>;
  private cache: Map<string, CacheEntry<T>> = new Map();
  private metadata: CacheMetadata;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    totalEntries: 0,
    cacheSize: 0,
    hitRate: 0,
  };
  private gitChangedFiles?: Set<string>;
  private cacheLoaded = false;
  private cacheDirty = false;

  constructor(config: FileCacheConfig = {}) {
    // Default configuration
    const homeDir = homedir();
    this.config = {
      cacheDir: config.cacheDir || join(homeDir, CONFIG_DIR_NAME, 'cache'),
      namespace: config.namespace || 'default',
      ttl: config.ttl || 7 * 24 * 60 * 60 * 1000, // 7 days
      maxEntries: config.maxEntries || 10000,
      maxSize: config.maxSize || 100 * 1024 * 1024, // 100MB
      useGit: config.useGit !== false,
      toolVersion: config.toolVersion || '1.0.0',
    };

    this.metadata = {
      version: 1,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      toolVersion: this.config.toolVersion,
      totalEntries: 0,
      totalSize: 0,
    };
  }

  /**
   * Initialize cache (load from disk)
   */
  async init(): Promise<void> {
    if (this.cacheLoaded) return;

    // Ensure cache directory exists
    await mkdir(this.config.cacheDir, { recursive: true });

    // Load cache from disk
    await this.loadCache();

    // Load git changed files if enabled
    if (this.config.useGit) {
      this.gitChangedFiles = await this.getGitChangedFiles();
    }

    this.cacheLoaded = true;
  }

  /**
   * Get cached result for a file, or compute if not cached/invalid
   */
  async get(
    filePath: string,
    computer: (path: string) => Promise<T>
  ): Promise<T> {
    await this.init();

    const relativePath = this.getRelativePath(filePath);

    // Check if file has changed via git (fast check)
    if (this.gitChangedFiles && this.gitChangedFiles.has(relativePath)) {
      this.stats.misses++;
      return this.computeAndCache(filePath, computer);
    }

    // Check cache
    const cached = this.cache.get(relativePath);

    if (!cached) {
      this.stats.misses++;
      return this.computeAndCache(filePath, computer);
    }

    // Validate cache entry
    const isValid = await this.isCacheValid(filePath, cached);

    if (!isValid) {
      this.stats.invalidations++;
      this.stats.misses++;
      return this.computeAndCache(filePath, computer);
    }

    // Cache hit!
    this.stats.hits++;
    this.updateStats();
    return cached.result;
  }

  /**
   * Set cache entry directly
   */
  async set(filePath: string, result: T): Promise<void> {
    await this.init();

    const relativePath = this.getRelativePath(filePath);
    const fileStat = await stat(filePath);
    const hash = await this.hashFile(filePath);

    const entry: CacheEntry<T> = {
      path: relativePath,
      mtime: fileStat.mtimeMs,
      size: fileStat.size,
      hash,
      result,
      cachedAt: Date.now(),
      version: this.metadata.version,
    };

    this.cache.set(relativePath, entry);
    this.cacheDirty = true;

    // Enforce limits
    await this.enforceLimits();

    // Update stats
    this.updateStats();
  }

  /**
   * Check if a file has changed
   */
  async hasChanged(filePath: string): Promise<boolean> {
    await this.init();

    const relativePath = this.getRelativePath(filePath);

    // Git check (fastest)
    if (this.gitChangedFiles && this.gitChangedFiles.has(relativePath)) {
      return true;
    }

    const cached = this.cache.get(relativePath);
    if (!cached) return true;

    return !(await this.isCacheValid(filePath, cached));
  }

  /**
   * Invalidate cache for a specific file
   */
  invalidate(filePath: string): void {
    const relativePath = this.getRelativePath(filePath);
    const deleted = this.cache.delete(relativePath);
    if (deleted) {
      this.stats.invalidations++;
      this.cacheDirty = true;
    }
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      totalEntries: 0,
      cacheSize: 0,
      hitRate: 0,
    };
    this.cacheDirty = true;
    await this.saveCache();
  }

  /**
   * Calculate total size of all cached entries
   */
  private calculateTotalSize(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Save cache to disk
   */
  async save(): Promise<void> {
    if (!this.cacheDirty) return;
    await this.saveCache();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache metadata
   */
  getMetadata(): CacheMetadata {
    return { ...this.metadata };
  }

  /**
   * Prune expired entries
   */
  async prune(): Promise<number> {
    const now = Date.now();
    let pruned = 0;

    for (const [path, entry] of this.cache.entries()) {
      if (now - entry.cachedAt > this.config.ttl) {
        this.cache.delete(path);
        pruned++;
      }
    }

    if (pruned > 0) {
      this.cacheDirty = true;
      this.updateStats();
      await this.saveCache();
    }

    return pruned;
  }

  // Private methods

  private async computeAndCache(
    filePath: string,
    computer: (path: string) => Promise<T>
  ): Promise<T> {
    const result = await computer(filePath);
    await this.set(filePath, result);
    return result;
  }

  private async isCacheValid(
    filePath: string,
    cached: CacheEntry<T>
  ): Promise<boolean> {
    try {
      // Fast checks first (no I/O)
      if (cached.version !== this.metadata.version) return false;
      if (Date.now() - cached.cachedAt > this.config.ttl) return false;

      // Check tool version - invalidate on tool upgrades
      if (this.metadata.toolVersion && this.config.toolVersion !== this.metadata.toolVersion) {
        return false;
      }

      // File existence check (minimal I/O)
      if (!existsSync(filePath)) return false;

      // Fast I/O checks: mtime and size
      const fileStat = await stat(filePath);
      if (fileStat.mtimeMs !== cached.mtime) return false;
      if (fileStat.size !== cached.size) return false;

      // Slow but accurate: content hash (only if fast checks pass)
      const currentHash = await this.hashFile(filePath);
      return currentHash === cached.hash;
    } catch {
      return false;
    }
  }

  private async hashFile(filePath: string): Promise<string> {
    const content = await readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  }

  private getRelativePath(filePath: string): string {
    const cwd = process.cwd();
    return relative(cwd, filePath);
  }

  private async getGitChangedFiles(): Promise<Set<string> | undefined> {
    try {
      // Check if we're in a git repo
      execSync('git rev-parse --git-dir', {
        stdio: 'ignore',
        cwd: process.cwd(),
      });

      // Get changed files (modified, added, untracked)
      const output = execSync(
        'git status --porcelain --untracked-files=all',
        {
          encoding: 'utf-8',
          cwd: process.cwd(),
        }
      );

      const changedFiles = new Set<string>();

      for (const line of output.split('\n')) {
        if (!line.trim()) continue;

        // BUG FIX: Validate line length before parsing git status output
        // Git status format: "XY filename" where XY is 2-char status code
        if (line.length < 4) continue;  // Minimum: "X  f" (status + space + 1 char filename)

        // Parse git status output
        const status = line.substring(0, 2);
        const filePath = line.substring(3).trim();  // BUG FIX: trim to handle extra spaces

        // BUG FIX: Skip if filePath is empty (edge case protection)
        if (!filePath) continue;

        // Include modified, added, deleted, renamed, untracked files
        if (status.trim()) {
          changedFiles.add(filePath);
        }
      }

      return changedFiles;
    } catch {
      // Not a git repo or git not available
      return undefined;
    }
  }

  private getCacheFilePath(): string {
    return join(this.config.cacheDir, `${this.config.namespace}.json`);
  }

  private async loadCache(): Promise<void> {
    const cacheFile = this.getCacheFilePath();

    if (!existsSync(cacheFile)) {
      return;
    }

    try {
      const content = await readFile(cacheFile, 'utf-8');
      const data = JSON.parse(content);

      // Load metadata
      if (data.metadata) {
        this.metadata = data.metadata;
        this.metadata.lastAccessedAt = Date.now();
      }

      // Load entries
      if (data.entries && Array.isArray(data.entries)) {
        for (const entry of data.entries) {
          this.cache.set(entry.path, entry);
        }
      }

      // Update stats
      this.stats.totalEntries = this.cache.size;
      this.updateStats();
    } catch (error) {
      // Cache corrupted, start fresh
      console.warn(`Cache corrupted, starting fresh: ${error}`);
    }
  }

  private async saveCache(): Promise<void> {
    const cacheFile = this.getCacheFilePath();

    // Update metadata
    this.metadata.totalEntries = this.cache.size;
    this.metadata.lastAccessedAt = Date.now();
    this.metadata.totalSize = this.calculateTotalSize();

    const data = {
      metadata: this.metadata,
      entries: Array.from(this.cache.values()),
    };

    await writeFile(cacheFile, JSON.stringify(data, null, 2));
    this.cacheDirty = false;
  }

  private async enforceLimits(): Promise<void> {
    // Enforce max entries
    if (this.cache.size > this.config.maxEntries) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);

      const toRemove = entries.slice(0, entries.length - this.config.maxEntries);
      for (const [path] of toRemove) {
        this.cache.delete(path);
      }
    }

    // Enforce max size
    const totalSize = this.calculateTotalSize();
    if (totalSize > this.config.maxSize) {
      // Remove oldest entries until under limit
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);

      let currentSize = totalSize;
      for (const [path, entry] of entries) {
        if (currentSize <= this.config.maxSize) break;
        this.cache.delete(path);
        currentSize -= entry.size;
      }
    }
  }

  private updateStats(): void {
    this.stats.totalEntries = this.cache.size;
    this.stats.cacheSize = this.calculateTotalSize();

    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Create a file cache instance
 */
export function createFileCache<T = unknown>(config?: FileCacheConfig): FileCache<T> {
  return new FileCache<T>(config);
}

/**
 * Global cache instances by namespace
 */
const cacheInstances = new Map<string, FileCache<unknown>>();

/**
 * Get or create a cache instance for a namespace
 */
export function getFileCache<T = unknown>(
  namespace: string,
  config?: Omit<FileCacheConfig, 'namespace'>
): FileCache<T> {
  if (!cacheInstances.has(namespace)) {
    cacheInstances.set(
      namespace,
      new FileCache<T>({ ...config, namespace })
    );
  }
  return cacheInstances.get(namespace) as FileCache<T>;
}

/**
 * Save all cache instances
 */
export async function saveAllCaches(): Promise<void> {
  await Promise.all(
    Array.from(cacheInstances.values()).map(cache => cache.save())
  );
}

/**
 * Clear all cache instances
 */
export async function clearAllCaches(): Promise<void> {
  await Promise.all(
    Array.from(cacheInstances.values()).map(cache => cache.clear())
  );
  cacheInstances.clear();
}
