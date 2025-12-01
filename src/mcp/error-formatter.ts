/**
 * User-Friendly MCP Error Formatter
 *
 * Transforms cryptic Zod validation errors and technical errors into
 * actionable, user-friendly messages with helpful hints and documentation links.
 */

import type { z } from 'zod';
import chalk from 'chalk';

export interface FormattedError {
  /** Main error title */
  title: string;
  /** Error details */
  details: string[];
  /** Helpful hints */
  hints: string[];
  /** Documentation link */
  docLink?: string;
  /** Example correct configuration */
  example?: string;
}

/**
 * Format a Zod validation error for MCP server config
 */
export function formatMCPConfigError(
  serverName: string,
  error: z.ZodError,
  originalConfig?: any
): string {
  const lines: string[] = [];

  lines.push(chalk.red('╭─ MCP Configuration Error ─────────────────────╮'));
  lines.push(chalk.red(`│ Server: ${chalk.bold(serverName)}`));
  lines.push(chalk.red('│'));

  // Group errors by field
  const errorsByField = new Map<string, string[]>();

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join('.') : 'config';
    const message = issue.message;

    let fieldErrors = errorsByField.get(field);
    if (!fieldErrors) {
      fieldErrors = [];
      errorsByField.set(field, fieldErrors);
    }

    fieldErrors.push(message);
  }

  // Display errors
  lines.push(chalk.red('│ Errors:'));
  for (const [field, messages] of errorsByField.entries()) {
    lines.push(chalk.red(`│   ❌ Field "${chalk.yellow(field)}":`));
    messages.forEach(msg => {
      lines.push(chalk.red(`│      ${msg}`));
    });

    // Add helpful hints based on field
    const hints = getHintsForField(field, originalConfig);
    if (hints.length > 0) {
      lines.push(chalk.red(`│      ${chalk.cyan('Hint:')} ${hints[0]}`));
    }
  }

  lines.push(chalk.red('│'));

  // Add example
  const example = getExampleConfig(errorsByField, originalConfig);
  if (example) {
    lines.push(chalk.red('│ Example correct config:'));
    example.split('\n').forEach(line => {
      lines.push(chalk.red(`│   ${chalk.green(line)}`));
    });
    lines.push(chalk.red('│'));
  }

  // Add documentation link
  lines.push(chalk.red(`│ ${chalk.blue('📖 Documentation:')} https://docs.ax-cli.dev/mcp/configuration`));
  lines.push(chalk.red('╰────────────────────────────────────────────────╯'));

  return lines.join('\n');
}

/**
 * Get helpful hints based on error field
 */
function getHintsForField(field: string, originalConfig?: any): string[] {
  const hints: string[] = [];

  switch (field) {
    case 'transport':
      hints.push('Add "transport": { "type": "stdio", "command": "...", "args": [...] }');
      if (originalConfig?.command) {
        hints.push('Legacy format detected. Your "command" field should be inside "transport".');
      }
      break;

    case 'transport.type':
      hints.push('Valid types: "stdio", "http", "sse", "streamable_http"');
      break;

    case 'transport.command':
      hints.push('Command is required for stdio transport');
      hints.push('Example: "npx", "node", "python", etc.');
      break;

    case 'transport.url':
      hints.push('URL is required for http/sse transports');
      hints.push('Example: "https://api.example.com" or "http://localhost:3000"');
      break;

    case 'transport.args':
      hints.push('Args should be an array of strings');
      hints.push('Example: ["@modelcontextprotocol/server-github"]');
      break;

    case 'name':
      hints.push('Server name is required and should be alphanumeric with hyphens/underscores');
      hints.push('Example: "github", "my-server", "api_v2"');
      break;

    default:
      if (field.startsWith('transport.')) {
        hints.push(`Check the ${field.split('.')[1]} field in your transport configuration`);
      }
  }

  return hints;
}

/**
 * Generate example config based on errors
 */
function getExampleConfig(
  errorsByField: Map<string, string[]>,
  originalConfig?: any
): string | null {
  const hasTransportError = Array.from(errorsByField.keys()).some(f =>
    f === 'transport' || f.startsWith('transport.')
  );

  if (!hasTransportError) {
    return null;
  }

  // Check if it's likely a stdio config
  const isStdio = originalConfig?.command || errorsByField.has('transport.command');

  if (isStdio) {
    return `{
  "name": "my-server",
  "transport": {
    "type": "stdio",
    "command": "npx",
    "args": ["@modelcontextprotocol/server-example"],
    "env": { "API_KEY": "..." }
  }
}`;
  }

  // Default to HTTP example
  return `{
  "name": "my-server",
  "transport": {
    "type": "http",
    "url": "https://api.example.com",
    "headers": { "Authorization": "Bearer ..." }
  }
}`;
}

/**
 * Format a connection error
 */
export function formatConnectionError(
  serverName: string,
  error: Error,
  transportType?: string
): string {
  const lines: string[] = [];

  lines.push(chalk.red('╭─ MCP Connection Error ────────────────────────╮'));
  lines.push(chalk.red(`│ Server: ${chalk.bold(serverName)}`));
  if (transportType) {
    lines.push(chalk.red(`│ Transport: ${transportType}`));
  }
  lines.push(chalk.red('│'));
  lines.push(chalk.red(`│ Error: ${error.message}`));
  lines.push(chalk.red('│'));

  // Add hints based on error message
  const hints = getConnectionErrorHints(error, transportType);
  if (hints.length > 0) {
    lines.push(chalk.red('│ Troubleshooting:'));
    hints.forEach(hint => {
      lines.push(chalk.red(`│   • ${hint}`));
    });
    lines.push(chalk.red('│'));
  }

  lines.push(chalk.red(`│ ${chalk.blue('🔧 Diagnostics:')} ax-cli mcp test ${serverName}`));
  lines.push(chalk.red('╰────────────────────────────────────────────────╯'));

  return lines.join('\n');
}

/**
 * Comprehensive error code to remediation mapping
 * Maps error codes/patterns to specific troubleshooting steps
 */
const ERROR_REMEDIATION: Record<string, { title: string; hints: string[]; command?: string }> = {
  // Process/Command errors
  'enoent': {
    title: 'Command not found',
    hints: [
      'The MCP server command is not installed or not in PATH',
      'Install the package: npm install -g <package-name>',
      'Or use npx: npx <package-name>',
      'Verify installation: which <command> or command -v <command>'
    ],
    command: 'npm list -g --depth=0'
  },
  'eacces': {
    title: 'Permission denied',
    hints: [
      'The command or file lacks execute permissions',
      'Fix permissions: chmod +x <file>',
      'Or install globally with proper permissions',
      'Avoid using sudo with npm - fix npm permissions instead'
    ],
    command: 'npm config set prefix ~/.npm-global'
  },
  'spawn': {
    title: 'Failed to spawn process',
    hints: [
      'The command could not be started',
      'Verify the command path is correct',
      'Check if the binary is compatible with your system',
      'Try running the command directly in terminal'
    ]
  },

  // Network errors
  'econnrefused': {
    title: 'Connection refused',
    hints: [
      'The MCP server is not running or not listening',
      'Start the server first, then retry',
      'Check if the port is correct',
      'Verify no firewall is blocking the connection'
    ],
    command: 'lsof -i :<port> # Check if port is in use'
  },
  'enotfound': {
    title: 'Host not found',
    hints: [
      'The hostname could not be resolved',
      'Check if the URL is spelled correctly',
      'Verify your internet connection',
      'Try using IP address instead of hostname'
    ],
    command: 'nslookup <hostname>'
  },
  'econnreset': {
    title: 'Connection reset',
    hints: [
      'The server closed the connection unexpectedly',
      'The server may have crashed or restarted',
      'Check server logs for errors',
      'Retry the connection'
    ]
  },
  'etimedout': {
    title: 'Connection timed out',
    hints: [
      'The server took too long to respond',
      'Check if the server is overloaded',
      'Verify network connectivity',
      'Increase timeout in configuration if needed'
    ]
  },
  'esockettimedout': {
    title: 'Socket timed out',
    hints: [
      'The connection was established but no response received',
      'The server may be hanging or processing slowly',
      'For stdio: ensure command has proper args (not a REPL)',
      'Check if the MCP server is compatible with this client'
    ]
  },

  // SSL/TLS errors
  'cert_': {
    title: 'SSL Certificate error',
    hints: [
      'The server\'s SSL certificate is invalid or expired',
      'For development: you can skip verification (not recommended)',
      'For production: ensure valid certificate is installed',
      'Check certificate chain: openssl s_client -connect <host>:443'
    ]
  },
  'unable_to_verify': {
    title: 'SSL verification failed',
    hints: [
      'Cannot verify the server\'s SSL certificate',
      'The certificate may be self-signed',
      'CA certificates may need to be updated',
      'Set NODE_TLS_REJECT_UNAUTHORIZED=0 for development only'
    ]
  },

  // Authentication errors
  '401': {
    title: 'Authentication failed',
    hints: [
      'The API key or token is invalid or expired',
      'Check environment variable is set: echo $<VAR_NAME>',
      'Regenerate the API key if expired',
      'Verify the token has required permissions'
    ]
  },
  '403': {
    title: 'Access forbidden',
    hints: [
      'You don\'t have permission to access this resource',
      'Check if your API key has the required scopes',
      'Verify the account has access to this feature',
      'Contact the service provider for access'
    ]
  },

  // Server errors
  '500': {
    title: 'Server error',
    hints: [
      'The MCP server encountered an internal error',
      'Check server logs for details',
      'Try again later',
      'Report the issue to the server maintainer'
    ]
  },
  '502': {
    title: 'Bad gateway',
    hints: [
      'The server received an invalid response from upstream',
      'The upstream server may be down',
      'Try again later',
      'Check if there are known outages'
    ]
  },
  '503': {
    title: 'Service unavailable',
    hints: [
      'The server is temporarily unavailable',
      'It may be overloaded or under maintenance',
      'Wait a few minutes and retry',
      'Check service status page'
    ]
  },

  // MCP-specific errors
  'initialization failed': {
    title: 'MCP initialization failed',
    hints: [
      'The MCP server failed to initialize properly',
      'Check if all required environment variables are set',
      'Verify the server version is compatible',
      'Try running: ax-cli mcp test <server-name>'
    ]
  },
  'protocol error': {
    title: 'MCP protocol error',
    hints: [
      'Invalid message format or unsupported protocol version',
      'Ensure the server implements MCP protocol correctly',
      'Check for server updates',
      'Verify client and server versions are compatible'
    ]
  },
  'tool not found': {
    title: 'MCP tool not found',
    hints: [
      'The requested tool is not available on the server',
      'List available tools: ax-cli mcp tools <server-name>',
      'The server may need to be restarted',
      'Check if the tool requires additional configuration'
    ]
  }
};

/**
 * Get hints for connection errors
 * Enhanced with comprehensive error code mapping
 */
function getConnectionErrorHints(error: Error, transportType?: string): string[] {
  const hints: string[] = [];
  const message = error.message.toLowerCase();
  const errorCode = (error as any).code?.toLowerCase() || '';

  // Check for specific error codes first
  for (const [pattern, remediation] of Object.entries(ERROR_REMEDIATION)) {
    if (message.includes(pattern) || errorCode.includes(pattern)) {
      hints.push(`${chalk.bold(remediation.title)}`);
      hints.push(...remediation.hints);
      if (remediation.command) {
        hints.push(`Debug command: ${chalk.cyan(remediation.command)}`);
      }
      break;
    }
  }

  // If no specific match, provide transport-specific hints
  if (hints.length === 0) {
    if (transportType === 'stdio') {
      hints.push('For stdio transport:');
      hints.push('• Verify command is installed: which <command>');
      hints.push('• Ensure args include a script path (not just the runtime)');
      hints.push('• Example: ["@modelcontextprotocol/server-github"]');
      hints.push('• Commands like "node" without args start a REPL and hang');
    } else if (transportType === 'http' || transportType === 'sse') {
      hints.push('For HTTP/SSE transport:');
      hints.push('• Verify server is running: curl <url>/health');
      hints.push('• Check URL is accessible from your network');
      hints.push('• Verify SSL certificate if using HTTPS');
      hints.push('• Check authentication headers are correct');
    } else {
      hints.push('General troubleshooting:');
      hints.push('• Check the server logs for more details');
      hints.push('• Verify all required environment variables are set');
      hints.push('• Try running ax-cli mcp test <server-name>');
    }
  }

  // Add environment variable hints if relevant
  if (message.includes('api_key') || message.includes('token') || message.includes('secret')) {
    hints.push('');
    hints.push('Environment variable tips:');
    hints.push('• Set in shell: export VAR_NAME=value');
    hints.push('• Or in .env file in project root');
    hints.push('• Verify: echo $VAR_NAME');
  }

  return hints;
}

/**
 * Format a validation error (generic)
 */
export function formatValidationError(
  context: string,
  issues: Array<{ field: string; message: string }>
): string {
  const lines: string[] = [];

  lines.push(chalk.yellow('╭─ Validation Error ────────────────────────────╮'));
  lines.push(chalk.yellow(`│ Context: ${context}`));
  lines.push(chalk.yellow('│'));
  lines.push(chalk.yellow('│ Issues:'));

  issues.forEach(({ field, message }) => {
    lines.push(chalk.yellow(`│   ❌ ${field}: ${message}`));
  });

  lines.push(chalk.yellow('╰────────────────────────────────────────────────╯'));

  return lines.join('\n');
}

/**
 * Format a message with icon and optional details
 */
function formatMessage(
  icon: string,
  colorFn: (text: string) => string,
  message: string,
  details?: string[]
): string {
  const lines = [colorFn(`${icon} ${message}`)];
  details?.forEach(detail => lines.push(chalk.dim(`   ${detail}`)));
  return lines.join('\n');
}

/** Format a warning message */
export const formatWarning = (message: string, details?: string[]) =>
  formatMessage('⚠️ ', chalk.yellow, message, details);

/** Format a success message */
export const formatSuccess = (message: string, details?: string[]) =>
  formatMessage('✅', chalk.green, message, details);

/** Format info message */
export const formatInfo = (message: string, details?: string[]) =>
  formatMessage('ℹ️ ', chalk.blue, message, details);
