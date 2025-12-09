/**
 * MCP Cancellation Support
 *
 * Enables cancellation of long-running MCP operations.
 * MCP Specification: notifications/cancelled
 *
 * @module mcp/cancellation
 */

import { EventEmitter } from 'events';
import type { ServerName, ToolName } from './type-safety.js';

/**
 * Cancellable request information
 */
export interface CancellableRequest {
  /** Unique request ID */
  id: string | number;
  /** Server handling the request */
  serverName: ServerName;
  /** Tool being called */
  toolName: ToolName;
  /** When the request started */
  startedAt: Date;
  /** Abort controller for local cancellation */
  abortController: AbortController;
}

/**
 * Cancellation result
 */
export interface CancellationResult {
  /** Whether cancellation was successful */
  success: boolean;
  /** Request ID that was cancelled */
  requestId: string | number;
  /** Reason for cancellation */
  reason?: string;
}

/**
 * Callback for sending cancellation notification to server
 */
export type SendCancellationNotification = (
  serverName: ServerName,
  requestId: string | number,
  reason?: string
) => Promise<void>;

/**
 * Cancellation Manager
 *
 * Manages cancellable requests and coordinates cancellation with MCP servers.
 *
 * @example
 * ```typescript
 * const manager = new CancellationManager();
 *
 * // Register a request
 * const abortController = new AbortController();
 * manager.register({
 *   id: 'req-1',
 *   serverName,
 *   toolName,
 *   startedAt: new Date(),
 *   abortController
 * });
 *
 * // Cancel when needed
 * await manager.cancel('req-1', 'User requested cancellation');
 * ```
 */
export class CancellationManager extends EventEmitter {
  private activeRequests = new Map<string | number, CancellableRequest>();
  private cancelledIds = new Set<string | number>();
  private sendNotification: SendCancellationNotification | null = null;
  // BUG FIX: Track cleanup timers so they can be cleared on reset
  private cleanupTimers = new Map<string | number, NodeJS.Timeout>();

  /**
   * Set the notification sender function
   * Called by MCPManagerV2 to wire up the notification mechanism
   */
  setSendNotification(fn: SendCancellationNotification): void {
    this.sendNotification = fn;
  }

  /**
   * Register a cancellable request
   *
   * @param request - Request information
   */
  register(request: CancellableRequest): void {
    this.activeRequests.set(request.id, request);
    this.emit('requestRegistered', request);
  }

  /**
   * Cancel a specific request
   *
   * @param requestId - ID of the request to cancel
   * @param reason - Optional reason for cancellation
   * @returns Promise that resolves when cancellation is processed
   */
  async cancel(
    requestId: string | number,
    reason?: string
  ): Promise<CancellationResult> {
    const request = this.activeRequests.get(requestId);

    if (!request) {
      // Already completed or doesn't exist
      return {
        success: false,
        requestId,
        reason: 'Request not found or already completed',
      };
    }

    // Mark as cancelled
    this.cancelledIds.add(requestId);

    // Abort the local request
    request.abortController.abort();

    // Send cancellation notification to server
    if (this.sendNotification) {
      try {
        await this.sendNotification(
          request.serverName,
          requestId,
          reason ?? 'User cancelled'
        );
      } catch (error) {
        // Log but don't fail - the local abort is what matters
        console.warn(`Failed to send cancellation notification: ${error}`);
      }
    }

    // Emit cancellation event
    this.emit('requestCancelled', request, reason);

    // Cleanup
    this.cleanup(requestId);

    return {
      success: true,
      requestId,
      reason,
    };
  }

  /**
   * Cancel all active requests
   *
   * @param reason - Optional reason for cancellation
   * @returns Promise that resolves when all cancellations are processed
   */
  async cancelAll(reason?: string): Promise<CancellationResult[]> {
    const requests = Array.from(this.activeRequests.values());
    // Use allSettled to ensure all cancellations are attempted even if some fail
    const results = await Promise.allSettled(
      requests.map((req) => this.cancel(req.id, reason))
    );
    // Convert PromiseSettledResult to CancellationResult, treating rejections as failures
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      // Return a failure result for rejected promises
      return {
        success: false,
        requestId: requests[index].id,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    });
  }

  /**
   * Cancel all requests for a specific server
   *
   * @param serverName - Server to cancel requests for
   * @param reason - Optional reason for cancellation
   * @returns Promise that resolves when cancellations are processed
   */
  async cancelByServer(
    serverName: ServerName,
    reason?: string
  ): Promise<CancellationResult[]> {
    const requests = Array.from(this.activeRequests.values()).filter(
      (req) => req.serverName === serverName
    );
    const results = await Promise.all(
      requests.map((req) => this.cancel(req.id, reason))
    );
    return results;
  }

  /**
   * Get all active requests
   *
   * @returns Array of active requests
   */
  getActiveRequests(): CancellableRequest[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Get the most recent active request
   *
   * @returns Most recent request, or undefined if none
   */
  getMostRecentRequest(): CancellableRequest | undefined {
    const requests = this.getActiveRequests();
    if (requests.length === 0) {
      return undefined;
    }
    return requests.reduce((latest, req) =>
      req.startedAt > latest.startedAt ? req : latest
    );
  }

  /**
   * Check if a request has been cancelled
   *
   * @param requestId - Request ID to check
   * @returns true if request was cancelled
   */
  isCancelled(requestId: string | number): boolean {
    return this.cancelledIds.has(requestId);
  }

  /**
   * Check if there are any active requests
   *
   * @returns true if there are active requests
   */
  hasActiveRequests(): boolean {
    return this.activeRequests.size > 0;
  }

  /**
   * Get the number of active requests
   *
   * @returns Number of active requests
   */
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Cleanup a completed or cancelled request
   *
   * @param requestId - Request ID to cleanup
   */
  cleanup(requestId: string | number): void {
    this.activeRequests.delete(requestId);

    // BUG FIX: Clear any existing timer for this request to prevent duplicates
    const existingTimer = this.cleanupTimers.get(requestId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.cleanupTimers.delete(requestId);
    }

    // Keep cancelled IDs briefly to handle race conditions
    // BUG FIX: Store timer reference so it can be cleared on reset
    const timer = setTimeout(() => {
      this.cancelledIds.delete(requestId);
      this.cleanupTimers.delete(requestId);
    }, 5000);

    this.cleanupTimers.set(requestId, timer);
  }

  /**
   * Cleanup all tracking
   *
   * BUG FIX: Now also clears all pending cleanup timers to prevent memory leaks
   */
  cleanupAll(): void {
    // BUG FIX: Clear all pending timers first
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    // Clear all active requests
    this.activeRequests.clear();

    // Clear cancelled IDs immediately since we're cleaning everything
    this.cancelledIds.clear();
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

/**
 * Error code for cancelled requests (JSON-RPC)
 */
export const CANCELLED_ERROR_CODE = -32800;

/**
 * Check if an error indicates a cancelled request
 *
 * @param error - Error to check
 * @returns true if error indicates cancellation
 */
export function isRequestCancelled(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const err = error as { code?: number; message?: string };
    if (err.code === CANCELLED_ERROR_CODE) {
      return true;
    }
    if (err.message?.toLowerCase().includes('cancelled')) {
      return true;
    }
  }
  return false;
}

/**
 * Create an abort error for cancelled requests
 *
 * @param reason - Cancellation reason
 * @returns Error object
 */
export function createCancellationError(reason?: string): Error {
  const error = new Error(reason ?? 'Request cancelled');
  (error as any).code = CANCELLED_ERROR_CODE;
  return error;
}

// Singleton instance
let cancellationManager: CancellationManager | null = null;

/**
 * Get the singleton cancellation manager instance
 */
export function getCancellationManager(): CancellationManager {
  if (!cancellationManager) {
    cancellationManager = new CancellationManager();
  }
  return cancellationManager;
}

/**
 * Reset the cancellation manager (for testing)
 */
export function resetCancellationManager(): void {
  if (cancellationManager) {
    cancellationManager.cleanupAll();
    cancellationManager.removeAllListeners();
  }
  cancellationManager = null;
}
