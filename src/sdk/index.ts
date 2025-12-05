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
 *   agent.dispose();
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
export {
  getMCPManager,
  initializeMCPServers,
  getMcpConnectionCount,
  getMCPConnectionStatus,
  getMCPPrompts,
  discoverMCPPrompts,
  getMCPResources,
} from '../llm/tools.js';
export type { MCPConfig } from '../mcp/config.js';
export type { MCPServerConfig, MCPTool } from '../mcp/client.js';
export { MCPManager } from '../mcp/client.js';

// MCP v2 API (recommended for better type safety)
export {
  MCPManagerV2,
  createServerName,
  createToolName,
  type ServerName,
  type ToolName,
  type ConnectionState,
  type MCPPrompt,
} from '../mcp/client-v2.js';

// MCP Prompt utilities
export {
  promptToSlashCommand,
  parsePromptCommand,
  formatPromptResult,
  getPromptDescription,
} from '../mcp/prompts.js';

// MCP Resource utilities
export {
  listAllResources,
  getResourceContent,
  parseMCPReference,
  extractMCPReferences,
  resolveMCPReferences,
  searchResources,
  type MCPResource,
} from '../mcp/resources.js';

// Z.AI MCP Integration
export {
  // Server configuration
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
} from '../mcp/zai-templates.js';

export {
  // Detection and status
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
} from '../mcp/zai-detector.js';

// Permission system
export {
  getPermissionManager,
  initializePermissionManager,
  PermissionManager,
  PermissionTier,
  type PermissionRequest,
  type PermissionResult,
  type RiskLevel,
} from '../permissions/permission-manager.js';

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
// Shared Tool Registry (Phase 3 - AutomatosX Integration)
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
// Internal Tool Registry (Phase 2 - Task 5)
// ============================================================================

export {
  ToolRegistry as InternalToolRegistry,
  type ToolDefinition,
  type ToolCategory
} from '../tools/registry.js';

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
  CLI_VERSION,
  SDK_VERSION,
  SDK_API_VERSION,
  getCLIVersion,
  getSDKVersion,
  getSDKInfo,
  getVersionString,
  isSDKVersionCompatible,
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
  MockMCPServer,
  createMockMCPServer,
  waitForAgent,
  createMockToolResult,
  assertToolSuccess,
  assertToolFailure
} from './testing.js';

export type { MockMCPServerOptions } from './testing.js';

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
  autoCleanup: z.boolean().optional(),
  onDispose: z.function().args().returns(z.union([z.void(), z.promise(z.void())])).optional(),
  onError: z.function().args(z.instanceof(Error)).returns(z.void()).optional(),
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

  /**
   * Enable automatic cleanup on process exit signals
   *
   * When enabled (default), the SDK automatically registers cleanup handlers for:
   * - process.exit
   * - SIGINT (Ctrl+C)
   * - SIGTERM
   * - SIGHUP
   *
   * Set to false if you want manual control over cleanup (useful for libraries,
   * long-running services, or when you want to manage agent lifecycle yourself).
   *
   * @default true (backward compatible - cleanup enabled by default)
   *
   * @example
   * ```typescript
   * // Auto-cleanup enabled (default behavior)
   * const agent = await createAgent();
   *
   * // Manual cleanup control
   * const agent = await createAgent({ autoCleanup: false });
   * // ... use agent ...
   * agent.dispose(); // Manual cleanup
   * ```
   */
  autoCleanup?: boolean;

  /**
   * Lifecycle hook called before agent disposal
   *
   * This hook is called BEFORE the agent's dispose() method runs, allowing you to:
   * - Save state or checkpoint data
   * - Log metrics or analytics
   * - Notify external systems
   * - Perform custom cleanup
   *
   * Can be async (returns Promise<void>) or sync (returns void).
   *
   * @param None
   * @returns void or Promise<void>
   *
   * @example
   * ```typescript
   * const agent = await createAgent({
   *   onDispose: async () => {
   *     console.log('Agent disposing, saving state...');
   *     await saveAgentState(agent);
   *   }
   * });
   * ```
   */
  onDispose?: () => void | Promise<void>;

  /**
   * Error handler called when agent encounters errors
   *
   * This hook is called whenever the agent encounters an error during:
   * - Message processing
   * - Tool execution
   * - Stream handling
   *
   * Use this to implement custom error handling, logging, or recovery logic.
   *
   * @param error - The error that occurred
   * @returns void
   *
   * @example
   * ```typescript
   * const agent = await createAgent({
   *   onError: (error) => {
   *     console.error('Agent error:', error);
   *     metrics.incrementErrorCount();
   *     errorLogger.log(error);
   *   }
   * });
   * ```
   */
  onError?: (error: Error) => void;
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
 *   agent.dispose();
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

  // Apply defaults for optional values
  const maxToolRounds = validated.maxToolRounds; // undefined is valid, LLMAgent uses 400 as default
  const debug = validated.debug ?? false;
  const autoCleanup = validated.autoCleanup ?? true; // Default: true (backward compatible)
  const onDispose = validated.onDispose;
  const onError = validated.onError;

  // Debug logging
  if (debug) {
    console.error('[AX SDK DEBUG] Creating agent with settings:');
    console.error('[AX SDK DEBUG]   Model:', model);
    console.error('[AX SDK DEBUG]   Base URL:', baseURL);
    console.error('[AX SDK DEBUG]   Max tool rounds:', maxToolRounds ?? 400);
    console.error('[AX SDK DEBUG]   Auto cleanup:', autoCleanup);
    console.error('[AX SDK DEBUG]   API key configured:', !!apiKey);
    console.error('[AX SDK DEBUG]   Lifecycle hooks:', {
      onDispose: !!onDispose,
      onError: !!onError
    });
  }

  // Create agent instance with settings from ax-cli setup
  const agent = new LLMAgent(
    apiKey,
    baseURL,
    model,
    maxToolRounds
  );

  // Store lifecycle hooks on agent
  (agent as any)._sdkLifecycleHooks = {
    onDispose,
    onError
  };

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

  // Phase 3: Add onError lifecycle hook integration
  if (onError) {
    // Wrap agent's processUserMessage to catch errors
    const originalProcessUserMessage = agent.processUserMessage.bind(agent);
    agent.processUserMessage = async (prompt: string) => {
      try {
        return await originalProcessUserMessage(prompt);
      } catch (error) {
        if (error instanceof Error) {
          onError(error);
        }
        throw error; // Re-throw after calling hook
      }
    };

    // Also listen to stream errors
    agent.on('error', (error: Error) => {
      onError(error);
    });
  }

  // Phase 3: Wrap dispose() to call onDispose hook
  const originalDispose = agent.dispose.bind(agent);
  (agent as any).dispose = () => {
    // Mark as disposed in SDK internal state to prevent auto-cleanup from running again
    const markDisposed = (agent as any)._sdkMarkDisposed;
    if (markDisposed) {
      markDisposed();
    }

    // BUG FIX: Remove cleanup handlers from process event listeners to prevent memory leaks
    // This must happen before onDispose hook in case the hook throws
    const cleanupHandler = (agent as any)._sdkCleanupHandler;
    if (cleanupHandler) {
      process.removeListener('exit', cleanupHandler);
      process.removeListener('SIGINT', cleanupHandler);
      process.removeListener('SIGTERM', cleanupHandler);
      process.removeListener('SIGHUP', cleanupHandler);
      delete (agent as any)._sdkCleanupHandler;
    }

    // Handle onDispose hook - if async, we can't await it in synchronous dispose
    // but we'll call it and let it run (fire-and-forget for async hooks)
    if (onDispose) {
      try {
        if (debug) {
          console.error('[AX SDK DEBUG] Calling onDispose hook');
        }
        const result = onDispose();
        // If it's a promise, handle errors but don't block
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((error: unknown) => {
            if (debug) {
              console.error('[AX SDK DEBUG] Error in async onDispose hook:', error);
            }
          });
        }
      } catch (error) {
        if (debug) {
          console.error('[AX SDK DEBUG] Error in onDispose hook:', error);
        }
        // Continue with disposal even if hook fails
      }
    }

    // Call original dispose (synchronous)
    return originalDispose();
  };

  // Phase 3: Auto-cleanup on process exit (OPTIONAL)
  if (autoCleanup) {
    // Track if this agent has been disposed to avoid double cleanup
    let isDisposed = false;

    const cleanupHandler = () => {
      // Prevent double cleanup
      if (isDisposed) {
        return;
      }
      isDisposed = true;

      try {
        if (debug) {
          console.error('[AX SDK DEBUG] Auto-cleanup: disposing agent on process exit');
        }
        // Note: dispose() is synchronous in LLMAgent
        // For clean shutdown, call agent.dispose() explicitly before process exits.
        agent.dispose();
      } catch (error) {
        // Ignore errors during emergency cleanup
        if (debug) {
          console.error('[AX SDK DEBUG] Error during auto-cleanup:', error);
        }
      }
    };

    // Use process.on() instead of process.once() to allow multiple agents
    // Each agent has its own cleanup handler that tracks disposal state
    process.on('exit', cleanupHandler);
    process.on('SIGINT', cleanupHandler);
    process.on('SIGTERM', cleanupHandler);
    process.on('SIGHUP', cleanupHandler);

    // Store cleanup handler reference for manual removal if needed
    (agent as any)._sdkCleanupHandler = cleanupHandler;
    (agent as any)._sdkIsDisposed = () => isDisposed;
    (agent as any)._sdkMarkDisposed = () => { isDisposed = true; };
  } else {
    if (debug) {
      console.error('[AX SDK DEBUG] Auto-cleanup disabled, manual cleanup required');
    }
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
 * Remove auto-cleanup handlers from an agent
 *
 * Use this function to remove the automatic cleanup handlers registered by createAgent()
 * when autoCleanup was enabled (default). This gives you manual control over when the
 * agent is disposed.
 *
 * **Use Cases:**
 * - Long-running services that manage agent lifecycle manually
 * - Testing scenarios where you want precise control over cleanup
 * - Library code that embeds agents
 *
 * **Note:** Only works if agent was created with autoCleanup: true (default).
 * If autoCleanup was false, this function does nothing.
 *
 * @param agent - The agent instance created with createAgent()
 *
 * @example
 * ```typescript
 * // Create agent with auto-cleanup (default)
 * const agent = await createAgent();
 *
 * // Later, take manual control
 * removeCleanupHandlers(agent);
 *
 * // Now you must manually dispose
 * agent.dispose();
 * ```
 *
 * @example
 * ```typescript
 * // For manual cleanup from the start, use autoCleanup: false
 * const agent = await createAgent({ autoCleanup: false });
 * // No need to call removeCleanupHandlers
 * agent.dispose(); // Manual cleanup
 * ```
 */
export function removeCleanupHandlers(agent: LLMAgent): void {
  const cleanupHandler = (agent as any)._sdkCleanupHandler;
  const markDisposed = (agent as any)._sdkMarkDisposed;

  if (!cleanupHandler) {
    // No cleanup handlers registered (autoCleanup was false)
    return;
  }

  // Mark as disposed to prevent cleanup handler from running if signal fires later
  if (markDisposed) {
    markDisposed();
  }

  // Remove all process event listeners
  process.removeListener('exit', cleanupHandler);
  process.removeListener('SIGINT', cleanupHandler);
  process.removeListener('SIGTERM', cleanupHandler);
  process.removeListener('SIGHUP', cleanupHandler);

  // Clear the references
  delete (agent as any)._sdkCleanupHandler;
  delete (agent as any)._sdkIsDisposed;
  delete (agent as any)._sdkMarkDisposed;
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
