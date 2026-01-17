import { spawn, ChildProcess, execFileSync } from 'child_process';
import * as vscode from 'vscode';
import type { CLIRequest, CLIResponse, CLIError } from './types.js';
import { CLI_REQUEST_TIMEOUT_MS, CONFIG_NAMESPACE } from './constants.js';

// Re-export types for consumers of this module
export type { CLIRequest, CLIResponse, CLIError };

/**
 * Check if a command exists in PATH (cross-platform).
 * Uses 'where' on Windows and 'which' on Unix-like systems.
 */
function findOnPathSync(command: string): string | null {
  try {
    const checkCommand = process.platform === 'win32' ? 'where' : 'which';
    const stdout = execFileSync(checkCommand, [command], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return stdout.trim().split('\n')[0] || null;
  } catch {
    return null;
  }
}

export class CLIBridge {
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private requestCallbacks: Map<string, (response: CLIResponse | CLIError) => void> = new Map();

  constructor() {
    this.ensureCLIInstalled();
  }

  private ensureCLIInstalled(): void {
    // Check if ax-cli is installed using cross-platform findOnPath
    if (!findOnPathSync('ax-cli')) {
      vscode.window.showErrorMessage(
        'AX CLI not found. Please install: npm install -g @defai.digital/ax-cli',
        'Install Now'
      ).then((selection: string | undefined) => {
        if (selection === 'Install Now') {
          vscode.window.showInformationMessage('Opening installation guide...');
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/defai-digital/ax-cli#installation'));
        }
      });
    }
  }

  async sendRequest(request: CLIRequest): Promise<CLIResponse | CLIError> {
    return new Promise((resolve) => {
      // Store callback
      this.requestCallbacks.set(request.id, resolve);

      // Build command
      const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
      const args = [
        '--prompt', request.prompt,
        '--json',
        '--vscode',
      ];

      // Note: API key is now stored in SecretStorage and passed via environment variable
      // See CLIBridgeSDK for the secure implementation

      // Add base URL if configured
      const baseURL = config.get<string>('baseURL');
      if (baseURL) {
        args.push('--base-url', baseURL);
      }

      // Add model if configured
      const model = config.get<string>('model');
      if (model) {
        args.push('--model', model);
      }

      // Add max tool rounds if configured
      const maxToolRounds = config.get<number>('maxToolRounds');
      if (maxToolRounds) {
        args.push('--max-tool-rounds', maxToolRounds.toString());
      }

      // Add context flags
      if (request.context) {
        if (request.context.file) {
          args.push('--file', request.context.file);
        }
        if (request.context.selection) {
          args.push('--selection', request.context.selection);
        }
        if (request.context.lineRange) {
          args.push('--line-range', request.context.lineRange);
        }
        if (request.context.gitDiff) {
          args.push('--git-diff');
        }
      }

      // Spawn process with fallback cwd to prevent undefined
      // Priority: workspace folder > home directory > process cwd
      const workspaceCwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const homeCwd = require('os').homedir();
      const cwd = workspaceCwd || homeCwd || process.cwd();

      const cliProcess = spawn('ax-cli', args, {
        cwd,
      });

      // Track the process so dispose() can kill it
      this.activeProcesses.set(request.id, cliProcess);

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | null = null;

      cliProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      cliProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      cliProcess.on('close', (code) => {
        // Clear timeout to prevent memory leak
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // Clean up process tracking
        this.activeProcesses.delete(request.id);

        if (code === 0) {
          try {
            const response: CLIResponse = JSON.parse(stdout);
            response.id = request.id;
            resolve(response);
          } catch (error) {
            const errorResponse: CLIError = {
              id: request.id,
              error: {
                message: 'Failed to parse CLI response',
                type: 'ParseError',
              },
              timestamp: new Date().toISOString(),
            };
            resolve(errorResponse);
          }
        } else {
          try {
            const errorResponse: CLIError = JSON.parse(stdout || stderr);
            errorResponse.id = request.id;
            resolve(errorResponse);
          } catch {
            const errorResponse: CLIError = {
              id: request.id,
              error: {
                message: stderr || 'CLI process failed',
                type: 'ProcessError',
              },
              timestamp: new Date().toISOString(),
            };
            resolve(errorResponse);
          }
        }

        this.requestCallbacks.delete(request.id);
      });

      cliProcess.on('error', (error) => {
        // Clear timeout to prevent memory leak
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // Clean up process tracking on error
        this.activeProcesses.delete(request.id);

        const errorResponse: CLIError = {
          id: request.id,
          error: {
            message: error.message,
            type: 'SpawnError',
          },
          timestamp: new Date().toISOString(),
        };
        resolve(errorResponse);
        this.requestCallbacks.delete(request.id);
      });

      // Timeout after configured duration
      timeoutId = setTimeout(() => {
        if (this.requestCallbacks.has(request.id)) {
          cliProcess.kill();
          this.activeProcesses.delete(request.id);
          const errorResponse: CLIError = {
            id: request.id,
            error: {
              message: 'Request timeout',
              type: 'TimeoutError',
            },
            timestamp: new Date().toISOString(),
          };
          resolve(errorResponse);
          this.requestCallbacks.delete(request.id);
        }
      }, CLI_REQUEST_TIMEOUT_MS);
    });
  }

  dispose(): void {
    // Kill all active processes
    for (const [requestId, process] of this.activeProcesses) {
      process.kill();
      this.activeProcesses.delete(requestId);
    }
    this.requestCallbacks.clear();
  }
}
