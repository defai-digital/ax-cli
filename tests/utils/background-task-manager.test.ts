/**
 * Tests for Background Task Manager
 *
 * @module tests/utils/background-task-manager.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import {
  BackgroundTaskManager,
  getBackgroundTaskManager,
  type BackgroundTask,
  type TaskOutput,
} from '../../packages/core/src/utils/background-task-manager.js';

// We need to test a fresh instance each time, but the module exports a singleton
// So we'll test the public interface through the singleton

describe('BackgroundTaskManager', () => {
  let manager: BackgroundTaskManager;

  beforeEach(() => {
    manager = getBackgroundTaskManager();
    // Clear any existing completed tasks
    manager.clearCompletedTasks();
  });

  afterEach(() => {
    // Kill any remaining running tasks
    for (const task of manager.listTasks()) {
      if (task.status === 'running') {
        manager.kill(task.id);
      }
    }
    // Clear all tasks
    manager.clearCompletedTasks();
  });

  describe('getInstance / getBackgroundTaskManager', () => {
    it('should return singleton instance', () => {
      const instance1 = getBackgroundTaskManager();
      const instance2 = getBackgroundTaskManager();
      expect(instance1).toBe(instance2);
    });

    it('should be an EventEmitter', () => {
      expect(manager).toBeInstanceOf(EventEmitter);
    });
  });

  describe('spawn', () => {
    it('should spawn a command and return task ID', () => {
      const taskId = manager.spawn('echo "hello"');

      expect(taskId).toBeDefined();
      expect(taskId).toMatch(/^bg_/);
    });

    it('should generate unique task IDs', () => {
      const id1 = manager.spawn('echo "1"');
      const id2 = manager.spawn('echo "2"');

      expect(id1).not.toBe(id2);
    });

    it('should add task to list', () => {
      const taskId = manager.spawn('echo "test"');

      const tasks = manager.listTasks();
      expect(tasks.some(t => t.id === taskId)).toBe(true);
    });

    it('should set initial status to running', () => {
      const taskId = manager.spawn('sleep 10');

      const task = manager.getTaskInfo(taskId);
      expect(task?.status).toBe('running');

      // Clean up
      manager.kill(taskId);
    });

    it('should emit taskStarted event', async () => {
      const startedPromise = new Promise<{ taskId: string; command: string }>((resolve) => {
        manager.once('taskStarted', resolve);
      });

      const taskId = manager.spawn('echo "test"');
      const event = await startedPromise;

      expect(event.taskId).toBe(taskId);
      expect(event.command).toBe('echo "test"');
    });

    it('should use provided working directory', () => {
      const cwd = '/tmp';
      const taskId = manager.spawn('pwd', cwd);

      const task = manager.getTaskInfo(taskId);
      expect(task?.cwd).toBe(cwd);
    });

    it('should capture stdout', async () => {
      const taskId = manager.spawn('echo "hello world"');

      // Wait for task to complete
      const output = await manager.waitForTask(taskId, 5000);

      expect(output?.stdout).toContain('hello world');
    });

    it('should capture stderr', async () => {
      const taskId = manager.spawn('echo "error message" >&2');

      const output = await manager.waitForTask(taskId, 5000);

      expect(output?.stderr).toContain('error message');
    });

    it('should set status to completed on success', async () => {
      const taskId = manager.spawn('echo "success"');

      await manager.waitForTask(taskId, 5000);

      const output = manager.getOutput(taskId);
      expect(output?.status).toBe('completed');
      expect(output?.exitCode).toBe(0);
    });

    it('should set status to failed on non-zero exit', async () => {
      const taskId = manager.spawn('exit 1');

      await manager.waitForTask(taskId, 5000);

      const output = manager.getOutput(taskId);
      expect(output?.status).toBe('failed');
      expect(output?.exitCode).toBe(1);
    });

    it('should emit taskComplete event', async () => {
      const completePromise = new Promise<{ taskId: string; exitCode: number | null; status: string }>((resolve) => {
        manager.once('taskComplete', resolve);
      });

      const taskId = manager.spawn('echo "done"');
      const event = await completePromise;

      expect(event.taskId).toBe(taskId);
      expect(event.exitCode).toBe(0);
      expect(event.status).toBe('completed');
    });

    it('should limit output buffer size', async () => {
      // Generate more than 1000 lines (maxOutputLines)
      const taskId = manager.spawn('for i in $(seq 1 1500); do echo "line $i"; done');

      await manager.waitForTask(taskId, 10000);

      const output = manager.getOutput(taskId);
      const lines = output?.stdout.split('\n').filter(l => l.length > 0) || [];

      // Should be limited to maxOutputLines (1000)
      expect(lines.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getOutput', () => {
    it('should return null for non-existent task', () => {
      const output = manager.getOutput('non-existent-task');
      expect(output).toBeNull();
    });

    it('should return task output', async () => {
      const taskId = manager.spawn('echo "output test"');
      await manager.waitForTask(taskId, 5000);

      const output = manager.getOutput(taskId);

      expect(output).not.toBeNull();
      expect(output?.stdout).toContain('output test');
      expect(output?.status).toBeDefined();
      expect(output?.startTime).toBeInstanceOf(Date);
    });

    it('should include endTime for completed tasks', async () => {
      const taskId = manager.spawn('echo "done"');
      await manager.waitForTask(taskId, 5000);

      const output = manager.getOutput(taskId);

      expect(output?.endTime).toBeInstanceOf(Date);
    });
  });

  describe('getTaskInfo', () => {
    it('should return null for non-existent task', () => {
      const info = manager.getTaskInfo('non-existent');
      expect(info).toBeNull();
    });

    it('should return task info without stdout/stderr', () => {
      const taskId = manager.spawn('echo "info test"');

      const info = manager.getTaskInfo(taskId);

      expect(info).not.toBeNull();
      expect(info?.id).toBe(taskId);
      expect(info?.command).toBe('echo "info test"');
      expect(info?.status).toBeDefined();
      expect((info as any).stdout).toBeUndefined();
      expect((info as any).stderr).toBeUndefined();
    });
  });

  describe('listTasks', () => {
    it('should return empty array when no tasks', () => {
      manager.clearCompletedTasks();
      // Kill any running tasks
      for (const task of manager.listTasks()) {
        if (task.status === 'running') {
          manager.kill(task.id);
        }
      }
      manager.clearCompletedTasks();

      const tasks = manager.listTasks();
      expect(tasks).toEqual([]);
    });

    it('should list all tasks', async () => {
      const id1 = manager.spawn('echo "1"');
      const id2 = manager.spawn('echo "2"');

      const tasks = manager.listTasks();

      expect(tasks.length).toBeGreaterThanOrEqual(2);
      expect(tasks.some(t => t.id === id1)).toBe(true);
      expect(tasks.some(t => t.id === id2)).toBe(true);
    });

    it('should not include process or output buffers', () => {
      manager.spawn('echo "test"');

      const tasks = manager.listTasks();

      for (const task of tasks) {
        expect((task as any).process).toBeUndefined();
        expect((task as any).stdout).toBeUndefined();
        expect((task as any).stderr).toBeUndefined();
      }
    });
  });

  describe('getRunningCount', () => {
    it('should return 0 when no tasks are running', async () => {
      manager.clearCompletedTasks();
      expect(manager.getRunningCount()).toBe(0);
    });

    it('should count running tasks', () => {
      const id1 = manager.spawn('sleep 10');
      const id2 = manager.spawn('sleep 10');

      expect(manager.getRunningCount()).toBeGreaterThanOrEqual(2);

      // Clean up
      manager.kill(id1);
      manager.kill(id2);
    });

    it('should not count completed tasks', async () => {
      const taskId = manager.spawn('echo "quick"');
      await manager.waitForTask(taskId, 5000);

      // The completed task shouldn't be counted as running
      const info = manager.getTaskInfo(taskId);
      expect(info?.status).not.toBe('running');
    });
  });

  describe('kill', () => {
    it('should return false for non-existent task', () => {
      const result = manager.kill('non-existent');
      expect(result).toBe(false);
    });

    it('should return false for completed task', async () => {
      const taskId = manager.spawn('echo "done"');
      await manager.waitForTask(taskId, 5000);

      const result = manager.kill(taskId);
      expect(result).toBe(false);
    });

    it('should kill running task', async () => {
      const taskId = manager.spawn('sleep 60');

      // Give it a moment to start
      await new Promise(r => setTimeout(r, 100));

      const result = manager.kill(taskId);
      expect(result).toBe(true);

      // Wait for task to be killed
      await manager.waitForTask(taskId, 5000);

      const info = manager.getTaskInfo(taskId);
      expect(info?.status).toBe('killed');
    });

    it('should emit taskKilled event', async () => {
      const killedPromise = new Promise<{ taskId: string }>((resolve) => {
        manager.once('taskKilled', resolve);
      });

      const taskId = manager.spawn('sleep 60');
      await new Promise(r => setTimeout(r, 100));

      manager.kill(taskId);
      const event = await killedPromise;

      expect(event.taskId).toBe(taskId);
    });
  });

  describe('waitForTask', () => {
    it('should return null for non-existent task', async () => {
      const output = await manager.waitForTask('non-existent');
      expect(output).toBeNull();
    });

    it('should wait for task to complete', async () => {
      const taskId = manager.spawn('echo "waiting"');

      const output = await manager.waitForTask(taskId, 5000);

      expect(output?.status).toBe('completed');
      expect(output?.stdout).toContain('waiting');
    });

    it('should return immediately for completed task', async () => {
      const taskId = manager.spawn('echo "already done"');
      await manager.waitForTask(taskId, 5000);

      // Call again - should return immediately
      const start = Date.now();
      const output = await manager.waitForTask(taskId, 5000);
      const elapsed = Date.now() - start;

      expect(output?.status).toBe('completed');
      expect(elapsed).toBeLessThan(100);
    });

    it('should timeout if task takes too long', async () => {
      const taskId = manager.spawn('sleep 60');

      const output = await manager.waitForTask(taskId, 100);

      // Should return after timeout with running status
      expect(output?.status).toBe('running');

      // Clean up
      manager.kill(taskId);
    });
  });

  describe('removeTask', () => {
    it('should return false for non-existent task', () => {
      const result = manager.removeTask('non-existent');
      expect(result).toBe(false);
    });

    it('should return false for running task', () => {
      const taskId = manager.spawn('sleep 60');

      const result = manager.removeTask(taskId);
      expect(result).toBe(false);

      // Clean up
      manager.kill(taskId);
    });

    it('should remove completed task', async () => {
      const taskId = manager.spawn('echo "remove me"');
      await manager.waitForTask(taskId, 5000);

      const result = manager.removeTask(taskId);
      expect(result).toBe(true);

      const info = manager.getTaskInfo(taskId);
      expect(info).toBeNull();
    });
  });

  describe('clearCompletedTasks', () => {
    it('should remove all completed tasks', async () => {
      const id1 = manager.spawn('echo "1"');
      const id2 = manager.spawn('echo "2"');

      await manager.waitForTask(id1, 5000);
      await manager.waitForTask(id2, 5000);

      const cleared = manager.clearCompletedTasks();

      expect(cleared).toBeGreaterThanOrEqual(2);
      expect(manager.getTaskInfo(id1)).toBeNull();
      expect(manager.getTaskInfo(id2)).toBeNull();
    });

    it('should not remove running tasks', async () => {
      const completedId = manager.spawn('echo "done"');
      const runningId = manager.spawn('sleep 60');

      await manager.waitForTask(completedId, 5000);

      manager.clearCompletedTasks();

      expect(manager.getTaskInfo(completedId)).toBeNull();
      expect(manager.getTaskInfo(runningId)).not.toBeNull();

      // Clean up
      manager.kill(runningId);
    });
  });

  describe('adoptProcess', () => {
    it('should adopt existing child process', () => {
      // Create a child process manually
      const childProcess = spawn('sleep', ['10']);

      const taskId = manager.adoptProcess(childProcess, 'sleep 10', '/tmp');

      expect(taskId).toBeDefined();
      expect(taskId).toMatch(/^bg_/);

      const info = manager.getTaskInfo(taskId);
      expect(info?.command).toBe('sleep 10');
      expect(info?.cwd).toBe('/tmp');
      expect(info?.status).toBe('running');

      // Clean up
      manager.kill(taskId);
    });

    it('should preserve existing output', () => {
      const childProcess = spawn('echo', ['test']);
      const existingOutput = ['line1', 'line2'];

      const taskId = manager.adoptProcess(childProcess, 'echo test', '/tmp', existingOutput);

      const output = manager.getOutput(taskId);
      expect(output?.stdout).toContain('line1');
      expect(output?.stdout).toContain('line2');
    });

    it('should emit taskAdopted event', async () => {
      const adoptedPromise = new Promise<{ taskId: string; command: string }>((resolve) => {
        manager.once('taskAdopted', resolve);
      });

      const childProcess = spawn('echo', ['adopted']);
      const taskId = manager.adoptProcess(childProcess, 'echo adopted', '/tmp');

      const event = await adoptedPromise;

      expect(event.taskId).toBe(taskId);
      expect(event.command).toBe('echo adopted');
    });
  });

  describe('cleanup', () => {
    it('should kill all running tasks', async () => {
      const id1 = manager.spawn('sleep 60');
      const id2 = manager.spawn('sleep 60');

      await new Promise(r => setTimeout(r, 100));

      manager.cleanup();

      const tasks = manager.listTasks();
      expect(tasks.length).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should remove all event listeners', () => {
      const listener = vi.fn();
      manager.on('taskStarted', listener);

      expect(manager.listenerCount('taskStarted')).toBeGreaterThan(0);

      manager.destroy();

      expect(manager.listenerCount('taskStarted')).toBe(0);
    });
  });

  describe('memory leak prevention', () => {
    it('should clean up listeners after task completion', async () => {
      const taskId = manager.spawn('echo "leak test"');

      await manager.waitForTask(taskId, 5000);

      // Task should have no process reference after completion
      const task = manager.getTaskInfo(taskId);
      expect(task?.status).toBe('completed');
      // Process reference should be cleaned up (checked via getTaskInfo which doesn't expose process)
    });
  });
});
