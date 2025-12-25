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
import { ConfigMigrator } from '../utils/config-migrator.js';
import type { UserSettings } from '../schemas/settings-schemas.js';
import type { ProviderDefinition } from '../provider/config.js';
import { getActiveConfigPaths } from '../provider/config.js';
import {
  detectZAIServices,
  getRecommendedServers,
  generateZAIServerConfig,
} from '../mcp/index.js';
import { addUserMCPServer, removeUserMCPServer } from '../mcp/config.js';
import { FILE_NAMES } from '../constants.js';
import { exitIfCancelled } from './utils.js';
import type { SupportedLanguageType } from '../schemas/settings-schemas.js';

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

        // ═══════════════════════════════════════════════════════════════════
        // Legacy Migration Check
        // ═══════════════════════════════════════════════════════════════════
        // Check for legacy ~/.ax-cli/ config and offer migration
        if (ConfigMigrator.hasLegacyConfig() && !ConfigMigrator.wasAlreadyMigrated(provider)) {
          const legacyConfig = ConfigMigrator.loadLegacyConfig();

          if (legacyConfig) {
            const summary = ConfigMigrator.getMigrationSummary(legacyConfig);

            // Only prompt if there are settings worth migrating
            if (summary.hasMigratableSettings) {
              const choice = await ConfigMigrator.promptForMigration(provider, summary);

              if (choice === 'migrate') {
                const result = ConfigMigrator.migrate(legacyConfig, provider);
                if (result.success && result.migratedSettings.length > 0) {
                  prompts.log.success(`Migrated ${result.migratedSettings.length} settings from legacy config`);
                }
              } else if (choice === 'fresh') {
                // Mark as migrated so we don't ask again
                ConfigMigrator.markAsMigrated(provider);
                prompts.log.info('Starting with fresh configuration');
              }
              // 'skip' - will ask again next time, don't mark

              console.log(''); // Blank line before continuing
            } else {
              // No migratable settings, just mark as checked
              ConfigMigrator.markAsMigrated(provider);
            }
          }
        }

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
        // STEP 1: Language Selection
        // ═══════════════════════════════════════════════════════════════════
        const totalSteps = provider.name === 'glm' ? 5 : 4;
        prompts.log.step(chalk.bold(`Step 1/${totalSteps} — Choose Language`));

        const languageChoices: { value: SupportedLanguageType; label: string; hint: string }[] = [
          { value: 'en', label: 'English', hint: 'Default' },
          { value: 'zh-CN', label: '简体中文', hint: 'Simplified Chinese' },
          { value: 'zh-TW', label: '繁體中文', hint: 'Traditional Chinese' },
          { value: 'ja', label: '日本語', hint: 'Japanese' },
          { value: 'ko', label: '한국어', hint: 'Korean' },
          { value: 'th', label: 'ไทย', hint: 'Thai' },
          { value: 'vi', label: 'Tiếng Việt', hint: 'Vietnamese' },
          { value: 'de', label: 'Deutsch', hint: 'German' },
          { value: 'fr', label: 'Français', hint: 'French' },
          { value: 'es', label: 'Español', hint: 'Spanish' },
          { value: 'pt', label: 'Português', hint: 'Portuguese' },
        ];

        // Get existing language from config
        const existingLang = existingConfig?.language;
        const currentLang: SupportedLanguageType = typeof existingLang === 'string'
          ? existingLang as SupportedLanguageType
          : (existingLang?.current ?? 'en');

        const selectedLanguage = await prompts.select({
          message: 'Select display language:',
          options: languageChoices,
          initialValue: currentLang,
        });
        exitIfCancelled(selectedLanguage);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: Server URL (GLM only - Grok is always online)
        // ═══════════════════════════════════════════════════════════════════
        let selectedBaseURL = provider.defaultBaseURL;
        let isLocalServer = false;

        if (provider.name === 'glm') {
          prompts.log.step(chalk.bold(`Step 2/${totalSteps} — Server Selection`));

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
        // STEP 3: API Key with Connection Test Loop (or Step 2 for Grok)
        // ═══════════════════════════════════════════════════════════════════
        const apiKeyStep = provider.name === 'glm' ? `Step 3/${totalSteps}` : `Step 2/${totalSteps}`;
        prompts.log.step(chalk.bold(`${apiKeyStep} — API Key & Connection Test`));

        let apiKey = '';
        let connectionValidated = false;
        const shouldSkipValidation = options.validate === false || isLocalServer;

        // Check for existing key
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
          }
        }

        // API Key entry and validation loop
        while (!connectionValidated) {
          // If no API key yet, prompt for one
          if (!apiKey) {
            prompts.log.info(`Get your API key from: ${website}`);
            const newKey = await prompts.password({
              message: `Enter your ${provider.displayName} API key:`,
              validate: (value) => value?.trim().length > 0 ? undefined : 'API key is required',
            });
            exitIfCancelled(newKey);
            apiKey = newKey.trim();
          }

          // Test connection
          if (shouldSkipValidation) {
            prompts.log.info('Skipping validation' + (isLocalServer ? ' (local server)' : ''));
            connectionValidated = true;
          } else {
            const spinner = prompts.spinner();
            spinner.start('Testing API connection...');

            const validationResult = await validateProviderSetup(
              {
                baseURL: selectedBaseURL,
                apiKey: apiKey,
                model: provider.defaultModel,
                providerName: provider.name,
              },
              false
            );

            if (validationResult.success) {
              spinner.stop('Connection successful!');
              prompts.log.success('API key validated');
              connectionValidated = true;
            } else {
              spinner.stop('Connection failed');

              // Show error details
              if (validationResult.authentication && !validationResult.authentication.success) {
                prompts.log.error(`Authentication: ${validationResult.authentication.error || validationResult.authentication.message}`);
              } else if (validationResult.endpoint && !validationResult.endpoint.success) {
                prompts.log.error(`Endpoint: ${validationResult.endpoint.error || validationResult.endpoint.message}`);
              }

              console.log(''); // Blank line

              // Ask user what to do
              const retryChoice = await prompts.select({
                message: 'Connection failed. What would you like to do?',
                options: [
                  { value: 'retry', label: 'Enter a different API key', hint: 'Try again with a new key' },
                  { value: 'skip', label: 'Continue anyway', hint: 'Save config without validation' },
                  { value: 'quit', label: 'Cancel setup', hint: 'Press Esc or select to quit' },
                ],
              });
              exitIfCancelled(retryChoice);

              if (retryChoice === 'retry') {
                apiKey = ''; // Clear to prompt for new key
                continue;
              } else if (retryChoice === 'skip') {
                prompts.log.warn('Proceeding with unvalidated configuration');
                connectionValidated = true;
              } else {
                prompts.cancel('Setup cancelled.');
                process.exit(0);
              }
            }
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: Model Selection (or Step 3 for Grok)
        // ═══════════════════════════════════════════════════════════════════
        const modelStep = provider.name === 'glm' ? `Step 4/${totalSteps}` : `Step 3/${totalSteps}`;
        prompts.log.step(chalk.bold(`${modelStep} — Choose Model`));

        // Format context window for display
        const formatContext = (tokens: number): string => {
          if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(0)}M`;
          if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
          return String(tokens);
        };

        // Build model choices from provider definition with context info
        // Sort: default first, then by context window (descending)
        const modelEntries = Object.entries(provider.models);
        modelEntries.sort((a, b) => {
          // Default model first
          if (a[0] === provider.defaultModel) return -1;
          if (b[0] === provider.defaultModel) return 1;
          // Then by context window (descending)
          return b[1].contextWindow - a[1].contextWindow;
        });

        const modelChoices = modelEntries.map(([modelId, config]) => {
          const contextInfo = formatContext(config.contextWindow);
          const isDefault = modelId === provider.defaultModel;
          return {
            value: modelId,
            label: isDefault ? `${config.name} (recommended)` : config.name,
            hint: `${contextInfo} context • ${config.description}`,
          };
        });

        // Safety check - should never happen but prevents crash if provider has no models
        if (modelChoices.length === 0) {
          prompts.log.error('No models available for this provider');
          prompts.cancel('Setup failed: Provider configuration is invalid.');
          process.exit(1);
        }

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

        // Safety check - should not happen but prevents crash
        if (!modelConfig) {
          prompts.log.error(`Model "${chosenModel}" not found in provider configuration`);
          prompts.cancel('Setup failed due to invalid model selection.');
          process.exit(1);
        }

        // Show model features
        const features: string[] = [];
        if (modelConfig.supportsThinking) features.push('Thinking');
        if (modelConfig.supportsVision) features.push('Vision');
        if (modelConfig.supportsSearch) features.push('Search');
        if (modelConfig.supportsSeed) features.push('Seed');

        const contextStr = formatContext(modelConfig.contextWindow);
        if (features.length > 0) {
          prompts.log.info(`${contextStr} context • Features: ${features.join(', ')}`);
        } else {
          prompts.log.info(`${contextStr} context window`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 5: Review & Save (or Step 4 for Grok)
        // ═══════════════════════════════════════════════════════════════════
        const saveStep = provider.name === 'glm' ? `Step 5/${totalSteps}` : `Step 4/${totalSteps}`;
        prompts.log.step(chalk.bold(`${saveStep} — Review & Save`));

        const maxTokens = modelConfig.maxOutputTokens > 32768 ? 32768 : modelConfig.maxOutputTokens;

        // Get language display name
        const langDisplay = languageChoices.find(l => l.value === selectedLanguage)?.label ?? selectedLanguage;

        await prompts.note(
          `Language:    ${langDisplay}\n` +
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
          language: selectedLanguage,
          _provider: provider.displayName,
          _website: website,
          _isLocalServer: isLocalServer,
        } as UserSettings;

        // Persist using settings manager to ensure encryption + permissions
        try {
          settingsManager.saveUserSettings(mergedConfig);
          prompts.log.success('Configuration saved successfully!');
        } catch (saveError) {
          prompts.log.error(`Failed to save configuration: ${extractErrorMessage(saveError)}`);
          prompts.log.info(`Config path: ${configPath}`);
          prompts.log.info('Please check file permissions and disk space.');
          process.exit(1);
        }

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
        // Project Initialization
        // ═══════════════════════════════════════════════════════════════════
        await prompts.note(
          'Project initialization analyzes your codebase and creates:\n' +
          '• CUSTOM.md - AI instructions tailored to your project\n' +
          '• ax.index.json - Full project analysis (AI reads when needed)\n' +
          '• ax.summary.json - Prompt summary (~500 tokens, fast loading)\n\n' +
          'This helps the AI understand your codebase from the first message.',
          'Project Initialization'
        );

        try {
          const initProject = await prompts.confirm({
            message: 'Initialize current project now?',
            initialValue: true,
          });

          if (!prompts.isCancel(initProject) && initProject) {
            const initSpinner = prompts.spinner();
            initSpinner.start('Analyzing project and generating context...');

            try {
              // Run project initialization using the init command logic
              const { ProjectAnalyzer } = await import('../utils/project-analyzer.js');
              const { LLMOptimizedInstructionGenerator } = await import('../utils/llm-optimized-instruction-generator.js');
              const { writeFileSync, mkdirSync } = await import('fs');
              const { join } = await import('path');

              const projectRoot = process.cwd();
              const projectConfigDir = join(projectRoot, activeConfigPaths.DIR_NAME);
              const customMdPath = join(projectConfigDir, FILE_NAMES.CUSTOM_MD);
              const indexPath = join(projectRoot, FILE_NAMES.AX_INDEX_JSON);
              const summaryPath = join(projectRoot, FILE_NAMES.AX_SUMMARY_JSON);

              // Ensure project config directory exists
              if (!existsSync(projectConfigDir)) {
                mkdirSync(projectConfigDir, { recursive: true });
              }

              // Analyze project
              const analyzer = new ProjectAnalyzer(projectRoot);
              const result = await analyzer.analyze();

              if (result.success && result.projectInfo) {
                // Generate LLM-optimized instructions
                const generator = new LLMOptimizedInstructionGenerator({
                  compressionLevel: 'moderate',
                  hierarchyEnabled: true,
                  criticalRulesCount: 5,
                  includeDODONT: true,
                  includeTroubleshooting: true,
                });

                const instructions = generator.generateInstructions(result.projectInfo);
                const index = generator.generateIndex(result.projectInfo);
                const summary = generator.generateSummary(result.projectInfo);

                // Write files
                writeFileSync(customMdPath, instructions, 'utf-8');
                writeFileSync(indexPath, index, 'utf-8');
                writeFileSync(summaryPath, summary, 'utf-8');

                initSpinner.stop('Project initialized successfully!');
                prompts.log.success(`Created: ${activeConfigPaths.DIR_NAME}/CUSTOM.md`);
                prompts.log.success('Created: ax.index.json');
                prompts.log.success('Created: ax.summary.json');
              } else {
                initSpinner.stop('Could not analyze project');
                prompts.log.warn(result.error || 'Project analysis failed');
                prompts.log.info(`You can initialize later with: ${cliName} init`);
              }
            } catch (initError) {
              initSpinner.stop('Project initialization failed');
              prompts.log.warn(`${extractErrorMessage(initError)}`);
              prompts.log.info(`You can initialize later with: ${cliName} init`);
            }
          } else if (!prompts.isCancel(initProject)) {
            prompts.log.info(`You can initialize later with: ${cliName} init`);
          }
        } catch {
          prompts.log.info('Skipping project initialization (non-interactive mode).');
          prompts.log.info(`Initialize later with: ${cliName} init`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // Completion Summary
        // ═══════════════════════════════════════════════════════════════════
        await prompts.note(
          `Location:    ${configPath}\n` +
          `Language:    ${langDisplay}\n` +
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
          '2. Run a quick test:\n' +
          `   $ ${cliName} -p "Hello, introduce yourself"`,
          'Next Steps'
        );

        // Provider-specific tips
        const tips: string[] = [
          `Edit config manually:  ${configPath}`,
          `View help:             ${cliName} --help`,
          `Change language:       /lang (inside ${cliName})`,
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
