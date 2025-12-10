#!/usr/bin/env node
/**
 * ax-cli - Enterprise-Class AI Command Line Interface
 *
 * This CLI focuses on LOCAL/OFFLINE inference as primary use case:
 * - Ollama (primary)
 * - LMStudio
 * - vLLM
 * - DeepSeek Cloud (only cloud provider)
 *
 * Supports any model available in Ollama: Qwen, DeepSeek, Llama, Phi, Gemma, etc.
 *
 * NOTE: ax-cli does NOT have provider-specific features like:
 * - Web search (native API)
 * - Image generation
 * - Vision capabilities
 *
 * For GLM features, use ax-glm: npm install -g @defai.digital/ax-glm
 * For Grok features, use ax-grok: npm install -g @defai.digital/ax-grok
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { runSetup } from './setup.js';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const VERSION = '4.3.14';
const NAME = 'ax-cli';

// Config paths
const CONFIG_FILE = join(homedir(), '.ax-cli', 'config.json');

interface AxCliConfig {
  selectedProvider?: 'local' | 'deepseek';
  _provider?: string;
  defaultModel?: string;
  apiKey?: string;
  baseURL?: string;
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
function showStatus(config: AxCliConfig | null): void {
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
 * Launch the CLI with the configured provider
 */
async function launchCLI(config: AxCliConfig, _args: string[]): Promise<void> {
  // Dynamically import the core module
  try {
    const core = await import('@defai.digital/ax-core');

    // Use AX_CLI_PROVIDER directly - it has no GLM/Grok specific features
    // Override baseURL and model from config if provided
    const axCliProvider = {
      ...core.AX_CLI_PROVIDER,
      // Override with user's configured settings
      defaultBaseURL: config.baseURL || core.AX_CLI_PROVIDER.defaultBaseURL,
      defaultModel: config.defaultModel || core.AX_CLI_PROVIDER.defaultModel,
    };

    // Run the CLI with AX-CLI provider (no web search, no vision, no image)
    core.runCLI({
      provider: axCliProvider,
      version: VERSION,
    });
  } catch (error) {
    // Core module not available - show helpful message
    console.log(chalk.yellow('\n  @defai.digital/ax-core is not installed.'));
    console.log('  Please install it first:\n');
    console.log(chalk.gray('    npm install -g @defai.digital/ax-core'));
    console.log();
    process.exit(1);
  }
}

const program = new Command();

program
  .name(NAME)
  .description('Enterprise-Class AI Command Line Interface')
  .version(VERSION);

/**
 * Setup command - configure provider and API key
 */
program
  .command('setup')
  .description('Configure your LLM provider')
  .action(async () => {
    showBanner();
    await runSetup();
  });

/**
 * Status command - show current configuration
 */
program
  .command('status')
  .description('Show current provider configuration')
  .action(() => {
    showBanner();
    const config = loadConfig();
    showStatus(config);
  });

/**
 * Default action - launch CLI or prompt setup
 */
program
  .argument('[message...]', 'Initial message to send to the AI')
  .action(async (messageArgs: string[]) => {
    const config = loadConfig();

    if (!config?.selectedProvider) {
      showBanner();
      console.log(chalk.yellow('  No provider configured yet.\n'));
      console.log('  Available providers:');
      console.log('    • ' + chalk.green('Local/Offline') + ' - Ollama, LMStudio, vLLM (recommended)');
      console.log('    • ' + chalk.magenta('DeepSeek') + ' - DeepSeek Cloud API');
      console.log();
      console.log('  Run ' + chalk.bold.blue('ax-cli setup') + ' to get started.\n');
      console.log(chalk.dim('  Note: For cloud provider features (web search, vision, image):'));
      console.log(chalk.dim('  • GLM: npm install -g @defai.digital/ax-glm'));
      console.log(chalk.dim('  • Grok: npm install -g @defai.digital/ax-grok\n'));
      process.exit(1);
    }

    // Launch the full CLI
    await launchCLI(config, messageArgs);
  });

program.parse();
