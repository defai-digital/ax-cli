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
  return `AX CLI Help:

Built-in Commands:
  /continue   - Continue incomplete response from where it left off
  /clear      - Clear chat history
  /init       - Initialize project with smart analysis
  /help       - Show this help
  /shortcuts  - Show keyboard shortcuts guide
  /usage      - Show API usage statistics
  /doctor     - Run health check diagnostics
  /mcp        - Open MCP server dashboard
  /exit       - Exit application
  exit, quit  - Exit application

Background Task Commands:
  /tasks             - List all background tasks
  /task <id>         - View output of a background task
  /kill <id>         - Kill a running background task

  Tip: Append ' &' to any bash command to run it in background
       Example: npm run dev &

Checkpoint Commands:
  /rewind            - Rewind to a previous checkpoint (interactive)
  /checkpoints       - Show checkpoint statistics
  /checkpoint-clean  - Clean old checkpoints (compress and prune)

Plan Commands (Multi-Phase Task Planning):
  /plans             - List all task plans
  /plan [id]         - Show current or specific plan details
  /phases            - Show phases of current plan
  /pause             - Pause current plan execution
  /resume [id]       - Resume current or specific plan
  /skip              - Skip current phase
  /abandon           - Abandon current plan

Git Commands:
  /commit-and-push - AI-generated commit + push to remote

Memory Commands (z.ai GLM caching):
  /memory          - Show project memory status
  /memory warmup   - Generate project memory context
  /memory refresh  - Update memory after changes

UI Commands:
  /theme           - Show current theme and list available themes
  /theme <name>    - Switch color theme (default, dark, light, dracula, monokai)

Model Commands:
  /model           - Show current model and list available models
  /model <name>    - Switch to a model (session only)
  /model save      - Save current model to config (persistent)
  /model reset     - Reset to provider default model

Enhanced Input Features:
  ↑/↓ Arrow   - Navigate command history
  Ctrl+C      - Clear input (press twice to exit)
  Ctrl+X      - Clear entire input line
  Esc×2       - Clear input (press Escape twice quickly)
  Ctrl+←/→    - Move by word
  Ctrl+A/E    - Move to line start/end
  Ctrl+W      - Delete word before cursor
  Ctrl+K      - Delete to end of line
  Ctrl+U      - Delete to start of line
  Ctrl+O      - Toggle verbose mode (show full output, default: concise)
  Ctrl+B      - Toggle background mode (run all commands in background)
  Ctrl+P      - Expand/collapse pasted text at cursor
  Ctrl+Y      - Copy last assistant response to clipboard
  Shift+Tab   - Toggle auto-edit mode (bypass confirmations)
  1-4 keys    - Quick select in confirmation dialogs

Paste Handling:
  When you paste 5+ lines, it's automatically collapsed to a preview.
  Position cursor on collapsed text and press Ctrl+P to expand/collapse.
  Full content is always sent to AI (display-only feature).

Direct Commands (executed immediately):
  ls [path]   - List directory contents
  pwd         - Show current directory
  cd <path>   - Change directory
  cat <file>  - View file contents
  mkdir <dir> - Create directory
  touch <file>- Create empty file

Model Configuration:
  Edit ~/${configDirName}/config.json to configure default model and settings

For complex operations, just describe what you want in natural language.
Examples:
  "edit package.json and add a new script"
  "create a new React component called Header"
  "show me all TypeScript files in this project"`;
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
    aliases: ["h", "?"],
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
