/**
 * Setup Flow - Provider Selection and Configuration
 *
 * This setup wizard:
 * 1. Lets user select GLM or Grok provider
 * 2. For GLM: Choose between Z.AI Cloud or Local Server
 * 3. Runs the provider-specific setup (API key, model selection, etc.)
 * 4. Saves the provider preference so `ax-cli` launches the correct CLI
 */

import chalk from 'chalk';
import { select, confirm, password, input } from '@inquirer/prompts';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export type Provider = 'glm' | 'grok';
export type ServerType = 'cloud' | 'local';

interface ModelInfo {
  id: string;
  name: string;
  description: string;
}

interface ProviderInfo {
  name: string;
  description: string;
  cliName: string;
  package: string;
  defaultBaseURL: string;
  defaultModel: string;
  apiKeyEnvVar: string;
  website: string;
  models: ModelInfo[];
}

// Z.AI Cloud models
const ZAI_MODELS: ModelInfo[] = [
  { id: 'glm-4.6', name: 'GLM-4.6', description: 'Most capable GLM model with thinking mode (200K context)' },
  { id: 'glm-4.5v', name: 'GLM-4.5V', description: 'Vision-capable GLM model (64K context)' },
  { id: 'glm-4', name: 'GLM-4', description: 'Standard GLM-4 model (128K context)' },
  { id: 'glm-4-flash', name: 'GLM-4 Flash', description: 'Fast, efficient GLM model (128K context)' },
];

// Common local GLM models
const LOCAL_GLM_MODELS: ModelInfo[] = [
  { id: 'glm4', name: 'GLM-4 (9B)', description: 'GLM-4 9B base model for local inference' },
  { id: 'glm4:latest', name: 'GLM-4 Latest', description: 'Latest GLM-4 model tag' },
  { id: 'codegeex4', name: 'CodeGeeX4', description: 'Code generation model based on GLM-4' },
  { id: 'chatglm3', name: 'ChatGLM3', description: 'ChatGLM3 6B model' },
];

const PROVIDERS: Record<Provider, ProviderInfo> = {
  glm: {
    name: 'GLM (Z.AI)',
    description: 'Optimized for GLM-4.6 with thinking mode and 200K context',
    cliName: 'ax-glm',
    package: '@defai.digital/ax-glm',
    defaultBaseURL: 'https://api.z.ai/api/coding/paas/v4',
    defaultModel: 'glm-4.6',
    apiKeyEnvVar: 'ZAI_API_KEY',
    website: 'https://z.ai',
    models: ZAI_MODELS,
  },
  grok: {
    name: 'Grok (xAI)',
    description: 'Optimized for Grok with extended thinking, vision, and live search',
    cliName: 'ax-grok',
    package: '@defai.digital/ax-grok',
    defaultBaseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-3',
    apiKeyEnvVar: 'XAI_API_KEY',
    website: 'https://console.x.ai',
    models: [
      { id: 'grok-3', name: 'Grok-3', description: 'Most capable Grok model with extended thinking (128K context)' },
      { id: 'grok-3-mini', name: 'Grok-3 Mini', description: 'Efficient Grok 3 with thinking support' },
      { id: 'grok-2', name: 'Grok-2', description: 'Capable Grok 2 with advanced reasoning' },
      { id: 'grok-2-vision', name: 'Grok-2 Vision', description: 'Vision-capable Grok model' },
      { id: 'grok-2-mini', name: 'Grok-2 Mini', description: 'Faster, more efficient Grok 2' },
    ],
  },
};

// Well-known local server ports
const LOCAL_SERVERS = [
  { name: 'Ollama', url: 'http://localhost:11434/v1', port: 11434 },
  { name: 'LM Studio', url: 'http://localhost:1234/v1', port: 1234 },
  { name: 'vLLM', url: 'http://localhost:8000/v1', port: 8000 },
  { name: 'LocalAI', url: 'http://localhost:8080/v1', port: 8080 },
];

// Config paths
// ax-cli meta config (stores which provider was selected)
const AX_CLI_CONFIG_DIR = join(homedir(), '.ax-cli');
const AX_CLI_CONFIG_FILE = join(AX_CLI_CONFIG_DIR, 'config.json');

// Provider-specific config directories
const PROVIDER_CONFIG_DIRS: Record<Provider, string> = {
  glm: join(homedir(), '.ax-glm'),
  grok: join(homedir(), '.ax-grok'),
};

/**
 * Get provider-specific config path
 */
function getProviderConfigPath(provider: Provider): string {
  return join(PROVIDER_CONFIG_DIRS[provider], 'config.json');
}

interface AxCliConfig {
  selectedProvider?: Provider;
  serverType?: ServerType;
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  currentModel?: string;
  maxTokens?: number;
  temperature?: number;
  models?: string[];
  _provider?: string;
  _website?: string;
  _isLocalServer?: boolean;
  // Grok-specific settings
  grok?: {
    thinkingMode?: 'off' | 'low' | 'high';
    liveSearch?: boolean;
  };
}

// Grok model definitions with full feature info
interface GrokModelInfo extends ModelInfo {
  contextWindow: number;
  maxOutput: number;
  supportsThinking: boolean;
  supportsVision: boolean;
  supportsSearch: boolean;
  family: 'grok-3' | 'grok-2' | 'legacy';
}

const GROK_MODELS: GrokModelInfo[] = [
  // Grok 3 family - with extended thinking
  {
    id: 'grok-3',
    name: 'Grok-3',
    description: 'Most capable model with extended thinking',
    contextWindow: 131072,
    maxOutput: 131072,
    supportsThinking: true,
    supportsVision: false,
    supportsSearch: true,
    family: 'grok-3',
  },
  {
    id: 'grok-3-mini',
    name: 'Grok-3 Mini',
    description: 'Efficient model with thinking support',
    contextWindow: 131072,
    maxOutput: 131072,
    supportsThinking: true,
    supportsVision: false,
    supportsSearch: true,
    family: 'grok-3',
  },
  // Grok 2 family - standard models
  {
    id: 'grok-2',
    name: 'Grok-2',
    description: 'Capable model with advanced reasoning',
    contextWindow: 131072,
    maxOutput: 32768,
    supportsThinking: false,
    supportsVision: false,
    supportsSearch: true,
    family: 'grok-2',
  },
  {
    id: 'grok-2-vision',
    name: 'Grok-2 Vision',
    description: 'Vision-capable for image understanding',
    contextWindow: 32768,
    maxOutput: 8192,
    supportsThinking: false,
    supportsVision: true,
    supportsSearch: true,
    family: 'grok-2',
  },
  {
    id: 'grok-2-mini',
    name: 'Grok-2 Mini',
    description: 'Fast and efficient',
    contextWindow: 131072,
    maxOutput: 32768,
    supportsThinking: false,
    supportsVision: false,
    supportsSearch: true,
    family: 'grok-2',
  },
];

/**
 * Load ax-cli meta config (provider selection only)
 */
function loadMetaConfig(): { selectedProvider?: Provider } {
  try {
    if (existsSync(AX_CLI_CONFIG_FILE)) {
      return JSON.parse(readFileSync(AX_CLI_CONFIG_FILE, 'utf-8'));
    }
  } catch {
    // Ignore errors
  }
  return {};
}

/**
 * Load provider-specific config
 */
function loadProviderConfig(provider: Provider): AxCliConfig {
  try {
    const configPath = getProviderConfigPath(provider);
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    }
  } catch {
    // Ignore errors
  }
  return {};
}

/**
 * Save ax-cli meta config (provider selection)
 */
function saveMetaConfig(provider: Provider): void {
  if (!existsSync(AX_CLI_CONFIG_DIR)) {
    mkdirSync(AX_CLI_CONFIG_DIR, { recursive: true });
  }
  writeFileSync(AX_CLI_CONFIG_FILE, JSON.stringify({ selectedProvider: provider }, null, 2), { mode: 0o600 });
}

/**
 * Save provider-specific config
 */
function saveProviderConfig(provider: Provider, config: AxCliConfig): void {
  const configDir = PROVIDER_CONFIG_DIRS[provider];
  const configPath = getProviderConfigPath(provider);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * Check if a local server is running on a given port
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
 * Fetch models from a local server
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

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { data?: Array<{ id: string; owned_by?: string }> };
    const models = data.data || [];

    return models.map((m: { id: string; owned_by?: string }) => ({
      id: m.id,
      name: m.id,
      description: m.owned_by ? `Provided by ${m.owned_by}` : 'Local model',
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
 * Validate API connection (for cloud providers)
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
async function isProviderInstalled(provider: Provider): Promise<boolean> {
  const cliName = PROVIDERS[provider].cliName;
  try {
    await execAsync(`which ${cliName}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Install provider package
 */
async function installProvider(provider: Provider): Promise<boolean> {
  const providerInfo = PROVIDERS[provider];
  const spinner = ora(`Installing ${providerInfo.package}...`).start();

  try {
    const packageManager = await detectPackageManager();
    const installCmd = packageManager === 'pnpm'
      ? `pnpm add -g ${providerInfo.package}`
      : packageManager === 'yarn'
        ? `yarn global add ${providerInfo.package}`
        : `npm install -g ${providerInfo.package}`;

    await execAsync(installCmd);
    spinner.succeed(`${providerInfo.package} installed successfully!`);
    return true;
  } catch (error) {
    spinner.fail('Installation failed');
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(chalk.red(`\n  Error: ${errorMessage}`));
    console.log(chalk.yellow('\n  Try installing manually:'));
    console.log(`    npm install -g ${providerInfo.package}\n`);
    return false;
  }
}

/**
 * Run the GLM-specific setup (Z.AI Cloud or Local)
 */
async function runGLMSetup(existingConfig: AxCliConfig): Promise<AxCliConfig | null> {
  const providerInfo = PROVIDERS.glm;

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: Server Type Selection (Cloud vs Local)
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 1/4 — Choose Server Type\n'));

  const serverType = await select<ServerType>({
    message: 'Where do you want to run GLM models?',
    choices: [
      {
        name: `${chalk.green('Z.AI Cloud')} - Official Z.AI API with GLM-4.6 (Recommended)`,
        value: 'cloud' as ServerType,
        description: 'Requires API key from z.ai',
      },
      {
        name: `${chalk.blue('Local Server')} - Run GLM models locally (Ollama, vLLM, etc.)`,
        value: 'local' as ServerType,
        description: 'No API key required, uses local inference',
      },
    ],
    default: existingConfig.serverType || 'cloud',
  });

  if (serverType === 'cloud') {
    return await runZAICloudSetup(existingConfig, providerInfo);
  } else {
    return await runLocalGLMSetup(existingConfig, providerInfo);
  }
}

/**
 * Run Z.AI Cloud setup
 */
async function runZAICloudSetup(existingConfig: AxCliConfig, providerInfo: ProviderInfo): Promise<AxCliConfig | null> {
  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: API Key
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 2/4 — Z.AI API Key\n'));
  console.log(`  Get your API key from: ${chalk.underline(providerInfo.website)}\n`);

  let apiKey = '';
  const envKey = process.env[providerInfo.apiKeyEnvVar];
  const existingKey = existingConfig.apiKey;
  const isSameServerType = existingConfig.serverType === 'cloud';

  if (existingKey && isSameServerType) {
    const maskedKey = existingKey.length > 12
      ? `${existingKey.substring(0, 8)}...${existingKey.substring(existingKey.length - 4)}`
      : `${existingKey.substring(0, 4)}...`;

    console.log(`  Existing API key found: ${chalk.dim(maskedKey)}\n`);

    const reuseKey = await confirm({
      message: 'Use existing API key?',
      default: true,
    });

    if (reuseKey) {
      apiKey = existingKey;
      console.log(chalk.green('  ✓ Using existing API key\n'));
    }
  } else if (envKey) {
    console.log(`  Found ${providerInfo.apiKeyEnvVar} in environment\n`);
    const useEnvKey = await confirm({
      message: `Use API key from ${providerInfo.apiKeyEnvVar} environment variable?`,
      default: true,
    });

    if (useEnvKey) {
      apiKey = envKey;
      console.log(chalk.green('  ✓ Using environment API key\n'));
    }
  }

  if (!apiKey) {
    apiKey = await password({
      message: 'Enter your Z.AI API key:',
      validate: (value) => value.trim().length > 0 || 'API key is required',
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: Model Selection
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 3/4 — Choose Model\n'));

  const modelChoices = ZAI_MODELS.map((m) => ({
    name: m.id === providerInfo.defaultModel
      ? `${m.name} (recommended) - ${m.description}`
      : `${m.name} - ${m.description}`,
    value: m.id,
  }));

  const selectedModel = await select({
    message: 'Select default model:',
    choices: modelChoices,
    default: existingConfig.defaultModel || providerInfo.defaultModel,
  });

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: Validate & Save
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 4/4 — Validate & Save\n'));

  const spinner = ora('Validating Z.AI connection...').start();
  const isValid = await validateCloudConnection(providerInfo.defaultBaseURL, apiKey);

  if (isValid) {
    spinner.succeed('Z.AI connection validated successfully!');
  } else {
    spinner.warn('Could not validate connection (will save anyway)');
  }

  return {
    ...existingConfig,
    selectedProvider: 'glm',
    serverType: 'cloud',
    apiKey: apiKey,
    baseURL: providerInfo.defaultBaseURL,
    defaultModel: selectedModel,
    currentModel: selectedModel,
    maxTokens: existingConfig.maxTokens ?? 32768,
    temperature: existingConfig.temperature ?? 0.7,
    models: ZAI_MODELS.map(m => m.id),
    _provider: 'GLM (Z.AI Cloud)',
    _website: providerInfo.website,
    _isLocalServer: false,
  };
}

/**
 * Run Local GLM Server setup
 */
async function runLocalGLMSetup(existingConfig: AxCliConfig, providerInfo: ProviderInfo): Promise<AxCliConfig | null> {
  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: Local Server Detection
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 2/4 — Local Server\n'));

  const detectSpinner = ora('Detecting local inference servers...').start();
  const detectedServers = await detectLocalServers();
  const availableServers = detectedServers.filter(s => s.available);
  detectSpinner.stop();

  let selectedBaseURL: string;

  if (availableServers.length > 0) {
    console.log(chalk.green(`  ✓ Found ${availableServers.length} running server(s)\n`));

    const serverChoices = [
      ...availableServers.map(s => ({
        name: `${chalk.green('●')} ${s.name} - ${s.url}`,
        value: s.url,
      })),
      {
        name: `${chalk.dim('○')} Enter custom URL...`,
        value: '__custom__',
      },
    ];

    const serverSelection = await select({
      message: 'Select your local server:',
      choices: serverChoices,
      default: existingConfig.baseURL || availableServers[0].url,
    });

    if (serverSelection === '__custom__') {
      selectedBaseURL = await input({
        message: 'Enter server URL:',
        default: 'http://localhost:11434/v1',
        validate: (value) => {
          try {
            new URL(value);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        },
      });
    } else {
      selectedBaseURL = serverSelection;
    }
  } else {
    console.log(chalk.yellow('  No running servers detected.\n'));
    console.log('  Common local server URLs:');
    LOCAL_SERVERS.forEach(s => {
      console.log(`    ${chalk.dim('•')} ${s.name}: ${chalk.dim(s.url)}`);
    });
    console.log();

    selectedBaseURL = await input({
      message: 'Enter your server URL:',
      default: existingConfig.baseURL || 'http://localhost:11434/v1',
      validate: (value) => {
        try {
          new URL(value);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: Model Selection (fetch from server or use defaults)
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 3/4 — Choose Model\n'));

  const modelSpinner = ora('Fetching available models...').start();
  let availableModels = await fetchLocalModels(selectedBaseURL);
  modelSpinner.stop();

  let selectedModel: string;

  if (availableModels.length > 0) {
    console.log(chalk.green(`  ✓ Found ${availableModels.length} model(s) on server\n`));

    // Filter to show GLM-related models first, then others
    const glmModels = availableModels.filter(m =>
      m.id.toLowerCase().includes('glm') ||
      m.id.toLowerCase().includes('codegeex') ||
      m.id.toLowerCase().includes('chatglm')
    );
    const otherModels = availableModels.filter(m =>
      !m.id.toLowerCase().includes('glm') &&
      !m.id.toLowerCase().includes('codegeex') &&
      !m.id.toLowerCase().includes('chatglm')
    );

    const sortedModels = [...glmModels, ...otherModels];

    const modelChoices = [
      ...sortedModels.map(m => ({
        name: `${m.name} - ${m.description}`,
        value: m.id,
      })),
      {
        name: chalk.dim('Enter custom model name...'),
        value: '__custom__',
      },
    ];

    const modelSelection = await select({
      message: 'Select model:',
      choices: modelChoices,
      default: existingConfig.defaultModel || (glmModels[0]?.id || sortedModels[0]?.id),
    });

    if (modelSelection === '__custom__') {
      selectedModel = await input({
        message: 'Enter model name:',
        default: 'glm4',
      });
    } else {
      selectedModel = modelSelection;
    }
  } else {
    console.log(chalk.yellow('  Could not fetch models from server.\n'));
    console.log('  Common GLM models for local inference:');
    LOCAL_GLM_MODELS.forEach(m => {
      console.log(`    ${chalk.dim('•')} ${m.id}: ${chalk.dim(m.description)}`);
    });
    console.log();

    const modelChoices = [
      ...LOCAL_GLM_MODELS.map(m => ({
        name: `${m.name} - ${m.description}`,
        value: m.id,
      })),
      {
        name: chalk.dim('Enter custom model name...'),
        value: '__custom__',
      },
    ];

    const modelSelection = await select({
      message: 'Select model:',
      choices: modelChoices,
      default: existingConfig.defaultModel || 'glm4',
    });

    if (modelSelection === '__custom__') {
      selectedModel = await input({
        message: 'Enter model name:',
        default: 'glm4',
      });
    } else {
      selectedModel = modelSelection;
    }

    availableModels = LOCAL_GLM_MODELS;
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: Validate & Save
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 4/4 — Validate & Save\n'));

  const validateSpinner = ora('Validating local server connection...').start();
  const isValid = await checkLocalServer(selectedBaseURL);

  if (isValid) {
    validateSpinner.succeed('Local server connection validated!');
  } else {
    validateSpinner.warn('Server not responding (will save anyway)');
  }

  return {
    ...existingConfig,
    selectedProvider: 'glm',
    serverType: 'local',
    apiKey: '', // No API key needed for local
    baseURL: selectedBaseURL,
    defaultModel: selectedModel,
    currentModel: selectedModel,
    maxTokens: existingConfig.maxTokens ?? 8192,
    temperature: existingConfig.temperature ?? 0.7,
    models: availableModels.map(m => m.id),
    _provider: 'GLM (Local Server)',
    _website: '',
    _isLocalServer: true,
  };
}

/**
 * Format context window size for display
 */
function formatContextSize(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(0)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K`;
  }
  return String(tokens);
}

/**
 * Build feature badges for a Grok model
 */
function getGrokModelBadges(model: GrokModelInfo): string {
  const badges: string[] = [];
  if (model.supportsThinking) badges.push(chalk.magenta('🧠 Thinking'));
  if (model.supportsVision) badges.push(chalk.blue('👁️ Vision'));
  if (model.supportsSearch) badges.push(chalk.green('🔍 Search'));
  return badges.length > 0 ? badges.join(' ') : '';
}

/**
 * Validate xAI API key and fetch account info
 */
async function validateXAIKey(apiKey: string): Promise<{
  valid: boolean;
  models?: string[];
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://api.x.ai/v1/models', {
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      }
      return { valid: false, error: `API error: ${response.status}` };
    }

    const data = await response.json() as { data?: Array<{ id: string }> };
    const models = data.data?.map((m: { id: string }) => m.id) || [];

    return { valid: true, models };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { valid: false, error: 'Connection timeout' };
    }
    return { valid: false, error: 'Connection failed' };
  }
}

/**
 * Run the Grok-specific setup (Enhanced)
 */
async function runGrokSetup(existingConfig: AxCliConfig): Promise<AxCliConfig | null> {
  const providerInfo = PROVIDERS.grok;

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: API Key
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 1/5 — xAI API Key\n'));

  console.log('  Grok is powered by xAI. You need an API key to use it.');
  console.log(`  Get your API key from: ${chalk.underline.blue(providerInfo.website)}\n`);

  let apiKey = '';
  const envKey = process.env[providerInfo.apiKeyEnvVar] || process.env['GROK_API_KEY'];
  const existingKey = existingConfig.apiKey;
  const isSameProvider = existingConfig.selectedProvider === 'grok';

  if (existingKey && isSameProvider) {
    const maskedKey = existingKey.length > 12
      ? `${existingKey.substring(0, 8)}...${existingKey.substring(existingKey.length - 4)}`
      : `${existingKey.substring(0, 4)}...`;

    console.log(`  Existing API key found: ${chalk.dim(maskedKey)}\n`);

    const reuseKey = await confirm({
      message: 'Use existing API key?',
      default: true,
    });

    if (reuseKey) {
      apiKey = existingKey;
      console.log(chalk.green('  ✓ Using existing API key\n'));
    }
  } else if (envKey) {
    const envVarName = process.env[providerInfo.apiKeyEnvVar] ? providerInfo.apiKeyEnvVar : 'GROK_API_KEY';
    console.log(`  Found ${chalk.cyan(envVarName)} in environment\n`);

    const useEnvKey = await confirm({
      message: `Use API key from ${envVarName} environment variable?`,
      default: true,
    });

    if (useEnvKey) {
      apiKey = envKey;
      console.log(chalk.green('  ✓ Using environment API key\n'));
    }
  }

  if (!apiKey) {
    apiKey = await password({
      message: 'Enter your xAI API key:',
      validate: (value) => {
        if (!value.trim()) return 'API key is required';
        if (!value.startsWith('xai-')) return 'xAI API keys start with "xai-"';
        return true;
      },
    });
  }

  // Validate the API key
  const validateSpinner = ora('Validating API key...').start();
  const validation = await validateXAIKey(apiKey);

  if (validation.valid) {
    validateSpinner.succeed(`API key valid! Found ${validation.models?.length || 0} available models`);
  } else {
    validateSpinner.fail(`Validation failed: ${validation.error}`);
    console.log();

    const continueAnyway = await confirm({
      message: 'Continue with setup anyway?',
      default: false,
    });

    if (!continueAnyway) {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: Model Selection (Grouped by Family)
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 2/5 — Choose Model\n'));

  // Show model overview
  console.log('  ' + chalk.bold('Grok 3 Series') + chalk.dim(' — Extended thinking with reasoning_effort'));
  console.log('  ' + chalk.bold('Grok 2 Series') + chalk.dim(' — Fast and capable, with vision option'));
  console.log();

  // Build choices with feature badges and grouping
  const grok3Models = GROK_MODELS.filter(m => m.family === 'grok-3');
  const grok2Models = GROK_MODELS.filter(m => m.family === 'grok-2');

  const modelChoices = [
    // Grok 3 section
    { name: chalk.bold.magenta('── Grok 3 (Extended Thinking) ──'), value: '__separator_1__', disabled: true },
    ...grok3Models.map(m => {
      const badges = getGrokModelBadges(m);
      const contextInfo = chalk.dim(`${formatContextSize(m.contextWindow)} context`);
      const isDefault = m.id === 'grok-3';
      const label = isDefault ? `${m.name} ${chalk.yellow('(recommended)')}` : m.name;
      return {
        name: `${label} - ${m.description} ${badges} ${contextInfo}`,
        value: m.id,
      };
    }),
    // Grok 2 section
    { name: chalk.bold.blue('── Grok 2 (Standard) ──'), value: '__separator_2__', disabled: true },
    ...grok2Models.map(m => {
      const badges = getGrokModelBadges(m);
      const contextInfo = chalk.dim(`${formatContextSize(m.contextWindow)} context`);
      return {
        name: `${m.name} - ${m.description} ${badges} ${contextInfo}`,
        value: m.id,
      };
    }),
  ];

  const selectedModel = await select({
    message: 'Select default model:',
    choices: modelChoices,
    default: existingConfig.defaultModel || 'grok-3',
  });

  const selectedModelInfo = GROK_MODELS.find(m => m.id === selectedModel);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: Thinking Mode (Only for Grok 3 models)
  // ═══════════════════════════════════════════════════════════════════
  let thinkingMode: 'off' | 'low' | 'high' = 'off';

  if (selectedModelInfo?.supportsThinking) {
    console.log(chalk.bold.cyan('\n  Step 3/5 — Extended Thinking\n'));

    console.log('  Grok 3 supports extended thinking via ' + chalk.cyan('reasoning_effort') + ':');
    console.log('  ' + chalk.dim('• off  — Standard responses, faster'));
    console.log('  ' + chalk.dim('• low  — Light reasoning, balanced'));
    console.log('  ' + chalk.dim('• high — Deep reasoning, best for complex tasks'));
    console.log();

    thinkingMode = await select({
      message: 'Default thinking mode:',
      choices: [
        {
          name: `${chalk.green('off')} - Standard mode (fastest)`,
          value: 'off' as const,
        },
        {
          name: `${chalk.yellow('low')} - Light reasoning (balanced)`,
          value: 'low' as const,
        },
        {
          name: `${chalk.magenta('high')} - Deep reasoning (recommended for coding)`,
          value: 'high' as const,
        },
      ],
      default: existingConfig.grok?.thinkingMode || 'high',
    });

    if (thinkingMode !== 'off') {
      console.log(chalk.green(`  ✓ Extended thinking enabled: ${thinkingMode}`));
      console.log(chalk.dim(`    Use --think or --no-think to override per-request\n`));
    }
  } else {
    console.log(chalk.bold.cyan('\n  Step 3/5 — Extended Thinking\n'));
    console.log(chalk.dim(`  ${selectedModel} doesn't support extended thinking.`));
    console.log(chalk.dim('  Choose a Grok 3 model for this feature.\n'));
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: Live Search
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 4/5 — Live Web Search\n'));

  console.log('  Grok can search the web in real-time for up-to-date information.');
  console.log('  ' + chalk.dim('This uses the xAI search integration.'));
  console.log();

  const enableLiveSearch = await confirm({
    message: 'Enable live web search by default?',
    default: existingConfig.grok?.liveSearch ?? true,
  });

  if (enableLiveSearch) {
    console.log(chalk.green('  ✓ Live search enabled'));
    console.log(chalk.dim('    Grok will search the web when helpful\n'));
  } else {
    console.log(chalk.dim('  ✓ Live search disabled'));
    console.log(chalk.dim('    Use --search flag to enable per-request\n'));
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 5: Review & Save
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 5/5 — Review & Save\n'));

  // Show configuration summary
  const summaryLines = [
    `Model:           ${selectedModel}`,
    `Context Window:  ${formatContextSize(selectedModelInfo?.contextWindow || 131072)}`,
  ];

  if (selectedModelInfo?.supportsThinking) {
    summaryLines.push(`Thinking Mode:   ${thinkingMode === 'off' ? 'disabled' : thinkingMode}`);
  }

  summaryLines.push(`Live Search:     ${enableLiveSearch ? 'enabled' : 'disabled'}`);

  // Feature summary
  const features: string[] = [];
  if (selectedModelInfo?.supportsThinking && thinkingMode !== 'off') features.push('🧠 Thinking');
  if (selectedModelInfo?.supportsVision) features.push('👁️ Vision');
  if (enableLiveSearch) features.push('🔍 Search');

  if (features.length > 0) {
    summaryLines.push(`Features:        ${features.join(' ')}`);
  }

  console.log(chalk.cyan('  ┌─────────────────────────────────────────┐'));
  console.log(chalk.cyan('  │          Configuration Preview          │'));
  console.log(chalk.cyan('  └─────────────────────────────────────────┘'));
  summaryLines.forEach(line => console.log(`  ${line}`));
  console.log();

  const confirmSave = await confirm({
    message: 'Save this configuration?',
    default: true,
  });

  if (!confirmSave) {
    return null;
  }

  return {
    ...existingConfig,
    selectedProvider: 'grok',
    serverType: 'cloud',
    apiKey: apiKey,
    baseURL: providerInfo.defaultBaseURL,
    defaultModel: selectedModel,
    currentModel: selectedModel,
    maxTokens: selectedModelInfo?.maxOutput ?? 32768,
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
 * Run the setup wizard
 */
export async function runSetup(): Promise<void> {
  console.log(chalk.cyan('\n  ╔════════════════════════════════════════╗'));
  console.log(chalk.cyan('  ║     Welcome to ax-cli Setup Wizard     ║'));
  console.log(chalk.cyan('  ╚════════════════════════════════════════╝\n'));

  console.log('  This wizard will configure your AI coding assistant');
  console.log('  with your preferred LLM provider.\n');

  // Load existing meta config (to get previously selected provider)
  const metaConfig = loadMetaConfig();

  // ═══════════════════════════════════════════════════════════════════
  // Provider Selection
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Choose Provider\n'));

  const provider = await select<Provider>({
    message: 'Which LLM provider do you want to use?',
    choices: [
      {
        name: `${chalk.green('GLM')} - GLM-4.6 via Z.AI Cloud or local inference`,
        value: 'glm' as Provider,
        description: 'Thinking mode, 200K context, vision support',
      },
      {
        name: `${chalk.blue('Grok')} - Grok 3 via xAI API`,
        value: 'grok' as Provider,
        description: 'Extended thinking, live search, vision support',
      },
    ],
    default: metaConfig.selectedProvider || 'glm',
  });

  // Load provider-specific config for the selected provider
  const existingProviderConfig = loadProviderConfig(provider);

  // Run provider-specific setup
  let newConfig: AxCliConfig | null = null;

  if (provider === 'glm') {
    newConfig = await runGLMSetup(existingProviderConfig);
  } else {
    newConfig = await runGrokSetup(existingProviderConfig);
  }

  if (!newConfig) {
    console.log(chalk.yellow('\n  Setup cancelled.\n'));
    return;
  }

  // Save meta config (provider selection) to ~/.ax-cli/config.json
  saveMetaConfig(provider);

  // Save provider-specific config to ~/.ax-glm/ or ~/.ax-grok/
  saveProviderConfig(provider, newConfig);
  console.log(chalk.green('\n  ✓ Configuration saved!\n'));

  // Show summary
  const providerInfo = PROVIDERS[provider];
  const isLocal = newConfig._isLocalServer;

  console.log(chalk.cyan('  ┌─────────────────────────────────────────┐'));
  console.log(chalk.cyan('  │          Configuration Summary          │'));
  console.log(chalk.cyan('  └─────────────────────────────────────────┘\n'));
  console.log(`  Provider:    ${newConfig._provider}`);
  console.log(`  Server:      ${isLocal ? newConfig.baseURL : 'Cloud API'}`);
  console.log(`  Model:       ${newConfig.defaultModel}`);
  console.log(`  Config:      ${getProviderConfigPath(provider)}`);
  console.log();

  // Check if provider CLI is installed
  const installed = await isProviderInstalled(provider);

  if (!installed) {
    console.log(chalk.yellow(`  ${providerInfo.cliName} is not installed.\n`));

    const shouldInstall = await confirm({
      message: `Install ${providerInfo.cliName}?`,
      default: true,
    });

    if (shouldInstall) {
      const success = await installProvider(provider);
      if (!success) {
        process.exit(1);
      }
    } else {
      console.log(chalk.yellow('\n  You can install it later:'));
      console.log(`    npm install -g ${providerInfo.package}\n`);
    }
  }

  // Show next steps
  console.log(chalk.cyan('\n  ┌─────────────────────────────────────────┐'));
  console.log(chalk.cyan('  │              Next Steps                 │'));
  console.log(chalk.cyan('  └─────────────────────────────────────────┘\n'));
  console.log(`  1. Run ${chalk.bold('ax-cli')} to start (auto-launches ${providerInfo.cliName})`);
  console.log(`  2. Or run ${chalk.bold(providerInfo.cliName)} directly`);
  console.log(`  3. Run ${chalk.bold(`${providerInfo.cliName} --help`)} for all options`);

  if (isLocal) {
    console.log();
    console.log(chalk.dim('  Note: Make sure your local server is running before using ax-glm'));
  }

  console.log();
  console.log(chalk.green('  ✓ Setup complete! Happy coding!\n'));
}

/**
 * Detect which package manager to use
 */
async function detectPackageManager(): Promise<'npm' | 'pnpm' | 'yarn'> {
  try {
    await execAsync('pnpm --version');
    return 'pnpm';
  } catch {
    // Not found
  }

  try {
    await execAsync('yarn --version');
    return 'yarn';
  } catch {
    // Not found
  }

  return 'npm';
}

/**
 * Get the selected provider from meta config
 */
export function getSelectedProvider(): Provider | null {
  const config = loadMetaConfig();
  return config.selectedProvider || null;
}
