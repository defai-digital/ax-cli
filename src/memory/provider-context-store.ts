/**
 * Provider-Aware Context Store
 *
 * This module extends ContextStore to support provider-specific memory isolation.
 * When running ax-glm and ax-grok in parallel, each has its own memory.json:
 * - .ax-glm/memory.json
 * - .ax-grok/memory.json
 *
 * @example
 * ```typescript
 * // Get store for current provider context
 * const store = getProviderContextStore();
 *
 * // Get store for specific provider
 * const glmStore = getProviderContextStore('glm');
 * const grokStore = getProviderContextStore('grok');
 * ```
 */

import * as fs from 'fs';
import type { ProjectMemory, CacheStats } from './types.js';
import { MEMORY_DEFAULTS } from './types.js';
import { safeValidateProjectMemory } from './schemas.js';
import { parseJsonFile } from '../utils/json-utils.js';
import {
  ProviderContext,
  ProviderType,
  getProviderContext,
} from '../utils/provider-context.js';
import { withFileLockSync } from '../utils/file-lock.js';

/**
 * Result type for store operations
 */
export type StoreResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Provider-Aware Context Store
 *
 * Unlike the base ContextStore which uses a global singleton,
 * this version supports instance-based operation for multi-provider scenarios.
 */
export class ProviderContextStore {
  private static instances = new Map<string, ProviderContextStore>();

  readonly context: ProviderContext;
  readonly memoryPath: string;
  readonly configDir: string;

  private constructor(context: ProviderContext) {
    this.context = context;
    this.configDir = context.projectDir;
    this.memoryPath = context.projectMemoryPath;
  }

  /**
   * Get or create a store for a provider context
   */
  static forContext(context: ProviderContext): ProviderContextStore {
    const key = `${context.provider}:${context.projectDir}`;
    let instance = ProviderContextStore.instances.get(key);
    if (!instance) {
      instance = new ProviderContextStore(context);
      ProviderContextStore.instances.set(key, instance);
    }
    return instance;
  }

  /**
   * Get store for specific provider
   */
  static forProvider(
    provider: ProviderType,
    projectRoot?: string
  ): ProviderContextStore {
    const context = projectRoot
      ? ProviderContext.create(provider, projectRoot)
      : ProviderContext.create(provider);
    return ProviderContextStore.forContext(context);
  }

  /**
   * Get store for current provider context
   */
  static current(): ProviderContextStore {
    return ProviderContextStore.forContext(getProviderContext());
  }

  /**
   * Clear all cached instances (for testing)
   */
  static clearInstances(): void {
    ProviderContextStore.instances.clear();
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
   * Check if provider config directory exists
   */
  configDirExists(): boolean {
    return fs.existsSync(this.configDir);
  }

  /**
   * Load project memory from disk with file locking
   */
  load(): StoreResult<ProjectMemory> {
    if (!this.exists()) {
      return {
        success: false,
        error: `Memory file not found at ${this.memoryPath}. Run: ${this.context.config.cliName} memory warmup`,
      };
    }

    try {
      // Use file locking for safe concurrent reads
      return withFileLockSync(
        this.memoryPath,
        () => {
          // Parse JSON file
          const parseResult = parseJsonFile<unknown>(this.memoryPath);
          if (!parseResult.success) {
            return {
              success: false,
              error:
                `Failed to parse memory.json: ${parseResult.error}\n` +
                `💡 The file may be corrupted. Try: ${this.context.config.cliName} memory warmup --force`,
            };
          }

          // Validate schema
          const validation = safeValidateProjectMemory(parseResult.data);
          if (!validation.success) {
            return {
              success: false,
              error:
                `Invalid memory.json schema: ${validation.error}\n` +
                `💡 The file format is outdated or corrupted. Run: ${this.context.config.cliName} memory warmup`,
            };
          }

          // Validate memory size (warn if too large)
          const memory = validation.data;
          const tokenEstimate = memory.context.token_estimate;

          if (tokenEstimate > MEMORY_DEFAULTS.MAX_RECOMMENDED_TOKENS) {
            if (process.env.NODE_ENV !== 'test') {
              console.warn(
                `⚠️  [${this.context.provider}] Large context detected (${tokenEstimate.toLocaleString()} tokens)\n` +
                  `   Recommended: <${MEMORY_DEFAULTS.MAX_RECOMMENDED_TOKENS.toLocaleString()} tokens for optimal caching`
              );
            }
          }

          return { success: true, data: validation.data };
        },
        { type: 'read', timeout: 5000 }
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to load memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Save project memory to disk with file locking (atomic write)
   */
  save(memory: ProjectMemory): StoreResult<void> {
    try {
      // Ensure provider config directory exists
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }

      // Validate before saving
      const validation = safeValidateProjectMemory(memory);
      if (!validation.success) {
        return {
          success: false,
          error:
            `Invalid memory data: ${validation.error}\n` +
            `💡 Memory structure is invalid. Please report this bug.`,
        };
      }

      // Size validation warning
      const tokenEstimate = memory.context.token_estimate;
      if (tokenEstimate > MEMORY_DEFAULTS.MAX_RECOMMENDED_TOKENS) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn(
            `⚠️  [${this.context.provider}] Saving large context (${tokenEstimate.toLocaleString()} tokens)`
          );
        }
      }

      // Use file locking for safe concurrent writes
      return withFileLockSync(
        this.memoryPath,
        () => {
          // Atomic write: write to temp file then rename
          const tmpPath = `${this.memoryPath}.tmp.${process.pid}.${Date.now()}`;
          const content = JSON.stringify(memory, null, 2);

          try {
            fs.writeFileSync(tmpPath, content, 'utf-8');
            fs.renameSync(tmpPath, this.memoryPath);
            return { success: true, data: undefined };
          } catch (writeError) {
            // Clean up temp file
            try {
              if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath);
              }
            } catch {
              // Ignore cleanup errors
            }
            throw writeError;
          }
        },
        { type: 'write', timeout: 10000 }
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown write error',
      };
    }
  }

  /**
   * Update only the stats section of memory.json with locking
   */
  updateStats(stats: Partial<CacheStats>): StoreResult<void> {
    try {
      return withFileLockSync(
        this.memoryPath,
        () => {
          const loadResult = this.loadWithoutLock();
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

          return this.saveWithoutLock(memory);
        },
        { type: 'write', timeout: 10000 }
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to update stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Internal load without locking (for use within locked sections)
   */
  private loadWithoutLock(): StoreResult<ProjectMemory> {
    if (!this.exists()) {
      return {
        success: false,
        error: `Memory file not found at ${this.memoryPath}`,
      };
    }

    const parseResult = parseJsonFile<unknown>(this.memoryPath);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Failed to parse memory.json: ${parseResult.error}`,
      };
    }

    const validation = safeValidateProjectMemory(parseResult.data);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid memory.json schema: ${validation.error}`,
      };
    }

    return { success: true, data: validation.data };
  }

  /**
   * Internal save without locking (for use within locked sections)
   */
  private saveWithoutLock(memory: ProjectMemory): StoreResult<void> {
    const tmpPath = `${this.memoryPath}.tmp.${process.pid}.${Date.now()}`;
    const content = JSON.stringify(memory, null, 2);

    try {
      fs.writeFileSync(tmpPath, content, 'utf-8');
      fs.renameSync(tmpPath, this.memoryPath);
      return { success: true, data: undefined };
    } catch (error) {
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
   * Record usage with proper locking (fixes race condition)
   */
  recordUsage(promptTokens: number, cachedTokens: number): StoreResult<void> {
    try {
      return withFileLockSync(
        this.memoryPath,
        () => {
          const loadResult = this.loadWithoutLock();
          if (!loadResult.success) {
            return {
              success: false,
              error: `[${this.context.provider}] No memory found - stats not recorded`,
            };
          }

          const memory = loadResult.data;
          const currentStats = memory.stats || {};

          memory.stats = {
            ...currentStats,
            last_cached_tokens: cachedTokens,
            last_prompt_tokens: promptTokens,
            total_tokens_saved:
              (currentStats.total_tokens_saved || 0) + cachedTokens,
            usage_count: (currentStats.usage_count || 0) + 1,
            last_used_at: new Date().toISOString(),
          };

          memory.updated_at = new Date().toISOString();

          return this.saveWithoutLock(memory);
        },
        { type: 'write', timeout: 10000 }
      );
    } catch (error) {
      return {
        success: false,
        error: `Failed to record usage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Delete memory.json
   */
  clear(): StoreResult<void> {
    if (!this.exists()) {
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
   */
  getMetadata(): {
    exists: boolean;
    provider: ProviderType;
    tokenEstimate?: number;
    updatedAt?: string;
    contentHash?: string;
    usageCount?: number;
  } {
    const base = {
      exists: false,
      provider: this.context.provider,
    };

    if (!this.exists()) {
      return base;
    }

    const result = this.load();
    if (!result.success) {
      return base;
    }

    const memory = result.data;
    return {
      exists: true,
      provider: this.context.provider,
      tokenEstimate: memory.context.token_estimate,
      updatedAt: memory.updated_at,
      contentHash: memory.content_hash,
      usageCount: memory.stats?.usage_count,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get provider-aware context store
 */
export function getProviderContextStore(
  provider?: ProviderType,
  projectRoot?: string
): ProviderContextStore {
  if (provider) {
    return ProviderContextStore.forProvider(provider, projectRoot);
  }
  return ProviderContextStore.current();
}

/**
 * Get memory metadata for all configured providers
 */
export function getAllProviderMemoryMetadata(projectRoot?: string): Array<{
  provider: ProviderType;
  exists: boolean;
  tokenEstimate?: number;
  usageCount?: number;
}> {
  const providers: ProviderType[] = ['glm', 'grok', 'generic'];
  return providers.map((provider) => {
    const store = getProviderContextStore(provider, projectRoot);
    return store.getMetadata();
  });
}
