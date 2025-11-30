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
 * @packageDocumentation
 */

// Core client - backward-compatible wrapper (v1 API)
export { MCPManager } from "./client.js";
export type { MCPTool, MCPServerConfig, MCPTransportConfig } from "./client.js";

// Type-safe client (v2 API) - recommended for new code
export {
  MCPManagerV2,
  createServerName,
  createToolName,
  type ConnectionState,
  type ReconnectionConfig,
} from "./client-v2.js";
export type { ServerName, ToolName } from "./client-v2.js";

// Configuration
export {
  loadMCPConfig,
  addMCPServer,
  removeMCPServer,
  PREDEFINED_SERVERS,
  getTemplate,
  generateConfigFromTemplate,
} from "./config.js";
export type { MCPConfig } from "./config.js";

// Transports
export {
  createTransport,
  type MCPTransport,
  type TransportType,
  type TransportConfig,
  type StdioFraming,
} from "./transports.js";

// Config detection and migration
export { detectConfigFormat, detectMultipleConfigs, getDetectionSummary } from "./config-detector.js";
export { migrateConfig, batchMigrateConfigs, formatBatchMigrationResult } from "./config-migrator.js";

// Type safety utilities
export { Result, Ok, Err } from "./type-safety.js";

// Resource handling
export { resolveMCPReferences, extractMCPReferences } from "./resources.js";
