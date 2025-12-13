import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Validate and normalize a directory path to prevent shell injection
 * @param dir - Directory path to validate
 * @returns Normalized absolute path
 * @throws Error if path is invalid or doesn't exist
 */
function validateCwd(dir: string): string {
  // Resolve to absolute path to normalize the path
  const resolved = path.resolve(dir);

  // Check that directory exists and is accessible
  try {
    const stats = fs.statSync(resolved);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolved}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Directory does not exist: ${resolved}`);
    }
    throw error;
  }

  return resolved;
}

export interface BackgroundTask {
  id: string;
  command: string;
  cwd: string;
  status: 'running' | 'completed' | 'failed' | 'killed';
  startTime: Date;
  endTime?: Date;
  exitCode?: number | null;
  stdout: string[];
  stderr: string[];
  process?: ChildProcess;
  // MEMORY LEAK FIX: Store listener references for proper cleanup
  listeners?: {
    onStdout?: (data: Buffer) => void;
    onStderr?: (data: Buffer) => void;
    onClose?: (code: number | null) => void;
    onError?: (error: Error) => void;
  };
  // TIMEOUT LEAK FIX: Store force-kill timeout ID for cleanup
  forceKillTimeout?: NodeJS.Timeout;
}

export interface TaskOutput {
  stdout: string;
  stderr: string;
  status: BackgroundTask['status'];
  exitCode?: number | null;
  startTime: Date;
  endTime?: Date;
}

/**
 * BackgroundTaskManager - Manages background shell command execution
 *
 * Features:
 * - Spawn commands in background with unique task IDs
 * - Buffer stdout/stderr for later retrieval
 * - Track task status (running/completed/failed/killed)
 * - Automatic cleanup on process exit
 */
export class BackgroundTaskManager extends EventEmitter {
  private static instance: BackgroundTaskManager;
  private tasks: Map<string, BackgroundTask> = new Map();
  private taskCounter: number = 0;
  private maxOutputLines: number = 1000; // Limit buffered output per task

  private constructor() {
    super();
    // Track if cleanup has already been performed to prevent multiple invocations
    let cleanupPerformed = false;
    const safeCleanup = (exitCode?: number) => {
      if (cleanupPerformed) return;
      cleanupPerformed = true;
      this.cleanup();
      return exitCode;
    };

    // Cleanup on process exit (synchronous, can't call process.exit here)
    process.on('exit', () => safeCleanup());

    // Signal handlers need to exit the process after cleanup
    // Otherwise the process hangs after receiving the signal
    process.on('SIGINT', () => {
      safeCleanup();
      process.exit(130); // 128 + SIGINT(2)
    });
    process.on('SIGTERM', () => {
      safeCleanup();
      process.exit(143); // 128 + SIGTERM(15)
    });
  }

  static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  /**
   * Generate a unique task ID
   */
  private generateTaskId(): string {
    this.taskCounter++;
    const timestamp = Date.now().toString(36);
    return `bg_${timestamp}_${this.taskCounter}`;
  }

  /**
   * MEMORY LEAK FIX: Clean up task listeners to prevent EventEmitter leaks
   */
  private cleanupTaskListeners(task: BackgroundTask): void {
    if (!task.process || !task.listeners) return;

    // Remove only OUR listeners, not all listeners
    if (task.listeners.onStdout) {
      task.process.stdout?.off('data', task.listeners.onStdout);
    }
    if (task.listeners.onStderr) {
      task.process.stderr?.off('data', task.listeners.onStderr);
    }
    if (task.listeners.onClose) {
      task.process.off('close', task.listeners.onClose);
    }
    if (task.listeners.onError) {
      task.process.off('error', task.listeners.onError);
    }

    // Clear listener references
    delete task.listeners;
  }

  /**
   * Spawn a command in the background
   * @returns Task ID
   */
  spawn(command: string, cwd: string = process.cwd()): string {
    const taskId = this.generateTaskId();

    // Validate and normalize cwd to prevent shell injection (CodeQL security fix)
    const safeCwd = validateCwd(cwd);

    // Use shell to execute command (supports pipes, redirects, etc.)
    const childProcess = spawn('bash', ['-c', command], {
      cwd: safeCwd,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const task: BackgroundTask = {
      id: taskId,
      command,
      cwd: safeCwd,
      status: 'running',
      startTime: new Date(),
      stdout: [],
      stderr: [],
      process: childProcess,
      listeners: {}, // MEMORY LEAK FIX: Store listener references
    };

    // MEMORY LEAK FIX: Define listeners as named functions so we can remove them later
    const onStdout = (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.length > 0);

      // MEMORY LEAK FIX: Prevent unbounded growth before pushing
      // Check if we need to make room BEFORE pushing to avoid spikes
      if (task.stdout.length + lines.length > this.maxOutputLines) {
        // Calculate how many elements to remove
        const overflow = task.stdout.length + lines.length - this.maxOutputLines;
        // Remove from beginning using splice (more efficient than slice for large arrays)
        task.stdout.splice(0, overflow);
      }

      // Now push new lines (array is guaranteed to stay within limit)
      task.stdout.push(...lines);
      this.emit('output', { taskId, type: 'stdout', data: data.toString() });
    };

    const onStderr = (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.length > 0);

      // MEMORY LEAK FIX: Prevent unbounded growth before pushing
      // Check if we need to make room BEFORE pushing to avoid spikes
      if (task.stderr.length + lines.length > this.maxOutputLines) {
        // Calculate how many elements to remove
        const overflow = task.stderr.length + lines.length - this.maxOutputLines;
        // Remove from beginning using splice (more efficient than slice for large arrays)
        task.stderr.splice(0, overflow);
      }

      // Now push new lines (array is guaranteed to stay within limit)
      task.stderr.push(...lines);
      this.emit('output', { taskId, type: 'stderr', data: data.toString() });
    };

    const onClose = (code: number | null) => {
      // BUG FIX: Don't overwrite 'killed' status - preserve user intent
      // When user explicitly kills a task, we want to show 'killed' not 'failed'
      if (task.status !== 'killed') {
        task.status = code === 0 ? 'completed' : 'failed';
      }
      task.exitCode = code;
      task.endTime = new Date();

      // TIMEOUT LEAK FIX: Clear force-kill timeout if exists
      if (task.forceKillTimeout) {
        clearTimeout(task.forceKillTimeout);
        task.forceKillTimeout = undefined;
      }

      this.cleanupTaskListeners(task); // MEMORY LEAK FIX: Clean up listeners
      delete task.process; // Remove reference to allow GC
      this.emit('taskComplete', { taskId, exitCode: code, status: task.status });
    };

    const onError = (error: Error) => {
      task.status = 'failed';
      task.stderr.push(`Process error: ${error.message}`);
      task.endTime = new Date();

      // TIMEOUT LEAK FIX: Clear force-kill timeout if exists
      if (task.forceKillTimeout) {
        clearTimeout(task.forceKillTimeout);
        task.forceKillTimeout = undefined;
      }

      this.cleanupTaskListeners(task); // MEMORY LEAK FIX: Clean up listeners
      delete task.process;
      this.emit('taskError', { taskId, error: error.message });
    };

    // Store listener references for cleanup
    task.listeners = { onStdout, onStderr, onClose, onError };

    // Attach listeners
    childProcess.stdout?.on('data', onStdout);
    childProcess.stderr?.on('data', onStderr);
    childProcess.on('close', onClose);
    childProcess.on('error', onError);

    this.tasks.set(taskId, task);
    this.emit('taskStarted', { taskId, command });

    return taskId;
  }

  /**
   * Get output from a background task
   */
  getOutput(taskId: string): TaskOutput | null {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    return {
      stdout: task.stdout.join('\n'),
      stderr: task.stderr.join('\n'),
      status: task.status,
      exitCode: task.exitCode,
      startTime: task.startTime,
      endTime: task.endTime,
    };
  }

  /**
   * Get task info without output (for listing)
   */
  getTaskInfo(taskId: string): Omit<BackgroundTask, 'process' | 'stdout' | 'stderr'> | null {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    return {
      id: task.id,
      command: task.command,
      cwd: task.cwd,
      status: task.status,
      startTime: task.startTime,
      endTime: task.endTime,
      exitCode: task.exitCode,
    };
  }

  /**
   * List all tasks
   */
  listTasks(): Array<Omit<BackgroundTask, 'process' | 'stdout' | 'stderr'>> {
    return Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      command: task.command,
      cwd: task.cwd,
      status: task.status,
      startTime: task.startTime,
      endTime: task.endTime,
      exitCode: task.exitCode,
    }));
  }

  /**
   * Get running task count
   */
  getRunningCount(): number {
    return Array.from(this.tasks.values()).filter(t => t.status === 'running').length;
  }

  /**
   * Adopt an existing running process into background management
   * Used when Ctrl+B is pressed during execution
   */
  adoptProcess(
    childProcess: ChildProcess,
    command: string,
    cwd: string,
    existingOutput: string[] = []
  ): string {
    const taskId = this.generateTaskId();

    // Add task to map FIRST to ensure it's tracked even if events fire immediately
    const task: BackgroundTask = {
      id: taskId,
      command,
      cwd,
      status: 'running',
      startTime: new Date(),
      stdout: [...existingOutput],
      stderr: [],
      process: childProcess,
      listeners: {}, // MEMORY LEAK FIX: Store listener references for cleanup
    };
    this.tasks.set(taskId, task);

    // Remove existing listeners to prevent duplicate handlers
    // Do this AFTER adding to map so any events during transition still have a task to update
    this.removeExistingProcessListeners(childProcess);

    // MEMORY LEAK FIX: Define listeners as named functions so we can remove them later
    const onStdout = (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.length > 0);

      // MEMORY LEAK FIX: Prevent unbounded growth before pushing
      if (task.stdout.length + lines.length > this.maxOutputLines) {
        const overflow = task.stdout.length + lines.length - this.maxOutputLines;
        task.stdout.splice(0, overflow);
      }

      task.stdout.push(...lines);
      this.emit('output', { taskId, type: 'stdout', data: data.toString() });
    };

    const onStderr = (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.length > 0);

      // MEMORY LEAK FIX: Prevent unbounded growth before pushing
      if (task.stderr.length + lines.length > this.maxOutputLines) {
        const overflow = task.stderr.length + lines.length - this.maxOutputLines;
        task.stderr.splice(0, overflow);
      }

      task.stderr.push(...lines);
      this.emit('output', { taskId, type: 'stderr', data: data.toString() });
    };

    const onClose = (code: number | null) => {
      // BUG FIX: Don't overwrite 'killed' status - preserve user intent
      // When user explicitly kills a task, we want to show 'killed' not 'failed'
      if (task.status !== 'killed') {
        task.status = code === 0 ? 'completed' : 'failed';
      }
      task.exitCode = code;
      task.endTime = new Date();

      // TIMEOUT LEAK FIX: Clear force-kill timeout if exists
      if (task.forceKillTimeout) {
        clearTimeout(task.forceKillTimeout);
        task.forceKillTimeout = undefined;
      }

      this.cleanupTaskListeners(task); // MEMORY LEAK FIX: Clean up listeners
      delete task.process;
      this.emit('taskComplete', { taskId, exitCode: code, status: task.status });
    };

    const onError = (error: Error) => {
      task.status = 'failed';
      task.stderr.push(`Process error: ${error.message}`);
      task.endTime = new Date();

      // TIMEOUT LEAK FIX: Clear force-kill timeout if exists
      if (task.forceKillTimeout) {
        clearTimeout(task.forceKillTimeout);
        task.forceKillTimeout = undefined;
      }

      this.cleanupTaskListeners(task); // MEMORY LEAK FIX: Clean up listeners
      delete task.process;
      this.emit('taskError', { taskId, error: error.message });
    };

    // Store listener references for cleanup
    task.listeners = { onStdout, onStderr, onClose, onError };

    // Attach listeners
    childProcess.stdout?.on('data', onStdout);
    childProcess.stderr?.on('data', onStderr);
    childProcess.on('close', onClose);
    childProcess.on('error', onError);

    this.emit('taskAdopted', { taskId, command });

    return taskId;
  }

  /**
   * Remove all listeners from a child process to prevent duplicate handlers
   * when adopting a process that already has listeners attached
   */
  private removeExistingProcessListeners(childProcess: ChildProcess): void {
    childProcess.stdout?.removeAllListeners('data');
    childProcess.stderr?.removeAllListeners('data');
    childProcess.removeAllListeners('close');
    childProcess.removeAllListeners('error');
  }

  /**
   * Kill a background task
   */
  kill(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running' || !task.process) {
      return false;
    }

    try {
      const processRef = task.process;

      // RACE CONDITION FIX: Set status to 'killed' BEFORE sending SIGTERM
      // This prevents onClose from overwriting status if it fires before we set it
      task.status = 'killed';
      task.endTime = new Date();

      task.process.kill('SIGTERM');

      // TIMEOUT LEAK FIX: Clear any existing force-kill timeout before creating a new one
      if (task.forceKillTimeout) {
        clearTimeout(task.forceKillTimeout);
        task.forceKillTimeout = undefined;
      }

      // Give it a moment, then force kill if needed
      // BUG FIX: Only check process reference - status check was broken because
      // status is already 'killed' at this point, causing SIGKILL to never be sent
      const forceKillTimeout = setTimeout(() => {
        // Verify this is still the same process (hasn't been cleaned up)
        // If task.process is undefined or different, the process already exited
        if (task.process === processRef) {
          try {
            processRef.kill('SIGKILL');
          } catch {
            // Process may have already exited, ignore
          }
        }
        // Clear reference after execution
        task.forceKillTimeout = undefined;
      }, 1000);

      // Unref the timeout so it doesn't keep the process alive
      forceKillTimeout.unref();

      // TIMEOUT LEAK FIX: Store timeout ID for cleanup
      task.forceKillTimeout = forceKillTimeout;

      this.emit('taskKilled', { taskId });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for a task to complete
   */
  async waitForTask(taskId: string, timeoutMs: number = 60000): Promise<TaskOutput | null> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    if (task.status !== 'running') {
      return this.getOutput(taskId);
    }

    return new Promise((resolve) => {
      const cleanup = () => {
        clearTimeout(timeout);
        this.off('taskComplete', checkComplete);
        this.off('taskError', checkComplete);
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve(this.getOutput(taskId));
      }, timeoutMs);

      const checkComplete = (data: { taskId: string }) => {
        if (data.taskId === taskId) {
          cleanup();
          resolve(this.getOutput(taskId));
        }
      };

      this.on('taskComplete', checkComplete);
      this.on('taskError', checkComplete);

      // Check if task already completed after attaching listeners (race condition guard)
      const currentTask = this.tasks.get(taskId);
      if (currentTask && currentTask.status !== 'running') {
        cleanup();
        resolve(this.getOutput(taskId));
      }
    });
  }

  /**
   * Remove a completed task from memory
   */
  removeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    // Don't remove running tasks
    if (task.status === 'running') {
      return false;
    }

    return this.tasks.delete(taskId);
  }

  /**
   * Clear all completed/failed tasks
   */
  clearCompletedTasks(): number {
    let cleared = 0;
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status !== 'running') {
        this.tasks.delete(taskId);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Cleanup all tasks (called on process exit)
   */
  cleanup(): void {
    for (const task of this.tasks.values()) {
      // MEMORY LEAK FIX: Clean up listeners before killing processes
      this.cleanupTaskListeners(task);

      // TIMEOUT LEAK FIX: Clear force-kill timeouts
      if (task.forceKillTimeout) {
        clearTimeout(task.forceKillTimeout);
        task.forceKillTimeout = undefined;
      }

      if (task.status === 'running' && task.process) {
        try {
          task.process.kill('SIGTERM');
        } catch {
          // Ignore errors during cleanup
        }
      }
    }
    this.tasks.clear();
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

// Export singleton getter
export function getBackgroundTaskManager(): BackgroundTaskManager {
  return BackgroundTaskManager.getInstance();
}
