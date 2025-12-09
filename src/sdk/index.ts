/**
 * AX CLI SDK v1.4.0 - Programmatic API for AX CLI
 *
 * Use AX CLI as a library for integrations, VSCode extensions, and programmatic AI agents.
 *
 * ## Installation
 *
 * ```bash
 * npm install @defai.digital/ax-cli
 * ```
 *
 * ## Quick Start
 *
 * ```typescript
 * import { createAgent, createGLMAgent, createGrokAgent } from '@defai.digital/ax-cli/sdk';
 *
 * // Option 1: Auto-detect provider
 * const agent = await createAgent();
 *
 * // Option 2: Explicit provider
 * const glmAgent = await createGLMAgent();   // Uses ~/.ax-glm/config.json
 * const grokAgent = await createGrokAgent(); // Uses ~/.ax-grok/config.json
 *
 * // Process messages
 * const result = await agent.processUserMessage('Analyze this code');
 * agent.dispose();
 * ```
 *
 * ## Public API (v1.4.0)
 *
 * ### Agent Creation
 * - `createAgent(options?)` - Create agent with auto-detected or specified provider
 * - `createGLMAgent(options?)` - Create GLM (Z.AI) agent
 * - `createGrokAgent(options?)` - Create Grok (xAI) agent
 * - `tryCreateAgent(options?)` - Create agent without throwing (returns result object)
 * - `withAgent(fn, options?)` - Run function with auto-disposed agent
 *
 * ### Error Handling
 * - `SDKError` - Structured error class with error codes
 * - `SDKErrorCode` - Error code enum (SETUP_NOT_RUN, API_KEY_MISSING, etc.)
 *
 * ### Agent Utilities
 * - `getAgentInfo(agent)` - Get provider, model, config info
 * - `getAgentStatus(agent)` - Check if agent is available/busy/disposed
 * - `isAgentDisposed(agent)` - Check disposal state
 * - `disposeAsync(agent)` - Dispose with async hook support
 *
 * ### Provider Utilities
 * - `detectProvider()` - Auto-detect configured provider
 * - `checkProviderHealth(provider?)` - Check if provider is configured
 * - `getAllProviderHealth()` - Check all providers
 *
 * ### Version Info
 * - `SDK_VERSION`, `CLI_VERSION` - Version constants
 * - `getSDKVersion()`, `getCLIVersion()` - Version strings
 * - `isSDKVersionCompatible(minVersion)` - Version check
 *
 * ### Testing
 * - `createMockAgent(responses)` - Create mock for testing
 * - `createMockSettings(overrides)` - Mock settings manager
 *
 * ## Example: Streaming Responses
 *
 * ```typescript
 * import { createGLMAgent, SDKError, SDKErrorCode } from '@defai.digital/ax-cli/sdk';
 *
 * const agent = await createGLMAgent();
 *
 * agent.on('stream', (chunk) => {
 *   if (chunk.type === 'content') {
 *     process.stdout.write(chunk.content);
 *   }
 * });
 *
 * try {
 *   await agent.processUserMessage('Explain async/await');
 * } catch (error) {
 *   if (SDKError.isSDKError(error)) {
 *     console.error(`Error [${error.code}]: ${error.message}`);
 *   }
 * } finally {
 *   agent.dispose();
 * }
 * ```
 *
 * ## Example: Parallel Providers
 *
 * ```typescript
 * import { createGLMAgent, createGrokAgent } from '@defai.digital/ax-cli/sdk';
 *
 * // Run GLM and Grok in parallel
 * const [glm, grok] = await Promise.all([
 *   createGLMAgent(),
 *   createGrokAgent(),
 * ]);
 *
 * const [glmResult, grokResult] = await Promise.all([
 *   glm.processUserMessage('Analyze with GLM'),
 *   grok.processUserMessage('Analyze with Grok'),
 * ]);
 *
 * glm.dispose();
 * grok.dispose();
 * ```
 *
 * ## Example: Testing
 *
 * ```typescript
 * import { createMockAgent } from '@defai.digital/ax-cli/sdk';
 *
 * const mock = createMockAgent(['Hello!', 'How can I help?']);
 * const result = await mock.processUserMessage('Hi');
 * expect(result).toContain('Hello!');
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
import { LLMAgent, type StreamingChunk } from '../agent/llm-agent.js';
import { Subagent } from '../agent/subagent.js';
import { initializeMCPServers } from '../llm/tools.js';
import { z } from 'zod';
import { SDKError, SDKErrorCode } from './errors.js';

// Provider-aware imports
import {
  ProviderContext,
  type ProviderType,
  detectProvider,
  PROVIDER_CONFIGS,
} from '../utils/provider-context.js';
import {
  ProviderSettingsManager,
} from '../utils/provider-settings.js';
// File locking utilities - re-exported for SDK users
export {
  withFileLock,
  withFileLockSync,
  SafeJsonFile,
  LockGuard,
  cleanupStaleLocks,
  type LockOptions,
} from '../utils/file-lock.js';

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
// NOTE: Internal utilities removed in SDK v1.4.0 to reduce API surface
// ============================================================================
// The following were intentionally removed from public exports:
// - Settings utilities (getSettingsManager, createTokenCounter, etc.)
// - MCP internals (MCPManager, MCPManagerV2, etc.) - use createAgent() instead
// - Z.AI MCP templates/detector - internal implementation details
// - Permission system internals
// - Planning system internals
// - Checkpoint system internals
// - Memory/Context internals
// - Progress reporting
// - Unified logging
// - Tool registry internals
//
// If you need these, import directly from the specific modules.
// The SDK public API focuses on: createAgent, createGLMAgent, createGrokAgent, SDKError

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

// ============================================================================
// Provider Context (Multi-Provider Support) - Public API only
// ============================================================================

// Export only the essential provider types for SDK users
export type { ProviderType } from '../utils/provider-context.js';

// Re-export detectProvider for advanced users who need provider detection
export { detectProvider } from '../utils/provider-context.js';

// Note: Internal utilities (withFileLock, SafeJsonFile, ProviderFileCache,
// ProviderContextStore, etc.) are intentionally NOT exported.
// These are implementation details, not part of the public SDK API.

/**
 * Validation schema for agent options
 * @internal
 */
const AgentOptionsSchema = z.object({
  provider: z.enum(['glm', 'grok', 'generic']).optional(),
  maxToolRounds: z.number().int().min(1).max(1000).optional(),
  debug: z.boolean().optional(),
  autoCleanup: z.boolean().optional(),
  // Zod v4: z.function() no longer uses .args()/.returns() - use custom type
  onDispose: z.custom<() => void | Promise<void>>((val) => typeof val === 'function').optional(),
  onError: z.custom<(error: Error) => void>((val) => typeof val === 'function').optional(),
}).strict();

/**
 * Agent configuration options for SDK users
 *
 * SECURITY: Credentials (apiKey, baseURL) must be configured via "ax-cli setup"
 * and are NOT exposed through the SDK API to prevent security vulnerabilities.
 *
 * MULTI-PROVIDER SUPPORT (v5.0):
 * When running multiple providers in parallel (ax-glm and ax-grok), use the
 * `provider` option to specify which provider's configuration to use.
 * Each provider has isolated:
 * - Configuration files (~/.ax-glm/ vs ~/.ax-grok/)
 * - Cache directories
 * - Memory stores
 * - History
 *
 * @example
 * ```typescript
 * // Run GLM and Grok agents in parallel
 * const glmAgent = await createAgent({ provider: 'glm' });
 * const grokAgent = await createAgent({ provider: 'grok' });
 *
 * // Use both simultaneously
 * const [glmResult, grokResult] = await Promise.all([
 *   glmAgent.processUserMessage('Analyze with GLM'),
 *   grokAgent.processUserMessage('Analyze with Grok'),
 * ]);
 * ```
 */
export interface AgentOptions {
  /**
   * Provider to use for configuration
   *
   * When specified, the agent will use the provider-specific configuration
   * from the corresponding directory:
   * - 'glm': Uses ~/.ax-glm/config.json
   * - 'grok': Uses ~/.ax-grok/config.json
   * - 'generic': Uses ~/.ax-cli/config.json
   *
   * If not specified, automatically detects based on:
   * 1. AX_PROVIDER environment variable
   * 2. Which provider's API key is set (ZAI_API_KEY, XAI_API_KEY)
   * 3. Falls back to 'generic'
   *
   * @default auto-detect
   */
  provider?: ProviderType;

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
 * @throws {SDKError} With code MODEL_MISSING if model not configured
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

  // Determine provider (explicit > auto-detect)
  const provider = validated.provider ?? detectProvider();

  // Create provider context WITHOUT activating globally
  // This is critical for parallel agent support - each agent gets its own context
  // without affecting the global state that other agents might be using
  const providerContext = ProviderContext.create(provider);

  // Get provider-specific settings manager using the context
  const providerSettings = ProviderSettingsManager.forContext(providerContext);

  // Load settings from provider-specific config
  try {
    providerSettings.loadUserSettings();
  } catch (error) {
    const cliName = PROVIDER_CONFIGS[provider].cliName;
    throw new SDKError(
      SDKErrorCode.SETUP_NOT_RUN,
      `${cliName} setup has not been run. Please run "${cliName} setup" to configure your API key, model, and base URL before using the SDK.`,
      error instanceof Error ? error : undefined
    );
  }

  // Get configuration from provider-specific settings
  const apiKey = providerSettings.getApiKey();
  const model = providerSettings.getCurrentModel();
  const baseURL = providerSettings.getBaseURL();

  // Validate required settings exist
  const cliName = PROVIDER_CONFIGS[provider].cliName;

  if (!apiKey) {
    throw new SDKError(
      SDKErrorCode.API_KEY_MISSING,
      `No API key configured for ${provider}. Please run "${cliName} setup" to configure your credentials.`
    );
  }

  if (!baseURL) {
    throw new SDKError(
      SDKErrorCode.BASE_URL_MISSING,
      `No base URL configured for ${provider}. Please run "${cliName} setup" to configure your API provider.`
    );
  }

  // BUG FIX: Validate model is configured before creating agent
  // Without this, undefined model would fall back to getSettingsManager().getCurrentModel()
  // which uses the OLD singleton-based settings manager, not the provider-aware one.
  // This could cause the agent to use a different model in multi-provider scenarios.
  if (!model) {
    throw new SDKError(
      SDKErrorCode.MODEL_MISSING,
      `No model configured for ${provider}. Please run "${cliName} setup" to configure your AI model.`
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
    console.error('[AX SDK DEBUG]   Provider:', provider);
    console.error('[AX SDK DEBUG]   Config dir:', providerContext.userDir);
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

  // Create agent instance with provider-specific settings
  const agent = new LLMAgent(
    apiKey,
    baseURL,
    model,
    maxToolRounds
  );

  // Store provider context on agent for later use
  (agent as any)._sdkProvider = provider;
  (agent as any)._sdkProviderContext = providerContext;
  (agent as any)._sdkProviderSettings = providerSettings;
  // Store the actual model and baseURL used at creation time
  // This prevents getAgentInfo from returning wrong values if config changes
  (agent as any)._sdkModel = model;
  (agent as any)._sdkBaseURL = baseURL;
  // Store creation timestamp for debugging and lifecycle tracking
  (agent as any)._sdkCreatedAt = new Date();

  // Store lifecycle hooks on agent
  (agent as any)._sdkLifecycleHooks = {
    onDispose,
    onError
  };

  // Store debug flag so disposeAsync can access it for logging
  (agent as any)._sdkDebug = debug;

  // BUG FIX: Track SDK-added listeners so they can be removed on dispose
  // Without this, listeners would persist after disposal causing memory leaks
  const sdkListeners: Array<{ event: string; listener: (...args: unknown[]) => void }> = [];

  // Enable debug mode on agent if requested
  if (debug) {
    // Add debug event listener
    const debugStreamListener = (chunk: StreamingChunk): void => {
      if (chunk.type === 'tool_calls' && chunk.toolCalls) {
        const toolNames = chunk.toolCalls.map((tc) => tc.function.name).join(', ');
        console.error('[AX SDK DEBUG] Tool calls:', toolNames);
      } else if (chunk.type === 'tool_result' && chunk.toolResult) {
        console.error('[AX SDK DEBUG] Tool result:', chunk.toolResult.success ? 'success' : 'failed');
      }
    };
    agent.on('stream', debugStreamListener as (...args: unknown[]) => void);
    sdkListeners.push({ event: 'stream', listener: debugStreamListener as (...args: unknown[]) => void });

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
        // BUG FIX: Handle non-Error throwables by wrapping them
        // Without this, throwing a string/null/undefined would skip the onError hook
        // but still propagate the error, leaving the user unaware
        const normalizedError = error instanceof Error
          ? error
          : new Error(String(error ?? 'Unknown error'));
        onError(normalizedError);
        throw error; // Re-throw original error to preserve behavior
      }
    };

    // Also listen to stream errors
    const errorListener = (error: Error): void => {
      onError(error);
    };
    agent.on('error', errorListener as (...args: unknown[]) => void);
    sdkListeners.push({ event: 'error', listener: errorListener as (...args: unknown[]) => void });
  }

  // Store listeners reference for cleanup
  (agent as any)._sdkListeners = sdkListeners;

  // BUG FIX: Track if SDK dispose wrapper has been called to prevent double disposal
  // Without this, calling dispose() multiple times would run cleanup logic and
  // onDispose hook multiple times, which could cause errors or unexpected behavior
  let sdkDisposeCompleted = false;

  // Store a reliable disposed flag that works regardless of autoCleanup setting
  (agent as any)._sdkDisposed = false;

  // Phase 3: Wrap dispose() to call onDispose hook
  const originalDispose = agent.dispose.bind(agent);
  // Store original dispose on agent so disposeAsync can access it
  (agent as any)._sdkOriginalDispose = originalDispose;
  (agent as any).dispose = () => {
    // BUG FIX: Guard against double disposal in SDK wrapper
    // Check BOTH the closure variable AND the agent property
    // This handles the case where disposeAsync() was called first (sets _sdkDisposed)
    // or where dispose() was called first (sets sdkDisposeCompleted)
    if (sdkDisposeCompleted || (agent as any)._sdkDisposed === true) {
      return;
    }
    sdkDisposeCompleted = true;

    // Set the reliable disposed flag (works regardless of autoCleanup)
    (agent as any)._sdkDisposed = true;

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

    // BUG FIX: Remove SDK-added event listeners to prevent memory leaks
    // These include debug stream listener and onError listener
    const listeners = (agent as any)._sdkListeners as Array<{ event: string; listener: (...args: unknown[]) => void }> | undefined;
    if (listeners && listeners.length > 0 && typeof agent.off === 'function') {
      for (const { event, listener } of listeners) {
        agent.off(event, listener);
      }
      delete (agent as any)._sdkListeners;
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
 * Create an agent configured for GLM (Z.AI)
 *
 * Convenience function that creates an agent with provider: 'glm'.
 * Uses configuration from ~/.ax-glm/config.json.
 *
 * @param options - Agent options (provider is set to 'glm')
 * @returns Configured LLM Agent for GLM
 *
 * @example
 * ```typescript
 * const agent = await createGLMAgent();
 * const result = await agent.processUserMessage('Hello');
 * agent.dispose();
 * ```
 */
export async function createGLMAgent(
  options: Omit<AgentOptions, 'provider'> = {}
): Promise<LLMAgent> {
  return createAgent({ ...options, provider: 'glm' });
}

/**
 * Create an agent configured for Grok (xAI)
 *
 * Convenience function that creates an agent with provider: 'grok'.
 * Uses configuration from ~/.ax-grok/config.json.
 *
 * @param options - Agent options (provider is set to 'grok')
 * @returns Configured LLM Agent for Grok
 *
 * @example
 * ```typescript
 * const agent = await createGrokAgent();
 * const result = await agent.processUserMessage('Hello');
 * agent.dispose();
 * ```
 */
export async function createGrokAgent(
  options: Omit<AgentOptions, 'provider'> = {}
): Promise<LLMAgent> {
  return createAgent({ ...options, provider: 'grok' });
}

// ============================================================================
// High-Value Helper Functions (v5.2)
// ============================================================================

/**
 * Result type for tryCreateAgent
 */
export type CreateAgentResult =
  | { success: true; agent: LLMAgent; error: undefined }
  | { success: false; agent: undefined; error: SDKError };

/**
 * Create an agent without throwing errors
 *
 * Unlike createAgent(), this function returns a result object instead of throwing.
 * Useful for graceful error handling without try-catch blocks.
 *
 * @param options - Agent configuration options
 * @returns Result object with either agent or error
 *
 * @example
 * ```typescript
 * const result = await tryCreateAgent({ provider: 'glm' });
 *
 * if (result.success) {
 *   // Use agent
 *   await result.agent.processUserMessage('Hello');
 *   result.agent.dispose();
 * } else {
 *   // Handle error without try-catch
 *   console.error('Failed:', result.error.code, result.error.message);
 * }
 * ```
 */
export async function tryCreateAgent(options: AgentOptions = {}): Promise<CreateAgentResult> {
  try {
    const agent = await createAgent(options);
    return { success: true, agent, error: undefined };
  } catch (error) {
    const sdkError = SDKError.isSDKError(error)
      ? error
      : new SDKError(
          SDKErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : 'Unknown error creating agent',
          error instanceof Error ? error : undefined
        );
    return { success: false, agent: undefined, error: sdkError };
  }
}

/**
 * Run a function with a temporary agent that is automatically disposed
 *
 * This helper creates an agent, runs your function, and ensures the agent
 * is properly disposed even if an error occurs. Useful for:
 * - One-off agent operations
 * - Scripts that need cleanup guarantees
 * - Testing scenarios
 *
 * @param fn - Function to run with the agent
 * @param options - Agent configuration options
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * // Simple usage
 * const result = await withAgent(async (agent) => {
 *   return await agent.processUserMessage('Analyze this code');
 * });
 *
 * // With options
 * const result = await withAgent(
 *   async (agent) => {
 *     agent.on('stream', console.log);
 *     return await agent.processUserMessage('Hello');
 *   },
 *   { provider: 'glm', maxToolRounds: 50 }
 * );
 * ```
 */
export async function withAgent<T>(
  fn: (agent: LLMAgent) => Promise<T>,
  options: AgentOptions = {}
): Promise<T> {
  const agent = await createAgent(options);
  try {
    return await fn(agent);
  } finally {
    // Use disposeAsync to properly await any async onDispose hooks
    await disposeAsync(agent);
  }
}

/**
 * Run a function with a temporary agent, returning result or error
 *
 * Combines withAgent and tryCreateAgent - creates agent, runs function,
 * disposes, and returns result without throwing. Ideal for error-tolerant
 * workflows.
 *
 * @param fn - Function to run with the agent
 * @param options - Agent configuration options
 * @returns Result object with either value or error
 *
 * @example
 * ```typescript
 * const result = await tryWithAgent(async (agent) => {
 *   return await agent.processUserMessage('Hello');
 * }, { provider: 'grok' });
 *
 * if (result.success) {
 *   console.log('Got response:', result.value);
 * } else {
 *   console.error('Failed:', result.error.message);
 * }
 * ```
 */
export async function tryWithAgent<T>(
  fn: (agent: LLMAgent) => Promise<T>,
  options: AgentOptions = {}
): Promise<{ success: true; value: T; error: undefined } | { success: false; value: undefined; error: SDKError }> {
  const createResult = await tryCreateAgent(options);
  if (!createResult.success) {
    return { success: false, value: undefined, error: createResult.error };
  }

  try {
    const value = await fn(createResult.agent);
    return { success: true, value, error: undefined };
  } catch (error) {
    const sdkError = SDKError.isSDKError(error)
      ? error
      : new SDKError(
          SDKErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : 'Unknown error during agent operation',
          error instanceof Error ? error : undefined
        );
    return { success: false, value: undefined, error: sdkError };
  } finally {
    await disposeAsync(createResult.agent);
  }
}

/**
 * Options for creating a subagent
 */
export interface SubagentOptions extends Partial<import('../agent/subagent-types.js').SubagentConfig> {
  /**
   * Provider to use for this subagent's configuration
   *
   * When specified, the subagent will use provider-specific settings.
   * Important for parallel multi-provider scenarios.
   *
   * @default auto-detect based on environment
   */
  provider?: ProviderType;
}

/**
 * Create a specialized subagent for specific tasks
 *
 * @param role - The role/specialty of the subagent
 * @param options - Optional configuration including provider
 * @returns Configured Subagent instance
 *
 * @example
 * ```typescript
 * // Basic usage
 * const testAgent = createSubagent(SubagentRole.TESTING, {
 *   maxToolRounds: 20,
 *   priority: 2
 * });
 *
 * // With provider for parallel support
 * const glmSubagent = createSubagent(SubagentRole.ANALYSIS, {
 *   provider: 'glm',
 *   maxToolRounds: 30
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
  options?: SubagentOptions
): Subagent {
  // BUG FIX: Clone config to prevent external mutation affecting the subagent
  // Without this, the caller could modify config.allowedTools array after creation
  // and unexpectedly change which tools the subagent can use
  let clonedConfig: Partial<import('../agent/subagent-types.js').SubagentConfig> | undefined;

  if (options) {
    // BUG FIX: Use destructuring to exclude provider instead of setting undefined
    // Setting `provider: undefined` explicitly could cause issues if Subagent
    // constructor checks for presence of `provider` key vs undefined value
    const { provider: _provider, allowedTools, ...rest } = options;
    clonedConfig = {
      ...rest,
      // Deep clone arrays to prevent mutation
      allowedTools: allowedTools ? [...allowedTools] : undefined,
    };
  }

  // Create subagent
  const subagent = new Subagent(role, clonedConfig);

  // Store provider context if specified for later use
  if (options?.provider) {
    const providerContext = ProviderContext.create(options.provider);
    const providerSettings = ProviderSettingsManager.forContext(providerContext);
    (subagent as any)._sdkProvider = options.provider;
    (subagent as any)._sdkProviderContext = providerContext;
    (subagent as any)._sdkProviderSettings = providerSettings;
  }

  return subagent;
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

// ============================================================================
// Agent Information & Health Check (v5.0 - High-Value Features)
// ============================================================================

/**
 * Information about an agent's configuration
 */
export interface AgentInfo {
  /** Provider type ('glm', 'grok', or 'generic') */
  provider: ProviderType;
  /** Provider display name */
  providerDisplayName: string;
  /** Current model in use */
  model: string | undefined;
  /** Base URL for API calls */
  baseURL: string | undefined;
  /** Whether the agent has been disposed */
  isDisposed: boolean;
  /** Configuration directory path */
  configDir: string;
  /** CLI command name for this provider */
  cliName: string;
  /** When the agent was created */
  createdAt: Date;
}

/**
 * Get information about an agent created with createAgent()
 *
 * This function extracts the provider, model, and configuration information
 * from an agent instance. Useful for debugging, logging, and multi-provider
 * scenarios where you need to know which provider an agent is using.
 *
 * @param agent - The agent instance created with createAgent()
 * @returns AgentInfo object with provider/model details, or null if not SDK-created
 *
 * @example
 * ```typescript
 * const glmAgent = await createAgent({ provider: 'glm' });
 * const grokAgent = await createAgent({ provider: 'grok' });
 *
 * const glmInfo = getAgentInfo(glmAgent);
 * console.log(glmInfo?.provider);  // 'glm'
 * console.log(glmInfo?.model);     // 'glm-4.6'
 *
 * const grokInfo = getAgentInfo(grokAgent);
 * console.log(grokInfo?.provider); // 'grok'
 * console.log(grokInfo?.model);    // 'grok-3'
 * ```
 */
export function getAgentInfo(agent: LLMAgent): AgentInfo | null {
  const provider = (agent as any)._sdkProvider as ProviderType | undefined;
  const providerContext = (agent as any)._sdkProviderContext as ProviderContext | undefined;
  // BUG FIX: Use stored model/baseURL from creation time, not from settings
  // Settings could change after agent creation, giving wrong info
  const model = (agent as any)._sdkModel as string | undefined;
  const baseURL = (agent as any)._sdkBaseURL as string | undefined;
  // BUG FIX: Use the reliable _sdkDisposed flag instead of _sdkIsDisposed function
  // _sdkIsDisposed only exists when autoCleanup: true, but _sdkDisposed is always set
  const isDisposed = (agent as any)._sdkDisposed as boolean | undefined;
  const createdAt = (agent as any)._sdkCreatedAt as Date | undefined;

  if (!provider || !providerContext || !createdAt) {
    // Not created via SDK createAgent()
    return null;
  }

  const config = PROVIDER_CONFIGS[provider];

  return {
    provider,
    providerDisplayName: config.displayName,
    model,
    baseURL,
    isDisposed: isDisposed ?? false,
    configDir: providerContext.userDir,
    cliName: config.cliName,
    createdAt,
  };
}

/**
 * Get the model an agent is using
 *
 * Quick accessor to get just the model name from an SDK-created agent.
 * Returns undefined if the agent was not created via createAgent().
 *
 * @param agent - The agent instance
 * @returns The model name or undefined
 *
 * @example
 * ```typescript
 * const agent = await createAgent({ provider: 'glm' });
 * console.log(getAgentModel(agent)); // 'glm-4.6'
 * ```
 */
export function getAgentModel(agent: LLMAgent): string | undefined {
  return (agent as any)._sdkModel as string | undefined;
}

/**
 * Get the base URL an agent is using
 *
 * Quick accessor to get just the base URL from an SDK-created agent.
 * Returns undefined if the agent was not created via createAgent().
 *
 * @param agent - The agent instance
 * @returns The base URL or undefined
 *
 * @example
 * ```typescript
 * const agent = await createAgent({ provider: 'grok' });
 * console.log(getAgentBaseURL(agent)); // 'https://api.x.ai/v1'
 * ```
 */
export function getAgentBaseURL(agent: LLMAgent): string | undefined {
  return (agent as any)._sdkBaseURL as string | undefined;
}

/**
 * Get the provider an agent is using
 *
 * Quick accessor to get just the provider type from an SDK-created agent.
 * Returns undefined if the agent was not created via createAgent().
 *
 * @param agent - The agent instance
 * @returns The provider type or undefined
 *
 * @example
 * ```typescript
 * const agent = await createAgent({ provider: 'glm' });
 * console.log(getAgentProvider(agent)); // 'glm'
 * ```
 */
export function getAgentProvider(agent: LLMAgent): ProviderType | undefined {
  return (agent as any)._sdkProvider as ProviderType | undefined;
}

/**
 * Get when an agent was created
 *
 * Quick accessor to get the creation timestamp from an SDK-created agent.
 * Useful for logging, monitoring, and debugging agent lifecycle.
 * Returns undefined if the agent was not created via createAgent().
 *
 * @param agent - The agent instance
 * @returns The creation Date or undefined
 *
 * @example
 * ```typescript
 * const agent = await createAgent();
 * console.log(getAgentCreatedAt(agent)); // Date object
 * ```
 */
export function getAgentCreatedAt(agent: LLMAgent): Date | undefined {
  return (agent as any)._sdkCreatedAt as Date | undefined;
}

/**
 * Get how long an agent has been running (age in milliseconds)
 *
 * Returns the time elapsed since the agent was created. Useful for:
 * - Monitoring long-running agents
 * - Implementing agent timeouts
 * - Debugging performance issues
 * - Logging agent lifecycle metrics
 *
 * @param agent - The agent instance
 * @returns Age in milliseconds, or undefined if not SDK-created
 *
 * @example
 * ```typescript
 * const agent = await createAgent();
 *
 * // ... some work ...
 *
 * const ageMs = getAgentAge(agent);
 * if (ageMs !== undefined) {
 *   console.log(`Agent running for ${Math.round(ageMs / 1000)}s`);
 *
 *   // Implement timeout
 *   if (ageMs > 5 * 60 * 1000) { // 5 minutes
 *     console.warn('Agent running too long, disposing');
 *     agent.dispose();
 *   }
 * }
 * ```
 */
export function getAgentAge(agent: LLMAgent): number | undefined {
  const createdAt = (agent as any)._sdkCreatedAt as Date | undefined;
  if (!createdAt) {
    return undefined;
  }
  return Date.now() - createdAt.getTime();
}

/**
 * Format agent age as human-readable string
 *
 * Convenience function to get agent age as a formatted string.
 * Returns undefined if agent was not created via createAgent().
 *
 * @param agent - The agent instance
 * @returns Formatted age string (e.g., "1m 30s", "2h 15m"), or undefined
 *
 * @example
 * ```typescript
 * const agent = await createAgent();
 * // ... work ...
 * console.log(`Agent age: ${formatAgentAge(agent)}`); // "Agent age: 1m 30s"
 * ```
 */
export function formatAgentAge(agent: LLMAgent): string | undefined {
  const ageMs = getAgentAge(agent);
  if (ageMs === undefined) {
    return undefined;
  }

  const seconds = Math.floor(ageMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Check if an agent is busy (bash executing) or disposed
 *
 * This function provides a quick check to determine if an agent is available
 * to process new messages. An agent is considered "busy" if:
 * - It has been disposed (cannot be used at all)
 * - It is currently executing a bash command
 *
 * Useful for:
 * - Pre-flight checks before sending messages
 * - Implementing request queuing
 * - Health monitoring dashboards
 *
 * @param agent - The agent instance to check
 * @returns Object with availability status
 *
 * @example
 * ```typescript
 * const agent = await createAgent();
 *
 * // Check before processing
 * const status = getAgentStatus(agent);
 * if (!status.available) {
 *   console.log('Agent not available:', status.reason);
 *   return;
 * }
 *
 * await agent.processUserMessage('Hello');
 * ```
 */
export function getAgentStatus(agent: LLMAgent): {
  /** Whether the agent is available to process messages */
  available: boolean;
  /** Whether the agent has been disposed */
  isDisposed: boolean;
  /** Whether the agent is executing bash command */
  isBusy: boolean;
  /** Reason why agent is unavailable (if not available) */
  reason?: string;
  /** Agent age in milliseconds (if SDK-created) */
  ageMs?: number;
} {
  const disposed = isAgentDisposed(agent);
  const isBusy = typeof agent.isBashExecuting === 'function'
    ? agent.isBashExecuting()
    : false;

  const isDisposed = disposed === true;
  const available = !isDisposed && !isBusy;

  let reason: string | undefined;
  if (isDisposed) {
    reason = 'Agent has been disposed';
  } else if (isBusy) {
    reason = 'Agent is currently executing bash command';
  }

  return {
    available,
    isDisposed,
    isBusy,
    reason,
    ageMs: getAgentAge(agent),
  };
}

/**
 * Result of a provider health check
 */
export interface ProviderHealthResult {
  /** Whether the provider is healthy and ready */
  healthy: boolean;
  /** Provider type checked */
  provider: ProviderType;
  /** Whether API key is configured */
  hasApiKey: boolean;
  /** Whether base URL is configured */
  hasBaseURL: boolean;
  /** Whether model is configured */
  hasModel: boolean;
  /** Human-readable status message */
  message: string;
  /** Error details if unhealthy */
  error?: string;
}

/**
 * Check if a provider is properly configured and ready to use
 *
 * This function validates that a provider has all required configuration
 * (API key, base URL, model) without actually creating an agent or making
 * API calls. Useful for:
 * - Pre-flight checks before creating agents
 * - Setup wizards and configuration UIs
 * - Health checks in long-running services
 *
 * @param provider - Provider to check (defaults to auto-detect)
 * @returns ProviderHealthResult with configuration status
 *
 * @example
 * ```typescript
 * // Check specific provider
 * const glmHealth = checkProviderHealth('glm');
 * if (!glmHealth.healthy) {
 *   console.error('GLM not configured:', glmHealth.message);
 *   console.log('Run: ax-glm setup');
 * }
 *
 * // Check all providers
 * const providers: ProviderType[] = ['glm', 'grok'];
 * for (const p of providers) {
 *   const health = checkProviderHealth(p);
 *   console.log(`${p}: ${health.healthy ? '✓' : '✗'} ${health.message}`);
 * }
 * ```
 */
export function checkProviderHealth(provider?: ProviderType): ProviderHealthResult {
  const targetProvider = provider ?? detectProvider();
  const config = PROVIDER_CONFIGS[targetProvider];
  const settings = ProviderSettingsManager.forProvider(targetProvider);

  const hasApiKey = !!settings.getApiKey();
  const hasBaseURL = !!settings.getBaseURL();
  const hasModel = !!settings.getCurrentModel();

  const issues: string[] = [];
  if (!hasApiKey) issues.push('API key missing');
  if (!hasBaseURL) issues.push('Base URL missing');
  if (!hasModel) issues.push('Model not set');

  const healthy = hasApiKey && hasBaseURL && hasModel;

  let message: string;
  if (healthy) {
    message = `${config.displayName} is configured and ready`;
  } else {
    message = `${config.displayName} needs configuration: ${issues.join(', ')}`;
  }

  return {
    healthy,
    provider: targetProvider,
    hasApiKey,
    hasBaseURL,
    hasModel,
    message,
    error: healthy ? undefined : `Run "${config.cliName} setup" to configure`,
  };
}

/**
 * Get health status for all supported providers
 *
 * @returns Array of health results for all providers
 *
 * @example
 * ```typescript
 * const allHealth = getAllProviderHealth();
 * const configured = allHealth.filter(h => h.healthy);
 * console.log(`${configured.length} providers ready`);
 * ```
 */
export function getAllProviderHealth(): ProviderHealthResult[] {
  const providers: ProviderType[] = ['glm', 'grok', 'generic'];
  return providers.map(p => checkProviderHealth(p));
}

// ============================================================================
// Agent Lifecycle Utilities (v5.1 - High-Value Features)
// ============================================================================

/**
 * Check if an agent has been disposed
 *
 * This function provides a reliable way to check if an agent created with
 * createAgent() has been disposed. Works regardless of the `autoCleanup` setting.
 *
 * @param agent - The agent instance to check
 * @returns true if the agent has been disposed, false otherwise
 * @returns undefined if the agent was not created via createAgent()
 *
 * @example
 * ```typescript
 * const agent = await createAgent();
 * console.log(isAgentDisposed(agent)); // false
 *
 * agent.dispose();
 * console.log(isAgentDisposed(agent)); // true
 * ```
 */
export function isAgentDisposed(agent: LLMAgent): boolean | undefined {
  const disposed = (agent as any)._sdkDisposed;
  if (disposed === undefined) {
    // Not created via SDK createAgent()
    return undefined;
  }
  return disposed;
}

/**
 * Dispose an agent asynchronously, properly awaiting the onDispose hook
 *
 * The standard `agent.dispose()` is synchronous and fires async onDispose hooks
 * in a fire-and-forget manner. Use this function when you need to ensure the
 * onDispose hook completes before continuing.
 *
 * @param agent - The agent instance to dispose
 * @returns Promise that resolves when disposal is complete
 *
 * @example
 * ```typescript
 * const agent = await createAgent({
 *   onDispose: async () => {
 *     await saveState(); // This WILL be awaited with disposeAsync
 *   }
 * });
 *
 * // ... use agent ...
 *
 * // Properly await cleanup
 * await disposeAsync(agent);
 * console.log('Cleanup complete, state saved');
 * ```
 */
export async function disposeAsync(agent: LLMAgent): Promise<void> {
  // Get debug flag for logging
  const debug = (agent as any)._sdkDebug as boolean | undefined;

  // Check if this is an SDK-created agent
  const originalDispose = (agent as any)._sdkOriginalDispose;
  if (typeof originalDispose !== 'function') {
    // Not created via SDK createAgent() - fall back to regular dispose
    // This is a graceful fallback for non-SDK agents
    if (debug) {
      console.error('[AX SDK DEBUG] disposeAsync: Agent not created via createAgent(), using regular dispose');
    }
    agent.dispose();
    return;
  }

  // Check if already disposed
  const disposed = (agent as any)._sdkDisposed;
  if (disposed === true) {
    if (debug) {
      console.error('[AX SDK DEBUG] disposeAsync: Agent already disposed, skipping');
    }
    return; // Already disposed
  }

  // Get the onDispose hook if it exists
  const hooks = (agent as any)._sdkLifecycleHooks as {
    onDispose?: () => void | Promise<void>;
    onError?: (error: Error) => void;
  } | undefined;
  const onDispose = hooks?.onDispose;

  // Mark as disposed to prevent sync dispose() from running cleanup again
  (agent as any)._sdkDisposed = true;

  // Also mark the autoCleanup tracker as disposed to prevent signal handlers from triggering
  const markDisposed = (agent as any)._sdkMarkDisposed;
  if (markDisposed) {
    markDisposed();
  }

  // Call onDispose hook and await if it returns a promise
  if (onDispose) {
    try {
      if (debug) {
        console.error('[AX SDK DEBUG] disposeAsync: Calling onDispose hook');
      }
      const result = onDispose();
      if (result && typeof (result as Promise<void>).then === 'function') {
        await result;
      }
      if (debug) {
        console.error('[AX SDK DEBUG] disposeAsync: onDispose hook completed');
      }
    } catch (error) {
      // Log but don't throw - disposal should complete even if hook fails
      if (debug) {
        console.error('[AX SDK DEBUG] disposeAsync: Error in onDispose hook:', error);
      }
      // Users should handle errors in their onDispose hook
    }
  }

  // Remove cleanup handlers from process event listeners
  const cleanupHandler = (agent as any)._sdkCleanupHandler;
  if (cleanupHandler) {
    process.removeListener('exit', cleanupHandler);
    process.removeListener('SIGINT', cleanupHandler);
    process.removeListener('SIGTERM', cleanupHandler);
    process.removeListener('SIGHUP', cleanupHandler);
    delete (agent as any)._sdkCleanupHandler;
  }

  // Remove SDK-added event listeners
  const listeners = (agent as any)._sdkListeners as Array<{ event: string; listener: (...args: unknown[]) => void }> | undefined;
  if (listeners && listeners.length > 0 && typeof agent.off === 'function') {
    for (const { event, listener } of listeners) {
      agent.off(event, listener);
    }
    delete (agent as any)._sdkListeners;
  }

  // Call the stored original dispose directly, NOT agent.dispose()
  // agent.dispose() would call our wrapper which would:
  // 1. Skip because sdkDisposeCompleted might be false (closure variable)
  // 2. Or run the full wrapper logic including onDispose hook AGAIN
  // Instead, call _sdkOriginalDispose which is the unwrapped LLMAgent.dispose()
  originalDispose();

  if (debug) {
    console.error('[AX SDK DEBUG] disposeAsync: Disposal complete');
  }
}

/**
 * Information about a subagent's configuration
 */
export interface SubagentInfo {
  /** Provider type if configured */
  provider: ProviderType | undefined;
  /** Provider display name if configured */
  providerDisplayName: string | undefined;
  /** Configuration directory path if configured */
  configDir: string | undefined;
  /** CLI command name for this provider if configured */
  cliName: string | undefined;
  /** The subagent's role */
  role: import('../agent/subagent-types.js').SubagentRole;
}

/**
 * Get information about a subagent created with createSubagent()
 *
 * @param subagent - The subagent instance
 * @returns SubagentInfo object with provider details
 *
 * @example
 * ```typescript
 * const subagent = createSubagent(SubagentRole.TESTING, { provider: 'glm' });
 * const info = getSubagentInfo(subagent);
 * console.log(info.provider); // 'glm'
 * console.log(info.role);     // SubagentRole.TESTING
 * ```
 */
export function getSubagentInfo(subagent: Subagent): SubagentInfo {
  const provider = (subagent as any)._sdkProvider as ProviderType | undefined;
  const providerContext = (subagent as any)._sdkProviderContext as ProviderContext | undefined;

  let providerDisplayName: string | undefined;
  let configDir: string | undefined;
  let cliName: string | undefined;

  if (provider && providerContext) {
    const config = PROVIDER_CONFIGS[provider];
    providerDisplayName = config.displayName;
    configDir = providerContext.userDir;
    cliName = config.cliName;
  }

  return {
    provider,
    providerDisplayName,
    configDir,
    cliName,
    role: subagent.role,
  };
}
