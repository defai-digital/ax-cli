/**
 * Zod schemas for validating user and project settings
 * Ensures graceful degradation on corrupted config files
 */

import { z } from 'zod';
import { ModelIdSchema, MCPServerIdSchema } from '@defai.digital/ax-schemas';

// Encrypted Value Schema (for encrypted API keys)
// SECURITY FIX: Support both old format (salt+IV) and new format (separate salt)
export const EncryptedValueSchema = z.object({
  encrypted: z.string(),
  iv: z.string(),
  salt: z.string().optional(), // New field for improved security
  tag: z.string(),
  version: z.number().int().positive(),
});

// Sampling Settings Schema (for deterministic/reproducible mode)
export const SamplingSettingsSchema = z.object({
  doSample: z.boolean().optional(),
  seed: z.number().int().nonnegative().optional(),
  topP: z.number().min(0).max(1).optional(),
}).optional();

// Thinking Settings Schema (for GLM-4.6 reasoning mode)
export const ThinkingSettingsSchema = z.object({
  enabled: z.boolean().optional(),
}).optional();

// Paste Settings Schema (for large paste auto-collapse) - Enhanced Phase 1 + Bracketed Paste Mode
export const PasteSettingsSchema = z.object({
  // Enable/disable auto-collapse feature
  autoCollapse: z.boolean().optional().default(true),
  // Minimum lines to trigger collapse (default: 20)
  collapseThreshold: z.number().int().min(1).max(1000).optional().default(20),
  // Character threshold for collapse (default: 500 chars) - Phase 1
  characterThreshold: z.number().int().min(100).max(100000).optional().default(500),
  // Maximum collapsed blocks per message (default: 50)
  maxCollapsedBlocks: z.number().int().min(1).max(100).optional().default(50),
  // Show line count in placeholder (default: true)
  showLineCount: z.boolean().optional().default(true),
  // Show preview lines in collapsed state (default: true) - Phase 1
  showPreview: z.boolean().optional().default(true),
  // Number of preview lines to show (default: 2)
  previewLines: z.number().int().min(0).max(10).optional().default(2),
  // Enable paste history tracking (default: true) - Phase 1
  enableHistory: z.boolean().optional().default(true),
  // Maximum paste history items (default: 10) - Phase 1
  maxHistoryItems: z.number().int().min(0).max(100).optional().default(10),
  // Bracketed Paste Mode Settings - v3.8.0
  // Enable bracketed paste mode for reliable detection (default: true)
  enableBracketedPaste: z.boolean().optional().default(true),
  // Show "Pasting..." indicator during paste accumulation (default: true)
  showPasteIndicator: z.boolean().optional().default(true),
  // Maximum paste size in bytes (default: 100MB) - Security limit
  maxPasteSize: z.number().int().min(1024).max(1024 * 1024 * 1024).optional().default(100 * 1024 * 1024),
  // Paste timeout in milliseconds (default: 30000ms = 30s)
  pasteTimeout: z.number().int().min(1000).max(60000).optional().default(30000),
  // Fallback to simple batched detection if bracketed paste not supported (default: true)
  enableFallback: z.boolean().optional().default(true),
}).optional();

// Input Settings Schema (for multi-line input behavior) - Phase 1
export const InputSettingsSchema = z.object({
  // Enter key behavior: submit (default), newline, smart (auto-detect)
  enterBehavior: z.enum(['newline', 'submit', 'smart']).optional().default('submit'),
  // Submit keys configuration (default: shift+enter)
  submitKeys: z.array(z.string()).optional().default(['shift+enter']),
  // Multi-line indicator for continuation lines
  multilineIndicator: z.string().optional().default('│ '),
  // Smart detection settings
  smartDetection: z.object({
    enabled: z.boolean().optional().default(true),
    checkBrackets: z.boolean().optional().default(true),
    checkOperators: z.boolean().optional().default(true),
    checkStatements: z.boolean().optional().default(true),
  }).optional(),
}).optional();

// Keyboard Shortcuts Settings Schema - Phase 1
export const ShortcutsSettingsSchema = z.object({
  // Show shortcuts help on first run
  showOnStartup: z.boolean().optional().default(false),
  // Hint timeout in milliseconds (0 = no timeout)
  hintTimeout: z.number().int().min(0).max(10000).optional().default(3000),
  // Custom key bindings (advanced users)
  customBindings: z.record(z.string(), z.string()).optional(),
}).optional();

// Theme names enum for type safety
export const ThemeNameSchema = z.enum(['default', 'dark', 'light', 'dracula', 'monokai', 'business', 'japanese']);
export type ThemeName = z.infer<typeof ThemeNameSchema>;

// UI Settings Schema (for verbosity levels and tool grouping)
export const UISettingsSchema = z.object({
  // Verbosity level: quiet (0), concise (1), verbose (2)
  verbosityLevel: z.enum(['quiet', 'concise', 'verbose']).optional().default('quiet'),
  // Enable/disable tool call grouping (applies to quiet mode)
  groupToolCalls: z.boolean().optional().default(true),
  // Maximum operations per group
  maxGroupSize: z.number().int().min(1).max(50).optional().default(20),
  // Time window for grouping consecutive operations (ms)
  groupTimeWindow: z.number().int().min(0).max(5000).optional().default(500),
  // Color theme for the CLI interface
  theme: ThemeNameSchema.optional().default('default'),
}).optional();

// Status Bar Settings Schema - Phase 2
export const StatusBarSettingsSchema = z.object({
  // Enable/disable status bar
  enabled: z.boolean().optional().default(true),
  // Compact mode (single line) vs expanded (multi-line)
  compact: z.boolean().optional().default(true),
  // Show cost estimation
  showCost: z.boolean().optional().default(true),
  // Show token usage
  showTokens: z.boolean().optional().default(true),
  // Show context usage
  showContext: z.boolean().optional().default(true),
  // Show session info (duration, message count)
  showSession: z.boolean().optional().default(true),
  // Show mode indicators (auto-accept, thinking)
  showModes: z.boolean().optional().default(true),
  // Update interval in milliseconds
  updateInterval: z.number().int().min(500).max(5000).optional().default(1000),
  // Position: top or bottom
  position: z.enum(['top', 'bottom']).optional().default('top'),
}).optional();

// Auto-accept Settings Schema - Phase 2
export const AutoAcceptSettingsSchema = z.object({
  // Enable/disable auto-accept mode
  enabled: z.boolean().optional().default(false),
  // Persist across sessions
  persistAcrossSessions: z.boolean().optional().default(false),
  // Operations that always require confirmation
  alwaysConfirm: z.array(z.string()).optional().default([
    'git_push_main',
    'mass_delete',
    'rm_rf',
    'npm_publish',
  ]),
  // Scope: session, project, or global
  scope: z.enum(['session', 'project', 'global']).optional().default('session'),
  // Audit log settings
  auditLog: z.object({
    enabled: z.boolean().optional().default(true),
    maxEntries: z.number().int().min(10).max(10000).optional().default(1000),
    filepath: z.string().optional(),
  }).optional().default({
    enabled: true,
    maxEntries: 1000,
  }),
}).optional();

// External Editor Settings Schema - Phase 2
export const ExternalEditorSettingsSchema = z.object({
  // Enable/disable external editor integration
  enabled: z.boolean().optional().default(true),
  // Override $EDITOR environment variable
  editor: z.string().optional(),
  // Keyboard shortcut to open editor
  shortcut: z.string().optional().default('ctrl+g'),
  // Override temp directory (default: /tmp)
  tempDir: z.string().optional(),
  // Confirm before submitting from editor
  confirmBeforeSubmit: z.boolean().optional().default(true),
  // Enable syntax highlighting in editor
  syntaxHighlighting: z.boolean().optional().default(true),
}).optional();

// Thinking Mode Settings Schema (Enhanced) - Phase 2
export const ThinkingModeSettingsSchema = z.object({
  // Enable GLM-4.6 thinking mode
  enabled: z.boolean().optional().default(false),
  // Enable quick toggle with Tab key
  quickToggle: z.boolean().optional().default(true),
  // Show thinking mode indicator in status bar
  showInStatusBar: z.boolean().optional().default(true),
  // Thinking budget tokens (optional, GLM-4.6 specific)
  budgetTokens: z.number().int().min(100).max(10000).optional(),
}).optional();

// Auto-Update Settings Schema
export const AutoUpdateSettingsSchema = z.object({
  // Enable/disable automatic update check on startup
  enabled: z.boolean().optional().default(true),
  // Check interval in hours (0 = always check, 24 = once per day)
  checkIntervalHours: z.number().int().min(0).max(168).optional().default(24),
  // Last check timestamp (ISO string)
  lastCheckTimestamp: z.string().optional(),
  // Auto-install updates without prompting (not recommended)
  autoInstall: z.boolean().optional().default(false),
}).optional();

// Agent-First Mode Settings Schema
// Routes tasks to specialized AutomatosX agents when explicitly requested
export const AgentFirstSettingsSchema = z.object({
  // Enable/disable agent-first mode (default: false - use direct LLM unless explicitly requested)
  enabled: z.boolean().optional().default(false),
  // Minimum confidence to auto-route (0.0-1.0)
  confidenceThreshold: z.number().min(0).max(1).optional().default(0.6),
  // Show which agent is handling the task (badge in UI)
  showAgentIndicator: z.boolean().optional().default(true),
  // Default agent when no keyword match (null = direct LLM)
  defaultAgent: z.string().nullable().optional().default('standard'),
  // Agents to exclude from auto-selection
  excludedAgents: z.array(z.string()).optional().default([]),
}).optional();

// Security Settings Schema (for enterprise hardening)
export const SecuritySettingsSchema = z.object({
  // Enable command whitelist validation (REQ-SEC-001)
  // Default: false (allows all commands with user confirmation)
  // Enterprise: true (strict whitelist enforcement)
  enableCommandWhitelist: z.boolean().optional(),
  // Enable SSRF protection for HTTP/SSE transports (REQ-SEC-011)
  // Default: false (no SSRF validation)
  // Enterprise: true (strict SSRF protection)
  enableSSRFProtection: z.boolean().optional(),
  // Enable error message sanitization (REQ-SEC-010)
  // Default: false (full error details)
  // Enterprise: true (sanitize sensitive data from errors)
  enableErrorSanitization: z.boolean().optional(),
}).optional();

// User Settings Schema
export const UserSettingsSchema: z.ZodType<any> = z.object({
  // API key (plain-text) - DEPRECATED: Use apiKeyEncrypted instead
  // This field is kept for backward compatibility and migration
  // Will be cleared once migrated to apiKeyEncrypted
  apiKey: z.string().optional(),

  // Encrypted API key (new field) - REQ-SEC-003
  // This is the preferred way to store API keys
  apiKeyEncrypted: EncryptedValueSchema.optional(),

  // INPUT VALIDATION FIX: Validate URL format while allowing local URLs
  baseURL: z.string().optional().refine(
    (val) => {
      if (!val) return true; // Optional field
      try {
        // Allow http, https, and localhost URLs
        const url = new URL(val);
        return ['http:', 'https:'].includes(url.protocol);
      } catch {
        // If URL parsing fails, check if it's a valid localhost format
        return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/.test(val);
      }
    },
    { message: 'baseURL must be a valid HTTP or HTTPS URL' }
  ),
  defaultModel: ModelIdSchema.optional(),
  currentModel: ModelIdSchema.optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  models: z.array(ModelIdSchema).optional(),
  confirmations: z.object({
    fileOperations: z.boolean().optional(),
    bashCommands: z.boolean().optional(),
  }).optional(),
  // Security settings for enterprise hardening (disabled by default)
  security: SecuritySettingsSchema,
  // Sampling settings for deterministic/reproducible mode
  sampling: SamplingSettingsSchema,
  // Thinking settings for GLM-4.6 reasoning mode
  thinking: ThinkingSettingsSchema,
  // Input settings for multi-line input behavior (Phase 1)
  input: InputSettingsSchema,
  // Keyboard shortcuts settings (Phase 1)
  shortcuts: ShortcutsSettingsSchema,
  // Paste settings for large paste auto-collapse
  paste: PasteSettingsSchema,
  // UI settings for verbosity levels and tool grouping
  ui: UISettingsSchema,
  // Status bar settings (Phase 2)
  statusBar: StatusBarSettingsSchema,
  // Auto-accept mode settings (Phase 2)
  autoAccept: AutoAcceptSettingsSchema,
  // External editor settings (Phase 2)
  externalEditor: ExternalEditorSettingsSchema,
  // Thinking mode settings (enhanced Phase 2)
  thinkingMode: ThinkingModeSettingsSchema,
  // Auto-update settings
  autoUpdate: AutoUpdateSettingsSchema,
  // Agent-first mode settings
  agentFirst: AgentFirstSettingsSchema,
  // User-level MCP server configurations (global across all projects)
  // Used for provider-specific MCP servers like Z.AI that should work from any directory
  mcpServers: z.record(z.string(), z.any()).optional(),
}).passthrough(); // Allow additional properties for backward compatibility

// Project Settings Schema
export const ProjectSettingsSchema: z.ZodType<any> = z.object({
  name: z.string().optional(),
  model: ModelIdSchema.optional(), // Legacy field
  currentModel: ModelIdSchema.optional(),
  customInstructions: z.string().optional(),
  excludePatterns: z.array(z.string()).optional(),
  includePatterns: z.array(z.string()).optional(),
  mcpServers: z.record(z.string(), z.any()).optional(), // MCP server configurations
  // Project-level sampling settings (overrides user settings)
  sampling: SamplingSettingsSchema,
  // Project-level thinking settings (overrides user settings)
  thinking: ThinkingSettingsSchema,
  // Project-level UI settings (overrides user settings)
  ui: UISettingsSchema,
  // Project-level agent-first mode settings (overrides user settings)
  agentFirst: AgentFirstSettingsSchema,
}).passthrough(); // Allow additional properties for backward compatibility

// Model Option Schema
export const ModelOptionSchema: z.ZodType<any> = z.object({
  model: ModelIdSchema,
  description: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
});

// MCP Server Config Schema
export const MCPTransportConfigSchema = z.object({
  type: z.enum(['stdio', 'http', 'sse', 'streamable_http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  url: z.string().url().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  // Framing protocol for stdio transport (default: 'content-length')
  // - 'ndjson': Newline-delimited JSON (MCP SDK default, used by most MCP servers)
  // - 'content-length': Content-Length header framing (LSP-style, used by AutomatosX)
  framing: z.enum(['ndjson', 'content-length']).optional(),
});

export const MCPServerConfigSchema: z.ZodType<any> = z.object({
  name: MCPServerIdSchema,
  transport: MCPTransportConfigSchema,
  command: z.string().optional(), // Legacy support
  args: z.array(z.string()).optional(), // Legacy support
  env: z.record(z.string(), z.string()).optional(), // Legacy support
  // Timeout configuration for long-running MCP tools (e.g., AutomatosX agents)
  // Default: 60000ms (60 seconds) - matches MCP SDK default
  // For long-running tasks, set higher values (e.g., 2700000 for 45 minutes)
  timeout: z.number().int().positive().optional(),
  // Initialization timeout for server startup (e.g., when using npx to download packages)
  // Default: 60000ms (60 seconds) - but servers using npx may need 120000ms or more
  // This timeout covers transport connection + MCP initialize handshake
  initTimeout: z.number().int().positive().optional(),
  // Suppress stderr output from the MCP server (hides INFO/DEBUG logs)
  // Default: false (show all stderr output)
  quiet: z.boolean().optional(),
});

// Export types
export type EncryptedValue = z.infer<typeof EncryptedValueSchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
export type ModelOption = z.infer<typeof ModelOptionSchema>;
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;
export type MCPTransportConfig = z.infer<typeof MCPTransportConfigSchema>;
export type SamplingSettings = z.infer<typeof SamplingSettingsSchema>;
export type ThinkingSettings = z.infer<typeof ThinkingSettingsSchema>;
export type InputSettings = z.infer<typeof InputSettingsSchema>;
export type RequiredInputSettings = Required<InputSettings>; // All properties required (for runtime config)
export type ShortcutsSettings = z.infer<typeof ShortcutsSettingsSchema>;
export type PasteSettings = z.infer<typeof PasteSettingsSchema>;
export type UISettings = z.infer<typeof UISettingsSchema>;
// Phase 2 types
export type StatusBarSettings = z.infer<typeof StatusBarSettingsSchema>;
export type AutoAcceptSettings = z.infer<typeof AutoAcceptSettingsSchema>;
export type ExternalEditorSettings = z.infer<typeof ExternalEditorSettingsSchema>;
export type ThinkingModeSettings = z.infer<typeof ThinkingModeSettingsSchema>;
export type AutoUpdateSettings = z.infer<typeof AutoUpdateSettingsSchema>;
export type AgentFirstSettings = z.infer<typeof AgentFirstSettingsSchema>;
