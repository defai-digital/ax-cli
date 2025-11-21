import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

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
   * Spawn a command in the background
   * @returns Task ID
   */
  spawn(command: string, cwd: string = process.cwd()): string {
    const taskId = this.generateTaskId();

    // Use shell to execute command (supports pipes, redirects, etc.)
    const childProcess = spawn('bash', ['-c', command], {
      cwd,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const task: BackgroundTask = {
      id: taskId,
      command,
      cwd,
      status: 'running',
      startTime: new Date(),
      stdout: [],
      stderr: [],
      process: childProcess,
    };

    // Buffer stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.length > 0);
      task.stdout.push(...lines);
      // Trim if too many lines
      if (task.stdout.length > this.maxOutputLines) {
        task.stdout = task.stdout.slice(-this.maxOutputLines);
      }
      this.emit('output', { taskId, type: 'stdout', data: data.toString() });
    });

    // Buffer stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.length > 0);
      task.stderr.push(...lines);
      // Trim if too many lines
      if (task.stderr.length > this.maxOutputLines) {
        task.stderr = task.stderr.slice(-this.maxOutputLines);
      }
      this.emit('output', { taskId, type: 'stderr', data: data.toString() });
    });

    // Handle process exit
    childProcess.on('close', (code: number | null) => {
      task.status = code === 0 ? 'completed' : 'failed';
      task.exitCode = code;
      task.endTime = new Date();
      delete task.process; // Remove reference to allow GC
      this.emit('taskComplete', { taskId, exitCode: code, status: task.status });
    });

    // Handle process errors
    childProcess.on('error', (error: Error) => {
      task.status = 'failed';
      task.stderr.push(`Process error: ${error.message}`);
      task.endTime = new Date();
      delete task.process;
      this.emit('taskError', { taskId, error: error.message });
    });

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
    };
    this.tasks.set(taskId, task);

    // Remove existing listeners to prevent duplicate handlers
    // Do this AFTER adding to map so any events during transition still have a task to update
    this.removeExistingProcessListeners(childProcess);

    // Re-attach stdout listener
    childProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.length > 0);
      task.stdout.push(...lines);
      if (task.stdout.length > this.maxOutputLines) {
        task.stdout = task.stdout.slice(-this.maxOutputLines);
      }
      this.emit('output', { taskId, type: 'stdout', data: data.toString() });
    });

    // Re-attach stderr listener
    childProcess.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.length > 0);
      task.stderr.push(...lines);
      if (task.stderr.length > this.maxOutputLines) {
        task.stderr = task.stderr.slice(-this.maxOutputLines);
      }
      this.emit('output', { taskId, type: 'stderr', data: data.toString() });
    });

    // Handle process exit
    childProcess.on('close', (code: number | null) => {
      task.status = code === 0 ? 'completed' : 'failed';
      task.exitCode = code;
      task.endTime = new Date();
      delete task.process;
      this.emit('taskComplete', { taskId, exitCode: code, status: task.status });
    });

    // Handle process errors
    childProcess.on('error', (error: Error) => {
      task.status = 'failed';
      task.stderr.push(`Process error: ${error.message}`);
      task.endTime = new Date();
      delete task.process;
      this.emit('taskError', { taskId, error: error.message });
    });

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
      task.process.kill('SIGTERM');

      // Give it a moment, then force kill if needed
      // Check both task status AND process reference to avoid stale operations
      const forceKillTimeout = setTimeout(() => {
        // Verify this is still the same process and it hasn't terminated
        if (task.process === processRef && task.status === 'running') {
          try {
            processRef.kill('SIGKILL');
          } catch {
            // Process may have already exited, ignore
          }
        }
      }, 1000);

      // Unref the timeout so it doesn't keep the process alive
      forceKillTimeout.unref();

      task.status = 'killed';
      task.endTime = new Date();
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
}

// Export singleton getter
export function getBackgroundTaskManager(): BackgroundTaskManager {
  return BackgroundTaskManager.getInstance();
}
