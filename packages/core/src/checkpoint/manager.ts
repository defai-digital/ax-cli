/**
 * Checkpoint Manager
 *
 * High-level API for checkpoint operations:
 * - Creating checkpoints
 * - Listing checkpoints
 * - Restoring checkpoints
 * - Pruning old checkpoints
 * - Automatic checkpoint scheduling
 */

import crypto from 'crypto';
import * as fs from 'fs/promises';
import path from 'path';
import { CheckpointStorage, calculateHash, verifyFileSnapshot } from './storage.js';
import { validatePathSecure } from '../utils/path-security.js';
import type {
  Checkpoint,
  CheckpointConfig,
  CheckpointInfo,
  CheckpointOptions,
  CheckpointRestoreResult,
  CheckpointStats,
  CheckpointFilter,
  FileSnapshot,
} from './types.js';
import { DEFAULT_CHECKPOINT_CONFIG } from './types.js';
import type { ChatEntry } from '../agent/llm-agent.js';
import { extractErrorMessage } from '../utils/error-handler.js';

export class CheckpointManager {
  private storage: CheckpointStorage;
  private config: CheckpointConfig;
  private maintenanceRunning: boolean = false; // CONCURRENCY FIX: Prevent concurrent maintenance

  constructor(config?: Partial<CheckpointConfig>, baseDir?: string) {
    this.config = { ...DEFAULT_CHECKPOINT_CONFIG, ...config };
    // Use config.storageDir if provided, otherwise use baseDir parameter
    const storageDir = this.config.storageDir || baseDir;
    this.storage = new CheckpointStorage(storageDir);
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  /**
   * Create a new checkpoint
   */
  async createCheckpoint(options: CheckpointOptions): Promise<Checkpoint> {
    if (!this.config.enabled) {
      throw new Error('Checkpoint system is disabled');
    }

    const checkpointId = crypto.randomUUID();
    const timestamp = new Date();

    // Create file snapshots
    const fileSnapshots: FileSnapshot[] = [];
    for (const file of options.files) {
      const validation = await validatePathSecure(file.path).catch(() => ({ success: false } as const));
      const safePath = validation.success && validation.path ? validation.path : path.resolve(file.path);

      if (!validation.success) {
        // Warn but continue so checkpoints can still be created for reporting; restoration will re-validate
        console.warn(`Skipped path security validation for checkpoint file ${file.path}: ${'error' in validation ? validation.error : 'validation failed'}`);
      }

      const hash = calculateHash(file.content);
      fileSnapshots.push({
        path: safePath,
        content: file.content,
        hash,
        size: Buffer.byteLength(file.content, 'utf-8'),
      });
    }

    // Limit conversation depth
    // INPUT VALIDATION FIX: Validate conversationState and conversationDepth
    if (!options.conversationState) {
      throw new Error('conversationState is required for checkpoint creation');
    }

    // Validate conversationDepth is positive
    const depth = this.config.conversationDepth;
    if (!depth || depth <= 0) {
      throw new Error(`Invalid conversationDepth: ${depth}. Must be positive integer.`);
    }

    const conversationState = options.conversationState.slice(-depth);

    // Generate default description if not provided
    const defaultDescription = options.files.length > 0
      ? `Before modifying ${options.files.length === 1 ? options.files[0].path : `${options.files.length} files`}`
      : 'Auto-generated checkpoint';

    const checkpoint: Checkpoint = {
      id: checkpointId,
      timestamp,
      description: options.description || defaultDescription,
      files: fileSnapshots,
      conversationState,
      metadata: {
        ...options.metadata,
        // Apply defaults AFTER spread so they're not overwritten by undefined
        model: options.metadata?.model || 'unknown',
        triggeredBy: options.metadata?.triggeredBy || 'manual',
      },
    };

    await this.storage.save(checkpoint);

    // Run maintenance
    await this.runMaintenance();

    return checkpoint;
  }

  /**
   * Restore a checkpoint
   */
  async restoreCheckpoint(checkpointId: string): Promise<CheckpointRestoreResult> {
    const checkpoint = await this.storage.load(checkpointId);

    if (!checkpoint) {
      return {
        success: false,
        filesRestored: [],
        filesFailed: [],
        error: `Checkpoint ${checkpointId} not found`,
      };
    }

    const filesRestored: string[] = [];
    const filesFailed: string[] = [];

    // Restore files
    for (const snapshot of checkpoint.files) {
      try {
        // Verify file integrity before restoring
        if (!verifyFileSnapshot(snapshot)) {
          filesFailed.push(snapshot.path);
          console.error(`Hash verification failed for ${snapshot.path}: checkpoint may be corrupted`);
          continue;
        }

        const validation = await validatePathSecure(snapshot.path);
        if (!validation.success || !validation.path) {
          filesFailed.push(snapshot.path);
          console.warn(`Skipped restoring ${snapshot.path}: ${validation.error || 'path validation failed'}`);
          continue;
        }

        const safePath = validation.path;
        // Ensure parent directory exists before writing
        const parentDir = path.dirname(safePath);
        await fs.mkdir(parentDir, { recursive: true });
        await fs.writeFile(safePath, snapshot.content, 'utf-8');
        filesRestored.push(safePath);
      } catch (error: unknown) {
        filesFailed.push(snapshot.path);
        // BUG FIX: Use type guard to safely access error message
        // JavaScript allows throwing any value, not just Error objects
        const msg = extractErrorMessage(error);
        console.error(`Failed to restore ${snapshot.path}: ${msg}`);
      }
    }

    return {
      success: filesFailed.length === 0,
      filesRestored,
      filesFailed,
      conversationIndex: checkpoint.conversationState.length,
      error: filesFailed.length > 0
        ? `Failed to restore ${filesFailed.length} file(s)`
        : undefined,
    };
  }

  /**
   * Apply a checkpoint (restore files and return conversation state)
   * Alias for restoreCheckpoint for backward compatibility
   */
  async applyCheckpoint(checkpointId: string): Promise<CheckpointRestoreResult> {
    return await this.restoreCheckpoint(checkpointId);
  }

  /**
   * List checkpoints with optional filtering
   */
  async listCheckpoints(filter?: CheckpointFilter): Promise<CheckpointInfo[]> {
    let checkpoints = await this.storage.listInfo();

    // Apply filters
    // Support both beforeDate/until (before this date, i.e., <=)
    const beforeDate = filter?.beforeDate || filter?.until;
    if (beforeDate) {
      checkpoints = checkpoints.filter(c => c.timestamp <= beforeDate);
    }

    // Support both afterDate/since (after this date, i.e., >=)
    const afterDate = filter?.afterDate || filter?.since;
    if (afterDate) {
      checkpoints = checkpoints.filter(c => c.timestamp >= afterDate);
    }

    if (filter?.filesChanged) {
      const searchPaths = filter.filesChanged;
      checkpoints = checkpoints.filter(c =>
        searchPaths.some(searchPath =>
          c.filesChanged.some(filePath => filePath.includes(searchPath))
        )
      );
    }

    // Filter by compression status (default: include all)
    if (filter?.includeCompressed === false) {
      checkpoints = checkpoints.filter(c => !c.compressed);
    }

    // Apply limit
    if (filter?.limit) {
      checkpoints = checkpoints.slice(0, filter.limit);
    }

    return checkpoints;
  }

  /**
   * Get checkpoint by ID
   */
  async getCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    return await this.storage.load(checkpointId);
  }

  /**
   * Get checkpoint info
   */
  async getCheckpointInfo(checkpointId: string): Promise<CheckpointInfo | null> {
    return await this.storage.getCheckpointInfo(checkpointId);
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(checkpointId: string): Promise<void> {
    await this.storage.delete(checkpointId);
  }

  /**
   * Get checkpoint statistics
   */
  async getStats(): Promise<CheckpointStats> {
    return await this.storage.getStats();
  }

  /**
   * Prune old checkpoints based on config
   */
  async pruneOldCheckpoints(): Promise<number> {
    if (!this.config.enabled) {
      return 0;
    }

    // Validate pruneAfterDays is a positive finite number
    const pruneAfterDays = this.config.pruneAfterDays;
    if (!Number.isFinite(pruneAfterDays) || pruneAfterDays <= 0) {
      console.warn(`Invalid pruneAfterDays config: ${pruneAfterDays}. Must be a positive number.`);
      return 0;
    }

    const pruneDate = new Date();
    pruneDate.setDate(pruneDate.getDate() - pruneAfterDays);

    return await this.storage.pruneOlderThan(pruneDate);
  }

  /**
   * Compress old checkpoints based on config
   */
  async compressOldCheckpoints(): Promise<number> {
    if (!this.config.enabled) {
      return 0;
    }

    // Validate compressAfterDays is a positive finite number
    const compressAfterDays = this.config.compressAfterDays;
    if (!Number.isFinite(compressAfterDays) || compressAfterDays <= 0) {
      console.warn(`Invalid compressAfterDays config: ${compressAfterDays}. Must be a positive number.`);
      return 0;
    }

    const compressDate = new Date();
    compressDate.setDate(compressDate.getDate() - compressAfterDays);

    const checkpoints = await this.storage.listInfo();
    let compressed = 0;

    // BUG FIX: Catch individual compression errors to continue with remaining checkpoints
    for (const checkpoint of checkpoints) {
      if (checkpoint.timestamp < compressDate && !checkpoint.compressed) {
        try {
          await this.storage.compress(checkpoint.id);
          compressed++;
        } catch (error: unknown) {
          const msg = extractErrorMessage(error);
          console.error(`Failed to compress checkpoint ${checkpoint.id}: ${msg}`);
        }
      }
    }

    return compressed;
  }

  /**
   * Run maintenance (pruning, compression, limit enforcement)
   */
  async runMaintenance(): Promise<void> {
    // Skip maintenance if checkpoints are disabled
    if (!this.config.enabled) {
      return;
    }

    // CONCURRENCY FIX: Prevent concurrent maintenance operations
    if (this.maintenanceRunning) {
      console.warn('Maintenance already running, skipping concurrent execution');
      return; // Skip if already running
    }

    this.maintenanceRunning = true;

    try {
      // BUG FIX: Use type guard for all error handlers to safely access error message
      // JavaScript allows throwing any value, not just Error objects

      // Compress old checkpoints - catch errors to continue with other stages
      try {
        await this.compressOldCheckpoints();
      } catch (error: unknown) {
        const msg = extractErrorMessage(error);
        console.error(`Failed to compress old checkpoints: ${msg}`);
      }

      // Prune very old checkpoints - catch errors to continue with other stages
      try {
        await this.pruneOldCheckpoints();
      } catch (error: unknown) {
        const msg = extractErrorMessage(error);
        console.error(`Failed to prune old checkpoints: ${msg}`);
      }

      // Enforce max checkpoints limit - catch errors to continue with other stages
      try {
        await this.enforceCheckpointLimit();
      } catch (error: unknown) {
        const msg = extractErrorMessage(error);
        console.error(`Failed to enforce checkpoint limit: ${msg}`);
      }

      // Enforce storage limit - catch errors to continue with other stages
      try {
        await this.enforceStorageLimit();
      } catch (error: unknown) {
        const msg = extractErrorMessage(error);
        console.error(`Failed to enforce storage limit: ${msg}`);
      }
    } finally {
      // Always reset flag, even if operations fail
      this.maintenanceRunning = false;
    }
  }

  /**
   * Enforce maximum number of checkpoints
   */
  private async enforceCheckpointLimit(): Promise<void> {
    // Validate maxCheckpoints is a positive finite number
    const maxCheckpoints = this.config.maxCheckpoints;
    if (!Number.isFinite(maxCheckpoints) || maxCheckpoints < 0) {
      console.warn(`Invalid maxCheckpoints config: ${maxCheckpoints}. Must be a non-negative number.`);
      return;
    }

    const checkpoints = await this.storage.listInfo();
    const limit = Math.max(0, Math.floor(maxCheckpoints));

    if (checkpoints.length > limit) {
      const toDelete = checkpoints
        .slice(limit)
        .map(c => c.id);

      // BUG FIX: Catch individual delete errors to continue with remaining checkpoints
      for (const id of toDelete) {
        try {
          await this.storage.delete(id);
        } catch (error: unknown) {
          const msg = extractErrorMessage(error);
          console.error(`Failed to delete checkpoint ${id} during limit enforcement: ${msg}`);
        }
      }
    }
  }

  /**
   * Enforce storage size limit (in MB)
   */
  private async enforceStorageLimit(): Promise<void> {
    const stats = await this.storage.getStats();
    const limitBytes = this.config.storageLimit * 1024 * 1024;

    if (stats.totalSize > limitBytes) {
      const checkpoints = await this.storage.listInfo();

      // Sort by timestamp ascending (oldest first) to ensure we delete oldest checkpoints first
      // This prevents issues if the index is ever unsorted or corrupted
      checkpoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      let currentSize = stats.totalSize;

      // LOGIC FIX: Add safeguards against infinite loop
      // Guard against infinite loop if checkpoint.size is 0, undefined, or corrupted
      const MAX_ITERATIONS = checkpoints.length + 10; // Allow some margin
      let iterations = 0;

      // Delete oldest checkpoints (from start of sorted array) until under limit
      for (let i = 0; i < checkpoints.length && currentSize > limitBytes; i++) {
        // Safety: prevent infinite loop from corrupted data
        if (++iterations > MAX_ITERATIONS) {
          console.error(`Storage limit enforcement exceeded ${MAX_ITERATIONS} iterations, aborting to prevent infinite loop`);
          break;
        }

        const checkpoint = checkpoints[i];

        // Validate checkpoint.size before using it
        if (!checkpoint.size || checkpoint.size <= 0) {
          console.warn(`Invalid checkpoint size for ${checkpoint.id} (size: ${checkpoint.size}), skipping deletion`);
          continue; // Skip this checkpoint, try next one
        }

        // BUG FIX: Catch individual delete errors to continue with remaining checkpoints
        // Previously, a single delete failure would stop the entire loop
        try {
          await this.storage.delete(checkpoint.id);
          currentSize -= checkpoint.size;
        } catch (error: unknown) {
          const msg = extractErrorMessage(error);
          console.error(`Failed to delete checkpoint ${checkpoint.id} during storage limit enforcement: ${msg}`);
          // Continue with next checkpoint instead of stopping
        }

        // Safety: prevent negative size from arithmetic errors
        if (currentSize < 0) {
          currentSize = 0;
        }
      }
    }
  }

  /**
   * Get conversation state from a checkpoint
   */
  async getConversationState(checkpointId: string): Promise<ChatEntry[] | null> {
    const checkpoint = await this.storage.load(checkpointId);
    return checkpoint?.conversationState || null;
  }

  /**
   * Check if checkpoint should be created before an operation
   */
  shouldCreateCheckpoint(operation: string): boolean {
    return (
      this.config.enabled &&
      this.config.createBeforeOperations.includes(operation)
    );
  }

  /**
   * Update configuration
   * Note: storageDir changes are rejected as they require re-initialization
   */
  updateConfig(config: Partial<CheckpointConfig>): void {
    // Reject storageDir changes - would require re-initializing storage
    if (config.storageDir && config.storageDir !== this.config.storageDir) {
      console.warn(`Cannot change storageDir at runtime. Current: ${this.config.storageDir}, requested: ${config.storageDir}. Use initCheckpointManager() to change storage location.`);
      const { storageDir: _ignored, ...safeConfig } = config;
      this.config = { ...this.config, ...safeConfig };
      // BUG FIX: Deep copy array to prevent external mutation
      if (safeConfig.createBeforeOperations) {
        this.config.createBeforeOperations = [...safeConfig.createBeforeOperations];
      }
      return;
    }
    this.config = { ...this.config, ...config };
    // BUG FIX: Deep copy array to prevent external mutation
    if (config.createBeforeOperations) {
      this.config.createBeforeOperations = [...config.createBeforeOperations];
    }
  }

  /**
   * Get current configuration
   * Returns a deep copy to prevent external mutation
   */
  getConfig(): CheckpointConfig {
    // BUG FIX: Deep copy to prevent mutation of createBeforeOperations array
    return {
      ...this.config,
      createBeforeOperations: [...this.config.createBeforeOperations],
    };
  }
}

// Singleton instance
let checkpointManagerInstance: CheckpointManager | null = null;

/**
 * Get the singleton checkpoint manager instance
 *
 * Note: If instance already exists, config and baseDir are ignored.
 * Use initCheckpointManager() to create a new instance with different config.
 */
export function getCheckpointManager(
  config?: Partial<CheckpointConfig>,
  baseDir?: string
): CheckpointManager {
  if (!checkpointManagerInstance) {
    checkpointManagerInstance = new CheckpointManager(config, baseDir);
  } else if (config || baseDir) {
    // Warn if caller passes config to existing singleton (it will be ignored)
    console.warn('CheckpointManager singleton already exists; config/baseDir ignored. Use initCheckpointManager() to recreate.');
  }
  return checkpointManagerInstance;
}

/**
 * Initialize a new checkpoint manager instance (creates new singleton)
 */
export function initCheckpointManager(
  config?: Partial<CheckpointConfig>,
  baseDir?: string
): CheckpointManager {
  checkpointManagerInstance = new CheckpointManager(config, baseDir);
  return checkpointManagerInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetCheckpointManager(): void {
  checkpointManagerInstance = null;
}
