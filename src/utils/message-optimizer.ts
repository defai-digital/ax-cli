/**
 * Message Optimizer - Smart truncation and summarization for LLM messages
 *
 * Reduces verbose tool outputs while preserving essential information.
 * Designed to reduce message length by 80-95% for better context efficiency.
 */

export interface TruncationConfig {
  /** Maximum length for tool outputs (default: 1000) */
  maxLength?: number;
  /** Number of lines to show from start (default: 20) */
  headLines?: number;
  /** Number of lines to show from end (default: 10) */
  tailLines?: number;
  /** Whether to extract and show only errors (default: true) */
  extractErrors?: boolean;
  /** Maximum lines for file content (default: 100) */
  maxFileLines?: number;
}

export interface TruncationResult {
  /** Optimized content */
  content: string;
  /** Whether content was truncated */
  truncated: boolean;
  /** Original length */
  originalLength: number;
  /** New length */
  newLength: number;
  /** Percentage reduced */
  reduction: number;
}

/**
 * MessageOptimizer - Reduces verbose tool outputs while preserving key information
 */
export class MessageOptimizer {
  private config: Required<TruncationConfig>;

  constructor(config: TruncationConfig = {}) {
    this.config = {
      maxLength: config.maxLength ?? 1000,
      headLines: config.headLines ?? 20,
      tailLines: config.tailLines ?? 10,
      extractErrors: config.extractErrors ?? true,
      maxFileLines: config.maxFileLines ?? 100,
    };
  }

  /**
   * Optimize tool output with smart truncation
   */
  optimizeToolOutput(output: string, toolName?: string): TruncationResult {
    const originalLength = output.length;

    // Check for special processing even for short outputs
    let optimized = output;

    if (this.isTypeScriptBuild(output)) {
      optimized = this.extractTypeScriptErrors(output);
    } else if (this.isTestOutput(output)) {
      optimized = this.extractTestResults(output);
    } else if (this.isGitOutput(output)) {
      optimized = this.truncateGitOutput(output);
    } else if (toolName === 'read_file') {
      optimized = this.truncateFileContent(output);
    }

    // Check if content needs truncation after processing
    if (optimized.length > this.config.maxLength) {
      // Generic truncation for long outputs
      optimized = this.genericTruncate(optimized);
    }

    const needsTruncation = optimized.length !== originalLength;

    return {
      content: optimized,
      truncated: needsTruncation,
      originalLength,
      newLength: optimized.length,
      reduction: needsTruncation ? ((originalLength - optimized.length) / originalLength) * 100 : 0,
    };
  }

  /**
   * Detect TypeScript build output
   */
  private isTypeScriptBuild(output: string): boolean {
    return (
      output.includes('error TS') ||
      output.includes('tsc') ||
      output.includes('> tsc')
    );
  }

  /**
   * Detect test output
   */
  private isTestOutput(output: string): boolean {
    return (
      output.includes('Test Files') ||
      output.includes('Tests ') ||
      output.includes('PASS') ||
      output.includes('FAIL')
    );
  }

  /**
   * Detect git output
   */
  private isGitOutput(output: string): boolean {
    return (
      output.includes('git ') ||
      output.includes('commit ') ||
      output.includes('On branch')
    );
  }

  /**
   * Extract TypeScript errors with context
   */
  private extractTypeScriptErrors(output: string): string {
    const lines = output.split('\n');
    const errors: string[] = [];
    let currentError: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Error line: src/file.ts(123,45): error TS1234: Message
      if (line.includes('error TS')) {
        if (currentError.length > 0) {
          errors.push(currentError.join('\n'));
          currentError = [];
        }
        currentError.push(line);
      }
      // Context lines (indented, part of error message)
      else if (currentError.length > 0 && line.match(/^\s{2,}/)) {
        currentError.push(line);
      }
      // End of error context
      else if (currentError.length > 0) {
        errors.push(currentError.join('\n'));
        currentError = [];
      }
    }

    // Don't forget last error
    if (currentError.length > 0) {
      errors.push(currentError.join('\n'));
    }

    if (errors.length === 0) {
      // No errors found, use generic truncation
      return this.genericTruncate(output);
    }

    // Build summary
    const errorCount = errors.length;
    const header = `TypeScript Build: ${errorCount} error${errorCount !== 1 ? 's' : ''} found\n\n`;

    // Show first 5 errors in full, rest as summary
    const shownErrors = errors.slice(0, 5);
    const remaining = errorCount - shownErrors.length;

    let result = header + shownErrors.join('\n\n');

    if (remaining > 0) {
      result += `\n\n... and ${remaining} more error${remaining !== 1 ? 's' : ''} (truncated for brevity)`;
    }

    return result;
  }

  /**
   * Extract test results summary
   */
  private extractTestResults(output: string): string {
    const lines = output.split('\n');
    const important: string[] = [];

    for (const line of lines) {
      // Keep summary lines
      if (
        line.includes('Test Files') ||
        line.includes('Tests ') ||
        line.includes('PASS') ||
        line.includes('FAIL') ||
        line.includes('✓') ||
        line.includes('✗') ||
        line.includes('Duration')
      ) {
        important.push(line);
      }
    }

    if (important.length === 0) {
      return this.genericTruncate(output);
    }

    return important.join('\n');
  }

  /**
   * Truncate git output intelligently
   */
  private truncateGitOutput(output: string): string {
    const lines = output.split('\n');

    // For git status, show all (usually short)
    if (output.includes('On branch')) {
      return output;
    }

    // For git log, show first few commits
    if (output.includes('commit ')) {
      return this.headTailTruncate(output, 30, 5);
    }

    // For git diff, show summary
    if (output.includes('diff --git')) {
      const header = lines.slice(0, 10).join('\n');
      const summary = `\n\n... (diff truncated, showing first 10 lines of ${lines.length} total)`;
      return header + summary;
    }

    return this.genericTruncate(output);
  }

  /**
   * Truncate file content with context preservation
   */
  private truncateFileContent(output: string): string {
    const lines = output.split('\n');
    const maxLines = this.config.maxFileLines;

    if (lines.length <= maxLines) {
      return output;
    }

    const halfLines = Math.floor(maxLines / 2);
    return this.headTailTruncate(output, halfLines, halfLines);
  }

  /**
   * Generic truncation: show head and tail
   */
  private genericTruncate(output: string): string {
    return this.headTailTruncate(
      output,
      this.config.headLines,
      this.config.tailLines
    );
  }

  /**
   * Head-tail truncation: show beginning and end
   */
  private headTailTruncate(
    output: string,
    headLines: number,
    tailLines: number
  ): string {
    const lines = output.split('\n');
    const totalLines = lines.length;

    if (totalLines <= headLines + tailLines) {
      // For single-line strings that exceed maxLength, truncate by characters
      if (totalLines === 1 && output.length > this.config.maxLength) {
        const halfMax = Math.floor(this.config.maxLength / 2);
        const head = output.substring(0, halfMax);
        const tail = output.substring(output.length - halfMax);
        return `${head}... (${output.length - this.config.maxLength} chars omitted) ...${tail}`;
      }
      return output;
    }

    const head = lines.slice(0, headLines);
    const tail = lines.slice(-tailLines);
    const omitted = totalLines - headLines - tailLines;

    return [
      ...head,
      ``,
      `... (${omitted} lines omitted - total ${totalLines} lines) ...`,
      ``,
      ...tail,
    ].join('\n');
  }

  /**
   * Create excerpt with context around important lines
   */
  createExcerpt(
    lines: string[],
    importantIndices: number[],
    contextLines: number = 2
  ): string {
    if (importantIndices.length === 0) {
      return this.genericTruncate(lines.join('\n'));
    }

    const ranges: Array<[number, number]> = [];

    // Build ranges around important lines
    for (const idx of importantIndices.sort((a, b) => a - b)) {
      const start = Math.max(0, idx - contextLines);
      const end = Math.min(lines.length - 1, idx + contextLines);

      // Merge overlapping ranges
      if (ranges.length > 0) {
        const last = ranges[ranges.length - 1];
        if (start <= last[1] + 1) {
          last[1] = Math.max(last[1], end);
          continue;
        }
      }

      ranges.push([start, end]);
    }

    // Build excerpt
    const excerpts: string[] = [];
    for (let i = 0; i < ranges.length; i++) {
      const [start, end] = ranges[i];
      const excerpt = lines.slice(start, end + 1);

      if (i > 0) {
        excerpts.push(`... (${start - ranges[i - 1][1] - 1} lines omitted) ...`);
      }

      excerpts.push(...excerpt);
    }

    return excerpts.join('\n');
  }

  /**
   * Get optimization statistics
   */
  getStats(results: TruncationResult[]): {
    totalOriginal: number;
    totalNew: number;
    totalReduction: number;
    avgReduction: number;
    count: number;
  } {
    const totalOriginal = results.reduce((sum, r) => sum + r.originalLength, 0);
    const totalNew = results.reduce((sum, r) => sum + r.newLength, 0);

    // Guard against division by zero
    const totalReduction = totalOriginal > 0
      ? ((totalOriginal - totalNew) / totalOriginal) * 100
      : 0;

    const avgReduction = results.length > 0
      ? results.reduce((sum, r) => sum + r.reduction, 0) / results.length
      : 0;

    return {
      totalOriginal,
      totalNew,
      totalReduction,
      avgReduction,
      count: results.length,
    };
  }
}

/**
 * Global singleton instance
 */
let globalOptimizer: MessageOptimizer | null = null;

/**
 * Get or create global message optimizer
 * Note: If config is provided after initial creation, it will update the optimizer
 */
export function getMessageOptimizer(config?: TruncationConfig): MessageOptimizer {
  if (!globalOptimizer) {
    globalOptimizer = new MessageOptimizer(config);
  } else if (config) {
    // Update config if provided on subsequent calls
    globalOptimizer = new MessageOptimizer(config);
  }
  return globalOptimizer;
}

/**
 * Quick helper: optimize tool output
 */
export function optimizeOutput(output: string, toolName?: string): string {
  const optimizer = getMessageOptimizer();
  const result = optimizer.optimizeToolOutput(output, toolName);
  return result.content;
}
