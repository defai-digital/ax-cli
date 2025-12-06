/**
 * System Prompt Builder
 * Builds AI assistant prompts from YAML configuration
 * Integrates project memory for z.ai GLM-4.6 caching
 */

import { loadPromptsConfig, type PromptSection } from './config-loader.js';
import { getContextInjector } from '../memory/index.js';
import { getMCPManager } from '../llm/tools.js';

/**
 * Build the system prompt for the AI assistant
 * @param options.customInstructions - Custom instructions from CUSTOM.md
 * @param options.includeMemory - Whether to include project memory (default: true)
 */
export function buildSystemPrompt(options: {
  customInstructions?: string;
  includeMemory?: boolean;
}): string {
  const config = loadPromptsConfig();
  const sections: string[] = [];

  // Project Memory Context (prepended for z.ai caching)
  // This should be first and consistent to maximize cache hits
  const includeMemory = options.includeMemory !== false;
  if (includeMemory) {
    const injector = getContextInjector();
    const memoryContext = injector.getContext();
    if (memoryContext) {
      sections.push(memoryContext);
      sections.push('\n---\n');
    }
  }

  // Identity
  sections.push(config.system_prompt.identity);

  // Professional objectivity (if defined) - key for reducing sycophancy
  if (config.system_prompt.professional_objectivity) {
    sections.push(formatSection(config.system_prompt.professional_objectivity));
  }

  // Core principles (if defined)
  if (config.system_prompt.core_principles) {
    sections.push(formatSection(config.system_prompt.core_principles));
  }

  // Custom instructions (if provided)
  if (options.customInstructions) {
    sections.push(
      config.custom_instructions_prefix +
      options.customInstructions +
      config.custom_instructions_suffix
    );
  }

  // Tools header
  sections.push(`\n${config.system_prompt.tools_header}`);

  // List built-in tools
  const toolsList = config.system_prompt.tools
    .filter(tool => !tool.optional)
    .map(tool => `- ${tool.name}: ${tool.description}`)
    .join('\n');
  sections.push(toolsList);

  // Add MCP tools if available
  const mcpManager = getMCPManager();
  const mcpTools = mcpManager?.getTools() || [];
  if (mcpTools.length > 0) {
    sections.push('\nMCP Tools (External Capabilities):');
    const mcpToolsList = mcpTools
      .map(tool => {
        // Extract friendly name from mcp__server__toolname format
        const friendlyName = tool.name.replace(/^mcp__[^_]+__/, '');
        const description = tool.description?.split('\n')[0] || 'External tool';
        return `- ${friendlyName}: ${description}`;
      })
      .join('\n');
    sections.push(mcpToolsList);
    sections.push('\nIMPORTANT: Use MCP tools for web search, fetching URLs, and external data access. You HAVE network access through these tools.');
  }

  // Add all configured sections
  for (const section of Object.values(config.system_prompt.sections)) {
    sections.push(formatSection(section));
  }

  // Closing statement
  sections.push(`\n${config.system_prompt.closing}`);

  return sections.join('\n');
}

/**
 * Format a prompt section with its content
 */
function formatSection(section: PromptSection): string {
  const parts: string[] = [];

  if (section.title) {
    parts.push(`\n${section.title}:`);
  }

  if (section.content) {
    parts.push(section.content);
  }

  if (section.rules) {
    parts.push(...section.rules.map(rule => `- ${rule}`));
  }

  if (section.steps) {
    section.steps.forEach((step, index) => {
      parts.push(`${index + 1}. ${step}`);
    });
  }

  if (section.guidelines) {
    parts.push(...section.guidelines.map(guideline => `- ${guideline}`));
  }

  return parts.join('\n');
}
