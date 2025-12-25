/**
 * Command Utility Functions
 *
 * Pure functions for command parsing, validation, and message formatting.
 * Extracted from use-input-handler.ts for better testability.
 *
 * @packageDocumentation
 */

/**
 * List of built-in slash commands
 */
export const BUILT_IN_COMMANDS = [
  '/continue',
  '/retry',
  '/clear',
  '/init',
  '/help',
  '/shortcuts',
  '/usage',
  '/doctor',
  '/mcp',
  '/exit',
  '/tasks',
  '/task',
  '/kill',
  '/rewind',
  '/checkpoints',
  '/checkpoint-clean',
  '/plans',
  '/plan',
  '/phases',
  '/pause',
  '/resume',
  '/skip',
  '/abandon',
  '/commit-and-push',
  '/memory',
  '/theme',
] as const;

export type BuiltInCommand = typeof BUILT_IN_COMMANDS[number];

/**
 * Direct shell commands that are executed immediately
 */
export const DIRECT_SHELL_COMMANDS = ['ls', 'pwd', 'cd', 'cat', 'mkdir', 'touch'] as const;

export type DirectShellCommand = typeof DIRECT_SHELL_COMMANDS[number];

/**
 * Check if input is a slash command (starts with /)
 *
 * @param input - User input string
 * @returns True if input starts with /
 */
export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

/**
 * Check if input is a direct shell command
 *
 * @param input - User input string
 * @returns True if input starts with a direct shell command
 */
export function isDirectShellCommand(input: string): boolean {
  const trimmed = input.trim();
  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase();
  return DIRECT_SHELL_COMMANDS.includes(firstWord as DirectShellCommand);
}

/**
 * Parse a slash command into command name and arguments
 *
 * @param input - User input string (should start with /)
 * @returns Parsed command with name and arguments
 *
 * @example
 * ```ts
 * parseSlashCommand('/task 123'); // { command: '/task', args: ['123'] }
 * parseSlashCommand('/clear');    // { command: '/clear', args: [] }
 * ```
 */
export function parseSlashCommand(input: string): { command: string; args: string[] } {
  const trimmed = input.trim();
  const parts = trimmed.split(/\s+/);
  const command = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);
  return { command, args };
}

/**
 * Parse a direct shell command into command name and arguments
 *
 * @param input - User input string
 * @returns Parsed command with name and arguments
 *
 * @example
 * ```ts
 * parseDirectCommand('cd /path/to/dir'); // { command: 'cd', args: '/path/to/dir' }
 * parseDirectCommand('ls -la');          // { command: 'ls', args: '-la' }
 * ```
 */
export function parseDirectCommand(input: string): { command: string; args: string } {
  const trimmed = input.trim();
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) {
    return { command: trimmed.toLowerCase(), args: '' };
  }
  return {
    command: trimmed.slice(0, spaceIndex).toLowerCase(),
    args: trimmed.slice(spaceIndex + 1).trim(),
  };
}

/**
 * Check if input should run in background (ends with &)
 *
 * @param input - User input string
 * @returns True if command should run in background
 */
export function isBackgroundCommand(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.endsWith('&') && !trimmed.endsWith('&&');
}

/**
 * Remove background operator from command
 *
 * @param input - User input string
 * @returns Command without trailing &
 */
export function stripBackgroundOperator(input: string): string {
  const trimmed = input.trim();
  if (isBackgroundCommand(trimmed)) {
    return trimmed.slice(0, -1).trim();
  }
  return trimmed;
}

/**
 * Check if input is an MCP resource reference (@mcp:...)
 *
 * @param input - User input string
 * @returns True if input contains MCP resource reference
 */
export function hasMCPResourceReference(input: string): boolean {
  return /@mcp:[^\s]*/.test(input);
}

/**
 * Extract MCP resource query from input
 *
 * @param input - User input string
 * @returns MCP query or null if not found
 *
 * @example
 * ```ts
 * extractMCPQuery('@mcp:server_'); // 'server_'
 * extractMCPQuery('hello @mcp:'); // ''
 * extractMCPQuery('no mcp');      // null
 * ```
 */
export function extractMCPQuery(input: string): string | null {
  const match = input.match(/@mcp:([^\s]*)$/);
  return match ? match[1] : null;
}

/**
 * Format a timeout error message with helpful guidance
 *
 * @param originalError - Original error message
 * @returns Enhanced error message with tips
 */
export function formatTimeoutError(originalError: string): string {
  let message = `Error: ${originalError}`;

  if (originalError.includes('timeout')) {
    message += `\n\n💡 Tip: For very long conversations, try:\n`;
    message += `   • Use /clear to start fresh and ask a more focused question\n`;
    message += `   • Break down your request into smaller parts\n`;
    message += `   • Use --continue flag to start a new session with history`;
  }

  return message;
}

/**
 * Command suggestion item
 */
export interface CommandSuggestion {
  command: string;
  displayCommand?: string;  // Display text with aliases (falls back to command if not set)
  description: string;
}

/**
 * Filter command suggestions based on input
 *
 * @param input - User input string (without leading /)
 * @param suggestions - List of available command suggestions
 * @returns Filtered suggestions matching input
 */
export function filterCommands(
  input: string,
  suggestions: CommandSuggestion[]
): CommandSuggestion[] {
  const search = input.toLowerCase();
  return suggestions.filter(
    (s) =>
      s.command.toLowerCase().includes(search) ||
      s.description.toLowerCase().includes(search)
  );
}

/**
 * Validate command input is not empty
 *
 * @param input - User input string
 * @returns True if input has content after trimming
 */
export function isValidInput(input: string): boolean {
  return input.trim().length > 0;
}

/**
 * Check if input is an exit command
 *
 * @param input - User input string
 * @returns True if input is an exit command
 */
export function isExitCommand(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  return trimmed === '/exit' || trimmed === 'exit' || trimmed === 'quit';
}

/**
 * Parse /task or /kill command to extract task ID
 *
 * @param input - User input string
 * @returns Task ID or null if not found
 *
 * @example
 * ```ts
 * parseTaskId('/task abc123');  // 'abc123'
 * parseTaskId('/kill 456');     // '456'
 * parseTaskId('/tasks');        // null
 * ```
 */
export function parseTaskId(input: string): string | null {
  const { args } = parseSlashCommand(input);
  return args[0] || null;
}

/**
 * Format usage statistics for display
 *
 * @param stats - Usage statistics object
 * @param providerName - Name of the AI provider
 * @param modelName - Name of the model
 * @returns Formatted usage string
 */
export function formatUsageStats(
  stats: {
    totalPromptTokens: number;
    totalCompletionTokens: number;
    sessionCount: number;
  },
  providerName: string,
  modelName: string
): string {
  const totalTokens = stats.totalPromptTokens + stats.totalCompletionTokens;

  return `📊 API Usage Statistics

Provider: ${providerName}
Model: ${modelName}

Token Usage:
  Prompt tokens:     ${stats.totalPromptTokens.toLocaleString()}
  Completion tokens: ${stats.totalCompletionTokens.toLocaleString()}
  Total tokens:      ${totalTokens.toLocaleString()}

Sessions: ${stats.sessionCount}`;
}

/**
 * Verbosity levels for output display
 */
export type VerbosityLevel = 0 | 1 | 2;

/**
 * Get next verbosity level (cycles 0 -> 1 -> 2 -> 0)
 *
 * @param current - Current verbosity level
 * @returns Next verbosity level
 */
export function cycleVerbosity(current: VerbosityLevel): VerbosityLevel {
  return ((current + 1) % 3) as VerbosityLevel;
}

/**
 * Get description for verbosity level
 *
 * @param level - Verbosity level
 * @returns Human-readable description
 */
export function getVerbosityDescription(level: VerbosityLevel): string {
  switch (level) {
    case 0:
      return 'concise';
    case 1:
      return 'normal';
    case 2:
      return 'verbose';
  }
}
