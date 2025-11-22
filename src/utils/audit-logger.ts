/**
 * Security Audit Logging System (REQ-SEC-008)
 *
 * Provides tamper-proof logging for security-critical events
 * Implements:
 * - Cryptographic log integrity verification
 * - Automatic log retention (90 days)
 * - SIEM-ready structured logging
 * - Critical event alerting
 *
 * Security: CVSS 6.1 (Medium Priority)
 */

import { createHash } from 'crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

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
 * Audit event structure
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

  /**
   * Previous log entry hash (for tamper detection)
   */
  previousHash?: string;

  /**
   * Current entry hash (SHA-256 of all fields)
   */
  hash?: string;
}

/**
 * Audit log configuration
 */
export interface AuditLogConfig {
  /**
   * Directory to store audit logs
   */
  logDirectory?: string;

  /**
   * Log retention period in days (default: 90)
   */
  retentionDays?: number;

  /**
   * Whether to emit critical event alerts
   */
  enableAlerts?: boolean;

  /**
   * Whether to enable tamper-proof chaining
   */
  enableChaining?: boolean;

  /**
   * Maximum log file size in bytes (default: 10MB)
   */
  maxFileSize?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<AuditLogConfig> = {
  logDirectory: join(homedir(), '.ax-cli', 'audit-logs'),
  retentionDays: 90,
  enableAlerts: true,
  enableChaining: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

/**
 * Audit Logger
 *
 * Provides tamper-proof audit logging with cryptographic verification
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
 *
 * // Log critical event (triggers alert)
 * logger.logCritical({
 *   category: AuditCategory.COMMAND_EXECUTION,
 *   action: 'shell_injection_attempt',
 *   outcome: 'failure',
 *   details: { command: 'ls; rm -rf /' },
 * });
 * ```
 */
export class AuditLogger {
  private static instance: AuditLogger | null = null;
  private config: Required<AuditLogConfig>;
  private currentLogFile: string;
  private lastHash: string | null = null;
  private eventCount: number = 0;
  private alertCallbacks: Array<(event: AuditEvent) => void> = [];

  private constructor(config: AuditLogConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Ensure log directory exists
    if (!existsSync(this.config.logDirectory)) {
      mkdirSync(this.config.logDirectory, { recursive: true });
    }

    // Initialize log file
    this.currentLogFile = this.getCurrentLogFile();

    // Load last hash for chaining
    if (this.config.enableChaining) {
      this.lastHash = this.loadLastHash();
    }

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
   * Register alert callback for critical events
   */
  onCriticalEvent(callback: (event: AuditEvent) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Log an audit event
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp' | 'hash' | 'previousHash'>): void {
    const fullEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    // Add hash chain for tamper detection
    if (this.config.enableChaining) {
      fullEvent.previousHash = this.lastHash || undefined;
      fullEvent.hash = this.calculateHash(fullEvent);
      this.lastHash = fullEvent.hash;
    }

    // Write to log file
    this.writeEvent(fullEvent);

    // Emit alert for critical events
    if (this.config.enableAlerts && fullEvent.severity === AuditSeverity.CRITICAL) {
      this.emitAlert(fullEvent);
    }

    // Check if we need to rotate log file
    this.checkLogRotation();

    this.eventCount++;
  }

  /**
   * Log critical security event (convenience method)
   */
  logCritical(
    event: Omit<AuditEvent, 'id' | 'timestamp' | 'severity' | 'hash' | 'previousHash'>
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
    event: Omit<AuditEvent, 'id' | 'timestamp' | 'severity' | 'hash' | 'previousHash'>
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
    event: Omit<AuditEvent, 'id' | 'timestamp' | 'severity' | 'hash' | 'previousHash'>
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
    event: Omit<AuditEvent, 'id' | 'timestamp' | 'severity' | 'hash' | 'previousHash'>
  ): void {
    this.log({
      ...event,
      severity: AuditSeverity.INFO,
    });
  }

  /**
   * Verify log integrity
   *
   * Checks the hash chain to detect tampering
   */
  verifyIntegrity(logFile?: string): { valid: boolean; errors: string[] } {
    const file = logFile || this.currentLogFile;

    if (!existsSync(file)) {
      return { valid: false, errors: ['Log file does not exist'] };
    }

    const errors: string[] = [];
    const lines = readFileSync(file, 'utf8').split('\n').filter(l => l.trim());

    let previousHash: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      try {
        const event: AuditEvent = JSON.parse(lines[i]);

        // Verify hash chain (normalize undefined to null for comparison)
        const eventPrevHash = event.previousHash || null;
        if (eventPrevHash !== previousHash) {
          errors.push(
            `Event ${event.id} (line ${i + 1}): Hash chain broken. ` +
            `Expected previous hash: ${previousHash}, got: ${eventPrevHash}`
          );
        }

        // Verify event hash
        const calculatedHash = this.calculateHash(event);
        if (event.hash !== calculatedHash) {
          errors.push(
            `Event ${event.id} (line ${i + 1}): Hash mismatch. ` +
            `Event may have been tampered with.`
          );
        }

        previousHash = event.hash || null;
      } catch (error) {
        errors.push(`Line ${i + 1}: Invalid JSON - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
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
   * Calculate SHA-256 hash of event (excluding hash field itself)
   */
  private calculateHash(event: AuditEvent): string {
    // Create copy without hash field
    const { hash, ...eventWithoutHash } = event;

    // Sort keys for consistent hashing, filter out undefined values
    const sortedKeys = Object.keys(eventWithoutHash)
      .filter(key => (eventWithoutHash as any)[key] !== undefined)
      .sort();

    const data = sortedKeys.map(key => {
      const value = (eventWithoutHash as any)[key];
      return `${key}:${JSON.stringify(value)}`;
    }).join('|');

    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Write event to log file
   */
  private writeEvent(event: AuditEvent): void {
    const logLine = JSON.stringify(event) + '\n';

    try {
      writeFileSync(this.currentLogFile, logLine, { flag: 'a' });
    } catch (error) {
      // Fallback: If current log file is locked/corrupted, create new one
      console.error('Failed to write to audit log:', error);
      this.rotateLogFile();
      writeFileSync(this.currentLogFile, logLine, { flag: 'a' });
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
   * Load last hash from current log file
   */
  private loadLastHash(): string | null {
    if (!existsSync(this.currentLogFile)) {
      return null;
    }

    try {
      const lines = readFileSync(this.currentLogFile, 'utf8').split('\n').filter(l => l.trim());
      if (lines.length === 0) return null;

      const lastEvent: AuditEvent = JSON.parse(lines[lines.length - 1]);
      return lastEvent.hash || null;
    } catch {
      return null;
    }
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
    this.lastHash = this.loadLastHash();
  }

  /**
   * Clean up old log files (retention policy)
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

  /**
   * Emit alert for critical events
   */
  private emitAlert(event: AuditEvent): void {
    for (const callback of this.alertCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Alert callback failed:', error);
      }
    }
  }
}

/**
 * Get audit logger singleton
 */
export function getAuditLogger(config?: AuditLogConfig): AuditLogger {
  return AuditLogger.getInstance(config);
}
