import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import enquirer from 'enquirer';
import chalk from 'chalk';

/**
 * Provider configurations
 */
interface ProviderConfig {
  name: string;
  displayName: string;
  baseURL: string;
  defaultModel: string;
  requiresApiKey: boolean;
  website: string;
  description: string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  'z.ai': {
    name: 'z.ai',
    displayName: 'Z.AI (GLM Models)',
    baseURL: 'https://api.z.ai/api/coding/paas/v4',
    defaultModel: 'glm-4.6',
    requiresApiKey: true,
    website: 'https://z.ai',
    description: 'Z.AI with GLM 4.6 - Advanced reasoning and 200K context window'
  },
  'xai': {
    name: 'xai',
    displayName: 'xAI (Grok)',
    baseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-code-fast-1',
    requiresApiKey: true,
    website: 'https://x.ai',
    description: 'xAI Grok models - Fast coding assistance'
  },
  'openai': {
    name: 'openai',
    displayName: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4-turbo',
    requiresApiKey: true,
    website: 'https://platform.openai.com',
    description: 'OpenAI GPT models - Industry-leading language models'
  },
  'anthropic': {
    name: 'anthropic',
    displayName: 'Anthropic (Claude)',
    baseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    requiresApiKey: true,
    website: 'https://console.anthropic.com',
    description: 'Anthropic Claude models - Advanced AI assistant'
  },
  'ollama': {
    name: 'ollama',
    displayName: 'Ollama (Local)',
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    requiresApiKey: false,
    website: 'https://ollama.ai',
    description: 'Local models via Ollama - No API key required'
  }
};

/**
 * Setup command - Initialize ~/.ax-cli/config.json with provider selection
 */
export function createSetupCommand(): Command {
  const setupCommand = new Command('setup');

  setupCommand
    .description('Initialize AX CLI configuration with AI provider selection')
    .option('--force', 'Overwrite existing configuration')
    .action(async (options) => {
      try {
        console.log(chalk.cyan('\n🚀 AX CLI Setup\n'));

        // Always use the NEW path ~/.ax-cli/config.json
        const configPath = join(homedir(), '.ax-cli', 'config.json');
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

        // Provider selection
        console.log(chalk.cyan('\n📝 Configuration Setup\n'));

        const providerChoices = Object.entries(PROVIDERS).map(([key, provider]) => ({
          name: key,
          message: `${provider.displayName} - ${provider.description}`
        }));

        const providerResponse = await enquirer.prompt<{ provider: string }>({
          type: 'select',
          name: 'provider',
          message: 'Select your AI provider:',
          choices: providerChoices
        });

        const selectedProvider = PROVIDERS[providerResponse.provider];

        // API Key prompt (if required)
        let apiKey = '';
        if (selectedProvider.requiresApiKey) {
          console.log(chalk.dim(`\nGet your API key from: ${selectedProvider.website}\n`));

          const apiKeyResponse = await enquirer.prompt<{ apiKey: string }>({
            type: 'password',
            name: 'apiKey',
            message: `Enter your ${selectedProvider.displayName} API key:`,
            validate: (value: string) => {
              if (!value || value.trim().length === 0) {
                return 'API key is required';
              }
              return true;
            }
          });
          apiKey = apiKeyResponse.apiKey.trim();
        } else {
          console.log(chalk.green(`\n✓ ${selectedProvider.displayName} doesn't require an API key`));
        }

        // Create configuration object with comments
        // Use provider-specific max tokens (32k for GLM 4.6, others use reasonable defaults)
        const maxTokens = selectedProvider.name === 'z.ai' ? 32768 : 8192;

        const config = {
          _comment: 'AX CLI Configuration',
          _provider: selectedProvider.displayName,
          _website: selectedProvider.website,
          apiKey: apiKey,
          baseURL: selectedProvider.baseURL,
          model: selectedProvider.defaultModel,
          maxTokens: maxTokens,
          temperature: 0.7,
          mcpServers: {},
          _examples: {
            _comment: 'Example configurations for different providers',
            'z.ai': {
              baseURL: 'https://api.z.ai/api/coding/paas/v4',
              models: ['glm-4.6', 'glm-4-air', 'glm-4-airx']
            },
            'xai': {
              baseURL: 'https://api.x.ai/v1',
              models: ['grok-code-fast-1']
            },
            'openai': {
              baseURL: 'https://api.openai.com/v1',
              models: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']
            },
            'anthropic': {
              baseURL: 'https://api.anthropic.com/v1',
              models: ['claude-3-5-sonnet-20241022', 'claude-3-opus', 'claude-3-sonnet']
            },
            'ollama': {
              baseURL: 'http://localhost:11434/v1',
              models: ['llama3.1', 'codellama', 'mistral'],
              note: 'No API key required for local Ollama'
            }
          }
        };

        // Write configuration file
        writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

        console.log(chalk.green('\n✅ Configuration saved successfully!\n'));
        console.log(chalk.cyan('📄 Configuration details:\n'));
        console.log(chalk.dim('   Location:    ') + chalk.white(configPath));
        console.log(chalk.dim('   Provider:    ') + chalk.white(selectedProvider.displayName));
        console.log(chalk.dim('   Base URL:    ') + chalk.white(selectedProvider.baseURL));
        console.log(chalk.dim('   Model:       ') + chalk.white(selectedProvider.defaultModel));
        console.log(chalk.dim('   Max Tokens:  ') + chalk.white(maxTokens.toString()));
        console.log(chalk.dim('   Temperature: ') + chalk.white('0.7'));

        console.log(chalk.cyan('\n🎯 Next steps:\n'));
        console.log(chalk.white('   1. Start interactive mode:'));
        console.log(chalk.dim('      $ ') + chalk.green('ax-cli'));
        console.log(chalk.white('\n   2. Run a quick test:'));
        console.log(chalk.dim('      $ ') + chalk.green('ax-cli -p "Hello, introduce yourself"'));
        console.log(chalk.white('\n   3. Initialize a project:'));
        console.log(chalk.dim('      $ ') + chalk.green('ax-cli init'));

        console.log(chalk.cyan('\n💡 Tips:\n'));
        console.log(chalk.dim('   • Edit config manually:  ') + chalk.white(configPath));
        console.log(chalk.dim('   • See example configs:   ') + chalk.white('Check "_examples" in config file'));
        console.log(chalk.dim('   • View help:             ') + chalk.white('ax-cli --help'));
        console.log(chalk.dim('   • Documentation:         ') + chalk.white('https://github.com/defai-digital/ax-cli\n'));

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
