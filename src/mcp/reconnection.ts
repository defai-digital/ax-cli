/**
 * MCP Server Automatic Reconnection (Phase 5)
 *
 * Provides intelligent retry logic with exponential backoff for failed MCP connections
 * Ensures production reliability without overwhelming servers
 */

import { EventEmitter } from 'events';
import type { MCPServerConfig } from '../schemas/settings-schemas.js';
import { extractErrorMessage } from '../utils/error-handler.js';

export interface ReconnectionStrategy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier (2 = double each time) */
  backoffMultiplier: number;
  /** Add random jitter to prevent thundering herd */
  jitter: boolean;
}

export const DEFAULT_STRATEGY: ReconnectionStrategy = {
  maxRetries: 5,
  baseDelayMs: 1000,      // Start at 1 second
  maxDelayMs: 30000,      // Cap at 30 seconds
  backoffMultiplier: 2,   // Double each time: 1s, 2s, 4s, 8s, 16s, 30s
  jitter: true            // Add randomness
};

export interface ReconnectionState {
  serverName: string;
  attempts: number;
  lastAttempt: number;
  nextAttempt: number | null;
  status: 'idle' | 'scheduled' | 'connecting' | 'failed' | 'connected';
  lastError?: string;
}

/**
 * Reconnection Manager
 *
 * Manages automatic reconnection attempts with exponential backoff
 */
export class ReconnectionManager extends EventEmitter {
  private retryAttempts: Map<string, number> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private reconnectionState: Map<string, ReconnectionState> = new Map();
  private strategy: ReconnectionStrategy;

  constructor(strategy: ReconnectionStrategy = DEFAULT_STRATEGY) {
    super();
    this.strategy = strategy;
  }

  /**
   * Schedule reconnection for a server
   */
  async scheduleReconnection(
    serverName: string,
    config: MCPServerConfig,
    reconnectFn: (config: MCPServerConfig) => Promise<void>
  ): Promise<void> {
    const attempts = this.retryAttempts.get(serverName) || 0;

    if (attempts >= this.strategy.maxRetries) {
      this.updateState(serverName, {
        serverName,
        attempts,
        lastAttempt: Date.now(),
        nextAttempt: null,
        status: 'failed',
        lastError: 'Max reconnection attempts reached'
      });

      this.emit('max-retries-reached', {
        serverName,
        attempts,
        config
      });

      return;
    }

    const delay = this.calculateDelay(attempts);

    this.updateState(serverName, {
      serverName,
      attempts,
      lastAttempt: Date.now(),
      nextAttempt: Date.now() + delay,
      status: 'scheduled'
    });

    this.emit('reconnection-scheduled', {
      serverName,
      attempt: attempts + 1,
      maxAttempts: this.strategy.maxRetries,
      delayMs: delay
    });

    // BUG FIX: Clear any existing timer before scheduling a new one
    // This prevents orphaned timer references when reconnection is rescheduled
    const existingTimer = this.reconnectTimers.get(serverName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      // BUG FIX: Remove timer reference immediately when it fires
      // This ensures cancelReconnection won't try to clear an already-fired timer
      this.reconnectTimers.delete(serverName);

      this.updateState(serverName, {
        serverName,
        attempts: attempts + 1,
        lastAttempt: Date.now(),
        nextAttempt: null,
        status: 'connecting'
      });

      this.emit('reconnection-attempt', {
        serverName,
        attempt: attempts + 1,
        maxAttempts: this.strategy.maxRetries
      });

      try {
        await reconnectFn(config);

        // Success - reset attempts
        this.retryAttempts.set(serverName, 0);
        this.updateState(serverName, {
          serverName,
          attempts: 0,
          lastAttempt: Date.now(),
          nextAttempt: null,
          status: 'connected'
        });

        this.emit('reconnection-success', {
          serverName,
          totalAttempts: attempts + 1
        });
      } catch (error) {
        // Failure - schedule next attempt
        this.retryAttempts.set(serverName, attempts + 1);

        const errorMessage = extractErrorMessage(error);
        this.updateState(serverName, {
          serverName,
          attempts: attempts + 1,
          lastAttempt: Date.now(),
          nextAttempt: null,
          status: 'idle',
          lastError: errorMessage
        });

        this.emit('reconnection-failed', {
          serverName,
          attempt: attempts + 1,
          maxAttempts: this.strategy.maxRetries,
          error: errorMessage
        });

        // Schedule next attempt (timer reference is already cleared above)
        await this.scheduleReconnection(serverName, config, reconnectFn);
      }
    }, delay);

    this.reconnectTimers.set(serverName, timer);
  }

  /**
   * Calculate delay for next attempt with exponential backoff
   */
  private calculateDelay(attempts: number): number {
    let delay = this.strategy.baseDelayMs * Math.pow(this.strategy.backoffMultiplier, attempts);

    // Cap at max delay
    delay = Math.min(delay, this.strategy.maxDelayMs);

    // Add jitter if enabled (±25% randomness)
    if (this.strategy.jitter) {
      const jitterRange = delay * 0.25;
      const jitter = (Math.random() * 2 - 1) * jitterRange;
      delay += jitter;
    }

    return Math.max(delay, 0);
  }

  /**
   * Cancel reconnection attempts for a server
   */
  cancelReconnection(serverName: string): void {
    const timer = this.reconnectTimers.get(serverName);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(serverName);
    }

    this.retryAttempts.delete(serverName);
    this.reconnectionState.delete(serverName);

    this.emit('reconnection-cancelled', { serverName });
  }

  /**
   * Cancel all reconnection attempts
   */
  cancelAll(): void {
    for (const serverName of this.reconnectTimers.keys()) {
      this.cancelReconnection(serverName);
    }
  }

  /**
   * Reset retry counter for a server
   */
  resetRetries(serverName: string): void {
    this.retryAttempts.set(serverName, 0);
  }

  /**
   * Get reconnection state for a server
   */
  getState(serverName: string): ReconnectionState | null {
    return this.reconnectionState.get(serverName) || null;
  }

  /**
   * Get all reconnection states
   */
  getAllStates(): ReconnectionState[] {
    return Array.from(this.reconnectionState.values());
  }

  /**
   * Update reconnection state
   */
  private updateState(serverName: string, state: ReconnectionState): void {
    this.reconnectionState.set(serverName, state);
  }

  /**
   * Get number of active reconnection attempts
   */
  getActiveReconnections(): number {
    return this.reconnectTimers.size;
  }

  /**
   * Check if server is currently attempting to reconnect
   */
  isReconnecting(serverName: string): boolean {
    const state = this.getState(serverName);
    return state?.status === 'scheduled' || state?.status === 'connecting';
  }

  /**
   * Format time until next reconnection attempt
   */
  static formatNextAttempt(nextAttemptMs: number): string {
    const diff = nextAttemptMs - Date.now();
    if (diff <= 0) return 'now';

    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  }

  /**
   * Get strategy configuration
   */
  getStrategy(): ReconnectionStrategy {
    return { ...this.strategy };
  }

  /**
   * Update strategy configuration
   */
  setStrategy(strategy: Partial<ReconnectionStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
  }

  /**
   * Clean up all resources (timers, state)
   */
  dispose(): void {
    // Cancel all pending reconnection timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }

    // Clear all state
    this.reconnectTimers.clear();
    this.retryAttempts.clear();
    this.reconnectionState.clear();

    // Remove all event listeners
    this.removeAllListeners();
  }
}
