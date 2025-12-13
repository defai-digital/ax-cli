/**
 * Command Parsing Utilities
 *
 * Pure functions for parsing slash command arguments.
 * These parsers extract structured data from command strings.
 *
 * @packageDocumentation
 */

/**
 * Memory command actions
 */
export type MemoryAction = "status" | "warmup" | "refresh";

/**
 * Parsed memory command
 */
export interface ParsedMemoryCommand {
  action: MemoryAction;
  args: string[];
}

/**
 * Parse a /memory command
 * @example
 * parseMemoryCommand("/memory") // { action: "status", args: [] }
 * parseMemoryCommand("/memory warmup") // { action: "warmup", args: [] }
 * parseMemoryCommand("/memory status") // { action: "status", args: [] }
 */
export function parseMemoryCommand(input: string): ParsedMemoryCommand {
  const trimmed = input.trim();

  if (trimmed === "/memory" || trimmed === "/memory status") {
    return { action: "status", args: [] };
  }

  if (trimmed === "/memory warmup") {
    return { action: "warmup", args: [] };
  }

  if (trimmed === "/memory refresh") {
    return { action: "refresh", args: [] };
  }

  // Default to status if unknown subcommand
  return { action: "status", args: [] };
}

/**
 * Permission command actions
 */
export type PermissionAction = "show" | "set" | "reset" | "help";

/**
 * Parsed permission command
 */
export interface ParsedPermissionCommand {
  action: PermissionAction;
  tool?: string;
  tier?: string;
}

/**
 * Valid permission tiers
 */
export const VALID_PERMISSION_TIERS = ["auto_approve", "notify", "confirm", "block"] as const;
export type PermissionTier = typeof VALID_PERMISSION_TIERS[number];

/**
 * Parse a /permissions command
 * @example
 * parsePermissionsCommand("/permissions") // { action: "show" }
 * parsePermissionsCommand("/permissions set bash confirm") // { action: "set", tool: "bash", tier: "confirm" }
 * parsePermissionsCommand("/permissions reset") // { action: "reset" }
 */
export function parsePermissionsCommand(input: string): ParsedPermissionCommand {
  const trimmed = input.trim();
  const args = trimmed.replace("/permissions", "").trim();

  if (!args || args === "show" || args === "list") {
    return { action: "show" };
  }

  if (args === "reset") {
    return { action: "reset" };
  }

  if (args.startsWith("set ")) {
    const setArgs = args.replace("set ", "").trim().split(/\s+/);
    if (setArgs.length >= 2) {
      return {
        action: "set",
        tool: setArgs[0],
        tier: setArgs[1],
      };
    }
  }

  return { action: "help" };
}

/**
 * Validate if a tier is valid
 */
export function isValidPermissionTier(tier: string): tier is PermissionTier {
  return VALID_PERMISSION_TIERS.includes(tier as PermissionTier);
}

/**
 * Parsed MCP prompt command
 */
export interface ParsedMcpPromptCommand {
  serverName: string;
  promptName: string;
  argsString: string;
  isValid: boolean;
}

/**
 * Parse an MCP prompt command (format: /mcp__servername__promptname [args])
 * @example
 * parseMcpPromptCommand("/mcp__server__prompt arg1 arg2")
 * // { serverName: "server", promptName: "prompt", argsString: "arg1 arg2", isValid: true }
 */
export function parseMcpPromptCommand(input: string): ParsedMcpPromptCommand {
  const trimmed = input.trim();
  const parts = trimmed.split(" ");
  const commandPart = parts[0];
  const argsString = parts.slice(1).join(" ");

  // Extract server and prompt name from command
  // Format: /mcp__servername__promptname
  const match = commandPart.match(/^\/mcp__([^_]+)__(.+)$/);

  if (!match) {
    return {
      serverName: "",
      promptName: "",
      argsString: "",
      isValid: false,
    };
  }

  return {
    serverName: match[1],
    promptName: match[2],
    argsString,
    isValid: true,
  };
}

/**
 * Parsed task command
 */
export interface ParsedTaskCommand {
  taskId: string;
  isValid: boolean;
}

/**
 * Parse a /task command
 * @example
 * parseTaskCommand("/task abc123") // { taskId: "abc123", isValid: true }
 */
export function parseTaskCommand(input: string): ParsedTaskCommand {
  const trimmed = input.trim();
  const taskId = trimmed.replace("/task", "").trim();

  return {
    taskId,
    isValid: taskId.length > 0,
  };
}

/**
 * Parsed kill command
 */
export interface ParsedKillCommand {
  taskId: string;
  isValid: boolean;
}

/**
 * Parse a /kill command
 * @example
 * parseKillCommand("/kill abc123") // { taskId: "abc123", isValid: true }
 */
export function parseKillCommand(input: string): ParsedKillCommand {
  const trimmed = input.trim();
  const taskId = trimmed.replace("/kill", "").trim();

  return {
    taskId,
    isValid: taskId.length > 0,
  };
}

/**
 * Parsed theme command
 */
export interface ParsedThemeCommand {
  action: "show" | "set" | "list";
  themeName?: string;
}

/**
 * Parse a /theme command
 * @example
 * parseThemeCommand("/theme") // { action: "show" }
 * parseThemeCommand("/theme dark") // { action: "set", themeName: "dark" }
 * parseThemeCommand("/theme list") // { action: "list" }
 */
export function parseThemeCommand(input: string): ParsedThemeCommand {
  const trimmed = input.trim();
  const args = trimmed.replace("/theme", "").trim();

  if (!args) {
    return { action: "show" };
  }

  if (args === "list") {
    return { action: "list" };
  }

  return { action: "set", themeName: args };
}

/**
 * Check if input is a direct command (starts with /)
 */
export function isDirectCommand(input: string): boolean {
  return input.trim().startsWith("/");
}

/**
 * Check if input is a bash passthrough command
 * Common commands that can be executed directly
 */
export function isBashPassthroughCommand(input: string): boolean {
  const trimmed = input.trim();
  const firstWord = trimmed.split(/\s+/)[0].toLowerCase();

  const passthroughCommands = [
    "git",
    "npm",
    "pnpm",
    "yarn",
    "node",
    "python",
    "python3",
    "pip",
    "pip3",
    "cargo",
    "go",
    "make",
    "docker",
    "kubectl",
    "ls",
    "cd",
    "pwd",
    "cat",
    "grep",
    "find",
    "sed",
    "awk",
    "curl",
    "wget",
  ];

  return passthroughCommands.includes(firstWord);
}

/**
 * Extract command name from slash command
 * @example
 * extractCommandName("/help") // "help"
 * extractCommandName("/memory warmup") // "memory"
 */
export function extractCommandName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return "";
  }

  // Remove leading slash and get first word
  const withoutSlash = trimmed.slice(1);
  const firstSpace = withoutSlash.indexOf(" ");

  if (firstSpace === -1) {
    return withoutSlash;
  }

  return withoutSlash.slice(0, firstSpace);
}

/**
 * Extract arguments after command name
 * @example
 * extractCommandArgs("/permissions set bash confirm") // "set bash confirm"
 */
export function extractCommandArgs(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return trimmed;
  }

  const withoutSlash = trimmed.slice(1);
  const firstSpace = withoutSlash.indexOf(" ");

  if (firstSpace === -1) {
    return "";
  }

  return withoutSlash.slice(firstSpace + 1);
}
