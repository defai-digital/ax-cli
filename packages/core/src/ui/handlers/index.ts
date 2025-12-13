/**
 * UI Handlers
 *
 * Modular handlers for UI interactions, extracted for testability.
 *
 * @packageDocumentation
 */

// Slash command handlers (legacy)
export {
  isSlashCommand,
  parseSlashCommand,
  handleHelpCommand,
  handleShortcutsCommand,
  handleExitCommand,
  handleClearCommand,
  handleTasksCommand,
  handleTaskCommand,
  handleKillCommand,
  handleUsageCommand,
  handleMemoryStatusCommand,
  handleCommandsListCommand,
  formatGrokUsageInfo,
  formatGLMUsageInfo,
  isDirectBashCommand,
  calculateEstimatedCost,
  DIRECT_BASH_COMMANDS,
  type CommandResult,
  type CommandHandlerDeps,
  type SessionStats,
  type ContextStore,
  type StatsCollector,
  type CustomCommandsManager,
} from "./slash-commands.js";

// New modular command handlers
export {
  type CommandContext,
  type CommandContextWithCallbacks,
  type CommandHandler,
  addChatEntry,
  createAssistantMessage,
  createUserMessage,
} from "./types.js";

// Chat commands (/continue, /retry, /clear)
export {
  getLastUserMessage,
  getRetryMessage,
  addRetryUserEntry,
  addContinueUserEntry,
  getContinuePrompt,
} from "./chat-commands.js";

// Memory commands (/memory)
export {
  handleMemoryCommand,
} from "./memory-commands.js";

// Theme commands (/theme)
export {
  handleThemeCommand,
  AVAILABLE_THEMES,
  getAvailableThemeNames,
  isValidTheme,
} from "./theme-commands.js";

// Stream processor
export {
  processStreamChunk,
  processReasoningChunk,
  processContentChunk,
  processToolCallsChunk,
  processToolResultChunk,
  processDoneChunk,
  shouldIgnoreContentChunk,
  applyChatHistoryActions,
  formatStreamError,
  createErrorEntry,
  createInitialState,
  type StreamChunk,
  type StreamChunkType,
  type ChatHistoryAction,
  type StreamProcessorState,
  type StreamProcessResult,
} from "./stream-processor.js";
