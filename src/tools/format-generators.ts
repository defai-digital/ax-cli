/**
 * Format Generators for Tool Definitions
 *
 * Converts rich ToolDefinition objects to various output formats:
 * - OpenAI function calling format
 * - Anthropic tool format
 * - System prompt sections
 *
 * These are DERIVED formats - the ToolDefinition is the source of truth.
 */

import type {
  ToolDefinition,
  AnthropicTool,
  ParameterDefinition,
} from './types.js';
import type { LLMTool, JSONSchemaValue } from '../llm/client.js';

/**
 * Convert ParameterDefinition to JSON Schema format for OpenAI
 */
function toJSONSchemaProperty(param: ParameterDefinition): JSONSchemaValue {
  // Build the base schema
  const baseSchema: { type: string; description: string; [key: string]: unknown } = {
    type: param.type,
    description: param.description,
  };

  if (param.default !== undefined) {
    baseSchema.default = param.default;
  }

  if (param.enum) {
    baseSchema.enum = param.enum;
  }

  if (param.items && param.type === 'array') {
    const items = param.items as { type: string; properties?: Record<string, ParameterDefinition>; required?: string[] };
    if (items.type === 'object' && items.properties) {
      baseSchema.items = {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(items.properties).map(([key, val]) => [
            key,
            toJSONSchemaProperty(val),
          ])
        ),
        required: items.required || [],
      };
    } else {
      baseSchema.items = { type: items.type };
    }
  }

  return baseSchema as JSONSchemaValue;
}

/**
 * Generate a compact description suitable for API calls
 *
 * The compact description is the first paragraph plus key constraints
 * for dangerous tools.
 */
export function generateCompactDescription(tool: ToolDefinition): string {
  // Get first paragraph (up to first double newline or 500 chars)
  const firstParagraph = tool.description.split('\n\n')[0].slice(0, 500);

  // For dangerous tools, add the most important constraint
  if (tool.safetyLevel === 'dangerous' && tool.constraints.length > 0) {
    return `${firstParagraph} IMPORTANT: ${tool.constraints[0]}`;
  }

  return firstParagraph;
}

/**
 * Convert rich ToolDefinition to OpenAI function calling format
 *
 * This is a DERIVED format for API calls. The full tool details
 * should be provided in the system prompt.
 */
export function toOpenAIFormat(tool: ToolDefinition): LLMTool {
  const properties: Record<string, JSONSchemaValue> = {};

  for (const [name, param] of Object.entries(tool.parameters.properties)) {
    properties[name] = toJSONSchemaProperty(param);
  }

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: generateCompactDescription(tool),
      parameters: {
        type: 'object',
        properties,
        required: tool.parameters.required,
      },
    },
  };
}

/**
 * Convert rich ToolDefinition to Anthropic tool format
 */
export function toAnthropicFormat(tool: ToolDefinition): AnthropicTool {
  const properties: Record<string, unknown> = {};

  for (const [name, param] of Object.entries(tool.parameters.properties)) {
    properties[name] = toJSONSchemaProperty(param);
  }

  return {
    name: tool.name,
    description: generateCompactDescription(tool),
    input_schema: {
      type: 'object',
      properties,
      required: tool.parameters.required,
    },
  };
}

/**
 * Generate a full system prompt section for a tool
 *
 * This includes all the rich metadata: description, parameters,
 * usage notes, constraints, anti-patterns, and examples.
 */
export function toSystemPromptSection(tool: ToolDefinition): string {
  const sections: string[] = [];

  // Header
  sections.push(`## ${tool.displayName}`);
  sections.push('');
  sections.push(tool.description);
  sections.push('');

  // Parameters
  sections.push('### Parameters');
  sections.push('');
  for (const [name, param] of Object.entries(tool.parameters.properties)) {
    const required = tool.parameters.required.includes(name) ? '(required)' : '(optional)';
    sections.push(`- \`${name}\` ${required}: ${param.description}`);
    if (param.default !== undefined) {
      sections.push(`  - Default: \`${JSON.stringify(param.default)}\``);
    }
    if (param.enum) {
      sections.push(`  - Options: ${param.enum.map(e => `\`${e}\``).join(', ')}`);
    }
    if (param.examples && param.examples.length > 0) {
      sections.push(`  - Examples: ${param.examples.map(e => `\`${JSON.stringify(e)}\``).join(', ')}`);
    }
    if (param.constraints && param.constraints.length > 0) {
      param.constraints.forEach(c => sections.push(`  - ${c}`));
    }
  }
  sections.push('');

  // Usage Notes
  if (tool.usageNotes.length > 0) {
    sections.push('### Usage Notes');
    sections.push('');
    tool.usageNotes.forEach(note => sections.push(`- ${note}`));
    sections.push('');
  }

  // Constraints
  if (tool.constraints.length > 0) {
    sections.push('### Constraints');
    sections.push('');
    tool.constraints.forEach(c => sections.push(`- ${c}`));
    sections.push('');
  }

  // Anti-patterns (when NOT to use)
  if (tool.antiPatterns && tool.antiPatterns.length > 0) {
    sections.push('### Do NOT Use When');
    sections.push('');
    tool.antiPatterns.forEach(ap => sections.push(`- ${ap}`));
    sections.push('');
  }

  // Examples
  if (tool.examples.length > 0) {
    sections.push('### Examples');
    sections.push('');
    tool.examples.forEach(ex => {
      sections.push(`**${ex.description}**`);
      sections.push(`- Scenario: ${ex.scenario}`);
      sections.push(`- Input: \`${JSON.stringify(ex.input)}\``);
      sections.push(`- Expected: ${ex.expectedBehavior}`);
      if (ex.notes) {
        sections.push(`- Note: ${ex.notes}`);
      }
      sections.push('');
    });
  }

  // Related tools
  if (tool.relatedTools && tool.relatedTools.length > 0) {
    sections.push(`**Related tools:** ${tool.relatedTools.join(', ')}`);
    sections.push('');
  }

  // Alternatives
  if (tool.alternatives && tool.alternatives.length > 0) {
    sections.push(`**Alternatives:** ${tool.alternatives.join(', ')}`);
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Generate the complete tool instructions section for system prompt
 *
 * @param tools - Array of tool definitions
 * @returns Formatted markdown string with all tool documentation
 */
export function generateToolInstructions(tools: ToolDefinition[]): string {
  const sections: string[] = [];

  sections.push('# Available Tools');
  sections.push('');
  sections.push('The following tools are available. Read each description carefully before using.');
  sections.push('');

  // Group tools by category
  const byCategory = new Map<string, ToolDefinition[]>();
  for (const tool of tools) {
    for (const category of tool.categories) {
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      const categoryTools = byCategory.get(category);
      if (categoryTools) {
        categoryTools.push(tool);
      }
    }
  }

  // Generate sections by category
  const categoryOrder: string[] = [
    'file-operations',
    'command-execution',
    'search',
    'task-management',
    'user-interaction',
    'agent-delegation',
    'design',
    'web',
  ];

  for (const category of categoryOrder) {
    const categoryTools = byCategory.get(category);
    if (categoryTools && categoryTools.length > 0) {
      sections.push(`---`);
      sections.push('');
      sections.push(`# ${formatCategoryName(category)}`);
      sections.push('');

      // Deduplicate tools (a tool might be in multiple categories)
      const seen = new Set<string>();
      for (const tool of categoryTools) {
        if (!seen.has(tool.name)) {
          seen.add(tool.name);
          sections.push(toSystemPromptSection(tool));
          sections.push('---');
          sections.push('');
        }
      }
    }
  }

  // Add general tool usage principles
  sections.push('# Tool Usage Principles');
  sections.push('');
  sections.push('1. **Use specialized tools over general tools** - Use view_file instead of bash cat');
  sections.push('2. **Read before editing** - Always view_file before str_replace_editor');
  sections.push('3. **Parallel execution** - Make independent tool calls in parallel');
  sections.push('4. **Sequential for dependencies** - Chain dependent calls with proper ordering');
  sections.push('5. **Never guess parameters** - Ask if unsure about required values');
  sections.push('6. **Match exact content** - For str_replace_editor, copy exact text from file');
  sections.push('');

  return sections.join('\n');
}

/**
 * Format category name for display
 */
function formatCategoryName(category: string): string {
  const names: Record<string, string> = {
    'file-operations': 'File Operations',
    'command-execution': 'Command Execution',
    'search': 'Search',
    'task-management': 'Task Management',
    'user-interaction': 'User Interaction',
    'agent-delegation': 'Agent Delegation',
    'design': 'Design Tools',
    'web': 'Web Tools',
  };
  return names[category] || category;
}

/**
 * Calculate total token cost for a set of tools
 *
 * Useful for budget planning and deciding which tools to include
 */
export function calculateTotalTokenCost(tools: ToolDefinition[]): number {
  return tools.reduce((sum, tool) => sum + tool.tokenCost, 0);
}

/**
 * Filter tools by category
 */
export function filterByCategory(
  tools: ToolDefinition[],
  categories: string[]
): ToolDefinition[] {
  return tools.filter(tool =>
    tool.categories.some(c => categories.includes(c))
  );
}

/**
 * Filter tools by safety level
 */
export function filterBySafetyLevel(
  tools: ToolDefinition[],
  levels: Array<'safe' | 'moderate' | 'dangerous'>
): ToolDefinition[] {
  return tools.filter(tool => levels.includes(tool.safetyLevel));
}

/**
 * Get tools that require confirmation
 */
export function getToolsRequiringConfirmation(tools: ToolDefinition[]): ToolDefinition[] {
  return tools.filter(tool => tool.requiresConfirmation);
}
