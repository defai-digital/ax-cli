/**
 * MCP Server Configuration Validation (Phase 4)
 *
 * Provides pre-flight checks to validate MCP server configurations
 * before attempting connection, improving error messages and UX.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { MCPServerConfig } from '../schemas/settings-schemas.js';
import { getTemplate } from './templates.js';

const execAsync = promisify(exec);

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

  // Check if command is executable
  const commandExists = await checkCommandExists(command);
  if (!commandExists) {
    errors.push(`Command "${command}" not found in PATH. Please install it or provide full path.`);
  }

  // Validate args
  if (args && !Array.isArray(args)) {
    errors.push('Arguments must be an array');
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
  } catch (error) {
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
 */
async function checkCommandExists(command: string): Promise<boolean> {
  try {
    // Handle full paths
    if (command.includes('/') || command.includes('\\')) {
      return true; // Assume full paths are valid
    }

    // Check if command exists in PATH
    const checkCommand = process.platform === 'win32'
      ? `where ${command}`
      : `which ${command}`;

    await execAsync(checkCommand);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a URL is accessible (with timeout)
 */
async function checkUrlAccessible(url: string): Promise<boolean> {
  try {
    // Use native fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    });

    clearTimeout(timeout);
    return response.ok || response.status === 404; // 404 is ok, means server exists
  } catch {
    return false;
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
