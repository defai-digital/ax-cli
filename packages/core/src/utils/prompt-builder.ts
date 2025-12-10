/**
 * System Prompt Builder
 * Builds AI assistant prompts from YAML configuration
 * Integrates project memory for z.ai GLM-4.6 caching
 * Includes project index (ax.index.json) for project understanding
 * Includes priority-based tool selection guidance
 */

import { loadPromptsConfig, type PromptSection } from './config-loader.js';
import { getContextInjector } from '../memory/index.js';
import { getMCPManager } from '../llm/tools.js';
import { getActiveProvider } from '../provider/config.js';
import { getPriorityRegistry } from '../tools/priority-registry.js';
import { getProjectIndexManager } from './project-index-manager.js';

/**
 * Build the system prompt for the AI assistant
 * @param options.customInstructions - Custom instructions from CUSTOM.md
 * @param options.includeMemory - Whether to include project memory (default: true)
 * @param options.includeProjectIndex - Whether to include project index (default: true)
 */
export function buildSystemPrompt(options: {
  customInstructions?: string;
  includeMemory?: boolean;
  includeProjectIndex?: boolean;
}): string {
  const config = loadPromptsConfig();
  const sections: string[] = [];

  // Project Index Context (ax.index.json) - project structure and tech stack
  // This helps the AI understand the project before starting
  const includeProjectIndex = options.includeProjectIndex !== false;
  if (includeProjectIndex) {
    const indexManager = getProjectIndexManager();
    const projectContext = indexManager.getPromptContext();
    if (projectContext) {
      sections.push(projectContext);
      sections.push('\n---\n');
    }
  }

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

  // New Claude Code-style sections (if defined)
  const namedSections = [
    'thinking',
    'autonomy',
    'context',
    'tools',
    'verification',
    'safety',
    'code_quality',
    'scenarios',
    'communication',
    'agents',
    'uncertainty',
  ] as const;

  for (const sectionName of namedSections) {
    const section = config.system_prompt[sectionName];
    if (section) {
      sections.push(formatSection(section));
    }
  }

  // Legacy: Professional objectivity (if defined)
  if (config.system_prompt.professional_objectivity) {
    sections.push(formatSection(config.system_prompt.professional_objectivity));
  }

  // Legacy: Core principles (if defined)
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

  // Legacy: Tools header and list (if defined in old format)
  if (config.system_prompt.tools_header && Array.isArray(config.system_prompt.sections?.tools)) {
    sections.push(`\n${config.system_prompt.tools_header}`);
    // Old format had tools as array
  }

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

    // Provider-aware search instructions
    // Only recommend MCP for web search if the provider doesn't have native search
    const activeProvider = getActiveProvider();
    const hasNativeSearch = activeProvider.features.supportsSearch;

    if (hasNativeSearch) {
      // Provider has native search (e.g., Grok) - use it directly
      sections.push(`\nIMPORTANT: You have NATIVE web search capability through the ${activeProvider.displayName} API. For web searches, simply ask questions that require current information - the API will automatically search the web. Use MCP tools for fetching specific URLs and other external data access.`);
    } else {
      // Provider doesn't have native search (e.g., GLM) - use MCP tools
      sections.push('\nIMPORTANT: Use MCP tools for web search, fetching URLs, and external data access. You HAVE network access through these tools.');
    }

    // Add priority-based tool selection guidance
    const registry = getPriorityRegistry();
    const guidance = registry.getCapabilityGuidance();
    if (guidance.length > 0) {
      sections.push('\nTool Selection Guidelines:');
      sections.push(guidance.map(g => `- ${g}`).join('\n'));
    }
  }

  // Legacy: Add all configured sections from old format
  if (config.system_prompt.sections) {
    for (const section of Object.values(config.system_prompt.sections)) {
      sections.push(formatSection(section));
    }
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
