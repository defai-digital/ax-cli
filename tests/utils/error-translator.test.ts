/**
 * Tests for utils/error-translator.ts
 * Tests error message translation from Chinese to English
 */
import { describe, it, expect } from 'vitest';
import {
  translateErrorMessage,
  extractAndTranslateError,
} from '../../packages/core/src/utils/error-translator.js';

describe('translateErrorMessage', () => {
  describe('English messages (passthrough)', () => {
    it('should return English messages unchanged', () => {
      expect(translateErrorMessage('Invalid API key')).toBe('Invalid API key');
      expect(translateErrorMessage('Rate limit exceeded')).toBe('Rate limit exceeded');
      expect(translateErrorMessage('Server error')).toBe('Server error');
    });

    it('should handle empty string', () => {
      expect(translateErrorMessage('')).toBe('');
    });

    it('should handle messages with numbers', () => {
      expect(translateErrorMessage('Error 429: Too many requests')).toBe('Error 429: Too many requests');
    });
  });

  describe('Chinese authentication errors', () => {
    it('should translate token expired error', () => {
      const result = translateErrorMessage('令牌已过期或验证不正确');
      expect(result).toContain('Token expired');
      expect(result).toContain('verification incorrect');
    });

    it('should translate authentication failed error', () => {
      const result = translateErrorMessage('认证失败');
      expect(result).toContain('Authentication failed');
    });

    it('should translate invalid API key error', () => {
      const result = translateErrorMessage('无效的API密钥');
      expect(result).toContain('Invalid API key');
    });

    it('should translate API key does not exist error', () => {
      const result = translateErrorMessage('API密钥不存在');
      expect(result).toContain('API key does not exist');
    });
  });

  describe('Chinese rate limiting errors', () => {
    it('should translate rate limit exceeded error', () => {
      const result = translateErrorMessage('请求过于频繁');
      expect(result).toContain('Request rate limit exceeded');
    });

    it('should translate rate limit error', () => {
      const result = translateErrorMessage('超出速率限制');
      expect(result).toContain('Rate limit exceeded');
    });

    it('should translate retry later error', () => {
      const result = translateErrorMessage('请稍后重试');
      expect(result).toContain('retry later');
    });
  });

  describe('Chinese quota errors', () => {
    it('should translate insufficient balance error', () => {
      const result = translateErrorMessage('余额不足');
      expect(result).toContain('Insufficient balance');
    });

    it('should translate quota exhausted error', () => {
      const result = translateErrorMessage('配额已用尽');
      expect(result).toContain('Quota exhausted');
    });

    it('should translate account overdue error', () => {
      const result = translateErrorMessage('账户已欠费');
      expect(result).toContain('Account is overdue');
    });
  });

  describe('Chinese model errors', () => {
    it('should translate model does not exist error', () => {
      const result = translateErrorMessage('模型不存在');
      expect(result).toContain('Model does not exist');
    });

    it('should translate model not available error', () => {
      const result = translateErrorMessage('模型不可用');
      expect(result).toContain('Model not available');
    });

    it('should translate model not supported error', () => {
      const result = translateErrorMessage('不支持该模型');
      expect(result).toContain('Model not supported');
    });
  });

  describe('Chinese request errors', () => {
    it('should translate invalid parameters error', () => {
      const result = translateErrorMessage('参数错误');
      expect(result).toContain('Invalid parameters');
    });

    it('should translate request body too large error', () => {
      const result = translateErrorMessage('请求体过大');
      expect(result).toContain('Request body too large');
    });

    it('should translate invalid request error', () => {
      const result = translateErrorMessage('无效的请求');
      expect(result).toContain('Invalid request');
    });

    it('should translate missing required parameters error', () => {
      const result = translateErrorMessage('缺少必需参数');
      expect(result).toContain('Missing required parameters');
    });
  });

  describe('Chinese server errors', () => {
    it('should translate server error', () => {
      const result = translateErrorMessage('服务器错误');
      expect(result).toContain('Server error');
    });

    it('should translate internal error', () => {
      const result = translateErrorMessage('内部错误');
      expect(result).toContain('Internal error');
    });

    it('should translate service unavailable error', () => {
      const result = translateErrorMessage('服务暂时不可用');
      expect(result).toContain('Service temporarily unavailable');
    });

    it('should translate gateway timeout error', () => {
      const result = translateErrorMessage('网关超时');
      expect(result).toContain('Gateway timeout');
    });
  });

  describe('partial matches', () => {
    it('should handle messages containing Chinese error phrases', () => {
      const result = translateErrorMessage('Error: 令牌已过期或验证不正确');
      expect(result).toContain('Token expired');
    });

    it('should handle mixed English and Chinese', () => {
      const result = translateErrorMessage('401 认证失败');
      expect(result).toContain('Authentication failed');
    });
  });

  describe('untranslated Chinese messages', () => {
    it('should provide hint for unknown Chinese errors', () => {
      const result = translateErrorMessage('未知错误类型');
      expect(result).toContain('Chinese error message');
      expect(result).toContain('未知错误类型');
    });
  });

  describe('with status codes', () => {
    it('should add context for 401 status code', () => {
      const result = translateErrorMessage('认证失败', 401);
      expect(result).toContain('Authentication failed');
      expect(result).toContain('API key');
    });

    it('should add context for 403 status code', () => {
      const result = translateErrorMessage('认证失败', 403);
      expect(result).toContain('permissions');
    });

    it('should add context for 429 status code', () => {
      const result = translateErrorMessage('请求过于频繁', 429);
      expect(result).toContain('wait');
    });

    it('should add context for 500 status code', () => {
      const result = translateErrorMessage('服务器错误', 500);
      expect(result).toContain('provider');
      expect(result).toContain('later');
    });

    it('should add context for 502 status code', () => {
      const result = translateErrorMessage('网关超时', 502);
      expect(result).toContain('issues');
    });

    it('should add context for 503 status code', () => {
      const result = translateErrorMessage('服务暂时不可用', 503);
      expect(result).toContain('issues');
    });

    it('should add context for 504 status code', () => {
      const result = translateErrorMessage('网关超时', 504);
      expect(result).toContain('issues');
    });

    it('should not add context for unknown status codes', () => {
      const result = translateErrorMessage('服务器错误', 418);
      expect(result).not.toContain(' - ');
    });

    it('should provide generic hint for untranslated errors with status codes', () => {
      const result = translateErrorMessage('未知中文错误', 401);
      expect(result).toContain('authentication issue');
    });

    it('should provide rate limit hint for untranslated 429 errors', () => {
      const result = translateErrorMessage('未知中文错误', 429);
      expect(result).toContain('rate limit');
    });

    it('should provide server error hint for untranslated 500 errors', () => {
      const result = translateErrorMessage('未知中文错误', 500);
      expect(result).toContain('server error');
    });

    it('should provide documentation hint for unknown status codes', () => {
      const result = translateErrorMessage('未知中文错误', 418);
      expect(result).toContain('documentation');
    });
  });
});

describe('extractAndTranslateError', () => {
  describe('Error objects', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error message');
      const result = extractAndTranslateError(error);
      expect(result).toBe('Test error message');
    });

    it('should translate Chinese Error messages', () => {
      const error = new Error('认证失败');
      const result = extractAndTranslateError(error);
      expect(result).toContain('Authentication failed');
    });
  });

  describe('abort errors', () => {
    it('should handle AbortError by name', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      const result = extractAndTranslateError(error);
      expect(result).toContain('cancelled');
    });

    it('should handle error message containing "abort"', () => {
      const error = new Error('The operation was aborted');
      const result = extractAndTranslateError(error);
      expect(result).toContain('cancelled');
    });

    it('should handle error message containing "cancelled"', () => {
      const error = new Error('Request was cancelled');
      const result = extractAndTranslateError(error);
      expect(result).toContain('cancelled');
    });

    it('should handle error message containing "canceled"', () => {
      const error = new Error('Request was canceled');
      const result = extractAndTranslateError(error);
      expect(result).toContain('cancelled');
    });

    it('should provide timeout context for first chunk timeout with abort', () => {
      const error = new Error('abort: timeout waiting for first chunk');
      const result = extractAndTranslateError(error);
      expect(result).toContain('Connection timeout');
      expect(result).toContain('server took too long');
    });

    it('should provide timeout context for idle timeout with abort', () => {
      const error = new Error('abort: idle timeout reached');
      const result = extractAndTranslateError(error);
      expect(result).toContain('Stream timeout');
      expect(result).toContain('stopped responding');
    });

    it('should provide generic timeout message', () => {
      const error = new Error('timeout abort');
      const result = extractAndTranslateError(error);
      expect(result).toContain('timeout');
    });
  });

  describe('OpenAI-style error objects', () => {
    it('should extract message from error.error.message', () => {
      const error = {
        error: {
          message: 'Invalid API key provided',
          status: 401,
        },
      };
      const result = extractAndTranslateError(error);
      expect(result).toBe('Invalid API key provided');
    });

    it('should extract message from error.message', () => {
      const error = {
        message: 'Something went wrong',
      };
      const result = extractAndTranslateError(error);
      expect(result).toBe('Something went wrong');
    });

    it('should extract and use status code', () => {
      const error = {
        error: {
          message: '认证失败',
          status: 401,
        },
      };
      const result = extractAndTranslateError(error);
      expect(result).toContain('Authentication failed');
      expect(result).toContain('API key');
    });

    it('should handle statusCode property', () => {
      const error = {
        message: '认证失败',
        statusCode: 401,
      };
      const result = extractAndTranslateError(error);
      expect(result).toContain('Authentication failed');
    });

    it('should handle status property', () => {
      const error = {
        message: '认证失败',
        status: 401,
      };
      const result = extractAndTranslateError(error);
      expect(result).toContain('Authentication failed');
    });

    it('should JSON stringify objects without message', () => {
      const error = { code: 'ERR_UNKNOWN', details: 'Something failed' };
      const result = extractAndTranslateError(error);
      expect(result).toContain('ERR_UNKNOWN');
      expect(result).toContain('Something failed');
    });
  });

  describe('primitive values', () => {
    it('should handle string errors', () => {
      const result = extractAndTranslateError('Simple string error');
      expect(result).toBe('Simple string error');
    });

    it('should handle number errors', () => {
      const result = extractAndTranslateError(500);
      expect(result).toBe('500');
    });

    it('should handle null errors', () => {
      const result = extractAndTranslateError(null);
      expect(result).toBe('null');
    });

    it('should handle undefined errors', () => {
      const result = extractAndTranslateError(undefined);
      expect(result).toBe('undefined');
    });
  });

  describe('edge cases', () => {
    it('should handle empty Error message', () => {
      const error = new Error('');
      const result = extractAndTranslateError(error);
      expect(result).toBe('');
    });

    it('should handle complex nested errors', () => {
      const error = {
        error: {
          error: {
            message: 'Nested error',
          },
        },
      };
      // Should stringify since error.error.message doesn't exist at expected path
      const result = extractAndTranslateError(error);
      expect(result).toContain('Nested error');
    });
  });
});
