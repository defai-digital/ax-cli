/**
 * Slash Command Handlers
 *
 * Pure functions for handling slash commands. These are extracted from
 * use-input-handler.ts to enable independent testing.
 *
 * @packageDocumentation
 */

import type { ChatEntry } from "../../agent/llm-agent.js";

/**
 * Command execution result
 */
export interface CommandResult {
  /** Whether the command was handled */
  handled: boolean;
  /** Chat entries to add to history */
  entries?: ChatEntry[];
  /** Whether to clear input after execution */
  clearInput?: boolean;
  /** Whether to set processing state */
  setProcessing?: boolean;
  /** Async action to execute (for commands that need async operations) */
  asyncAction?: () => Promise<void>;
  /** Error message if command failed */
  error?: string;
}

/**
 * Model info for display
 */
export interface ModelDisplayInfo {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  isCurrent: boolean;
}

/**
 * Dependencies for command handlers
 */
export interface CommandHandlerDeps {
  /** Get settings manager */
  getSettingsManager: () => {
    getCurrentModel: () => string | null;
    getAvailableModels: () => string[];
    getUIConfig: () => { theme?: string } | null;
    updateUIConfig: (config: { theme: string }) => void;
    /** Set current model (runtime only, not persisted) */
    setCurrentModel?: (model: string) => void;
    /** Save model to user settings (persisted) */
    saveModelToConfig?: (model: string) => void;
  };
  /** Get active provider */
  getActiveProvider: () => {
    name: string;
    displayName: string;
    defaultModel: string;
    defaultVisionModel?: string;
    branding: { cliName: string };
    models: Record<string, { name: string; description: string; contextWindow: number }>;
    aliases?: Record<string, string>;
  };
  /** Get active config paths */
  getActiveConfigPaths: () => { DIR_NAME: string };
  /** Get usage tracker */
  getUsageTracker: () => { getSessionStats: () => SessionStats };
  /** Get history manager */
  getHistoryManager: () => { clearHistory: () => void };
  /** Get context store */
  getContextStore: () => ContextStore;
  /** Get stats collector */
  getStatsCollector: () => StatsCollector;
  /** Clear tool group cache */
  clearToolGroupCache: () => void;
  /** Get keyboard shortcut guide text */
  getKeyboardShortcutGuideText: () => string;
  /** Get custom commands manager */
  getCustomCommandsManager: () => CustomCommandsManager;
}

/**
 * Session statistics interface
 */
export interface SessionStats {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalReasoningTokens: number;
  byModel: Map<string, { totalTokens: number; requests: number }>;
}

/**
 * Context store interface
 */
export interface ContextStore {
  getMetadata: () => { exists: boolean; tokenEstimate?: number; updatedAt?: string; usageCount?: number };
  load: () => { success: boolean; data: { context: { sections: Record<string, number>; token_estimate: number }; content_hash: string } };
  save: (memory: unknown) => { success: boolean; error?: string };
}

/**
 * Stats collector interface
 */
export interface StatsCollector {
  getFormattedStats: () => { usageCount: number; tokensSaved: number; cacheRate: number; estimatedSavings: number } | null;
}

/**
 * Custom commands manager interface
 */
export interface CustomCommandsManager {
  getAllCommands: () => Array<{ name: string; description: string; scope: string }>;
  hasCommand: (name: string) => boolean;
  expandCommand: (name: string, args: string) => string | null;
}

/**
 * Check if input is a slash command
 */
export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith("/");
}

/**
 * Parse slash command and arguments
 */
export function parseSlashCommand(input: string): { command: string; args: string } {
  const trimmed = input.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) {
    return { command: trimmed, args: "" };
  }
  return {
    command: trimmed.substring(0, spaceIndex),
    args: trimmed.substring(spaceIndex + 1).trim(),
  };
}

/**
 * Handle /help command
 */
export function handleHelpCommand(configDirName: string): CommandResult {
  const helpContent = `AX CLI Help:

Built-in Commands:
  /continue   - Continue incomplete response from where it left off
  /clear      - Clear chat history
  /init       - Initialize project with smart analysis
  /help       - Show this help
  /shortcuts  - Show keyboard shortcuts guide
  /usage      - Show API usage statistics
  /doctor     - Run health check diagnostics
  /mcp        - Open MCP server dashboard
  /exit       - Exit application
  exit, quit  - Exit application

Background Task Commands:
  /tasks             - List all background tasks
  /task <id>         - View output of a background task
  /kill <id>         - Kill a running background task

  Tip: Append ' &' to any bash command to run it in background
       Example: npm run dev &

Checkpoint Commands:
  /rewind            - Rewind to a previous checkpoint (interactive)
  /checkpoints       - Show checkpoint statistics
  /checkpoint-clean  - Clean old checkpoints (compress and prune)

Plan Commands (Multi-Phase Task Planning):
  /plans             - List all task plans
  /plan [id]         - Show current or specific plan details
  /phases            - Show phases of current plan
  /pause             - Pause current plan execution
  /resume [id]       - Resume current or specific plan
  /skip              - Skip current phase
  /abandon           - Abandon current plan

Git Commands:
  /commit-and-push - AI-generated commit + push to remote

Memory Commands (z.ai GLM-4.6 caching):
  /memory          - Show project memory status
  /memory warmup   - Generate project memory context
  /memory refresh  - Update memory after changes

UI Commands:
  /theme           - Show current theme and list available themes
  /theme <name>    - Switch color theme (default, dark, light, dracula, monokai)

Model Commands:
  /model           - Show current model and list available models
  /model <name>    - Switch to a model (session only)
  /model save      - Save current model to config (persistent)
  /model reset     - Reset to provider default model

Configuration:
  Edit ~/${configDirName}/config.json to configure settings

For complex operations, just describe what you want in natural language.`;

  return {
    handled: true,
    entries: [{
      type: "assistant",
      content: helpContent,
      timestamp: new Date(),
    }],
    clearInput: true,
  };
}

/**
 * Handle /shortcuts command
 */
export function handleShortcutsCommand(getKeyboardShortcutGuideText: () => string): CommandResult {
  return {
    handled: true,
    entries: [{
      type: "assistant",
      content: getKeyboardShortcutGuideText(),
      timestamp: new Date(),
    }],
    clearInput: true,
  };
}

/**
 * Handle /exit command
 */
export function handleExitCommand(): CommandResult {
  return {
    handled: true,
    clearInput: true,
    asyncAction: async () => {
      process.exit(0);
    },
  };
}

/**
 * Handle /clear command
 */
export function handleClearCommand(): CommandResult {
  return {
    handled: true,
    entries: [], // Empty entries to clear history
    clearInput: true,
  };
}

/**
 * Handle /tasks command
 */
export function handleTasksCommand(listTasks: () => { output: string }): CommandResult {
  const result = listTasks();
  return {
    handled: true,
    entries: [{
      type: "assistant",
      content: result.output || "No background tasks",
      timestamp: new Date(),
    }],
    clearInput: true,
  };
}

/**
 * Handle /task <id> command
 */
export function handleTaskCommand(
  taskId: string,
  getTaskOutput: (id: string) => Promise<{ success: boolean; output?: string; error?: string }>
): CommandResult {
  if (!taskId) {
    return {
      handled: true,
      entries: [{
        type: "assistant",
        content: "Usage: /task <task_id>",
        timestamp: new Date(),
      }],
      clearInput: true,
    };
  }

  return {
    handled: true,
    clearInput: true,
    asyncAction: async () => {
      // Note: The actual result handling happens in the caller
      await getTaskOutput(taskId);
    },
  };
}

/**
 * Handle /kill <id> command
 */
export function handleKillCommand(
  taskId: string,
  killTask: (id: string) => { success: boolean; output?: string; error?: string }
): CommandResult {
  if (!taskId) {
    return {
      handled: true,
      entries: [{
        type: "assistant",
        content: "Usage: /kill <task_id>",
        timestamp: new Date(),
      }],
      clearInput: true,
    };
  }

  const result = killTask(taskId);
  return {
    handled: true,
    entries: [{
      type: "assistant",
      content: result.success ? result.output || "Task killed" : result.error || "Failed to kill task",
      timestamp: new Date(),
    }],
    clearInput: true,
  };
}

/**
 * Handle /usage command
 */
export function handleUsageCommand(
  stats: SessionStats,
  currentModel: string,
  providerName: string,
  isGrok: boolean
): CommandResult {
  let usageContent = `📊 **API Usage & Limits (${providerName})**\n\n`;

  // Session statistics
  usageContent += "**📱 Current Session:**\n";
  usageContent += `  • Model: ${currentModel}\n`;

  if (stats.totalRequests === 0) {
    usageContent += "  No API requests made yet. Ask me something to start tracking!\n";
  } else {
    usageContent += `  • Requests: ${stats.totalRequests.toLocaleString()}\n`;
    usageContent += `  • Prompt Tokens: ${stats.totalPromptTokens.toLocaleString()}\n`;
    usageContent += `  • Completion Tokens: ${stats.totalCompletionTokens.toLocaleString()}\n`;
    usageContent += `  • Total Tokens: ${stats.totalTokens.toLocaleString()}\n`;

    if (stats.totalReasoningTokens > 0) {
      usageContent += `  • Reasoning Tokens: ${stats.totalReasoningTokens.toLocaleString()}\n`;
    }

    if (stats.byModel.size > 0) {
      usageContent += `\n  **Models Used:**\n`;
      for (const [model, modelStats] of stats.byModel.entries()) {
        usageContent += `    - ${model}: ${modelStats.totalTokens.toLocaleString()} tokens (${modelStats.requests} requests)\n`;
      }
    }
  }

  // Provider-specific information
  if (isGrok) {
    usageContent += formatGrokUsageInfo(stats, currentModel);
  } else {
    usageContent += formatGLMUsageInfo(stats);
  }

  return {
    handled: true,
    entries: [{
      type: "assistant",
      content: usageContent,
      timestamp: new Date(),
    }],
    clearInput: true,
  };
}

/**
 * Format Grok-specific usage information
 */
export function formatGrokUsageInfo(stats: SessionStats, currentModel: string): string {
  let content = `\n**🔑 xAI Account Usage & Limits:**\n`;
  content += `  ⚠️  API does not provide programmatic access to usage data\n`;
  content += `\n  **Check your account:**\n`;
  content += `  • Usage Explorer: https://console.x.ai\n`;
  content += `  • Billing & Team: https://console.x.ai/team\n`;
  content += `  • API Keys: https://console.x.ai/api-keys\n`;
  content += `\n**ℹ️  Notes:**\n`;
  content += `  • Usage is tracked in real-time on the xAI console\n`;
  content += `  • Cached input tokens: 75% discount\n`;

  const modelLower = currentModel.toLowerCase();
  if (modelLower.includes('grok-4.1-fast')) {
    content += `\n**💰 Grok 4.1 Fast Pricing:**\n`;
    content += `  • Input: $0.20 per 1M tokens\n`;
    content += `  • Output: $0.50 per 1M tokens\n`;
  } else {
    content += `\n**💰 Grok 4 Pricing:**\n`;
    content += `  • Input: $3.00 per 1M tokens\n`;
    content += `  • Output: $15.00 per 1M tokens\n`;
    content += `  • Cached: $0.75 per 1M tokens\n`;
  }

  if (stats.totalRequests > 0) {
    const inputRate = modelLower.includes('grok-4.1-fast') ? 0.20 : 3.0;
    const outputRate = modelLower.includes('grok-4.1-fast') ? 0.50 : 15.0;
    const inputCost = (stats.totalPromptTokens / 1000000) * inputRate;
    const outputCost = (stats.totalCompletionTokens / 1000000) * outputRate;
    const totalCost = inputCost + outputCost;
    content += `\n**💵 Estimated Session Cost:**\n`;
    content += `  • Input: $${inputCost.toFixed(6)} (${stats.totalPromptTokens.toLocaleString()} tokens)\n`;
    content += `  • Output: $${outputCost.toFixed(6)} (${stats.totalCompletionTokens.toLocaleString()} tokens)\n`;
    content += `  • **Total: ~$${totalCost.toFixed(6)}**\n`;
  }

  return content;
}

/**
 * Format GLM-specific usage information
 */
export function formatGLMUsageInfo(stats: SessionStats): string {
  let content = `\n**🔑 Z.AI Account Usage & Limits:**\n`;
  content += `  ⚠️  API does not provide programmatic access to usage data\n`;
  content += `\n  **Check your account:**\n`;
  content += `  • Billing & Usage: https://z.ai/manage-apikey/billing\n`;
  content += `  • Rate Limits: https://z.ai/manage-apikey/rate-limits\n`;
  content += `  • API Keys: https://z.ai/manage-apikey/apikey-list\n`;
  content += `\n**ℹ️  Notes:**\n`;
  content += `  • Billing reflects previous day (n-1) consumption\n`;
  content += `  • Current day usage may not be immediately visible\n`;
  content += `  • Cached content: 1/5 of original price\n`;
  content += `\n**💰 GLM Pricing:**\n`;
  content += `  • Input: $2.00 per 1M tokens\n`;
  content += `  • Output: $10.00 per 1M tokens\n`;
  content += `  • Cached: $0.50 per 1M tokens\n`;

  if (stats.totalRequests > 0) {
    const inputCost = (stats.totalPromptTokens / 1000000) * 2.0;
    const outputCost = (stats.totalCompletionTokens / 1000000) * 10.0;
    const totalCost = inputCost + outputCost;
    content += `\n**💵 Estimated Session Cost:**\n`;
    content += `  • Input: $${inputCost.toFixed(6)} (${stats.totalPromptTokens.toLocaleString()} tokens)\n`;
    content += `  • Output: $${outputCost.toFixed(6)} (${stats.totalCompletionTokens.toLocaleString()} tokens)\n`;
    content += `  • **Total: ~$${totalCost.toFixed(6)}**\n`;
  }

  return content;
}

/**
 * Handle /memory command
 */
export function handleMemoryStatusCommand(
  metadata: { exists: boolean; tokenEstimate?: number; updatedAt?: string; usageCount?: number },
  loadResult: { success: boolean; data: { context: { sections: Record<string, number> } } } | null,
  formattedStats: { usageCount: number; tokensSaved: number; cacheRate: number; estimatedSavings: number } | null
): CommandResult {
  let memoryContent = "🧠 **Project Memory Status**\n\n";

  if (!metadata.exists) {
    memoryContent += "❌ No project memory found.\n\n";
    memoryContent += "Run `/memory warmup` to generate project memory for z.ai caching.\n";
  } else {
    memoryContent += `✅ Memory initialized\n\n`;
    memoryContent += `**Token Estimate:** ${metadata.tokenEstimate?.toLocaleString() || 'N/A'} tokens\n`;
    memoryContent += `**Last Updated:** ${metadata.updatedAt ? new Date(metadata.updatedAt).toLocaleString() : 'N/A'}\n`;
    memoryContent += `**Usage Count:** ${metadata.usageCount || 0}\n`;

    if (loadResult?.success) {
      const sections = loadResult.data.context.sections;
      memoryContent += `\n**📊 Token Distribution:**\n`;
      const total = Object.values(sections).reduce((a, b) => a + b, 0);
      for (const [name, tokens] of Object.entries(sections)) {
        const pct = total > 0 ? Math.round((tokens / total) * 100) : 0;
        const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
        memoryContent += `   ${bar}  ${name.charAt(0).toUpperCase() + name.slice(1)}  (${pct}%)\n`;
      }
    }

    if (formattedStats && formattedStats.usageCount > 0) {
      memoryContent += `\n**💾 Cache Statistics:**\n`;
      memoryContent += `   • Usage Count: ${formattedStats.usageCount}\n`;
      memoryContent += `   • Tokens Saved: ${formattedStats.tokensSaved.toLocaleString()}\n`;
      memoryContent += `   • Cache Rate: ${formattedStats.cacheRate}%\n`;
      memoryContent += `   • Est. Savings: $${formattedStats.estimatedSavings.toFixed(4)}\n`;
    }
  }

  return {
    handled: true,
    entries: [{
      type: "assistant",
      content: memoryContent,
      timestamp: new Date(),
    }],
    clearInput: true,
  };
}

/**
 * Handle /commands command - list custom commands
 */
export function handleCommandsListCommand(
  customCommands: Array<{ name: string; description: string; scope: string }>,
  configDirName: string
): CommandResult {
  let content = "**Custom Commands:**\n\n";

  if (customCommands.length === 0) {
    content += "No custom commands found.\n\n";
    content += "Create commands by adding markdown files to:\n";
    content += `  • \`${configDirName}/commands/\` (project-level)\n`;
    content += `  • \`~/${configDirName}/commands/\` (user-level)\n`;
  } else {
    const projectCmds = customCommands.filter(c => c.scope === "project");
    const userCmds = customCommands.filter(c => c.scope === "user");

    if (projectCmds.length > 0) {
      content += "**Project Commands:**\n";
      for (const cmd of projectCmds) {
        content += `  /${cmd.name} - ${cmd.description}\n`;
      }
      content += "\n";
    }

    if (userCmds.length > 0) {
      content += "**User Commands:**\n";
      for (const cmd of userCmds) {
        content += `  /${cmd.name} - ${cmd.description}\n`;
      }
    }
  }

  return {
    handled: true,
    entries: [{
      type: "assistant",
      content,
      timestamp: new Date(),
    }],
    clearInput: true,
  };
}

/**
 * List of direct bash commands that are executed immediately
 */
export const DIRECT_BASH_COMMANDS = [
  "ls", "pwd", "cd", "cat", "mkdir", "touch",
  "echo", "grep", "find", "cp", "mv", "rm",
];

/**
 * Check if input is a direct bash command
 */
export function isDirectBashCommand(input: string): boolean {
  const trimmed = input.trim();
  const firstWord = trimmed.split(" ")[0] || "";
  return DIRECT_BASH_COMMANDS.includes(firstWord);
}

/**
 * Calculate estimated cost for tokens
 */
export function calculateEstimatedCost(
  promptTokens: number,
  completionTokens: number,
  inputRate: number,
  outputRate: number
): { inputCost: number; outputCost: number; totalCost: number } {
  const inputCost = (promptTokens / 1000000) * inputRate;
  const outputCost = (completionTokens / 1000000) * outputRate;
  const totalCost = inputCost + outputCost;
  return { inputCost, outputCost, totalCost };
}

/**
 * Resolve model alias to actual model name
 */
export function resolveModelAlias(
  modelName: string,
  aliases?: Record<string, string>
): string {
  if (!aliases) return modelName;
  const lower = modelName.toLowerCase();
  return aliases[lower] || modelName;
}

/**
 * Handle /model command - view, switch, and save models
 *
 * Usage:
 *   /model              - Show current model and list available models
 *   /model <name>       - Switch to a model (session only)
 *   /model save         - Save current model to config (persistent)
 *   /model save <name>  - Switch and save model to config
 *   /model reset        - Reset to provider default model
 */
export function handleModelCommand(
  args: string,
  deps: {
    getCurrentModel: () => string | null;
    setCurrentModel?: (model: string) => void;
    saveModelToConfig?: (model: string) => void;
    getAvailableModels: () => string[];
  },
  provider: {
    name: string;
    displayName: string;
    defaultModel: string;
    defaultVisionModel?: string;
    models: Record<string, { name: string; description: string; contextWindow: number; supportsVision?: boolean }>;
    aliases?: Record<string, string>;
  },
  configDirName: string
): CommandResult {
  const currentModel = deps.getCurrentModel() || provider.defaultModel;
  const trimmedArgs = args.trim().toLowerCase();

  // /model or /model list - show current model and available models
  if (!trimmedArgs || trimmedArgs === 'list' || trimmedArgs === 'status') {
    return handleModelListCommand(currentModel, provider, configDirName);
  }

  // /model reset - reset to provider default
  if (trimmedArgs === 'reset' || trimmedArgs === 'default') {
    return handleModelResetCommand(provider, deps, configDirName);
  }

  // /model save [name] - save model to config
  if (trimmedArgs.startsWith('save')) {
    const modelToSave = trimmedArgs.replace('save', '').trim();
    return handleModelSaveCommand(
      modelToSave || currentModel,
      provider,
      deps,
      configDirName
    );
  }

  // /model <name> - switch model (session only)
  return handleModelSwitchCommand(trimmedArgs, currentModel, provider, deps);
}

/**
 * Handle /model list - show available models
 */
function handleModelListCommand(
  currentModel: string,
  provider: {
    displayName: string;
    defaultModel: string;
    defaultVisionModel?: string;
    models: Record<string, { name: string; description: string; contextWindow: number; supportsVision?: boolean }>;
    aliases?: Record<string, string>;
  },
  configDirName: string
): CommandResult {
  let content = `🤖 **Model Selection (${provider.displayName})**\n\n`;
  content += `**Current Model:** \`${currentModel}\`\n`;
  content += `**Provider Default:** \`${provider.defaultModel}\`\n`;
  if (provider.defaultVisionModel) {
    content += `**Vision Model:** \`${provider.defaultVisionModel}\`\n`;
  }
  content += '\n';

  // List available models
  content += '**Available Models:**\n';
  const modelEntries = Object.entries(provider.models);

  // Group by type (text vs vision)
  const textModels = modelEntries.filter(([_, m]) => !('supportsVision' in m && m.supportsVision));
  const visionModels = modelEntries.filter(([_, m]) => 'supportsVision' in m && m.supportsVision);

  for (const [id, model] of textModels) {
    const isCurrentMarker = id === currentModel ? ' ← current' : '';
    const isDefaultMarker = id === provider.defaultModel ? ' (default)' : '';
    const contextK = Math.round(model.contextWindow / 1000);
    content += `  • \`${id}\`${isDefaultMarker}${isCurrentMarker}\n`;
    content += `    ${model.description} (${contextK}K context)\n`;
  }

  if (visionModels.length > 0) {
    content += '\n**Vision Models:**\n';
    for (const [id, model] of visionModels) {
      const contextK = Math.round(model.contextWindow / 1000);
      content += `  • \`${id}\` - ${model.description} (${contextK}K)\n`;
    }
  }

  // List aliases
  if (provider.aliases && Object.keys(provider.aliases).length > 0) {
    content += '\n**Aliases:**\n';
    for (const [alias, target] of Object.entries(provider.aliases)) {
      content += `  • \`${alias}\` → \`${target}\`\n`;
    }
  }

  content += '\n**Commands:**\n';
  content += '  `/model <name>`       - Switch model (session only)\n';
  content += '  `/model save`         - Save current model to config\n';
  content += '  `/model save <name>`  - Switch and save to config\n';
  content += '  `/model reset`        - Reset to provider default\n';
  content += `\n💡 Config: ~/${configDirName}/config.json`;

  return {
    handled: true,
    entries: [{
      type: 'assistant',
      content,
      timestamp: new Date(),
    }],
    clearInput: true,
  };
}

/**
 * Handle /model <name> - switch model for current session
 */
function handleModelSwitchCommand(
  modelName: string,
  _currentModel: string,
  provider: {
    models: Record<string, { name: string; description: string }>;
    aliases?: Record<string, string>;
  },
  deps: {
    setCurrentModel?: (model: string) => void;
  }
): CommandResult {
  // Resolve alias
  const resolvedModel = resolveModelAlias(modelName, provider.aliases);

  // Check if model exists in provider config
  const modelConfig = provider.models[resolvedModel];
  const isKnownModel = !!modelConfig;

  // Allow switching even to unknown models (for custom/external models)
  if (deps.setCurrentModel) {
    deps.setCurrentModel(resolvedModel);
  }

  let content: string;
  if (isKnownModel) {
    content = `✅ **Switched to \`${resolvedModel}\`**\n\n`;
    content += `${modelConfig.description}\n\n`;
    content += '💡 This change is for the current session only.\n';
    content += 'Use `/model save` to persist across sessions.';
  } else {
    content = `⚠️ **Switched to \`${resolvedModel}\`** (custom model)\n\n`;
    content += 'This model is not in the provider config.\n';
    content += 'Make sure it exists on your API endpoint.\n\n';
    content += '💡 Use `/model save` to persist if it works.';
  }

  if (modelName !== resolvedModel) {
    content = content.replace(
      `**Switched to \`${resolvedModel}\`**`,
      `**Switched to \`${resolvedModel}\`** (via alias \`${modelName}\`)`
    );
  }

  return {
    handled: true,
    entries: [{
      type: 'assistant',
      content,
      timestamp: new Date(),
    }],
    clearInput: true,
  };
}

/**
 * Handle /model save - save current model to config
 */
function handleModelSaveCommand(
  modelName: string,
  provider: {
    models: Record<string, { name: string; description: string }>;
    aliases?: Record<string, string>;
  },
  deps: {
    setCurrentModel?: (model: string) => void;
    saveModelToConfig?: (model: string) => void;
  },
  configDirName: string
): CommandResult {
  const resolvedModel = resolveModelAlias(modelName, provider.aliases);

  if (!deps.saveModelToConfig) {
    return {
      handled: true,
      entries: [{
        type: 'assistant',
        content: '❌ Model saving is not supported in this context.',
        timestamp: new Date(),
      }],
      clearInput: true,
    };
  }

  // Save to config
  deps.saveModelToConfig(resolvedModel);

  // Also set as current model
  if (deps.setCurrentModel) {
    deps.setCurrentModel(resolvedModel);
  }

  const modelConfig = provider.models[resolvedModel];
  let content = `✅ **Saved \`${resolvedModel}\` to config**\n\n`;
  if (modelConfig) {
    content += `${modelConfig.description}\n\n`;
  }
  content += `📁 Config: ~/${configDirName}/config.json\n\n`;
  content += 'This model will be used in future sessions.';

  return {
    handled: true,
    entries: [{
      type: 'assistant',
      content,
      timestamp: new Date(),
    }],
    clearInput: true,
  };
}

/**
 * Handle /model reset - reset to provider default
 */
function handleModelResetCommand(
  provider: {
    defaultModel: string;
    models: Record<string, { name: string; description: string }>;
  },
  deps: {
    setCurrentModel?: (model: string) => void;
    saveModelToConfig?: (model: string) => void;
  },
  configDirName: string
): CommandResult {
  const defaultModel = provider.defaultModel;

  // Set current model to default
  if (deps.setCurrentModel) {
    deps.setCurrentModel(defaultModel);
  }

  // Save to config
  if (deps.saveModelToConfig) {
    deps.saveModelToConfig(defaultModel);
  }

  const modelConfig = provider.models[defaultModel];
  let content = `✅ **Reset to default: \`${defaultModel}\`**\n\n`;
  if (modelConfig) {
    content += `${modelConfig.description}\n\n`;
  }
  content += `📁 Saved to ~/${configDirName}/config.json`;

  return {
    handled: true,
    entries: [{
      type: 'assistant',
      content,
      timestamp: new Date(),
    }],
    clearInput: true,
  };
}
