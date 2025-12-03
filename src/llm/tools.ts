import { LLMTool } from "./client.js";
import { MCPManager, MCPTool } from "../mcp/client.js";
import { loadMCPConfig } from "../mcp/config.js";
import { extractErrorMessage } from "../utils/error-handler.js";
import { TIMEOUT_CONFIG } from "../constants.js";

// Tool configuration constants
const TOOL_DEFAULTS = {
  BASH_TIMEOUT_MS: TIMEOUT_CONFIG.BASH_DEFAULT,
  MCP_INIT_TIMEOUT_MS: TIMEOUT_CONFIG.MCP_INIT,
  SEARCH_MAX_RESULTS: 50,
} as const;

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
 * Core tool definitions for the LLM agent
 * Named BASE_LLM_TOOLS (not GROK) to reflect actual usage
 */
const BASE_LLM_TOOLS: LLMTool[] = [
  {
    type: "function",
    function: {
      name: "view_file",
      description: "View contents of a file or list directory contents",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to file or directory to view",
          },
          start_line: {
            type: "number",
            description:
              "Starting line number for partial file view (optional)",
          },
          end_line: {
            type: "number",
            description: "Ending line number for partial file view (optional)",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_file",
      description: "Create a new file with specified content",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path where the file should be created",
          },
          content: {
            type: "string",
            description: "Content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "str_replace_editor",
      description: "Edit existing files with precise string replacement. Can replace single or multi-line text blocks. For multiple changes to the same file, include more context in old_str to make a single comprehensive edit rather than multiple separate calls.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to edit",
          },
          old_str: {
            type: "string",
            description:
              "Text to replace - can be single line or multi-line block. Include sufficient context (surrounding lines) to uniquely identify the location and enable consolidated edits.",
          },
          new_str: {
            type: "string",
            description: "Replacement text - can be single line or entire function/block",
          },
          replace_all: {
            type: "boolean",
            description:
              "Replace all occurrences (default: false, only replaces first occurrence). Useful for variable renaming across file.",
          },
        },
        required: ["path", "old_str", "new_str"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "multi_edit",
      description: "Make multiple edits to a single file in one atomic operation. Use this instead of multiple str_replace_editor calls when you need to make several changes to the same file. Edits are applied sequentially and the operation fails entirely if any edit is invalid (all-or-nothing).",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to edit",
          },
          edits: {
            type: "array",
            description: "Array of edits to apply sequentially. Each edit operates on the result of the previous edit.",
            items: {
              type: "object",
              properties: {
                old_str: {
                  type: "string",
                  description: "Text to replace",
                },
                new_str: {
                  type: "string",
                  description: "Replacement text",
                },
              },
              required: ["old_str", "new_str"],
            },
          },
        },
        required: ["path", "edits"],
      },
    },
  },

  {
    type: "function",
    function: {
      name: "bash",
      description: "Execute a bash command. Append ' &' to run in background.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash command to execute. Append ' &' to run in background (e.g., 'npm run dev &')",
          },
          background: {
            type: "boolean",
            description: "Run command in background (alternative to appending ' &'). Useful for long-running processes like dev servers.",
          },
          timeout: {
            type: "number",
            description: `Timeout in milliseconds (default: ${TOOL_DEFAULTS.BASH_TIMEOUT_MS}). Ignored for background commands.`,
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash_output",
      description: "Get output from a background task. Use after running a command with ' &' or background:true",
      parameters: {
        type: "object",
        properties: {
          task_id: {
            type: "string",
            description: "The background task ID (returned when starting a background command)",
          },
          wait: {
            type: "boolean",
            description: "Wait for task to complete before returning output (default: false)",
          },
          timeout: {
            type: "number",
            description: `Maximum time to wait in milliseconds if wait is true (default: ${TOOL_DEFAULTS.BASH_TIMEOUT_MS})`,
          },
        },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search",
      description:
        "Unified search tool for finding text content or files (similar to Cursor's search)",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Text to search for or file name/path pattern",
          },
          search_type: {
            type: "string",
            enum: ["text", "files", "both"],
            description:
              "Type of search: 'text' for content search, 'files' for file names, 'both' for both (default: 'both')",
          },
          include_pattern: {
            type: "string",
            description:
              "Glob pattern for files to include (e.g. '*.ts', '*.js')",
          },
          exclude_pattern: {
            type: "string",
            description:
              "Glob pattern for files to exclude (e.g. '*.log', 'node_modules')",
          },
          case_sensitive: {
            type: "boolean",
            description:
              "Whether search should be case sensitive (default: false)",
          },
          whole_word: {
            type: "boolean",
            description: "Whether to match whole words only (default: false)",
          },
          regex: {
            type: "boolean",
            description: "Whether query is a regex pattern (default: false)",
          },
          max_results: {
            type: "number",
            description: `Maximum number of results to return (default: ${TOOL_DEFAULTS.SEARCH_MAX_RESULTS})`,
          },
          file_types: {
            type: "array",
            items: { type: "string" },
            description: "File types to search (e.g. ['js', 'ts', 'py'])",
          },
          include_hidden: {
            type: "boolean",
            description: "Whether to include hidden files (default: false)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_todo_list",
      description: "Create a new todo list for planning and tracking tasks",
      parameters: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            description: "Array of todo items",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "Unique identifier for the todo item",
                },
                content: {
                  type: "string",
                  description: "Description of the todo item",
                },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed"],
                  description: "Current status of the todo item",
                },
                priority: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                  description: "Priority level of the todo item",
                },
              },
              required: ["id", "content", "status", "priority"],
            },
          },
        },
        required: ["todos"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_todo_list",
      description: "Update existing todos in the todo list",
      parameters: {
        type: "object",
        properties: {
          updates: {
            type: "array",
            description: "Array of todo updates",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "ID of the todo item to update",
                },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed"],
                  description: "New status for the todo item",
                },
                content: {
                  type: "string",
                  description: "New content for the todo item",
                },
                priority: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                  description: "New priority for the todo item",
                },
              },
              required: ["id"],
            },
          },
        },
        required: ["updates"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_architecture",
      description:
        "Analyze project architecture to detect design patterns (MVC, Clean Architecture, Repository), anti-patterns (God Objects), and generate improvement recommendations with confidence scores.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description:
              "Path to project root directory (default: current directory)",
          },
          depth: {
            type: "string",
            enum: ["quick", "deep"],
            default: "quick",
            description:
              'Analysis depth: "quick" for pattern detection only, "deep" includes anti-pattern detection',
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "validate_best_practices",
      description:
        "Validate TypeScript/JavaScript files against best practices and coding standards. Checks for type safety issues (any types, implicit any), code quality (unused variables, error handling), maintainability (complexity, file length), and adherence to naming conventions.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Path to directory or file to validate (default: current directory)",
          },
          pattern: {
            type: "string",
            description:
              "Glob pattern for files to validate (default: **/*.{ts,tsx})",
          },
          rules: {
            type: "object",
            description:
              "Rule configuration object to enable/disable specific rules (e.g., {\"no-any-type\": {\"enabled\": false}})",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user",
      description: "Ask the user questions to gather preferences, clarify requirements, or get decisions on implementation choices. Use this when you need user input before proceeding. Supports multiple choice questions with 2-4 options per question.",
      parameters: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            description: "Questions to ask the user (1-4 questions)",
            items: {
              type: "object",
              properties: {
                question: {
                  type: "string",
                  description: "The complete question to ask the user. Should be clear and specific.",
                },
                header: {
                  type: "string",
                  description: "Short label for the question (max 12 chars). E.g., 'Auth method', 'Library'.",
                },
                options: {
                  type: "array",
                  description: "Available choices (2-4 options). 'Other' is added automatically.",
                  items: {
                    type: "object",
                    properties: {
                      label: {
                        type: "string",
                        description: "Display text for this option (1-5 words).",
                      },
                      description: {
                        type: "string",
                        description: "Explanation of what this option means.",
                      },
                    },
                    required: ["label", "description"],
                  },
                },
                multiSelect: {
                  type: "boolean",
                  description: "Allow multiple selections (default: false).",
                },
              },
              required: ["question", "options"],
            },
          },
        },
        required: ["questions"],
      },
    },
  },
  // ==========================================================================
  // Design Tools (Figma Integration)
  // ==========================================================================
  {
    type: "function",
    function: {
      name: "figma_map",
      description: "Map a Figma file structure to see its pages, frames, and components. Requires FIGMA_ACCESS_TOKEN environment variable.",
      parameters: {
        type: "object",
        properties: {
          file_key: {
            type: "string",
            description: "Figma file key (from the URL: figma.com/file/FILE_KEY/...)",
          },
          depth: {
            type: "number",
            description: "Maximum depth to traverse (optional)",
          },
          format: {
            type: "string",
            enum: ["tree", "json", "flat"],
            description: "Output format (default: tree)",
          },
          show_ids: {
            type: "boolean",
            description: "Include node IDs in output",
          },
          show_types: {
            type: "boolean",
            description: "Include node types in output",
          },
          frames_only: {
            type: "boolean",
            description: "Show only frames and components",
          },
        },
        required: ["file_key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "figma_tokens",
      description: "Extract design tokens (colors, spacing, radii) from a Figma file's variables. Requires FIGMA_ACCESS_TOKEN environment variable.",
      parameters: {
        type: "object",
        properties: {
          file_key: {
            type: "string",
            description: "Figma file key containing design tokens/variables",
          },
          format: {
            type: "string",
            enum: ["json", "tailwind", "css", "scss"],
            description: "Output format (default: json)",
          },
          color_format: {
            type: "string",
            enum: ["hex", "rgb", "hsl"],
            description: "Color output format (default: hex)",
          },
          dimension_unit: {
            type: "string",
            enum: ["px", "rem"],
            description: "Dimension unit (default: px)",
          },
          rem_base: {
            type: "number",
            description: "Base value for rem conversion (default: 16)",
          },
        },
        required: ["file_key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "figma_audit",
      description: "Run a design audit on a Figma file to check for naming conventions, missing auto-layout, and other best practices. Requires FIGMA_ACCESS_TOKEN environment variable.",
      parameters: {
        type: "object",
        properties: {
          file_key: {
            type: "string",
            description: "Figma file key to audit",
          },
          depth: {
            type: "number",
            description: "Maximum depth to traverse (optional)",
          },
          rules: {
            type: "array",
            items: { type: "string" },
            description: "Specific rules to run (e.g., ['layer-naming', 'missing-autolayout']). Runs all by default.",
          },
          exclude_rules: {
            type: "array",
            items: { type: "string" },
            description: "Rules to exclude from the audit",
          },
        },
        required: ["file_key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "figma_search",
      description: "Search for nodes in a Figma file by name, type, or text content. Requires FIGMA_ACCESS_TOKEN environment variable.",
      parameters: {
        type: "object",
        properties: {
          file_key: {
            type: "string",
            description: "Figma file key to search in",
          },
          name: {
            type: "string",
            description: "Search by node name (partial match)",
          },
          type: {
            type: "string",
            description: "Filter by node type (e.g., FRAME, TEXT, COMPONENT)",
          },
          text: {
            type: "string",
            description: "Search text nodes by content",
          },
          limit: {
            type: "number",
            description: "Maximum results to return (default: 10)",
          },
        },
        required: ["file_key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "figma_alias_list",
      description: "List all saved Figma design aliases (shortcuts to specific files/nodes)",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "figma_alias_resolve",
      description: "Resolve a design alias to its Figma file key and node ID",
      parameters: {
        type: "object",
        properties: {
          alias: {
            type: "string",
            description: "Alias name to resolve",
          },
        },
        required: ["alias"],
      },
    },
  },
];

/**
 * Exported tool definitions
 * @deprecated Use LLM_TOOLS instead of GROK_TOOLS (legacy name kept for backwards compatibility)
 */
export const GROK_TOOLS: LLMTool[] = [...BASE_LLM_TOOLS];
export const LLM_TOOLS: LLMTool[] = GROK_TOOLS; // Preferred name

// Global MCP manager instance (singleton pattern)
let mcpManager: MCPManager | null = null;

/**
 * Get or create the MCP manager singleton
 * Note: MCPManager constructor is synchronous, so no race condition is possible
 * in single-threaded JavaScript. The flag is only useful across async boundaries.
 */
export function getMCPManager(): MCPManager {
  if (!mcpManager) {
    // MCPManager constructor is synchronous, so no spin-wait needed
    // JavaScript is single-threaded - this code runs atomically
    mcpManager = new MCPManager();
  }
  return mcpManager;
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
 */
export async function initializeMCPServers(): Promise<void> {
  const manager = getMCPManager();
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

/** @deprecated Use convertMCPToolToLLMTool instead */
export const convertMCPToolToGrokTool = convertMCPToolToLLMTool;

/**
 * Merge base tools with MCP tools
 */
export function mergeWithMCPTools(baseTools: LLMTool[]): LLMTool[] {
  if (!mcpManager) {
    return baseTools;
  }
  const mcpTools = mcpManager.getTools().map(convertMCPToolToLLMTool);
  return [...baseTools, ...mcpTools];
}

/** @deprecated Use mergeWithMCPTools instead */
export const addMCPToolsToGrokTools = mergeWithMCPTools;

/**
 * Get all available tools (base + MCP)
 * Handles MCP initialization with timeout
 */
export async function getAllTools(): Promise<LLMTool[]> {
  const manager = getMCPManager();

  try {
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('MCP init timeout')),
        TOOL_DEFAULTS.MCP_INIT_TIMEOUT_MS
      );
    });

    // Prevent unhandled rejection if timeout loses race
    timeoutPromise.catch(() => {});

    await Promise.race([
      manager.ensureServersInitialized().finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      }),
      timeoutPromise,
    ]);
  } catch (error) {
    console.warn('MCP server initialization failed:', extractErrorMessage(error));
  }

  return mergeWithMCPTools(LLM_TOOLS);
}

/** @deprecated Use getAllTools instead */
export const getAllGrokTools = getAllTools;

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
