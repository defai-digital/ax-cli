/**
 * Analysis Logger
 *
 * Structured logging for analysis operations.
 * Provides context-aware logging with severity levels.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

/**
 * Console-based logger implementation
 */
export class ConsoleLogger implements Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, context || '');
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, context || '');
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, context || '');
    }
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (this.level <= LogLevel.ERROR) {
      const errorInfo = error
        ? { message: error.message, stack: error.stack }
        : undefined;
      console.error(
        `[ERROR] ${message}`,
        errorInfo,
        context || ''
      );
    }
  }

  /**
   * Set log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

/**
 * No-op logger for testing or when logging is disabled
 */
export class NoopLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

/**
 * Create a logger based on environment
 *
 * By default, only shows WARN and ERROR messages to avoid cluttering CLI output.
 * Set DEBUG=1 to enable all log levels including INFO and DEBUG.
 */
export function createLogger(): Logger {
  const debugMode = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
  const level = debugMode ? LogLevel.DEBUG : LogLevel.WARN;
  return new ConsoleLogger(level);
}
