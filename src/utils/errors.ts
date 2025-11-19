/**
 * Typed Error Classes
 * Provides consistent, categorized error handling across the application
 */

/**
 * Base error class for AX CLI errors
 */
export class AxCliError extends Error {
  constructor(
    message: string,
    public readonly category: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AxCliError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Configuration-related errors (YAML, settings, etc.)
 */
export class ConfigurationError extends AxCliError {
  constructor(message: string, details?: unknown) {
    super(message, 'Configuration', details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Validation errors (Zod, schema, input validation)
 */
export class ValidationError extends AxCliError {
  constructor(message: string, details?: unknown) {
    super(message, 'Validation', details);
    this.name = 'ValidationError';
  }
}

/**
 * File system operation errors
 */
export class FileSystemError extends AxCliError {
  constructor(
    message: string,
    public readonly filePath?: string,
    details?: unknown
  ) {
    super(message, 'FileSystem', details);
    this.name = 'FileSystemError';
  }
}

/**
 * Network/API errors
 */
export class NetworkError extends AxCliError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    details?: unknown
  ) {
    super(message, 'Network', details);
    this.name = 'NetworkError';
  }
}

/**
 * MCP (Model Context Protocol) errors
 */
export class MCPError extends AxCliError {
  constructor(
    message: string,
    public readonly serverName?: string,
    details?: unknown
  ) {
    super(message, 'MCP', details);
    this.name = 'MCPError';
  }
}

/**
 * Tool execution errors
 */
export class ToolExecutionError extends AxCliError {
  constructor(
    message: string,
    public readonly toolName?: string,
    details?: unknown
  ) {
    super(message, 'ToolExecution', details);
    this.name = 'ToolExecutionError';
  }
}

/**
 * Authentication/Authorization errors
 */
export class AuthenticationError extends AxCliError {
  constructor(message: string, details?: unknown) {
    super(message, 'Authentication', details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Type guard to check if error is an AxCliError
 */
export function isAxCliError(error: unknown): error is AxCliError {
  return error instanceof AxCliError;
}

/**
 * Extract user-friendly error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AxCliError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unknown error occurred';
}

/**
 * Format error for logging with details
 */
export function formatErrorForLogging(error: unknown): string {
  if (error instanceof AxCliError) {
    let message = `[${error.category}] ${error.message}`;

    if (error.details) {
      message += `\nDetails: ${JSON.stringify(error.details, null, 2)}`;
    }

    if (error.stack) {
      message += `\nStack: ${error.stack}`;
    }

    return message;
  }

  if (error instanceof Error) {
    return error.stack || error.message;
  }

  return String(error);
}

/**
 * Wrap any error in an appropriate AxCliError
 */
export function wrapError(error: unknown, category: string, context?: string): AxCliError {
  const message = context
    ? `${context}: ${getErrorMessage(error)}`
    : getErrorMessage(error);

  return new AxCliError(message, category, error);
}
