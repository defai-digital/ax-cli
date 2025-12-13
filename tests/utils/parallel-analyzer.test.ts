import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parallelLimit,
  analyzeFilesParallel,
  analyzeFilesParallelSafe,
  getOptimalBatchSize,
  estimateParallelSpeedup,
} from '../../packages/core/src/utils/parallel-analyzer.js';

describe('parallelLimit', () => {
  // Helper to simulate async operations with controllable delays
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  describe('order preservation', () => {
    it('should preserve input order when completion order differs', async () => {
      // Arrange: Items complete in reverse order (5 fastest, 1 slowest)
      const items = [1, 2, 3, 4, 5];
      const processor = async (n: number) => {
        await delay((6 - n) * 10); // Reverse completion order
        return n * 10;
      };

      // Act
      const results = await parallelLimit(items, processor, 5);

      // Assert: Results should match INPUT order, not completion order
      expect(results).toEqual([10, 20, 30, 40, 50]);
    });

    it('should preserve order with mixed completion times', async () => {
      // Arrange: Third item completes first
      const items = ['a', 'b', 'c', 'd', 'e'];
      const processor = async (item: string) => {
        const delays = { a: 100, b: 80, c: 10, d: 60, e: 40 };
        await delay(delays[item as keyof typeof delays]);
        return item.toUpperCase();
      };

      // Act
      const results = await parallelLimit(items, processor, 3);

      // Assert
      expect(results).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it('should preserve order with concurrency of 1', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = async (n: number) => {
        await delay(5); // Small delay
        return n * 2;
      };

      const results = await parallelLimit(items, processor, 1);

      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it('should preserve order with concurrency equal to array length', async () => {
      const items = [1, 2, 3];
      const processor = async (n: number) => {
        await delay((4 - n) * 5); // 3 completes first
        return n * 3;
      };

      const results = await parallelLimit(items, processor, 3);

      expect(results).toEqual([3, 6, 9]);
    });

    it('should preserve order with concurrency greater than array length', async () => {
      const items = [1, 2];
      const processor = async (n: number) => {
        await delay(n * 5);
        return n * 4;
      };

      const results = await parallelLimit(items, processor, 10);

      expect(results).toEqual([4, 8]);
    });
  });

  describe('concurrency control', () => {
    it('should respect concurrency limit', async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const items = [1, 2, 3, 4, 5, 6, 7, 8];
      const processor = async (n: number) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await delay(20);
        currentConcurrent--;
        return n;
      };

      await parallelLimit(items, processor, 3);

      expect(maxConcurrent).toBe(3);
    });

    it('should process all items even with low concurrency', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = async (n: number) => {
        await delay(5);
        return n * 5;
      };

      const results = await parallelLimit(items, processor, 2);

      expect(results).toEqual([5, 10, 15, 20, 25]);
      expect(results.length).toBe(items.length);
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', async () => {
      const results = await parallelLimit([], async (x) => x, 3);
      expect(results).toEqual([]);
    });

    it('should handle single item', async () => {
      const results = await parallelLimit([42], async (x) => x * 2, 3);
      expect(results).toEqual([84]);
    });

    it('should handle processor returning undefined', async () => {
      const items = [1, 2, 3];
      const processor = async () => undefined;

      const results = await parallelLimit(items, processor, 2);

      expect(results).toEqual([undefined, undefined, undefined]);
      expect(results.length).toBe(3);
    });

    it('should handle processor returning null', async () => {
      const items = [1, 2, 3];
      const processor = async () => null;

      const results = await parallelLimit(items, processor, 2);

      expect(results).toEqual([null, null, null]);
    });

    it('should handle processor returning objects', async () => {
      const items = [1, 2, 3];
      const processor = async (n: number) => {
        await delay(5);
        return { id: n, value: n * 10 };
      };

      const results = await parallelLimit(items, processor, 2);

      expect(results).toEqual([
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 },
      ]);
    });

    it('should handle large arrays', async () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      const processor = async (n: number) => n * 2;

      const results = await parallelLimit(items, processor, 10);

      expect(results.length).toBe(100);
      expect(results[0]).toBe(0);
      expect(results[50]).toBe(100);
      expect(results[99]).toBe(198);
    });
  });

  describe('error handling', () => {
    it('should propagate errors from processor', async () => {
      const items = [1, 2, 3];
      const processor = async (n: number) => {
        if (n === 2) throw new Error('Test error');
        return n * 10;
      };

      await expect(parallelLimit(items, processor, 2)).rejects.toThrow('Test error');
    });

    it('should stop processing on first error', async () => {
      let processed = 0;
      const items = [1, 2, 3, 4, 5];
      const processor = async (n: number) => {
        processed++;
        if (n === 2) throw new Error('Early error');
        await delay(50); // Delay to allow other promises to start
        return n;
      };

      await expect(parallelLimit(items, processor, 3)).rejects.toThrow('Early error');

      // Should have started processing some items before error
      expect(processed).toBeGreaterThan(0);
    });
  });

  describe('processor types', () => {
    it('should work with string transformation', async () => {
      const items = ['hello', 'world', 'test'];
      const processor = async (s: string) => {
        await delay(5);
        return s.toUpperCase();
      };

      const results = await parallelLimit(items, processor, 2);

      expect(results).toEqual(['HELLO', 'WORLD', 'TEST']);
    });

    it('should work with number transformation', async () => {
      const items = [1, 2, 3, 4];
      const processor = async (n: number) => {
        await delay(5);
        return n ** 2;
      };

      const results = await parallelLimit(items, processor, 2);

      expect(results).toEqual([1, 4, 9, 16]);
    });

    it('should work with complex transformations', async () => {
      const items = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
      ];

      const processor = async (user: typeof items[0]) => {
        await delay(5);
        return {
          ...user,
          upperName: user.name.toUpperCase(),
        };
      };

      const results = await parallelLimit(items, processor, 2);

      expect(results).toEqual([
        { id: 1, name: 'Alice', upperName: 'ALICE' },
        { id: 2, name: 'Bob', upperName: 'BOB' },
        { id: 3, name: 'Charlie', upperName: 'CHARLIE' },
      ]);
    });
  });

  describe('timing and performance', () => {
    it('should complete faster with higher concurrency', async () => {
      const items = [1, 2, 3, 4, 5, 6];
      const processor = async (n: number) => {
        await delay(50);
        return n;
      };

      // Sequential (concurrency 1): ~300ms (6 * 50ms)
      const start1 = Date.now();
      await parallelLimit(items, processor, 1);
      const duration1 = Date.now() - start1;

      // Parallel (concurrency 3): ~100ms (2 batches * 50ms)
      const start3 = Date.now();
      await parallelLimit(items, processor, 3);
      const duration3 = Date.now() - start3;

      // Parallel should be faster (generous margin for CI/loaded systems)
      // Use 0.9x instead of 0.7x to avoid flakiness on slower systems
      expect(duration3).toBeLessThan(duration1 * 0.9);
    });
  });

  describe('regression test for Bug #16', () => {
    it('should maintain order when items complete out of sequence (Bug #16)', async () => {
      // This test specifically validates the fix for Bug #16
      // where .push() in concurrent callbacks lost order

      const completionOrder: number[] = [];
      const items = [0, 1, 2, 3, 4];

      const processor = async (n: number) => {
        // Create intentionally reversed completion order
        const delays = [100, 80, 60, 40, 20]; // 4 completes first, 0 last
        await delay(delays[n]);

        // Track actual completion order
        completionOrder.push(n);

        return n * 100;
      };

      const results = await parallelLimit(items, processor, 5);

      // Completion order should be reversed: [4, 3, 2, 1, 0]
      expect(completionOrder).toEqual([4, 3, 2, 1, 0]);

      // But results should match INPUT order: [0, 100, 200, 300, 400]
      expect(results).toEqual([0, 100, 200, 300, 400]);

      // Explicitly verify each index
      expect(results[0]).toBe(0);
      expect(results[1]).toBe(100);
      expect(results[2]).toBe(200);
      expect(results[3]).toBe(300);
      expect(results[4]).toBe(400);
    });

    it('should use indexed storage not push (Bug #16 root cause)', async () => {
      // Verify the array is pre-allocated with correct size
      const items = [1, 2, 3];

      const processor = async (n: number) => {
        await delay(5);
        return n;
      };

      const results = await parallelLimit(items, processor, 3);

      // Array should have been pre-allocated
      expect(results.length).toBe(items.length);

      // All positions should be filled (no undefined gaps)
      results.forEach((result, index) => {
        expect(result).toBe(index + 1);
      });
    });
  });
});

describe('analyzeFilesParallel', () => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array for empty input', async () => {
    const analyzer = vi.fn();
    const result = await analyzeFilesParallel([], analyzer);
    expect(result).toEqual([]);
    expect(analyzer).not.toHaveBeenCalled();
  });

  it('should analyze all files', async () => {
    const files = ['file1.ts', 'file2.ts', 'file3.ts'];
    const analyzer = vi.fn().mockImplementation(async (file: string) => `analyzed-${file}`);

    const results = await analyzeFilesParallel(files, analyzer);

    expect(results).toHaveLength(3);
    expect(results).toContain('analyzed-file1.ts');
    expect(results).toContain('analyzed-file2.ts');
    expect(results).toContain('analyzed-file3.ts');
    expect(analyzer).toHaveBeenCalledTimes(3);
  });

  it('should call onProgress callback', async () => {
    const files = ['f1', 'f2', 'f3'];
    const onProgress = vi.fn();
    const analyzer = vi.fn().mockResolvedValue('done');

    await analyzeFilesParallel(files, analyzer, { onProgress, batchSize: 1 });

    expect(onProgress).toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(expect.any(Number), 3);
  });

  it('should call onBatchStart and onBatchEnd callbacks', async () => {
    const files = ['f1', 'f2'];
    const onBatchStart = vi.fn();
    const onBatchEnd = vi.fn();
    const analyzer = vi.fn().mockResolvedValue('done');

    await analyzeFilesParallel(files, analyzer, {
      batchSize: 1,
      onBatchStart,
      onBatchEnd,
    });

    expect(onBatchStart).toHaveBeenCalled();
    expect(onBatchEnd).toHaveBeenCalled();
  });

  it('should stop on error when stopOnError is true', async () => {
    const files = ['f1', 'f2', 'f3'];
    const error = new Error('Test error');
    const onError = vi.fn();

    const analyzer = vi.fn()
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(error);

    await expect(
      analyzeFilesParallel(files, analyzer, { stopOnError: true, batchSize: 1, onError })
    ).rejects.toThrow('Test error');

    expect(onError).toHaveBeenCalledWith('f2', error);
  });

  it('should respect batchSize option', async () => {
    const files = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'];
    const onBatchStart = vi.fn();
    const analyzer = vi.fn().mockResolvedValue('done');

    await analyzeFilesParallel(files, analyzer, { batchSize: 2, onBatchStart });

    // With batch size 2, should have 3 batches
    expect(onBatchStart).toHaveBeenCalledTimes(3);
  });

  it('should respect maxConcurrency option', async () => {
    const files = ['f1', 'f2', 'f3', 'f4'];
    const analyzer = vi.fn().mockImplementation(async (file: string) => file);

    await analyzeFilesParallel(files, analyzer, { maxConcurrency: 2 });

    expect(analyzer).toHaveBeenCalledTimes(4);
  });
});

describe('analyzeFilesParallelSafe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty result for empty input', async () => {
    const analyzer = vi.fn();
    const result = await analyzeFilesParallelSafe([], analyzer);

    expect(result.results).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.stats.total).toBe(0);
    expect(result.stats.completed).toBe(0);
    expect(result.stats.failed).toBe(0);
    expect(result.stats.durationMs).toBe(0);
  });

  it('should return results and stats for successful analysis', async () => {
    const files = ['f1', 'f2', 'f3'];
    const analyzer = vi.fn().mockImplementation(async (file: string) => `result-${file}`);

    const result = await analyzeFilesParallelSafe(files, analyzer, { batchSize: 1 });

    expect(result.results).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
    expect(result.stats.total).toBe(3);
    expect(result.stats.completed).toBe(3);
    expect(result.stats.failed).toBe(0);
    expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should collect errors without stopping by default', async () => {
    const files = ['f1', 'f2', 'f3'];
    const error = new Error('Test error');

    const analyzer = vi.fn()
      .mockResolvedValueOnce('ok1')
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('ok3');

    const result = await analyzeFilesParallelSafe(files, analyzer, { batchSize: 1 });

    expect(result.results).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toBe('f2');
    expect(result.errors[0].error).toBe(error);
    expect(result.stats.failed).toBe(1);
  });

  it('should call onError callback for errors', async () => {
    const files = ['f1', 'f2'];
    const error = new Error('Test error');
    const onError = vi.fn();

    const analyzer = vi.fn()
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(error);

    await analyzeFilesParallelSafe(files, analyzer, { batchSize: 1, onError });

    expect(onError).toHaveBeenCalledWith('f2', error);
  });

  it('should call onProgress callback for both successes and failures', async () => {
    const files = ['f1', 'f2'];
    const onProgress = vi.fn();

    const analyzer = vi.fn()
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(new Error('fail'));

    await analyzeFilesParallelSafe(files, analyzer, { batchSize: 1, onProgress });

    // Should be called for both success and failure
    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it('should call onBatchStart and onBatchEnd callbacks', async () => {
    const files = ['f1', 'f2'];
    const onBatchStart = vi.fn();
    const onBatchEnd = vi.fn();
    const analyzer = vi.fn().mockResolvedValue('done');

    await analyzeFilesParallelSafe(files, analyzer, {
      batchSize: 1,
      onBatchStart,
      onBatchEnd,
    });

    expect(onBatchStart).toHaveBeenCalled();
    expect(onBatchEnd).toHaveBeenCalled();
  });

  it('should stop early when stopOnError is true', async () => {
    const files = ['f1', 'f2', 'f3'];
    const error = new Error('Stop error');

    const analyzer = vi.fn()
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(error);

    const result = await analyzeFilesParallelSafe(files, analyzer, {
      batchSize: 1,
      stopOnError: true,
    });

    // Should have stopped after error
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe(error);
  });
});

describe('getOptimalBatchSize', () => {
  it('should return at least 1', () => {
    expect(getOptimalBatchSize(0, 4)).toBe(1);
    expect(getOptimalBatchSize(1, 4)).toBe(1);
  });

  it('should calculate batch size based on CPU count', () => {
    // 100 files, 4 CPUs -> target 12 batches -> batch size ~9
    const batchSize = getOptimalBatchSize(100, 4);
    expect(batchSize).toBeGreaterThanOrEqual(1);
    expect(batchSize).toBeLessThanOrEqual(100);
  });

  it('should scale with file count', () => {
    const small = getOptimalBatchSize(10, 4);
    const large = getOptimalBatchSize(1000, 4);
    expect(large).toBeGreaterThan(small);
  });

  it('should use auto-detected CPU count when not specified', () => {
    const batchSize = getOptimalBatchSize(100);
    expect(batchSize).toBeGreaterThanOrEqual(1);
  });
});

describe('estimateParallelSpeedup', () => {
  it('should return zero values for empty input', () => {
    const result = estimateParallelSpeedup(0, 100, 4);
    expect(result.sequentialTime).toBe(0);
    expect(result.parallelTime).toBe(0);
    expect(result.speedup).toBe(0);
  });

  it('should calculate sequential time correctly', () => {
    const result = estimateParallelSpeedup(10, 100, 4);
    expect(result.sequentialTime).toBe(1000); // 10 files * 100ms
  });

  it('should calculate parallel time correctly', () => {
    const result = estimateParallelSpeedup(8, 100, 4);
    expect(result.parallelTime).toBe(200); // ceil(8/4) * 100 = 2 * 100
  });

  it('should calculate speedup correctly', () => {
    const result = estimateParallelSpeedup(8, 100, 4);
    expect(result.speedup).toBe(4); // 800/200 = 4x speedup
  });

  it('should calculate efficiency correctly', () => {
    const result = estimateParallelSpeedup(8, 100, 4);
    expect(result.efficiency).toBe(1); // 4/4 = 100% efficiency
  });

  it('should handle edge case with negative values', () => {
    const result = estimateParallelSpeedup(-5, -100, -4);
    expect(result.sequentialTime).toBe(0);
    expect(result.parallelTime).toBe(0);
    expect(result.speedup).toBe(0);
    expect(result.efficiency).toBe(0);
  });

  it('should use auto-detected CPU count when not specified', () => {
    const result = estimateParallelSpeedup(100, 10);
    expect(result.speedup).toBeGreaterThan(0);
  });

  it('should have diminishing returns for non-divisible file counts', () => {
    // 10 files on 4 CPUs = ceil(10/4) = 3 batches
    const result = estimateParallelSpeedup(10, 100, 4);
    expect(result.parallelTime).toBe(300); // 3 * 100
    expect(result.speedup).toBeCloseTo(3.33, 1); // 1000/300
  });
});
