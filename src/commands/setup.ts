import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import enquirer from 'enquirer';
import chalk from 'chalk';
import { validateProviderSetup } from '../utils/setup-validator.js';
import { getSettingsManager } from '../utils/settings-manager.js';
import type { UserSettings } from '../schemas/settings-schemas.js';

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
  'z.ai-free': {
    name: 'z.ai-free',
    displayName: 'Z.AI (Free Plan)',
    baseURL: 'https://api.z.ai/api/paas/v4',
    defaultModel: 'glm-4.6',
    requiresApiKey: true,
    website: 'https://z.ai',
    description: 'Z.AI Free Plan - Standard API endpoint for non-coding-plan users'
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
 * Determine provider key from baseURL
 */
function getProviderFromBaseURL(baseURL: string): string | null {
  for (const [key, provider] of Object.entries(PROVIDERS)) {
    if (provider.baseURL === baseURL) {
      return key;
    }
  }
  return null;
}

/**
 * Setup command - Initialize ~/.ax-cli/config.json with provider selection
 */
export function createSetupCommand(): Command {
  const setupCommand = new Command('setup');

  setupCommand
    .description('Initialize AX CLI configuration with AI provider selection')
    .option('--force', 'Overwrite existing configuration')
    .option('--no-validate', 'Skip validation of API endpoint and credentials')
    .action(async (options) => {
      try {
        console.log(chalk.cyan('\n🚀 AX CLI Setup\n'));

        // Always use the NEW path ~/.ax-cli/config.json
        const configPath = join(homedir(), '.ax-cli', 'config.json');
        const configDir = dirname(configPath);

        // Ensure config directory exists
        if (!existsSync(configDir)) {
          mkdirSync(configDir, { recursive: true });
          console.log(chalk.green(`✓ Created config directory: ${configDir}`));
        }

        // Load existing config to check for existing API key BEFORE provider selection
        // Use settings manager to load decrypted config (REQ-SEC-003)
        let existingConfig: UserSettings | null = null;
        let existingProviderKey: string | null = null;

        if (existsSync(configPath)) {
          try {
            // Load settings through settings manager (handles decryption)
            const settingsManager = getSettingsManager();
            existingConfig = settingsManager.loadUserSettings();

            // Determine which provider the existing config is using
            if (existingConfig.baseURL) {
              existingProviderKey = getProviderFromBaseURL(existingConfig.baseURL);
            }

            // Show existing configuration
            if (existingProviderKey && !options.force) {
              const existingProvider = PROVIDERS[existingProviderKey];
              console.log(chalk.blue('ℹ️  Existing configuration found:'));
              console.log(chalk.dim(`   Provider: ${existingProvider?.displayName || 'Unknown'}`));
              console.log(chalk.dim(`   Location: ${configPath}\n`));
            }
          } catch (error) {
            console.warn(chalk.yellow('⚠️  Failed to load existing config:'), error instanceof Error ? error.message : 'Unknown error');
            // Continue with setup even if loading existing config fails
          }
        }

        // Provider selection
        console.log(chalk.cyan('📝 Configuration Setup\n'));

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
          const isSameProvider = existingProviderKey === providerResponse.provider;
          // existingConfig.apiKey is already decrypted string (loaded via loadUserSettings)
          const hasExistingKey = existingConfig?.apiKey && typeof existingConfig.apiKey === 'string' && existingConfig.apiKey.trim().length > 0;

          // Same provider with existing API key - ask if they want to reuse it
          if (isSameProvider && hasExistingKey) {
            console.log(chalk.green(`\n✓ Found existing API key for ${selectedProvider.displayName}`));
            // Display masked API key (handle short keys gracefully)
            // apiKey is guaranteed to be a string here (type guard in hasExistingKey)
            const key = existingConfig!.apiKey as string;
            const maskedKey = key.length > 12
              ? `${key.substring(0, 8)}...${key.substring(key.length - 4)}`
              : `${key.substring(0, Math.min(4, key.length))}...`;
            console.log(chalk.dim(`   Key: ${maskedKey}\n`));

            const reuseKeyResponse = await enquirer.prompt<{ reuseKey: boolean }>({
              type: 'confirm',
              name: 'reuseKey',
              message: 'Use existing API key?',
              initial: true
            });

            if (reuseKeyResponse.reuseKey) {
              apiKey = existingConfig!.apiKey;
              console.log(chalk.green('✓ Using existing API key'));
            } else {
              // Ask for new key
              console.log(chalk.dim(`\nGet your API key from: ${selectedProvider.website}\n`));
              const apiKeyResponse = await enquirer.prompt<{ apiKey: string }>({
                type: 'password',
                name: 'apiKey',
                message: `Enter your new ${selectedProvider.displayName} API key:`,
                validate: (value: string) => {
                  if (!value || value.trim().length === 0) {
                    return 'API key is required';
                  }
                  return true;
                }
              });
              apiKey = apiKeyResponse.apiKey.trim();
            }
          }
          // Different provider or no existing key - just ask for new key
          else {
            if (hasExistingKey && !isSameProvider && existingProviderKey) {
              const previousProvider = PROVIDERS[existingProviderKey];
              console.log(chalk.yellow(`\n⚠️  Switching from ${previousProvider?.displayName || 'previous provider'} to ${selectedProvider.displayName}`));
            }

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
          }
        } else {
          console.log(chalk.green(`\n✓ ${selectedProvider.displayName} doesn't require an API key`));
        }

        // Validate configuration before saving
        const validationResult = await validateProviderSetup(
          {
            baseURL: selectedProvider.baseURL,
            apiKey: apiKey,
            model: selectedProvider.defaultModel,
            providerName: selectedProvider.name,
          },
          !options.validate // Skip if --no-validate flag is used
        );

        // If validation failed, ask user if they want to save anyway
        if (!validationResult.success && options.validate !== false) {
          console.log(chalk.yellow('\n⚠️  Validation failed, but you can still save the configuration.\n'));

          const proceedAnyway = await enquirer.prompt<{ proceed: boolean }>({
            type: 'confirm',
            name: 'proceed',
            message: 'Save configuration anyway?',
            initial: false
          });

          if (!proceedAnyway.proceed) {
            console.log(chalk.blue('\n✨ Setup cancelled. Please check your settings and try again.\n'));
            return;
          }
        }

        // Create configuration object with comments
        // Use provider-specific max tokens (32k for GLM 4.6, others use reasonable defaults)
        const maxTokens = (selectedProvider.name === 'z.ai' || selectedProvider.name === 'z.ai-free') ? 32768 : 8192;

        const config = {
          _comment: 'AX CLI Configuration',
          _provider: selectedProvider.displayName,
          _website: selectedProvider.website,
          apiKey: apiKey,
          baseURL: selectedProvider.baseURL,
          defaultModel: selectedProvider.defaultModel,
          maxTokens: maxTokens,
          temperature: 0.7,
          mcpServers: {},
          _examples: {
            _comment: 'Example configurations for different providers',
            'z.ai-coding-plan': {
              baseURL: 'https://api.z.ai/api/coding/paas/v4',
              models: ['glm-4.6', 'glm-4-air', 'glm-4-airx'],
              note: 'For users with GLM Coding Plan subscription'
            },
            'z.ai-free': {
              baseURL: 'https://api.z.ai/api/paas/v4',
              models: ['glm-4.6', 'glm-4-air', 'glm-4-airx'],
              note: 'For free plan users'
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
        if (error?.message === 'canceled' || error?.name === 'canceled') {
          console.log(chalk.yellow('\n⚠️  Setup cancelled by user.\n'));
          process.exit(0);
        }

        console.error(chalk.red('\n❌ Setup failed:\n'));
        console.error(chalk.dim('   ') + (error instanceof Error ? error.message : String(error)) + '\n');
        process.exit(1);
      }
    });

  return setupCommand;
}
