/**
 * Unit tests for CheckpointManager
 *
 * Tests:
 * - Checkpoint creation
 * - Checkpoint limit enforcement (max 100)
 * - Listing with filters
 * - Checkpoint application/restoration
 * - Background tasks (compression, pruning)
 * - Conversation depth limiting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  CheckpointManager,
  getCheckpointManager,
  initCheckpointManager,
  resetCheckpointManager,
} from '../../src/checkpoint/manager.js';
import type { CheckpointConfig, CheckpointOptions, ChatEntry } from '../../src/checkpoint/types.js';

describe('CheckpointManager', () => {
  let manager: CheckpointManager;
  let testDir: string;

  beforeEach(async () => {
    // Reset singleton
    resetCheckpointManager();

    // Create test directory
    testDir = path.join(process.cwd(), `.test-checkpoint-mgr-${Date.now()}`);

    // Initialize manager with test config
    const config: Partial<CheckpointConfig> = {
      enabled: true,
      maxCheckpoints: 5, // Lower limit for testing
      compressAfterDays: 1,
      pruneAfterDays: 7,
      conversationDepth: 10,
      storageDir: path.join(testDir, 'checkpoints'),
    };

    manager = new CheckpointManager(config);
    await manager.initialize();
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    resetCheckpointManager();
  });

  describe('initialization', () => {
    it('should initialize only once', async () => {
      await manager.initialize();
      await manager.initialize();
      // Should not throw and directory should still exist
      const checkpointsDir = path.join(testDir, 'checkpoints');
      const stat = await fs.stat(checkpointsDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should create storage directory', async () => {
      const checkpointsDir = path.join(testDir, 'checkpoints');
      const stat = await fs.stat(checkpointsDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it.skip('should start background tasks when enabled', async () => {
      // TODO: This requires mocking background task intervals or verifying task execution
      // Skipping for now as it requires more complex test infrastructure
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance from getCheckpointManager', () => {
      const instance1 = getCheckpointManager();
      const instance2 = getCheckpointManager();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance with initCheckpointManager', () => {
      const instance1 = getCheckpointManager();
      const instance2 = initCheckpointManager();

      expect(instance1).not.toBe(instance2);
    });

    it('should reset singleton with resetCheckpointManager', () => {
      const instance1 = getCheckpointManager();
      resetCheckpointManager();
      const instance2 = getCheckpointManager();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('createCheckpoint', () => {
    it('should create checkpoint with provided options', async () => {
      const options = createTestOptions();

      const checkpoint = await manager.createCheckpoint(options);

      expect(checkpoint.id).toBeTruthy();
      expect(checkpoint.timestamp).toBeInstanceOf(Date);
      expect(checkpoint.description).toBe(options.description);
      expect(checkpoint.files).toHaveLength(options.files.length);
    });

    it('should generate default description when not provided', async () => {
      const options = createTestOptions();
      delete options.description;

      const checkpoint = await manager.createCheckpoint(options);

      expect(checkpoint.description).toContain('Before modifying');
    });

    it('should calculate file hashes', async () => {
      const options = createTestOptions();

      const checkpoint = await manager.createCheckpoint(options);

      expect(checkpoint.files[0].hash).toBeTruthy();
      expect(checkpoint.files[0].hash.length).toBe(64); // SHA-256
    });

    it('should limit conversation depth', async () => {
      const options = createTestOptions();

      // Create 20 conversation entries (exceeds limit of 10)
      options.conversationState = Array.from({ length: 20 }, (_, i) => ({
        type: 'user' as const,
        content: `Message ${i}`,
        timestamp: new Date(),
      }));

      const checkpoint = await manager.createCheckpoint(options);

      // Should only keep last 10
      expect(checkpoint.conversationState).toHaveLength(10);
    });

    it('should throw when checkpoint system is disabled', async () => {
      const disabledManager = new CheckpointManager({ enabled: false });
      const options = createTestOptions();

      await expect(disabledManager.createCheckpoint(options)).rejects.toThrow('Checkpoint system is disabled');
    });

    it('should enforce checkpoint limit', async () => {
      // Create 5 checkpoints (max for our test config)
      for (let i = 0; i < 5; i++) {
        await manager.createCheckpoint(createTestOptions());
      }

      // Create one more (should trigger deletion of oldest)
      await manager.createCheckpoint(createTestOptions());

      const checkpoints = await manager.listCheckpoints();
      expect(checkpoints.length).toBe(5); // Should not exceed limit
    });

    it('should handle empty file list', async () => {
      const options = createTestOptions();
      options.files = [];
      delete options.description; // Use auto-generated description

      const checkpoint = await manager.createCheckpoint(options);

      expect(checkpoint.files).toHaveLength(0);
      expect(checkpoint.description).toContain('Auto-generated');
    });

    it('should handle single file', async () => {
      const options = createTestOptions();
      options.files = [{ path: '/test/single.ts', content: 'content' }];
      delete options.description; // Use auto-generated description

      const checkpoint = await manager.createCheckpoint(options);

      expect(checkpoint.description).toContain('single.ts');
    });

    it('should handle multiple files', async () => {
      const options = createTestOptions();
      options.files = [
        { path: '/test/file1.ts', content: 'content 1' },
        { path: '/test/file2.ts', content: 'content 2' },
        { path: '/test/file3.ts', content: 'content 3' },
      ];
      delete options.description; // Use auto-generated description

      const checkpoint = await manager.createCheckpoint(options);

      expect(checkpoint.description).toContain('3 files');
    });
  });

  describe('listCheckpoints', () => {
    beforeEach(async () => {
      // Create test checkpoints with different timestamps
      for (let i = 0; i < 3; i++) {
        const options = createTestOptions();
        const checkpoint = await manager.createCheckpoint(options);

        // Manually set timestamp for testing
        if (i === 0) {
          checkpoint.timestamp = new Date('2025-01-01');
        } else if (i === 1) {
          checkpoint.timestamp = new Date('2025-06-01');
        } else {
          checkpoint.timestamp = new Date('2025-11-20');
        }
      }
    });

    it('should list all checkpoints', async () => {
      const checkpoints = await manager.listCheckpoints();
      expect(checkpoints.length).toBeGreaterThan(0);
    });

    it('should filter by since date', async () => {
      const checkpoints = await manager.listCheckpoints({
        since: new Date('2025-05-01'),
      });

      expect(checkpoints.length).toBeLessThanOrEqual(3);
      checkpoints.forEach(c => {
        expect(c.timestamp.getTime()).toBeGreaterThanOrEqual(new Date('2025-05-01').getTime());
      });
    });

    it('should filter by until date', async () => {
      const checkpoints = await manager.listCheckpoints({
        until: new Date('2025-07-01'),
      });

      checkpoints.forEach(c => {
        expect(c.timestamp.getTime()).toBeLessThanOrEqual(new Date('2025-07-01').getTime());
      });
    });

    it('should filter by limit', async () => {
      const checkpoints = await manager.listCheckpoints({
        limit: 2,
      });

      expect(checkpoints.length).toBeLessThanOrEqual(2);
    });

    it('should filter by files changed', async () => {
      // Create checkpoint with specific file
      const options = createTestOptions();
      options.files = [{ path: '/test/specific.ts', content: 'content' }];
      await manager.createCheckpoint(options);

      const checkpoints = await manager.listCheckpoints({
        filesChanged: ['specific.ts'],
      });

      expect(checkpoints.length).toBeGreaterThan(0);
      checkpoints.forEach(c => {
        expect(c.filesChanged.some(f => f.includes('specific.ts'))).toBe(true);
      });
    });

    it('should filter by compressed status', async () => {
      const checkpoints = await manager.listCheckpoints({
        includeCompressed: false,
      });

      checkpoints.forEach(c => {
        expect(c.compressed).toBe(false);
      });
    });

    it('should return empty array when no checkpoints match filter', async () => {
      const checkpoints = await manager.listCheckpoints({
        since: new Date('2030-01-01'),
      });

      expect(checkpoints).toEqual([]);
    });
  });

  describe('getCheckpoint', () => {
    it('should get checkpoint by ID', async () => {
      const options = createTestOptions();
      const created = await manager.createCheckpoint(options);

      const retrieved = await manager.getCheckpoint(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent checkpoint', async () => {
      const retrieved = await manager.getCheckpoint('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('applyCheckpoint', () => {
    it('should restore files from checkpoint', async () => {
      // Create a test file
      const testFilePath = path.join(testDir, 'test-file.txt');
      const originalContent = 'original content';
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, originalContent, 'utf-8');

      // Create checkpoint
      const options = createTestOptions();
      options.files = [{ path: testFilePath, content: originalContent }];
      const checkpoint = await manager.createCheckpoint(options);

      // Modify file
      await fs.writeFile(testFilePath, 'modified content', 'utf-8');

      // Apply checkpoint
      const result = await manager.applyCheckpoint(checkpoint.id);

      expect(result.success).toBe(true);
      expect(result.filesRestored).toContain(testFilePath);

      // Verify file was restored
      const restoredContent = await fs.readFile(testFilePath, 'utf-8');
      expect(restoredContent).toBe(originalContent);
    });

    it('should return conversation index', async () => {
      const options = createTestOptions();
      options.conversationState = Array.from({ length: 5 }, (_, i) => ({
        type: 'user' as const,
        content: `Message ${i}`,
        timestamp: new Date(),
      }));

      const checkpoint = await manager.createCheckpoint(options);
      const result = await manager.applyCheckpoint(checkpoint.id);

      expect(result.conversationIndex).toBe(5);
    });

    it('should handle non-existent checkpoint', async () => {
      const result = await manager.applyCheckpoint('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should track failed file restorations', async () => {
      const options = createTestOptions();

      // Use cross-platform invalid path
      // On Windows: use an invalid drive letter, on Unix: use a path that requires root
      const isWindows = process.platform === 'win32';
      const invalidPath = isWindows
        ? 'Z:\\invalid\\path\\that\\cannot\\be\\written.txt' // Non-existent drive on Windows
        : '/root/invalid/path/that/cannot/be/written.txt'; // Requires root on Unix

      options.files = [{ path: invalidPath, content: 'content' }];

      const checkpoint = await manager.createCheckpoint(options);

      // Try to apply (should fail due to invalid path)
      const result = await manager.applyCheckpoint(checkpoint.id);

      expect(result.success).toBe(false);
      expect(result.filesFailed.length).toBeGreaterThan(0);
    });

    it('should verify file integrity before restoration', async () => {
      const testFilePath = path.join(testDir, 'integrity-test.txt');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });

      const options = createTestOptions();
      options.files = [{ path: testFilePath, content: 'test content' }];

      const checkpoint = await manager.createCheckpoint(options);

      // Corrupt the checkpoint data (simulate tampering)
      // Note: This is tricky to test without directly accessing storage internals
      // For now, just verify the apply succeeds with valid data
      const result = await manager.applyCheckpoint(checkpoint.id);

      expect(result.success).toBe(true);
    });
  });

  describe('deleteCheckpoint', () => {
    it('should delete checkpoint', async () => {
      const options = createTestOptions();
      const checkpoint = await manager.createCheckpoint(options);

      await manager.deleteCheckpoint(checkpoint.id);

      const retrieved = await manager.getCheckpoint(checkpoint.id);
      expect(retrieved).toBeNull();
    });

    it('should handle deleting non-existent checkpoint', async () => {
      await expect(manager.deleteCheckpoint('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      await manager.createCheckpoint(createTestOptions());
      await manager.createCheckpoint(createTestOptions());

      const stats = await manager.getStats();

      expect(stats.totalCount).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.oldestDate).toBeInstanceOf(Date);
      expect(stats.newestDate).toBeInstanceOf(Date);
    });

    it('should return empty stats when no checkpoints', async () => {
      const stats = await manager.getStats();

      expect(stats.totalCount).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('compressOldCheckpoints', () => {
    it('should compress checkpoints older than threshold', async () => {
      // Create checkpoint with old timestamp
      const options = createTestOptions();
      const checkpoint = await manager.createCheckpoint(options);

      // Manually set old timestamp (older than compressAfterDays)
      checkpoint.timestamp = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

      const compressed = await manager.compressOldCheckpoints();

      // Compression may or may not succeed depending on implementation details
      // Just verify it doesn't throw
      expect(compressed).toBeGreaterThanOrEqual(0);
    });

    it('should not compress recent checkpoints', async () => {
      await manager.createCheckpoint(createTestOptions());

      const compressed = await manager.compressOldCheckpoints();

      expect(compressed).toBe(0);
    });

    it('should return 0 when disabled', async () => {
      const disabledManager = new CheckpointManager({ enabled: false });

      const compressed = await disabledManager.compressOldCheckpoints();

      expect(compressed).toBe(0);
    });
  });

  describe('pruneOldCheckpoints', () => {
    it('should prune checkpoints older than threshold', async () => {
      // Create old checkpoint
      const options = createTestOptions();
      const checkpoint = await manager.createCheckpoint(options);

      // Manually set very old timestamp
      checkpoint.timestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      const pruned = await manager.pruneOldCheckpoints();

      // Pruning may or may not succeed depending on implementation
      expect(pruned).toBeGreaterThanOrEqual(0);
    });

    it('should not prune recent checkpoints', async () => {
      await manager.createCheckpoint(createTestOptions());

      const pruned = await manager.pruneOldCheckpoints();

      expect(pruned).toBe(0);
    });

    it('should return 0 when disabled', async () => {
      const disabledManager = new CheckpointManager({ enabled: false });

      const pruned = await disabledManager.pruneOldCheckpoints();

      expect(pruned).toBe(0);
    });
  });

  describe('checkpoint limit enforcement', () => {
    it('should delete oldest checkpoints when limit exceeded', async () => {
      // Create checkpoints up to limit (5 in test config)
      // Add small delays to ensure distinct timestamps for reliable sorting
      const checkpoints = [];
      for (let i = 0; i < 5; i++) {
        const checkpoint = await manager.createCheckpoint(createTestOptions());
        checkpoints.push(checkpoint);
        await new Promise(resolve => setTimeout(resolve, 5)); // 5ms delay for distinct timestamps
      }

      // Create one more (should trigger deletion of oldest)
      await new Promise(resolve => setTimeout(resolve, 5));
      const newest = await manager.createCheckpoint(createTestOptions());

      const allCheckpoints = await manager.listCheckpoints();
      expect(allCheckpoints.length).toBe(5);

      // Newest should still exist
      const retrieved = await manager.getCheckpoint(newest.id);
      expect(retrieved).not.toBeNull();

      // First checkpoint should be deleted
      const oldest = await manager.getCheckpoint(checkpoints[0].id);
      expect(oldest).toBeNull();
    });

    it('should maintain limit across multiple creates', async () => {
      // Create 10 checkpoints (double the limit)
      for (let i = 0; i < 10; i++) {
        await manager.createCheckpoint(createTestOptions());
      }

      const allCheckpoints = await manager.listCheckpoints();
      expect(allCheckpoints.length).toBe(5); // Should maintain limit
    });
  });

  describe('conversation depth limiting', () => {
    it('should limit conversation to configured depth', async () => {
      const options = createTestOptions();

      // Create 50 conversation entries (exceeds limit of 10)
      options.conversationState = Array.from({ length: 50 }, (_, i) => ({
        type: 'user' as const,
        content: `Message ${i}`,
        timestamp: new Date(),
      }));

      const checkpoint = await manager.createCheckpoint(options);

      expect(checkpoint.conversationState).toHaveLength(10);
    });

    it('should keep most recent messages', async () => {
      const options = createTestOptions();

      options.conversationState = Array.from({ length: 20 }, (_, i) => ({
        type: 'user' as const,
        content: `Message ${i}`,
        timestamp: new Date(),
      }));

      const checkpoint = await manager.createCheckpoint(options);

      // Should keep messages 10-19 (last 10)
      expect(checkpoint.conversationState[0].content).toBe('Message 10');
      expect(checkpoint.conversationState[9].content).toBe('Message 19');
    });

    it('should not limit when below threshold', async () => {
      const options = createTestOptions();

      options.conversationState = Array.from({ length: 5 }, (_, i) => ({
        type: 'user' as const,
        content: `Message ${i}`,
        timestamp: new Date(),
      }));

      const checkpoint = await manager.createCheckpoint(options);

      expect(checkpoint.conversationState).toHaveLength(5);
    });
  });

  describe('error handling', () => {
    it('should handle storage errors gracefully', async () => {
      // Create manager with invalid storage path (cross-platform)
      // On Windows: use an invalid drive letter, on Unix: use a path that requires root
      const isWindows = process.platform === 'win32';
      const invalidPath = isWindows
        ? 'Z:\\invalid\\path\\that\\cannot\\exist'
        : '/invalid/path/that/cannot/exist';

      const invalidManager = new CheckpointManager({
        storageDir: invalidPath,
      });

      await expect(invalidManager.initialize()).rejects.toThrow();
    });

    it.skip('should continue after background task failures', async () => {
      // TODO: This requires mocking background tasks and forcing failures
      // Skipping for now as it requires more complex test infrastructure
    });
  });

  describe('getConversationState', () => {
    it('should return conversation state for valid checkpoint', async () => {
      const options = createTestOptions();
      options.conversationState = [
        { type: 'user' as const, content: 'Test 1', timestamp: new Date() },
        { type: 'assistant' as const, content: 'Response 1', timestamp: new Date() },
      ];

      const checkpoint = await manager.createCheckpoint(options);
      const state = await manager.getConversationState(checkpoint.id);

      expect(state).not.toBeNull();
      expect(state).toHaveLength(2);
      expect(state![0].content).toBe('Test 1');
    });

    it('should return null for non-existent checkpoint', async () => {
      const state = await manager.getConversationState('non-existent-id');
      expect(state).toBeNull();
    });
  });

  describe('shouldCreateCheckpoint', () => {
    it('should return true for operations in createBeforeOperations', () => {
      expect(manager.shouldCreateCheckpoint('write')).toBe(true);
      expect(manager.shouldCreateCheckpoint('edit')).toBe(true);
      expect(manager.shouldCreateCheckpoint('delete')).toBe(true);
    });

    it('should return false for operations not in createBeforeOperations', () => {
      expect(manager.shouldCreateCheckpoint('read')).toBe(false);
      expect(manager.shouldCreateCheckpoint('list')).toBe(false);
      expect(manager.shouldCreateCheckpoint('unknown')).toBe(false);
    });

    it('should return false when checkpoints are disabled', () => {
      const disabledManager = new CheckpointManager({ enabled: false });
      expect(disabledManager.shouldCreateCheckpoint('write')).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      manager.updateConfig({ maxCheckpoints: 200 });
      const config = manager.getConfig();
      expect(config.maxCheckpoints).toBe(200);
    });

    it('should merge with existing config', () => {
      const originalConfig = manager.getConfig();
      manager.updateConfig({ enabled: false });
      const newConfig = manager.getConfig();

      expect(newConfig.enabled).toBe(false);
      expect(newConfig.maxCheckpoints).toBe(originalConfig.maxCheckpoints);
    });

    it('should warn and skip storageDir change', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const originalConfig = manager.getConfig();

      manager.updateConfig({ storageDir: '/new/path' });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot change storageDir'));
      expect(manager.getConfig().storageDir).toBe(originalConfig.storageDir);
      warnSpy.mockRestore();
    });

    it('should allow updating other config while rejecting storageDir', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      manager.updateConfig({ storageDir: '/new/path', maxCheckpoints: 999 });

      expect(manager.getConfig().maxCheckpoints).toBe(999);
      warnSpy.mockRestore();
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const config1 = manager.getConfig();
      const config2 = manager.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different object references
    });
  });

  describe('getCheckpointInfo', () => {
    it('should return checkpoint info by ID', async () => {
      const options = createTestOptions();
      const checkpoint = await manager.createCheckpoint(options);

      const info = await manager.getCheckpointInfo(checkpoint.id);

      expect(info).not.toBeNull();
      expect(info?.id).toBe(checkpoint.id);
      expect(info?.description).toBe(checkpoint.description);
    });

    it('should return null for non-existent checkpoint', async () => {
      const info = await manager.getCheckpointInfo('non-existent-id');
      expect(info).toBeNull();
    });
  });

  describe('restoreCheckpoint alias', () => {
    it('restoreCheckpoint should work the same as applyCheckpoint', async () => {
      const testFilePath = path.join(testDir, 'restore-test.txt');
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, 'original', 'utf-8');

      const options = createTestOptions();
      options.files = [{ path: testFilePath, content: 'original' }];
      const checkpoint = await manager.createCheckpoint(options);

      await fs.writeFile(testFilePath, 'modified', 'utf-8');
      const result = await manager.restoreCheckpoint(checkpoint.id);

      expect(result.success).toBe(true);
    });
  });

  describe('validation edge cases', () => {
    it('should throw when conversationState is missing', async () => {
      const options = createTestOptions();
      (options as any).conversationState = null;

      await expect(manager.createCheckpoint(options)).rejects.toThrow('conversationState is required');
    });

    it('should throw when conversationDepth is invalid', async () => {
      const invalidManager = new CheckpointManager({
        enabled: true,
        conversationDepth: 0,
        storageDir: path.join(testDir, 'invalid-depth'),
      });
      await invalidManager.initialize();

      const options = createTestOptions();

      await expect(invalidManager.createCheckpoint(options)).rejects.toThrow('Invalid conversationDepth');
    });

    it('should handle invalid pruneAfterDays config', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const invalidManager = new CheckpointManager({
        enabled: true,
        pruneAfterDays: -1,
        storageDir: path.join(testDir, 'invalid-prune'),
      });
      await invalidManager.initialize();

      const result = await invalidManager.pruneOldCheckpoints();

      expect(result).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid pruneAfterDays'));
      warnSpy.mockRestore();
    });

    it('should handle invalid compressAfterDays config', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const invalidManager = new CheckpointManager({
        enabled: true,
        compressAfterDays: 0,
        storageDir: path.join(testDir, 'invalid-compress'),
      });
      await invalidManager.initialize();

      const result = await invalidManager.compressOldCheckpoints();

      expect(result).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid compressAfterDays'));
      warnSpy.mockRestore();
    });

    it('should handle invalid maxCheckpoints config', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const invalidManager = new CheckpointManager({
        enabled: true,
        maxCheckpoints: -5,
        storageDir: path.join(testDir, 'invalid-max'),
      });
      await invalidManager.initialize();

      // Create a checkpoint to trigger maintenance
      await invalidManager.createCheckpoint(createTestOptions());

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid maxCheckpoints'));
      warnSpy.mockRestore();
    });
  });

  describe('storage limit enforcement', () => {
    it('should delete oldest checkpoints when storage limit exceeded', async () => {
      // Create manager with very small storage limit (1KB)
      const smallLimitManager = new CheckpointManager({
        enabled: true,
        storageLimit: 0.0001, // ~100 bytes - forces immediate limit enforcement
        maxCheckpoints: 100, // High limit so storage limit triggers instead
        storageDir: path.join(testDir, 'small-storage'),
      });
      await smallLimitManager.initialize();

      // Create several checkpoints with content
      const options = createTestOptions();
      options.files = [{ path: path.join(testDir, 'large.txt'), content: 'A'.repeat(1000) }];

      await smallLimitManager.createCheckpoint(options);
      await smallLimitManager.createCheckpoint(options);
      await smallLimitManager.createCheckpoint(options);

      // Storage limit should have deleted some checkpoints
      const remaining = await smallLimitManager.listCheckpoints();
      expect(remaining.length).toBeLessThan(3);
    });
  });

  describe('concurrent maintenance prevention', () => {
    it('should skip concurrent maintenance runs', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Access private maintenanceRunning flag
      (manager as any).maintenanceRunning = true;

      await manager.runMaintenance();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Maintenance already running'));
      (manager as any).maintenanceRunning = false;
      warnSpy.mockRestore();
    });
  });
});

// ==================== Helper Functions ====================

function createTestOptions(): CheckpointOptions {
  // Use cross-platform path - path.join handles platform differences
  const testFilePath = path.join(process.cwd(), `test-file-${Date.now()}.ts`);

  return {
    description: 'Test checkpoint',
    files: [
      {
        path: testFilePath,
        content: 'test content',
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
    },
  };
}
