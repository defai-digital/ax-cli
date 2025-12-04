/**
 * Tool Definitions - Barrel Export
 *
 * This file exports all tool definitions and provides the TOOL_DEFINITIONS array
 * which is the single source of truth for all tool metadata.
 */

import type { ToolDefinition } from '../types.js';

// Core tools
export { bashTool } from './bash.js';
export { bashOutputTool } from './bash-output.js';
export { viewFileTool } from './view-file.js';
export { createFileTool } from './create-file.js';
export { strReplaceEditorTool } from './str-replace-editor.js';
export { multiEditTool } from './multi-edit.js';
export { searchTool } from './search.js';
export { createTodoListTool, updateTodoListTool } from './todo.js';
export { askUserTool } from './ask-user.js';
export { axAgentTool } from './ax-agent.js';
export {
  figmaMapTool,
  figmaTokensTool,
  figmaAuditTool,
  figmaSearchTool,
  figmaAliasListTool,
  figmaAliasResolveTool,
} from './design.js';

// Import all tools for the array
import { bashTool } from './bash.js';
import { bashOutputTool } from './bash-output.js';
import { viewFileTool } from './view-file.js';
import { createFileTool } from './create-file.js';
import { strReplaceEditorTool } from './str-replace-editor.js';
import { multiEditTool } from './multi-edit.js';
import { searchTool } from './search.js';
import { createTodoListTool, updateTodoListTool } from './todo.js';
import { askUserTool } from './ask-user.js';
import { axAgentTool } from './ax-agent.js';
import {
  figmaMapTool,
  figmaTokensTool,
  figmaAuditTool,
  figmaSearchTool,
  figmaAliasListTool,
  figmaAliasResolveTool,
} from './design.js';

/**
 * All tool definitions - Single Source of Truth
 *
 * This array contains all rich tool definitions with Claude Code-quality
 * descriptions, usage notes, constraints, and examples.
 *
 * OpenAI and Anthropic formats are DERIVED from these definitions using
 * the format generators.
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // File operations
  viewFileTool,
  createFileTool,
  strReplaceEditorTool,
  multiEditTool,

  // Command execution
  bashTool,
  bashOutputTool,

  // Search
  searchTool,

  // Task management
  createTodoListTool,
  updateTodoListTool,

  // User interaction
  askUserTool,

  // Agent delegation
  axAgentTool,

  // Design tools
  figmaMapTool,
  figmaTokensTool,
  figmaAuditTool,
  figmaSearchTool,
  figmaAliasListTool,
  figmaAliasResolveTool,
];

/**
 * Get a tool definition by name
 */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}

/**
 * Get tool definitions by category
 */
export function getToolsByCategory(category: string): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((t) =>
    t.categories.includes(category as ToolDefinition['categories'][number])
  );
}

/**
 * Get tool definitions by safety level
 */
export function getToolsBySafetyLevel(
  level: 'safe' | 'moderate' | 'dangerous'
): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((t) => t.safetyLevel === level);
}

/**
 * Get tool definitions that require confirmation
 */
export function getToolsRequiringConfirmation(): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((t) => t.requiresConfirmation);
}

/**
 * Calculate total token cost for all tools
 */
export function getTotalTokenCost(): number {
  return TOOL_DEFINITIONS.reduce((sum, t) => sum + t.tokenCost, 0);
}
