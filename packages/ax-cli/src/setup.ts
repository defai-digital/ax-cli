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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync, spawnSync } from 'child_process';

// ax-cli is LOCAL/OFFLINE ONLY - no cloud providers
export type Provider = 'local';
export type ServerType = 'local';

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
// Note: For cloud DeepSeek, a future ax-deepseek package will be available
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
// PROVIDER CONFIGURATION - LOCAL/OFFLINE ONLY
// ═══════════════════════════════════════════════════════════════════

const PROVIDER_INFO: ProviderInfo = {
  name: 'Local/Offline (Ollama, LMStudio, vLLM)',
  description: 'Run models locally - Qwen 3 recommended (best offline coding model)',
  cliName: 'ax-cli',
  package: '@ax-cli/cli',
  defaultBaseURL: 'http://localhost:11434/v1',
  defaultModel: 'qwen3:14b',  // Tier 1: Best overall
  apiKeyEnvVar: '',  // No API key for local
  website: 'https://ollama.ai',
  models: ALL_LOCAL_MODELS,
};

// Well-known local server ports
const LOCAL_SERVERS = [
  { name: 'Ollama', url: 'http://localhost:11434/v1', port: 11434 },
  { name: 'LM Studio', url: 'http://localhost:1234/v1', port: 1234 },
  { name: 'vLLM', url: 'http://localhost:8000/v1', port: 8000 },
  { name: 'LocalAI', url: 'http://localhost:8080/v1', port: 8080 },
];

// Config paths
const AX_CLI_CONFIG_DIR = join(homedir(), '.ax-cli');
const AX_CLI_CONFIG_FILE = join(AX_CLI_CONFIG_DIR, 'config.json');

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
 * Load ax-cli config
 */
function loadConfig(): AxCliConfig {
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
 * Save ax-cli config
 */
function saveConfig(config: AxCliConfig): void {
  if (!existsSync(AX_CLI_CONFIG_DIR)) {
    mkdirSync(AX_CLI_CONFIG_DIR, { recursive: true });
  }
  writeFileSync(AX_CLI_CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
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
 * Run the setup wizard
 */
export async function runSetup(): Promise<void> {
  console.log(chalk.cyan('\n  ╔════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('  ║       Welcome to ax-cli Setup Wizard           ║'));
  console.log(chalk.cyan('  ║         LOCAL/OFFLINE AI Assistant             ║'));
  console.log(chalk.cyan('  ╚════════════════════════════════════════════════╝\n'));

  console.log('  ax-cli is designed for LOCAL/OFFLINE AI inference.');
  console.log('  Run AI models locally without sending data to the cloud.\n');

  console.log(chalk.dim('  For cloud providers, use dedicated CLIs:'));
  console.log(chalk.dim('  • GLM (Z.AI):     npm install -g @defai.digital/ax-glm'));
  console.log(chalk.dim('  • Grok (xAI):     npm install -g @defai.digital/ax-grok'));
  console.log(chalk.dim('  • DeepSeek:       (coming soon) @defai.digital/ax-deepseek\n'));

  // Load existing config
  const existingConfig = loadConfig();

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

    // Sort by tier priority (T1 Qwen first, then T2 GLM, etc.)
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
        default: PROVIDER_INFO.defaultModel,
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
      default: existingConfig.defaultModel || PROVIDER_INFO.defaultModel,
    });

    if (modelSelection === '__custom__') {
      selectedModel = await input({
        message: 'Enter model name:',
        default: PROVIDER_INFO.defaultModel,
      });
    } else {
      selectedModel = modelSelection;
    }

    availableModels = PROVIDER_INFO.models; // Fallback to predefined local models
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: Quick Setup Option
  // ═══════════════════════════════════════════════════════════════════
  console.log(chalk.bold.cyan('\n  Step 3/3 — Quick Setup\n'));

  const useDefaults = await confirm({
    message: 'Use default settings for everything else? (Recommended)',
    default: true,
  });

  if (useDefaults) {
    console.log(chalk.green('\n  ✓ Using default settings\n'));
  } else {
    // Only validate if user wants detailed setup
    const validateSpinner = ora('Validating local server connection...').start();
    const isValid = await checkLocalServer(selectedBaseURL);

    if (isValid) {
      validateSpinner.succeed('Local server connection validated!');
    } else {
      validateSpinner.warn('Server not responding (will save anyway)');
      console.log(chalk.dim('\n  Tip: Make sure your local server is running before using ax-cli'));
    }
  }

  // Save configuration
  const newConfig: AxCliConfig = {
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
    _provider: PROVIDER_INFO.name,
    _website: PROVIDER_INFO.website,
    _isLocalServer: true,
  };

  saveConfig(newConfig);
  console.log(chalk.green('\n  ✓ Configuration saved!\n'));

  // ═══════════════════════════════════════════════════════════════════
  // AutomatosX Integration (quick setup installs and configures by default)
  // ═══════════════════════════════════════════════════════════════════
  if (useDefaults) {
    // Quick setup - install AutomatosX and run ax setup -f by default
    let axStatus = getAutomatosXStatus();

    if (!axStatus.installed) {
      const installSpinner = ora('Installing AutomatosX for multi-agent AI orchestration...').start();

      const installed = await installAutomatosX();
      if (installed) {
        installSpinner.succeed('AutomatosX installed successfully!');
        axStatus = getAutomatosXStatus(); // Refresh status after install
      } else {
        installSpinner.stop();
        console.log(chalk.yellow('  Could not install AutomatosX'));
        console.log(chalk.dim('  Install manually later: npm install -g @defai.digital/automatosx'));
      }
    } else {
      console.log(chalk.green(`  ✓ AutomatosX detected${axStatus.version ? ` (v${axStatus.version})` : ''}`));
    }

    // Run ax setup -f to configure AutomatosX with defaults
    if (axStatus.installed) {
      const setupSpinner = ora('Configuring AutomatosX...').start();

      const setupSuccess = await runAutomatosXSetup();
      if (setupSuccess) {
        setupSpinner.succeed('AutomatosX configured successfully!');
      } else {
        setupSpinner.stop();
        console.log(chalk.yellow('  Could not configure AutomatosX'));
        console.log(chalk.dim('  Configure manually later: ax setup -f'));
      }
    }
  } else {
    // Detailed setup - just show info
    const axStatus = getAutomatosXStatus();
    if (axStatus.installed) {
      console.log(chalk.green(`  ✓ AutomatosX detected${axStatus.version ? ` (v${axStatus.version})` : ''}`));
    } else {
      console.log(chalk.dim('  AutomatosX not installed. Install later: npm install -g @defai.digital/automatosx'));
    }
  }

  // Show summary
  console.log(chalk.cyan('  ┌─────────────────────────────────────────┐'));
  console.log(chalk.cyan('  │          Configuration Summary          │'));
  console.log(chalk.cyan('  └─────────────────────────────────────────┘\n'));
  console.log(`  Provider:    ${newConfig._provider}`);
  console.log(`  Server:      ${newConfig.baseURL}`);
  console.log(`  Model:       ${newConfig.defaultModel}`);
  console.log(`  Config:      ${AX_CLI_CONFIG_FILE}`);
  console.log();

  // Show next steps
  console.log(chalk.cyan('\n  ┌─────────────────────────────────────────┐'));
  console.log(chalk.cyan('  │              Next Steps                 │'));
  console.log(chalk.cyan('  └─────────────────────────────────────────┘\n'));
  console.log(`  1. Run ${chalk.bold('ax-cli')} to start`);
  console.log(`  2. Run ${chalk.bold('ax-cli --help')} for all options`);
  console.log();
  console.log(chalk.dim('  Note: Make sure your local server is running before using ax-cli'));
  console.log();
  console.log(chalk.dim('  For cloud providers:'));
  console.log(chalk.dim('  • GLM (Z.AI):     ax-glm setup'));
  console.log(chalk.dim('  • Grok (xAI):     ax-grok setup'));
  console.log();
  console.log(chalk.green('  ✓ Setup complete! Happy coding!\n'));
}

/**
 * Get the selected provider from config
 */
export function getSelectedProvider(): Provider | null {
  const config = loadConfig();
  return config.selectedProvider || null;
}
