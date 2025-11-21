import { LLMTool } from "./client.js";
import { MCPManager, MCPTool } from "../mcp/client.js";
import { loadMCPConfig } from "../mcp/config.js";

const BASE_GROK_TOOLS: LLMTool[] = [
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
      description: "Replace specific text in a file. Use this for single line edits only",
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
              "Text to replace (must match exactly, or will use fuzzy matching for multi-line strings)",
          },
          new_str: {
            type: "string",
            description: "Text to replace with",
          },
          replace_all: {
            type: "boolean",
            description:
              "Replace all occurrences (default: false, only replaces first occurrence)",
          },
        },
        required: ["path", "old_str", "new_str"],
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
            description: "Timeout in milliseconds (default: 30000). Ignored for background commands.",
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
            description: "Maximum time to wait in milliseconds if wait is true (default: 30000)",
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
            description: "Maximum number of results to return (default: 50)",
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
];

// Function to build tools array
function buildGrokTools(): LLMTool[] {
  return [...BASE_GROK_TOOLS];
}

// Export dynamic tools array
export const GROK_TOOLS: LLMTool[] = buildGrokTools();

// Global MCP manager instance
let mcpManager: MCPManager | null = null;

export function getMCPManager(): MCPManager {
  if (!mcpManager) {
    mcpManager = new MCPManager();
  }
  return mcpManager;
}

/**
 * Get the count of connected MCP servers
 * Safe to call even if MCP manager is not initialized
 */
export function getMcpConnectionCount(): number {
  if (!mcpManager) {
    return 0;
  }
  return mcpManager.getServers().length;
}

export async function initializeMCPServers(): Promise<void> {
  const manager = getMCPManager();
  const config = loadMCPConfig();
  
  // Store original stderr.write
  const originalStderrWrite = process.stderr.write;
  
  // Temporarily suppress stderr to hide verbose MCP connection logs
  process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
    // Filter out mcp-remote verbose logs
    const chunkStr = chunk.toString();
    if (chunkStr.includes('[') && (
        chunkStr.includes('Using existing client port') ||
        chunkStr.includes('Connecting to remote server') ||
        chunkStr.includes('Using transport strategy') ||
        chunkStr.includes('Connected to remote server') ||
        chunkStr.includes('Local STDIO server running') ||
        chunkStr.includes('Proxy established successfully') ||
        chunkStr.includes('Local→Remote') ||
        chunkStr.includes('Remote→Local')
      )) {
      // Suppress these verbose logs
      if (callback) callback();
      return true;
    }
    
    // Allow other stderr output
    return originalStderrWrite.call(this, chunk, encoding, callback);
  };
  
  try {
    for (const serverConfig of config.servers) {
      try {
        await manager.addServer(serverConfig);
      } catch (error) {
        console.warn(`Failed to initialize MCP server ${serverConfig.name}:`, error);
      }
    }
  } finally {
    // Restore original stderr.write
    process.stderr.write = originalStderrWrite;
  }
}

export function convertMCPToolToGrokTool(mcpTool: MCPTool): LLMTool {
  return {
    type: "function",
    function: {
      name: mcpTool.name,
      description: mcpTool.description,
      parameters: mcpTool.inputSchema || {
        type: "object",
        properties: {},
        required: []
      }
    }
  };
}

export function addMCPToolsToGrokTools(baseTools: LLMTool[]): LLMTool[] {
  if (!mcpManager) {
    return baseTools;
  }
  
  const mcpTools = mcpManager.getTools();
  const grokMCPTools = mcpTools.map(convertMCPToolToGrokTool);
  
  return [...baseTools, ...grokMCPTools];
}

export async function getAllGrokTools(): Promise<LLMTool[]> {
  const manager = getMCPManager();
  // Try to initialize servers if not already done
  // Log errors but continue without MCP tools rather than blocking
  try {
    await Promise.race([
      manager.ensureServersInitialized(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('MCP init timeout')), 5000)
      ),
    ]);
  } catch (error) {
    console.warn('MCP server initialization failed:', error instanceof Error ? error.message : String(error));
    // Continue without MCP tools rather than blocking
  }
  return addMCPToolsToGrokTools(GROK_TOOLS);
}
