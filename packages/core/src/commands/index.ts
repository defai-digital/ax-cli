/**
 * Commands Module - CLI Command System
 *
 * Provides the command registry, built-in command handlers,
 * and utilities for creating custom commands.
 *
 * @packageDocumentation
 */

// Command registry and types
export { CommandRegistry } from './registry.js';
export type {
  CommandDefinition,
  CommandContext,
  CommandResult,
  CommandHandler,
  CommandCategory,
  CommandSuggestion,
  ParsedCommand,
  RegistryStats,
} from './types.js';

// Built-in command handlers and registration
export {
  builtInCommands,
  registerBuiltInCommands,
  initializeCommandRegistry,
  isCommandRegistryInitialized,
  resetCommandRegistryState,
  getAllCommandSuggestions,
} from './handlers/index.js';

// Individual command handlers (re-exported from handlers)
export * from './handlers/index.js';

// Command factory functions
export { createUpdateCommand } from './update.js';
export { createInitCommand } from './init.js';
export { createDoctorCommand } from './doctor.js';
export { createSetupCommand } from './setup.js';
export { createMCPCommand } from './mcp.js';
export { createCacheCommand } from './cache.js';
export { createUsageCommand } from './usage.js';
export { createModelsCommand } from './models.js';
export { createMemoryCommand } from './memory.js';
export { createStatusCommand } from './status.js';
export { createDesignCommand } from './design.js';

// Custom command support
export { CustomCommandsManager, getCustomCommandsManager, type CustomCommand } from './custom-commands.js';

// Utilities
export {
  handleCommandError,
  withSpinner,
  outputResult,
  formatBytes,
  formatDate,
  printSeparator,
  confirmAction,
  exitIfCancelled,
} from './utils.js';
