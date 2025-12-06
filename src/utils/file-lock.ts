/**
 * File Locking Utility - Cross-process file locking for concurrent access
 *
 * This module provides file-level locking to prevent race conditions when
 * multiple ax-glm and ax-grok instances access the same files.
 *
 * Features:
 * - Cross-process locking using lock files
 * - Automatic stale lock cleanup
 * - Configurable timeouts
 * - Read/write lock semantics
 * - Safe atomic operations
 *
 * @example
 * ```typescript
 * // Exclusive lock for writes
 * await withFileLock('/path/to/file.json', async () => {
 *   const data = JSON.parse(fs.readFileSync('/path/to/file.json', 'utf-8'));
 *   data.count++;
 *   fs.writeFileSync('/path/to/file.json', JSON.stringify(data));
 * });
 *
 * // Read lock (shared)
 * const data = await withFileLock('/path/to/file.json', async () => {
 *   return JSON.parse(fs.readFileSync('/path/to/file.json', 'utf-8'));
 * }, { type: 'read' });
 * ```
 */

import { existsSync, unlinkSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { hostname } from 'os';

/**
 * Lock types
 */
export type LockType = 'read' | 'write';

/**
 * Lock options
 */
export interface LockOptions {
  /** Lock type (default: 'write') */
  type?: LockType;
  /** Maximum time to wait for lock in ms (default: 10000) */
  timeout?: number;
  /** Time between lock attempts in ms (default: 50) */
  retryInterval?: number;
  /** Maximum age of lock file before considered stale in ms (default: 30000) */
  staleThreshold?: number;
  /** Whether to throw on timeout (default: true) */
  throwOnTimeout?: boolean;
}

/**
 * Lock file content
 */
interface LockFileContent {
  pid: number;
  hostname: string;
  timestamp: number;
  type: LockType;
  provider?: string;
}

/**
 * Default lock options
 */
const DEFAULT_OPTIONS: Required<LockOptions> = {
  type: 'write',
  timeout: 10000,
  retryInterval: 50,
  staleThreshold: 30000,
  throwOnTimeout: true,
};

/**
 * Get the lock file path for a given file
 */
export function getLockPath(filePath: string): string {
  return `${resolve(filePath)}.lock`;
}

/**
 * Get current hostname (cached for performance)
 */
let cachedHostname: string | null = null;
function getHostname(): string {
  if (!cachedHostname) {
    cachedHostname = hostname();
  }
  return cachedHostname;
}

/**
 * Track re-entrant lock count per file (for same process)
 * Key: lockPath, Value: count
 */
const reentrantLockCounts = new Map<string, number>();

/**
 * Get re-entry count for a lock
 */
function getReentryCount(lockPath: string): number {
  return reentrantLockCounts.get(lockPath) || 0;
}

/**
 * Increment re-entry count
 */
function incrementReentryCount(lockPath: string): void {
  const count = getReentryCount(lockPath);
  reentrantLockCounts.set(lockPath, count + 1);
}

/**
 * Decrement re-entry count, returns true if lock should be released
 */
function decrementReentryCount(lockPath: string): boolean {
  const count = getReentryCount(lockPath);
  if (count <= 1) {
    reentrantLockCounts.delete(lockPath);
    return true; // Should release
  }
  reentrantLockCounts.set(lockPath, count - 1);
  return false; // Don't release yet
}

/**
 * Check if a lock is stale (process no longer exists or too old)
 */
function isLockStale(lockContent: LockFileContent, staleThreshold: number): boolean {
  const now = Date.now();
  const age = now - lockContent.timestamp;

  // Check if lock is too old
  if (age > staleThreshold) {
    return true;
  }

  // Check if the process that created the lock still exists
  // Only check if it's on the same machine (hostname matches)
  if (lockContent.hostname === getHostname()) {
    try {
      // process.kill with signal 0 checks if process exists without killing it
      process.kill(lockContent.pid, 0);
      return false; // Process exists
    } catch {
      return true; // Process doesn't exist
    }
  }

  // Can't verify cross-machine locks, rely on timestamp
  return age > staleThreshold / 2;
}

/**
 * Try to read and parse lock file content
 */
function readLockFile(lockPath: string): LockFileContent | null {
  try {
    if (!existsSync(lockPath)) {
      return null;
    }
    const content = readFileSync(lockPath, 'utf-8');
    return JSON.parse(content) as LockFileContent;
  } catch {
    return null;
  }
}

/**
 * Create lock file content
 */
function createLockContent(type: LockType): LockFileContent {
  return {
    pid: process.pid,
    hostname: getHostname(),
    timestamp: Date.now(),
    type,
    provider: process.env.AX_PROVIDER,
  };
}

/**
 * Attempt to acquire a lock
 * Uses atomic rename pattern for safety
 *
 * NOTE: All locks are treated as exclusive for simplicity and correctness.
 * Implementing true shared read locks requires OS-level primitives (flock/fcntl)
 * which are not portable across platforms. The 'type' parameter is stored
 * in the lock file for debugging purposes only.
 */
function tryAcquireLock(
  filePath: string,
  type: LockType,
  staleThreshold: number
): boolean {
  const lockPath = getLockPath(filePath);
  const tempLockPath = `${lockPath}.${process.pid}.${Date.now()}`;

  try {
    // Ensure directory exists
    const dir = dirname(lockPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Check existing lock
    const existingLock = readLockFile(lockPath);
    if (existingLock) {
      // Check if we already own the lock (re-entrant)
      if (
        existingLock.pid === process.pid &&
        existingLock.hostname === getHostname()
      ) {
        // We already own the lock - update timestamp to prevent staleness
        // and increment re-entry count
        try {
          const updatedContent = createLockContent(type);
          writeFileSync(lockPath, JSON.stringify(updatedContent));
          incrementReentryCount(lockPath);
        } catch {
          // Failed to update, but we still own it
        }
        return true;
      }

      // Check if stale
      if (!isLockStale(existingLock, staleThreshold)) {
        // Lock is held by another process - wait
        return false;
      }

      // Stale lock, try to remove it
      try {
        unlinkSync(lockPath);
      } catch {
        // Another process might have already removed it
      }
    }

    // Create temp lock file
    const content = createLockContent(type);
    writeFileSync(tempLockPath, JSON.stringify(content), { flag: 'wx' });

    // Attempt atomic rename
    try {
      const fs = require('fs');
      fs.renameSync(tempLockPath, lockPath);
      incrementReentryCount(lockPath); // Track this as first acquisition
      return true;
    } catch {
      // Another process got the lock first
      try {
        unlinkSync(tempLockPath);
      } catch {
        // Ignore cleanup errors
      }
      return false;
    }
  } catch {
    // Clean up temp file if it exists
    try {
      if (existsSync(tempLockPath)) {
        unlinkSync(tempLockPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    return false;
  }
}

/**
 * Release a lock
 * Handles re-entrant locks by only releasing when count reaches zero
 */
function releaseLock(filePath: string): void {
  const lockPath = getLockPath(filePath);

  try {
    // Check re-entry count - only release when all nested locks are released
    const shouldRelease = decrementReentryCount(lockPath);
    if (!shouldRelease) {
      // Still have nested locks, don't release yet
      return;
    }

    // Verify we own the lock before releasing (check both PID and hostname)
    const lockContent = readLockFile(lockPath);
    if (
      lockContent &&
      lockContent.pid === process.pid &&
      lockContent.hostname === getHostname()
    ) {
      unlinkSync(lockPath);
    }
  } catch {
    // Ignore errors during release
  }
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Acquire a file lock with retry
 */
export async function acquireLock(
  filePath: string,
  options: LockOptions = {}
): Promise<boolean> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  while (Date.now() - startTime < opts.timeout) {
    if (tryAcquireLock(filePath, opts.type!, opts.staleThreshold)) {
      return true;
    }
    await sleep(opts.retryInterval);
  }

  if (opts.throwOnTimeout) {
    throw new Error(
      `Failed to acquire ${opts.type} lock on ${filePath} after ${opts.timeout}ms`
    );
  }

  return false;
}

/**
 * Synchronous sleep using Atomics.wait (if available) or busy wait fallback
 * This is more efficient than a pure spin loop
 */
function sleepSync(ms: number): void {
  // Use Atomics.wait if available (Node.js 8.10+)
  // This properly yields the thread instead of spinning
  try {
    const sharedBuffer = new SharedArrayBuffer(4);
    const int32 = new Int32Array(sharedBuffer);
    Atomics.wait(int32, 0, 0, ms);
  } catch {
    // Fallback: spin with occasional Date.now() to allow GC
    const end = Date.now() + ms;
    let i = 0;
    while (Date.now() < end) {
      i++;
      // Occasional check to allow event loop to process (every 1000 iterations)
      if (i % 1000 === 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        Date.now();
      }
    }
  }
}

/**
 * Acquire a file lock synchronously (blocking)
 */
export function acquireLockSync(
  filePath: string,
  options: LockOptions = {}
): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  while (Date.now() - startTime < opts.timeout) {
    if (tryAcquireLock(filePath, opts.type!, opts.staleThreshold)) {
      return true;
    }

    // Use efficient sync sleep
    sleepSync(opts.retryInterval);
  }

  if (opts.throwOnTimeout) {
    throw new Error(
      `Failed to acquire ${opts.type} lock on ${filePath} after ${opts.timeout}ms`
    );
  }

  return false;
}

/**
 * Execute a function with an exclusive file lock
 *
 * @example
 * ```typescript
 * await withFileLock('/path/to/config.json', async () => {
 *   const config = JSON.parse(fs.readFileSync('/path/to/config.json', 'utf-8'));
 *   config.lastAccess = Date.now();
 *   fs.writeFileSync('/path/to/config.json', JSON.stringify(config));
 * });
 * ```
 */
export async function withFileLock<T>(
  filePath: string,
  fn: () => T | Promise<T>,
  options: LockOptions = {}
): Promise<T> {
  const acquired = await acquireLock(filePath, options);

  if (!acquired) {
    throw new Error(`Could not acquire lock on ${filePath}`);
  }

  try {
    return await fn();
  } finally {
    releaseLock(filePath);
  }
}

/**
 * Execute a function with an exclusive file lock (synchronous)
 */
export function withFileLockSync<T>(
  filePath: string,
  fn: () => T,
  options: LockOptions = {}
): T {
  const acquired = acquireLockSync(filePath, options);

  if (!acquired) {
    throw new Error(`Could not acquire lock on ${filePath}`);
  }

  try {
    return fn();
  } finally {
    releaseLock(filePath);
  }
}

/**
 * Lock guard class for manual lock management
 *
 * @example
 * ```typescript
 * const guard = await LockGuard.acquire('/path/to/file');
 * try {
 *   // ... do work ...
 * } finally {
 *   guard.release();
 * }
 * ```
 */
export class LockGuard {
  private released = false;

  private constructor(
    public readonly filePath: string,
    public readonly type: LockType
  ) {}

  /**
   * Acquire a lock and return a guard
   */
  static async acquire(
    filePath: string,
    options: LockOptions = {}
  ): Promise<LockGuard> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    await acquireLock(filePath, opts);
    return new LockGuard(filePath, opts.type);
  }

  /**
   * Acquire a lock synchronously and return a guard
   */
  static acquireSync(
    filePath: string,
    options: LockOptions = {}
  ): LockGuard {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    acquireLockSync(filePath, opts);
    return new LockGuard(filePath, opts.type);
  }

  /**
   * Release the lock
   */
  release(): void {
    if (!this.released) {
      releaseLock(this.filePath);
      this.released = true;
    }
  }

  /**
   * Check if lock has been released
   */
  get isReleased(): boolean {
    return this.released;
  }
}

/**
 * Safe JSON file operations with locking
 */
export const SafeJsonFile = {
  /**
   * Read a JSON file with lock protection
   */
  async read<T>(filePath: string, options: LockOptions = {}): Promise<T | null> {
    return withFileLock(
      filePath,
      () => {
        if (!existsSync(filePath)) {
          return null;
        }
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as T;
      },
      { ...options, type: 'read' }
    );
  },

  /**
   * Write a JSON file with lock protection
   */
  async write<T>(
    filePath: string,
    data: T,
    options: LockOptions = {}
  ): Promise<void> {
    return withFileLock(
      filePath,
      () => {
        const dir = dirname(filePath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        // Write to temp file first, then rename (atomic)
        const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
        try {
          writeFileSync(tempPath, JSON.stringify(data, null, 2));
          require('fs').renameSync(tempPath, filePath);
        } catch (error) {
          // Clean up temp file on error
          try {
            if (existsSync(tempPath)) {
              unlinkSync(tempPath);
            }
          } catch {
            // Ignore cleanup errors
          }
          throw error;
        }
      },
      { ...options, type: 'write' }
    );
  },

  /**
   * Update a JSON file with lock protection
   * Reads, modifies, and writes atomically
   */
  async update<T>(
    filePath: string,
    updater: (current: T | null) => T,
    options: LockOptions = {}
  ): Promise<T> {
    return withFileLock(
      filePath,
      () => {
        let current: T | null = null;
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8');
          current = JSON.parse(content) as T;
        }

        const updated = updater(current);

        const dir = dirname(filePath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
        try {
          writeFileSync(tempPath, JSON.stringify(updated, null, 2));
          require('fs').renameSync(tempPath, filePath);
        } catch (error) {
          // Clean up temp file on error
          try {
            if (existsSync(tempPath)) {
              unlinkSync(tempPath);
            }
          } catch {
            // Ignore cleanup errors
          }
          throw error;
        }

        return updated;
      },
      { ...options, type: 'write' }
    );
  },

  /**
   * Synchronous read with lock
   */
  readSync<T>(filePath: string, options: LockOptions = {}): T | null {
    return withFileLockSync(
      filePath,
      () => {
        if (!existsSync(filePath)) {
          return null;
        }
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as T;
      },
      { ...options, type: 'read' }
    );
  },

  /**
   * Synchronous write with lock
   */
  writeSync<T>(
    filePath: string,
    data: T,
    options: LockOptions = {}
  ): void {
    withFileLockSync(
      filePath,
      () => {
        const dir = dirname(filePath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
        try {
          writeFileSync(tempPath, JSON.stringify(data, null, 2));
          require('fs').renameSync(tempPath, filePath);
        } catch (error) {
          // Clean up temp file on error
          try {
            if (existsSync(tempPath)) {
              unlinkSync(tempPath);
            }
          } catch {
            // Ignore cleanup errors
          }
          throw error;
        }
      },
      { ...options, type: 'write' }
    );
  },
};

/**
 * Clean up any stale lock files in a directory
 */
export function cleanupStaleLocks(
  directory: string,
  staleThreshold: number = DEFAULT_OPTIONS.staleThreshold
): number {
  const fs = require('fs');
  const path = require('path');

  let cleaned = 0;

  try {
    const files = fs.readdirSync(directory);
    for (const file of files) {
      if (file.endsWith('.lock')) {
        const lockPath = path.join(directory, file);
        const content = readLockFile(lockPath);
        if (content && isLockStale(content, staleThreshold)) {
          try {
            unlinkSync(lockPath);
            cleaned++;
          } catch {
            // Ignore errors
          }
        }
      }
    }
  } catch {
    // Directory might not exist
  }

  return cleaned;
}
