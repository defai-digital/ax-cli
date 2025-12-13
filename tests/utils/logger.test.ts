/**
 * Tests for utils/logger.ts
 * Tests the Logger singleton and logging functionality
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogLevel, getLogger, logger } from '../../packages/core/src/utils/logger.js';

describe('Logger', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on console methods
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset logger to INFO level
    logger.setLevel(LogLevel.INFO);
    logger.setJsonOutput(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LogLevel enum', () => {
    it('should have correct values', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
      expect(LogLevel.SILENT).toBe(4);
    });
  });

  describe('singleton', () => {
    it('should return same instance via getLogger', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
    });

    it('should export logger as singleton', () => {
      expect(logger).toBe(getLogger());
    });
  });

  describe('setLevel and getLevel', () => {
    it('should set and get log level', () => {
      logger.setLevel(LogLevel.DEBUG);
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);

      logger.setLevel(LogLevel.ERROR);
      expect(logger.getLevel()).toBe(LogLevel.ERROR);
    });
  });

  describe('setJsonOutput', () => {
    it('should enable JSON output', () => {
      logger.setJsonOutput(true);
      logger.info('test message');

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      expect(() => JSON.parse(call)).not.toThrow();

      const parsed = JSON.parse(call);
      expect(parsed.message).toBe('test message');
      expect(parsed.level).toBe('INFO');
    });

    it('should disable JSON output', () => {
      logger.setJsonOutput(false);
      logger.info('test message');

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      expect(call).toContain('[INFO]');
      expect(call).toContain('test message');
    });
  });

  describe('isLevelEnabled', () => {
    it('should return true for enabled levels', () => {
      logger.setLevel(LogLevel.INFO);

      expect(logger.isLevelEnabled(LogLevel.INFO)).toBe(true);
      expect(logger.isLevelEnabled(LogLevel.WARN)).toBe(true);
      expect(logger.isLevelEnabled(LogLevel.ERROR)).toBe(true);
    });

    it('should return false for disabled levels', () => {
      logger.setLevel(LogLevel.WARN);

      expect(logger.isLevelEnabled(LogLevel.DEBUG)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.INFO)).toBe(false);
    });

    it('should handle DEBUG level', () => {
      logger.setLevel(LogLevel.DEBUG);

      expect(logger.isLevelEnabled(LogLevel.DEBUG)).toBe(true);
      expect(logger.isLevelEnabled(LogLevel.INFO)).toBe(true);
    });

    it('should handle SILENT level', () => {
      logger.setLevel(LogLevel.SILENT);

      expect(logger.isLevelEnabled(LogLevel.DEBUG)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.INFO)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.WARN)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.ERROR)).toBe(false);
    });
  });

  describe('debug', () => {
    it('should log debug messages when level is DEBUG', () => {
      logger.setLevel(LogLevel.DEBUG);
      logger.debug('debug message');

      expect(consoleDebugSpy).toHaveBeenCalled();
      const call = consoleDebugSpy.mock.calls[0][0] as string;
      expect(call).toContain('[DEBUG]');
      expect(call).toContain('debug message');
    });

    it('should not log debug messages when level is INFO', () => {
      logger.setLevel(LogLevel.INFO);
      logger.debug('debug message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should include context in debug messages', () => {
      logger.setLevel(LogLevel.DEBUG);
      logger.debug('debug message', { key: 'value' });

      const call = consoleDebugSpy.mock.calls[0][0] as string;
      expect(call).toContain('key');
      expect(call).toContain('value');
    });
  });

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('info message');

      expect(consoleInfoSpy).toHaveBeenCalled();
      const call = consoleInfoSpy.mock.calls[0][0] as string;
      expect(call).toContain('[INFO]');
      expect(call).toContain('info message');
    });

    it('should not log info when level is WARN', () => {
      logger.setLevel(LogLevel.WARN);
      logger.info('info message');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it('should include context in info messages', () => {
      logger.info('info message', { count: 42 });

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      expect(call).toContain('count');
      expect(call).toContain('42');
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      logger.warn('warning message');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const call = consoleWarnSpy.mock.calls[0][0] as string;
      expect(call).toContain('[WARN]');
      expect(call).toContain('warning message');
    });

    it('should not log warn when level is ERROR', () => {
      logger.setLevel(LogLevel.ERROR);
      logger.warn('warning message');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should include context in warning messages', () => {
      logger.warn('warning message', { severity: 'medium' });

      const call = consoleWarnSpy.mock.calls[0][0] as string;
      expect(call).toContain('severity');
      expect(call).toContain('medium');
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      logger.error('error message');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0][0] as string;
      expect(call).toContain('[ERROR]');
      expect(call).toContain('error message');
    });

    it('should log error even when level is ERROR', () => {
      logger.setLevel(LogLevel.ERROR);
      logger.error('error message');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should not log error when level is SILENT', () => {
      logger.setLevel(LogLevel.SILENT);
      logger.error('error message');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should include context in error messages', () => {
      logger.error('error message', { code: 'E001' });

      const call = consoleErrorSpy.mock.calls[0][0] as string;
      expect(call).toContain('code');
      expect(call).toContain('E001');
    });
  });

  describe('errorWithStack', () => {
    it('should log error with Error object stack trace', () => {
      const error = new Error('test error');
      logger.errorWithStack('Operation failed', error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0][0] as string;
      expect(call).toContain('[ERROR]');
      expect(call).toContain('Operation failed');
      expect(call).toContain('test error');
      expect(call).toContain('errorMessage');
      expect(call).toContain('errorName');
    });

    it('should handle non-Error objects', () => {
      logger.errorWithStack('Operation failed', 'string error');

      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0][0] as string;
      expect(call).toContain('Operation failed');
      expect(call).toContain('string error');
    });

    it('should include additional context', () => {
      const error = new Error('test error');
      logger.errorWithStack('Operation failed', error, { operation: 'save' });

      const call = consoleErrorSpy.mock.calls[0][0] as string;
      expect(call).toContain('operation');
      expect(call).toContain('save');
    });

    it('should include stack trace when available', () => {
      const error = new Error('test error');
      logger.errorWithStack('Operation failed', error);

      const call = consoleErrorSpy.mock.calls[0][0] as string;
      expect(call).toContain('stack');
    });
  });

  describe('JSON output format', () => {
    beforeEach(() => {
      logger.setJsonOutput(true);
    });

    it('should output valid JSON for all log levels', () => {
      logger.setLevel(LogLevel.DEBUG);

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      const debugCall = consoleDebugSpy.mock.calls[0][0] as string;
      const infoCall = consoleInfoSpy.mock.calls[0][0] as string;
      const warnCall = consoleWarnSpy.mock.calls[0][0] as string;
      const errorCall = consoleErrorSpy.mock.calls[0][0] as string;

      expect(() => JSON.parse(debugCall)).not.toThrow();
      expect(() => JSON.parse(infoCall)).not.toThrow();
      expect(() => JSON.parse(warnCall)).not.toThrow();
      expect(() => JSON.parse(errorCall)).not.toThrow();
    });

    it('should include timestamp in JSON output', () => {
      logger.info('test');

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(call);

      expect(parsed.timestamp).toBeDefined();
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    });

    it('should include level name in JSON output', () => {
      logger.info('test');

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(call);

      expect(parsed.level).toBe('INFO');
    });

    it('should include context in JSON output', () => {
      logger.info('test', { foo: 'bar', num: 123 });

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(call);

      expect(parsed.context.foo).toBe('bar');
      expect(parsed.context.num).toBe(123);
    });
  });

  describe('text output format', () => {
    beforeEach(() => {
      logger.setJsonOutput(false);
    });

    it('should format with level prefix', () => {
      logger.setLevel(LogLevel.DEBUG);

      logger.debug('test');
      logger.info('test');
      logger.warn('test');
      logger.error('test');

      expect((consoleDebugSpy.mock.calls[0][0] as string).startsWith('[DEBUG]')).toBe(true);
      expect((consoleInfoSpy.mock.calls[0][0] as string).startsWith('[INFO]')).toBe(true);
      expect((consoleWarnSpy.mock.calls[0][0] as string).startsWith('[WARN]')).toBe(true);
      expect((consoleErrorSpy.mock.calls[0][0] as string).startsWith('[ERROR]')).toBe(true);
    });

    it('should include context as JSON string', () => {
      logger.info('test', { key: 'value' });

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      expect(call).toContain('{"key":"value"}');
    });

    it('should not include context when not provided', () => {
      logger.info('test');

      const call = consoleInfoSpy.mock.calls[0][0] as string;
      expect(call).toBe('[INFO] test');
    });
  });
});
