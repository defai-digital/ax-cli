/**
 * Setup Flow - Provider Selection and Configuration
 *
 * This setup wizard:
 * 1. Lets user select a provider (Qwen, Deepseek, Mixtral, Local)
 * 2. For cloud providers: Configure API key and model
 * 3. For offline mode: Configure local server (Ollama/LMStudio) with any supported model
 * 4. Saves configuration to ~/.ax-cli/
 *
 * Provider Distribution:
 * - ax-cli: Standalone CLI (cloud: Qwen, DeepSeek, Mixtral; local: Ollama/LMStudio)
 * - ax-glm: GLM-specific CLI with web search, vision, image generation (Z.AI Cloud)
 * - ax-grok: Grok-specific CLI with web search, vision, extended thinking (xAI Cloud)
 *
 * NOTE: ax-cli does NOT route to ax-glm or ax-grok. For GLM/Grok specific features,
 * users should install and use ax-glm or ax-grok directly.
 */

import chalk from 'chalk';
import { select, confirm, password, input } from '@inquirer/prompts';
import ora from 'ora';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Note: GLM and Grok are NOT available in ax-cli - use ax-glm or ax-grok directly
export type Provider = 'qwen' | 'deepseek' | 'mixtral' | 'local';
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

// Common local models by family (for Ollama/LMStudio)
const LOCAL_QWEN_MODELS: ModelInfo[] = [
  { id: 'qwen2.5-coder:32b', name: 'Qwen2.5-Coder 32B', description: 'Best coding model, 128K context' },
  { id: 'qwen2.5-coder:14b', name: 'Qwen2.5-Coder 14B', description: 'Balanced coding model' },
  { id: 'qwen2.5-coder:7b', name: 'Qwen2.5-Coder 7B', description: 'Efficient coding model' },
  { id: 'qwen2.5:72b', name: 'Qwen2.5 72B', description: 'Most capable general model' },
  { id: 'qwen2.5:32b', name: 'Qwen2.5 32B', description: 'High-quality general model' },
  { id: 'qwen2.5:14b', name: 'Qwen2.5 14B', description: 'Balanced general model' },
  { id: 'qwen2.5:7b', name: 'Qwen2.5 7B', description: 'Efficient general model' },
];

const LOCAL_DEEPSEEK_MODELS: ModelInfo[] = [
  { id: 'deepseek-coder-v2:236b', name: 'DeepSeek-Coder-V2 236B', description: 'Most capable coding model (MoE)' },
  { id: 'deepseek-coder-v2:16b', name: 'DeepSeek-Coder-V2 16B', description: 'Efficient coding model' },
  { id: 'deepseek-v2.5', name: 'DeepSeek-V2.5', description: 'Latest general model with coding' },
  { id: 'deepseek-coder:33b', name: 'DeepSeek-Coder 33B', description: 'Strong coding model' },
  { id: 'deepseek-coder:6.7b', name: 'DeepSeek-Coder 6.7B', description: 'Efficient coding model' },
];

const LOCAL_MIXTRAL_MODELS: ModelInfo[] = [
  { id: 'mixtral:8x22b', name: 'Mixtral 8x22B', description: 'Most capable MoE model (141B params)' },
  { id: 'mixtral:8x7b', name: 'Mixtral 8x7B', description: 'Efficient MoE model (47B params)' },
  { id: 'mistral:7b', name: 'Mistral 7B', description: 'Fast and efficient base model' },
  { id: 'codestral:22b', name: 'Codestral 22B', description: 'Dedicated coding model' },
  { id: 'mistral-nemo:12b', name: 'Mistral Nemo 12B', description: 'Compact but capable model' },
];

// All local models combined for offline setup
const ALL_LOCAL_MODELS: ModelInfo[] = [
  // Qwen models
  ...LOCAL_QWEN_MODELS.map(m => ({ ...m, name: `[Qwen] ${m.name}` })),
  // DeepSeek models
  ...LOCAL_DEEPSEEK_MODELS.map(m => ({ ...m, name: `[DeepSeek] ${m.name}` })),
  // Mixtral/Mistral models
  ...LOCAL_MIXTRAL_MODELS.map(m => ({ ...m, name: `[Mixtral] ${m.name}` })),
];

// Qwen Cloud models (DashScope API)
const QWEN_CLOUD_MODELS: ModelInfo[] = [
  { id: 'qwen-max', name: 'Qwen-Max', description: 'Most capable Qwen model (32K context)' },
  { id: 'qwen-plus', name: 'Qwen-Plus', description: 'Balanced performance and cost (32K context)' },
  { id: 'qwen-turbo', name: 'Qwen-Turbo', description: 'Fast and efficient (8K context)' },
  { id: 'qwen-coder-plus', name: 'Qwen-Coder-Plus', description: 'Optimized for coding tasks' },
];

// DeepSeek Cloud models
const DEEPSEEK_CLOUD_MODELS: ModelInfo[] = [
  { id: 'deepseek-chat', name: 'DeepSeek-Chat', description: 'Latest chat model with 64K context' },
  { id: 'deepseek-coder', name: 'DeepSeek-Coder', description: 'Optimized for code generation' },
  { id: 'deepseek-reasoner', name: 'DeepSeek-Reasoner', description: 'Enhanced reasoning capabilities' },
];

// Mixtral/Mistral Cloud models
const MIXTRAL_CLOUD_MODELS: ModelInfo[] = [
  { id: 'mistral-large-latest', name: 'Mistral Large', description: 'Most capable model (128K context)' },
  { id: 'mistral-medium-latest', name: 'Mistral Medium', description: 'Balanced performance' },
  { id: 'mistral-small-latest', name: 'Mistral Small', description: 'Fast and efficient' },
  { id: 'codestral-latest', name: 'Codestral', description: 'Dedicated coding model (32K context)' },
  { id: 'open-mixtral-8x22b', name: 'Mixtral 8x22B', description: 'Open-weight MoE model' },
];

// Note: GLM and Grok are NOT available in ax-cli
// For GLM features (web search, vision, image), use: npm install -g @defai.digital/ax-glm
// For Grok features (web search, vision, thinking), use: npm install -g @defai.digital/ax-grok

const PROVIDERS: Record<Provider, ProviderInfo> = {
  qwen: {
    name: 'Qwen (DashScope Cloud)',
    description: 'Qwen models via Alibaba DashScope API',
    cliName: 'ax-cli',
    package: '@defai.digital/ax-cli',
    defaultBaseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-max',
    apiKeyEnvVar: 'DASHSCOPE_API_KEY',
    website: 'https://dashscope.console.aliyun.com',
    models: QWEN_CLOUD_MODELS,
  },
  deepseek: {
    name: 'DeepSeek (Cloud)',
    description: 'DeepSeek models via official API',
    cliName: 'ax-cli',
    package: '@defai.digital/ax-cli',
    defaultBaseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    website: 'https://platform.deepseek.com',
    models: DEEPSEEK_CLOUD_MODELS,
  },
  mixtral: {
    name: 'Mixtral/Mistral (Cloud)',
    description: 'Mistral AI models via official API',
    cliName: 'ax-cli',
    package: '@defai.digital/ax-cli',
    defaultBaseURL: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    apiKeyEnvVar: 'MISTRAL_API_KEY',
    website: 'https://console.mistral.ai',
    models: MIXTRAL_CLOUD_MODELS,
  },
  local: {
    name: 'Offline/Local (Ollama/LMStudio)',
    description: 'Run models locally via Ollama, LMStudio, vLLM, or other OpenAI-compatible servers',
    cliName: 'ax-cli',
    package: '@defai.digital/ax-cli',
    defaultBaseURL: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5-coder:14b',
    apiKeyEnvVar: '',
    website: 'https://ollama.ai',
    models: ALL_LOCAL_MODELS,
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

// All ax-cli providers use the same config directory
const PROVIDER_CONFIG_DIRS: Record<Provider, string> = {
  qwen: join(homedir(), '.ax-cli'),
  deepseek: join(homedir(), '.ax-cli'),
  mixtral: join(homedir(), '.ax-cli'),
  local: join(homedir(), '.ax-cli'),
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
}

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
 * Run Generic Cloud Provider setup (Qwen, DeepSeek, Mixtral)
 */
async function runGenericCloudSetup(provider: Provider, existingConfig: AxCliConfig): Promise<AxCliConfig | null> {
  const providerInfo = PROVIDERS[provider];

  console.log(chalk.cyan('\n  ┌─────────────────────────────────────────────────────┐'));
  console.log(chalk.cyan(`  │  ${providerInfo.name} Setup`.padEnd(53) + '│'));
  console.log(chalk.cyan('  └─────────────────────────────────────────────────────┘\n'));

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: API Key with Connection Test Loop
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 1/3 — API Key & Connection Test\n'));
  console.log(`  Get your API key from: ${chalk.underline(providerInfo.website)}\n`);

  let apiKey = '';
  let connectionValidated = false;
  const envKey = process.env[providerInfo.apiKeyEnvVar];
  const existingKey = existingConfig.apiKey;
  const isSameProvider = existingConfig.selectedProvider === provider;

  // Check for existing key
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
    }
  } else if (envKey) {
    console.log(`  Found ${providerInfo.apiKeyEnvVar} in environment\n`);
    const useEnvKey = await confirm({
      message: `Use API key from ${providerInfo.apiKeyEnvVar} environment variable?`,
      default: true,
    });

    if (useEnvKey) {
      apiKey = envKey;
    }
  }

  // API Key entry and validation loop
  while (!connectionValidated) {
    // If no API key yet, prompt for one
    if (!apiKey) {
      apiKey = await password({
        message: `Enter your ${providerInfo.name} API key:`,
        validate: (value) => value.trim().length > 0 || 'API key is required',
      });
    }

    // Test connection
    const spinner = ora(`Testing ${providerInfo.name} connection...`).start();
    const isValid = await validateCloudConnection(providerInfo.defaultBaseURL, apiKey);

    if (isValid) {
      spinner.succeed(`${providerInfo.name} connection validated!`);
      connectionValidated = true;
    } else {
      spinner.fail('Connection failed');
      console.log();

      // Ask user what to do
      const retryChoice = await select({
        message: 'Connection failed. What would you like to do?',
        choices: [
          { name: 'Enter a different API key', value: 'retry' },
          { name: 'Continue anyway (save without validation)', value: 'skip' },
          { name: 'Cancel setup (Esc)', value: 'quit' },
        ],
      });

      if (retryChoice === 'retry') {
        apiKey = ''; // Clear to prompt for new key
        continue;
      } else if (retryChoice === 'skip') {
        console.log(chalk.yellow('  ⚠ Proceeding with unvalidated configuration\n'));
        connectionValidated = true;
      } else {
        console.log(chalk.yellow('\n  Setup cancelled.\n'));
        return null;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: Model Selection
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 2/3 — Choose Model\n'));

  const modelChoices = providerInfo.models.map((m) => ({
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
  // STEP 3: Save Configuration
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 3/3 — Save Configuration\n'));

  return {
    ...existingConfig,
    selectedProvider: provider,
    serverType: 'cloud',
    apiKey: apiKey,
    baseURL: providerInfo.defaultBaseURL,
    defaultModel: selectedModel,
    currentModel: selectedModel,
    maxTokens: existingConfig.maxTokens ?? 32768,
    temperature: existingConfig.temperature ?? 0.7,
    models: providerInfo.models.map(m => m.id),
    _provider: providerInfo.name,
    _website: providerInfo.website,
    _isLocalServer: false,
  };
}

/**
 * Run Generic Local Setup (Ollama, LMStudio, vLLM)
 */
async function runLocalSetup(existingConfig: AxCliConfig): Promise<AxCliConfig | null> {
  const providerInfo = PROVIDERS.local;

  console.log(chalk.cyan('\n  ┌─────────────────────────────────────────────────────┐'));
  console.log(chalk.cyan('  │  Local/Offline Setup (Ollama, LMStudio, vLLM)       │'));
  console.log(chalk.cyan('  └─────────────────────────────────────────────────────┘\n'));

  console.log('  Run AI models locally without an API key.');
  console.log('  Supports: GLM, Qwen, DeepSeek, Mixtral/Mistral models\n');

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: Local Server Detection
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 1/3 — Local Server\n'));

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
      default: existingConfig.baseURL || availableServers[0]?.url,
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
    console.log(chalk.dim('  Tip: Start Ollama with: ollama serve'));
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
  // STEP 2: Model Selection (fetch from server or use defaults)
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 2/3 — Choose Model\n'));

  const modelSpinner = ora('Fetching available models...').start();
  let availableModels = await fetchLocalModels(selectedBaseURL);
  modelSpinner.stop();

  let selectedModel: string;

  if (availableModels.length > 0) {
    console.log(chalk.green(`  ✓ Found ${availableModels.length} model(s) on server\n`));

    // Categorize models by family
    const categorizeModel = (id: string): string => {
      const lower = id.toLowerCase();
      if (lower.includes('glm') || lower.includes('codegeex') || lower.includes('chatglm')) return 'GLM';
      if (lower.includes('qwen')) return 'Qwen';
      if (lower.includes('deepseek')) return 'DeepSeek';
      if (lower.includes('mixtral') || lower.includes('mistral') || lower.includes('codestral')) return 'Mixtral';
      return 'Other';
    };

    // Sort by family priority
    const familyOrder = ['Qwen', 'DeepSeek', 'GLM', 'Mixtral', 'Other'];
    const sortedModels = [...availableModels].sort((a, b) => {
      const catA = familyOrder.indexOf(categorizeModel(a.id));
      const catB = familyOrder.indexOf(categorizeModel(b.id));
      return catA - catB;
    });

    const modelChoices = [
      ...sortedModels.map(m => {
        const category = categorizeModel(m.id);
        const prefix = category !== 'Other' ? `[${category}] ` : '';
        return {
          name: `${prefix}${m.name} - ${m.description}`,
          value: m.id,
        };
      }),
      {
        name: chalk.dim('Enter custom model name...'),
        value: '__custom__',
      },
    ];

    const modelSelection = await select({
      message: 'Select model:',
      choices: modelChoices,
      default: existingConfig.defaultModel || sortedModels[0]?.id,
    });

    if (modelSelection === '__custom__') {
      selectedModel = await input({
        message: 'Enter model name:',
        default: providerInfo.defaultModel,
      });
    } else {
      selectedModel = modelSelection;
    }
  } else {
    console.log(chalk.yellow('  Could not fetch models from server.\n'));
    console.log('  Popular models for local inference:\n');
    console.log(chalk.bold('  Qwen (Recommended for coding):'));
    LOCAL_QWEN_MODELS.slice(0, 3).forEach(m => {
      console.log(`    ${chalk.dim('•')} ${m.id}: ${chalk.dim(m.description)}`);
    });
    console.log(chalk.bold('\n  DeepSeek:'));
    LOCAL_DEEPSEEK_MODELS.slice(0, 2).forEach(m => {
      console.log(`    ${chalk.dim('•')} ${m.id}: ${chalk.dim(m.description)}`);
    });
    console.log(chalk.bold('\n  Mixtral/Mistral:'));
    LOCAL_MIXTRAL_MODELS.slice(0, 2).forEach(m => {
      console.log(`    ${chalk.dim('•')} ${m.id}: ${chalk.dim(m.description)}`);
    });
    console.log();

    const modelChoices = [
      ...ALL_LOCAL_MODELS.map(m => ({
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
      default: existingConfig.defaultModel || providerInfo.defaultModel,
    });

    if (modelSelection === '__custom__') {
      selectedModel = await input({
        message: 'Enter model name:',
        default: providerInfo.defaultModel,
      });
    } else {
      selectedModel = modelSelection;
    }

    availableModels = providerInfo.models; // Fallback to predefined local models
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: Validate & Save
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 3/3 — Validate & Save\n'));

  const validateSpinner = ora('Validating local server connection...').start();
  const isValid = await checkLocalServer(selectedBaseURL);

  if (isValid) {
    validateSpinner.succeed('Local server connection validated!');
  } else {
    validateSpinner.warn('Server not responding (will save anyway)');
    console.log(chalk.dim('\n  Tip: Make sure your local server is running before using ax-cli'));
  }

  return {
    ...existingConfig,
    selectedProvider: 'local',
    serverType: 'local',
    apiKey: '', // No API key needed for local
    baseURL: selectedBaseURL,
    defaultModel: selectedModel,
    currentModel: selectedModel,
    maxTokens: existingConfig.maxTokens ?? 8192,
    temperature: existingConfig.temperature ?? 0.7,
    models: availableModels.map(m => m.id),
    _provider: providerInfo.name,
    _website: providerInfo.website,
    _isLocalServer: true,
  };
}

/**
 * Run the setup wizard
 */
export async function runSetup(): Promise<void> {
  console.log(chalk.cyan('\n  ╔════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('  ║       Welcome to ax-cli Setup Wizard           ║'));
  console.log(chalk.cyan('  ╚════════════════════════════════════════════════╝\n'));

  console.log('  This wizard will configure your AI coding assistant');
  console.log('  with your preferred LLM provider.\n');
  console.log(chalk.dim('  • Cloud providers: API key required'));
  console.log(chalk.dim('  • Local/Offline: No API key, uses Ollama/LMStudio'));
  console.log();
  console.log(chalk.dim('  Note: For GLM/Grok-specific features (web search, vision, image):'));
  console.log(chalk.dim('  • GLM: npm install -g @defai.digital/ax-glm'));
  console.log(chalk.dim('  • Grok: npm install -g @defai.digital/ax-grok\n'));

  // Load existing meta config (to get previously selected provider)
  const metaConfig = loadMetaConfig();

  // ═══════════════════════════════════════════════════════════════════
  // Provider Selection
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Choose Provider\n'));

  const provider = await select<Provider>({
    message: 'Which LLM provider do you want to use?',
    choices: [
      // Cloud providers managed by ax-cli
      {
        name: `${chalk.yellow('Qwen')} - DashScope Cloud`,
        value: 'qwen' as Provider,
        description: 'Qwen2.5 models via Alibaba API',
      },
      {
        name: `${chalk.magenta('DeepSeek')} - DeepSeek Cloud`,
        value: 'deepseek' as Provider,
        description: 'DeepSeek-V2.5 and Coder models',
      },
      {
        name: `${chalk.cyan('Mixtral')} - Mistral AI Cloud`,
        value: 'mixtral' as Provider,
        description: 'Mistral Large, Codestral, Mixtral MoE',
      },
      // Local/Offline mode
      {
        name: `${chalk.gray('Local/Offline')} - Ollama, LMStudio, vLLM`,
        value: 'local' as Provider,
        description: 'Run Qwen, DeepSeek, Mixtral locally (no API key)',
      },
    ],
    default: metaConfig.selectedProvider || 'qwen',
  });

  // Load provider-specific config for the selected provider
  const existingProviderConfig = loadProviderConfig(provider);

  // Run provider-specific setup
  let newConfig: AxCliConfig | null = null;

  if (provider === 'local') {
    newConfig = await runLocalSetup(existingProviderConfig);
  } else {
    // Generic cloud provider setup (Qwen, DeepSeek, Mixtral)
    newConfig = await runGenericCloudSetup(provider, existingProviderConfig);
  }

  if (!newConfig) {
    console.log(chalk.yellow('\n  Setup cancelled.\n'));
    return;
  }

  // Save config to ~/.ax-cli/config.json
  saveMetaConfig(provider);
  saveProviderConfig(provider, newConfig);
  console.log(chalk.green('\n  ✓ Configuration saved!\n'));

  // Show summary
  const isLocal = newConfig._isLocalServer;

  console.log(chalk.cyan('  ┌─────────────────────────────────────────┐'));
  console.log(chalk.cyan('  │          Configuration Summary          │'));
  console.log(chalk.cyan('  └─────────────────────────────────────────┘\n'));
  console.log(`  Provider:    ${newConfig._provider}`);
  console.log(`  Server:      ${isLocal ? newConfig.baseURL : 'Cloud API'}`);
  console.log(`  Model:       ${newConfig.defaultModel}`);
  console.log(`  Config:      ${getProviderConfigPath(provider)}`);
  console.log();

  // Show next steps
  console.log(chalk.cyan('\n  ┌─────────────────────────────────────────┐'));
  console.log(chalk.cyan('  │              Next Steps                 │'));
  console.log(chalk.cyan('  └─────────────────────────────────────────┘\n'));
  console.log(`  1. Run ${chalk.bold('ax-cli')} to start`);
  console.log(`  2. Run ${chalk.bold('ax-cli --help')} for all options`);

  if (isLocal) {
    console.log();
    console.log(chalk.dim('  Note: Make sure your local server is running before using ax-cli'));
  }

  console.log();
  console.log(chalk.green('  ✓ Setup complete! Happy coding!\n'));
}

/**
 * Get the selected provider from meta config
 */
export function getSelectedProvider(): Provider | null {
  const config = loadMetaConfig();
  return config.selectedProvider || null;
}
