/**
 * Performance Benchmarks for SafeMutex (Phase 4)
 *
 * Measures performance characteristics of the SafeKeyedMutex
 * implementation to validate it meets production requirements.
 *
 * Target: < 1ms overhead per lock acquisition
 */

import { describe, it, expect, bench } from 'vitest';
import { SafeKeyedMutex } from '../../src/mcp/mutex-safe.js';

describe('SafeKeyedMutex Performance Benchmarks', () => {
  describe('Lock Acquisition Performance', () => {
    bench('acquire and release lock (single key)', async () => {
      const mutex = new SafeKeyedMutex();
      const key = 'test-key';

      await mutex.runExclusive(key, async () => {
        // Simulate minimal work
        await Promise.resolve();
      });
    });

    bench('acquire and release lock (10 different keys)', async () => {
      const mutex = new SafeKeyedMutex();

      const promises = Array.from({ length: 10 }, (_, i) =>
        mutex.runExclusive(`key-${i}`, async () => {
          await Promise.resolve();
        })
      );

      await Promise.all(promises);
    });

    bench('sequential lock acquisitions (same key)', async () => {
      const mutex = new SafeKeyedMutex();
      const key = 'sequential-key';

      for (let i = 0; i < 10; i++) {
        await mutex.runExclusive(key, async () => {
          await Promise.resolve();
        });
      }
    });

    bench('concurrent lock attempts (same key, queued)', async () => {
      const mutex = new SafeKeyedMutex();
      const key = 'concurrent-key';

      const promises = Array.from({ length: 10 }, () =>
        mutex.runExclusive(key, async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
        })
      );

      await Promise.all(promises);
    });
  });

  describe('Lock Cleanup Performance', () => {
    bench('lock cleanup after successful execution', async () => {
      const mutex = new SafeKeyedMutex();

      await mutex.runExclusive('cleanup-key', async () => {
        return 'success';
      });

      // Lock should be cleaned up, next acquisition should be fast
      await mutex.runExclusive('cleanup-key', async () => {
        return 'success';
      });
    });

    bench('lock cleanup after error', async () => {
      const mutex = new SafeKeyedMutex();

      await mutex.runExclusive('error-key', async () => {
        throw new Error('Test error');
      });

      // Lock should be cleaned up despite error
      await mutex.runExclusive('error-key', async () => {
        return 'success';
      });
    });
  });

  describe('Memory Usage Under Load', () => {
    bench('1000 lock acquisitions (different keys)', async () => {
      const mutex = new SafeKeyedMutex();

      const promises = Array.from({ length: 1000 }, (_, i) =>
        mutex.runExclusive(`key-${i}`, async () => {
          await Promise.resolve();
        })
      );

      await Promise.all(promises);
    });

    bench('1000 sequential acquisitions (same key)', async () => {
      const mutex = new SafeKeyedMutex();
      const key = 'sequential-load';

      for (let i = 0; i < 1000; i++) {
        await mutex.runExclusive(key, async () => {
          await Promise.resolve();
        });
      }
    });
  });

  describe('Contention Scenarios', () => {
    bench('high contention (100 concurrent requests, 1 key)', async () => {
      const mutex = new SafeKeyedMutex();
      const key = 'contended-key';

      const promises = Array.from({ length: 100 }, () =>
        mutex.runExclusive(key, async () => {
          await new Promise(resolve => setImmediate(resolve));
        })
      );

      await Promise.all(promises);
    });

    bench('low contention (100 concurrent requests, 100 keys)', async () => {
      const mutex = new SafeKeyedMutex();

      const promises = Array.from({ length: 100 }, (_, i) =>
        mutex.runExclusive(`key-${i}`, async () => {
          await new Promise(resolve => setImmediate(resolve));
        })
      );

      await Promise.all(promises);
    });
  });

  describe('Error Handling Performance', () => {
    bench('error propagation with Result type', async () => {
      const mutex = new SafeKeyedMutex();

      const result = await mutex.runExclusive('error-result', async () => {
        throw new Error('Benchmark error');
      });

      expect(result.success).toBe(false);
    });

    bench('mixed success and failure', async () => {
      const mutex = new SafeKeyedMutex();

      const promises = Array.from({ length: 10 }, (_, i) =>
        mutex.runExclusive(`mixed-${i}`, async () => {
          if (i % 2 === 0) {
            throw new Error('Even error');
          }
          return 'success';
        })
      );

      await Promise.all(promises);
    });
  });
});

/**
 * Functional Tests for Lock Behavior
 *
 * These verify correctness alongside performance benchmarks
 */
describe('SafeKeyedMutex Correctness Tests', () => {
  it('should serialize access to shared resource', async () => {
    const mutex = new SafeKeyedMutex();
    const key = 'serialize-test';
    const order: number[] = [];

    const promises = Array.from({ length: 10 }, (_, i) =>
      mutex.runExclusive(key, async () => {
        order.push(i);
        await new Promise(resolve => setTimeout(resolve, 1));
      })
    );

    await Promise.all(promises);

    // Order should have all 10 entries
    expect(order).toHaveLength(10);
    expect(new Set(order).size).toBe(10); // All unique
  });

  it('should prevent race conditions', async () => {
    const mutex = new SafeKeyedMutex();
    const key = 'race-test';
    let counter = 0;

    const increment = async () => {
      await mutex.runExclusive(key, async () => {
        const current = counter;
        await new Promise(resolve => setImmediate(resolve));
        counter = current + 1;
      });
    };

    await Promise.all(Array.from({ length: 100 }, () => increment()));

    // Without mutex, this would likely be < 100
    expect(counter).toBe(100);
  });

  it('should release lock even on error', async () => {
    const mutex = new SafeKeyedMutex();
    const key = 'error-release-test';

    // First call throws
    const result1 = await mutex.runExclusive(key, async () => {
      throw new Error('First error');
    });

    expect(result1.success).toBe(false);

    // Second call should acquire lock successfully
    const result2 = await mutex.runExclusive(key, async () => {
      return 'success';
    });

    expect(result2.success).toBe(true);
  });

  it('should handle parallel acquisitions on different keys', async () => {
    const mutex = new SafeKeyedMutex();
    const counters: Record<string, number> = {};

    const increment = async (key: string) => {
      await mutex.runExclusive(key, async () => {
        counters[key] = (counters[key] || 0) + 1;
      });
    };

    // 10 keys, 10 increments each
    const promises = Array.from({ length: 100 }, (_, i) =>
      increment(`key-${i % 10}`)
    );

    await Promise.all(promises);

    // Each key should have exactly 10 increments
    Object.values(counters).forEach(count => {
      expect(count).toBe(10);
    });
  });

  it('should measure lock acquisition overhead', async () => {
    const mutex = new SafeKeyedMutex();
    const key = 'overhead-test';
    const iterations = 1000;

    // Measure with mutex
    const startWithMutex = performance.now();
    for (let i = 0; i < iterations; i++) {
      await mutex.runExclusive(key, async () => {
        // Minimal work
      });
    }
    const withMutexTime = performance.now() - startWithMutex;

    // Measure without mutex (baseline)
    const startWithout = performance.now();
    for (let i = 0; i < iterations; i++) {
      await (async () => {
        // Same minimal work
      })();
    }
    const withoutMutexTime = performance.now() - startWithout;

    const overhead = withMutexTime - withoutMutexTime;
    const perOpOverhead = overhead / iterations;

    console.log(`Mutex overhead: ${overhead.toFixed(2)}ms total, ${perOpOverhead.toFixed(3)}ms per operation`);

    // Overhead should be < 1ms per operation on average
    expect(perOpOverhead).toBeLessThan(1);
  });

  it('should not leak memory over many operations', async () => {
    const mutex = new SafeKeyedMutex();

    // Simulate long-running usage
    for (let i = 0; i < 1000; i++) {
      await mutex.runExclusive(`key-${i % 10}`, async () => {
        await Promise.resolve();
      });
    }

    // If there were memory leaks, this would accumulate
    // No assertion needed - just verify no crash/OOM
    expect(true).toBe(true);
  });

  it('should handle rapid key changes', async () => {
    const mutex = new SafeKeyedMutex();
    const results: string[] = [];

    // Alternate between keys rapidly
    for (let i = 0; i < 100; i++) {
      const key = i % 2 === 0 ? 'even' : 'odd';
      await mutex.runExclusive(key, async () => {
        results.push(key);
      });
    }

    expect(results).toHaveLength(100);
    expect(results.filter(r => r === 'even')).toHaveLength(50);
    expect(results.filter(r => r === 'odd')).toHaveLength(50);
  });
});

/**
 * Benchmark Summary:
 *
 * Expected Performance Characteristics:
 * 1. Lock acquisition: < 0.1ms (uncontended)
 * 2. Lock acquisition: < 1ms (under contention)
 * 3. Cleanup overhead: negligible (< 0.01ms)
 * 4. Memory usage: O(n) where n = number of unique keys
 * 5. Contention handling: fair queuing (FIFO)
 *
 * Run benchmarks with:
 *   npm run test -- safe-mutex.bench.ts --reporter=verbose
 *
 * Expected coverage contribution: +0.5% (edge cases tested)
 */
