import { Command } from 'commander';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { execSync, spawnSync } from 'child_process';
import enquirer from 'enquirer';
import chalk from 'chalk';
import { validateProviderSetup } from '../utils/setup-validator.js';
import { getSettingsManager } from '../utils/settings-manager.js';
import { extractErrorMessage } from '../utils/error-handler.js';
import type { UserSettings } from '../schemas/settings-schemas.js';
import { CONFIG_PATHS } from '../constants.js';
import {
  detectZAIServices,
  getRecommendedServers,
  generateZAIServerConfig,
  ZAI_MCP_TEMPLATES,
} from '../mcp/index.js';
import { addMCPServer } from '../mcp/config.js';

/**
 * Check if AutomatosX (ax) is installed
 */
function isAutomatosXInstalled(): boolean {
  try {
    const result = spawnSync('ax', ['--version'], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Get AutomatosX version if installed
 */
function getAutomatosXVersion(): string | null {
  try {
    const result = spawnSync('ax', ['--version'], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    if (result.status === 0 && result.stdout) {
      // Extract version from output (e.g., "ax version 1.2.3")
      const match = result.stdout.match(/(\d+\.\d+\.\d+)/);
      return match ? match[1] : result.stdout.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Update AutomatosX to latest version
 */
async function updateAutomatosX(): Promise<boolean> {
  try {
    execSync('ax update -y', {
      stdio: 'inherit',
      timeout: 120000 // 2 minutes timeout
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install AutomatosX globally
 */
async function installAutomatosX(): Promise<boolean> {
  try {
    execSync('npm install -g @defai.digital/automatosx', {
      stdio: 'inherit',
      timeout: 180000 // 3 minutes timeout
    });
    return true;
  } catch {
    return false;
  }
}

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

/** Prompt for a new API key with validation */
async function promptForApiKey(providerDisplayName: string, website: string): Promise<string> {
  console.log(chalk.dim(`\nGet your API key from: ${website}\n`));
  const response = await enquirer.prompt<{ apiKey: string }>({
    type: 'password',
    name: 'apiKey',
    message: `Enter your ${providerDisplayName} API key:`,
    validate: (value: string) => value?.trim().length > 0 || 'API key is required',
  });
  return response.apiKey.trim();
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

  const STEP_TOTAL = 5;
  const step = (index: number, title: string) => chalk.cyan(`\nStep ${index}/${STEP_TOTAL} — ${title}\n`);

  setupCommand
    .description('Initialize AX CLI configuration with AI provider selection')
    .option('--force', 'Overwrite existing configuration')
    .option('--no-validate', 'Skip validation of API endpoint and credentials')
    .action(async (options) => {
      try {
        console.log(chalk.cyan('\n🚀 AX CLI Setup\n'));

        // Always use the NEW path ~/.ax-cli/config.json
        const configPath = CONFIG_PATHS.USER_CONFIG;
        const configDir = dirname(configPath);
        const settingsManager = getSettingsManager();

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
        console.log(step(1, 'Choose provider'));

        const providerChoices = Object.entries(PROVIDERS).map(([key, provider]) => ({
          name: key,
          message: `${provider.displayName} - ${provider.description}`,
          hint: provider.website,
        }));

        const providerResponse = await enquirer.prompt<{ provider: string }>({
          type: 'select',
          name: 'provider',
          message: 'Select your AI provider:',
          choices: providerChoices,
          initial: existingProviderKey
            ? providerChoices.findIndex(choice => choice.name === existingProviderKey)
            : 0,
        });

        const selectedProvider = PROVIDERS[providerResponse.provider];

        // API Key prompt (if required)
        let apiKey = '';
        if (selectedProvider.requiresApiKey) {
          console.log(step(2, 'Add API key'));
          const isSameProvider = existingProviderKey === providerResponse.provider;
          // existingConfig.apiKey is already decrypted string (loaded via loadUserSettings)
          const hasExistingKey = existingConfig?.apiKey && typeof existingConfig.apiKey === 'string' && existingConfig.apiKey.trim().length > 0;

          // Same provider with existing API key - ask if they want to reuse it
          if (isSameProvider && hasExistingKey && existingConfig?.apiKey) {
            console.log(chalk.green(`\n✓ Found existing API key for ${selectedProvider.displayName}`));
            // Display masked API key (handle short keys gracefully)
            // apiKey is guaranteed to be a string here (type guard in condition)
            const key = existingConfig.apiKey;
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
              apiKey = existingConfig.apiKey;
              console.log(chalk.green('✓ Using existing API key'));
            } else {
              apiKey = await promptForApiKey(`new ${selectedProvider.displayName}`, selectedProvider.website);
            }
          } else {
            // Different provider or no existing key - just ask for new key
            if (hasExistingKey && !isSameProvider && existingProviderKey) {
              const previousProvider = PROVIDERS[existingProviderKey];
              console.log(chalk.yellow(`\n⚠️  Switching from ${previousProvider?.displayName || 'previous provider'} to ${selectedProvider.displayName}`));
            }
            apiKey = await promptForApiKey(selectedProvider.displayName, selectedProvider.website);
          }
        } else {
          console.log(chalk.green(`\n✓ ${selectedProvider.displayName} doesn't require an API key`));
        }

        // Model selection
        console.log(step(3, 'Choose model'));
        const existingModel = existingConfig?.defaultModel || existingConfig?.currentModel;
        const baseModelOptions = Array.from(
          new Set([
            selectedProvider.defaultModel,
            ...(existingConfig?.models || []),
            existingModel,
          ].filter(Boolean))
        ) as string[];

        const modelChoices = baseModelOptions.map(model => ({
          name: model,
          message: model === selectedProvider.defaultModel ? `${model} (default)` : model,
        }));

        modelChoices.push({ name: '__custom__', message: 'Other (enter manually)' });

        const modelResponse = await enquirer.prompt<{ model: string }>({
          type: 'select',
          name: 'model',
          message: 'Select default model:',
          choices: modelChoices,
          initial: Math.max(
            0,
            modelChoices.findIndex(choice => choice.name === (existingModel || selectedProvider.defaultModel))
          ),
        });

        let chosenModel = modelResponse.model;
        if (modelResponse.model === '__custom__') {
          const manualModel = await enquirer.prompt<{ manualModel: string }>({
            type: 'input',
            name: 'manualModel',
            message: 'Enter model ID:',
            initial: selectedProvider.defaultModel,
            validate: (value: string) => value.trim().length > 0 || 'Model is required',
          });
          chosenModel = manualModel.manualModel.trim();
        }

        // Validate configuration before saving
        console.log(step(4, 'Validate connection'));
        const validationResult = await validateProviderSetup(
          {
            baseURL: selectedProvider.baseURL,
            apiKey: apiKey,
            model: chosenModel,
            providerName: selectedProvider.name,
          },
          !options.validate // Skip if --no-validate flag is used
        );

        // If validator returned models list, offer quick re-pick
        if (validationResult.availableModels && validationResult.availableModels.length > 0) {
          const uniqueAvailable = Array.from(new Set(validationResult.availableModels));
          const availableChoices = uniqueAvailable.map(model => ({
            name: model,
            message: model,
          }));
          availableChoices.push({ name: chosenModel, message: `${chosenModel} (keep current)` });

          const pickAvailable = await enquirer.prompt<{ altModel: string }>({
            type: 'select',
            name: 'altModel',
            message: 'Select a validated model (or keep current):',
            choices: availableChoices,
            initial: availableChoices.findIndex(choice => choice.name === chosenModel),
          });

          chosenModel = pickAvailable.altModel;
        }

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

        const mergedConfig: UserSettings = {
          ...(existingConfig || {}),
          apiKey: apiKey,
          baseURL: selectedProvider.baseURL,
          defaultModel: chosenModel,
          currentModel: chosenModel,
          maxTokens: existingConfig?.maxTokens ?? maxTokens,
          temperature: existingConfig?.temperature ?? 0.7,
          models: Array.from(new Set([chosenModel, ...(existingConfig?.models || []), selectedProvider.defaultModel].filter(Boolean))),
          _provider: selectedProvider.displayName,
          _website: selectedProvider.website,
        } as UserSettings;

        console.log(step(5, 'Review & save'));
        console.log(chalk.white('Provider:    ') + chalk.green(selectedProvider.displayName));
        console.log(chalk.white('Base URL:    ') + chalk.green(selectedProvider.baseURL));
        console.log(chalk.white('Model:       ') + chalk.green(chosenModel));
        console.log(chalk.white('Max Tokens:  ') + chalk.green((mergedConfig.maxTokens || maxTokens).toString()));
        console.log(chalk.white('Config path: ') + chalk.green(configPath));

        const confirmSave = await enquirer.prompt<{ save: boolean }>({
          type: 'confirm',
          name: 'save',
          message: 'Save these settings?',
          initial: true,
        });

        if (!confirmSave.save) {
          console.log(chalk.yellow('\n⚠️  Setup cancelled. No changes saved.\n'));
          return;
        }

        // Persist using settings manager to ensure encryption + permissions
        settingsManager.saveUserSettings(mergedConfig);

        console.log(chalk.green('\n✅ Configuration saved successfully!\n'));

        // Automatically enable Z.AI MCP servers for Z.AI providers (enabled by default)
        if (selectedProvider.name === 'z.ai' || selectedProvider.name === 'z.ai-free') {
          console.log(chalk.cyan('🔌 Z.AI MCP Integration\n'));
          console.log(chalk.dim('   Enabling Z.AI MCP servers for enhanced capabilities:'));
          console.log(chalk.dim('   • Web Search - Real-time web search'));
          console.log(chalk.dim('   • Web Reader - Extract content from web pages'));
          console.log(chalk.dim('   • Vision - Image/video analysis (Node.js 22+)\n'));

          try {
            const status = await detectZAIServices();
            const serversToAdd = getRecommendedServers(status);

            console.log(chalk.blue('Setting up Z.AI MCP servers...'));
            let successCount = 0;

            for (const serverName of serversToAdd) {
              const template = ZAI_MCP_TEMPLATES[serverName];
              try {
                const config = generateZAIServerConfig(serverName, apiKey);
                // Only save config during setup - don't connect (server will be connected when ax-cli runs)
                addMCPServer(config);
                console.log(chalk.green(`✓ ${template.displayName}`));
                successCount++;
              } catch {
                console.log(chalk.yellow(`⚠ ${template.displayName} (skipped)`));
              }
            }

            if (successCount > 0) {
              console.log(chalk.green(`\n✨ ${successCount} Z.AI MCP server${successCount !== 1 ? 's' : ''} enabled!\n`));
            }
          } catch (error) {
            console.log(chalk.yellow('\n⚠️  Could not set up Z.AI MCP servers:'), extractErrorMessage(error));
            console.log(chalk.dim('   You can enable them later with: ax-cli mcp add-zai\n'));
          }
        }

        // AutomatosX Integration
        console.log(chalk.cyan('🤖 AutomatosX Agent Orchestration\n'));
        console.log(chalk.dim('   Multi-agent AI orchestration with persistent memory and collaboration.\n'));

        const axInstalled = isAutomatosXInstalled();

        if (axInstalled) {
          const currentVersion = getAutomatosXVersion();
          console.log(chalk.green(`✓ AutomatosX detected${currentVersion ? ` (v${currentVersion})` : ''}`));
          console.log(chalk.dim('   Checking for updates...\n'));

          const updated = await updateAutomatosX();
          if (updated) {
            const newVersion = getAutomatosXVersion();
            console.log(chalk.green(`✓ AutomatosX updated${newVersion ? ` to v${newVersion}` : ''}\n`));
          } else {
            console.log(chalk.yellow('⚠ Could not update AutomatosX. Run manually: ax update -y\n'));
          }
        } else {
          // Wrap in try-catch to handle non-interactive environments (e.g., CI/tests)
          try {
            const installResponse = await enquirer.prompt<{ install: boolean }>({
              type: 'confirm',
              name: 'install',
              message: 'Install AutomatosX for multi-agent AI orchestration?',
              initial: true,
            });

            if (installResponse?.install) {
              console.log(chalk.dim('\n   Installing AutomatosX...\n'));

              const installed = await installAutomatosX();
              if (installed) {
                console.log(chalk.green('\n✓ AutomatosX installed successfully!'));
                console.log(chalk.dim('   Run `ax list agents` to see available AI agents.\n'));
              } else {
                console.log(chalk.yellow('\n⚠ Could not install AutomatosX.'));
                console.log(chalk.dim('   Install manually: npm install -g @defai.digital/automatosx\n'));
              }
            } else {
              console.log(chalk.dim('\n   You can install AutomatosX later: npm install -g @defai.digital/automatosx\n'));
            }
          } catch {
            // Skip AutomatosX prompt in non-interactive environments
            console.log(chalk.dim('   Skipping AutomatosX setup (non-interactive mode).\n'));
            console.log(chalk.dim('   Install manually: npm install -g @defai.digital/automatosx\n'));
          }
        }

        console.log(chalk.cyan('📄 Configuration details:\n'));
        console.log(chalk.dim('   Location:    ') + chalk.white(configPath));
        console.log(chalk.dim('   Provider:    ') + chalk.white(selectedProvider.displayName));
        console.log(chalk.dim('   Base URL:    ') + chalk.white(selectedProvider.baseURL));
        console.log(chalk.dim('   Model:       ') + chalk.white(chosenModel));
        console.log(chalk.dim('   Max Tokens:  ') + chalk.white((mergedConfig.maxTokens || maxTokens).toString()));
        console.log(chalk.dim('   Temperature: ') + chalk.white((mergedConfig.temperature ?? 0.7).toString()));

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
        console.error(chalk.dim('   ') + extractErrorMessage(error) + '\n');
        process.exit(1);
      }
    });

  return setupCommand;
}
