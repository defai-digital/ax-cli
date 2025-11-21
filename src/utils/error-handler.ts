/**
 * Centralized error handling utilities
 * Provides consistent error messages and logging
 */

import { ToolResult } from '../types/index.js';

/**
 * Standard error categories
 */
export enum ErrorCategory {
  FILE_OPERATION = 'File Operation',
  BASH_COMMAND = 'Bash Command',
  MCP_CONNECTION = 'MCP Connection',
  TOOL_EXECUTION = 'Tool Execution',
  VALIDATION = 'Validation',
  NETWORK = 'Network',
  CONFIGURATION = 'Configuration',
  API_ERROR = 'API Error',
  AUTHENTICATION = 'Authentication',
  RATE_LIMIT = 'Rate Limit',
  MODEL_UNAVAILABLE = 'Model Unavailable',
  PARSING = 'Parsing',
  TIMEOUT = 'Timeout',
}

/**
 * Get actionable suggestion based on error type
 * Phase 3: Enhanced error recovery
 */
function getErrorSuggestion(category: ErrorCategory, errorMessage: string): string | null {
  const lowerError = errorMessage.toLowerCase();

  // File operation errors
  if (category === ErrorCategory.FILE_OPERATION) {
    if (lowerError.includes('enoent') || lowerError.includes('no such file')) {
      return "💡 Suggestion: Check if the file path is correct and the file exists.";
    }
    if (lowerError.includes('eacces') || lowerError.includes('permission denied')) {
      return "💡 Suggestion: Check file permissions or try running with appropriate access.";
    }
    if (lowerError.includes('eisdir') || lowerError.includes('is a directory')) {
      return "💡 Suggestion: The path points to a directory, not a file. Specify a file path.";
    }
  }

  // API errors
  if (category === ErrorCategory.API_ERROR || category === ErrorCategory.AUTHENTICATION) {
    if (lowerError.includes('api key') || lowerError.includes('unauthorized')) {
      return "💡 Suggestion: Verify your API key in ~/.ax-cli/config.json or use 'ax setup' to reconfigure.";
    }
    if (lowerError.includes('network') || lowerError.includes('timeout')) {
      return "💡 Suggestion: Check your internet connection and try again.";
    }
  }

  // Rate limit errors
  if (category === ErrorCategory.RATE_LIMIT) {
    return "💡 Suggestion: Wait a few moments before retrying. Consider upgrading your API plan if this happens frequently.";
  }

  // MCP connection errors
  if (category === ErrorCategory.MCP_CONNECTION) {
    return "💡 Suggestion: Check your MCP server configuration in .ax-cli/settings.json and ensure the server is running.";
  }

  // Bash command errors
  if (category === ErrorCategory.BASH_COMMAND) {
    if (lowerError.includes('command not found')) {
      return "💡 Suggestion: Install the required command or check if it's in your PATH.";
    }
    if (lowerError.includes('exit code')) {
      return "💡 Suggestion: Check the command output above for specific error details.";
    }
  }

  return null;
}

/**
 * Create a standardized error message
 * Phase 3: Enhanced with actionable suggestions
 */
export function createErrorMessage(
  category: ErrorCategory,
  operation: string,
  error: unknown
): string {
  const errorMsg = extractErrorMessage(error);
  const baseMessage = `[${category}] ${operation} failed: ${errorMsg}`;

  // Add suggestion if available
  const suggestion = getErrorSuggestion(category, errorMsg);
  if (suggestion) {
    return `${baseMessage}\n${suggestion}`;
  }

  return baseMessage;
}

/**
 * Create a standardized ToolResult error
 */
export function createToolError(
  category: ErrorCategory,
  operation: string,
  error: unknown
): ToolResult {
  return {
    success: false,
    error: createErrorMessage(category, operation, error),
  };
}

/**
 * Create a standardized ToolResult success
 */
export function createToolSuccess(output: string): ToolResult {
  return {
    success: true,
    output,
  };
}

/**
 * Extract error message from unknown error type
 * Consolidates the common pattern: error instanceof Error ? error.message : String(error)
 */
export function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T>(
  json: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(json) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: extractErrorMessage(error),
    };
  }
}

/**
 * Wrap async operation with consistent error handling
 */
export async function wrapToolOperation<T>(
  category: ErrorCategory,
  operation: string,
  fn: () => Promise<T>
): Promise<ToolResult> {
  try {
    const result = await fn();
    return createToolSuccess(
      typeof result === 'string' ? result : JSON.stringify(result)
    );
  } catch (error) {
    return createToolError(category, operation, error);
  }
}
