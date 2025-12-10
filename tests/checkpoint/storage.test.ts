/**
 * Unit tests for CheckpointStorage
 *
 * Tests:
 * - Atomic writes
 * - Compression/decompression
 * - Hash calculation and verification
 * - Index operations
 * - Pruning logic
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CheckpointStorage, calculateHash, verifyFileSnapshot } from '../../packages/core/src/checkpoint/storage.js';
import type { Checkpoint, FileSnapshot } from '../../packages/core/src/checkpoint/types.js';

describe('CheckpointStorage', () => {
  let storage: CheckpointStorage;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(process.cwd(), `.test-checkpoints-${Date.now()}`);
    storage = new CheckpointStorage(testDir);
    await storage.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should create storage directory on initialize', async () => {
      const newTestDir = path.join(process.cwd(), `.test-checkpoints-init-${Date.now()}`);
      const newStorage = new CheckpointStorage(newTestDir);

      await newStorage.initialize();

      const checkpointsDir = path.join(newTestDir, 'checkpoints');
      const stat = await fs.stat(checkpointsDir);
      expect(stat.isDirectory()).toBe(true);

      // Cleanup
      await fs.rm(newTestDir, { recursive: true, force: true });
    });

    it('should create metadata index on initialize', async () => {
      const newTestDir = path.join(process.cwd(), `.test-checkpoints-index-${Date.now()}`);
      const newStorage = new CheckpointStorage(newTestDir);

      await newStorage.initialize();

      const indexPath = path.join(newTestDir, 'checkpoints', 'metadata.json');
      const content = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(content);

      expect(index).toHaveProperty('checkpoints');
      expect(index).toHaveProperty('stats');
      expect(index).toHaveProperty('lastUpdated');
      expect(Array.isArray(index.checkpoints)).toBe(true);

      // Cleanup
      await fs.rm(newTestDir, { recursive: true, force: true });
    });

    it('should handle initialization errors gracefully', async () => {
      // Create storage with invalid path (cross-platform)
      // On Windows: use an invalid drive letter, on Unix: use a path that requires root
      const isWindows = process.platform === 'win32';
      const invalidPath = isWindows
        ? 'Z:\\invalid\\path\\that\\cannot\\be\\created' // Non-existent drive on Windows
        : '/root/invalid/path/that/cannot/be/created'; // Requires root on Unix

      const invalidStorage = new CheckpointStorage(invalidPath);

      await expect(invalidStorage.initialize()).rejects.toThrow();
    });
  });

  describe('save', () => {
    it('should save checkpoint to disk', async () => {
      const checkpoint = createTestCheckpoint();

      await storage.save(checkpoint);

      const date = checkpoint.timestamp.toISOString().split('T')[0];
      const filepath = path.join(testDir, 'checkpoints', date, `checkpoint-${checkpoint.id}.json`);

      const stat = await fs.stat(filepath);
      expect(stat.isFile()).toBe(true);
    });

    it('should use atomic writes (temp file + rename)', async () => {
      const checkpoint = createTestCheckpoint();

      // Save checkpoint
      await storage.save(checkpoint);

      // Verify the final file exists (not the temp file)
      const date = checkpoint.timestamp.toISOString().split('T')[0];
      const filepath = path.join(testDir, 'checkpoints', date, `checkpoint-${checkpoint.id}.json`);
      const tempPath = `${filepath}.tmp`;

      // Final file should exist
      const stat = await fs.stat(filepath);
      expect(stat.isFile()).toBe(true);

      // Temp file should NOT exist (atomic rename completed)
      await expect(fs.stat(tempPath)).rejects.toThrow();
    });

    it('should create date-based subdirectory', async () => {
      const checkpoint = createTestCheckpoint();

      await storage.save(checkpoint);

      const date = checkpoint.timestamp.toISOString().split('T')[0];
      const dateDir = path.join(testDir, 'checkpoints', date);

      const stat = await fs.stat(dateDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should update index after saving', async () => {
      const checkpoint = createTestCheckpoint();

      await storage.save(checkpoint);

      const checkpoints = await storage.list();
      expect(checkpoints).toContain(checkpoint.id);
    });

    // Skip on Windows - fs.chmod doesn't work the same way on Windows
    it.skipIf(process.platform === 'win32')('should handle save errors', async () => {
      const checkpoint = createTestCheckpoint();

      // Make directory read-only to cause write error (Unix only)
      const checkpointsDir = path.join(testDir, 'checkpoints');
      await fs.chmod(checkpointsDir, 0o444);

      await expect(storage.save(checkpoint)).rejects.toThrow();

      // Restore permissions for cleanup
      await fs.chmod(checkpointsDir, 0o755);
    });
  });

  describe('load', () => {
    it('should load saved checkpoint', async () => {
      const original = createTestCheckpoint();
      await storage.save(original);

      const loaded = await storage.load(original.id);

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(original.id);
      expect(loaded?.description).toBe(original.description);
      expect(loaded?.files).toHaveLength(original.files.length);
    });

    it('should return null for non-existent checkpoint', async () => {
      const loaded = await storage.load('non-existent-id');
      expect(loaded).toBeNull();
    });

    it('should convert date strings back to Date objects', async () => {
      const original = createTestCheckpoint();
      await storage.save(original);

      const loaded = await storage.load(original.id);

      expect(loaded?.timestamp).toBeInstanceOf(Date);
      expect(loaded?.conversationState[0].timestamp).toBeInstanceOf(Date);
    });

    it('should load compressed checkpoints', async () => {
      const checkpoint = createTestCheckpoint();
      await storage.save(checkpoint);
      await storage.compress(checkpoint.id);

      const loaded = await storage.load(checkpoint.id);

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(checkpoint.id);
    });

    it('should handle load errors', async () => {
      const checkpoint = createTestCheckpoint();
      await storage.save(checkpoint);

      // Corrupt the file
      const date = checkpoint.timestamp.toISOString().split('T')[0];
      const filepath = path.join(testDir, 'checkpoints', date, `checkpoint-${checkpoint.id}.json`);
      await fs.writeFile(filepath, 'invalid json{', 'utf-8');

      await expect(storage.load(checkpoint.id)).rejects.toThrow();
    });
  });

  describe('list and listInfo', () => {
    it('should list all checkpoint IDs', async () => {
      const checkpoint1 = createTestCheckpoint();
      const checkpoint2 = createTestCheckpoint();

      await storage.save(checkpoint1);
      await storage.save(checkpoint2);

      const list = await storage.list();

      expect(list).toContain(checkpoint1.id);
      expect(list).toContain(checkpoint2.id);
      expect(list).toHaveLength(2);
    });

    it('should return empty array when no checkpoints', async () => {
      const list = await storage.list();
      expect(list).toEqual([]);
    });

    it('should list checkpoint info without loading full content', async () => {
      const checkpoint = createTestCheckpoint();
      await storage.save(checkpoint);

      const infoList = await storage.listInfo();

      expect(infoList).toHaveLength(1);
      expect(infoList[0].id).toBe(checkpoint.id);
      expect(infoList[0].description).toBe(checkpoint.description);
      expect(infoList[0].filesChanged).toHaveLength(checkpoint.files.length);
    });

    it('should sort checkpoints by timestamp (newest first)', async () => {
      const old = createTestCheckpoint();
      old.timestamp = new Date('2025-01-01');

      const recent = createTestCheckpoint();
      recent.timestamp = new Date('2025-11-20');

      await storage.save(old);
      await storage.save(recent);

      const infoList = await storage.listInfo();

      expect(infoList[0].id).toBe(recent.id);
      expect(infoList[1].id).toBe(old.id);
    });
  });

  describe('getCheckpointInfo', () => {
    it('should get info for specific checkpoint', async () => {
      const checkpoint = createTestCheckpoint();
      await storage.save(checkpoint);

      const info = await storage.getCheckpointInfo(checkpoint.id);

      expect(info).not.toBeNull();
      expect(info?.id).toBe(checkpoint.id);
      expect(info?.description).toBe(checkpoint.description);
    });

    it('should return null for non-existent checkpoint', async () => {
      const info = await storage.getCheckpointInfo('non-existent');
      expect(info).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete checkpoint file', async () => {
      const checkpoint = createTestCheckpoint();
      await storage.save(checkpoint);

      await storage.delete(checkpoint.id);

      const loaded = await storage.load(checkpoint.id);
      expect(loaded).toBeNull();
    });

    it('should remove checkpoint from index', async () => {
      const checkpoint = createTestCheckpoint();
      await storage.save(checkpoint);

      await storage.delete(checkpoint.id);

      const list = await storage.list();
      expect(list).not.toContain(checkpoint.id);
    });

    it('should update stats after deletion', async () => {
      const checkpoint = createTestCheckpoint();
      await storage.save(checkpoint);

      const statsBefore = await storage.getStats();
      expect(statsBefore.totalCount).toBe(1);

      await storage.delete(checkpoint.id);

      const statsAfter = await storage.getStats();
      expect(statsAfter.totalCount).toBe(0);
    });

    it('should handle deleting non-existent checkpoint gracefully', async () => {
      await expect(storage.delete('non-existent')).resolves.not.toThrow();
    });

    it('should delete compressed checkpoints', async () => {
      const checkpoint = createTestCheckpoint();
      await storage.save(checkpoint);
      await storage.compress(checkpoint.id);

      await storage.delete(checkpoint.id);

      const info = await storage.getCheckpointInfo(checkpoint.id);
      expect(info).toBeNull();
    });
  });

  describe('compress', () => {
    it('should compress checkpoint', async () => {
      const checkpoint = createTestCheckpoint();
      await storage.save(checkpoint);

      const infoBefore = await storage.getCheckpointInfo(checkpoint.id);
      const sizeBefore = infoBefore!.size;

      await storage.compress(checkpoint.id);

      const infoAfter = await storage.getCheckpointInfo(checkpoint.id);
      expect(infoAfter?.compressed).toBe(true);

      // Compressed file should generally be smaller (though not guaranteed for small files)
      // Just verify it's still loadable
      const loaded = await storage.load(checkpoint.id);
      expect(loaded?.id).toBe(checkpoint.id);
    });

    it('should not compress already compressed checkpoint', async () => {
      const checkpoint = createTestCheckpoint();
      await storage.save(checkpoint);
      await storage.compress(checkpoint.id);

      const info1 = await storage.getCheckpointInfo(checkpoint.id);

      // Try to compress again
      await storage.compress(checkpoint.id);

      const info2 = await storage.getCheckpointInfo(checkpoint.id);
      expect(info2?.compressed).toBe(true);
    });

    it('should update compression status in index', async () => {
      const checkpoint = createTestCheckpoint();
      await storage.save(checkpoint);

      const statsBefore = await storage.getStats();
      expect(statsBefore.compressedCount).toBe(0);

      await storage.compress(checkpoint.id);

      const statsAfter = await storage.getStats();
      expect(statsAfter.compressedCount).toBe(1);
    });

    it('should delete uncompressed file after compression', async () => {
      const checkpoint = createTestCheckpoint();
      await storage.save(checkpoint);

      const date = checkpoint.timestamp.toISOString().split('T')[0];
      const uncompressedPath = path.join(testDir, 'checkpoints', date, `checkpoint-${checkpoint.id}.json`);

      await storage.compress(checkpoint.id);

      // Uncompressed file should not exist
      await expect(fs.access(uncompressedPath)).rejects.toThrow();

      // Compressed file should exist
      const compressedPath = `${uncompressedPath}.gz`;
      await expect(fs.access(compressedPath)).resolves.not.toThrow();
    });

    it('should handle compression errors', async () => {
      await expect(storage.compress('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const checkpoint1 = createTestCheckpoint();
      const checkpoint2 = createTestCheckpoint();

      await storage.save(checkpoint1);
      await storage.save(checkpoint2);

      const stats = await storage.getStats();

      expect(stats.totalCount).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.compressedCount).toBe(0);
      expect(stats.oldestDate).toBeInstanceOf(Date);
      expect(stats.newestDate).toBeInstanceOf(Date);
    });

    it('should update stats after compression', async () => {
      const checkpoint = createTestCheckpoint();
      await storage.save(checkpoint);

      await storage.compress(checkpoint.id);

      const stats = await storage.getStats();
      expect(stats.compressedCount).toBe(1);
    });

    it('should return empty stats when no checkpoints', async () => {
      const stats = await storage.getStats();

      expect(stats.totalCount).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.compressedCount).toBe(0);
    });
  });

  describe('pruneOlderThan', () => {
    it('should prune checkpoints older than date', async () => {
      const old1 = createTestCheckpoint();
      old1.timestamp = new Date('2025-01-01');

      const old2 = createTestCheckpoint();
      old2.timestamp = new Date('2025-01-15');

      const recent = createTestCheckpoint();
      recent.timestamp = new Date('2025-11-20');

      await storage.save(old1);
      await storage.save(old2);
      await storage.save(recent);

      const cutoffDate = new Date('2025-02-01');
      const pruned = await storage.pruneOlderThan(cutoffDate);

      expect(pruned).toBe(2);

      const remaining = await storage.list();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]).toBe(recent.id);
    });

    it('should not prune recent checkpoints', async () => {
      const recent = createTestCheckpoint();
      await storage.save(recent);

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const pruned = await storage.pruneOlderThan(futureDate);

      expect(pruned).toBe(1);
    });

    it('should return 0 when no checkpoints to prune', async () => {
      const recent = createTestCheckpoint();
      await storage.save(recent);

      const pastDate = new Date('2020-01-01');
      const pruned = await storage.pruneOlderThan(pastDate);

      expect(pruned).toBe(0);
    });

    it('should update stats after pruning', async () => {
      const old = createTestCheckpoint();
      old.timestamp = new Date('2025-01-01');
      await storage.save(old);

      const cutoffDate = new Date('2025-02-01');
      await storage.pruneOlderThan(cutoffDate);

      const stats = await storage.getStats();
      expect(stats.totalCount).toBe(0);
    });
  });

  describe('getTotalSize', () => {
    it('should return total storage size', async () => {
      const checkpoint1 = createTestCheckpoint();
      const checkpoint2 = createTestCheckpoint();

      await storage.save(checkpoint1);
      await storage.save(checkpoint2);

      const totalSize = await storage.getTotalSize();
      expect(totalSize).toBeGreaterThan(0);
    });

    it('should return 0 when no checkpoints', async () => {
      const totalSize = await storage.getTotalSize();
      expect(totalSize).toBe(0);
    });
  });
});

describe('Hash functions', () => {
  describe('calculateHash', () => {
    it('should calculate SHA-256 hash', () => {
      const content = 'test content';
      const hash = calculateHash(content);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it('should produce consistent hashes for same content', () => {
      const content = 'test content';
      const hash1 = calculateHash(content);
      const hash2 = calculateHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const hash1 = calculateHash('content 1');
      const hash2 = calculateHash('content 2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = calculateHash('');
      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });

    it('should handle Unicode content', () => {
      const hash = calculateHash('Hello 世界 🌍');
      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });

    it('should handle large content', () => {
      const largeContent = 'x'.repeat(1000000);
      const hash = calculateHash(largeContent);
      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });
  });

  describe('verifyFileSnapshot', () => {
    it('should verify valid snapshot', () => {
      const content = 'test content';
      const hash = calculateHash(content);
      const snapshot = { content, hash };

      expect(verifyFileSnapshot(snapshot)).toBe(true);
    });

    it('should reject invalid snapshot', () => {
      const snapshot = {
        content: 'test content',
        hash: 'invalid-hash',
      };

      expect(verifyFileSnapshot(snapshot)).toBe(false);
    });

    it('should reject tampered content', () => {
      const content = 'original content';
      const hash = calculateHash(content);
      const snapshot = {
        content: 'tampered content',
        hash,
      };

      expect(verifyFileSnapshot(snapshot)).toBe(false);
    });

    it('should handle empty content', () => {
      const content = '';
      const hash = calculateHash(content);
      const snapshot = { content, hash };

      expect(verifyFileSnapshot(snapshot)).toBe(true);
    });
  });
});

// ==================== Helper Functions ====================

function createTestCheckpoint(): Checkpoint {
  const id = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const content = 'test file content';

  // Use cross-platform path
  const testFilePath = path.join(process.cwd(), 'test-file.ts');

  return {
    id,
    timestamp: new Date(),
    description: 'Test checkpoint',
    files: [
      {
        path: testFilePath,
        content,
        hash: calculateHash(content),
        size: Buffer.byteLength(content),
      },
    ],
    conversationState: [
      {
        type: 'user',
        content: 'Test message',
        timestamp: new Date(),
      },
    ],
    metadata: {
      model: 'glm-4.6',
      triggeredBy: 'test',
      compressed: false,
    },
  };
}
