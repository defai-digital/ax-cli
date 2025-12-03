import { spawn, ChildProcess } from 'child_process';
import { homedir } from 'os';
import path from 'path';
import { ToolResult } from '../types/index.js';
import { ConfirmationService } from '../utils/confirmation-service.js';
import { getMessageOptimizer } from '../utils/message-optimizer.js';
import { getBackgroundTaskManager } from '../utils/background-task-manager.js';
import { getSettingsManager } from '../utils/settings-manager.js';
import { EventEmitter } from 'events';
import {
  parseCommand,
  validateArguments,
  getSafeCommands,
} from '../utils/command-security.js';
import { isDestructiveCommand } from '../utils/safety-rules.js';
import { getAutoAcceptLogger } from '../utils/auto-accept-logger.js';
import { TIMEOUT_CONFIG, FILE_CONFIG } from '../constants.js';
import { extractErrorMessage } from '../utils/error-handler.js';

// escapeShellArg moved to src/utils/input-sanitizer.ts (better cross-platform support)
// Re-export for backward compatibility
export { escapeShellArg } from '../utils/input-sanitizer.js';

export interface BashExecuteOptions {
  timeout?: number;
  background?: boolean;
  /** Abort signal to cancel execution or move to background */
  signal?: AbortSignal;
}

/**
 * Result when command is moved to background
 */
export interface BackgroundTransferResult {
  movedToBackground: true;
  taskId: string;
  partialOutput: string;
}

export class BashTool extends EventEmitter {
  private static readonly MAX_BUFFER_SIZE = FILE_CONFIG.MAX_BUFFER_SIZE;
  private static readonly DEFAULT_TIMEOUT = TIMEOUT_CONFIG.BASH_DEFAULT;

  private currentDirectory: string = process.cwd();
  private confirmationService = ConfirmationService.getInstance();
  private backgroundTaskManager = getBackgroundTaskManager();

  /** Currently running process (for Ctrl+B transfer) */
  private currentProcess: ChildProcess | null = null;
  private currentCommand: string = '';
  private currentOutput: string[] = [];

  constructor() {
    super();
  }

  /**
   * Check if a command is currently executing
   */
  isExecuting(): boolean {
    return this.currentProcess !== null;
  }

  /**
   * Move the currently running command to background
   * Returns task ID if successful, null if no command is running or adoption fails
   */
  moveToBackground(): string | null {
    if (!this.currentProcess || !this.currentCommand) {
      return null;
    }

    // Store references before clearing state
    const processToAdopt = this.currentProcess;
    const commandToAdopt = this.currentCommand;
    const outputToAdopt = [...this.currentOutput];

    try {
      const taskId = this.backgroundTaskManager.adoptProcess(
        processToAdopt,
        commandToAdopt,
        this.currentDirectory,
        outputToAdopt
      );

      // Only clear state after successful adoption
      this.currentProcess = null;
      this.currentCommand = '';
      this.currentOutput = [];

      return taskId;
    } catch (error) {
      // BUG FIX: Log error before returning null so caller can diagnose failures
      const errorMsg = extractErrorMessage(error);
      console.error('Failed to move process to background:', errorMsg);

      // CRITICAL FIX: Clear state even on failure to prevent process handle leak
      this.currentProcess = null;
      this.currentCommand = '';
      this.currentOutput = [];

      // Attempt to kill orphaned process to prevent resource leak
      // BUG FIX: Add SIGKILL fallback to ensure process termination
      try {
        if (!processToAdopt.killed && processToAdopt.exitCode === null) {
          processToAdopt.kill('SIGTERM');

          // Force kill after 2 seconds if SIGTERM doesn't work
          const forceKillTimeout = setTimeout(() => {
            try {
              if (!processToAdopt.killed && processToAdopt.exitCode === null) {
                processToAdopt.kill('SIGKILL');
              }
            } catch {
              // Process already terminated
            }
          }, 2000);

          // Unref to prevent keeping event loop alive
          forceKillTimeout.unref();

          // Clear timeout when process exits
          processToAdopt.once('exit', () => clearTimeout(forceKillTimeout));
        }
      } catch {
        // Ignore kill errors
      }

      return null;
    }
  }

  /**
   * Execute a bash command
   * @param command The command to execute
   * @param options Execution options (timeout, background, signal)
   */
  async execute(command: string, options: BashExecuteOptions | number = {}): Promise<ToolResult> {
    // Handle legacy timeout parameter
    const opts: BashExecuteOptions = typeof options === 'number'
      ? { timeout: options }
      : options;
    const timeout = opts.timeout ?? BashTool.DEFAULT_TIMEOUT;

    // Check if command should run in background
    // Either explicit option or command ends with ' &'
    const shouldRunInBackground = opts.background || command.trimEnd().endsWith(' &');

    try {
      // Validate timeout parameter
      if (!Number.isFinite(timeout) || timeout <= 0) {
        return {
          success: false,
          error: `Invalid timeout: ${timeout}. Must be a positive number.`
        };
      }

      // Phase 2: Check if command is destructive
      const { isDestructive, matchedOperations } = isDestructiveCommand(command);

      // Get auto-accept configuration
      const autoAcceptConfig = getSettingsManager().getAutoAcceptConfig();
      const isAutoAcceptEnabled = this.confirmationService.getSessionFlags().allOperations === true;

      // Determine if we should always confirm despite auto-accept
      const shouldAlwaysConfirm = isDestructive && matchedOperations.some(op =>
        autoAcceptConfig?.alwaysConfirm?.includes(op.id)
      );

      // Build confirmation details with safety info
      let confirmationContent = `Command: ${command}\nWorking directory: ${this.currentDirectory}`;
      if (isDestructive) {
        confirmationContent += `\n\n⚠️  WARNING: This operation is flagged as destructive:\n`;
        matchedOperations.forEach(op => {
          confirmationContent += `  - ${op.name}: ${op.description}\n`;
        });
      }

      // Request confirmation for bash command execution
      const shouldExecute = await this.confirmationService.shouldProceed('bash', {
        operation: 'Run bash command',
        filename: command,
        showVSCodeOpen: false,
        content: confirmationContent,
        alwaysConfirm: shouldAlwaysConfirm // Force confirmation for destructive ops
      });

      // Phase 2: Log to audit logger
      if (autoAcceptConfig && autoAcceptConfig.auditLog?.enabled) {
        const logger = getAutoAcceptLogger();
        logger.logBashCommand(
          command,
          matchedOperations,
          shouldExecute, // userConfirmed = true if user confirmed (shouldExecute=true)
          isAutoAcceptEnabled && !shouldAlwaysConfirm, // autoAccepted = true if auto-accept AND not forced confirm
          autoAcceptConfig.scope || 'session'
        );
      }

      if (!shouldExecute) {
        return {
          success: false,
          error: 'Command execution cancelled by user'
        };
      }

      // SECURITY: Validate command against whitelist (REQ-SEC-001)
      // Only enforce if enableCommandWhitelist is explicitly set to true (default: false)
      // AX CLI already has user confirmation prompts for safety
      // This strict hardening is for enterprise customers who enable it manually
      const settingsManager = getSettingsManager();
      const settings = settingsManager.loadUserSettings();
      const shouldEnforceWhitelist = settings?.security?.enableCommandWhitelist ?? false;

      // Skip validation for cd command (handled separately) and background commands
      if (shouldEnforceWhitelist && !command.startsWith('cd ') && !shouldRunInBackground) {
        try {
          const parsed = parseCommand(command);
          const validation = validateArguments(parsed.args);

          if (!validation.valid) {
            return {
              success: false,
              error: `Security: Command validation failed\n${validation.errors.join('\n')}\n\nAllowed commands: ${getSafeCommands().join(', ')}`
            };
          }
        } catch (error: unknown) {
          return {
            success: false,
            error: `Security: ${extractErrorMessage(error)}\n\nAllowed commands: ${getSafeCommands().join(', ')}`
          };
        }
      }

      // Handle background execution
      if (shouldRunInBackground) {
        // Remove trailing ' &' if present
        const cleanCommand = command.trimEnd().endsWith(' &')
          ? command.trimEnd().slice(0, -2).trim()
          : command;

        const taskId = this.backgroundTaskManager.spawn(cleanCommand, this.currentDirectory);
        return {
          success: true,
          output: `🔄 Background task started\nTask ID: ${taskId}\nCommand: ${cleanCommand}\n\nUse /tasks to list running tasks or /task ${taskId} to view output.`
        };
      }

      // Handle cd command specially (doesn't need spawn)
      if (command.startsWith('cd ')) {
        return this.handleCdCommand(command);
      }

      // Use spawn for interruptible execution
      const result = await this.executeWithSpawn(command, timeout, opts.signal);

      // Convert BackgroundTransferResult to ToolResult
      if ('movedToBackground' in result && result.movedToBackground) {
        const bgResult = result as BackgroundTransferResult;
        return {
          success: true,
          output: `🔄 Command moved to background\nTask ID: ${bgResult.taskId}\nPartial output: ${bgResult.partialOutput || '(none)'}\n\nUse /tasks to list running tasks or /task ${bgResult.taskId} to view output.`
        };
      }

      return result as ToolResult;

    } catch (error: unknown) {
      // Safely extract error message and command output
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        errorMessage = error.message;
        // Check for stdout/stderr on exec errors
        const execError = error as Error & { stdout?: string; stderr?: string };
        if (execError.stdout || execError.stderr) {
          errorMessage = (execError.stdout || '') + (execError.stderr ? `\nSTDERR: ${execError.stderr}` : '');
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Optimize error output to reduce verbosity
      const optimizer = getMessageOptimizer();
      const optimized = optimizer.optimizeToolOutput(errorMessage, 'bash');

      return {
        success: false,
        error: `Command failed:\n${optimized.content}`
      };
    }
  }

  /**
   * Expand ~ to home directory in path
   * @returns expanded path or null with error message if HOME not found
   */
  private expandHomePath(dirPath: string): { path: string } | { error: string } {
    if (dirPath === '~') {
      const home = homedir();
      return home ? { path: home } : { error: 'Cannot expand ~: HOME directory not found' };
    }
    if (dirPath.startsWith('~/')) {
      const home = homedir();
      return home ? { path: dirPath.replace(/^~/, home) } : { error: 'Cannot expand ~: HOME directory not found' };
    }
    return { path: dirPath };
  }

  /**
   * Handle cd command separately (no spawn needed)
   */
  private handleCdCommand(command: string): ToolResult {
    let newDir = command.substring(3).trim();

    // Validate directory path is not empty
    if (newDir === '') {
      return {
        success: false,
        error: 'Cannot change directory: no directory specified'
      };
    }

    // Detect compound commands (cd path && command or cd path; command)
    // These should be executed via shell, not the cd handler
    if (newDir.includes('&&') || newDir.includes(';') || newDir.includes('|')) {
      return {
        success: false,
        error: `Cannot change directory: compound commands not supported.\n` +
               `The "cd" command only changes the working directory.\n` +
               `To run commands in a different directory, use:\n` +
               `  bash -c "cd /path && your-command"\n` +
               `Or set the directory first, then run commands separately.`
      };
    }

    // Remove surrounding quotes if present
    if ((newDir.startsWith('"') && newDir.endsWith('"')) ||
        (newDir.startsWith("'") && newDir.endsWith("'"))) {
      newDir = newDir.slice(1, -1);
    }

    // Expand ~ to home directory
    const expanded = this.expandHomePath(newDir);
    if ('error' in expanded) {
      return { success: false, error: expanded.error };
    }
    newDir = expanded.path;

    // Resolve relative paths
    const resolvedDir = path.resolve(this.currentDirectory, newDir);

    try {
      process.chdir(resolvedDir);
      this.currentDirectory = process.cwd();
      return {
        success: true,
        output: `Changed directory to: ${this.currentDirectory}`
      };
    } catch (error: unknown) {
      // Provide more helpful error message
      const nodeError = error as NodeJS.ErrnoException;
      const errorCode = nodeError?.code;
      if (errorCode === 'ENOENT') {
        return {
          success: false,
          error: `Cannot change directory: "${resolvedDir}" does not exist. Current directory is: ${this.currentDirectory}`
        };
      } else if (errorCode === 'ENOTDIR') {
        return {
          success: false,
          error: `Cannot change directory: "${resolvedDir}" is not a directory. Current directory is: ${this.currentDirectory}`
        };
      } else if (errorCode === 'EACCES') {
        return {
          success: false,
          error: `Cannot change directory: permission denied for "${resolvedDir}". Current directory is: ${this.currentDirectory}`
        };
      }
      return {
        success: false,
        error: `Cannot change directory to "${resolvedDir}": ${extractErrorMessage(error)}. Current directory is: ${this.currentDirectory}`
      };
    }
  }

  /**
   * Execute command using spawn (interruptible)
   * Returns ToolResult normally, or BackgroundTransferResult if moved to background
   */
  private executeWithSpawn(
    command: string,
    timeout: number,
    signal?: AbortSignal
  ): Promise<ToolResult | BackgroundTransferResult> {
    return new Promise((resolve, reject) => {
      const stdout: string[] = [];
      const stderr: string[] = [];
      let outputSize = 0;
      let movedToBackground = false;

      // TIMEOUT LEAK FIX: Track all timeout IDs for proper cleanup
      let mainTimeoutId: NodeJS.Timeout | undefined;
      let killTimeoutId: NodeJS.Timeout | undefined;

      const clearAllTimers = () => {
        if (mainTimeoutId) {
          clearTimeout(mainTimeoutId);
          mainTimeoutId = undefined;
        }
        if (killTimeoutId) {
          clearTimeout(killTimeoutId);
          killTimeoutId = undefined;
        }
      };

      // Spawn the process
      const childProcess = spawn('bash', ['-c', command], {
        cwd: this.currentDirectory,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Store for potential background transfer
      this.currentProcess = childProcess;
      this.currentCommand = command;
      this.currentOutput = [];

      // Emit event for UI to know execution started
      this.emit('executionStarted', { command, pid: childProcess.pid });

      // TIMEOUT LEAK FIX: Set up timeout with tracked IDs
      mainTimeoutId = setTimeout(() => {
        if (!movedToBackground) {
          childProcess.kill('SIGTERM');
          // Track the inner timeout as well
          killTimeoutId = setTimeout(() => {
            if (childProcess.exitCode === null) {
              childProcess.kill('SIGKILL');
            }
            killTimeoutId = undefined;
          }, 1000);
          // Use unref() so timeout doesn't prevent GC after process exits
          killTimeoutId.unref();
        }
        mainTimeoutId = undefined;
      }, timeout);

      // Helper to cleanup abort listener when process completes
      // Defined first so it can be called from abortHandler
      let abortHandler: (() => void) | null = null;
      const cleanupAbortListener = () => {
        if (signal && abortHandler) {
          signal.removeEventListener('abort', abortHandler);
          abortHandler = null;
        }
      };

      // Handle abort signal (for Ctrl+B background transfer)
      // Store handler reference for cleanup to prevent memory leaks
      if (signal) {
        abortHandler = () => {
          if (this.currentProcess === childProcess) {
            const taskId = this.moveToBackground();

            if (taskId) {
              // TIMEOUT LEAK FIX: Only clear timers when backgrounding succeeds
              clearAllTimers();
              // Always cleanup abort listener to prevent memory leak
              cleanupAbortListener();

              movedToBackground = true;
              resolve({
                movedToBackground: true,
                taskId,
                partialOutput: stdout.join('\n'),
              });
            }
            // If moveToBackground() returns null, don't resolve - let the process complete normally
            // Keep timers active so the timeout still enforces process termination
          }
        };
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      // Collect stdout
      childProcess.stdout?.on('data', (data: Buffer) => {
        const str = data.toString();
        stdout.push(str);
        this.currentOutput.push(str);
        outputSize += str.length;

        // Prevent memory exhaustion
        if (outputSize > BashTool.MAX_BUFFER_SIZE) {
          childProcess.kill('SIGTERM');
        }

        // Emit for streaming output
        this.emit('stdout', { data: str });
      });

      // Collect stderr
      childProcess.stderr?.on('data', (data: Buffer) => {
        const str = data.toString();
        stderr.push(str);
        this.currentOutput.push(`STDERR: ${str}`);

        // Emit for streaming output
        this.emit('stderr', { data: str });
      });

      // Handle process completion
      childProcess.on('close', (code: number | null) => {
        // TIMEOUT LEAK FIX: Clear all timers on completion
        clearAllTimers();
        cleanupAbortListener(); // Remove abort listener to prevent memory leaks

        // BUG FIX: Remove stream listeners to prevent memory leak accumulation
        childProcess.stdout?.removeAllListeners('data');
        childProcess.stderr?.removeAllListeners('data');

        // Clear current process state
        if (this.currentProcess === childProcess) {
          this.currentProcess = null;
          this.currentCommand = '';
          this.currentOutput = [];
        }

        // Emit completion event
        this.emit('executionCompleted', { command, exitCode: code });

        if (movedToBackground) {
          return; // Already resolved
        }

        const rawOutput = stdout.join('') + (stderr.length > 0 ? `\nSTDERR: ${stderr.join('')}` : '');
        const trimmedOutput = rawOutput.trim() || 'Command executed successfully (no output)';

        // Optimize output
        const optimizer = getMessageOptimizer();
        const optimized = optimizer.optimizeToolOutput(trimmedOutput, 'bash');

        if (code === 0) {
          resolve({
            success: true,
            output: optimized.content
          });
        } else {
          resolve({
            success: false,
            error: `Command failed (exit code ${code}):\n${optimized.content}`
          });
        }
      });

      // Handle process errors
      childProcess.on('error', (error: Error) => {
        // TIMEOUT LEAK FIX: Clear all timers on error
        clearAllTimers();
        cleanupAbortListener(); // Remove abort listener to prevent memory leaks

        if (this.currentProcess === childProcess) {
          this.currentProcess = null;
          this.currentCommand = '';
          this.currentOutput = [];
        }

        if (!movedToBackground) {
          reject(error);
        }
      });
    });
  }

  getCurrentDirectory(): string {
    return this.currentDirectory;
  }

  /**
   * Clean up resources (kill running process, remove event listeners)
   */
  dispose(): void {
    // Kill current process if running
    const processToKill = this.currentProcess;
    if (processToKill && !processToKill.killed && processToKill.exitCode === null) {
      try {
        processToKill.kill('SIGTERM');

        // Force kill after 2 seconds if SIGTERM doesn't work (consistent with moveToBackground)
        const forceKillTimeout = setTimeout(() => {
          try {
            if (!processToKill.killed && processToKill.exitCode === null) {
              processToKill.kill('SIGKILL');
            }
          } catch {
            // Process already terminated
          }
        }, 2000);

        // Unref to prevent keeping event loop alive during shutdown
        forceKillTimeout.unref();

        // Clear timeout when process exits
        processToKill.once('exit', () => clearTimeout(forceKillTimeout));
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Clear state
    this.currentProcess = null;
    this.currentCommand = '';
    this.currentOutput = [];

    // Remove all event listeners
    this.removeAllListeners();
  }
}
