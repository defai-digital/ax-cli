/**
 * MCP Server Health Monitoring
 *
 * Provides health checking, status monitoring, and automatic reconnection
 * for MCP servers.
 */

import { EventEmitter } from 'events';
import type { MCPManager } from './client.js';
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

// ============================================================================
// Configuration Constants
// ============================================================================

/** Default health check interval in milliseconds */
const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 60_000;

/** Maximum latency samples to keep for percentile calculations */
const MAX_LATENCY_SAMPLES = 100;

/** Success rate threshold below which a server is considered unhealthy */
const UNHEALTHY_SUCCESS_RATE_THRESHOLD = 50;

/** Percentile to calculate for latency metrics (0.95 = P95) */
const LATENCY_PERCENTILE = 0.95;

/** Default success rate when no calls have been made */
const DEFAULT_SUCCESS_RATE = 100;

/** Milliseconds threshold for latency display formatting */
const LATENCY_FORMAT_THRESHOLD_MS = 1000;

// Time unit conversions
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** Percentage multiplier for rate calculations */
const PERCENTAGE_MULTIPLIER = 100;

// ============================================================================
// Event Names
// ============================================================================

/** Event emitted when health check completes for a server */
const EVENT_HEALTH_CHECK = 'health-check';

/** Event emitted when a server is detected as disconnected */
const EVENT_SERVER_DISCONNECTED = 'server-disconnected';

/** Event emitted when health check fails with an error */
const EVENT_HEALTH_CHECK_ERROR = 'health-check-error';

// ============================================================================
// Error Messages
// ============================================================================

const ERROR_ALREADY_STARTED = 'Health monitoring already started';
const LOG_PREFIX_HEALTH_CHECK_FAILED = 'Health check failed:';

/** Default value for empty percentile calculations */
const EMPTY_PERCENTILE_VALUE = 0;

/** Decimal places for formatted latency display */
const LATENCY_FORMAT_DECIMALS = 2;

/** Numeric ascending sort comparator */
const numericAscending = (a: number, b: number): number => a - b;

// ============================================================================
// Types
// ============================================================================

/** Server statistics for health tracking */
interface ServerStats {
  connectedAt: number;
  successCount: number;
  failureCount: number;
  latencies: number[];
  latencySum: number;
  lastSuccessAt?: number;
  lastErrorMessage?: string;
  lastErrorAt?: number;
}

/** Create default stats object */
function createDefaultStats(): ServerStats {
  return {
    connectedAt: Date.now(),
    successCount: 0,
    failureCount: 0,
    latencies: [],
    latencySum: 0,
  };
}

export class MCPHealthMonitor extends EventEmitter {
  private readonly mcpManager: MCPManager;
  private readonly reconnectionManager: ReconnectionManager;
  private readonly statsMap = new Map<string, ServerStats>();
  private healthCheckTimer: NodeJS.Timeout | null = null;

  /** Get or create stats for a server */
  private getOrCreateStats(serverName: string): ServerStats {
    let serverStats = this.statsMap.get(serverName);
    if (!serverStats) {
      serverStats = createDefaultStats();
      this.statsMap.set(serverName, serverStats);
    }
    return serverStats;
  }

  /** Events to forward from reconnection manager */
  private static readonly RECONNECTION_EVENTS = [
    'reconnection-scheduled',
    'reconnection-attempt',
    'reconnection-success',
    'reconnection-failed',
    'max-retries-reached',
  ] as const;

  /** Bound handler for server removal events */
  private readonly handleServerRemoved = (serverName: string): void => {
    this.removeStats(serverName);
  };

  constructor(mcpManager: MCPManager, reconnectionStrategy?: ReconnectionStrategy) {
    super();
    this.mcpManager = mcpManager;
    this.reconnectionManager = new ReconnectionManager(reconnectionStrategy);

    // Forward all reconnection events
    for (const eventName of MCPHealthMonitor.RECONNECTION_EVENTS) {
      this.reconnectionManager.on(eventName, (eventData) => this.emit(eventName, eventData));
    }

    // Clean up stats when servers are removed (prevents memory leak)
    this.mcpManager.on('serverRemoved', this.handleServerRemoved);
  }

  /**
   * Start health monitoring with specified interval
   * @param intervalMs Check interval in milliseconds
   */
  start(intervalMs = DEFAULT_HEALTH_CHECK_INTERVAL_MS): void {
    if (this.healthCheckTimer) {
      throw new Error(ERROR_ALREADY_STARTED);
    }

    // Initialize stats for existing servers
    for (const serverName of this.mcpManager.getServers()) {
      this.getOrCreateStats(serverName);
    }

    this.healthCheckTimer = setInterval(() => {
      try {
        this.performHealthChecks();
      } catch (error) {
        console.error(LOG_PREFIX_HEALTH_CHECK_FAILED, error);
      }
    }, intervalMs);

    // Don't block process exit
    this.healthCheckTimer.unref();
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /** Clean up all resources */
  dispose(): void {
    this.stop();
    this.mcpManager.off('serverRemoved', this.handleServerRemoved);
    this.reconnectionManager.dispose();
    this.statsMap.clear();
    this.removeAllListeners();
  }

  /** Perform health checks on all servers and emit events */
  private performHealthChecks(): void {
    for (const serverName of this.mcpManager.getServers()) {
      try {
        const health = this.checkServerHealth(serverName);
        this.emit(EVENT_HEALTH_CHECK, health);

        if (!health.connected && health.successRate < UNHEALTHY_SUCCESS_RATE_THRESHOLD) {
          this.emit(EVENT_SERVER_DISCONNECTED, serverName);
        }
      } catch (caught) {
        const error = caught instanceof Error ? caught : new Error(String(caught));
        this.emit(EVENT_HEALTH_CHECK_ERROR, serverName, error);
      }
    }
  }

  /** Check health of a specific server */
  checkServerHealth(serverName: string): ServerHealth {
    const serverTools = this.mcpManager.getTools().filter(
      (tool: { serverName?: string }) => tool.serverName === serverName
    );
    const serverStats = this.getOrCreateStats(serverName);
    const { latencies, latencySum, successCount, failureCount } = serverStats;
    const totalCalls = successCount + failureCount;
    const hasLatencyData = latencies.length > 0;
    const isConnected = serverTools.length > 0;

    return {
      serverName,
      connected: isConnected,
      toolCount: serverTools.length,
      uptime: Date.now() - serverStats.connectedAt,
      connectedAt: serverStats.connectedAt,
      lastSuccess: serverStats.lastSuccessAt,
      lastError: serverStats.lastErrorMessage,
      lastErrorAt: serverStats.lastErrorAt,
      successCount,
      failureCount,
      avgLatency: hasLatencyData ? latencySum / latencies.length : undefined,
      p95Latency: hasLatencyData ? this.calculatePercentile(latencies, LATENCY_PERCENTILE) : undefined,
      successRate: totalCalls > 0 ? (successCount / totalCalls) * PERCENTAGE_MULTIPLIER : DEFAULT_SUCCESS_RATE,
    };
  }

  /** Record a successful tool call */
  recordSuccess(serverName: string, latencyMs: number): void {
    const serverStats = this.getOrCreateStats(serverName);
    serverStats.successCount++;
    serverStats.lastSuccessAt = Date.now();
    serverStats.latencySum += latencyMs;
    serverStats.latencies.push(latencyMs);

    // Trim oldest latency if over limit
    if (serverStats.latencies.length > MAX_LATENCY_SAMPLES) {
      serverStats.latencySum -= serverStats.latencies[0];
      serverStats.latencies.shift();
    }
  }

  /** Record a failed tool call */
  recordFailure(serverName: string, errorMessage: string): void {
    const serverStats = this.getOrCreateStats(serverName);
    serverStats.failureCount++;
    serverStats.lastErrorMessage = errorMessage;
    serverStats.lastErrorAt = Date.now();
  }

  /** Get reconnection manager for external reconnection handling */
  getReconnectionManager(): ReconnectionManager {
    return this.reconnectionManager;
  }

  /** Calculate percentile (0-1) from array, returns EMPTY_PERCENTILE_VALUE for empty arrays */
  private calculatePercentile(latencyValues: number[], percentile: number): number {
    const sampleCount = latencyValues.length;
    if (sampleCount === 0) return EMPTY_PERCENTILE_VALUE;

    const sortedValues = [...latencyValues].sort(numericAscending);
    const index = Math.max(0, Math.min(sampleCount - 1, Math.ceil(sampleCount * percentile) - 1));
    return sortedValues[index];
  }

  /** Get health report for all servers */
  getHealthReport(): ServerHealth[] {
    return this.mcpManager.getServers().map(
      serverName => this.checkServerHealth(serverName)
    );
  }

  /** Get health status for a specific server (returns null if not found) */
  getServerStatus(serverName: string): ServerHealth | null {
    // Use stats map for O(1) existence check instead of O(n) includes()
    if (!this.statsMap.has(serverName)) {
      // Server may exist but not have stats yet - check manager
      if (!this.mcpManager.getServers().includes(serverName)) {
        return null;
      }
    }
    return this.checkServerHealth(serverName);
  }

  /** Reset stats for a server */
  resetStats(serverName: string): void {
    this.statsMap.set(serverName, createDefaultStats());
  }

  /**
   * Remove stats for a server (call when server is unregistered)
   * Prevents memory leak from accumulating stats for removed servers
   */
  removeStats(serverName: string): void {
    this.statsMap.delete(serverName);
  }

  /** Format uptime as human-readable string (e.g., "2d 5h", "45m 30s") */
  static formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / MS_PER_SECOND);
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const days = Math.floor(hours / HOURS_PER_DAY);

    if (days > 0) return `${days}d ${hours % HOURS_PER_DAY}h`;
    if (hours > 0) return `${hours}h ${minutes % MINUTES_PER_HOUR}m`;
    if (minutes > 0) return `${minutes}m ${seconds % SECONDS_PER_MINUTE}s`;
    return `${seconds}s`;
  }

  /** Format latency as human-readable string (e.g., "150ms", "1.25s") */
  static formatLatency(latencyMs: number): string {
    return latencyMs < LATENCY_FORMAT_THRESHOLD_MS
      ? `${Math.round(latencyMs)}ms`
      : `${(latencyMs / MS_PER_SECOND).toFixed(LATENCY_FORMAT_DECIMALS)}s`;
  }
}
