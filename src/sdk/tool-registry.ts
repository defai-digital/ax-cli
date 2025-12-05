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

    const registeredTool: RegisteredTool = {
      definition,
      executor,
      registeredBy: source,
      registeredAt: Date.now(),
      tags: options.tags,
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
   * Get a registered tool
   */
  getTool(toolName: string): RegisteredTool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Check if a tool is registered
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get all tool definitions (OpenAI format)
   */
  getAllToolDefinitions(): LLMTool[] {
    return Array.from(this.tools.values()).map(tool => tool.definition);
  }

  /**
   * Get tool definitions from specific source
   */
  getToolDefinitionsBySource(source: 'ax-cli' | 'automatosx'): LLMTool[] {
    const toolNames = this.toolsBySource.get(source) || new Set();
    return Array.from(toolNames)
      .map(name => this.tools.get(name))
      .filter((tool): tool is RegisteredTool => tool !== undefined)
      .map(tool => tool.definition);
  }

  /**
   * Get tool definitions by tag
   */
  getToolDefinitionsByTag(tag: string): LLMTool[] {
    return Array.from(this.tools.values())
      .filter(tool => tool.tags?.includes(tag))
      .map(tool => tool.definition);
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
      const result = await tool.executor(args, context);
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
    const tools = Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      definition: tool.definition,
      registeredBy: tool.registeredBy,
      registeredAt: tool.registeredAt,
      tags: tool.tags,
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

  for (const { definition, executor, options } of tools) {
    try {
      registry.registerTool(source, definition, executor, options);
      registered.push(definition.function.name);
    } catch (error) {
      errors.push({
        name: definition.function.name,
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
