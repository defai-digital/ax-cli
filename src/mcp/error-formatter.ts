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

    if (!errorsByField.has(field)) {
      errorsByField.set(field, []);
    }

    errorsByField.get(field)!.push(message);
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
 * Get hints for connection errors
 */
function getConnectionErrorHints(error: Error, transportType?: string): string[] {
  const hints: string[] = [];
  const message = error.message.toLowerCase();

  if (message.includes('command not found') || message.includes('enoent')) {
    hints.push('Command not found. Check if the command is installed and in PATH.');
    hints.push('Try running the command manually to verify it works.');
  } else if (message.includes('timeout') || message.includes('timed out')) {
    hints.push('Connection timed out. The server may have hung or failed to respond.');
    hints.push('For stdio commands (node, python, etc.), ensure args are provided.');
    hints.push('Commands without args start a REPL and wait for input, causing timeout.');
    hints.push('Verify the URL/command is correct and accessible.');
  } else if (message.includes('econnrefused') || message.includes('connection refused')) {
    hints.push('Connection refused. Server may not be running.');
    hints.push('Check if the server is listening on the correct port.');
  } else if (message.includes('unauthorized') || message.includes('401')) {
    hints.push('Authentication failed. Check your API keys/tokens.');
    hints.push('Verify credentials in environment variables or config.');
  } else if (message.includes('not found') || message.includes('404')) {
    hints.push('Endpoint not found. Check the URL path.');
    hints.push('Verify the server supports MCP protocol.');
  } else if (message.includes('permission denied') || message.includes('eacces')) {
    hints.push('Permission denied. Check file/command permissions.');
    hints.push('You may need to run with sudo or adjust permissions.');
  }

  // Transport-specific hints
  if (transportType === 'stdio' && hints.length === 0) {
    hints.push('Check if the command is installed: which <command>');
    hints.push('Verify the args are correct for your command.');
    hints.push('Node/Python/Deno/Bun require a script path in args.');
  } else if ((transportType === 'http' || transportType === 'sse') && hints.length === 0) {
    hints.push('Verify the server is running: curl <url>');
    hints.push('Check if the URL is accessible from your network.');
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
 * Format a warning message
 */
export function formatWarning(message: string, details?: string[]): string {
  const lines: string[] = [];

  lines.push(chalk.yellow(`⚠️  ${message}`));

  if (details && details.length > 0) {
    details.forEach(detail => {
      lines.push(chalk.dim(`   ${detail}`));
    });
  }

  return lines.join('\n');
}

/**
 * Format a success message
 */
export function formatSuccess(message: string, details?: string[]): string {
  const lines: string[] = [];

  lines.push(chalk.green(`✅ ${message}`));

  if (details && details.length > 0) {
    details.forEach(detail => {
      lines.push(chalk.dim(`   ${detail}`));
    });
  }

  return lines.join('\n');
}

/**
 * Format info message
 */
export function formatInfo(message: string, details?: string[]): string {
  const lines: string[] = [];

  lines.push(chalk.blue(`ℹ️  ${message}`));

  if (details && details.length > 0) {
    details.forEach(detail => {
      lines.push(chalk.dim(`   ${detail}`));
    });
  }

  return lines.join('\n');
}
