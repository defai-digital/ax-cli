/**
 * Structured logging utility for AX CLI
 *
 * Provides consistent logging across the application with:
 * - Log levels (debug, info, warn, error)
 * - Structured context for debugging
 * - Silent mode for programmatic usage
 * - Optional JSON output for log aggregation
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

class Logger {
  private static instance: Logger;
  private level: LogLevel = LogLevel.INFO;
  private jsonOutput = false;

  private constructor() {
    // Check environment for log level
    const envLevel = process.env.AX_LOG_LEVEL?.toUpperCase();
    if (envLevel && envLevel in LogLevel) {
      this.level = LogLevel[envLevel as keyof typeof LogLevel];
    }

    // Check for JSON output mode
    this.jsonOutput = process.env.AX_LOG_JSON === 'true';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set the minimum log level
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  public getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Enable/disable JSON output format
   */
  public setJsonOutput(enabled: boolean): void {
    this.jsonOutput = enabled;
  }

  /**
   * Check if a log level is enabled
   */
  public isLevelEnabled(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(entry: LogEntry): string {
    if (this.jsonOutput) {
      return JSON.stringify({
        ...entry,
        level: LogLevel[entry.level],
      });
    }

    const levelPrefix = this.getLevelPrefix(entry.level);
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    return `${levelPrefix} ${entry.message}${contextStr}`;
  }

  private getLevelPrefix(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '[DEBUG]';
      case LogLevel.INFO:
        return '[INFO]';
      case LogLevel.WARN:
        return '[WARN]';
      case LogLevel.ERROR:
        return '[ERROR]';
      default:
        return '';
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    const formatted = this.formatMessage(entry);

    const target =
      level === LogLevel.ERROR
        ? console.error
        : level === LogLevel.WARN
          ? console.warn
          : level === LogLevel.INFO
            ? console.info
            : console.debug;

    // Fall back to console.log if a level-specific method is missing
    (target || console.log)(formatted);
  }

  /**
   * Log debug message (only shown when AX_LOG_LEVEL=DEBUG)
   */
  public debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  public info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  public warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  public error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Log error with stack trace
   */
  public errorWithStack(message: string, error: unknown, context?: LogContext): void {
    const errorContext: LogContext = { ...context };

    if (error instanceof Error) {
      errorContext.errorMessage = error.message;
      errorContext.errorName = error.name;
      if (error.stack) {
        errorContext.stack = error.stack;
      }
    } else {
      errorContext.error = String(error);
    }

    this.log(LogLevel.ERROR, message, errorContext);
  }
}

/**
 * Get the singleton logger instance
 */
export function getLogger(): Logger {
  return Logger.getInstance();
}

/**
 * Convenience export for direct usage
 */
export const logger = Logger.getInstance();
