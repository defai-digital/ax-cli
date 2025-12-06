#!/usr/bin/env node
/**
 * ax-cli - Meta CLI for provider selection and installation
 *
 * This CLI helps users choose between ax-glm and ax-grok,
 * installs the selected provider, and can launch it.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { detectInstalledProvider, launchProvider } from './launcher.js';
import { runSetup } from './setup.js';

const VERSION = '1.0.0';
const NAME = 'ax-cli';

const program = new Command();

program
  .name(NAME)
  .description('AI coding assistant - choose your LLM provider')
  .version(VERSION);

/**
 * Setup command - select and install provider
 */
program
  .command('setup')
  .description('Select and install an LLM provider (ax-glm or ax-grok)')
  .action(async () => {
    await runSetup();
  });

/**
 * Status command - show current configuration
 */
program
  .command('status')
  .description('Show installed providers and current configuration')
  .action(async () => {
    console.log(chalk.cyan('\n  ax-cli Status\n'));

    const installed = await detectInstalledProvider();

    if (installed) {
      console.log(chalk.green(`  ✓ Installed provider: ax-${installed}`));
      console.log(chalk.dim(`    Run "ax-${installed}" to use the CLI\n`));
    } else {
      console.log(chalk.yellow('  No provider installed'));
      console.log(chalk.dim('    Run "ax-cli setup" to install a provider\n'));
    }
  });

/**
 * Default action - detect and launch or prompt setup
 */
program
  .argument('[args...]', 'Arguments to pass to the provider CLI')
  .action(async (args: string[]) => {
    // If no arguments, show help or status
    if (args.length === 0) {
      const installed = await detectInstalledProvider();

      if (installed) {
        // Launch the installed provider with help
        console.log(chalk.cyan(`\n  Launching ax-${installed}...\n`));
        await launchProvider(installed, ['--help']);
      } else {
        console.log(chalk.cyan('\n  Welcome to ax-cli!\n'));
        console.log('  No provider installed yet.');
        console.log('  Run ' + chalk.bold('ax-cli setup') + ' to get started.\n');
        console.log('  Available providers:');
        console.log('    • ' + chalk.bold('ax-glm') + ' - Optimized for GLM (ChatGLM/Z.AI)');
        console.log('    • ' + chalk.bold('ax-grok') + ' - Optimized for Grok (xAI) ' + chalk.dim('[coming soon]'));
        console.log();
      }
      return;
    }

    // Check for setup command
    if (args[0] === 'setup') {
      await runSetup();
      return;
    }

    // Try to detect and launch installed provider
    const installed = await detectInstalledProvider();

    if (!installed) {
      console.log(chalk.yellow('\n  No provider installed.'));
      console.log('  Run ' + chalk.bold('ax-cli setup') + ' to install a provider.\n');
      process.exit(1);
    }

    // Launch the installed provider with all arguments
    await launchProvider(installed, args);
  });

program.parse();
