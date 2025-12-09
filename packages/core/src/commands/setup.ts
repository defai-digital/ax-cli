import { Command } from 'commander';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { execSync, spawnSync } from 'child_process';
import * as prompts from '@clack/prompts';
import chalk from 'chalk';
import { validateProviderSetup } from '../utils/setup-validator.js';
import { getSettingsManager } from '../utils/settings-manager.js';
import { extractErrorMessage } from '../utils/error-handler.js';
import { getTerminalStateManager } from '../utils/terminal-state.js';
import { exitCancelled, exitWithError, ExitCode } from '../utils/exit-handler.js';
// Logger imported for future structured logging improvements
// import { getLogger } from '../utils/logger.js';
import type { UserSettings } from '../schemas/settings-schemas.js';
import { getActiveConfigPaths, getActiveProvider } from '../provider/config.js';
import {
  detectZAIServices,
  getRecommendedServers,
  generateZAIServerConfig,
} from '../mcp/index.js';
import { addUserMCPServer, removeUserMCPServer } from '../mcp/config.js';

/**
 * Handle user cancellation - exits process if cancelled
 * Uses unified exit handler for consistent cleanup
 */
function exitIfCancelled<T>(value: T | symbol): asserts value is T {
  if (prompts.isCancel(value)) {
    const terminalManager = getTerminalStateManager();
    terminalManager.forceCleanup();
    prompts.cancel('Setup cancelled.');
    exitCancelled('Setup cancelled by user');
  }
}

/**
 * Check AutomatosX status - returns version if installed, null otherwise
 */
function getAutomatosXStatus(): { installed: boolean; version: string | null } {
  try {
    const result = spawnSync('ax', ['--version'], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    if (result.status === 0 && result.stdout) {
      const match = result.stdout.match(/(\d+\.\d+\.\d+)/);
      return { installed: true, version: match ? match[1] : result.stdout.trim() };
    }
    return { installed: false, version: null };
  } catch {
    return { installed: false, version: null };
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
 * Setup command - Initialize provider config (e.g., ~/.ax-glm/config.json)
 */
export function createSetupCommand(): Command {
  const setupCommand = new Command('setup');

  setupCommand
    .description('Initialize AX CLI configuration with AI provider selection')
    .option('--force', 'Overwrite existing configuration')
    .option('--no-validate', 'Skip validation of API endpoint and credentials')
    .action(async (options: {
      force?: boolean;
      validate?: boolean;
    }) => {
      try {
        // Show intro
        const provider = getActiveProvider();
        prompts.intro(chalk.cyan(`${provider.branding.cliName} Setup`));

        // Use provider-specific config path (~/.ax-glm/config.json or ~/.ax-grok/config.json)
        const configPath = getActiveConfigPaths().USER_CONFIG;
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
        exitIfCancelled(providerKey);

        const selectedProvider = PROVIDERS[providerKey];

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
            exitIfCancelled(reuseKey);

            if (reuseKey) {
              apiKey = existingConfig.apiKey;
              prompts.log.success('Using existing API key');
            } else {
              prompts.log.info(`Get your API key from: ${selectedProvider.website}`);
              const newKey = await prompts.password({
                message: `Enter new ${selectedProvider.displayName} API key:`,
                validate: (value) => value?.trim().length > 0 ? undefined : 'API key is required',
              });
              exitIfCancelled(newKey);
              apiKey = newKey.trim();
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
            exitIfCancelled(newKey);
            apiKey = newKey.trim();
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
        exitIfCancelled(modelSelection);

        let chosenModel = modelSelection;
        if (modelSelection === '__custom__') {
          const manualModel = await prompts.text({
            message: 'Enter model ID:',
            initialValue: selectedProvider.defaultModel,
            validate: (value) => value?.trim().length > 0 ? undefined : 'Model is required',
          });
          exitIfCancelled(manualModel);
          chosenModel = manualModel.trim();
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: Validate Connection
        // ═══════════════════════════════════════════════════════════════════
        prompts.log.step(chalk.bold('Step 4/5 — Validate Connection'));

        if (!options.validate) {
          prompts.log.info('Skipping validation (--no-validate)');
        } else {
          const spinner = prompts.spinner();
          spinner.start('Testing endpoint connectivity...');

          const validationResult = await validateProviderSetup(
            {
              baseURL: selectedProvider.baseURL,
              apiKey: apiKey,
              model: chosenModel,
              providerName: selectedProvider.name,
            },
            false // Don't skip - we already checked above
          );

          // IMPORTANT: Stop spinner BEFORE any prompts or additional output
          // This prevents terminal state corruption that can cause hangs
          if (validationResult.success) {
            spinner.stop('All checks passed');
          } else {
            spinner.stop('Validation encountered issues');
          }

          // Now display detailed results (spinner is stopped, safe to output)
          if (validationResult.endpoint) {
            if (validationResult.endpoint.success) {
              prompts.log.success(`Endpoint: ${validationResult.endpoint.message}`);
            } else {
              prompts.log.error(`Endpoint: ${validationResult.endpoint.error || validationResult.endpoint.message}`);
            }
          }

          if (validationResult.authentication) {
            if (validationResult.authentication.success) {
              prompts.log.success(`Authentication: ${validationResult.authentication.message}`);
            } else {
              prompts.log.error(`Authentication: ${validationResult.authentication.error || validationResult.authentication.message}`);

              // Show troubleshooting tips
              if (validationResult.authentication.details) {
                console.log(''); // Blank line for readability
                prompts.log.info('Troubleshooting tips:');
                for (const detail of validationResult.authentication.details) {
                  prompts.log.message(`  • ${detail}`);
                }
                console.log(''); // Blank line
              }
            }
          }

          if (validationResult.model) {
            if (validationResult.model.success) {
              prompts.log.success(`Model: ${validationResult.model.message}`);
            } else {
              prompts.log.error(`Model: ${validationResult.model.error || validationResult.model.message}`);
            }
          }

          // If validator returned models list, offer quick re-pick
          if (validationResult.availableModels && validationResult.availableModels.length > 0) {
            const uniqueAvailable = Array.from(new Set(validationResult.availableModels));
            const availableChoices = uniqueAvailable.slice(0, 10).map(model => ({
              value: model,
              label: model,
            }));
            availableChoices.push({ value: chosenModel, label: `${chosenModel} (keep current)` });

            const altModel = await prompts.select({
              message: 'Select a validated model (or keep current):',
              options: availableChoices,
              initialValue: chosenModel,
            });
            exitIfCancelled(altModel);
            chosenModel = altModel;
          }

          // Handle validation failure - ask user what to do
          if (!validationResult.success) {
            console.log(''); // Ensure clean line before prompt

            const proceedAnyway = await prompts.confirm({
              message: 'Validation failed. Save configuration anyway?',
              initialValue: false,
            });

            if (prompts.isCancel(proceedAnyway) || !proceedAnyway) {
              const terminalManager = getTerminalStateManager();
              terminalManager.forceCleanup();
              prompts.cancel('Setup cancelled. Please check your settings and try again.');
              exitCancelled('Setup cancelled - validation failed');
            }

            prompts.log.warn('Proceeding with unvalidated configuration');
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
        exitIfCancelled(confirmSave);

        if (!confirmSave) {
          const terminalManager = getTerminalStateManager();
          terminalManager.forceCleanup();
          prompts.cancel('Setup cancelled. No changes saved.');
          exitCancelled('Setup cancelled - user declined to save');
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
        try {
          settingsManager.saveUserSettings(mergedConfig);
          prompts.log.success('Configuration saved successfully!');
        } catch (saveError) {
          const terminalManager = getTerminalStateManager();
          terminalManager.forceCleanup();
          prompts.log.error(`Failed to save configuration: ${extractErrorMessage(saveError)}`);
          prompts.log.info(`Config path: ${configPath}`);
          prompts.log.info('Please check file permissions and disk space.');
          exitWithError('Failed to save configuration', ExitCode.CONFIG_ERROR, {
            command: 'setup',
            operation: 'save-settings',
          });
        }

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

            // Remove existing Z.AI MCP servers first (from user-level settings)
            for (const serverName of serversToAdd) {
              try {
                removeUserMCPServer(serverName);
              } catch {
                // Ignore errors if server doesn't exist
              }
            }

            // Add Z.AI MCP servers to user-level settings (global across all projects)
            // This ensures they're available from any directory, not just the setup directory
            let successCount = 0;
            for (const serverName of serversToAdd) {
              try {
                const config = generateZAIServerConfig(serverName, apiKey);
                addUserMCPServer(config);
                successCount++;
              } catch {
                // Skip failed servers
              }
            }

            mcpSpinner.stop(`${successCount} Z.AI MCP server${successCount !== 1 ? 's' : ''} configured`);
          } catch (error) {
            mcpSpinner.stop('Could not set up Z.AI MCP servers');
            prompts.log.warn(`${extractErrorMessage(error)}`);
            prompts.log.info(`You can enable them later with: ${provider.branding.cliName} mcp add-zai`);
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // AutomatosX Integration
        // ═══════════════════════════════════════════════════════════════════
        await prompts.note(
          'Multi-agent AI orchestration with persistent memory and collaboration.',
          'AutomatosX Agent Orchestration'
        );

        let axStatus = getAutomatosXStatus();

        if (axStatus.installed) {
          prompts.log.success(`AutomatosX detected${axStatus.version ? ` (v${axStatus.version})` : ''}`);

          const axSpinner = prompts.spinner();
          axSpinner.start('Checking for updates...');

          const updated = await updateAutomatosX();
          if (updated) {
            axStatus = getAutomatosXStatus(); // Refresh version after update
            axSpinner.stop(`AutomatosX updated${axStatus.version ? ` to v${axStatus.version}` : ''}`);
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
                axStatus = getAutomatosXStatus(); // Refresh status after install
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
        if (axStatus.installed) {
          await prompts.note(
            `When enabled, ${provider.branding.cliName} automatically routes tasks to specialized agents\n` +
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

        const cliName = provider.branding.cliName;
        await prompts.note(
          '1. Start interactive mode:\n' +
          `   $ ${cliName}\n\n` +
          `2. Initialize your project (inside ${cliName}):\n` +
          '   > /init\n\n' +
          '3. Or run a quick test:\n' +
          `   $ ${cliName} -p "Hello, introduce yourself"`,
          'Next Steps'
        );

        await prompts.note(
          `• Edit config manually:  ${configPath}\n` +
          '• See example configs:   Check "_examples" in config file\n' +
          `• View help:             ${cliName} --help\n` +
          '• Documentation:         https://github.com/defai-digital/ax-cli',
          'Tips'
        );

        prompts.outro(chalk.green('Setup complete! Happy coding!'));

      } catch (error: unknown) {
        const terminalManager = getTerminalStateManager();
        terminalManager.forceCleanup();

        const err = error as { message?: string; name?: string };
        if (err?.message === 'canceled' || err?.name === 'canceled') {
          prompts.cancel('Setup cancelled by user.');
          exitCancelled('Setup cancelled by user');
        }

        prompts.log.error(`Setup failed: ${extractErrorMessage(error)}`);
        exitWithError('Setup failed', ExitCode.GENERAL_ERROR, {
          command: 'setup',
          error: extractErrorMessage(error),
        });
      }
    });

  return setupCommand;
}
