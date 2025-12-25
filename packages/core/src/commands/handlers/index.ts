/**
 * Command Handlers Index
 *
 * Re-exports all command handlers and provides registration utilities.
 *
 * @packageDocumentation
 */

// Re-export individual handlers
export * from "./help.js";
export * from "./session.js";
export * from "./tasks.js";
export * from "./doctor.js";
export * from "./theme.js";
export * from "./model.js";
export * from "./usage.js";
export * from "./permissions.js";
export * from "./init.js";
export * from "./memory.js";
export * from "./mcp.js";
export * from "./lang.js";

// Import command definitions for registration
import { helpCommands } from "./help.js";
import { sessionCommands } from "./session.js";
import { taskCommands } from "./tasks.js";
import { doctorCommands } from "./doctor.js";
import { themeCommands } from "./theme.js";
import { modelCommands } from "./model.js";
import { usageCommands } from "./usage.js";
import { permissionsCommands } from "./permissions.js";
import { initCommands } from "./init.js";
import { memoryCommands } from "./memory.js";
import { mcpCommands } from "./mcp.js";
import { langCommands } from "./lang.js";

import type { CommandDefinition } from "../types.js";
import { CommandRegistry } from "../registry.js";

/**
 * All built-in command definitions
 *
 * Note: Plan and rewind commands are registered separately
 * since they already exist in their own modules.
 */
export const builtInCommands: CommandDefinition[] = [
  ...helpCommands,
  ...sessionCommands,
  ...taskCommands,
  ...doctorCommands,
  ...themeCommands,
  ...modelCommands,
  ...usageCommands,
  ...permissionsCommands,
  ...initCommands,
  ...memoryCommands,
  ...mcpCommands,
  ...langCommands,
];

// Track initialization state
let _initialized = false;

/**
 * Register all built-in commands with the registry
 *
 * Call this during application initialization to enable
 * all slash commands. Safe to call multiple times (idempotent).
 */
export function registerBuiltInCommands(): void {
  if (_initialized) return;

  const registry = CommandRegistry.getInstance();
  registry.registerAll(builtInCommands);
  _initialized = true;
}

/**
 * Initialize the command registry with all built-in commands
 *
 * This is the main entry point for command system initialization.
 * Call this early in the application lifecycle.
 *
 * @returns The initialized CommandRegistry instance
 */
export function initializeCommandRegistry(): CommandRegistry {
  registerBuiltInCommands();
  return CommandRegistry.getInstance();
}

/**
 * Check if the command registry has been initialized
 */
export function isCommandRegistryInitialized(): boolean {
  return _initialized;
}

/**
 * Reset initialization state (for testing only)
 */
export function resetCommandRegistryState(): void {
  _initialized = false;
  CommandRegistry.resetInstance();
}

/**
 * Get all command suggestions for autocomplete
 *
 * Returns built-in commands from the registry.
 * Aliases are shown inline with the command, not as separate entries.
 */
export function getAllCommandSuggestions(): Array<{
  command: string;
  description: string;
}> {
  const registry = CommandRegistry.getInstance();
  const suggestions: Array<{ command: string; description: string }> = [];

  for (const cmd of registry.getAll()) {
    // Show command with aliases inline (e.g., "/exit, /q")
    const aliasStr = cmd.aliases?.length ? `, /${cmd.aliases.join(', /')}` : '';
    suggestions.push({
      command: `/${cmd.name}${aliasStr}`,
      description: cmd.description,
    });
  }

  return suggestions;
}
