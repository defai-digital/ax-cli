/**
 * Provider-Specific MCP Configuration Loader
 *
 * Loads MCP configurations from provider-specific directories following
 * Claude Code best practices:
 *
 * Priority (highest to lowest):
 * 1. .ax-glm/.mcp.json or .ax-grok/.mcp.json (Claude Code format - recommended)
 * 2. .ax-glm/mcp-config.json or .ax-grok/mcp-config.json (legacy format)
 *
 * Claude Code Format (.mcp.json):
 * ```json
 * {
 *   "mcpServers": {
 *     "serverName": {
 *       "command": "...",
 *       "args": [...],
 *       "env": {...}
 *     }
 *   }
 * }
 * ```
 *
 * This ensures that when both ax-glm and ax-grok are installed,
 * they maintain separate MCP configurations without conflicts.
 */

import fs from 'fs';
import path from 'path';
import { getActiveConfigPaths, getActiveProvider } from '../provider/config.js';
import type { MCPServerConfig, MCPTransportConfig } from '../schemas/settings-schemas.js';
import { extractErrorMessage } from '../utils/error-handler.js';

/**
 * Claude Code MCP format (.mcp.json)
 * This is the recommended format, same as Claude Code
 */
export interface ClaudeCodeMCPConfig {
  mcpServers?: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    disabled?: boolean;
  }>;
}

/**
 * Legacy provider-specific MCP configuration format
 * This is the format used in .ax-glm/mcp-config.json and .ax-grok/mcp-config.json
 */
export interface LegacyProviderMCPConfig {
  mcp?: {
    /** Whether MCP is enabled for this provider */
    enabled?: boolean;
    /** Command to start the MCP server */
    serverCommand?: string;
    /** Arguments for the MCP server command */
    serverArgs?: string[];
    /** Whether to auto-connect on startup */
    autoConnect?: boolean;
    /** Connection timeout in milliseconds */
    timeout?: number;
    /** Environment variables for the MCP server */
    env?: Record<string, string>;
  };
  provider?: {
    /** Provider name (e.g., 'glm', 'grok') */
    name?: string;
    /** Environment variable for API key */
    apiKeyEnv?: string;
    /** Default model */
    defaultModel?: string;
  };
  integration?: {
    /** Use AutomatosX memory system */
    useMemory?: boolean;
    /** Use agent context for enhanced prompts */
    useAgentContext?: boolean;
    /** Save responses to memory */
    saveResponsesToMemory?: boolean;
  };
}

/**
 * Result of loading provider-specific MCP config
 */
export interface ProviderMCPLoadResult {
  /** Whether config was found */
  found: boolean;
  /** Path to config file */
  configPath?: string;
  /** Format of the config file */
  format?: 'claude-code' | 'legacy';
  /** Converted MCPServerConfigs (if found and valid) */
  serverConfigs: MCPServerConfig[];
  /** Error message if loading failed */
  error?: string;
  /** Warnings during loading */
  warnings: string[];
}

/**
 * Get the path to the Claude Code format MCP config file (.mcp.json)
 */
export function getClaudeCodeMCPConfigPath(projectRoot?: string): string {
  const configPaths = getActiveConfigPaths();
  const root = projectRoot || process.cwd();
  return path.join(root, configPaths.DIR_NAME, '.mcp.json');
}

/**
 * Get the path to the legacy MCP config file (mcp-config.json)
 */
export function getLegacyMCPConfigPath(projectRoot?: string): string {
  const configPaths = getActiveConfigPaths();
  const root = projectRoot || process.cwd();
  return path.join(root, configPaths.DIR_NAME, 'mcp-config.json');
}

/**
 * Check if provider-specific MCP config exists (either format)
 */
export function providerMCPConfigExists(projectRoot?: string): boolean {
  return fs.existsSync(getClaudeCodeMCPConfigPath(projectRoot)) ||
         fs.existsSync(getLegacyMCPConfigPath(projectRoot));
}

/**
 * Load provider-specific MCP configuration
 *
 * This function:
 * 1. First tries to load Claude Code format (.mcp.json) - recommended
 * 2. Falls back to legacy format (mcp-config.json)
 * 3. Converts to MCPServerConfig[] format
 * 4. Returns the configs or error information
 */
export function loadProviderMCPConfig(projectRoot?: string): ProviderMCPLoadResult {
  const warnings: string[] = [];
  const claudeCodePath = getClaudeCodeMCPConfigPath(projectRoot);
  const legacyPath = getLegacyMCPConfigPath(projectRoot);

  // Try Claude Code format first (.mcp.json)
  if (fs.existsSync(claudeCodePath)) {
    try {
      const raw = fs.readFileSync(claudeCodePath, 'utf-8');
      const config = JSON.parse(raw) as ClaudeCodeMCPConfig;
      const serverConfigs = convertClaudeCodeFormat(config);

      return {
        found: true,
        configPath: claudeCodePath,
        format: 'claude-code',
        serverConfigs,
        warnings,
      };
    } catch (error) {
      return {
        found: true,
        configPath: claudeCodePath,
        format: 'claude-code',
        serverConfigs: [],
        error: `Failed to parse .mcp.json: ${extractErrorMessage(error)}`,
        warnings,
      };
    }
  }

  // Fall back to legacy format (mcp-config.json)
  if (fs.existsSync(legacyPath)) {
    warnings.push(
      `Using legacy mcp-config.json format. Consider migrating to .mcp.json (Claude Code format)`
    );

    try {
      const raw = fs.readFileSync(legacyPath, 'utf-8');
      const config = JSON.parse(raw) as LegacyProviderMCPConfig;
      const serverConfigs = convertLegacyFormat(config);

      return {
        found: true,
        configPath: legacyPath,
        format: 'legacy',
        serverConfigs,
        warnings,
      };
    } catch (error) {
      return {
        found: true,
        configPath: legacyPath,
        format: 'legacy',
        serverConfigs: [],
        error: `Failed to parse mcp-config.json: ${extractErrorMessage(error)}`,
        warnings,
      };
    }
  }

  // No config found
  return {
    found: false,
    serverConfigs: [],
    warnings,
  };
}

/**
 * Convert Claude Code format (.mcp.json) to MCPServerConfig[]
 */
function convertClaudeCodeFormat(config: ClaudeCodeMCPConfig): MCPServerConfig[] {
  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    return [];
  }

  const servers: MCPServerConfig[] = [];

  for (const [name, serverDef] of Object.entries(config.mcpServers)) {
    if (serverDef.disabled) {
      continue;
    }

    // Build environment variables
    const env: Record<string, string> = {
      AUTOMATOSX_PROJECT_DIR: process.cwd(),
      ...(serverDef.env || {}),
    };

    const transport: MCPTransportConfig = {
      type: 'stdio',
      command: serverDef.command,
      args: serverDef.args || [],
      env,
    };

    servers.push({
      name,
      enabled: true,
      transport,
      // Default timeout for provider MCP servers
      initTimeout: 30000,
      // Suppress verbose output by default
      quiet: true,
    });
  }

  return servers;
}

/**
 * Convert legacy format (mcp-config.json) to MCPServerConfig[]
 */
function convertLegacyFormat(config: LegacyProviderMCPConfig): MCPServerConfig[] {
  const mcp = config.mcp;

  if (!mcp?.serverCommand) {
    return [];
  }

  // Check if MCP is disabled
  if (mcp.enabled === false) {
    return [];
  }

  const provider = getActiveProvider();

  // Build the server name based on provider
  // e.g., "automatosx-glm" or "automatosx-grok"
  const serverName = `automatosx-${provider.name}`;

  // Build environment variables
  const env: Record<string, string> = {
    AUTOMATOSX_PROJECT_DIR: process.cwd(),
    ...(mcp.env || {}),
  };

  // Add provider-specific env vars from the config
  if (config.provider?.apiKeyEnv) {
    env.AUTOMATOSX_API_KEY_ENV = config.provider.apiKeyEnv;
  }

  // Add integration settings as env vars
  if (config.integration) {
    if (config.integration.useMemory !== undefined) {
      env.AUTOMATOSX_USE_MEMORY = String(config.integration.useMemory);
    }
    if (config.integration.useAgentContext !== undefined) {
      env.AUTOMATOSX_USE_AGENT_CONTEXT = String(config.integration.useAgentContext);
    }
    if (config.integration.saveResponsesToMemory !== undefined) {
      env.AUTOMATOSX_SAVE_RESPONSES = String(config.integration.saveResponsesToMemory);
    }
  }

  const transport: MCPTransportConfig = {
    type: 'stdio',
    command: mcp.serverCommand,
    args: mcp.serverArgs || [],
    env,
  };

  return [{
    name: serverName,
    enabled: true,
    transport,
    initTimeout: mcp.timeout || 30000,
    // Suppress verbose output by default
    quiet: true,
  }];
}

/**
 * Get provider MCP servers ready to be merged with other sources
 */
export function getProviderMCPServers(projectRoot?: string): MCPServerConfig[] {
  const result = loadProviderMCPConfig(projectRoot);
  return result.serverConfigs;
}
