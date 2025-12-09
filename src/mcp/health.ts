/**
 * MCP Server Health Monitoring
 *
 * Provides health checking, status monitoring, and automatic reconnection
 * for MCP servers.
 */

import { EventEmitter } from 'events';
import type { MCPManager, MCPTool } from './client.js';
import { ReconnectionManager, type ReconnectionStrategy } from './reconnection.js';

/**
 * Health status for an MCP server
 */
export interface ServerHealth {
  /** Server name */
  serverName: string;
  /** Connection status */
  connected: boolean;
  /** Number of available tools */
  toolCount: number;
  /** Server uptime in milliseconds */
  uptime?: number;
  /** Connection start time */
  connectedAt?: number;
  /** Last successful call timestamp */
  lastSuccess?: number;
  /** Last error message */
  lastError?: string;
  /** Last error timestamp */
  lastErrorAt?: number;
  /** Total number of successful tool calls */
  successCount: number;
  /** Total number of failed tool calls */
  failureCount: number;
  /** Average latency in milliseconds */
  avgLatency?: number;
  /** P95 latency in milliseconds */
  p95Latency?: number;
  /** Success rate percentage (0-100) */
  successRate: number;
}

/**
 * Health check event types
 */
export interface HealthCheckEvents {
  'health-check': (health: ServerHealth) => void;
  'server-disconnected': (serverName: string) => void;
  'server-reconnected': (serverName: string) => void;
  'health-check-error': (serverName: string, error: Error) => void;
}

/**
 * MCP Health Monitor
 *
 * Monitors the health of MCP servers and provides automatic reconnection
 */
/** Server statistics shape */
interface ServerStats {
  connectedAt: number;
  successCount: number;
  failureCount: number;
  latencies: number[];
  lastSuccess?: number;
  lastError?: string;
  lastErrorAt?: number;
}

/** Create default stats object */
function createDefaultStats(): ServerStats {
  return {
    connectedAt: Date.now(),
    successCount: 0,
    failureCount: 0,
    latencies: [],
  };
}

export class MCPHealthMonitor extends EventEmitter {
  private mcpManager: MCPManager;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectionManager: ReconnectionManager;
  private serverStats = new Map<string, ServerStats>();

  /** Get or create stats for a server */
  private getOrCreateStats(serverName: string): ServerStats {
    let stats = this.serverStats.get(serverName);
    if (!stats) {
      stats = createDefaultStats();
      this.serverStats.set(serverName, stats);
    }
    return stats;
  }

  constructor(mcpManager: MCPManager, reconnectionStrategy?: ReconnectionStrategy) {
    super();
    this.mcpManager = mcpManager;
    this.reconnectionManager = new ReconnectionManager(reconnectionStrategy);

    // Forward reconnection events
    this.reconnectionManager.on('reconnection-scheduled', (data) => this.emit('reconnection-scheduled', data));
    this.reconnectionManager.on('reconnection-attempt', (data) => this.emit('reconnection-attempt', data));
    this.reconnectionManager.on('reconnection-success', (data) => this.emit('reconnection-success', data));
    this.reconnectionManager.on('reconnection-failed', (data) => this.emit('reconnection-failed', data));
    this.reconnectionManager.on('max-retries-reached', (data) => this.emit('max-retries-reached', data));
  }

  /**
   * Start health monitoring with specified interval
   */
  start(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      throw new Error('Health monitoring already started');
    }

    // Initialize stats for existing servers
    for (const serverName of this.mcpManager.getServers()) {
      if (!this.serverStats.has(serverName)) {
        this.serverStats.set(serverName, createDefaultStats());
      }
    }

    // Use .unref() to prevent timer from blocking process exit
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks().catch((error) => {
        console.error('Health check failed:', error);
      });
    }, intervalMs);
    this.healthCheckInterval.unref();
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Clean up all resources (interval, reconnection manager, event listeners)
   */
  dispose(): void {
    // Stop health monitoring
    this.stop();

    // Dispose reconnection manager (clears timers and state)
    this.reconnectionManager.dispose();

    // Clear server stats
    this.serverStats.clear();

    // Remove all event listeners
    this.removeAllListeners();
  }

  /**
   * Perform health checks on all servers
   */
  private async performHealthChecks(): Promise<void> {
    const servers = this.mcpManager.getServers();

    for (const serverName of servers) {
      try {
        const health = await this.checkServerHealth(serverName);
        this.emit('health-check', health);

        // Check if server is unhealthy
        if (!health.connected && health.successRate < 50) {
          this.emit('server-disconnected', serverName);
          // Note: Automatic reconnection disabled - config not available in health monitor
          // Reconnection should be handled externally via the reconnection manager
        }
      } catch (error) {
        this.emit('health-check-error', serverName, error as Error);
      }
    }
  }

  /**
   * Check health of a specific server
   */
  async checkServerHealth(serverName: string): Promise<ServerHealth> {
    const tools = this.mcpManager.getTools().filter((t: MCPTool) => t.serverName === serverName);

    const stats = this.getOrCreateStats(serverName);

    // Calculate success rate
    const total = stats.successCount + stats.failureCount;
    const successRate = total > 0 ? (stats.successCount / total) * 100 : 100;

    // Calculate latencies
    const avgLatency = stats.latencies.length > 0
      ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
      : undefined;

    const p95Latency = stats.latencies.length > 0
      ? this.calculatePercentile(stats.latencies, 0.95)
      : undefined;

    // Calculate uptime
    const uptime = Date.now() - stats.connectedAt;

    return {
      serverName,
      connected: tools.length > 0,
      toolCount: tools.length,
      uptime,
      connectedAt: stats.connectedAt,
      lastSuccess: stats.lastSuccess,
      lastError: stats.lastError,
      lastErrorAt: stats.lastErrorAt,
      successCount: stats.successCount,
      failureCount: stats.failureCount,
      avgLatency,
      p95Latency,
      successRate,
    };
  }

  /** Record a successful tool call */
  recordSuccess(serverName: string, latencyMs: number): void {
    const stats = this.getOrCreateStats(serverName);
    stats.successCount++;
    stats.lastSuccess = Date.now();
    stats.latencies.push(latencyMs);

    // Keep only last 100 latencies
    if (stats.latencies.length > 100) {
      stats.latencies.shift();
    }
  }

  /** Record a failed tool call */
  recordFailure(serverName: string, error: string): void {
    const stats = this.getOrCreateStats(serverName);
    stats.failureCount++;
    stats.lastError = error;
    stats.lastErrorAt = Date.now();
  }

  /**
   * Attempt to reconnect to a disconnected server
   *
   * NOTE: This method is currently not used because the health monitor
   * doesn't have access to server configs. Reconnection should be handled
   * externally by listening to 'server-disconnected' events.
   */
  /* private async attemptReconnection(serverName: string, config: any): Promise<void> {
    // Only schedule if not already reconnecting
    if (this.reconnectionManager.isReconnecting(serverName)) {
      return;
    }

    await this.reconnectionManager.scheduleReconnection(
      serverName,
      config,
      async (cfg) => {
        await this.mcpManager.addServer(cfg);
      }
    );
  } */

  /**
   * Get reconnection manager
   */
  getReconnectionManager(): ReconnectionManager {
    return this.reconnectionManager;
  }

  /**
   * Calculate percentile from array of values
   * Returns 0 for empty arrays to distinguish from actual values
   */
  private calculatePercentile(values: number[], percentile: number): number {
    // EDGE CASE FIX: Handle empty array explicitly
    if (values.length === 0) {
      return 0; // Return 0 for empty metrics (no data available)
    }

    const sorted = [...values].sort((a, b) => a - b);
    // BUG FIX: Ensure index is within bounds [0, length-1]
    // Math.ceil could produce length when percentile=1.0, causing out-of-bounds access
    const rawIndex = Math.ceil(sorted.length * percentile) - 1;
    const index = Math.min(sorted.length - 1, Math.max(0, rawIndex));
    return sorted[index];
  }

  /**
   * Get health report for all servers
   */
  async getHealthReport(): Promise<ServerHealth[]> {
    const servers = this.mcpManager.getServers();
    const report: ServerHealth[] = [];

    for (const serverName of servers) {
      const health = await this.checkServerHealth(serverName);
      report.push(health);
    }

    return report;
  }

  /**
   * Get health status for a specific server
   */
  async getServerStatus(serverName: string): Promise<ServerHealth | null> {
    const servers = this.mcpManager.getServers();
    if (!servers.includes(serverName)) {
      return null;
    }

    return await this.checkServerHealth(serverName);
  }

  /** Reset stats for a server */
  resetStats(serverName: string): void {
    this.serverStats.set(serverName, createDefaultStats());
  }

  /**
   * Get formatted uptime string
   */
  static formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get formatted latency string
   */
  static formatLatency(latencyMs: number): string {
    if (latencyMs < 1000) {
      return `${Math.round(latencyMs)}ms`;
    } else {
      return `${(latencyMs / 1000).toFixed(2)}s`;
    }
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }

}
