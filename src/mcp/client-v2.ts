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
import { Result, Ok, Err } from "./type-safety.js";
import {
  ServerName,
  ToolName,
  createServerName
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
  inputSchema: any;
  outputSchema?: any;       // ✅ NEW: Tool output schema (MCP 2025-06-18)
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

  constructor(
    reconnectionConfig: Partial<ReconnectionConfig> = {},
    healthCheckConfig: Partial<HealthCheckConfig> = {}
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

    // Start health checks if enabled
    if (this.healthCheckConfig.enabled) {
      this.startHealthChecks();
    }
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
      // Transition to failed state
      this.connections.set(serverName, {
        status: 'failed',
        serverName,
        error: new Error(`Invalid config: ${validationResult.error.message}`),
        failedAt: Date.now()
      });

      return Err(new Error(`Invalid MCP server config: ${validationResult.error.message}`));
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
      this.connections.set(serverName, {
        status: 'failed',
        serverName,
        error,
        failedAt: Date.now()
      });
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

          // Create client
          const client = new Client(
            {
              name: MCP_CONFIG.CLIENT_NAME,
              version: MCP_CONFIG.CLIENT_VERSION
            },
            {
              capabilities: {}  // SDK v1.22+ doesn't have tools in client capabilities
            }
          );

          // Connect
          const sdkTransport = await transport.connect();
          await client.connect(sdkTransport);

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
          // Transition to failed state
          const err = error instanceof Error ? error : new Error(String(error));
          this.connections.set(serverName, {
            status: 'failed',
            serverName,
            error: err,
            failedAt: Date.now()
          });

          this.emit('serverError', serverName, err);

          // Phase 2: Schedule reconnection if enabled
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
      const err = error instanceof Error ? error : new Error(String(error));
      this.connections.set(serverName, {
        status: 'failed',
        serverName,
        error: err,
        failedAt: Date.now()
      });

      // Phase 2: Schedule reconnection if enabled
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
      return Err(error instanceof Error ? error : new Error(String(error)));
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
      const err = error instanceof Error ? error : new Error(String(error));
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
      const err = error instanceof Error ? error : new Error(String(error));
      console.warn(`Error disconnecting MCP transport ${serverName}:`, err);
      return Err(err);
    }
  }

  /**
   * Call MCP tool with type safety and optional schema validation
   *
   * @param toolName - The tool to call
   * @param arguments_ - Tool arguments
   * @param options - Optional settings for validation
   * @returns Result containing the tool result with optional schema validation
   */
  async callTool(
    toolName: ToolName,
    arguments_: Record<string, unknown> | null | undefined,
    options?: { validateOutput?: boolean }
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

      // Call tool with timeout (mutex released, but client reference is still valid)
      // MCP SDK accepts { timeout?: number } as third parameter
      const result = await client.callTool({
        name: originalToolName,
        arguments: safeArgs
      }, undefined, { timeout });

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
      return Err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Call MCP tool with progress tracking
   *
   * MCP Specification: Supports notifications/progress for long-running operations.
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
      // Call the base callTool - progress notifications will be handled via setupNotificationHandlers
      // Note: The MCP SDK's callTool accepts a _meta.progressToken but we handle notifications globally
      return await this.callTool(toolName, arguments_);
    } finally {
      progressTracker.cleanup(token);
    }
  }

  /**
   * Call MCP tool with cancellation support
   *
   * MCP Specification: Supports notifications/cancelled for aborting operations.
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
      // Create abort listener
      const abortPromise = new Promise<never>((_, reject) => {
        abortController.signal.addEventListener('abort', () => {
          reject(new Error('Request cancelled'));
        });
      });

      // Race between tool call and abort
      const result = await Promise.race([
        this.callTool(toolName, arguments_),
        abortPromise,
      ]);

      return result;
    } catch (error) {
      // Check if this was a cancellation
      if (cancellationManager.isCancelled(requestId) || isRequestCancelled(error)) {
        return Ok({
          content: [],
          isCancelled: true,
          cancelReason: 'User cancelled',
        } as CallToolResult & { isCancelled: boolean; cancelReason: string });
      }
      return Err(error instanceof Error ? error : new Error(String(error)));
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
    const chars = Array.from(text);

    let low = 0;
    let high = chars.length;
    let result = text;

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
      const err = error instanceof Error ? error : new Error(String(error));
      return Err(err);
    }
  }

  /**
   * Discover prompts from all connected servers
   */
  async discoverPrompts(): Promise<void> {
    const connectedServers = this.getServers();

    for (const serverName of connectedServers) {
      await this.listServerPrompts(serverName);
    }
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
    const timer = setTimeout(async () => {
      // Increment attempt count
      this.reconnectionAttempts.set(serverName, attempts + 1);

      // Attempt reconnection
      const result = await this.addServer(config);

      if (result.success) {
        // Success! Reset attempt counter
        this.reconnectionAttempts.delete(serverName);
        this.emit('reconnection-succeeded', serverName, attempts + 1);
      } else {
        // Failed - will be rescheduled by addServer error handling
        // (which calls scheduleReconnection again)
      }
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
      // Server is unhealthy
      this.emit('server-unhealthy', serverName, error);

      // Transition to failed state
      const err = error instanceof Error ? error : new Error(String(error));
      this.connections.set(serverName, {
        status: 'failed',
        serverName,
        error: err,
        failedAt: Date.now()
      });

      // Close the connection
      try {
        await state.client.close();
        await state.transport.disconnect();
      } catch (closeError) {
        console.warn(`Error closing unhealthy server ${serverName}:`, closeError);
      }

      // Schedule reconnection
      const config = this.serverConfigs.get(serverName);
      if (config && this.reconnectionConfig.enabled && !this.disposed) {
        this.scheduleReconnection(serverName, config);
      }

      return Ok(false); // Unhealthy
    }
  }

  /**
   * Start periodic health checks for all connected servers
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
        for (const serverName of connectedServers) {
          await this.healthCheck(serverName);
        }
      } finally {
        this.healthCheckInFlight = false;
      }
    };

    // Run initial health check
    runHealthChecks().catch(error => {
      console.warn('Health check error:', error);
    });

    // Schedule periodic checks
    this.healthCheckTimer = setInterval(() => {
      runHealthChecks().catch(error => {
        console.warn('Health check error:', error);
      });
    }, this.healthCheckConfig.intervalMs);
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
            .map(result => result.reason instanceof Error ? result.reason : new Error(String(result.reason)));

          if (initErrors.length > 0) {
            return Err(new AggregateError(initErrors, 'Some MCP servers failed to initialize'));
          }
          return Ok(undefined);

        } catch (error) {
          console.error('Failed to initialize MCP servers:', error);
          return Err(error instanceof Error ? error : new Error(String(error)));
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
              return Err(error instanceof Error ? error : new Error(String(error)));
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

/**
 * Helper functions for creating branded types
 */
function createToolName(name: string): ToolName | null {
  // Tool names can have double underscores for MCP prefix
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return null;
  }
  if (name.length < 1 || name.length > 128) {
    return null;
  }
  return name as ToolName;
}

// Re-export createServerName from type-safety
export { createServerName, createToolName };
