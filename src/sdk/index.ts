/**
 * AX CLI SDK - Programmatic API for AX CLI
 *
 * This SDK allows you to use AX CLI as a library instead of spawning CLI processes.
 * Perfect for integrations, VSCode extensions, and programmatic AI agent usage.
 *
 * @example
 * ```typescript
 * import { createAgent, getSettingsManager } from '@defai.digital/ax-cli/sdk';
 *
 * // Initialize settings
 * const settings = getSettingsManager();
 * await settings.loadUserSettings();
 *
 * // Create agent
 * const agent = await createAgent({
 *   model: 'glm-4.6',
 *   maxToolRounds: 50
 * });
 *
 * // Listen to streaming responses
 * agent.on('stream', (chunk) => {
 *   console.log(chunk.content);
 * });
 *
 * // Process messages
 * const result = await agent.processUserMessage('List all TypeScript files');
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Agent Classes
// ============================================================================

export { LLMAgent } from '../agent/llm-agent.js';
export { Subagent } from '../agent/subagent.js';
export { SubagentOrchestrator } from '../agent/subagent-orchestrator.js';
export { ContextManager } from '../agent/context-manager.js';

// Internal imports for SDK functions
import { LLMAgent } from '../agent/llm-agent.js';
import { Subagent } from '../agent/subagent.js';
import { getSettingsManager } from '../utils/settings-manager.js';
import { initializeMCPServers } from '../llm/tools.js';

// ============================================================================
// LLM Client
// ============================================================================

export { LLMClient } from '../llm/client.js';
export type {
  LLMMessage,
  LLMTool,
  LLMToolCall,
  LLMResponse,
  SearchParameters,
  SearchOptions,
} from '../llm/client.js';

export type {
  ChatOptions,
  ThinkingConfig,
  SamplingConfig,
  GLM46StreamChunk,
} from '../llm/types.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type { ChatEntry, StreamingChunk } from '../agent/llm-agent.js';
export type { ToolResult, Tool, EditorCommand, AgentState } from '../types/index.js';

export {
  SubagentRole,
  SubagentState,
  type SubagentConfig,
  type SubagentTask,
  type SubagentResult,
  type SubagentStatus,
} from '../agent/subagent-types.js';

// ============================================================================
// Settings and Configuration
// ============================================================================

export { getSettingsManager } from '../utils/settings-manager.js';
export type { SettingsManager } from '../utils/settings-manager.js';

// ============================================================================
// Utilities
// ============================================================================

export { createTokenCounter } from '../utils/token-counter.js';
export type { TokenCounter } from '../utils/token-counter.js';

export { loadCustomInstructions } from '../utils/custom-instructions.js';
export { buildSystemPrompt } from '../utils/prompt-builder.js';
export { getUsageTracker } from '../utils/usage-tracker.js';
export { extractErrorMessage, createErrorMessage, ErrorCategory } from '../utils/error-handler.js';

// ============================================================================
// MCP Integration
// ============================================================================

export { loadMCPConfig } from '../mcp/config.js';
export { getMCPManager, initializeMCPServers } from '../llm/tools.js';
export type { MCPConfig } from '../mcp/config.js';
export type { MCPServerConfig } from '../mcp/client.js';

// ============================================================================
// Planning System
// ============================================================================

export { getTaskPlanner, isComplexRequest } from '../planner/index.js';
export type {
  TaskPlanner,
  TaskPlan,
  TaskPhase,
  PhaseResult,
  PlanResult,
} from '../planner/index.js';

// ============================================================================
// Checkpoint System
// ============================================================================

export { getCheckpointManager } from '../checkpoint/index.js';
export type { CheckpointManager, Checkpoint } from '../checkpoint/index.js';

// ============================================================================
// Constants
// ============================================================================

export {
  GLM_MODELS,
  DEFAULT_MODEL,
  AGENT_CONFIG,
  PLANNER_CONFIG,
  type SupportedModel,
} from '../constants.js';

// ============================================================================
// SDK Helper Functions
// ============================================================================

/**
 * Agent configuration options for SDK users
 */
export interface AgentOptions {
  /** API key (optional, will use settings if not provided) */
  apiKey?: string;
  /** Model to use (optional, will use settings if not provided) */
  model?: string;
  /** Base URL for API (optional, will use settings if not provided) */
  baseURL?: string;
  /** Maximum number of tool execution rounds */
  maxToolRounds?: number;
}

/**
 * Create a new LLM Agent with configuration
 *
 * @param options - Agent configuration options
 * @returns Configured LLM Agent instance
 *
 * @example
 * ```typescript
 * const agent = await createAgent({
 *   model: 'glm-4.6',
 *   maxToolRounds: 50
 * });
 *
 * agent.on('stream', (chunk) => {
 *   if (chunk.type === 'content') {
 *     console.log(chunk.content);
 *   }
 * });
 *
 * const result = await agent.processUserMessage('Analyze this codebase');
 * ```
 */
export async function createAgent(options: AgentOptions = {}): Promise<LLMAgent> {
  const settingsManager = getSettingsManager();

  // Load settings if not already loaded
  try {
    settingsManager.loadUserSettings();
  } catch {
    // Settings may not exist yet, that's okay
  }

  // Get configuration (use options or settings)
  const apiKey = options.apiKey || settingsManager.getApiKey() || '';
  const model = options.model || settingsManager.getCurrentModel();
  const baseURL = options.baseURL || settingsManager.getBaseURL();
  const maxToolRounds = options.maxToolRounds;

  // Create agent instance
  const agent = new LLMAgent(
    apiKey,
    baseURL,
    model,
    maxToolRounds
  );

  return agent;
}

/**
 * Create a specialized subagent for specific tasks
 *
 * @param role - The role/specialty of the subagent
 * @param config - Optional configuration overrides
 * @returns Configured Subagent instance
 *
 * @example
 * ```typescript
 * const testAgent = createSubagent(SubagentRole.TESTING, {
 *   maxToolRounds: 20,
 *   priority: 2
 * });
 *
 * const result = await testAgent.execute({
 *   id: 'task-1',
 *   description: 'Write unit tests for auth module',
 *   context: { files: ['src/auth.ts'] }
 * });
 * ```
 */
export function createSubagent(
  role: import('../agent/subagent-types.js').SubagentRole,
  config?: Partial<import('../agent/subagent-types.js').SubagentConfig>
): Subagent {
  return new Subagent(role, config);
}

/**
 * Initialize SDK with configuration
 *
 * @param config - SDK initialization configuration
 *
 * @example
 * ```typescript
 * await initializeSDK({
 *   apiKey: 'your-api-key',
 *   model: 'glm-4.6',
 *   baseURL: 'https://api.example.com/v1'
 * });
 * ```
 */
export async function initializeSDK(config: {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  mcpServers?: Record<string, any>;
}): Promise<void> {
  const settingsManager = getSettingsManager();

  // Update settings
  if (config.apiKey) {
    settingsManager.updateUserSetting('apiKey', config.apiKey);
  }
  if (config.model) {
    settingsManager.updateUserSetting('defaultModel', config.model);
  }
  if (config.baseURL) {
    settingsManager.updateUserSetting('baseURL', config.baseURL);
  }

  // Initialize MCP servers if provided
  if (config.mcpServers) {
    await initializeMCPServers();
  }
}
