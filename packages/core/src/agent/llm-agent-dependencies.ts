/**
 * LLM Agent Dependency Injection
 *
 * Provides dependency injection for LLMAgent to enable better testability.
 * Tests can override individual dependencies without mocking entire modules.
 *
 * @packageDocumentation
 */

import { getSettingsManager as defaultGetSettingsManager } from "../utils/settings-manager.js";
import { getTokenCounter as defaultGetTokenCounter, type TokenCounter } from "../utils/token-counter.js";
import { loadCustomInstructions as defaultLoadCustomInstructions } from "../utils/custom-instructions.js";
import { buildSystemPrompt as defaultBuildSystemPrompt } from "../utils/prompt-builder.js";
import { getCheckpointManager as defaultGetCheckpointManager, type CheckpointManager } from "../checkpoint/index.js";
import { getTaskPlanner as defaultGetTaskPlanner, type TaskPlanner } from "../planner/index.js";
import { getStatusReporter as defaultGetStatusReporter } from "./status-reporter.js";
import { getLoopDetector as defaultGetLoopDetector, resetLoopDetector as defaultResetLoopDetector } from "./loop-detector.js";
import { getActiveProvider as defaultGetActiveProvider, type ProviderDefinition } from "../provider/config.js";
import { loadMCPConfig as defaultLoadMCPConfig, type MCPConfig } from "../mcp/config.js";
import {
  getAllTools as defaultGetAllTools,
  getMCPManager as defaultGetMCPManager,
  initializeMCPServers as defaultInitializeMCPServers,
} from "../llm/tools.js";
import { type MCPManager } from "../mcp/client.js";
import { resolveMCPReferences as defaultResolveMCPReferences, extractMCPReferences as defaultExtractMCPReferences } from "../mcp/resources.js";
import { LLMClient } from "../llm/client.js";
import { ContextManager } from "./context-manager.js";
import { SubagentOrchestrator } from "./subagent-orchestrator.js";
import { ToolExecutor } from "./execution/index.js";
import { StreamHandler } from "./streaming/index.js";
import { PlanExecutor } from "./planning/index.js";
import type { LLMTool } from "../llm/client.js";
import type { StatusReporter } from "./status-reporter.js";
import type { LoopDetector } from "./loop-detector.js";
import type { SettingsManager } from "../utils/settings-manager.js";

/**
 * Dependency injection interface for LLMAgent
 *
 * All dependencies can be individually overridden for testing.
 * Default implementations use the real production modules.
 */
export interface LLMAgentDependencies {
  // Settings and configuration
  getSettingsManager: () => SettingsManager;

  // Token counting
  getTokenCounter: (model: string) => TokenCounter;

  // Custom instructions and prompt building
  loadCustomInstructions: () => string | null;
  buildSystemPrompt: (options: {
    customInstructions?: string;
    includeMemory?: boolean;
    includeProjectIndex?: boolean;
  }) => string;

  // Checkpoint management
  getCheckpointManager: () => CheckpointManager;

  // Task planning
  getTaskPlanner: () => TaskPlanner;

  // Status reporting
  getStatusReporter: () => StatusReporter;

  // Loop detection
  getLoopDetector: () => LoopDetector;
  resetLoopDetector: () => void;

  // Provider configuration
  getActiveProvider: () => ProviderDefinition | null;

  // MCP configuration and tools
  loadMCPConfig: (cwd?: string) => MCPConfig;
  getAllTools: () => Promise<LLMTool[]>;
  getMCPManager: () => MCPManager;
  initializeMCPServers: (clientConfig?: { name?: string; version?: string }) => Promise<void>;
  resolveMCPReferences: (message: string) => Promise<string>;
  extractMCPReferences: (message: string) => string[];

  // Factory functions for creating instances (allows complete replacement)
  createLLMClient?: (apiKey: string, model: string, baseURL?: string) => LLMClient;
  createContextManager?: (options: { model: string }) => ContextManager;
  createSubagentOrchestrator?: (options: { maxConcurrentAgents: number }) => SubagentOrchestrator;
  createToolExecutor?: (options: ToolExecutorOptions) => ToolExecutor;
  createStreamHandler?: (options: StreamHandlerOptions) => StreamHandler;
  createPlanExecutor?: (options: PlanExecutorOptions) => PlanExecutor;
}

/**
 * ToolExecutor creation options
 */
export interface ToolExecutorOptions {
  checkpointCallback: (files: string[], description: string) => Promise<void>;
  onAxAgentStart: (agentName: string) => void;
  onAxAgentEnd: (agentName: string) => void;
}

/**
 * StreamHandler creation options
 */
export interface StreamHandlerOptions {
  isCancelled: () => boolean;
  yieldCancellation: () => AsyncGenerator<{ type: 'cancellation'; content: string }>;
  model: string;
}

/**
 * PlanExecutor creation options (partial - simplified for DI)
 */
export interface PlanExecutorOptions {
  llmClient: LLMClient;
  tokenCounter: TokenCounter;
  toolExecutor: ToolExecutor;
  getTools: () => LLMTool[];
  executeTool: (toolCall: unknown) => Promise<unknown>;
  parseToolArgumentsCached: (toolCall: unknown) => Record<string, unknown>;
  buildChatOptions: (options: unknown) => unknown;
  applyContextPruning: () => boolean;
  emitter: unknown;
  maxToolRounds: number;
  setPlanningEnabled: (enabled: boolean) => void;
}

/**
 * Wrapper for resolveMCPReferences that auto-injects MCPManager
 */
async function wrappedResolveMCPReferences(message: string): Promise<string> {
  const mcpManager = defaultGetMCPManager();
  if (!mcpManager) {
    return message; // Return unchanged if no MCP manager
  }
  return defaultResolveMCPReferences(message, mcpManager);
}

/**
 * Default dependencies using real implementations
 */
export const defaultLLMAgentDependencies: LLMAgentDependencies = {
  // Settings and configuration
  getSettingsManager: defaultGetSettingsManager,

  // Token counting
  getTokenCounter: defaultGetTokenCounter,

  // Custom instructions and prompt building
  loadCustomInstructions: defaultLoadCustomInstructions,
  buildSystemPrompt: defaultBuildSystemPrompt,

  // Checkpoint management
  getCheckpointManager: defaultGetCheckpointManager,

  // Task planning
  getTaskPlanner: defaultGetTaskPlanner,

  // Status reporting
  getStatusReporter: defaultGetStatusReporter,

  // Loop detection
  getLoopDetector: defaultGetLoopDetector,
  resetLoopDetector: defaultResetLoopDetector,

  // Provider configuration
  getActiveProvider: defaultGetActiveProvider,

  // MCP configuration and tools
  loadMCPConfig: defaultLoadMCPConfig,
  getAllTools: defaultGetAllTools,
  getMCPManager: defaultGetMCPManager,
  initializeMCPServers: defaultInitializeMCPServers,
  resolveMCPReferences: wrappedResolveMCPReferences,
  extractMCPReferences: defaultExtractMCPReferences,
};

// Module-level dependencies that can be overridden for testing
let deps: LLMAgentDependencies = defaultLLMAgentDependencies;

/**
 * Set LLMAgent dependencies (for testing)
 *
 * @param newDeps - Partial dependencies to override
 *
 * @example
 * ```ts
 * // In test setup
 * setLLMAgentDependencies({
 *   getSettingsManager: () => mockSettingsManager,
 *   getTokenCounter: () => mockTokenCounter,
 * });
 *
 * // After tests
 * resetLLMAgentDependencies();
 * ```
 */
export function setLLMAgentDependencies(newDeps: Partial<LLMAgentDependencies>): void {
  deps = { ...defaultLLMAgentDependencies, ...newDeps };
}

/**
 * Reset LLMAgent dependencies to defaults
 *
 * Should be called in test teardown to avoid test pollution.
 */
export function resetLLMAgentDependencies(): void {
  deps = defaultLLMAgentDependencies;
}

/**
 * Get current LLMAgent dependencies
 *
 * @returns Current dependency configuration
 */
export function getLLMAgentDependencies(): LLMAgentDependencies {
  return deps;
}
