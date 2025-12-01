/**
 * Progress-Based Detection System (Phase 2)
 *
 * Tracks state changes to detect actual progress vs. loops.
 * Key insight: The problem isn't repeated tool calls, it's repeated tool calls
 * that don't make progress.
 *
 * Progress Indicators:
 * - File operations: Content changed (hash comparison)
 * - Bash commands: Exit code 0 vs non-zero
 * - Edits: File actually modified
 */

import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { CACHE_CONFIG } from '../constants.js';

/**
 * File state snapshot for comparison
 */
interface FileState {
  path: string;
  hash: string;
  size: number;
  mtime: number;
  exists: boolean;
}

/**
 * Progress result for a tool execution
 */
export interface ProgressResult {
  madeProgress: boolean;
  reason: string;
  stateChange?: {
    before: FileState | null;
    after: FileState | null;
  };
}

/**
 * Bash execution result for progress tracking
 */
export interface BashProgressResult {
  madeProgress: boolean;
  reason: string;
  exitCode: number;
  outputChanged: boolean;
}

/**
 * Progress tracking for all tool operations
 */
export class ProgressTracker {
  /** Cache of file states (path -> state) */
  private fileStateCache: Map<string, FileState> = new Map();

  /** Cache of bash output hashes (command -> hash) */
  private bashOutputCache: Map<string, string> = new Map();

  /** Recent file modifications for pattern detection */
  private recentFileOps: Array<{
    path: string;
    operation: 'create' | 'edit' | 'view';
    timestamp: number;
    success: boolean;
  }> = [];

  /** Maximum recent operations to track */
  private maxRecentOps = 50;

  /**
   * Capture file state before an operation
   */
  async captureFileState(path: string): Promise<FileState | null> {
    try {
      const stats = await stat(path);
      const content = await readFile(path);
      const hash = this.hashContent(content);

      const state: FileState = {
        path,
        hash,
        size: stats.size,
        mtime: stats.mtimeMs,
        exists: true,
      };

      // Cache for later comparison
      this.fileStateCache.set(path, state);

      return state;
    } catch {
      // File doesn't exist
      return {
        path,
        hash: '',
        size: 0,
        mtime: 0,
        exists: false,
      };
    }
  }

  /**
   * Check if a file operation made progress
   * Call this AFTER the operation completes
   */
  async checkFileProgress(
    path: string,
    operation: 'create' | 'edit' | 'view',
    success: boolean
  ): Promise<ProgressResult> {
    const beforeState = this.fileStateCache.get(path) || null;

    // Record this operation
    this.recordFileOp(path, operation, success);

    if (!success) {
      return {
        madeProgress: false,
        reason: `Operation failed on ${path}`,
        stateChange: { before: beforeState, after: null },
      };
    }

    // For view operations, always count as progress (reading info)
    if (operation === 'view') {
      return {
        madeProgress: true,
        reason: 'File content retrieved',
      };
    }

    // For create/edit operations, check if file state changed
    const afterState = await this.captureFileState(path);

    // File was created
    if (!beforeState?.exists && afterState?.exists) {
      return {
        madeProgress: true,
        reason: 'File created',
        stateChange: { before: beforeState, after: afterState },
      };
    }

    // File content changed
    if (beforeState?.hash !== afterState?.hash) {
      return {
        madeProgress: true,
        reason: 'File content modified',
        stateChange: { before: beforeState, after: afterState },
      };
    }

    // No change detected
    return {
      madeProgress: false,
      reason: 'File content unchanged (operation had no effect)',
      stateChange: { before: beforeState, after: afterState },
    };
  }

  /**
   * Check if a bash command made progress
   */
  checkBashProgress(
    command: string,
    exitCode: number,
    output: string
  ): BashProgressResult {
    const outputHash = this.hashContent(Buffer.from(output));
    const previousHash = this.bashOutputCache.get(command);

    // Update cache
    this.bashOutputCache.set(command, outputHash);

    // Cleanup old cache entries with 80% target capacity strategy
    if (this.bashOutputCache.size > CACHE_CONFIG.BASH_OUTPUT_CACHE_MAX_SIZE) {
      const targetSize = Math.floor(CACHE_CONFIG.BASH_OUTPUT_CACHE_MAX_SIZE * 0.8);
      const toRemove = this.bashOutputCache.size - targetSize;
      const keysToDelete = Array.from(this.bashOutputCache.keys()).slice(0, toRemove);
      for (const key of keysToDelete) {
        this.bashOutputCache.delete(key);
      }
    }

    // Exit code 0 = success
    if (exitCode === 0) {
      return {
        madeProgress: true,
        reason: 'Command executed successfully',
        exitCode,
        outputChanged: previousHash !== outputHash,
      };
    }

    // Non-zero exit code
    const outputChanged = previousHash !== outputHash;

    return {
      madeProgress: outputChanged,
      reason: outputChanged
        ? 'Command failed but produced different output'
        : 'Command failed with same output (likely stuck)',
      exitCode,
      outputChanged,
    };
  }

  /**
   * Detect if we're stuck in a file operation loop
   * Returns true if the same file is being operated on repeatedly without progress
   */
  detectFileOpLoop(path: string): {
    isLoop: boolean;
    reason?: string;
    suggestion?: string;
  } {
    const recentOpsForPath = this.recentFileOps.filter(
      (op) => op.path === path && Date.now() - op.timestamp < 60000 // Last minute
    );

    // Check for repeated failures
    const failures = recentOpsForPath.filter((op) => !op.success);
    if (failures.length >= 3) {
      return {
        isLoop: true,
        reason: `File "${path}" has failed ${failures.length} times in the last minute`,
        suggestion: 'Check if the file exists and has correct permissions',
      };
    }

    // Check for excessive operations on same file
    if (recentOpsForPath.length >= 5) {
      const edits = recentOpsForPath.filter((op) => op.operation === 'edit');
      if (edits.length >= 4) {
        return {
          isLoop: true,
          reason: `File "${path}" edited ${edits.length} times in rapid succession`,
          suggestion: 'Consider if the edits are achieving the intended changes',
        };
      }
    }

    return { isLoop: false };
  }

  /**
   * Get progress statistics
   */
  getStats(): {
    trackedFiles: number;
    trackedCommands: number;
    recentOperations: number;
  } {
    return {
      trackedFiles: this.fileStateCache.size,
      trackedCommands: this.bashOutputCache.size,
      recentOperations: this.recentFileOps.length,
    };
  }

  /**
   * Reset all tracking
   */
  reset(): void {
    this.fileStateCache.clear();
    this.bashOutputCache.clear();
    this.recentFileOps = [];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private hashContent(content: Buffer | string): string {
    return createHash('md5')
      .update(typeof content === 'string' ? content : content)
      .digest('hex');
  }

  private recordFileOp(
    path: string,
    operation: 'create' | 'edit' | 'view',
    success: boolean
  ): void {
    this.recentFileOps.push({
      path,
      operation,
      timestamp: Date.now(),
      success,
    });

    // Cleanup old entries
    if (this.recentFileOps.length > this.maxRecentOps) {
      this.recentFileOps = this.recentFileOps.slice(-this.maxRecentOps);
    }
  }
}

/**
 * Singleton instance
 */
let progressTrackerInstance: ProgressTracker | null = null;

export function getProgressTracker(): ProgressTracker {
  if (!progressTrackerInstance) {
    progressTrackerInstance = new ProgressTracker();
  }
  return progressTrackerInstance;
}

export function resetProgressTracker(): void {
  if (progressTrackerInstance) {
    progressTrackerInstance.reset();
  }
}
