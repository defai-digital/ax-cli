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
import { getCommandTranslations } from '../i18n/loader.js';
import { resetCachedLanguage } from '../ui/hooks/use-translations.js';

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
 * Install AutomatosX globally and run silent setup
 */
async function installAutomatosX(): Promise<boolean> {
  try {
    execSync('npm install -g @defai.digital/automatosx', {
      stdio: 'inherit',
      timeout: 180000 // 3 minutes timeout
    });
    // Run silent setup after installation
    try {
      execSync('ax setup --silent', {
        stdio: 'inherit',
        timeout: 60000 // 1 minute timeout
      });
    } catch {
      // Silent setup failed, but installation succeeded
    }
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
 * Setup options interface
 */
export interface ProviderSetupOptions {
  force?: boolean;
  validate?: boolean;
  silent?: boolean;
}

/**
 * Run the provider setup wizard
 * Exported for use when CLI detects missing configuration
 */
export async function runProviderSetup(
  provider: ProviderDefinition,
  options: ProviderSetupOptions = {}
): Promise<void> {
  const cliName = provider.branding.cliName;
  const website = getProviderWebsite(provider);

  try {
    // Load initial translations using existing config language or English
    const settingsManager = getSettingsManager();
    let initialLang: SupportedLanguageType = 'en';
    try {
      initialLang = settingsManager.getLanguage();
    } catch {
      // Ignore - use English if settings can't be read
    }
    let t = getCommandTranslations(initialLang as SupportedLanguageType);

    // Show intro with provider-specific branding
    prompts.intro(chalk.cyan(`${cliName.toUpperCase()} ${t.setup.title}`));

    await prompts.note(
      `${provider.branding.description}\n\n` +
      `${t.setup.provider}: ${provider.displayName}\n` +
      `${t.setup.apiKeyHint}: ${website}`,
      t.setup.welcome || 'Welcome'
    );

    // ═══════════════════════════════════════════════════════════════════
    // Legacy Migration Check (skip in silent mode)
    // ═══════════════════════════════════════════════════════════════════
    // Check for legacy ~/.ax-cli/ config and offer migration
    if (!options.silent && ConfigMigrator.hasLegacyConfig() && !ConfigMigrator.wasAlreadyMigrated(provider)) {
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
            `${t.setup.configExists || 'Existing configuration found at'}:\n${configPath}`,
            t.setup.configExistsTitle || 'Configuration Exists'
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
    prompts.log.step(chalk.bold(`${t.setup.step} 1/${totalSteps} — ${t.setup.chooseLanguage}`));

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

    let selectedLanguage: SupportedLanguageType;
    if (options.silent) {
      // Silent mode: use existing language or default
      selectedLanguage = currentLang;
      prompts.log.info(`${t.setup.language}: ${languageChoices.find(l => l.value === selectedLanguage)?.label || selectedLanguage}`);
    } else {
      const langChoice = await prompts.select({
        message: t.setup.selectLanguage,
        options: languageChoices,
        initialValue: currentLang,
      });
      exitIfCancelled(langChoice);
      selectedLanguage = langChoice as SupportedLanguageType;
    }

    // Reload translations for selected language
    t = getCommandTranslations(selectedLanguage);

    // Show language confirmation
    if (selectedLanguage !== initialLang) {
      const langLabel = languageChoices.find(l => l.value === selectedLanguage)?.label ?? selectedLanguage;
      prompts.log.info(`${t.setup.languageChanged || 'Language set to'} ${langLabel}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Server URL (GLM only - Grok is always online)
    // ═══════════════════════════════════════════════════════════════════
    let selectedBaseURL = provider.defaultBaseURL;
    let isLocalServer = false;

    if (provider.name === 'glm') {
      prompts.log.step(chalk.bold(`${t.setup.step} 2/${totalSteps} — ${t.setup.serverSelection}`));

      if (options.silent) {
        // Silent mode: use existing URL or default cloud
        selectedBaseURL = existingConfig?.baseURL || provider.defaultBaseURL;
        isLocalServer = existingConfig?._isLocalServer || false;
        prompts.log.info(`${t.setup.baseUrl}: ${selectedBaseURL}`);
      } else {
        const serverType = await prompts.select({
          message: t.setup.selectServerType,
          options: [
            {
              value: 'zai',
              label: `${t.setup.cloudRecommended}`,
              hint: t.setup.cloudHint,
            },
            {
              value: 'local',
              label: t.setup.localCustom,
              hint: t.setup.localHint,
            },
          ],
          initialValue: 'zai',
        });
        exitIfCancelled(serverType);

        if (serverType === 'local') {
          isLocalServer = true;

          await prompts.note(
            `${t.setup.supportedServers}:\n` +
            '• Ollama:   http://localhost:11434/v1\n' +
            '• LMStudio: http://localhost:1234/v1\n' +
            '• vLLM:     http://localhost:8000/v1',
            t.setup.localServerOptions
          );

          const customURL = await prompts.text({
            message: t.setup.enterServerUrl,
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
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: API Key with Connection Test Loop (or Step 2 for Grok)
    // ═══════════════════════════════════════════════════════════════════
    const apiKeyStepNum = provider.name === 'glm' ? 3 : 2;
    prompts.log.step(chalk.bold(`${t.setup.step} ${apiKeyStepNum}/${totalSteps} — ${t.setup.apiKeyStep}`));

    let apiKey = '';
    let connectionValidated = false;
    const shouldSkipValidation = options.validate === false || isLocalServer || options.silent;

    // Check for existing key
    const hasExistingKey = existingConfig?.apiKey && typeof existingConfig.apiKey === 'string' && existingConfig.apiKey.trim().length > 0;

    if (options.silent && hasExistingKey && existingConfig?.apiKey) {
      // Silent mode: reuse existing API key
      apiKey = existingConfig.apiKey;
      prompts.log.success(t.setup.useExistingKey || 'Using existing API key');
      connectionValidated = true;
    } else if (options.silent && !hasExistingKey) {
      // Silent mode without existing key - error
      prompts.log.error(t.setup.apiKeyRequired || 'API key is required');
      prompts.log.info(`${t.setup.apiKeyHint}: ${website}`);
      process.exit(1);
    } else if (hasExistingKey && existingConfig?.apiKey) {
      const key = existingConfig.apiKey;
      const maskedKey = key.length > 12
        ? `${key.substring(0, 8)}...${key.substring(key.length - 4)}`
        : `${key.substring(0, Math.min(4, key.length))}...`;

      await prompts.note(
        `Key: ${maskedKey}`,
        t.setup.existingApiKey || 'Existing API Key'
      );

      const reuseKey = await prompts.confirm({
        message: t.setup.useExistingKey || 'Use existing API key?',
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
        prompts.log.info(`${t.setup.apiKeyHint}: ${website}`);
        const newKey = await prompts.password({
          message: t.setup.enterApiKey,
          validate: (value) => value?.trim().length > 0 ? undefined : t.setup.apiKeyRequired || 'API key is required',
        });
        exitIfCancelled(newKey);
        apiKey = newKey.trim();
      }

      // Test connection
      if (shouldSkipValidation) {
        prompts.log.info(t.setup.skipValidation || 'Skipping validation' + (isLocalServer ? ' (local server)' : ''));
        connectionValidated = true;
      } else {
        const spinner = prompts.spinner();
        spinner.start(t.setup.testingConnection);

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
          spinner.stop(t.setup.connectionSuccess);
          prompts.log.success(t.setup.apiKeyValidated || 'API key validated');
          connectionValidated = true;
        } else {
          spinner.stop(t.setup.connectionFailed);

          // Show error details
          if (validationResult.authentication && !validationResult.authentication.success) {
            prompts.log.error(`${t.setup.authError || 'Authentication'}: ${validationResult.authentication.error || validationResult.authentication.message}`);
          } else if (validationResult.endpoint && !validationResult.endpoint.success) {
            prompts.log.error(`${t.setup.endpointError || 'Endpoint'}: ${validationResult.endpoint.error || validationResult.endpoint.message}`);
          }

          console.log(''); // Blank line

          // Ask user what to do
          const retryChoice = await prompts.select({
            message: t.setup.retryOrSkip,
            options: [
              { value: 'retry', label: t.setup.retry, hint: t.setup.retryHint || 'Try again with a new key' },
              { value: 'skip', label: t.setup.continueAnyway, hint: t.setup.continueAnywayHint || 'Save config without validation' },
              { value: 'quit', label: t.setup.cancelSetup || 'Cancel setup', hint: t.setup.cancelHint || 'Press Esc or select to quit' },
            ],
          });
          exitIfCancelled(retryChoice);

          if (retryChoice === 'retry') {
            apiKey = ''; // Clear to prompt for new key
            continue;
          } else if (retryChoice === 'skip') {
            prompts.log.warn(t.setup.proceedingWithoutValidation || 'Proceeding with unvalidated configuration');
            connectionValidated = true;
          } else {
            prompts.cancel(t.setup.setupCancelled);
            process.exit(0);
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Model Selection (or Step 3 for Grok)
    // ═══════════════════════════════════════════════════════════════════
    const modelStepNum = provider.name === 'glm' ? 4 : 3;
    prompts.log.step(chalk.bold(`${t.setup.step} ${modelStepNum}/${totalSteps} — ${t.setup.modelSelection}`));

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
        label: isDefault ? `${config.name} (${t.setup.recommended})` : config.name,
        hint: `${contextInfo} ${t.setup.context} • ${config.description}`,
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

    let chosenModel: string;
    if (options.silent) {
      // Silent mode: use existing model or default
      chosenModel = initialModel;
      prompts.log.info(`${t.setup.model}: ${chosenModel}`);
    } else {
      const modelSelection = await prompts.select({
        message: t.setup.selectModel,
        options: modelChoices,
        initialValue: initialModel,
      });
      exitIfCancelled(modelSelection);
      chosenModel = modelSelection;
    }

    const modelConfig = provider.models[chosenModel];

    // Safety check - should not happen but prevents crash
    if (!modelConfig) {
      prompts.log.error(`Model "${chosenModel}" not found in provider configuration`);
      prompts.cancel(t.setup.configSaveFailed || 'Setup failed due to invalid model selection.');
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
      prompts.log.info(`${contextStr} ${t.setup.context} • ${t.setup.features}: ${features.join(', ')}`);
    } else {
      prompts.log.info(`${contextStr} ${t.setup.context}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: Review & Save (or Step 4 for Grok)
    // ═══════════════════════════════════════════════════════════════════
    const saveStepNum = provider.name === 'glm' ? 5 : 4;
    prompts.log.step(chalk.bold(`${t.setup.step} ${saveStepNum}/${totalSteps} — ${t.setup.reviewSave}`));

    const maxTokens = modelConfig.maxOutputTokens > 32768 ? 32768 : modelConfig.maxOutputTokens;

    // Get language display name
    const langDisplay = languageChoices.find(l => l.value === selectedLanguage)?.label ?? selectedLanguage;

    await prompts.note(
      `${t.setup.language}:    ${langDisplay}\n` +
      `${t.setup.provider}:    ${provider.displayName}${isLocalServer ? ' (Local)' : ''}\n` +
      `${t.setup.baseUrl}:    ${selectedBaseURL}\n` +
      `${t.setup.model}:       ${chosenModel}\n` +
      `${t.setup.maxTokens}:  ${existingConfig?.maxTokens ?? maxTokens}\n` +
      `${t.setup.configPath}: ${configPath}`,
      t.setup.configSummary
    );

    if (!options.silent) {
      const confirmSave = await prompts.confirm({
        message: t.setup.saveSettings,
        initialValue: true,
      });
      exitIfCancelled(confirmSave);

      if (!confirmSave) {
        prompts.cancel(t.setup.setupCancelled);
        process.exit(0);
      }
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
      // CRITICAL: Invalidate the translation cache so UI uses the new language
      resetCachedLanguage();
      prompts.log.success(t.setup.configSaved);
    } catch (saveError) {
      prompts.log.error(`${t.setup.configSaveFailed}: ${extractErrorMessage(saveError)}`);
      prompts.log.info(`${t.setup.configPath}: ${configPath}`);
      prompts.log.info(t.setup.checkPermissions || 'Please check file permissions and disk space.');
      process.exit(1);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Provider-Specific MCP Integration (GLM with Z.AI only, not local)
    // ═══════════════════════════════════════════════════════════════════
    if (provider.name === 'glm' && !isLocalServer) {
      await prompts.note(
        `${t.setup.enablingMcp}:\n` +
        `- ${t.setup.webSearch} - Real-time web search\n` +
        `- ${t.setup.webReader} - Extract content from web pages\n` +
        `- ${t.setup.vision} - Image/video analysis (Node.js 22+)`,
        t.setup.mcpIntegration
      );

      const mcpSpinner = prompts.spinner();
      mcpSpinner.start(t.setup.configuringMcp);

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

        mcpSpinner.stop(t.setup.mcpConfigured.replace('{count}', String(successCount)));
      } catch (error) {
        mcpSpinner.stop(t.setup.mcpFailed);
        prompts.log.warn(`${extractErrorMessage(error)}`);
        prompts.log.info(`${t.setup.enableLater}: ${cliName} mcp add-zai`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // AutomatosX Integration
    // ═══════════════════════════════════════════════════════════════════
    await prompts.note(
      t.setup.automatosxDesc,
      t.setup.automatosx
    );

    let axStatus = getAutomatosXStatus();

    if (axStatus.installed) {
      prompts.log.success(`${t.setup.automatosxFound}${axStatus.version ? ` (v${axStatus.version})` : ''}`);

      if (!options.silent) {
        const axSpinner = prompts.spinner();
        axSpinner.start(t.setup.checkAutomatosx);

        const updated = await updateAutomatosX();
        if (updated) {
          axStatus = getAutomatosXStatus(); // Refresh version after update
          axSpinner.stop(t.setup.automatosxUpdated || `AutomatosX updated${axStatus.version ? ` to v${axStatus.version}` : ''}`);
        } else {
          axSpinner.stop(t.setup.automatosxUpdateFailed || 'Could not update AutomatosX');
          prompts.log.info(t.setup.runManually || 'Run manually: ax update -y');
        }
      }
    } else if (!options.silent) {
      try {
        const installResponse = await prompts.confirm({
          message: t.setup.installAutomatosxPrompt || 'Install AutomatosX for multi-agent AI orchestration?',
          initialValue: true,
        });

        if (!prompts.isCancel(installResponse) && installResponse) {
          const installSpinner = prompts.spinner();
          installSpinner.start(t.setup.installingAutomatosx || 'Installing AutomatosX...');

          const installed = await installAutomatosX();
          if (installed) {
            installSpinner.stop(t.setup.automatosxInstalled || 'AutomatosX installed successfully!');
            prompts.log.info(t.setup.runAxList || 'Run `ax list agents` to see available AI agents.');
            axStatus = getAutomatosXStatus(); // Refresh status after install
          } else {
            installSpinner.stop(t.setup.automatosxInstallFailed || 'Could not install AutomatosX');
            prompts.log.info(`${t.setup.installAutomatosx}`);
          }
        } else if (!prompts.isCancel(installResponse)) {
          prompts.log.info(`${t.setup.installAutomatosx}`);
        }
      } catch {
        prompts.log.info(t.setup.skippingAutomatosx || 'Skipping AutomatosX setup (non-interactive mode).');
        prompts.log.info(`${t.setup.installAutomatosx}`);
      }
    } else {
      // Silent mode: skip AutomatosX install
      prompts.log.info(t.setup.skippingAutomatosx || 'Skipping AutomatosX setup (silent mode).');
    }

    // Agent-First Mode Configuration (only ask if AutomatosX is available and not silent)
    if (axStatus.installed && !options.silent) {
      await prompts.note(
        `${t.setup.agentFirstDesc || `When enabled, ${cliName} automatically routes tasks to specialized agents`}\n` +
        `${t.setup.agentFirstKeywords || 'based on keywords (e.g., "test" -> testing agent, "refactor" -> refactoring agent).'}\n` +
        `${t.setup.agentFirstDefault || 'When disabled (default), you use the direct LLM and can invoke agents explicitly.'}`,
        t.setup.agentFirstMode || 'Agent-First Mode'
      );

      try {
        const enableAgentFirst = await prompts.confirm({
          message: t.setup.enableAgentFirst || 'Enable agent-first mode (auto-route to specialized agents)?',
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
            prompts.log.success(t.setup.agentFirstEnabled || 'Agent-first mode enabled');
            prompts.log.info(t.setup.agentFirstEnabledInfo || 'Tasks will be automatically routed to specialized agents.');
          } else {
            prompts.log.success(t.setup.agentFirstDisabled || 'Agent-first mode disabled (default)');
            prompts.log.info(t.setup.agentFirstDisabledInfo || 'Use direct LLM. Invoke agents with --agent flag when needed.');
          }
        }
      } catch {
        prompts.log.info(t.setup.skippingAgentFirst || 'Skipping agent-first configuration (non-interactive mode).');
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Project Initialization (skip in silent mode)
    // ═══════════════════════════════════════════════════════════════════
    if (!options.silent) {
      await prompts.note(
        `${t.setup.projectInitDesc || 'Project initialization analyzes your codebase and creates:'}\n` +
        '• CUSTOM.md - AI instructions tailored to your project\n' +
        '• ax.index.json - Full project analysis (AI reads when needed)\n' +
        '• ax.summary.json - Prompt summary (~500 tokens, fast loading)\n\n' +
        `${t.setup.projectInitBenefit || 'This helps the AI understand your codebase from the first message.'}`,
        t.setup.projectInit || 'Project Initialization'
      );
    }

    try {
      let initProject = false;
      if (options.silent) {
        // Silent mode: skip project initialization
        prompts.log.info(t.setup.skippingProjectInit || 'Skipping project initialization (silent mode).');
        prompts.log.info(`${t.setup.initLater || 'Initialize later with'}: ${cliName} init`);
      } else {
        const initChoice = await prompts.confirm({
          message: t.setup.initProjectNow || 'Initialize current project now?',
          initialValue: true,
        });
        initProject = !prompts.isCancel(initChoice) && initChoice;
      }

      if (initProject) {
        const initSpinner = prompts.spinner();
        initSpinner.start(t.setup.analyzingProject || 'Analyzing project and generating context...');

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

            initSpinner.stop(t.setup.projectInitSuccess || 'Project initialized successfully!');
            prompts.log.success(`${t.setup.created || 'Created'}: ${activeConfigPaths.DIR_NAME}/CUSTOM.md`);
            prompts.log.success(`${t.setup.created || 'Created'}: ax.index.json`);
            prompts.log.success(`${t.setup.created || 'Created'}: ax.summary.json`);
          } else {
            initSpinner.stop(t.setup.projectAnalysisFailed || 'Could not analyze project');
            prompts.log.warn(result.error || t.setup.projectAnalysisFailed || 'Project analysis failed');
            prompts.log.info(`${t.setup.initLater || 'You can initialize later with'}: ${cliName} init`);
          }
        } catch (initError) {
          initSpinner.stop(t.setup.projectInitFailed || 'Project initialization failed');
          prompts.log.warn(`${extractErrorMessage(initError)}`);
          prompts.log.info(`${t.setup.initLater || 'You can initialize later with'}: ${cliName} init`);
        }
      }
    } catch {
      prompts.log.info(t.setup.skippingProjectInit || 'Skipping project initialization (non-interactive mode).');
      prompts.log.info(`${t.setup.initLater || 'Initialize later with'}: ${cliName} init`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Completion Summary
    // ═══════════════════════════════════════════════════════════════════
    await prompts.note(
      `${t.setup.configPath}:    ${configPath}\n` +
      `${t.setup.language}:    ${langDisplay}\n` +
      `${t.setup.provider}:    ${provider.displayName}${isLocalServer ? ' (Local)' : ''}\n` +
      `${t.setup.baseUrl}:    ${selectedBaseURL}\n` +
      `${t.setup.model}:       ${chosenModel}\n` +
      `${t.setup.maxTokens}:  ${mergedConfig.maxTokens || maxTokens}\n` +
      `Temperature: ${mergedConfig.temperature ?? 0.7}`,
      t.setup.configDetails || 'Configuration Details'
    );

    await prompts.note(
      `1. ${t.setup.startInteractive || 'Start interactive mode'}:\n` +
      `   $ ${cliName}\n\n` +
      `2. ${t.setup.runQuickTest || 'Run a quick test'}:\n` +
      `   $ ${cliName} -p "Hello, introduce yourself"`,
      t.setup.nextSteps || 'Next Steps'
    );

    // Provider-specific tips
    const tips: string[] = [
      `${t.setup.editConfig || 'Edit config manually'}:  ${configPath}`,
      `${t.setup.viewHelp || 'View help'}:             ${cliName} --help`,
      `${t.setup.changeLang || 'Change language'}:       /lang (inside ${cliName})`,
    ];

    if (provider.features.supportsThinking) {
      tips.push(`${t.setup.enableThinking || 'Enable thinking mode'}:  ${cliName} --think`);
    }
    if (provider.features.supportsSeed) {
      tips.push(`${t.setup.reproducibleOutput || 'Reproducible output'}:   ${cliName} --seed 42`);
    }
    if (provider.features.supportsVision) {
      const visionModel = Object.entries(provider.models).find(([, c]) => c.supportsVision)?.[0];
      if (visionModel) {
        tips.push(`${t.setup.useVisionModel || 'Use vision model'}:      ${cliName} -m ${visionModel}`);
      }
    }

    await prompts.note(tips.join('\n'), t.setup.tips || 'Tips');

    prompts.outro(chalk.green(t.setup.setupComplete + ' ' + (t.setup.getStarted || 'Happy coding!')));

  } catch (error: unknown) {
    const err = error as { message?: string; name?: string };
    if (err?.message === 'canceled' || err?.name === 'canceled') {
      prompts.cancel('Setup cancelled by user.');
      process.exit(0);
    }

    prompts.log.error(`Setup failed: ${extractErrorMessage(error)}`);
    process.exit(1);
  }
}

/**
 * Create a provider-specific setup command
 */
export function createProviderSetupCommand(provider: ProviderDefinition): Command {
  const setupCommand = new Command('setup');
  const cliName = provider.branding.cliName;

  setupCommand
    .description(`Initialize ${cliName} configuration with ${provider.displayName}`)
    .option('--force', 'Overwrite existing configuration')
    .option('--no-validate', 'Skip validation of API endpoint and credentials')
    .option('-s, --silent', 'Non-interactive mode with default settings (uses selected language)')
    .action(async (options: ProviderSetupOptions) => {
      await runProviderSetup(provider, options);
    });

  return setupCommand;
}
