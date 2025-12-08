/**
 * AutomatosX MCP Auto-Discovery
 *
 * Automatically detects and enables AutomatosX MCP server when installed.
 * This provides seamless integration between ax-glm/ax-grok and AutomatosX.
 *
 * Design:
 * 1. Check if `automatosx` command exists in PATH
 * 2. If installed, automatically inject AutomatosX MCP server config
 * 3. User can override via .mcp.json or disable via settings
 *
 * This ensures that when users have both ax-glm/ax-grok and AutomatosX installed,
 * they get automatic integration without manual configuration.
 */

import { execSync } from 'child_process';
import type { MCPServerConfig, MCPTransportConfig } from '../schemas/settings-schemas.js';
import { getActiveProvider } from '../provider/config.js';

/**
 * Result of AutomatosX detection
 */
export interface AutomatosXDetectionResult {
  /** Whether AutomatosX is installed and available */
  installed: boolean;
  /** Path to the automatosx command (if found) */
  commandPath?: string;
  /** Version of AutomatosX (if detected) */
  version?: string;
  /** Whether MCP server capability is available */
  hasMCPServer: boolean;
  /** Error message if detection failed */
  error?: string;
}

/**
 * Options for auto-discovery
 */
export interface AutoDiscoveryOptions {
  /** Skip auto-discovery entirely */
  disabled?: boolean;
  /** Custom command path for automatosx */
  customCommandPath?: string;
  /** Custom environment variables for the MCP server */
  env?: Record<string, string>;
}

// Cache the detection result to avoid repeated checks
let cachedDetection: AutomatosXDetectionResult | null = null;
let cacheTime: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Detect if AutomatosX is installed and available
 */
export function detectAutomatosX(forceRefresh = false): AutomatosXDetectionResult {
  // Return cached result if still valid
  const now = Date.now();
  if (!forceRefresh && cachedDetection && (now - cacheTime) < CACHE_TTL_MS) {
    return cachedDetection;
  }

  try {
    // Try to find automatosx in PATH
    const commandPath = findCommand('automatosx');

    if (!commandPath) {
      cachedDetection = {
        installed: false,
        hasMCPServer: false,
      };
      cacheTime = now;
      return cachedDetection;
    }

    // Check version
    let version: string | undefined;
    try {
      const versionOutput = execSync('automatosx --version', {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      version = versionOutput;
    } catch {
      // Version check failed, but command exists
    }

    // Check if MCP server capability exists
    let hasMCPServer = false;
    try {
      const helpOutput = execSync('automatosx mcp --help', {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      hasMCPServer = helpOutput.includes('mcp server') || helpOutput.includes('Start AutomatosX as MCP server');
    } catch {
      // MCP help failed, might be older version
    }

    cachedDetection = {
      installed: true,
      commandPath,
      version,
      hasMCPServer,
    };
    cacheTime = now;
    return cachedDetection;

  } catch (error) {
    cachedDetection = {
      installed: false,
      hasMCPServer: false,
      error: error instanceof Error ? error.message : String(error),
    };
    cacheTime = now;
    return cachedDetection;
  }
}

/**
 * Find a command in PATH
 */
function findCommand(command: string): string | undefined {
  try {
    // Use 'which' on Unix, 'where' on Windows
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    const result = execSync(`${whichCmd} ${command}`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // 'where' on Windows might return multiple lines
    return result.split('\n')[0]?.trim();
  } catch {
    return undefined;
  }
}

/**
 * Generate AutomatosX MCP server config for auto-discovery
 */
export function generateAutoDiscoveryConfig(options?: AutoDiscoveryOptions): MCPServerConfig | null {
  if (options?.disabled) {
    return null;
  }

  const detection = detectAutomatosX();

  if (!detection.installed || !detection.hasMCPServer) {
    return null;
  }

  const provider = getActiveProvider();
  const serverName = `automatosx-${provider.name}`;
  const command = options?.customCommandPath || detection.commandPath || 'automatosx';

  // Build environment variables
  const env: Record<string, string> = {
    // Set the project directory
    AUTOMATOSX_PROJECT_DIR: process.cwd(),
    // Indicate which provider is using AutomatosX
    AUTOMATOSX_PROVIDER: provider.name,
    // Pass through any custom env vars
    ...(options?.env || {}),
  };

  const transport: MCPTransportConfig = {
    type: 'stdio',
    command,
    args: ['mcp', 'server'],
    env,
  };

  return {
    name: serverName,
    enabled: true,
    transport,
    initTimeout: 30000,
    // Mark as auto-discovered
    quiet: true,
  };
}

/**
 * Get auto-discovered MCP servers
 *
 * Returns AutomatosX MCP server config if:
 * 1. AutomatosX is installed
 * 2. It has MCP server capability
 * 3. Auto-discovery is not disabled
 */
export function getAutoDiscoveredServers(options?: AutoDiscoveryOptions): MCPServerConfig[] {
  const config = generateAutoDiscoveryConfig(options);
  return config ? [config] : [];
}

/**
 * Check if a server name is an auto-discovered AutomatosX server
 */
export function isAutoDiscoveredServer(serverName: string): boolean {
  return serverName.startsWith('automatosx-');
}

/**
 * Clear the detection cache
 */
export function clearDetectionCache(): void {
  cachedDetection = null;
  cacheTime = 0;
}
