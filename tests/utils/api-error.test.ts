/**
 * Tests for API Error Classes - Structured Error Handling for LLM API
 *
 * @module tests/utils/api-error.test
 */

import { describe, it, expect } from 'vitest';
import { LLMAPIError, createLLMAPIError } from '../../packages/core/src/utils/api-error.js';

describe('api-error', () => {
  describe('LLMAPIError', () => {
    describe('constructor', () => {
      it('should create error with all parameters', () => {
        const originalError = new Error('Original error');
        const headers = { 'x-request-id': 'req-123' };

        const error = new LLMAPIError(
          'API call failed',
          originalError,
          'glm-4-plus',
          500,
          headers,
          'req-123'
        );

        expect(error.message).toBe('API call failed');
        expect(error.originalError).toBe(originalError);
        expect(error.model).toBe('glm-4-plus');
        expect(error.statusCode).toBe(500);
        expect(error.headers).toEqual(headers);
        expect(error.requestId).toBe('req-123');
        expect(error.name).toBe('LLMAPIError');
        expect(error.timestamp).toBeInstanceOf(Date);
      });

      it('should create error with minimal parameters', () => {
        const error = new LLMAPIError('API call failed', null, 'glm-4-plus');

        expect(error.message).toBe('API call failed');
        expect(error.originalError).toBeNull();
        expect(error.model).toBe('glm-4-plus');
        expect(error.statusCode).toBeUndefined();
        expect(error.headers).toBeUndefined();
        expect(error.requestId).toBeUndefined();
      });

      it('should preserve original stack trace', () => {
        const originalError = new Error('Original error');
        const error = new LLMAPIError('API call failed', originalError, 'glm-4-plus');

        expect(error.stack).toContain('Caused by:');
        expect(error.stack).toContain('Original error');
      });

      it('should handle original error without stack', () => {
        const originalError = { message: 'No stack' };
        const error = new LLMAPIError('API call failed', originalError, 'glm-4-plus');

        expect(error.stack).not.toContain('Caused by:');
      });

      it('should be instanceof Error', () => {
        const error = new LLMAPIError('API call failed', null, 'glm-4-plus');
        expect(error instanceof Error).toBe(true);
        expect(error instanceof LLMAPIError).toBe(true);
      });
    });

    describe('isRetryable', () => {
      it('should return true for status 429', () => {
        const error = new LLMAPIError('Rate limited', null, 'glm-4-plus', 429);
        expect(error.isRetryable).toBe(true);
      });

      it('should return true for status 500', () => {
        const error = new LLMAPIError('Server error', null, 'glm-4-plus', 500);
        expect(error.isRetryable).toBe(true);
      });

      it('should return true for status 502', () => {
        const error = new LLMAPIError('Bad gateway', null, 'glm-4-plus', 502);
        expect(error.isRetryable).toBe(true);
      });

      it('should return true for status 503', () => {
        const error = new LLMAPIError('Service unavailable', null, 'glm-4-plus', 503);
        expect(error.isRetryable).toBe(true);
      });

      it('should return true for status 504', () => {
        const error = new LLMAPIError('Gateway timeout', null, 'glm-4-plus', 504);
        expect(error.isRetryable).toBe(true);
      });

      it('should return false for status 400', () => {
        const error = new LLMAPIError('Bad request', null, 'glm-4-plus', 400);
        expect(error.isRetryable).toBe(false);
      });

      it('should return false for status 401', () => {
        const error = new LLMAPIError('Unauthorized', null, 'glm-4-plus', 401);
        expect(error.isRetryable).toBe(false);
      });

      it('should return false for status 403', () => {
        const error = new LLMAPIError('Forbidden', null, 'glm-4-plus', 403);
        expect(error.isRetryable).toBe(false);
      });

      it('should return false for status 404', () => {
        const error = new LLMAPIError('Not found', null, 'glm-4-plus', 404);
        expect(error.isRetryable).toBe(false);
      });

      it('should return true for network error without status code', () => {
        const originalError = { code: 'ECONNRESET' };
        const error = new LLMAPIError('Connection reset', originalError, 'glm-4-plus');
        expect(error.isRetryable).toBe(true);
      });

      it('should return false for non-network error without status code', () => {
        const originalError = { message: 'Some error' };
        const error = new LLMAPIError('Error', originalError, 'glm-4-plus');
        expect(error.isRetryable).toBe(false);
      });
    });

    describe('isNetworkError', () => {
      it('should return true for ECONNRESET', () => {
        const originalError = { code: 'ECONNRESET' };
        const error = new LLMAPIError('Connection reset', originalError, 'glm-4-plus');
        expect(error.isNetworkError).toBe(true);
      });

      it('should return true for ETIMEDOUT', () => {
        const originalError = { code: 'ETIMEDOUT' };
        const error = new LLMAPIError('Timed out', originalError, 'glm-4-plus');
        expect(error.isNetworkError).toBe(true);
      });

      it('should return true for ENOTFOUND', () => {
        const originalError = { code: 'ENOTFOUND' };
        const error = new LLMAPIError('Not found', originalError, 'glm-4-plus');
        expect(error.isNetworkError).toBe(true);
      });

      it('should return true for ENETUNREACH', () => {
        const originalError = { code: 'ENETUNREACH' };
        const error = new LLMAPIError('Network unreachable', originalError, 'glm-4-plus');
        expect(error.isNetworkError).toBe(true);
      });

      it('should return true for ECONNREFUSED', () => {
        const originalError = { code: 'ECONNREFUSED' };
        const error = new LLMAPIError('Connection refused', originalError, 'glm-4-plus');
        expect(error.isNetworkError).toBe(true);
      });

      it('should return true for message containing "network"', () => {
        const originalError = { message: 'Network connection failed' };
        const error = new LLMAPIError('Error', originalError, 'glm-4-plus');
        expect(error.isNetworkError).toBe(true);
      });

      it('should return true for message containing "timeout"', () => {
        const originalError = { message: 'Request timeout' };
        const error = new LLMAPIError('Error', originalError, 'glm-4-plus');
        expect(error.isNetworkError).toBe(true);
      });

      it('should return true for message containing "fetch failed"', () => {
        const originalError = { message: 'Fetch failed' };
        const error = new LLMAPIError('Error', originalError, 'glm-4-plus');
        expect(error.isNetworkError).toBe(true);
      });

      it('should return false for non-network error', () => {
        const originalError = { message: 'Invalid JSON' };
        const error = new LLMAPIError('Error', originalError, 'glm-4-plus');
        expect(error.isNetworkError).toBe(false);
      });

      it('should handle null original error', () => {
        const error = new LLMAPIError('Error', null, 'glm-4-plus');
        expect(error.isNetworkError).toBe(false);
      });

      it('should handle original error with non-string code', () => {
        const originalError = { code: 123 };
        const error = new LLMAPIError('Error', originalError, 'glm-4-plus');
        expect(error.isNetworkError).toBe(false);
      });
    });

    describe('isRateLimitError', () => {
      it('should return true for status 429', () => {
        const error = new LLMAPIError('Rate limited', null, 'glm-4-plus', 429);
        expect(error.isRateLimitError).toBe(true);
      });

      it('should return false for other status codes', () => {
        const error = new LLMAPIError('Server error', null, 'glm-4-plus', 500);
        expect(error.isRateLimitError).toBe(false);
      });

      it('should return false when no status code', () => {
        const error = new LLMAPIError('Error', null, 'glm-4-plus');
        expect(error.isRateLimitError).toBe(false);
      });
    });

    describe('isAuthError', () => {
      it('should return true for status 401', () => {
        const error = new LLMAPIError('Unauthorized', null, 'glm-4-plus', 401);
        expect(error.isAuthError).toBe(true);
      });

      it('should return true for status 403', () => {
        const error = new LLMAPIError('Forbidden', null, 'glm-4-plus', 403);
        expect(error.isAuthError).toBe(true);
      });

      it('should return false for other status codes', () => {
        const error = new LLMAPIError('Not found', null, 'glm-4-plus', 404);
        expect(error.isAuthError).toBe(false);
      });

      it('should return false when no status code', () => {
        const error = new LLMAPIError('Error', null, 'glm-4-plus');
        expect(error.isAuthError).toBe(false);
      });
    });

    describe('isClientError', () => {
      it('should return true for status 400', () => {
        const error = new LLMAPIError('Bad request', null, 'glm-4-plus', 400);
        expect(error.isClientError).toBe(true);
      });

      it('should return true for status 404', () => {
        const error = new LLMAPIError('Not found', null, 'glm-4-plus', 404);
        expect(error.isClientError).toBe(true);
      });

      it('should return true for status 422', () => {
        const error = new LLMAPIError('Unprocessable', null, 'glm-4-plus', 422);
        expect(error.isClientError).toBe(true);
      });

      it('should return false for status 429 (rate limit)', () => {
        const error = new LLMAPIError('Rate limited', null, 'glm-4-plus', 429);
        expect(error.isClientError).toBe(false);
      });

      it('should return false for status 500', () => {
        const error = new LLMAPIError('Server error', null, 'glm-4-plus', 500);
        expect(error.isClientError).toBe(false);
      });

      it('should return false when no status code', () => {
        const error = new LLMAPIError('Error', null, 'glm-4-plus');
        expect(error.isClientError).toBe(false);
      });
    });

    describe('retryAfterSeconds', () => {
      it('should return seconds from numeric Retry-After header', () => {
        const error = new LLMAPIError('Rate limited', null, 'glm-4-plus', 429, {
          'retry-after': '30'
        });
        expect(error.retryAfterSeconds).toBe(30);
      });

      it('should return seconds from Retry-After header (capitalized)', () => {
        const error = new LLMAPIError('Rate limited', null, 'glm-4-plus', 429, {
          'Retry-After': '60'
        });
        expect(error.retryAfterSeconds).toBe(60);
      });

      it('should parse HTTP date Retry-After header', () => {
        const futureDate = new Date(Date.now() + 5000);
        const error = new LLMAPIError('Rate limited', null, 'glm-4-plus', 429, {
          'retry-after': futureDate.toUTCString()
        });
        // Should be approximately 5 seconds
        expect(error.retryAfterSeconds).toBeGreaterThanOrEqual(4);
        expect(error.retryAfterSeconds).toBeLessThanOrEqual(6);
      });

      it('should return null for past HTTP date', () => {
        const pastDate = new Date(Date.now() - 5000);
        const error = new LLMAPIError('Rate limited', null, 'glm-4-plus', 429, {
          'retry-after': pastDate.toUTCString()
        });
        expect(error.retryAfterSeconds).toBeNull();
      });

      it('should return null when no headers', () => {
        const error = new LLMAPIError('Rate limited', null, 'glm-4-plus', 429);
        expect(error.retryAfterSeconds).toBeNull();
      });

      it('should return null when no Retry-After header', () => {
        const error = new LLMAPIError('Rate limited', null, 'glm-4-plus', 429, {
          'content-type': 'application/json'
        });
        expect(error.retryAfterSeconds).toBeNull();
      });

      it('should return null for invalid Retry-After value', () => {
        const error = new LLMAPIError('Rate limited', null, 'glm-4-plus', 429, {
          'retry-after': 'invalid'
        });
        expect(error.retryAfterSeconds).toBeNull();
      });
    });

    describe('userMessage', () => {
      it('should return rate limit message with retry-after', () => {
        const error = new LLMAPIError('Rate limited', null, 'glm-4-plus', 429, {
          'retry-after': '30'
        });
        expect(error.userMessage).toBe('Rate limit exceeded. Please retry in 30 seconds.');
      });

      it('should return rate limit message without retry-after', () => {
        const error = new LLMAPIError('Rate limited', null, 'glm-4-plus', 429);
        expect(error.userMessage).toBe('Rate limit exceeded. Please try again in a few moments.');
      });

      it('should return auth message for 401', () => {
        const error = new LLMAPIError('Unauthorized', null, 'glm-4-plus', 401);
        expect(error.userMessage).toBe('Authentication failed. Please check your API key and try again.');
      });

      it('should return auth message for 403', () => {
        const error = new LLMAPIError('Forbidden', null, 'glm-4-plus', 403);
        expect(error.userMessage).toBe('Authentication failed. Please check your API key and try again.');
      });

      it('should return network error message', () => {
        const originalError = { code: 'ECONNRESET' };
        const error = new LLMAPIError('Connection reset', originalError, 'glm-4-plus');
        expect(error.userMessage).toBe('Network connection failed. Please check your internet connection and try again.');
      });

      it('should return server error message for 5xx', () => {
        const error = new LLMAPIError('Server error', null, 'glm-4-plus', 500);
        expect(error.userMessage).toBe('The AI service is temporarily unavailable. Please try again in a few moments.');
      });

      it('should return original message for other errors', () => {
        const error = new LLMAPIError('Something went wrong', null, 'glm-4-plus', 400);
        expect(error.userMessage).toBe('Something went wrong');
      });
    });

    describe('toJSON', () => {
      it('should serialize error to JSON', () => {
        const originalError = { name: 'TypeError', message: 'Original', code: 'ERR', status: 500 };
        const error = new LLMAPIError(
          'API call failed',
          originalError,
          'glm-4-plus',
          500,
          { 'x-request-id': 'req-123' },
          'req-123'
        );

        const json = error.toJSON();

        expect(json.name).toBe('LLMAPIError');
        expect(json.message).toBe('API call failed');
        expect(json.model).toBe('glm-4-plus');
        expect(json.statusCode).toBe(500);
        expect(json.headers).toEqual({ 'x-request-id': 'req-123' });
        expect(json.requestId).toBe('req-123');
        expect(json.timestamp).toBeDefined();
        expect(json.isRetryable).toBe(true);
        expect(json.isRateLimitError).toBe(false);
        expect(json.isAuthError).toBe(false);
        expect(json.isNetworkError).toBe(false);
        expect(json.retryAfterSeconds).toBeNull();
        expect(json.originalError).toEqual({
          name: 'TypeError',
          message: 'Original',
          code: 'ERR',
          status: 500
        });
      });

      it('should handle null original error', () => {
        const error = new LLMAPIError('API call failed', null, 'glm-4-plus');
        const json = error.toJSON();

        expect(json.originalError).toEqual({
          name: undefined,
          message: undefined,
          code: undefined,
          status: undefined
        });
      });
    });

    describe('toString', () => {
      it('should format error with status code', () => {
        const error = new LLMAPIError('API call failed', null, 'glm-4-plus', 500);
        expect(error.toString()).toBe('LLMAPIError: API call failed (HTTP 500)');
      });

      it('should format error with request ID', () => {
        const error = new LLMAPIError('API call failed', null, 'glm-4-plus', 500, {}, 'req-123');
        expect(error.toString()).toBe('LLMAPIError: API call failed (HTTP 500) [Request ID: req-123]');
      });

      it('should format error without status code', () => {
        const error = new LLMAPIError('API call failed', null, 'glm-4-plus');
        expect(error.toString()).toBe('LLMAPIError: API call failed');
      });

      it('should format error with request ID but no status code', () => {
        const error = new LLMAPIError('API call failed', null, 'glm-4-plus', undefined, undefined, 'req-123');
        expect(error.toString()).toBe('LLMAPIError: API call failed [Request ID: req-123]');
      });
    });
  });

  describe('createLLMAPIError', () => {
    it('should create error from error object with status', () => {
      const originalError = {
        message: 'Request failed',
        status: 500
      };

      const error = createLLMAPIError(originalError, 'glm-4-plus');

      expect(error).toBeInstanceOf(LLMAPIError);
      expect(error.message).toBe('Request failed');
      expect(error.statusCode).toBe(500);
      expect(error.model).toBe('glm-4-plus');
    });

    it('should create error from error object with response.status', () => {
      const originalError = {
        message: 'Request failed',
        response: { status: 429 }
      };

      const error = createLLMAPIError(originalError, 'glm-4-plus');

      expect(error.statusCode).toBe(429);
    });

    it('should extract headers from error', () => {
      const originalError = {
        message: 'Request failed',
        headers: { 'x-request-id': 'req-123' }
      };

      const error = createLLMAPIError(originalError, 'glm-4-plus');

      expect(error.headers).toEqual({ 'x-request-id': 'req-123' });
    });

    it('should extract headers from response.headers', () => {
      const originalError = {
        message: 'Request failed',
        response: { headers: { 'x-request-id': 'req-456' } }
      };

      const error = createLLMAPIError(originalError, 'glm-4-plus');

      expect(error.headers).toEqual({ 'x-request-id': 'req-456' });
    });

    it('should extract request ID from headers', () => {
      const originalError = {
        message: 'Request failed',
        headers: { 'x-request-id': 'req-789' }
      };

      const error = createLLMAPIError(originalError, 'glm-4-plus');

      expect(error.requestId).toBe('req-789');
    });

    it('should extract request ID from X-Request-Id header', () => {
      const originalError = {
        message: 'Request failed',
        headers: { 'X-Request-Id': 'req-abc' }
      };

      const error = createLLMAPIError(originalError, 'glm-4-plus');

      expect(error.requestId).toBe('req-abc');
    });

    it('should add context prefix to message', () => {
      const originalError = {
        message: 'Request failed'
      };

      const error = createLLMAPIError(originalError, 'glm-4-plus', 'Chat completion');

      expect(error.message).toBe('Chat completion: Request failed');
    });

    it('should extract message from error.error.message', () => {
      const originalError = {
        error: { message: 'Nested error message' }
      };

      const error = createLLMAPIError(originalError, 'glm-4-plus');

      expect(error.message).toBe('Nested error message');
    });

    it('should use "Unknown error" when no message found', () => {
      const originalError = {};

      const error = createLLMAPIError(originalError, 'glm-4-plus');

      expect(error.message).toBe('Unknown error');
    });

    it('should handle null error', () => {
      const error = createLLMAPIError(null, 'glm-4-plus');

      expect(error.message).toBe('Unknown error');
      expect(error.originalError).toBeNull();
    });

    it('should handle undefined error', () => {
      const error = createLLMAPIError(undefined, 'glm-4-plus');

      expect(error.message).toBe('Unknown error');
    });

    it('should preserve original error reference', () => {
      const originalError = new Error('Original');

      const error = createLLMAPIError(originalError, 'glm-4-plus');

      expect(error.originalError).toBe(originalError);
    });
  });
});
