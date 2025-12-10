/**
 * Provider Configuration System
 *
 * Defines provider-specific configurations for GLM, Grok, and other providers.
 * Each provider has its own defaults, model configs, and feature flags.
 */

/**
 * Model configuration for a specific model
 */
export interface ProviderModelConfig {
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsThinking: boolean;
  supportsVision: boolean;
  supportsSearch: boolean;
  supportsSeed: boolean;
  defaultTemperature: number;
  description: string;
}

/**
 * Provider feature flags
 */
export interface ProviderFeatures {
  supportsThinking: boolean;
  supportsVision: boolean;
  supportsSearch: boolean;
  supportsSeed: boolean;
  supportsDoSample: boolean;
  /**
   * How thinking mode is activated:
   * - 'thinking_mode': GLM style - uses thinking_mode parameter
   * - 'reasoning_effort': Grok 3 style - uses reasoning_effort parameter (low/high)
   */
  thinkingModeStyle?: 'thinking_mode' | 'reasoning_effort';
}

/**
 * Provider definition - full configuration for a provider
 * (Different from ProviderConfig which is API key config)
 */
export interface ProviderDefinition {
  /** Provider identifier (e.g., 'glm', 'grok') */
  name: string;
  /** Display name for UI (e.g., 'GLM (Z.AI)') */
  displayName: string;
  /** Environment variable for API key */
  apiKeyEnvVar: string;
  /** Alternative env vars for API key (fallbacks) */
  apiKeyEnvVarAliases?: string[];
  /** Default API base URL */
  defaultBaseURL: string;
  /** Default model (primary LLM for coding tasks) */
  defaultModel: string;
  /** Default vision model (for image analysis, if supported) */
  defaultVisionModel?: string;
  /** Supported models */
  models: Record<string, ProviderModelConfig>;
  /** Provider feature flags */
  features: ProviderFeatures;
  /** CLI branding */
  branding: {
    cliName: string;
    description: string;
    welcomeMessage: string;
    /** Primary color for UI elements (Ink color name) */
    primaryColor: string;
    /** Secondary/accent color */
    secondaryColor: string;
    /** ASCII art logo for welcome screen */
    asciiLogo: string;
    /** Short tagline */
    tagline: string;
  };
  /** Configuration directory name (e.g., '.ax-glm', '.ax-grok') */
  configDirName: string;
}

/**
 * GLM Provider Definition (Z.AI)
 */
export const GLM_PROVIDER: ProviderDefinition = {
  name: 'glm',
  displayName: 'GLM (Z.AI)',
  apiKeyEnvVar: 'ZAI_API_KEY',
  apiKeyEnvVarAliases: ['GLM_API_KEY', 'YOUR_API_KEY'],
  defaultBaseURL: 'https://api.z.ai/api/coding/paas/v4',
  defaultModel: 'glm-4.6',
  defaultVisionModel: 'glm-4.6v',
  configDirName: '.ax-glm',
  models: {
    'glm-4.6': {
      name: 'GLM-4.6',
      contextWindow: 200000,
      maxOutputTokens: 128000,
      supportsThinking: true,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Most capable GLM model with thinking mode support',
    },
    // Vision models - selected separately in setup (Step 2)
    'glm-4.6v': {
      name: 'GLM-4.6V',
      contextWindow: 128000,
      maxOutputTokens: 128000,
      supportsThinking: true,
      supportsVision: true,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Latest vision model with 128K context and thinking mode',
    },
    'glm-4.5v': {
      name: 'GLM-4.5V',
      contextWindow: 64000,
      maxOutputTokens: 16000,
      supportsThinking: true,
      supportsVision: true,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Vision model with 64K context (legacy)',
    },
    'glm-4': {
      name: 'GLM-4',
      contextWindow: 128000,
      maxOutputTokens: 8000,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Standard GLM-4 model',
    },
    'glm-4-flash': {
      name: 'GLM-4 Flash',
      contextWindow: 128000,
      maxOutputTokens: 4000,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Fast, efficient GLM model for quick tasks',
    },
    // Image generation model
    'cogview-4': {
      name: 'CogView-4',
      contextWindow: 4096,
      maxOutputTokens: 1024,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Text-to-image generation model with variable resolutions',
    },
  },
  features: {
    supportsThinking: true,
    supportsVision: true, // Via separate visionModel config (glm-4.6v default)
    supportsSearch: false,
    supportsSeed: false,
    supportsDoSample: true,
    thinkingModeStyle: 'thinking_mode',
  },
  branding: {
    cliName: 'ax-glm',
    description: 'GLM-optimized AI coding assistant powered by Z.AI',
    welcomeMessage: '🔥 Starting AX-GLM AI Assistant (powered by Z.AI)...',
    primaryColor: '#FF6600',
    secondaryColor: '#FF3300',
    tagline: 'Powered by Z.AI',
    asciiLogo: `
   █████╗ ██╗  ██╗     ██████╗ ██╗     ███╗   ███╗
  ██╔══██╗╚██╗██╔╝    ██╔════╝ ██║     ████╗ ████║
  ███████║ ╚███╔╝     ██║  ███╗██║     ██╔████╔██║
  ██╔══██║ ██╔██╗     ██║   ██║██║     ██║╚██╔╝██║
  ██║  ██║██╔╝ ██╗    ╚██████╔╝███████╗██║ ╚═╝ ██║
  ╚═╝  ╚═╝╚═╝  ╚═╝     ╚═════╝ ╚══════╝╚═╝     ╚═╝`,
  },
};

/**
 * Grok Provider Definition (xAI)
 */
export const GROK_PROVIDER: ProviderDefinition = {
  name: 'grok',
  displayName: 'Grok (xAI)',
  apiKeyEnvVar: 'XAI_API_KEY',
  apiKeyEnvVarAliases: ['GROK_API_KEY'],
  defaultBaseURL: 'https://api.x.ai/v1',
  defaultModel: 'grok-4-0709',
  // NOTE: Grok-4 has built-in vision, thinking, and search - no separate vision model needed
  configDirName: '.ax-grok',
  models: {
    // Grok 4 - Latest generation with ALL capabilities built-in
    // Vision, thinking (reasoning_effort), web search, seed support
    'grok-4-0709': {
      name: 'Grok-4',
      contextWindow: 131072,
      maxOutputTokens: 131072,
      supportsThinking: true,
      supportsVision: true,
      supportsSearch: true,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Most capable: reasoning, coding, vision, search (default)',
    },
    'grok-4.1-fast': {
      name: 'Grok-4.1 Fast',
      contextWindow: 131072,
      maxOutputTokens: 131072,
      supportsThinking: true,
      supportsVision: true,
      supportsSearch: true,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Fast variant with agent tools support',
    },
    // Image generation model
    'grok-2-image-1212': {
      name: 'Grok-2 Image',
      contextWindow: 32768,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Text-to-image generation model',
    },
    // NOTE: Legacy models (grok-3, grok-2, grok-beta) removed
    // Grok-4 supersedes all previous models with better capabilities
  },
  features: {
    supportsThinking: true, // Grok-4 reasoning_effort (low/high)
    supportsVision: true,   // Grok-4 has built-in vision
    supportsSearch: true,   // Grok-4 has built-in web search
    supportsSeed: true,
    supportsDoSample: false,
    thinkingModeStyle: 'reasoning_effort',
  },
  branding: {
    cliName: 'ax-grok',
    description: 'Grok-optimized AI coding assistant powered by xAI',
    welcomeMessage: '⚡ Starting AX-Grok AI Assistant (powered by xAI)...',
    primaryColor: '#C0C0C0',
    secondaryColor: 'gray',
    tagline: 'Powered by xAI',
    asciiLogo: `
   █████╗ ██╗  ██╗     ██████╗ ██████╗  ██████╗ ██╗  ██╗
  ██╔══██╗╚██╗██╔╝    ██╔════╝ ██╔══██╗██╔═══██╗██║ ██╔╝
  ███████║ ╚███╔╝     ██║  ███╗██████╔╝██║   ██║█████╔╝
  ██╔══██║ ██╔██╗     ██║   ██║██╔══██╗██║   ██║██╔═██╗
  ██║  ██║██╔╝ ██╗    ╚██████╔╝██║  ██║╚██████╔╝██║  ██╗
  ╚═╝  ╚═╝╚═╝  ╚═╝     ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝`,
  },
};

/**
 * AX CLI Provider Definition
 *
 * AX-CLI focuses on LOCAL/OFFLINE inference as primary use case:
 * - Ollama (primary)
 * - LMStudio
 * - vLLM
 * - DeepSeek Cloud (only cloud provider)
 *
 * 2025 Offline Coding LLM Rankings:
 * - T1: Qwen 3 (9.6/10) - Best overall, coding leader
 * - T2: GLM-4.6 (9.4/10) - Best for refactor + docs (9B rivals Qwen 14B!)
 * - T3: DeepSeek-Coder V2 (9.3/10) - Best speed/value
 * - T4: Codestral/Mistral (8.4/10) - Good for C/C++/Rust
 * - T5: Llama (8.1/10) - Best fallback/compatibility
 *
 * For GLM-specific features, use ax-glm.
 * For Grok-specific features, use ax-grok.
 */
export const AX_CLI_PROVIDER: ProviderDefinition = {
  name: 'ax-cli',
  displayName: 'AX CLI',
  apiKeyEnvVar: 'AX_API_KEY',
  apiKeyEnvVarAliases: ['AXCLI_API_KEY'],  // Keep provider-agnostic (no DEEPSEEK binding for future ax-deepseek)
  defaultBaseURL: 'http://localhost:11434/v1', // Default to Ollama (local)
  defaultModel: 'qwen3:14b',  // Tier 1: Best overall
  configDirName: '.ax-cli',
  models: {
    // ═══════════════════════════════════════════════════════════════════
    // TIER 1: QWEN 3 (9.6/10) - Best Overall Offline Coding Model
    // ═══════════════════════════════════════════════════════════════════
    'qwen3:72b': {
      name: 'Qwen 3 72B',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'T1 BEST: Most capable, 128K context',
    },
    'qwen3:32b': {
      name: 'Qwen 3 32B',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'T1 BEST: High-quality coding, 128K context',
    },
    'qwen3:14b': {
      name: 'Qwen 3 14B',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'T1 BEST: Balanced performance (recommended)',
    },
    'qwen3:8b': {
      name: 'Qwen 3 8B',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'T1 BEST: Efficient, great for most tasks',
    },
    'qwen2.5-coder:32b': {
      name: 'Qwen2.5-Coder 32B',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Excellent coding specialist, 128K context',
    },
    // ═══════════════════════════════════════════════════════════════════
    // TIER 2: GLM-4.6 (9.4/10) - Best for Refactor + Docs ★NEW
    // GLM-4.6 9B rivals Qwen 14B / DeepSeek 16B in quality
    // Better than DeepSeek on long context reasoning
    // ═══════════════════════════════════════════════════════════════════
    'glm-4.6:32b': {
      name: 'GLM-4.6 32B',
      contextWindow: 200000,
      maxOutputTokens: 32000,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'T2 REFACTOR: Large-scale refactor + multi-file editing',
    },
    'glm-4.6:9b': {
      name: 'GLM-4.6 9B',
      contextWindow: 200000,
      maxOutputTokens: 32000,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'T2 REFACTOR: Rivals Qwen 14B, excellent long context',
    },
    'codegeex4': {
      name: 'CodeGeeX4',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'T2 DOCS: Best for documentation generation',
    },
    'glm4:9b': {
      name: 'GLM-4 9B',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'T2: Bilingual code understanding',
    },
    // ═══════════════════════════════════════════════════════════════════
    // TIER 3: DEEPSEEK-CODER V2 (9.3/10) - Best Speed/Value
    // ═══════════════════════════════════════════════════════════════════
    'deepseek-coder-v2:16b': {
      name: 'DeepSeek-Coder-V2 16B',
      contextWindow: 64000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'T3 FAST: Best speed/quality ratio',
    },
    'deepseek-coder-v2:7b': {
      name: 'DeepSeek-Coder-V2 7B',
      contextWindow: 64000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'T3 FAST: 7B performs like 13B, edge-friendly',
    },
    // ═══════════════════════════════════════════════════════════════════
    // TIER 4: CODESTRAL/MISTRAL (8.4/10) - C/C++/Rust
    // ═══════════════════════════════════════════════════════════════════
    'codestral:22b': {
      name: 'Codestral 22B',
      contextWindow: 32000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'T4: Strong in C/C++/Rust',
    },
    // ═══════════════════════════════════════════════════════════════════
    // TIER 5: LLAMA (8.1/10) - Best Fallback/Compatibility
    // ═══════════════════════════════════════════════════════════════════
    'llama3.1:70b': {
      name: 'Llama 3.1 70B',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'T5 FALLBACK: Best compatibility',
    },
    'llama3.1:8b': {
      name: 'Llama 3.1 8B',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'T5 FALLBACK: Fast, stable',
    },
    'codellama:34b': {
      name: 'Code Llama 34B',
      contextWindow: 16000,
      maxOutputTokens: 4096,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Optimized for code generation',
    },
    // ═══════════════════════════════════════════════════════════════════
    // NOTE: DeepSeek Cloud models removed from ax-cli
    // ax-cli is LOCAL/OFFLINE FIRST - cloud providers should use dedicated CLIs:
    // - ax-glm for Z.AI GLM models
    // - ax-grok for xAI Grok models
    // - ax-deepseek (future) for DeepSeek cloud models
    // ═══════════════════════════════════════════════════════════════════
  },
  features: {
    supportsThinking: false,  // No extended thinking in base CLI
    supportsVision: false,    // No vision - use ax-glm or ax-grok
    supportsSearch: false,    // No web search - use ax-glm or ax-grok
    supportsSeed: false,      // No seed support
    supportsDoSample: false,  // No doSample
    thinkingModeStyle: undefined,
  },
  branding: {
    cliName: 'ax-cli',
    description: 'Local-First AI Command Line Interface',
    welcomeMessage: '💎 Starting AX-CLI AI Assistant (Local/Offline)...',
    primaryColor: 'green',
    secondaryColor: 'blue',
    tagline: 'Local AI Coding Assistant',
    asciiLogo: `
   █████╗ ██╗  ██╗      ██████╗██╗     ██╗
  ██╔══██╗╚██╗██╔╝     ██╔════╝██║     ██║
  ███████║ ╚███╔╝█████╗██║     ██║     ██║
  ██╔══██║ ██╔██╗╚════╝██║     ██║     ██║
  ██║  ██║██╔╝ ██╗     ╚██████╗███████╗██║
  ╚═╝  ╚═╝╚═╝  ╚═╝      ╚═════╝╚══════╝╚═╝`,
  },
};

/**
 * Default provider (AX CLI)
 */
export const DEFAULT_PROVIDER = AX_CLI_PROVIDER;

/**
 * Get provider definition by name
 */
export function getProviderDefinition(name: string): ProviderDefinition | undefined {
  const providers: Record<string, ProviderDefinition> = {
    'ax-cli': AX_CLI_PROVIDER,
    glm: GLM_PROVIDER,
    grok: GROK_PROVIDER,
  };
  return providers[name.toLowerCase()];
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): ProviderDefinition[] {
  return [AX_CLI_PROVIDER, GLM_PROVIDER, GROK_PROVIDER];
}

/**
 * Get model config from provider
 */
export function getProviderModelConfig(
  provider: ProviderDefinition,
  modelName: string
): ProviderModelConfig | undefined {
  return provider.models[modelName];
}

/**
 * Get API key from environment for a provider
 */
export function getApiKeyFromEnv(provider: ProviderDefinition): string | undefined {
  // Check primary env var
  let apiKey = process.env[provider.apiKeyEnvVar];

  // Check aliases
  if (!apiKey && provider.apiKeyEnvVarAliases) {
    for (const alias of provider.apiKeyEnvVarAliases) {
      apiKey = process.env[alias];
      if (apiKey) break;
    }
  }

  return apiKey;
}

import { homedir } from 'os';
import { join } from 'path';

/**
 * File names for config files
 */
export const CONFIG_FILE_NAMES = {
  USER_CONFIG: 'config.json',
  PROJECT_SETTINGS: 'settings.json',
  CUSTOM_MD: 'CUSTOM.md',
  AX_MD: 'AX.md',
  INDEX_JSON: 'index.json',
  MEMORY_JSON: 'memory.json',
  HISTORY_JSON: 'history.json',
  SESSIONS_DIR: 'sessions',
  TEMPLATES_DIR: 'templates',
  PLANS_DIR: 'plans',
  BACKUPS_DIR: 'backups',
  CACHE_DIR: 'cache',
} as const;

/**
 * Config paths structure for a provider
 */
export interface ProviderConfigPaths {
  /** Configuration directory name */
  DIR_NAME: string;
  /** User-level settings directory */
  USER_DIR: string;
  /** User-level configuration file */
  USER_CONFIG: string;
  /** Project-level settings directory */
  PROJECT_DIR: string;
  /** Project-level settings file */
  PROJECT_SETTINGS: string;
  /** Custom instructions file path (project-level) */
  CUSTOM_MD: string;
  /** Root project context file path (like CLAUDE.md) */
  AX_MD: string;
  /** Project index file path (project-level) */
  INDEX_JSON: string;
  /** Project memory file path (project-level) */
  MEMORY_JSON: string;
  /** User templates directory */
  USER_TEMPLATES_DIR: string;
  /** User plans directory */
  USER_PLANS_DIR: string;
  /** User history file */
  USER_HISTORY: string;
  /** User sessions directory */
  USER_SESSIONS_DIR: string;
}

/**
 * Get config paths for a specific provider
 */
export function getProviderConfigPaths(provider: ProviderDefinition): ProviderConfigPaths {
  const configDirName = provider.configDirName;

  return {
    DIR_NAME: configDirName,
    USER_DIR: join(homedir(), configDirName),
    USER_CONFIG: join(homedir(), configDirName, CONFIG_FILE_NAMES.USER_CONFIG),
    PROJECT_DIR: join(process.cwd(), configDirName),
    PROJECT_SETTINGS: join(process.cwd(), configDirName, CONFIG_FILE_NAMES.PROJECT_SETTINGS),
    CUSTOM_MD: join(process.cwd(), configDirName, CONFIG_FILE_NAMES.CUSTOM_MD),
    AX_MD: join(process.cwd(), CONFIG_FILE_NAMES.AX_MD),
    INDEX_JSON: join(process.cwd(), configDirName, CONFIG_FILE_NAMES.INDEX_JSON),
    MEMORY_JSON: join(process.cwd(), configDirName, CONFIG_FILE_NAMES.MEMORY_JSON),
    USER_TEMPLATES_DIR: join(homedir(), configDirName, CONFIG_FILE_NAMES.TEMPLATES_DIR),
    USER_PLANS_DIR: join(homedir(), configDirName, CONFIG_FILE_NAMES.PLANS_DIR),
    USER_HISTORY: join(homedir(), configDirName, CONFIG_FILE_NAMES.HISTORY_JSON),
    USER_SESSIONS_DIR: join(homedir(), configDirName, CONFIG_FILE_NAMES.SESSIONS_DIR),
  };
}

/**
 * Get config paths for a provider by name
 */
export function getConfigPathsByProviderName(providerName: string): ProviderConfigPaths | undefined {
  const provider = getProviderDefinition(providerName);
  if (!provider) return undefined;
  return getProviderConfigPaths(provider);
}

// Current active provider (set by cli-factory)
let activeProvider: ProviderDefinition | null = null;

// Cache the priority registry update function to avoid repeated dynamic imports
let _updatePriorityRegistryProvider: ((provider: ProviderDefinition) => void) | null = null;

/**
 * Set the active provider (called by cli-factory on startup)
 * Also updates the priority registry to use the correct provider
 *
 * NOTE: We only cache activeProvider, not config paths.
 * getActiveConfigPaths() computes paths dynamically to handle cwd changes.
 */
export function setActiveProviderConfigPaths(provider: ProviderDefinition): void {
  activeProvider = provider;

  // Update priority registry with the new provider synchronously if available
  // This avoids the race condition where getPriorityRegistry() is called before the update
  if (_updatePriorityRegistryProvider) {
    _updatePriorityRegistryProvider(provider);
  } else {
    // First call - load the module and cache the function
    // Use synchronous require-style import pattern for reliability
    import('../tools/priority-registry.js').then(({ updatePriorityRegistryProvider }) => {
      _updatePriorityRegistryProvider = updatePriorityRegistryProvider;
      updatePriorityRegistryProvider(provider);
    }).catch(() => {
      // Silent fail - priority registry not critical for startup
    });
  }
}

/**
 * Initialize the priority registry synchronously
 * Call this early in the startup sequence to ensure the registry is ready
 */
export async function initializePriorityRegistry(): Promise<void> {
  if (!_updatePriorityRegistryProvider) {
    try {
      const { updatePriorityRegistryProvider } = await import('../tools/priority-registry.js');
      _updatePriorityRegistryProvider = updatePriorityRegistryProvider;
      if (activeProvider) {
        updatePriorityRegistryProvider(activeProvider);
      }
    } catch {
      // Silent fail
    }
  }
}

/**
 * Get the active provider definition
 * Falls back to GLM provider if not set
 */
export function getActiveProvider(): ProviderDefinition {
  return activeProvider || GLM_PROVIDER;
}

/**
 * Get the active provider config paths
 * Falls back to GLM provider if not set
 *
 * IMPORTANT: Always computes paths dynamically to handle cwd changes.
 * PROJECT_* paths depend on process.cwd(), so caching would cause stale paths
 * if the working directory changes during the session.
 */
export function getActiveConfigPaths(): ProviderConfigPaths {
  // Always compute dynamically - PROJECT_* paths use process.cwd()
  // which can change during the session (e.g., if a tool changes directory)
  const provider = activeProvider || GLM_PROVIDER;
  return getProviderConfigPaths(provider);
}

/**
 * Model aliases for convenient model selection
 * Maps friendly names to actual model identifiers
 */
export const MODEL_ALIASES: Record<string, string> = {
  // GLM aliases
  'glm-latest': 'glm-4.6',
  'glm-fast': 'glm-4-flash',
  'glm-vision': 'glm-4.6v',
  'glm-image': 'cogview-4',
  // Grok aliases (simplified - Grok-4 has all capabilities built-in)
  'grok-latest': 'grok-4-0709',
  'grok-fast': 'grok-4.1-fast',
  'grok-image': 'grok-2-image-1212',
  // NOTE: 'grok-vision' and 'grok-mini' removed - Grok-4 has built-in vision
};

/**
 * Resolve a model name, handling aliases
 * Returns the actual model name if alias exists, otherwise returns input unchanged
 *
 * @param modelName - Model name or alias
 * @returns Resolved model name
 *
 * @example
 * resolveModelAlias('grok-latest')  // Returns 'grok-4-0709'
 * resolveModelAlias('glm-4.6')      // Returns 'glm-4.6' (unchanged)
 */
export function resolveModelAlias(modelName: string): string {
  return MODEL_ALIASES[modelName.toLowerCase()] || modelName;
}

/**
 * Get all model aliases for a provider
 *
 * @param provider - Provider definition
 * @returns Array of alias entries { alias, model, description }
 */
export function getProviderModelAliases(
  provider: ProviderDefinition
): Array<{ alias: string; model: string; description: string }> {
  const prefix = provider.name.toLowerCase();
  const aliases: Array<{ alias: string; model: string; description: string }> = [];

  for (const [alias, model] of Object.entries(MODEL_ALIASES)) {
    if (alias.startsWith(prefix + '-')) {
      const modelConfig = provider.models[model];
      if (modelConfig) {
        aliases.push({
          alias,
          model,
          description: modelConfig.description,
        });
      }
    }
  }

  return aliases;
}

/**
 * Check if a model name is an alias
 */
export function isModelAlias(modelName: string): boolean {
  return modelName.toLowerCase() in MODEL_ALIASES;
}

/**
 * Get list of all available models for a provider (including aliases)
 * Useful for CLI model selection and validation
 *
 * @param provider - Provider definition
 * @returns Array of model entries with name, alias (if any), and description
 */
export function getAvailableModelsWithAliases(
  provider: ProviderDefinition
): Array<{ model: string; alias?: string; description: string; isDefault: boolean }> {
  const result: Array<{ model: string; alias?: string; description: string; isDefault: boolean }> = [];

  // Build reverse lookup for aliases
  const aliasLookup: Record<string, string> = {};
  for (const [alias, model] of Object.entries(MODEL_ALIASES)) {
    if (alias.startsWith(provider.name.toLowerCase() + '-')) {
      aliasLookup[model] = alias;
    }
  }

  // Add all models
  for (const [modelId, config] of Object.entries(provider.models)) {
    result.push({
      model: modelId,
      alias: aliasLookup[modelId],
      description: config.description,
      isDefault: modelId === provider.defaultModel,
    });
  }

  return result;
}
