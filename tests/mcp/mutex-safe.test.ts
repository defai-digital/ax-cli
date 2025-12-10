/**
 * Tests for SafeMutex and SafeKeyedMutex
 *
 * Covers:
 * - Basic lock/unlock operations
 * - Concurrent access protection
 * - Double-release prevention (linear types)
 * - Stress tests for deadlock/livelock prevention
 * - Token leak detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SafeMutex, SafeKeyedMutex, LockToken } from '../../packages/core/src/mcp/mutex-safe.js';

describe('SafeMutex', () => {
  let mutex: SafeMutex;

  beforeEach(() => {
    mutex = new SafeMutex();
  });

  describe('basic operations', () => {
    it('should start unlocked', () => {
      expect(mutex.isLocked()).toBe(false);
      expect(mutex.getLockHolder()).toBeNull();
      expect(mutex.getQueueLength()).toBe(0);
    });

    it('should acquire lock successfully', async () => {
      const token = await mutex.acquire('test');

      expect(mutex.isLocked()).toBe(true);
      expect(mutex.getLockHolder()).toBe('test');
      expect(token.isReleased()).toBe(false);

      token.release();
      expect(mutex.isLocked()).toBe(false);
    });

    it('should release lock via token', async () => {
      const token = await mutex.acquire('test');
      expect(mutex.isLocked()).toBe(true);

      token.release();

      expect(mutex.isLocked()).toBe(false);
      expect(token.isReleased()).toBe(true);
    });

    it('should track lock duration', async () => {
      const token = await mutex.acquire('test');

      // Wait a bit (use 15ms to avoid timer precision flakiness)
      await new Promise(resolve => setTimeout(resolve, 15));

      const duration = mutex.getLockDuration();
      expect(duration).not.toBeNull();
      // Allow 5ms tolerance for timer precision issues
      expect(duration!).toBeGreaterThanOrEqual(10);

      token.release();
      expect(mutex.getLockDuration()).toBeNull();
    });
  });

  describe('linear type enforcement (double-release prevention)', () => {
    it('should throw when releasing token twice', async () => {
      const token = await mutex.acquire('test');
      token.release();

      expect(() => token.release()).toThrow('Lock token already released');
    });

    it('should mark token as released after release', async () => {
      const token = await mutex.acquire('test');
      expect(token.isReleased()).toBe(false);

      token.release();
      expect(token.isReleased()).toBe(true);
    });
  });

  describe('runExclusive', () => {
    it('should execute function with lock held', async () => {
      let wasLocked = false;

      const result = await mutex.runExclusive('test', async () => {
        wasLocked = mutex.isLocked();
        return 'success';
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('success');
      }
      expect(wasLocked).toBe(true);
      expect(mutex.isLocked()).toBe(false);
    });

    it('should release lock even if function throws', async () => {
      const result = await mutex.runExclusive('test', async () => {
        throw new Error('Test error');
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Test error');
      }
      expect(mutex.isLocked()).toBe(false);
    });

    it('should convert non-Error throws to Error', async () => {
      const result = await mutex.runExclusive('test', async () => {
        throw 'string error';
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('string error');
      }
    });
  });

  describe('concurrent access', () => {
    it('should serialize concurrent acquires', async () => {
      const order: number[] = [];

      const task = async (id: number) => {
        const token = await mutex.acquire(`task-${id}`);
        order.push(id);
        await new Promise(resolve => setTimeout(resolve, 10));
        token.release();
      };

      await Promise.all([task(1), task(2), task(3)]);

      // All tasks should complete
      expect(order).toHaveLength(3);
      // Order should be sequential (1, 2, 3) because they're serialized
      expect(order).toEqual([1, 2, 3]);
    });

    it('should queue waiting operations', async () => {
      const token1 = await mutex.acquire('first');

      // Start second acquire (will wait)
      const acquire2 = mutex.acquire('second');

      // Give time for second acquire to queue
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(mutex.getQueueLength()).toBe(1);

      token1.release();
      const token2 = await acquire2;

      expect(mutex.getQueueLength()).toBe(0);
      token2.release();
    });
  });

  describe('stress tests', () => {
    it('should not deadlock under high contention (100 concurrent ops)', async () => {
      const results: number[] = [];
      const numOps = 100;

      const operations = Array.from({ length: numOps }, (_, i) =>
        mutex.runExclusive(`op-${i}`, async () => {
          results.push(i);
          return i;
        })
      );

      const allResults = await Promise.all(operations);

      // All operations should complete
      expect(results).toHaveLength(numOps);
      expect(allResults.every(r => r.success)).toBe(true);

      // Mutex should be unlocked
      expect(mutex.isLocked()).toBe(false);
      expect(mutex.getQueueLength()).toBe(0);
    });

    it('should handle rapid acquire/release cycles', async () => {
      const cycles = 50;

      for (let i = 0; i < cycles; i++) {
        const token = await mutex.acquire(`cycle-${i}`);
        expect(mutex.isLocked()).toBe(true);
        token.release();
        expect(mutex.isLocked()).toBe(false);
      }
    });

    it('should handle mixed sync/async operations', async () => {
      const results: string[] = [];

      const asyncOp = async (id: string) => {
        return mutex.runExclusive(id, async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
          results.push(id);
          return id;
        });
      };

      const syncOp = async (id: string) => {
        return mutex.runExclusive(id, async () => {
          results.push(id);
          return id;
        });
      };

      await Promise.all([
        asyncOp('async-1'),
        syncOp('sync-1'),
        asyncOp('async-2'),
        syncOp('sync-2'),
        asyncOp('async-3'),
      ]);

      expect(results).toHaveLength(5);
      expect(mutex.isLocked()).toBe(false);
    });
  });
});

describe('SafeKeyedMutex', () => {
  let keyedMutex: SafeKeyedMutex;

  beforeEach(() => {
    keyedMutex = new SafeKeyedMutex();
  });

  describe('basic operations', () => {
    it('should start with no keys', () => {
      expect(keyedMutex.getKeys()).toHaveLength(0);
    });

    it('should create mutex on first acquire', async () => {
      const token = await keyedMutex.acquire('server-1');

      expect(keyedMutex.getKeys()).toContain('server-1');
      expect(keyedMutex.isLocked('server-1')).toBe(true);

      token.release();
    });

    it('should track multiple keys independently', async () => {
      const token1 = await keyedMutex.acquire('server-1');
      const token2 = await keyedMutex.acquire('server-2');

      expect(keyedMutex.isLocked('server-1')).toBe(true);
      expect(keyedMutex.isLocked('server-2')).toBe(true);
      expect(keyedMutex.getKeys()).toHaveLength(2);

      token1.release();
      expect(keyedMutex.isLocked('server-1')).toBe(false);
      expect(keyedMutex.isLocked('server-2')).toBe(true);

      token2.release();
    });

    it('should return false for non-existent key', () => {
      expect(keyedMutex.isLocked('non-existent')).toBe(false);
      expect(keyedMutex.getLockHolder('non-existent')).toBeNull();
      expect(keyedMutex.getQueueLength('non-existent')).toBe(0);
    });
  });

  describe('runExclusive', () => {
    it('should execute function with key-specific lock', async () => {
      const result = await keyedMutex.runExclusive('server-1', async () => {
        expect(keyedMutex.isLocked('server-1')).toBe(true);
        return 'done';
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('done');
      }
      expect(keyedMutex.isLocked('server-1')).toBe(false);
    });

    it('should allow parallel operations on different keys', async () => {
      const startTimes: Record<string, number> = {};
      const endTimes: Record<string, number> = {};

      const operation = async (key: string, duration: number) => {
        return keyedMutex.runExclusive(key, async () => {
          startTimes[key] = Date.now();
          await new Promise(resolve => setTimeout(resolve, duration));
          endTimes[key] = Date.now();
          return key;
        });
      };

      // Start operations on different keys simultaneously
      await Promise.all([
        operation('key-1', 50),
        operation('key-2', 50),
        operation('key-3', 50),
      ]);

      // All should have started around the same time (parallel execution)
      const starts = Object.values(startTimes);
      const maxStartDiff = Math.max(...starts) - Math.min(...starts);

      // Allow some tolerance for scheduling
      expect(maxStartDiff).toBeLessThan(30);
    });

    it('should serialize operations on same key', async () => {
      const order: number[] = [];

      const operation = async (id: number) => {
        return keyedMutex.runExclusive('same-key', async () => {
          order.push(id);
          await new Promise(resolve => setTimeout(resolve, 10));
          return id;
        });
      };

      await Promise.all([
        operation(1),
        operation(2),
        operation(3),
      ]);

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('cleanup', () => {
    it('should clear single key', async () => {
      const token = await keyedMutex.acquire('server-1');
      token.release();

      expect(keyedMutex.getKeys()).toContain('server-1');

      keyedMutex.clear('server-1');

      expect(keyedMutex.getKeys()).not.toContain('server-1');
    });

    it('should clear all keys', async () => {
      const token1 = await keyedMutex.acquire('server-1');
      const token2 = await keyedMutex.acquire('server-2');
      token1.release();
      token2.release();

      expect(keyedMutex.getKeys()).toHaveLength(2);

      keyedMutex.clearAll();

      expect(keyedMutex.getKeys()).toHaveLength(0);
    });
  });

  describe('diagnostics', () => {
    it('should provide diagnostic info for all locks', async () => {
      const token1 = await keyedMutex.acquire('server-1');
      await keyedMutex.acquire('server-2');
      token1.release();

      const diagnostics = keyedMutex.getDiagnostics();

      expect(diagnostics).toHaveLength(2);

      const server1 = diagnostics.find(d => d.key === 'server-1');
      expect(server1?.locked).toBe(false);

      const server2 = diagnostics.find(d => d.key === 'server-2');
      expect(server2?.locked).toBe(true);
      expect(server2?.holder).toBe('server-2');
    });
  });

  describe('stress tests', () => {
    it('should handle 100 concurrent operations across 10 keys', async () => {
      const numKeys = 10;
      const opsPerKey = 10;
      const results: string[] = [];

      const operations: Promise<any>[] = [];

      for (let keyIdx = 0; keyIdx < numKeys; keyIdx++) {
        for (let opIdx = 0; opIdx < opsPerKey; opIdx++) {
          operations.push(
            keyedMutex.runExclusive(`key-${keyIdx}`, async () => {
              const id = `key-${keyIdx}-op-${opIdx}`;
              results.push(id);
              return id;
            })
          );
        }
      }

      const allResults = await Promise.all(operations);

      expect(results).toHaveLength(numKeys * opsPerKey);
      expect(allResults.every(r => r.success)).toBe(true);

      // All mutexes should be unlocked
      for (let keyIdx = 0; keyIdx < numKeys; keyIdx++) {
        expect(keyedMutex.isLocked(`key-${keyIdx}`)).toBe(false);
      }
    });

    it('should not leak tokens on error', async () => {
      const numOps = 20;

      const operations = Array.from({ length: numOps }, (_, i) =>
        keyedMutex.runExclusive('error-key', async () => {
          if (i % 2 === 0) {
            throw new Error(`Error ${i}`);
          }
          return i;
        })
      );

      await Promise.all(operations);

      // Mutex should be unlocked despite errors
      expect(keyedMutex.isLocked('error-key')).toBe(false);
      expect(keyedMutex.getQueueLength('error-key')).toBe(0);
    });
  });
});

describe('LockToken', () => {
  it('should track key', async () => {
    const mutex = new SafeMutex();
    const token = await mutex.acquire('my-key');

    expect(token.key).toBe('my-key');

    token.release();
  });

  it('should prevent reuse after release', async () => {
    const mutex = new SafeMutex();
    const token = await mutex.acquire('test');

    token.release();

    expect(token.isReleased()).toBe(true);
    expect(() => token.release()).toThrow();
  });
});
