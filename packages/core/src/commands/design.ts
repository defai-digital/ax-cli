/**
 * Design Command
 * CLI command for design system checks and enforcement
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as prompts from '@clack/prompts';
import {
  runDesignCheck,
  getAvailableRules,
} from '../design-check/index.js';
import type { CheckResultWithFixes } from '../design-check/index.js';
import { formatConsoleOutput } from '../design-check/reporter/console.js';
import { formatJsonOutput } from '../design-check/reporter/json.js';
import type { DesignCheckOptions } from '../design-check/types.js';

/**
 * Collect multiple values for an option
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Generate a simple progress bar for coverage display
 */
function getProgressBar(percentage: number): string {
  const width = 20;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return chalk.gray('[') + (percentage >= 80 ? chalk.green(bar) : percentage >= 50 ? chalk.yellow(bar) : chalk.red(bar)) + chalk.gray(']');
}

/**
 * Create the design command with subcommands
 */
export function createDesignCommand(): Command {
  const designCmd = new Command('design')
    .description('Design system tools and checks');

  // design check subcommand
  designCmd
    .command('check [paths...]')
    .description('Check code for design system violations')
    .option('--format <type>', 'Output format: stylish, json', 'stylish')
    .option('--config <path>', 'Config file path')
    .option('-q, --quiet', 'Only report errors, not warnings', false)
    .option(
      '--max-warnings <n>',
      'Exit with error if warnings exceed threshold (-1 = no limit)',
      '-1'
    )
    .option(
      '--ignore <pattern>',
      'Ignore pattern (can be repeated)',
      collect,
      []
    )
    .option('--rule <id>', 'Run only specific rule')
    .option('--no-color', 'Disable colored output')
    .option('--fix', 'Auto-fix violations (coming soon)', false)
    .option('--list-rules', 'List available rules')
    .action(async (paths: string[], options) => {
      try {
        // Handle --list-rules
        if (options.listRules) {
          const rules = getAvailableRules();
          console.log(chalk.cyan('\nAvailable rules:\n'));
          for (const rule of rules) {
            console.log(`  ${chalk.yellow(rule)}`);
          }
          console.log('');
          return;
        }

        // Build options
        const checkOptions: Partial<DesignCheckOptions> = {
          format: options.format as 'stylish' | 'json',
          config: options.config,
          quiet: options.quiet,
          maxWarnings: parseInt(options.maxWarnings, 10),
          ignorePatterns: options.ignore,
          rule: options.rule,
          noColor: !options.color,
          fix: options.fix,
        };

        // Default to current directory if no paths provided
        const targetPaths = paths.length > 0 ? paths : ['src'];

        // Show intro unless JSON output
        if (options.format !== 'json') {
          prompts.intro(chalk.cyan('Design Check'));
        }

        // Run the check
        const result = await runDesignCheck(targetPaths, checkOptions) as CheckResultWithFixes;

        // Output results
        if (options.format === 'json') {
          // Include fix results in JSON output
          const jsonOutput = {
            ...JSON.parse(formatJsonOutput(result)),
            fixes: result.fixResults ? {
              applied: result.totalFixesApplied,
              skipped: result.totalFixesSkipped,
              files: result.fixResults.map((fr) => ({
                file: fr.file,
                applied: fr.appliedCount,
                skipped: fr.skippedCount,
              })),
            } : undefined,
            coverage: result.coverage,
          };
          console.log(JSON.stringify(jsonOutput, null, 2));
        } else {
          const output = formatConsoleOutput(result, { noColor: !options.color, quiet: options.quiet });
          if (output) {
            console.log(output);
          }

          // Show fix results if fixes were applied
          if (options.fix && result.totalFixesApplied && result.totalFixesApplied > 0) {
            console.log('');
            console.log(chalk.green(`✓ Fixed ${result.totalFixesApplied} problem${result.totalFixesApplied === 1 ? '' : 's'}`));
            if (result.fixResults) {
              for (const fr of result.fixResults) {
                if (fr.appliedCount > 0) {
                  console.log(chalk.gray(`  ${fr.file}: ${fr.appliedCount} fix${fr.appliedCount === 1 ? '' : 'es'} applied`));
                }
              }
            }
            if (result.totalFixesSkipped && result.totalFixesSkipped > 0) {
              console.log(chalk.yellow(`  ${result.totalFixesSkipped} fix${result.totalFixesSkipped === 1 ? '' : 'es'} skipped (no matching token)`));
            }
          }

          // Show coverage summary
          if (result.coverage && !options.quiet) {
            const cov = result.coverage;
            if (cov.totalColors > 0 || cov.totalSpacing > 0) {
              console.log('');
              console.log(chalk.cyan('Token Coverage:'));
              if (cov.totalColors > 0) {
                const colorBar = getProgressBar(cov.colorCoverage);
                console.log(`  Colors:  ${colorBar} ${cov.colorCoverage}%`);
              }
              if (cov.totalSpacing > 0) {
                const spacingBar = getProgressBar(cov.spacingCoverage);
                console.log(`  Spacing: ${spacingBar} ${cov.spacingCoverage}%`);
              }
            }
          }
        }

        // Determine exit code
        if (result.summary.errors > 0) {
          process.exit(1);
        }

        const maxWarnings = parseInt(options.maxWarnings, 10);
        if (maxWarnings >= 0 && result.summary.warnings > maxWarnings) {
          if (options.format !== 'json') {
            console.log(
              chalk.yellow(
                `\nWarning threshold exceeded: ${result.summary.warnings} warnings (max: ${maxWarnings})`
              )
            );
          }
          process.exit(1);
        }

        // Success exit
        process.exit(0);
      } catch (error) {
        if (options.format === 'json') {
          console.log(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            })
          );
        } else {
          prompts.log.error(
            `Error: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        process.exit(2);
      }
    });

  // design init subcommand (for creating config)
  designCmd
    .command('init')
    .description('Initialize design check configuration')
    .option('--force', 'Overwrite existing config', false)
    .action(async (options) => {
      try {
        prompts.intro(chalk.cyan('Design Check Setup'));

        const fs = await import('fs');
        const path = await import('path');

        const configDir = path.join(process.cwd(), '.ax-cli');
        const configPath = path.join(configDir, 'design.json');

        // Check if config exists
        if (fs.existsSync(configPath) && !options.force) {
          prompts.log.warn(`Config already exists at ${configPath}`);
          prompts.log.info('Use --force to overwrite');
          prompts.outro('Setup cancelled');
          return;
        }

        // Create config directory
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }

        // Default config
        const defaultConfig = {
          $schema: 'https://ax-cli.dev/schemas/design-check.json',
          tokens: {
            colors: {
              primary: '#1e90ff',
              secondary: '#ff6b6b',
              success: '#4caf50',
              warning: '#ff9800',
              error: '#f44336',
              background: '#ffffff',
              text: '#212121',
              'text-muted': '#757575',
            },
            spacing: {
              xs: '4px',
              sm: '8px',
              md: '16px',
              lg: '24px',
              xl: '32px',
            },
          },
          rules: {
            'no-hardcoded-colors': 'error',
            'no-raw-spacing': 'warn',
            'no-inline-styles': 'warn',
            'missing-alt-text': 'error',
            'missing-form-labels': 'error',
          },
          include: ['src/**/*.tsx', 'src/**/*.jsx', 'src/**/*.css'],
          ignore: [
            '**/node_modules/**',
            '**/*.test.*',
            '**/*.spec.*',
            '**/stories/**',
          ],
        };

        // Write config
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));

        prompts.log.success(`Created config at ${configPath}`);
        prompts.log.info('Edit this file to customize your design tokens and rules');

        prompts.outro(chalk.green('Setup complete!'));
      } catch (error) {
        prompts.log.error(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  return designCmd;
}
