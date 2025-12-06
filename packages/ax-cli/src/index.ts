#!/usr/bin/env node
/**
 * ax-cli - Meta CLI for provider selection and configuration
 *
 * This CLI helps users:
 * 1. Select between GLM and Grok providers
 * 2. Configure their API key and preferences
 * 3. Auto-launch the correct provider CLI based on saved preference
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { detectInstalledProvider, launchProvider, getConfiguredProvider } from './launcher.js';
import { runSetup } from './setup.js';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const VERSION = '1.0.0';
const NAME = 'ax-cli';

// Config paths
const CONFIG_FILE = join(homedir(), '.ax-cli', 'config.json');

interface AxCliConfig {
  selectedProvider?: 'glm' | 'grok';
  _provider?: string;
  defaultModel?: string;
}

function loadConfig(): AxCliConfig | null {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {
    // Ignore errors
  }
  return null;
}

const program = new Command();

program
  .name(NAME)
  .description('AI coding assistant - choose your LLM provider')
  .version(VERSION);

/**
 * Setup command - configure provider and API key
 */
program
  .command('setup')
  .description('Configure your LLM provider (GLM or Grok)')
  .action(async () => {
    await runSetup();
  });

/**
 * Status command - show current configuration
 */
program
  .command('status')
  .description('Show current provider configuration')
  .action(async () => {
    console.log(chalk.cyan('\n  ax-cli Status\n'));

    const config = loadConfig();
    const installed = await detectInstalledProvider();

    if (config?.selectedProvider) {
      const cliName = config.selectedProvider === 'glm' ? 'ax-glm' : 'ax-grok';
      console.log(chalk.green(`  ✓ Configured provider: ${config._provider || config.selectedProvider}`));
      console.log(chalk.dim(`    Model: ${config.defaultModel || 'default'}`));
      console.log(chalk.dim(`    CLI: ${cliName}`));
      console.log();

      if (installed) {
        console.log(chalk.green(`  ✓ ${cliName} is installed`));
        console.log(chalk.dim(`    Run "${cliName}" or "ax-cli" to start\n`));
      } else {
        console.log(chalk.yellow(`  ⚠ ${cliName} is not installed`));
        console.log(chalk.dim(`    Run "ax-cli setup" to install it\n`));
      }
    } else {
      console.log(chalk.yellow('  No provider configured'));
      console.log(chalk.dim('    Run "ax-cli setup" to get started\n'));
    }
  });

/**
 * Default action - auto-launch configured provider or prompt setup
 */
program
  .argument('[args...]', 'Arguments to pass to the provider CLI')
  .action(async (args: string[]) => {
    // Check for setup command
    if (args[0] === 'setup') {
      await runSetup();
      return;
    }

    // Check for status command
    if (args[0] === 'status') {
      program.commands.find(cmd => cmd.name() === 'status')?.parseAsync(['', '', 'status']);
      return;
    }

    // Try to detect configured/installed provider
    const provider = await detectInstalledProvider();

    if (!provider) {
      // Check if there's a configured provider that's not installed
      const configured = getConfiguredProvider();

      if (configured) {
        const cliName = configured === 'glm' ? 'ax-glm' : 'ax-grok';
        console.log(chalk.yellow(`\n  ${cliName} is configured but not installed.\n`));
        console.log('  Run ' + chalk.bold('ax-cli setup') + ' to install it.\n');
      } else {
        console.log(chalk.cyan('\n  Welcome to ax-cli!\n'));
        console.log('  No provider configured yet.');
        console.log('  Run ' + chalk.bold('ax-cli setup') + ' to get started.\n');
        console.log('  Available providers:');
        console.log('    • ' + chalk.bold('GLM (Z.AI)') + ' - GLM-4.6 with thinking mode and 200K context');
        console.log('    • ' + chalk.bold('Grok (xAI)') + ' - Grok 3 with extended thinking and live search');
        console.log();
      }
      process.exit(1);
    }

    const cliName = provider === 'glm' ? 'ax-glm' : 'ax-grok';

    // If no arguments, launch in interactive mode
    if (args.length === 0) {
      console.log(chalk.cyan(`\n  Launching ${cliName}...\n`));
      await launchProvider(provider, []);
      return;
    }

    // Launch the provider with all arguments
    await launchProvider(provider, args);
  });

program.parse();
