/**
 * Process Pool Manager
 *
 * Manages a pool of reusable child processes to prevent memory leaks
 * and resource exhaustion (REQ-ARCH-002).
 *
 * Key features:
 * - Limits concurrent processes to prevent resource exhaustion
 * - Queues requests when pool is full
 * - Automatic cleanup of idle processes
 * - Graceful shutdown with proper cleanup
 * - Memory leak prevention through proper event listener management
 *
 * @module process-pool
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { TIMEOUT_CONFIG } from '../constants.js';
import { sleep } from './retry-helper.js';

/**
 * Options for process execution
 */
export interface ProcessExecutionOptions {
  command: string;
  args: string[];
  timeout?: number; // Timeout in milliseconds
  cwd?: string;
}

/**
 * Result of process execution
 */
export interface ProcessExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
}

/**
 * Process pool configuration
 */
export interface ProcessPoolConfig {
  maxProcesses?: number; // Maximum concurrent processes (default: 5)
  processTimeout?: number; // Process execution timeout in ms (default: 30000)
  idleTimeout?: number; // Time before idle process is killed in ms (default: 60000)
  maxQueueSize?: number; // Maximum queue size (default: 100)
}

/**
 * Queued task waiting for execution
 */
interface QueuedTask {
  options: ProcessExecutionOptions;
  resolve: (result: ProcessExecutionResult) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * Process pool manager for efficient process reuse
 */
export class ProcessPool extends EventEmitter {
  private readonly maxProcesses: number;
  private readonly processTimeout: number;
  private readonly maxQueueSize: number;

  private activeProcesses: Set<ChildProcess> = new Set();
  private taskQueue: QueuedTask[] = [];
  private shuttingDown: boolean = false;
  private idleTimers: Map<ChildProcess, NodeJS.Timeout> = new Map();

  constructor(config: ProcessPoolConfig = {}) {
    super();
    this.maxProcesses = config.maxProcesses ?? 5;
    this.processTimeout = config.processTimeout ?? TIMEOUT_CONFIG.PROCESS_EXECUTION;
    this.maxQueueSize = config.maxQueueSize ?? 100;
  }

  /**
   * Execute a command using the process pool
   */
  async execute(options: ProcessExecutionOptions): Promise<ProcessExecutionResult> {
    if (this.shuttingDown) {
      throw new Error('Process pool is shutting down');
    }

    // Check queue size limit
    if (this.taskQueue.length >= this.maxQueueSize) {
      throw new Error(`Process pool queue is full (max: ${this.maxQueueSize})`);
    }

    return new Promise<ProcessExecutionResult>((resolve, reject) => {
      const task: QueuedTask = {
        options,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    // Don't process if shutting down
    if (this.shuttingDown) {
      return;
    }

    // Process tasks while we have capacity
    while (
      this.taskQueue.length > 0 &&
      this.activeProcesses.size < this.maxProcesses
    ) {
      const task = this.taskQueue.shift();
      if (!task) break;

      this.executeTask(task);
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: QueuedTask): Promise<void> {
    const { options, resolve, reject } = task;

    try {
      const result = await this.spawnProcess(options);
      resolve(result);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      // Process next task in queue
      this.processQueue();
    }
  }

  /**
   * Spawn a process and manage its lifecycle
   */
  private async spawnProcess(
    options: ProcessExecutionOptions
  ): Promise<ProcessExecutionResult> {
    return new Promise<ProcessExecutionResult>((resolve, reject) => {
      const proc = spawn(options.command, options.args, {
        cwd: options.cwd,
      });

      this.activeProcesses.add(proc);

      let stdout = '';
      let stderr = '';
      let isResolved = false;
      let timeoutHandle: NodeJS.Timeout | null = null;

      // Set timeout
      const timeout = options.timeout ?? this.processTimeout;
      if (timeout > 0) {
        timeoutHandle = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            this.cleanupProcess(proc, timeoutHandle);
            reject(new Error(`Process timeout after ${timeout}ms`));
          }
        }, timeout);
      }

      // Collect stdout
      const MAX_BUFFER = 4 * 1024 * 1024; // 4MB safety cap to prevent runaway buffers
      if (proc.stdout) {
        proc.stdout.on('data', (data) => {
          if (stdout.length >= MAX_BUFFER) {
            return; // avoid RangeError from unbounded growth
          }
          const chunk = data.toString();
          const spaceLeft = MAX_BUFFER - stdout.length;
          stdout += chunk.slice(0, Math.max(0, spaceLeft));
        });
      }

      // Collect stderr
      if (proc.stderr) {
        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      // Handle process exit
      proc.on('close', (code, signal) => {
        if (isResolved) {
          return;
        }
        isResolved = true;

        this.cleanupProcess(proc, timeoutHandle);

        resolve({
          stdout,
          stderr,
          exitCode: code,
          signal: signal,
        });
      });

      // Handle process errors
      proc.on('error', (error) => {
        if (isResolved) {
          return;
        }
        isResolved = true;

        this.cleanupProcess(proc, timeoutHandle);
        reject(error);
      });
    });
  }

  /**
   * Cleanup process and associated resources
   */
  private cleanupProcess(
    proc: ChildProcess,
    timeoutHandle: NodeJS.Timeout | null
  ): void {
    // Clear timeout
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    // Clear idle timer if exists
    const idleTimer = this.idleTimers.get(proc);
    if (idleTimer) {
      clearTimeout(idleTimer);
      this.idleTimers.delete(proc);
    }

    // Remove all event listeners to prevent memory leaks
    if (proc.stdout) {
      proc.stdout.removeAllListeners();
    }
    if (proc.stderr) {
      proc.stderr.removeAllListeners();
    }
    proc.removeAllListeners();

    // Kill process if still running
    if (proc.exitCode === null && proc.signalCode === null) {
      try {
        proc.kill('SIGTERM');

        // Force kill after 3 seconds if SIGTERM doesn't work
        // BUG FIX: Add .unref() to prevent keeping process alive
        const forceKillTimeout = setTimeout(() => {
          try {
            if (proc.exitCode === null && !proc.killed) {
              proc.kill('SIGKILL');
            }
          } catch {
            // Process already terminated
          }
        }, 3000);

        // BUG FIX: Unref the timeout so it doesn't keep the event loop alive
        forceKillTimeout.unref();

        // Clear force kill timeout when process exits
        // BUG FIX: Simplified cleanup - attach listener directly without setImmediate race condition
        // If process already exited, onExit won't fire but timeout will still be cleaned up on natural expiry
        const onExit = () => clearTimeout(forceKillTimeout);
        proc.once('exit', onExit);

        // Also clear on error to prevent leaks
        proc.once('error', onExit);
      } catch {
        // Process already terminated or can't be killed
      }
    }

    // Remove from active set
    this.activeProcesses.delete(proc);

    // Emit metrics event
    this.emit('processCompleted', {
      activeProcesses: this.activeProcesses.size,
      queuedTasks: this.taskQueue.length,
    });
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    activeProcesses: number;
    queuedTasks: number;
    maxProcesses: number;
    maxQueueSize: number;
  } {
    return {
      activeProcesses: this.activeProcesses.size,
      queuedTasks: this.taskQueue.length,
      maxProcesses: this.maxProcesses,
      maxQueueSize: this.maxQueueSize,
    };
  }

  /**
   * Shutdown the pool gracefully
   */
  async shutdown(force: boolean = false): Promise<void> {
    this.shuttingDown = true;

    // Reject all queued tasks
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (task) {
        task.reject(new Error('Process pool shutting down'));
      }
    }

    // Wait for active processes to complete or force kill
    if (force) {
      // Force kill all active processes
      for (const proc of this.activeProcesses) {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Ignore errors
        }
      }
      this.activeProcesses.clear();
    } else {
      // Wait for active processes to complete (with timeout)
      const shutdownTimeout = 10000; // 10 seconds
      const startTime = Date.now();

      while (this.activeProcesses.size > 0) {
        if (Date.now() - startTime > shutdownTimeout) {
          // Force kill remaining processes
          for (const proc of this.activeProcesses) {
            try {
              proc.kill('SIGKILL');
            } catch {
              // Ignore errors
            }
          }
          this.activeProcesses.clear();
          break;
        }

        // Wait 100ms before checking again
        await sleep(100);
      }
    }

    // Clear all idle timers
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer);
    }
    this.idleTimers.clear();

    this.emit('shutdown');
  }

  /**
   * Check if pool is idle (no active processes or queued tasks)
   */
  isIdle(): boolean {
    return this.activeProcesses.size === 0 && this.taskQueue.length === 0;
  }

  /**
   * Check if pool is at capacity
   */
  isAtCapacity(): boolean {
    return this.activeProcesses.size >= this.maxProcesses;
  }

  /**
   * Clean up resources and remove all event listeners.
   * BUG FIX: Now clears idleTimers and rejects queued tasks to prevent timer leaks
   */
  destroy(): void {
    // Prevent new tasks
    this.shuttingDown = true;

    // Clear all idle timers
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer);
    }
    this.idleTimers.clear();

    // Reject all queued tasks
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (task) {
        task.reject(new Error('Process pool destroyed'));
      }
    }

    this.removeAllListeners();
  }
}

/**
 * Singleton process pool instance for ripgrep
 */
let ripgrepPool: ProcessPool | null = null;

/**
 * Get or create the ripgrep process pool
 */
export function getRipgrepPool(): ProcessPool {
  if (!ripgrepPool) {
    ripgrepPool = new ProcessPool({
      maxProcesses: 5,
      processTimeout: TIMEOUT_CONFIG.SEARCH_DEFAULT,
      maxQueueSize: 100,
    });

    // Cleanup on process exit
    process.on('beforeExit', () => {
      if (ripgrepPool) {
        ripgrepPool.shutdown(true).catch(() => {
          // Ignore errors during shutdown
        });
      }
    });
  }

  return ripgrepPool;
}

/**
 * Shutdown the ripgrep pool (for testing)
 */
export async function shutdownRipgrepPool(): Promise<void> {
  if (ripgrepPool) {
    await ripgrepPool.shutdown();
    ripgrepPool = null;
  }
}
