/**
 * MCP Debug Mode
 *
 * Comprehensive diagnostic utilities for troubleshooting MCP server connections,
 * tool calls, and configuration issues.
 *
 * @module mcp/debug
 */

import { EventEmitter } from 'events';
// BUG FIX: Use type-only imports to prevent circular dependencies
// debug.ts may be imported early, before client-v2.ts is fully initialized
import type { ServerName, ToolName, ConnectionState, MCPTool, MCPPrompt } from './client-v2.js';
import type { TransportType } from './transports.js';
import { Result } from './type-safety.js';

// =============================================================================
// Debug Event Types
// =============================================================================

/**
 * Types of debug events that can be emitted
 */
export type DebugEventType =
  | 'connection:start'
  | 'connection:success'
  | 'connection:failure'
  | 'connection:disconnect'
  | 'tool:call:start'
  | 'tool:call:success'
  | 'tool:call:failure'
  | 'tool:call:timeout'
  | 'transport:created'
  | 'transport:error'
  | 'health:check'
  | 'health:failure'
  | 'reconnection:scheduled'
  | 'reconnection:attempt'
  | 'reconnection:success'
  | 'reconnection:failure'
  | 'schema:validation'
  | 'resource:updated'
  | 'progress:update';

/**
 * Debug event structure
 */
export interface DebugEvent {
  type: DebugEventType;
  timestamp: Date;
  serverName?: ServerName;
  toolName?: ToolName;
  data: Record<string, unknown>;
  duration?: number;
  error?: Error;
}

/**
 * Server diagnostic information
 */
export interface ServerDiagnostics {
  serverName: ServerName;
  status: ConnectionState['status'];
  transportType?: TransportType;
  connectedAt?: number;
  failedAt?: number;
  lastError?: string;
  toolCount: number;
  tools: string[];
  promptCount: number;
  prompts: string[];
  reconnectionAttempts: number;
  healthCheckStatus?: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck?: Date;
}

/**
 * Overall MCP diagnostic summary
 */
export interface MCPDiagnostics {
  timestamp: Date;
  totalServers: number;
  connectedServers: number;
  failedServers: number;
  connectingServers: number;
  totalTools: number;
  totalPrompts: number;
  servers: ServerDiagnostics[];
  recentEvents: DebugEvent[];
  healthCheckEnabled: boolean;
  reconnectionEnabled: boolean;
}

// =============================================================================
// Debug Logger
// =============================================================================

/**
 * Debug log level
 */
export type DebugLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Debug logger configuration
 */
export interface DebugLoggerConfig {
  enabled: boolean;
  level: DebugLogLevel;
  maxEvents: number;
  includeTimestamps: boolean;
  formatOutput: boolean;
}

/**
 * Default debug logger configuration
 */
export const DEFAULT_DEBUG_CONFIG: DebugLoggerConfig = {
  enabled: false,
  level: 'info',
  maxEvents: 100,
  includeTimestamps: true,
  formatOutput: true,
};

/**
 * MCP Debug Logger
 *
 * Captures and formats debug events for MCP operations.
 * Can be enabled/disabled at runtime.
 */
export class MCPDebugLogger extends EventEmitter {
  private config: DebugLoggerConfig;
  private events: DebugEvent[] = [];
  private serverHealthStatus: Map<ServerName, { status: 'healthy' | 'unhealthy'; lastCheck: Date }> = new Map();

  constructor(config: Partial<DebugLoggerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_DEBUG_CONFIG, ...config };
  }

  /**
   * Enable debug mode
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable debug mode
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Check if debug mode is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set debug level
   */
  setLevel(level: DebugLogLevel): void {
    this.config.level = level;
  }

  /**
   * Log a debug event
   */
  log(
    type: DebugEventType,
    data: Record<string, unknown>,
    options?: {
      serverName?: ServerName;
      toolName?: ToolName;
      duration?: number;
      error?: Error;
    }
  ): void {
    if (!this.config.enabled) return;

    const event: DebugEvent = {
      type,
      timestamp: new Date(),
      data,
      ...options,
    };

    // Add to event buffer
    this.events.push(event);

    // Trim buffer if needed
    if (this.events.length > this.config.maxEvents) {
      this.events = this.events.slice(-this.config.maxEvents);
    }

    // Emit event for external listeners
    this.emit('debug', event);

    // Console output if enabled
    if (this.shouldLog(type)) {
      this.outputEvent(event);
    }
  }

  /**
   * Check if event type should be logged at current level
   */
  private shouldLog(type: DebugEventType): boolean {
    const levelPriority: Record<DebugLogLevel, number> = {
      trace: 0,
      debug: 1,
      info: 2,
      warn: 3,
      error: 4,
    };

    const eventLevel = this.getEventLevel(type);
    return levelPriority[eventLevel] >= levelPriority[this.config.level];
  }

  /**
   * Get log level for event type
   */
  private getEventLevel(type: DebugEventType): DebugLogLevel {
    if (type.includes('failure') || type.includes('error') || type.includes('timeout')) {
      return 'error';
    }
    if (type.includes('health:failure')) {
      return 'warn';
    }
    if (type.includes('reconnection')) {
      return 'info';
    }
    if (type.includes('start') || type.includes('success')) {
      return 'debug';
    }
    return 'trace';
  }

  /**
   * Format and output an event
   */
  private outputEvent(event: DebugEvent): void {
    if (!this.config.formatOutput) {
      console.log('[MCP Debug]', event);
      return;
    }

    const timestamp = this.config.includeTimestamps
      ? `[${event.timestamp.toISOString()}]`
      : '';

    const level = this.getEventLevel(event.type).toUpperCase().padEnd(5);
    const serverInfo = event.serverName ? ` [${event.serverName}]` : '';
    const toolInfo = event.toolName ? ` ${event.toolName}` : '';
    const durationInfo = event.duration ? ` (${event.duration}ms)` : '';

    let message = `${timestamp} ${level} ${event.type}${serverInfo}${toolInfo}${durationInfo}`;

    if (Object.keys(event.data).length > 0) {
      message += ` ${JSON.stringify(event.data)}`;
    }

    if (event.error) {
      message += ` ERROR: ${event.error.message}`;
    }

    console.log(message);
  }

  /**
   * Record health check result
   */
  recordHealthCheck(serverName: ServerName, healthy: boolean): void {
    this.serverHealthStatus.set(serverName, {
      status: healthy ? 'healthy' : 'unhealthy',
      lastCheck: new Date(),
    });

    this.log('health:check', { healthy }, { serverName });
  }

  /**
   * Get recent events
   */
  getRecentEvents(count?: number): DebugEvent[] {
    const limit = count ?? this.config.maxEvents;
    return this.events.slice(-limit);
  }

  /**
   * Get events for a specific server
   */
  getServerEvents(serverName: ServerName): DebugEvent[] {
    return this.events.filter((e) => e.serverName === serverName);
  }

  /**
   * Get events for a specific tool
   */
  getToolEvents(toolName: ToolName): DebugEvent[] {
    return this.events.filter((e) => e.toolName === toolName);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: DebugEventType): DebugEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Get health status for a server
   */
  getHealthStatus(serverName: ServerName): { status: 'healthy' | 'unhealthy' | 'unknown'; lastCheck?: Date } {
    const status = this.serverHealthStatus.get(serverName);
    if (!status) {
      return { status: 'unknown' };
    }
    return status;
  }

  /**
   * Clear all recorded events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Clear health status
   */
  clearHealthStatus(): void {
    this.serverHealthStatus.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): DebugLoggerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DebugLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }

}

// =============================================================================
// Singleton Instance
// =============================================================================

let debugLoggerInstance: MCPDebugLogger | null = null;

/**
 * Get the singleton debug logger instance
 */
export function getMCPDebugLogger(): MCPDebugLogger {
  if (!debugLoggerInstance) {
    debugLoggerInstance = new MCPDebugLogger();
  }
  return debugLoggerInstance;
}

/**
 * Reset the debug logger instance (for testing)
 */
export function resetMCPDebugLogger(): void {
  if (debugLoggerInstance) {
    debugLoggerInstance.removeAllListeners();
    debugLoggerInstance.clearEvents();
    debugLoggerInstance.clearHealthStatus();
  }
  debugLoggerInstance = null;
}

// =============================================================================
// Diagnostic Utilities
// =============================================================================

/**
 * Collect diagnostics from MCPManagerV2
 *
 * @param manager - The MCP manager instance
 * @returns Diagnostic summary
 */
export async function collectMCPDiagnostics(
  manager: {
    getServers(): ServerName[];
    getConnectionState(serverName: ServerName): ConnectionState | undefined;
    getTools(): MCPTool[];
    getPrompts(): MCPPrompt[];
    getTransportType(serverName: ServerName): Result<TransportType, Error>;
    getConnectionStatus(): { connected: number; failed: number; connecting: number; total: number };
  }
): Promise<MCPDiagnostics> {
  const debugLogger = getMCPDebugLogger();
  const connectionStatus = manager.getConnectionStatus();
  const allTools = manager.getTools();
  const allPrompts = manager.getPrompts();
  const serverNames = manager.getServers();

  const serverDiagnostics: ServerDiagnostics[] = [];

  // Collect all servers (not just connected ones)
  const allServerNames = new Set<ServerName>();
  for (const tool of allTools) {
    allServerNames.add(tool.serverName);
  }
  for (const serverName of serverNames) {
    allServerNames.add(serverName);
  }

  for (const serverName of allServerNames) {
    const state = manager.getConnectionState(serverName);
    const transportResult = manager.getTransportType(serverName);

    const serverTools = allTools.filter((t) => t.serverName === serverName);
    const serverPrompts = allPrompts.filter((p) => p.serverName === serverName);

    const healthStatus = debugLogger.getHealthStatus(serverName);

    const diagnostic: ServerDiagnostics = {
      serverName,
      status: state?.status ?? 'idle',
      transportType: transportResult.success ? transportResult.value : undefined,
      connectedAt: state?.status === 'connected' ? state.connectedAt : undefined,
      failedAt: state?.status === 'failed' ? state.failedAt : undefined,
      lastError: state?.status === 'failed' ? state.error.message : undefined,
      toolCount: serverTools.length,
      tools: serverTools.map((t) => String(t.name)),
      promptCount: serverPrompts.length,
      prompts: serverPrompts.map((p) => p.name),
      reconnectionAttempts: 0, // Would need access to private state
      healthCheckStatus: healthStatus.status,
      lastHealthCheck: healthStatus.lastCheck,
    };

    serverDiagnostics.push(diagnostic);
  }

  return {
    timestamp: new Date(),
    totalServers: connectionStatus.total,
    connectedServers: connectionStatus.connected,
    failedServers: connectionStatus.failed,
    connectingServers: connectionStatus.connecting,
    totalTools: allTools.length,
    totalPrompts: allPrompts.length,
    servers: serverDiagnostics,
    recentEvents: debugLogger.getRecentEvents(20),
    healthCheckEnabled: true, // Would need access to config
    reconnectionEnabled: true, // Would need access to config
  };
}

/**
 * Format diagnostics for display
 */
export function formatMCPDiagnostics(diagnostics: MCPDiagnostics): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    MCP DIAGNOSTICS REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`Timestamp: ${diagnostics.timestamp.toISOString()}`);
  lines.push('');

  // Summary
  lines.push('┌─────────────────────────────────────────────────────────────┐');
  lines.push('│                        SUMMARY                              │');
  lines.push('├─────────────────────────────────────────────────────────────┤');
  lines.push(`│ Servers: ${diagnostics.connectedServers}/${diagnostics.totalServers} connected, ${diagnostics.failedServers} failed, ${diagnostics.connectingServers} connecting`);
  lines.push(`│ Tools:   ${diagnostics.totalTools} registered`);
  lines.push(`│ Prompts: ${diagnostics.totalPrompts} available`);
  lines.push('└─────────────────────────────────────────────────────────────┘');
  lines.push('');

  // Server details
  if (diagnostics.servers.length > 0) {
    lines.push('┌─────────────────────────────────────────────────────────────┐');
    lines.push('│                    SERVER DETAILS                           │');
    lines.push('└─────────────────────────────────────────────────────────────┘');

    for (const server of diagnostics.servers) {
      const statusIcon = server.status === 'connected' ? '✓' : server.status === 'failed' ? '✗' : '○';
      const healthIcon = server.healthCheckStatus === 'healthy' ? '♥' : server.healthCheckStatus === 'unhealthy' ? '!' : '?';

      lines.push(`  ${statusIcon} ${server.serverName}`);
      lines.push(`    Status: ${server.status} ${healthIcon}`);
      if (server.transportType) {
        lines.push(`    Transport: ${server.transportType}`);
      }
      if (server.connectedAt) {
        lines.push(`    Connected: ${new Date(server.connectedAt).toISOString()}`);
      }
      if (server.lastError) {
        lines.push(`    Last Error: ${server.lastError}`);
      }
      lines.push(`    Tools: ${server.toolCount} (${server.tools.slice(0, 3).join(', ')}${server.tools.length > 3 ? '...' : ''})`);
      if (server.promptCount > 0) {
        lines.push(`    Prompts: ${server.promptCount}`);
      }
      lines.push('');
    }
  }

  // Recent events
  if (diagnostics.recentEvents.length > 0) {
    lines.push('┌─────────────────────────────────────────────────────────────┐');
    lines.push('│                    RECENT EVENTS                            │');
    lines.push('└─────────────────────────────────────────────────────────────┘');

    for (const event of diagnostics.recentEvents.slice(-10)) {
      const time = event.timestamp.toISOString().split('T')[1].split('.')[0];
      const serverInfo = event.serverName ? ` [${event.serverName}]` : '';
      lines.push(`  ${time} ${event.type}${serverInfo}`);
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Create a debug session that instruments MCP manager events
 */
export function createDebugSession(
  manager: EventEmitter,
  options?: Partial<DebugLoggerConfig>
): MCPDebugLogger {
  const debugLogger = getMCPDebugLogger();

  if (options) {
    debugLogger.updateConfig(options);
  }

  debugLogger.enable();

  // Wire up manager events to debug logger
  manager.on('serverAdded', (serverName: ServerName, toolCount: number) => {
    debugLogger.log('connection:success', { toolCount }, { serverName });
  });

  manager.on('serverError', (serverName: ServerName, error: Error) => {
    debugLogger.log('connection:failure', {}, { serverName, error });
  });

  manager.on('serverRemoved', (serverName: ServerName) => {
    debugLogger.log('connection:disconnect', {}, { serverName });
  });

  manager.on('server-unhealthy', (serverName: ServerName, error: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error));
    debugLogger.log('health:failure', {}, { serverName, error: err });
    debugLogger.recordHealthCheck(serverName, false);
  });

  manager.on('reconnection-scheduled', (serverName: ServerName, attempt: number, delay: number) => {
    debugLogger.log('reconnection:scheduled', { attempt, delay }, { serverName });
  });

  manager.on('reconnection-succeeded', (serverName: ServerName, attempts: number) => {
    debugLogger.log('reconnection:success', { attempts }, { serverName });
  });

  manager.on('reconnection-failed', (serverName: ServerName, attempts: number, reason: string) => {
    debugLogger.log('reconnection:failure', { attempts, reason }, { serverName });
  });

  manager.on('progress', (data: { serverName: ServerName; progress: number; total?: number }) => {
    debugLogger.log('progress:update', { progress: data.progress, total: data.total }, { serverName: data.serverName });
  });

  manager.on('resource-updated', (serverName: ServerName, uri: string) => {
    debugLogger.log('resource:updated', { uri }, { serverName });
  });

  manager.on('schema-validation-failed', (data: { toolName: ToolName; serverName: ServerName; errors: string[] }) => {
    debugLogger.log('schema:validation', { valid: false, errors: data.errors }, { serverName: data.serverName, toolName: data.toolName });
  });

  return debugLogger;
}
