/**
 * AutomatosX Configuration Loader
 *
 * Loads MCP server configurations from AutomatosX config files and merges
 * them with ax-cli configurations. Provides backward compatibility for
 * AutomatosX users migrating to ax-cli.
 */

import fs from 'fs';
import path from 'path';
import type { MCPServerConfig } from '../schemas/settings-schemas.js';
import { migrateConfig, type MigrationResult } from './config-migrator.js';
import { detectConfigFormat } from './config-detector.js';
import { extractErrorMessage } from '../utils/error-handler.js';

export interface AutomatosXConfig {
  /** MCP server configurations */
  mcpServers?: Record<string, any>;
  /** AutomatosX version (if present) */
  automatosxVersion?: string;
  /** Other AutomatosX-specific fields */
  [key: string]: any;
}

export interface AutomatosXLoadResult {
  /** Whether AutomatosX config was found */
  found: boolean;
  /** Loaded and migrated MCP server configs */
  servers: MCPServerConfig[];
  /** Path to AutomatosX config (if found) */
  configPath?: string;
  /** Migration results for each server */
  migrations: Map<string, MigrationResult>;
  /** Warnings */
  warnings: string[];
  /** Errors */
  errors: string[];
}

export interface MergedConfigResult {
  /** Merged server configurations */
  servers: MCPServerConfig[];
  /** Source tracking for each server */
  sources: Map<string, 'ax-cli' | 'automatosx' | 'both'>;
  /** Conflicts detected during merge */
  conflicts: Array<{
    serverName: string;
    axCliConfig: any;
    automatosXConfig: any;
    resolution: 'ax-cli-wins' | 'automatosx-wins' | 'manual-required';
  }>;
  /** Warnings */
  warnings: string[];
}

/**
 * Get AutomatosX config directory path
 */
export function getAutomatosXConfigDir(projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  return path.join(root, '.automatosx');
}

/**
 * Get AutomatosX config file path
 */
export function getAutomatosXConfigPath(projectRoot?: string): string {
  return path.join(getAutomatosXConfigDir(projectRoot), 'config.json');
}

/**
 * Check if AutomatosX config exists
 */
export function automatosXConfigExists(projectRoot?: string): boolean {
  const configPath = getAutomatosXConfigPath(projectRoot);
  return fs.existsSync(configPath);
}

/**
 * Load AutomatosX configuration file
 */
export function loadAutomatosXConfigFile(projectRoot?: string): AutomatosXConfig | null {
  const configPath = getAutomatosXConfigPath(projectRoot);

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const data = JSON.parse(raw) as AutomatosXConfig;
    return data;
  } catch (error) {
    console.warn(
      `Failed to load AutomatosX config from ${configPath}: ${
        extractErrorMessage(error)
      }`
    );
    return null;
  }
}

/**
 * Load and migrate AutomatosX MCP server configurations
 */
export function loadAutomatosXMCPServers(projectRoot?: string): AutomatosXLoadResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const migrations = new Map<string, MigrationResult>();
  const servers: MCPServerConfig[] = [];

  // Check if AutomatosX config exists
  const configPath = getAutomatosXConfigPath(projectRoot);

  if (!fs.existsSync(configPath)) {
    return {
      found: false,
      servers: [],
      migrations,
      warnings,
      errors
    };
  }

  // Load config
  const config = loadAutomatosXConfigFile(projectRoot);

  if (!config) {
    errors.push('Failed to load AutomatosX config');
    return {
      found: true,
      configPath,
      servers: [],
      migrations,
      warnings,
      errors
    };
  }

  // Extract MCP servers
  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    warnings.push('AutomatosX config found but no MCP servers configured');
    return {
      found: true,
      configPath,
      servers: [],
      migrations,
      warnings,
      errors
    };
  }

  // Detect version
  if (config.automatosxVersion) {
    warnings.push(`AutomatosX version detected: ${config.automatosxVersion}`);
  }

  // Migrate each server
  for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    // Ensure server has name field
    const configWithName = { ...serverConfig, name: serverConfig.name || name };

    // Detect format
    const detection = detectConfigFormat(configWithName);

    if (detection.isLegacy) {
      warnings.push(`Server "${name}" uses legacy format - migrating automatically`);
    }

    // Migrate
    const migration = migrateConfig(configWithName);
    migrations.set(name, migration);

    if (migration.success && migration.migratedConfig) {
      servers.push(migration.migratedConfig);
    } else {
      errors.push(`Failed to migrate server "${name}": ${migration.errors.join(', ')}`);
    }
  }

  return {
    found: true,
    configPath,
    servers,
    migrations,
    warnings,
    errors
  };
}

/**
 * Merge ax-cli and AutomatosX MCP server configurations
 *
 * Strategy:
 * - ax-cli configs take precedence (user explicitly configured)
 * - AutomatosX configs provide defaults/fallbacks
 * - Conflicts are logged as warnings
 * - Both configs can coexist (different server names)
 */
export function mergeConfigs(
  axCliServers: MCPServerConfig[],
  automatosXServers: MCPServerConfig[]
): MergedConfigResult {
  const merged = new Map<string, MCPServerConfig>();
  const sources = new Map<string, 'ax-cli' | 'automatosx' | 'both'>();
  const conflicts: MergedConfigResult['conflicts'] = [];
  const warnings: string[] = [];

  // Add AutomatosX servers first (lower priority)
  for (const server of automatosXServers) {
    merged.set(server.name, server);
    sources.set(server.name, 'automatosx');
  }

  // Add/override with ax-cli servers (higher priority)
  for (const server of axCliServers) {
    const existingServer = merged.get(server.name);

    if (existingServer) {
      // Conflict detected
      const automatosXServer = existingServer;

      // Check if configs are identical (no real conflict)
      const areIdentical = JSON.stringify(automatosXServer) === JSON.stringify(server);

      if (areIdentical) {
        sources.set(server.name, 'both');
        warnings.push(
          `Server "${server.name}" configured in both ax-cli and AutomatosX with identical settings`
        );
      } else {
        sources.set(server.name, 'ax-cli');
        conflicts.push({
          serverName: server.name,
          axCliConfig: server,
          automatosXConfig: automatosXServer,
          resolution: 'ax-cli-wins'
        });
        warnings.push(
          `Server "${server.name}" configured in both ax-cli and AutomatosX. Using ax-cli version.`
        );
      }
    } else {
      sources.set(server.name, 'ax-cli');
    }

    // ax-cli always wins
    merged.set(server.name, server);
  }

  return {
    servers: Array.from(merged.values()),
    sources,
    conflicts,
    warnings
  };
}

/**
 * Format merge result for display
 */
export function formatMergeResult(result: MergedConfigResult): string {
  const lines: string[] = [];

  lines.push('╭─ MCP Config Merge Summary ────────────────────╮');
  lines.push(`│ Total servers: ${result.servers.length}`);

  const axCliCount = Array.from(result.sources.values()).filter(s => s === 'ax-cli').length;
  const automatosXCount = Array.from(result.sources.values()).filter(s => s === 'automatosx').length;
  const bothCount = Array.from(result.sources.values()).filter(s => s === 'both').length;

  if (axCliCount > 0) {
    lines.push(`│ From ax-cli: ${axCliCount}`);
  }
  if (automatosXCount > 0) {
    lines.push(`│ From AutomatosX: ${automatosXCount}`);
  }
  if (bothCount > 0) {
    lines.push(`│ In both (identical): ${bothCount}`);
  }

  if (result.conflicts.length > 0) {
    lines.push(`│ Conflicts resolved: ${result.conflicts.length}`);
  }

  lines.push('╰────────────────────────────────────────────────╯');

  // Show conflicts
  if (result.conflicts.length > 0) {
    lines.push('');
    lines.push('Conflicts (ax-cli config used):');
    result.conflicts.forEach(conflict => {
      lines.push(`  • ${conflict.serverName}`);
    });
  }

  // Show warnings
  if (result.warnings.length > 0) {
    lines.push('');
    result.warnings.forEach(warning => {
      lines.push(`⚠️  ${warning}`);
    });
  }

  return lines.join('\n');
}

/**
 * Get recommendation for user based on merge result
 */
export function getConfigRecommendation(result: MergedConfigResult): string | null {
  // If there are conflicts, recommend consolidation
  if (result.conflicts.length > 0) {
    return (
      'Recommendation: Consolidate your MCP server configurations into .ax-cli/settings.json\n' +
      'to avoid conflicts. Run: ax-cli mcp migrate --from .automatosx/config.json'
    );
  }

  // If AutomatosX configs exist but no conflicts, inform user
  const automatosXCount = Array.from(result.sources.values()).filter(s => s === 'automatosx').length;

  if (automatosXCount > 0) {
    return (
      'Info: Using MCP servers from AutomatosX config. This is OK, but consider\n' +
      'migrating to .ax-cli/settings.json for better integration.'
    );
  }

  return null;
}
