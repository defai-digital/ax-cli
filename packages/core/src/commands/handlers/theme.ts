/**
 * Theme Command Handler
 *
 * Handler for /theme - color theme management
 *
 * @packageDocumentation
 */

import type { CommandDefinition, CommandContext, CommandResult } from "../types.js";

/**
 * /theme command handler
 *
 * Usage:
 *   /theme         - Show current theme and list available
 *   /theme list    - Same as above
 *   /theme <name>  - Switch to the specified theme
 */
export async function handleTheme(
  args: string,
  ctx: CommandContext
): Promise<CommandResult> {
  try {
    // Convert to lowercase for case-insensitive theme name matching
    const arg = args.trim().toLowerCase();

    // Dynamic imports for theme utilities
    const { getAllThemes, isValidTheme } = await import("../../ui/themes/index.js");
    const { clearThemeCache } = await import("../../ui/utils/colors.js");
    const allThemes = getAllThemes();

    if (!arg || arg === "list") {
      // Show current theme and list available themes
      const uiConfig = ctx.settings.getUIConfig();
      const currentTheme = uiConfig?.theme || "default";

      let content = "🎨 **Color Themes**\n\n";
      content += `**Current theme:** ${currentTheme}\n\n`;
      content += "**Available themes:**\n";

      for (const theme of allThemes) {
        const isCurrent = theme.name === currentTheme ? " ✓" : "";
        content += `   • \`${theme.name}\` - ${theme.description}${isCurrent}\n`;
      }
      content += "\n**Usage:** `/theme <name>` to switch themes";

      return {
        handled: true,
        entries: [
          {
            type: "assistant",
            content,
            timestamp: new Date(),
          },
        ],
        clearInput: true,
      };
    }

    // Set a specific theme
    if (isValidTheme(arg)) {
      ctx.settings.updateUIConfig({ theme: arg });
      clearThemeCache(); // Clear cached theme colors

      const selectedTheme = allThemes.find((t) => t.name === arg);

      return {
        handled: true,
        entries: [
          {
            type: "assistant",
            content: `✅ Theme changed to **${selectedTheme?.displayName}** (${selectedTheme?.description}).\n\n💡 The new theme will be applied to UI elements.`,
            timestamp: new Date(),
          },
        ],
        clearInput: true,
      };
    }

    // Invalid theme name
    return {
      handled: true,
      entries: [
        {
          type: "assistant",
          content: `❌ Unknown theme: \`${arg}\`\n\nAvailable themes: ${allThemes.map((t) => t.name).join(", ")}`,
          timestamp: new Date(),
        },
      ],
      clearInput: true,
    };
  } catch (error) {
    return {
      handled: true,
      error: `Failed to process theme command: ${error instanceof Error ? error.message : "Unknown error"}`,
      clearInput: true,
    };
  }
}

/**
 * Theme command definition for registration
 */
export const themeCommands: CommandDefinition[] = [
  {
    name: "theme",
    description: "Switch color theme (default, dark, light, dracula, monokai)",
    category: "settings",
    handler: handleTheme,
    examples: ["/theme", "/theme dark", "/theme list"],
  },
];
