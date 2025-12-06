/**
 * Tool Registry for dynamic tool management
 *
 * Provides a centralized registry for tools, enabling:
 * - Dynamic tool registration/unregistration
 * - Dependency validation
 * - Category-based organization
 * - Custom tool development
 */

import type { ToolResult } from '../types/index.js';
import { Result, Ok, Err } from '../mcp/type-safety.js';
import { extractErrorMessage } from '../utils/error-handler.js';

/**
 * Tool category classification
 */
export type ToolCategory = 'file' | 'command' | 'search' | 'analysis' | 'custom';

/**
 * Complete tool definition for registration
 */
export interface ToolDefinition {
  /** Unique tool name (lowercase with underscores) */
  name: string;

  /** Human-readable description */
  description: string;

  /** Semantic version (e.g., "1.0.0") */
  version: string;

  /** Tool category for organization */
  category: ToolCategory;

  /** Tool execution function */
  execute: (args: any) => Promise<ToolResult>;

  /** JSON Schema for tool parameters */
  schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };

  /** Optional dependencies on other tools */
  dependencies?: string[];

  /** Optional metadata */
  metadata?: {
    author?: string;
    license?: string;
    homepage?: string;
  };
}

/**
 * LLM Tool format (OpenAI function calling format)
 */
export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * Tool Registry for dynamic tool management
 *
 * @example
 * ```typescript
 * const registry = new ToolRegistry();
 *
 * registry.register({
 *   name: 'my_tool',
 *   description: 'Does something',
 *   version: '1.0.0',
 *   category: 'custom',
 *   async execute(args) {
 *     return { success: true, output: 'Done!' };
 *   },
 *   schema: {
 *     type: 'object',
 *     properties: {
 *       input: { type: 'string' }
 *     }
 *   }
 * });
 * ```
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /**
   * Register a new tool
   *
   * Validates:
   * - Tool name format (lowercase with underscores)
   * - No duplicate names
   * - All dependencies exist
   * - Schema is valid
   *
   * @param tool Tool definition to register
   * @returns Ok(void) on success, Err(Error) on failure
   */
  register(tool: ToolDefinition): Result<void, Error> {
    // Validate tool name format
    if (!tool.name || !/^[a-z][a-z0-9_]*$/.test(tool.name)) {
      return Err(new Error(`Invalid tool name: ${tool.name}. Must be lowercase with underscores.`));
    }

    // Check for conflicts
    if (this.tools.has(tool.name)) {
      return Err(new Error(`Tool ${tool.name} already registered`));
    }

    // Validate dependencies exist
    if (tool.dependencies) {
      for (const dep of tool.dependencies) {
        if (!this.tools.has(dep)) {
          return Err(new Error(`Missing dependency: ${dep} required by ${tool.name}`));
        }
      }
    }

    // Validate schema
    if (!tool.schema || tool.schema.type !== 'object') {
      return Err(new Error(`Tool ${tool.name} must have object schema`));
    }

    this.tools.set(tool.name, tool);
    return Ok(undefined);
  }

  /**
   * Unregister a tool
   *
   * Validates that no other tools depend on this tool before removal.
   *
   * @param name Tool name to unregister
   * @returns Ok(void) on success, Err(Error) on failure
   */
  unregister(name: string): Result<void, Error> {
    // Check if any tool depends on this
    for (const [toolName, tool] of this.tools.entries()) {
      if (tool.dependencies?.includes(name)) {
        return Err(new Error(`Cannot remove ${name}: ${toolName} depends on it`));
      }
    }

    if (!this.tools.delete(name)) {
      return Err(new Error(`Tool ${name} not found`));
    }

    return Ok(undefined);
  }

  /**
   * Get a tool by name
   *
   * @param name Tool name
   * @returns Tool definition or undefined if not found
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * List all tools, optionally filtered by category
   *
   * @param category Optional category filter
   * @returns Array of tool definitions
   */
  list(category?: ToolCategory): ToolDefinition[] {
    const allTools = Array.from(this.tools.values());
    if (category) {
      return allTools.filter(t => t.category === category);
    }
    return allTools;
  }

  /**
   * Convert registered tools to LLM tool format
   *
   * Transforms internal ToolDefinition format to OpenAI function calling format.
   *
   * @returns Array of LLM tools
   */
  toLLMTools(): LLMTool[] {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: `${tool.description} (v${tool.version})`,
        parameters: tool.schema
      }
    }));
  }

  /**
   * Execute a tool by name
   *
   * @param name Tool name
   * @param args Tool arguments
   * @returns Tool result
   */
  async execute(name: string, args: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${name}`
      };
    }

    try {
      return await tool.execute(args);
    } catch (error) {
      return {
        success: false,
        error: extractErrorMessage(error)
      };
    }
  }

  /**
   * Get tool count
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }
}
