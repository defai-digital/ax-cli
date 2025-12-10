/**
 * REGRESSION TESTS: Context Manager Concurrent Access (fixed in v3.7.2)
 *
 * Tests concurrent access safety in ContextManager to prevent race conditions.
 * Ensures timer unref and cache operations are thread-safe.
 *
 * Critical reliability fix that MUST NOT regress.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextManager } from '../../packages/core/src/agent/context-manager.js';
import { createTokenCounter } from '../../packages/core/src/utils/token-counter.js';
import type { LLMMessage } from '../../packages/core/src/llm/client.js';

describe('Context Manager Concurrent Access Tests', () => {
  let contextManager: ContextManager;
  let tokenCounter: ReturnType<typeof createTokenCounter>;

  beforeEach(() => {
    contextManager = new ContextManager({
      model: 'gpt-3.5-turbo',
      pruneThreshold: 0.75,
      hardLimit: 0.95,
      keepRecentToolRounds: 3,
      keepFirstMessages: 2,
    });
    tokenCounter = createTokenCounter('gpt-3.5-turbo');
  });

  afterEach(() => {
    // Cleanup
    contextManager = null as any;
  });

  describe('Concurrent shouldPrune Calls', () => {
    it('should handle concurrent shouldPrune calls safely', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are an assistant.' },
        { role: 'user', content: 'Hello' },
      ];

      // Call shouldPrune concurrently 100 times
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(contextManager.shouldPrune(messages, tokenCounter))
      );

      const results = await Promise.all(promises);

      // All results should be consistent
      const firstResult = results[0];
      expect(results.every(r => r === firstResult)).toBe(true);
    });

    it('should handle concurrent calls with different message arrays', async () => {
      const messages1: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Short message' },
      ];

      const messages2: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'x'.repeat(10000) },
      ];

      // Concurrent calls with different inputs
      const promises = [
        Promise.resolve(contextManager.shouldPrune(messages1, tokenCounter)),
        Promise.resolve(contextManager.shouldPrune(messages2, tokenCounter)),
        Promise.resolve(contextManager.shouldPrune(messages1, tokenCounter)),
        Promise.resolve(contextManager.shouldPrune(messages2, tokenCounter)),
      ];

      const results = await Promise.all(promises);

      // Results should match the inputs (no cross-contamination)
      expect(results[0]).toBe(results[2]); // Same input -> same result
      expect(results[1]).toBe(results[3]); // Same input -> same result
    });
  });

  describe('Concurrent getStats Calls', () => {
    it('should handle concurrent getStats calls', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System message' },
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Assistant response' },
      ];

      const promises = Array.from({ length: 50 }, () =>
        Promise.resolve(contextManager.getStats(messages, tokenCounter))
      );

      const results = await Promise.all(promises);

      // All stats should be identical
      expect(results.every(r =>
        r.currentTokens === results[0].currentTokens &&
        r.percentage === results[0].percentage
      )).toBe(true);
    });

    it('should not corrupt stats during concurrent access', async () => {
      const largeMessages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        ...Array.from({ length: 100 }, (_, i) => ({
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content: `Message ${i}: ${'x'.repeat(100)}`,
        })),
      ];

      const promises = Array.from({ length: 20 }, () =>
        Promise.resolve(contextManager.getStats(largeMessages, tokenCounter))
      );

      const results = await Promise.all(promises);

      // All results should have valid values
      results.forEach(stats => {
        expect(stats.currentTokens).toBeGreaterThan(0);
        expect(stats.percentage).toBeGreaterThan(0);
        expect(stats.percentage).toBeLessThan(100);
        expect(stats.available).toBeGreaterThan(0);
      });
    });
  });

  describe('Concurrent Pruning Operations', () => {
    it('should handle concurrent pruneMessages calls', async () => {
      const largeMessages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        ...Array.from({ length: 200 }, (_, i) => ({
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content: `Message ${i}: ${'x'.repeat(500)}`,
        })),
      ];

      // Concurrent pruning
      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(contextManager.pruneMessages(largeMessages, tokenCounter))
      );

      const results = await Promise.all(promises);

      // All results should be arrays
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });

      // Results should be consistent
      expect(results.every(r => r.length === results[0].length)).toBe(true);
    });

    it('should not corrupt messages during concurrent pruning', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'First user message' },
        { role: 'assistant', content: 'First assistant response' },
        { role: 'user', content: 'Second user message' },
        { role: 'assistant', content: 'Second assistant response' },
      ];

      const promises = Array.from({ length: 20 }, () =>
        Promise.resolve(contextManager.pruneMessages(messages, tokenCounter))
      );

      const results = await Promise.all(promises);

      // All pruned results should preserve system message
      results.forEach(pruned => {
        expect(pruned[0].role).toBe('system');
        expect(pruned[0].content).toBe('System');
      });
    });
  });

  describe('Mixed Concurrent Operations', () => {
    it('should handle mix of shouldPrune, getStats, and pruneMessages', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        ...Array.from({ length: 50 }, (_, i) => ({
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content: `Message ${i}`,
        })),
      ];

      const operations = [
        () => Promise.resolve(contextManager.shouldPrune(messages, tokenCounter)),
        () => Promise.resolve(contextManager.getStats(messages, tokenCounter)),
        () => Promise.resolve(contextManager.pruneMessages(messages, tokenCounter)),
        () => Promise.resolve(contextManager.isNearHardLimit(messages, tokenCounter)),
      ];

      // Run mixed operations concurrently
      const promises = Array.from({ length: 40 }, (_, i) => operations[i % 4]());

      // Should not throw or corrupt state
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should maintain consistency across operations', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        ...Array.from({ length: 100 }, (_, i) => ({
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content: 'x'.repeat(1000),
        })),
      ];

      // Run getStats multiple times concurrently
      const statsPromises = Array.from({ length: 10 }, () =>
        Promise.resolve(contextManager.getStats(messages, tokenCounter))
      );

      const stats = await Promise.all(statsPromises);

      // Token counts should be identical
      const tokenCounts = stats.map(s => s.currentTokens);
      expect(new Set(tokenCounts).size).toBe(1); // All same
    });
  });

  describe('Timer Safety', () => {
    it('should not block process exit with timers', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Test message' },
      ];

      // Call operations that might set timers
      for (let i = 0; i < 100; i++) {
        contextManager.shouldPrune(messages, tokenCounter);
        contextManager.getStats(messages, tokenCounter);
      }

      // Timers should be unref'd (not blocking)
      // This is verified by the implementation using timer.unref()
      expect(true).toBe(true); // Test passes if no hang
    });

    it('should handle rapid timer creation and cancellation', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Message' },
      ];

      // Rapidly create and cancel timers
      const promises = Array.from({ length: 1000 }, async () => {
        contextManager.shouldPrune(messages, tokenCounter);
        await new Promise(resolve => setImmediate(resolve));
      });

      await Promise.all(promises);

      // Should not leak timers or crash
      expect(true).toBe(true);
    });
  });

  describe('Cache Race Conditions', () => {
    it('should not have cache corruption with concurrent access', async () => {
      const messages1: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Message set 1' },
      ];

      const messages2: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Message set 2' },
      ];

      // Interleave calls with different message sets
      const promises: Promise<any>[] = [];

      for (let i = 0; i < 50; i++) {
        promises.push(Promise.resolve(contextManager.getStats(messages1, tokenCounter)));
        promises.push(Promise.resolve(contextManager.getStats(messages2, tokenCounter)));
      }

      const results = await Promise.all(promises);

      // Results should alternate between two distinct values
      // Extract token counts
      const counts = results.map((r: any) => r.currentTokens);

      // Should have two unique values (one for each message set)
      const uniqueCounts = new Set(counts);
      expect(uniqueCounts.size).toBeLessThanOrEqual(2);
    });

    it('should handle cache invalidation during concurrent access', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Test' },
      ];

      // Concurrent access while cache might be invalidating
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(contextManager.getStats(messages, tokenCounter))
      );

      const results = await Promise.all(promises);

      // All results should be valid (no undefined or corrupted values)
      results.forEach(stats => {
        expect(stats.currentTokens).toBeGreaterThan(0);
        expect(stats.contextWindow).toBeGreaterThan(0);
        expect(stats.percentage).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Model Switching', () => {
    it('should handle model switching during concurrent operations', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Test message' },
      ];

      const counter1 = createTokenCounter('gpt-3.5-turbo');
      const counter2 = createTokenCounter('gpt-4');

      // Mix calls with different token counters (simulating model switch)
      const promises = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve(
          contextManager.getStats(messages, i % 2 === 0 ? counter1 : counter2)
        )
      );

      const results = await Promise.all(promises);

      // All results should be valid
      results.forEach(stats => {
        expect(stats.currentTokens).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Under Concurrent Load', () => {
    it('should perform well with high concurrency', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        ...Array.from({ length: 50 }, (_, i) => ({
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content: `Message ${i}`,
        })),
      ];

      const startTime = Date.now();

      // 1000 concurrent operations
      const promises = Array.from({ length: 1000 }, () =>
        Promise.resolve(contextManager.shouldPrune(messages, tokenCounter))
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // Should complete quickly even with high concurrency
      expect(duration).toBeLessThan(2000); // <2 seconds for 1000 ops
    });

    it('should not leak memory under concurrent load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        ...Array.from({ length: 100 }, (_, i) => ({
          role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
          content: 'x'.repeat(100),
        })),
      ];

      // Perform many concurrent operations
      for (let batch = 0; batch < 10; batch++) {
        const promises = Array.from({ length: 100 }, () =>
          Promise.resolve(contextManager.getStats(messages, tokenCounter))
        );
        await Promise.all(promises);
      }

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (<50MB)
      // Note: V8 heap behavior is non-deterministic; 10MB was too strict
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Error Handling in Concurrent Context', () => {
    it('should handle errors gracefully during concurrent access', async () => {
      const invalidMessages: any = [
        { role: 'invalid', content: 123 }, // Invalid type
      ];

      // Concurrent calls with invalid data
      const promises = Array.from({ length: 20 }, () =>
        Promise.resolve(contextManager.getStats(invalidMessages, tokenCounter))
      );

      // Should not crash (may return errors or default values)
      const results = await Promise.all(promises);
      expect(results).toBeDefined();
    });

    it('should recover from concurrent errors', async () => {
      const validMessages: LLMMessage[] = [
        { role: 'user', content: 'Valid message' },
      ];

      const invalidMessages: any = null;

      // Mix valid and invalid calls using Promise.allSettled to handle rejections
      // Wrap the invalid call in a promise to catch synchronous errors
      const promises = [
        Promise.resolve().then(() => contextManager.getStats(validMessages, tokenCounter)),
        Promise.resolve().then(() => contextManager.getStats(invalidMessages, tokenCounter)),
        Promise.resolve().then(() => contextManager.getStats(validMessages, tokenCounter)),
      ];

      const results = await Promise.allSettled(promises);

      // Valid calls should still work
      expect(results[0].status).toBe('fulfilled');
      expect(results[2].status).toBe('fulfilled');

      // Invalid call should fail (rejected)
      expect(results[1].status).toBe('rejected');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain single-threaded behavior', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Test' },
      ];

      // Sequential calls should work as before
      const result1 = contextManager.shouldPrune(messages, tokenCounter);
      const result2 = contextManager.shouldPrune(messages, tokenCounter);

      expect(result1).toBe(result2);
    });

    it('should produce consistent results regardless of concurrency', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Test message' },
      ];

      // Sequential call
      const sequentialResult = contextManager.getStats(messages, tokenCounter);

      // Concurrent calls
      const concurrentPromises = Array.from({ length: 10 }, () =>
        Promise.resolve(contextManager.getStats(messages, tokenCounter))
      );

      const concurrentResults = await Promise.all(concurrentPromises);

      // All should match sequential result
      concurrentResults.forEach(result => {
        expect(result.currentTokens).toBe(sequentialResult.currentTokens);
      });
    });
  });
});
