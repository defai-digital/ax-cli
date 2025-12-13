/**
 * MCP Manager (v1 - Legacy API)
 *
 * @deprecated Use MCPManagerV2 from './client-v2.js' instead.
 * This class will be removed in v4.0.0.
 *
 * This is now a thin wrapper around MCPManagerV2 for backward compatibility.
 * All new code should use MCPManagerV2 directly for better type safety and
 * explicit error handling with Result types.
 *
 * ## Migration Guide
 *
 * ### Before (v1 - throws on error):
 * ```typescript
 * import { MCPManager } from './mcp/client.js';
 * const manager = new MCPManager();
 *
 * try {
 *   await manager.addServer(config); // throws on failure
 *   const tools = manager.getTools();
 * } catch (error) {
 *   console.error('Failed:', error);
 * }
 * ```
 *
 * ### After (v2 - returns Result):
 * ```typescript
 * import { MCPManagerV2 } from './mcp/client-v2.js';
 * const manager = new MCPManagerV2();
 *
 * const result = await manager.addServer(config);
 * if (!result.success) {
 *   console.error('Failed:', result.error);
 *   return;
 * }
 *
 * const tools = manager.getTools(); // Same API
 * ```
 *
 * ## Key Differences
 *
 * 1. **Error Handling**: v2 uses Result types instead of exceptions
 * 2. **Type Safety**: v2 uses branded types (ServerName, ToolName)
 * 3. **State Tracking**: v2 has explicit connection state machine
 * 4. **Concurrency**: v2 uses SafeMutex for better race condition prevention
 *
 * @see {@link MCPManagerV2} for the new implementation
 */

import { EventEmitter } from "events";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { TransportType } from "./transports.js";
import type { MCPServerConfig, MCPTransportConfig } from "../schemas/settings-schemas.js";

// Import v2 implementation
import {
  MCPManagerV2,
  createServerName,
  createToolName
} from './client-v2.js';

// Re-export types for external use
export type { MCPServerConfig, MCPTransportConfig };

/**
 * MCP Tool (v1 interface)
 * Compatible with v2 but uses plain strings instead of branded types
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;  // Tool output schema (MCP 2025-06-18)
  serverName: string;
}

/**
 * MCP Manager - Legacy v1 API
 *
 * This class now wraps MCPManagerV2 internally. All operations are
 * delegated to v2 with Result types converted to exceptions for
 * backward compatibility.
 *
 * @deprecated Use MCPManagerV2 instead
 */
export class MCPManager extends EventEmitter {
  /** @internal v2 implementation */
  private v2: MCPManagerV2;

  /** @internal Track v2 event handlers for cleanup to prevent memory leaks */
  private v2EventHandlers: Map<string, (...args: unknown[]) => void> = new Map();

  constructor(clientConfig?: { name?: string; version?: string }) {
    super();
    this.v2 = new MCPManagerV2({}, {}, clientConfig);

    // Forward all v2 events to v1 listeners
    // BUG FIX: Store handler references so they can be removed in dispose()
    const events = [
      'serverAdded',
      'serverError',
      'serverRemoved',
      'token-limit-exceeded',
      'token-warning',
      'reconnection-scheduled',
      'reconnection-succeeded',
      'reconnection-failed',
      'server-unhealthy',
    ] as const;

    for (const event of events) {
      const handler = (...args: unknown[]) => this.emit(event, ...args);
      this.v2EventHandlers.set(event, handler);
      this.v2.on(event, handler);
    }
  }

  /**
   * Add MCP server
   *
   * @throws {Error} If connection fails
   * @deprecated Use MCPManagerV2.addServer() which returns Result type
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    const result = await this.v2.addServer(config);
    if (!result.success) {
      throw result.error;
    }
  }

  /**
   * Remove MCP server
   *
   * @throws {Error} If server not found or removal fails
   * @deprecated Use MCPManagerV2.removeServer() which returns Result type
   */
  async removeServer(serverName: string): Promise<void> {
    const name = createServerName(serverName);
    if (!name) {
      throw new Error(`Invalid server name: "${serverName}"`);
    }

    const result = await this.v2.removeServer(name);
    if (!result.success) {
      throw result.error;
    }
  }

  /**
   * Call MCP tool
   *
   * @throws {Error} If tool not found or call fails
   * @deprecated Use MCPManagerV2.callTool() which returns Result type
   */
  async callTool(
    toolName: string,
    arguments_: Record<string, unknown> | null | undefined
  ): Promise<CallToolResult> {
    const tool = createToolName(toolName);
    if (!tool) {
      throw new Error(`Invalid tool name: "${toolName}"`);
    }

    const result = await this.v2.callTool(tool, arguments_);
    if (!result.success) {
      throw result.error;
    }
    return result.value;
  }

  /**
   * Get all registered tools
   */
  getTools(): MCPTool[] {
    // Convert v2 tools (with branded types) to v1 tools (plain strings)
    return this.v2.getTools().map(tool => ({
      name: tool.name as string, // Cast branded type to string
      description: tool.description,
      inputSchema: tool.inputSchema,
      serverName: tool.serverName as string // Cast branded type to string
    }));
  }

  /**
   * Get all connected server names
   */
  getServers(): string[] {
    // Convert ServerName[] to string[]
    return this.v2.getServers().map(name => name as string);
  }

  /**
   * Get transport type for a server
   */
  getTransportType(serverName: string): TransportType | undefined {
    const name = createServerName(serverName);
    if (!name) {
      return undefined;
    }

    const result = this.v2.getTransportType(name);
    return result.success ? result.value : undefined;
  }

  /**
   * Get MCP connection status summary
   * Returns counts of connected, failed, connecting, and total servers
   */
  getConnectionStatus(): { connected: number; failed: number; connecting: number; total: number } {
    return this.v2.getConnectionStatus();
  }

  /**
   * Get all prompts from connected servers
   */
  getPrompts(): Array<{ serverName: string; name: string; description?: string; arguments?: Array<{ name: string; description?: string; required?: boolean }> }> {
    return this.v2.getPrompts().map(p => ({
      serverName: p.serverName as string,
      name: p.name,
      description: p.description,
      arguments: p.arguments,
    }));
  }

  /**
   * Discover prompts from all connected servers
   */
  async discoverPrompts(): Promise<void> {
    await this.v2.discoverPrompts();
  }

  /**
   * Shutdown all servers
   *
   * @throws {Error} If shutdown fails
   */
  async shutdown(): Promise<void> {
    const result = await this.v2.shutdown();
    if (!result.success) {
      throw result.error;
    }
  }

  /**
   * Ensure MCP servers are initialized from config
   */
  async ensureServersInitialized(): Promise<void> {
    const result = await this.v2.ensureServersInitialized();
    if (!result.success) {
      // Don't throw - v1 behavior was to log warnings
      console.warn('Failed to initialize MCP servers:', result.error);
    }
  }

  /**
   * Cleanup all resources and remove event listeners
   */
  async dispose(): Promise<void> {
    // BUG FIX: Remove v2 event handlers to prevent memory leak
    // The arrow function handlers kept references to `this`, preventing GC
    for (const [event, handler] of this.v2EventHandlers) {
      this.v2.off(event, handler);
    }
    this.v2EventHandlers.clear();

    const result = await this.v2.dispose();
    if (!result.success) {
      // Don't throw during cleanup - v1 behavior was to log warnings
      console.warn('Error during MCP manager disposal:', result.error);
    }

    this.removeAllListeners();
  }

  /**
   * Get underlying v2 instance (for advanced use cases)
   * @internal
   */
  getV2Instance(): MCPManagerV2 {
    return this.v2;
  }

  /**
   * Get token counter instance (for testing)
   * @internal
   */
  get tokenCounter() {
    return (this.v2 as any).tokenCounter;
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    // BUG FIX: Also remove v2 event handlers in synchronous destroy
    for (const [event, handler] of this.v2EventHandlers) {
      this.v2.off(event, handler);
    }
    this.v2EventHandlers.clear();

    this.removeAllListeners();
  }
}
