/**
 * Utility Module
 *
 * Centralized utility functions organized by domain.
 *
 * ## Logical Groupings
 *
 * ### Error Handling
 * - error-handler.ts - Core error extraction and formatting
 * - enhanced-error-messages.ts - User-friendly error messages
 * - api-error.ts - API-specific error handling
 * - error-translator.ts - Error translation for users
 *
 * ### Security
 * - command-security.ts - Command validation
 * - encryption.ts - AES-256-GCM encryption for API keys
 * - input-sanitizer.ts - XSS and injection prevention
 * - path-security.ts - Path traversal protection
 * - safety-rules.ts - Safety rule enforcement
 *
 * ### Configuration
 * - settings-manager.ts - User/project settings
 * - config-loader.ts - Config file loading
 * - custom-instructions.ts - Custom AI instructions
 * - template-manager.ts - Template management
 *
 * ### Paths
 * - path-helpers.ts - Path constants
 * - path-utils.ts - Path manipulation
 * - path-validator.ts - Path validation
 *
 * ### Caching
 * - cache.ts - Generic caching
 * - file-cache.ts - File content caching
 * - rate-limiter.ts - Rate limiting
 *
 * ### Text Processing
 * - text-utils.ts - Text manipulation
 * - string-utils.ts - String utilities
 * - json-utils.ts - JSON parsing
 * - paste-utils.ts - Clipboard handling
 * - message-optimizer.ts - Message optimization
 *
 * ### Process Management
 * - background-task-manager.ts - Background tasks
 * - process-pool.ts - Process pooling
 * - retry-helper.ts - Retry logic
 *
 * ### Analysis
 * - project-analyzer.ts - Project analysis
 * - parallel-analyzer.ts - Parallel analysis
 * - analysis-logger.ts - Analysis logging
 *
 * ### Logging
 * - audit-logger.ts - Security audit logging
 * - auto-accept-logger.ts - Auto-accept logging
 * - console-messenger.ts - Console output
 *
 * ### History
 * - history-manager.ts - Conversation history
 * - history-migration.ts - History format migration
 *
 * ### Initialization
 * - init-previewer.ts - Init preview
 * - init-validator.ts - Init validation
 * - setup-validator.ts - Setup validation
 * - onboarding-manager.ts - User onboarding
 *
 * ### Core
 * - token-counter.ts - Token counting
 * - usage-tracker.ts - Usage tracking
 * - version.ts - Version info
 * - performance.ts - Performance monitoring
 * - progress-tracker.ts - Progress tracking
 * - confirmation-service.ts - Confirmation dialogs
 * - external-editor.ts - External editor support
 * - prompt-builder.ts - Prompt building
 * - automatosx-detector.ts - AutomatosX detection
 * - instruction-generator.ts - Instruction generation
 * - llm-optimized-instruction-generator.ts - LLM-optimized instructions
 *
 * @packageDocumentation
 */

// ============================================================================
// Error Handling
// ============================================================================
export * from './error-handler.js';

// ============================================================================
// Configuration
// ============================================================================
export * from './settings-manager.js';
export * from './custom-instructions.js';

// ============================================================================
// Caching
// ============================================================================
export * from './cache.js';

// ============================================================================
// Paths
// ============================================================================
export * from './path-validator.js';

// ============================================================================
// Text Processing
// ============================================================================
export * from './text-utils.js';

// ============================================================================
// Core Utilities
// ============================================================================
export * from './token-counter.js';
export * from './confirmation-service.js';
export * from './performance.js';

// ============================================================================
// Logging & Exit Handling
// ============================================================================
export * from './logger.js';
export * from './exit-handler.js';
export * from './terminal-state.js';

// ============================================================================
// Input Validation
// ============================================================================
export * from './input-validator.js';
