/**
 * Tests for File Locking Utility - Cross-process file locking
 *
 * @module tests/utils/file-lock.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getLockPath,
  acquireLock,
  acquireLockSync,
  withFileLock,
  withFileLockSync,
  LockGuard,
  SafeJsonFile,
  cleanupStaleLocks,
} from '../../packages/core/src/utils/file-lock.js';

describe('file-lock', () => {
  let testDir: string;
  let testFile: string;

  beforeEach(() => {
    // Create unique test directory for each test
    testDir = join(tmpdir(), `ax-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    testFile = join(testDir, 'test-file.json');
  });

  afterEach(() => {
    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getLockPath', () => {
    it('should return lock path with .lock extension', () => {
      const lockPath = getLockPath('/path/to/file.json');
      // Cross-platform: match either forward or back slashes
      expect(lockPath).toMatch(/[/\\]path[/\\]to[/\\]file\.json\.lock$/);
    });

    it('should resolve relative paths', () => {
      const lockPath = getLockPath('relative/path.json');
      expect(lockPath).toContain('.lock');
      expect(lockPath).not.toBe('relative/path.json.lock');
    });
  });

  describe('acquireLock', () => {
    it('should acquire lock on file', async () => {
      const acquired = await acquireLock(testFile, { throwOnTimeout: false });
      expect(acquired).toBe(true);

      const lockPath = getLockPath(testFile);
      expect(existsSync(lockPath)).toBe(true);

      // Clean up
      unlinkSync(lockPath);
    });

    it('should create lock file with correct content', async () => {
      await acquireLock(testFile, { throwOnTimeout: false });

      const lockPath = getLockPath(testFile);
      const content = JSON.parse(readFileSync(lockPath, 'utf-8'));

      expect(content.pid).toBe(process.pid);
      expect(content.timestamp).toBeDefined();
      expect(content.type).toBe('write');

      // Clean up
      unlinkSync(lockPath);
    });

    it('should support read lock type', async () => {
      await acquireLock(testFile, { type: 'read', throwOnTimeout: false });

      const lockPath = getLockPath(testFile);
      const content = JSON.parse(readFileSync(lockPath, 'utf-8'));

      expect(content.type).toBe('read');

      // Clean up
      unlinkSync(lockPath);
    });

    it('should be re-entrant for same process', async () => {
      // First acquisition
      const first = await acquireLock(testFile, { throwOnTimeout: false });
      expect(first).toBe(true);

      // Second acquisition (re-entrant)
      const second = await acquireLock(testFile, { throwOnTimeout: false });
      expect(second).toBe(true);

      // Clean up - need to release twice for re-entrant locks
      const lockPath = getLockPath(testFile);
      unlinkSync(lockPath);
    });

    it('should timeout when lock is held by another process', async () => {
      // Simulate another process holding the lock
      const lockPath = getLockPath(testFile);
      mkdirSync(testDir, { recursive: true });

      const fakeLock = {
        pid: process.pid + 1000, // Different PID
        hostname: 'other-machine', // Different hostname
        timestamp: Date.now(),
        type: 'write' as const
      };
      writeFileSync(lockPath, JSON.stringify(fakeLock));

      // Try to acquire with short timeout
      const acquired = await acquireLock(testFile, {
        timeout: 100,
        retryInterval: 10,
        throwOnTimeout: false
      });

      expect(acquired).toBe(false);

      // Clean up
      unlinkSync(lockPath);
    });

    it('should throw on timeout when throwOnTimeout is true', async () => {
      // Simulate another process holding the lock
      const lockPath = getLockPath(testFile);
      mkdirSync(testDir, { recursive: true });

      const fakeLock = {
        pid: process.pid + 1000,
        hostname: 'other-machine',
        timestamp: Date.now(),
        type: 'write' as const
      };
      writeFileSync(lockPath, JSON.stringify(fakeLock));

      await expect(acquireLock(testFile, {
        timeout: 100,
        retryInterval: 10,
        throwOnTimeout: true
      })).rejects.toThrow('Failed to acquire write lock');

      // Clean up
      unlinkSync(lockPath);
    });

    it('should acquire stale lock', async () => {
      // Create a stale lock
      const lockPath = getLockPath(testFile);
      mkdirSync(testDir, { recursive: true });

      const staleLock = {
        pid: process.pid + 1000,
        hostname: 'other-machine',
        timestamp: Date.now() - 60000, // 60 seconds ago (stale)
        type: 'write' as const
      };
      writeFileSync(lockPath, JSON.stringify(staleLock));

      const acquired = await acquireLock(testFile, {
        staleThreshold: 30000, // 30 seconds
        throwOnTimeout: false
      });

      expect(acquired).toBe(true);

      // Clean up
      unlinkSync(lockPath);
    });
  });

  describe('acquireLockSync', () => {
    it('should acquire lock synchronously', () => {
      const acquired = acquireLockSync(testFile, { throwOnTimeout: false });
      expect(acquired).toBe(true);

      const lockPath = getLockPath(testFile);
      expect(existsSync(lockPath)).toBe(true);

      // Clean up
      unlinkSync(lockPath);
    });

    it('should timeout when lock is held', () => {
      // Simulate another process holding the lock
      const lockPath = getLockPath(testFile);
      mkdirSync(testDir, { recursive: true });

      const fakeLock = {
        pid: process.pid + 1000,
        hostname: 'other-machine',
        timestamp: Date.now(),
        type: 'write' as const
      };
      writeFileSync(lockPath, JSON.stringify(fakeLock));

      const acquired = acquireLockSync(testFile, {
        timeout: 100,
        retryInterval: 10,
        throwOnTimeout: false
      });

      expect(acquired).toBe(false);

      // Clean up
      unlinkSync(lockPath);
    });

    it('should throw on timeout when configured', () => {
      const lockPath = getLockPath(testFile);
      mkdirSync(testDir, { recursive: true });

      const fakeLock = {
        pid: process.pid + 1000,
        hostname: 'other-machine',
        timestamp: Date.now(),
        type: 'write' as const
      };
      writeFileSync(lockPath, JSON.stringify(fakeLock));

      expect(() => acquireLockSync(testFile, {
        timeout: 100,
        retryInterval: 10,
        throwOnTimeout: true
      })).toThrow('Failed to acquire write lock');

      // Clean up
      unlinkSync(lockPath);
    });
  });

  describe('withFileLock', () => {
    it('should execute function with lock held', async () => {
      let lockHeld = false;

      await withFileLock(testFile, async () => {
        const lockPath = getLockPath(testFile);
        lockHeld = existsSync(lockPath);
      });

      expect(lockHeld).toBe(true);

      // Lock should be released
      const lockPath = getLockPath(testFile);
      expect(existsSync(lockPath)).toBe(false);
    });

    it('should return function result', async () => {
      const result = await withFileLock(testFile, async () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
    });

    it('should release lock on error', async () => {
      await expect(withFileLock(testFile, async () => {
        throw new Error('Test error');
      })).rejects.toThrow('Test error');

      // Lock should be released
      const lockPath = getLockPath(testFile);
      expect(existsSync(lockPath)).toBe(false);
    });

    it('should handle synchronous function', async () => {
      const result = await withFileLock(testFile, () => {
        return 'sync-result';
      });

      expect(result).toBe('sync-result');
    });
  });

  describe('withFileLockSync', () => {
    it('should execute function with lock held', () => {
      let lockHeld = false;

      withFileLockSync(testFile, () => {
        const lockPath = getLockPath(testFile);
        lockHeld = existsSync(lockPath);
      });

      expect(lockHeld).toBe(true);

      // Lock should be released
      const lockPath = getLockPath(testFile);
      expect(existsSync(lockPath)).toBe(false);
    });

    it('should return function result', () => {
      const result = withFileLockSync(testFile, () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
    });

    it('should release lock on error', () => {
      expect(() => withFileLockSync(testFile, () => {
        throw new Error('Test error');
      })).toThrow('Test error');

      // Lock should be released
      const lockPath = getLockPath(testFile);
      expect(existsSync(lockPath)).toBe(false);
    });
  });

  describe('LockGuard', () => {
    it('should acquire lock on creation', async () => {
      const guard = await LockGuard.acquire(testFile);

      const lockPath = getLockPath(testFile);
      expect(existsSync(lockPath)).toBe(true);
      expect(guard.isReleased).toBe(false);

      guard.release();
    });

    it('should release lock on release()', async () => {
      const guard = await LockGuard.acquire(testFile);
      guard.release();

      expect(guard.isReleased).toBe(true);
      const lockPath = getLockPath(testFile);
      expect(existsSync(lockPath)).toBe(false);
    });

    it('should be safe to release multiple times', async () => {
      const guard = await LockGuard.acquire(testFile);
      guard.release();
      guard.release(); // Should not throw
      guard.release();

      expect(guard.isReleased).toBe(true);
    });

    it('should have correct filePath and type', async () => {
      const guard = await LockGuard.acquire(testFile, { type: 'read' });

      expect(guard.filePath).toBe(testFile);
      expect(guard.type).toBe('read');

      guard.release();
    });

    it('should acquire lock synchronously', () => {
      const guard = LockGuard.acquireSync(testFile);

      const lockPath = getLockPath(testFile);
      expect(existsSync(lockPath)).toBe(true);

      guard.release();
    });
  });

  describe('SafeJsonFile', () => {
    describe('read', () => {
      it('should read existing JSON file', async () => {
        writeFileSync(testFile, JSON.stringify({ key: 'value' }));

        const data = await SafeJsonFile.read<{ key: string }>(testFile);

        expect(data).toEqual({ key: 'value' });
      });

      it('should return null for non-existent file', async () => {
        const data = await SafeJsonFile.read(testFile);

        expect(data).toBeNull();
      });
    });

    describe('write', () => {
      it('should write JSON file', async () => {
        await SafeJsonFile.write(testFile, { key: 'value' });

        const content = JSON.parse(readFileSync(testFile, 'utf-8'));
        expect(content).toEqual({ key: 'value' });
      });

      it('should create directory if not exists', async () => {
        const nestedFile = join(testDir, 'nested', 'deep', 'file.json');

        await SafeJsonFile.write(nestedFile, { nested: true });

        expect(existsSync(nestedFile)).toBe(true);
        const content = JSON.parse(readFileSync(nestedFile, 'utf-8'));
        expect(content).toEqual({ nested: true });
      });

      it('should format JSON with indentation', async () => {
        await SafeJsonFile.write(testFile, { key: 'value' });

        const content = readFileSync(testFile, 'utf-8');
        expect(content).toContain('\n'); // Has line breaks
      });
    });

    describe('update', () => {
      it('should update existing file', async () => {
        writeFileSync(testFile, JSON.stringify({ count: 1 }));

        const result = await SafeJsonFile.update<{ count: number }>(testFile, (current) => {
          return { count: (current?.count || 0) + 1 };
        });

        expect(result).toEqual({ count: 2 });

        const content = JSON.parse(readFileSync(testFile, 'utf-8'));
        expect(content).toEqual({ count: 2 });
      });

      it('should create file if not exists', async () => {
        const result = await SafeJsonFile.update<{ count: number }>(testFile, (current) => {
          return { count: (current?.count || 0) + 1 };
        });

        expect(result).toEqual({ count: 1 });
      });
    });

    describe('readSync', () => {
      it('should read existing JSON file synchronously', () => {
        writeFileSync(testFile, JSON.stringify({ key: 'value' }));

        const data = SafeJsonFile.readSync<{ key: string }>(testFile);

        expect(data).toEqual({ key: 'value' });
      });

      it('should return null for non-existent file', () => {
        const data = SafeJsonFile.readSync(testFile);

        expect(data).toBeNull();
      });
    });

    describe('writeSync', () => {
      it('should write JSON file synchronously', () => {
        SafeJsonFile.writeSync(testFile, { key: 'value' });

        const content = JSON.parse(readFileSync(testFile, 'utf-8'));
        expect(content).toEqual({ key: 'value' });
      });

      it('should create directory if not exists', () => {
        const nestedFile = join(testDir, 'nested-sync', 'file.json');

        SafeJsonFile.writeSync(nestedFile, { nested: true });

        expect(existsSync(nestedFile)).toBe(true);
      });
    });
  });

  describe('cleanupStaleLocks', () => {
    it('should clean up stale lock files', () => {
      // Create some stale lock files
      const staleLock1 = join(testDir, 'file1.json.lock');
      const staleLock2 = join(testDir, 'file2.json.lock');

      const staleContent = {
        pid: 99999,
        hostname: 'old-machine',
        timestamp: Date.now() - 60000, // 60 seconds ago
        type: 'write' as const
      };

      writeFileSync(staleLock1, JSON.stringify(staleContent));
      writeFileSync(staleLock2, JSON.stringify(staleContent));

      const cleaned = cleanupStaleLocks(testDir, 30000);

      expect(cleaned).toBe(2);
      expect(existsSync(staleLock1)).toBe(false);
      expect(existsSync(staleLock2)).toBe(false);
    });

    it('should not clean up fresh lock files', () => {
      // Create a fresh lock file
      const freshLock = join(testDir, 'fresh.json.lock');

      const freshContent = {
        pid: 99999,
        hostname: 'other-machine',
        timestamp: Date.now(), // Just created
        type: 'write' as const
      };

      writeFileSync(freshLock, JSON.stringify(freshContent));

      const cleaned = cleanupStaleLocks(testDir, 30000);

      expect(cleaned).toBe(0);
      expect(existsSync(freshLock)).toBe(true);
    });

    it('should handle non-existent directory', () => {
      const cleaned = cleanupStaleLocks('/non/existent/directory');

      expect(cleaned).toBe(0);
    });

    it('should only process .lock files', () => {
      // Create a non-lock file
      const regularFile = join(testDir, 'regular.json');
      writeFileSync(regularFile, JSON.stringify({ data: true }));

      const cleaned = cleanupStaleLocks(testDir);

      expect(cleaned).toBe(0);
      expect(existsSync(regularFile)).toBe(true);
    });
  });

  describe('concurrent access', () => {
    it('should handle concurrent read/write safely', async () => {
      // Initialize file
      writeFileSync(testFile, JSON.stringify({ count: 0 }));

      // Perform multiple concurrent updates
      const updates = Array.from({ length: 10 }, () =>
        SafeJsonFile.update<{ count: number }>(testFile, (current) => {
          return { count: (current?.count || 0) + 1 };
        })
      );

      await Promise.all(updates);

      const finalContent = JSON.parse(readFileSync(testFile, 'utf-8'));
      expect(finalContent.count).toBe(10);
    });
  });
});
