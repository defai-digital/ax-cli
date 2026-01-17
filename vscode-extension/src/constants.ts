/**
 * Centralized constants for AX CLI VS Code extension
 *
 * This file contains magic numbers and strings that are used across
 * multiple modules to ensure consistency and easy maintenance.
 */

// =============================================================================
// Extension Configuration
// =============================================================================

/**
 * VS Code configuration namespace for this extension
 */
export const CONFIG_NAMESPACE = 'ax-cli';

/**
 * Extension version displayed in IPC port file
 */
export const EXTENSION_VERSION = '1.0.2';

// =============================================================================
// Model Configuration
// =============================================================================

/**
 * Default AI model used when no model is configured
 */
export const DEFAULT_MODEL = 'grok-4-0709';

// =============================================================================
// Timeout Configuration (in milliseconds)
// =============================================================================

/**
 * Default timeout for CLI requests (5 minutes)
 */
export const CLI_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Timeout for diff preview user review (5 minutes)
 */
export const DIFF_PREVIEW_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Timeout for chat request initiation (30 seconds)
 */
export const CHAT_REQUEST_TIMEOUT_MS = 30 * 1000;

/**
 * Timeout for IPC response waiting (5 seconds)
 */
export const IPC_RESPONSE_TIMEOUT_MS = 5 * 1000;

/**
 * Status bar auto-reset delay (5 seconds)
 */
export const STATUS_RESET_TIMEOUT_MS = 5 * 1000;

/**
 * File search debounce delay (150ms)
 */
export const FILE_SEARCH_DEBOUNCE_MS = 150;

/**
 * Git command timeout (10 seconds)
 */
export const GIT_COMMAND_TIMEOUT_MS = 10 * 1000;

/**
 * Default timeout for hook execution (30 seconds)
 */
export const HOOK_TIMEOUT_MS = 30 * 1000;

/**
 * Default delay for auto-error recovery (1 second)
 */
export const ERROR_RECOVERY_DELAY_MS = 1000;

// =============================================================================
// Size Limits
// =============================================================================

/**
 * Maximum messages to keep in chat history before pruning
 */
export const MAX_CHAT_MESSAGES = 500;

/**
 * Number of recent messages to keep when compacting history
 */
export const COMPACT_HISTORY_KEEP_COUNT = 10;

/**
 * Maximum sessions to keep before cleanup
 */
export const MAX_SESSIONS = 20;

/**
 * Maximum checkpoints to keep before cleanup
 */
export const MAX_CHECKPOINTS = 50;

/**
 * Checkpoint retention period in days
 */
export const CHECKPOINT_RETENTION_DAYS = 7;

/**
 * Maximum files to return in workspace search
 */
export const MAX_WORKSPACE_FILES = 1000;

/**
 * Maximum characters for git diff display before truncation
 */
export const MAX_GIT_DIFF_LENGTH = 5000;

/**
 * Maximum file results to show in file picker
 */
export const MAX_FILE_PICKER_RESULTS = 50;

/**
 * Maximum file content size for IPC payload validation (10MB)
 */
export const MAX_IPC_CONTENT_LENGTH = 10 * 1024 * 1024;

/**
 * Maximum file path length for IPC payload validation
 */
export const MAX_IPC_PATH_LENGTH = 4096;

/**
 * Maximum prompt length for IPC payload validation (1MB)
 */
export const MAX_IPC_PROMPT_LENGTH = 1024 * 1024;

// =============================================================================
// UI Configuration
// =============================================================================

/**
 * Status bar item priority (right-aligned, lower = more right)
 */
export const STATUS_BAR_PRIORITY = 100;

// =============================================================================
// WebSocket Close Codes
// =============================================================================

/**
 * WebSocket close code for authentication failure
 */
export const WS_CLOSE_AUTH_FAILED = 4001;

/**
 * WebSocket close code for normal shutdown
 */
export const WS_CLOSE_NORMAL = 1000;
