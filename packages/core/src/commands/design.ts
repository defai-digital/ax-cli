/**
 * Design Command
 *
 * CLI commands for Figma design integration.
 *
 * Usage:
 *   ax-cli design map <file-key> [--depth N] [--json]
 *   ax-cli design alias add <alias> <file-key> <node-id>
 *   ax-cli design alias list
 *   ax-cli design alias remove <alias>
 *   ax-cli design tokens pull <file-key> [--format json|tailwind]
 *   ax-cli design tokens compare <file-key> <local-path>
 *   ax-cli design auth status
 *
 * @module commands/design
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { extractErrorMessage } from '../utils/error-handler.js';
import {
  getFigmaClient,
  mapFigmaFile,
  formatMapResult,
  addAlias,
  removeAlias,
  listAliases,
  resolveAlias,
  setDefaultFile,
  setDsFile,
  extractTokensFromVariables,
  formatTokens,
  compareTokens,
  formatComparison,
  auditDesign,
  formatAuditResult,
  formatAuditSummary,
  type TreeDisplayOptions,
  type MapOutputFormat,
} from '../design/index.js';
import type { AuditRuleId } from '@defai.digital/ax-schemas';

// =============================================================================
// Command Creation
// =============================================================================

export function createDesignCommand(): Command {
  const designCommand = new Command('design');
  designCommand.description('Figma design integration commands');

  // ===========================================================================
  // Auth Commands
  // ===========================================================================

  const authCommand = designCommand
    .command('auth')
    .description('Manage Figma authentication');

  authCommand
    .command('status')
    .description('Check Figma authentication status')
    .action(async () => {
      const token = process.env.FIGMA_ACCESS_TOKEN;

      if (!token) {
        console.log(chalk.red('Not authenticated'));
        console.log();
        console.log(chalk.gray('To authenticate:'));
        console.log(chalk.gray('  1. Get a personal access token from https://www.figma.com/settings'));
        console.log(chalk.gray('  2. Set the environment variable:'));
        console.log(chalk.cyan('     export FIGMA_ACCESS_TOKEN="your-token"'));
        return;
      }

      // Test the token with a simple request
      try {
        // Create client to validate token (client creation validates token format)
        getFigmaClient(token);
        console.log(chalk.green('Authenticated'));
        console.log(chalk.gray(`Token: ${token.slice(0, 8)}...${token.slice(-4)}`));

        // Try to get user info (if available)
        console.log();
        console.log(chalk.gray('Token appears to be valid.'));
      } catch (error) {
        console.log(chalk.yellow('Token configured but may be invalid'));
        console.log(chalk.gray(`Token: ${token.slice(0, 8)}...${token.slice(-4)}`));
        console.log(chalk.red(`Error: ${extractErrorMessage(error)}`));
      }
    });

  // ===========================================================================
  // Map Commands
  // ===========================================================================

  designCommand
    .command('map <file-key>')
    .description('Map a Figma file structure')
    .option('-d, --depth <number>', 'Maximum depth to traverse', parseInt)
    .option('-f, --format <format>', 'Output format: tree, json, flat', 'tree')
    .option('--show-ids', 'Include node IDs in output')
    .option('--show-types', 'Include node types in output')
    .option('--frames-only', 'Show only frames and components')
    .option('-o, --output <file>', 'Write output to file')
    .action(async (fileKey: string, options) => {
      try {
        console.log(chalk.blue(`Fetching Figma file ${fileKey}...`));

        const client = getFigmaClient();
        const response = await client.getFile(fileKey, {
          depth: options.depth,
        });

        const treeOptions: TreeDisplayOptions = {
          maxDepth: options.depth,
          showIds: options.showIds,
          showTypes: options.showTypes,
          framesOnly: options.framesOnly,
        };

        const mapResult = mapFigmaFile(response, fileKey, treeOptions);
        const output = formatMapResult(mapResult, options.format as MapOutputFormat, treeOptions);

        if (options.output) {
          writeFileSync(options.output, output, 'utf-8');
          console.log(chalk.green(`Output written to ${options.output}`));
        } else {
          console.log();
          console.log(output);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${extractErrorMessage(error)}`));
        process.exit(1);
      }
    });

  // ===========================================================================
  // Alias Commands
  // ===========================================================================

  const aliasCommand = designCommand
    .command('alias')
    .description('Manage design aliases');

  aliasCommand
    .command('add <alias> <file-key> <node-id>')
    .description('Add a design alias')
    .option('--description <text>', 'Description for this alias')
    .action((alias: string, fileKey: string, nodeId: string, options) => {
      const result = addAlias(alias, fileKey, nodeId, {
        description: options.description,
      });

      if (result.success) {
        console.log(chalk.green(result.message));
      } else {
        console.error(chalk.red(result.message));
        process.exit(1);
      }
    });

  aliasCommand
    .command('remove <alias>')
    .description('Remove a design alias')
    .action((alias: string) => {
      const result = removeAlias(alias);

      if (result.success) {
        console.log(chalk.green(result.message));
      } else {
        console.error(chalk.red(result.message));
        process.exit(1);
      }
    });

  aliasCommand
    .command('list')
    .description('List all design aliases')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const response = listAliases();

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      if (response.total === 0) {
        console.log(chalk.yellow('No aliases defined.'));
        console.log();
        console.log(chalk.gray('Add an alias with:'));
        console.log(chalk.cyan('  ax-cli design alias add <alias> <file-key> <node-id>'));
        return;
      }

      console.log(chalk.blue.bold('Design Aliases'));
      console.log();

      if (response.defaultFile) {
        console.log(chalk.gray(`Default file: ${response.defaultFile}`));
      }
      if (response.dsFile) {
        console.log(chalk.gray(`Design system file: ${response.dsFile}`));
      }
      if (response.defaultFile || response.dsFile) {
        console.log();
      }

      for (const entry of response.aliases) {
        console.log(`${chalk.bold(entry.alias)}`);
        console.log(chalk.gray(`  File: ${entry.fileKey}`));
        console.log(chalk.gray(`  Node: ${entry.nodeId}`));
        if (entry.description) {
          console.log(chalk.gray(`  Description: ${entry.description}`));
        }
        if (entry.updatedAt) {
          console.log(chalk.gray(`  Updated: ${entry.updatedAt}`));
        }
        console.log();
      }

      console.log(chalk.gray(`Total: ${response.total} alias(es)`));
    });

  aliasCommand
    .command('resolve <alias>')
    .description('Resolve an alias to file key and node ID')
    .action((alias: string) => {
      const result = resolveAlias(alias);

      if ('error' in result) {
        console.error(chalk.red(result.error));
        if (result.suggestions && result.suggestions.length > 0) {
          console.log();
          console.log(chalk.gray('Did you mean:'));
          for (const suggestion of result.suggestions) {
            console.log(chalk.cyan(`  ${suggestion}`));
          }
        }
        process.exit(1);
      }

      console.log(chalk.green(`Alias: ${result.alias}`));
      console.log(chalk.gray(`File: ${result.fileKey}`));
      console.log(chalk.gray(`Node: ${result.nodeId}`));
      console.log(chalk.gray(`Source: ${result.source}`));
    });

  aliasCommand
    .command('set-default <file-key>')
    .description('Set the default Figma file')
    .action((fileKey: string) => {
      const result = setDefaultFile(fileKey);

      if (result.success) {
        console.log(chalk.green(result.message));
      } else {
        console.error(chalk.red(result.message));
        process.exit(1);
      }
    });

  aliasCommand
    .command('set-ds <file-key>')
    .description('Set the design system file')
    .action((fileKey: string) => {
      const result = setDsFile(fileKey);

      if (result.success) {
        console.log(chalk.green(result.message));
      } else {
        console.error(chalk.red(result.message));
        process.exit(1);
      }
    });

  // ===========================================================================
  // Token Commands
  // ===========================================================================

  const tokensCommand = designCommand
    .command('tokens')
    .description('Extract and manage design tokens');

  tokensCommand
    .command('pull <file-key>')
    .description('Extract design tokens from a Figma file')
    .option('-f, --format <format>', 'Output format: json, tailwind, css, scss', 'json')
    .option('-o, --output <file>', 'Write output to file')
    .option('--color-format <format>', 'Color format: hex, rgb, hsl', 'hex')
    .option('--dimension-unit <unit>', 'Dimension unit: px, rem', 'px')
    .option('--rem-base <number>', 'Base value for rem conversion', '16')
    .action(async (fileKey: string, options) => {
      try {
        console.log(chalk.blue(`Fetching variables from ${fileKey}...`));

        const client = getFigmaClient();
        const response = await client.getLocalVariables(fileKey);

        const tokens = extractTokensFromVariables(response, {
          colorFormat: options.colorFormat,
          dimensionUnit: options.dimensionUnit,
          remBase: parseInt(options.remBase, 10),
        });

        const output = formatTokens(tokens, options.format);

        if (options.output) {
          writeFileSync(options.output, output, 'utf-8');
          console.log(chalk.green(`Tokens written to ${options.output}`));
        } else {
          console.log();
          console.log(output);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${extractErrorMessage(error)}`));
        process.exit(1);
      }
    });

  tokensCommand
    .command('compare <file-key> <local-path>')
    .description('Compare Figma tokens with local tokens file')
    .option('--json', 'Output as JSON')
    .action(async (fileKey: string, localPath: string, options) => {
      try {
        if (!existsSync(localPath)) {
          console.error(chalk.red(`Local file not found: ${localPath}`));
          process.exit(1);
        }

        console.log(chalk.blue(`Comparing tokens...`));

        const client = getFigmaClient();
        const response = await client.getLocalVariables(fileKey);
        const figmaTokens = extractTokensFromVariables(response);

        const localContent = readFileSync(localPath, 'utf-8');
        let localTokens;
        try {
          localTokens = JSON.parse(localContent);
        } catch {
          console.error(`Error: Failed to parse ${localPath} as JSON. File may be corrupted.`);
          process.exit(1);
        }

        const comparison = compareTokens(figmaTokens, localTokens, fileKey, localPath);

        if (options.json) {
          console.log(JSON.stringify(comparison, null, 2));
        } else {
          console.log();
          console.log(formatComparison(comparison));
        }

        // Exit with non-zero if there are differences
        if (comparison.summary.added > 0 || comparison.summary.removed > 0 || comparison.summary.modified > 0) {
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${extractErrorMessage(error)}`));
        process.exit(1);
      }
    });

  // ===========================================================================
  // Select Command (Basic implementation)
  // ===========================================================================

  designCommand
    .command('select <file-key>')
    .description('Find nodes in a Figma file')
    .option('--name <pattern>', 'Search by name (partial match)')
    .option('--type <type>', 'Filter by node type')
    .option('--text <content>', 'Search text nodes by content')
    .option('--limit <number>', 'Maximum results', '10')
    .option('--json', 'Output as JSON')
    .action(async (fileKey: string, options) => {
      try {
        if (!options.name && !options.type && !options.text) {
          console.error(chalk.red('At least one search option required: --name, --type, or --text'));
          process.exit(1);
        }

        console.log(chalk.blue(`Searching in ${fileKey}...`));

        const client = getFigmaClient();
        const response = await client.getFile(fileKey);

        const { findNodes, mapFigmaFile, getNodePath } = await import('../design/index.js');

        const mapResult = mapFigmaFile(response, fileKey);
        const limit = parseInt(options.limit, 10);

        // Pre-compute lowercase search terms once (avoid repeated toLowerCase in callback)
        const nameLower = options.name?.toLowerCase();
        const typeUpper = options.type?.toUpperCase();
        const textLower = options.text?.toLowerCase();

        const results = findNodes(mapResult.root, (node) => {
          if (nameLower && !node.name.toLowerCase().includes(nameLower)) {
            return false;
          }
          if (typeUpper && node.type !== typeUpper) {
            return false;
          }
          if (textLower && (!node.characters || !node.characters.toLowerCase().includes(textLower))) {
            return false;
          }
          return true;
        }, limit);

        if (results.length === 0) {
          console.log(chalk.yellow('No matching nodes found.'));
          return;
        }

        if (options.json) {
          const jsonResults = results.map((node) => ({
            id: node.id,
            name: node.name,
            type: node.type,
            path: getNodePath(mapResult.root, node.id)?.join(' > '),
            characters: node.characters,
          }));
          console.log(JSON.stringify(jsonResults, null, 2));
        } else {
          console.log();
          console.log(chalk.blue.bold(`Found ${results.length} node(s):`));
          console.log();

          for (const node of results) {
            const path = getNodePath(mapResult.root, node.id);
            console.log(`${chalk.bold(node.name)} [${node.type}]`);
            console.log(chalk.gray(`  ID: ${node.id}`));
            if (path) {
              console.log(chalk.gray(`  Path: ${path.join(' > ')}`));
            }
            if (node.characters) {
              console.log(chalk.gray(`  Text: "${node.characters}"`));
            }
            console.log();
          }
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${extractErrorMessage(error)}`));
        process.exit(1);
      }
    });

  // ===========================================================================
  // Audit Commands
  // ===========================================================================

  designCommand
    .command('audit <file-key>')
    .description('Run design audit on a Figma file')
    .option('-d, --depth <number>', 'Maximum depth to traverse', parseInt)
    .option('--rules <rules>', 'Comma-separated list of rules to run')
    .option('--exclude <rules>', 'Comma-separated list of rules to exclude')
    .option('--fail-on-warning', 'Exit with error on warnings')
    .option('--json', 'Output as JSON')
    .option('-o, --output <file>', 'Write output to file')
    .option('--summary', 'Show only summary (compact output)')
    .action(async (fileKey: string, options) => {
      try {
        console.log(chalk.blue(`Auditing Figma file ${fileKey}...`));

        const client = getFigmaClient();
        const response = await client.getFile(fileKey, {
          depth: options.depth,
        });

        const mapResult = mapFigmaFile(response, fileKey);

        // Build audit config
        const auditConfig: {
          maxDepth?: number;
          failOnError?: boolean;
          failOnWarning?: boolean;
          rules?: AuditRuleId[];
          excludeRules?: AuditRuleId[];
        } = {
          maxDepth: options.depth,
          failOnError: true,
          failOnWarning: options.failOnWarning ?? false,
        };

        if (options.rules) {
          auditConfig.rules = options.rules.split(',').map((r: string) => r.trim()) as AuditRuleId[];
        }

        if (options.exclude) {
          auditConfig.excludeRules = options.exclude.split(',').map((r: string) => r.trim()) as AuditRuleId[];
        }

        const result = auditDesign(mapResult, auditConfig);

        // Output
        let output: string;
        if (options.json) {
          output = JSON.stringify(result, null, 2);
        } else if (options.summary) {
          output = formatAuditSummary(result);
        } else {
          output = formatAuditResult(result);
        }

        if (options.output) {
          writeFileSync(options.output, output, 'utf-8');
          console.log(chalk.green(`Audit report written to ${options.output}`));
        } else {
          console.log();
          console.log(output);
        }

        // Exit code based on issues
        if (result.summary.issueCount.error > 0) {
          console.log();
          console.log(chalk.red(`Audit failed: ${result.summary.issueCount.error} error(s) found`));
          process.exit(1);
        }

        if (options.failOnWarning && result.summary.issueCount.warning > 0) {
          console.log();
          console.log(chalk.yellow(`Audit failed: ${result.summary.issueCount.warning} warning(s) found`));
          process.exit(1);
        }

        if (result.summary.issueCount.total > 0) {
          console.log();
          console.log(chalk.yellow(`Audit completed with ${result.summary.issueCount.total} issue(s)`));
        } else {
          console.log();
          console.log(chalk.green('Audit passed: No issues found'));
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${extractErrorMessage(error)}`));
        process.exit(1);
      }
    });

  // Audit rules list subcommand
  designCommand
    .command('audit-rules')
    .description('List available audit rules')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const rules = [
        { id: 'layer-naming', name: 'Layer Naming', category: 'naming', severity: 'info', description: 'Check for generic layer names (Frame 1, Rectangle 1, etc.)' },
        { id: 'missing-autolayout', name: 'Missing Auto-Layout', category: 'best-practices', severity: 'info', description: 'Identify frames without auto-layout that might benefit from it' },
        { id: 'naming-convention', name: 'Naming Convention', category: 'naming', severity: 'info', description: 'Check that layer names follow conventions' },
        { id: 'text-overflow', name: 'Text Overflow', category: 'best-practices', severity: 'warning', description: 'Detect text that may overflow its container' },
        { id: 'component-usage', name: 'Component Usage', category: 'best-practices', severity: 'info', description: 'Check that components are used instead of detached instances' },
        { id: 'spacing-consistency', name: 'Spacing Consistency', category: 'consistency', severity: 'warning', description: 'Check that spacing values match design system tokens' },
        { id: 'font-consistency', name: 'Font Consistency', category: 'consistency', severity: 'warning', description: 'Check that fonts match design system typography' },
        { id: 'token-usage', name: 'Token Usage', category: 'consistency', severity: 'warning', description: 'Check that colors and text styles use defined tokens' },
        { id: 'color-contrast', name: 'Color Contrast', category: 'accessibility', severity: 'error', description: 'Check WCAG color contrast requirements' },
        { id: 'image-resolution', name: 'Image Resolution', category: 'performance', severity: 'warning', description: 'Check that images have sufficient resolution (disabled by default)' },
      ];

      if (options.json) {
        console.log(JSON.stringify(rules, null, 2));
        return;
      }

      console.log(chalk.blue.bold('Available Audit Rules'));
      console.log();

      // Group by category
      const categories = ['naming', 'best-practices', 'consistency', 'accessibility', 'performance'];
      for (const category of categories) {
        const categoryRules = rules.filter((r) => r.category === category);
        if (categoryRules.length === 0) continue;

        console.log(chalk.bold(category.toUpperCase()));
        for (const rule of categoryRules) {
          const severityColor = rule.severity === 'error' ? chalk.red : rule.severity === 'warning' ? chalk.yellow : chalk.gray;
          console.log(`  ${chalk.cyan(rule.id)} [${severityColor(rule.severity)}]`);
          console.log(chalk.gray(`    ${rule.description}`));
        }
        console.log();
      }

      console.log(chalk.gray('Use --rules to run specific rules, --exclude to skip rules'));
      console.log(chalk.gray('Example: ax-cli design audit <file-key> --rules layer-naming,text-overflow'));
    });

  return designCommand;
}
