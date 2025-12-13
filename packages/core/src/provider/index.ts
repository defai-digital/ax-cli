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
  AX_CLI_PROVIDER,
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

// Grok-specific exports (xAI Agent Tools API)
export {
  type WebSearchConfig,
  type XSearchConfig,
  type CodeExecutionConfig,
  type GrokServerToolsConfig,
  DEFAULT_GROK_SERVER_TOOLS,
  buildServerToolsArray,
  buildServerToolConfig,
  hasEnabledServerTools,
  mergeServerToolsConfig,
} from './grok/index.js';
