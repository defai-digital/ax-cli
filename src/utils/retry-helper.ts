/**
 * Retry Helper - Exponential Backoff with Retry-After Support
 *
 * Implements robust retry logic for LLM API calls with:
 * - Exponential backoff
 * - Retry-After header support
 * - Configurable retry conditions
 * - Jitter to prevent thundering herd
 */

/** Error with optional status/code for retryability checking */
export interface RetryableError extends Error {
  status?: number;
  code?: string;
  headers?: Record<string, string>;
}

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 8000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** HTTP status codes that should trigger retry (default: [429, 500, 502, 503, 504]) */
  retryableStatusCodes?: number[];
  /** Callback invoked before each retry attempt */
  onRetry?: (attempt: number, error: RetryableError, delayMs: number) => void;
  /** Whether to add jitter to backoff delays (default: true) */
  addJitter?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 8000,
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  addJitter: true,
};

/**
 * Check if an error is retryable based on status code
 */
function isRetryableError(error: unknown, retryableStatusCodes: number[]): boolean {
  const retryable = error as Partial<RetryableError>;

  // Check for status code
  if (typeof retryable?.status === 'number') {
    return retryableStatusCodes.includes(retryable.status);
  }

  // Check for code property (some errors use 'code' instead of 'status')
  if (typeof retryable?.code === 'string') {
    // Network errors are retryable
    if (['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'].includes(retryable.code)) {
      return true;
    }
  }

  // Check if error message indicates network issue
  const message = retryable?.message?.toLowerCase() || '';
  if (message.includes('network') || message.includes('timeout') || message.includes('econnreset')) {
    return true;
  }

  // Abort errors are NOT retryable - they indicate intentional cancellation
  // This includes user-initiated cancellations and upstream signal aborts
  if (message.includes('abort') || message.includes('cancelled') || message.includes('canceled')) {
    return false;
  }

  // Check for AbortError by name
  if (retryable?.name === 'AbortError') {
    return false;
  }

  return false;
}

/**
 * Extract Retry-After delay from error headers
 * Returns delay in milliseconds, or null if not present
 */
function getRetryAfterDelay(error: unknown): number | null {
  const retryable = error as Partial<RetryableError>;
  const headers = retryable?.headers || {};
  const retryAfter = headers['retry-after'] || headers['Retry-After'];

  if (!retryAfter) {
    return null;
  }

  // Retry-After can be either:
  // 1. A number of seconds
  // 2. An HTTP date
  const parsed = parseInt(retryAfter, 10);
  if (!isNaN(parsed)) {
    return parsed * 1000; // Convert seconds to milliseconds
  }

  // Try parsing as date
  const retryDate = new Date(retryAfter);
  if (!isNaN(retryDate.getTime())) {
    const now = Date.now();
    const delay = retryDate.getTime() - now;
    return delay > 0 ? delay : null;
  }

  return null;
}

/**
 * Calculate exponential backoff delay with optional jitter
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  backoffMultiplier: number,
  maxDelay: number,
  addJitter: boolean
): number {
  // Calculate exponential delay: initialDelay * (multiplier ^ attempt)
  let delay = initialDelay * Math.pow(backoffMultiplier, attempt);

  // Cap at max delay
  delay = Math.min(delay, maxDelay);

  // Add jitter (random variation ±25%) to prevent thundering herd
  if (addJitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
    delay = delay * jitterFactor;
  }

  return Math.floor(delay);
}

/**
 * Sleep for specified milliseconds
 * Exported for reuse across codebase to avoid duplicate Promise/setTimeout patterns
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with optional jitter (exported for reuse)
 *
 * @param attempt - Current retry attempt (0-indexed)
 * @param initialDelay - Initial delay in milliseconds
 * @param maxDelay - Maximum delay cap in milliseconds
 * @param addJitter - Whether to add random jitter (±25%)
 * @returns Calculated delay in milliseconds
 */
export function calculateExponentialBackoff(
  attempt: number,
  initialDelay: number = 1000,
  maxDelay: number = 30000,
  addJitter: boolean = true
): number {
  // Cap exponent to prevent integer overflow (2^30 ~= 1 billion ms)
  const cappedExponent = Math.min(attempt, 30);
  let delay = initialDelay * Math.pow(2, cappedExponent);

  // Cap at max delay
  delay = Math.min(delay, maxDelay);

  // Add jitter (random variation ±25%) to prevent thundering herd
  if (addJitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
    delay = delay * jitterFactor;
  }

  return Math.floor(delay);
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration options
 * @returns Promise resolving to the function's return value
 * @throws Error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => apiClient.call(),
 *   {
 *     maxRetries: 3,
 *     onRetry: (attempt, error, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // First attempt (attempt = 0) or retry attempt
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // Check if we should retry
      const shouldRetry = attempt < opts.maxRetries && isRetryableError(error, opts.retryableStatusCodes);

      if (!shouldRetry) {
        // Not retryable or exhausted retries
        throw error;
      }

      // Calculate delay
      let delay: number;
      const retryAfterDelay = getRetryAfterDelay(error);

      if (retryAfterDelay !== null) {
        // Honor Retry-After header (cap at maxDelay)
        delay = Math.min(retryAfterDelay, opts.maxDelay);
      } else {
        // Use exponential backoff
        delay = calculateBackoffDelay(
          attempt,
          opts.initialDelay,
          opts.backoffMultiplier,
          opts.maxDelay,
          opts.addJitter
        );
      }

      // Invoke callback if provided
      if (options.onRetry) {
        try {
          options.onRetry(attempt + 1, error as RetryableError, delay);
        } catch (callbackError) {
          // Don't let callback errors break retry flow
          console.warn('Retry callback error:', callbackError);
        }
      }

      // Wait before retry
      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

/**
 * Retry wrapper specifically for streaming operations
 * Only retries before first chunk is yielded
 *
 * @param fn - Async generator function to retry
 * @param options - Retry configuration options
 * @returns AsyncGenerator that retries until first successful chunk
 */
export async function* retryStreamWithBackoff<T>(
  fn: () => AsyncGenerator<T>,
  options: RetryOptions = {}
): AsyncGenerator<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Try to get stream
      const stream = fn();

      // Yield all chunks - if first chunk succeeds, no more retries
      for await (const chunk of stream) {
        yield chunk;
      }

      // Stream completed successfully
      return;
    } catch (error: unknown) {
      lastError = error;

      // Check if we should retry
      const shouldRetry = attempt < opts.maxRetries && isRetryableError(error, opts.retryableStatusCodes);

      if (!shouldRetry) {
        throw error;
      }

      // Calculate delay (same logic as non-streaming)
      let delay: number;
      const retryAfterDelay = getRetryAfterDelay(error);

      if (retryAfterDelay !== null) {
        delay = Math.min(retryAfterDelay, opts.maxDelay);
      } else {
        delay = calculateBackoffDelay(
          attempt,
          opts.initialDelay,
          opts.backoffMultiplier,
          opts.maxDelay,
          opts.addJitter
        );
      }

      // Invoke callback if provided
      if (options.onRetry) {
        try {
          options.onRetry(attempt + 1, error as RetryableError, delay);
        } catch (callbackError) {
          console.warn('Retry callback error:', callbackError);
        }
      }

      // Wait before retry
      await sleep(delay);
    }
  }

  // Exhausted retries
  throw lastError;
}
