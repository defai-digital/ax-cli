/**
 * Shared Tool Registry - Unified tool discovery for AX <-> ax-cli integration
 *
 * Allows AutomatosX agents to register custom tools that become available to ax-cli,
 * and vice versa. Enables seamless tool sharing across both systems.
 */

import type { LLMTool } from '../llm/client.js';

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  /** Source system that's executing the tool */
  source: 'ax-cli' | 'automatosx';
  /** Agent ID executing the tool */
  agentId?: string;
  /** Additional context data */
  metadata?: Record<string, unknown>;
}

/**
 * Tool executor function
 */
export type ToolExecutor = (
  args: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<{
  success: boolean;
  output?: string;
  error?: string;
  data?: unknown;
}>;

/**
 * Registered tool with execution handler
 */
export interface RegisteredTool {
  /** Tool definition (OpenAI format) */
  definition: LLMTool;
  /** Execution handler */
  executor: ToolExecutor;
  /** Source system that registered this tool */
  registeredBy: 'ax-cli' | 'automatosx';
  /** Registration timestamp */
  registeredAt: number;
  /** Optional tags for categorization */
  tags?: string[];
}

/**
 * Tool registration options
 */
export interface ToolRegistrationOptions {
  /** Tags for categorization */
  tags?: string[];
  /** Whether to allow overwriting existing tool */
  allowOverwrite?: boolean;
}

/**
 * Shared Tool Registry - Centralized tool management
 */
export class ToolRegistry {
  private static instance: ToolRegistry | null = null;

  private tools: Map<string, RegisteredTool> = new Map();
  private toolsBySource: Map<string, Set<string>> = new Map(); // source -> tool names

  private constructor() {
    // Initialize source maps
    this.toolsBySource.set('ax-cli', new Set());
    this.toolsBySource.set('automatosx', new Set());
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static reset(): void {
    if (ToolRegistry.instance) {
      ToolRegistry.instance.clear();
      ToolRegistry.instance = null;
    }
  }

  /**
   * Register a tool
   */
  registerTool(
    source: 'ax-cli' | 'automatosx',
    definition: LLMTool,
    executor: ToolExecutor,
    options: ToolRegistrationOptions = {}
  ): void {
    const toolName = definition.function.name;

    // Check if tool already exists
    const existingTool = this.tools.get(toolName);
    if (existingTool && !options.allowOverwrite) {
      throw new Error(
        `Tool '${toolName}' is already registered. Use allowOverwrite: true to replace it.`
      );
    }

    // If overwriting, remove from old source's set first
    if (existingTool && existingTool.registeredBy !== source) {
      const oldSourceSet = this.toolsBySource.get(existingTool.registeredBy);
      if (oldSourceSet) {
        oldSourceSet.delete(toolName);
      }
    }

    // BUG FIX: Clone definition and tags to prevent external mutation of registry state
    // Without this, external code could modify the definition/tags after registration
    // and corrupt the internal registry state
    const registeredTool: RegisteredTool = {
      definition: this.cloneDefinition(definition),
      executor,
      registeredBy: source,
      registeredAt: Date.now(),
      tags: options.tags ? [...options.tags] : undefined,
    };

    this.tools.set(toolName, registeredTool);
    const sourceSet = this.toolsBySource.get(source);
    if (sourceSet) {
      sourceSet.add(toolName);
    }
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return false;
    }

    this.tools.delete(toolName);
    const sourceSet = this.toolsBySource.get(tool.registeredBy);
    if (sourceSet) {
      sourceSet.delete(toolName);
    }
    return true;
  }

  /**
   * Deep clone an LLMTool definition to prevent external mutation
   * @internal
   */
  private cloneDefinition(def: LLMTool): LLMTool {
    return {
      type: def.type,
      function: {
        name: def.function.name,
        description: def.function.description,
        parameters: JSON.parse(JSON.stringify(def.function.parameters)),
      },
    };
  }

  /**
   * Deep clone a RegisteredTool to prevent external mutation
   * @internal
   */
  private cloneTool(tool: RegisteredTool): RegisteredTool {
    return {
      definition: this.cloneDefinition(tool.definition),
      executor: tool.executor, // Executor is a function, can't be cloned
      registeredBy: tool.registeredBy,
      registeredAt: tool.registeredAt,
      tags: tool.tags ? [...tool.tags] : undefined,
    };
  }

  /**
   * Get a registered tool
   *
   * Returns a deep copy to prevent external mutation of registry state.
   * Note: The executor function reference is shared (cannot be cloned).
   */
  getTool(toolName: string): RegisteredTool | undefined {
    const tool = this.tools.get(toolName);
    // BUG FIX: Return deep copy to prevent external mutation
    return tool ? this.cloneTool(tool) : undefined;
  }

  /**
   * Check if a tool is registered
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get all tool definitions (OpenAI format)
   *
   * Returns deep copies to prevent external mutation of registry state.
   */
  getAllToolDefinitions(): LLMTool[] {
    // BUG FIX: Return deep copies to prevent external mutation
    return Array.from(this.tools.values()).map(tool => this.cloneDefinition(tool.definition));
  }

  /**
   * Get tool definitions from specific source
   *
   * Returns deep copies to prevent external mutation of registry state.
   */
  getToolDefinitionsBySource(source: 'ax-cli' | 'automatosx'): LLMTool[] {
    const toolNames = this.toolsBySource.get(source) || new Set();
    // BUG FIX: Return deep copies to prevent external mutation
    return Array.from(toolNames)
      .map(name => this.tools.get(name))
      .filter((tool): tool is RegisteredTool => tool !== undefined)
      .map(tool => this.cloneDefinition(tool.definition));
  }

  /**
   * Get tool definitions by tag
   *
   * Returns deep copies to prevent external mutation of registry state.
   */
  getToolDefinitionsByTag(tag: string): LLMTool[] {
    // BUG FIX: Return deep copies to prevent external mutation
    return Array.from(this.tools.values())
      .filter(tool => tool.tags?.includes(tag))
      .map(tool => this.cloneDefinition(tool.definition));
  }

  /**
   * Execute a tool
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    data?: unknown;
  }> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolName}' not found in registry`,
      };
    }

    try {
      // BUG FIX: Clone args and context before passing to executor
      // This prevents the executor from mutating the caller's objects
      // which could cause subtle bugs if the caller reuses them
      const clonedArgs = JSON.parse(JSON.stringify(args));
      const clonedContext: ToolExecutionContext = {
        source: context.source,
        agentId: context.agentId,
        metadata: context.metadata ? { ...context.metadata } : undefined,
      };
      const result = await tool.executor(clonedArgs, clonedContext);
      return result;
    } catch (error) {
      // Preserve full error information for debugging
      const errorMessage = error instanceof Error
        ? `${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`
        : 'Unknown execution error';

      return {
        success: false,
        error: errorMessage,
        // Include structured error data for programmatic access
        data: error instanceof Error ? {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
        } : undefined,
      };
    }
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool names by source
   */
  getToolNamesBySource(source: 'ax-cli' | 'automatosx'): string[] {
    return Array.from(this.toolsBySource.get(source) || []);
  }

  /**
   * Clear all tools (optionally filter by source)
   */
  clear(source?: 'ax-cli' | 'automatosx'): void {
    if (source) {
      // Clear only tools from specific source
      const sourceSet = this.toolsBySource.get(source);
      const toolNames = Array.from(sourceSet || []);
      for (const name of toolNames) {
        this.tools.delete(name);
      }
      if (sourceSet) {
        sourceSet.clear();
      }
    } else {
      // Clear all tools
      this.tools.clear();
      this.toolsBySource.get('ax-cli')?.clear();
      this.toolsBySource.get('automatosx')?.clear();
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    bySource: Record<string, number>;
    byTag: Record<string, number>;
  } {
    const byTag: Record<string, number> = {};

    for (const tool of this.tools.values()) {
      if (tool.tags) {
        for (const tag of tool.tags) {
          byTag[tag] = (byTag[tag] || 0) + 1;
        }
      }
    }

    return {
      total: this.tools.size,
      bySource: {
        'ax-cli': this.toolsBySource.get('ax-cli')?.size ?? 0,
        'automatosx': this.toolsBySource.get('automatosx')?.size ?? 0,
      },
      byTag,
    };
  }

  /**
   * Export registry as JSON (excluding executors)
   *
   * Returns deep copies to prevent external mutation of registry state.
   */
  exportDefinitions(): {
    tools: Array<{
      name: string;
      definition: LLMTool;
      registeredBy: string;
      registeredAt: number;
      tags?: string[];
    }>;
    stats: {
      total: number;
      bySource: Record<string, number>;
      byTag: Record<string, number>;
    };
  } {
    // BUG FIX: Return deep copies to prevent external mutation
    const tools = Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      definition: this.cloneDefinition(tool.definition),
      registeredBy: tool.registeredBy,
      registeredAt: tool.registeredAt,
      tags: tool.tags ? [...tool.tags] : undefined,
    }));

    return {
      tools,
      stats: this.getStats(),
    };
  }
}

/**
 * Get the global tool registry instance
 */
export function getToolRegistry(): ToolRegistry {
  return ToolRegistry.getInstance();
}

/**
 * Helper: Register multiple tools at once
 *
 * @param source - Source system registering the tools
 * @param tools - Array of tool definitions with executors
 * @returns Object with success status and any errors encountered
 */
export function registerTools(
  source: 'ax-cli' | 'automatosx',
  tools: Array<{
    definition: LLMTool;
    executor: ToolExecutor;
    options?: ToolRegistrationOptions;
  }>
): { registered: string[]; errors: Array<{ name: string; error: string }> } {
  const registry = getToolRegistry();
  const registered: string[] = [];
  const errors: Array<{ name: string; error: string }> = [];

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    // BUG FIX: Safely extract tool name to prevent crashes on malformed input
    // Without this, accessing definition.function.name on null/undefined would throw
    // and crash registration for all remaining tools
    const toolName = tool?.definition?.function?.name ?? `unknown-tool-${i}`;

    try {
      if (!tool || !tool.definition || !tool.executor) {
        throw new Error('Tool definition and executor are required');
      }
      registry.registerTool(source, tool.definition, tool.executor, tool.options);
      registered.push(toolName);
    } catch (error) {
      errors.push({
        name: toolName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { registered, errors };
}

/**
 * Helper: Create a simple tool executor from a function
 */
export function createToolExecutor<T extends Record<string, unknown>>(
  handler: (args: T) => Promise<{ success: boolean; output?: string; error?: string; data?: unknown }>
): ToolExecutor {
  return async (args: Record<string, unknown>, _context: ToolExecutionContext) => {
    return handler(args as T);
  };
}
