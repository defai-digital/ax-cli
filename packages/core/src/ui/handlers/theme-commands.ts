/**
 * Theme Command Handlers
 *
 * Handles /theme command for switching color themes.
 *
 * @packageDocumentation
 */

import type { CommandContext, CommandResult } from "./types.js";
import { createAssistantMessage, addChatEntry } from "./types.js";
import { parseThemeCommand } from "../utils/command-parsers.js";

/**
 * Available color themes
 */
export const AVAILABLE_THEMES = [
  { name: "default", description: "System default theme" },
  { name: "dark", description: "Dark theme with high contrast" },
  { name: "light", description: "Light theme for bright environments" },
  { name: "dracula", description: "Purple-tinted dark theme" },
  { name: "monokai", description: "Warm dark theme inspired by Sublime Text" },
] as const;

/**
 * Get list of available theme names
 */
export function getAvailableThemeNames(): string[] {
  return AVAILABLE_THEMES.map((t) => t.name);
}

/**
 * Check if a theme name is valid
 */
export function isValidTheme(themeName: string): boolean {
  return getAvailableThemeNames().includes(themeName);
}

/**
 * Handle /theme command
 *
 * Note: Full implementation integrates with SettingsManager.
 * This handler provides the parsing and validation structure.
 */
export async function handleThemeCommand(
  context: CommandContext
): Promise<CommandResult> {
  const parsed = parseThemeCommand(context.input);

  switch (parsed.action) {
    case "list": {
      const listText = `# Available Themes

${AVAILABLE_THEMES.map((t) => `- **${t.name}**: ${t.description}`).join("\n")}

---
Use \`/theme <name>\` to switch themes.`;
      addChatEntry(context.setChatHistory, createAssistantMessage(listText));
      break;
    }

    case "set": {
      if (!parsed.themeName) {
        addChatEntry(
          context.setChatHistory,
          createAssistantMessage("Please specify a theme name. Use `/theme list` to see available themes.")
        );
      } else if (!isValidTheme(parsed.themeName)) {
        addChatEntry(
          context.setChatHistory,
          createAssistantMessage(
            `Unknown theme: "${parsed.themeName}". Available themes: ${getAvailableThemeNames().join(", ")}`
          )
        );
      } else {
        // Theme setting is handled by the main input handler with settings manager
        addChatEntry(
          context.setChatHistory,
          createAssistantMessage(`Theme "${parsed.themeName}" selected. Apply with settings manager.`)
        );
      }
      break;
    }

    case "show":
    default: {
      const showText = `# Theme Configuration

Use these commands to manage themes:
- \`/theme list\` - Show all available themes
- \`/theme <name>\` - Switch to a specific theme

Available themes: ${getAvailableThemeNames().join(", ")}`;
      addChatEntry(context.setChatHistory, createAssistantMessage(showText));
      break;
    }
  }

  context.clearInput();
  return { handled: true };
}
