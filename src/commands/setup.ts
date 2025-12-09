/**
 * Setup Command - Provider Selection and Configuration
 *
 * This setup wizard:
 * 1. Lets user select GLM or Grok provider
 * 2. Runs provider-specific setup (API key, model selection, etc.)
 * 3. Saves config to provider-specific directory (~/.ax-glm or ~/.ax-grok)
 * 4. Recommends installing the provider-specific CLI
 */

import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync, spawnSync } from 'child_process';
import * as prompts from '@clack/prompts';
import chalk from 'chalk';
import { validateProviderSetup } from '../utils/setup-validator.js';
import { extractErrorMessage } from '../utils/error-handler.js';
import {
  detectZAIServices,
  getRecommendedServers,
  generateZAIServerConfig,
} from '../mcp/index.js';
import { addMCPServer, removeMCPServer } from '../mcp/config.js';

type Provider = 'glm' | 'grok';
type ServerType = 'cloud' | 'local';

interface ProviderInfo {
  name: string;
  displayName: string;
  cliName: string;
  package: string;
  defaultBaseURL: string;
  defaultModel: string;
  apiKeyEnvVar: string;
  website: string;
  description: string;
  configDir: string;
}

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  supportsThinking?: boolean;
  supportsVision?: boolean;
  supportsSearch?: boolean;
}

// Provider definitions
const PROVIDERS: Record<Provider, ProviderInfo> = {
  glm: {
    name: 'glm',
    displayName: 'GLM (Z.AI)',
    cliName: 'ax-glm',
    package: '@defai.digital/ax-glm',
    defaultBaseURL: 'https://api.z.ai/api/coding/paas/v4',
    defaultModel: 'glm-4.6',
    apiKeyEnvVar: 'ZAI_API_KEY',
    website: 'https://z.ai',
    description: 'GLM-4.6 with thinking mode and 200K context',
    configDir: '.ax-glm',
  },
  grok: {
    name: 'grok',
    displayName: 'Grok (xAI)',
    cliName: 'ax-grok',
    package: '@defai.digital/ax-grok',
    defaultBaseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-3',
    apiKeyEnvVar: 'XAI_API_KEY',
    website: 'https://console.x.ai',
    description: 'Grok 3 with extended thinking, vision, and live search',
    configDir: '.ax-grok',
  },
};

// GLM models
const GLM_MODELS: ModelInfo[] = [
  { id: 'glm-4.6', name: 'GLM-4.6', description: 'Most capable GLM model with thinking mode', contextWindow: 200000, supportsThinking: true },
  { id: 'glm-4.6v', name: 'GLM-4.6V', description: 'Latest vision model with 128K context and thinking mode', contextWindow: 128000, supportsVision: true, supportsThinking: true },
  { id: 'glm-4', name: 'GLM-4', description: 'Standard GLM-4 model', contextWindow: 128000 },
  { id: 'glm-4-flash', name: 'GLM-4 Flash', description: 'Fast, efficient GLM model', contextWindow: 128000 },
];

// Grok models
const GROK_MODELS: ModelInfo[] = [
  { id: 'grok-3', name: 'Grok-3', description: 'Most capable with extended thinking', contextWindow: 131072, supportsThinking: true, supportsSearch: true },
  { id: 'grok-3-mini', name: 'Grok-3 Mini', description: 'Efficient with thinking support', contextWindow: 131072, supportsThinking: true, supportsSearch: true },
  { id: 'grok-2', name: 'Grok-2', description: 'Capable with advanced reasoning', contextWindow: 131072, supportsSearch: true },
  { id: 'grok-2-vision', name: 'Grok-2 Vision', description: 'Vision-capable for image understanding', contextWindow: 32768, supportsVision: true, supportsSearch: true },
  { id: 'grok-2-mini', name: 'Grok-2 Mini', description: 'Fast and efficient', contextWindow: 131072, supportsSearch: true },
];

// Local server options
const LOCAL_SERVERS = [
  { name: 'Ollama', url: 'http://localhost:11434/v1', port: 11434 },
  { name: 'LM Studio', url: 'http://localhost:1234/v1', port: 1234 },
  { name: 'vLLM', url: 'http://localhost:8000/v1', port: 8000 },
  { name: 'LocalAI', url: 'http://localhost:8080/v1', port: 8080 },
];

interface ProviderConfig {
  selectedProvider: Provider;
  serverType: ServerType;
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  currentModel: string;
  maxTokens: number;
  temperature: number;
  models: string[];
  _provider: string;
  _website: string;
  _isLocalServer: boolean;
  grok?: {
    thinkingMode: 'off' | 'low' | 'high';
    liveSearch: boolean;
  };
}

/**
 * Handle user cancellation
 */
function exitIfCancelled<T>(value: T | symbol): asserts value is T {
  if (prompts.isCancel(value)) {
    prompts.cancel('Setup cancelled.');
    process.exit(0);
  }
}

/**
 * Get provider config path
 */
function getConfigPath(provider: Provider): string {
  return join(homedir(), PROVIDERS[provider].configDir, 'config.json');
}

/**
 * Get provider config directory
 */
function getConfigDir(provider: Provider): string {
  return join(homedir(), PROVIDERS[provider].configDir);
}

/**
 * Load existing provider config
 */
function loadProviderConfig(provider: Provider): Partial<ProviderConfig> {
  try {
    const configPath = getConfigPath(provider);
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    }
  } catch {
    // Ignore errors
  }
  return {};
}

/**
 * Save provider config
 */
function saveProviderConfig(provider: Provider, config: ProviderConfig): void {
  const configDir = getConfigDir(provider);
  const configPath = getConfigPath(provider);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * Check if a local server is running
 */
async function checkLocalServer(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${url}/models`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch models from local server
 */
async function fetchLocalModels(baseURL: string): Promise<ModelInfo[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${baseURL}/models`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) return [];

    const data = await response.json() as { data?: Array<{ id: string; owned_by?: string }> };
    const models = data.data || [];

    return models.map((m: { id: string; owned_by?: string }) => ({
      id: m.id,
      name: m.id,
      description: m.owned_by ? `Provided by ${m.owned_by}` : 'Local model',
      contextWindow: 8192,
    }));
  } catch {
    return [];
  }
}

/**
 * Detect running local servers
 */
async function detectLocalServers(): Promise<Array<{ name: string; url: string; available: boolean }>> {
  const results = await Promise.all(
    LOCAL_SERVERS.map(async (server) => ({
      ...server,
      available: await checkLocalServer(server.url),
    }))
  );
  return results;
}

/**
 * Validate cloud API connection
 */
async function validateCloudConnection(baseURL: string, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if provider CLI is installed
 */
function isProviderInstalled(provider: Provider): boolean {
  const cliName = PROVIDERS[provider].cliName;
  try {
    const result = spawnSync('which', [cliName], { encoding: 'utf-8', timeout: 5000 });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Install provider package
 */
async function installProvider(provider: Provider): Promise<boolean> {
  const providerInfo = PROVIDERS[provider];
  const spinner = prompts.spinner();
  spinner.start(`Installing ${providerInfo.package}...`);

  try {
    execSync(`npm install -g ${providerInfo.package}`, {
      stdio: 'pipe',
      timeout: 180000,
    });
    spinner.stop(`${providerInfo.package} installed successfully!`);
    return true;
  } catch (error) {
    spinner.stop('Installation failed');
    prompts.log.error(extractErrorMessage(error));
    prompts.log.info(`Try manually: npm install -g ${providerInfo.package}`);
    return false;
  }
}

/**
 * Run GLM-specific setup
 */
async function runGLMSetup(existingConfig: Partial<ProviderConfig>): Promise<ProviderConfig | null> {
  const providerInfo = PROVIDERS.glm;

  // Step 1: Server Type
  prompts.log.step(chalk.bold('Step 1/4 - Server Type'));

  const serverType = await prompts.select<ServerType>({
    message: 'Where do you want to run GLM models?',
    options: [
      { value: 'cloud' as ServerType, label: 'Z.AI Cloud (Recommended)', hint: 'Official Z.AI API with GLM-4.6' },
      { value: 'local' as ServerType, label: 'Local Server', hint: 'Ollama, LM Studio, vLLM, etc.' },
    ],
    initialValue: (existingConfig.serverType || 'cloud') as ServerType,
  });
  exitIfCancelled(serverType);

  if (serverType === 'cloud') {
    return await runZAICloudSetup(existingConfig, providerInfo);
  } else {
    return await runLocalGLMSetup(existingConfig, providerInfo);
  }
}

/**
 * Run Z.AI Cloud setup
 */
async function runZAICloudSetup(existingConfig: Partial<ProviderConfig>, providerInfo: ProviderInfo): Promise<ProviderConfig | null> {
  // Step 2: API Key
  prompts.log.step(chalk.bold('Step 2/4 - Z.AI API Key'));
  prompts.log.info(`Get your API key from: ${providerInfo.website}`);

  let apiKey = '';
  const envKey = process.env[providerInfo.apiKeyEnvVar];
  const existingKey = existingConfig.apiKey;

  if (existingKey && existingConfig.serverType === 'cloud') {
    const maskedKey = existingKey.length > 12
      ? `${existingKey.substring(0, 8)}...${existingKey.substring(existingKey.length - 4)}`
      : `${existingKey.substring(0, 4)}...`;

    prompts.log.info(`Existing API key: ${maskedKey}`);
    const reuseKey = await prompts.confirm({ message: 'Use existing API key?', initialValue: true });
    exitIfCancelled(reuseKey);

    if (reuseKey) {
      apiKey = existingKey;
      prompts.log.success('Using existing API key');
    }
  } else if (envKey) {
    prompts.log.info(`Found ${providerInfo.apiKeyEnvVar} in environment`);
    const useEnvKey = await prompts.confirm({ message: 'Use API key from environment?', initialValue: true });
    exitIfCancelled(useEnvKey);

    if (useEnvKey) {
      apiKey = envKey;
      prompts.log.success('Using environment API key');
    }
  }

  if (!apiKey) {
    const newKey = await prompts.password({
      message: 'Enter your Z.AI API key:',
      validate: (value) => value?.trim().length > 0 ? undefined : 'API key is required',
    });
    exitIfCancelled(newKey);
    apiKey = newKey.trim();
  }

  // Step 3: Model Selection
  prompts.log.step(chalk.bold('Step 3/4 - Choose Model'));

  const modelChoices = GLM_MODELS.map((m) => ({
    value: m.id,
    label: m.id === providerInfo.defaultModel ? `${m.name} (recommended)` : m.name,
    hint: m.description,
  }));

  const selectedModel = await prompts.select({
    message: 'Select default model:',
    options: modelChoices,
    initialValue: existingConfig.defaultModel || providerInfo.defaultModel,
  });
  exitIfCancelled(selectedModel);

  // Step 4: Validate & Save
  prompts.log.step(chalk.bold('Step 4/4 - Validate & Save'));

  const spinner = prompts.spinner();
  spinner.start('Validating Z.AI connection...');

  const isValid = await validateProviderSetup({
    baseURL: providerInfo.defaultBaseURL,
    apiKey: apiKey,
    model: selectedModel,
    providerName: 'glm',
  }, false);

  if (isValid.success) {
    spinner.stop('Z.AI connection validated successfully!');
  } else {
    spinner.stop('Could not validate connection (will save anyway)');
  }

  return {
    selectedProvider: 'glm',
    serverType: 'cloud',
    apiKey: apiKey,
    baseURL: providerInfo.defaultBaseURL,
    defaultModel: selectedModel,
    currentModel: selectedModel,
    maxTokens: 32768,
    temperature: existingConfig.temperature ?? 0.7,
    models: GLM_MODELS.map(m => m.id),
    _provider: 'GLM (Z.AI Cloud)',
    _website: providerInfo.website,
    _isLocalServer: false,
  };
}

/**
 * Run Local GLM Server setup
 */
async function runLocalGLMSetup(existingConfig: Partial<ProviderConfig>, _providerInfo: ProviderInfo): Promise<ProviderConfig | null> {
  // Step 2: Local Server Detection
  prompts.log.step(chalk.bold('Step 2/4 - Local Server'));

  const spinner = prompts.spinner();
  spinner.start('Detecting local inference servers...');

  const detectedServers = await detectLocalServers();
  const availableServers = detectedServers.filter(s => s.available);
  spinner.stop(availableServers.length > 0
    ? `Found ${availableServers.length} running server(s)`
    : 'No running servers detected');

  let selectedBaseURL: string;

  if (availableServers.length > 0) {
    const serverChoices = [
      ...availableServers.map(s => ({ value: s.url, label: `${s.name} - ${s.url}` })),
      { value: '__custom__', label: 'Enter custom URL...' },
    ];

    const serverSelection = await prompts.select({
      message: 'Select your local server:',
      options: serverChoices,
      initialValue: existingConfig.baseURL || availableServers[0].url,
    });
    exitIfCancelled(serverSelection);

    if (serverSelection === '__custom__') {
      const customURL = await prompts.text({
        message: 'Enter server URL:',
        initialValue: 'http://localhost:11434/v1',
        validate: (value) => {
          try { new URL(value); return undefined; }
          catch { return 'Please enter a valid URL'; }
        },
      });
      exitIfCancelled(customURL);
      selectedBaseURL = customURL.trim();
    } else {
      selectedBaseURL = serverSelection;
    }
  } else {
    prompts.log.info('Common local server URLs:');
    LOCAL_SERVERS.forEach(s => prompts.log.info(`  ${s.name}: ${s.url}`));

    const customURL = await prompts.text({
      message: 'Enter your server URL:',
      initialValue: existingConfig.baseURL || 'http://localhost:11434/v1',
      validate: (value) => {
        try { new URL(value); return undefined; }
        catch { return 'Please enter a valid URL'; }
      },
    });
    exitIfCancelled(customURL);
    selectedBaseURL = customURL.trim();
  }

  // Step 3: Model Selection
  prompts.log.step(chalk.bold('Step 3/4 - Choose Model'));

  const modelSpinner = prompts.spinner();
  modelSpinner.start('Fetching available models...');

  let availableModels = await fetchLocalModels(selectedBaseURL);
  modelSpinner.stop(availableModels.length > 0
    ? `Found ${availableModels.length} model(s)`
    : 'Could not fetch models from server');

  let selectedModel: string;

  if (availableModels.length > 0) {
    const modelChoices = [
      ...availableModels.map(m => ({ value: m.id, label: `${m.name} - ${m.description}` })),
      { value: '__custom__', label: 'Enter custom model name...' },
    ];

    const modelSelection = await prompts.select({
      message: 'Select model:',
      options: modelChoices,
      initialValue: existingConfig.defaultModel || availableModels[0]?.id,
    });
    exitIfCancelled(modelSelection);

    if (modelSelection === '__custom__') {
      const customModel = await prompts.text({ message: 'Enter model name:', initialValue: 'glm4' });
      exitIfCancelled(customModel);
      selectedModel = customModel.trim();
    } else {
      selectedModel = modelSelection;
    }
  } else {
    const customModel = await prompts.text({
      message: 'Enter model name:',
      initialValue: existingConfig.defaultModel || 'glm4',
    });
    exitIfCancelled(customModel);
    selectedModel = customModel.trim();
  }

  // Step 4: Validate & Save
  prompts.log.step(chalk.bold('Step 4/4 - Validate & Save'));

  const validateSpinner = prompts.spinner();
  validateSpinner.start('Validating local server connection...');

  const isValid = await checkLocalServer(selectedBaseURL);
  validateSpinner.stop(isValid ? 'Local server connection validated!' : 'Server not responding (will save anyway)');

  return {
    selectedProvider: 'glm',
    serverType: 'local',
    apiKey: '',
    baseURL: selectedBaseURL,
    defaultModel: selectedModel,
    currentModel: selectedModel,
    maxTokens: 8192,
    temperature: existingConfig.temperature ?? 0.7,
    models: availableModels.length > 0 ? availableModels.map(m => m.id) : [selectedModel],
    _provider: 'GLM (Local Server)',
    _website: '',
    _isLocalServer: true,
  };
}

/**
 * Run Grok-specific setup
 */
async function runGrokSetup(existingConfig: Partial<ProviderConfig>): Promise<ProviderConfig | null> {
  const providerInfo = PROVIDERS.grok;

  // Step 1: API Key
  prompts.log.step(chalk.bold('Step 1/5 - xAI API Key'));
  prompts.log.info(`Get your API key from: ${providerInfo.website}`);

  let apiKey = '';
  const envKey = process.env[providerInfo.apiKeyEnvVar] || process.env['GROK_API_KEY'];
  const existingKey = existingConfig.apiKey;

  if (existingKey && existingConfig.selectedProvider === 'grok') {
    const maskedKey = existingKey.length > 12
      ? `${existingKey.substring(0, 8)}...${existingKey.substring(existingKey.length - 4)}`
      : `${existingKey.substring(0, 4)}...`;

    prompts.log.info(`Existing API key: ${maskedKey}`);
    const reuseKey = await prompts.confirm({ message: 'Use existing API key?', initialValue: true });
    exitIfCancelled(reuseKey);

    if (reuseKey) {
      apiKey = existingKey;
      prompts.log.success('Using existing API key');
    }
  } else if (envKey) {
    prompts.log.info('Found API key in environment');
    const useEnvKey = await prompts.confirm({ message: 'Use API key from environment?', initialValue: true });
    exitIfCancelled(useEnvKey);

    if (useEnvKey) {
      apiKey = envKey;
      prompts.log.success('Using environment API key');
    }
  }

  if (!apiKey) {
    const newKey = await prompts.password({
      message: 'Enter your xAI API key:',
      validate: (value) => {
        if (!value?.trim()) return 'API key is required';
        if (!value.startsWith('xai-')) return 'xAI API keys start with "xai-"';
        return undefined;
      },
    });
    exitIfCancelled(newKey);
    apiKey = newKey.trim();
  }

  // Validate API key
  const validateSpinner = prompts.spinner();
  validateSpinner.start('Validating API key...');

  const isValid = await validateCloudConnection(providerInfo.defaultBaseURL, apiKey);
  validateSpinner.stop(isValid ? 'API key validated!' : 'Could not validate (will save anyway)');

  // Step 2: Model Selection
  prompts.log.step(chalk.bold('Step 2/5 - Choose Model'));

  prompts.log.info('Grok 3 Series - Extended thinking with reasoning_effort');
  prompts.log.info('Grok 2 Series - Fast and capable, with vision option');

  const modelChoices = GROK_MODELS.map((m) => {
    const badges: string[] = [];
    if (m.supportsThinking) badges.push('Thinking');
    if (m.supportsVision) badges.push('Vision');
    if (m.supportsSearch) badges.push('Search');
    const badgeStr = badges.length > 0 ? ` [${badges.join(', ')}]` : '';

    return {
      value: m.id,
      label: m.id === providerInfo.defaultModel ? `${m.name} (recommended)` : m.name,
      hint: `${m.description}${badgeStr}`,
    };
  });

  const selectedModel = await prompts.select({
    message: 'Select default model:',
    options: modelChoices,
    initialValue: existingConfig.defaultModel || providerInfo.defaultModel,
  });
  exitIfCancelled(selectedModel);

  const selectedModelInfo = GROK_MODELS.find(m => m.id === selectedModel);

  // Step 3: Thinking Mode (only for Grok 3)
  let thinkingMode: 'off' | 'low' | 'high' = 'off';

  prompts.log.step(chalk.bold('Step 3/5 - Extended Thinking'));

  if (selectedModelInfo?.supportsThinking) {
    prompts.log.info('Grok 3 supports extended thinking via reasoning_effort:');
    prompts.log.info('  off  - Standard responses, faster');
    prompts.log.info('  low  - Light reasoning, balanced');
    prompts.log.info('  high - Deep reasoning, best for complex tasks');

    const thinkingSelection = await prompts.select({
      message: 'Default thinking mode:',
      options: [
        { value: 'off' as const, label: 'off - Standard mode (fastest)' },
        { value: 'low' as const, label: 'low - Light reasoning (balanced)' },
        { value: 'high' as const, label: 'high - Deep reasoning (recommended for coding)' },
      ],
      initialValue: existingConfig.grok?.thinkingMode || 'high',
    });
    exitIfCancelled(thinkingSelection);
    thinkingMode = thinkingSelection;

    if (thinkingMode !== 'off') {
      prompts.log.success(`Extended thinking enabled: ${thinkingMode}`);
    }
  } else {
    prompts.log.info(`${selectedModel} doesn't support extended thinking.`);
    prompts.log.info('Choose a Grok 3 model for this feature.');
  }

  // Step 4: Live Search
  prompts.log.step(chalk.bold('Step 4/5 - Live Web Search'));

  prompts.log.info('Grok can search the web in real-time for up-to-date information.');

  const enableLiveSearch = await prompts.confirm({
    message: 'Enable live web search by default?',
    initialValue: existingConfig.grok?.liveSearch ?? true,
  });
  exitIfCancelled(enableLiveSearch);

  if (enableLiveSearch) {
    prompts.log.success('Live search enabled');
  } else {
    prompts.log.info('Live search disabled (use --search flag to enable per-request)');
  }

  // Step 5: Review & Save
  prompts.log.step(chalk.bold('Step 5/5 - Review & Save'));

  const summaryLines = [
    `Model: ${selectedModel}`,
  ];
  if (selectedModelInfo?.supportsThinking) {
    summaryLines.push(`Thinking Mode: ${thinkingMode === 'off' ? 'disabled' : thinkingMode}`);
  }
  summaryLines.push(`Live Search: ${enableLiveSearch ? 'enabled' : 'disabled'}`);

  prompts.note(summaryLines.join('\n'), 'Configuration Preview');

  const confirmSave = await prompts.confirm({ message: 'Save this configuration?', initialValue: true });
  exitIfCancelled(confirmSave);

  if (!confirmSave) {
    return null;
  }

  return {
    selectedProvider: 'grok',
    serverType: 'cloud',
    apiKey: apiKey,
    baseURL: providerInfo.defaultBaseURL,
    defaultModel: selectedModel,
    currentModel: selectedModel,
    maxTokens: 32768,
    temperature: existingConfig.temperature ?? 0.7,
    models: GROK_MODELS.map(m => m.id),
    _provider: 'Grok (xAI)',
    _website: providerInfo.website,
    _isLocalServer: false,
    grok: {
      thinkingMode: thinkingMode,
      liveSearch: enableLiveSearch,
    },
  };
}

/**
 * Setup Z.AI MCP servers
 */
async function setupZAIMCPServers(apiKey: string): Promise<void> {
  prompts.note(
    'Enabling Z.AI MCP servers for enhanced capabilities:\n' +
    '- Web Search - Real-time web search\n' +
    '- Web Reader - Extract content from web pages\n' +
    '- Vision - Image/video analysis',
    'Z.AI MCP Integration'
  );

  const mcpSpinner = prompts.spinner();
  mcpSpinner.start('Configuring Z.AI MCP servers...');

  try {
    const status = await detectZAIServices();
    const serversToAdd = getRecommendedServers(status);

    for (const serverName of serversToAdd) {
      try { removeMCPServer(serverName); } catch { /* ignore */ }
    }

    let successCount = 0;
    for (const serverName of serversToAdd) {
      try {
        const config = generateZAIServerConfig(serverName, apiKey);
        addMCPServer(config);
        successCount++;
      } catch { /* skip */ }
    }

    mcpSpinner.stop(`${successCount} Z.AI MCP server${successCount !== 1 ? 's' : ''} configured`);
  } catch (error) {
    mcpSpinner.stop('Could not set up Z.AI MCP servers');
    prompts.log.warn(extractErrorMessage(error));
  }
}

/**
 * Create setup command
 */
export function createSetupCommand(): Command {
  const setupCommand = new Command('setup');

  setupCommand
    .description('Configure your LLM provider (GLM or Grok)')
    .option('--force', 'Overwrite existing configuration')
    .action(async () => {
      try {
        prompts.intro(chalk.cyan('AX CLI Setup Wizard'));

        prompts.note(
          'This wizard will configure your AI coding assistant\n' +
          'with your preferred LLM provider.',
          'Welcome'
        );

        // Provider Selection
        prompts.log.step(chalk.bold('Choose Provider'));

        const provider = await prompts.select<Provider>({
          message: 'Which LLM provider do you want to use?',
          options: [
            {
              value: 'glm' as Provider,
              label: 'GLM (Z.AI)',
              hint: PROVIDERS.glm.description,
            },
            {
              value: 'grok' as Provider,
              label: 'Grok (xAI)',
              hint: PROVIDERS.grok.description,
            },
          ],
        });
        exitIfCancelled(provider);

        // Load existing config for selected provider
        const existingConfig = loadProviderConfig(provider);

        // Run provider-specific setup
        let newConfig: ProviderConfig | null = null;

        if (provider === 'glm') {
          newConfig = await runGLMSetup(existingConfig);
        } else {
          newConfig = await runGrokSetup(existingConfig);
        }

        if (!newConfig) {
          prompts.cancel('Setup cancelled.');
          process.exit(0);
        }

        // Save configuration to provider-specific directory
        saveProviderConfig(provider, newConfig);
        prompts.log.success('Configuration saved!');

        // Setup Z.AI MCP servers for GLM cloud
        if (provider === 'glm' && newConfig.serverType === 'cloud' && newConfig.apiKey) {
          await setupZAIMCPServers(newConfig.apiKey);
        }

        // Show summary
        const providerInfo = PROVIDERS[provider];
        const configPath = getConfigPath(provider);

        prompts.note(
          `Provider: ${newConfig._provider}\n` +
          `Server:   ${newConfig._isLocalServer ? newConfig.baseURL : 'Cloud API'}\n` +
          `Model:    ${newConfig.defaultModel}\n` +
          `Config:   ${configPath}`,
          'Configuration Summary'
        );

        // Check if provider CLI is installed
        const installed = isProviderInstalled(provider);

        if (!installed) {
          prompts.log.warn(`${providerInfo.cliName} is not installed.`);

          const shouldInstall = await prompts.confirm({
            message: `Install ${providerInfo.cliName}?`,
            initialValue: true,
          });

          if (!prompts.isCancel(shouldInstall) && shouldInstall) {
            await installProvider(provider);
          } else {
            prompts.log.info(`Install later: npm install -g ${providerInfo.package}`);
          }
        } else {
          prompts.log.success(`${providerInfo.cliName} is installed`);
        }

        // Next steps
        prompts.note(
          `1. Run "${providerInfo.cliName}" to start\n` +
          `2. Or run "ax-cli" (auto-launches ${providerInfo.cliName})\n` +
          `3. Run "${providerInfo.cliName} --help" for all options`,
          'Next Steps'
        );

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
