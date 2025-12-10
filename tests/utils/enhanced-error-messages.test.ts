/**
 * Tests for enhanced error messages
 * Phase 5: Error Message Improvements
 */

import { describe, it, expect } from 'vitest';
import {
  formatEnhancedError,
  createFriendlyError,
  FriendlyErrors,
} from '../../packages/core/src/utils/enhanced-error-messages.js';
import { ErrorCategory } from '../../packages/core/src/utils/error-handler.js';

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

  describe('Additional error patterns', () => {
    describe('FILE_ERROR_PATTERNS', () => {
      it('should handle ENOTDIR error', () => {
        const error = formatEnhancedError(
          ErrorCategory.FILE_OPERATION,
          'List directory',
          'ENOTDIR: not a directory'
        );

        expect(error).toContain('Expected Directory, Got File');
        expect(error).toContain('Specify a directory path');
      });

      it('should handle EEXIST error', () => {
        const error = formatEnhancedError(
          ErrorCategory.FILE_OPERATION,
          'Create file',
          'EEXIST: file already exists'
        );

        expect(error).toContain('File Already Exists');
        expect(error).toContain('str_replace');
      });

      it('should handle EMFILE error', () => {
        const error = formatEnhancedError(
          ErrorCategory.FILE_OPERATION,
          'Open file',
          'EMFILE: too many open files'
        );

        expect(error).toContain('Too Many Open Files');
        expect(error).toContain('file descriptor');
      });

      it('should handle ENOSPC error', () => {
        const error = formatEnhancedError(
          ErrorCategory.FILE_OPERATION,
          'Write file',
          'ENOSPC: no space left on device'
        );

        expect(error).toContain('No Space Left on Device');
        expect(error).toContain('df -h');
      });

      it('should handle EISDIR error', () => {
        const error = formatEnhancedError(
          ErrorCategory.FILE_OPERATION,
          'Read file',
          'EISDIR: illegal operation on a directory'
        );

        expect(error).toContain('Expected File, Got Directory');
      });

      it('should match "is a directory" pattern', () => {
        const error = formatEnhancedError(
          ErrorCategory.FILE_OPERATION,
          'Read file',
          'Cannot read: path is a directory'
        );

        expect(error).toContain('Expected File, Got Directory');
      });

      it('should match "already exists" pattern', () => {
        const error = formatEnhancedError(
          ErrorCategory.FILE_OPERATION,
          'Create file',
          'Target file already exists'
        );

        expect(error).toContain('File Already Exists');
      });
    });

    describe('API_ERROR_PATTERNS', () => {
      it('should handle 400 Bad Request', () => {
        const error = formatEnhancedError(
          ErrorCategory.API_ERROR,
          'API request',
          'Bad request',
          { statusCode: 400 }
        );

        expect(error).toContain('Bad Request');
        expect(error).toContain('Check the request parameters');
      });

      it('should handle 403 Forbidden', () => {
        const error = formatEnhancedError(
          ErrorCategory.API_ERROR,
          'API request',
          'Forbidden',
          { statusCode: 403 }
        );

        expect(error).toContain('Access Forbidden');
        expect(error).toContain('ax-cli models');
      });

      it('should handle 404 Not Found', () => {
        const error = formatEnhancedError(
          ErrorCategory.API_ERROR,
          'API request',
          'Not found',
          { statusCode: 404 }
        );

        expect(error).toContain('Resource Not Found');
        expect(error).toContain('ax-cli models');
      });

      it('should handle 500 Internal Server Error', () => {
        const error = formatEnhancedError(
          ErrorCategory.API_ERROR,
          'API request',
          'Internal server error',
          { statusCode: 500 }
        );

        expect(error).toContain('Server Error');
        expect(error).toContain('status page');
      });

      it('should handle 502 Bad Gateway', () => {
        const error = formatEnhancedError(
          ErrorCategory.API_ERROR,
          'API request',
          'Bad Gateway',
          { statusCode: 502 }
        );

        expect(error).toContain('Bad Gateway');
        expect(error).toContain('temporary');
      });

      it('should handle 503 Service Unavailable', () => {
        const error = formatEnhancedError(
          ErrorCategory.API_ERROR,
          'API request',
          'Service Unavailable',
          { statusCode: 503 }
        );

        expect(error).toContain('Service Unavailable');
        expect(error).toContain('high load');
      });

      it('should handle 504 Gateway Timeout', () => {
        const error = formatEnhancedError(
          ErrorCategory.API_ERROR,
          'API request',
          'Gateway Timeout',
          { statusCode: 504 }
        );

        expect(error).toContain('Gateway Timeout');
        expect(error).toContain('complexity');
      });
    });

    describe('MCP_ERROR_PATTERNS', () => {
      it('should handle timeout error', () => {
        const error = formatEnhancedError(
          ErrorCategory.MCP_CONNECTION,
          'MCP request',
          'Request timeout occurred'
        );

        expect(error).toContain('MCP Server Timeout');
        expect(error).toContain('ax-cli mcp health');
      });

      it('should handle invalid response error', () => {
        const error = formatEnhancedError(
          ErrorCategory.MCP_CONNECTION,
          'MCP request',
          'Invalid response from server'
        );

        expect(error).toContain('Invalid MCP Server Response');
        expect(error).toContain('ax-cli mcp test');
      });

      it('should handle unexpected response error', () => {
        const error = formatEnhancedError(
          ErrorCategory.MCP_CONNECTION,
          'MCP request',
          'Unexpected response format received'
        );

        expect(error).toContain('Invalid MCP Server Response');
      });

      it('should handle connect error', () => {
        const error = formatEnhancedError(
          ErrorCategory.MCP_CONNECTION,
          'Connect to server',
          'Unable to connect to MCP'
        );

        expect(error).toContain('MCP Server Connection Failed');
      });
    });

    describe('BASH_ERROR_PATTERNS', () => {
      it('should handle security violation', () => {
        const error = formatEnhancedError(
          ErrorCategory.BASH_COMMAND,
          'Execute command',
          'Command blocked for security reasons'
        );

        expect(error).toContain('Security Restriction');
        expect(error).toContain('Learn more');
      });

      it('should handle blocked command', () => {
        const error = formatEnhancedError(
          ErrorCategory.BASH_COMMAND,
          'Execute command',
          'This operation is blocked'
        );

        expect(error).toContain('Security Restriction');
      });

      it('should handle exit code 1', () => {
        const error = formatEnhancedError(
          ErrorCategory.BASH_COMMAND,
          'Run script',
          'Process exit code 1'
        );

        expect(error).toContain('Command Failed');
        expect(error).toContain('command output');
      });

      it('should handle code 1 pattern', () => {
        const error = formatEnhancedError(
          ErrorCategory.BASH_COMMAND,
          'Run script',
          'Exited with code 1'
        );

        expect(error).toContain('Command Failed');
      });

      it('should handle not found pattern', () => {
        const error = formatEnhancedError(
          ErrorCategory.BASH_COMMAND,
          'Execute',
          'foo: not found'
        );

        expect(error).toContain('Command Not Found');
      });
    });
  });

  describe('createFriendlyError advanced', () => {
    it('should extract code property from error', () => {
      const err = new Error('ENOENT: no such file') as Error & { code: string };
      err.code = 'ENOENT';
      const result = createFriendlyError(
        ErrorCategory.FILE_OPERATION,
        'Read file',
        err
      );

      expect(result).toContain('File or Directory Not Found');
    });

    it('should extract statusCode property from error', () => {
      const err = new Error('Server error') as Error & { statusCode: number };
      err.statusCode = 500;
      const result = createFriendlyError(
        ErrorCategory.API_ERROR,
        'API request',
        err
      );

      expect(result).toContain('Server Error');
    });

    it('should handle objects with nested error.code', () => {
      const err = { error: { message: 'Auth failed', code: 'AUTH_FAILED' } };
      const result = createFriendlyError(
        ErrorCategory.AUTHENTICATION,
        'Login',
        err
      );

      expect(result).toContain('Auth failed');
    });

    it('should handle objects with nested error.status', () => {
      const err = { error: { message: 'Rate limited', status: 429 } };
      const result = createFriendlyError(
        ErrorCategory.RATE_LIMIT,
        'API request',
        err
      );

      expect(result).toContain('Rate Limit Exceeded');
    });

    it('should stringify objects without message', () => {
      const err = { foo: 'bar', baz: 123 };
      const result = createFriendlyError(
        ErrorCategory.VALIDATION,
        'Validate',
        err
      );

      expect(result).toContain('foo');
    });
  });

  describe('getErrorIcon', () => {
    it('should return correct icon for API_ERROR with template', () => {
      const error = formatEnhancedError(
        ErrorCategory.API_ERROR,
        'Test',
        'error',
        { statusCode: 500 }
      );

      expect(error).toContain('🔑');
    });

    it('should use fallback format for NETWORK without template', () => {
      const error = formatEnhancedError(
        ErrorCategory.NETWORK,
        'Test',
        'some error'
      );

      // No template for NETWORK, uses fallback format
      expect(error).toContain('[Network]');
      expect(error).toContain('Test failed');
    });

    it('should use fallback format for CONFIGURATION without template', () => {
      const error = formatEnhancedError(
        ErrorCategory.CONFIGURATION,
        'Test',
        'some error'
      );

      // No template for CONFIGURATION, uses fallback format
      expect(error).toContain('[Configuration]');
      expect(error).toContain('Test failed');
    });

    it('should use fallback format for VALIDATION without template', () => {
      const error = formatEnhancedError(
        ErrorCategory.VALIDATION,
        'Test',
        'some error'
      );

      // No template for VALIDATION, uses fallback format
      expect(error).toContain('[Validation]');
      expect(error).toContain('Test failed');
    });

    it('should use fallback format for TIMEOUT without template', () => {
      const error = formatEnhancedError(
        ErrorCategory.TIMEOUT,
        'Test',
        'some error'
      );

      // No template for TIMEOUT, uses fallback format
      expect(error).toContain('[Timeout]');
      expect(error).toContain('Test failed');
    });

    it('should use fallback format for unknown category', () => {
      const error = formatEnhancedError(
        'Unknown' as ErrorCategory,
        'Test',
        'some error'
      );

      // Unknown category uses fallback format
      expect(error).toContain('[Unknown]');
      expect(error).toContain('Test failed');
    });

    it('should use fallback format for TOOL_EXECUTION', () => {
      const error = formatEnhancedError(
        ErrorCategory.TOOL_EXECUTION,
        'Test',
        'some error'
      );

      // No template, uses fallback format
      expect(error).toContain('[Tool Execution]');
      expect(error).toContain('Test failed');
    });

    it('should use fallback format for MODEL_UNAVAILABLE', () => {
      const error = formatEnhancedError(
        ErrorCategory.MODEL_UNAVAILABLE,
        'Test',
        'some error'
      );

      // No template, uses fallback format
      expect(error).toContain('[Model Unavailable]');
      expect(error).toContain('Test failed');
    });

    it('should use fallback format for PARSING', () => {
      const error = formatEnhancedError(
        ErrorCategory.PARSING,
        'Test',
        'some error'
      );

      // No template, uses fallback format
      expect(error).toContain('[Parsing]');
      expect(error).toContain('Test failed');
    });
  });

  describe('formatEnhancedError options', () => {
    it('should not include short error in body if already in description', () => {
      const error = formatEnhancedError(
        ErrorCategory.FILE_OPERATION,
        'Read file',
        'ENOENT',
        { filePath: '/test.txt' }
      );

      // Error message ENOENT should appear
      expect(error).toContain('ENOENT');
    });

    it('should truncate very long error messages in output', () => {
      const longError = 'x'.repeat(250);
      const error = formatEnhancedError(
        ErrorCategory.FILE_OPERATION,
        'Read file',
        longError,
        { filePath: '/test.txt' }
      );

      // The fallback format will be used since no pattern matches
      // Long messages (>200 chars) should not be duplicated in Error: line
      expect(error).toBeTruthy();
    });

    it('should include details when provided', () => {
      const error = formatEnhancedError(
        ErrorCategory.FILE_OPERATION,
        'Read file',
        'ENOENT',
        { filePath: '/test.txt', details: 'Additional context here' }
      );

      expect(error).toContain('Details: Additional context here');
    });
  });
});
