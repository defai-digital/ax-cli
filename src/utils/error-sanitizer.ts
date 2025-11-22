/**
 * Error Message Sanitization (REQ-SEC-010)
 *
 * Sanitizes error messages to prevent information disclosure
 * Removes:
 * - File system paths
 * - API keys and secrets
 * - Stack traces (for user-facing errors)
 * - Internal implementation details
 *
 * Security: CVSS 6.5 (Medium Priority)
 */

import { homedir } from 'os';
import { getAuditLogger, AuditCategory } from './audit-logger.js';

/**
 * Patterns to detect and sanitize in error messages
 */
const SENSITIVE_PATTERNS = {
  // File paths (Windows and Unix)
  FILE_PATH: /([A-Za-z]:\\|\/)[^\s"'<>|]+/g,

  // API keys and tokens (common formats)
  // Matches patterns like "api_key=XXX", "secret: XXX", "API key: XXX", "bearer XXX"
  API_KEY: /\b(?:api[_ -]?key|token|secret|password|bearer)[\s:=]+['"]?[a-zA-Z0-9_\-]{16,}['"]?/gi,

  // Environment variables
  ENV_VAR: /\$\{?[A-Z_][A-Z0-9_]*\}?/g,

  // IP addresses (for SSRF protection)
  IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

  // URLs with credentials
  URL_WITH_CREDS: /https?:\/\/[^:]+:[^@]+@[^\s]+/g,

  // Stack trace lines
  STACK_TRACE_LINE: /^\s*at\s+.+\(.+:\d+:\d+\)$/gm,

  // Home directory references
  HOME_DIR: new RegExp(homedir().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
} as const;

/**
 * Replacement strings for sanitized content
 */
const REPLACEMENTS = {
  FILE_PATH: '[REDACTED_PATH]',
  API_KEY: '[REDACTED_KEY]',
  ENV_VAR: '[REDACTED_ENV]',
  IP_ADDRESS: '[REDACTED_IP]',
  URL_WITH_CREDS: '[REDACTED_URL]',
  STACK_TRACE_LINE: '',
  HOME_DIR: '[USER_HOME]',
} as const;

/**
 * Sanitized error structure
 */
export interface SanitizedError {
  /**
   * Sanitized error message (safe for user display)
   */
  message: string;

  /**
   * Error code (for documentation lookup)
   */
  code?: string;

  /**
   * Generic error category
   */
  category: string;

  /**
   * Suggested action for user
   */
  suggestion?: string;

  /**
   * Original error (for internal logging only)
   */
  originalError?: Error;
}

/**
 * Error categories for user-friendly messages
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  FILE_SYSTEM = 'FILE_SYSTEM',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  RATE_LIMIT = 'RATE_LIMIT',
  API_ERROR = 'API_ERROR',
  INTERNAL = 'INTERNAL',
  USER_INPUT = 'USER_INPUT',
}

/**
 * Sanitize error message by removing sensitive information
 *
 * @param message - Raw error message
 * @returns Sanitized message safe for user display
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  // Remove URLs with credentials first (before FILE_PATH catches them)
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.URL_WITH_CREDS, REPLACEMENTS.URL_WITH_CREDS);

  // Remove home directory references (before FILE_PATH catches them)
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.HOME_DIR, REPLACEMENTS.HOME_DIR);

  // Remove file paths
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.FILE_PATH, REPLACEMENTS.FILE_PATH);

  // Remove API keys and secrets
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.API_KEY, REPLACEMENTS.API_KEY);

  // Remove environment variables
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.ENV_VAR, REPLACEMENTS.ENV_VAR);

  // Remove IP addresses
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.IP_ADDRESS, REPLACEMENTS.IP_ADDRESS);

  return sanitized;
}

/**
 * Sanitize stack trace by removing sensitive paths
 *
 * @param stack - Raw stack trace
 * @returns Sanitized stack trace
 */
export function sanitizeStackTrace(stack: string): string {
  let sanitized = stack;

  // Remove home directory references first
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.HOME_DIR, REPLACEMENTS.HOME_DIR);

  // Remove file paths from stack frames
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.FILE_PATH, REPLACEMENTS.FILE_PATH);

  return sanitized;
}

/**
 * Remove stack trace entirely (for user-facing errors)
 *
 * @param message - Error message with potential stack trace
 * @returns Message without stack trace
 */
export function removeStackTrace(message: string): string {
  // Split at first "at " (stack trace start)
  const parts = message.split(/\n\s*at\s+/);
  return parts[0].trim();
}

/**
 * Categorize error and create user-friendly message
 *
 * @param error - Error object
 * @returns Sanitized error with category and suggestion
 */
export function sanitizeError(error: Error | unknown): SanitizedError {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  const message = errorObj.message;

  // Sanitize the message
  const sanitizedMessage = sanitizeErrorMessage(removeStackTrace(message));

  // Determine category and suggestion
  let category = ErrorCategory.INTERNAL;
  let suggestion: string | undefined;
  let code: string | undefined;

  // Network errors
  if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
    category = ErrorCategory.NETWORK;
    suggestion = 'Check your network connection and try again.';
    code = 'ERR_NETWORK';
  }
  // File system errors
  else if (message.includes('ENOENT') || message.includes('EACCES') || message.includes('EPERM')) {
    category = ErrorCategory.FILE_SYSTEM;
    suggestion = 'Check that the file exists and you have permission to access it.';
    code = 'ERR_FILE_SYSTEM';
  }
  // Validation errors
  else if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    category = ErrorCategory.VALIDATION;
    suggestion = 'Check your input and try again.';
    code = 'ERR_VALIDATION';
  }
  // Authentication errors
  else if (message.includes('unauthorized') || message.includes('authentication') || message.includes('API key')) {
    category = ErrorCategory.AUTHENTICATION;
    suggestion = 'Check your API key configuration.';
    code = 'ERR_AUTH';
  }
  // Rate limit errors
  else if (message.includes('rate limit') || message.includes('too many requests')) {
    category = ErrorCategory.RATE_LIMIT;
    suggestion = 'Please wait a moment before trying again.';
    code = 'ERR_RATE_LIMIT';
  }
  // API errors
  else if (message.includes('API') || message.includes('status code')) {
    category = ErrorCategory.API_ERROR;
    suggestion = 'The API returned an error. Please try again later.';
    code = 'ERR_API';
  }

  // REQ-SEC-008: Audit log errors with sensitive info detection
  if (message !== sanitizedMessage) {
    const auditLogger = getAuditLogger();
    auditLogger.logWarning({
      category: AuditCategory.SYSTEM_EVENT,
      action: 'sensitive_data_in_error',
      outcome: 'success',
      details: {
        category,
        sanitized: true,
      },
    });
  }

  return {
    message: sanitizedMessage,
    code,
    category,
    suggestion,
    originalError: errorObj,
  };
}

/**
 * Format sanitized error for user display
 *
 * @param sanitizedError - Sanitized error object
 * @returns Formatted error message
 */
export function formatUserError(sanitizedError: SanitizedError): string {
  const parts: string[] = [];

  if (sanitizedError.code) {
    parts.push(`[${sanitizedError.code}]`);
  }

  parts.push(sanitizedError.message);

  if (sanitizedError.suggestion) {
    parts.push(`\nℹ️  ${sanitizedError.suggestion}`);
  }

  return parts.join(' ');
}

/**
 * Create internal log message with full details (not sanitized)
 *
 * @param error - Original error
 * @param context - Additional context
 * @returns Detailed log message
 */
export function createInternalLogMessage(error: Error | unknown, context?: Record<string, unknown>): string {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  const parts: string[] = [
    `Error: ${errorObj.message}`,
  ];

  if (errorObj.stack) {
    parts.push(`Stack: ${sanitizeStackTrace(errorObj.stack)}`);
  }

  if (context) {
    parts.push(`Context: ${JSON.stringify(context, null, 2)}`);
  }

  return parts.join('\n');
}

/**
 * Safe error wrapper for user-facing operations
 *
 * @param operation - Async operation to execute
 * @param errorHandler - Optional custom error handler
 * @returns Result or sanitized error
 *
 * @example
 * ```typescript
 * const result = await safeExecute(
 *   () => riskyOperation(),
 *   (error) => console.error('Internal error:', error)
 * );
 *
 * if (!result.success) {
 *   console.log(formatUserError(result.error));
 * }
 * ```
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  errorHandler?: (error: Error, sanitized: SanitizedError) => void
): Promise<{ success: true; data: T } | { success: false; error: SanitizedError }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const sanitized = sanitizeError(error);

    // Log internal error details
    if (errorHandler) {
      errorHandler(sanitized.originalError!, sanitized);
    } else {
      console.error(createInternalLogMessage(error));
    }

    return { success: false, error: sanitized };
  }
}
