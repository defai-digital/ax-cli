/**
 * Context Store - Handles reading and writing memory.json
 *
 * Provides atomic file operations and schema validation
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ProjectMemory, CacheStats } from './types.js';
import { MEMORY_DEFAULTS } from './types.js';
import { safeValidateProjectMemory } from './schemas.js';
import { parseJsonFile } from '../utils/json-utils.js';

/**
 * Result type for store operations
 */
export type StoreResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * ContextStore - Manages persistence of project memory
 */
export class ContextStore {
  private memoryPath: string;
  private configDir: string;

  constructor(projectRoot: string = process.cwd()) {
    this.configDir = path.join(projectRoot, MEMORY_DEFAULTS.CONFIG_DIR);
    this.memoryPath = path.join(this.configDir, MEMORY_DEFAULTS.FILENAME);
  }

  /**
   * Get the path to memory.json
   */
  getMemoryPath(): string {
    return this.memoryPath;
  }

  /**
   * Get the config directory path
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * Check if memory.json exists
   */
  exists(): boolean {
    return fs.existsSync(this.memoryPath);
  }

  /**
   * Check if .ax-cli directory exists
   */
  configDirExists(): boolean {
    return fs.existsSync(this.configDir);
  }

  /**
   * Load project memory from disk
   */
  load(): StoreResult<ProjectMemory> {
    if (!this.exists()) {
      return {
        success: false,
        error: `Memory file not found at ${this.memoryPath}. Run: ax memory warmup`,
      };
    }

    // Parse JSON file
    const parseResult = parseJsonFile<unknown>(this.memoryPath);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Failed to parse memory.json: ${parseResult.error}\n` +
               `💡 The file may be corrupted. Try: ax memory warmup --force`,
      };
    }

    // Validate schema
    const validation = safeValidateProjectMemory(parseResult.data);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid memory.json schema: ${validation.error}\n` +
               `💡 The file format is outdated or corrupted. Run: ax memory warmup`,
      };
    }

    // Validate memory size (warn if too large)
    const memory = validation.data;
    const tokenEstimate = memory.context.token_estimate;

    if (tokenEstimate > MEMORY_DEFAULTS.MAX_RECOMMENDED_TOKENS) {
      // Log warning but don't fail - this is just a recommendation
      if (process.env.NODE_ENV !== 'test') {
        console.warn(
          `⚠️  Large context detected (${tokenEstimate.toLocaleString()} tokens)\n` +
          `   Recommended: <${MEMORY_DEFAULTS.MAX_RECOMMENDED_TOKENS.toLocaleString()} tokens for optimal caching\n` +
          `   Consider reducing --max-tokens in ax memory warmup`
        );
      }
    }

    return { success: true, data: validation.data };
  }

  /**
   * Save project memory to disk (atomic write)
   */
  save(memory: ProjectMemory): StoreResult<void> {
    try {
      // Ensure .ax-cli directory exists
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }

      // Validate before saving
      const validation = safeValidateProjectMemory(memory);
      if (!validation.success) {
        return {
          success: false,
          error: `Invalid memory data: ${validation.error}\n` +
                 `💡 Memory structure is invalid. Please report this bug.`,
        };
      }

      // Size validation
      const tokenEstimate = memory.context.token_estimate;

      if (tokenEstimate > MEMORY_DEFAULTS.MAX_RECOMMENDED_TOKENS) {
        // Warn but don't fail - user might intentionally want large context
        if (process.env.NODE_ENV !== 'test') {
          console.warn(
            `⚠️  Saving large context (${tokenEstimate.toLocaleString()} tokens)\n` +
            `   This may reduce cache efficiency. Consider using --max-tokens ${MEMORY_DEFAULTS.MAX_RECOMMENDED_TOKENS}`
          );
        }
      }

      // Atomic write: write to temp file then rename
      const tmpPath = `${this.memoryPath}.tmp`;
      const content = JSON.stringify(memory, null, 2);

      fs.writeFileSync(tmpPath, content, 'utf-8');
      fs.renameSync(tmpPath, this.memoryPath);

      return { success: true, data: undefined };
    } catch (error) {
      // Clean up temp file if it exists
      const tmpPath = `${this.memoryPath}.tmp`;
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown write error',
      };
    }
  }

  /**
   * Update only the stats section of memory.json
   */
  updateStats(stats: Partial<CacheStats>): StoreResult<void> {
    const loadResult = this.load();
    if (!loadResult.success) {
      return { success: false, error: loadResult.error };
    }

    const memory = loadResult.data;

    // Merge stats
    memory.stats = {
      ...memory.stats,
      ...stats,
      last_used_at: new Date().toISOString(),
    };

    // Update timestamp
    memory.updated_at = new Date().toISOString();

    return this.save(memory);
  }

  /**
   * Increment usage count and record cache hit
   *
   * ⚠️ KNOWN LIMITATION: Race condition if multiple API calls happen simultaneously.
   * Stats recording uses load-modify-save pattern without locking. In rare cases
   * where multiple API calls overlap, some cache hit stats may be lost.
   * This is acceptable as stats are informational, not critical to operation.
   *
   * For production use requiring perfect accuracy, consider:
   * - File-level locking (complex, platform-dependent)
   * - Separate stats database (overengineering for most use cases)
   * - Async queue with single writer (adds complexity)
   */
  recordUsage(promptTokens: number, cachedTokens: number): StoreResult<void> {
    const loadResult = this.load();
    if (!loadResult.success) {
      // Memory doesn't exist - return actual failure so caller knows stats weren't recorded
      return { success: false, error: 'No memory found - stats not recorded' };
    }

    const memory = loadResult.data;
    const currentStats = memory.stats || {};

    return this.updateStats({
      last_cached_tokens: cachedTokens,
      last_prompt_tokens: promptTokens,
      total_tokens_saved: (currentStats.total_tokens_saved || 0) + cachedTokens,
      usage_count: (currentStats.usage_count || 0) + 1,
    });
  }

  /**
   * Delete memory.json
   */
  clear(): StoreResult<void> {
    if (!this.exists()) {
      // Already cleared
      return { success: true, data: undefined };
    }

    try {
      fs.unlinkSync(this.memoryPath);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown delete error',
      };
    }
  }

  /**
   * Get memory metadata without loading full context
   * Useful for quick status checks
   */
  getMetadata(): {
    exists: boolean;
    tokenEstimate?: number;
    updatedAt?: string;
    contentHash?: string;
    usageCount?: number;
  } {
    if (!this.exists()) {
      return { exists: false };
    }

    const result = this.load();
    if (!result.success) {
      return { exists: false };
    }

    const memory = result.data;
    return {
      exists: true,
      tokenEstimate: memory.context.token_estimate,
      updatedAt: memory.updated_at,
      contentHash: memory.content_hash,
      usageCount: memory.stats?.usage_count,
    };
  }
}

/**
 * Singleton instance for convenience
 * NOTE: Singleton uses process.cwd() as projectRoot
 */
let defaultStore: ContextStore | null = null;

/**
 * Get a context store instance
 *
 * IMPORTANT: Singleton behavior
 * - Without projectRoot: Returns singleton instance (uses process.cwd())
 * - With projectRoot: Returns NEW instance for that specific project
 *
 * Example:
 * ```typescript
 * const store1 = getContextStore();           // Singleton
 * const store2 = getContextStore();           // Same instance
 * const store3 = getContextStore('/custom'); // New instance
 * ```
 *
 * @param projectRoot - Optional custom project root. If provided, returns a new instance.
 * @returns ContextStore instance
 */
export function getContextStore(projectRoot?: string): ContextStore {
  if (projectRoot) {
    // Custom project root - always return new instance
    return new ContextStore(projectRoot);
  }

  // Default behavior - return singleton
  if (!defaultStore) {
    defaultStore = new ContextStore();
  }

  return defaultStore;
}

/**
 * Reset the default store (mainly for testing)
 */
export function resetDefaultStore(): void {
  defaultStore = null;
}
