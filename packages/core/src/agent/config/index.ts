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
  buildMCPToolsSection,
  buildCompleteSystemPrompt,
  formatMCPTool,
  hasNativeSearchInstructions,
  hasMCPToolsSection,
  appendNativeSearchInstructions,
  appendMCPToolsSection,
} from "./system-prompt-builder.js";
