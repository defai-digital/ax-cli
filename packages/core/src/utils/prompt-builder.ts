/**
 * System Prompt Builder
 * Builds AI assistant prompts from YAML configuration
 * Integrates project memory for z.ai GLM-4.6 caching
 * Includes project context (AX.md or legacy ax.index.json) for project understanding
 * Includes priority-based tool selection guidance
 * Includes user language preference for multilingual responses
 */

import { loadPromptsConfig, type PromptSection } from './config-loader.js';
import { getContextInjector } from '../memory/index.js';
import { getMCPManager, convertMCPToolToLLMTool } from '../llm/tools.js';
import { getActiveProvider } from '../provider/config.js';
import { getPriorityRegistry } from '../tools/priority-registry.js';
import { getProjectIndexManager } from './project-index-manager.js';
import { getSettingsManager } from './settings-manager.js';
import {
  buildLanguageInstructions,
  buildMCPToolsSection,
} from '../agent/config/system-prompt-builder.js';

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

  // Project Context (AX.md preferred, falls back to ax.index.json)
  // This helps the AI understand the project before starting
  // Priority: AX.md > ax.summary.json > ax.index.json
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

  // Language preference (if user selected a non-English language)
  // Placed early in the prompt for high visibility
  try {
    const settingsManager = getSettingsManager();
    const language = settingsManager.getLanguage();
    const languageInstruction = buildLanguageInstructions(language);
    if (languageInstruction) {
      sections.push(languageInstruction);
    }
  } catch {
    // Ignore errors - language setting is optional enhancement
  }

  // P0/P2 sections: Professional tone and behavior (PRD-001)
  // These come first to establish tone and expectations
  const toneSections = [
    'professional_objectivity',
    'no_time_estimates',  // P2: Explicit prohibition of time estimates
    'tone_and_style',
  ] as const;

  for (const sectionName of toneSections) {
    const section = config.system_prompt[sectionName];
    if (section) {
      sections.push(formatSection(section));
    }
  }

  // Core behavior sections (Claude Code-style)
  const namedSections = [
    'thinking',
    'task_management',  // P0: Task management integration (PRD-001)
    'autonomy',
    'context',
    'code_references',  // P0: Code reference format (PRD-001)
    'parallel_execution',  // P0: Parallel execution guidance (PRD-001)
  ] as const;

  for (const sectionName of namedSections) {
    const section = config.system_prompt[sectionName];
    if (section) {
      sections.push(formatSection(section));
    }
  }

  // P0 sections: Tool-specific guidance (PRD-001)
  // Detailed anti-patterns and examples for each tool
  const toolSections = [
    'tool_bash',
    'tool_view_file',
    'tool_str_replace_editor',
    'tool_search',
  ] as const;

  for (const sectionName of toolSections) {
    const section = config.system_prompt[sectionName];
    if (section) {
      sections.push(formatSection(section));
    }
  }

  // P1 sections: Codebase exploration (PRD-001)
  const explorationSections = [
    'exploration_pattern',  // P1: Codebase exploration methodology
  ] as const;

  for (const sectionName of explorationSections) {
    const section = config.system_prompt[sectionName];
    if (section) {
      sections.push(formatSection(section));
    }
  }

  // General tools overview and remaining behavior sections
  const behaviorSections = [
    'tools',
    'verification',
    'safety',
    'code_quality',
    'scenarios',
    'communication',
    'agents',
    'uncertainty',
  ] as const;

  for (const sectionName of behaviorSections) {
    const section = config.system_prompt[sectionName];
    if (section) {
      sections.push(formatSection(section));
    }
  }

  // P0 sections: Git workflow guidance (PRD-001)
  const gitSections = [
    'git_commit_workflow',
    'git_pr_workflow',
  ] as const;

  for (const sectionName of gitSections) {
    const section = config.system_prompt[sectionName];
    if (section) {
      sections.push(formatSection(section));
    }
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
    // Convert MCPTool[] to LLMTool[] using shared utility
    const llmTools = mcpTools.map(convertMCPToolToLLMTool);

    // Use shared function to build MCP tools section
    const activeProvider = getActiveProvider();
    const hasNativeSearch = activeProvider.features.supportsSearch;
    const mcpSection = buildMCPToolsSection(llmTools, hasNativeSearch);
    if (mcpSection) {
      sections.push(mcpSection);
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
