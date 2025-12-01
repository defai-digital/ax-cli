/**
 * Performance monitoring utilities
 * Provides timing and performance metrics for operations
 */

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Simple performance timer for measuring operation duration
 *
 * @example
 * ```typescript
 * const timer = new PerformanceTimer('tokenCount');
 * // ... do work ...
 * const duration = timer.end();
 * console.log(`Operation took ${duration}ms`);
 * ```
 */
export class PerformanceTimer {
  private startTime: number;
  private endTime?: number;
  private name: string;

  constructor(name: string) {
    this.name = name;
    this.startTime = performance.now();
  }

  /**
   * End the timer and return duration in milliseconds
   */
  end(): number {
    this.endTime = performance.now();
    return this.duration();
  }

  /**
   * Get duration without ending timer
   */
  duration(): number {
    const end = this.endTime || performance.now();
    return end - this.startTime;
  }

  /**
   * Get metric object
   */
  getMetric(): PerformanceMetric {
    return {
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime ? this.duration() : undefined,
    };
  }
}

/**
 * Measure the performance of an async function
 *
 * @example
 * ```typescript
 * const [result, duration] = await measureAsync(
 *   'apiCall',
 *   () => fetch('https://api.example.com')
 * );
 * console.log(`API call took ${duration}ms`);
 * ```
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<[T, number]> {
  const timer = new PerformanceTimer(name);
  const result = await fn();
  const duration = timer.end();
  return [result, duration];
}

/**
 * Measure the performance of a sync function
 *
 * @example
 * ```typescript
 * const [result, duration] = measure('calculation', () => {
 *   return heavyComputation();
 * });
 * ```
 */
export function measure<T>(name: string, fn: () => T): [T, number] {
  const timer = new PerformanceTimer(name);
  const result = fn();
  const duration = timer.end();
  return [result, duration];
}

/**
 * Debounce function to limit execution rate
 * Returns a tuple of [debounced function, cleanup function]
 */
export function debounce<TArgs extends any[]>(
  fn: (...args: TArgs) => void,
  delay: number
): [(...args: TArgs) => void, () => void] {
  let timeoutId: NodeJS.Timeout | null = null;

  const debouncedFn = (...args: TArgs) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return [debouncedFn, cleanup];
}

/**
 * Throttle function to limit execution frequency
 * Returns a tuple of [throttled function, cleanup function]
 */
export function throttle<TArgs extends any[]>(
  fn: (...args: TArgs) => void,
  limit: number
): [(...args: TArgs) => void, () => void] {
  let inThrottle = false;
  let timeoutId: NodeJS.Timeout | null = null;

  const throttledFn = (...args: TArgs) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;

      timeoutId = setTimeout(() => {
        inThrottle = false;
        timeoutId = null;
      }, limit);
    }
  };

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    inThrottle = false;
  };

  return [throttledFn, cleanup];
}
