/**
 * System Prompt Builder
 *
 * Pure utility functions for building system prompt sections.
 * These functions generate prompt content without modifying state directly.
 *
 * @packageDocumentation
 */

import type { LLMTool } from "../../llm/client.js";
import type { ProviderDefinition } from "../../provider/config.js";
import type { SupportedLanguageType } from "../../schemas/settings-schemas.js";

/**
 * Section header markers for system prompt sections
 * Centralized to ensure consistency and easy updates
 */
const SECTION_MARKERS = {
  SESSION_CONTEXT: '[Session Context]',
  LANGUAGE_PREFERENCE: '[Language Preference]',
  NATIVE_SEARCH: '[Native Search Capability]',
  GROK_CAPABILITIES: '[Grok Agent Capabilities (xAI)]',
  MCP_TOOLS: 'MCP Tools (External Capabilities):',
} as const;

/**
 * Build a section header with consistent formatting
 * @param title Section title
 * @param lines Content lines
 * @returns Formatted section string
 */
function buildSection(title: string, lines: string[]): string {
  return ['', '---', title, ...lines].join('\n');
}

/**
 * Map of language codes to their full names for LLM instruction clarity
 */
const LANGUAGE_NAMES: Record<SupportedLanguageType, string> = {
  'en': 'English',
  'zh-CN': 'Simplified Chinese (简体中文)',
  'zh-TW': 'Traditional Chinese (繁體中文)',
  'ja': 'Japanese (日本語)',
  'ko': 'Korean (한국어)',
  'th': 'Thai (ภาษาไทย)',
  'vi': 'Vietnamese (Tiếng Việt)',
  'de': 'German (Deutsch)',
  'fr': 'French (Français)',
  'es': 'Spanish (Español)',
  'pt': 'Portuguese (Português)',
};

/**
 * Build the dynamic session context section for the system prompt.
 * Contains working directory and session timestamp.
 *
 * @param workingDir Current working directory (defaults to process.cwd())
 * @returns Formatted session context string
 */
export function buildSessionContext(workingDir?: string): string {
  return buildSection(SECTION_MARKERS.SESSION_CONTEXT, [
    `Working Directory: ${workingDir ?? process.cwd()}`,
    `Session Start: ${new Date().toISOString().split('T')[0]}`,
  ]);
}

/**
 * Build language preference instructions for the system prompt.
 * Tells the LLM to respond in the user's selected language.
 *
 * @param language The user's selected language code
 * @returns Language instruction string, or empty string for English (default)
 */
export function buildLanguageInstructions(language: SupportedLanguageType | undefined): string {
  // English is the default, no special instruction needed
  if (!language || language === 'en') {
    return '';
  }

  const languageName = LANGUAGE_NAMES[language] || language;

  return buildSection(SECTION_MARKERS.LANGUAGE_PREFERENCE, [
    `IMPORTANT: The user has selected ${languageName} as their preferred language.`,
    `You MUST respond in ${languageName} for all your replies.`,
    'Technical terms, code, file paths, and command outputs should remain in their original form.',
    'Only translate your explanations, questions, and conversational text.',
  ]);
}

/**
 * Check if a system prompt already contains language preference instructions.
 * Used to prevent duplicate instructions.
 *
 * @param content The current system prompt content
 * @returns true if language instructions already exist
 */
export function hasLanguageInstructions(content: string): boolean {
  return content.includes(SECTION_MARKERS.LANGUAGE_PREFERENCE);
}

/**
 * Build native search capability instructions for providers that support it.
 * This informs the LLM about its built-in web search capabilities.
 *
 * @param provider The active provider definition
 * @returns Search instructions string, or empty string if provider doesn't support search
 */
export function buildNativeSearchInstructions(provider: ProviderDefinition | null | undefined): string {
  // Only add instructions for providers that support native search
  if (!provider?.features.supportsSearch) {
    return '';
  }

  return buildSection(SECTION_MARKERS.NATIVE_SEARCH, [
    `You have NATIVE web search capability through the ${provider.displayName} API.`,
    'When users ask about current events, recent information, or anything requiring up-to-date data:',
    '- You CAN and SHOULD search the web - the API will automatically handle search queries',
    '- Simply respond with information that requires current data - search happens automatically',
    '- Do NOT say you cannot search the web or access current information',
    '- The search is built into your API - you DO have real-time web access',
  ]);
}

/**
 * Build Grok-specific capability instructions (xAI Agent Tools API).
 * This informs the LLM about Grok's unique server-side tool capabilities.
 *
 * @param provider The active provider definition
 * @returns Grok capabilities string, or empty string if not a Grok provider
 */
export function buildGrokCapabilitiesInstructions(provider: ProviderDefinition | null | undefined): string {
  // Only add instructions for Grok provider with server-side tool support
  if (!provider?.features.supportsServerTools) {
    return '';
  }

  const capabilities: string[] = [];

  if (provider.features.supportsParallelFunctionCalling) {
    capabilities.push('- PARALLEL TOOL CALLING: When multiple tools are needed, call them ALL in a single response');
    capabilities.push('  The server will execute them in parallel for faster completion');
  }

  if (provider.features.supportsXSearch) {
    capabilities.push('- X (TWITTER) SEARCH: You can search X/Twitter posts for real-time social media data');
  }

  if (provider.features.supportsCodeExecution) {
    capabilities.push('- CODE EXECUTION SANDBOX: Server-side Python execution is available for computation tasks');
  }

  if (capabilities.length === 0) {
    return '';
  }

  return buildSection(SECTION_MARKERS.GROK_CAPABILITIES, [
    'You have enhanced server-side tool capabilities through the xAI Agent Tools API:',
    ...capabilities,
    '',
    'OPTIMIZATION: When a task requires multiple independent tool calls (e.g., reading multiple files,',
    'running multiple searches), make ALL calls in a SINGLE response to leverage parallel execution.',
    'This significantly reduces total response time.',
  ]);
}

/**
 * Check if a system prompt already contains Grok capabilities instructions.
 * Used to prevent duplicate instructions.
 *
 * @param content The current system prompt content
 * @returns true if Grok capabilities instructions already exist
 */
export function hasGrokCapabilitiesInstructions(content: string): boolean {
  return content.includes(SECTION_MARKERS.GROK_CAPABILITIES);
}

/**
 * Format a single MCP tool for display in the system prompt.
 *
 * @param tool The LLM tool definition
 * @returns Formatted tool string for prompt
 */
export function formatMCPTool(tool: LLMTool): string {
  const friendlyName = tool.function.name.replace(/^mcp__[^_]+__/, '');
  const description = tool.function.description?.split('\n')[0] || 'External tool';
  return `- ${friendlyName}: ${description}`;
}

/**
 * Build MCP tools section for the system prompt.
 * Lists available MCP tools and provides usage instructions.
 *
 * @param mcpTools Array of available MCP tools
 * @param hasNativeSearch Whether the provider has native search capability
 * @returns MCP tools section string, or empty string if no tools
 */
export function buildMCPToolsSection(
  mcpTools: LLMTool[],
  hasNativeSearch: boolean = false
): string {
  if (mcpTools.length === 0) {
    return '';
  }

  const mcpToolsList = mcpTools
    .map(formatMCPTool)
    .join('\n');

  // For providers without native search, tell them to use MCP tools for web access
  // For providers WITH native search, just mention MCP is for specific URL fetching
  const searchInstructions = hasNativeSearch
    ? '\nUse MCP tools for fetching specific URLs, reading web pages, and other external data access.'
    : '\nIMPORTANT: Use MCP tools for web search, fetching URLs, and external data access. You HAVE network access through these tools.';

  return [
    `\n\n${SECTION_MARKERS.MCP_TOOLS}`,
    mcpToolsList,
    searchInstructions,
  ].join('\n');
}

/**
 * Check if a system prompt already contains native search instructions.
 * Used to prevent duplicate instructions.
 *
 * @param content The current system prompt content
 * @returns true if native search instructions already exist
 */
export function hasNativeSearchInstructions(content: string): boolean {
  return content.includes(SECTION_MARKERS.NATIVE_SEARCH);
}

/**
 * Check if a system prompt already contains MCP tools section.
 * Used to prevent duplicate updates.
 *
 * @param content The current system prompt content
 * @returns true if MCP tools section already exists
 */
export function hasMCPToolsSection(content: string): boolean {
  return content.includes(SECTION_MARKERS.MCP_TOOLS);
}

/**
 * Build a complete system prompt by combining base prompt with dynamic sections.
 *
 * @param basePrompt The base system prompt from configuration
 * @param options Options for additional sections
 * @returns Complete system prompt
 */
export function buildCompleteSystemPrompt(
  basePrompt: string,
  options: {
    workingDir?: string;
    provider?: ProviderDefinition | null;
    mcpTools?: LLMTool[];
    language?: SupportedLanguageType;
  } = {}
): string {
  let prompt = basePrompt;

  // Add language preference instructions (at the top for visibility)
  if (options.language) {
    prompt += buildLanguageInstructions(options.language);
  }

  // Add session context
  prompt += buildSessionContext(options.workingDir);

  // Add native search instructions if provider supports it
  if (options.provider) {
    prompt += buildNativeSearchInstructions(options.provider);

    // Add Grok-specific capability instructions (xAI Agent Tools API)
    prompt += buildGrokCapabilitiesInstructions(options.provider);
  }

  // Add MCP tools section if tools are available
  if (options.mcpTools && options.mcpTools.length > 0) {
    const hasNativeSearch = options.provider?.features.supportsSearch ?? false;
    prompt += buildMCPToolsSection(options.mcpTools, hasNativeSearch);
  }

  return prompt;
}

/**
 * Append native search instructions to existing content if not already present.
 *
 * @param content Current prompt content
 * @param provider Active provider definition
 * @returns Updated content with search instructions (or unchanged if already present)
 */
export function appendNativeSearchInstructions(
  content: string,
  provider: ProviderDefinition | null | undefined
): string {
  if (hasNativeSearchInstructions(content)) {
    return content;
  }
  return content + buildNativeSearchInstructions(provider);
}

/**
 * Append MCP tools section to existing content if not already present.
 *
 * @param content Current prompt content
 * @param mcpTools Available MCP tools
 * @param hasNativeSearch Whether provider has native search
 * @returns Updated content with MCP tools section (or unchanged if already present)
 */
export function appendMCPToolsSection(
  content: string,
  mcpTools: LLMTool[],
  hasNativeSearch: boolean = false
): string {
  if (hasMCPToolsSection(content)) {
    return content;
  }
  return content + buildMCPToolsSection(mcpTools, hasNativeSearch);
}

/**
 * Append Grok capabilities instructions to existing content if not already present.
 *
 * @param content Current prompt content
 * @param provider Active provider definition
 * @returns Updated content with Grok capabilities (or unchanged if already present)
 */
export function appendGrokCapabilitiesInstructions(
  content: string,
  provider: ProviderDefinition | null | undefined
): string {
  if (hasGrokCapabilitiesInstructions(content)) {
    return content;
  }
  return content + buildGrokCapabilitiesInstructions(provider);
}
