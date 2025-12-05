/**
 * Tests for enhanced error messages
 * Phase 5: Error Message Improvements
 */

import { describe, it, expect } from 'vitest';
import {
  formatEnhancedError,
  createFriendlyError,
  FriendlyErrors,
} from '../../src/utils/enhanced-error-messages.js';
import { ErrorCategory } from '../../src/utils/error-handler.js';

describe('Enhanced Error Messages', () => {
  describe('formatEnhancedError', () => {
    it('should format file not found error with suggestions', () => {
      const error = formatEnhancedError(
        ErrorCategory.FILE_OPERATION,
        'Read file',
        'ENOENT: no such file or directory',
        { filePath: '/path/to/file.txt' }
      );

      expect(error).toContain('📁'); // File icon
      expect(error).toContain('File or Directory Not Found');
      expect(error).toContain('File: /path/to/file.txt');
      expect(error).toContain('💡 How to fix:');
      expect(error).toContain('Check if the file path is correct');
      expect(error).toContain('Verify the file exists using: ls');
    });

    it('should format permission denied error', () => {
      const error = formatEnhancedError(
        ErrorCategory.FILE_OPERATION,
        'Write file',
        'EACCES: permission denied',
        { filePath: '/protected/file.txt' }
      );

      expect(error).toContain('📁'); // File icon
      expect(error).toContain('Permission Denied');
      expect(error).toContain('File: /protected/file.txt');
      expect(error).toContain('Check file permissions using: ls -la');
    });

    it('should format API 401 error with learn more link', () => {
      const error = formatEnhancedError(
        ErrorCategory.API_ERROR,
        'API request',
        'Unauthorized',
        { statusCode: 401 }
      );

      expect(error).toContain('🔑'); // Key icon
      expect(error).toContain('Authentication Failed');
      expect(error).toContain('ax-cli setup'); // Updated to use ax-cli command
      expect(error).toContain('📚 Learn more:');
    });

    it('should format rate limit error', () => {
      const error = formatEnhancedError(
        ErrorCategory.RATE_LIMIT,
        'API request',
        'Too many requests',
        { statusCode: 429 }
      );

      expect(error).toContain('⏱️'); // Timer icon
      expect(error).toContain('Rate Limit Exceeded');
      expect(error).toContain('Wait a few minutes before retrying');
    });

    it('should format MCP connection error', () => {
      const error = formatEnhancedError(
        ErrorCategory.MCP_CONNECTION,
        'Connect to server',
        'Connection failed',
        { details: 'Server not responding' }
      );

      expect(error).toContain('🔌'); // Plug icon
      expect(error).toContain('MCP Server Connection Failed');
      expect(error).toContain('ax-cli mcp'); // Updated to use ax-cli mcp commands
    });

    it('should format bash command not found error', () => {
      const error = formatEnhancedError(
        ErrorCategory.BASH_COMMAND,
        'Execute command',
        'command not found: foobar',
        { details: 'Command "foobar" is not available' }
      );

      expect(error).toContain('⚡'); // Bolt icon
      expect(error).toContain('Command Not Found');
      expect(error).toContain('Install the required command');
    });

    it('should fall back to standard format for unknown errors', () => {
      const error = formatEnhancedError(
        ErrorCategory.VALIDATION,
        'Validate input',
        'Some random error',
        {}
      );

      // Should still have category in brackets
      expect(error).toContain('[Validation]');
      expect(error).toContain('failed');
    });
  });

  describe('createFriendlyError', () => {
    it('should handle Error objects', () => {
      const err = new Error('ENOENT: no such file');
      const result = createFriendlyError(
        ErrorCategory.FILE_OPERATION,
        'Read file',
        err,
        { filePath: '/test/file.txt' }
      );

      expect(result).toContain('File or Directory Not Found');
      expect(result).toContain('/test/file.txt');
    });

    it('should handle error objects with status codes', () => {
      const err = {
        message: 'Unauthorized',
        status: 401,
      };
      const result = createFriendlyError(
        ErrorCategory.API_ERROR,
        'API request',
        err
      );

      expect(result).toContain('Authentication Failed');
      expect(result).toContain('API key');
    });

    it('should handle string errors', () => {
      const result = createFriendlyError(
        ErrorCategory.BASH_COMMAND,
        'Execute',
        'command not found: git'
      );

      expect(result).toContain('Command Not Found');
    });

    it('should handle unknown error types', () => {
      const result = createFriendlyError(
        ErrorCategory.TIMEOUT,
        'Wait for response',
        { weird: 'object' }
      );

      expect(result).toContain('Wait for response');
    });
  });

  describe('FriendlyErrors helpers', () => {
    it('should create file not found error', () => {
      const error = FriendlyErrors.fileNotFound('/missing/file.txt');

      expect(error).toContain('File or Directory Not Found');
      expect(error).toContain('/missing/file.txt');
      expect(error).toContain('Check if the file path is correct');
    });

    it('should create permission denied error', () => {
      const error = FriendlyErrors.permissionDenied('/protected/file.txt');

      expect(error).toContain('Permission Denied');
      expect(error).toContain('/protected/file.txt');
      expect(error).toContain('Check file permissions');
    });

    it('should create API key invalid error', () => {
      const error = FriendlyErrors.apiKeyInvalid();

      expect(error).toContain('Authentication Failed');
      expect(error).toContain('API key');
      expect(error).toContain('ax-cli setup');
    });

    it('should create rate limit error', () => {
      const error = FriendlyErrors.rateLimitExceeded();

      expect(error).toContain('Rate Limit Exceeded');
      expect(error).toContain('Wait a few minutes');
    });

    it('should create MCP connection error', () => {
      const error = FriendlyErrors.mcpConnectionFailed('test-server');

      expect(error).toContain('MCP Server Connection Failed');
      expect(error).toContain('test-server');
    });

    it('should create command not found error', () => {
      const error = FriendlyErrors.commandNotFound('git');

      expect(error).toContain('Command Not Found');
      expect(error).toContain('git');
    });
  });

  describe('Error message structure', () => {
    it('should include all required sections', () => {
      const error = formatEnhancedError(
        ErrorCategory.FILE_OPERATION,
        'Read file',
        'ENOENT',
        {
          filePath: '/test/file.txt',
          details: 'Additional context',
        }
      );

      // Should have icon
      expect(error).toMatch(/^📁/);

      // Should have title
      expect(error).toContain('File or Directory Not Found');

      // Should have operation
      expect(error).toContain('Operation: Read file');

      // Should have file path
      expect(error).toContain('File: /test/file.txt');

      // Should have description
      expect(error).toContain('The specified path does not exist');

      // Should have details
      expect(error).toContain('Details: Additional context');

      // Should have suggestions
      expect(error).toContain('💡 How to fix:');
      expect(error).toContain('1.');
      expect(error).toContain('2.');
    });

    it('should number suggestions correctly', () => {
      const error = formatEnhancedError(
        ErrorCategory.FILE_OPERATION,
        'Read file',
        'EACCES',
        { filePath: '/test/file.txt' }
      );

      expect(error).toContain('1. Check file permissions');
      expect(error).toContain('2. Ensure you have read/write access');
      expect(error).toContain('3.');
      expect(error).toContain('4.');
    });

    it('should format multiline error messages nicely', () => {
      const error = formatEnhancedError(
        ErrorCategory.API_ERROR,
        'API request',
        'Invalid request',
        { statusCode: 400 }
      );

      const lines = error.split('\n');
      expect(lines.length).toBeGreaterThan(5); // Icon, operation, description, suggestions
    });
  });

  describe('Error icon mapping', () => {
    it('should use correct icons for categories with templates', () => {
      const testCases: Array<[ErrorCategory, string, string, number?]> = [
        [ErrorCategory.FILE_OPERATION, 'ENOENT', '📁', undefined],
        [ErrorCategory.BASH_COMMAND, 'command not found', '⚡', undefined],
        [ErrorCategory.MCP_CONNECTION, 'connection failed', '🔌', undefined],
        [ErrorCategory.API_ERROR, 'Unauthorized', '🔑', 401],
        [ErrorCategory.AUTHENTICATION, 'Invalid API key', '🔑', 401],
        [ErrorCategory.RATE_LIMIT, 'Too many requests', '⏱️', 429],
      ];

      for (const [category, errorMsg, icon, statusCode] of testCases) {
        const error = formatEnhancedError(
          category,
          'Test operation',
          errorMsg,
          { statusCode }
        );
        expect(error).toMatch(new RegExp(`^${icon}`));
      }
    });

    it('should fall back to standard format for categories without templates', () => {
      const error = formatEnhancedError(
        ErrorCategory.VALIDATION,
        'Test operation',
        'Test error',
        {}
      );
      // Should use legacy format
      expect(error).toContain('[Validation]');
      expect(error).toContain('Test operation failed');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long error messages', () => {
      const longMessage = 'Error: ' + 'x'.repeat(300);
      const error = createFriendlyError(
        ErrorCategory.VALIDATION,
        'Validate',
        longMessage
      );

      expect(error).toBeTruthy();
      expect(error.length).toBeGreaterThan(0);
    });

    it('should handle empty file paths', () => {
      const error = formatEnhancedError(
        ErrorCategory.FILE_OPERATION,
        'Read file',
        'ENOENT',
        { filePath: '' }
      );

      // Should still be valid
      expect(error).toContain('File or Directory Not Found');
    });

    it('should handle null and undefined gracefully', () => {
      const error1 = createFriendlyError(
        ErrorCategory.VALIDATION,
        'Test',
        null
      );
      expect(error1).toBeTruthy();

      const error2 = createFriendlyError(
        ErrorCategory.VALIDATION,
        'Test',
        undefined
      );
      expect(error2).toBeTruthy();
    });

    it('should handle errors with no details', () => {
      const error = formatEnhancedError(
        ErrorCategory.NETWORK,
        'Fetch data',
        'Connection timeout'
      );

      expect(error).toBeTruthy();
      expect(error).toContain('Connection timeout');
    });
  });
});
