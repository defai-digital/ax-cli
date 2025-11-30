/**
 * Command Security Utilities
 *
 * Provides secure command execution with whitelisting and validation.
 * Prevents command injection vulnerabilities (REQ-SEC-001).
 *
 * @module command-security
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ToolResult } from '../types/index.js';

const execFileAsync = promisify(execFile);

/**
 * Whitelist of safe commands allowed for execution.
 * Only these commands can be executed via the BashTool.
 *
 * CRITICAL: Do not add arbitrary commands without security review.
 */
export const SAFE_COMMANDS = [
  'ls',
  'grep',
  'find',
  'cat',
  'head',
  'tail',
  'wc',
  'sort',
  'uniq',
  'cut',
  'awk',
  'sed',
  'pwd',
  'echo',
  'date',
  'whoami',
  'hostname',
  'git',
  'rg',
  'fd',
  'rm',      // File deletion (safe with validation)
  'mkdir',   // Directory creation
  'touch',   // File creation
  'cp',      // File copy
  'mv',      // File move/rename
] as const;

export type SafeCommand = typeof SAFE_COMMANDS[number];

/**
 * Environment variables safe to pass to child processes.
 * Only these will be included in the child process environment.
 */
const SAFE_ENV_VARS = [
  'PATH',
  'HOME',
  'USER',
  'LANG',
  'LC_ALL',
  'TERM',
  'TMPDIR',
  'PWD',
] as const;

/**
 * Shell metacharacters that are forbidden in command arguments.
 * These could enable command injection if not properly validated.
 */
const SHELL_METACHARACTERS = /[;&|`$(){}[\]<>'"\\*?~!#]/;

/**
 * Parsed command structure
 */
export interface ParsedCommand {
  command: SafeCommand;
  args: string[];
}

/**
 * Command execution options
 */
export interface CommandExecutionOptions {
  cwd?: string;
  timeout?: number;
  maxBuffer?: number;
}

/**
 * Sanitize environment variables for child process.
 * Only includes safe environment variables to prevent injection.
 *
 * @param env - Original process environment
 * @returns Sanitized environment object
 */
export function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const sanitized: NodeJS.ProcessEnv = {};

  for (const key of SAFE_ENV_VARS) {
    if (env[key]) {
      sanitized[key] = env[key];
    }
  }

  return sanitized;
}

/**
 * Parse a command string into command and arguments.
 * Validates that the command is in the whitelist.
 *
 * @param commandString - Full command string (e.g., "ls -la /tmp")
 * @returns Parsed command structure
 * @throws Error if command is not whitelisted
 */
export function parseCommand(commandString: string): ParsedCommand {
  const trimmed = commandString.trim();

  if (!trimmed) {
    throw new Error('Empty command string');
  }

  // Simple split by whitespace
  const parts = trimmed.split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);

  // Validate command is in whitelist
  if (!SAFE_COMMANDS.includes(command as SafeCommand)) {
    throw new Error(
      `Command '${command}' not in whitelist. Allowed commands: ${SAFE_COMMANDS.join(', ')}`
    );
  }

  return {
    command: command as SafeCommand,
    args,
  };
}

/**
 * Validate command arguments for shell metacharacters.
 * Prevents command injection via argument injection.
 *
 * @param args - Command arguments to validate
 * @returns Validation result
 */
export function validateArguments(args: string[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // BUG FIX: Track cumulative argument size to prevent exceeding OS limits
  // Most Unix systems have ARG_MAX around 128KB-2MB, use conservative limit
  const MAX_TOTAL_ARG_SIZE = 131072; // 128KB - safe for most systems
  let totalArgSize = 0;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Check for shell metacharacters
    if (SHELL_METACHARACTERS.test(arg)) {
      errors.push(
        `Argument ${i} contains forbidden shell metacharacters: "${arg}"`
      );
    }

    // Check for null bytes
    if (arg.includes('\0')) {
      errors.push(`Argument ${i} contains null byte`);
    }

    // Check length (prevent buffer overflow)
    if (arg.length > 10000) {
      errors.push(`Argument ${i} exceeds maximum length (10000 chars)`);
    }

    // BUG FIX: Accumulate total size (including null terminator for each arg)
    totalArgSize += arg.length + 1;
  }

  // BUG FIX: Check cumulative argument size
  if (totalArgSize > MAX_TOTAL_ARG_SIZE) {
    errors.push(`Total argument size (${totalArgSize} bytes) exceeds safe limit (${MAX_TOTAL_ARG_SIZE} bytes)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Execute a safe command with validation.
 * Uses execFile to avoid shell invocation and command injection.
 *
 * SECURITY: This function uses execFile instead of spawn('bash', ['-c'])
 * to prevent command injection attacks.
 *
 * @param commandString - Command to execute
 * @param options - Execution options
 * @returns Tool result with output or error
 */
export async function executeSafeCommand(
  commandString: string,
  options: CommandExecutionOptions = {}
): Promise<ToolResult> {
  try {
    // 1. Parse command into command + args
    const parsed = parseCommand(commandString);

    // 2. Validate arguments
    const validation = validateArguments(parsed.args);
    if (!validation.valid) {
      return {
        success: false,
        error: `Command validation failed:\n${validation.errors.join('\n')}`,
      };
    }

    // 3. Prepare execution options
    const execOptions = {
      cwd: options.cwd || process.cwd(),
      env: sanitizeEnv(process.env),
      timeout: options.timeout || 30000, // 30 second default
      maxBuffer: options.maxBuffer || 1024 * 1024, // 1MB default
    };

    // 4. Execute using execFile (no shell invocation)
    const { stdout, stderr } = await execFileAsync(
      parsed.command,
      parsed.args,
      execOptions
    );

    // 5. Return successful result
    return {
      success: true,
      output: stdout || stderr || 'Command completed successfully',
    };
  } catch (error: any) {
    // Handle execution errors
    const errorMessage = error.message || String(error);
    const exitCode = error.code || 'unknown';

    return {
      success: false,
      error: `Command execution failed (exit code: ${exitCode}): ${errorMessage}`,
    };
  }
}

/**
 * Check if a command is safe to execute.
 *
 * @param command - Command name to check
 * @returns True if command is in whitelist
 */
export function isSafeCommand(command: string): command is SafeCommand {
  return SAFE_COMMANDS.includes(command as SafeCommand);
}

/**
 * Get list of safe commands (for documentation/help).
 *
 * @returns Array of safe command names
 */
export function getSafeCommands(): readonly string[] {
  return SAFE_COMMANDS;
}
