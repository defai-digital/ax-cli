/**
 * AX CLI SDK - Programmatic API for AX CLI
 *
 * This SDK allows you to use AX CLI as a library instead of spawning CLI processes.
 * Perfect for integrations, VSCode extensions, and programmatic AI agent usage.
 *
 * ## Quick Start
 *
 * 1. Run `ax-cli setup` to configure credentials (one-time setup)
 * 2. Use the SDK in your code
 *
 * @example
 * ```typescript
 * import { createAgent, SDKError, SDKErrorCode } from '@defai.digital/ax-cli/sdk';
 *
 * // Create agent (credentials from ax-cli setup)
 * const agent = await createAgent({
 *   maxToolRounds: 50  // Optional: 1-1000, default 400
 * });
 *
 * try {
 *   // Listen to streaming responses
 *   agent.on('stream', (chunk) => {
 *     if (chunk.type === 'content') {
 *       console.log(chunk.content);
 *     }
 *   });
 *
 *   // Process messages
 *   const result = await agent.processUserMessage('List all TypeScript files');
 *   console.log('Done!', result.length, 'messages');
 * } catch (error) {
 *   // Handle structured errors
 *   if (SDKError.isSDKError(error)) {
 *     if (error.code === SDKErrorCode.SETUP_NOT_RUN) {
 *       console.error('Please run: ax-cli setup');
 *     }
 *   }
 * } finally {
 *   // Always cleanup resources
 *   await agent.dispose();
 * }
 * ```
 *
 * ## Testing
 *
 * ```typescript
 * import { createMockAgent } from '@defai.digital/ax-cli/sdk/testing';
 *
 * const mockAgent = createMockAgent(['Response 1', 'Response 2']);
 * const result = await mockAgent.processUserMessage('Test');
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
import { z } from 'zod';
import { SDKError, SDKErrorCode } from './errors.js';

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
export { getMCPManager, initializeMCPServers, getMcpConnectionCount } from '../llm/tools.js';
export type { MCPConfig } from '../mcp/config.js';
export type { MCPServerConfig, MCPTool } from '../mcp/client.js';
export { MCPManager } from '../mcp/client.js';

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
// Memory and Context Cache
// ============================================================================

export { ContextStore, getContextStore, resetDefaultStore } from '../memory/context-store.js';
export type { StoreResult } from '../memory/context-store.js';
export type { ProjectMemory, CacheStats } from '../memory/types.js';

// ============================================================================
// Progress Reporting
// ============================================================================

export {
  ProgressReporter,
  getProgressReporter,
  ProgressEventType,
  type ProgressEvent
} from './progress-reporter.js';

// ============================================================================
// Unified Logging (Phase 3)
// ============================================================================

export {
  UnifiedLogger,
  getUnifiedLogger,
  LogLevel,
  parseLogLevel,
  getLogLevelName,
  type LogEntry,
  type LogSource,
  type LogFilter
} from './unified-logger.js';

// ============================================================================
// Shared Tool Registry (Phase 3)
// ============================================================================

export {
  ToolRegistry,
  getToolRegistry,
  registerTools,
  createToolExecutor,
  type RegisteredTool,
  type ToolExecutor,
  type ToolExecutionContext,
  type ToolRegistrationOptions
} from './tool-registry.js';

// ============================================================================
// Constants
// ============================================================================

export {
  GLM_MODELS,
  DEFAULT_MODEL,
  AGENT_CONFIG,
  PLANNER_CONFIG,
  VerbosityLevel,
  UI_CONFIG,
  type SupportedModel,
} from '../constants.js';

// ============================================================================
// SDK Version (Phase 1.5: Best Practices)
// ============================================================================

export {
  SDK_VERSION,
  SDK_API_VERSION,
  getSDKVersion,
  getSDKInfo,
} from './version.js';

// ============================================================================
// SDK Errors (Phase 1: Best Practices)
// ============================================================================

export { SDKError, SDKErrorCode } from './errors.js';

// ============================================================================
// Testing Utilities (Phase 1: Best Practices)
// ============================================================================

export {
  MockAgent,
  createMockAgent,
  MockSettingsManager,
  createMockSettings,
} from './testing.js';

// ============================================================================
// SDK Helper Functions
// ============================================================================

/**
 * Validation schema for agent options
 * @internal
 */
const AgentOptionsSchema = z.object({
  maxToolRounds: z.number().int().min(1).max(1000).optional(),
  debug: z.boolean().optional(),
}).strict();

/**
 * Agent configuration options for SDK users
 *
 * SECURITY: Credentials (apiKey, baseURL) must be configured via "ax-cli setup"
 * and are NOT exposed through the SDK API to prevent security vulnerabilities.
 */
export interface AgentOptions {
  /** Maximum number of tool execution rounds (1-1000, default: 400) */
  maxToolRounds?: number;

  /**
   * Enable debug mode for verbose logging
   *
   * When enabled, the SDK will log detailed information about:
   * - Agent initialization
   * - Message processing
   * - Tool executions
   * - Errors and warnings
   *
   * Debug logs are written to stderr and prefixed with [AX SDK DEBUG].
   *
   * @default false
   */
  debug?: boolean;
}

/**
 * Create a new LLM Agent with configuration
 *
 * SECURITY: All credentials (API key, base URL, model) must be configured
 * via "ax-cli setup" command. This prevents security vulnerabilities where
 * credentials could be exposed in code or logs.
 *
 * @param options - Agent configuration options (non-sensitive only)
 * @returns Configured LLM Agent instance
 * @throws {SDKError} With code SETUP_NOT_RUN if ax-cli setup has not been run
 * @throws {SDKError} With code API_KEY_MISSING if API key not configured
 * @throws {SDKError} With code BASE_URL_MISSING if base URL not configured
 * @throws {SDKError} With code VALIDATION_ERROR if options are invalid
 *
 * @example
 * ```typescript
 * import { createAgent, SDKError, SDKErrorCode } from '@defai.digital/ax-cli/sdk';
 *
 * // First, user must run: ax-cli setup
 * // Then use SDK with settings from setup:
 *
 * const agent = await createAgent({
 *   maxToolRounds: 50  // Optional: 1-1000, default 400
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
 *   console.log(result);
 * } catch (error) {
 *   if (SDKError.isSDKError(error)) {
 *     switch (error.code) {
 *       case SDKErrorCode.SETUP_NOT_RUN:
 *         console.error('Run ax-cli setup first');
 *         break;
 *       case SDKErrorCode.API_KEY_MISSING:
 *         console.error('API key not configured');
 *         break;
 *     }
 *   }
 * } finally {
 *   // Always cleanup resources
 *   await agent.dispose();
 * }
 * ```
 */
export async function createAgent(options: AgentOptions = {}): Promise<LLMAgent> {
  // Validate input options
  let validated: AgentOptions;
  try {
    validated = AgentOptionsSchema.parse(options);
  } catch (error) {
    throw new SDKError(
      SDKErrorCode.VALIDATION_ERROR,
      `Invalid agent options: ${error instanceof Error ? error.message : 'Unknown validation error'}`,
      error instanceof Error ? error : undefined
    );
  }

  const settingsManager = getSettingsManager();

  // Load settings from ax-cli setup
  try {
    settingsManager.loadUserSettings();
  } catch (error) {
    throw new SDKError(
      SDKErrorCode.SETUP_NOT_RUN,
      'ax-cli setup has not been run. Please run "ax-cli setup" to configure your API key, model, and base URL before using the SDK.',
      error instanceof Error ? error : undefined
    );
  }

  // Get configuration ONLY from settings (security requirement)
  const apiKey = settingsManager.getApiKey();
  const model = settingsManager.getCurrentModel();
  const baseURL = settingsManager.getBaseURL();

  // Validate required settings exist
  if (!apiKey) {
    throw new SDKError(
      SDKErrorCode.API_KEY_MISSING,
      'No API key configured. Please run "ax-cli setup" to configure your credentials.'
    );
  }

  if (!baseURL) {
    throw new SDKError(
      SDKErrorCode.BASE_URL_MISSING,
      'No base URL configured. Please run "ax-cli setup" to configure your API provider.'
    );
  }

  const maxToolRounds = validated.maxToolRounds;
  const debug = validated.debug ?? false;

  // Debug logging
  if (debug) {
    console.error('[AX SDK DEBUG] Creating agent with settings:');
    console.error('[AX SDK DEBUG]   Model:', model);
    console.error('[AX SDK DEBUG]   Base URL:', baseURL);
    console.error('[AX SDK DEBUG]   Max tool rounds:', maxToolRounds ?? 400);
    console.error('[AX SDK DEBUG]   API key configured:', !!apiKey);
  }

  // Create agent instance with settings from ax-cli setup
  const agent = new LLMAgent(
    apiKey,
    baseURL,
    model,
    maxToolRounds
  );

  // Enable debug mode on agent if requested
  if (debug) {
    // Add debug event listener
    agent.on('stream', (chunk) => {
      if (chunk.type === 'tool_calls' && chunk.toolCalls) {
        const toolNames = chunk.toolCalls.map((tc: any) => tc.function.name).join(', ');
        console.error('[AX SDK DEBUG] Tool calls:', toolNames);
      } else if (chunk.type === 'tool_result' && chunk.toolResult) {
        console.error('[AX SDK DEBUG] Tool result:', chunk.toolResult.success ? 'success' : 'failed');
      }
    });

    console.error('[AX SDK DEBUG] Agent created successfully');
  }

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
 * Initialize SDK and MCP servers
 *
 * SECURITY: This function does NOT accept credentials. All credentials must be
 * configured via "ax-cli setup" command. This function only initializes MCP servers.
 *
 * @example
 * ```typescript
 * // Initialize MCP servers from ax-cli settings
 * await initializeSDK();
 * ```
 *
 * @deprecated Most SDK users don't need to call this - createAgent() handles initialization.
 * Only call this if you need to pre-initialize MCP servers.
 */
export async function initializeSDK(): Promise<void> {
  // Initialize MCP servers from settings configured via ax-cli setup
  await initializeMCPServers();
}
