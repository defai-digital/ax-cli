/**
 * @defai.digital/ax-core - Provider Module Exports
 */

export type {
  ProviderCapabilities,
  ContentPart,
  Message,
  ToolCall,
  ToolCallDelta,
  TokenUsage,
  StreamChunk,
  ThinkingConfig,
  SamplingConfig,
  ChatOptions,
  Tool,
  LLMResponse,
  ILLMProvider,
  ProviderFactory,
  ProviderConfig,
  ToolResult,
  AccumulatedMessage,
} from './interfaces.js';

// Provider definitions and configurations
export type {
  ProviderModelConfig,
  ProviderFeatures,
  ProviderDefinition,
} from './config.js';

export {
  GLM_PROVIDER,
  GROK_PROVIDER,
  DEFAULT_PROVIDER,
  getProviderDefinition,
  getAvailableProviders,
  getProviderModelConfig,
  getApiKeyFromEnv,
  // Model alias system
  MODEL_ALIASES,
  resolveModelAlias,
  getProviderModelAliases,
  isModelAlias,
  getAvailableModelsWithAliases,
} from './config.js';
