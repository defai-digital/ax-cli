/**
 * Setup Flow - Provider Selection and Installation
 */

import chalk from 'chalk';
import { select, confirm } from '@inquirer/prompts';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type Provider = 'glm' | 'grok';

interface ProviderInfo {
  name: string;
  description: string;
  package: string;
  available: boolean;
}

const PROVIDERS: Record<Provider, ProviderInfo> = {
  glm: {
    name: 'GLM (ChatGLM/Z.AI)',
    description: 'Optimized for GLM-4.6 with thinking mode support',
    package: '@ax-cli/glm',
    available: true,
  },
  grok: {
    name: 'Grok (xAI)',
    description: 'Optimized for Grok with vision and live search',
    package: '@ax-cli/grok',
    available: true,
  },
};

/**
 * Run the setup wizard
 */
export async function runSetup(): Promise<void> {
  console.log(chalk.cyan('\n  ╔════════════════════════════════════════╗'));
  console.log(chalk.cyan('  ║     Welcome to ax-cli Setup Wizard     ║'));
  console.log(chalk.cyan('  ╚════════════════════════════════════════╝\n'));

  console.log('  This wizard will help you install an AI coding assistant');
  console.log('  optimized for your preferred LLM provider.\n');

  // Select provider
  const provider = await select<Provider>({
    message: 'Which LLM provider do you want to use?',
    choices: Object.entries(PROVIDERS).map(([key, info]) => ({
      name: info.available
        ? `${info.name} - ${info.description}`
        : `${info.name} - ${info.description} ${chalk.dim('[coming soon]')}`,
      value: key as Provider,
      disabled: !info.available,
    })),
  });

  const providerInfo = PROVIDERS[provider];

  // Confirm installation
  const shouldInstall = await confirm({
    message: `Install ${providerInfo.name}?`,
    default: true,
  });

  if (!shouldInstall) {
    console.log(chalk.yellow('\n  Installation cancelled.\n'));
    return;
  }

  // Install the provider package
  const spinner = ora(`Installing ${providerInfo.package}...`).start();

  try {
    // Determine package manager
    const packageManager = await detectPackageManager();

    // Install command
    const installCmd = packageManager === 'pnpm'
      ? `pnpm add -g ${providerInfo.package}`
      : packageManager === 'yarn'
        ? `yarn global add ${providerInfo.package}`
        : `npm install -g ${providerInfo.package}`;

    await execAsync(installCmd);

    spinner.succeed(`${providerInfo.package} installed successfully!`);

    console.log(chalk.green('\n  ✓ Installation complete!\n'));
    console.log('  Next steps:');
    console.log(`    1. Run ${chalk.bold(`ax-${provider} setup`)} to configure your API key`);
    console.log(`    2. Run ${chalk.bold(`ax-${provider} "your task"`)} to start using the assistant`);
    console.log();

  } catch (error) {
    spinner.fail('Installation failed');

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(chalk.red(`\n  Error: ${errorMessage}`));
    console.log(chalk.yellow('\n  Try installing manually:'));
    console.log(`    npm install -g ${providerInfo.package}\n`);

    process.exit(1);
  }
}

/**
 * Detect which package manager to use
 */
async function detectPackageManager(): Promise<'npm' | 'pnpm' | 'yarn'> {
  // Check for pnpm
  try {
    await execAsync('pnpm --version');
    return 'pnpm';
  } catch {
    // Not found
  }

  // Check for yarn
  try {
    await execAsync('yarn --version');
    return 'yarn';
  } catch {
    // Not found
  }

  // Default to npm
  return 'npm';
}
