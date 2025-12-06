/**
 * MCP Server Configuration Validation (Phase 4)
 *
 * Provides pre-flight checks to validate MCP server configurations
 * before attempting connection, improving error messages and UX.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import type { MCPServerConfig } from '../schemas/settings-schemas.js';
import { getTemplate } from './templates.js';
import { getAuditLogger, AuditCategory } from '../utils/audit-logger.js';

const execFileAsync = promisify(execFile);

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  field?: string;
}

/**
 * Safe commands whitelist for MCP stdio transport
 * Only these commands are allowed to prevent command injection
 */
const SAFE_MCP_COMMANDS = [
  // Node.js package managers
  'node',
  'npm',
  'npx',
  'bun',
  'deno',
  'pnpm',
  'yarn',
  // Python
  'python',
  'python3',
  'pip',
  'pip3',
  'uvx',
  // Docker
  'docker',
  // Common shell commands (for legitimate MCP servers)
  'bash',
  'sh',
  'zsh',
  // Full paths allowed (validated separately)
] as const;

type SafeMCPCommand = typeof SAFE_MCP_COMMANDS[number];

/**
 * Validate an MCP server configuration with pre-flight checks
 */
export async function validateServerConfig(config: MCPServerConfig): Promise<ValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Validate transport configuration exists
  if (!config.transport) {
    errors.push('Transport configuration is required');
    return { valid: false, warnings, errors };
  }

  // 2. Transport-specific validation
  switch (config.transport.type) {
    case 'stdio':
      await validateStdioTransport(config, errors, warnings);
      break;
    case 'http':
    case 'sse':
      await validateHttpTransport(config, errors, warnings);
      break;
    case 'streamable_http':
      await validateStreamableHttpTransport(config, errors, warnings);
      break;
  }

  // 3. Validate required environment variables from template
  validateRequiredEnvVars(config, errors, warnings);

  // 4. Validate server name
  if (!config.name || config.name.trim() === '') {
    errors.push('Server name cannot be empty');
  } else if (!/^[a-z0-9-_]+$/i.test(config.name)) {
    warnings.push(`Server name "${config.name}" contains special characters. Recommended: alphanumeric, hyphens, underscores only`);
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Validate command against whitelist
 * Prevents command injection by only allowing safe commands
 */
function validateCommandWhitelist(command: string): { valid: boolean; error?: string } {
  // BUG FIX: Handle empty or whitespace-only commands
  const trimmedCommand = command.trim();
  if (!trimmedCommand) {
    return {
      valid: false,
      error: 'Command cannot be empty'
    };
  }

  // Allow full paths (they will be validated separately)
  if (trimmedCommand.includes('/') || trimmedCommand.includes('\\')) {
    // Validate path doesn't contain shell metacharacters
    const dangerousChars = /[;&|`$()<>]/;
    if (dangerousChars.test(trimmedCommand)) {
      return {
        valid: false,
        error: `Command path contains dangerous characters: ${trimmedCommand}`
      };
    }
    return { valid: true };
  }

  // Check against whitelist
  // BUG FIX: Use trimmed command and handle empty result from split
  const baseCommand = trimmedCommand.split(/\s+/)[0] || '';
  if (!baseCommand || !SAFE_MCP_COMMANDS.includes(baseCommand as SafeMCPCommand)) {
    return {
      valid: false,
      error: `Command "${baseCommand || '(empty)'}" is not in the safe commands whitelist. ` +
             `Allowed: ${SAFE_MCP_COMMANDS.join(', ')}. ` +
             `Use full path for custom commands.`
    };
  }

  return { valid: true };
}

/**
 * Validate command arguments for injection attempts
 */
function validateCommandArgs(args: string[]): { valid: boolean; error?: string } {
  const dangerousPatterns = /[;&|`$()<>]/;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Check for shell metacharacters
    if (dangerousPatterns.test(arg)) {
      return {
        valid: false,
        error: `Argument ${i} contains dangerous shell metacharacters: "${arg}"`
      };
    }

    // Check for null bytes
    if (arg.includes('\0')) {
      return {
        valid: false,
        error: `Argument ${i} contains null byte`
      };
    }
  }

  return { valid: true };
}

/**
 * Validate stdio transport configuration
 */
async function validateStdioTransport(
  config: MCPServerConfig,
  errors: string[],
  warnings: string[]
): Promise<void> {
  if (!config.transport || config.transport.type !== 'stdio') return;

  const { command, args } = config.transport;

  // Check if command exists
  if (!command || command.trim() === '') {
    errors.push('Command is required for stdio transport');
    return;
  }

  // SECURITY: Validate command against whitelist (REQ-SEC-004)
  const whitelistResult = validateCommandWhitelist(command);
  if (!whitelistResult.valid) {
    // REQ-SEC-008: Audit log command injection attempt
    const auditLogger = getAuditLogger();
    auditLogger.logCritical({
      category: AuditCategory.COMMAND_EXECUTION,
      action: 'mcp_command_injection_attempt',
      resource: config.name,
      outcome: 'failure',
      error: whitelistResult.error,
      details: { command, configName: config.name },
    });

    errors.push(whitelistResult.error || 'Command not allowed');
    return; // Don't continue if command is not allowed
  }

  // Validate args
  if (args && !Array.isArray(args)) {
    errors.push('Arguments must be an array');
    return;
  }

  // SECURITY: Validate arguments for injection attempts (REQ-SEC-004)
  if (args && args.length > 0) {
    const argsResult = validateCommandArgs(args);
    if (!argsResult.valid) {
      errors.push(argsResult.error || 'Invalid arguments');
      return;
    }
  }

  // Commands that require at least one argument (script/module to run)
  // Without args, these commands start a REPL and wait for input, causing MCP timeout
  const commandsRequiringArgs = ['node', 'python', 'python3', 'deno', 'bun'];
  const baseCommand = command.split(/\s+/)[0].split('/').pop() || command;

  if (commandsRequiringArgs.includes(baseCommand) && (!args || args.length === 0)) {
    errors.push(
      `Command "${command}" requires at least one argument (e.g., a script file). ` +
      `Empty args will cause the process to hang waiting for input.`
    );
    return;
  }

  // Check if command is executable (after whitelist check)
  const commandExists = await checkCommandExists(command);
  if (!commandExists) {
    warnings.push(`Command "${command}" not found in PATH. Please install it or provide full path.`);
  }

  // Check for common npm package patterns
  if (command === 'npx' && args && args.length > 0) {
    const packageName = args[0];
    if (packageName.startsWith('@modelcontextprotocol/')) {
      // This is an official MCP server package - good!
      warnings.push(`Ensure "${packageName}" is installed: npm install -g ${packageName}`);
    }
  }
}

/**
 * Validate HTTP/SSE transport configuration
 */
async function validateHttpTransport(
  config: MCPServerConfig,
  errors: string[],
  warnings: string[]
): Promise<void> {
  if (!config.transport || (config.transport.type !== 'http' && config.transport.type !== 'sse')) return;

  const { url } = config.transport;

  // Check if URL exists
  if (!url || url.trim() === '') {
    errors.push(`URL is required for ${config.transport.type} transport`);
    return;
  }

  // Validate URL format
  try {
    const parsedUrl = new URL(url);

    // Check protocol
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      errors.push(`Invalid protocol "${parsedUrl.protocol}". Expected http: or https:`);
    }

    // Warn about http (not https)
    if (parsedUrl.protocol === 'http:' && !parsedUrl.hostname.includes('localhost') && !parsedUrl.hostname.includes('127.0.0.1')) {
      warnings.push('Using http:// instead of https:// for remote server. Consider using encrypted connection.');
    }

    // Check if URL is accessible (non-blocking)
    const accessible = await checkUrlAccessible(url);
    if (!accessible) {
      warnings.push(`Unable to reach "${url}". Server may not be running or URL may be incorrect.`);
    }
  } catch {
    errors.push(`Invalid URL format: ${url}`);
  }
}

/**
 * Validate streamable HTTP transport configuration
 */
async function validateStreamableHttpTransport(
  config: MCPServerConfig,
  errors: string[],
  _warnings: string[]
): Promise<void> {
  if (!config.transport || config.transport.type !== 'streamable_http') return;

  const { url } = config.transport;

  if (!url || url.trim() === '') {
    errors.push('URL is required for streamable_http transport');
    return;
  }

  try {
    new URL(url);
  } catch {
    errors.push(`Invalid URL format: ${url}`);
  }
}

/**
 * Validate required environment variables based on template
 */
function validateRequiredEnvVars(
  config: MCPServerConfig,
  errors: string[],
  _warnings: string[]
): void {
  // Try to get template for this server
  const template = getTemplate(config.name);
  if (!template || !template.requiredEnv) return;

  // Check each required environment variable
  for (const envVar of template.requiredEnv) {
    const hasInConfig = config.transport?.env && envVar.name in config.transport.env;
    const hasInProcess = envVar.name in process.env;

    if (!hasInConfig && !hasInProcess) {
      errors.push(`Missing required environment variable: ${envVar.name} - ${envVar.description}`);
    }
  }
}

/**
 * Check if a command exists in PATH
 * Uses execFile to prevent command injection vulnerabilities
 */
async function checkCommandExists(command: string): Promise<boolean> {
  try {
    // Handle full paths
    if (command.includes('/') || command.includes('\\')) {
      return true; // Assume full paths are valid
    }

    // Check if command exists in PATH using execFile (prevents command injection)
    const checkCommand = process.platform === 'win32' ? 'where' : 'which';

    await execFileAsync(checkCommand, [command]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a URL is accessible (with timeout)
 */
async function checkUrlAccessible(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    });
    return response.ok || response.status === 404; // 404 means server exists
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push('❌ Validation Failed\n');
    result.errors.forEach(error => {
      lines.push(`  • ${error}`);
    });
  }

  if (result.warnings.length > 0) {
    lines.push(result.errors.length > 0 ? '\n⚠️  Warnings\n' : '⚠️  Warnings\n');
    result.warnings.forEach(warning => {
      lines.push(`  • ${warning}`);
    });
  }

  if (result.valid && result.warnings.length === 0) {
    lines.push('✅ Configuration is valid');
  }

  return lines.join('\n');
}

/**
 * Get the list of safe MCP commands (for documentation/testing)
 */
export function getSafeMCPCommands(): readonly string[] {
  return SAFE_MCP_COMMANDS;
}
