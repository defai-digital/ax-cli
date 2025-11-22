/**
 * Streaming Analyzer
 *
 * Emits analysis results as they're found instead of waiting for all files.
 * Provides better user experience with immediate feedback.
 *
 * Quick Win #3: Streaming Results (Est. time: 30 minutes)
 * Impact: Better UX, perceived 2-5x faster
 */

import { EventEmitter } from 'events';

/**
 * Analysis result for a single file
 */
export interface FileAnalysisResult<T = unknown> {
  /** File path */
  file: string;
  /** Analysis result */
  result?: T;
  /** Error if analysis failed */
  error?: Error;
  /** Analysis duration in ms */
  duration: number;
  /** Whether result was from cache */
  cached: boolean;
}

/**
 * Progress update
 */
export interface AnalysisProgress {
  /** Number of files completed */
  completed: number;
  /** Total number of files */
  total: number;
  /** Current file being analyzed */
  currentFile?: string;
  /** Percentage complete (0-100) */
  percentage: number;
  /** Estimated time remaining in ms */
  estimatedTimeRemaining?: number;
}

/**
 * Analysis summary
 */
export interface AnalysisSummary<T = unknown> {
  /** All results */
  results: FileAnalysisResult<T>[];
  /** Number of successful analyses */
  successCount: number;
  /** Number of failed analyses */
  errorCount: number;
  /** Number of cached results */
  cachedCount: number;
  /** Total duration in ms */
  totalDuration: number;
  /** Average duration per file in ms */
  avgDuration: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
}

/**
 * Streaming analyzer events
 */
export interface StreamingAnalyzerEvents<T = unknown> {
  /** Emitted when a file analysis starts */
  start: (file: string) => void;
  /** Emitted when a file analysis completes */
  result: (result: FileAnalysisResult<T>) => void;
  /** Emitted on progress updates */
  progress: (progress: AnalysisProgress) => void;
  /** Emitted when all files are analyzed */
  complete: (summary: AnalysisSummary<T>) => void;
  /** Emitted on error */
  error: (file: string, error: Error) => void;
}

/**
 * Streaming Analyzer
 *
 * Analyzes files and emits results as they're completed.
 *
 * @example
 * ```typescript
 * const analyzer = new StreamingAnalyzer();
 *
 * analyzer.on('result', (result) => {
 *   if (result.error) {
 *     console.error(`Error in ${result.file}: ${result.error.message}`);
 *   } else {
 *     console.log(`✓ ${result.file} (${result.duration}ms)`);
 *   }
 * });
 *
 * analyzer.on('progress', (progress) => {
 *   console.log(`Progress: ${progress.percentage}%`);
 * });
 *
 * analyzer.on('complete', (summary) => {
 *   console.log(`Done! ${summary.successCount} files analyzed`);
 * });
 *
 * await analyzer.analyze(files, analyzeFile);
 * ```
 */
export class StreamingAnalyzer<T = unknown> extends EventEmitter {
  private results: FileAnalysisResult<T>[] = [];
  private startTime: number = 0;
  private completed: number = 0;
  private total: number = 0;

  /**
   * Analyze files and emit results as they complete
   *
   * @param files - Array of file paths to analyze
   * @param analyzer - Analysis function
   * @returns Promise that resolves when all files are analyzed
   */
  async analyze(
    files: string[],
    analyzer: (file: string) => Promise<T>
  ): Promise<AnalysisSummary<T>> {
    this.results = [];
    this.startTime = Date.now();
    this.completed = 0;
    this.total = files.length;

    for (const file of files) {
      await this.analyzeFile(file, analyzer);
    }

    return this.createSummary();
  }

  /**
   * Analyze files in parallel and emit results as they complete
   *
   * @param files - Array of file paths to analyze
   * @param analyzer - Analysis function
   * @param concurrency - Maximum concurrent analyses (default: 4)
   * @returns Promise that resolves when all files are analyzed
   */
  async analyzeParallel(
    files: string[],
    analyzer: (file: string) => Promise<T>,
    concurrency: number = 4
  ): Promise<AnalysisSummary<T>> {
    this.results = [];
    this.startTime = Date.now();
    this.completed = 0;
    this.total = files.length;

    // Process files in parallel batches
    const queue = [...files];
    const executing: Set<Promise<void>> = new Set();

    while (queue.length > 0 || executing.size > 0) {
      // Start new analyses up to concurrency limit
      while (queue.length > 0 && executing.size < concurrency) {
        const file = queue.shift()!;
        const promise = this.analyzeFile(file, analyzer);

        // Wrap promise to auto-remove from set when completed
        const tracked = promise.finally(() => {
          executing.delete(tracked);
        });

        executing.add(tracked);
      }

      // Wait for at least one to complete
      if (executing.size > 0) {
        await Promise.race(executing);
      }
    }

    return this.createSummary();
  }

  /**
   * Get current progress
   */
  getProgress(): AnalysisProgress {
    const percentage = this.total > 0 ? (this.completed / this.total) * 100 : 0;
    const elapsed = Date.now() - this.startTime;
    const avgTimePerFile = this.completed > 0 ? elapsed / this.completed : 0;
    const remaining = this.total - this.completed;
    const estimatedTimeRemaining = avgTimePerFile * remaining;

    return {
      completed: this.completed,
      total: this.total,
      percentage,
      estimatedTimeRemaining: estimatedTimeRemaining > 0 ? estimatedTimeRemaining : undefined,
    };
  }

  /**
   * Analyze a single file and emit events
   */
  private async analyzeFile(
    file: string,
    analyzer: (file: string) => Promise<T>
  ): Promise<void> {
    this.emit('start', file);

    const startTime = Date.now();
    let result: FileAnalysisResult<T>;

    try {
      const analysisResult = await analyzer(file);
      const duration = Date.now() - startTime;

      result = {
        file,
        result: analysisResult,
        duration,
        cached: false, // Analyzer should set this
      };

      this.results.push(result);
      this.emit('result', result);
    } catch (error) {
      const duration = Date.now() - startTime;

      result = {
        file,
        error: error as Error,
        duration,
        cached: false,
      };

      this.results.push(result);
      this.emit('result', result);
      this.emit('error', file, error as Error);
    }

    this.completed++;
    this.emit('progress', this.getProgress());
  }

  /**
   * Create analysis summary
   */
  private createSummary(): AnalysisSummary<T> {
    const successCount = this.results.filter((r) => !r.error).length;
    const errorCount = this.results.filter((r) => r.error).length;
    const cachedCount = this.results.filter((r) => r.cached).length;
    const totalDuration = Date.now() - this.startTime;
    const avgDuration = this.results.length > 0
      ? this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length
      : 0;
    const cacheHitRate = this.results.length > 0
      ? cachedCount / this.results.length
      : 0;

    const summary: AnalysisSummary<T> = {
      results: this.results,
      successCount,
      errorCount,
      cachedCount,
      totalDuration,
      avgDuration,
      cacheHitRate,
    };

    this.emit('complete', summary);
    return summary;
  }
}

/**
 * Helper function to create a progress bar string
 *
 * @param progress - Progress info
 * @param width - Width of progress bar (default: 40)
 * @returns Progress bar string
 *
 * @example
 * ```typescript
 * const bar = createProgressBar({ completed: 50, total: 100, percentage: 50 });
 * console.log(bar); // [####################          ] 50%
 * ```
 */
export function createProgressBar(progress: AnalysisProgress, width: number = 40): string {
  const filledWidth = Math.round((progress.percentage / 100) * width);
  const emptyWidth = width - filledWidth;
  const filled = '#'.repeat(filledWidth);
  const empty = ' '.repeat(emptyWidth);
  return `[${filled}${empty}] ${progress.percentage.toFixed(1)}%`;
}

/**
 * Helper function to format duration
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 *
 * @example
 * ```typescript
 * formatDuration(1500); // "1.5s"
 * formatDuration(65000); // "1m 5s"
 * ```
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Helper function to format summary
 *
 * @param summary - Analysis summary
 * @returns Formatted summary string
 */
export function formatSummary<T>(summary: AnalysisSummary<T>): string {
  const lines: string[] = [];

  lines.push('Analysis Summary');
  lines.push('─'.repeat(50));
  lines.push(`Total files:     ${summary.results.length}`);
  lines.push(`Successful:      ${summary.successCount}`);
  lines.push(`Errors:          ${summary.errorCount}`);
  lines.push(`Cached:          ${summary.cachedCount}`);
  lines.push(`Total duration:  ${formatDuration(summary.totalDuration)}`);
  lines.push(`Avg per file:    ${formatDuration(summary.avgDuration)}`);
  lines.push(`Cache hit rate:  ${(summary.cacheHitRate * 100).toFixed(1)}%`);

  return lines.join('\n');
}
