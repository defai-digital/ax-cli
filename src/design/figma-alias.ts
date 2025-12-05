/**
 * Figma Alias System
 *
 * Maps human-readable names to Figma file keys and node IDs.
 * Stored in .ax-cli/design.json
 *
 * @module design/figma-alias
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import {
  DesignConfigSchema,
  AliasTargetSchema,
  createEmptyDesignConfig,
  createDesignAlias,
  type DesignConfig,
  type AliasTarget,
  type AliasOperationResult,
  type ResolvedAlias,
  type AliasListEntry,
  type AliasListResponse,
} from '@ax-cli/schemas';

// =============================================================================
// Constants
// =============================================================================

const AX_CLI_DIR = '.ax-cli';
const DESIGN_CONFIG_FILE = 'design.json';

// =============================================================================
// Config File Management
// =============================================================================

/**
 * Get the path to the design config file
 */
export function getDesignConfigPath(basePath?: string): string {
  const base = basePath ?? process.cwd();
  return join(base, AX_CLI_DIR, DESIGN_CONFIG_FILE);
}

/**
 * Load the design config from disk
 *
 * BUG FIX: Now throws on corrupted config instead of silently returning empty.
 * This prevents data loss when saveDesignConfig would overwrite corrupted data.
 *
 * @throws Error if config file exists but is corrupted/malformed
 */
export function loadDesignConfig(basePath?: string): DesignConfig {
  const configPath = getDesignConfigPath(basePath);

  if (!existsSync(configPath)) {
    return createEmptyDesignConfig();
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return DesignConfigSchema.parse(parsed);
  } catch (error) {
    // BUG FIX: Throw instead of silently returning empty config
    // This prevents data loss - callers must handle the error explicitly
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Failed to parse design config at ${configPath}: ${message}\n` +
      `To reset: delete the file and re-create aliases, or fix the JSON manually.`
    );
  }
}

/**
 * Save the design config to disk
 */
export function saveDesignConfig(config: DesignConfig, basePath?: string): void {
  const configPath = getDesignConfigPath(basePath);
  const configDir = dirname(configPath);

  // Ensure directory exists
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Update last modified timestamp
  const updatedConfig: DesignConfig = {
    ...config,
    meta: {
      ...config.meta,
      lastModified: new Date().toISOString(),
    },
  };

  writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');
}

// =============================================================================
// Alias Operations
// =============================================================================

/**
 * Add or update an alias
 */
export function addAlias(
  aliasName: string,
  fileKey: string,
  nodeId: string,
  options?: {
    description?: string;
    basePath?: string;
  }
): AliasOperationResult {
  try {
    // Validate alias name (throws if invalid)
    createDesignAlias(aliasName);

    // Validate target
    const target: AliasTarget = AliasTargetSchema.parse({
      fileKey,
      nodeId,
      description: options?.description,
      updatedAt: new Date().toISOString(),
    });

    // Load existing config
    const config = loadDesignConfig(options?.basePath);

    // Check if alias already exists
    const existed = aliasName in config.aliases;

    // Add/update alias
    config.aliases[aliasName] = target;

    // Save config
    saveDesignConfig(config, options?.basePath);

    return {
      success: true,
      alias: aliasName,
      message: existed
        ? `Updated alias "${aliasName}" → ${fileKey}/${nodeId}`
        : `Added alias "${aliasName}" → ${fileKey}/${nodeId}`,
      target,
    };
  } catch (error) {
    return {
      success: false,
      alias: aliasName,
      message: error instanceof Error ? error.message : 'Failed to add alias',
    };
  }
}

/**
 * Remove an alias
 */
export function removeAlias(
  aliasName: string,
  options?: { basePath?: string }
): AliasOperationResult {
  try {
    const config = loadDesignConfig(options?.basePath);

    if (!(aliasName in config.aliases)) {
      return {
        success: false,
        alias: aliasName,
        message: `Alias "${aliasName}" not found`,
      };
    }

    const target = config.aliases[aliasName];
    delete config.aliases[aliasName];

    saveDesignConfig(config, options?.basePath);

    return {
      success: true,
      alias: aliasName,
      message: `Removed alias "${aliasName}"`,
      target,
    };
  } catch (error) {
    return {
      success: false,
      alias: aliasName,
      message: error instanceof Error ? error.message : 'Failed to remove alias',
    };
  }
}

/**
 * List all aliases
 */
export function listAliases(options?: { basePath?: string }): AliasListResponse {
  const config = loadDesignConfig(options?.basePath);

  const aliases: AliasListEntry[] = Object.entries(config.aliases).map(([alias, target]) => ({
    alias,
    fileKey: target.fileKey,
    nodeId: target.nodeId,
    fileName: config.meta?.fileNames?.[target.fileKey],
    description: target.description,
    updatedAt: target.updatedAt,
  }));

  // Sort by alias name
  aliases.sort((a, b) => a.alias.localeCompare(b.alias));

  return {
    defaultFile: config.defaultFile,
    dsFile: config.dsFile,
    aliases,
    total: aliases.length,
  };
}

/**
 * Resolve an alias to its target
 */
export function resolveAlias(
  aliasOrNodeId: string,
  options?: { basePath?: string }
): ResolvedAlias | { error: string; suggestions?: string[] } {
  const config = loadDesignConfig(options?.basePath);

  // Check if it's a direct alias match
  if (aliasOrNodeId in config.aliases) {
    const target = config.aliases[aliasOrNodeId];
    return {
      alias: aliasOrNodeId,
      fileKey: target.fileKey,
      nodeId: target.nodeId,
      source: 'explicit',
      description: target.description,
    };
  }

  // Check if it's a node ID format (number:number)
  if (/^\d+:\d+$/.test(aliasOrNodeId)) {
    // Need a default file to resolve bare node IDs
    if (!config.defaultFile) {
      return {
        error: 'No default file set. Use "ax-cli design alias set-default <file-key>" or provide full alias.',
      };
    }

    return {
      alias: aliasOrNodeId,
      fileKey: config.defaultFile,
      nodeId: aliasOrNodeId,
      source: 'default-file',
    };
  }

  // Check for partial matches (suggestions)
  const suggestions = Object.keys(config.aliases).filter((alias) =>
    alias.toLowerCase().includes(aliasOrNodeId.toLowerCase())
  );

  return {
    error: `Alias "${aliasOrNodeId}" not found`,
    suggestions: suggestions.length > 0 ? suggestions.slice(0, 5) : undefined,
  };
}

/**
 * Set the default file key
 */
export function setDefaultFile(
  fileKey: string,
  options?: { basePath?: string; fileName?: string }
): AliasOperationResult {
  try {
    const config = loadDesignConfig(options?.basePath);

    config.defaultFile = fileKey;

    // Store file name if provided
    if (options?.fileName) {
      config.meta = {
        ...config.meta,
        fileNames: {
          ...config.meta?.fileNames,
          [fileKey]: options.fileName,
        },
      };
    }

    saveDesignConfig(config, options?.basePath);

    return {
      success: true,
      alias: 'default',
      message: `Set default file to "${fileKey}"${options?.fileName ? ` (${options.fileName})` : ''}`,
    };
  } catch (error) {
    return {
      success: false,
      alias: 'default',
      message: error instanceof Error ? error.message : 'Failed to set default file',
    };
  }
}

/**
 * Set the design system file key
 */
export function setDsFile(
  fileKey: string,
  options?: { basePath?: string; fileName?: string }
): AliasOperationResult {
  try {
    const config = loadDesignConfig(options?.basePath);

    config.dsFile = fileKey;

    // Store file name if provided
    if (options?.fileName) {
      config.meta = {
        ...config.meta,
        fileNames: {
          ...config.meta?.fileNames,
          [fileKey]: options.fileName,
        },
      };
    }

    saveDesignConfig(config, options?.basePath);

    return {
      success: true,
      alias: 'ds',
      message: `Set design system file to "${fileKey}"${options?.fileName ? ` (${options.fileName})` : ''}`,
    };
  } catch (error) {
    return {
      success: false,
      alias: 'ds',
      message: error instanceof Error ? error.message : 'Failed to set DS file',
    };
  }
}

/**
 * Get an alias by name
 */
export function getAlias(
  aliasName: string,
  options?: { basePath?: string }
): AliasTarget | null {
  const config = loadDesignConfig(options?.basePath);
  return config.aliases[aliasName] ?? null;
}

/**
 * Check if an alias exists
 */
export function hasAlias(aliasName: string, options?: { basePath?: string }): boolean {
  const config = loadDesignConfig(options?.basePath);
  return aliasName in config.aliases;
}

/**
 * Get all aliases for a specific file
 */
export function getAliasesForFile(
  fileKey: string,
  options?: { basePath?: string }
): AliasListEntry[] {
  const config = loadDesignConfig(options?.basePath);

  return Object.entries(config.aliases)
    .filter(([_, target]) => target.fileKey === fileKey)
    .map(([alias, target]) => ({
      alias,
      fileKey: target.fileKey,
      nodeId: target.nodeId,
      description: target.description,
      updatedAt: target.updatedAt,
    }));
}

/**
 * Import aliases from another config file
 */
export function importAliases(
  sourcePath: string,
  options?: { basePath?: string; overwrite?: boolean }
): AliasOperationResult {
  try {
    const sourceConfig = loadDesignConfig(sourcePath);
    const targetConfig = loadDesignConfig(options?.basePath);

    let added = 0;
    let skipped = 0;

    for (const [alias, target] of Object.entries(sourceConfig.aliases)) {
      if (alias in targetConfig.aliases && !options?.overwrite) {
        skipped++;
        continue;
      }

      targetConfig.aliases[alias] = target;
      added++;
    }

    saveDesignConfig(targetConfig, options?.basePath);

    return {
      success: true,
      alias: 'import',
      message: `Imported ${added} alias(es), skipped ${skipped} existing`,
    };
  } catch (error) {
    return {
      success: false,
      alias: 'import',
      message: error instanceof Error ? error.message : 'Failed to import aliases',
    };
  }
}
