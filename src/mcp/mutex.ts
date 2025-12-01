/**
 * Simple Mutex Implementation
 *
 * Provides mutual exclusion for async operations without external dependencies.
 * Prevents race conditions in concurrent operations.
 */

/**
 * Simple mutex for protecting critical sections
 */
export class Mutex {
  private locked = false;
  private queue: Array<() => void> = [];

  /**
   * Acquire the mutex lock
   * Returns a release function that must be called when done
   */
  async acquire(): Promise<() => void> {
    // BUG FIX: Use a loop to handle the race condition where another caller
    // could acquire the lock between our queue notification and lock acquisition.
    // This implements a proper "test-and-set" pattern for async mutexes.
    while (this.locked) {
      await new Promise<void>(resolve => {
        this.queue.push(resolve);
      });
      // After being notified, re-check if lock is available
      // Another waiter might have been notified simultaneously
    }

    // Acquire lock
    this.locked = true;

    // Return release function
    return () => {
      this.release();
    };
  }

  /**
   * Release the mutex lock
   */
  private release(): void {
    // BUG FIX: Release lock AFTER notifying next waiter to prevent
    // new callers from sneaking in before queued waiters.
    // Get next waiter first while still holding the lock.
    const next = this.queue.shift();

    // Now release the lock
    this.locked = false;

    // Notify next waiting operation (they will re-acquire in their loop)
    if (next) {
      next();
    }
  }

  /**
   * Execute a function with mutex protection
   */
  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();

    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Check if mutex is currently locked
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get number of operations waiting for mutex
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}

/**
 * Per-key mutex manager
 * Allows separate mutexes for different keys (e.g., different server names)
 */
export class KeyedMutex {
  private mutexes = new Map<string, Mutex>();

  /** Get or create mutex for a key */
  private getMutex(key: string): Mutex {
    const existing = this.mutexes.get(key);
    if (existing) return existing;
    const mutex = new Mutex();
    this.mutexes.set(key, mutex);
    return mutex;
  }

  /**
   * Acquire mutex for a specific key
   */
  async acquire(key: string): Promise<() => void> {
    const mutex = this.getMutex(key);
    return await mutex.acquire();
  }

  /**
   * Execute function with mutex protection for a specific key
   */
  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const mutex = this.getMutex(key);
    return await mutex.runExclusive(fn);
  }

  /**
   * Check if a key is currently locked
   */
  isLocked(key: string): boolean {
    const mutex = this.mutexes.get(key);
    return mutex ? mutex.isLocked() : false;
  }

  /**
   * Get number of operations waiting for a key
   */
  getQueueLength(key: string): number {
    const mutex = this.mutexes.get(key);
    return mutex ? mutex.getQueueLength() : 0;
  }

  /**
   * Clear mutex for a key (cleanup)
   */
  clear(key: string): void {
    this.mutexes.delete(key);
  }

  /**
   * Clear all mutexes (cleanup)
   */
  clearAll(): void {
    this.mutexes.clear();
  }

  /**
   * Get all active keys
   */
  getKeys(): string[] {
    return Array.from(this.mutexes.keys());
  }
}
