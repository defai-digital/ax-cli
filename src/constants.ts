/**
 * Application-wide constants
 * Now loaded from YAML configuration files for better maintainability
 */

import { homedir } from 'os';
import { join } from 'path';
import { loadModelsConfig, loadSettingsConfig, loadMessagesConfig, formatMessage } from './utils/config-loader.js';

// Load configurations from YAML files
const modelsYaml = loadModelsConfig();
const settingsYaml = loadSettingsConfig();
const messagesYaml = loadMessagesConfig();

/** Configuration directory name */
export const CONFIG_DIR_NAME = '.ax-cli';

// File Names (without paths)
export const FILE_NAMES = {
  /** User configuration file name */
  USER_CONFIG: 'config.json',
  /** Project settings file name */
  PROJECT_SETTINGS: 'settings.json',
  /** Custom instructions file name */
  CUSTOM_MD: 'CUSTOM.md',
  /** Root project context file (like CLAUDE.md) */
  AX_MD: 'AX.md',
  /** Project index file name */
  INDEX_JSON: 'index.json',
  /** Shared project index at root (used by all CLIs) */
  AX_INDEX_JSON: 'ax.index.json',
  /** Project memory file name */
  MEMORY_JSON: 'memory.json',
  /** History file name */
  HISTORY_JSON: 'history.json',
  /** Sessions directory name */
  SESSIONS_DIR: 'sessions',
  /** Templates directory name */
  TEMPLATES_DIR: 'templates',
  /** Plans directory name */
  PLANS_DIR: 'plans',
  /** Backups directory name */
  BACKUPS_DIR: 'backups',
  /** Cache directory name */
  CACHE_DIR: 'cache',
} as const;

// Configuration Paths
export const CONFIG_PATHS = {
  /** Configuration directory name */
  DIR_NAME: CONFIG_DIR_NAME,
  /** User-level settings directory */
  USER_DIR: join(homedir(), CONFIG_DIR_NAME),
  /** User-level configuration file */
  USER_CONFIG: join(homedir(), CONFIG_DIR_NAME, FILE_NAMES.USER_CONFIG),
  /** Project-level settings directory */
  PROJECT_DIR: join(process.cwd(), CONFIG_DIR_NAME),
  /** Project-level settings file */
  PROJECT_SETTINGS: join(process.cwd(), CONFIG_DIR_NAME, FILE_NAMES.PROJECT_SETTINGS),
  /** Custom instructions file path (project-level) */
  CUSTOM_MD: join(process.cwd(), CONFIG_DIR_NAME, FILE_NAMES.CUSTOM_MD),
  /** Root project context file path (like CLAUDE.md) */
  AX_MD: join(process.cwd(), FILE_NAMES.AX_MD),
  /** Project index file path (project-level) */
  INDEX_JSON: join(process.cwd(), CONFIG_DIR_NAME, FILE_NAMES.INDEX_JSON),
  /** Project memory file path (project-level) */
  MEMORY_JSON: join(process.cwd(), CONFIG_DIR_NAME, FILE_NAMES.MEMORY_JSON),
  /** User templates directory */
  USER_TEMPLATES_DIR: join(homedir(), CONFIG_DIR_NAME, FILE_NAMES.TEMPLATES_DIR),
  /** User plans directory */
  USER_PLANS_DIR: join(homedir(), CONFIG_DIR_NAME, FILE_NAMES.PLANS_DIR),
  /** User history file */
  USER_HISTORY: join(homedir(), CONFIG_DIR_NAME, FILE_NAMES.HISTORY_JSON),
  /** User sessions directory */
  USER_SESSIONS_DIR: join(homedir(), CONFIG_DIR_NAME, FILE_NAMES.SESSIONS_DIR),
  /** AutomatosX temporary files directory */
  AUTOMATOSX_TMP: join(homedir(), 'automatosx', 'tmp'),
} as const;

// Agent Configuration
export const AGENT_CONFIG = {
  MAX_TOOL_ROUNDS: settingsYaml.agent.max_tool_rounds,
  DEFAULT_TIMEOUT: settingsYaml.agent.default_timeout,
  DEFAULT_MAX_TOKENS: settingsYaml.agent.default_max_tokens,
  MAX_RECENT_TOOL_CALLS: settingsYaml.agent.max_recent_tool_calls,
  /** Maximum number of messages to keep in chat history */
  MAX_MESSAGES: settingsYaml.agent.max_messages || 500,
  LOOP_DETECTION_THRESHOLD: settingsYaml.agent.loop_detection_threshold,
  ENABLE_LOOP_DETECTION: settingsYaml.agent.enable_loop_detection,
} as const;

// Subagent Configuration
export const SUBAGENT_CONFIG = {
  // Default tool rounds per role
  GENERAL_MAX_TOOL_ROUNDS: settingsYaml.subagent?.general_max_tool_rounds || 30,
  TESTING_MAX_TOOL_ROUNDS: settingsYaml.subagent?.testing_max_tool_rounds || 20,
  DOCUMENTATION_MAX_TOOL_ROUNDS: settingsYaml.subagent?.documentation_max_tool_rounds || 15,
  REFACTORING_MAX_TOOL_ROUNDS: settingsYaml.subagent?.refactoring_max_tool_rounds || 25,
  ANALYSIS_MAX_TOOL_ROUNDS: settingsYaml.subagent?.analysis_max_tool_rounds || 15,
  DEBUG_MAX_TOOL_ROUNDS: settingsYaml.subagent?.debug_max_tool_rounds || 25,
  PERFORMANCE_MAX_TOOL_ROUNDS: settingsYaml.subagent?.performance_max_tool_rounds || 20,
  // Context depth settings
  DEFAULT_CONTEXT_DEPTH: settingsYaml.subagent?.default_context_depth || 15,
  DEEP_CONTEXT_DEPTH: settingsYaml.subagent?.deep_context_depth || 20,
  SHALLOW_CONTEXT_DEPTH: settingsYaml.subagent?.shallow_context_depth || 10,
  // Concurrency limits
  MAX_CONCURRENT_AGENTS: settingsYaml.subagent?.max_concurrent_agents || 5,
  MAX_CONCURRENT_TOOLS: settingsYaml.subagent?.max_concurrent_tools || 4,
} as const;

// Convert YAML model config to runtime format
export const GLM_MODELS = Object.entries(modelsYaml.models).reduce((acc, [key, model]) => {
  acc[key] = {
    name: model.name,
    contextWindow: model.context_window,
    maxOutputTokens: model.max_output_tokens,
    defaultMaxTokens: model.default_max_tokens,
    supportsThinking: model.supports_thinking,
    supportsVision: model.supports_vision || false,
    defaultTemperature: model.default_temperature,
    temperatureRange: {
      min: model.temperature_range.min,
      max: model.temperature_range.max,
    },
    tokenEfficiency: model.token_efficiency,
  };
  return acc;
}, {} as Record<string, {
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  defaultMaxTokens: number;
  supportsThinking: boolean;
  supportsVision: boolean;
  defaultTemperature: number;
  temperatureRange: { min: number; max: number };
  tokenEfficiency: number;
}>);

export type SupportedModel = keyof typeof GLM_MODELS;
export const DEFAULT_MODEL: SupportedModel = modelsYaml.default_model as SupportedModel;

// File Operations
export const FILE_CONFIG = {
  MAX_FILE_SIZE: settingsYaml.file.max_file_size,
  MAX_BUFFER_SIZE: settingsYaml.file.max_buffer_size,
  DIFF_CONTEXT_LINES: settingsYaml.file.diff_context_lines,
} as const;

// History Configuration
export const HISTORY_CONFIG = {
  MAX_HISTORY_SIZE: settingsYaml.history.max_history_size,
} as const;

// MCP Configuration
export const MCP_CONFIG = {
  CLIENT_NAME: settingsYaml.mcp.client_name,
  CLIENT_VERSION: settingsYaml.mcp.client_version,
  DEFAULT_TIMEOUT: settingsYaml.mcp.default_timeout,
  HEALTH_CHECK_INTERVAL: settingsYaml.mcp.health_check_interval || 60000,
  RECONNECT_MAX_DELAY: settingsYaml.mcp.reconnect_max_delay || 30000,
  TOKEN_WARNING_THRESHOLD: settingsYaml.mcp.token_warning_threshold,
  TOKEN_HARD_LIMIT: settingsYaml.mcp.token_hard_limit,
  TRUNCATION_ENABLED: settingsYaml.mcp.truncation_enabled,
} as const;

// Centralized Timeout Configuration
export const TIMEOUT_CONFIG = {
  // Tool execution timeouts
  BASH_DEFAULT: settingsYaml.timeouts?.bash_default || 30000,
  SEARCH_DEFAULT: settingsYaml.timeouts?.search_default || 30000,
  HOOK_DEFAULT: settingsYaml.timeouts?.hook_default || 30000,

  // Streaming timeouts
  STREAMING_FIRST_CHUNK: settingsYaml.timeouts?.streaming_first_chunk || 90000,
  STREAMING_IDLE: settingsYaml.timeouts?.streaming_idle || 120000,

  // Process pool timeouts
  PROCESS_EXECUTION: settingsYaml.timeouts?.process_execution || 30000,
  PROCESS_IDLE: settingsYaml.timeouts?.process_idle || 60000,

  // Paste timeouts
  PASTE_TIMEOUT: settingsYaml.timeouts?.paste_timeout || 30000,

  // Cache TTL
  CACHE_TTL: settingsYaml.timeouts?.cache_ttl || 60000,
  SETTINGS_CACHE_TTL: settingsYaml.timeouts?.settings_cache_ttl || 5000,

  // Network/API timeouts
  API_HEALTH_CHECK: settingsYaml.timeouts?.api_health_check || 5000,
  COMMAND_CHECK: settingsYaml.timeouts?.command_check || 3000,
  MCP_INIT: settingsYaml.timeouts?.mcp_init || 5000,
  SHUTDOWN: settingsYaml.timeouts?.shutdown || 10000,
  NPM_LIST: settingsYaml.timeouts?.npm_list || 10000,
  NPM_VIEW: settingsYaml.timeouts?.npm_view || 10000,
  UPDATE_INSTALL: settingsYaml.timeouts?.update_install || 120000,

  // UI timeouts
  NOTIFICATION_DISPLAY: settingsYaml.timeouts?.notification_display || 3000,
  TOOL_APPROVAL: settingsYaml.timeouts?.tool_approval || 300000,
  CONTEXT_CLEANUP_INTERVAL: settingsYaml.timeouts?.context_cleanup_interval || 300000,
  CONFIRMATION_TIMEOUT: settingsYaml.timeouts?.confirmation_timeout || 60000,

  // Time formatting constants
  MS_PER_SECOND: 1000,
  MS_PER_MINUTE: 60000,
} as const;

// Verbosity Levels
export enum VerbosityLevel {
  /** Group operations, show summaries only (default) */
  QUIET = 0,
  /** One line per tool execution */
  CONCISE = 1,
  /** Full details with arguments and outputs */
  VERBOSE = 2,
}

// Map string values from config to enum
export function parseVerbosityLevel(value: string): VerbosityLevel {
  switch (value.toLowerCase()) {
    case 'quiet':
      return VerbosityLevel.QUIET;
    case 'concise':
      return VerbosityLevel.CONCISE;
    case 'verbose':
      return VerbosityLevel.VERBOSE;
    default:
      return VerbosityLevel.QUIET;
  }
}

// UI Configuration
export const UI_CONFIG = {
  STATUS_UPDATE_INTERVAL: settingsYaml.ui.status_update_interval,
  PROCESSING_TIMER_INTERVAL: settingsYaml.ui.processing_timer_interval,
  // Verbosity settings
  DEFAULT_VERBOSITY_LEVEL: parseVerbosityLevel(settingsYaml.ui.verbosity_level || 'quiet'),
  GROUP_TOOL_CALLS: settingsYaml.ui.group_tool_calls !== undefined ? settingsYaml.ui.group_tool_calls : true,
  MAX_GROUP_SIZE: settingsYaml.ui.max_group_size || 20,
  GROUP_TIME_WINDOW: settingsYaml.ui.group_time_window || 500,
  /** Enable semantic grouping (Claude Code-style "Exploring codebase (12 reads)") */
  SEMANTIC_GROUPING: settingsYaml.ui.semantic_grouping !== undefined ? settingsYaml.ui.semantic_grouping : true,
  /** Maximum operations in a semantic group before splitting */
  MAX_SEMANTIC_GROUP_SIZE: settingsYaml.ui.max_semantic_group_size || 30,
  /** Maximum visible tool lines in rolling display (Claude Code-style) */
  MAX_VISIBLE_TOOL_LINES: settingsYaml.ui.max_visible_tool_lines || 3,
} as const;

// Token Counting
export const TOKEN_CONFIG = {
  TOKENS_PER_MESSAGE: settingsYaml.token.tokens_per_message,
  TOKENS_FOR_REPLY_PRIMING: settingsYaml.token.tokens_for_reply_priming,
  DEFAULT_MODEL: settingsYaml.token.default_model,
  DEFAULT_ENCODING: settingsYaml.token.default_encoding,
  CACHE_MAX_SIZE: settingsYaml.token.cache_max_size,
  CHARS_PER_TOKEN_ESTIMATE: settingsYaml.token.chars_per_token_estimate,
  /** Approximate tokens per image for multimodal messages (based on z.ai docs) */
  TOKENS_PER_IMAGE: 1000,
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
  DEFAULT_MAX_SIZE: settingsYaml.cache.default_max_size,
  DEFAULT_TTL: settingsYaml.cache.default_ttl,
  /** Max entries for tool call arguments cache */
  TOOL_ARGS_CACHE_MAX_SIZE: settingsYaml.cache.tool_args_cache_max_size || 500,
  /** Number of entries to remove when cache is full */
  TOOL_ARGS_CACHE_PRUNE_COUNT: settingsYaml.cache.tool_args_cache_prune_count || 100,
  /** Max entries for bash output hash cache (progress tracking) */
  BASH_OUTPUT_CACHE_MAX_SIZE: 100,
} as const;

// Performance Monitoring
export const PERF_CONFIG = {
  DEBOUNCE_DELAY: settingsYaml.performance.debounce_delay,
  THROTTLE_LIMIT: settingsYaml.performance.throttle_limit,
  SLOW_OPERATION_THRESHOLD: settingsYaml.performance.slow_operation_threshold,
} as const;

// Tool Names
export const TOOL_NAMES = settingsYaml.tool_names as Record<string, string>;

// Error Messages with template support
export const ERROR_MESSAGES = {
  API_KEY_REQUIRED: messagesYaml.errors.api_key_required,
  TRANSPORT_CONFIG_REQUIRED: messagesYaml.errors.transport_config_required,
  TOOL_NOT_FOUND: (toolName: string) => formatMessage(messagesYaml.errors.tool_not_found, { toolName }),
  SERVER_NOT_CONNECTED: (serverName: string) => formatMessage(messagesYaml.errors.server_not_connected, { serverName }),
  FILE_NOT_FOUND: (filePath: string) => formatMessage(messagesYaml.errors.file_not_found, { filePath }),
  DIRECTORY_NOT_FOUND: (dirPath: string) => formatMessage(messagesYaml.errors.directory_not_found, { dirPath }),
} as const;

// Multi-Phase Task Planner Configuration
export const PLANNER_CONFIG = {
  /** Enable multi-phase planning */
  ENABLED: true,

  /** Minimum expected tool calls to trigger auto-planning (lowered for more parallelization) */
  AUTO_PLAN_THRESHOLD: 2,

  /** Maximum phases per plan */
  MAX_PHASES: 10,

  /** Phase timeout in milliseconds (10 minutes) */
  PHASE_TIMEOUT_MS: 600000,

  /** Maximum parallel phases */
  MAX_PARALLEL_PHASES: 5,

  /** Create checkpoints before each phase */
  AUTO_CHECKPOINT: true,

  /** Require plan approval before executing - false for Claude Code-style seamless execution */
  REQUIRE_PLAN_APPROVAL: false,

  /** Require approval for high-risk phases */
  REQUIRE_HIGH_RISK_APPROVAL: true,

  /** Auto-approve low-risk phases - true for Claude Code-style seamless execution */
  AUTO_APPROVE_LOW_RISK: true,

  /** Prune context between phases */
  PRUNE_AFTER_PHASE: true,

  /** Target context percentage after pruning */
  TARGET_CONTEXT_PERCENTAGE: 50,

  /** Plan retention period in days */
  PLAN_RETENTION_DAYS: 30,

  /** Auto-cleanup old plans */
  AUTO_CLEANUP: true,

  /** Silent mode - use TodoWrite instead of explicit phase announcements */
  SILENT_MODE: true,

  /** Show detailed phase info only in verbose mode */
  VERBOSE_PHASES: false,
} as const;
