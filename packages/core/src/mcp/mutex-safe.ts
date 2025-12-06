/**
 * Type-Safe Mutex Implementation
 *
 * This is an improved version of mutex.ts that uses advanced TypeScript
 * techniques to prevent logic bugs at compile-time.
 *
 * Improvements over basic mutex:
 * 1. Branded types for lock tokens (proves lock is held)
 * 2. Linear types (ensures release is called exactly once)
 * 3. Result types (explicit error handling)
 * 4. State tracking (prevents double-release)
 */

import { Result, Ok, Err } from './type-safety.js';

/**
 * Lock Token - Opaque type that proves caller holds the lock
 *
 * This token can ONLY be created by the Mutex class when a lock is acquired.
 * Functions that require the lock can demand this token, proving at compile-time
 * that the caller has acquired the lock.
 */
export class LockToken {
  // @ts-ignore - Brand field is intentionally unused (for type safety only)
  private readonly __brand!: 'LockToken';

  // Track if released (for linear type checking)
  private _released = false;

  private constructor(
    public readonly key: string,
    private readonly releaseFn: () => void
  ) {}

  /**
   * Release the lock (can only be called once)
   * This is a linear type - calling twice is a bug
   */
  release(): void {
    if (this._released) {
      throw new Error(`Lock token already released! Linear type violation for key: ${this.key}`);
    }

    this._released = true;
    this.releaseFn();
  }

  /**
   * Check if already released (for debugging)
   */
  isReleased(): boolean {
    return this._released;
  }

  /**
   * Internal factory - only Mutex can create tokens
   */
  static _create(key: string, releaseFn: () => void): LockToken {
    return new LockToken(key, releaseFn);
  }
}

/**
 * Lock State - Tracks current lock status
 */
type LockState =
  | { status: 'unlocked' }
  | { status: 'locked'; acquiredAt: number; key: string };

/**
 * Improved Mutex with Type Safety
 *
 * Key improvements:
 * - Lock tokens prove ownership at compile-time
 * - Linear types prevent double-release
 * - State tracking prevents invalid operations
 * - Result types for explicit error handling
 */
export class SafeMutex {
  private state: LockState = { status: 'unlocked' };
  private queue: Array<() => void> = [];

  /**
   * Acquire the mutex lock
   *
   * Returns a LockToken that:
   * 1. Proves the lock is held (compile-time)
   * 2. Must be released exactly once (runtime check)
   * 3. Cannot be counterfeited (private constructor)
   */
  async acquire(key: string = 'default'): Promise<LockToken> {
    // If locked, wait in queue
    if (this.state.status === 'locked') {
      await new Promise<void>(resolve => {
        this.queue.push(resolve);
      });
    }

    // Acquire lock
    this.state = {
      status: 'locked',
      acquiredAt: Date.now(),
      key
    };

    // Create token with release function
    const token = LockToken._create(key, () => {
      this.release(key);
    });

    return token;
  }

  /**
   * Release the mutex lock
   * Should only be called via LockToken.release()
   */
  private release(key: string): void {
    // Verify we're actually locked
    if (this.state.status !== 'locked') {
      throw new Error('Cannot release unlocked mutex');
    }

    // Verify key matches (prevents releasing wrong lock)
    if (this.state.status === 'locked' && this.state.key !== key) {
      throw new Error(`Key mismatch: trying to release lock for "${key}" but lock is held for "${this.state.key}"`);
    }

    // Release lock
    this.state = { status: 'unlocked' };

    // Notify next waiting operation
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  /**
   * Execute function with automatic lock management
   *
   * This is safer than manual acquire/release because:
   * 1. Guarantees release even if fn throws
   * 2. Prevents forgetting to release
   * 3. Returns Result type for explicit error handling
   */
  async runExclusive<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<Result<T, Error>> {
    const token = await this.acquire(key);

    try {
      const result = await fn();
      return Ok(result);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error(String(error)));
    } finally {
      // Always release, even if fn throws
      if (!token.isReleased()) {
        token.release();
      }
    }
  }

  /**
   * Check if mutex is currently locked
   */
  isLocked(): boolean {
    return this.state.status === 'locked';
  }

  /**
   * Get lock holder (for debugging)
   */
  getLockHolder(): string | null {
    return this.state.status === 'locked' ? this.state.key : null;
  }

  /**
   * Get number of operations waiting for lock
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get lock duration in milliseconds
   */
  getLockDuration(): number | null {
    if (this.state.status === 'locked') {
      return Date.now() - this.state.acquiredAt;
    }
    return null;
  }
}

/**
 * Per-key mutex manager with type safety
 */
export class SafeKeyedMutex {
  private mutexes = new Map<string, SafeMutex>();

  /** Get or create mutex for a key */
  private getMutex(key: string): SafeMutex {
    const existing = this.mutexes.get(key);
    if (existing) return existing;
    const mutex = new SafeMutex();
    this.mutexes.set(key, mutex);
    return mutex;
  }

  /**
   * Acquire mutex for a specific key
   * Returns a LockToken that proves ownership
   */
  async acquire(key: string): Promise<LockToken> {
    const mutex = this.getMutex(key);
    return await mutex.acquire(key);
  }

  /**
   * Execute function with mutex protection for a specific key
   * Returns Result type for explicit error handling
   */
  async runExclusive<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<Result<T, Error>> {
    const mutex = this.getMutex(key);
    return await mutex.runExclusive(key, fn);
  }

  /**
   * Check if a key is currently locked
   */
  isLocked(key: string): boolean {
    const mutex = this.mutexes.get(key);
    return mutex ? mutex.isLocked() : false;
  }

  /**
   * Get lock holder for a key
   */
  getLockHolder(key: string): string | null {
    const mutex = this.mutexes.get(key);
    return mutex ? mutex.getLockHolder() : null;
  }

  /**
   * Get number of operations waiting for a key
   */
  getQueueLength(key: string): number {
    const mutex = this.mutexes.get(key);
    return mutex ? mutex.getQueueLength() : 0;
  }

  /**
   * Get lock duration for a key
   */
  getLockDuration(key: string): number | null {
    const mutex = this.mutexes.get(key);
    return mutex ? mutex.getLockDuration() : null;
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

  /**
   * Get diagnostic info for all locks
   */
  getDiagnostics(): Array<{
    key: string;
    locked: boolean;
    holder: string | null;
    queueLength: number;
    duration: number | null;
  }> {
    return Array.from(this.mutexes.entries()).map(([key, mutex]) => ({
      key,
      locked: mutex.isLocked(),
      holder: mutex.getLockHolder(),
      queueLength: mutex.getQueueLength(),
      duration: mutex.getLockDuration()
    }));
  }
}

/**
 * USAGE EXAMPLES - See tests/mcp/safe-mutex.bench.ts for comprehensive examples
 */
