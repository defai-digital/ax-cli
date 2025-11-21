import { spawn, ChildProcess } from 'child_process';
import { ToolResult } from '../types/index.js';
import { ConfirmationService } from '../utils/confirmation-service.js';
import { getMessageOptimizer } from '../utils/message-optimizer.js';
import { getBackgroundTaskManager } from '../utils/background-task-manager.js';
import { EventEmitter } from 'events';

/**
 * Escape shell argument to prevent command injection
 */
function escapeShellArg(arg: string): string {
  // Replace single quotes with '\'' to safely escape them
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

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
  private static readonly MAX_BUFFER_SIZE = 1024 * 1024; // 1MB
  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

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
   * Returns task ID if successful, null if no command is running
   */
  moveToBackground(): string | null {
    if (!this.currentProcess || !this.currentCommand) {
      return null;
    }

    const taskId = this.backgroundTaskManager.adoptProcess(
      this.currentProcess,
      this.currentCommand,
      this.currentDirectory,
      this.currentOutput
    );

    // Clear current state
    this.currentProcess = null;
    this.currentCommand = '';
    this.currentOutput = [];

    return taskId;
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

      // Request confirmation for bash command execution
      const shouldExecute = await this.confirmationService.shouldProceed('bash', {
        operation: 'Run bash command',
        filename: command,
        showVSCodeOpen: false,
        content: `Command: ${command}\nWorking directory: ${this.currentDirectory}`
      });

      if (!shouldExecute) {
        return {
          success: false,
          error: 'Command execution cancelled by user'
        };
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

    } catch (error: any) {

      // Extract command output from error if available
      let errorMessage = error.message;
      if (error.stdout || error.stderr) {
        errorMessage = (error.stdout || '') + (error.stderr ? `\nSTDERR: ${error.stderr}` : '');
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

    // Remove surrounding quotes if present
    if ((newDir.startsWith('"') && newDir.endsWith('"')) ||
        (newDir.startsWith("'") && newDir.endsWith("'"))) {
      newDir = newDir.slice(1, -1);
    }

    // Expand ~ to home directory
    if (newDir.startsWith('~/')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      if (!homeDir) {
        return {
          success: false,
          error: 'Cannot expand ~: HOME directory not found'
        };
      }
      newDir = newDir.replace(/^~/, homeDir);
    } else if (newDir === '~') {
      newDir = process.env.HOME || process.env.USERPROFILE || '';
      if (!newDir) {
        return {
          success: false,
          error: 'Cannot expand ~: HOME directory not found'
        };
      }
    }

    try {
      process.chdir(newDir);
      this.currentDirectory = process.cwd();
      return {
        success: true,
        output: `Changed directory to: ${this.currentDirectory}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Cannot change directory: ${error.message}`
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

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!movedToBackground) {
          childProcess.kill('SIGTERM');
          setTimeout(() => {
            if (childProcess.exitCode === null) {
              childProcess.kill('SIGKILL');
            }
          }, 1000);
        }
      }, timeout);

      // Handle abort signal (for Ctrl+B background transfer)
      if (signal) {
        signal.addEventListener('abort', () => {
          if (this.currentProcess === childProcess) {
            movedToBackground = true;
            clearTimeout(timeoutId);

            const taskId = this.moveToBackground();
            if (taskId) {
              resolve({
                movedToBackground: true,
                taskId,
                partialOutput: stdout.join('\n'),
              });
            }
          }
        }, { once: true });
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
        clearTimeout(timeoutId);

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
        clearTimeout(timeoutId);

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

  async listFiles(directory: string = '.'): Promise<ToolResult> {
    return this.execute(`ls -la ${escapeShellArg(directory)}`);
  }

  async findFiles(pattern: string, directory: string = '.'): Promise<ToolResult> {
    return this.execute(`find ${escapeShellArg(directory)} -name ${escapeShellArg(pattern)} -type f`);
  }

  async grep(pattern: string, files: string = '.'): Promise<ToolResult> {
    return this.execute(`grep -r ${escapeShellArg(pattern)} ${escapeShellArg(files)}`);
  }
}