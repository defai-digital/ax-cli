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
} from '@defai.digital/ax-schemas';
import type { FigmaClient } from './figma-client.js';

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

// =============================================================================
// Alias Validation
// =============================================================================

/**
 * Status of a single alias validation
 */
export type AliasValidationStatus = 'valid' | 'invalid' | 'not_found' | 'error';

/**
 * Result of validating a single alias
 */
export interface AliasValidationEntry {
  alias: string;
  status: AliasValidationStatus;
  fileKey: string;
  nodeId: string;
  fileName?: string;
  nodeName?: string;
  nodeType?: string;
  error?: string;
}

/**
 * Result of validating all aliases
 */
export interface AliasValidationResult {
  timestamp: string;
  totalAliases: number;
  validAliases: number;
  invalidAliases: number;
  notFoundAliases: number;
  errorAliases: number;
  entries: AliasValidationEntry[];
  summary: string;
}

/**
 * Validate a single alias by checking if the referenced node exists in Figma
 *
 * @param alias - The alias name
 * @param target - The alias target
 * @param client - Figma client instance
 * @returns Validation entry
 */
export async function validateSingleAlias(
  alias: string,
  target: AliasTarget,
  client: FigmaClient
): Promise<AliasValidationEntry> {
  try {
    // Fetch the specific node from Figma
    // BUG FIX: Use correct method name (getFileNodes, not getNodes)
    const nodesResponse = await client.getFileNodes(target.fileKey, [target.nodeId]);

    // Check if nodes response contains the requested node
    const nodeData = nodesResponse.nodes?.[target.nodeId];

    if (!nodeData || !nodeData.document) {
      return {
        alias,
        status: 'not_found',
        fileKey: target.fileKey,
        nodeId: target.nodeId,
        error: `Node ${target.nodeId} not found in file ${target.fileKey}`,
      };
    }

    const node = nodeData.document;

    return {
      alias,
      status: 'valid',
      fileKey: target.fileKey,
      nodeId: target.nodeId,
      nodeName: node.name,
      nodeType: node.type,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific error types
    if (message.includes('404') || message.includes('not found')) {
      return {
        alias,
        status: 'not_found',
        fileKey: target.fileKey,
        nodeId: target.nodeId,
        error: `File or node not found: ${message}`,
      };
    }

    if (message.includes('403') || message.includes('forbidden') || message.includes('permission')) {
      return {
        alias,
        status: 'invalid',
        fileKey: target.fileKey,
        nodeId: target.nodeId,
        error: `Permission denied: ${message}`,
      };
    }

    return {
      alias,
      status: 'error',
      fileKey: target.fileKey,
      nodeId: target.nodeId,
      error: message,
    };
  }
}

/**
 * Validate all aliases in the design config
 *
 * Checks each alias against the Figma API to verify that the referenced
 * nodes still exist and are accessible.
 *
 * @param client - Figma client instance
 * @param options - Validation options
 * @returns Validation result with details for each alias
 */
export async function validateAllAliases(
  client: FigmaClient,
  options?: {
    basePath?: string;
    /** Only validate specific aliases */
    aliasNames?: string[];
    /** Continue on errors (default: true) */
    continueOnError?: boolean;
    /** Concurrency limit (default: 5) */
    concurrency?: number;
  }
): Promise<AliasValidationResult> {
  const config = loadDesignConfig(options?.basePath);
  const continueOnError = options?.continueOnError ?? true;
  const concurrency = options?.concurrency ?? 5;

  // Get aliases to validate
  let aliasesToValidate = Object.entries(config.aliases);
  if (options?.aliasNames && options.aliasNames.length > 0) {
    aliasesToValidate = aliasesToValidate.filter(([alias]) =>
      options.aliasNames!.includes(alias)
    );
  }

  const entries: AliasValidationEntry[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  // Process aliases in batches for controlled concurrency
  for (let i = 0; i < aliasesToValidate.length; i += concurrency) {
    const batch = aliasesToValidate.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async ([alias, target]) => {
        try {
          return await validateSingleAlias(alias, target, client);
        } catch (error) {
          if (!continueOnError) {
            throw error;
          }
          return {
            alias,
            status: 'error' as const,
            fileKey: target.fileKey,
            nodeId: target.nodeId,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    for (const entry of batchResults) {
      entries.push(entry);
      switch (entry.status) {
        case 'valid':
          validCount++;
          break;
        case 'invalid':
          invalidCount++;
          break;
        case 'not_found':
          notFoundCount++;
          break;
        case 'error':
          errorCount++;
          break;
      }
    }
  }

  // Build summary
  const summaryParts: string[] = [];
  summaryParts.push(`${validCount}/${entries.length} valid`);
  if (invalidCount > 0) summaryParts.push(`${invalidCount} invalid`);
  if (notFoundCount > 0) summaryParts.push(`${notFoundCount} not found`);
  if (errorCount > 0) summaryParts.push(`${errorCount} errors`);

  return {
    timestamp: new Date().toISOString(),
    totalAliases: entries.length,
    validAliases: validCount,
    invalidAliases: invalidCount,
    notFoundAliases: notFoundCount,
    errorAliases: errorCount,
    entries,
    summary: summaryParts.join(', '),
  };
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: AliasValidationResult): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                  ALIAS VALIDATION REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`Timestamp: ${result.timestamp}`);
  lines.push(`Summary: ${result.summary}`);
  lines.push('');

  // Group by status
  const validEntries = result.entries.filter((e) => e.status === 'valid');
  const invalidEntries = result.entries.filter((e) => e.status !== 'valid');

  if (invalidEntries.length > 0) {
    lines.push('┌─────────────────────────────────────────────────────────────┐');
    lines.push('│                    ISSUES FOUND                             │');
    lines.push('└─────────────────────────────────────────────────────────────┘');

    for (const entry of invalidEntries) {
      const statusIcon = entry.status === 'not_found' ? '⚠' : entry.status === 'error' ? '✗' : '?';
      lines.push(`  ${statusIcon} ${entry.alias}`);
      lines.push(`    Status: ${entry.status}`);
      lines.push(`    Target: ${entry.fileKey}/${entry.nodeId}`);
      if (entry.error) {
        lines.push(`    Error: ${entry.error}`);
      }
      lines.push('');
    }
  }

  if (validEntries.length > 0) {
    lines.push('┌─────────────────────────────────────────────────────────────┐');
    lines.push('│                    VALID ALIASES                            │');
    lines.push('└─────────────────────────────────────────────────────────────┘');

    for (const entry of validEntries) {
      lines.push(`  ✓ ${entry.alias}`);
      lines.push(`    Target: ${entry.fileKey}/${entry.nodeId}`);
      if (entry.nodeName) {
        lines.push(`    Node: ${entry.nodeName} (${entry.nodeType})`);
      }
      lines.push('');
    }
  }

  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Clean up stale aliases that no longer exist in Figma
 *
 * @param client - Figma client instance
 * @param options - Cleanup options
 * @returns Operation result with count of removed aliases
 */
export async function cleanupStaleAliases(
  client: FigmaClient,
  options?: {
    basePath?: string;
    /** Dry run - don't actually remove aliases */
    dryRun?: boolean;
  }
): Promise<AliasOperationResult & { removedAliases: string[] }> {
  try {
    // First validate all aliases
    const validation = await validateAllAliases(client, {
      basePath: options?.basePath,
    });

    // Find aliases to remove (not_found only - don't remove on transient errors)
    const staleAliases = validation.entries
      .filter((e) => e.status === 'not_found')
      .map((e) => e.alias);

    if (staleAliases.length === 0) {
      return {
        success: true,
        alias: 'cleanup',
        message: 'No stale aliases found',
        removedAliases: [],
      };
    }

    if (options?.dryRun) {
      return {
        success: true,
        alias: 'cleanup',
        message: `Would remove ${staleAliases.length} stale alias(es): ${staleAliases.join(', ')}`,
        removedAliases: staleAliases,
      };
    }

    // Remove stale aliases
    const config = loadDesignConfig(options?.basePath);
    for (const alias of staleAliases) {
      delete config.aliases[alias];
    }
    saveDesignConfig(config, options?.basePath);

    return {
      success: true,
      alias: 'cleanup',
      message: `Removed ${staleAliases.length} stale alias(es)`,
      removedAliases: staleAliases,
    };
  } catch (error) {
    return {
      success: false,
      alias: 'cleanup',
      message: error instanceof Error ? error.message : 'Failed to cleanup aliases',
      removedAliases: [],
    };
  }
}
