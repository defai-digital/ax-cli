/**
 * Tests for Progress-Based Detection System (Phase 2)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressTracker, getProgressTracker, resetProgressTracker } from '../../packages/core/src/agent/progress-tracker.js';

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    tracker = new ProgressTracker();
  });

  describe('File Progress Tracking', () => {
    it('should detect progress when file is created', async () => {
      // Mock fs operations
      vi.mock('fs/promises', async () => {
        const actual = await vi.importActual('fs/promises');
        return {
          ...actual,
          stat: vi.fn().mockResolvedValue({
            size: 100,
            mtimeMs: Date.now(),
          }),
          readFile: vi.fn().mockResolvedValue(Buffer.from('new content')),
        };
      });

      const result = await tracker.checkFileProgress('/test/file.ts', 'create', true);

      expect(result.madeProgress).toBe(true);
    });

    it('should detect no progress for view operations', async () => {
      const result = await tracker.checkFileProgress('/test/file.ts', 'view', true);

      expect(result.madeProgress).toBe(true);
      expect(result.reason).toContain('retrieved');
    });

    it('should detect no progress on failed operations', async () => {
      const result = await tracker.checkFileProgress('/test/file.ts', 'edit', false);

      expect(result.madeProgress).toBe(false);
      expect(result.reason).toContain('failed');
    });
  });

  describe('Bash Progress Tracking', () => {
    it('should detect progress on successful command', () => {
      const result = tracker.checkBashProgress('npm test', 0, 'All tests passed');

      expect(result.madeProgress).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should detect no progress on repeated failures', () => {
      // First failure
      tracker.checkBashProgress('failing-command', 1, 'Error: command failed');

      // Same failure again
      const result = tracker.checkBashProgress('failing-command', 1, 'Error: command failed');

      expect(result.madeProgress).toBe(false);
      expect(result.outputChanged).toBe(false);
      expect(result.reason).toContain('same output');
    });

    it('should detect progress when error output changes', () => {
      // First failure
      tracker.checkBashProgress('flaky-command', 1, 'Error A');

      // Different error
      const result = tracker.checkBashProgress('flaky-command', 1, 'Error B');

      expect(result.madeProgress).toBe(true);
      expect(result.outputChanged).toBe(true);
    });
  });

  describe('File Operation Loop Detection', () => {
    it('should detect repeated failures on same file', () => {
      // Simulate 3 failures
      tracker['recordFileOp']('/test/file.ts', 'edit', false);
      tracker['recordFileOp']('/test/file.ts', 'edit', false);
      tracker['recordFileOp']('/test/file.ts', 'edit', false);

      const result = tracker.detectFileOpLoop('/test/file.ts');

      expect(result.isLoop).toBe(true);
      expect(result.reason).toContain('failed');
    });

    it('should not flag successful operations', () => {
      // Simulate successful operations
      tracker['recordFileOp']('/test/file.ts', 'edit', true);
      tracker['recordFileOp']('/test/file.ts', 'edit', true);

      const result = tracker.detectFileOpLoop('/test/file.ts');

      expect(result.isLoop).toBe(false);
    });

    it('should detect excessive edits on same file', () => {
      // Simulate many edits
      for (let i = 0; i < 5; i++) {
        tracker['recordFileOp']('/test/file.ts', 'edit', true);
      }

      const result = tracker.detectFileOpLoop('/test/file.ts');

      expect(result.isLoop).toBe(true);
      expect(result.reason).toContain('edited');
    });
  });

  describe('Statistics', () => {
    it('should track statistics correctly', async () => {
      // Add some operations
      tracker.checkBashProgress('cmd1', 0, 'output');
      tracker.checkBashProgress('cmd2', 0, 'output');
      tracker['recordFileOp']('/file1.ts', 'edit', true);
      tracker['recordFileOp']('/file2.ts', 'create', true);

      const stats = tracker.getStats();

      expect(stats.trackedCommands).toBeGreaterThan(0);
      expect(stats.recentOperations).toBe(2);
    });

    it('should reset all tracking', () => {
      tracker.checkBashProgress('cmd', 0, 'output');
      tracker['recordFileOp']('/file.ts', 'edit', true);

      tracker.reset();

      const stats = tracker.getStats();
      expect(stats.trackedCommands).toBe(0);
      expect(stats.recentOperations).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getProgressTracker', () => {
      resetProgressTracker();
      const instance1 = getProgressTracker();
      const instance2 = getProgressTracker();
      expect(instance1).toBe(instance2);
    });
  });
});
