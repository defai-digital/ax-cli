/**
 * SDK Error Codes for programmatic error handling
 *
 * Use these codes to distinguish between different error types
 * instead of parsing error messages.
 *
 * @example
 * ```typescript
 * try {
 *   await createAgent();
 * } catch (error) {
 *   if (error instanceof SDKError) {
 *     switch (error.code) {
 *       case SDKErrorCode.SETUP_NOT_RUN:
 *         console.log('Run ax-cli setup first');
 *         break;
 *       case SDKErrorCode.API_KEY_MISSING:
 *         console.log('API key not configured');
 *         break;
 *     }
 *   }
 * }
 * ```
 */
export enum SDKErrorCode {
  /** ax-cli setup has not been run */
  SETUP_NOT_RUN = 'SDK_SETUP_NOT_RUN',

  /** API key is not configured in settings */
  API_KEY_MISSING = 'SDK_API_KEY_MISSING',

  /** Base URL is not configured in settings */
  BASE_URL_MISSING = 'SDK_BASE_URL_MISSING',

  /** Agent has been disposed and cannot be used */
  AGENT_DISPOSED = 'SDK_AGENT_DISPOSED',

  /** Input validation failed */
  VALIDATION_ERROR = 'SDK_VALIDATION_ERROR',

  /** Operation was aborted by user */
  ABORTED = 'SDK_ABORTED',

  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = 'SDK_RATE_LIMIT_EXCEEDED',

  /** Invalid configuration */
  INVALID_CONFIG = 'SDK_INVALID_CONFIG',

  /** Internal SDK error */
  INTERNAL_ERROR = 'SDK_INTERNAL_ERROR',
}

/**
 * Structured error class for SDK errors
 *
 * Provides error codes for programmatic handling and preserves
 * error chains for debugging.
 *
 * @example
 * ```typescript
 * throw new SDKError(
 *   SDKErrorCode.API_KEY_MISSING,
 *   'No API key configured. Please run "ax-cli setup".',
 *   originalError
 * );
 * ```
 */
export class SDKError extends Error {
  /**
   * Create a new SDK error
   *
   * @param code - Error code for programmatic handling
   * @param message - Human-readable error message
   * @param cause - Original error that caused this error (optional)
   */
  constructor(
    public readonly code: SDKErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SDKError';

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SDKError);
    }
  }

  /**
   * Type guard to check if an error is an SDKError
   *
   * @param error - Error to check
   * @returns True if error is an SDKError
   *
   * @example
   * ```typescript
   * try {
   *   await createAgent();
   * } catch (error) {
   *   if (SDKError.isSDKError(error)) {
   *     console.log('SDK error:', error.code);
   *   }
   * }
   * ```
   */
  static isSDKError(error: unknown): error is SDKError {
    return error instanceof SDKError;
  }

  /**
   * Convert error to JSON (excludes cause to prevent circular refs)
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      // Exclude cause to prevent circular references
      // and avoid leaking sensitive information
    };
  }

  /**
   * Custom inspect for Node.js util.inspect
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    let result = `${this.name} [${this.code}]: ${this.message}`;
    if (this.cause) {
      result += `\n  Caused by: ${this.cause.message}`;
    }
    return result;
  }
}
