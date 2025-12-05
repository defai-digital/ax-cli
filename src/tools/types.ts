/**
 * Rich Tool Definition Types for ax-cli Tool System v3.0
 *
 * This file defines the comprehensive ToolDefinition interface that serves as
 * the single source of truth for all tool metadata. OpenAI/Anthropic formats
 * are DERIVED from these definitions, not the other way around.
 *
 * @see PRD-AX-CLI-TOOL-SYSTEM-V3-FINAL.md
 */

/**
 * Tool categories for organization and filtering
 */
export type ToolCategory =
  | 'file-operations'
  | 'command-execution'
  | 'search'
  | 'task-management'
  | 'user-interaction'
  | 'web'
  | 'agent-delegation'
  | 'design';

/**
 * Safety level classification for tools
 * - safe: No risk of data loss or security issues
 * - moderate: Some risk, but typically reversible
 * - dangerous: High risk, requires confirmation
 */
export type ToolSafetyLevel = 'safe' | 'moderate' | 'dangerous';

/**
 * Parameter type definitions (JSON Schema compatible)
 */
export type ParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object';

/**
 * Detailed parameter definition with rich metadata
 */
export interface ParameterDefinition {
  /** JSON Schema type */
  type: ParameterType;

  /** Comprehensive description of the parameter */
  description: string;

  /** Default value if not provided */
  default?: unknown;

  /** Allowed values (for enum-like parameters) */
  enum?: string[];

  /** Format hint (e.g., 'file-path', 'url', 'date-iso8601') */
  format?: string;

  /** Example values for LLM guidance */
  examples?: unknown[];

  /** Constraints that must be satisfied */
  constraints?: string[];

  /** For array types: schema of array items */
  items?: ParameterDefinition | { type: ParameterType; properties?: Record<string, ParameterDefinition>; required?: string[] };
}

/**
 * Tool parameter schema (JSON Schema object format)
 */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, ParameterDefinition>;
  required: string[];
}

/**
 * Concrete usage example for a tool
 */
export interface ToolExample {
  /** Short description of what the example demonstrates */
  description: string;

  /** Scenario context - when would you use this */
  scenario: string;

  /** Example input arguments */
  input: Record<string, unknown>;

  /** Expected behavior/output description */
  expectedBehavior: string;

  /** Additional notes about the example */
  notes?: string;
}

/**
 * Rich Tool Definition - Single Source of Truth
 *
 * This interface defines everything about a tool. OpenAI function calling
 * format and Anthropic tool format are derived from this definition.
 *
 * @example
 * ```typescript
 * const viewFileTool: ToolDefinition = {
 *   name: 'view_file',
 *   displayName: 'View File',
 *   description: 'Read and display file contents...',
 *   parameters: { ... },
 *   usageNotes: ['Always read before editing', ...],
 *   constraints: ['Cannot modify files', ...],
 *   examples: [{ description: 'Read a source file', ... }],
 *   tokenCost: 439,
 *   safetyLevel: 'safe',
 *   requiresConfirmation: false,
 *   categories: ['file-operations'],
 * };
 * ```
 */
export interface ToolDefinition {
  /** Tool identifier (lowercase with underscores) */
  name: string;

  /** Display name for UI (Title Case) */
  displayName: string;

  /**
   * Comprehensive description (500+ words for complex tools)
   *
   * Should include:
   * - What the tool does
   * - When to use it
   * - When NOT to use it
   * - Important caveats
   */
  description: string;

  /** Input parameter schema */
  parameters: ToolParameterSchema;

  /**
   * Detailed usage guidance for LLM
   * Aim for 5-10 notes covering common patterns and best practices
   */
  usageNotes: string[];

  /**
   * Constraints and limitations
   * Things the LLM should NEVER do with this tool
   */
  constraints: string[];

  /**
   * Concrete usage examples (3-5 per tool)
   * Each example should cover a realistic scenario
   */
  examples: ToolExample[];

  /**
   * Estimated token cost for this tool's description
   * Used for token budget planning
   */
  tokenCost: number;

  /** Safety classification */
  safetyLevel: ToolSafetyLevel;

  /** Requires user confirmation before execution */
  requiresConfirmation: boolean;

  /** Alternative tools to consider */
  alternatives?: string[];

  /** Tool categories for organization */
  categories: ToolCategory[];

  /**
   * When NOT to use this tool
   * Common misuses that should be avoided
   */
  antiPatterns?: string[];

  /** Related tools that work well together */
  relatedTools?: string[];
}

/**
 * OpenAI function calling format (derived from ToolDefinition)
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

/**
 * Anthropic tool format (derived from ToolDefinition)
 */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

