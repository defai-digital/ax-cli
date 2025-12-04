/**
 * User-Friendly MCP Error Formatter
 *
 * Transforms cryptic Zod validation errors and technical errors into
 * actionable, user-friendly messages with helpful hints and documentation links.
 */

import type { z } from 'zod';
import chalk from 'chalk';
import {
  matchErrorPattern,
  getTransportHints,
  getEnvVarHints
} from './error-remediation.js';

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
        // BUG FIX: Validate split result before accessing index to prevent undefined access
        const fieldParts = field.split('.');
        const subField = fieldParts.length > 1 ? fieldParts[1] : field;
        hints.push(`Check the ${subField} field in your transport configuration`);
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
 * Uses extracted error remediation module for pattern matching
 */
function getConnectionErrorHints(error: Error, transportType?: string): string[] {
  const hints: string[] = [];

  // Check for specific error codes first using extracted module
  const remediation = matchErrorPattern(error);
  if (remediation) {
    hints.push(`${chalk.bold(remediation.title)}`);
    hints.push(...remediation.hints);
    if (remediation.command) {
      hints.push(`Debug command: ${chalk.cyan(remediation.command)}`);
    }
  }

  // If no specific match, provide transport-specific hints
  if (hints.length === 0) {
    hints.push(...getTransportHints(transportType));
  }

  // Add environment variable hints if relevant
  hints.push(...getEnvVarHints(error.message));

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
