/**
 * MCP Module Constants
 *
 * Centralized constants for the MCP module to eliminate magic numbers
 * and provide a single source of truth for configuration defaults.
 */

// ============================================================================
// TIMEOUTS (in milliseconds)
// ============================================================================

export const MCP_TIMEOUTS = {
  /** Default timeout for tool calls (60 seconds) */
  DEFAULT_TOOL_CALL: 60_000,

  /** Startup timeout for stdio processes (30 seconds) */
  STARTUP: 30_000,

  /** Health check interval (60 seconds) */
  HEALTH_CHECK_INTERVAL: 60_000,

  /** Z.AI Vision init timeout - longer for npx downloads (2 minutes) */
  ZAI_VISION_INIT: 120_000,

  /** Maximum reconnection delay cap (30 seconds) */
  MAX_RECONNECT_DELAY: 30_000,

  /** Initial reconnection delay (1 second) */
  INITIAL_RECONNECT_DELAY: 1_000,
} as const;

// ============================================================================
// LIMITS
// ============================================================================

export const MCP_LIMITS = {
  /** Maximum buffer size for content-length transport (100 MB) */
  MAX_BUFFER_SIZE: 100 * 1024 * 1024,

  /** Maximum reconnection attempts before giving up */
  MAX_RECONNECT_ATTEMPTS: 5,

  /** Maximum server name length */
  MAX_SERVER_NAME_LENGTH: 64,

  /** Maximum tool name length */
  MAX_TOOL_NAME_LENGTH: 128,
} as const;

// ============================================================================
// ERROR CODES
// ============================================================================

export const MCP_ERROR_CODES = {
  /** JSON-RPC error code for cancelled requests */
  CANCELLED: -32800,

  /** JSON-RPC error code for invalid request */
  INVALID_REQUEST: -32600,

  /** JSON-RPC error code for method not found */
  METHOD_NOT_FOUND: -32601,

  /** JSON-RPC error code for invalid params */
  INVALID_PARAMS: -32602,

  /** JSON-RPC error code for internal error */
  INTERNAL_ERROR: -32603,
} as const;

// ============================================================================
// RECONNECTION
// ============================================================================

export const MCP_RECONNECTION = {
  /** Initial delay before first reconnection attempt (ms) */
  INITIAL_DELAY_MS: 1_000,

  /** Maximum delay between reconnection attempts (ms) */
  MAX_DELAY_MS: 30_000,

  /** Backoff multiplier for exponential backoff */
  BACKOFF_MULTIPLIER: 2,

  /** Jitter factor to add randomness (0-1) */
  JITTER_FACTOR: 0.1,

  /** Maximum number of reconnection attempts */
  MAX_ATTEMPTS: 5,
} as const;

// ============================================================================
// TRANSPORT DEFAULTS
// ============================================================================

export const MCP_TRANSPORT_DEFAULTS = {
  /** Default framing for stdio transport */
  STDIO_FRAMING: 'content-length' as const,

  /** Default HTTP method for streamable HTTP transport */
  HTTP_METHOD: 'POST' as const,
} as const;

// ============================================================================
// VALIDATION PATTERNS
// ============================================================================

export const MCP_PATTERNS = {
  /** Valid server name pattern (alphanumeric with hyphens/underscores) */
  SERVER_NAME: /^[a-z0-9-_]+$/i,

  /** Valid tool name pattern (alphanumeric with underscores/hyphens) */
  TOOL_NAME: /^[a-zA-Z0-9_-]+$/,
} as const;
