/**
 * Unified exit handler for AX CLI
 *
 * Provides consistent process exit handling across the application with:
 * - Structured error logging
 * - Cleanup callbacks
 * - Exit code standardization
 */

import { getLogger } from './logger.js';

/**
 * Standard exit codes following Unix conventions
 */
export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  MISUSE = 2, // Command line usage error
  CONFIG_ERROR = 78, // Configuration error (sysexits.h EX_CONFIG)
  PERMISSION_DENIED = 77, // Permission denied (sysexits.h EX_NOPERM)
  NETWORK_ERROR = 76, // Network error
  CANCELLED = 130, // User cancelled (Ctrl+C convention)
}

/**
 * Exit context for logging and debugging
 */
interface ExitContext {
  command?: string;
  operation?: string;
  [key: string]: unknown;
}

/**
 * Cleanup callbacks to run before exit
 */
const cleanupCallbacks: Array<() => void | Promise<void>> = [];

/**
 * Register a cleanup callback to run before exit
 * Callbacks are run in LIFO order (last registered runs first)
 */
export function registerCleanup(callback: () => void | Promise<void>): void {
  cleanupCallbacks.unshift(callback);
}

/**
 * Remove a cleanup callback
 */
export function unregisterCleanup(callback: () => void | Promise<void>): void {
  const index = cleanupCallbacks.indexOf(callback);
  if (index !== -1) {
    cleanupCallbacks.splice(index, 1);
  }
}

/**
 * Run all cleanup callbacks
 */
async function runCleanup(): Promise<void> {
  const logger = getLogger();

  for (const callback of cleanupCallbacks) {
    try {
      await callback();
    } catch (error) {
      // Log but don't fail - we're exiting anyway
      logger.debug('Cleanup callback failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Exit with an error message
 * Use this instead of direct process.exit(1) calls
 */
export function exitWithError(
  message: string,
  code: ExitCode = ExitCode.GENERAL_ERROR,
  context?: ExitContext
): never {
  const logger = getLogger();

  logger.error(message, context);

  // Run cleanup synchronously since we're about to exit
  // Note: We use void to explicitly ignore the promise
  void runCleanup().finally(() => {
    process.exit(code);
  });

  // This never returns, but TypeScript needs the throw
  throw new Error('Exit requested');
}

/**
 * Exit with success
 */
export function exitSuccess(message?: string): never {
  const logger = getLogger();

  if (message) {
    logger.info(message);
  }

  void runCleanup().finally(() => {
    process.exit(ExitCode.SUCCESS);
  });

  throw new Error('Exit requested');
}

/**
 * Exit due to user cancellation
 */
export function exitCancelled(message = 'Operation cancelled by user'): never {
  const logger = getLogger();

  logger.info(message);

  void runCleanup().finally(() => {
    process.exit(ExitCode.CANCELLED);
  });

  throw new Error('Exit requested');
}

/**
 * Exit due to configuration error
 */
export function exitConfigError(message: string, context?: ExitContext): never {
  return exitWithError(message, ExitCode.CONFIG_ERROR, {
    ...context,
    suggestion: 'Run "ax-cli setup" to configure the application',
  });
}

/**
 * Exit due to network error
 */
export function exitNetworkError(message: string, context?: ExitContext): never {
  return exitWithError(message, ExitCode.NETWORK_ERROR, {
    ...context,
    suggestion: 'Check your internet connection and try again',
  });
}

/**
 * Safe exit wrapper that logs errors without exiting
 * Use when you want to log but let the caller decide whether to exit
 */
export function logError(message: string, error?: unknown, context?: ExitContext): void {
  const logger = getLogger();

  if (error) {
    logger.errorWithStack(message, error, context);
  } else {
    logger.error(message, context);
  }
}
