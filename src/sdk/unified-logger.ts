/**
 * Unified Logger - Shared logging system for AX <-> ax-cli integration
 *
 * Provides centralized log aggregation across AutomatosX and ax-cli
 * for easier debugging and monitoring.
 */

import { EventEmitter } from 'events';

/**
 * Log levels (ordered by severity)
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Log source identifiers
 */
export type LogSource = string; // e.g., "ax-cli", "ax-orchestrator", "ax-agent-backend"

/**
 * Log entry structure
 */
export interface LogEntry {
  /** Timestamp (milliseconds since epoch) */
  timestamp: number;
  /** Log level */
  level: LogLevel;
  /** Source of the log (agent ID, system name, etc.) */
  source: LogSource;
  /** Log message */
  message: string;
  /** Optional structured data */
  data?: Record<string, unknown>;
  /** Optional error object */
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

/**
 * Log filter options
 */
export interface LogFilter {
  /** Minimum log level to include */
  minLevel?: LogLevel;
  /** Filter by source (exact match or regex) */
  source?: string | RegExp;
  /** Filter by time range */
  since?: number; // timestamp
  until?: number; // timestamp
}

/**
 * Unified Logger - Centralized logging for AX and ax-cli
 */
export class UnifiedLogger extends EventEmitter {
  private static instance: UnifiedLogger | null = null;

  private logs: LogEntry[] = [];
  private maxLogSize: number = 1000; // Keep last 1000 log entries
  private minLevel: LogLevel = LogLevel.DEBUG;

  private constructor() {
    super();
    // Allow many listeners (multiple subscribers)
    this.setMaxListeners(50);
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): UnifiedLogger {
    if (!UnifiedLogger.instance) {
      UnifiedLogger.instance = new UnifiedLogger();
    }
    return UnifiedLogger.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static reset(): void {
    if (UnifiedLogger.instance) {
      UnifiedLogger.instance.clear();
      UnifiedLogger.instance.removeAllListeners();
      UnifiedLogger.instance = null;
    }
  }

  /**
   * Set the minimum log level to record
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Set maximum number of log entries to keep in memory
   */
  setMaxLogSize(size: number): void {
    this.maxLogSize = Math.max(100, size); // Minimum 100 entries
    this.trimLogs();
  }

  /**
   * Log a message
   */
  log(level: LogLevel, source: LogSource, message: string, data?: Record<string, unknown>, error?: Error): void {
    // Skip if below minimum level
    if (level < this.minLevel) {
      return;
    }

    // BUG FIX: Deep clone data to prevent external mutation of stored log entries
    // Without this, external code could modify the data object (including nested objects)
    // after logging and corrupt the internal log state
    // Using structuredClone for proper deep cloning (preferred over JSON.parse/stringify)
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      source,
      message,
      data: data ? structuredClone(data) : undefined,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : undefined,
    };

    // Trim logs BEFORE adding to prevent exceeding maxLogSize
    // This ensures the array never grows beyond the limit
    if (this.logs.length >= this.maxLogSize) {
      // Remove oldest entries to make room (keep last maxLogSize - 1 entries)
      this.logs = this.logs.slice(-(this.maxLogSize - 1));
    }

    // Add to logs
    this.logs.push(entry);

    // BUG FIX: Emit separate deep copies of the entry to each event channel
    // The stored entry must not be shared with listeners, as listeners could
    // mutate it (including nested objects) and corrupt internal state.
    // Each emission gets its own deep copy.
    const emitEntry = (): LogEntry => ({
      ...entry,
      data: entry.data ? structuredClone(entry.data) : undefined,
      error: entry.error ? { ...entry.error } : undefined,
    });
    this.emit('log', emitEntry());
    this.emit(LogLevel[level].toLowerCase(), emitEntry());
  }

  /**
   * Log debug message
   */
  debug(source: LogSource, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, source, message, data);
  }

  /**
   * Log info message
   */
  info(source: LogSource, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, source, message, data);
  }

  /**
   * Log warning message
   */
  warn(source: LogSource, message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, source, message, data);
  }

  /**
   * Log error message
   */
  error(source: LogSource, message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, source, message, data, error);
  }

  /**
   * Trim logs to max size (keep most recent)
   */
  private trimLogs(): void {
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }
  }

  /**
   * Get all logs (optionally filtered)
   *
   * Returns deep copies of log entries to prevent external mutation of internal state.
   */
  getLogs(filter?: LogFilter): LogEntry[] {
    let filtered = [...this.logs];

    if (filter) {
      if (filter.minLevel !== undefined) {
        const minLevel = filter.minLevel;
        filtered = filtered.filter(log => log.level >= minLevel);
      }

      if (filter.source) {
        const source = filter.source;
        if (typeof source === 'string') {
          filtered = filtered.filter(log => log.source === source);
        } else if (source instanceof RegExp) {
          // Reset lastIndex before each filter to avoid stateful behavior with global regexes
          // Global regexes maintain lastIndex state between test() calls which can cause flaky results
          filtered = filtered.filter(log => {
            source.lastIndex = 0;
            return source.test(log.source);
          });
        }
      }

      if (filter.since !== undefined) {
        const since = filter.since;
        filtered = filtered.filter(log => log.timestamp >= since);
      }

      if (filter.until !== undefined) {
        const until = filter.until;
        filtered = filtered.filter(log => log.timestamp <= until);
      }
    }

    // BUG FIX: Return deep copies to prevent external mutation of internal log entries
    // Without this, external code could modify the returned entries (including nested objects)
    // and corrupt internal state
    return filtered.map(log => ({
      ...log,
      // Deep copy nested objects using structuredClone for proper deep cloning
      data: log.data ? structuredClone(log.data) : undefined,
      error: log.error ? { ...log.error } : undefined,
    }));
  }

  /**
   * Get recent logs (last N entries)
   *
   * @param count - Number of recent entries to return (must be positive)
   * @param filter - Optional filter to apply before selecting recent entries
   * @returns Array of recent log entries
   */
  getRecentLogs(count: number, filter?: LogFilter): LogEntry[] {
    // Validate count is a positive integer
    const validCount = typeof count === 'number' && isFinite(count) && count > 0
      ? Math.floor(count)
      : 0;

    if (validCount === 0) {
      return [];
    }

    const logs = this.getLogs(filter);
    return logs.slice(-validCount);
  }

  /**
   * Subscribe to all log events
   */
  onLog(callback: (entry: LogEntry) => void): () => void {
    this.on('log', callback);
    return () => this.off('log', callback);
  }

  /**
   * Subscribe to specific log level
   */
  onLevel(level: LogLevel, callback: (entry: LogEntry) => void): () => void {
    const eventName = LogLevel[level].toLowerCase();
    this.on(eventName, callback);
    return () => this.off(eventName, callback);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Get statistics about logs
   */
  getStats(): {
    total: number;
    byLevel: Record<string, number>;
    bySources: Record<string, number>;
    oldestTimestamp?: number;
    newestTimestamp?: number;
  } {
    const byLevel: Record<string, number> = {
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
    };

    const bySources: Record<string, number> = {};

    for (const log of this.logs) {
      // Count by level
      byLevel[LogLevel[log.level]]++;

      // Count by source
      bySources[log.source] = (bySources[log.source] || 0) + 1;
    }

    return {
      total: this.logs.length,
      byLevel,
      bySources,
      oldestTimestamp: this.logs.length > 0 ? this.logs[0].timestamp : undefined,
      newestTimestamp: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : undefined,
    };
  }

  /**
   * Format a log entry as a string
   */
  format(entry: LogEntry, options: { includeTimestamp?: boolean; includeSource?: boolean } = {}): string {
    const parts: string[] = [];

    // Timestamp
    if (options.includeTimestamp !== false) {
      const date = new Date(entry.timestamp);
      parts.push(`[${date.toISOString()}]`);
    }

    // Level
    const levelName = LogLevel[entry.level].padEnd(5);
    parts.push(`[${levelName}]`);

    // Source
    if (options.includeSource !== false) {
      parts.push(`[${entry.source}]`);
    }

    // Message
    parts.push(entry.message);

    // Data
    if (entry.data) {
      parts.push(JSON.stringify(entry.data));
    }

    // Error
    if (entry.error) {
      parts.push(`Error: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(`\n${entry.error.stack}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Export logs as JSON
   */
  exportJSON(filter?: LogFilter): string {
    const logs = this.getLogs(filter);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Export logs as plain text
   */
  exportText(filter?: LogFilter, options?: { includeTimestamp?: boolean; includeSource?: boolean }): string {
    const logs = this.getLogs(filter);
    return logs.map(log => this.format(log, options)).join('\n');
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }

}

/**
 * Get the global unified logger instance
 */
export function getUnifiedLogger(): UnifiedLogger {
  return UnifiedLogger.getInstance();
}

/**
 * Helper: Get log level from string
 */
export function parseLogLevel(level: string): LogLevel {
  const normalized = level.toUpperCase();
  switch (normalized) {
    case 'DEBUG': return LogLevel.DEBUG;
    case 'INFO': return LogLevel.INFO;
    case 'WARN': return LogLevel.WARN;
    case 'WARNING': return LogLevel.WARN;
    case 'ERROR': return LogLevel.ERROR;
    default: return LogLevel.INFO;
  }
}

/**
 * Helper: Get log level name
 */
export function getLogLevelName(level: LogLevel): string {
  return LogLevel[level];
}
