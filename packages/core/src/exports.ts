/**
 * @defai.digital/ax-core - Library Exports
 *
 * This file exports all the functionality that ax-glm and ax-grok need
 * to create their provider-specific CLIs.
 */

// CLI Factory
export { createCLI, runCLI, type CLIFactoryOptions } from './cli-factory.js';

// Provider definitions and interfaces
export {
  // Types from interfaces
  type ProviderCapabilities,
  type ContentPart,
  type Message,
  type ToolCall,
  type ToolCallDelta,
  type TokenUsage,
  type StreamChunk,
  type ThinkingConfig,
  type SamplingConfig,
  type ChatOptions,
  type Tool,
  type LLMResponse,
  type ILLMProvider,
  type ProviderFactory,
  type ProviderConfig,
  type ToolResult,
  type AccumulatedMessage,
  // Types from config
  type ProviderModelConfig,
  type ProviderFeatures,
  type ProviderDefinition,
  // Provider definitions
  GLM_PROVIDER,
  GROK_PROVIDER,
  AX_CLI_PROVIDER,
  DEFAULT_PROVIDER,
  getProviderDefinition,
  getAvailableProviders,
  getProviderModelConfig,
  getApiKeyFromEnv,
  // Model aliases (now provider-specific via provider.aliases)
  MODEL_ALIASES,  // @deprecated - use provider.aliases instead
  resolveModelAlias,
} from './provider/index.js';

// Agent
export { LLMAgent } from './agent/llm-agent.js';

// Agent dependency injection (for testing)
export {
  setLLMAgentDependencies,
  resetLLMAgentDependencies,
  getLLMAgentDependencies,
  defaultLLMAgentDependencies,
  type LLMAgentDependencies,
} from './agent/llm-agent-dependencies.js';

// Settings
export { getSettingsManager } from './utils/settings-manager.js';

// Usage tracking
export {
  getUsageTracker,
  type UsageStats,
  type SessionStats,
  type PerformanceMetrics,
  type ToolUsageStats,
  type ServerToolMetrics,
} from './utils/usage-tracker.js';

// Version
export { getVersionString } from './utils/version.js';

// Migration utilities
export {
  ConfigMigrator,
  type MigrationSummary,
  type MigrationResult,
  type MigrationChoice,
  type ApiKeyStatus,
} from './utils/config-migrator.js';

export {
  ProjectMigrator,
  type FileInfo,
  type ProjectMigrationSummary,
  type ProjectMigrationResult,
  type ProjectMigrationChoice,
  type ProjectMigrationOptions,
} from './utils/project-migrator.js';

// Constants
export { AGENT_CONFIG, GLM_MODELS } from './constants.js';
