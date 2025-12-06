/**
 * Enhanced Error Messages
 * Provides user-friendly, actionable error messages with clear recovery paths
 * Phase 5: Error Message Improvements
 */

import { ErrorCategory } from './error-handler.js';

/**
 * Error message template with user-friendly formatting
 */
interface ErrorMessageTemplate {
  title: string;
  description: string;
  suggestions: string[];
  learnMore?: string;
}

/**
 * Common file operation error patterns
 */
const FILE_ERROR_PATTERNS: Record<string, ErrorMessageTemplate> = {
  ENOENT: {
    title: 'File or Directory Not Found',
    description: 'The specified path does not exist',
    suggestions: [
      'Check if the file path is correct',
      'Verify the file exists using: ls <directory>',
      'Use absolute paths to avoid confusion',
      'Check for typos in the file name',
    ],
  },
  EACCES: {
    title: 'Permission Denied',
    description: 'You do not have permission to access this file',
    suggestions: [
      'Check file permissions using: ls -la <file>',
      'Ensure you have read/write access',
      'Try running with appropriate permissions',
      'Contact your system administrator if needed',
    ],
  },
  EISDIR: {
    title: 'Expected File, Got Directory',
    description: 'The path points to a directory, not a file',
    suggestions: [
      'Specify a file path instead of a directory',
      'Use ls to list directory contents',
      'Add a filename to the end of the path',
    ],
  },
  ENOTDIR: {
    title: 'Expected Directory, Got File',
    description: 'The path points to a file, not a directory',
    suggestions: [
      'Specify a directory path instead of a file',
      'Remove the filename from the path',
      'Check the path structure',
    ],
  },
  EEXIST: {
    title: 'File Already Exists',
    description: 'Cannot create file because it already exists',
    suggestions: [
      'Choose a different filename',
      'Delete the existing file first (use with caution)',
      'Use str_replace to modify the existing file instead',
    ],
  },
  EMFILE: {
    title: 'Too Many Open Files',
    description: 'System has reached the limit of open files',
    suggestions: [
      'Close some open files or processes',
      'Increase system file descriptor limit',
      'Check for file handle leaks in running processes',
    ],
  },
  ENOSPC: {
    title: 'No Space Left on Device',
    description: 'The disk is full',
    suggestions: [
      'Free up disk space by deleting unnecessary files',
      'Check disk usage with: df -h',
      'Move files to a different location',
      'Clean up temporary files',
    ],
  },
};

/**
 * API error templates with actionable ax-cli commands
 */
const API_ERROR_PATTERNS: Record<number, ErrorMessageTemplate> = {
  400: {
    title: 'Bad Request',
    description: 'The API request was malformed or invalid',
    suggestions: [
      'Check the request parameters',
      'Verify the model name: ax-cli models',
      'Ensure the input is properly formatted',
      'Review the API documentation',
    ],
  },
  401: {
    title: 'Authentication Failed',
    description: 'Your API key is invalid or missing',
    suggestions: [
      '→ Run: ax-cli setup (to configure your API key)',
      '→ Or run: ax-cli config set apiKey YOUR_API_KEY',
      'Verify your API key at the provider dashboard',
      'Check if your API key has expired and regenerate if needed',
    ],
    learnMore: 'https://docs.ax-cli.dev/configuration#api-keys',
  },
  403: {
    title: 'Access Forbidden',
    description: 'You do not have permission to access this resource',
    suggestions: [
      'Verify your account has access to this model: ax-cli models',
      'Check your subscription plan at the provider dashboard',
      '→ Run: ax-cli doctor (to diagnose configuration issues)',
      'Ensure your API key has the correct permissions',
    ],
  },
  404: {
    title: 'Resource Not Found',
    description: 'The requested model or endpoint does not exist',
    suggestions: [
      '→ Run: ax-cli models (to see available models)',
      '→ Run: ax-cli config get baseUrl (to check your API endpoint)',
      'Ensure the provider supports this model',
      '→ Run: ax-cli doctor (to verify configuration)',
    ],
  },
  429: {
    title: 'Rate Limit Exceeded',
    description: 'You have sent too many requests in a short period',
    suggestions: [
      'Wait a few minutes before retrying',
      'Check your rate limits at the provider dashboard',
      '→ Run: ax-cli usage (to check your usage)',
      'Consider upgrading your API plan',
    ],
    learnMore: 'https://docs.ax-cli.dev/troubleshooting#rate-limits',
  },
  500: {
    title: 'Server Error',
    description: 'The API server encountered an internal error',
    suggestions: [
      'Wait a few moments and try again',
      'Check provider status page for outages',
      '→ Run: ax-cli doctor (to verify your configuration)',
      'Contact provider support if it persists',
    ],
  },
  502: {
    title: 'Bad Gateway',
    description: 'The API gateway received an invalid response',
    suggestions: [
      'This is a temporary provider issue',
      'Wait a few moments and try again',
      'Check provider status page',
    ],
  },
  503: {
    title: 'Service Unavailable',
    description: 'The API service is temporarily unavailable',
    suggestions: [
      'The provider may be experiencing high load',
      'Wait a few minutes and try again',
      'Check provider status page for updates',
    ],
  },
  504: {
    title: 'Gateway Timeout',
    description: 'The request took too long to complete',
    suggestions: [
      'Try reducing the complexity of your request',
      'Split large operations into smaller chunks',
      'Check your internet connection',
      'Try again in a few moments',
    ],
  },
};

/**
 * MCP error templates with actionable ax-cli commands
 */
const MCP_ERROR_PATTERNS: Record<string, ErrorMessageTemplate> = {
  CONNECTION_FAILED: {
    title: 'MCP Server Connection Failed',
    description: 'Unable to connect to the MCP server',
    suggestions: [
      '→ Run: ax-cli mcp list (to see configured servers)',
      '→ Run: ax-cli mcp test <server-name> (to test connection)',
      '→ Run: ax-cli mcp health (to check all server status)',
      'Check server logs for errors',
      '→ Run: ax-cli mcp remove <server-name> && ax-cli mcp add <server-name> --template (to reinstall)',
    ],
    learnMore: 'https://docs.ax-cli.dev/mcp#troubleshooting',
  },
  INVALID_RESPONSE: {
    title: 'Invalid MCP Server Response',
    description: 'The MCP server returned an unexpected response',
    suggestions: [
      '→ Run: ax-cli mcp test <server-name> (to verify server)',
      '→ Run: ax-cli mcp tools <server-name> (to see available tools)',
      'Ensure the MCP server is up to date',
      'Check if the server implements the MCP protocol correctly',
    ],
  },
  TIMEOUT: {
    title: 'MCP Server Timeout',
    description: 'The MCP server did not respond in time',
    suggestions: [
      '→ Run: ax-cli mcp health <server-name> (to check server status)',
      '→ Run: ax-cli mcp test <server-name> (to test connection)',
      'Check if the server is overloaded',
      'Try restarting the MCP server',
    ],
  },
  AUTH_FAILED: {
    title: 'MCP Server Authentication Failed',
    description: 'The MCP server rejected the authentication credentials',
    suggestions: [
      '→ Run: ax-cli mcp add <server-name> --template --env TOKEN=YOUR_TOKEN (to re-add with token)',
      'Verify your API token/key is valid and not expired',
      'Check the environment variable is set correctly',
      '→ Run: ax-cli mcp validate <server-name> (to check configuration)',
    ],
  },
  ENV_MISSING: {
    title: 'Missing Environment Variable',
    description: 'A required environment variable is not set',
    suggestions: [
      '→ Run: ax-cli mcp add <name> --template --env VAR_NAME=VALUE (to provide directly)',
      'Or set in your shell: export VAR_NAME="your_value"',
      'Or add to ~/.bashrc or ~/.zshrc for persistence',
      '→ Run: ax-cli mcp templates (to see required variables for each template)',
    ],
  },
};

/**
 * Bash command error templates
 */
const BASH_ERROR_PATTERNS: Record<string, ErrorMessageTemplate> = {
  COMMAND_NOT_FOUND: {
    title: 'Command Not Found',
    description: 'The specified command is not available',
    suggestions: [
      'Install the required command',
      'Check if the command is in your PATH',
      'Verify the command name is correct',
      'Try using the full path to the command',
    ],
  },
  EXIT_CODE_1: {
    title: 'Command Failed',
    description: 'The command exited with an error',
    suggestions: [
      'Check the command output above for details',
      'Verify command arguments are correct',
      'Ensure required files/resources exist',
      'Try running the command manually to debug',
    ],
  },
  SECURITY_VIOLATION: {
    title: 'Security Restriction',
    description: 'This command is blocked for security reasons',
    suggestions: [
      'Use allowed commands only',
      'Check security settings in .ax-cli/settings.json',
      'Avoid destructive operations without confirmation',
      'Use safe alternatives when available',
    ],
    learnMore: 'https://docs.ax-cli.dev/security#command-restrictions',
  },
};

/**
 * Format an error message with user-friendly structure
 */
export function formatEnhancedError(
  category: ErrorCategory,
  operation: string,
  errorMessage: string,
  options?: {
    filePath?: string;
    statusCode?: number;
    errorCode?: string;
    details?: string;
  }
): string {
  const template = getErrorTemplate(category, errorMessage, options);

  if (!template) {
    // Fallback to standard error message
    return `[${category}] ${operation} failed: ${errorMessage}`;
  }

  // Build enhanced error message
  const parts: string[] = [];

  // Header with emoji icon
  const icon = getErrorIcon(category);
  parts.push(`${icon} ${template.title}\n`);

  // Operation context
  parts.push(`Operation: ${operation}`);

  // File path if provided
  if (options?.filePath) {
    parts.push(`File: ${options.filePath}`);
  }

  // Description
  parts.push(`\n${template.description}`);

  // Original error if different from description
  if (!template.description.includes(errorMessage) && errorMessage.length < 200) {
    parts.push(`Error: ${errorMessage}`);
  }

  // Additional details if provided
  if (options?.details) {
    parts.push(`Details: ${options.details}`);
  }

  // Suggestions
  if (template.suggestions.length > 0) {
    parts.push('\n💡 How to fix:');
    template.suggestions.forEach((suggestion, idx) => {
      parts.push(`   ${idx + 1}. ${suggestion}`);
    });
  }

  // Learn more link
  if (template.learnMore) {
    parts.push(`\n📚 Learn more: ${template.learnMore}`);
  }

  return parts.join('\n');
}

/**
 * Get error template based on category and error message
 */
function getErrorTemplate(
  category: ErrorCategory,
  errorMessage: string,
  options?: {
    statusCode?: number;
    errorCode?: string;
  }
): ErrorMessageTemplate | null {
  const lowerError = errorMessage.toLowerCase();

  // File operations
  if (category === ErrorCategory.FILE_OPERATION) {
    // Check for specific error codes
    for (const [code, template] of Object.entries(FILE_ERROR_PATTERNS)) {
      if (lowerError.includes(code.toLowerCase()) ||
          errorMessage.includes(code)) {
        return template;
      }
    }

    // Pattern matching
    if (lowerError.includes('not found') || lowerError.includes('no such file')) {
      return FILE_ERROR_PATTERNS.ENOENT;
    }
    if (lowerError.includes('permission') || lowerError.includes('access denied')) {
      return FILE_ERROR_PATTERNS.EACCES;
    }
    if (lowerError.includes('is a directory')) {
      return FILE_ERROR_PATTERNS.EISDIR;
    }
    if (lowerError.includes('already exists')) {
      return FILE_ERROR_PATTERNS.EEXIST;
    }
  }

  // API errors
  if (category === ErrorCategory.API_ERROR ||
      category === ErrorCategory.AUTHENTICATION ||
      category === ErrorCategory.RATE_LIMIT) {
    if (options?.statusCode && API_ERROR_PATTERNS[options.statusCode]) {
      return API_ERROR_PATTERNS[options.statusCode];
    }
  }

  // MCP errors
  if (category === ErrorCategory.MCP_CONNECTION) {
    if (lowerError.includes('connection') || lowerError.includes('connect')) {
      return MCP_ERROR_PATTERNS.CONNECTION_FAILED;
    }
    if (lowerError.includes('timeout')) {
      return MCP_ERROR_PATTERNS.TIMEOUT;
    }
    if (lowerError.includes('invalid') || lowerError.includes('unexpected')) {
      return MCP_ERROR_PATTERNS.INVALID_RESPONSE;
    }
  }

  // Bash errors
  if (category === ErrorCategory.BASH_COMMAND) {
    if (lowerError.includes('command not found') || lowerError.includes('not found')) {
      return BASH_ERROR_PATTERNS.COMMAND_NOT_FOUND;
    }
    if (lowerError.includes('security') || lowerError.includes('blocked')) {
      return BASH_ERROR_PATTERNS.SECURITY_VIOLATION;
    }
    if (lowerError.includes('exit code 1') || errorMessage.includes('code 1')) {
      return BASH_ERROR_PATTERNS.EXIT_CODE_1;
    }
  }

  return null;
}

/**
 * Get emoji icon for error category
 */
function getErrorIcon(category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.FILE_OPERATION:
      return '📁';
    case ErrorCategory.BASH_COMMAND:
      return '⚡';
    case ErrorCategory.MCP_CONNECTION:
      return '🔌';
    case ErrorCategory.API_ERROR:
    case ErrorCategory.AUTHENTICATION:
      return '🔑';
    case ErrorCategory.RATE_LIMIT:
      return '⏱️';
    case ErrorCategory.NETWORK:
      return '🌐';
    case ErrorCategory.CONFIGURATION:
      return '⚙️';
    case ErrorCategory.VALIDATION:
      return '✅';
    case ErrorCategory.TIMEOUT:
      return '⌛';
    default:
      return '❌';
  }
}

/**
 * Create a user-friendly error for common scenarios
 */
export function createFriendlyError(
  category: ErrorCategory,
  operation: string,
  error: unknown,
  options?: {
    filePath?: string;
    details?: string;
  }
): string {
  // Extract error message and code
  let errorMessage: string;
  let errorCode: string | undefined;
  let statusCode: number | undefined;

  if (error instanceof Error) {
    errorMessage = error.message;
    // Try to extract error code from Error
    const err = error as any;
    errorCode = err.code;
    statusCode = err.statusCode || err.status;
  } else if (typeof error === 'object' && error !== null) {
    const err = error as any;
    errorMessage = err.message || err.error?.message || JSON.stringify(error);
    errorCode = err.code || err.error?.code;
    statusCode = err.status || err.statusCode || err.error?.status;
  } else {
    errorMessage = String(error);
  }

  return formatEnhancedError(category, operation, errorMessage, {
    ...options,
    errorCode,
    statusCode,
  });
}

/**
 * Quick helper functions for common error scenarios
 */
export const FriendlyErrors = {
  fileNotFound: (filePath: string) =>
    formatEnhancedError(
      ErrorCategory.FILE_OPERATION,
      'Read file',
      'ENOENT',
      { filePath }
    ),

  permissionDenied: (filePath: string) =>
    formatEnhancedError(
      ErrorCategory.FILE_OPERATION,
      'Access file',
      'EACCES',
      { filePath }
    ),

  apiKeyInvalid: () =>
    formatEnhancedError(
      ErrorCategory.AUTHENTICATION,
      'API request',
      'Invalid API key',
      { statusCode: 401 }
    ),

  rateLimitExceeded: () =>
    formatEnhancedError(
      ErrorCategory.RATE_LIMIT,
      'API request',
      'Rate limit exceeded',
      { statusCode: 429 }
    ),

  mcpConnectionFailed: (serverName: string) =>
    formatEnhancedError(
      ErrorCategory.MCP_CONNECTION,
      `Connect to ${serverName}`,
      'Connection failed',
      { details: `MCP server "${serverName}" is not responding` }
    ),

  commandNotFound: (command: string) =>
    formatEnhancedError(
      ErrorCategory.BASH_COMMAND,
      `Execute command`,
      'command not found',
      { details: `Command "${command}" is not available` }
    ),
};
