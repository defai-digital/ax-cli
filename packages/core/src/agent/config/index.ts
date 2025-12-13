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
  formatMCPTool,
  hasNativeSearchInstructions,
  hasGrokCapabilitiesInstructions,
  hasMCPToolsSection,
  appendNativeSearchInstructions,
  appendGrokCapabilitiesInstructions,
  appendMCPToolsSection,
} from "./system-prompt-builder.js";
