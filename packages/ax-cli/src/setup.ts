/**
 * Setup Flow - Provider Selection and Configuration
 *
 * This setup wizard:
 * 1. Lets user select a provider (Local or DeepSeek)
 * 2. For cloud providers: Configure API key and model
 * 3. For offline mode: Configure local server (Ollama/LMStudio/vLLM) with any supported model
 * 4. Saves configuration to ~/.ax-cli/
 *
 * Provider Distribution:
 * - ax-cli: Standalone CLI (local: Ollama/LMStudio/vLLM; cloud: DeepSeek)
 * - ax-glm: GLM-specific CLI with web search, vision, image generation (Z.AI Cloud)
 * - ax-grok: Grok-specific CLI with web search, vision, extended thinking (xAI Cloud)
 *
 * NOTE: ax-cli focuses on LOCAL/OFFLINE inference as primary use case.
 * For cloud-specific features, users should install ax-glm or ax-grok directly.
 */

import chalk from 'chalk';
import { select, confirm, password, input } from '@inquirer/prompts';
import ora from 'ora';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Note: GLM and Grok are NOT available in ax-cli - use ax-glm or ax-grok directly
// ax-cli focuses on local/offline inference with DeepSeek as the only cloud option
export type Provider = 'local' | 'deepseek';
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

// ═══════════════════════════════════════════════════════════════════
// 2025 OFFLINE CODING LLM RANKINGS (Updated December 2025)
// ═══════════════════════════════════════════════════════════════════
//
// Tier 1: Qwen 3 (32B/72B) - 9.6/10 - BEST OVERALL (PRIMARY)
//   - Multi-task consistency and stability still best
//   - Best for large codebase analysis (especially 32B+)
//   - Highest agentic tool integration (AX-CLI)
//   - Best Claude Code alternative for offline
//   → Recommended as PRIMARY model
//
// Tier 2: GLM-4.6 (9B/32B) - 9.4/10 - BEST REFACTOR + DOCS (MAJOR UPGRADE!)
//   - GLM-4.6-Coder coding significantly upgraded, cross-language excellent
//   - 9B performance rivals Qwen 14B / DeepSeek 16B
//   - Superior for large-scale refactor + documentation generation
//   - Beats DeepSeek Coder V2 on long context reasoning
//   - Best bilingual (Chinese + English) understanding
//   → Recommended as SECONDARY core model
//
// Tier 3: DeepSeek-Coder V2 (7B/16B) - 9.3/10 - BEST SPEED
//   - #1 inference speed
//   - Easiest edge deployment (Jetson/Mac)
//   - Best small model efficiency
//   - BUT: GLM-4.6 9B > DeepSeek 16B on large codebase reasoning
//   → Best for: quick patches, linting, small refactors
//
// Tier 4: Codestral/Mistral - 8.4/10 - C++/RUST NICHE
//   - Niche advantage in C++/Rust
//   - Overall capabilities superseded by Qwen/GLM/DeepSeek
//
// Tier 5: Llama 3.1/CodeLlama - 8.1/10 - FALLBACK
//   - Wide ecosystem, best framework support
//   - Stable and robust
//   - No longer leading in capability
// ═══════════════════════════════════════════════════════════════════

// TIER 1: Qwen 3 - Best overall offline coding model (9.6/10)
// → PRIMARY model for most coding tasks
const LOCAL_QWEN_MODELS: ModelInfo[] = [
  { id: 'qwen3:72b', name: 'Qwen 3 72B', description: 'PRIMARY: Most capable, 128K context' },
  { id: 'qwen3:32b', name: 'Qwen 3 32B', description: 'PRIMARY: Best for large codebase analysis' },
  { id: 'qwen3:14b', name: 'Qwen 3 14B', description: 'PRIMARY: Balanced performance (recommended)' },
  { id: 'qwen3:8b', name: 'Qwen 3 8B', description: 'PRIMARY: Efficient, great for most tasks' },
  { id: 'qwen2.5-coder:32b', name: 'Qwen2.5-Coder 32B', description: 'Excellent coding specialist' },
  { id: 'qwen2.5-coder:14b', name: 'Qwen2.5-Coder 14B', description: 'Balanced coding model' },
];

// TIER 2: GLM-4.6 - Best for refactor + docs (9.4/10) - MAJOR UPGRADE!
// → SECONDARY core model, excellent for architecture refactoring
// Note: For cloud GLM with web search/vision, use ax-glm
const LOCAL_GLM_MODELS: ModelInfo[] = [
  { id: 'glm-4.6:32b', name: 'GLM-4.6 32B', description: 'REFACTOR: Large-scale refactor + multi-file editing' },
  { id: 'glm-4.6:9b', name: 'GLM-4.6 9B', description: 'REFACTOR: Rivals Qwen 14B, excellent long context' },
  { id: 'codegeex4', name: 'CodeGeeX4', description: 'DOCS: Best for documentation generation' },
  { id: 'glm4:9b', name: 'GLM-4 9B', description: 'Bilingual code understanding' },
];

// TIER 3: DeepSeek-Coder V2 - Best speed (9.3/10)
// → Best for quick iterations, patches, linting
const LOCAL_DEEPSEEK_MODELS: ModelInfo[] = [
  { id: 'deepseek-coder-v2:16b', name: 'DeepSeek-Coder-V2 16B', description: 'SPEED: Fast iterations, patches' },
  { id: 'deepseek-coder-v2:7b', name: 'DeepSeek-Coder-V2 7B', description: 'SPEED: 7B rivals 13B, edge-friendly' },
  { id: 'deepseek-v3', name: 'DeepSeek V3', description: 'Latest general + coding model' },
  { id: 'deepseek-coder:33b', name: 'DeepSeek-Coder 33B', description: 'Strong coding model' },
  { id: 'deepseek-coder:6.7b', name: 'DeepSeek-Coder 6.7B', description: 'Efficient, low memory' },
];

// TIER 4: Codestral/Mistral - C++/Rust niche (8.4/10)
const LOCAL_CODESTRAL_MODELS: ModelInfo[] = [
  { id: 'codestral:22b', name: 'Codestral 22B', description: 'C++/RUST: Systems programming niche' },
  { id: 'mistral:7b', name: 'Mistral 7B', description: 'Good speed/accuracy balance' },
  { id: 'mistral-nemo:12b', name: 'Mistral Nemo 12B', description: 'Compact but capable' },
];

// TIER 5: Llama - Best fallback/compatibility (8.1/10)
const LOCAL_LLAMA_MODELS: ModelInfo[] = [
  { id: 'llama3.1:70b', name: 'Llama 3.1 70B', description: 'FALLBACK: Best framework compatibility' },
  { id: 'llama3.1:8b', name: 'Llama 3.1 8B', description: 'FALLBACK: Fast, stable' },
  { id: 'llama3.2:11b', name: 'Llama 3.2 11B', description: 'Vision support' },
  { id: 'codellama:34b', name: 'Code Llama 34B', description: 'Code specialist' },
  { id: 'codellama:7b', name: 'Code Llama 7B', description: 'Efficient code model' },
];

// All local models combined for offline setup (ordered by tier)
const ALL_LOCAL_MODELS: ModelInfo[] = [
  // Tier 1: Qwen (PRIMARY - recommended for most coding tasks)
  ...LOCAL_QWEN_MODELS.map(m => ({ ...m, name: `[T1-Qwen] ${m.name}` })),
  // Tier 2: GLM-4.6 (REFACTOR - best for large-scale refactoring + docs)
  ...LOCAL_GLM_MODELS.map(m => ({ ...m, name: `[T2-GLM] ${m.name}` })),
  // Tier 3: DeepSeek (SPEED - best for quick iterations)
  ...LOCAL_DEEPSEEK_MODELS.map(m => ({ ...m, name: `[T3-DeepSeek] ${m.name}` })),
  // Tier 4: Codestral (C++/RUST - systems programming)
  ...LOCAL_CODESTRAL_MODELS.map(m => ({ ...m, name: `[T4-Codestral] ${m.name}` })),
  // Tier 5: Llama (FALLBACK - compatibility)
  ...LOCAL_LLAMA_MODELS.map(m => ({ ...m, name: `[T5-Llama] ${m.name}` })),
];

// ═══════════════════════════════════════════════════════════════════
// CLOUD MODELS - DeepSeek (only cloud provider in ax-cli)
// ═══════════════════════════════════════════════════════════════════

const DEEPSEEK_CLOUD_MODELS: ModelInfo[] = [
  { id: 'deepseek-chat', name: 'DeepSeek-Chat', description: 'Latest chat model with 64K context' },
  { id: 'deepseek-coder', name: 'DeepSeek-Coder', description: 'Optimized for code generation' },
  { id: 'deepseek-reasoner', name: 'DeepSeek-Reasoner', description: 'Enhanced reasoning capabilities' },
];

// ═══════════════════════════════════════════════════════════════════
// PROVIDER CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════

// Note: GLM and Grok are NOT available in ax-cli
// For GLM features (web search, vision, image), use: npm install -g @defai.digital/ax-glm
// For Grok features (web search, vision, thinking), use: npm install -g @defai.digital/ax-grok

const PROVIDERS: Record<Provider, ProviderInfo> = {
  // LOCAL/OFFLINE - Primary focus of ax-cli
  local: {
    name: 'Local/Offline (Ollama, LMStudio, vLLM)',
    description: 'Run models locally - Qwen 3 recommended (best offline coding model)',
    cliName: 'ax-cli',
    package: '@defai.digital/ax-cli',
    defaultBaseURL: 'http://localhost:11434/v1',
    defaultModel: 'qwen3:14b',  // Tier 1: Best overall
    apiKeyEnvVar: '',
    website: 'https://ollama.ai',
    models: ALL_LOCAL_MODELS,
  },
  // DEEPSEEK CLOUD - Only cloud provider in ax-cli
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
  local: join(homedir(), '.ax-cli'),
  deepseek: join(homedir(), '.ax-cli'),
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
 * Run DeepSeek Cloud Provider setup
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

  // Check for existing key - display redacted preview only
  if (existingKey && isSameProvider) {
    // Create a redacted preview for display (e.g., "sk-abcd...wxyz")
    const redactedPreview = existingKey.length > 12
      ? `${existingKey.substring(0, 8)}...${existingKey.substring(existingKey.length - 4)}`
      : `${existingKey.substring(0, 4)}...`;

    console.log(`  Existing API key found: ${chalk.dim(redactedPreview)}\n`);

    const reuseKey = await confirm({
      message: 'Use existing API key?',
      default: true,
    });

    if (reuseKey) {
      apiKey = existingKey;
    }
  } else if (envKey) {
    // Display environment variable name only, not the value
    const envVarName = providerInfo.apiKeyEnvVar;
    console.log(`  Found ${envVarName} in environment\n`);
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

  console.log('  Run AI models locally without an API key.\n');
  console.log(chalk.bold('  2025 Offline Coding LLM Rankings (Updated Dec 2025):'));
  console.log(chalk.green('    T1 Qwen 3') + chalk.dim(' (9.6/10)') + ' - PRIMARY: Best overall, coding leader');
  console.log(chalk.magenta('    T2 GLM-4.6') + chalk.dim(' (9.4/10)') + ' - REFACTOR: Large-scale refactor + docs ' + chalk.yellow('★NEW'));
  console.log(chalk.blue('    T3 DeepSeek') + chalk.dim(' (9.3/10)') + ' - SPEED: Quick patches, linting');
  console.log(chalk.cyan('    T4 Codestral') + chalk.dim(' (8.4/10)') + ' - C++/RUST: Systems programming');
  console.log(chalk.gray('    T5 Llama') + chalk.dim(' (8.1/10)') + ' - FALLBACK: Best compatibility\n');

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

    // Categorize models by tier (2025 rankings - Updated Dec 2025)
    const categorizeModel = (id: string): { tier: string; label: string } => {
      const lower = id.toLowerCase();
      // Tier 1: Qwen (9.6/10) - Best overall, PRIMARY
      if (lower.includes('qwen')) return { tier: 'T1', label: 'T1-Qwen' };
      // Tier 2: GLM-4.6 (9.4/10) - Best refactor + docs (UPGRADED!)
      if (lower.includes('glm') || lower.includes('codegeex') || lower.includes('chatglm')) return { tier: 'T2', label: 'T2-GLM' };
      // Tier 3: DeepSeek (9.3/10) - Best speed
      if (lower.includes('deepseek')) return { tier: 'T3', label: 'T3-DeepSeek' };
      // Tier 4: Codestral/Mistral (8.4/10) - C/C++/Rust
      if (lower.includes('codestral') || lower.includes('mistral')) return { tier: 'T4', label: 'T4-Codestral' };
      // Tier 5: Llama (8.1/10) - Fallback
      if (lower.includes('llama') || lower.includes('codellama')) return { tier: 'T5', label: 'T5-Llama' };
      return { tier: 'T6', label: 'Other' };
    };

    // Sort by tier priority (T1 Qwen first, then T2 DeepSeek, etc.)
    const tierOrder = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
    const sortedModels = [...availableModels].sort((a, b) => {
      const catA = tierOrder.indexOf(categorizeModel(a.id).tier);
      const catB = tierOrder.indexOf(categorizeModel(b.id).tier);
      return catA - catB;
    });

    const modelChoices = [
      ...sortedModels.map(m => {
        const { label } = categorizeModel(m.id);
        const prefix = label !== 'Other' ? `[${label}] ` : '';
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
    console.log('  Recommended models by tier (Updated Dec 2025):\n');
    console.log(chalk.bold.green('  T1 Qwen 3 (9.6/10) - PRIMARY:'));
    LOCAL_QWEN_MODELS.slice(0, 3).forEach(m => {
      console.log(`    ${chalk.green('•')} ${m.id}: ${chalk.dim(m.description)}`);
    });
    console.log(chalk.bold.magenta('\n  T2 GLM-4.6 (9.4/10) - REFACTOR + DOCS ★NEW:'));
    LOCAL_GLM_MODELS.slice(0, 3).forEach(m => {
      console.log(`    ${chalk.magenta('•')} ${m.id}: ${chalk.dim(m.description)}`);
    });
    console.log(chalk.bold.blue('\n  T3 DeepSeek (9.3/10) - SPEED:'));
    LOCAL_DEEPSEEK_MODELS.slice(0, 2).forEach(m => {
      console.log(`    ${chalk.blue('•')} ${m.id}: ${chalk.dim(m.description)}`);
    });
    console.log(chalk.bold.gray('\n  T5 Llama (8.1/10) - FALLBACK:'));
    LOCAL_LLAMA_MODELS.slice(0, 2).forEach(m => {
      console.log(`    ${chalk.gray('•')} ${m.id}: ${chalk.dim(m.description)}`);
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
      // Local/Offline - Primary focus of ax-cli
      {
        name: `${chalk.green('Local/Offline')} - Ollama, LMStudio, vLLM ${chalk.dim('(Recommended)')}`,
        value: 'local' as Provider,
        description: 'Run Qwen, DeepSeek, Llama locally (no API key)',
      },
      // DeepSeek Cloud - Only cloud provider
      {
        name: `${chalk.magenta('DeepSeek')} - DeepSeek Cloud`,
        value: 'deepseek' as Provider,
        description: 'DeepSeek-V2.5, Coder, and Reasoner models',
      },
    ],
    default: metaConfig.selectedProvider || 'local',
  });

  // Load provider-specific config for the selected provider
  const existingProviderConfig = loadProviderConfig(provider);

  // Run provider-specific setup
  let newConfig: AxCliConfig | null = null;

  if (provider === 'local') {
    newConfig = await runLocalSetup(existingProviderConfig);
  } else {
    // DeepSeek cloud setup
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
