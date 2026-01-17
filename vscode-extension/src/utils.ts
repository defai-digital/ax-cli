/**
 * Shared utilities for the AX CLI VS Code extension
 */

import * as crypto from 'crypto';
import * as path from 'path';
import * as os from 'os';

/**
 * App configuration directory name
 * Used for storing sessions, checkpoints, hooks config, etc.
 */
export const AX_CLI_DIR = '.ax-cli';

/**
 * Get the full path to the AX CLI config directory in user's home
 * @returns Path like "/Users/name/.ax-cli"
 */
export function getAppConfigDir(): string {
  return path.join(os.homedir(), AX_CLI_DIR);
}

/**
 * Generate a unique ID with optional prefix
 * Uses crypto.randomUUID() for collision-resistant IDs
 *
 * @param prefix - Optional prefix for the ID (e.g., 'cp', 'session', 'hook')
 * @returns Unique ID string like "prefix-1234567890-a1b2c3d4"
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now();
  const random = crypto.randomUUID().slice(0, 8);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Generate a cryptographically secure nonce for CSP
 * @returns Base64-encoded random string
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Escape a string for safe use in shell commands
 * Cross-platform: uses double quotes on Windows, single quotes on Unix
 */
export function escapeShellArg(arg: string): string {
  if (process.platform === 'win32') {
    // Windows cmd.exe: escape special characters
    const escaped = arg
      .replace(/"/g, '""')
      .replace(/%/g, '%%')
      .replace(/\^/g, '^^')
      .replace(/&/g, '^&')
      .replace(/</g, '^<')
      .replace(/>/g, '^>')
      .replace(/\|/g, '^|');
    return `"${escaped}"`;
  }
  // Unix: use single quotes
  return `'${arg.replace(/'/g, "'\\''")}'`;
}
