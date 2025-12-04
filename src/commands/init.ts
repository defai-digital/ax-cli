/**
 * Init command - DEPRECATED: Use 'ax-cli setup' instead
 *
 * This command is kept for backwards compatibility and redirects to setup.
 * The project initialization functionality has been integrated into the setup command.
 */

import { Command } from 'commander';
import chalk from 'chalk';

export function createInitCommand(): Command {
  const initCommand = new Command('init')
    .description('Initialize project (deprecated: use "ax-cli setup" instead)')
    .option('-f, --force', 'Force regeneration even if files exist', false)
    .option('-v, --verbose', 'Verbose output showing analysis details', false)
    .option('-d, --directory <dir>', 'Project directory to analyze')
    .option('-y, --yes', 'Skip interactive prompts and use defaults', false)
    .option('--no-interaction', 'Run in non-interactive mode', false)
    .option('-t, --template <template-id>', 'Use a specific template')
    .option('--preview', 'Preview changes before applying', false)
    .option('--dry-run', 'Show what would be done without making changes', false)
    .option('--validate', 'Run validation checks only', false)
    .action(async (options: {
      force?: boolean;
      verbose?: boolean;
      directory?: string;
      yes?: boolean;
      noInteraction?: boolean;
      template?: string;
      preview?: boolean;
      dryRun?: boolean;
      validate?: boolean;
    }) => {
      // Show deprecation notice
      console.log(chalk.yellow('\n⚠️  Deprecation Notice:'));
      console.log(chalk.yellow('   "ax-cli init" has been merged into "ax-cli setup"'));
      console.log(chalk.yellow('   Please use "ax-cli setup" for full configuration.\n'));

      // Build equivalent setup command
      const args: string[] = ['setup'];
      if (options.force) args.push('--force');
      if (options.verbose) args.push('--verbose');
      if (options.directory) args.push('-d', options.directory);

      // Note: Some init-specific options (template, preview, dry-run, validate)
      // are not directly supported in setup. Show guidance.
      if (options.template || options.preview || options.dryRun || options.validate) {
        console.log(chalk.dim('Note: Some options (--template, --preview, --dry-run, --validate)'));
        console.log(chalk.dim('are not available in the new setup command.\n'));
      }

      console.log(chalk.cyan('Equivalent command:'));
      console.log(chalk.cyan(`  ax-cli ${args.join(' ')}\n`));

      // Instead of running, just inform the user
      console.log('Run the setup command to configure your project.\n');
    });

  return initCommand;
}
