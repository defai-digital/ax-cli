/**
 * Tests for Error Sanitization (REQ-SEC-010)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { homedir } from 'os';
import {
  sanitizeErrorMessage,
  sanitizeStackTrace,
  removeStackTrace,
  sanitizeError,
  formatUserError,
  createInternalLogMessage,
  safeExecute,
  ErrorCategory,
} from '../../src/utils/error-sanitizer.js';
import { AuditLogger } from '../../src/utils/audit-logger.js';

describe('Error Sanitization (REQ-SEC-010)', () => {
  beforeEach(() => {
    AuditLogger.resetInstance();
  });

  afterEach(() => {
    AuditLogger.resetInstance();
  });

  describe('sanitizeErrorMessage', () => {
    it('should remove file paths (Unix)', () => {
      const message = 'Error reading /home/user/secret/file.txt';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe('Error reading [REDACTED_PATH]');
      expect(sanitized).not.toContain('/home/user');
    });

    it('should remove file paths (Windows)', () => {
      const message = 'Error reading C:\\Users\\John\\secret\\file.txt';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe('Error reading [REDACTED_PATH]');
      expect(sanitized).not.toContain('C:\\Users');
    });

    it('should remove API keys', () => {
      const message = 'API error: api_key=sk_test_1234567890abcdef';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toContain('[REDACTED_KEY]');
      expect(sanitized).not.toContain('sk_test_1234567890abcdef');
    });

    it('should remove secrets', () => {
      const message = 'Auth failed: secret: mySecretPassword123456';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toContain('[REDACTED_KEY]');
      expect(sanitized).not.toContain('mySecretPassword123456');
    });

    it('should remove IP addresses', () => {
      const message = 'Connection failed to 192.168.1.100';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe('Connection failed to [REDACTED_IP]');
      expect(sanitized).not.toContain('192.168.1.100');
    });

    it('should remove URLs with credentials', () => {
      const message = 'Failed to fetch https://user:pass@api.example.com/data';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe('Failed to fetch [REDACTED_URL]');
      expect(sanitized).not.toContain('user:pass');
    });

    it('should remove environment variables', () => {
      const message = 'Missing $HOME or ${API_KEY}';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe('Missing [REDACTED_ENV] or [REDACTED_ENV]');
      expect(sanitized).not.toContain('$HOME');
    });

    it('should replace home directory', () => {
      const homeDir = homedir();
      const message = `Error reading ${homeDir}/config.json`;
      const sanitized = sanitizeErrorMessage(message);

      // Home directory is replaced, but FILE_PATH pattern may also match the remaining path
      expect(sanitized).toContain('[USER_HOME]');
      expect(sanitized).not.toContain(homeDir);
    });

    it('should handle multiple sensitive patterns', () => {
      const message = 'Failed to connect to 10.0.0.1 using API key: sk_test_abcd1234567890';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).not.toContain('10.0.0.1');
      expect(sanitized).not.toContain('sk_test_abcd1234567890');
      expect(sanitized).toContain('[REDACTED_IP]');
      expect(sanitized).toContain('[REDACTED_KEY]');
    });

    it('should preserve safe error messages', () => {
      const message = 'Connection timeout after 30 seconds';
      const sanitized = sanitizeErrorMessage(message);

      expect(sanitized).toBe(message);
    });
  });

  describe('sanitizeStackTrace', () => {
    it('should remove file paths from stack traces', () => {
      const stack = `Error: Test error
    at Object.<anonymous> (/home/user/project/src/index.ts:10:15)
    at Module._compile (node:internal/modules/cjs/loader:1358:14)`;

      const sanitized = sanitizeStackTrace(stack);

      expect(sanitized).not.toContain('/home/user/project');
      expect(sanitized).toContain('[REDACTED_PATH]');
    });

    it('should replace home directory in stack traces', () => {
      const homeDir = homedir();
      const stack = `Error: Test\n    at ${homeDir}/project/src/file.ts:10:15`;

      const sanitized = sanitizeStackTrace(stack);

      expect(sanitized).not.toContain(homeDir);
      expect(sanitized).toContain('[USER_HOME]');
    });
  });

  describe('removeStackTrace', () => {
    it('should remove stack trace from error message', () => {
      const message = `Error: Something went wrong
    at functionName (/path/to/file.js:10:5)
    at anotherFunction (/path/to/other.js:20:10)`;

      const result = removeStackTrace(message);

      expect(result).toBe('Error: Something went wrong');
      expect(result).not.toContain('at functionName');
    });

    it('should handle messages without stack traces', () => {
      const message = 'Simple error message';
      const result = removeStackTrace(message);

      expect(result).toBe(message);
    });
  });

  describe('sanitizeError', () => {
    it('should categorize network errors', () => {
      const error = new Error('fetch failed: ENOTFOUND api.example.com');
      const sanitized = sanitizeError(error);

      expect(sanitized.category).toBe(ErrorCategory.NETWORK);
      expect(sanitized.code).toBe('ERR_NETWORK');
      expect(sanitized.suggestion).toContain('network connection');
    });

    it('should categorize file system errors', () => {
      const error = new Error('ENOENT: no such file or directory');
      const sanitized = sanitizeError(error);

      expect(sanitized.category).toBe(ErrorCategory.FILE_SYSTEM);
      expect(sanitized.code).toBe('ERR_FILE_SYSTEM');
      expect(sanitized.suggestion).toContain('file exists');
    });

    it('should categorize validation errors', () => {
      const error = new Error('Validation failed: required field missing');
      const sanitized = sanitizeError(error);

      expect(sanitized.category).toBe(ErrorCategory.VALIDATION);
      expect(sanitized.code).toBe('ERR_VALIDATION');
      expect(sanitized.suggestion).toContain('input');
    });

    it('should categorize authentication errors', () => {
      const error = new Error('Unauthorized: Invalid API key');
      const sanitized = sanitizeError(error);

      expect(sanitized.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(sanitized.code).toBe('ERR_AUTH');
      expect(sanitized.suggestion).toContain('API key');
    });

    it('should categorize rate limit errors', () => {
      const error = new Error('Rate limit exceeded: too many requests');
      const sanitized = sanitizeError(error);

      expect(sanitized.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(sanitized.code).toBe('ERR_RATE_LIMIT');
      expect(sanitized.suggestion).toContain('wait');
    });

    it('should categorize API errors', () => {
      const error = new Error('API error: status code 500');
      const sanitized = sanitizeError(error);

      expect(sanitized.category).toBe(ErrorCategory.API_ERROR);
      expect(sanitized.code).toBe('ERR_API');
      expect(sanitized.suggestion).toContain('API');
    });

    it('should sanitize error message', () => {
      const error = new Error('Error reading /home/user/secret.txt with API key sk_test_1234567890abcdef');
      const sanitized = sanitizeError(error);

      expect(sanitized.message).not.toContain('/home/user');
      expect(sanitized.message).not.toContain('sk_test_1234567890abcdef');
    });

    it('should preserve original error', () => {
      const error = new Error('Test error');
      const sanitized = sanitizeError(error);

      expect(sanitized.originalError).toBe(error);
    });

    it('should handle non-Error objects', () => {
      const sanitized = sanitizeError('String error');

      expect(sanitized.message).toBe('String error');
      expect(sanitized.category).toBe(ErrorCategory.INTERNAL);
    });
  });

  describe('formatUserError', () => {
    it('should format error with code and suggestion', () => {
      const sanitized = {
        message: 'Connection failed',
        code: 'ERR_NETWORK',
        category: ErrorCategory.NETWORK,
        suggestion: 'Check your network connection',
      };

      const formatted = formatUserError(sanitized);

      expect(formatted).toContain('[ERR_NETWORK]');
      expect(formatted).toContain('Connection failed');
      expect(formatted).toContain('Check your network connection');
    });

    it('should format error without code', () => {
      const sanitized = {
        message: 'Something went wrong',
        category: ErrorCategory.INTERNAL,
      };

      const formatted = formatUserError(sanitized);

      expect(formatted).toBe('Something went wrong');
    });

    it('should format error without suggestion', () => {
      const sanitized = {
        message: 'Error occurred',
        code: 'ERR_UNKNOWN',
        category: ErrorCategory.INTERNAL,
      };

      const formatted = formatUserError(sanitized);

      expect(formatted).toBe('[ERR_UNKNOWN] Error occurred');
    });
  });

  describe('createInternalLogMessage', () => {
    it('should create detailed log message with stack', () => {
      const error = new Error('Test error');
      const log = createInternalLogMessage(error);

      expect(log).toContain('Error: Test error');
      expect(log).toContain('Stack:');
    });

    it('should include context in log', () => {
      const error = new Error('Test error');
      const context = { userId: '123', action: 'test' };
      const log = createInternalLogMessage(error, context);

      expect(log).toContain('Context:');
      expect(log).toContain('"userId": "123"');
      expect(log).toContain('"action": "test"');
    });

    it('should sanitize stack trace in log', () => {
      const homeDir = homedir();
      const error = new Error('Test error');
      const log = createInternalLogMessage(error);

      expect(log).not.toContain(homeDir);
    });
  });

  describe('safeExecute', () => {
    it('should return success result', async () => {
      const operation = async () => 'success';
      const result = await safeExecute(operation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('success');
      }
    });

    it('should return sanitized error on failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const operation = async () => {
        throw new Error('Operation failed with API key sk_test_1234567890abcdef');
      };

      const result = await safeExecute(operation);

      expect(result.success).toBe(false);
      if (!result.success) {
        // User-facing error should be sanitized
        expect(result.error.message).not.toContain('sk_test_1234567890abcdef');
        expect(result.error.message).toContain('[REDACTED_KEY]');
      }

      consoleErrorSpy.mockRestore();
    });

    it('should call error handler on failure', async () => {
      const operation = async () => {
        throw new Error('Test error');
      };

      let handlerCalled = false;
      const handler = () => {
        handlerCalled = true;
      };

      await safeExecute(operation, handler);

      expect(handlerCalled).toBe(true);
    });

    it('should log to console if no error handler provided', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const operation = async () => {
        throw new Error('Test error');
      };

      await safeExecute(operation);

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Audit Logging Integration', () => {
    it('should log when sensitive data is detected', async () => {
      const logger = AuditLogger.getInstance({
        logDirectory: '/tmp/ax-cli-test-error-sanitizer',
      });

      const logSpy = vi.spyOn(logger, 'logWarning');

      const error = new Error('Error with /home/user/secret.txt');
      sanitizeError(error);

      expect(logSpy).toHaveBeenCalledWith({
        category: expect.any(String),
        action: 'sensitive_data_in_error',
        outcome: 'success',
        details: expect.objectContaining({
          sanitized: true,
        }),
      });

      logSpy.mockRestore();
    });

    it('should not log when no sensitive data detected', async () => {
      const logger = AuditLogger.getInstance({
        logDirectory: '/tmp/ax-cli-test-error-sanitizer',
      });

      const logSpy = vi.spyOn(logger, 'logWarning');

      const error = new Error('Simple error message');
      sanitizeError(error);

      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });
});
