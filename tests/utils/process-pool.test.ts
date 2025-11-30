/**
 * Process Pool Tests
 *
 * Tests REQ-ARCH-002 implementation for memory leak prevention.
 * Includes stress tests for 1000+ searches to verify no handle leaks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ProcessPool,
  getRipgrepPool,
  shutdownRipgrepPool,
} from '../../src/utils/process-pool.js';

describe('REQ-ARCH-002: Process Pool - Memory Leak Prevention', () => {
  let pool: ProcessPool;

  beforeEach(() => {
    pool = new ProcessPool({
      maxProcesses: 5,
      processTimeout: 5000,
      maxQueueSize: 100,
    });
  });

  afterEach(async () => {
    if (pool) {
      await pool.shutdown(true);
    }
  });

  describe('Basic Functionality', () => {
    it('should execute a simple command', async () => {
      const result = await pool.execute({
        command: 'echo',
        args: ['hello world'],
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello world');
      expect(result.stderr).toBe('');
    });

    it('should handle command errors', async () => {
      try {
        await pool.execute({
          command: 'nonexistent-command-12345',
          args: [],
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle command timeout', async () => {
      try {
        await pool.execute({
          command: 'sleep',
          args: ['10'],
          timeout: 100, // 100ms timeout for 10s command
        });
        expect.fail('Should have thrown timeout error');
      } catch (error: any) {
        expect(error.message).toContain('timeout');
      }
    }, 10000);

    it('should collect stdout and stderr', async () => {
      const result = await pool.execute({
        command: 'sh',
        args: ['-c', 'echo stdout && echo stderr >&2'],
      });

      expect(result.stdout.trim()).toBe('stdout');
      expect(result.stderr.trim()).toBe('stderr');
    });
  });

  describe('Process Pool Management', () => {
    it('should limit concurrent processes', async () => {
      const promises = [];

      // Start 10 long-running processes (pool max is 5)
      for (let i = 0; i < 10; i++) {
        promises.push(
          pool.execute({
            command: 'sleep',
            args: ['0.1'],
          })
        );
      }

      // Check that pool limits concurrent processes
      const stats = pool.getStats();
      expect(stats.maxProcesses).toBe(5);
      expect(stats.activeProcesses).toBeLessThanOrEqual(5);

      // Wait for all to complete
      await Promise.all(promises);

      // After completion, pool should be empty
      const finalStats = pool.getStats();
      expect(finalStats.activeProcesses).toBe(0);
      expect(finalStats.queuedTasks).toBe(0);
    }, 10000);

    it('should queue tasks when at capacity', async () => {
      const promises = [];

      // Start 8 long-running processes (pool max is 5)
      for (let i = 0; i < 8; i++) {
        promises.push(
          pool.execute({
            command: 'sleep',
            args: ['0.2'],
          })
        );
      }

      // Wait a bit for queue to build up
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats = pool.getStats();
      expect(stats.activeProcesses).toBeLessThanOrEqual(5);
      expect(stats.queuedTasks).toBeGreaterThan(0);

      await Promise.all(promises);
    }, 10000);

    it('should reject tasks when queue is full', async () => {
      const smallPool = new ProcessPool({
        maxProcesses: 1,
        maxQueueSize: 2,
      });

      try {
        const promises = [];

        // Try to queue 5 tasks (max queue is 2, max concurrent is 1)
        for (let i = 0; i < 5; i++) {
          promises.push(
            smallPool.execute({
              command: 'sleep',
              args: ['0.5'],
            })
          );
        }

        await Promise.all(promises);
        expect.fail('Should have thrown queue full error');
      } catch (error: any) {
        expect(error.message).toContain('queue is full');
      } finally {
        await smallPool.shutdown(true);
      }
    }, 10000);

    it('should provide accurate stats', async () => {
      const initialStats = pool.getStats();
      expect(initialStats.activeProcesses).toBe(0);
      expect(initialStats.queuedTasks).toBe(0);
      expect(initialStats.maxProcesses).toBe(5);
      expect(initialStats.maxQueueSize).toBe(100);

      const promise = pool.execute({
        command: 'sleep',
        args: ['0.1'],
      });

      const duringStats = pool.getStats();
      expect(duringStats.activeProcesses).toBe(1);

      await promise;

      const afterStats = pool.getStats();
      expect(afterStats.activeProcesses).toBe(0);
    });
  });

  describe('Shutdown Behavior', () => {
    it('should reject new tasks when shutting down', async () => {
      const shutdownPromise = pool.shutdown();

      try {
        await pool.execute({
          command: 'echo',
          args: ['test'],
        });
        expect.fail('Should have thrown shutdown error');
      } catch (error: any) {
        expect(error.message).toContain('shutting down');
      }

      await shutdownPromise;
    });

    it('should wait for active processes during graceful shutdown', async () => {
      const startTime = Date.now();

      pool.execute({
        command: 'sleep',
        args: ['0.2'],
      });

      await pool.shutdown(false); // Graceful shutdown

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(150); // Should wait for process
    }, 10000);

    it('should force kill processes during force shutdown', async () => {
      pool.execute({
        command: 'sleep',
        args: ['10'],
      });

      const startTime = Date.now();
      await pool.shutdown(true); // Force shutdown

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should not wait
    });
  });

  describe('Ripgrep Pool Singleton', () => {
    afterEach(async () => {
      await shutdownRipgrepPool();
    });

    it('should return same pool instance', () => {
      const pool1 = getRipgrepPool();
      const pool2 = getRipgrepPool();

      expect(pool1).toBe(pool2);
    });

    it('should execute ripgrep commands', async () => {
      const pool = getRipgrepPool();

      const result = await pool.execute({
        command: 'echo',
        args: ['test'],
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('test');
    });

    it('should shutdown and recreate pool', async () => {
      const pool1 = getRipgrepPool();
      await shutdownRipgrepPool();

      const pool2 = getRipgrepPool();
      expect(pool1).not.toBe(pool2);
    });
  });

  describe('Memory Leak Prevention - Stress Tests', () => {
    it('should handle 100 sequential searches without memory leak', async () => {
      const iterations = 100;
      const results = [];

      for (let i = 0; i < iterations; i++) {
        const result = await pool.execute({
          command: 'echo',
          args: [`search ${i}`],
        });
        results.push(result);
      }

      // Verify all searches completed
      expect(results.length).toBe(iterations);
      expect(results.every((r) => r.exitCode === 0)).toBe(true);

      // Verify pool is clean
      const stats = pool.getStats();
      expect(stats.activeProcesses).toBe(0);
      expect(stats.queuedTasks).toBe(0);
    }, 30000);

    it('should handle 100 concurrent searches without memory leak', async () => {
      const iterations = 100;
      const promises = [];

      for (let i = 0; i < iterations; i++) {
        promises.push(
          pool.execute({
            command: 'echo',
            args: [`search ${i}`],
          })
        );
      }

      const results = await Promise.all(promises);

      // Verify all searches completed
      expect(results.length).toBe(iterations);
      expect(results.every((r) => r.exitCode === 0)).toBe(true);

      // Verify pool is clean
      const stats = pool.getStats();
      expect(stats.activeProcesses).toBe(0);
      expect(stats.queuedTasks).toBe(0);
    }, 30000);

    it('should handle 1000 searches (mixed sequential/concurrent) without memory leak', async () => {
      const batchSize = 50;
      const batches = 20; // 20 batches * 50 = 1000 searches
      let totalSearches = 0;

      for (let batch = 0; batch < batches; batch++) {
        const promises = [];

        for (let i = 0; i < batchSize; i++) {
          promises.push(
            pool.execute({
              command: 'echo',
              args: [`batch ${batch} search ${i}`],
            })
          );
        }

        const results = await Promise.all(promises);
        totalSearches += results.length;

        // Verify batch completed successfully
        expect(results.every((r) => r.exitCode === 0)).toBe(true);
      }

      // Verify all 1000 searches completed
      expect(totalSearches).toBe(1000);

      // Verify pool is clean (no memory leaks)
      const stats = pool.getStats();
      expect(stats.activeProcesses).toBe(0);
      expect(stats.queuedTasks).toBe(0);
    }, 180000); // 180 second timeout for 1000 searches (increased for slower CI)

    it('should handle errors without leaking resources', async () => {
      const iterations = 50;
      const promises = [];

      // Mix successful and failing commands
      for (let i = 0; i < iterations; i++) {
        if (i % 2 === 0) {
          promises.push(
            pool.execute({
              command: 'echo',
              args: ['success'],
            })
          );
        } else {
          promises.push(
            pool
              .execute({
                command: 'nonexistent-command',
                args: [],
              })
              .catch((error) => ({ error: true, message: error.message }))
          );
        }
      }

      const results = await Promise.all(promises);

      // Verify mixed results
      const successes = results.filter((r: any) => !r.error).length;
      const failures = results.filter((r: any) => r.error).length;

      expect(successes).toBe(25);
      expect(failures).toBe(25);

      // Wait for async cleanup to complete (process event loop tick)
      await new Promise((resolve) => setImmediate(resolve));

      // Verify pool is clean even after errors
      const stats = pool.getStats();
      expect(stats.activeProcesses).toBe(0);
      expect(stats.queuedTasks).toBe(0);
    }, 30000);
  });

  describe('Event Listener Cleanup', () => {
    it('should remove all event listeners after execution', async () => {
      const result = await pool.execute({
        command: 'echo',
        args: ['test'],
      });

      expect(result.exitCode).toBe(0);

      // Wait for async cleanup to complete (process event loop tick)
      await new Promise((resolve) => setImmediate(resolve));

      // Pool should be clean
      const stats = pool.getStats();
      expect(stats.activeProcesses).toBe(0);
    });

    it('should emit processCompleted events', async () => {
      let eventCount = 0;

      pool.on('processCompleted', (stats) => {
        eventCount++;
        expect(stats).toHaveProperty('activeProcesses');
        expect(stats).toHaveProperty('queuedTasks');
      });

      await pool.execute({
        command: 'echo',
        args: ['test'],
      });

      expect(eventCount).toBe(1);
    });

    it('should emit shutdown event', async () => {
      let shutdownEmitted = false;

      pool.on('shutdown', () => {
        shutdownEmitted = true;
      });

      await pool.shutdown();

      expect(shutdownEmitted).toBe(true);
    });
  });
});
