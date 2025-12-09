/**
 * MCP Configuration Migrator
 *
 * Automatically migrates legacy MCP configurations to modern format.
 * Handles both AutomatosX and old ax-cli configs.
 */

import type { MCPServerConfig, MCPTransportConfig } from '../schemas/settings-schemas.js';
import { MCPServerConfigSchema } from '../schemas/settings-schemas.js';
import { isLegacyStdioFormat, detectConfigFormat } from './config-detector.js';
import { extractErrorMessage } from '../utils/error-handler.js';

export interface MigrationResult {
  /** Whether migration was successful */
  success: boolean;
  /** Migrated configuration (if successful) */
  migratedConfig?: MCPServerConfig;
  /** Original configuration */
  originalConfig: unknown;
  /** Changes made during migration */
  changes: string[];
  /** Errors encountered */
  errors: string[];
  /** Warnings */
  warnings: string[];
}

export interface BatchMigrationResult {
  /** Total configs processed */
  total: number;
  /** Successfully migrated */
  migrated: number;
  /** Already in modern format (no migration needed) */
  alreadyModern: number;
  /** Failed migrations */
  failed: number;
  /** Individual results */
  results: Map<string, MigrationResult>;
  /** Summary message */
  summary: string;
}

/**
 * Migrate a legacy stdio-only config to modern format
 */
export function migrateLegacyStdioConfig(config: unknown): MigrationResult {
  const changes: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate this is actually a legacy config
  if (!isLegacyStdioFormat(config)) {
    return {
      success: false,
      originalConfig: config,
      changes,
      errors: ['Config is not in legacy stdio format'],
      warnings
    };
  }

  const legacyConfig = config as {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };

  // Build modern config
  try {
    const transportConfig: MCPTransportConfig = {
      type: 'stdio',
      command: legacyConfig.command,
      args: legacyConfig.args || []
    };

    // Only add env if it exists (cleaner than undefined)
    if (legacyConfig.env) {
      transportConfig.env = legacyConfig.env;
    }

    const modernConfig: MCPServerConfig = {
      name: legacyConfig.name,
      transport: transportConfig
    };

    // Validate the migrated config
    const validationResult = MCPServerConfigSchema.safeParse(modernConfig);

    if (!validationResult.success) {
      errors.push('Migrated config failed validation');
      validationResult.error.issues.forEach(issue => {
        errors.push(`  - ${issue.path.join('.')}: ${issue.message}`);
      });

      return {
        success: false,
        originalConfig: config,
        changes,
        errors,
        warnings
      };
    }

    // Track changes
    changes.push('Converted from legacy stdio-only format to modern format');
    changes.push('Created "transport" object with type "stdio"');
    changes.push(`Moved "command" field into transport: "${legacyConfig.command}"`);

    if (legacyConfig.args) {
      changes.push(`Moved "args" field into transport: [${legacyConfig.args.length} args]`);
    } else {
      changes.push('Added empty "args" array to transport');
      warnings.push('No args specified in original config. Using empty array.');
    }

    if (legacyConfig.env) {
      changes.push(`Moved "env" field into transport: [${Object.keys(legacyConfig.env).length} vars]`);
    }

    // Warn about removed fields
    const knownFields = ['name', 'command', 'args', 'env', 'transport'];
    const unknownFields = Object.keys(legacyConfig).filter(key => !knownFields.includes(key));

    if (unknownFields.length > 0) {
      warnings.push(`Removed unknown fields: ${unknownFields.join(', ')}`);
    }

    return {
      success: true,
      migratedConfig: validationResult.data,
      originalConfig: config,
      changes,
      errors,
      warnings
    };
  } catch (error) {
    errors.push(`Migration failed: ${extractErrorMessage(error)}`);
    return {
      success: false,
      originalConfig: config,
      changes,
      errors,
      warnings
    };
  }
}

/**
 * Attempt to migrate any config (auto-detects format)
 *
 * BUG FIX: When config is already in modern format, we now parse it through
 * Zod to ensure proper type coercion and strip unknown fields. Previously
 * we returned the raw config with just a type cast, which could leave
 * potentially invalid data structures in the returned config.
 */
export function migrateConfig(config: unknown): MigrationResult {
  const detection = detectConfigFormat(config);

  // Already in modern format
  if (!detection.isLegacy && detection.isValid) {
    // BUG FIX: Parse through Zod to ensure proper type coercion
    // and strip any unknown fields rather than just type-casting
    const parseResult = MCPServerConfigSchema.safeParse(config);
    if (!parseResult.success) {
      // This shouldn't happen since detection.isValid was true,
      // but handle it gracefully
      return {
        success: false,
        originalConfig: config,
        changes: [],
        errors: ['Config validation failed after detection', ...parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)],
        warnings: detection.warnings
      };
    }
    return {
      success: true,
      migratedConfig: parseResult.data,
      originalConfig: config,
      changes: ['No migration needed - already in modern format'],
      errors: [],
      warnings: detection.warnings
    };
  }

  // Invalid format that's not legacy either
  if (!detection.isLegacy && !detection.isValid) {
    return {
      success: false,
      originalConfig: config,
      changes: [],
      errors: ['Config is neither legacy nor valid modern format', ...detection.issues],
      warnings: detection.warnings
    };
  }

  // Legacy stdio format - migrate it
  if (detection.formatVersion === 'legacy-stdio') {
    return migrateLegacyStdioConfig(config);
  }

  // Unknown format
  return {
    success: false,
    originalConfig: config,
    changes: [],
    errors: [`Unknown config format: ${detection.formatVersion}`],
    warnings: detection.warnings
  };
}

/**
 * Batch migrate multiple configs
 */
export function batchMigrateConfigs(
  configs: Record<string, unknown>
): BatchMigrationResult {
  const results = new Map<string, MigrationResult>();
  let migrated = 0;
  let alreadyModern = 0;
  let failed = 0;

  for (const [name, config] of Object.entries(configs)) {
    // Ensure config has name field
    const configAsObject = config as Record<string, unknown>;
    const configWithName = { ...configAsObject, name: configAsObject.name || name };

    const result = migrateConfig(configWithName);
    results.set(name, result);

    if (result.success) {
      if (result.changes.some(c => c.includes('No migration needed'))) {
        alreadyModern++;
      } else {
        migrated++;
      }
    } else {
      failed++;
    }
  }

  const total = results.size;

  let summary = `Migration complete: ${total} config(s) processed.\n`;
  if (migrated > 0) {
    summary += `  ✅ ${migrated} migrated to modern format\n`;
  }
  if (alreadyModern > 0) {
    summary += `  ℹ️  ${alreadyModern} already in modern format\n`;
  }
  if (failed > 0) {
    summary += `  ❌ ${failed} failed to migrate\n`;
  }

  return {
    total,
    migrated,
    alreadyModern,
    failed,
    results,
    summary: summary.trim()
  };
}

/**
 * Create backup of config before migration
 */
export function createConfigBackup(config: unknown): {
  success: boolean;
  backup?: unknown;
  error?: string;
} {
  try {
    // Deep clone the config (structuredClone is faster than JSON.parse/stringify)
    const backup = structuredClone(config);

    // Add backup metadata
    const backupWithMetadata = {
      _backup: true,
      _timestamp: Date.now(),
      _version: '3.7.2',
      config: backup
    };

    return {
      success: true,
      backup: backupWithMetadata
    };
  } catch (error) {
    return {
      success: false,
      error: extractErrorMessage(error)
    };
  }
}

/**
 * Format migration result for display
 */
export function formatMigrationResult(
  serverName: string,
  result: MigrationResult
): string {
  const lines: string[] = [];

  lines.push(`Server: ${serverName}`);
  lines.push('─'.repeat(50));

  if (result.success) {
    lines.push('✅ Migration successful');
    lines.push('');
    lines.push('Changes:');
    result.changes.forEach(change => {
      lines.push(`  • ${change}`);
    });
  } else {
    lines.push('❌ Migration failed');
    lines.push('');
    lines.push('Errors:');
    result.errors.forEach(error => {
      lines.push(`  ❌ ${error}`);
    });
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    result.warnings.forEach(warning => {
      lines.push(`  ⚠️  ${warning}`);
    });
  }

  return lines.join('\n');
}

/**
 * Format batch migration result for display
 */
export function formatBatchMigrationResult(result: BatchMigrationResult): string {
  const lines: string[] = [];

  lines.push('╭─ MCP Configuration Migration ─────────────────╮');
  lines.push(`│ Total servers: ${result.total}`);
  lines.push(`│ Migrated: ${result.migrated}`);
  lines.push(`│ Already modern: ${result.alreadyModern}`);
  lines.push(`│ Failed: ${result.failed}`);
  lines.push('╰────────────────────────────────────────────────╯');
  lines.push('');

  // Show details for each server
  for (const [name, serverResult] of result.results.entries()) {
    if (serverResult.success && serverResult.changes.some(c => !c.includes('No migration needed'))) {
      lines.push(formatMigrationResult(name, serverResult));
      lines.push('');
    }
  }

  // Show failures
  const failures = Array.from(result.results.entries()).filter(([, r]) => !r.success);
  if (failures.length > 0) {
    lines.push('Failed Migrations:');
    lines.push('─'.repeat(50));
    failures.forEach(([name, serverResult]) => {
      lines.push(formatMigrationResult(name, serverResult));
      lines.push('');
    });
  }

  return lines.join('\n');
}
