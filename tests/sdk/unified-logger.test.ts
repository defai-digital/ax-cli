/**
 * Tests for sdk/unified-logger.ts
 * Tests the unified logging system for AX <-> ax-cli integration
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  UnifiedLogger,
  getUnifiedLogger,
  parseLogLevel,
  getLogLevelName,
  LogLevel,
  type LogEntry,
  type LogFilter,
} from '../../packages/core/src/sdk/unified-logger.js';

describe('UnifiedLogger', () => {
  beforeEach(() => {
    UnifiedLogger.reset();
    // Add error listener to prevent unhandled 'error' event exceptions
    // EventEmitter throws if 'error' event has no listener
    const logger = UnifiedLogger.getInstance();
    logger.on('error', () => {});
  });

  afterEach(() => {
    UnifiedLogger.reset();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = UnifiedLogger.getInstance();
      const instance2 = UnifiedLogger.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = UnifiedLogger.getInstance();
      UnifiedLogger.reset();
      const instance2 = UnifiedLogger.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('reset', () => {
    it('should clear logs', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('test', 'message');

      UnifiedLogger.reset();

      const newLogger = UnifiedLogger.getInstance();
      expect(newLogger.getLogs()).toHaveLength(0);
    });

    it('should remove all listeners', () => {
      const logger = UnifiedLogger.getInstance();
      const callback = vi.fn();
      logger.onLog(callback);

      UnifiedLogger.reset();

      const newLogger = UnifiedLogger.getInstance();
      newLogger.info('test', 'message');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('setMinLevel', () => {
    it('should filter logs below minimum level', () => {
      const logger = UnifiedLogger.getInstance();
      logger.setMinLevel(LogLevel.WARN);

      logger.debug('test', 'debug message');
      logger.info('test', 'info message');
      logger.warn('test', 'warn message');
      logger.error('test', 'error message');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe(LogLevel.WARN);
      expect(logs[1].level).toBe(LogLevel.ERROR);
    });
  });

  describe('setMaxLogSize', () => {
    it('should limit log entries', () => {
      const logger = UnifiedLogger.getInstance();
      logger.setMaxLogSize(150); // Must be >= 100 (minimum)

      for (let i = 0; i < 200; i++) {
        logger.info('test', `message ${i}`);
      }

      expect(logger.getLogs()).toHaveLength(150);
    });

    it('should enforce minimum of 100 entries', () => {
      const logger = UnifiedLogger.getInstance();
      logger.setMaxLogSize(10); // Will be clamped to 100

      for (let i = 0; i < 50; i++) {
        logger.info('test', `message ${i}`);
      }

      // Should have all 50 since minimum is 100
      expect(logger.getLogs()).toHaveLength(50);
    });

    it('should keep most recent logs', () => {
      const logger = UnifiedLogger.getInstance();
      logger.setMaxLogSize(100);

      for (let i = 0; i < 105; i++) {
        logger.info('test', `message ${i}`);
      }

      const logs = logger.getLogs();
      expect(logs).toHaveLength(100);
      expect(logs[0].message).toBe('message 5');
      expect(logs[99].message).toBe('message 104');
    });
  });

  describe('log', () => {
    it('should add log entry', () => {
      const logger = UnifiedLogger.getInstance();
      logger.log(LogLevel.INFO, 'test-source', 'Test message');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.INFO);
      expect(logs[0].source).toBe('test-source');
      expect(logs[0].message).toBe('Test message');
    });

    it('should include data', () => {
      const logger = UnifiedLogger.getInstance();
      logger.log(LogLevel.INFO, 'test', 'Message', { key: 'value' });

      const logs = logger.getLogs();
      expect(logs[0].data).toEqual({ key: 'value' });
    });

    it('should include error info', () => {
      const logger = UnifiedLogger.getInstance();
      const error = new Error('Test error');
      error.name = 'TestError';

      logger.log(LogLevel.ERROR, 'test', 'Error occurred', undefined, error);

      const logs = logger.getLogs();
      expect(logs[0].error?.message).toBe('Test error');
      expect(logs[0].error?.name).toBe('TestError');
      expect(logs[0].error?.stack).toBeDefined();
    });

    it('should clone data to prevent mutation', () => {
      const logger = UnifiedLogger.getInstance();
      const data = { key: 'original', nested: { value: 1 } };
      logger.log(LogLevel.INFO, 'test', 'Message', data);

      data.key = 'mutated';
      data.nested.value = 999;

      const logs = logger.getLogs();
      expect(logs[0].data).toEqual({ key: 'original', nested: { value: 1 } });
    });

    it('should emit log event', () => {
      const logger = UnifiedLogger.getInstance();
      const callback = vi.fn();
      logger.on('log', callback);

      logger.log(LogLevel.INFO, 'test', 'Message');

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.INFO,
        message: 'Message',
      }));
    });

    it('should emit level-specific event', () => {
      const logger = UnifiedLogger.getInstance();
      const infoCallback = vi.fn();
      const warnCallback = vi.fn();

      logger.on('info', infoCallback);
      logger.on('warn', warnCallback);

      logger.info('test', 'Info message');

      expect(infoCallback).toHaveBeenCalled();
      expect(warnCallback).not.toHaveBeenCalled();
    });

    it('should emit deep copies to prevent listener mutation', () => {
      const logger = UnifiedLogger.getInstance();
      let emittedEntry: LogEntry | null = null;

      logger.on('log', (entry) => {
        emittedEntry = entry;
        entry.message = 'mutated';
        if (entry.data) entry.data.key = 'mutated';
      });

      logger.log(LogLevel.INFO, 'test', 'Original', { key: 'original' });

      const logs = logger.getLogs();
      expect(logs[0].message).toBe('Original');
      expect(logs[0].data?.key).toBe('original');
    });
  });

  describe('debug', () => {
    it('should log debug message', () => {
      const logger = UnifiedLogger.getInstance();
      logger.debug('test', 'Debug message', { key: 'value' });

      const logs = logger.getLogs();
      expect(logs[0].level).toBe(LogLevel.DEBUG);
    });
  });

  describe('info', () => {
    it('should log info message', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('test', 'Info message');

      const logs = logger.getLogs();
      expect(logs[0].level).toBe(LogLevel.INFO);
    });
  });

  describe('warn', () => {
    it('should log warn message', () => {
      const logger = UnifiedLogger.getInstance();
      logger.warn('test', 'Warn message');

      const logs = logger.getLogs();
      expect(logs[0].level).toBe(LogLevel.WARN);
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      const logger = UnifiedLogger.getInstance();
      logger.error('test', 'Error message');

      const logs = logger.getLogs();
      expect(logs[0].level).toBe(LogLevel.ERROR);
    });

    it('should include error object', () => {
      const logger = UnifiedLogger.getInstance();
      const error = new Error('Test error');
      logger.error('test', 'Error occurred', error);

      const logs = logger.getLogs();
      expect(logs[0].error?.message).toBe('Test error');
    });

    it('should include both error and data', () => {
      const logger = UnifiedLogger.getInstance();
      const error = new Error('Test error');
      logger.error('test', 'Error occurred', error, { context: 'testing' });

      const logs = logger.getLogs();
      expect(logs[0].error?.message).toBe('Test error');
      expect(logs[0].data).toEqual({ context: 'testing' });
    });
  });

  describe('getLogs', () => {
    it('should return all logs without filter', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('source1', 'Message 1');
      logger.warn('source2', 'Message 2');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(2);
    });

    it('should filter by minimum level', () => {
      const logger = UnifiedLogger.getInstance();
      logger.debug('test', 'Debug');
      logger.info('test', 'Info');
      logger.warn('test', 'Warn');
      logger.error('test', 'Error');

      const logs = logger.getLogs({ minLevel: LogLevel.WARN });
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe(LogLevel.WARN);
      expect(logs[1].level).toBe(LogLevel.ERROR);
    });

    it('should filter by source string', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('source-a', 'Message A');
      logger.info('source-b', 'Message B');

      const logs = logger.getLogs({ source: 'source-a' });
      expect(logs).toHaveLength(1);
      expect(logs[0].source).toBe('source-a');
    });

    it('should filter by source regex', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('ax-agent-backend', 'Message 1');
      logger.info('ax-agent-frontend', 'Message 2');
      logger.info('ax-cli', 'Message 3');

      const logs = logger.getLogs({ source: /^ax-agent/ });
      expect(logs).toHaveLength(2);
    });

    it('should handle global regex correctly', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('test', 'Message 1');
      logger.info('test', 'Message 2');
      logger.info('test', 'Message 3');

      // Global regex can have stateful lastIndex issues
      const logs = logger.getLogs({ source: /test/g });
      expect(logs).toHaveLength(3);
    });

    it('should filter by time range (since)', () => {
      const logger = UnifiedLogger.getInstance();
      const now = Date.now();

      logger.info('test', 'Old message');

      // Simulate time passing
      vi.useFakeTimers();
      vi.setSystemTime(now + 1000);
      logger.info('test', 'New message');
      vi.useRealTimers();

      const logs = logger.getLogs({ since: now + 500 });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('New message');
    });

    it('should filter by time range (until)', () => {
      const logger = UnifiedLogger.getInstance();

      vi.useFakeTimers();
      vi.setSystemTime(1000);
      logger.info('test', 'Old message');

      vi.setSystemTime(2000);
      logger.info('test', 'New message');
      vi.useRealTimers();

      const logs = logger.getLogs({ until: 1500 });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Old message');
    });

    it('should return deep copies', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('test', 'Message', { key: 'original' });

      const logs1 = logger.getLogs();
      const logs2 = logger.getLogs();

      expect(logs1[0]).not.toBe(logs2[0]);
      expect(logs1[0].data).not.toBe(logs2[0].data);
    });
  });

  describe('getRecentLogs', () => {
    it('should return last N logs', () => {
      const logger = UnifiedLogger.getInstance();
      for (let i = 0; i < 10; i++) {
        logger.info('test', `Message ${i}`);
      }

      const logs = logger.getRecentLogs(3);
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('Message 7');
      expect(logs[2].message).toBe('Message 9');
    });

    it('should apply filter before selecting recent', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('source-a', 'A1');
      logger.info('source-b', 'B1');
      logger.info('source-a', 'A2');
      logger.info('source-b', 'B2');

      const logs = logger.getRecentLogs(1, { source: 'source-a' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('A2');
    });

    it('should handle invalid count', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('test', 'Message');

      expect(logger.getRecentLogs(0)).toHaveLength(0);
      expect(logger.getRecentLogs(-1)).toHaveLength(0);
      expect(logger.getRecentLogs(NaN)).toHaveLength(0);
      expect(logger.getRecentLogs(Infinity)).toHaveLength(0);
    });

    it('should floor fractional counts', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('test', 'M1');
      logger.info('test', 'M2');
      logger.info('test', 'M3');

      const logs = logger.getRecentLogs(2.7);
      expect(logs).toHaveLength(2);
    });
  });

  describe('onLog', () => {
    it('should subscribe to all log events', () => {
      const logger = UnifiedLogger.getInstance();
      const callback = vi.fn();

      logger.onLog(callback);
      logger.info('test', 'Message');
      logger.warn('test', 'Warning');

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should return unsubscribe function', () => {
      const logger = UnifiedLogger.getInstance();
      const callback = vi.fn();

      const unsubscribe = logger.onLog(callback);
      logger.info('test', 'Message 1');

      unsubscribe();
      logger.info('test', 'Message 2');

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('onLevel', () => {
    it('should subscribe to specific level', () => {
      const logger = UnifiedLogger.getInstance();
      const callback = vi.fn();

      logger.onLevel(LogLevel.ERROR, callback);
      logger.info('test', 'Info');
      logger.error('test', 'Error');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const logger = UnifiedLogger.getInstance();
      const callback = vi.fn();

      const unsubscribe = logger.onLevel(LogLevel.WARN, callback);
      logger.warn('test', 'Warning 1');

      unsubscribe();
      logger.warn('test', 'Warning 2');

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('should remove all logs', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('test', 'Message 1');
      logger.info('test', 'Message 2');

      logger.clear();

      expect(logger.getLogs()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return log statistics', () => {
      const logger = UnifiedLogger.getInstance();
      logger.debug('source1', 'Debug');
      logger.info('source1', 'Info');
      logger.warn('source2', 'Warn');
      logger.error('source2', 'Error');

      const stats = logger.getStats();

      expect(stats.total).toBe(4);
      expect(stats.byLevel.DEBUG).toBe(1);
      expect(stats.byLevel.INFO).toBe(1);
      expect(stats.byLevel.WARN).toBe(1);
      expect(stats.byLevel.ERROR).toBe(1);
      expect(stats.bySources.source1).toBe(2);
      expect(stats.bySources.source2).toBe(2);
    });

    it('should include timestamps', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('test', 'Message');

      const stats = logger.getStats();

      expect(stats.oldestTimestamp).toBeDefined();
      expect(stats.newestTimestamp).toBeDefined();
    });

    it('should handle empty logs', () => {
      const logger = UnifiedLogger.getInstance();
      const stats = logger.getStats();

      expect(stats.total).toBe(0);
      expect(stats.oldestTimestamp).toBeUndefined();
      expect(stats.newestTimestamp).toBeUndefined();
    });
  });

  describe('format', () => {
    it('should format log entry with all parts', () => {
      const logger = UnifiedLogger.getInstance();
      const entry: LogEntry = {
        timestamp: new Date('2024-01-15T10:30:00Z').getTime(),
        level: LogLevel.INFO,
        source: 'test-source',
        message: 'Test message',
      };

      const formatted = logger.format(entry);

      expect(formatted).toContain('[INFO ]');
      expect(formatted).toContain('[test-source]');
      expect(formatted).toContain('Test message');
    });

    it('should include data', () => {
      const logger = UnifiedLogger.getInstance();
      const entry: LogEntry = {
        timestamp: Date.now(),
        level: LogLevel.INFO,
        source: 'test',
        message: 'Message',
        data: { key: 'value' },
      };

      const formatted = logger.format(entry);

      expect(formatted).toContain('{"key":"value"}');
    });

    it('should include error', () => {
      const logger = UnifiedLogger.getInstance();
      const entry: LogEntry = {
        timestamp: Date.now(),
        level: LogLevel.ERROR,
        source: 'test',
        message: 'Error occurred',
        error: {
          message: 'Test error',
          stack: 'Error: Test error\n    at test.js:1:1',
        },
      };

      const formatted = logger.format(entry);

      expect(formatted).toContain('Error: Test error');
      expect(formatted).toContain('at test.js:1:1');
    });

    it('should respect includeTimestamp option', () => {
      const logger = UnifiedLogger.getInstance();
      const entry: LogEntry = {
        timestamp: Date.now(),
        level: LogLevel.INFO,
        source: 'test',
        message: 'Message',
      };

      const withTimestamp = logger.format(entry, { includeTimestamp: true });
      const withoutTimestamp = logger.format(entry, { includeTimestamp: false });

      expect(withTimestamp).toContain('[20');
      expect(withoutTimestamp).not.toContain('[20');
    });

    it('should respect includeSource option', () => {
      const logger = UnifiedLogger.getInstance();
      const entry: LogEntry = {
        timestamp: Date.now(),
        level: LogLevel.INFO,
        source: 'my-source',
        message: 'Message',
      };

      const withSource = logger.format(entry, { includeSource: true });
      const withoutSource = logger.format(entry, { includeSource: false });

      expect(withSource).toContain('[my-source]');
      expect(withoutSource).not.toContain('[my-source]');
    });
  });

  describe('exportJSON', () => {
    it('should export logs as JSON', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('test', 'Message');

      const json = logger.exportJSON();
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].message).toBe('Message');
    });

    it('should apply filter', () => {
      const logger = UnifiedLogger.getInstance();

      logger.info('test', 'Info');
      logger.error('test', 'Error');

      const json = logger.exportJSON({ minLevel: LogLevel.ERROR });
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].level).toBe(LogLevel.ERROR);
    });
  });

  describe('exportText', () => {
    it('should export logs as text', () => {
      const logger = UnifiedLogger.getInstance();
      logger.info('test', 'Message 1');
      logger.info('test', 'Message 2');

      const text = logger.exportText();

      expect(text).toContain('Message 1');
      expect(text).toContain('Message 2');
      expect(text.split('\n')).toHaveLength(2);
    });

    it('should apply filter and options', () => {
      const logger = UnifiedLogger.getInstance();

      logger.info('test', 'Info');
      logger.error('test', 'Error');

      const text = logger.exportText(
        { minLevel: LogLevel.ERROR },
        { includeTimestamp: false }
      );

      expect(text).toContain('Error');
      expect(text).not.toContain('Info');
    });
  });

  describe('destroy', () => {
    it('should remove all listeners', () => {
      const logger = UnifiedLogger.getInstance();
      const callback = vi.fn();
      logger.onLog(callback);

      logger.destroy();
      logger.info('test', 'Message');

      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('getUnifiedLogger', () => {
  beforeEach(() => {
    UnifiedLogger.reset();
  });

  afterEach(() => {
    UnifiedLogger.reset();
  });

  it('should return singleton instance', () => {
    const logger = getUnifiedLogger();
    expect(logger).toBe(UnifiedLogger.getInstance());
  });
});

describe('parseLogLevel', () => {
  it('should parse DEBUG', () => {
    expect(parseLogLevel('debug')).toBe(LogLevel.DEBUG);
    expect(parseLogLevel('DEBUG')).toBe(LogLevel.DEBUG);
    expect(parseLogLevel('Debug')).toBe(LogLevel.DEBUG);
  });

  it('should parse INFO', () => {
    expect(parseLogLevel('info')).toBe(LogLevel.INFO);
    expect(parseLogLevel('INFO')).toBe(LogLevel.INFO);
  });

  it('should parse WARN', () => {
    expect(parseLogLevel('warn')).toBe(LogLevel.WARN);
    expect(parseLogLevel('warning')).toBe(LogLevel.WARN);
    expect(parseLogLevel('WARN')).toBe(LogLevel.WARN);
    expect(parseLogLevel('WARNING')).toBe(LogLevel.WARN);
  });

  it('should parse ERROR', () => {
    expect(parseLogLevel('error')).toBe(LogLevel.ERROR);
    expect(parseLogLevel('ERROR')).toBe(LogLevel.ERROR);
  });

  it('should default to INFO for unknown', () => {
    expect(parseLogLevel('unknown')).toBe(LogLevel.INFO);
    expect(parseLogLevel('')).toBe(LogLevel.INFO);
  });
});

describe('getLogLevelName', () => {
  it('should return level names', () => {
    expect(getLogLevelName(LogLevel.DEBUG)).toBe('DEBUG');
    expect(getLogLevelName(LogLevel.INFO)).toBe('INFO');
    expect(getLogLevelName(LogLevel.WARN)).toBe('WARN');
    expect(getLogLevelName(LogLevel.ERROR)).toBe('ERROR');
  });
});
