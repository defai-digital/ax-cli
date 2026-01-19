/**
 * LLM Module - Language Model Client and Tools
 *
 * Provides the LLM client for interacting with AI models,
 * tool definitions, and type exports.
 *
 * @packageDocumentation
 */

// Client exports
export {
  LLMClient,
  type LLMMessage,
  type JSONSchemaValue,
  type LLMTool,
  type LLMToolCall,
  type SearchParameters,
  type SearchOptions,
  type LLMResponse,
} from './client.js';

// Tool management exports
export {
  LLM_TOOLS,
  getMCPManager,
  resetMCPManager,
  getMCPClientConfig,
  getMcpConnectionCount,
  initializeMCPServers,
  convertMCPToolToLLMTool,
  mergeWithMCPTools,
  getAllTools,
  getMCPConnectionStatus,
  getMCPPrompts,
  discoverMCPPrompts,
  getMCPResources,
} from './tools.js';

// Type exports
export {
  type ThinkingConfig,
  type SamplingConfig,
  type ChatOptions,
  type GLM46Response,
  type GLM46StreamChunk,
  type MessageContentPart,
  type MultimodalMessage,
  type SupportedModel,
  GLM_MODELS,
  isGLM46Response,
  hasReasoningContent,
  getModelConfig,
  validateTemperature,
  validateMaxTokens,
  validateThinking,
  validateSampling,
  createDefaultChatOptions,
  createDeterministicSampling,
  createCreativeSampling,
} from './types.js';
