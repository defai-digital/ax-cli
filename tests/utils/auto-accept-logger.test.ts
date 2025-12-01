/**
 * Unit tests for Auto-accept Audit Logger (Phase 2)
 *
 * Tests logging, statistics, filtering, and export functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AutoAcceptLogger,
  getAutoAcceptLogger,
  initializeAutoAcceptLogger,
} from '../../src/utils/auto-accept-logger.js';
import { DESTRUCTIVE_OPERATIONS } from '../../src/utils/safety-rules.js';
import { existsSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Auto-accept Audit Logger', () => {
  // Use unique temp file for each test to avoid conflicts
  const getTempFilepath = () => join(tmpdir(), `test-audit-${Date.now()}-${Math.random()}.json`);

  beforeEach(() => {
    // Reset singleton before each test to ensure clean state
    AutoAcceptLogger.resetInstance();
  });

  afterEach(() => {
    // Clean up singleton after each test
    AutoAcceptLogger.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const logger1 = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const logger2 = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      expect(logger1).toBe(logger2);
    });

    it('should reset instance', () => {
      const logger1 = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      AutoAcceptLogger.resetInstance();
      const logger2 = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      expect(logger1).not.toBe(logger2);
    });

    it('should return instance via getAutoAcceptLogger helper', () => {
      const logger = getAutoAcceptLogger();
      expect(logger).toBeInstanceOf(AutoAcceptLogger);
    });

    it('should return instance via initializeAutoAcceptLogger', () => {
      const logger = initializeAutoAcceptLogger(true, 1000);
      expect(logger).toBeInstanceOf(AutoAcceptLogger);
    });

    it('should return logger instance even when disabled', () => {
      const logger = initializeAutoAcceptLogger(false, 1000);
      expect(logger).toBeInstanceOf(AutoAcceptLogger);
      expect(logger.isEnabled()).toBe(false);
    });
  });

  describe('Logging Operations', () => {
    it('should log a bash command', () => {
      // Use in-memory logger (no file persistence)
      const logger = AutoAcceptLogger.getInstance(true, 1000, undefined);
      logger.clearLogs(); // Ensure clean state
      logger.logBashCommand(
        'ls -la',
        [],
        false,
        true,
        'session'
      );

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].operation).toBe('bash');
      expect(logs[0].command).toBe('ls -la');
      expect(logs[0].autoAccepted).toBe(true);
    });

    it('should log destructive bash command with matched rules', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand(
        'git push --force origin main',
        [DESTRUCTIVE_OPERATIONS.git_force_push, DESTRUCTIVE_OPERATIONS.git_push_main],
        false,
        false,
        'session'
      );

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].destructive).toBe(true);
      expect(logs[0].matchedRules).toHaveLength(2);
      expect(logs[0].matchedRules).toContain('git_force_push');
      expect(logs[0].matchedRules).toContain('git_push_main');
    });

    it('should log file operation', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logFileOperation(
        'edit',
        '/path/to/file.ts',
        false,
        true,
        false,
        'session'
      );

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].operation).toBe('edit');
      expect(logs[0].filepath).toBe('/path/to/file.ts');
      expect(logs[0].destructive).toBe(false);
    });

    it('should add timestamp and sessionId automatically', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand('echo test', [], false, true, 'session');

      const logs = logger.getAllLogs();
      expect(logs[0].timestamp).toBeDefined();
      expect(logs[0].sessionId).toBeDefined();
      expect(logs[0].sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);
    });

    it('should handle multiple log entries', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());

      logger.logBashCommand('ls -la', [], false, true, 'session');
      logger.logBashCommand('pwd', [], false, true, 'session');
      logger.logFileOperation('edit', 'file.ts', false, false, false, 'session');

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(3);
    });

    it('should enforce maxEntries limit (FIFO)', () => {
      const logger = AutoAcceptLogger.getInstance(true, 5); // maxEntries = 5

      // Add 10 entries
      for (let i = 0; i < 10; i++) {
        logger.logBashCommand(`command ${i}`, [], false, true, 'session');
      }

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(5); // Only last 5
      expect(logs[0].command).toBe('command 5'); // First retained entry
      expect(logs[4].command).toBe('command 9'); // Last entry
    });

    it('should not log when logger is disabled', () => {
      const logger = AutoAcceptLogger.getInstance(false, 1000, undefined);
      logger.clearLogs(); // Ensure clean state
      logger.logBashCommand('ls -la', [], false, true, 'session');

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(0);
    });
  });

  describe('Retrieval Methods', () => {
    beforeEach(() => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());

      // Add test data
      logger.logBashCommand('git status', [], false, true, 'session');
      logger.logBashCommand('git push --force origin main',
        [DESTRUCTIVE_OPERATIONS.git_force_push],
        true,
        false,
        'session'
      );
      logger.logFileOperation('edit', 'file.ts', false, false, false, 'session');
    });

    it('should get all logs', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(3);
    });

    it('should return copy of logs array', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const logs1 = logger.getAllLogs();
      const logs2 = logger.getAllLogs();
      expect(logs1).not.toBe(logs2); // Different array references
      expect(logs1).toEqual(logs2); // Same content
    });

    it('should get current session logs', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const sessionLogs = logger.getCurrentSessionLogs();
      expect(sessionLogs).toHaveLength(3);
      const sessionId = logger.getCurrentSessionId();
      sessionLogs.forEach(log => {
        expect(log.sessionId).toBe(sessionId);
      });
    });

    it('should get recent logs', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const recent = logger.getRecentLogs(2);
      expect(recent).toHaveLength(2);
      expect(recent[1].operation).toBe('edit'); // Most recent
    });

    it('should filter logs by operation', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const bashLogs = logger.getFilteredLogs({ operation: 'bash' });
      expect(bashLogs).toHaveLength(2);
      bashLogs.forEach(log => {
        expect(log.operation).toBe('bash');
      });
    });

    it('should filter logs by destructive flag', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const destructiveLogs = logger.getFilteredLogs({ destructive: true });
      expect(destructiveLogs).toHaveLength(1);
      expect(destructiveLogs[0].destructive).toBe(true);
    });

    it('should filter logs by autoAccepted flag', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const autoAcceptedLogs = logger.getFilteredLogs({ autoAccepted: true });
      expect(autoAcceptedLogs).toHaveLength(1);
      expect(autoAcceptedLogs[0].autoAccepted).toBe(true);
    });

    it('should filter logs by sessionId', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const sessionId = logger.getCurrentSessionId();
      const sessionLogs = logger.getFilteredLogs({ sessionId });
      expect(sessionLogs).toHaveLength(3);
    });

    it('should filter logs by date range', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const filtered = logger.getFilteredLogs({
        startDate: oneHourAgo,
        endDate: now
      });
      expect(filtered).toHaveLength(3); // All recent logs
    });

    it('should filter logs by multiple criteria', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const filtered = logger.getFilteredLogs({
        operation: 'bash',
        destructive: false,
        autoAccepted: true
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].command).toBe('git status');
    });
  });

  describe('Statistics', () => {
    // Use consistent temp file for all tests in this describe block
    const statsTestFile = join(tmpdir(), `test-audit-stats-${Date.now()}.json`);

    beforeEach(() => {
      // Reset singleton to ensure clean state
      AutoAcceptLogger.resetInstance();
      const logger = AutoAcceptLogger.getInstance(true, 1000, statsTestFile);
      logger.clearLogs(); // Clear any previous data

      // Add varied test data
      logger.logBashCommand('git status', [], false, true, 'session');
      logger.logBashCommand('git push --force main', [DESTRUCTIVE_OPERATIONS.git_force_push], true, false, 'session');
      logger.logBashCommand('npm install', [], false, true, 'session');
      logger.logFileOperation('edit', 'file1.ts', false, false, false, 'session');
      logger.logFileOperation('edit', 'file2.ts', false, false, false, 'session');
      logger.logFileOperation('write', 'file3.ts', false, true, true, 'session');
    });

    it('should calculate total operations', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, statsTestFile);
      const stats = logger.getStats();
      expect(stats.totalOperations).toBe(6);
    });

    it('should calculate auto-accepted count', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, statsTestFile);
      const stats = logger.getStats();
      expect(stats.autoAccepted).toBe(3); // git status, npm install, write
    });

    it('should calculate destructive count', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, statsTestFile);
      const stats = logger.getStats();
      expect(stats.destructive).toBe(1); // git push --force
    });

    it('should calculate user confirmed count', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, statsTestFile);
      const stats = logger.getStats();
      expect(stats.userConfirmed).toBe(2); // git push --force + write file3.ts
    });

    it('should calculate most common operations', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, statsTestFile);
      const stats = logger.getStats();
      expect(stats.mostCommonOperations).toHaveLength(3);
      expect(stats.mostCommonOperations[0].operation).toBe('bash');
      expect(stats.mostCommonOperations[0].count).toBe(3);
      expect(stats.mostCommonOperations[1].operation).toBe('edit');
      expect(stats.mostCommonOperations[1].count).toBe(2);
    });

    it('should calculate most triggered rules', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, statsTestFile);
      const stats = logger.getStats();
      expect(stats.mostTriggeredRules).toHaveLength(1);
      expect(stats.mostTriggeredRules[0].rule).toBe('git_force_push');
      expect(stats.mostTriggeredRules[0].count).toBe(1);
    });

    it('should get auto-accepted count', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, statsTestFile);
      const count = logger.getAutoAcceptedCount();
      expect(count).toBe(3);
    });

    it('should get destructive count', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, statsTestFile);
      const count = logger.getDestructiveCount();
      expect(count).toBe(1);
    });
  });

  describe('Display Formatting', () => {
    it('should format single log entry', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand('git status', [], false, true, 'session');

      const logs = logger.getAllLogs();
      const formatted = AutoAcceptLogger.formatLogEntry(logs[0]);

      expect(formatted).toContain('bash');
      expect(formatted).toContain('git status');
      expect(formatted).toContain('🟢'); // Not destructive
      expect(formatted).toContain('⚡'); // Auto-accepted
    });

    it('should format destructive log entry', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand(
        'git push --force',
        [DESTRUCTIVE_OPERATIONS.git_force_push],
        true,
        false,
        'session'
      );

      const logs = logger.getAllLogs();
      const formatted = AutoAcceptLogger.formatLogEntry(logs[0]);

      expect(formatted).toContain('🔴'); // Destructive
      expect(formatted).toContain('✋'); // User confirmed
      expect(formatted).toContain('git_force_push');
    });

    it('should format all logs', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand('git status', [], false, true, 'session');
      logger.logBashCommand('ls -la', [], false, true, 'session');

      const formatted = logger.formatAllLogs();

      expect(formatted).toContain('Audit Log');
      expect(formatted).toContain('2 entries');
      expect(formatted).toContain('git status');
      expect(formatted).toContain('ls -la');
    });

    it('should handle empty logs', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const formatted = logger.formatAllLogs();

      expect(formatted).toBe('No auto-accept operations logged yet.');
    });

    it('should generate summary', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand('git status', [], false, true, 'session');
      logger.logBashCommand('git push --force', [DESTRUCTIVE_OPERATIONS.git_force_push], true, false, 'session');

      const summary = logger.generateSummary();

      expect(summary).toContain('Audit Summary');
      expect(summary).toContain('Total: 2');
      expect(summary).toContain('Auto-accepted: 1');
      expect(summary).toContain('Destructive: 1');
      expect(summary).toContain('User Confirmed: 1');
    });
  });

  describe('Management Operations', () => {
    it('should clear all logs', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand('git status', [], false, true, 'session');
      logger.logBashCommand('ls -la', [], false, true, 'session');

      expect(logger.getAllLogs()).toHaveLength(2);

      logger.clearLogs();

      expect(logger.getAllLogs()).toHaveLength(0);
    });

    it('should export logs to file', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand('git status', [], false, true, 'session');

      const exportPath = join(tmpdir(), `test-export-${Date.now()}.json`);
      logger.exportToFile(exportPath);

      expect(existsSync(exportPath)).toBe(true);

      // Cleanup
      if (existsSync(exportPath)) {
        unlinkSync(exportPath);
      }
    });

    it('should enable/disable logger', () => {
      const logger = AutoAcceptLogger.getInstance(false);

      expect(logger.isEnabled()).toBe(false);

      logger.enable();
      expect(logger.isEnabled()).toBe(true);

      logger.disable();
      expect(logger.isEnabled()).toBe(false);
    });

    it('should not log when disabled', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, undefined);
      logger.clearLogs(); // Ensure clean state
      logger.logBashCommand('command1', [], false, true, 'session');

      logger.disable();
      logger.logBashCommand('command2', [], false, true, 'session');

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].command).toBe('command1');
    });

    it('should get current session ID', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const sessionId = logger.getCurrentSessionId();

      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);
    });
  });

  describe('Session Tracking', () => {
    it('should use same session ID for all logs in session', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const sessionId = logger.getCurrentSessionId();

      logger.logBashCommand('command1', [], false, true, 'session');
      logger.logBashCommand('command2', [], false, true, 'session');

      const logs = logger.getAllLogs();
      logs.forEach(log => {
        expect(log.sessionId).toBe(sessionId);
      });
    });

    it('should generate unique session IDs for different instances', () => {
      const logger1 = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const sessionId1 = logger1.getCurrentSessionId();

      AutoAcceptLogger.resetInstance();

      const logger2 = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const sessionId2 = logger2.getCurrentSessionId();

      expect(sessionId1).not.toBe(sessionId2);
    });
  });

  describe('Scope Tracking', () => {
    it('should track session scope', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand('git status', [], false, true, 'session');

      const logs = logger.getAllLogs();
      expect(logs[0].scope).toBe('session');
    });

    it('should track project scope', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand('git status', [], false, true, 'project');

      const logs = logger.getAllLogs();
      expect(logs[0].scope).toBe('project');
    });

    it('should track global scope', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand('git status', [], false, true, 'global');

      const logs = logger.getAllLogs();
      expect(logs[0].scope).toBe('global');
    });

    it('should filter logs by scope', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand('command1', [], false, true, 'session');
      logger.logBashCommand('command2', [], false, true, 'project');
      logger.logBashCommand('command3', [], false, true, 'global');

      const sessionLogs = logger.getFilteredLogs({ scope: 'session' });
      expect(sessionLogs).toHaveLength(1);
      expect(sessionLogs[0].command).toBe('command1');

      const projectLogs = logger.getFilteredLogs({ scope: 'project' });
      expect(projectLogs).toHaveLength(1);
      expect(projectLogs[0].command).toBe('command2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long command strings', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const longCommand = 'a'.repeat(10000);

      logger.logBashCommand(longCommand, [], false, true, 'session');

      const logs = logger.getAllLogs();
      expect(logs[0].command).toBe(longCommand);
    });

    it('should handle special characters in commands', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      const specialCommand = 'echo "test" | grep \\"pattern\\" && ls -la';

      logger.logBashCommand(specialCommand, [], false, true, 'session');

      const logs = logger.getAllLogs();
      expect(logs[0].command).toBe(specialCommand);
    });

    it('should handle empty command string', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand('', [], false, true, 'session');

      const logs = logger.getAllLogs();
      expect(logs[0].command).toBe('');
    });

    it('should handle very large maxEntries', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000000, undefined);
      logger.clearLogs(); // Ensure clean state

      for (let i = 0; i < 100; i++) {
        logger.logBashCommand(`command ${i}`, [], false, true, 'session');
      }

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(100);
    });

    it('should handle multiple destructive operations', () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, getTempFilepath());
      logger.logBashCommand(
        'git push --force origin main',
        [DESTRUCTIVE_OPERATIONS.git_force_push, DESTRUCTIVE_OPERATIONS.git_push_main],
        true,
        false,
        'session'
      );

      const logs = logger.getAllLogs();
      expect(logs[0].matchedRules).toHaveLength(2);
      expect(logs[0].ruleDetails).toHaveLength(2);
    });
  });
});
