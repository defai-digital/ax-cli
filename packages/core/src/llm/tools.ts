import { LLMTool } from "./client.js";
import { MCPManager, MCPTool } from "../mcp/client.js";
import { loadMCPConfig } from "../mcp/config.js";
import { extractErrorMessage } from "../utils/error-handler.js";
import { TIMEOUT_CONFIG } from "../constants.js";
import { TOOL_DEFINITIONS } from "../tools/definitions/index.js";
import { toOpenAIFormat } from "../tools/format-generators.js";
import { getPriorityRegistry } from "../tools/priority-registry.js";

// MCP initialization timeout
const MCP_INIT_TIMEOUT_MS = TIMEOUT_CONFIG.MCP_INIT;

// MCP log messages to suppress (verbose connection logs)
const MCP_SUPPRESSED_LOG_PATTERNS = [
  'Using existing client port',
  'Connecting to remote server',
  'Using transport strategy',
  'Connected to remote server',
  'Local STDIO server running',
  'Proxy established successfully',
  'Local→Remote',
  'Remote→Local',
] as const;

/**
 * LLM tool definitions derived from rich Tool System v3.0 definitions
 * These are the primary exports for tool registration with LLM providers
 */
export const LLM_TOOLS: LLMTool[] = TOOL_DEFINITIONS.map(toOpenAIFormat);

// Global MCP manager instance (singleton pattern)
let mcpManager: MCPManager | null = null;
// Store the client config used to create the manager (for debugging/inspection)
let _mcpClientConfig: { name?: string; version?: string } | undefined = undefined;

/**
 * Get or create the MCP manager singleton
 * Note: MCPManager constructor is synchronous, so no race condition is possible
 * in single-threaded JavaScript. The flag is only useful across async boundaries.
 *
 * @param clientConfig - Optional MCP client identification (name/version)
 *                       Only used on first call to create the manager.
 *                       Subsequent calls ignore this parameter.
 */
export function getMCPManager(clientConfig?: { name?: string; version?: string }): MCPManager {
  if (!mcpManager) {
    // MCPManager constructor is synchronous, so no spin-wait needed
    // JavaScript is single-threaded - this code runs atomically
    _mcpClientConfig = clientConfig;
    mcpManager = new MCPManager(clientConfig);
  }
  return mcpManager;
}

/**
 * Reset the MCP manager singleton (primarily for testing)
 * This allows creating a new manager with different client config
 */
export function resetMCPManager(): void {
  if (mcpManager) {
    void mcpManager.dispose();
    mcpManager = null;
    _mcpClientConfig = undefined;
  }
}

/**
 * Get the current MCP client configuration (for debugging/inspection)
 */
export function getMCPClientConfig(): { name?: string; version?: string } | undefined {
  return _mcpClientConfig;
}

/**
 * Get the count of connected MCP servers
 * Safe to call even if MCP manager is not initialized
 */
export function getMcpConnectionCount(): number {
  return mcpManager?.getServers().length ?? 0;
}

/**
 * Check if a log message should be suppressed
 */
function shouldSuppressMcpLog(message: string): boolean {
  if (!message.includes('[')) return false;
  return MCP_SUPPRESSED_LOG_PATTERNS.some(pattern => message.includes(pattern));
}

// BUG FIX: Use reference counting for stderr suppression to handle concurrent calls
let stderrSuppressionCount = 0;
let originalStderrWrite: typeof process.stderr.write | null = null;

function enableStderrSuppression(): void {
  stderrSuppressionCount++;
  if (stderrSuppressionCount === 1) {
    // First caller - install the suppression
    // Capture the original write function in a local variable for type safety
    const boundOriginalWrite = process.stderr.write.bind(process.stderr);
    originalStderrWrite = boundOriginalWrite;
    process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
      if (shouldSuppressMcpLog(chunk.toString())) {
        if (callback) callback();
        return true;
      }
      return boundOriginalWrite.call(this, chunk, encoding, callback);
    };
  }
}

function disableStderrSuppression(): void {
  // Guard against going negative (mismatched enable/disable calls)
  if (stderrSuppressionCount <= 0) {
    return;
  }
  stderrSuppressionCount--;
  if (stderrSuppressionCount === 0 && originalStderrWrite) {
    // Last caller - restore original
    process.stderr.write = originalStderrWrite;
    originalStderrWrite = null;
  }
}

/**
 * Initialize MCP servers from config
 * BUG FIX: Use reference-counted stderr suppression to handle concurrent calls
 * PERF FIX: Initialize servers in parallel so slow servers don't block others
 *
 * @param clientConfig - Optional MCP client identification (e.g., { name: 'ax-glm', version: '4.3.0' })
 *                       This is sent to MCP servers during the protocol handshake.
 */
export async function initializeMCPServers(clientConfig?: { name?: string; version?: string }): Promise<void> {
  const manager = getMCPManager(clientConfig);
  const config = loadMCPConfig();

  // Temporarily suppress verbose MCP connection logs (reference counted)
  enableStderrSuppression();

  try {
    // Initialize all servers in parallel for better performance
    // Failed servers are logged but don't block other servers
    const results = await Promise.allSettled(
      config.servers.map(async (serverConfig) => {
        try {
          await manager.addServer(serverConfig);
          return { name: serverConfig.name, success: true };
        } catch (error) {
          console.warn(`Failed to initialize MCP server ${serverConfig.name}:`, error);
          return { name: serverConfig.name, success: false, error };
        }
      })
    );

    // Log summary of server initialization
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    if (failed > 0 && successful === 0) {
      console.warn(`All ${failed} MCP server(s) failed to initialize`);
    } else if (failed > 0) {
      // Only log if there were failures mixed with successes
      // Silent success is preferred for good UX
    }
  } finally {
    disableStderrSuppression();
  }
}

/**
 * Convert MCP tool format to LLM tool format
 * MCP 2025-06-18: Includes output schema in description for LLM awareness
 */
export function convertMCPToolToLLMTool(mcpTool: MCPTool): LLMTool {
  // Build description with optional output schema info
  let description = mcpTool.description;

  // MCP 2025-06-18: Include output schema in description so LLM knows return format
  if (mcpTool.outputSchema) {
    const outputSchemaStr = typeof mcpTool.outputSchema === 'string'
      ? mcpTool.outputSchema
      : JSON.stringify(mcpTool.outputSchema, null, 2);
    description += `\n\nOutput schema: ${outputSchemaStr}`;
  }

  return {
    type: "function",
    function: {
      name: mcpTool.name,
      description,
      parameters: mcpTool.inputSchema || {
        type: "object",
        properties: {},
        required: []
      }
    }
  };
}

/**
 * Merge base tools with MCP tools
 * Applies priority-based filtering to prevent lower-priority tools from
 * overshadowing higher-priority alternatives.
 *
 * Priority filtering behavior:
 * - Grok provider: Native web search > MCP web search (AutomatosX hidden)
 * - GLM provider: Z.AI MCP web search > AutomatosX MCP web search
 * - All providers: Domain-specific MCPs (Figma, GitHub) take precedence
 *
 * @param baseTools - Built-in ax-cli tools
 * @param options - Optional configuration
 * @param options.applyPriorityFilter - Whether to filter based on priorities (default: true)
 * @returns Merged and filtered tools
 */
export function mergeWithMCPTools(
  baseTools: LLMTool[],
  options?: { applyPriorityFilter?: boolean }
): LLMTool[] {
  if (!mcpManager) {
    return baseTools;
  }

  const mcpTools = mcpManager.getTools().map(convertMCPToolToLLMTool);
  const allTools = [...baseTools, ...mcpTools];

  // Apply priority filtering unless explicitly disabled
  const applyFilter = options?.applyPriorityFilter !== false;
  if (!applyFilter) {
    return allTools;
  }

  const registry = getPriorityRegistry();
  const { filtered, hidden } = registry.filterTools(allTools);

  // Debug logging for hidden tools (only in DEBUG mode)
  if (process.env.DEBUG && hidden.length > 0) {
    console.log('[Priority Filter] Hidden tools:');
    for (const { tool, reason } of hidden) {
      console.log(`  - ${tool.function.name}: ${reason}`);
    }
  }

  return filtered;
}

/**
 * Get all available tools (base + MCP)
 * Handles MCP initialization with timeout
 */
export async function getAllTools(): Promise<LLMTool[]> {
  const manager = getMCPManager();

  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('MCP init timeout')),
        MCP_INIT_TIMEOUT_MS
      );
    });

    // Prevent unhandled rejection if timeout loses race
    timeoutPromise.catch(() => {});

    await Promise.race([
      manager.ensureServersInitialized(),
      timeoutPromise,
    ]);
  } catch (error) {
    console.warn('MCP server initialization failed:', extractErrorMessage(error));
  } finally {
    // Always clear timeout to prevent timer leak, regardless of which promise won
    if (timeoutId) clearTimeout(timeoutId);
  }

  return mergeWithMCPTools(LLM_TOOLS);
}

/**
 * Get MCP connection status for UI display
 * Returns { connected, failed, connecting, total } counts
 */
export function getMCPConnectionStatus(): { connected: number; failed: number; connecting: number; total: number } {
  try {
    const manager = getMCPManager();
    return manager.getConnectionStatus();
  } catch {
    // MCP manager not initialized yet
    return { connected: 0, failed: 0, connecting: 0, total: 0 };
  }
}

/**
 * Get MCP prompts from all connected servers
 * Returns array of prompts with server context
 */
export function getMCPPrompts(): Array<{ serverName: string; name: string; description?: string; arguments?: Array<{ name: string; description?: string; required?: boolean }> }> {
  try {
    const manager = getMCPManager();
    return manager.getPrompts();
  } catch {
    // MCP manager not initialized yet
    return [];
  }
}

/**
 * Discover MCP prompts from all connected servers
 */
export async function discoverMCPPrompts(): Promise<void> {
  try {
    const manager = getMCPManager();
    await manager.discoverPrompts();
  } catch {
    // MCP manager not initialized yet
  }
}

/**
 * Get all MCP resources from connected servers
 * Used for @mcp: auto-complete suggestions
 */
export async function getMCPResources(): Promise<Array<{ uri: string; name: string; description?: string; serverName: string; reference: string }>> {
  try {
    const manager = getMCPManager();
    const { listAllResources } = await import('../mcp/resources.js');
    return await listAllResources(manager);
  } catch {
    // MCP manager not initialized yet
    return [];
  }
}
