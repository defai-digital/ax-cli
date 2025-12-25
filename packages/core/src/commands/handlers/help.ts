/**
 * Help Command Handlers
 *
 * Handlers for /help, /shortcuts, /terminal-setup, /commands
 *
 * @packageDocumentation
 */

import type { CommandDefinition, CommandContext, CommandResult } from "../types.js";
import { getKeyboardShortcutGuideText } from "../../ui/components/keyboard-hints.js";
import { getCustomCommandsManager } from "../custom-commands.js";

/**
 * Generate help content with dynamic config directory
 */
function generateHelpContent(configDirName: string): string {
  return `**AX CLI Help**

**Core Commands:**
  /help, /?     Show this help
  /clear        Clear chat history
  /exit, /q     Exit application
  /shortcuts    Keyboard shortcuts guide

**Session:**
  /continue     Continue incomplete response
  /model, /m    View/switch AI models
  /lang, /l     Change display language
  /usage        API usage statistics

**Project:**
  /init         Initialize project with analysis
  /memory       Project memory status
  /doctor       Health check diagnostics

**Background Tasks:**
  /tasks        List background tasks
  /task <id>    View task output
  /kill <id>    Kill running task
  Tip: Append ' &' to run commands in background

**Checkpoints:**
  /rewind       Rewind to previous checkpoint
  /checkpoints  Show checkpoint stats

**Plans (Multi-Phase Tasks):**
  /plans        List all plans
  /plan [id]    Show plan details
  /pause        Pause execution
  /resume       Resume plan

**Settings:**
  /theme        Switch color theme
  /permissions  Manage tool permissions
  /mcp          MCP server dashboard

**Quick Keys:**
  ↑/↓         Command history
  Ctrl+O      Toggle verbose mode
  Ctrl+B      Toggle background mode
  Shift+Tab   Toggle auto-edit mode
  /shortcuts  Full keyboard guide

**Configuration:**
  ~/${configDirName}/config.json

Type naturally to ask questions or describe tasks.`;
}

/**
 * /help command handler
 */
export function handleHelp(_args: string, ctx: CommandContext): CommandResult {
  return {
    handled: true,
    entries: [
      {
        type: "assistant",
        content: generateHelpContent(ctx.configPaths.DIR_NAME),
        timestamp: new Date(),
      },
    ],
    clearInput: true,
  };
}

/**
 * /shortcuts command handler
 */
export function handleShortcuts(_args: string, _ctx: CommandContext): CommandResult {
  return {
    handled: true,
    entries: [
      {
        type: "assistant",
        content: getKeyboardShortcutGuideText(),
        timestamp: new Date(),
      },
    ],
    clearInput: true,
  };
}

/**
 * /terminal-setup command handler
 */
export function handleTerminalSetup(_args: string, _ctx: CommandContext): CommandResult {
  const content = `🔧 **Terminal Setup for Shift+Enter**

Most terminals don't natively support Shift+Enter as a separate key from Enter.
Here's how to configure popular terminals:

**iTerm2 (macOS):**
1. Go to Preferences → Profiles → Keys → Key Mappings
2. Click "+" to add a new mapping
3. Set "Keyboard Shortcut" to Shift+Return
4. Set "Action" to "Send Escape Sequence"
5. Enter \`[13;2u\` as the escape sequence
6. Click "OK"

**Kitty:**
Add to kitty.conf:
\`\`\`
map shift+enter send_text all \\x1b[13;2u
\`\`\`

**Alacritty:**
Add to alacritty.toml:
\`\`\`toml
[[keyboard.bindings]]
key = "Return"
mods = "Shift"
chars = "\\u001b[13;2u"
\`\`\`

**WezTerm:**
Add to wezterm.lua:
\`\`\`lua
return {
  keys = {
    { key = "Enter", mods = "SHIFT", action = wezterm.action.SendString "\\x1b[13;2u" },
  },
}
\`\`\`

**Alternative (No Terminal Config Needed):**
Use \`\\\` at the end of a line to continue on the next line:
\`\`\`
This is a long message that \\
continues on the next line
\`\`\`

Or use Ctrl+J to insert a newline (works in most terminals).`;

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

/**
 * /commands command handler - list custom commands
 */
export function handleCommands(_args: string, ctx: CommandContext): CommandResult {
  const customCommandsManager = getCustomCommandsManager();
  const commands = customCommandsManager.getAllCommands();

  let content = "**Custom Commands:**\n\n";

  if (commands.length === 0) {
    content += "No custom commands found.\n\n";
    content += "Create commands by adding markdown files to:\n";
    content += `  • \`${ctx.configPaths.DIR_NAME}/commands/\` (project-level)\n`;
    content += `  • \`~/${ctx.configPaths.DIR_NAME}/commands/\` (user-level)\n`;
  } else {
    const projectCmds = commands.filter((c) => c.scope === "project");
    const userCmds = commands.filter((c) => c.scope === "user");

    if (projectCmds.length > 0) {
      content += "**Project Commands:**\n";
      for (const cmd of projectCmds) {
        content += `  /${cmd.name} - ${cmd.description}\n`;
      }
      content += "\n";
    }

    if (userCmds.length > 0) {
      content += "**User Commands:**\n";
      for (const cmd of userCmds) {
        content += `  /${cmd.name} - ${cmd.description}\n`;
      }
    }
  }

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

/**
 * Help command definitions for registration
 */
export const helpCommands: CommandDefinition[] = [
  {
    name: "help",
    aliases: ["?"],
    description: "Show help information",
    category: "info",
    handler: handleHelp,
  },
  {
    name: "shortcuts",
    description: "Show keyboard shortcuts guide",
    category: "info",
    handler: handleShortcuts,
  },
  {
    name: "terminal-setup",
    description: "Configure Shift+Enter for multi-line input",
    category: "info",
    handler: handleTerminalSetup,
  },
  {
    name: "commands",
    description: "List all custom commands",
    category: "info",
    handler: handleCommands,
  },
];
