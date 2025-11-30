/**
 * API Error Classes - Structured Error Handling for LLM API
 *
 * Preserves full error context including status codes, headers, and original stack traces
 * for better diagnostics and retry decision making.
 */

/**
 * Structured error for LLM API failures
 * Preserves all diagnostic information from the original error
 */
export class LLMAPIError extends Error {
  public readonly name = 'LLMAPIError';
  public readonly timestamp: Date;

  constructor(
    message: string,
    public readonly originalError: any,
    public readonly model: string,
    public readonly statusCode?: number,
    public readonly headers?: Record<string, string>,
    public readonly requestId?: string
  ) {
    super(message);
    this.timestamp = new Date();

    // Preserve original stack trace if available
    if (originalError?.stack) {
      this.stack = `${this.stack}\n\nCaused by:\n${originalError.stack}`;
    }

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, LLMAPIError.prototype);
  }

  /**
   * Check if this error is retryable based on status code
   */
  get isRetryable(): boolean {
    if (!this.statusCode) {
      // Network errors (no status code) are retryable
      return this.isNetworkError;
    }

    // Retry on server errors and rate limits
    return [429, 500, 502, 503, 504].includes(this.statusCode);
  }

  /**
   * Check if this is a network/connection error
   */
  get isNetworkError(): boolean {
    const code = this.originalError?.code;
    if (typeof code === 'string') {
      return ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH', 'ECONNREFUSED'].includes(code);
    }

    const message = this.originalError?.message?.toLowerCase() || '';
    return message.includes('network') || message.includes('timeout') || message.includes('fetch failed');
  }

  /**
   * Check if this is a rate limit error
   */
  get isRateLimitError(): boolean {
    return this.statusCode === 429;
  }

  /**
   * Check if this is an authentication error
   */
  get isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  /**
   * Check if this is a client error (4xx, non-retryable)
   */
  get isClientError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 400 && this.statusCode < 500 && !this.isRateLimitError;
  }

  /**
   * Get Retry-After delay in seconds, or null if not present
   */
  get retryAfterSeconds(): number | null {
    if (!this.headers) {
      return null;
    }

    const retryAfter = this.headers['retry-after'] || this.headers['Retry-After'];
    if (!retryAfter) {
      return null;
    }

    // Retry-After can be either a number of seconds or an HTTP date
    const parsed = parseInt(retryAfter, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }

    // Try parsing as date
    const retryDate = new Date(retryAfter);
    if (!isNaN(retryDate.getTime())) {
      const now = Date.now();
      const delayMs = retryDate.getTime() - now;
      return delayMs > 0 ? Math.ceil(delayMs / 1000) : null;
    }

    return null;
  }

  /**
   * Get a user-friendly error message
   */
  get userMessage(): string {
    if (this.isRateLimitError) {
      const retryAfter = this.retryAfterSeconds;
      if (retryAfter) {
        return `Rate limit exceeded. Please retry in ${retryAfter} seconds.`;
      }
      return 'Rate limit exceeded. Please try again in a few moments.';
    }

    if (this.isAuthError) {
      return 'Authentication failed. Please check your API key and try again.';
    }

    if (this.isNetworkError) {
      return 'Network connection failed. Please check your internet connection and try again.';
    }

    if (this.statusCode && this.statusCode >= 500) {
      return 'The AI service is temporarily unavailable. Please try again in a few moments.';
    }

    // Default to the message
    return this.message;
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      model: this.model,
      statusCode: this.statusCode,
      headers: this.headers,
      requestId: this.requestId,
      timestamp: this.timestamp.toISOString(),
      isRetryable: this.isRetryable,
      isRateLimitError: this.isRateLimitError,
      isAuthError: this.isAuthError,
      isNetworkError: this.isNetworkError,
      retryAfterSeconds: this.retryAfterSeconds,
      originalError: {
        name: this.originalError?.name,
        message: this.originalError?.message,
        code: this.originalError?.code,
        status: this.originalError?.status,
      }
    };
  }

  /**
   * Convert error to string for display
   */
  toString(): string {
    let str = `${this.name}: ${this.message}`;

    if (this.statusCode) {
      str += ` (HTTP ${this.statusCode})`;
    }

    if (this.requestId) {
      str += ` [Request ID: ${this.requestId}]`;
    }

    return str;
  }
}

/**
 * Create an LLMAPIError from any error object
 * Extracts status, headers, and other metadata automatically
 */
export function createLLMAPIError(
  error: any,
  model: string,
  context?: string
): LLMAPIError {
  // Extract metadata from error
  const statusCode = error?.status || error?.response?.status;
  const headers = error?.headers || error?.response?.headers;
  const requestId = headers?.['x-request-id'] || headers?.['X-Request-Id'];

  // Build message
  const contextPrefix = context ? `${context}: ` : '';
  const errorMessage = error?.message || error?.error?.message || 'Unknown error';
  const message = `${contextPrefix}${errorMessage}`;

  return new LLMAPIError(
    message,
    error,
    model,
    statusCode,
    headers,
    requestId
  );
}
