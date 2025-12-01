/**
 * Basic Audit Logger (Free Tier)
 *
 * Provides simple JSON logging for security events.
 *
 * Free Tier Features:
 * ✅ Simple JSON logging to file
 * ✅ 30-day retention (auto-cleanup)
 * ✅ Basic event tracking
 * ✅ Lightweight (no encryption, no hash chains)
 *
 * Enterprise features (requires @ax-cli/enterprise):
 * - Compliance reports (SOC2, HIPAA, PCI-DSS)
 * - Tamper-proof encrypted logs with hash chains
 * - Real-time dashboards
 * - Custom retention (1yr, 7yr, forever)
 * - Incident response workflows
 * - Anomaly detection
 *
 * Security: CVSS 6.1 (Medium Priority)
 */

import { writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { CONFIG_DIR_NAME } from '../constants.js';

/**
 * Security event severity levels
 */
export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

/**
 * Security event categories
 */
export enum AuditCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  COMMAND_EXECUTION = 'COMMAND_EXECUTION',
  API_CALL = 'API_CALL',
  RATE_LIMIT = 'RATE_LIMIT',
  INPUT_VALIDATION = 'INPUT_VALIDATION',
  ENCRYPTION = 'ENCRYPTION',
  MCP_OPERATION = 'MCP_OPERATION',
  FILE_OPERATION = 'FILE_OPERATION',
  SYSTEM_EVENT = 'SYSTEM_EVENT',
}

/**
 * Audit event structure (basic version)
 */
export interface AuditEvent {
  /**
   * Unique event ID
   */
  id: string;

  /**
   * Event timestamp (ISO 8601)
   */
  timestamp: string;

  /**
   * Event severity
   */
  severity: AuditSeverity;

  /**
   * Event category
   */
  category: AuditCategory;

  /**
   * Event action (e.g., "login", "file_read", "api_call")
   */
  action: string;

  /**
   * User or actor performing the action
   */
  actor?: string;

  /**
   * Resource being accessed/modified
   */
  resource?: string;

  /**
   * Event outcome (success/failure)
   */
  outcome: 'success' | 'failure';

  /**
   * Additional event details
   */
  details?: Record<string, unknown>;

  /**
   * Error message (if outcome is failure)
   */
  error?: string;

  /**
   * Source IP address (if applicable)
   */
  sourceIp?: string;
}

/**
 * Audit log configuration (basic version)
 */
export interface AuditLogConfig {
  /**
   * Directory to store audit logs
   */
  logDirectory?: string;

  /**
   * Log retention period in days (max 30 days in free tier)
   */
  retentionDays?: number;

  /**
   * Maximum log file size in bytes (default: 10MB)
   */
  maxFileSize?: number;
}

/**
 * Default configuration (free tier)
 */
const DEFAULT_CONFIG: Required<AuditLogConfig> = {
  logDirectory: join(homedir(), CONFIG_DIR_NAME, 'audit-logs'),
  retentionDays: 30,  // Free tier: max 30 days
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

/**
 * Basic Audit Logger (Free Tier)
 *
 * Simple JSON logging for security events.
 *
 * @example
 * ```typescript
 * const logger = AuditLogger.getInstance();
 *
 * // Log a security event
 * logger.log({
 *   severity: AuditSeverity.WARNING,
 *   category: AuditCategory.RATE_LIMIT,
 *   action: 'rate_limit_exceeded',
 *   actor: 'user-123',
 *   outcome: 'failure',
 *   details: { limit: 20, attempts: 25 },
 * });
 * ```
 */
export class AuditLogger {
  private static instance: AuditLogger | null = null;
  private config: Required<AuditLogConfig>;
  private currentLogFile: string;
  private eventCount: number = 0;

  private constructor(config: AuditLogConfig = {}) {
    // Enforce free tier limits
    const retentionDays = Math.min(config.retentionDays || 30, 30);

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      retentionDays
    };

    // Ensure log directory exists
    if (!existsSync(this.config.logDirectory)) {
      mkdirSync(this.config.logDirectory, { recursive: true });
    }

    // Initialize log file
    this.currentLogFile = this.getCurrentLogFile();

    // Start retention cleanup (run once on init)
    this.cleanupOldLogs();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: AuditLogConfig): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger(config);
    }
    return AuditLogger.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    AuditLogger.instance = null;
  }

  /**
   * Log an audit event (basic version - no hash chains)
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const fullEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    // Write to log file
    this.writeEvent(fullEvent);

    // Check if we need to rotate log file
    this.checkLogRotation();

    this.eventCount++;
  }

  /**
   * Log critical security event (convenience method)
   */
  logCritical(
    event: Omit<AuditEvent, 'id' | 'timestamp' | 'severity'>
  ): void {
    this.log({
      ...event,
      severity: AuditSeverity.CRITICAL,
    });
  }

  /**
   * Log warning event (convenience method)
   */
  logWarning(
    event: Omit<AuditEvent, 'id' | 'timestamp' | 'severity'>
  ): void {
    this.log({
      ...event,
      severity: AuditSeverity.WARNING,
    });
  }

  /**
   * Log error event (convenience method)
   */
  logError(
    event: Omit<AuditEvent, 'id' | 'timestamp' | 'severity'>
  ): void {
    this.log({
      ...event,
      severity: AuditSeverity.ERROR,
    });
  }

  /**
   * Log info event (convenience method)
   */
  logInfo(
    event: Omit<AuditEvent, 'id' | 'timestamp' | 'severity'>
  ): void {
    this.log({
      ...event,
      severity: AuditSeverity.INFO,
    });
  }

  /**
   * Get audit statistics
   */
  getStats(): {
    totalEvents: number;
    logDirectory: string;
    currentLogFile: string;
    retentionDays: number;
  } {
    return {
      totalEvents: this.eventCount,
      logDirectory: this.config.logDirectory,
      currentLogFile: this.currentLogFile,
      retentionDays: this.config.retentionDays,
    };
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `evt_${timestamp}_${random}`;
  }

  /**
   * Write event to log file
   * Gracefully handles permission errors to prevent crashes
   */
  private writeEvent(event: AuditEvent): void {
    const logLine = JSON.stringify(event) + '\n';

    try {
      writeFileSync(this.currentLogFile, logLine, { flag: 'a' });
    } catch (error: any) {
      // Check for permission errors (EPERM, EACCES, EROFS)
      const isPermissionError = error?.code === 'EPERM' ||
                                 error?.code === 'EACCES' ||
                                 error?.code === 'EROFS';

      if (isPermissionError) {
        // Silently skip logging on permission errors to prevent crashes
        // This ensures the caller's primary operation continues
        return;
      }

      // For other errors (locked file, disk full), try rotating
      try {
        this.rotateLogFile();
        writeFileSync(this.currentLogFile, logLine, { flag: 'a' });
      } catch (retryError: any) {
        // If retry also fails, silently continue to prevent cascade failures
        // Audit logging is secondary to the main operation
        return;
      }
    }
  }

  /**
   * Get current log file path
   */
  private getCurrentLogFile(): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return join(this.config.logDirectory, `audit-${date}.jsonl`);
  }

  /**
   * Check if log file needs rotation
   */
  private checkLogRotation(): void {
    try {
      const stats = statSync(this.currentLogFile);
      if (stats.size >= this.config.maxFileSize) {
        this.rotateLogFile();
      }
    } catch {
      // File doesn't exist or can't be read - will be created on next write
    }

    // Check if date changed (new day)
    const expectedFile = this.getCurrentLogFile();
    if (expectedFile !== this.currentLogFile) {
      this.rotateLogFile();
    }
  }

  /**
   * Rotate log file
   */
  private rotateLogFile(): void {
    this.currentLogFile = this.getCurrentLogFile();
  }

  /**
   * Clean up old log files (30-day retention in free tier)
   */
  private cleanupOldLogs(): void {
    try {
      if (!existsSync(this.config.logDirectory)) {
        return;
      }

      const files = readdirSync(this.config.logDirectory);
      const now = Date.now();
      const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.startsWith('audit-') || !file.endsWith('.jsonl')) {
          continue;
        }

        const filePath = join(this.config.logDirectory, file);
        const stats = statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > retentionMs) {
          unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to clean up old audit logs:', error);
    }
  }
}

/**
 * Get audit logger singleton
 */
export function getAuditLogger(config?: AuditLogConfig): AuditLogger {
  return AuditLogger.getInstance(config);
}
