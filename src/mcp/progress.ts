/**
 * MCP Progress Notifications
 *
 * Handles progress tracking for long-running MCP operations.
 * MCP Specification: notifications/progress
 *
 * @module mcp/progress
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

/**
 * Progress update from MCP server
 */
export interface ProgressUpdate {
  /** Progress token identifying the operation */
  token: string | number;
  /** Progress value (0.0 - 1.0) */
  progress: number;
  /** Total number of items (optional) */
  total?: number;
  /** Current item number (optional) */
  current?: number;
  /** Status message (optional) */
  message?: string;
  /** Timestamp of this update */
  timestamp: Date;
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (update: ProgressUpdate) => void;

/**
 * Progress tracker for MCP operations
 *
 * Manages progress tokens and dispatches progress updates to registered callbacks.
 *
 * @example
 * ```typescript
 * const tracker = new ProgressTracker();
 * const token = tracker.createToken();
 *
 * tracker.onProgress(token, (update) => {
 *   console.log(`Progress: ${Math.floor(update.progress * 100)}%`);
 * });
 *
 * // When notification arrives from server:
 * tracker.handleNotification({ progressToken: token, progress: 0.5 });
 * ```
 */
export class ProgressTracker extends EventEmitter {
  private callbacks = new Map<string | number, ProgressCallback>();
  private startTimes = new Map<string | number, number>();
  private lastUpdates = new Map<string | number, ProgressUpdate>();

  /**
   * Create a unique progress token
   */
  createToken(): string {
    return randomUUID();
  }

  /**
   * Register a progress callback for a token
   *
   * @param token - Progress token
   * @param callback - Function to call on progress updates
   */
  onProgress(token: string | number, callback: ProgressCallback): void {
    this.callbacks.set(token, callback);
    this.startTimes.set(token, Date.now());
  }

  /**
   * Handle a progress notification from the server
   *
   * @param params - Notification parameters
   */
  handleNotification(params: {
    progressToken: string | number;
    progress: number;
    total?: number;
    message?: string;
  }): void {
    const callback = this.callbacks.get(params.progressToken);

    const update: ProgressUpdate = {
      token: params.progressToken,
      progress: Math.max(0, Math.min(1, params.progress)), // Clamp to 0-1
      total: params.total,
      current: params.total ? Math.floor(params.progress * params.total) : undefined,
      message: params.message,
      timestamp: new Date(),
    };

    // Store last update
    this.lastUpdates.set(params.progressToken, update);

    // Call registered callback
    if (callback) {
      callback(update);
    }

    // Emit event for global listeners
    this.emit('progress', update);
  }

  /**
   * Get elapsed time for a progress token
   *
   * @param token - Progress token
   * @returns Elapsed time in milliseconds, or undefined if token not found
   */
  getElapsedTime(token: string | number): number | undefined {
    const start = this.startTimes.get(token);
    return start ? Date.now() - start : undefined;
  }

  /**
   * Get the last progress update for a token
   *
   * @param token - Progress token
   * @returns Last progress update, or undefined if none
   */
  getLastUpdate(token: string | number): ProgressUpdate | undefined {
    return this.lastUpdates.get(token);
  }

  /**
   * Check if a token is being tracked
   *
   * @param token - Progress token
   * @returns true if token is registered
   */
  isTracking(token: string | number): boolean {
    return this.callbacks.has(token);
  }

  /**
   * Get all active progress tokens
   *
   * @returns Array of active tokens
   */
  getActiveTokens(): (string | number)[] {
    return Array.from(this.callbacks.keys());
  }

  /**
   * Cleanup a completed progress tracking
   *
   * @param token - Progress token to cleanup
   */
  cleanup(token: string | number): void {
    this.callbacks.delete(token);
    this.startTimes.delete(token);
    // Keep last update briefly for final status queries
    setTimeout(() => {
      this.lastUpdates.delete(token);
    }, 5000);
  }

  /**
   * Cleanup all progress tracking
   */
  cleanupAll(): void {
    const tokens = this.getActiveTokens();
    for (const token of tokens) {
      this.cleanup(token);
    }
  }

  /**
   * Estimate remaining time based on progress
   *
   * @param token - Progress token
   * @returns Estimated remaining time in ms, or undefined if cannot estimate
   */
  estimateRemainingTime(token: string | number): number | undefined {
    const elapsed = this.getElapsedTime(token);
    const update = this.getLastUpdate(token);

    if (!elapsed || !update || update.progress <= 0 || update.progress >= 1) {
      return undefined;
    }

    const totalEstimate = elapsed / update.progress;
    return Math.max(0, totalEstimate - elapsed);
  }
}

/**
 * Format progress for display
 *
 * @param update - Progress update
 * @param options - Formatting options
 * @returns Formatted progress string
 */
export function formatProgress(
  update: ProgressUpdate,
  options: {
    width?: number;
    showPercentage?: boolean;
    showCount?: boolean;
    showMessage?: boolean;
  } = {}
): string {
  const {
    width = 30,
    showPercentage = true,
    showCount = true,
    showMessage = true,
  } = options;

  const percentage = Math.floor(update.progress * 100);
  const filled = Math.floor(update.progress * width);
  const empty = width - filled;

  let result = `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;

  if (showPercentage) {
    result += ` ${percentage}%`;
  }

  if (showCount && update.total !== undefined && update.current !== undefined) {
    result += ` (${update.current}/${update.total})`;
  }

  if (showMessage && update.message) {
    result += `\n${update.message}`;
  }

  return result;
}

/**
 * Format elapsed time for display
 *
 * @param ms - Time in milliseconds
 * @returns Formatted time string
 */
export function formatElapsedTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Singleton instance
let progressTracker: ProgressTracker | null = null;

/**
 * Get the singleton progress tracker instance
 */
export function getProgressTracker(): ProgressTracker {
  if (!progressTracker) {
    progressTracker = new ProgressTracker();
  }
  return progressTracker;
}

/**
 * Reset the progress tracker (for testing)
 */
export function resetProgressTracker(): void {
  if (progressTracker) {
    progressTracker.cleanupAll();
    progressTracker.removeAllListeners();
  }
  progressTracker = null;
}
