import { Command } from 'commander';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { execSync, spawnSync } from 'child_process';
import * as prompts from '@clack/prompts';
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
} from '../mcp/index.js';
import { addMCPServer, removeMCPServer } from '../mcp/config.js';

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
        // Show intro
        prompts.intro(chalk.cyan('AX CLI Setup'));

        // Always use the NEW path ~/.ax-cli/config.json
        const configPath = CONFIG_PATHS.USER_CONFIG;
        const configDir = dirname(configPath);
        const settingsManager = getSettingsManager();

        // Ensure config directory exists
        if (!existsSync(configDir)) {
          mkdirSync(configDir, { recursive: true });
        }

        // Load existing config to check for existing API key BEFORE provider selection
        let existingConfig: UserSettings | null = null;
        let existingProviderKey: string | null = null;

        if (existsSync(configPath)) {
          try {
            existingConfig = settingsManager.loadUserSettings();
            if (existingConfig.baseURL) {
              existingProviderKey = getProviderFromBaseURL(existingConfig.baseURL);
            }

            if (existingProviderKey && !options.force) {
              const existingProvider = PROVIDERS[existingProviderKey];
              await prompts.note(
                `Provider: ${existingProvider?.displayName || 'Unknown'}\n` +
                `Location: ${configPath}`,
                'Existing Configuration Found'
              );
            }
          } catch (error) {
            prompts.log.warn(`Failed to load existing config: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: Provider Selection
        // ═══════════════════════════════════════════════════════════════════
        prompts.log.step(chalk.bold('Step 1/5 — Choose Provider'));

        const providerChoices = Object.entries(PROVIDERS).map(([key, provider]) => ({
          value: key,
          label: provider.displayName,
          hint: provider.description,
        }));

        const providerKey = await prompts.select({
          message: 'Select your AI provider:',
          options: providerChoices,
          initialValue: existingProviderKey || 'z.ai',
        });

        if (prompts.isCancel(providerKey)) {
          prompts.cancel('Setup cancelled.');
          process.exit(0);
        }

        const selectedProvider = PROVIDERS[providerKey as string];

        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: API Key
        // ═══════════════════════════════════════════════════════════════════
        prompts.log.step(chalk.bold('Step 2/5 — API Key'));

        let apiKey = '';
        if (selectedProvider.requiresApiKey) {
          const isSameProvider = existingProviderKey === providerKey;
          const hasExistingKey = existingConfig?.apiKey && typeof existingConfig.apiKey === 'string' && existingConfig.apiKey.trim().length > 0;

          if (isSameProvider && hasExistingKey && existingConfig?.apiKey) {
            const key = existingConfig.apiKey;
            const maskedKey = key.length > 12
              ? `${key.substring(0, 8)}...${key.substring(key.length - 4)}`
              : `${key.substring(0, Math.min(4, key.length))}...`;

            await prompts.note(
              `Key: ${maskedKey}`,
              `Existing API Key for ${selectedProvider.displayName}`
            );

            const reuseKey = await prompts.confirm({
              message: 'Use existing API key?',
              initialValue: true,
            });

            if (prompts.isCancel(reuseKey)) {
              prompts.cancel('Setup cancelled.');
              process.exit(0);
            }

            if (reuseKey) {
              apiKey = existingConfig.apiKey;
              prompts.log.success('Using existing API key');
            } else {
              prompts.log.info(`Get your API key from: ${selectedProvider.website}`);
              const newKey = await prompts.password({
                message: `Enter new ${selectedProvider.displayName} API key:`,
                validate: (value) => value?.trim().length > 0 ? undefined : 'API key is required',
              });

              if (prompts.isCancel(newKey)) {
                prompts.cancel('Setup cancelled.');
                process.exit(0);
              }
              apiKey = (newKey as string).trim();
            }
          } else {
            if (hasExistingKey && !isSameProvider && existingProviderKey) {
              const previousProvider = PROVIDERS[existingProviderKey];
              prompts.log.warn(`Switching from ${previousProvider?.displayName || 'previous provider'} to ${selectedProvider.displayName}`);
            }

            prompts.log.info(`Get your API key from: ${selectedProvider.website}`);
            const newKey = await prompts.password({
              message: `Enter your ${selectedProvider.displayName} API key:`,
              validate: (value) => value?.trim().length > 0 ? undefined : 'API key is required',
            });

            if (prompts.isCancel(newKey)) {
              prompts.cancel('Setup cancelled.');
              process.exit(0);
            }
            apiKey = (newKey as string).trim();
          }
        } else {
          prompts.log.success(`${selectedProvider.displayName} doesn't require an API key`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: Model Selection
        // ═══════════════════════════════════════════════════════════════════
        prompts.log.step(chalk.bold('Step 3/5 — Choose Model'));

        const existingModel = existingConfig?.defaultModel || existingConfig?.currentModel;
        const baseModelOptions = Array.from(
          new Set([
            selectedProvider.defaultModel,
            ...(existingConfig?.models || []),
            existingModel,
          ].filter(Boolean))
        ) as string[];

        const modelChoices = baseModelOptions.map(model => ({
          value: model,
          label: model === selectedProvider.defaultModel ? `${model} (default)` : model,
        }));
        modelChoices.push({ value: '__custom__', label: 'Other (enter manually)' });

        const modelSelection = await prompts.select({
          message: 'Select default model:',
          options: modelChoices,
          initialValue: existingModel || selectedProvider.defaultModel,
        });

        if (prompts.isCancel(modelSelection)) {
          prompts.cancel('Setup cancelled.');
          process.exit(0);
        }

        let chosenModel = modelSelection as string;
        if (modelSelection === '__custom__') {
          const manualModel = await prompts.text({
            message: 'Enter model ID:',
            initialValue: selectedProvider.defaultModel,
            validate: (value) => value?.trim().length > 0 ? undefined : 'Model is required',
          });

          if (prompts.isCancel(manualModel)) {
            prompts.cancel('Setup cancelled.');
            process.exit(0);
          }
          chosenModel = (manualModel as string).trim();
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: Validate Connection
        // ═══════════════════════════════════════════════════════════════════
        prompts.log.step(chalk.bold('Step 4/5 — Validate Connection'));

        const spinner = prompts.spinner();
        spinner.start('Validating connection...');

        const validationResult = await validateProviderSetup(
          {
            baseURL: selectedProvider.baseURL,
            apiKey: apiKey,
            model: chosenModel,
            providerName: selectedProvider.name,
          },
          !options.validate
        );

        spinner.stop('Validation complete');

        // If validator returned models list, offer quick re-pick
        if (validationResult.availableModels && validationResult.availableModels.length > 0) {
          const uniqueAvailable = Array.from(new Set(validationResult.availableModels));
          const availableChoices = uniqueAvailable.map(model => ({
            value: model,
            label: model,
          }));
          availableChoices.push({ value: chosenModel, label: `${chosenModel} (keep current)` });

          const altModel = await prompts.select({
            message: 'Select a validated model (or keep current):',
            options: availableChoices,
            initialValue: chosenModel,
          });

          if (prompts.isCancel(altModel)) {
            prompts.cancel('Setup cancelled.');
            process.exit(0);
          }
          chosenModel = altModel as string;
        }

        if (validationResult.success) {
          prompts.log.success('Connection validated successfully');
        } else if (options.validate !== false) {
          prompts.log.warn('Validation failed, but you can still save the configuration.');

          const proceedAnyway = await prompts.confirm({
            message: 'Save configuration anyway?',
            initialValue: false,
          });

          if (prompts.isCancel(proceedAnyway) || !proceedAnyway) {
            prompts.cancel('Setup cancelled. Please check your settings and try again.');
            process.exit(0);
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 5: Review & Save
        // ═══════════════════════════════════════════════════════════════════
        prompts.log.step(chalk.bold('Step 5/5 — Review & Save'));

        const maxTokens = (selectedProvider.name === 'z.ai' || selectedProvider.name === 'z.ai-free') ? 32768 : 8192;

        await prompts.note(
          `Provider:    ${selectedProvider.displayName}\n` +
          `Base URL:    ${selectedProvider.baseURL}\n` +
          `Model:       ${chosenModel}\n` +
          `Max Tokens:  ${existingConfig?.maxTokens ?? maxTokens}\n` +
          `Config path: ${configPath}`,
          'Configuration Summary'
        );

        const confirmSave = await prompts.confirm({
          message: 'Save these settings?',
          initialValue: true,
        });

        if (prompts.isCancel(confirmSave) || !confirmSave) {
          prompts.cancel('Setup cancelled. No changes saved.');
          process.exit(0);
        }

        // Create configuration object
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

        // Persist using settings manager to ensure encryption + permissions
        settingsManager.saveUserSettings(mergedConfig);

        prompts.log.success('Configuration saved successfully!');

        // ═══════════════════════════════════════════════════════════════════
        // Z.AI MCP Integration
        // ═══════════════════════════════════════════════════════════════════
        if (selectedProvider.name === 'z.ai' || selectedProvider.name === 'z.ai-free') {
          await prompts.note(
            'Enabling Z.AI MCP servers for enhanced capabilities:\n' +
            '• Web Search - Real-time web search\n' +
            '• Web Reader - Extract content from web pages\n' +
            '• Vision - Image/video analysis (Node.js 22+)',
            'Z.AI MCP Integration'
          );

          const mcpSpinner = prompts.spinner();
          mcpSpinner.start('Configuring Z.AI MCP servers...');

          try {
            const status = await detectZAIServices();
            const serversToAdd = getRecommendedServers(status);

            // Remove existing Z.AI MCP servers first
            for (const serverName of serversToAdd) {
              try {
                removeMCPServer(serverName);
              } catch {
                // Ignore errors if server doesn't exist
              }
            }

            let successCount = 0;
            for (const serverName of serversToAdd) {
              try {
                const config = generateZAIServerConfig(serverName, apiKey);
                addMCPServer(config);
                successCount++;
              } catch {
                // Skip failed servers
              }
            }

            mcpSpinner.stop(`${successCount} Z.AI MCP server${successCount !== 1 ? 's' : ''} configured`);
          } catch (error) {
            mcpSpinner.stop('Could not set up Z.AI MCP servers');
            prompts.log.warn(`${extractErrorMessage(error)}`);
            prompts.log.info('You can enable them later with: ax-cli mcp add-zai');
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // AutomatosX Integration
        // ═══════════════════════════════════════════════════════════════════
        await prompts.note(
          'Multi-agent AI orchestration with persistent memory and collaboration.',
          'AutomatosX Agent Orchestration'
        );

        const axInstalled = isAutomatosXInstalled();

        if (axInstalled) {
          const currentVersion = getAutomatosXVersion();
          prompts.log.success(`AutomatosX detected${currentVersion ? ` (v${currentVersion})` : ''}`);

          const axSpinner = prompts.spinner();
          axSpinner.start('Checking for updates...');

          const updated = await updateAutomatosX();
          if (updated) {
            const newVersion = getAutomatosXVersion();
            axSpinner.stop(`AutomatosX updated${newVersion ? ` to v${newVersion}` : ''}`);
          } else {
            axSpinner.stop('Could not update AutomatosX');
            prompts.log.info('Run manually: ax update -y');
          }
        } else {
          try {
            const installResponse = await prompts.confirm({
              message: 'Install AutomatosX for multi-agent AI orchestration?',
              initialValue: true,
            });

            if (!prompts.isCancel(installResponse) && installResponse) {
              const installSpinner = prompts.spinner();
              installSpinner.start('Installing AutomatosX...');

              const installed = await installAutomatosX();
              if (installed) {
                installSpinner.stop('AutomatosX installed successfully!');
                prompts.log.info('Run `ax list agents` to see available AI agents.');
              } else {
                installSpinner.stop('Could not install AutomatosX');
                prompts.log.info('Install manually: npm install -g @defai.digital/automatosx');
              }
            } else if (!prompts.isCancel(installResponse)) {
              prompts.log.info('You can install AutomatosX later: npm install -g @defai.digital/automatosx');
            }
          } catch {
            prompts.log.info('Skipping AutomatosX setup (non-interactive mode).');
            prompts.log.info('Install manually: npm install -g @defai.digital/automatosx');
          }
        }

        // Agent-First Mode Configuration (only ask if AutomatosX is available)
        const axAvailable = isAutomatosXInstalled();
        if (axAvailable) {
          await prompts.note(
            'When enabled, ax-cli automatically routes tasks to specialized agents\n' +
            'based on keywords (e.g., "test" → testing agent, "refactor" → refactoring agent).\n' +
            'When disabled (default), you use the direct LLM and can invoke agents explicitly.',
            'Agent-First Mode'
          );

          try {
            const enableAgentFirst = await prompts.confirm({
              message: 'Enable agent-first mode (auto-route to specialized agents)?',
              initialValue: false,
            });

            if (!prompts.isCancel(enableAgentFirst)) {
              const currentSettings = settingsManager.loadUserSettings();
              settingsManager.saveUserSettings({
                ...currentSettings,
                agentFirst: {
                  enabled: enableAgentFirst,
                  confidenceThreshold: 0.6,
                  showAgentIndicator: true,
                  defaultAgent: 'standard',
                  excludedAgents: [],
                },
              });

              if (enableAgentFirst) {
                prompts.log.success('Agent-first mode enabled');
                prompts.log.info('Tasks will be automatically routed to specialized agents.');
              } else {
                prompts.log.success('Agent-first mode disabled (default)');
                prompts.log.info('Use direct LLM. Invoke agents with --agent flag when needed.');
              }
            }
          } catch {
            prompts.log.info('Skipping agent-first configuration (non-interactive mode).');
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // Completion Summary
        // ═══════════════════════════════════════════════════════════════════
        await prompts.note(
          `Location:    ${configPath}\n` +
          `Provider:    ${selectedProvider.displayName}\n` +
          `Base URL:    ${selectedProvider.baseURL}\n` +
          `Model:       ${chosenModel}\n` +
          `Max Tokens:  ${mergedConfig.maxTokens || maxTokens}\n` +
          `Temperature: ${mergedConfig.temperature ?? 0.7}`,
          'Configuration Details'
        );

        await prompts.note(
          '1. Start interactive mode:\n' +
          '   $ ax-cli\n\n' +
          '2. Run a quick test:\n' +
          '   $ ax-cli -p "Hello, introduce yourself"\n\n' +
          '3. Initialize a project:\n' +
          '   $ ax-cli init',
          'Next Steps'
        );

        await prompts.note(
          `• Edit config manually:  ${configPath}\n` +
          '• See example configs:   Check "_examples" in config file\n' +
          '• View help:             ax-cli --help\n' +
          '• Documentation:         https://github.com/defai-digital/ax-cli',
          'Tips'
        );

        prompts.outro(chalk.green('Setup complete! Happy coding!'));

      } catch (error: any) {
        if (error?.message === 'canceled' || error?.name === 'canceled') {
          prompts.cancel('Setup cancelled by user.');
          process.exit(0);
        }

        prompts.log.error(`Setup failed: ${extractErrorMessage(error)}`);
        process.exit(1);
      }
    });

  return setupCommand;
}
