/**
 * Tool Approval Manager
 *
 * Manages tool call approvals for VSCode extension integration.
 * Handles the approval workflow with timeout, race condition prevention,
 * and proper cleanup.
 *
 * @packageDocumentation
 */

import { EventEmitter } from "events";
import type { LLMToolCall } from "../../llm/client.js";
import { TIMEOUT_CONFIG } from "../../constants.js";

/**
 * Configuration for ToolApprovalManager
 */
export interface ToolApprovalManagerConfig {
  /** Timeout for approval in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
}

/**
 * Manages tool call approvals for external integrations (e.g., VSCode).
 *
 * Features:
 * - Race condition prevention between timeout and manual approval
 * - Memory leak prevention with proper timeout cleanup
 * - Graceful disposal with pending callback resolution
 *
 * @example
 * ```typescript
 * const manager = new ToolApprovalManager(emitter);
 * manager.setRequireApproval(true);
 *
 * // In tool execution:
 * if (manager.isApprovalRequired()) {
 *   const approved = await manager.waitForApproval(toolCall);
 *   if (!approved) return { success: false, error: "Rejected" };
 * }
 *
 * // From VSCode extension:
 * manager.approveCall(toolCallId, true);
 *
 * // On dispose:
 * manager.dispose();
 * ```
 */
export class ToolApprovalManager {
  /** Whether tool approval is required */
  private requireApproval = false;

  /** Pending approval callbacks by tool call ID */
  private callbacks: Map<string, (approved: boolean) => void> = new Map();

  /** Active timeouts by tool call ID */
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  /** Resolved state to prevent double-resolution race condition */
  private resolved: Map<string, boolean> = new Map();

  /** Cleanup timeouts for resolved state tracking */
  private cleanupTimeouts: Set<NodeJS.Timeout> = new Set();

  /** Disposed state */
  private disposed = false;

  /** Approval timeout in milliseconds */
  private timeout: number;

  /** Event emitter for approval_required events */
  private emitter: EventEmitter;

  constructor(emitter: EventEmitter, config?: ToolApprovalManagerConfig) {
    this.emitter = emitter;
    this.timeout = config?.timeout ?? TIMEOUT_CONFIG.TOOL_APPROVAL;
  }

  /**
   * Enable or disable tool approval requirement
   */
  setRequireApproval(enabled: boolean): void {
    this.requireApproval = enabled;
  }

  /**
   * Check if tool approval is required
   */
  isApprovalRequired(): boolean {
    return this.requireApproval;
  }

  /**
   * Approve or reject a pending tool call.
   * Called by external integrations in response to 'tool:approval_required' events.
   *
   * @param toolCallId - The ID of the tool call to approve/reject
   * @param approved - true to execute the tool, false to reject it
   */
  approveCall(toolCallId: string, approved: boolean): void {
    // Check if already resolved to prevent race condition with timeout
    if (this.resolved.get(toolCallId)) {
      return;
    }

    const callback = this.callbacks.get(toolCallId);
    if (callback) {
      // Mark as resolved BEFORE calling callback to prevent races
      this.resolved.set(toolCallId, true);

      // Clear the timeout when approval is received (prevents memory leak)
      const timeout = this.timeouts.get(toolCallId);
      if (timeout) {
        clearTimeout(timeout);
        this.timeouts.delete(toolCallId);
      }

      callback(approved);
      this.callbacks.delete(toolCallId);

      // Clean up resolved tracking after a short delay
      this.scheduleResolvedCleanup(toolCallId);
    }
  }

  /**
   * Wait for external approval of a tool call.
   * Emits 'tool:approval_required' event and waits for approveCall() to be called.
   *
   * @param toolCall - The tool call awaiting approval
   * @returns Promise<boolean> - true if approved, false if rejected or timeout
   */
  waitForApproval(toolCall: LLMToolCall): Promise<boolean> {
    // If already disposed, immediately reject
    if (this.disposed) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      // Emit event so external integrations can show diff preview
      this.emitter.emit("tool:approval_required", toolCall);

      // Store callback
      this.callbacks.set(toolCall.id, resolve);
      this.resolved.set(toolCall.id, false);

      // Set up timeout
      const timeoutId = setTimeout(() => {
        // Check resolved state to prevent race condition with approveCall
        if (this.resolved.get(toolCall.id)) {
          return;
        }

        // Mark as resolved BEFORE resolving to prevent races
        this.resolved.set(toolCall.id, true);

        // Clean up
        this.timeouts.delete(toolCall.id);
        this.callbacks.delete(toolCall.id);
        resolve(false); // Auto-reject on timeout

        // Clean up resolved tracking after a short delay
        this.scheduleResolvedCleanup(toolCall.id);
      }, this.timeout);

      this.timeouts.set(toolCall.id, timeoutId);
    });
  }

  /**
   * Schedule cleanup of resolved state after a short delay
   */
  private scheduleResolvedCleanup(toolCallId: string): void {
    const cleanupTimeout = setTimeout(() => {
      if (this.disposed) return;
      this.resolved.delete(toolCallId);
      this.cleanupTimeouts.delete(cleanupTimeout);
    }, 1000);
    this.cleanupTimeouts.add(cleanupTimeout);
  }

  /**
   * Get count of pending approvals
   */
  getPendingCount(): number {
    return this.callbacks.size;
  }

  /**
   * Check if manager has been disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose the manager and clean up all resources.
   * - Clears all pending timeouts
   * - Resolves all pending callbacks with false (rejected)
   * - Clears all state maps
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Clear all pending approval timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();

    // Clear all cleanup timeouts
    for (const timeout of this.cleanupTimeouts) {
      clearTimeout(timeout);
    }
    this.cleanupTimeouts.clear();

    // Resolve any pending callbacks so awaiting promises don't hang
    for (const callback of this.callbacks.values()) {
      try {
        callback(false);
      } catch {
        // Ignore callback errors during teardown
      }
    }
    this.callbacks.clear();
    this.resolved.clear();
  }
}

/**
 * Create a new ToolApprovalManager
 */
export function createToolApprovalManager(
  emitter: EventEmitter,
  config?: ToolApprovalManagerConfig
): ToolApprovalManager {
  return new ToolApprovalManager(emitter, config);
}
