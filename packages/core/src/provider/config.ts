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
  /** Default model */
  defaultModel: string;
  /** Supported models */
  models: Record<string, ProviderModelConfig>;
  /** Provider feature flags */
  features: ProviderFeatures;
  /** CLI branding */
  branding: {
    cliName: string;
    description: string;
    welcomeMessage: string;
  };
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
    'glm-4.5v': {
      name: 'GLM-4.5V',
      contextWindow: 64000,
      maxOutputTokens: 16000,
      supportsThinking: true,
      supportsVision: true,
      supportsSearch: false,
      supportsSeed: false,
      defaultTemperature: 0.7,
      description: 'Vision-capable GLM model',
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
  },
  features: {
    supportsThinking: true,
    supportsVision: true, // via glm-4.5v
    supportsSearch: false,
    supportsSeed: false,
    supportsDoSample: true,
    thinkingModeStyle: 'thinking_mode',
  },
  branding: {
    cliName: 'ax-glm',
    description: 'GLM-optimized AI coding assistant powered by Z.AI',
    welcomeMessage: '🤖 Starting AX-GLM AI Assistant (powered by Z.AI)...',
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
  defaultModel: 'grok-3',
  models: {
    // Grok 3 models with thinking mode (reasoning_effort)
    'grok-3': {
      name: 'Grok-3',
      contextWindow: 131072,
      maxOutputTokens: 131072,
      supportsThinking: true,
      supportsVision: false,
      supportsSearch: true,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Most capable Grok model with extended thinking via reasoning_effort',
    },
    'grok-3-mini': {
      name: 'Grok-3 Mini',
      contextWindow: 131072,
      maxOutputTokens: 131072,
      supportsThinking: true,
      supportsVision: false,
      supportsSearch: true,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Efficient Grok 3 model with thinking support',
    },
    // Grok 2 models (no thinking mode)
    'grok-2': {
      name: 'Grok-2',
      contextWindow: 131072,
      maxOutputTokens: 32768,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: true,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Capable Grok 2 model with advanced reasoning',
    },
    'grok-2-vision': {
      name: 'Grok-2 Vision',
      contextWindow: 32768,
      maxOutputTokens: 8192,
      supportsThinking: false,
      supportsVision: true,
      supportsSearch: true,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Vision-capable Grok model for image understanding',
    },
    'grok-2-mini': {
      name: 'Grok-2 Mini',
      contextWindow: 131072,
      maxOutputTokens: 32768,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: true,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Faster, more efficient Grok 2 model',
    },
    // Legacy beta models
    'grok-beta': {
      name: 'Grok Beta',
      contextWindow: 131072,
      maxOutputTokens: 32768,
      supportsThinking: false,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Legacy Grok beta model',
    },
    'grok-vision-beta': {
      name: 'Grok Vision Beta',
      contextWindow: 8192,
      maxOutputTokens: 4096,
      supportsThinking: false,
      supportsVision: true,
      supportsSearch: false,
      supportsSeed: true,
      defaultTemperature: 0.7,
      description: 'Legacy vision-capable beta model',
    },
  },
  features: {
    supportsThinking: true, // via grok-3 models with reasoning_effort
    supportsVision: true, // via grok-2-vision
    supportsSearch: true,
    supportsSeed: true,
    supportsDoSample: false,
    thinkingModeStyle: 'reasoning_effort',
  },
  branding: {
    cliName: 'ax-grok',
    description: 'Grok-optimized AI coding assistant powered by xAI',
    welcomeMessage: '🤖 Starting AX-Grok AI Assistant (powered by xAI)...',
  },
};

/**
 * Default provider (GLM)
 */
export const DEFAULT_PROVIDER = GLM_PROVIDER;

/**
 * Get provider definition by name
 */
export function getProviderDefinition(name: string): ProviderDefinition | undefined {
  const providers: Record<string, ProviderDefinition> = {
    glm: GLM_PROVIDER,
    grok: GROK_PROVIDER,
  };
  return providers[name.toLowerCase()];
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): ProviderDefinition[] {
  return [GLM_PROVIDER, GROK_PROVIDER];
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
