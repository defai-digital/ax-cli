import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolResult } from '../types/index.js';
import { ConfirmationService } from '../utils/confirmation-service.js';

const execAsync = promisify(exec);

/**
 * Escape shell argument to prevent command injection
 */
function escapeShellArg(arg: string): string {
  // Replace single quotes with '\'' to safely escape them
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export class BashTool {
  private static readonly MAX_BUFFER_SIZE = 1024 * 1024; // 1MB
  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  private currentDirectory: string = process.cwd();
  private confirmationService = ConfirmationService.getInstance();


  async execute(command: string, timeout: number = BashTool.DEFAULT_TIMEOUT): Promise<ToolResult> {
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

      if (command.startsWith('cd ')) {
        const newDir = command.substring(3).trim();

        // Validate directory path is not empty
        if (newDir === '') {
          return {
            success: false,
            error: 'Cannot change directory: no directory specified'
          };
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

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.currentDirectory,
        timeout,
        maxBuffer: BashTool.MAX_BUFFER_SIZE,
        killSignal: 'SIGTERM'
      });

      const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
      
      return {
        success: true,
        output: output.trim() || 'Command executed successfully (no output)'
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Command failed: ${error.message}`
      };
    }
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