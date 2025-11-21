/**
 * Application-wide constants
 * Now loaded from YAML configuration files for better maintainability
 */

import { loadModelsConfig, loadSettingsConfig, loadMessagesConfig, formatMessage } from './utils/config-loader.js';

// Load configurations from YAML files
const modelsYaml = loadModelsConfig();
const settingsYaml = loadSettingsConfig();
const messagesYaml = loadMessagesConfig();

// Agent Configuration
export const AGENT_CONFIG = {
  MAX_TOOL_ROUNDS: settingsYaml.agent.max_tool_rounds,
  DEFAULT_TIMEOUT: settingsYaml.agent.default_timeout,
  DEFAULT_MAX_TOKENS: settingsYaml.agent.default_max_tokens,
  MAX_RECENT_TOOL_CALLS: settingsYaml.agent.max_recent_tool_calls,
  LOOP_DETECTION_THRESHOLD: settingsYaml.agent.loop_detection_threshold,
  ENABLE_LOOP_DETECTION: settingsYaml.agent.enable_loop_detection,
} as const;

// Convert YAML model config to runtime format
export const GLM_MODELS = Object.entries(modelsYaml.models).reduce((acc, [key, model]) => {
  acc[key] = {
    name: model.name,
    contextWindow: model.context_window,
    maxOutputTokens: model.max_output_tokens,
    defaultMaxTokens: model.default_max_tokens,
    supportsThinking: model.supports_thinking,
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
} as const;

// UI Configuration
export const UI_CONFIG = {
  STATUS_UPDATE_INTERVAL: settingsYaml.ui.status_update_interval,
  PROCESSING_TIMER_INTERVAL: settingsYaml.ui.processing_timer_interval,
} as const;

// Token Counting
export const TOKEN_CONFIG = {
  TOKENS_PER_MESSAGE: settingsYaml.token.tokens_per_message,
  TOKENS_FOR_REPLY_PRIMING: settingsYaml.token.tokens_for_reply_priming,
  DEFAULT_MODEL: settingsYaml.token.default_model,
  DEFAULT_ENCODING: settingsYaml.token.default_encoding,
  CACHE_MAX_SIZE: settingsYaml.token.cache_max_size,
  CHARS_PER_TOKEN_ESTIMATE: settingsYaml.token.chars_per_token_estimate,
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
  DEFAULT_MAX_SIZE: settingsYaml.cache.default_max_size,
  DEFAULT_TTL: settingsYaml.cache.default_ttl,
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

  /** Minimum expected tool calls to trigger auto-planning */
  AUTO_PLAN_THRESHOLD: 3,

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
