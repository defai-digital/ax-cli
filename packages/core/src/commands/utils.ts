/**
 * Shared utilities for CLI commands
 *
 * A thin utility layer to reduce duplication across commands.
 * NOT a framework - just common patterns extracted.
 */

import chalk from 'chalk';
import * as prompts from '@clack/prompts';
import { extractErrorMessage } from '../utils/error-handler.js';
import { getTerminalStateManager } from '../utils/terminal-state.js';
import { exitCancelled } from '../utils/exit-handler.js';

/**
 * Standard result type for command operations
 */
export interface CommandResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Handle errors consistently across commands
 * Prints error using @clack/prompts style with optional suggestion
 */
export function handleCommandError(
  error: unknown,
  options?: {
    suggestion?: string;
    exitCode?: number;
    exit?: boolean;
  }
): void {
  const message = extractErrorMessage(error);
  prompts.log.error(message);

  if (options?.suggestion) {
    prompts.log.info(options.suggestion);
  }

  if (options?.exit !== false) {
    process.exit(options?.exitCode ?? 1);
  }
}

/**
 * Run an async operation with a spinner
 * Handles spinner cleanup on both success and failure
 */
export async function withSpinner<T>(
  message: string,
  operation: () => Promise<T>,
  options?: {
    successMessage?: string | ((result: T) => string);
    failureMessage?: string;
  }
): Promise<T> {
  const spinner = prompts.spinner();
  spinner.start(message);

  try {
    const result = await operation();
    const successMsg = typeof options?.successMessage === 'function'
      ? options.successMessage(result)
      : options?.successMessage ?? 'Done';
    spinner.stop(successMsg);
    return result;
  } catch (error) {
    spinner.stop(options?.failureMessage ?? 'Failed');
    throw error;
  }
}

/**
 * Output data as JSON if --json flag is set, otherwise use callback
 */
export function outputResult<T>(
  data: T,
  options: { json?: boolean },
  formatFn: (data: T) => void
): void {
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    formatFn(data);
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '0 B';
  if (bytes === 0) return '0 B';
  if (bytes < 0) return '-' + formatBytes(-bytes);
  if (bytes < 1) return '< 1 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format date to locale string
 */
export function formatDate(date: Date | number | string): string {
  const d = typeof date === 'number' || typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
}

/**
 * Print a separator line
 */
export function printSeparator(width = 60): void {
  console.log(chalk.gray('─'.repeat(width)));
}

/**
 * Confirm an action, respecting --yes flag
 */
export async function confirmAction(
  message: string,
  options?: { yes?: boolean; defaultValue?: boolean }
): Promise<boolean> {
  if (options?.yes) return true;

  const result = await prompts.confirm({
    message,
    initialValue: options?.defaultValue ?? false,
  });

  if (prompts.isCancel(result)) {
    return false;
  }

  return result;
}

/**
 * Exit if user cancelled a prompt.
 * Ensures proper terminal cleanup before exit.
 */
export function exitIfCancelled<T>(value: T | symbol, message = 'Operation cancelled'): asserts value is T {
  if (prompts.isCancel(value)) {
    // Ensure terminal state is cleaned up (cursor visibility, raw mode, etc.)
    const terminalManager = getTerminalStateManager();
    terminalManager.forceCleanup();

    prompts.cancel(message);
    exitCancelled(message);
  }
}
