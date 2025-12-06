/**
 * Provider-Specific Setup Command
 *
 * Creates a setup wizard tailored to a specific provider (GLM or Grok).
 * This is used by ax-glm and ax-grok to provide focused setup experiences.
 */

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
import type { ProviderDefinition } from '../provider/config.js';
import { getActiveConfigPaths } from '../provider/config.js';
import {
  detectZAIServices,
  getRecommendedServers,
  generateZAIServerConfig,
} from '../mcp/index.js';
import { addMCPServer, removeMCPServer } from '../mcp/config.js';

/**
 * Handle user cancellation - exits process if cancelled
 */
function exitIfCancelled<T>(value: T | symbol): asserts value is T {
  if (prompts.isCancel(value)) {
    prompts.cancel('Setup cancelled.');
    process.exit(0);
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
 * Get provider-specific website URL
 */
function getProviderWebsite(provider: ProviderDefinition): string {
  if (provider.name === 'glm') {
    return 'https://z.ai';
  } else if (provider.name === 'grok') {
    return 'https://console.x.ai';
  }
  return 'https://example.com';
}

/**
 * Create a provider-specific setup command
 */
export function createProviderSetupCommand(provider: ProviderDefinition): Command {
  const setupCommand = new Command('setup');
  const cliName = provider.branding.cliName;
  const website = getProviderWebsite(provider);

  setupCommand
    .description(`Initialize ${cliName} configuration with ${provider.displayName}`)
    .option('--force', 'Overwrite existing configuration')
    .option('--no-validate', 'Skip validation of API endpoint and credentials')
    .action(async (options: {
      force?: boolean;
      validate?: boolean;
    }) => {
      try {
        // Show intro with provider-specific branding
        prompts.intro(chalk.cyan(`${cliName.toUpperCase()} Setup`));

        await prompts.note(
          `${provider.branding.description}\n\n` +
          `Provider: ${provider.displayName}\n` +
          `Get API key: ${website}`,
          'Welcome'
        );

        // Use provider-specific config path (e.g., ~/.ax-glm/config.json or ~/.ax-grok/config.json)
        const activeConfigPaths = getActiveConfigPaths();
        const configPath = activeConfigPaths.USER_CONFIG;
        const configDir = dirname(configPath);
        const settingsManager = getSettingsManager();

        // Ensure config directory exists
        if (!existsSync(configDir)) {
          mkdirSync(configDir, { recursive: true });
        }

        // Load existing config
        let existingConfig: UserSettings | null = null;

        if (existsSync(configPath)) {
          try {
            existingConfig = settingsManager.loadUserSettings();

            if (existingConfig.apiKey && !options.force) {
              await prompts.note(
                `Existing configuration found at:\n${configPath}`,
                'Configuration Exists'
              );
            }
          } catch (error) {
            prompts.log.warn(`Failed to load existing config: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: Server URL (GLM only - Grok is always online)
        // ═══════════════════════════════════════════════════════════════════
        let selectedBaseURL = provider.defaultBaseURL;
        let isLocalServer = false;

        if (provider.name === 'glm') {
          prompts.log.step(chalk.bold('Step 1/5 — Server Selection'));

          const serverType = await prompts.select({
            message: 'Select server type:',
            options: [
              {
                value: 'zai',
                label: 'Z.AI Cloud (Recommended)',
                hint: 'Use official Z.AI API at api.z.ai',
              },
              {
                value: 'local',
                label: 'Local/Custom Server',
                hint: 'Ollama, LMStudio, vLLM, or other OpenAI-compatible server',
              },
            ],
            initialValue: 'zai',
          });
          exitIfCancelled(serverType);

          if (serverType === 'local') {
            isLocalServer = true;

            await prompts.note(
              'Supported local servers:\n' +
              '• Ollama:   http://localhost:11434/v1\n' +
              '• LMStudio: http://localhost:1234/v1\n' +
              '• vLLM:     http://localhost:8000/v1',
              'Local Server Options'
            );

            const customURL = await prompts.text({
              message: 'Enter server URL:',
              placeholder: 'http://localhost:11434/v1',
              initialValue: existingConfig?.baseURL && existingConfig.baseURL !== provider.defaultBaseURL
                ? existingConfig.baseURL
                : 'http://localhost:11434/v1',
              validate: (value) => {
                if (!value?.trim()) return 'Server URL is required';
                try {
                  new URL(value);
                  return undefined;
                } catch {
                  return 'Invalid URL format';
                }
              },
            });
            exitIfCancelled(customURL);
            selectedBaseURL = customURL.trim();
          } else {
            selectedBaseURL = provider.defaultBaseURL;
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: API Key (step number adjusts for GLM)
        // ═══════════════════════════════════════════════════════════════════
        const apiKeyStep = provider.name === 'glm' ? 'Step 2/5' : 'Step 1/4';
        prompts.log.step(chalk.bold(`${apiKeyStep} — API Key`));

        let apiKey = '';
        const hasExistingKey = existingConfig?.apiKey && typeof existingConfig.apiKey === 'string' && existingConfig.apiKey.trim().length > 0;

        if (hasExistingKey && existingConfig?.apiKey) {
          const key = existingConfig.apiKey;
          const maskedKey = key.length > 12
            ? `${key.substring(0, 8)}...${key.substring(key.length - 4)}`
            : `${key.substring(0, Math.min(4, key.length))}...`;

          await prompts.note(
            `Key: ${maskedKey}`,
            `Existing API Key`
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
            prompts.log.info(`Get your API key from: ${website}`);
            const newKey = await prompts.password({
              message: `Enter your ${provider.displayName} API key:`,
              validate: (value) => value?.trim().length > 0 ? undefined : 'API key is required',
            });
            exitIfCancelled(newKey);
            apiKey = newKey.trim();
          }
        } else {
          prompts.log.info(`Get your API key from: ${website}`);
          const newKey = await prompts.password({
            message: `Enter your ${provider.displayName} API key:`,
            validate: (value) => value?.trim().length > 0 ? undefined : 'API key is required',
          });
          exitIfCancelled(newKey);
          apiKey = newKey.trim();
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: Model Selection (step number adjusts for GLM)
        // ═══════════════════════════════════════════════════════════════════
        const modelStep = provider.name === 'glm' ? 'Step 3/5' : 'Step 2/4';
        prompts.log.step(chalk.bold(`${modelStep} — Choose Model`));

        // Build model choices from provider definition
        const modelChoices = Object.entries(provider.models).map(([modelId, config]) => ({
          value: modelId,
          label: modelId === provider.defaultModel ? `${config.name} (default)` : config.name,
          hint: config.description,
        }));

        const existingModel = existingConfig?.defaultModel || existingConfig?.currentModel;
        const initialModel = existingModel && provider.models[existingModel] ? existingModel : provider.defaultModel;

        const modelSelection = await prompts.select({
          message: 'Select default model:',
          options: modelChoices,
          initialValue: initialModel,
        });
        exitIfCancelled(modelSelection);

        const chosenModel = modelSelection;
        const modelConfig = provider.models[chosenModel];

        // Show model features
        const features: string[] = [];
        if (modelConfig.supportsThinking) features.push('Thinking Mode');
        if (modelConfig.supportsVision) features.push('Vision');
        if (modelConfig.supportsSearch) features.push('Search');
        if (modelConfig.supportsSeed) features.push('Seed/Reproducible');

        if (features.length > 0) {
          prompts.log.info(`Model features: ${features.join(', ')}`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: Validate Connection (step number adjusts for GLM)
        // ═══════════════════════════════════════════════════════════════════
        const validateStep = provider.name === 'glm' ? 'Step 4/5' : 'Step 3/4';
        prompts.log.step(chalk.bold(`${validateStep} — Validate Connection`));

        const spinner = prompts.spinner();
        spinner.start('Validating connection...');

        const validationResult = await validateProviderSetup(
          {
            baseURL: selectedBaseURL,
            apiKey: apiKey,
            model: chosenModel,
            providerName: provider.name,
          },
          !options.validate || isLocalServer // Skip validation for local servers by default
        );

        spinner.stop('Validation complete');

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
        // STEP 5: Review & Save (step number adjusts for GLM)
        // ═══════════════════════════════════════════════════════════════════
        const saveStep = provider.name === 'glm' ? 'Step 5/5' : 'Step 4/4';
        prompts.log.step(chalk.bold(`${saveStep} — Review & Save`));

        const maxTokens = modelConfig.maxOutputTokens > 32768 ? 32768 : modelConfig.maxOutputTokens;

        await prompts.note(
          `Provider:    ${provider.displayName}${isLocalServer ? ' (Local)' : ''}\n` +
          `Base URL:    ${selectedBaseURL}\n` +
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
          prompts.cancel('Setup cancelled. No changes saved.');
          process.exit(0);
        }

        // Create configuration object
        const mergedConfig: UserSettings = {
          ...(existingConfig || {}),
          apiKey: apiKey,
          baseURL: selectedBaseURL,
          defaultModel: chosenModel,
          currentModel: chosenModel,
          maxTokens: existingConfig?.maxTokens ?? maxTokens,
          temperature: existingConfig?.temperature ?? 0.7,
          models: Object.keys(provider.models),
          _provider: provider.displayName,
          _website: website,
          _isLocalServer: isLocalServer,
        } as UserSettings;

        // Persist using settings manager to ensure encryption + permissions
        settingsManager.saveUserSettings(mergedConfig);

        prompts.log.success('Configuration saved successfully!');

        // ═══════════════════════════════════════════════════════════════════
        // Provider-Specific MCP Integration (GLM with Z.AI only, not local)
        // ═══════════════════════════════════════════════════════════════════
        if (provider.name === 'glm' && !isLocalServer) {
          await prompts.note(
            'Enabling Z.AI MCP servers for enhanced capabilities:\n' +
            '- Web Search - Real-time web search\n' +
            '- Web Reader - Extract content from web pages\n' +
            '- Vision - Image/video analysis (Node.js 22+)',
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
            prompts.log.info(`You can enable them later with: ${cliName} mcp add-zai`);
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
            `When enabled, ${cliName} automatically routes tasks to specialized agents\n` +
            'based on keywords (e.g., "test" -> testing agent, "refactor" -> refactoring agent).\n' +
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
          `Provider:    ${provider.displayName}${isLocalServer ? ' (Local)' : ''}\n` +
          `Base URL:    ${selectedBaseURL}\n` +
          `Model:       ${chosenModel}\n` +
          `Max Tokens:  ${mergedConfig.maxTokens || maxTokens}\n` +
          `Temperature: ${mergedConfig.temperature ?? 0.7}`,
          'Configuration Details'
        );

        await prompts.note(
          '1. Start interactive mode:\n' +
          `   $ ${cliName}\n\n` +
          `2. Initialize your project (inside ${cliName}):\n` +
          '   > /init\n\n' +
          '3. Or run a quick test:\n' +
          `   $ ${cliName} -p "Hello, introduce yourself"`,
          'Next Steps'
        );

        // Provider-specific tips
        const tips: string[] = [
          `Edit config manually:  ${configPath}`,
          `View help:             ${cliName} --help`,
        ];

        if (provider.features.supportsThinking) {
          tips.push(`Enable thinking mode:  ${cliName} --think`);
        }
        if (provider.features.supportsSeed) {
          tips.push(`Reproducible output:   ${cliName} --seed 42`);
        }
        if (provider.features.supportsVision) {
          const visionModel = Object.entries(provider.models).find(([, c]) => c.supportsVision)?.[0];
          if (visionModel) {
            tips.push(`Use vision model:      ${cliName} -m ${visionModel}`);
          }
        }

        await prompts.note(tips.join('\n'), 'Tips');

        prompts.outro(chalk.green('Setup complete! Happy coding!'));

      } catch (error: unknown) {
        const err = error as { message?: string; name?: string };
        if (err?.message === 'canceled' || err?.name === 'canceled') {
          prompts.cancel('Setup cancelled by user.');
          process.exit(0);
        }

        prompts.log.error(`Setup failed: ${extractErrorMessage(error)}`);
        process.exit(1);
      }
    });

  return setupCommand;
}
