/**
 * MCP (Model Context Protocol) Module
 *
 * Provides MCP server management capabilities including:
 * - Server lifecycle management (add, remove, shutdown)
 * - Multiple transport types (stdio, HTTP, SSE)
 * - Tool execution via MCP servers
 * - Configuration loading and validation
 *
 * ## Architecture
 *
 * The MCP module uses a layered architecture:
 * - `MCPManager` (v1 API) - Backward-compatible wrapper, throws on errors
 * - `MCPManagerV2` (v2 API) - Type-safe implementation with Result types
 *
 * All new code should use `MCPManagerV2` for better type safety.
 * `MCPManager` is maintained for SDK backward compatibility.
 *
 * ## Export Organization
 *
 * Exports are grouped by domain:
 * 1. Core API (v1 legacy + v2 recommended)
 * 2. Configuration (loading, templates, migration)
 * 3. Transports (stdio, HTTP, SSE)
 * 4. Features (progress, cancellation, subscriptions, validation)
 * 5. Utilities (type safety, resources, prompts)
 * 6. Z.AI Integration (templates, detection)
 *
 * @packageDocumentation
 */

// ============================================================================
// CORE API
// ============================================================================

// v1 API - backward-compatible wrapper (legacy, throws on errors)
export { MCPManager } from "./client.js";
export type { MCPTool, MCPServerConfig, MCPTransportConfig } from "./client.js";

// v2 API - type-safe implementation (recommended for new code)
export {
  MCPManagerV2,
  createServerName,
  createToolName,
  type ConnectionState,
  type ReconnectionConfig,
  type MCPPrompt,
} from "./client-v2.js";
export type { ServerName, ToolName } from "./client-v2.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Config loading and management
export {
  loadMCPConfig,
  addMCPServer,
  removeMCPServer,
  PREDEFINED_SERVERS,
  getTemplate,
  generateConfigFromTemplate,
} from "./config.js";
export type { MCPConfig } from "./config.js";

// Provider-specific MCP config loading (Claude Code format support)
export {
  loadProviderMCPConfig,
  getProviderMCPServers,
  providerMCPConfigExists,
  getClaudeCodeMCPConfigPath,
  getLegacyMCPConfigPath,
} from "./provider-mcp-loader.js";
export type {
  ProviderMCPLoadResult,
  ClaudeCodeMCPConfig,
  LegacyProviderMCPConfig,
} from "./provider-mcp-loader.js";

// AutomatosX auto-discovery (seamless integration when AutomatosX is installed)
export {
  detectAutomatosX,
  getAutoDiscoveredServers,
  generateAutoDiscoveryConfig,
  isAutoDiscoveredServer,
  clearDetectionCache,
} from "./automatosx-auto-discovery.js";
export type {
  AutomatosXDetectionResult,
  AutoDiscoveryOptions,
} from "./automatosx-auto-discovery.js";

// Config detection and migration
export { detectConfigFormat, detectMultipleConfigs, getDetectionSummary } from "./config-detector.js";
export { migrateConfig, batchMigrateConfigs, formatBatchMigrationResult } from "./config-migrator.js";

// ============================================================================
// TRANSPORTS
// ============================================================================

export {
  createTransport,
  type MCPTransport,
  type TransportType,
  type TransportConfig,
  type StdioFraming,
} from "./transports.js";

// ============================================================================
// FEATURES (MCP 2025-06-18 Specification)
// ============================================================================

// Progress tracking
export {
  ProgressTracker,
  getProgressTracker,
  resetProgressTracker,
  formatProgress,
  formatElapsedTime,
  type ProgressUpdate,
  type ProgressCallback,
} from "./progress.js";

// Cancellation support
export {
  CancellationManager,
  getCancellationManager,
  resetCancellationManager,
  isRequestCancelled,
  createCancellationError,
  CANCELLED_ERROR_CODE,
  type CancellableRequest,
  type CancellationResult,
} from "./cancellation.js";

// Resource subscriptions
export {
  SubscriptionManager,
  getSubscriptionManager,
  resetSubscriptionManager,
  type ResourceSubscription,
} from "./subscriptions.js";

// Schema validation
export {
  ToolOutputValidator,
  getToolOutputValidator,
  resetToolOutputValidator,
  type SchemaValidationResult,
  type SchemaValidationStatus,
} from "./schema-validator.js";

// ============================================================================
// UTILITIES
// ============================================================================

// Constants
export {
  MCP_TIMEOUTS,
  MCP_LIMITS,
  MCP_ERROR_CODES,
  MCP_RECONNECTION,
  MCP_TRANSPORT_DEFAULTS,
  MCP_PATTERNS,
} from "./constants.js";

// Type safety (Result types, error conversion)
export { Ok, Err, toError } from "./type-safety.js";
export type { Result } from "./type-safety.js";

// Error remediation (pattern matching, hints)
export {
  matchErrorPattern,
  getTransportHints,
  getEnvVarHints,
  ERROR_REMEDIATION,
  type Remediation
} from "./error-remediation.js";

// Resource handling
export { resolveMCPReferences, extractMCPReferences } from "./resources.js";

// Prompt utilities
export {
  parseMCPIdentifier,
  promptToSlashCommand,
  parsePromptCommand,
  formatPromptResult,
  getPromptDescription,
} from "./prompts.js";

// ============================================================================
// Z.AI INTEGRATION
// ============================================================================

// Z.AI MCP templates and configuration
export {
  ZAI_SERVER_NAMES,
  ZAI_ENDPOINTS,
  ZAI_VISION_PACKAGE,
  ZAI_MCP_TEMPLATES,
  ZAI_QUOTA_LIMITS,
  generateZAIServerConfig,
  getAllZAIServerNames,
  isZAIServer,
  getZAITemplate,
  type ZAIServerName,
  type ZAIPlanTier,
  type ZAIMCPTemplate,
} from "./zai-templates.js";

// Z.AI service detection and validation
export {
  detectZAIServices,
  getEnabledZAIServers,
  validateZAIApiKey,
  getZAIApiKey,
  isZAIMCPConfigured,
  getRecommendedServers,
  isGLMModel,
  isZAIBaseURL,
  formatZAIStatus,
  type ZAIServiceStatus,
} from "./zai-detector.js";

// ============================================================================
// DEBUG MODE
// ============================================================================

export {
  MCPDebugLogger,
  getMCPDebugLogger,
  resetMCPDebugLogger,
  collectMCPDiagnostics,
  formatMCPDiagnostics,
  createDebugSession,
  DEFAULT_DEBUG_CONFIG,
  type DebugEventType,
  type DebugEvent,
  type DebugLogLevel,
  type DebugLoggerConfig,
  type ServerDiagnostics,
  type MCPDiagnostics,
} from "./debug.js";
