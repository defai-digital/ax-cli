/**
 * System Prompt Builder
 * Builds AI assistant prompts from YAML configuration
 */

import { loadPromptsConfig, type PromptSection } from './config-loader.js';

/**
 * Build the system prompt for the AI assistant
 */
export function buildSystemPrompt(options: {
  hasMorphEditor: boolean;
  customInstructions?: string;
}): string {
  const config = loadPromptsConfig();
  const sections: string[] = [];

  // Identity
  sections.push(config.system_prompt.identity);

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

  // List tools
  const toolsList = config.system_prompt.tools
    .filter(tool => !tool.optional || (tool.optional && tool.name === 'edit_file' && options.hasMorphEditor))
    .map(tool => `- ${tool.name}: ${tool.description}`)
    .join('\n');
  sections.push(toolsList);

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
