/**
 * Setup Flow - Local/Offline Configuration
 *
 * This setup wizard:
 * 1. Detects local servers (Ollama/LMStudio/vLLM)
 * 2. Configures local server URL and model
 * 3. Saves configuration to ~/.ax-cli/
 *
 * Provider Distribution:
 * - ax-cli: LOCAL/OFFLINE FIRST - Ollama, LMStudio, vLLM (NO cloud providers)
 * - ax-glm: GLM-specific CLI with web search, vision, image generation (Z.AI Cloud)
 * - ax-grok: Grok-specific CLI with web search, vision, extended thinking (xAI Cloud)
 * - ax-deepseek: (future) DeepSeek-specific CLI for cloud features
 *
 * NOTE: ax-cli is LOCAL/OFFLINE FIRST. For cloud providers, use the dedicated CLIs.
 */

import chalk from 'chalk';
import { select, confirm, input } from '@inquirer/prompts';
import ora from 'ora';
import { existsSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { AX_CLI_PROVIDER, type ProviderModelConfig } from '@defai.digital/ax-core';
import {
  AX_CLI_CONFIG_FILE,
  deleteConfig,
  loadConfig,
  saveConfig,
  type AxCliConfig,
  type Provider,
} from './config.js';

export type { Provider, ServerType } from './config.js';

interface ModelInfo {
  id: string;
  name: string;
  description: string;
}

const DEFAULT_LOCAL_BASE_URL = AX_CLI_PROVIDER.defaultBaseURL || 'http://localhost:11434/v1';

// ═══════════════════════════════════════════════════════════════════
// MODEL DATA - Derived from AX_CLI_PROVIDER (single source of truth)
// ═══════════════════════════════════════════════════════════════════

/**
 * Model tier configuration for categorization and display
 * Single source of truth for tier metadata (colors, ratings, labels)
 */
const MODEL_TIERS = {
  T1: { prefix: 'T1-Qwen', pattern: /qwen/i, rating: '9.6/10', label: 'PRIMARY', displayName: 'Qwen 3', description: 'Best overall, coding leader', color: chalk.green },
  T2: { prefix: 'T2-GLM', pattern: /glm|codegeex|chatglm/i, rating: '9.4/10', label: 'REFACTOR', displayName: 'GLM', description: 'Large-scale refactor + docs', color: chalk.magenta, isNew: true },
  T3: { prefix: 'T3-DeepSeek', pattern: /deepseek/i, rating: '9.3/10', label: 'SPEED', displayName: 'DeepSeek', description: 'Quick patches, linting', color: chalk.blue },
  T4: { prefix: 'T4-Codestral', pattern: /codestral|mistral/i, rating: '8.4/10', label: 'C++/RUST', displayName: 'Codestral', description: 'Systems programming', color: chalk.cyan },
  T5: { prefix: 'T5-Llama', pattern: /llama|codellama/i, rating: '8.1/10', label: 'FALLBACK', displayName: 'Llama', description: 'Best compatibility', color: chalk.gray },
} as const;

type TierKey = keyof typeof MODEL_TIERS;

/**
 * Convert provider model config to setup ModelInfo format
 */
function providerModelsToModelInfo(): ModelInfo[] {
  return Object.entries(AX_CLI_PROVIDER.models).map(([id, config]: [string, ProviderModelConfig]) => ({
    id,
    name: config.name,
    description: config.description,
  }));
}

const PROVIDER_MODEL_INFOS = providerModelsToModelInfo();

/**
 * Get the tier for a model ID
 */
function getModelTier(modelId: string): { tier: TierKey; label: string } {
  const lower = modelId.toLowerCase();
  for (const [tier, config] of Object.entries(MODEL_TIERS) as [TierKey, typeof MODEL_TIERS[TierKey]][]) {
    if (config.pattern.test(lower)) {
      return { tier, label: config.prefix };
    }
  }
  return { tier: 'T5' as TierKey, label: 'Other' };
}

/**
 * Get models grouped by tier with prefixes
 */
function getModelsWithTierPrefix(models: ModelInfo[] = PROVIDER_MODEL_INFOS): ModelInfo[] {
  return models.map(m => {
    const { label } = getModelTier(m.id);
    return { ...m, name: label !== 'Other' ? `[${label}] ${m.name}` : m.name };
  });
}

/**
 * Get models for a specific tier
 */
function getModelsByTier(tier: TierKey, models: ModelInfo[] = PROVIDER_MODEL_INFOS): ModelInfo[] {
  return models.filter(m => getModelTier(m.id).tier === tier);
}

// Derived model lists from single source of truth
const ALL_LOCAL_MODELS = getModelsWithTierPrefix();

// ═══════════════════════════════════════════════════════════════════
// PROVIDER CONFIGURATION - LOCAL/OFFLINE ONLY
// ═══════════════════════════════════════════════════════════════════

const PROVIDER_INFO = {
  name: AX_CLI_PROVIDER.displayName,
  description: AX_CLI_PROVIDER.branding.description,
  cliName: AX_CLI_PROVIDER.branding.cliName,
  defaultBaseURL: DEFAULT_LOCAL_BASE_URL,
  defaultModel: AX_CLI_PROVIDER.defaultModel,
  website: 'https://ollama.ai',
  models: ALL_LOCAL_MODELS,
};

// Well-known local server ports
const LOCAL_SERVERS = [
  { name: 'Ollama', url: DEFAULT_LOCAL_BASE_URL, port: 11434 },
  { name: 'LM Studio', url: 'http://localhost:1234/v1', port: 1234 },
  { name: 'vLLM', url: 'http://localhost:8000/v1', port: 8000 },
  { name: 'LocalAI', url: 'http://localhost:8080/v1', port: 8080 },
];

// Config paths
/**
 * Normalize base URLs to avoid trailing slash issues
 */
function normalizeBaseURL(baseURL: string): string {
  try {
    const parsed = new URL(baseURL);
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return baseURL.replace(/\/+$/, '');
  }
}

/**
 * Build models endpoint from a base URL
 */
function buildModelsEndpoint(baseURL: string): string {
  return `${normalizeBaseURL(baseURL)}/models`;
}

/**
 * Run an async task with a spinner, ensuring cleanup even on failure
 */
async function withSpinner<T>(text: string, task: () => Promise<T>): Promise<T> {
  const spinner = ora(text).start();
  try {
    return await task();
  } finally {
    spinner.stop();
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
 * Execute a command with a timeout and inherited stdio
 */
function runCommand(command: string, timeoutMs: number): boolean {
  try {
    execSync(command, {
      stdio: 'inherit',
      timeout: timeoutMs
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install AutomatosX globally
 */
function installAutomatosX(): boolean {
  return runCommand('npm install -g @defai.digital/automatosx', 180000);
}

/**
 * Run AutomatosX setup with force flag
 */
function runAutomatosXSetup(): boolean {
  return runCommand('ax setup -f', 120000);
}

/**
 * Fetch with timeout - reduces duplication in network calls
 */
async function fetchWithTimeout<T>(
  url: string,
  timeoutMs: number,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: T }> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });

    if (!response.ok) {
      return { ok: false };
    }

    const data = await response.json() as T;
    return { ok: true, data };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Check if a local server is running on a given port
 */
async function checkLocalServer(url: string): Promise<boolean> {
  const result = await fetchWithTimeout(buildModelsEndpoint(url), 2000);
  return result.ok;
}

/**
 * Fetch models from a local server
 */
async function fetchLocalModels(baseURL: string): Promise<ModelInfo[]> {
  const result = await fetchWithTimeout<{ data?: Array<{ id: string; owned_by?: string }> }>(
    buildModelsEndpoint(baseURL),
    5000
  );

  if (!result.ok || !result.data?.data) {
    return [];
  }

  return result.data.data.map((m) => ({
    id: m.id,
    name: m.id,
    description: m.owned_by ? `Provided by ${m.owned_by}` : 'Local model',
  }));
}

/**
 * Detect running local servers
 */
async function detectLocalServers(): Promise<Array<{ name: string; url: string; available: boolean }>> {
  const results = await Promise.all(
    LOCAL_SERVERS.map(async (server) => {
      const normalizedURL = normalizeBaseURL(server.url);
      return {
        ...server,
        url: normalizedURL,
        available: await checkLocalServer(normalizedURL),
      };
    })
  );
  return results;
}

/**
 * URL validator for input prompts
 */
function validateURL(value: string): boolean | string {
  try {
    new URL(value);
    return true;
  } catch {
    return 'Please enter a valid URL';
  }
}

/**
 * Sort models by tier priority
 */
function sortModelsByTier(models: ModelInfo[]): ModelInfo[] {
  const tierOrder: TierKey[] = ['T1', 'T2', 'T3', 'T4', 'T5'];
  return [...models].sort((a, b) => {
    const tierA = tierOrder.indexOf(getModelTier(a.id).tier);
    const tierB = tierOrder.indexOf(getModelTier(b.id).tier);
    return (tierA === -1 ? 99 : tierA) - (tierB === -1 ? 99 : tierB);
  });
}

/**
 * Build model choices for select prompt
 */
function buildModelChoices(models: ModelInfo[], addTierPrefix: boolean = true): Array<{ name: string; value: string }> {
  const choices = models.map(m => {
    const { label } = getModelTier(m.id);
    const prefix = addTierPrefix && label !== 'Other' ? `[${label}] ` : '';
    return {
      name: `${prefix}${m.name} - ${m.description}`,
      value: m.id,
    };
  });
  choices.push({
    name: chalk.dim('Enter custom model name...'),
    value: '__custom__',
  });
  return choices;
}

/**
 * Handle model selection with custom option
 */
async function selectModelWithCustom(
  choices: Array<{ name: string; value: string }>,
  defaultValue: string,
  customDefault: string
): Promise<string> {
  const selection = await select({
    message: 'Select model:',
    choices,
    default: defaultValue,
  });

  if (selection === '__custom__') {
    return input({
      message: 'Enter model name:',
      default: customDefault,
    });
  }
  return selection;
}

/**
 * Print a styled box header
 */
function printBoxHeader(title: string, width: number = 50): void {
  const padding = Math.max(0, width - title.length - 4);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  console.log(chalk.cyan(`  ┌${'─'.repeat(width)}┐`));
  console.log(chalk.cyan(`  │${' '.repeat(leftPad)} ${title} ${' '.repeat(rightPad)}│`));
  console.log(chalk.cyan(`  └${'─'.repeat(width)}┘\n`));
}

/**
 * Get display limit for a tier (how many models to show)
 */
function getTierDisplayLimit(tier: TierKey): number {
  return tier === 'T4' ? 1 : tier === 'T5' ? 2 : 3;
}

/**
 * Print model recommendations by tier
 */
function printModelRecommendations(): void {
  console.log('  Recommended models by tier (Updated Dec 2025):\n');

  for (const [tier, config] of Object.entries(MODEL_TIERS) as [TierKey, typeof MODEL_TIERS[TierKey]][]) {
    const models = getModelsByTier(tier).slice(0, getTierDisplayLimit(tier));
    if (models.length === 0) continue;

    console.log(config.color.bold(`  ${config.prefix} (${config.rating}) - ${config.label}:`));
    models.forEach(m => {
      console.log(`    ${config.color('•')} ${m.id}: ${chalk.dim(m.description)}`);
    });
    console.log();
  }
}

/**
 * Print shared cloud provider guidance
 */
function printCloudProviderInfo(): void {
  console.log(chalk.dim('  For cloud providers, use dedicated CLIs:'));
  console.log(chalk.dim('  • GLM (Z.AI):     npm install -g @defai.digital/ax-glm && ax-glm setup'));
  console.log(chalk.dim('  • Grok (xAI):     npm install -g @defai.digital/ax-grok && ax-grok setup'));
  console.log(chalk.dim('  • DeepSeek:       (coming soon) @defai.digital/ax-deepseek'));
  console.log();
}

/**
 * Print welcome banner
 */
function printWelcomeBanner(): void {
  console.log(chalk.cyan('\n  ╔════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('  ║       Welcome to ax-cli Setup Wizard           ║'));
  console.log(chalk.cyan('  ║         LOCAL/OFFLINE AI Assistant             ║'));
  console.log(chalk.cyan('  ╚════════════════════════════════════════════════╝\n'));

  console.log('  ax-cli is designed for LOCAL/OFFLINE AI inference.');
  console.log('  Run AI models locally without sending data to the cloud.\n');

  printCloudProviderInfo();
}

/**
 * Print tier rankings (derived from MODEL_TIERS)
 */
function printTierRankings(): void {
  console.log(chalk.bold('  2025 Offline Coding LLM Rankings (Updated Dec 2025):'));

  for (const [tier, config] of Object.entries(MODEL_TIERS) as [TierKey, typeof MODEL_TIERS[TierKey]][]) {
    const newBadge = 'isNew' in config && config.isNew ? ' ' + chalk.yellow('★NEW') : '';
    console.log(
      config.color(`    ${tier} ${config.displayName}`) +
      chalk.dim(` (${config.rating})`) +
      ` - ${config.label}: ${config.description}${newBadge}`
    );
  }
  console.log();
}

/**
 * Handle force flag - delete existing config
 */
function handleForceFlag(force: boolean): void {
  if (!force || !existsSync(AX_CLI_CONFIG_FILE)) return;

  console.log(chalk.yellow('  ⚠ Force flag detected - deleting existing configuration...'));
  const deleted = deleteConfig();
  if (deleted) {
    console.log(chalk.green('  ✓ Existing configuration deleted\n'));
  } else {
    console.log(chalk.red('  ✗ Failed to delete existing configuration\n'));
    process.exit(1);
  }
}

/**
 * Step 1: Select local server
 */
async function selectLocalServer(existingConfig: AxCliConfig): Promise<string> {
  console.log(chalk.bold.cyan('\n  Step 1/3 — Local Server\n'));

  const detectedServers = await withSpinner('Detecting local inference servers...', detectLocalServers);
  const availableServers = detectedServers.filter(s => s.available);
  const defaultServerURL = normalizeBaseURL(existingConfig.baseURL || DEFAULT_LOCAL_BASE_URL);

  if (availableServers.length > 0) {
    console.log(chalk.green(`  ✓ Found ${availableServers.length} running server(s)\n`));

    const serverChoices = [
      ...availableServers.map(s => ({
        name: `${chalk.green('●')} ${s.name} - ${s.url}`,
        value: normalizeBaseURL(s.url),
      })),
      { name: `${chalk.dim('○')} Enter custom URL...`, value: '__custom__' },
    ];

    const serverSelection = await select({
      message: 'Select your local server:',
      choices: serverChoices,
      default: normalizeBaseURL(existingConfig.baseURL || availableServers[0]?.url),
    });

    if (serverSelection === '__custom__') {
      return normalizeBaseURL(await input({
        message: 'Enter server URL:',
        default: defaultServerURL,
        validate: validateURL,
      }));
    }
    return normalizeBaseURL(serverSelection);
  }

  // No servers detected
  console.log(chalk.yellow('  No running servers detected.\n'));
  console.log('  Common local server URLs:');
  LOCAL_SERVERS.forEach(s => {
    console.log(`    ${chalk.dim('•')} ${s.name}: ${chalk.dim(s.url)}`);
  });
  console.log();
  console.log(chalk.dim('  Tip: Start Ollama with: ollama serve'));
  console.log();

  return normalizeBaseURL(await input({
    message: 'Enter your server URL:',
    default: defaultServerURL,
    validate: validateURL,
  }));
}

/**
 * Step 2: Select model
 */
async function selectModel(
  baseURL: string,
  existingConfig: AxCliConfig
): Promise<{ model: string; models: ModelInfo[] }> {
  console.log(chalk.bold.cyan('\n  Step 2/3 — Choose Model\n'));

  let availableModels = await withSpinner('Fetching available models...', () => fetchLocalModels(baseURL));

  if (availableModels.length > 0) {
    console.log(chalk.green(`  ✓ Found ${availableModels.length} model(s) on server\n`));

    const sortedModels = sortModelsByTier(availableModels);
    const modelChoices = buildModelChoices(sortedModels, true);

    const selectedModel = await selectModelWithCustom(
      modelChoices,
      existingConfig.defaultModel || sortedModels[0]?.id,
      PROVIDER_INFO.defaultModel
    );
    return { model: selectedModel, models: availableModels };
  }

  // No models from server - use defaults
  console.log(chalk.yellow('  Could not fetch models from server.\n'));
  printModelRecommendations();

  const modelChoices = buildModelChoices(ALL_LOCAL_MODELS, false);
  const selectedModel = await selectModelWithCustom(
    modelChoices,
    existingConfig.defaultModel || PROVIDER_INFO.defaultModel,
    PROVIDER_INFO.defaultModel
  );
  return { model: selectedModel, models: PROVIDER_INFO.models };
}

/**
 * Step 3: Quick setup confirmation
 */
async function confirmQuickSetup(baseURL: string): Promise<boolean> {
  console.log(chalk.bold.cyan('\n  Step 3/3 — Quick Setup\n'));

  const useDefaults = await confirm({
    message: 'Use default settings for everything else? (Recommended)',
    default: true,
  });

  if (useDefaults) {
    console.log(chalk.green('\n  ✓ Using default settings\n'));
    return true;
  }

  // Validate server connection
  const validateSpinner = ora('Validating local server connection...').start();
  const isValid = await checkLocalServer(baseURL);

  if (isValid) {
    validateSpinner.succeed('Local server connection validated!');
  } else {
    validateSpinner.warn('Server not responding (will save anyway)');
    console.log(chalk.dim('\n  Tip: Make sure your local server is running before using ax-cli'));
  }
  return false;
}

/**
 * Print setup summary
 */
function printSetupSummary(config: AxCliConfig): void {
  printBoxHeader('Configuration Summary', 41);
  console.log(`  Provider:    ${config._provider}`);
  console.log(`  Server:      ${config.baseURL}`);
  console.log(`  Model:       ${config.defaultModel}`);
  console.log(`  Config:      ${AX_CLI_CONFIG_FILE}`);
  console.log();
}

/**
 * Print next steps
 */
function printNextSteps(): void {
  printBoxHeader('Next Steps', 41);
  console.log(`  1. Run ${chalk.bold('ax-cli')} to start`);
  console.log(`  2. Run ${chalk.bold('ax-cli --help')} for all options`);
  console.log();
  console.log(chalk.dim('  Note: Make sure your local server is running before using ax-cli'));
  console.log();
  printCloudProviderInfo();
  console.log(chalk.green('  ✓ Setup complete! Happy coding!\n'));
}

/**
 * Handle AutomatosX integration
 */
function handleAutomatosXIntegration(useQuickSetup: boolean): void {
  if (useQuickSetup) {
    let axStatus = getAutomatosXStatus();

    if (!axStatus.installed) {
      const installSpinner = ora('Installing AutomatosX for multi-agent AI orchestration...').start();
      const installed = installAutomatosX();

      if (installed) {
        installSpinner.succeed('AutomatosX installed successfully!');
        axStatus = getAutomatosXStatus();
      } else {
        installSpinner.stop();
        console.log(chalk.yellow('  Could not install AutomatosX'));
        console.log(chalk.dim('  Install manually later: npm install -g @defai.digital/automatosx'));
      }
    } else {
      console.log(chalk.green(`  ✓ AutomatosX detected${axStatus.version ? ` (v${axStatus.version})` : ''}`));
    }

    if (axStatus.installed) {
      const setupSpinner = ora('Configuring AutomatosX...').start();
      const setupSuccess = runAutomatosXSetup();

      if (setupSuccess) {
        setupSpinner.succeed('AutomatosX configured successfully!');
      } else {
        setupSpinner.stop();
        console.log(chalk.yellow('  Could not configure AutomatosX'));
        console.log(chalk.dim('  Configure manually later: ax setup -f'));
      }
    }
    return;
  }

  // Non-quick setup - just show info
  const axStatus = getAutomatosXStatus();
  if (axStatus.installed) {
    console.log(chalk.green(`  ✓ AutomatosX detected${axStatus.version ? ` (v${axStatus.version})` : ''}`));
  } else {
    console.log(chalk.dim('  AutomatosX not installed. Install later: npm install -g @defai.digital/automatosx'));
  }
}

/**
 * Build and save configuration
 */
function buildAndSaveConfig(
  existingConfig: AxCliConfig,
  baseURL: string,
  model: string,
  models: ModelInfo[]
): AxCliConfig {
  const normalizedBaseURL = normalizeBaseURL(baseURL);
  const newConfig: AxCliConfig = {
    ...existingConfig,
    selectedProvider: 'local',
    serverType: 'local',
    apiKey: '',
    baseURL: normalizedBaseURL,
    defaultModel: model,
    currentModel: model,
    maxTokens: existingConfig.maxTokens ?? 8192,
    temperature: existingConfig.temperature ?? 0.7,
    models: Array.from(new Set([...models.map(m => m.id), model])),
    _provider: PROVIDER_INFO.name,
    _website: PROVIDER_INFO.website,
    _isLocalServer: true,
  };

  saveConfig(newConfig);
  console.log(chalk.green('\n  ✓ Configuration saved!\n'));
  return newConfig;
}

/**
 * Setup options
 */
export interface SetupOptions {
  force?: boolean;
}

/**
 * Run the setup wizard
 *
 * Refactored to use extracted helper functions for clarity:
 * - printWelcomeBanner() - Welcome message and cloud provider info
 * - handleForceFlag() - Handle --force config reset
 * - printTierRankings() - Display LLM tier rankings
 * - selectLocalServer() - Step 1: Server selection
 * - selectModel() - Step 2: Model selection
 * - confirmQuickSetup() - Step 3: Quick/detailed setup
 * - buildAndSaveConfig() - Save configuration
 * - handleAutomatosXIntegration() - AutomatosX setup
 * - printSetupSummary() - Configuration summary
 * - printNextSteps() - Next steps and completion
 */
export async function runSetup(options: SetupOptions = {}): Promise<void> {
  // Welcome banner
  printWelcomeBanner();

  // Handle --force flag
  handleForceFlag(options.force ?? false);

  // Load existing config
  const existingConfig = loadConfig();

  // Show setup header with tier rankings
  console.log();
  printBoxHeader('Local/Offline Setup (Ollama, LMStudio, vLLM)', 53);
  console.log('  Run AI models locally without an API key.\n');
  printTierRankings();

  // Step 1: Select local server
  const selectedBaseURL = await selectLocalServer(existingConfig);
  const normalizedBaseURL = normalizeBaseURL(selectedBaseURL);

  // Step 2: Select model
  const { model: selectedModel, models: availableModels } = await selectModel(
    normalizedBaseURL,
    existingConfig
  );

  // Step 3: Quick setup confirmation
  const useQuickSetup = await confirmQuickSetup(normalizedBaseURL);

  // Save configuration
  const newConfig = buildAndSaveConfig(
    existingConfig,
    normalizedBaseURL,
    selectedModel,
    availableModels
  );

  // AutomatosX integration
  handleAutomatosXIntegration(useQuickSetup);

  // Show summary and next steps
  printSetupSummary(newConfig);
  console.log();
  printNextSteps();
}

/**
 * Get the selected provider from config
 */
export function getSelectedProvider(): Provider | null {
  const config = loadConfig();
  return config.selectedProvider || null;
}
