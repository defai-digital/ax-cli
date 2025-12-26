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
import type { UserSettings, SupportedLanguageType } from '../schemas/settings-schemas.js';
import { getActiveConfigPaths, getActiveProvider, GLM_PROVIDER, GROK_PROVIDER } from '../provider/config.js';
import { getCommandTranslations } from '../i18n/loader.js';
import { resetCachedLanguage } from '../ui/hooks/use-translations.js';
import {
  detectZAIServices,
  getRecommendedServers,
  generateZAIServerConfig,
} from '../mcp/index.js';
import { addUserMCPServer, removeUserMCPServer } from '../mcp/config.js';
import { exitIfCancelled } from './utils.js';

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
 * Run AutomatosX setup with force flag
 */
async function runAutomatosXSetup(): Promise<boolean> {
  try {
    execSync('ax setup -f', {
      stdio: 'inherit',
      timeout: 120000 // 2 minutes timeout
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Provider configurations for setup wizard
 *
 * NOTE: Model names are derived from centralized provider configs (GLM_PROVIDER, GROK_PROVIDER)
 * to ensure consistency. When updating models, only update the provider config files.
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

const HIGH_TOKEN_PROVIDERS = new Set(['z.ai', 'z.ai-free', 'x.ai']);

/**
 * Get GLM model description from provider config
 */
function getGLMModelDescription(): string {
  const model = GLM_PROVIDER.models[GLM_PROVIDER.defaultModel];
  const contextK = Math.round(model?.contextWindow / 1000) || 131;
  return `Z.AI with ${GLM_PROVIDER.defaultModel.toUpperCase()} - ${model?.description || 'Advanced reasoning'} (${contextK}K context)`;
}

/**
 * Get Grok model description from provider config
 */
function getGrokModelDescription(): string {
  const model = GROK_PROVIDER.models[GROK_PROVIDER.defaultModel];
  return `xAI ${GROK_PROVIDER.defaultModel} - ${model?.description || 'Search, vision, and code execution'}`;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  'z.ai': {
    name: 'z.ai',
    displayName: 'Z.AI (GLM Models)',
    baseURL: GLM_PROVIDER.defaultBaseURL,
    defaultModel: GLM_PROVIDER.defaultModel, // Uses centralized config
    requiresApiKey: true,
    website: 'https://z.ai',
    description: getGLMModelDescription(),
  },
  'z.ai-free': {
    name: 'z.ai-free',
    displayName: 'Z.AI (Free Plan)',
    baseURL: 'https://api.z.ai/api/paas/v4',
    defaultModel: GLM_PROVIDER.defaultModel, // Uses centralized config
    requiresApiKey: true,
    website: 'https://z.ai',
    description: 'Z.AI Free Plan - Standard API endpoint for non-coding-plan users',
  },
  'x.ai': {
    name: 'x.ai',
    displayName: 'xAI Grok (Recommended)',
    baseURL: GROK_PROVIDER.defaultBaseURL,
    defaultModel: GROK_PROVIDER.defaultModel, // Uses centralized config
    requiresApiKey: true,
    website: 'https://console.x.ai',
    description: getGrokModelDescription(),
  },
  'openai': {
    name: 'openai',
    displayName: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4-turbo',
    requiresApiKey: true,
    website: 'https://platform.openai.com',
    description: 'OpenAI GPT models - Industry-leading language models',
  },
  'anthropic': {
    name: 'anthropic',
    displayName: 'Anthropic (Claude)',
    baseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    requiresApiKey: true,
    website: 'https://console.anthropic.com',
    description: 'Anthropic Claude models - Advanced AI assistant',
  },
  'ollama': {
    name: 'ollama',
    displayName: 'Ollama (Local)',
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    requiresApiKey: false,
    website: 'https://ollama.ai',
    description: 'Local models via Ollama - No API key required',
  },
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

function getDefaultProviderKey(existingProviderKey: string | null, defaultBaseURL: string): string {
  return existingProviderKey || getProviderFromBaseURL(defaultBaseURL) || 'z.ai';
}

/**
 * Setup command - Initialize provider config (e.g., ~/.ax-glm/config.json)
 */
export function createSetupCommand(): Command {
  const setupCommand = new Command('setup');

  setupCommand
    .description('Initialize AX CLI configuration with AI provider selection')
    .option('--force', 'Delete existing configuration and start fresh')
    .option('--no-validate', 'Skip validation of API endpoint and credentials')
    .option('-s, --silent', 'Non-interactive mode with default settings (uses selected language)')
    .action(async (options: {
      force?: boolean;
      validate?: boolean;
      silent?: boolean;
    }) => {
      try {
        // Show intro
        const provider = getActiveProvider();
        const settingsManager = getSettingsManager();

        // Load initial language from config or use English
        let initialLang: SupportedLanguageType = 'en';
        try {
          initialLang = settingsManager.getLanguage();
        } catch {
          // Ignore - use English if settings can't be read
        }
        let t = getCommandTranslations(initialLang);

        prompts.intro(chalk.cyan(`${provider.branding.cliName} ${t.setup.title}`));

        // Use provider-specific config path (~/.ax-glm/config.json or ~/.ax-grok/config.json)
        const configPath = getActiveConfigPaths().USER_CONFIG;
        const configDir = dirname(configPath);

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

            if (existingProviderKey && !options.force && !options.silent) {
              const existingProvider = PROVIDERS[existingProviderKey];
              await prompts.note(
                `${t.setup.provider}: ${existingProvider?.displayName || 'Unknown'}\n` +
                `${t.setup.configPath}: ${configPath}`,
                t.setup.configExistsTitle || 'Existing Configuration Found'
              );
            }
          } catch (error) {
            prompts.log.warn(`Failed to load existing config: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: Language Selection
        // ═══════════════════════════════════════════════════════════════════
        prompts.log.step(chalk.bold(`${t.setup.step} 1/6 — ${t.setup.chooseLanguage}`));

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
          prompts.log.info(`${t.setup.languageChanged} ${langLabel}`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: Provider Selection
        // ═══════════════════════════════════════════════════════════════════
        prompts.log.step(chalk.bold(`${t.setup.step} 2/6 — ${t.setup.provider}`));

        const providerChoices = Object.entries(PROVIDERS).map(([key, prov]) => ({
          value: key,
          label: prov.displayName,
          hint: prov.description,
        }));

        const defaultProviderKey = getDefaultProviderKey(existingProviderKey, provider.defaultBaseURL);
        let providerKey: string;
        if (options.silent) {
          // Silent mode: use existing provider or default
          providerKey = existingProviderKey || defaultProviderKey;
          prompts.log.info(`${t.setup.provider}: ${PROVIDERS[providerKey]?.displayName || providerKey}`);
        } else {
          const provChoice = await prompts.select({
            message: t.setup.selectServerType || 'Select your AI provider:',
            options: providerChoices,
            initialValue: defaultProviderKey,
          });
          exitIfCancelled(provChoice);
          providerKey = provChoice as string;
        }

        const selectedProvider = PROVIDERS[providerKey];

        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: API Key
        // ═══════════════════════════════════════════════════════════════════
        prompts.log.step(chalk.bold(`${t.setup.step} 3/6 — ${t.setup.apiKeyStep}`));

        let apiKey = '';
        if (selectedProvider.requiresApiKey) {
          const isSameProvider = existingProviderKey === providerKey;
          const hasExistingKey = existingConfig?.apiKey && typeof existingConfig.apiKey === 'string' && existingConfig.apiKey.trim().length > 0;

          if (options.silent && hasExistingKey && existingConfig?.apiKey) {
            // Silent mode: reuse existing API key
            apiKey = existingConfig.apiKey;
            prompts.log.success(t.setup.useExistingKey || 'Using existing API key');
          } else if (isSameProvider && hasExistingKey && existingConfig?.apiKey) {
            const key = existingConfig.apiKey;
            const maskedKey = key.length > 12
              ? `${key.substring(0, 8)}...${key.substring(key.length - 4)}`
              : `${key.substring(0, Math.min(4, key.length))}...`;

            await prompts.note(
              `Key: ${maskedKey}`,
              `${t.setup.existingApiKey} ${selectedProvider.displayName}`
            );

            const reuseKey = await prompts.confirm({
              message: t.setup.useExistingKey || 'Use existing API key?',
              initialValue: true,
            });
            exitIfCancelled(reuseKey);

            if (reuseKey) {
              apiKey = existingConfig.apiKey;
              prompts.log.success(t.setup.useExistingKey || 'Using existing API key');
            } else {
              prompts.log.info(`${t.setup.apiKeyHint}: ${selectedProvider.website}`);
              const newKey = await prompts.password({
                message: t.setup.enterApiKey || `Enter new ${selectedProvider.displayName} API key:`,
                validate: (value) => value?.trim().length > 0 ? undefined : t.setup.apiKeyRequired || 'API key is required',
              });
              exitIfCancelled(newKey);
              apiKey = newKey.trim();
            }
          } else if (!options.silent) {
            if (hasExistingKey && !isSameProvider && existingProviderKey) {
              const previousProvider = PROVIDERS[existingProviderKey];
              prompts.log.warn(`Switching from ${previousProvider?.displayName || 'previous provider'} to ${selectedProvider.displayName}`);
            }

            prompts.log.info(`${t.setup.apiKeyHint}: ${selectedProvider.website}`);
            const newKey = await prompts.password({
              message: t.setup.enterApiKey || `Enter your ${selectedProvider.displayName} API key:`,
              validate: (value) => value?.trim().length > 0 ? undefined : t.setup.apiKeyRequired || 'API key is required',
            });
            exitIfCancelled(newKey);
            apiKey = newKey.trim();
          } else {
            // Silent mode without existing key - error
            prompts.log.error(t.setup.apiKeyRequired || 'API key is required');
            prompts.log.info(`${t.setup.apiKeyHint}: ${selectedProvider.website}`);
            exitWithError('API key required in silent mode', ExitCode.CONFIG_ERROR, { command: 'setup' });
          }
        } else {
          prompts.log.success(`${selectedProvider.displayName} doesn't require an API key`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: Model Selection (Primary LLM)
        // ═══════════════════════════════════════════════════════════════════
        prompts.log.step(chalk.bold(`${t.setup.step} 4/6 — ${t.setup.modelSelection}`));

        // Get models that DON'T support vision (primary coding models)
        const activeProvider = getActiveProvider();
        const primaryModels = Object.entries(activeProvider.models)
          .filter(([_, config]) => !config.supportsVision)
          .map(([id]) => id);

        const existingModel = existingConfig?.defaultModel || existingConfig?.currentModel;
        const baseModelOptions = Array.from(
          new Set([
            selectedProvider.defaultModel,
            ...primaryModels,
            ...(existingConfig?.models || []),
            existingModel,
          ].filter(Boolean))
        ) as string[];

        let chosenModel: string;
        if (options.silent) {
          // Silent mode: use existing model or default
          chosenModel = existingModel || selectedProvider.defaultModel;
          prompts.log.info(`${t.setup.model}: ${chosenModel}`);
        } else {
          const modelChoices = baseModelOptions.map(model => ({
            value: model,
            label: model === selectedProvider.defaultModel ? `${model} (${t.setup.recommended})` : model,
          }));
          modelChoices.push({ value: '__custom__', label: 'Other (enter manually)' });

          const modelSelection = await prompts.select({
            message: t.setup.selectModel || 'Select default model for coding tasks:',
            options: modelChoices,
            initialValue: existingModel || selectedProvider.defaultModel,
          });
          exitIfCancelled(modelSelection);

          chosenModel = modelSelection;
          if (modelSelection === '__custom__') {
            const manualModel = await prompts.text({
              message: 'Enter model ID:',
              initialValue: selectedProvider.defaultModel,
              validate: (value) => value?.trim().length > 0 ? undefined : 'Model is required',
            });
            exitIfCancelled(manualModel);
            chosenModel = manualModel.trim();
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 5: Vision Model Selection (if provider supports vision)
        // ═══════════════════════════════════════════════════════════════════
        let chosenVisionModel: string | undefined;

        if (activeProvider.features.supportsVision && activeProvider.defaultVisionModel) {
          prompts.log.step(chalk.bold(`${t.setup.step} 5/6 — ${t.setup.vision}`));

          if (options.silent) {
            // Silent mode: use existing or default vision model
            chosenVisionModel = existingConfig?.visionModel || activeProvider.defaultVisionModel;
            prompts.log.info(`${t.setup.vision}: ${chosenVisionModel}`);
          } else {
            // Get models that DO support vision
            const visionModels = Object.entries(activeProvider.models)
              .filter(([_, config]) => config.supportsVision)
              .map(([id]) => id);

            const existingVisionModel = existingConfig?.visionModel;

            const visionModelChoices = visionModels.map(model => ({
              value: model,
              label: model === activeProvider.defaultVisionModel ? `${model} (${t.setup.recommended})` : model,
            }));
            visionModelChoices.push({ value: '__none__', label: 'None (disable vision)' });
            visionModelChoices.push({ value: '__custom__', label: 'Other (enter manually)' });

            const visionModelSelection = await prompts.select({
              message: t.setup.selectModel || 'Select model for image/vision tasks:',
              options: visionModelChoices,
              initialValue: existingVisionModel || activeProvider.defaultVisionModel,
            });
            exitIfCancelled(visionModelSelection);

            if (visionModelSelection === '__none__') {
              chosenVisionModel = undefined;
              prompts.log.info('Vision model disabled');
            } else if (visionModelSelection === '__custom__') {
              const manualVisionModel = await prompts.text({
                message: 'Enter vision model ID:',
                initialValue: activeProvider.defaultVisionModel,
                validate: (value) => value?.trim().length > 0 ? undefined : 'Model is required',
              });
              exitIfCancelled(manualVisionModel);
              chosenVisionModel = manualVisionModel.trim();
            } else {
              chosenVisionModel = visionModelSelection;
            }
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // STEP 6: Quick Setup Option
        // ═══════════════════════════════════════════════════════════════════
        prompts.log.step(chalk.bold(`${t.setup.step} 6/6 — ${t.setup.reviewSave}`));

        const maxTokens = HIGH_TOKEN_PROVIDERS.has(selectedProvider.name) ? 32768 : 8192;

        // In silent mode, always use defaults
        let useDefaults = options.silent || false;
        if (!options.silent) {
          // Ask if user wants to use defaults for remaining settings
          const defaultsChoice = await prompts.confirm({
            message: 'Use default settings for everything else? (Recommended for quick setup)',
            initialValue: true,
          });
          exitIfCancelled(defaultsChoice);
          useDefaults = defaultsChoice;
        }

        // Track whether we should validate and configure extras
        let shouldValidate = options.validate !== false;
        let shouldConfigureExtras = true;

        if (useDefaults) {
          // Skip validation and extra configuration - use smart defaults
          shouldValidate = false;
          shouldConfigureExtras = false;
          prompts.log.success('Using default settings for quick setup');
        } else {
          // User wants to customize - proceed with validation
          prompts.log.info('Proceeding with detailed configuration...');
        }

        // ═══════════════════════════════════════════════════════════════════
        // Validate Connection (only if not using defaults)
        // ═══════════════════════════════════════════════════════════════════
        if (shouldValidate) {
          prompts.log.step(chalk.bold('Validating Connection...'));

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
        // Review & Save (simplified if using defaults)
        // ═══════════════════════════════════════════════════════════════════
        if (!useDefaults) {
          const visionSummary = chosenVisionModel ? `\nVision:      ${chosenVisionModel}` : '';
          const langLabel = languageChoices.find(l => l.value === selectedLanguage)?.label || selectedLanguage;
          await prompts.note(
            `Language:    ${langLabel}\n` +
            `Provider:    ${selectedProvider.displayName}\n` +
            `Base URL:    ${selectedProvider.baseURL}\n` +
            `Model:       ${chosenModel}${visionSummary}\n` +
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
        }

        // Create configuration object
        const mergedConfig: UserSettings = {
          ...(existingConfig || {}),
          apiKey: apiKey,
          baseURL: selectedProvider.baseURL,
          defaultModel: chosenModel,
          currentModel: chosenModel,
          visionModel: chosenVisionModel, // Vision model for image analysis tasks
          maxTokens: existingConfig?.maxTokens ?? maxTokens,
          temperature: existingConfig?.temperature ?? 0.7,
          models: Array.from(new Set([chosenModel, ...(existingConfig?.models || []), selectedProvider.defaultModel].filter(Boolean))),
          language: { current: selectedLanguage, autoDetect: false }, // Language setting
          _provider: selectedProvider.displayName,
          _website: selectedProvider.website,
        } as UserSettings;

        // Persist using settings manager to ensure encryption + permissions
        try {
          settingsManager.saveUserSettings(mergedConfig);
          // CRITICAL: Invalidate the translation cache so UI uses the new language
          resetCachedLanguage();
          prompts.log.success(t.setup.configSaved || 'Configuration saved successfully!');
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
        // Z.AI MCP Integration (auto-configure with defaults, or ask if customizing)
        // ═══════════════════════════════════════════════════════════════════
        if (selectedProvider.name === 'z.ai' || selectedProvider.name === 'z.ai-free') {
          if (!shouldConfigureExtras) {
            // Quick setup - silently configure MCP servers
            prompts.log.info('Configuring Z.AI MCP servers...');
          } else {
            await prompts.note(
              'Enabling Z.AI MCP servers for enhanced capabilities:\n' +
              '• Web Search - Real-time web search\n' +
              '• Web Reader - Extract content from web pages\n' +
              '• Vision - Image/video analysis (Node.js 22+)',
              'Z.AI MCP Integration'
            );
          }

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
        // AutomatosX Integration (auto-configure with defaults, or ask if customizing)
        // ═══════════════════════════════════════════════════════════════════
        let axStatus = getAutomatosXStatus();

        if (shouldConfigureExtras) {
          // Detailed setup - show notes and ask questions
          await prompts.note(
            'Multi-agent AI orchestration with persistent memory and collaboration.',
            'AutomatosX Agent Orchestration'
          );

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

          // Agent-First Mode Configuration (only ask if AutomatosX is available and user wants to customize)
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
        } else {
          // Quick setup - install AutomatosX and run ax setup -f by default
          if (!axStatus.installed) {
            const installSpinner = prompts.spinner();
            installSpinner.start('Installing AutomatosX for multi-agent AI orchestration...');

            const installed = await installAutomatosX();
            if (installed) {
              installSpinner.stop('AutomatosX installed successfully!');
              axStatus = getAutomatosXStatus(); // Refresh status after install
            } else {
              installSpinner.stop('Could not install AutomatosX');
              prompts.log.info('Install manually later: npm install -g @defai.digital/automatosx');
            }
          } else {
            prompts.log.success(`AutomatosX detected${axStatus.version ? ` (v${axStatus.version})` : ''}`);
          }

          // Run ax setup -f to configure AutomatosX with defaults
          if (axStatus.installed) {
            const setupSpinner = prompts.spinner();
            setupSpinner.start('Configuring AutomatosX...');

            const setupSuccess = await runAutomatosXSetup();
            if (setupSuccess) {
              setupSpinner.stop('AutomatosX configured successfully!');
            } else {
              setupSpinner.stop('Could not configure AutomatosX');
              prompts.log.info('Configure manually later: ax setup -f');
            }

            // Default: agent-first mode disabled
            const currentSettings = settingsManager.loadUserSettings();
            settingsManager.saveUserSettings({
              ...currentSettings,
              agentFirst: {
                enabled: false,
                confidenceThreshold: 0.6,
                showAgentIndicator: true,
                defaultAgent: 'standard',
                excludedAgents: [],
              },
            });
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // Completion Summary
        // ═══════════════════════════════════════════════════════════════════
        const visionModelInfo = chosenVisionModel ? `\n${t.setup.vision}:      ${chosenVisionModel}` : '';
        const finalLangLabel = languageChoices.find(l => l.value === selectedLanguage)?.label || selectedLanguage;
        await prompts.note(
          `${t.setup.configPath}:    ${configPath}\n` +
          `${t.setup.language}:    ${finalLangLabel}\n` +
          `${t.setup.provider}:    ${selectedProvider.displayName}\n` +
          `${t.setup.baseUrl}:    ${selectedProvider.baseURL}\n` +
          `${t.setup.model}:       ${chosenModel}${visionModelInfo}\n` +
          `${t.setup.maxTokens}:  ${mergedConfig.maxTokens || maxTokens}\n` +
          `Temperature: ${mergedConfig.temperature ?? 0.7}`,
          t.setup.configDetails || 'Configuration Details'
        );

        const cliName = provider.branding.cliName;
        await prompts.note(
          `1. ${t.setup.startInteractive}:\n` +
          `   $ ${cliName}\n\n` +
          `2. ${t.setup.runQuickTest}:\n` +
          `   $ ${cliName} -p "Hello, introduce yourself"`,
          t.setup.nextSteps || 'Next Steps'
        );

        await prompts.note(
          `• ${t.setup.editConfig}:  ${configPath}\n` +
          `• ${t.setup.viewHelp}:             ${cliName} --help\n` +
          `• ${t.setup.changeLang}:       /lang`,
          t.setup.tips || 'Tips'
        );

        prompts.outro(chalk.green(`${t.setup.setupComplete} ${t.setup.getStarted}`));

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
