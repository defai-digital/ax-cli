/**
 * Tests for Audit Logger (REQ-SEC-008)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync, unlinkSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  AuditLogger,
  getAuditLogger,
  AuditSeverity,
  AuditCategory,
  type AuditEvent,
} from '../../src/utils/audit-logger.js';

describe('AuditLogger', () => {
  let testLogDir: string;
  let logger: AuditLogger;

  beforeEach(() => {
    // Create unique test directory
    testLogDir = join(tmpdir(), `audit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    // Reset singleton
    AuditLogger.resetInstance();

    // Create logger with test directory
    logger = AuditLogger.getInstance({
      logDirectory: testLogDir,
      retentionDays: 7, // Shorter for testing
      enableAlerts: true,
      enableChaining: true,
    });
  });

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(testLogDir)) {
      const files = readdirSync(testLogDir);
      for (const file of files) {
        unlinkSync(join(testLogDir, file));
      }
      rmdirSync(testLogDir);
    }

    // Reset singleton
    AuditLogger.resetInstance();
  });

  describe('log()', () => {
    it('should log an event with all fields', () => {
      logger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.API_CALL,
        action: 'test_action',
        outcome: 'success',
        actor: 'test-user',
        resource: 'test-resource',
        details: { key: 'value' },
      });

      const stats = logger.getStats();
      expect(stats.totalEvents).toBe(1);

      // Verify log file was created
      expect(existsSync(stats.currentLogFile)).toBe(true);

      // Read and verify content
      const content = readFileSync(stats.currentLogFile, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      expect(lines).toHaveLength(1);

      const event: AuditEvent = JSON.parse(lines[0]);
      expect(event.severity).toBe(AuditSeverity.INFO);
      expect(event.category).toBe(AuditCategory.API_CALL);
      expect(event.action).toBe('test_action');
      expect(event.outcome).toBe('success');
      expect(event.actor).toBe('test-user');
      expect(event.resource).toBe('test-resource');
      expect(event.details).toEqual({ key: 'value' });
      expect(event.id).toBeTruthy();
      expect(event.timestamp).toBeTruthy();
    });

    it('should generate unique event IDs', () => {
      logger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM_EVENT,
        action: 'test1',
        outcome: 'success',
      });

      logger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM_EVENT,
        action: 'test2',
        outcome: 'success',
      });

      const content = readFileSync(logger.getStats().currentLogFile, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      const event1: AuditEvent = JSON.parse(lines[0]);
      const event2: AuditEvent = JSON.parse(lines[1]);

      expect(event1.id).not.toBe(event2.id);
    });

    it('should include timestamp in ISO 8601 format', () => {
      logger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM_EVENT,
        action: 'test',
        outcome: 'success',
      });

      const content = readFileSync(logger.getStats().currentLogFile, 'utf8');
      const event: AuditEvent = JSON.parse(content.trim());

      // Verify ISO 8601 format
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
    });
  });

  describe('convenience methods', () => {
    it('should log critical events with logCritical()', () => {
      logger.logCritical({
        category: AuditCategory.COMMAND_EXECUTION,
        action: 'dangerous_command',
        outcome: 'failure',
      });

      const content = readFileSync(logger.getStats().currentLogFile, 'utf8');
      const event: AuditEvent = JSON.parse(content.trim());

      expect(event.severity).toBe(AuditSeverity.CRITICAL);
    });

    it('should log warnings with logWarning()', () => {
      logger.logWarning({
        category: AuditCategory.RATE_LIMIT,
        action: 'limit_exceeded',
        outcome: 'failure',
      });

      const content = readFileSync(logger.getStats().currentLogFile, 'utf8');
      const event: AuditEvent = JSON.parse(content.trim());

      expect(event.severity).toBe(AuditSeverity.WARNING);
    });

    it('should log errors with logError()', () => {
      logger.logError({
        category: AuditCategory.AUTHENTICATION,
        action: 'login_failed',
        outcome: 'failure',
        error: 'Invalid credentials',
      });

      const content = readFileSync(logger.getStats().currentLogFile, 'utf8');
      const event: AuditEvent = JSON.parse(content.trim());

      expect(event.severity).toBe(AuditSeverity.ERROR);
      expect(event.error).toBe('Invalid credentials');
    });

    it('should log info events with logInfo()', () => {
      logger.logInfo({
        category: AuditCategory.DATA_ACCESS,
        action: 'file_read',
        outcome: 'success',
      });

      const content = readFileSync(logger.getStats().currentLogFile, 'utf8');
      const event: AuditEvent = JSON.parse(content.trim());

      expect(event.severity).toBe(AuditSeverity.INFO);
    });
  });

  // Enterprise features (tamper-proof chaining) moved to @ax-cli/enterprise
  describe.skip('tamper-proof chaining', () => {
    it('should create hash chain across events', () => {
      logger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM_EVENT,
        action: 'event1',
        outcome: 'success',
      });

      logger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM_EVENT,
        action: 'event2',
        outcome: 'success',
      });

      const content = readFileSync(logger.getStats().currentLogFile, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      const event1: AuditEvent = JSON.parse(lines[0]);
      const event2: AuditEvent = JSON.parse(lines[1]);

      // First event has no previous hash
      expect(event1.previousHash).toBeUndefined();
      expect(event1.hash).toBeTruthy();

      // Second event's previousHash should match first event's hash
      expect(event2.previousHash).toBe(event1.hash);
      expect(event2.hash).toBeTruthy();
      expect(event2.hash).not.toBe(event1.hash);
    });

    it('should verify integrity of unmodified logs', () => {
      logger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM_EVENT,
        action: 'test1',
        outcome: 'success',
      });

      logger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM_EVENT,
        action: 'test2',
        outcome: 'success',
      });

      const result = logger.verifyIntegrity();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect tampered log entries', async () => {
      logger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM_EVENT,
        action: 'original',
        outcome: 'success',
      });

      // Tamper with log file
      const content = readFileSync(logger.getStats().currentLogFile, 'utf8');
      const event: AuditEvent = JSON.parse(content.trim());
      event.action = 'tampered'; // Modify action
      const tamperedContent = JSON.stringify(event) + '\n';
      const { writeFileSync } = await import('fs');
      writeFileSync(logger.getStats().currentLogFile, tamperedContent);

      const result = logger.verifyIntegrity();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Hash mismatch');
    });

    it('should detect broken hash chain', async () => {
      logger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM_EVENT,
        action: 'event1',
        outcome: 'success',
      });

      logger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM_EVENT,
        action: 'event2',
        outcome: 'success',
      });

      // Tamper with hash chain
      const content = readFileSync(logger.getStats().currentLogFile, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      const event2: AuditEvent = JSON.parse(lines[1]);
      event2.previousHash = 'wrong_hash';
      event2.hash = 'recalculated_wrong_hash';

      const tamperedContent = lines[0] + '\n' + JSON.stringify(event2) + '\n';
      const { writeFileSync } = await import('fs');
      writeFileSync(logger.getStats().currentLogFile, tamperedContent);

      const result = logger.verifyIntegrity();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Hash chain broken'))).toBe(true);
    });
  });

  // Enterprise features (critical event alerts) moved to @ax-cli/enterprise
  describe.skip('critical event alerts', () => {
    it('should trigger alert callback for critical events', () => {
      const alertCallback = vi.fn();
      logger.onCriticalEvent(alertCallback);

      logger.logCritical({
        category: AuditCategory.COMMAND_EXECUTION,
        action: 'shell_injection',
        outcome: 'failure',
      });

      expect(alertCallback).toHaveBeenCalledTimes(1);
      const event = alertCallback.mock.calls[0][0] as AuditEvent;
      expect(event.severity).toBe(AuditSeverity.CRITICAL);
      expect(event.action).toBe('shell_injection');
    });

    it('should not trigger alert for non-critical events', () => {
      const alertCallback = vi.fn();
      logger.onCriticalEvent(alertCallback);

      logger.logInfo({
        category: AuditCategory.SYSTEM_EVENT,
        action: 'normal_operation',
        outcome: 'success',
      });

      expect(alertCallback).not.toHaveBeenCalled();
    });

    it('should handle multiple alert callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      logger.onCriticalEvent(callback1);
      logger.onCriticalEvent(callback2);

      logger.logCritical({
        category: AuditCategory.COMMAND_EXECUTION,
        action: 'critical_event',
        outcome: 'failure',
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('log retention', () => {
    it('should clean up old log files', async () => {
      // Create logger with very short retention (1 day)
      AuditLogger.resetInstance();
      const shortRetentionLogger = AuditLogger.getInstance({
        logDirectory: testLogDir,
        retentionDays: 0, // Immediate cleanup for testing
      });

      // Log an event
      shortRetentionLogger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM_EVENT,
        action: 'test',
        outcome: 'success',
      });

      // Wait a bit to ensure file timestamp is old enough
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create a new logger instance which triggers cleanup
      AuditLogger.resetInstance();
      AuditLogger.getInstance({
        logDirectory: testLogDir,
        retentionDays: 0,
      });

      // Note: Cleanup runs async, so we can't reliably test file deletion
      // This test mainly ensures cleanup doesn't crash
    });
  });

  describe('log rotation', () => {
    it('should create daily log files', () => {
      const stats = logger.getStats();
      const today = new Date().toISOString().split('T')[0];

      expect(stats.currentLogFile).toContain(`audit-${today}.jsonl`);
    });
  });

  describe('getStats()', () => {
    it('should return correct statistics', () => {
      logger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM_EVENT,
        action: 'test1',
        outcome: 'success',
      });

      logger.log({
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM_EVENT,
        action: 'test2',
        outcome: 'success',
      });

      const stats = logger.getStats();

      expect(stats.totalEvents).toBe(2);
      expect(stats.logDirectory).toBe(testLogDir);
      expect(stats.retentionDays).toBe(7);
      expect(stats.currentLogFile).toBeTruthy();
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const logger1 = getAuditLogger();
      const logger2 = getAuditLogger();

      expect(logger1).toBe(logger2);
    });

    it('should allow reset for testing', () => {
      const logger1 = getAuditLogger();
      AuditLogger.resetInstance();
      const logger2 = getAuditLogger();

      expect(logger1).not.toBe(logger2);
    });
  });

  describe('all event categories', () => {
    it('should support all audit categories', () => {
      const categories = [
        AuditCategory.AUTHENTICATION,
        AuditCategory.AUTHORIZATION,
        AuditCategory.DATA_ACCESS,
        AuditCategory.DATA_MODIFICATION,
        AuditCategory.COMMAND_EXECUTION,
        AuditCategory.API_CALL,
        AuditCategory.RATE_LIMIT,
        AuditCategory.INPUT_VALIDATION,
        AuditCategory.ENCRYPTION,
        AuditCategory.MCP_OPERATION,
        AuditCategory.FILE_OPERATION,
        AuditCategory.SYSTEM_EVENT,
      ];

      for (const category of categories) {
        logger.log({
          severity: AuditSeverity.INFO,
          category,
          action: `test_${category}`,
          outcome: 'success',
        });
      }

      expect(logger.getStats().totalEvents).toBe(categories.length);
    });
  });
});
