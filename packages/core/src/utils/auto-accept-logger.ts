/**
 * Auto-accept Mode Audit Logger
 *
 * Specialized logger for tracking auto-accepted operations.
 * Integrates with safety rules system to track destructive operations.
 *
 * Design Philosophy:
 * - Every auto-accepted operation must be logged
 * - Track both safe and destructive operations
 * - Configurable retention via settings
 * - Easy retrieval for debugging
 * - Integration with general audit logger for compliance
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { DestructiveOperation } from './safety-rules.js';
import { getAuditLogger, AuditCategory, AuditSeverity } from './audit-logger.js';
import { getAxBaseDir } from './path-helpers.js';

export interface AutoAcceptLogEntry {
  timestamp: string; // ISO 8601 format
  sessionId: string; // Session identifier
  operation: string; // Operation type (bash, edit, write, etc)
  command?: string; // For bash operations
  filepath?: string; // For file operations
  details: string; // Human-readable description
  destructive: boolean; // Was this flagged as destructive?
  matchedRules?: string[]; // IDs of matched destructive operations
  ruleDetails?: DestructiveOperation[]; // Full rule objects
  userConfirmed: boolean; // Did user manually confirm?
  autoAccepted: boolean; // Was this auto-accepted?
  scope: 'session' | 'project' | 'global'; // Auto-accept scope
}

export interface AutoAcceptLogFilter {
  operation?: string;
  destructive?: boolean;
  autoAccepted?: boolean;
  sessionId?: string;
  startDate?: Date;
  endDate?: Date;
  scope?: 'session' | 'project' | 'global';
}

export interface AutoAcceptStats {
  totalOperations: number;
  autoAccepted: number;
  destructive: number;
  userConfirmed: number;
  sessionCount: number;
  mostCommonOperations: Array<{ operation: string; count: number }>;
  mostTriggeredRules: Array<{ rule: string; count: number }>;
}

export class AutoAcceptLogger {
  private static instance: AutoAcceptLogger | null = null;
  private logs: AutoAcceptLogEntry[] = [];
  private maxEntries: number;
  private filepath: string | undefined;
  private sessionId: string;
  private enabled: boolean;

  private constructor(enabled: boolean, maxEntries: number = 1000, filepath?: string) {
    this.enabled = enabled;
    this.maxEntries = maxEntries;
    this.filepath = filepath || this.getDefaultFilepath();
    this.sessionId = this.generateSessionId();

    // Ensure directory exists
    const dir = getAxBaseDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Load existing logs from file if filepath provided and exists
    if (this.filepath && existsSync(this.filepath)) {
      this.loadFromFile();
    }
  }

  /**
   * Get singleton instance
   * NOTE: Defaults to enabled=false to prevent unexpected disk writes
   * Use initializeAutoAcceptLogger() to explicitly enable with settings
   */
  public static getInstance(enabled?: boolean, maxEntries?: number, filepath?: string): AutoAcceptLogger {
    if (!AutoAcceptLogger.instance) {
      AutoAcceptLogger.instance = new AutoAcceptLogger(
        enabled ?? false, // Default to disabled - callers should explicitly enable
        maxEntries ?? 1000,
        filepath
      );
    }
    return AutoAcceptLogger.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  public static resetInstance(): void {
    AutoAcceptLogger.instance = null;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get default filepath for auto-accept logs
   */
  private getDefaultFilepath(): string {
    return join(getAxBaseDir(), 'auto-accept-audit.json');
  }

  /**
   * Log an operation
   */
  public log(entry: Omit<AutoAcceptLogEntry, 'timestamp' | 'sessionId'>): void {
    if (!this.enabled) {
      return;
    }

    const fullEntry: AutoAcceptLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
    };

    this.logs.push(fullEntry);

    // Enforce max entries (FIFO)
    if (this.logs.length > this.maxEntries) {
      this.logs = this.logs.slice(-this.maxEntries);
    }

    // Persist to file
    this.saveToFile();

    // Also log to general audit logger for compliance
    this.logToGeneralAudit(fullEntry);
  }

  /**
   * Log to general audit logger for compliance
   */
  private logToGeneralAudit(entry: AutoAcceptLogEntry): void {
    try {
      const auditLogger = getAuditLogger();

      auditLogger.log({
        severity: entry.destructive ? AuditSeverity.WARNING : AuditSeverity.INFO,
        category: entry.operation === 'bash'
          ? AuditCategory.COMMAND_EXECUTION
          : AuditCategory.FILE_OPERATION,
        action: entry.autoAccepted ? 'auto_accept' : 'user_confirmed',
        resource: entry.command || entry.filepath || 'unknown',
        outcome: 'success',
        details: {
          operation: entry.operation,
          destructive: entry.destructive,
          matchedRules: entry.matchedRules,
          scope: entry.scope,
          sessionId: entry.sessionId,
        },
      });
    } catch (error) {
      // Silently fail - don't block operation if audit logger fails
      console.error('[AutoAcceptLogger] Failed to log to general audit logger:', error);
    }
  }

  /**
   * Log a bash command
   */
  public logBashCommand(
    command: string,
    destructiveOperations: DestructiveOperation[],
    userConfirmed: boolean,
    autoAccepted: boolean,
    scope: 'session' | 'project' | 'global' = 'session'
  ): void {
    this.log({
      operation: 'bash',
      command,
      details: `Executed bash command: ${command}`,
      destructive: destructiveOperations.length > 0,
      matchedRules: destructiveOperations.map((op) => op.id),
      ruleDetails: destructiveOperations,
      userConfirmed,
      autoAccepted,
      scope,
    });
  }

  /**
   * Log a file operation
   */
  public logFileOperation(
    operation: 'edit' | 'write' | 'delete',
    filepath: string,
    destructive: boolean,
    userConfirmed: boolean,
    autoAccepted: boolean,
    scope: 'session' | 'project' | 'global' = 'session'
  ): void {
    this.log({
      operation,
      filepath,
      details: `${operation} file: ${filepath}`,
      destructive,
      userConfirmed,
      autoAccepted,
      scope,
    });
  }

  /**
   * Get all logs
   */
  public getAllLogs(): AutoAcceptLogEntry[] {
    return [...this.logs]; // Return copy
  }

  /**
   * Get logs matching filter
   */
  public getFilteredLogs(filter: AutoAcceptLogFilter): AutoAcceptLogEntry[] {
    return this.logs.filter((entry) => {
      // Operation filter
      if (filter.operation && entry.operation !== filter.operation) {
        return false;
      }

      // Destructive filter
      if (filter.destructive !== undefined && entry.destructive !== filter.destructive) {
        return false;
      }

      // Auto-accepted filter
      if (filter.autoAccepted !== undefined && entry.autoAccepted !== filter.autoAccepted) {
        return false;
      }

      // Session ID filter
      if (filter.sessionId && entry.sessionId !== filter.sessionId) {
        return false;
      }

      // Scope filter
      if (filter.scope && entry.scope !== filter.scope) {
        return false;
      }

      // Date range filter
      const entryDate = new Date(entry.timestamp);
      if (filter.startDate && entryDate < filter.startDate) {
        return false;
      }
      if (filter.endDate && entryDate > filter.endDate) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get logs for current session
   */
  public getCurrentSessionLogs(): AutoAcceptLogEntry[] {
    return this.getFilteredLogs({ sessionId: this.sessionId });
  }

  /**
   * Get recent logs (last N entries)
   */
  public getRecentLogs(count: number): AutoAcceptLogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get statistics
   */
  public getStats(sessionId?: string): AutoAcceptStats {
    const logs = sessionId
      ? this.getFilteredLogs({ sessionId })
      : this.logs;

    const totalOperations = logs.length;
    const autoAccepted = logs.filter((e) => e.autoAccepted).length;
    const destructive = logs.filter((e) => e.destructive).length;
    const userConfirmed = logs.filter((e) => e.userConfirmed).length;

    // Count unique sessions
    const sessionIds = new Set(logs.map((e) => e.sessionId));
    const sessionCount = sessionIds.size;

    // Count operations
    const operationCounts: Record<string, number> = {};
    logs.forEach((entry) => {
      operationCounts[entry.operation] = (operationCounts[entry.operation] || 0) + 1;
    });
    const mostCommonOperations = Object.entries(operationCounts)
      .map(([operation, count]) => ({ operation, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Count matched rules
    const ruleCounts: Record<string, number> = {};
    logs.forEach((entry) => {
      if (entry.matchedRules) {
        entry.matchedRules.forEach((rule) => {
          ruleCounts[rule] = (ruleCounts[rule] || 0) + 1;
        });
      }
    });
    const mostTriggeredRules = Object.entries(ruleCounts)
      .map(([rule, count]) => ({ rule, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalOperations,
      autoAccepted,
      destructive,
      userConfirmed,
      sessionCount,
      mostCommonOperations,
      mostTriggeredRules,
    };
  }

  /**
   * Get auto-accepted operations count
   */
  public getAutoAcceptedCount(sessionId?: string): number {
    const filter: AutoAcceptLogFilter = { autoAccepted: true };
    if (sessionId) {
      filter.sessionId = sessionId;
    }
    return this.getFilteredLogs(filter).length;
  }

  /**
   * Get destructive operations count
   */
  public getDestructiveCount(sessionId?: string): number {
    const filter: AutoAcceptLogFilter = { destructive: true };
    if (sessionId) {
      filter.sessionId = sessionId;
    }
    return this.getFilteredLogs(filter).length;
  }

  /**
   * Clear all logs
   */
  public clearLogs(): void {
    this.logs = [];
    if (this.filepath) {
      this.saveToFile();
    }
  }

  /**
   * Export logs to JSON file
   */
  public exportToFile(filepath: string): void {
    const data = JSON.stringify(this.logs, null, 2);
    writeFileSync(filepath, data, 'utf-8');
  }

  /**
   * Load logs from file
   */
  private loadFromFile(): void {
    try {
      if (!this.filepath || !existsSync(this.filepath)) {
        return;
      }

      const data = readFileSync(this.filepath, 'utf-8');
      const parsed = JSON.parse(data);

      if (Array.isArray(parsed)) {
        this.logs = parsed.slice(-this.maxEntries); // Only keep last maxEntries
      }
    } catch (error) {
      // Silently fail - audit log is not critical
      console.error('[AutoAcceptLogger] Failed to load logs from file:', error);
    }
  }

  /**
   * Save logs to file
   */
  private saveToFile(): void {
    try {
      if (!this.filepath) {
        return;
      }

      const data = JSON.stringify(this.logs, null, 2);
      writeFileSync(this.filepath, data, 'utf-8');
    } catch (error) {
      // Silently fail - audit log is not critical
      console.error('[AutoAcceptLogger] Failed to save logs to file:', error);
    }
  }

  /**
   * Format log entry for display
   */
  public static formatLogEntry(entry: AutoAcceptLogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleString();
    const destructiveFlag = entry.destructive ? '🔴' : '🟢';
    const autoAcceptFlag = entry.autoAccepted ? '⚡' : '✋';
    const scopeFlag = entry.scope === 'global' ? '🌍' : entry.scope === 'project' ? '📁' : '⏱️';

    let message = `[${timestamp}] ${destructiveFlag} ${autoAcceptFlag} ${scopeFlag} ${entry.operation}`;

    if (entry.command) {
      message += ` - ${entry.command}`;
    } else if (entry.filepath) {
      message += ` - ${entry.filepath}`;
    } else {
      message += ` - ${entry.details}`;
    }

    if (entry.matchedRules && entry.matchedRules.length > 0) {
      message += ` (rules: ${entry.matchedRules.join(', ')})`;
    }

    return message;
  }

  /**
   * Format all logs for display
   */
  public formatAllLogs(): string {
    if (this.logs.length === 0) {
      return 'No auto-accept operations logged yet.';
    }

    const header = `Auto-accept Audit Log (${this.logs.length} entries, session: ${this.sessionId})\n${'='.repeat(80)}\n`;
    const entries = this.logs.map((entry) => AutoAcceptLogger.formatLogEntry(entry)).join('\n');
    const footer = `\n${'='.repeat(80)}`;

    return header + entries + footer;
  }

  /**
   * Generate summary report
   */
  public generateSummary(sessionId?: string): string {
    const stats = this.getStats(sessionId);

    if (stats.totalOperations === 0) {
      return 'No auto-accept operations logged yet.';
    }

    const lines = [
      'Auto-accept Audit Summary',
      '='.repeat(50),
      `Session: ${sessionId || this.sessionId}`,
      '',
      '📊 Operations:',
      `  Total: ${stats.totalOperations}`,
      `  Auto-accepted: ${stats.autoAccepted} (${((stats.autoAccepted / stats.totalOperations) * 100).toFixed(1)}%)`,
      `  Destructive: ${stats.destructive} (${((stats.destructive / stats.totalOperations) * 100).toFixed(1)}%)`,
      `  User Confirmed: ${stats.userConfirmed} (${((stats.userConfirmed / stats.totalOperations) * 100).toFixed(1)}%)`,
      '',
      '🔧 Most Common Operations:',
      ...stats.mostCommonOperations.map((op) => `  ${op.operation}: ${op.count}`),
    ];

    if (stats.mostTriggeredRules.length > 0) {
      lines.push('', '⚠️  Most Triggered Safety Rules:');
      stats.mostTriggeredRules.forEach((rule) => {
        lines.push(`  ${rule.rule}: ${rule.count}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Get current session ID
   */
  public getCurrentSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if logger is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable logging
   */
  public enable(): void {
    this.enabled = true;
  }

  /**
   * Disable logging
   */
  public disable(): void {
    this.enabled = false;
  }
}

/**
 * Get singleton instance of auto-accept audit logger
 */
export function getAutoAcceptLogger(): AutoAcceptLogger {
  return AutoAcceptLogger.getInstance();
}

/**
 * Initialize auto-accept audit logger with settings
 */
export function initializeAutoAcceptLogger(
  enabled: boolean,
  maxEntries: number,
  filepath?: string
): AutoAcceptLogger {
  return AutoAcceptLogger.getInstance(enabled, maxEntries, filepath);
}
