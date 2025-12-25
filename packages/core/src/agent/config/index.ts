/**
 * Agent Configuration Modules
 *
 * @packageDocumentation
 */

export {
  AgentConfigManager,
  createAgentConfigManager,
  type AgentConfigManagerOptions,
  type AutoThinkingEnabledEvent,
  type ChatOptions,
} from "./agent-config.js";

export {
  buildSessionContext,
  buildNativeSearchInstructions,
  buildGrokCapabilitiesInstructions,
  buildMCPToolsSection,
  buildCompleteSystemPrompt,
  buildLanguageInstructions,
  formatMCPTool,
  hasNativeSearchInstructions,
  hasGrokCapabilitiesInstructions,
  hasMCPToolsSection,
  hasLanguageInstructions,
  appendNativeSearchInstructions,
  appendGrokCapabilitiesInstructions,
  appendMCPToolsSection,
} from "./system-prompt-builder.js";
