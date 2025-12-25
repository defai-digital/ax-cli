#!/usr/bin/env node
/**
 * ax-cli - Enterprise-Class AI Command Line Interface
 *
 * This CLI focuses on LOCAL/OFFLINE inference as primary use case:
 * - Ollama (primary)
 * - LMStudio
 * - vLLM
 *
 * Supports any model available in Ollama: Qwen, DeepSeek, Llama, Phi, Gemma, etc.
 *
 * NOTE: ax-cli is LOCAL/OFFLINE FIRST. For cloud provider features, use:
 * - ax-glm: npm install -g @defai.digital/ax-glm (web search, vision, image gen)
 * - ax-grok: npm install -g @defai.digital/ax-grok (web search, vision, X search)
 */

import { createCLI, AX_CLI_PROVIDER } from '@defai.digital/ax-core';
import { Command } from 'commander';
import chalk from 'chalk';
import { createRequire } from 'module';
import { runSetup } from './setup.js';
import { loadConfig, type AxCliConfig } from './config.js';

// Get version from package.json
const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const VERSION = pkg.version;

/**
 * Display the AX-CLI banner with cool theme
 */
function showBanner(): void {
  const logo = `
  ${chalk.blue('█████╗ ██╗  ██╗')}      ${chalk.magenta('██████╗██╗     ██╗')}
  ${chalk.blue('██╔══██╗╚██╗██╔╝')}     ${chalk.magenta('██╔════╝██║     ██║')}
  ${chalk.blue('███████║ ╚███╔╝')}${chalk.green('█████╗')}${chalk.magenta('██║     ██║     ██║')}
  ${chalk.blue('██╔══██║ ██╔██╗')}${chalk.green('╚════╝')}${chalk.magenta('██║     ██║     ██║')}
  ${chalk.blue('██║  ██║██╔╝ ██╗')}     ${chalk.magenta('╚██████╗███████╗██║')}
  ${chalk.blue('╚═╝  ╚═╝╚═╝  ╚═╝')}      ${chalk.magenta('╚═════╝╚══════╝╚═╝')}
  `;
  console.log(logo);
  console.log(chalk.gray('       Enterprise AI Coding Assistant\n'));
}

/**
 * Show status of current configuration
 */
function showStatus(config: AxCliConfig): void {
  console.log(chalk.blue('\n  ══════════════════════════════════════'));
  console.log(chalk.blue('  ║') + chalk.bold('       AX-CLI Status                ') + chalk.blue('║'));
  console.log(chalk.blue('  ══════════════════════════════════════\n'));

  if (config?.selectedProvider) {
    console.log(chalk.green('  ✓ Provider: ') + chalk.bold(config._provider || config.selectedProvider));
    console.log(chalk.gray('    Model: ') + (config.defaultModel || 'default'));
    if (config.baseURL) {
      console.log(chalk.gray('    API: ') + config.baseURL);
    }
    console.log();
    console.log(chalk.blue('  To start: ') + chalk.bold('ax-cli'));
    console.log(chalk.blue('  To reconfigure: ') + chalk.bold('ax-cli setup'));
  } else {
    console.log(chalk.yellow('  ⚠ No provider configured'));
    console.log();
    console.log('  Run ' + chalk.bold.blue('ax-cli setup') + ' to get started.\n');
  }
  console.log();
}

/**
 * Create ax-cli specific setup command
 */
function createAxCliSetupCommand(): Command {
  return new Command('setup')
    .description('Configure your local LLM provider (Ollama, LMStudio, vLLM)')
    .option('--force', 'Delete existing configuration and start fresh')
    .action(async (options: { force?: boolean }) => {
      showBanner();
      await runSetup({ force: options.force });
    });
}

/**
 * Create ax-cli specific config command (shows local provider configuration)
 */
function createAxCliConfigCommand(): Command {
  return new Command('config')
    .description('Show current local provider configuration')
    .action(() => {
      showBanner();
      const config = loadConfig();
      showStatus(config);
    });
}

/**
 * Check if ax-cli is configured, show helpful message if not
 */
function checkConfiguration(): boolean {
  const config = loadConfig();

  if (!config?.selectedProvider) {
    showBanner();
    console.log(chalk.yellow('  No provider configured yet.\n'));
    console.log('  Available providers:');
    console.log('    • ' + chalk.green('Local/Offline') + ' - Ollama, LMStudio, vLLM (recommended)');
    console.log();
    console.log('  Run ' + chalk.bold.blue('ax-cli setup') + ' to get started.\n');
    console.log(chalk.dim('  Note: For cloud provider features (web search, vision, image):'));
    console.log(chalk.dim('  • GLM: npm install -g @defai.digital/ax-glm'));
    console.log(chalk.dim('  • Grok: npm install -g @defai.digital/ax-grok\n'));
    return false;
  }

  return true;
}

// Build the ax-cli provider with local config overrides
function getAxCliProvider() {
  const config = loadConfig();

  return {
    ...AX_CLI_PROVIDER,
    // Override with user's configured settings
    defaultBaseURL: config.baseURL || AX_CLI_PROVIDER.defaultBaseURL,
    defaultModel: config.defaultModel || AX_CLI_PROVIDER.defaultModel,
  };
}

// Check args to see if we're running a subcommand that doesn't need config
const args = process.argv.slice(2);
const isSetupCommand = args[0] === 'setup';
const isConfigCommand = args[0] === 'config';
const isHelpCommand = args.includes('--help') || args.includes('-h');
const isVersionCommand = args.includes('--version') || args.includes('-v');
const isMcpCommand = args[0] === 'mcp';
const needsConfigCheck = !isSetupCommand && !isConfigCommand && !isHelpCommand && !isVersionCommand && !isMcpCommand;

// Check configuration before creating CLI (unless running setup/config/help/version/mcp)
if (needsConfigCheck && !checkConfiguration()) {
  process.exit(1);
}

// Create the CLI using core's factory with all features (including MCP!)
// Use skipSetupCommand to allow ax-cli to provide its own local-focused setup
const cli = createCLI({
  provider: getAxCliProvider(),
  version: VERSION,
  skipSetupCommand: true, // ax-cli provides its own setup command
});

// Add ax-cli specific commands
cli.addCommand(createAxCliSetupCommand());
cli.addCommand(createAxCliConfigCommand());

// Parse and run
cli.parse();
