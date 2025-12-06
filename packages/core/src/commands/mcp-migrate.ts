/**
 * MCP Migration Command
 *
 * CLI command to migrate legacy MCP configurations to modern format.
 * Handles both AutomatosX and old ax-cli configs.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Command } from 'commander';
import { getAutomatosXConfigPath } from '../mcp/automatosx-loader.js';
import { batchMigrateConfigs, formatBatchMigrationResult } from '../mcp/config-migrator.js';
import { detectMultipleConfigs, getDetectionSummary } from '../mcp/config-detector.js';
import { formatSuccess, formatWarning, formatInfo } from '../mcp/error-formatter.js';
import { extractErrorMessage } from '../utils/error-handler.js';
import { CONFIG_PATHS } from '../constants.js';

export function createMCPMigrateCommand(): Command {
  const command = new Command('migrate');

  command
    .description('Migrate legacy MCP configurations to modern format')
    .option('--from <path>', 'Source config file (default: .automatosx/config.json)')
    .option('--to <path>', 'Target config file (default: .ax-cli/settings.json)')
    .option('--dry-run', 'Preview migration without making changes')
    .option('--no-backup', 'Skip creating backup file')
    .option('--force', 'Overwrite existing configs without confirmation')
    .action(async (options) => {
      try {
        await runMigration(options);
      } catch (error) {
        console.error(chalk.red('Migration failed:'), extractErrorMessage(error));
        process.exit(1);
      }
    });

  return command;
}

interface MigrationOptions {
  from?: string;
  to?: string;
  dryRun?: boolean;
  backup: boolean;
  force?: boolean;
}

async function runMigration(options: MigrationOptions): Promise<void> {
  console.log(chalk.bold('\n🔄 MCP Configuration Migration\n'));

  // Determine source and target paths
  const sourcePath = options.from || getAutomatosXConfigPath();
  const targetPath = options.to || CONFIG_PATHS.PROJECT_SETTINGS;

  console.log(formatInfo(`Source: ${sourcePath}`));
  console.log(formatInfo(`Target: ${targetPath}`));
  console.log('');

  // Check if source exists
  if (!fs.existsSync(sourcePath)) {
    console.error(chalk.red(`❌ Source file not found: ${sourcePath}`));
    console.log('');
    console.log(chalk.dim('Available options:'));
    console.log(chalk.dim('  1. Create .automatosx/config.json with your MCP servers'));
    console.log(chalk.dim('  2. Specify a different source: --from <path>'));
    console.log(chalk.dim('  3. Manually configure MCP in .ax-cli/settings.json'));
    process.exit(1);
  }

  // Load source config
  console.log(chalk.dim('Loading source configuration...'));
  let sourceConfig: any;

  try {
    const raw = fs.readFileSync(sourcePath, 'utf-8');
    sourceConfig = JSON.parse(raw);
  } catch (error) {
    console.error(chalk.red(`❌ Failed to parse source config: ${extractErrorMessage(error)}`));
    process.exit(1);
  }

  // Extract MCP servers
  const mcpServers = sourceConfig.mcpServers || {};

  if (Object.keys(mcpServers).length === 0) {
    console.log(formatWarning('No MCP servers found in source config'));
    process.exit(0);
  }

  console.log(formatInfo(`Found ${Object.keys(mcpServers).length} MCP server(s)\n`));

  // Detect config formats
  console.log(chalk.dim('Analyzing configurations...'));
  const detectionResults = detectMultipleConfigs(mcpServers);
  const summary = getDetectionSummary(detectionResults);

  console.log(formatInfo(
    'Detection summary:',
    [
      `Total: ${summary.total}`,
      `Valid: ${summary.valid}`,
      `Legacy format: ${summary.legacy}`,
      `Needs migration: ${summary.needsMigration}`,
      `Has issues: ${summary.hasIssues}`
    ]
  ));
  console.log('');

  // Run migration
  console.log(chalk.dim('Migrating configurations...\n'));
  const migrationResult = batchMigrateConfigs(mcpServers);

  // Display results
  console.log(formatBatchMigrationResult(migrationResult));
  console.log('');

  // If dry run, stop here
  if (options.dryRun) {
    console.log(formatInfo('Dry run complete. No files were modified.'));
    console.log(chalk.dim('Run without --dry-run to apply changes.'));
    return;
  }

  // Check if migration was successful
  if (migrationResult.failed > 0) {
    console.log(formatWarning(
      `${migrationResult.failed} server(s) failed to migrate.`,
      ['Fix the issues above and try again.', 'Use --dry-run to preview without making changes.']
    ));
    process.exit(1);
  }

  // Prepare target config
  let targetConfig: any = {};

  if (fs.existsSync(targetPath)) {
    // Load existing target config
    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      targetConfig = JSON.parse(raw);
    } catch (error) {
      console.error(chalk.red(`❌ Failed to parse existing target config: ${extractErrorMessage(error)}`));
      process.exit(1);
    }

    // Check for conflicts
    const existingServers = targetConfig.mcpServers || {};
    const conflicts = Object.keys(mcpServers).filter(name => existingServers[name]);

    if (conflicts.length > 0 && !options.force) {
      console.log(formatWarning(
        `The following servers already exist in ${targetPath}:`,
        conflicts.map(name => `  • ${name}`)
      ));
      console.log('');
      console.log(chalk.dim('Options:'));
      console.log(chalk.dim('  1. Use --force to overwrite existing configs'));
      console.log(chalk.dim('  2. Manually merge the configs'));
      console.log(chalk.dim('  3. Remove conflicting servers from source'));
      process.exit(1);
    }

    if (conflicts.length > 0 && options.force) {
      console.log(formatWarning(
        `Overwriting ${conflicts.length} existing server(s) (--force)`,
        conflicts
      ));
    }
  }

  // Create backup if requested
  if (options.backup && fs.existsSync(targetPath)) {
    const backupPath = `${targetPath}.backup-${Date.now()}`;
    console.log(chalk.dim(`Creating backup: ${backupPath}`));

    try {
      fs.copyFileSync(targetPath, backupPath);
      console.log(formatSuccess('Backup created'));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create backup: ${extractErrorMessage(error)}`));
      process.exit(1);
    }
  }

  // Merge migrated servers into target config
  targetConfig.mcpServers = targetConfig.mcpServers || {};

  for (const [name, result] of migrationResult.results.entries()) {
    if (result.success && result.migratedConfig) {
      targetConfig.mcpServers[name] = result.migratedConfig;
    }
  }

  // Ensure target directory exists
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Write target config
  console.log(chalk.dim(`Writing to ${targetPath}...`));

  try {
    fs.writeFileSync(targetPath, JSON.stringify(targetConfig, null, 2), 'utf-8');
    console.log(formatSuccess('Migration complete!'));
  } catch (error) {
    console.error(chalk.red(`❌ Failed to write target config: ${extractErrorMessage(error)}`));
    process.exit(1);
  }

  // Show next steps
  console.log('');
  console.log(chalk.bold('Next steps:'));
  console.log(chalk.dim('  1. Test your MCP servers: ax-cli mcp list'));
  console.log(chalk.dim('  2. Verify connections: ax-cli mcp test <server-name>'));
  console.log(chalk.dim('  3. (Optional) Remove old config: rm ' + sourcePath));
  console.log('');
}

export default createMCPMigrateCommand;
