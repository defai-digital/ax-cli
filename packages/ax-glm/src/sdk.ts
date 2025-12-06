/**
 * AX-GLM SDK - Programmatic API for GLM-powered AI agents
 *
 * This SDK allows you to use ax-glm as a library for building AI-powered applications.
 * Perfect for integrations, VSCode extensions, and programmatic AI agent usage.
 *
 * ## Quick Start
 *
 * 1. Run `ax-glm setup` to configure credentials (one-time setup)
 * 2. Use the SDK in your code
 *
 * @example
 * ```typescript
 * import { createGLMAgent, SDKError, SDKErrorCode } from '@defai.digital/ax-glm/sdk';
 *
 * // Create GLM agent (credentials from ax-glm setup)
 * const agent = await createGLMAgent({
 *   maxToolRounds: 50,
 *   enableThinking: true  // Enable GLM thinking mode
 * });
 *
 * try {
 *   agent.on('stream', (chunk) => {
 *     if (chunk.type === 'content') {
 *       console.log(chunk.content);
 *     }
 *   });
 *
 *   const result = await agent.processUserMessage('Analyze this codebase');
 *   console.log('Done!', result.length, 'messages');
 * } catch (error) {
 *   if (SDKError.isSDKError(error)) {
 *     if (error.code === SDKErrorCode.SETUP_NOT_RUN) {
 *       console.error('Please run: ax-glm setup');
 *     }
 *   }
 * } finally {
 *   agent.dispose();
 * }
 * ```
 *
 * @packageDocumentation
 */

// Re-export GLM-specific SDK functions
export {
  // GLM-specific agent factory
  createGLMAgent,
  createProviderAgent,

  // Provider definitions
  GLM_PROVIDER,
  GROK_PROVIDER,
  getProviderDefinition,
  getAvailableProviders,
  getProviderModelConfig,
  getApiKeyFromEnv,

  // Types
  type ProviderAgentOptions,
  type ProviderDefinition,
  type ProviderModelConfig,
  type ProviderFeatures,

  // Core SDK exports
  createAgent,
  createSubagent,
  removeCleanupHandlers,
  initializeSDK,

  // Agent classes
  LLMAgent,
  Subagent,
  SubagentOrchestrator,
  ContextManager,

  // LLM Client
  LLMClient,
  type LLMMessage,
  type LLMTool,
  type LLMToolCall,
  type LLMResponse,
  type ChatOptions,
  type ThinkingConfig,
  type SamplingConfig,
  type GLM46StreamChunk,

  // Types
  type ChatEntry,
  type StreamingChunk,
  type ToolResult,
  type Tool,
  type AgentOptions,

  // Subagent types
  SubagentRole,
  SubagentState,
  type SubagentConfig,
  type SubagentTask,
  type SubagentResult,
  type SubagentStatus,

  // Settings
  getSettingsManager,
  type SettingsManager,

  // Utilities
  createTokenCounter,
  type TokenCounter,
  loadCustomInstructions,
  buildSystemPrompt,
  getUsageTracker,
  extractErrorMessage,
  createErrorMessage,
  ErrorCategory,

  // MCP Integration
  loadMCPConfig,
  getMCPManager,
  initializeMCPServers,
  getMcpConnectionCount,
  getMCPConnectionStatus,
  getMCPPrompts,
  discoverMCPPrompts,
  getMCPResources,
  type MCPConfig,
  type MCPServerConfig,
  type MCPTool,
  MCPManager,
  MCPManagerV2,
  createServerName,
  createToolName,
  type ServerName,
  type ToolName,
  type ConnectionState,
  type MCPPrompt,

  // Z.AI MCP Integration
  ZAI_SERVER_NAMES,
  ZAI_ENDPOINTS,
  ZAI_VISION_PACKAGE,
  ZAI_MCP_TEMPLATES,
  ZAI_QUOTA_LIMITS,
  generateZAIServerConfig,
  getAllZAIServerNames,
  isZAIServer,
  getZAITemplate,
  type ZAIServerName,
  type ZAIPlanTier,
  type ZAIMCPTemplate,
  detectZAIServices,
  getEnabledZAIServers,
  validateZAIApiKey,
  getZAIApiKey,
  isZAIMCPConfigured,
  getRecommendedServers,
  isGLMModel,
  isZAIBaseURL,
  formatZAIStatus,
  type ZAIServiceStatus,

  // Permission system
  getPermissionManager,
  initializePermissionManager,
  PermissionManager,
  PermissionTier,
  type PermissionRequest,
  type PermissionResult,
  type RiskLevel,

  // Planning
  getTaskPlanner,
  isComplexRequest,
  type TaskPlanner,
  type TaskPlan,
  type TaskPhase,
  type PhaseResult,
  type PlanResult,

  // Checkpoint
  getCheckpointManager,
  type CheckpointManager,
  type Checkpoint,

  // Memory
  ContextStore,
  getContextStore,
  resetDefaultStore,
  type StoreResult,
  type ProjectMemory,
  type CacheStats,

  // Progress Reporting
  ProgressReporter,
  getProgressReporter,
  ProgressEventType,
  type ProgressEvent,

  // Unified Logging
  UnifiedLogger,
  getUnifiedLogger,
  LogLevel,
  parseLogLevel,
  getLogLevelName,
  type LogEntry,
  type LogSource,
  type LogFilter,

  // Tool Registry
  ToolRegistry,
  getToolRegistry,
  registerTools,
  createToolExecutor,
  type RegisteredTool,
  type ToolExecutor,
  type ToolExecutionContext,
  type ToolRegistrationOptions,
  InternalToolRegistry,
  type ToolDefinition,
  type ToolCategory,

  // Constants
  GLM_MODELS,
  DEFAULT_MODEL,
  AGENT_CONFIG,
  PLANNER_CONFIG,
  VerbosityLevel,
  UI_CONFIG,
  type SupportedModel,

  // Version
  CLI_VERSION,
  SDK_VERSION,
  SDK_API_VERSION,
  getCLIVersion,
  getSDKVersion,
  getSDKInfo,
  getVersionString,
  isSDKVersionCompatible,

  // Errors
  SDKError,
  SDKErrorCode,

  // Testing utilities
  MockAgent,
  createMockAgent,
  MockSettingsManager,
  createMockSettings,
  MockMCPServer,
  createMockMCPServer,
  waitForAgent,
  createMockToolResult,
  assertToolSuccess,
  assertToolFailure,
  type MockMCPServerOptions,
} from '@defai.digital/ax-core/sdk';
