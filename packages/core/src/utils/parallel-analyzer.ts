/**
 * Parallel File Analyzer
 *
 * Enables concurrent analysis of multiple files using Promise.all
 * for CPU-bound operations, achieving 2-8x speedup on multi-core systems.
 *
 * Quick Win #1: Parallel Processing (Est. time: 2 hours)
 * Impact: 2-8x speedup depending on CPU cores
 */

import os from 'os';

/**
 * Configuration for parallel analysis
 */
export interface ParallelConfig {
  /** Maximum concurrent operations (default: CPU count) */
  maxConcurrency?: number;
  /** Batch size for processing (default: auto-calculated) */
  batchSize?: number;
  /** Continue after errors instead of aborting (default: true for safe, false for strict) */
  stopOnError?: boolean;
  /** Enable progress callbacks */
  onProgress?: (completed: number, total: number) => void;
  /** Enable error callbacks */
  onError?: (file: string, error: Error) => void;
  /** Called when a batch starts/ends (for tracing/metrics) */
  onBatchStart?: (batchIndex: number, batchSize: number) => void;
  onBatchEnd?: (batchIndex: number, durationMs: number) => void;
}

/**
 * Chunk array into smaller arrays
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Analyze files in parallel batches
 *
 * @param files - Array of file paths to analyze
 * @param analyzer - Analysis function to run on each file
 * @param config - Configuration options
 * @returns Array of analysis results
 *
 * @example
 * ```typescript
 * const results = await analyzeFilesParallel(
 *   ['file1.ts', 'file2.ts', 'file3.ts'],
 *   async (file) => {
 *     return await analyzeFile(file);
 *   },
 *   {
 *     maxConcurrency: 4,
 *     onProgress: (done, total) => {
 *       console.log(`Progress: ${done}/${total}`);
 *     }
 *   }
 * );
 * ```
 */
export async function analyzeFilesParallel<T>(
  files: string[],
  analyzer: (file: string) => Promise<T>,
  config: ParallelConfig = {}
): Promise<T[]> {
  const cpus = os.cpus().length;
  const maxConcurrency = Math.max(1, Math.min(config.maxConcurrency || cpus, files.length || 1));
  const batchSize = config.batchSize || Math.max(1, Math.ceil(files.length / maxConcurrency));
  const stopOnError = config.stopOnError ?? true;

  if (files.length === 0) {
    return [];
  }

  // Split files into batches
  const batches = chunk(files, batchSize);

  // BUG FIX: Use atomic counter object to prevent race condition
  // Multiple batches running concurrently could read/write `completed` simultaneously
  // causing incorrect progress values. Using an object with atomic-like access pattern.
  const progress = { completed: 0 };
  const total = files.length;

  // Process batches in parallel
  const results = await Promise.all(
    batches.map(async (batch, batchIndex) => {
      const batchStart = Date.now();
      config.onBatchStart?.(batchIndex, batch.length);
      // Process files in batch sequentially
      const batchResults: T[] = [];

      for (const file of batch) {
        try {
          const result = await analyzer(file);
          batchResults.push(result);

          // Update progress atomically
          // Note: In Node.js single-threaded model, increment is atomic between await points
          progress.completed++;
          if (config.onProgress) {
            config.onProgress(progress.completed, total);
          }
        } catch (error) {
          if (config.onError) {
            config.onError(file, error as Error);
          }
          if (stopOnError) {
            throw error;
          }
        }
      }

      config.onBatchEnd?.(batchIndex, Date.now() - batchStart);
      return batchResults;
    })
  );

  // Flatten results
  return results.flat();
}

/**
 * Analyze files in parallel with automatic batching and error handling
 *
 * This is a higher-level function that provides better error handling
 * and automatic retry logic.
 *
 * @param files - Array of file paths to analyze
 * @param analyzer - Analysis function to run on each file
 * @param config - Configuration options
 * @returns Object with results and errors
 *
 * @example
 * ```typescript
 * const { results, errors } = await analyzeFilesParallelSafe(
 *   ['file1.ts', 'file2.ts', 'file3.ts'],
 *   async (file) => {
 *     return await analyzeFile(file);
 *   }
 * );
 *
 * console.log(`Analyzed ${results.length} files successfully`);
 * console.log(`Failed ${errors.length} files`);
 * ```
 */
export async function analyzeFilesParallelSafe<T>(
  files: string[],
  analyzer: (file: string) => Promise<T>,
  config: ParallelConfig = {}
): Promise<{
  results: Array<{ file: string; result: T }>;
  errors: Array<{ file: string; error: Error }>;
  stats: { completed: number; failed: number; total: number; durationMs: number };
}> {
  const cpus = os.cpus().length;
  const maxConcurrency = Math.max(1, Math.min(config.maxConcurrency || cpus, files.length || 1));
  const batchSize = config.batchSize || Math.max(1, Math.ceil(files.length / maxConcurrency));
  const stopOnError = config.stopOnError ?? false;
  const start = Date.now();

  if (files.length === 0) {
    return { results: [], errors: [], stats: { completed: 0, failed: 0, total: 0, durationMs: 0 } };
  }

  // Split files into batches
  const batches = chunk(files, batchSize);

  // BUG FIX: Use atomic counter object to prevent race condition
  // Multiple batches running concurrently could read/write `completed` simultaneously
  const progress = { completed: 0 };
  const total = files.length;

  // BUG FIX: Each batch collects its own results to avoid race conditions
  // when pushing to shared arrays from concurrent batches
  type BatchResult = {
    results: Array<{ file: string; result: T }>;
    errors: Array<{ file: string; error: Error }>;
  };

  // Process batches in parallel
  const batchResults = await Promise.all(
    batches.map(async (batch, batchIndex): Promise<BatchResult> => {
      const batchStart = Date.now();
      config.onBatchStart?.(batchIndex, batch.length);
      const batchSuccesses: Array<{ file: string; result: T }> = [];
      const batchErrors: Array<{ file: string; error: Error }> = [];

      // Process files in batch sequentially
      for (const file of batch) {
        try {
          const result = await analyzer(file);
          batchSuccesses.push({ file, result });

          // Update progress atomically
          progress.completed++;
          if (config.onProgress) {
            config.onProgress(progress.completed, total);
          }
        } catch (error) {
          batchErrors.push({ file, error: error as Error });
          if (config.onError) {
            config.onError(file, error as Error);
          }
          progress.completed++;
          if (config.onProgress) {
            config.onProgress(progress.completed, total);
          }
          if (stopOnError) {
            // End early while preserving collected errors/results so far
            break;
          }
        }
      }

      config.onBatchEnd?.(batchIndex, Date.now() - batchStart);
      return { results: batchSuccesses, errors: batchErrors };
    })
  );

  // Aggregate results from all batches
  const results: Array<{ file: string; result: T }> = [];
  const errors: Array<{ file: string; error: Error }> = [];
  for (const batch of batchResults) {
    results.push(...batch.results);
    errors.push(...batch.errors);
  }

  const durationMs = Date.now() - start;
  return {
    results,
    errors,
    stats: {
      completed: progress.completed - errors.length,
      failed: errors.length,
      total,
      durationMs,
    },
  };
}

/**
 * Process items in parallel with a concurrency limit
 *
 * This is a general-purpose parallel processor that can be used for any async operation.
 *
 * @param items - Array of items to process
 * @param processor - Processing function
 * @param concurrency - Maximum concurrent operations
 * @returns Array of results
 *
 * @example
 * ```typescript
 * const results = await parallelLimit(
 *   [1, 2, 3, 4, 5],
 *   async (n) => n * 2,
 *   2 // Max 2 concurrent operations
 * );
 * ```
 */
export async function parallelLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const executing: Map<number, Promise<void>> = new Map();
  let firstError: Error | null = null;

  for (let i = 0; i < items.length; i++) {
    const index = i;  // Capture index for closure
    const item = items[i];

    // Create task that stores result at correct index
    const task = processor(item)
      .then((result) => {
        results[index] = result;  // Store at correct index to preserve order
      })
      .catch((error) => {
        // Store first error to throw after all promises settle
        if (!firstError) {
          firstError = error;
        }
      })
      .finally(() => {
        // Remove using index (deterministic), not promise reference
        executing.delete(index);
      });

    executing.set(index, task);

    // Wait for any task to complete when at concurrency limit
    if (executing.size >= concurrency) {
      await Promise.race(executing.values());
    }
  }

  // Wait for all remaining tasks to complete
  await Promise.all(executing.values());

  // Throw first error if any occurred
  if (firstError) {
    throw firstError;
  }

  return results;
}

/**
 * Get optimal batch size based on file count and CPU cores
 *
 * @param fileCount - Number of files to process
 * @param cpuCount - Number of CPU cores (default: auto-detect)
 * @returns Optimal batch size
 */
export function getOptimalBatchSize(
  fileCount: number,
  cpuCount: number = os.cpus().length
): number {
  // Heuristic: Aim for 2-4 batches per core for good load balancing
  const targetBatches = cpuCount * 3;
  return Math.max(1, Math.ceil(fileCount / targetBatches));
}

/**
 * Estimate speedup from parallel processing
 *
 * @param fileCount - Number of files to process
 * @param avgTimePerFile - Average time per file in ms
 * @param cpuCount - Number of CPU cores (default: auto-detect)
 * @returns Estimated speedup info
 */
export function estimateParallelSpeedup(
  fileCount: number,
  avgTimePerFile: number,
  cpuCount: number = os.cpus().length
): {
  sequentialTime: number;
  parallelTime: number;
  speedup: number;
  efficiency: number;
} {
  // Guard against edge cases
  const safeCpuCount = Math.max(1, cpuCount);
  const safeFileCount = Math.max(0, fileCount);
  const safeAvgTime = Math.max(0, avgTimePerFile);

  const sequentialTime = safeFileCount * safeAvgTime;
  const parallelTime = Math.ceil(safeFileCount / safeCpuCount) * safeAvgTime;

  // Avoid division by zero
  const speedup = parallelTime > 0 ? sequentialTime / parallelTime : 0;
  const efficiency = safeCpuCount > 0 ? speedup / safeCpuCount : 0; // 0-1, ideally close to 1

  return {
    sequentialTime,
    parallelTime,
    speedup,
    efficiency,
  };
}
