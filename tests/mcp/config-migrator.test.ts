/**
 * Tests for MCP config-migrator module
 * Tests legacy config migration functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  migrateLegacyStdioConfig,
  migrateConfig,
  batchMigrateConfigs,
  createConfigBackup,
  formatMigrationResult,
  formatBatchMigrationResult,
  type LegacyStdioConfig,
  type MigrationResult,
} from '../../packages/core/src/mcp/config-migrator.js';

// Mock the config-detector module
vi.mock('../../packages/core/src/mcp/config-detector.js', () => ({
  isLegacyStdioFormat: vi.fn(),
  detectConfigFormat: vi.fn(),
}));

// Mock the error-handler module
vi.mock('../../packages/core/src/utils/error-handler.js', () => ({
  extractErrorMessage: vi.fn((error: unknown) => {
    if (error instanceof Error) return error.message;
    return String(error);
  }),
}));

import { isLegacyStdioFormat, detectConfigFormat } from '../../packages/core/src/mcp/config-detector.js';

describe('migrateLegacyStdioConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should migrate valid legacy stdio config', () => {
    const legacyConfig: LegacyStdioConfig = {
      name: 'my-server',
      command: 'node',
      args: ['server.js'],
      env: { NODE_ENV: 'production' },
    };

    vi.mocked(isLegacyStdioFormat).mockReturnValue(true);

    const result = migrateLegacyStdioConfig(legacyConfig);

    expect(result.success).toBe(true);
    expect(result.migratedConfig).toBeDefined();
    expect(result.migratedConfig?.transport).toEqual({
      type: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { NODE_ENV: 'production' },
    });
    expect(result.changes).toContain('Converted from legacy stdio-only format to modern format');
  });

  it('should fail for non-legacy config', () => {
    const config = { transport: { type: 'stdio', command: 'node' } };

    vi.mocked(isLegacyStdioFormat).mockReturnValue(false);

    const result = migrateLegacyStdioConfig(config as unknown as LegacyStdioConfig);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Config is not in legacy stdio format');
  });

  it('should add empty args array when not specified', () => {
    const legacyConfig: LegacyStdioConfig = {
      name: 'server',
      command: 'npx',
    };

    vi.mocked(isLegacyStdioFormat).mockReturnValue(true);

    const result = migrateLegacyStdioConfig(legacyConfig);

    expect(result.success).toBe(true);
    expect(result.migratedConfig?.transport.args).toEqual([]);
    expect(result.warnings).toContain('No args specified in original config. Using empty array.');
  });

  it('should warn about unknown fields', () => {
    const legacyConfig = {
      name: 'server',
      command: 'node',
      args: [],
      unknownField: 'value',
      anotherField: 123,
    } as unknown as LegacyStdioConfig;

    vi.mocked(isLegacyStdioFormat).mockReturnValue(true);

    const result = migrateLegacyStdioConfig(legacyConfig);

    expect(result.success).toBe(true);
    expect(result.warnings.some(w => w.includes('unknownField'))).toBe(true);
    expect(result.warnings.some(w => w.includes('anotherField'))).toBe(true);
  });

  it('should track all changes made', () => {
    const legacyConfig: LegacyStdioConfig = {
      name: 'server',
      command: 'python',
      args: ['-m', 'server'],
      env: { PYTHONPATH: '/usr/lib' },
    };

    vi.mocked(isLegacyStdioFormat).mockReturnValue(true);

    const result = migrateLegacyStdioConfig(legacyConfig);

    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes.some(c => c.includes('transport'))).toBe(true);
    expect(result.changes.some(c => c.includes('command'))).toBe(true);
    expect(result.changes.some(c => c.includes('args'))).toBe(true);
    expect(result.changes.some(c => c.includes('env'))).toBe(true);
  });
});

describe('migrateConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return success for already modern format', () => {
    const modernConfig = {
      name: 'server',
      transport: {
        type: 'stdio',
        command: 'node',
        args: ['index.js'],
      },
    };

    vi.mocked(detectConfigFormat).mockReturnValue({
      isLegacy: false,
      isValid: true,
      formatVersion: 'modern',
      issues: [],
      warnings: [],
    });

    const result = migrateConfig(modernConfig);

    expect(result.success).toBe(true);
    expect(result.changes).toContain('No migration needed - already in modern format');
  });

  it('should fail for invalid non-legacy config', () => {
    const invalidConfig = { invalid: 'config' };

    vi.mocked(detectConfigFormat).mockReturnValue({
      isLegacy: false,
      isValid: false,
      formatVersion: 'unknown',
      issues: ['Missing transport field'],
      warnings: [],
    });

    const result = migrateConfig(invalidConfig);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('neither legacy nor valid modern'))).toBe(true);
  });

  it('should migrate legacy-stdio format', () => {
    const legacyConfig: LegacyStdioConfig = {
      name: 'server',
      command: 'node',
      args: ['server.js'],
    };

    vi.mocked(detectConfigFormat).mockReturnValue({
      isLegacy: true,
      isValid: false,
      formatVersion: 'legacy-stdio',
      issues: [],
      warnings: [],
    });
    vi.mocked(isLegacyStdioFormat).mockReturnValue(true);

    const result = migrateConfig(legacyConfig);

    expect(result.success).toBe(true);
    expect(result.migratedConfig).toBeDefined();
    expect(result.migratedConfig?.transport.type).toBe('stdio');
  });

  it('should fail for unknown format', () => {
    const unknownConfig = { someField: 'value' };

    vi.mocked(detectConfigFormat).mockReturnValue({
      isLegacy: true,
      isValid: false,
      formatVersion: 'unknown-format',
      issues: [],
      warnings: ['Some warning'],
    });

    const result = migrateConfig(unknownConfig);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('Unknown config format'))).toBe(true);
    expect(result.warnings).toContain('Some warning');
  });

  it('should include warnings from detection', () => {
    const modernConfig = {
      name: 'server',
      transport: { type: 'stdio', command: 'node', args: [] },
    };

    vi.mocked(detectConfigFormat).mockReturnValue({
      isLegacy: false,
      isValid: true,
      formatVersion: 'modern',
      issues: [],
      warnings: ['Deprecated field used'],
    });

    const result = migrateConfig(modernConfig);

    expect(result.warnings).toContain('Deprecated field used');
  });
});

describe('batchMigrateConfigs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should migrate multiple configs', () => {
    vi.mocked(detectConfigFormat).mockReturnValue({
      isLegacy: true,
      isValid: false,
      formatVersion: 'legacy-stdio',
      issues: [],
      warnings: [],
    });
    vi.mocked(isLegacyStdioFormat).mockReturnValue(true);

    const configs = {
      server1: { command: 'node', args: ['s1.js'] },
      server2: { command: 'python', args: ['s2.py'] },
    };

    const result = batchMigrateConfigs(configs);

    expect(result.total).toBe(2);
    expect(result.migrated).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.results.size).toBe(2);
  });

  it('should count already modern configs', () => {
    vi.mocked(detectConfigFormat).mockReturnValue({
      isLegacy: false,
      isValid: true,
      formatVersion: 'modern',
      issues: [],
      warnings: [],
    });

    const configs = {
      server1: { name: 's1', transport: { type: 'stdio', command: 'node', args: [] } },
    };

    const result = batchMigrateConfigs(configs);

    expect(result.alreadyModern).toBe(1);
    expect(result.migrated).toBe(0);
  });

  it('should count failed migrations', () => {
    vi.mocked(detectConfigFormat).mockReturnValue({
      isLegacy: false,
      isValid: false,
      formatVersion: 'unknown',
      issues: ['Invalid config'],
      warnings: [],
    });

    const configs = {
      badServer: { invalid: 'config' },
    };

    const result = batchMigrateConfigs(configs);

    expect(result.failed).toBe(1);
    expect(result.migrated).toBe(0);
  });

  it('should use key as name when config has no name', () => {
    vi.mocked(detectConfigFormat).mockReturnValue({
      isLegacy: true,
      isValid: false,
      formatVersion: 'legacy-stdio',
      issues: [],
      warnings: [],
    });
    vi.mocked(isLegacyStdioFormat).mockReturnValue(true);

    const configs = {
      'my-server': { command: 'node', args: [] },
    };

    const result = batchMigrateConfigs(configs);

    const serverResult = result.results.get('my-server');
    expect(serverResult?.migratedConfig?.name).toBe('my-server');
  });

  it('should generate summary message', () => {
    vi.mocked(detectConfigFormat).mockReturnValue({
      isLegacy: true,
      isValid: false,
      formatVersion: 'legacy-stdio',
      issues: [],
      warnings: [],
    });
    vi.mocked(isLegacyStdioFormat).mockReturnValue(true);

    const configs = {
      server1: { command: 'node', args: [] },
    };

    const result = batchMigrateConfigs(configs);

    expect(result.summary).toContain('Migration complete');
    expect(result.summary).toContain('1 config(s) processed');
  });

  it('should handle mixed results', () => {
    // First call returns legacy format, second returns invalid
    vi.mocked(detectConfigFormat)
      .mockReturnValueOnce({
        isLegacy: true,
        isValid: false,
        formatVersion: 'legacy-stdio',
        issues: [],
        warnings: [],
      })
      .mockReturnValueOnce({
        isLegacy: false,
        isValid: false,
        formatVersion: 'unknown',
        issues: ['Invalid'],
        warnings: [],
      });
    vi.mocked(isLegacyStdioFormat).mockReturnValue(true);

    const configs = {
      goodServer: { command: 'node', args: [] },
      badServer: { invalid: true },
    };

    const result = batchMigrateConfigs(configs);

    expect(result.migrated).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.total).toBe(2);
  });
});

describe('createConfigBackup', () => {
  it('should create backup with metadata', () => {
    const config: LegacyStdioConfig = {
      name: 'server',
      command: 'node',
      args: ['index.js'],
    };

    const result = createConfigBackup(config);

    expect(result.success).toBe(true);
    expect(result.backup).toBeDefined();
    expect(result.backup?._backup).toBe(true);
    expect(result.backup?._timestamp).toBeGreaterThan(0);
    expect(result.backup?._version).toBe('3.7.2');
    expect(result.backup?.config).toEqual(config);
  });

  it('should deep clone the config', () => {
    const config: LegacyStdioConfig = {
      name: 'server',
      command: 'node',
      args: ['index.js'],
      env: { KEY: 'value' },
    };

    const result = createConfigBackup(config);

    // Modify original
    config.args?.push('modified');
    config.env!['NEW_KEY'] = 'new-value';

    // Backup should be unchanged
    expect((result.backup?.config as LegacyStdioConfig).args).toEqual(['index.js']);
    expect((result.backup?.config as LegacyStdioConfig).env).toEqual({ KEY: 'value' });
  });

  it('should handle complex nested configs', () => {
    const config = {
      name: 'server',
      command: 'node',
      nested: {
        deep: {
          value: 123,
        },
      },
    };

    const result = createConfigBackup(config);

    expect(result.success).toBe(true);
    expect((result.backup?.config as typeof config).nested.deep.value).toBe(123);
  });
});

describe('formatMigrationResult', () => {
  it('should format successful migration', () => {
    const result: MigrationResult = {
      success: true,
      migratedConfig: {
        name: 'server',
        transport: { type: 'stdio', command: 'node', args: [] },
      },
      originalConfig: { command: 'node' },
      changes: ['Change 1', 'Change 2'],
      errors: [],
      warnings: [],
    };

    const formatted = formatMigrationResult('my-server', result);

    expect(formatted).toContain('Server: my-server');
    expect(formatted).toContain('Migration successful');
    expect(formatted).toContain('Change 1');
    expect(formatted).toContain('Change 2');
  });

  it('should format failed migration', () => {
    const result: MigrationResult = {
      success: false,
      originalConfig: { invalid: 'config' },
      changes: [],
      errors: ['Error 1', 'Error 2'],
      warnings: [],
    };

    const formatted = formatMigrationResult('bad-server', result);

    expect(formatted).toContain('Server: bad-server');
    expect(formatted).toContain('Migration failed');
    expect(formatted).toContain('Error 1');
    expect(formatted).toContain('Error 2');
  });

  it('should include warnings when present', () => {
    const result: MigrationResult = {
      success: true,
      migratedConfig: {
        name: 'server',
        transport: { type: 'stdio', command: 'node', args: [] },
      },
      originalConfig: { command: 'node' },
      changes: ['Changed'],
      errors: [],
      warnings: ['Warning 1', 'Warning 2'],
    };

    const formatted = formatMigrationResult('server', result);

    expect(formatted).toContain('Warnings:');
    expect(formatted).toContain('Warning 1');
    expect(formatted).toContain('Warning 2');
  });

  it('should not include warnings section when empty', () => {
    const result: MigrationResult = {
      success: true,
      originalConfig: { command: 'node' },
      changes: ['Changed'],
      errors: [],
      warnings: [],
    };

    const formatted = formatMigrationResult('server', result);

    expect(formatted).not.toContain('Warnings:');
  });
});

describe('formatBatchMigrationResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format batch result with header', () => {
    const batchResult = {
      total: 3,
      migrated: 1,
      alreadyModern: 1,
      failed: 1,
      results: new Map<string, MigrationResult>(),
      summary: 'Migration complete',
    };

    const formatted = formatBatchMigrationResult(batchResult);

    expect(formatted).toContain('MCP Configuration Migration');
    expect(formatted).toContain('Total servers: 3');
    expect(formatted).toContain('Migrated: 1');
    expect(formatted).toContain('Already modern: 1');
    expect(formatted).toContain('Failed: 1');
  });

  it('should show details for migrated servers', () => {
    const migratedResult: MigrationResult = {
      success: true,
      migratedConfig: {
        name: 'server',
        transport: { type: 'stdio', command: 'node', args: [] },
      },
      originalConfig: { command: 'node' },
      changes: ['Converted from legacy format'],
      errors: [],
      warnings: [],
    };

    const results = new Map<string, MigrationResult>();
    results.set('migrated-server', migratedResult);

    const batchResult = {
      total: 1,
      migrated: 1,
      alreadyModern: 0,
      failed: 0,
      results,
      summary: 'Migration complete',
    };

    const formatted = formatBatchMigrationResult(batchResult);

    expect(formatted).toContain('migrated-server');
    expect(formatted).toContain('Converted from legacy format');
  });

  it('should show failed migrations section', () => {
    const failedResult: MigrationResult = {
      success: false,
      originalConfig: { invalid: 'config' },
      changes: [],
      errors: ['Config validation failed'],
      warnings: [],
    };

    const results = new Map<string, MigrationResult>();
    results.set('failed-server', failedResult);

    const batchResult = {
      total: 1,
      migrated: 0,
      alreadyModern: 0,
      failed: 1,
      results,
      summary: 'Migration complete',
    };

    const formatted = formatBatchMigrationResult(batchResult);

    expect(formatted).toContain('Failed Migrations:');
    expect(formatted).toContain('failed-server');
    expect(formatted).toContain('Config validation failed');
  });

  it('should not show details for already modern configs', () => {
    const modernResult: MigrationResult = {
      success: true,
      migratedConfig: {
        name: 'server',
        transport: { type: 'stdio', command: 'node', args: [] },
      },
      originalConfig: { transport: { type: 'stdio', command: 'node' } },
      changes: ['No migration needed - already in modern format'],
      errors: [],
      warnings: [],
    };

    const results = new Map<string, MigrationResult>();
    results.set('modern-server', modernResult);

    const batchResult = {
      total: 1,
      migrated: 0,
      alreadyModern: 1,
      failed: 0,
      results,
      summary: 'Migration complete',
    };

    const formatted = formatBatchMigrationResult(batchResult);

    // Should not show the server details in the main body since it's already modern
    const lines = formatted.split('\n');
    const serverDetailLines = lines.filter(l => l.includes('modern-server'));
    // modern-server should only appear once - not in a detailed section
    expect(serverDetailLines.length).toBeLessThanOrEqual(1);
  });
});
