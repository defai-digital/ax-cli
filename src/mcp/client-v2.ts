/**
 * Type-Safe MCP Client (Phase 1 Improvements)
 *
 * Improvements applied:
 * 1. SafeMutex with lock tokens (prevents race conditions)
 * 2. Result types for all public APIs (explicit error handling)
 * 3. State machine for connection tracking (type-safe states)
 * 4. Branded types for ServerName/ToolName (prevent confusion)
 * 5. Invariant checks (runtime validation)
 *
 * Coverage: 70% → 85%+ (Phase 1)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  ProgressNotificationSchema,
  ResourceUpdatedNotificationSchema,
  ResourceListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { EventEmitter } from "events";
import { createTransport, MCPTransport, TransportType } from "./transports.js";
import { MCP_CONFIG, ERROR_MESSAGES } from "../constants.js";
import { MCPServerConfigSchema } from "../schemas/settings-schemas.js";
import type { MCPServerConfig, MCPTransportConfig } from "../schemas/settings-schemas.js";
import { getTokenCounter } from "../utils/token-counter.js";

// Phase 1: Import type safety utilities
import { SafeKeyedMutex } from "./mutex-safe.js";
import { Result, Ok, Err, toError } from "./type-safety.js";
import {
  ServerName,
  ToolName,
  createServerName,
  createToolName
} from "./type-safety.js";
import {
  assertValidServerName
} from "./invariants.js";
import {
  type ProgressUpdate,
  type ProgressCallback,
  getProgressTracker
} from "./progress.js";
import {
  getCancellationManager,
  type CancellableRequest,
  type CancellationResult,
  isRequestCancelled
} from "./cancellation.js";
import {
  getSubscriptionManager,
  type ResourceSubscription
} from "./subscriptions.js";
import {
  getToolOutputValidator,
  type SchemaValidationResult
} from "./schema-validator.js";
import { randomUUID } from 'crypto';

// Re-export types for external use
export type { ProgressUpdate, ProgressCallback };
export type { CancellableRequest, CancellationResult };
export type { ResourceSubscription };
export type { SchemaValidationResult };

/**
 * Extended tool result with schema validation
 */
export interface ValidatedToolResult extends CallToolResult {
  /** Schema validation result (if tool has outputSchema) */
  schemaValidation?: SchemaValidationResult;
}
export type { MCPServerConfig, MCPTransportConfig, ServerName, ToolName };

/**
 * Connection State Machine
 *
 * Valid transitions:
 * - idle → connecting (addServer called)
 * - connecting → connected (connection succeeds)
 * - connecting → failed (connection fails)
 * - connected → disconnecting (removeServer called)
 * - disconnecting → idle (cleanup complete)
 * - failed → idle (reset)
 */
export type ConnectionState =
  | {
      status: 'idle';
      serverName: ServerName;
    }
  | {
      status: 'connecting';
      serverName: ServerName;
      startedAt: number;
      promise: Promise<Result<void, Error>>;
    }
  | {
      status: 'connected';
      serverName: ServerName;
      client: Client;
      transport: MCPTransport;
      connectedAt: number;
    }
  | {
      status: 'disconnecting';
      serverName: ServerName;
      client: Client;
      transport: MCPTransport;
    }
  | {
      status: 'failed';
      serverName: ServerName;
      error: Error;
      failedAt: number;
    };

/**
 * Reconnection Configuration
 *
 * Controls automatic reconnection behavior when MCP servers fail or disconnect.
 * Uses exponential backoff to avoid overwhelming failed servers.
 *
 * @example
 * ```typescript
 * const config: ReconnectionConfig = {
 *   enabled: true,
 *   maxRetries: 5,
 *   initialDelayMs: 1000,
 *   maxDelayMs: 30000,
 *   backoffMultiplier: 2
 * };
 * ```
 */
export interface ReconnectionConfig {
  /** Enable automatic reconnection on failure */
  enabled: boolean;

  /** Maximum number of reconnection attempts before giving up (default: 5) */
  maxRetries: number;

  /** Initial delay before first reconnection attempt in ms (default: 1000) */
  initialDelayMs: number;

  /** Maximum delay between reconnection attempts in ms (default: 30000) */
  maxDelayMs: number;

  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
}

/**
 * Default reconnection configuration
 */
export const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  enabled: true,
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: MCP_CONFIG.RECONNECT_MAX_DELAY,
  backoffMultiplier: 2
};

/**
 * Health Check Configuration
 */
export interface HealthCheckConfig {
  /** Enable periodic health checks */
  enabled: boolean;

  /** Interval between health checks in ms */
  intervalMs: number;
}

/**
 * Default health check configuration
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  enabled: true,
  intervalMs: MCP_CONFIG.HEALTH_CHECK_INTERVAL
};

/**
 * MCP Tool with branded types
 */
export interface MCPTool {
  name: ToolName;           // ✅ Branded type
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;       // ✅ NEW: Tool output schema (MCP 2025-06-18)
  serverName: ServerName;   // ✅ Branded type
}

/**
 * MCP Prompt from a server
 */
export interface MCPPrompt {
  serverName: ServerName;
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * MCP Server Capabilities Summary
 *
 * Provides a structured view of what an MCP server supports.
 * This enables agents to tailor their behavior based on server capabilities.
 *
 * For example, Figma MCP servers may support:
 * - Resource subscriptions for real-time design updates
 * - Progress notifications for long-running exports
 * - Tools with output schemas for structured responses
 */
export interface MCPServerCapabilities {
  // Resources
  /** Whether the server supports resources/list and resources/read */
  supportsResources: boolean;
  /** Whether the server supports resources/subscribe for real-time updates */
  supportsResourceSubscriptions: boolean;
  /** Whether the server emits notifications/resources/list_changed */
  supportsResourceListChanged: boolean;

  // Tools
  /** Whether the server supports tools/list and tools/call */
  supportsTools: boolean;
  /** Whether the server emits notifications/tools/list_changed */
  supportsToolListChanged: boolean;

  // Prompts
  /** Whether the server supports prompts/list and prompts/get */
  supportsPrompts: boolean;
  /** Whether the server emits notifications/prompts/list_changed */
  supportsPromptListChanged: boolean;

  // Logging
  /** Whether the server supports logging/setLevel */
  supportsLogging: boolean;

  // Experimental features (server-specific)
  experimental: Record<string, unknown>;

  // Raw capabilities for advanced use cases
  raw: Record<string, unknown>;
}

/**
 * Type-safe MCP Manager with improved safety
 */
export class MCPManagerV2 extends EventEmitter {
  // Phase 1: Replace Maps with state machine
  private connections: Map<ServerName, ConnectionState> = new Map();
  private tools: Map<ToolName, MCPTool> = new Map();
  private prompts: Map<string, MCPPrompt> = new Map(); // key: mcp__servername__promptname

  // Phase 1: Use SafeMutex instead of pendingConnections Map
  private connectionMutex = new SafeKeyedMutex();

  private initializationPromise: Promise<Result<void, Error>> | null = null;
  private tokenCounter = getTokenCounter();
  private disposed = false;
  private disposing = false;
  private disposePromise: Promise<Result<void, Error>> | null = null;

  // Phase 2: Reconnection management
  private reconnectionConfig: ReconnectionConfig;
  private healthCheckConfig: HealthCheckConfig;
  private reconnectionAttempts: Map<ServerName, number> = new Map();
  private reconnectionTimers: Map<ServerName, NodeJS.Timeout> = new Map();
  private serverConfigs: Map<ServerName, MCPServerConfig> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private healthCheckInFlight = false;

  // MCP Client identification (sent to MCP servers during initialization)
  private clientName: string;
  private clientVersion: string;

  constructor(
    reconnectionConfig: Partial<ReconnectionConfig> = {},
    healthCheckConfig: Partial<HealthCheckConfig> = {},
    clientConfig?: { name?: string; version?: string }
  ) {
    super();
    this.reconnectionConfig = {
      ...DEFAULT_RECONNECTION_CONFIG,
      ...reconnectionConfig
    };
    this.healthCheckConfig = {
      ...DEFAULT_HEALTH_CHECK_CONFIG,
      ...healthCheckConfig
    };
    // Use provided client name/version or fall back to MCP_CONFIG defaults
    this.clientName = clientConfig?.name ?? MCP_CONFIG.CLIENT_NAME;
    this.clientVersion = clientConfig?.version ?? MCP_CONFIG.CLIENT_VERSION;

    // Start health checks if enabled
    if (this.healthCheckConfig.enabled) {
      this.startHealthChecks();
    }
  }

  /**
   * Transition server to failed state (reduces duplication)
   */
  private _setFailedState(serverName: ServerName, error: Error): void {
    this.connections.set(serverName, {
      status: 'failed',
      serverName,
      error,
      failedAt: Date.now()
    });
  }

  /**
   * Add MCP server with type-safe connection management
   *
   * Phase 1 improvements:
   * - Returns Result instead of throwing
   * - Uses SafeMutex for concurrency control
   * - Tracks state machine transitions
   * - Validates inputs with invariants
   */
  async addServer(config: MCPServerConfig): Promise<Result<void, Error>> {
    // Phase 1: Check if disposed
    if (this.disposed || this.disposing) {
      return Err(new Error('MCPManager is disposed'));
    }

    // Phase 1: Validate server name (branded type creation)
    const serverName = createServerName(config.name);
    if (!serverName) {
      return Err(new Error(`Invalid server name: "${config.name}"`));
    }

    // Phase 1: Check current state
    const currentState = this.connections.get(serverName);

    if (currentState) {
      switch (currentState.status) {
        case 'connected':
          return Ok(undefined); // Already connected

        case 'connecting':
          // Wait for existing connection attempt
          return await currentState.promise;

        case 'disconnecting':
          return Err(new Error(`Server ${serverName} is disconnecting`));

        case 'failed':
          // Can retry after failure
          break;

        case 'idle':
          // Can connect
          break;
      }
    }

    // Phase 1: Use SafeMutex for concurrency control
    const mutexResult = await this.connectionMutex.runExclusive(
      serverName,
      async () => {
        // Double-check state inside mutex
        const state = this.connections.get(serverName);
        if (state?.status === 'connected') {
          return Ok(undefined);
        }

        return await this._addServerInternal(serverName, config);
      }
    );

    // Unwrap nested Result
    if (!mutexResult.success) {
      return mutexResult;
    }
    return mutexResult.value;
  }

  /**
   * Internal connection logic with state transitions
   */
  private async _addServerInternal(
    serverName: ServerName,
    config: MCPServerConfig
  ): Promise<Result<void, Error>> {
    // Validate config with Zod
    const validationResult = MCPServerConfigSchema.safeParse(config);
    if (!validationResult.success) {
      const error = new Error(`Invalid MCP server config: ${validationResult.error.message}`);
      this._setFailedState(serverName, error);
      return Err(error);
    }

    const validatedConfig = validationResult.data;

    // Phase 2: Store server config for reconnection attempts
    this.serverConfigs.set(serverName, validatedConfig);

    // Handle legacy stdio-only configuration
    let transportConfig = validatedConfig.transport;
    if (!transportConfig && validatedConfig.command) {
      transportConfig = {
        type: 'stdio' as const,
        command: validatedConfig.command,
        args: validatedConfig.args,
        env: validatedConfig.env
      };
    }

    if (!transportConfig) {
      const error = new Error(ERROR_MESSAGES.TRANSPORT_CONFIG_REQUIRED);
      this._setFailedState(serverName, error);
      return Err(error);
    }

    // Pass quiet option from server config to transport config
    const transportWithQuiet = {
      ...transportConfig,
      quiet: validatedConfig.quiet ?? false
    };

    try {
      // Transition to connecting state
      const startedAt = Date.now();
      const connectingPromise = (async (): Promise<Result<void, Error>> => {
        try {
          // Create transport (with quiet option for stderr suppression)
          const transport = createTransport(transportWithQuiet);

          // Create client with provider-specific identification
          const client = new Client(
            {
              name: this.clientName,
              version: this.clientVersion
            },
            {
              capabilities: {}  // SDK v1.22+ doesn't have tools in client capabilities
            }
          );

          // Connect with configurable initialization timeout
          // Default is MCP_CONFIG.DEFAULT_TIMEOUT (60s), but servers using npx may need longer
          const initTimeout = validatedConfig.initTimeout ?? MCP_CONFIG.DEFAULT_TIMEOUT;
          const sdkTransport = await transport.connect();
          await client.connect(sdkTransport, { timeout: initTimeout });

          // Set up MCP notification handlers for progress and resource updates
          this.setupNotificationHandlers(client, serverName);

          // If dispose started while connecting, shut down and abort transition
          if (this.disposing || this.disposed) {
            try {
              await client.close();
            } catch {
              // best-effort close during disposal
            }
            try {
              await transport.disconnect();
            } catch {
              // ignore during disposal
            }

            // Remove the stale connecting entry so shutdown can proceed
            const state = this.connections.get(serverName);
            if (state?.status === 'connecting') {
              this.connections.delete(serverName);
            }
            return Err(new Error(`MCPManager is disposing - aborted connection for ${serverName}`));
          }

          // List tools
          const toolsResult = await client.listTools();

          // Register tools with branded types
          for (const tool of toolsResult.tools) {
            const toolName = createToolName(`mcp__${serverName}__${tool.name}`);
            if (!toolName) {
              console.warn(`Invalid tool name: ${tool.name}`);
              continue;
            }

            const mcpTool: MCPTool = {
              name: toolName,
              description: tool.description || `Tool from ${serverName} server`,
              inputSchema: tool.inputSchema,
              // MCP 2025-06-18: Include output schema if provided by server
              outputSchema: (tool as any).outputSchema,
              serverName
            };
            this.tools.set(toolName, mcpTool);
          }

          // Transition to connected state
          this.connections.set(serverName, {
            status: 'connected',
            serverName,
            client,
            transport,
            connectedAt: Date.now()
          });

          this.emit('serverAdded', serverName, toolsResult.tools.length);
          return Ok(undefined);

        } catch (error) {
          const err = toError(error);
          this._setFailedState(serverName, err);
          this.emit('serverError', serverName, err);

          if (this.reconnectionConfig.enabled && !this.disposed) {
            this.scheduleReconnection(serverName, validatedConfig);
          }

          return Err(err);
        }
      })();

      this.connections.set(serverName, {
        status: 'connecting',
        serverName,
        startedAt,
        promise: connectingPromise
      });

      return await connectingPromise;

    } catch (error) {
      const err = toError(error);
      this._setFailedState(serverName, err);

      if (this.reconnectionConfig.enabled && !this.disposed) {
        this.scheduleReconnection(serverName, validatedConfig);
      }

      return Err(err);
    }
  }

  /**
   * Remove MCP server with proper state transitions
   */
  async removeServer(serverName: ServerName): Promise<Result<void, Error>> {
    // Phase 1: Check if disposed
    if (this.disposed) {
      return Err(new Error('MCPManager is disposed'));
    }

    // Phase 1: Validate server name
    assertValidServerName(serverName);

    // Phase 2: Cancel any pending reconnection attempts
    this.cancelReconnection(serverName);
    this.reconnectionAttempts.delete(serverName);
    this.serverConfigs.delete(serverName);

    // BUG FIX: Use mutex to prevent TOCTOU race with addServer/callTool
    const mutexResult = await this.connectionMutex.runExclusive(
      serverName,
      async () => {
        // Re-check state inside mutex (prevent race conditions)
        const state = this.connections.get(serverName);
        if (!state) {
          return Err(new Error(`Server ${serverName} not found`));
        }

        // Check if we can disconnect from current state
        if (state.status === 'connecting') {
          return Err(new Error(`Server ${serverName} is still connecting`));
        }

        if (state.status === 'disconnecting') {
          return Err(new Error(`Server ${serverName} is already disconnecting`));
        }

        if (state.status !== 'connected') {
          // Remove from map if not connected
          this.connections.delete(serverName);
          return Ok(undefined);
        }

        return await this._removeServerInternal(serverName, state);
      }
    );

    // Unwrap nested Result
    if (!mutexResult.success) {
      return mutexResult;
    }
    return mutexResult.value;
  }

  /**
   * Internal disconnection logic with state transitions
   */
  private async _removeServerInternal(
    serverName: ServerName,
    state: Extract<ConnectionState, { status: 'connected' }>
  ): Promise<Result<void, Error>> {
    // Transition to disconnecting state
    this.connections.set(serverName, {
      status: 'disconnecting',
      serverName,
      client: state.client,
      transport: state.transport
    });

    try {
      // Remove tools
      for (const [toolName, tool] of this.tools.entries()) {
        if (tool.serverName === serverName) {
          this.tools.delete(toolName);
        }
      }

      // Disconnect client
      const clientResult = await this.closeClient(state.client, serverName);

      // Disconnect transport
      const transportResult = await this.disconnectTransport(state.transport, serverName);

      // Aggregate errors
      const errors: Error[] = [];
      if (!clientResult.success) errors.push(clientResult.error);
      if (!transportResult.success) errors.push(transportResult.error);

      // Transition to idle state
      this.connections.delete(serverName);

      this.emit('serverRemoved', serverName);

      if (errors.length > 0) {
        return Err(new AggregateError(errors, `Failed to fully disconnect ${serverName}`));
      }

      return Ok(undefined);

    } catch (error) {
      // Even if error, remove from state
      this.connections.delete(serverName);
      return Err(toError(error));
    }
  }

  /**
   * Close client with error handling
   */
  private async closeClient(
    client: Client,
    serverName: ServerName
  ): Promise<Result<void, Error>> {
    try {
      await client.close();
      return Ok(undefined);
    } catch (error) {
      const err = toError(error);
      console.warn(`Error closing MCP client ${serverName}:`, err);
      return Err(err);
    }
  }

  /**
   * Disconnect transport with error handling
   */
  private async disconnectTransport(
    transport: MCPTransport,
    serverName: ServerName
  ): Promise<Result<void, Error>> {
    try {
      await transport.disconnect();
      return Ok(undefined);
    } catch (error) {
      const err = toError(error);
      console.warn(`Error disconnecting MCP transport ${serverName}:`, err);
      return Err(err);
    }
  }

  /**
   * Call MCP tool with type safety and optional schema validation
   *
   * @param toolName - The tool to call
   * @param arguments_ - Tool arguments
   * @param options - Optional settings for validation and MCP _meta
   * @returns Result containing the tool result with optional schema validation
   */
  async callTool(
    toolName: ToolName,
    arguments_: Record<string, unknown> | null | undefined,
    options?: {
      validateOutput?: boolean;
      /** MCP _meta for progress tracking and cancellation */
      _meta?: {
        progressToken?: string | number;
        /** Request ID for cancellation (custom extension) */
        requestId?: string | number;
      };
      /** AbortSignal for cancellation */
      signal?: AbortSignal;
    }
  ): Promise<Result<ValidatedToolResult, Error>> {
    if (this.disposed) {
      return Err(new Error('MCPManager is disposed'));
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      return Err(new Error(`Tool ${toolName} not found`));
    }

    // BUG FIX: Get client reference inside mutex to prevent TOCTOU race with removeServer
    const mutexResult = await this.connectionMutex.runExclusive(
      tool.serverName,
      async () => {
        // Re-check state inside mutex
        const state = this.connections.get(tool.serverName);
        if (!state) {
          return Err(new Error(`Server ${tool.serverName} not found`));
        }

        if (state.status !== 'connected') {
          return Err(new Error(`Server ${tool.serverName} not connected (status: ${state.status})`));
        }

        // Return client snapshot (mutex released after this, but client reference is safe to use)
        return Ok(state.client);
      }
    );

    // Unwrap nested Result
    if (!mutexResult.success) {
      return mutexResult;
    }

    const clientResult = mutexResult.value;
    if (!clientResult.success) {
      return clientResult;
    }

    const client = clientResult.value;

    try {
      // BUG FIX: Re-validate connection state before making call to handle race with removeServer
      // Between mutex release and here, removeServer could have been called
      const currentState = this.connections.get(tool.serverName);
      if (!currentState || currentState.status !== 'connected') {
        return Err(new Error(
          `Server ${tool.serverName} disconnected during tool call preparation (status: ${currentState?.status ?? 'removed'})`
        ));
      }

      // Extract original tool name
      const prefix = `mcp__${tool.serverName}__`;
      const originalToolName = toolName.startsWith(prefix)
        ? toolName.substring(prefix.length)
        : toolName;

      // Validate arguments
      const safeArgs = (arguments_ && typeof arguments_ === 'object' && !Array.isArray(arguments_))
        ? arguments_
        : {};

      // Get server-specific timeout configuration
      const serverConfig = this.serverConfigs.get(tool.serverName);
      const timeout = serverConfig?.timeout ?? MCP_CONFIG.DEFAULT_TIMEOUT;

      // Build call params with optional _meta for progress/cancellation
      const callParams: {
        name: string;
        arguments: Record<string, unknown>;
        _meta?: { progressToken?: string | number; requestId?: string | number };
      } = {
        name: originalToolName,
        arguments: safeArgs
      };

      // Include _meta fields if provided (for progress tracking and cancellation)
      const meta: { progressToken?: string | number; requestId?: string | number } = {};
      if (options?._meta?.progressToken !== undefined) {
        meta.progressToken = options._meta.progressToken;
      }
      if (options?._meta?.requestId !== undefined) {
        meta.requestId = options._meta.requestId;
      }
      if (meta.progressToken !== undefined || meta.requestId !== undefined) {
        callParams._meta = meta;
      }

      // Build request options with timeout and optional abort signal
      const requestOptions: { timeout: number; signal?: AbortSignal } = { timeout };
      if (options?.signal) {
        requestOptions.signal = options.signal;
      }

      // Call tool with timeout (mutex released, but client reference is still valid)
      // MCP SDK accepts { timeout?: number, signal?: AbortSignal } as third parameter
      const result = await client.callTool(callParams, undefined, requestOptions);

      // Apply token limiting
      if (MCP_CONFIG.TRUNCATION_ENABLED) {
        const resultText = JSON.stringify(result.content);
        const tokenCount = this.tokenCounter.countTokens(resultText);

        if (tokenCount > MCP_CONFIG.TOKEN_HARD_LIMIT) {
          const truncatedText = this.truncateToTokenLimit(resultText, MCP_CONFIG.TOKEN_HARD_LIMIT);

          result.content = [
            { type: 'text', text: truncatedText },
            {
              type: 'text',
              text: `\n\n⚠️  Output truncated: ${tokenCount.toLocaleString()} tokens exceeded limit of ${MCP_CONFIG.TOKEN_HARD_LIMIT.toLocaleString()} tokens`
            }
          ];

          this.emit('token-limit-exceeded', {
            toolName,
            serverName: tool.serverName,
            originalTokens: tokenCount,
            truncatedTokens: MCP_CONFIG.TOKEN_HARD_LIMIT
          });
        } else if (tokenCount > MCP_CONFIG.TOKEN_WARNING_THRESHOLD) {
          this.emit('token-warning', {
            toolName,
            serverName: tool.serverName,
            tokenCount,
            threshold: MCP_CONFIG.TOKEN_WARNING_THRESHOLD
          });
        }
      }

      // Phase 2: Schema validation (if enabled and tool has outputSchema)
      const validatedResult: ValidatedToolResult = result as ValidatedToolResult;
      const shouldValidate = options?.validateOutput ?? true; // Default to enabled

      if (shouldValidate && tool.outputSchema) {
        const validator = getToolOutputValidator();
        const content = Array.isArray(result.content) ? result.content : [];
        const validationResult = validator.validateContent(tool.outputSchema, content);

        validatedResult.schemaValidation = validationResult;

        // Emit event on validation failure (for monitoring)
        if (validationResult.status === 'invalid') {
          this.emit('schema-validation-failed', {
            toolName,
            serverName: tool.serverName,
            errors: validationResult.errors,
          });
        }
      }

      return Ok(validatedResult);

    } catch (error) {
      // BUG FIX: Check if the error is due to server disconnection during call
      // This handles the race condition where removeServer was called mid-operation
      const currentState = this.connections.get(tool.serverName);
      if (!currentState || currentState.status === 'disconnecting' || currentState.status === 'failed') {
        return Err(new Error(
          `Server ${tool.serverName} was disconnected during tool execution. Original error: ${toError(error).message}`
        ));
      }
      return Err(toError(error));
    }
  }

  /**
   * Call MCP tool with progress tracking
   *
   * MCP Specification: Supports notifications/progress for long-running operations.
   *
   * FIX: Now properly forwards _meta.progressToken to the MCP server so it can
   * attach progress notifications to this specific request.
   *
   * @param toolName - The tool to call
   * @param arguments_ - Tool arguments
   * @param options - Progress tracking options
   * @returns Result containing the tool result or error
   */
  async callToolWithProgress(
    toolName: ToolName,
    arguments_: Record<string, unknown> | null | undefined,
    options?: {
      onProgress?: ProgressCallback;
    }
  ): Promise<Result<CallToolResult, Error>> {
    const progressTracker = getProgressTracker();
    const token = progressTracker.createToken();

    // Register progress callback
    if (options?.onProgress) {
      progressTracker.onProgress(token, options.onProgress);
    }

    try {
      // Call the base callTool with _meta.progressToken so the server knows
      // where to send progress notifications
      return await this.callTool(toolName, arguments_, {
        _meta: { progressToken: token }
      });
    } finally {
      progressTracker.cleanup(token);
    }
  }

  /**
   * Call MCP tool with cancellation support
   *
   * MCP Specification: Supports notifications/cancelled for aborting operations.
   *
   * FIX: Now properly propagates AbortSignal to the MCP SDK so cancellation
   * actually stops the server work instead of just racing locally. Also sends
   * notifications/cancelled to the server so it can clean up.
   *
   * @param toolName - The tool to call
   * @param arguments_ - Tool arguments
   * @returns Result containing the tool result, cancellation status, or error
   */
  async callToolCancellable(
    toolName: ToolName,
    arguments_: Record<string, unknown> | null | undefined
  ): Promise<Result<CallToolResult & { isCancelled?: boolean; cancelReason?: string }, Error>> {
    if (this.disposed) {
      return Err(new Error('MCPManager is disposed'));
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      return Err(new Error(`Tool ${toolName} not found`));
    }

    const cancellationManager = getCancellationManager();
    const requestId = randomUUID();
    const abortController = new AbortController();

    // Register the cancellable request
    cancellationManager.register({
      id: requestId,
      serverName: tool.serverName,
      toolName,
      startedAt: new Date(),
      abortController,
    });

    try {
      // FIX: Pass AbortSignal directly to the MCP SDK so cancellation actually
      // stops the server work. The SDK will abort the underlying request when
      // the signal is triggered.
      const result = await this.callTool(toolName, arguments_, {
        _meta: { requestId },
        signal: abortController.signal
      });

      // Check if the signal was aborted after the call completed
      if (abortController.signal.aborted) {
        return Ok({
          content: [],
          isCancelled: true,
          cancelReason: 'User cancelled',
        } as CallToolResult & { isCancelled: boolean; cancelReason: string });
      }

      return result;
    } catch (error) {
      // Check if this was a cancellation (either from our manager or SDK abort)
      const err = toError(error);
      const isAborted = abortController.signal.aborted ||
                        cancellationManager.isCancelled(requestId) ||
                        isRequestCancelled(error) ||
                        err.name === 'AbortError';

      if (isAborted) {
        return Ok({
          content: [],
          isCancelled: true,
          cancelReason: 'User cancelled',
        } as CallToolResult & { isCancelled: boolean; cancelReason: string });
      }
      return Err(err);
    } finally {
      cancellationManager.cleanup(requestId);
    }
  }

  /**
   * Cancel the most recent active request
   *
   * @param reason - Optional reason for cancellation
   * @returns Cancellation result
   */
  async cancelCurrentRequest(reason?: string): Promise<CancellationResult | undefined> {
    const cancellationManager = getCancellationManager();
    const request = cancellationManager.getMostRecentRequest();
    if (request) {
      return await cancellationManager.cancel(request.id, reason);
    }
    return undefined;
  }

  /**
   * Cancel all active requests
   *
   * @param reason - Optional reason for cancellation
   * @returns Array of cancellation results
   */
  async cancelAllRequests(reason?: string): Promise<CancellationResult[]> {
    const cancellationManager = getCancellationManager();
    return await cancellationManager.cancelAll(reason);
  }

  /**
   * Check if there are any active cancellable requests
   */
  hasActiveRequests(): boolean {
    return getCancellationManager().hasActiveRequests();
  }

  /**
   * Get the count of active cancellable requests
   */
  getActiveRequestCount(): number {
    return getCancellationManager().getActiveRequestCount();
  }

  // =========================================================================
  // Resource Subscriptions (MCP 2025-06-18)
  // =========================================================================

  /**
   * Subscribe to a resource
   *
   * @param serverName - Server providing the resource
   * @param uri - Resource URI to subscribe to
   * @returns Result indicating success or error
   */
  async subscribeResource(
    serverName: ServerName,
    uri: string
  ): Promise<Result<void, Error>> {
    return await getSubscriptionManager().subscribe(serverName, uri);
  }

  /**
   * Unsubscribe from a resource
   *
   * @param serverName - Server providing the resource
   * @param uri - Resource URI to unsubscribe from
   * @returns Result indicating success or error
   */
  async unsubscribeResource(
    serverName: ServerName,
    uri: string
  ): Promise<Result<void, Error>> {
    return await getSubscriptionManager().unsubscribe(serverName, uri);
  }

  /**
   * Get all active resource subscriptions
   */
  getResourceSubscriptions(): ResourceSubscription[] {
    return getSubscriptionManager().getActiveSubscriptions();
  }

  /**
   * Check if subscribed to a resource
   */
  isSubscribedToResource(serverName: ServerName, uri: string): boolean {
    return getSubscriptionManager().isSubscribed(serverName, uri);
  }

  /**
   * Set up notification handlers for MCP server
   *
   * Handles:
   * - notifications/progress - Progress updates for long-running operations
   * - notifications/resources/updated - Resource change notifications
   * - notifications/resources/list_changed - Resource list changes
   */
  private setupNotificationHandlers(client: Client, serverName: ServerName): void {
    const progressTracker = getProgressTracker();

    // Handle progress notifications
    try {
      client.setNotificationHandler(
        ProgressNotificationSchema,
        (notification) => {
          const { params } = notification;
          if (params.progressToken !== undefined && params.progress !== undefined) {
            progressTracker.handleNotification({
              progressToken: params.progressToken,
              progress: params.progress,
              total: params.total,
              message: undefined, // Not in standard schema
            });
            this.emit('progress', { serverName, ...params });
          }
        }
      );
    } catch {
      // Server may not support progress notifications
    }

    // Handle resource update notifications
    const subscriptionManager = getSubscriptionManager();
    try {
      client.setNotificationHandler(
        ResourceUpdatedNotificationSchema,
        (notification) => {
          const { params } = notification;
          if (params.uri) {
            subscriptionManager.handleResourceUpdated(serverName, params.uri);
            this.emit('resource-updated', serverName, params.uri);
          }
        }
      );
    } catch {
      // Server may not support resource notifications
    }

    // Handle resource list change notifications
    try {
      client.setNotificationHandler(
        ResourceListChangedNotificationSchema,
        () => {
          subscriptionManager.handleResourceListChanged(serverName);
          this.emit('resource-list-changed', serverName);
        }
      );
    } catch {
      // Server may not support resource notifications
    }

    // Wire up subscription manager with request sender
    subscriptionManager.setSendRequest(async (srvName, method, uri) => {
      if (srvName !== serverName) {
        return Err(new Error(`Server mismatch: ${srvName} vs ${serverName}`));
      }

      try {
        if (method === 'resources/subscribe') {
          await client.subscribeResource({ uri });
        } else {
          await client.unsubscribeResource({ uri });
        }
        return Ok(undefined);
      } catch (error) {
        return Err(error instanceof Error ? error : new Error(String(error)));
      }
    });

    // Wire up subscription manager capabilities checker
    subscriptionManager.setCheckCapabilities(async (srvName) => {
      if (srvName !== serverName) {
        return { supportsSubscriptions: false };
      }

      // Check server capabilities
      const caps = client.getServerCapabilities();
      return {
        supportsSubscriptions: Boolean(caps?.resources?.subscribe),
      };
    });

    // Wire up cancellation notification sender
    const cancellationManager = getCancellationManager();
    cancellationManager.setSendNotification(async (srvName, requestId, reason) => {
      if (srvName !== serverName) return;

      try {
        // Send cancellation notification via the client
        await client.notification({
          method: 'notifications/cancelled',
          params: {
            requestId,
            reason: reason ?? 'User cancelled',
          },
        });
      } catch {
        // Server may not support cancellation
      }
    });
  }

  /**
   * Truncate text to fit within token limit
   * UNICODE FIX: Uses grapheme clusters
   */
  private truncateToTokenLimit(text: string, maxTokens: number): string {
    // BUG FIX: Handle edge case where maxTokens is 0 or negative
    if (maxTokens <= 0) {
      return '';
    }

    const chars = Array.from(text);

    // BUG FIX: Initialize result to empty string, not full text
    // This ensures that if no valid truncation is found, we return empty
    let low = 0;
    let high = chars.length;
    let result = '';

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const truncated = chars.slice(0, mid).join('');
      const tokens = this.tokenCounter.countTokens(truncated);

      if (tokens <= maxTokens) {
        result = truncated;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result;
  }

  /**
   * Get all tools
   */
  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all connected servers
   */
  getServers(): ServerName[] {
    const connected: ServerName[] = [];
    for (const [serverName, state] of this.connections.entries()) {
      if (state.status === 'connected') {
        connected.push(serverName);
      }
    }
    return connected;
  }

  /**
   * Get MCP connection status summary
   * Returns counts of connected, failed, connecting, and total servers
   */
  getConnectionStatus(): { connected: number; failed: number; connecting: number; total: number } {
    let connected = 0;
    let failed = 0;
    let connecting = 0;

    for (const state of this.connections.values()) {
      switch (state.status) {
        case 'connected':
          connected++;
          break;
        case 'failed':
          failed++;
          break;
        case 'connecting':
          connecting++;
          break;
      }
    }

    return {
      connected,
      failed,
      connecting,
      total: this.connections.size,
    };
  }

  /**
   * Get connection state for a server
   */
  getConnectionState(serverName: ServerName): ConnectionState | undefined {
    return this.connections.get(serverName);
  }

  /**
   * Get all prompts from connected servers
   */
  getPrompts(): MCPPrompt[] {
    return Array.from(this.prompts.values());
  }

  /**
   * List prompts from a specific server
   */
  async listServerPrompts(serverName: ServerName): Promise<Result<MCPPrompt[], Error>> {
    // BUG FIX: Check disposed flag before operating on resources
    if (this.disposed) {
      return Err(new Error('MCPManager has been disposed'));
    }

    const state = this.connections.get(serverName);

    if (!state || state.status !== 'connected') {
      return Err(new Error(`Server ${serverName} not connected`));
    }

    try {
      const result = await state.client.listPrompts();
      const serverPrompts: MCPPrompt[] = [];

      for (const prompt of result.prompts) {
        const mcpPrompt: MCPPrompt = {
          serverName,
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
        };
        const key = `mcp__${serverName}__${prompt.name}`;
        this.prompts.set(key, mcpPrompt);
        serverPrompts.push(mcpPrompt);
      }

      return Ok(serverPrompts);
    } catch {
      // Server may not support prompts - return empty array
      return Ok([]);
    }
  }

  /**
   * Get a specific prompt from a server
   */
  async getPrompt(
    serverName: ServerName,
    promptName: string,
    args?: Record<string, string>
  ): Promise<Result<{ description?: string; messages: unknown[] }, Error>> {
    // BUG FIX: Check disposed flag before operating on resources
    if (this.disposed) {
      return Err(new Error('MCPManager has been disposed'));
    }

    const state = this.connections.get(serverName);

    if (!state || state.status !== 'connected') {
      return Err(new Error(`Server ${serverName} not connected`));
    }

    try {
      const result = await state.client.getPrompt({
        name: promptName,
        arguments: args,
      });

      return Ok({
        description: result.description,
        messages: result.messages || [],
      });
    } catch (error) {
      return Err(toError(error));
    }
  }

  /**
   * Discover prompts from all connected servers
   * PERF: Parallelized - servers are independent, no need to wait sequentially
   */
  async discoverPrompts(): Promise<void> {
    if (this.disposed) {
      return;
    }

    const connectedServers = this.getServers();
    if (connectedServers.length === 0) {
      return;
    }

    // Parallel discovery - each server is independent
    await Promise.allSettled(
      connectedServers.map(serverName => this.listServerPrompts(serverName))
    );
  }

  /**
   * Get transport type for a server
   */
  getTransportType(serverName: ServerName): Result<TransportType, Error> {
    const state = this.connections.get(serverName);

    if (!state) {
      return Err(new Error(`Server ${serverName} not found`));
    }

    if (state.status !== 'connected') {
      return Err(new Error(`Server ${serverName} not connected`));
    }

    const type = state.transport.getType();
    return Ok(type);
  }

  // =========================================================================
  // Server Capabilities (Figma MCP Fix #3)
  // =========================================================================

  /**
   * Get capabilities for a specific MCP server
   *
   * This allows agents to tailor their behavior based on server capabilities.
   * For example, Figma MCP servers may support long-running exports with progress.
   *
   * @param serverName - The server to query capabilities for
   * @returns Result containing capability summary or error
   *
   * @example
   * ```typescript
   * const caps = manager.getServerCapabilities(serverName);
   * if (caps.success && caps.value.supportsProgress) {
   *   // Use callToolWithProgress for better UX
   *   await manager.callToolWithProgress(toolName, args, { onProgress });
   * }
   * ```
   */
  getServerCapabilities(serverName: ServerName): Result<MCPServerCapabilities, Error> {
    if (this.disposed) {
      return Err(new Error('MCPManager is disposed'));
    }

    const state = this.connections.get(serverName);
    if (!state) {
      return Err(new Error(`Server ${serverName} not found`));
    }

    if (state.status !== 'connected') {
      return Err(new Error(`Server ${serverName} not connected (status: ${state.status})`));
    }

    try {
      const rawCaps = state.client.getServerCapabilities();

      const capabilities: MCPServerCapabilities = {
        // Resources support
        supportsResources: Boolean(rawCaps?.resources),
        supportsResourceSubscriptions: Boolean(rawCaps?.resources?.subscribe),
        supportsResourceListChanged: Boolean(rawCaps?.resources?.listChanged),

        // Tools support
        supportsTools: Boolean(rawCaps?.tools),
        supportsToolListChanged: Boolean(rawCaps?.tools?.listChanged),

        // Prompts support
        supportsPrompts: Boolean(rawCaps?.prompts),
        supportsPromptListChanged: Boolean(rawCaps?.prompts?.listChanged),

        // Logging support
        supportsLogging: Boolean(rawCaps?.logging),

        // Experimental features
        experimental: rawCaps?.experimental || {},

        // Raw capabilities for advanced use
        raw: rawCaps || {},
      };

      return Ok(capabilities);
    } catch (error) {
      return Err(toError(error));
    }
  }

  /**
   * Get capabilities for all connected servers
   *
   * @returns Map of server names to their capabilities
   */
  getAllServerCapabilities(): Map<ServerName, MCPServerCapabilities> {
    const result = new Map<ServerName, MCPServerCapabilities>();

    for (const serverName of this.getServers()) {
      const caps = this.getServerCapabilities(serverName);
      if (caps.success) {
        result.set(serverName, caps.value);
      }
    }

    return result;
  }

  /**
   * Check if a server supports a specific capability
   *
   * @param serverName - Server to check
   * @param capability - Capability to check for
   * @returns true if the server supports the capability
   */
  serverSupports(
    serverName: ServerName,
    capability: keyof Omit<MCPServerCapabilities, 'experimental' | 'raw'>
  ): boolean {
    const caps = this.getServerCapabilities(serverName);
    if (!caps.success) {
      return false;
    }
    return Boolean(caps.value[capability]);
  }

  // =========================================================================
  // Resource Access (Fix for resources.ts compatibility)
  // =========================================================================

  /**
   * Get the MCP client for a specific server
   *
   * This is used by resources.ts to access listResources/readResource
   *
   * @param serverName - The server name
   * @returns Result containing the client or error
   */
  getClient(serverName: ServerName): Result<Client, Error> {
    if (this.disposed) {
      return Err(new Error('MCPManager is disposed'));
    }

    const state = this.connections.get(serverName);
    if (!state) {
      return Err(new Error(`Server ${serverName} not found`));
    }

    if (state.status !== 'connected') {
      return Err(new Error(`Server ${serverName} not connected (status: ${state.status})`));
    }

    return Ok(state.client);
  }

  /**
   * List resources from a specific server
   *
   * @param serverName - The server name
   * @returns Result containing resources or error
   */
  async listResources(serverName: ServerName): Promise<Result<Array<{ uri: string; name: string; description?: string; mimeType?: string }>, Error>> {
    if (this.disposed) {
      return Err(new Error('MCPManager is disposed'));
    }

    const clientResult = this.getClient(serverName);
    if (!clientResult.success) {
      return clientResult;
    }

    try {
      const result = await clientResult.value.listResources();
      return Ok(result.resources.map(r => ({
        uri: r.uri,
        name: r.name || r.uri,
        description: r.description,
        mimeType: r.mimeType,
      })));
    } catch (error) {
      // Server may not support resources
      return Ok([]);
    }
  }

  /**
   * Read a resource from a specific server
   *
   * @param serverName - The server name
   * @param uri - Resource URI
   * @returns Result containing resource content or error
   */
  async readResource(serverName: ServerName, uri: string): Promise<Result<string, Error>> {
    if (this.disposed) {
      return Err(new Error('MCPManager is disposed'));
    }

    const clientResult = this.getClient(serverName);
    if (!clientResult.success) {
      return clientResult;
    }

    try {
      const result = await clientResult.value.readResource({ uri });

      // Extract text content
      if (result.contents && result.contents.length > 0) {
        const content = result.contents[0];
        if ('text' in content && content.text) {
          return Ok(content.text);
        }
        if ('blob' in content && content.blob) {
          // Handle base64 encoded content
          return Ok(Buffer.from(content.blob, 'base64').toString('utf-8'));
        }
      }

      return Ok('');
    } catch (error) {
      return Err(toError(error));
    }
  }

  /**
   * Schedule reconnection for a failed server with exponential backoff
   *
   * Phase 2: Automatic reconnection logic
   *
   * @param serverName - Server to reconnect
   * @param config - Server configuration
   */
  private scheduleReconnection(serverName: ServerName, config: MCPServerConfig): void {
    // Cancel any existing reconnection timer
    this.cancelReconnection(serverName);

    // Get current attempt count
    const attempts = this.reconnectionAttempts.get(serverName) || 0;

    // Check if we've exceeded max retries
    if (attempts >= this.reconnectionConfig.maxRetries) {
      this.emit('reconnection-failed', serverName, attempts, 'Max retries exceeded');
      return;
    }

    // Calculate exponential backoff delay
    const baseDelay = this.reconnectionConfig.initialDelayMs;
    const multiplier = Math.pow(this.reconnectionConfig.backoffMultiplier, attempts);
    const calculatedDelay = Math.min(
      baseDelay * multiplier,
      this.reconnectionConfig.maxDelayMs
    );

    // Emit reconnection scheduled event
    this.emit('reconnection-scheduled', serverName, attempts + 1, calculatedDelay);

    // Schedule reconnection attempt
    const timer = setTimeout(() => {
      // BUG FIX: Check if disposed before attempting reconnection
      // Timer may fire after dispose() was called
      if (this.disposing) {
        return;
      }

      // Increment attempt count
      this.reconnectionAttempts.set(serverName, attempts + 1);

      // Attempt reconnection (wrapped in IIFE to handle async properly)
      void (async () => {
        const result = await this.addServer(config);

        if (result.success) {
          // Success! Reset attempt counter
          this.reconnectionAttempts.delete(serverName);
          this.emit('reconnection-succeeded', serverName, attempts + 1);
        }
        // Failed - will be rescheduled by addServer error handling
        // (which calls scheduleReconnection again)
      })();
    }, calculatedDelay);

    this.reconnectionTimers.set(serverName, timer);
  }

  /**
   * Cancel reconnection for a server
   */
  private cancelReconnection(serverName: ServerName): void {
    const timer = this.reconnectionTimers.get(serverName);
    if (timer) {
      clearTimeout(timer);
      this.reconnectionTimers.delete(serverName);
    }
  }

  /**
   * Perform health check on a single server
   *
   * @param serverName - Server to check
   * @returns Result indicating health status
   */
  async healthCheck(serverName: ServerName): Promise<Result<boolean, Error>> {
    // BUG FIX: Check disposed flag before operating on resources
    if (this.disposed) {
      return Err(new Error('MCPManager has been disposed'));
    }

    const state = this.connections.get(serverName);

    if (!state) {
      return Err(new Error(`Server ${serverName} not found`));
    }

    if (state.status !== 'connected') {
      return Ok(false); // Not connected = not healthy
    }

    try {
      // Simple health check: try to list tools
      await state.client.listTools();
      return Ok(true); // Healthy
    } catch (error) {
      this.emit('server-unhealthy', serverName, error);

      const err = toError(error);
      this._setFailedState(serverName, err);

      try {
        await state.client.close();
        await state.transport.disconnect();
      } catch (closeError) {
        console.warn(`Error closing unhealthy server ${serverName}:`, closeError);
      }

      const config = this.serverConfigs.get(serverName);
      if (config && this.reconnectionConfig.enabled && !this.disposed) {
        this.scheduleReconnection(serverName, config);
      }

      return Ok(false);
    }
  }

  /**
   * Start periodic health checks for all connected servers
   * PERF: Parallelized - health checks are independent per server
   */
  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      return; // Already running
    }

    const runHealthChecks = async () => {
      if (this.healthCheckInFlight || this.disposed || this.disposing) {
        return;
      }
      this.healthCheckInFlight = true;

      const connectedServers = Array.from(this.connections.entries())
        .filter(([_, state]) => state.status === 'connected')
        .map(([name, _]) => name);

      try {
        // Parallel health checks - each server is independent
        await Promise.allSettled(
          connectedServers.map(serverName => this.healthCheck(serverName))
        );
      } finally {
        this.healthCheckInFlight = false;
      }
    };

    // Run initial health check
    runHealthChecks().catch(error => {
      console.warn('Health check error:', error);
    });

    // Schedule periodic checks
    // Use .unref() to prevent timer from blocking process exit
    this.healthCheckTimer = setInterval(() => {
      runHealthChecks().catch(error => {
        console.warn('Health check error:', error);
      });
    }, this.healthCheckConfig.intervalMs);
    this.healthCheckTimer.unref();
  }

  /**
   * Stop periodic health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    this.healthCheckInFlight = false;
  }

  /**
   * Shutdown all servers
   */
  async shutdown(): Promise<Result<void, Error>> {
    const serverNames = Array.from(this.connections.keys());
    const results = await Promise.allSettled(
      serverNames.map(name => this.removeServer(name))
    );

    const errors: Error[] = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`Failed to remove server ${serverNames[index]}:`, result.reason);
        errors.push(result.reason);
      } else if (!result.value.success) {
        errors.push(result.value.error);
      }
    });

    if (errors.length > 0) {
      return Err(new AggregateError(errors, 'Shutdown had errors'));
    }

    return Ok(undefined);
  }

  /**
   * Ensure servers initialized
   */
  async ensureServersInitialized(): Promise<Result<void, Error>> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.connections.size === 0 && !this.initializationPromise) {
      this.initializationPromise = (async (): Promise<Result<void, Error>> => {
        try {
          const { loadMCPConfig } = await import('../mcp/config.js');
          const config = loadMCPConfig();

          const initPromises = config.servers.map(async (serverConfig) => {
            const serverName = createServerName(serverConfig.name);
            if (!serverName) {
              console.warn(`Invalid server name: ${serverConfig.name}`);
              return;
            }

            const result = await this.addServer(serverConfig);
            if (!result.success) {
              console.warn(`Failed to initialize MCP server ${serverName}:`, result.error);
            }
          });

          const initResults = await Promise.allSettled(initPromises);

          const initErrors = initResults
            .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
            .map(result => toError(result.reason));

          if (initErrors.length > 0) {
            return Err(new AggregateError(initErrors, 'Some MCP servers failed to initialize'));
          }
          return Ok(undefined);

        } catch (error) {
          console.error('Failed to initialize MCP servers:', error);
          return Err(toError(error));
        } finally {
          this.initializationPromise = null;
        }
      })();
    }

    if (this.initializationPromise) {
      return await this.initializationPromise;
    }

    return Ok(undefined);
  }

  /**
   * Dispose all resources
   */
  async dispose(): Promise<Result<void, Error>> {
    if (this.disposePromise) {
      return this.disposePromise;
    }

    this.disposePromise = (async () => {
      if (this.disposed) {
        return Ok(undefined);
      }

      this.disposing = true;

      try {
        // Phase 2: Stop health checks
        this.stopHealthChecks();

        // Phase 2: Cancel all reconnection timers
        for (const timer of this.reconnectionTimers.values()) {
          clearTimeout(timer);
        }
        this.reconnectionTimers.clear();
        this.reconnectionAttempts.clear();
        this.serverConfigs.clear();

        // Wait for any in-flight connections to finish to avoid post-dispose transitions
        const connectingPromises = Array.from(this.connections.values())
          .filter((state): state is Extract<ConnectionState, { status: 'connecting' }> => state.status === 'connecting')
          .map(async (state) => {
            try {
              return await state.promise;
            } catch (error) {
              return Err(toError(error));
            }
          });
        if (connectingPromises.length > 0) {
          await Promise.allSettled(connectingPromises);
        }

        const shutdownResult = await this.shutdown();

        this.removeAllListeners();

        return shutdownResult;
      } finally {
        this.disposed = true;
        this.disposing = false;
      }
    })();

    return this.disposePromise;
  }
}

// Re-export from type-safety for external use
export { createServerName, createToolName };
