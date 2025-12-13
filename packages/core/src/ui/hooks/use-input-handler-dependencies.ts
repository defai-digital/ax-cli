/**
 * Dependency Injection for useInputHandler
 *
 * This module provides a way to inject dependencies into useInputHandler
 * for testing purposes. By using dependency injection instead of direct imports,
 * tests can easily mock external services without complex vi.mock setups.
 *
 * @packageDocumentation
 */

import * as fs from "fs";
import * as path from "path";
// Note: LLMAgent type imported for documentation purposes
import { ConfirmationService } from "../../utils/confirmation-service.js";
import { getSettingsManager } from "../../utils/settings-manager.js";
import { getActiveProvider, getActiveConfigPaths } from "../../provider/config.js";
import { getUsageTracker } from "../../utils/usage-tracker.js";
import { getHistoryManager } from "../../utils/history-manager.js";
import { getContextStore, ContextGenerator, getStatsCollector } from "../../memory/index.js";
import { getCustomCommandsManager } from "../../commands/custom-commands.js";
import { getHooksManager } from "../../hooks/index.js";
import { getMCPPrompts, getMCPManager, getMCPResources } from "../../llm/tools.js";
import { getPermissionManager } from "../../permissions/permission-manager.js";
import { ProjectAnalyzer } from "../../utils/project-analyzer.js";
import { BashOutputTool } from "../../tools/bash-output.js";
import { clearToolGroupCache } from "../utils/tool-grouper.js";
import { getKeyboardShortcutGuideText } from "../components/keyboard-hints.js";
import { extractErrorMessage } from "../../utils/error-handler.js";
import { openExternalEditor, getPreferredEditor, getEditorDisplayName } from "../../utils/external-editor.js";
import { parseFileMentions } from "../../utils/file-mentions.js";
import { parseImageInput, buildMessageContent } from "../utils/image-handler.js";
import { routeToAgent } from "../../agent/agent-router.js";
import { executeAgent } from "../../agent/agent-executor.js";

/**
 * File system operations interface
 */
export interface FileSystemOps {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  writeFileSync: typeof fs.writeFileSync;
  readFileSync: typeof fs.readFileSync;
}

/**
 * Path utilities interface
 */
export interface PathOps {
  join: typeof path.join;
}

/**
 * External editor operations interface
 */
export interface ExternalEditorOps {
  openExternalEditor: typeof openExternalEditor;
  getPreferredEditor: typeof getPreferredEditor;
  getEditorDisplayName: typeof getEditorDisplayName;
}

/**
 * Agent routing operations interface
 */
export interface AgentRoutingOps {
  routeToAgent: typeof routeToAgent;
  executeAgent: typeof executeAgent;
}

/**
 * Message processing operations interface
 */
export interface MessageProcessingOps {
  parseFileMentions: typeof parseFileMentions;
  parseImageInput: typeof parseImageInput;
  buildMessageContent: typeof buildMessageContent;
}

/**
 * MCP operations interface
 */
export interface MCPOps {
  getMCPPrompts: typeof getMCPPrompts;
  getMCPManager: typeof getMCPManager;
  getMCPResources: typeof getMCPResources;
}

/**
 * Provider operations interface
 */
export interface ProviderOps {
  getActiveProvider: typeof getActiveProvider;
  getActiveConfigPaths: typeof getActiveConfigPaths;
}

/**
 * Manager factory functions interface
 */
export interface ManagerFactories {
  getSettingsManager: typeof getSettingsManager;
  getUsageTracker: typeof getUsageTracker;
  getHistoryManager: typeof getHistoryManager;
  getContextStore: typeof getContextStore;
  getStatsCollector: typeof getStatsCollector;
  getCustomCommandsManager: typeof getCustomCommandsManager;
  getHooksManager: typeof getHooksManager;
  getPermissionManager: typeof getPermissionManager;
}

/**
 * Tool factories interface
 */
export interface ToolFactories {
  createBashOutputTool: () => BashOutputTool;
  createProjectAnalyzer: (projectRoot: string) => ProjectAnalyzer;
  createContextGenerator: () => ContextGenerator;
}

/**
 * Utility functions interface
 */
export interface UtilityOps {
  clearToolGroupCache: typeof clearToolGroupCache;
  getKeyboardShortcutGuideText: typeof getKeyboardShortcutGuideText;
  extractErrorMessage: typeof extractErrorMessage;
  getConfirmationServiceInstance: () => ConfirmationService;
}

/**
 * Dynamic import function for modules that need lazy loading
 */
export interface DynamicImports {
  importLLMOptimizedInstructionGenerator: () => Promise<typeof import("../../utils/llm-optimized-instruction-generator.js")>;
  importChildProcess: () => Promise<typeof import("child_process")>;
  importUtil: () => Promise<typeof import("util")>;
  importThemes: () => Promise<typeof import("../themes/index.js")>;
  importColors: () => Promise<typeof import("../utils/colors.js")>;
  importClientV2: () => Promise<typeof import("../../mcp/client-v2.js")>;
}

/**
 * Complete dependencies interface for useInputHandler
 */
export interface UseInputHandlerDependencies {
  fs: FileSystemOps;
  path: PathOps;
  externalEditor: ExternalEditorOps;
  agentRouting: AgentRoutingOps;
  messageProcessing: MessageProcessingOps;
  mcp: MCPOps;
  provider: ProviderOps;
  managers: ManagerFactories;
  tools: ToolFactories;
  utils: UtilityOps;
  dynamicImports: DynamicImports;
  /** Process reference for exit handling */
  processExit: (code?: number) => never;
  /** Get current working directory */
  getCwd: () => string;
}

/**
 * Default dependencies using actual implementations
 */
const defaultDependencies: UseInputHandlerDependencies = {
  fs: {
    existsSync: fs.existsSync,
    mkdirSync: fs.mkdirSync,
    writeFileSync: fs.writeFileSync,
    readFileSync: fs.readFileSync,
  },
  path: {
    join: path.join,
  },
  externalEditor: {
    openExternalEditor,
    getPreferredEditor,
    getEditorDisplayName,
  },
  agentRouting: {
    routeToAgent,
    executeAgent,
  },
  messageProcessing: {
    parseFileMentions,
    parseImageInput,
    buildMessageContent,
  },
  mcp: {
    getMCPPrompts,
    getMCPManager,
    getMCPResources,
  },
  provider: {
    getActiveProvider,
    getActiveConfigPaths,
  },
  managers: {
    getSettingsManager,
    getUsageTracker,
    getHistoryManager,
    getContextStore,
    getStatsCollector,
    getCustomCommandsManager,
    getHooksManager,
    getPermissionManager,
  },
  tools: {
    createBashOutputTool: () => new BashOutputTool(),
    createProjectAnalyzer: (projectRoot: string) => new ProjectAnalyzer(projectRoot),
    createContextGenerator: () => new ContextGenerator(),
  },
  utils: {
    clearToolGroupCache,
    getKeyboardShortcutGuideText,
    extractErrorMessage,
    getConfirmationServiceInstance: () => ConfirmationService.getInstance(),
  },
  dynamicImports: {
    importLLMOptimizedInstructionGenerator: () => import("../../utils/llm-optimized-instruction-generator.js"),
    importChildProcess: () => import("child_process"),
    importUtil: () => import("util"),
    importThemes: () => import("../themes/index.js"),
    importColors: () => import("../utils/colors.js"),
    importClientV2: () => import("../../mcp/client-v2.js"),
  },
  processExit: (code?: number) => process.exit(code),
  getCwd: () => process.cwd(),
};

/**
 * Current dependencies (mutable for testing)
 */
let currentDependencies: UseInputHandlerDependencies = defaultDependencies;

/**
 * Get current dependencies
 */
export function getInputHandlerDependencies(): UseInputHandlerDependencies {
  return currentDependencies;
}

/**
 * Set custom dependencies (for testing)
 */
export function setInputHandlerDependencies(
  deps: Partial<UseInputHandlerDependencies>
): void {
  currentDependencies = {
    ...defaultDependencies,
    ...deps,
    // Deep merge nested objects
    fs: { ...defaultDependencies.fs, ...deps.fs },
    path: { ...defaultDependencies.path, ...deps.path },
    externalEditor: { ...defaultDependencies.externalEditor, ...deps.externalEditor },
    agentRouting: { ...defaultDependencies.agentRouting, ...deps.agentRouting },
    messageProcessing: { ...defaultDependencies.messageProcessing, ...deps.messageProcessing },
    mcp: { ...defaultDependencies.mcp, ...deps.mcp },
    provider: { ...defaultDependencies.provider, ...deps.provider },
    managers: { ...defaultDependencies.managers, ...deps.managers },
    tools: { ...defaultDependencies.tools, ...deps.tools },
    utils: { ...defaultDependencies.utils, ...deps.utils },
    dynamicImports: { ...defaultDependencies.dynamicImports, ...deps.dynamicImports },
  };
}

/**
 * Reset to default dependencies (call in afterEach in tests)
 */
export function resetInputHandlerDependencies(): void {
  currentDependencies = defaultDependencies;
}

/**
 * Create mock dependencies for testing
 */
export function createMockDependencies(
  overrides: Partial<UseInputHandlerDependencies> = {}
): UseInputHandlerDependencies {
  const mockFs: FileSystemOps = {
    existsSync: () => false,
    mkdirSync: () => undefined,
    writeFileSync: () => undefined,
    readFileSync: (() => Buffer.alloc(0)) as unknown as typeof fs.readFileSync,
  };

  const mockPath: PathOps = {
    join: (...paths) => paths.join("/"),
  };

  const mockProvider = {
    name: "test-provider",
    displayName: "Test Provider",
    defaultModel: "test-model",
    branding: { cliName: "test-cli" },
  };

  const mockConfigPaths = {
    DIR_NAME: ".test-cli",
    USER_CONFIG: "~/.test-cli/config.json",
  };

  return {
    fs: { ...mockFs, ...overrides.fs },
    path: { ...mockPath, ...overrides.path },
    externalEditor: {
      openExternalEditor: async () => ({ success: false, cancelled: true }),
      getPreferredEditor: () => "vim",
      getEditorDisplayName: () => "Vim",
      ...overrides.externalEditor,
    },
    agentRouting: {
      routeToAgent: () => ({
        agent: null,
        confidence: 0,
        reasoning: "",
        systemPrefix: "",
        transparencyNote: "",
        matchedKeywords: [],
      }),
      executeAgent: async function* () { yield { type: "done" as const }; },
      ...overrides.agentRouting,
    },
    messageProcessing: {
      parseFileMentions: async (input: string) => ({
        hasMentions: false,
        expandedInput: input,
        originalInput: input,
        mentions: [],
        errors: [],
      }),
      parseImageInput: async (input: string) => ({
        hasImages: false,
        images: [],
        cleanedInput: input,
        text: input,
        errors: [],
      }),
      buildMessageContent: () => [],
      ...overrides.messageProcessing,
    },
    mcp: {
      getMCPPrompts: () => [],
      getMCPManager: () => ({ getV2Instance: () => null } as unknown as ReturnType<typeof getMCPManager>),
      getMCPResources: async () => [],
      ...overrides.mcp,
    },
    provider: {
      getActiveProvider: () => mockProvider as ReturnType<typeof getActiveProvider>,
      getActiveConfigPaths: () => mockConfigPaths as ReturnType<typeof getActiveConfigPaths>,
      ...overrides.provider,
    },
    managers: {
      getSettingsManager: () => ({
        getCurrentModel: () => "test-model",
        getAvailableModels: () => ["test-model"],
        getUIConfig: () => ({ theme: "default" }),
        updateUIConfig: () => {},
        getAgentFirstSettings: () => ({ enabled: false }),
      } as unknown as ReturnType<typeof getSettingsManager>),
      getUsageTracker: () => ({
        getSessionStats: () => ({
          totalRequests: 0,
          totalPromptTokens: 0,
          totalCompletionTokens: 0,
          totalTokens: 0,
          totalReasoningTokens: 0,
          byModel: new Map(),
        }),
      } as unknown as ReturnType<typeof getUsageTracker>),
      getHistoryManager: () => ({
        clearHistory: () => {},
      } as unknown as ReturnType<typeof getHistoryManager>),
      getContextStore: () => ({
        getMetadata: () => ({ exists: false }),
        load: () => ({ success: false }),
        save: () => ({ success: true }),
      } as unknown as ReturnType<typeof getContextStore>),
      getStatsCollector: () => ({
        getFormattedStats: () => null,
      } as unknown as ReturnType<typeof getStatsCollector>),
      getCustomCommandsManager: () => ({
        getAllCommands: () => [],
        hasCommand: () => false,
        expandCommand: () => null,
      } as unknown as ReturnType<typeof getCustomCommandsManager>),
      getHooksManager: () => ({
        processUserInput: async (input: string) => input,
      } as unknown as ReturnType<typeof getHooksManager>),
      getPermissionManager: () => ({
        getConfig: () => ({
          permissions: {
            default_tier: "confirm",
            tools: {},
            session_approvals: { allow_all_bash: false, trust_current_directory: false },
          },
        }),
        updateConfig: async () => {},
        clearSessionApprovals: () => {},
      } as unknown as ReturnType<typeof getPermissionManager>),
      ...overrides.managers,
    },
    tools: {
      createBashOutputTool: () => ({
        listTasks: () => ({ output: "" }),
        execute: async () => ({ success: true, output: "" }),
        killTask: () => ({ success: true }),
      } as unknown as BashOutputTool),
      createProjectAnalyzer: () => ({
        analyze: async () => ({ success: false }),
      } as unknown as ProjectAnalyzer),
      createContextGenerator: () => ({
        generate: async () => ({ success: false }),
      } as unknown as ContextGenerator),
      ...overrides.tools,
    },
    utils: {
      clearToolGroupCache: () => {},
      getKeyboardShortcutGuideText: () => "Keyboard shortcuts",
      extractErrorMessage: (e: unknown) => e instanceof Error ? e.message : String(e),
      getConfirmationServiceInstance: () => ({
        getSessionFlags: () => ({}),
        setSessionFlag: () => {},
        resetSession: () => {},
      } as unknown as ConfirmationService),
      ...overrides.utils,
    },
    dynamicImports: {
      importLLMOptimizedInstructionGenerator: async () => ({
        LLMOptimizedInstructionGenerator: class {
          generateInstructions() { return ""; }
          generateIndex() { return ""; }
          generateSummary() { return ""; }
        },
      } as unknown as typeof import("../../utils/llm-optimized-instruction-generator.js")),
      importChildProcess: async () => ({
        exec: () => {},
      } as unknown as typeof import("child_process")),
      importUtil: async () => ({
        promisify: () => async () => ({ stdout: "", stderr: "" }),
      } as unknown as typeof import("util")),
      importThemes: async () => ({
        getAllThemes: () => [],
        isValidTheme: () => false,
      } as unknown as typeof import("../themes/index.js")),
      importColors: async () => ({
        clearThemeCache: () => {},
      } as unknown as typeof import("../utils/colors.js")),
      importClientV2: async () => ({
        createServerName: () => null,
      } as unknown as typeof import("../../mcp/client-v2.js")),
      ...overrides.dynamicImports,
    },
    processExit: (() => { throw new Error("process.exit called"); }) as never,
    getCwd: () => "/test/dir",
    ...overrides,
  };
}
