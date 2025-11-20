import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileCache, createFileCache, getFileCache, clearAllCaches } from '../../src/utils/file-cache.js';
import { writeFile, mkdir, rm, utimes } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('FileCache', () => {
  let testDir: string;
  let cacheDir: string;
  let testFile: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `ax-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    cacheDir = join(testDir, 'cache');
    testFile = join(testDir, 'test-file.txt');

    await mkdir(testDir, { recursive: true });
    await mkdir(cacheDir, { recursive: true });
    await writeFile(testFile, 'test content');
  });

  afterEach(async () => {
    // Clean up
    try {
      await rm(testDir, { recursive: true, force: true });
      await clearAllCaches();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('basic caching', () => {
    it('should cache file analysis results', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
      });

      let computeCount = 0;
      const computer = async (path: string): Promise<string> => {
        computeCount++;
        return `analyzed: ${path}`;
      };

      // First call should compute
      const result1 = await cache.get(testFile, computer);
      expect(result1).toContain('analyzed');
      expect(computeCount).toBe(1);

      // Second call should use cache
      const result2 = await cache.get(testFile, computer);
      expect(result2).toBe(result1);
      expect(computeCount).toBe(1); // Not computed again
    });

    it('should return cache hit on unchanged file', async () => {
      const cache = createFileCache<number>({
        cacheDir,
        namespace: 'test',
      });

      let callCount = 0;
      const computer = async (): Promise<number> => {
        callCount++;
        return callCount;
      };

      const result1 = await cache.get(testFile, computer);
      expect(result1).toBe(1);

      const result2 = await cache.get(testFile, computer);
      expect(result2).toBe(1); // Same result (cache hit)
      expect(callCount).toBe(1); // Only called once
    });

    it('should invalidate cache when file changes', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
        useGit: false, // Disable git for this test
      });

      let computeCount = 0;
      const computer = async (): Promise<string> => {
        computeCount++;
        return `result-${computeCount}`;
      };

      // First call
      const result1 = await cache.get(testFile, computer);
      expect(result1).toBe('result-1');

      // Modify file
      await writeFile(testFile, 'modified content');

      // Should recompute
      const result2 = await cache.get(testFile, computer);
      expect(result2).toBe('result-2');
      expect(computeCount).toBe(2);
    });

    it('should detect changes via mtime', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
        useGit: false,
      });

      const computer = async (): Promise<string> => 'result';

      // Cache the file
      await cache.get(testFile, computer);

      // Touch the file (change mtime but not content)
      const now = new Date();
      await utimes(testFile, now, now);

      // Should detect change and recompute
      const hasChanged = await cache.hasChanged(testFile);
      expect(hasChanged).toBe(true);
    });
  });

  describe('cache statistics', () => {
    it('should track cache hits and misses', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
      });

      const computer = async (): Promise<string> => 'result';

      // Initial stats should be zero
      let stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);

      // First call is a miss
      await cache.get(testFile, computer);
      stats = cache.getStats();
      expect(stats.misses).toBe(1);

      // Second call is a hit
      await cache.get(testFile, computer);
      stats = cache.getStats();
      expect(stats.hits).toBe(1);

      // Hit rate should be 50%
      expect(stats.hitRate).toBeCloseTo(0.5);
    });

    it('should track total entries', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
        useGit: false, // Disable git for test consistency
      });

      const file1 = join(testDir, 'file1.txt');
      const file2 = join(testDir, 'file2.txt');

      await writeFile(file1, 'content1');
      await writeFile(file2, 'content2');

      await cache.get(file1, async () => 'result1');
      await cache.get(file2, async () => 'result2');

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(2);
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
        useGit: false, // Disable git for test consistency
      });

      await cache.get(testFile, async () => 'result');

      let stats = cache.getStats();
      expect(stats.totalEntries).toBe(1);

      await cache.clear();

      stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);
    });

    it('should invalidate specific entry', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
      });

      let computeCount = 0;
      const computer = async (): Promise<string> => {
        computeCount++;
        return `result-${computeCount}`;
      };

      await cache.get(testFile, computer);
      expect(computeCount).toBe(1);

      cache.invalidate(testFile);

      await cache.get(testFile, computer);
      expect(computeCount).toBe(2); // Recomputed
    });

    it('should prune expired entries', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
        ttl: 100, // 100ms TTL
        useGit: false, // Disable git for test consistency
      });

      await cache.get(testFile, async () => 'result');

      let stats = cache.getStats();
      expect(stats.totalEntries).toBe(1);

      // Wait for entry to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const pruned = await cache.prune();
      expect(pruned).toBe(1);

      stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);
    });

    it('should enforce max entries limit', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
        maxEntries: 3,
      });

      // Create 5 files
      for (let i = 0; i < 5; i++) {
        const file = join(testDir, `file${i}.txt`);
        await writeFile(file, `content${i}`);
        await cache.get(file, async () => `result${i}`);
      }

      const stats = cache.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(3);
    });
  });

  describe('persistence', () => {
    it('should save and load cache from disk', async () => {
      const namespace = `test-persist-${Date.now()}`;

      // Create cache and add entry
      {
        const cache = createFileCache<string>({
          cacheDir,
          namespace,
        });

        await cache.get(testFile, async () => 'saved-result');
        await cache.save();
      }

      // Create new cache instance and verify entry exists
      {
        const cache = createFileCache<string>({
          cacheDir,
          namespace,
        });

        let computeCalled = false;
        const result = await cache.get(testFile, async () => {
          computeCalled = true;
          return 'new-result';
        });

        expect(result).toBe('saved-result');
        expect(computeCalled).toBe(false); // Used cached value
      }
    });

    it('should maintain metadata across sessions', async () => {
      const namespace = `test-metadata-${Date.now()}`;

      let createdAt: number;

      // Create cache and check metadata
      {
        const cache = createFileCache<string>({
          cacheDir,
          namespace,
          toolVersion: '1.2.3',
        });

        await cache.get(testFile, async () => 'result');
        await cache.save();

        const metadata = cache.getMetadata();
        createdAt = metadata.createdAt;
        expect(metadata.toolVersion).toBe('1.2.3');
      }

      // Load cache and verify metadata
      {
        const cache = createFileCache<string>({
          cacheDir,
          namespace,
          toolVersion: '1.2.3',
        });

        await cache.init();
        const metadata = cache.getMetadata();

        expect(metadata.createdAt).toBe(createdAt);
        expect(metadata.toolVersion).toBe('1.2.3');
      }
    });
  });

  describe('set method', () => {
    it('should set cache entry directly', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
      });

      await cache.set(testFile, 'manual-result');

      const result = await cache.get(testFile, async () => 'computed-result');
      expect(result).toBe('manual-result');
    });
  });

  describe('hasChanged method', () => {
    it('should return false for unchanged file', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
        useGit: false,
      });

      await cache.set(testFile, 'result');

      const changed = await cache.hasChanged(testFile);
      expect(changed).toBe(false);
    });

    it('should return true for changed file', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
        useGit: false,
      });

      await cache.set(testFile, 'result');

      // Modify file
      await writeFile(testFile, 'new content');

      const changed = await cache.hasChanged(testFile);
      expect(changed).toBe(true);
    });

    it('should return true for uncached file', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
      });

      const changed = await cache.hasChanged(testFile);
      expect(changed).toBe(true);
    });
  });

  describe('namespace isolation', () => {
    it('should isolate caches by namespace', async () => {
      const cache1 = createFileCache<string>({
        cacheDir,
        namespace: 'ns1',
      });

      const cache2 = createFileCache<string>({
        cacheDir,
        namespace: 'ns2',
      });

      await cache1.set(testFile, 'result1');
      await cache2.set(testFile, 'result2');

      const result1 = await cache1.get(testFile, async () => 'wrong');
      const result2 = await cache2.get(testFile, async () => 'wrong');

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
    });
  });

  describe('getFileCache singleton', () => {
    it('should return same instance for same namespace', () => {
      const cache1 = getFileCache('test-singleton');
      const cache2 = getFileCache('test-singleton');

      expect(cache1).toBe(cache2);
    });

    it('should return different instances for different namespaces', () => {
      const cache1 = getFileCache('ns1');
      const cache2 = getFileCache('ns2');

      expect(cache1).not.toBe(cache2);
    });
  });

  describe('error handling', () => {
    it('should handle missing file gracefully', async () => {
      const cache = createFileCache<string>({
        cacheDir,
        namespace: 'test',
      });

      const missingFile = join(testDir, 'missing.txt');

      await expect(
        cache.get(missingFile, async () => 'result')
      ).rejects.toThrow();
    });

    it('should handle corrupted cache file', async () => {
      const namespace = `test-corrupt-${Date.now()}`;
      const cacheFile = join(cacheDir, `${namespace}.json`);

      // Create corrupted cache file
      await writeFile(cacheFile, 'invalid json {{{');

      const cache = createFileCache<string>({
        cacheDir,
        namespace,
      });

      // Should start fresh instead of crashing
      let computeCalled = false;
      await cache.get(testFile, async () => {
        computeCalled = true;
        return 'result';
      });

      expect(computeCalled).toBe(true);
    });
  });

  describe('tool version invalidation', () => {
    it('should invalidate cache on tool version change', async () => {
      const namespace = `test-version-${Date.now()}`;

      // Create cache with version 1.0.0
      {
        const cache = createFileCache<string>({
          cacheDir,
          namespace,
          toolVersion: '1.0.0',
        });

        await cache.set(testFile, 'old-result');
        await cache.save();
      }

      // Load cache with version 2.0.0
      {
        const cache = createFileCache<string>({
          cacheDir,
          namespace,
          toolVersion: '2.0.0',
        });

        let computeCalled = false;
        const result = await cache.get(testFile, async () => {
          computeCalled = true;
          return 'new-result';
        });

        // Should recompute due to version mismatch
        expect(computeCalled).toBe(true);
        expect(result).toBe('new-result');
      }
    });
  });
});
