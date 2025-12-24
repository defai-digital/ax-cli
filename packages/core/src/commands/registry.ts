/**
 * Command Registry
 *
 * Central registry for slash commands. Handles registration, lookup,
 * alias resolution, and execution dispatch.
 *
 * @packageDocumentation
 */

import type {
  CommandDefinition,
  CommandContext,
  CommandResult,
  CommandSuggestion,
  CommandCategory,
  ParsedCommand,
  RegistryStats,
} from "./types.js";
import { getLogger } from "../utils/logger.js";

/**
 * Singleton command registry
 *
 * All slash commands are registered here and dispatched through this registry.
 */
export class CommandRegistry {
  private static instance: CommandRegistry | null = null;

  /** Primary command storage: name -> definition */
  private commands: Map<string, CommandDefinition> = new Map();

  /** Alias resolution: alias -> primary command name */
  private aliases: Map<string, string> = new Map();

  /** Category index for efficient category-based lookups */
  private byCategory: Map<CommandCategory, Set<string>> = new Map();

  private constructor() {
    // Initialize category sets
    const categories: CommandCategory[] = [
      "session",
      "memory",
      "tasks",
      "settings",
      "project",
      "info",
      "mcp",
      "plan",
    ];
    for (const category of categories) {
      this.byCategory.set(category, new Set());
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry();
    }
    return CommandRegistry.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  public static resetInstance(): void {
    CommandRegistry.instance = null;
  }

  /**
   * Register a single command
   *
   * @param command - The command definition to register
   * @throws Error if command name or alias conflicts with existing registration
   */
  public register(command: CommandDefinition): void {
    const name = command.name.toLowerCase();

    // Check for conflicts
    if (this.commands.has(name)) {
      throw new Error(`Command "${name}" is already registered`);
    }
    if (this.aliases.has(name)) {
      throw new Error(
        `Command "${name}" conflicts with existing alias for "${this.aliases.get(name)}"`
      );
    }

    // Register the command
    this.commands.set(name, command);

    // Add to category index
    const categorySet = this.byCategory.get(command.category);
    if (categorySet) {
      categorySet.add(name);
    }

    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        const aliasLower = alias.toLowerCase();
        if (this.commands.has(aliasLower)) {
          throw new Error(
            `Alias "${aliasLower}" conflicts with existing command`
          );
        }
        if (this.aliases.has(aliasLower)) {
          throw new Error(
            `Alias "${aliasLower}" is already registered for "${this.aliases.get(aliasLower)}"`
          );
        }
        this.aliases.set(aliasLower, name);
      }
    }

    const logger = getLogger();
    logger.debug(`Registered command: /${name}`, {
      category: command.category,
      aliases: command.aliases,
    });
  }

  /**
   * Register multiple commands at once
   *
   * @param commands - Array of command definitions
   */
  public registerAll(commands: CommandDefinition[]): void {
    for (const command of commands) {
      this.register(command);
    }
  }

  /**
   * Unregister a command
   *
   * @param name - Command name to unregister
   * @returns true if command was unregistered, false if not found
   */
  public unregister(name: string): boolean {
    const nameLower = name.toLowerCase();
    const command = this.commands.get(nameLower);

    if (!command) {
      return false;
    }

    // Remove from commands
    this.commands.delete(nameLower);

    // Remove from category index
    const categorySet = this.byCategory.get(command.category);
    if (categorySet) {
      categorySet.delete(nameLower);
    }

    // Remove aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.delete(alias.toLowerCase());
      }
    }

    return true;
  }

  /**
   * Get a command by name or alias
   *
   * @param name - Command name or alias
   * @returns The command definition, or undefined if not found
   */
  public get(name: string): CommandDefinition | undefined {
    const nameLower = name.toLowerCase();

    // Try direct lookup first
    const direct = this.commands.get(nameLower);
    if (direct) {
      return direct;
    }

    // Try alias resolution
    const primaryName = this.aliases.get(nameLower);
    if (primaryName) {
      return this.commands.get(primaryName);
    }

    return undefined;
  }

  /**
   * Check if a command exists
   *
   * @param name - Command name or alias
   */
  public has(name: string): boolean {
    const nameLower = name.toLowerCase();
    return this.commands.has(nameLower) || this.aliases.has(nameLower);
  }

  /**
   * Get all commands in a category
   *
   * @param category - The category to filter by
   * @returns Array of command definitions
   */
  public getByCategory(category: CommandCategory): CommandDefinition[] {
    const names = this.byCategory.get(category);
    if (!names) {
      return [];
    }

    const result: CommandDefinition[] = [];
    for (const name of names) {
      const command = this.commands.get(name);
      if (command) {
        result.push(command);
      }
    }
    return result;
  }

  /**
   * Get all registered commands
   *
   * @param includeHidden - Whether to include hidden commands
   */
  public getAll(includeHidden = false): CommandDefinition[] {
    const result: CommandDefinition[] = [];
    for (const command of this.commands.values()) {
      if (includeHidden || !command.hidden) {
        result.push(command);
      }
    }
    return result;
  }

  /**
   * Get command suggestions for autocomplete
   *
   * @param prefix - The input prefix (e.g., "/mod")
   * @param limit - Maximum number of suggestions
   */
  public getSuggestions(prefix: string, limit = 10): CommandSuggestion[] {
    const suggestions: CommandSuggestion[] = [];
    const prefixLower = prefix.toLowerCase().replace(/^\//, "");

    // Collect matching commands
    for (const [name, command] of this.commands) {
      if (command.hidden) continue;

      if (name.startsWith(prefixLower)) {
        suggestions.push({
          command: `/${name}`,
          description: command.description,
          category: command.category,
        });
      }

      // Also check aliases
      if (command.aliases) {
        for (const alias of command.aliases) {
          if (alias.toLowerCase().startsWith(prefixLower)) {
            suggestions.push({
              command: `/${alias}`,
              description: `${command.description} (alias for /${name})`,
              category: command.category,
            });
          }
        }
      }
    }

    // Sort by relevance (exact prefix matches first, then alphabetically)
    suggestions.sort((a, b) => {
      const aExact = a.command.toLowerCase() === `/${prefixLower}`;
      const bExact = b.command.toLowerCase() === `/${prefixLower}`;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return a.command.localeCompare(b.command);
    });

    return suggestions.slice(0, limit);
  }

  /**
   * Parse a slash command input
   *
   * @param input - The raw input string
   * @returns Parsed command structure
   */
  public parse(input: string): ParsedCommand {
    const trimmed = input.trim();

    if (!trimmed.startsWith("/")) {
      return {
        command: "",
        fullCommand: "",
        args: trimmed,
        isSlashCommand: false,
      };
    }

    const spaceIndex = trimmed.indexOf(" ");
    if (spaceIndex === -1) {
      const command = trimmed.substring(1).toLowerCase();
      return {
        command,
        fullCommand: trimmed,
        args: "",
        isSlashCommand: true,
      };
    }

    const command = trimmed.substring(1, spaceIndex).toLowerCase();
    const args = trimmed.substring(spaceIndex + 1).trim();

    return {
      command,
      fullCommand: trimmed.substring(0, spaceIndex),
      args,
      isSlashCommand: true,
    };
  }

  /**
   * Execute a command
   *
   * @param input - The full command input (e.g., "/model save glm-4.7")
   * @param ctx - The command context
   * @returns The command result
   */
  public async execute(
    input: string,
    ctx: CommandContext
  ): Promise<CommandResult> {
    const parsed = this.parse(input);

    if (!parsed.isSlashCommand) {
      return { handled: false };
    }

    const command = this.get(parsed.command);
    if (!command) {
      return {
        handled: false,
        error: `Unknown command: /${parsed.command}. Type /help for available commands.`,
      };
    }

    // Validate required args
    if (command.requiresArgs && !parsed.args) {
      return {
        handled: true,
        error: `Command /${parsed.command} requires arguments. ${command.examples ? `Usage: ${command.examples[0]}` : ""}`,
      };
    }

    try {
      const result = await command.handler(parsed.args, ctx);
      return result;
    } catch (error) {
      const logger = getLogger();
      logger.error(`Command /${parsed.command} failed`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        handled: true,
        error: `Command failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Get registry statistics
   */
  public getStats(): RegistryStats {
    const byCategory: Record<CommandCategory, number> = {
      session: 0,
      memory: 0,
      tasks: 0,
      settings: 0,
      project: 0,
      info: 0,
      mcp: 0,
      plan: 0,
    };

    for (const [category, names] of this.byCategory) {
      byCategory[category] = names.size;
    }

    return {
      commandCount: this.commands.size,
      aliasCount: this.aliases.size,
      byCategory,
    };
  }

  /**
   * Clear all registered commands (for testing)
   */
  public clear(): void {
    this.commands.clear();
    this.aliases.clear();
    for (const set of this.byCategory.values()) {
      set.clear();
    }
  }
}

/**
 * Convenience function to get the command registry instance
 */
export function getCommandRegistry(): CommandRegistry {
  return CommandRegistry.getInstance();
}

/**
 * Check if input is a slash command
 */
export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith("/");
}

/**
 * Parse a slash command into its parts
 */
export function parseSlashCommand(input: string): ParsedCommand {
  return CommandRegistry.getInstance().parse(input);
}
