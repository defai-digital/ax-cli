import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getActiveConfigPaths } from '../provider/config.js';

const execFileAsync = promisify(execFile);

/**
 * Check if a command exists in PATH (cross-platform).
 * Uses 'where' on Windows and 'which' on Unix-like systems.
 *
 * @param command - The command name to find
 * @returns Promise<string | null> - The path to the command if found, null otherwise
 */
export async function findOnPath(command: string): Promise<string | null> {
  try {
    // Handle full paths - just check if file exists
    if (command.includes('/') || command.includes('\\')) {
      return fs.existsSync(command) ? command : null;
    }

    // Use 'where' on Windows, 'which' on Unix-like systems
    const checkCommand = process.platform === 'win32' ? 'where' : 'which';
    const { stdout } = await execFileAsync(checkCommand, [command]);
    const foundPath = stdout.trim().split('\n')[0]; // Take first result
    return foundPath || null;
  } catch {
    return null;
  }
}

/**
 * Synchronous version of findOnPath for contexts where async is not available.
 * Uses 'where' on Windows and 'which' on Unix-like systems.
 *
 * @param command - The command name to find
 * @returns string | null - The path to the command if found, null otherwise
 */
export function findOnPathSync(command: string): string | null {
  try {
    // Handle full paths - just check if file exists
    if (command.includes('/') || command.includes('\\')) {
      return fs.existsSync(command) ? command : null;
    }

    // Use 'where' on Windows, 'which' on Unix-like systems
    const checkCommand = process.platform === 'win32' ? 'where' : 'which';
    const { execFileSync } = require('child_process');
    const stdout = execFileSync(checkCommand, [command], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const foundPath = stdout.trim().split('\n')[0]; // Take first result
    return foundPath || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the base directory for AX CLI user data.
 *
 * - Honors AX_CLI_HOME when set (useful for tests and sandboxed environments)
 * - Defaults to ~/.ax-glm or ~/.ax-grok (provider-specific) to preserve existing behavior
 * - Falls back to <cwd>/.ax-glm or <cwd>/.ax-grok when the home directory is not writable
 */
export function getAxBaseDir(): string {
  const override = process.env.AX_CLI_HOME;
  if (override && override.trim().length > 0) {
    return path.resolve(override);
  }

  // Use provider-specific user directory
  const configPaths = getActiveConfigPaths();
  const defaultDir = configPaths.USER_DIR;

  // If defaultDir is writable, use it
  try {
    fs.accessSync(defaultDir, fs.constants.W_OK);
    return defaultDir;
  } catch {
    // Fallback to workspace-local directory to avoid EPERM in sandboxed environments
    const fallbackDir = configPaths.PROJECT_DIR;
    try {
      fs.mkdirSync(fallbackDir, { recursive: true });
    } catch {
      // Ignore mkdir errors - final write attempts will surface meaningful errors
    }
    return fallbackDir;
  }
}
