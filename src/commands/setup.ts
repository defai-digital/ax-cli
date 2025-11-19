import { Command } from 'commander';
import { getSettingsManager } from '../utils/settings-manager.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import enquirer from 'enquirer';
import chalk from 'chalk';

/**
 * Default configuration template for z.ai with GLM 4.6
 */
const DEFAULT_CONFIG = {
  apiKey: '',
  baseURL: 'https://api.x.ai/v1',
  model: 'glm-4.6',
  maxTokens: 8192,
  temperature: 0.7,
  mcpServers: {}
};

/**
 * Setup command - Initialize ~/.ax-cli/config.json with z.ai and GLM 4.6
 */
export function createSetupCommand(): Command {
  const setupCommand = new Command('setup');

  setupCommand
    .description('Initialize AX CLI configuration with z.ai and GLM 4.6')
    .option('--force', 'Overwrite existing configuration')
    .action(async (options) => {
      try {
        console.log(chalk.cyan('\n🚀 AX CLI Setup\n'));

        const manager = getSettingsManager();
        const configPath = manager.getUserSettingsPath();
        const configDir = dirname(configPath);

        // Check if config already exists
        if (existsSync(configPath) && !options.force) {
          console.log(chalk.yellow('⚠️  Configuration file already exists at:'));
          console.log(chalk.dim(`   ${configPath}\n`));

          const overwrite = await enquirer.prompt<{ overwrite: boolean }>({
            type: 'confirm',
            name: 'overwrite',
            message: 'Do you want to overwrite the existing configuration?',
            initial: false
          });

          if (!overwrite.overwrite) {
            console.log(chalk.blue('\n✨ Setup cancelled. Using existing configuration.\n'));
            return;
          }
        }

        // Ensure config directory exists
        if (!existsSync(configDir)) {
          mkdirSync(configDir, { recursive: true });
          console.log(chalk.green(`✓ Created config directory: ${configDir}`));
        }

        // Prompt for API key
        console.log(chalk.cyan('\n📝 Configuration Setup\n'));
        console.log(chalk.dim('We\'ll set up your AX CLI with z.ai (https://x.ai) and GLM 4.6.\n'));

        const response = await enquirer.prompt<{ apiKey: string }>({
          type: 'password',
          name: 'apiKey',
          message: 'Enter your z.ai API key:',
          validate: (value: string) => {
            if (!value || value.trim().length === 0) {
              return 'API key is required';
            }
            return true;
          }
        });

        // Create configuration object
        const config = {
          ...DEFAULT_CONFIG,
          apiKey: response.apiKey.trim()
        };

        // Write configuration file
        writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

        console.log(chalk.green('\n✅ Configuration saved successfully!\n'));
        console.log(chalk.cyan('📄 Configuration details:\n'));
        console.log(chalk.dim('   Location:    ') + chalk.white(configPath));
        console.log(chalk.dim('   Provider:    ') + chalk.white('z.ai (https://x.ai)'));
        console.log(chalk.dim('   Base URL:    ') + chalk.white(config.baseURL));
        console.log(chalk.dim('   Model:       ') + chalk.white(config.model));
        console.log(chalk.dim('   Max Tokens:  ') + chalk.white(config.maxTokens.toString()));
        console.log(chalk.dim('   Temperature: ') + chalk.white(config.temperature.toString()));

        console.log(chalk.cyan('\n🎯 Next steps:\n'));
        console.log(chalk.white('   1. Start interactive mode:'));
        console.log(chalk.dim('      $ ') + chalk.green('ax-cli'));
        console.log(chalk.white('\n   2. Run a quick test:'));
        console.log(chalk.dim('      $ ') + chalk.green('ax-cli -p "Hello, introduce yourself"'));
        console.log(chalk.white('\n   3. Initialize a project:'));
        console.log(chalk.dim('      $ ') + chalk.green('ax-cli init'));

        console.log(chalk.cyan('\n💡 Tips:\n'));
        console.log(chalk.dim('   • Edit config:     ') + chalk.white(configPath));
        console.log(chalk.dim('   • View help:       ') + chalk.white('ax-cli --help'));
        console.log(chalk.dim('   • Documentation:   ') + chalk.white('https://github.com/defai-digital/ax-cli\n'));

      } catch (error: any) {
        if (error.message === 'canceled' || error.name === 'canceled') {
          console.log(chalk.yellow('\n⚠️  Setup cancelled by user.\n'));
          process.exit(0);
        }

        console.error(chalk.red('\n❌ Setup failed:\n'));
        console.error(chalk.dim('   ') + error.message + '\n');
        process.exit(1);
      }
    });

  return setupCommand;
}
