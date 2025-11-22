/**
 * Analysis Error Classes
 *
 * Structured error hierarchy for analysis operations.
 * All errors extend from AnalysisError base class and include context information.
 */

/**
 * Base error class for all analysis errors
 */
export abstract class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when project structure cannot be analyzed
 */
export class ProjectStructureError extends AnalysisError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PROJECT_STRUCTURE_ERROR', context);
  }
}

/**
 * Error thrown when a file cannot be parsed or read
 */
export class FileParseError extends AnalysisError {
  constructor(
    message: string,
    public readonly filePath: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'FILE_PARSE_ERROR', { ...context, filePath });
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends AnalysisError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
  }
}

/**
 * Error thrown when analysis exceeds timeout
 */
export class AnalysisTimeoutError extends AnalysisError {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'ANALYSIS_TIMEOUT', { ...context, timeoutMs });
  }
}

/**
 * Error thrown when pattern detection fails
 */
export class PatternDetectionError extends AnalysisError {
  constructor(
    message: string,
    public readonly patternName: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'PATTERN_DETECTION_ERROR', { ...context, patternName });
  }
}
