/**
 * Tests for type-safety.ts utilities
 *
 * Covers:
 * - Brand type creation and validation
 * - Result types (Ok, Err)
 * - Connection state validation
 * - toError utility
 * - tryCatch wrapper
 */

import { describe, it, expect } from 'vitest';
import {
  createServerName,
  createConfigFilePath,
  createToolName,
  isValidConnectionState,
  handleConnectionState,
  asNonEmpty,
  Ok,
  Err,
  mapResult,
  andThen,
  toError,
  tryCatch,
  type ServerName,
  type ConnectionState,
  type Result,
} from '../../packages/core/src/mcp/type-safety.js';

describe('Brand Types', () => {
  describe('createServerName', () => {
    it('should accept valid alphanumeric names', () => {
      expect(createServerName('github')).toBe('github');
      expect(createServerName('my-server')).toBe('my-server');
      expect(createServerName('api_v2')).toBe('api_v2');
      expect(createServerName('Server123')).toBe('Server123');
    });

    it('should reject empty names', () => {
      expect(createServerName('')).toBeNull();
    });

    it('should reject names with invalid characters', () => {
      expect(createServerName('my server')).toBeNull();
      expect(createServerName('server.name')).toBeNull();
      expect(createServerName('server/name')).toBeNull();
      expect(createServerName('server:name')).toBeNull();
    });

    it('should reject names exceeding 64 characters', () => {
      const longName = 'a'.repeat(65);
      expect(createServerName(longName)).toBeNull();
    });

    it('should accept names exactly 64 characters', () => {
      const maxName = 'a'.repeat(64);
      expect(createServerName(maxName)).toBe(maxName);
    });
  });

  describe('createConfigFilePath', () => {
    it('should accept absolute paths', () => {
      expect(createConfigFilePath('/home/user/config.json')).toBe('/home/user/config.json');
      expect(createConfigFilePath('/etc/ax-cli/config')).toBe('/etc/ax-cli/config');
    });

    it('should accept relative paths starting with .', () => {
      expect(createConfigFilePath('./config.json')).toBe('./config.json');
      expect(createConfigFilePath('../parent/config.json')).toBe('../parent/config.json');
      expect(createConfigFilePath('./.ax-cli/settings.json')).toBe('./.ax-cli/settings.json');
    });

    it('should reject empty paths', () => {
      expect(createConfigFilePath('')).toBeNull();
      expect(createConfigFilePath('   ')).toBeNull();
    });

    it('should reject paths not starting with / or .', () => {
      expect(createConfigFilePath('config.json')).toBeNull();
      expect(createConfigFilePath('relative/path')).toBeNull();
    });
  });

  describe('createToolName', () => {
    it('should accept valid tool names', () => {
      expect(createToolName('bash')).toBe('bash');
      expect(createToolName('text_editor')).toBe('text_editor');
      expect(createToolName('mcp__github__create_issue')).toBe('mcp__github__create_issue');
    });

    it('should reject empty names', () => {
      expect(createToolName('')).toBeNull();
    });

    it('should reject names with spaces', () => {
      expect(createToolName('tool name')).toBeNull();
    });

    it('should reject names exceeding 128 characters', () => {
      const longName = 'a'.repeat(129);
      expect(createToolName(longName)).toBeNull();
    });

    it('should accept names exactly 128 characters', () => {
      const maxName = 'a'.repeat(128);
      expect(createToolName(maxName)).toBe(maxName);
    });
  });
});

describe('Result Types', () => {
  describe('Ok', () => {
    it('should create success result', () => {
      const result = Ok('value');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('value');
      }
    });

    it('should work with different types', () => {
      const numResult = Ok(42);
      expect(numResult.success).toBe(true);

      const objResult = Ok({ foo: 'bar' });
      expect(objResult.success).toBe(true);

      const nullResult = Ok(null);
      expect(nullResult.success).toBe(true);
    });
  });

  describe('Err', () => {
    it('should create error result', () => {
      const error = new Error('test error');
      const result = Err(error);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(error);
      }
    });

    it('should work with string errors', () => {
      const result = Err('string error');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('string error');
      }
    });
  });

  describe('mapResult', () => {
    it('should map success value', () => {
      const result = Ok(5);
      const mapped = mapResult(result, x => x * 2);

      expect(mapped.success).toBe(true);
      if (mapped.success) {
        expect(mapped.value).toBe(10);
      }
    });

    it('should pass through error', () => {
      const error = new Error('test');
      const result: Result<number, Error> = Err(error);
      const mapped = mapResult(result, x => x * 2);

      expect(mapped.success).toBe(false);
      if (!mapped.success) {
        expect(mapped.error).toBe(error);
      }
    });
  });

  describe('andThen', () => {
    it('should chain successful results', () => {
      const result = Ok(5);
      const chained = andThen(result, x => Ok(x * 2));

      expect(chained.success).toBe(true);
      if (chained.success) {
        expect(chained.value).toBe(10);
      }
    });

    it('should short-circuit on error', () => {
      const error = new Error('first error');
      const result: Result<number, Error> = Err(error);
      const chained = andThen(result, x => Ok(x * 2));

      expect(chained.success).toBe(false);
      if (!chained.success) {
        expect(chained.error).toBe(error);
      }
    });

    it('should propagate errors from chain function', () => {
      const result = Ok(5);
      const error = new Error('chain error');
      const chained = andThen(result, () => Err(error));

      expect(chained.success).toBe(false);
      if (!chained.success) {
        expect(chained.error).toBe(error);
      }
    });
  });
});

describe('toError', () => {
  it('should return Error as-is', () => {
    const error = new Error('test');
    expect(toError(error)).toBe(error);
  });

  it('should convert string to Error', () => {
    const result = toError('string error');
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('string error');
  });

  it('should convert number to Error', () => {
    const result = toError(42);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('42');
  });

  it('should convert null to Error', () => {
    const result = toError(null);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('null');
  });

  it('should convert undefined to Error', () => {
    const result = toError(undefined);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('undefined');
  });

  it('should convert object to Error', () => {
    const result = toError({ code: 'ERR' });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('[object Object]');
  });
});

describe('tryCatch', () => {
  it('should return Ok on success', async () => {
    const result = await tryCatch(async () => 'success');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe('success');
    }
  });

  it('should return Err on throw', async () => {
    const result = await tryCatch(async () => {
      throw new Error('test error');
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('test error');
    }
  });

  it('should convert non-Error throws to Error', async () => {
    const result = await tryCatch(async () => {
      throw 'string throw';
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('string throw');
    }
  });

  it('should work with async operations', async () => {
    const result = await tryCatch(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 42;
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(42);
    }
  });
});

describe('ConnectionState', () => {
  describe('isValidConnectionState', () => {
    it('should validate idle state', () => {
      const state = { status: 'idle', serverName: 'test' };
      expect(isValidConnectionState(state)).toBe(true);
    });

    it('should validate connecting state', () => {
      const state = {
        status: 'connecting',
        serverName: 'test',
        startedAt: Date.now(),
      };
      expect(isValidConnectionState(state)).toBe(true);
    });

    it('should validate connected state', () => {
      const state = {
        status: 'connected',
        serverName: 'test',
        connectedAt: Date.now(),
        client: {},
      };
      expect(isValidConnectionState(state)).toBe(true);
    });

    it('should validate disconnecting state', () => {
      const state = {
        status: 'disconnecting',
        serverName: 'test',
        client: {},
      };
      expect(isValidConnectionState(state)).toBe(true);
    });

    it('should validate failed state', () => {
      const state = {
        status: 'failed',
        serverName: 'test',
        error: new Error('test'),
        failedAt: Date.now(),
      };
      expect(isValidConnectionState(state)).toBe(true);
    });

    it('should reject null', () => {
      expect(isValidConnectionState(null)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(isValidConnectionState('string')).toBe(false);
      expect(isValidConnectionState(123)).toBe(false);
    });

    it('should reject missing status', () => {
      expect(isValidConnectionState({ serverName: 'test' })).toBe(false);
    });

    it('should reject missing serverName', () => {
      expect(isValidConnectionState({ status: 'idle' })).toBe(false);
    });

    it('should reject invalid status', () => {
      expect(isValidConnectionState({ status: 'invalid', serverName: 'test' })).toBe(false);
    });

    it('should reject connecting without startedAt', () => {
      expect(isValidConnectionState({
        status: 'connecting',
        serverName: 'test',
      })).toBe(false);
    });

    it('should reject connected without connectedAt', () => {
      expect(isValidConnectionState({
        status: 'connected',
        serverName: 'test',
        client: {},
      })).toBe(false);
    });

    it('should reject failed without error', () => {
      expect(isValidConnectionState({
        status: 'failed',
        serverName: 'test',
        failedAt: Date.now(),
      })).toBe(false);
    });
  });

  describe('handleConnectionState', () => {
    it('should handle idle state', () => {
      const state: ConnectionState = { status: 'idle', serverName: 'test' as ServerName };
      const result = handleConnectionState(state);
      expect(result).toContain('idle');
      expect(result).toContain('test');
    });

    it('should handle connecting state', () => {
      const state: ConnectionState = {
        status: 'connecting',
        serverName: 'test' as ServerName,
        startedAt: Date.now() - 1000,
      };
      const result = handleConnectionState(state);
      expect(result).toContain('Connecting');
      expect(result).toContain('test');
    });

    it('should handle connected state', () => {
      const state: ConnectionState = {
        status: 'connected',
        serverName: 'test' as ServerName,
        connectedAt: Date.now() - 5000,
        client: {},
      };
      const result = handleConnectionState(state);
      expect(result).toContain('Connected');
      expect(result).toContain('uptime');
    });

    it('should handle failed state', () => {
      const state: ConnectionState = {
        status: 'failed',
        serverName: 'test' as ServerName,
        error: new Error('connection failed'),
        failedAt: Date.now(),
      };
      const result = handleConnectionState(state);
      expect(result).toContain('failed');
      expect(result).toContain('connection failed');
    });
  });
});

describe('NonEmptyArray', () => {
  describe('asNonEmpty', () => {
    it('should return array if non-empty', () => {
      const arr = [1, 2, 3];
      const result = asNonEmpty(arr);
      expect(result).not.toBeNull();
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return null for empty array', () => {
      const arr: number[] = [];
      const result = asNonEmpty(arr);
      expect(result).toBeNull();
    });

    it('should work with single element', () => {
      const arr = ['single'];
      const result = asNonEmpty(arr);
      expect(result).not.toBeNull();
      expect(result![0]).toBe('single');
    });
  });
});
