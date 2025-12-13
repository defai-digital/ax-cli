/**
 * Help Command Handlers
 *
 * Handles /help, /shortcuts, and /usage commands.
 *
 * @packageDocumentation
 */

import type { CommandContext, CommandResult } from "./types.js";
import { createAssistantMessage, addChatEntry } from "./types.js";
import { getKeyboardShortcutGuideText } from "../components/keyboard-hints.js";
import { getUsageTracker } from "../../utils/usage-tracker.js";
import { getActiveProvider } from "../../provider/config.js";

/**
 * Handle /help command
 */
export async function handleHelpCommand(
  context: CommandContext
): Promise<CommandResult> {
  const provider = getActiveProvider();
  const providerName = provider?.displayName || "LLM";

  const helpText = `# Available Commands

## Chat Commands
- \`/continue\` - Continue incomplete response
- \`/retry\` - Re-send the last message
- \`/clear\` - Clear chat history

## Project Commands
- \`/init\` - Initialize project with smart analysis
- \`/commit-and-push\` - AI-generated commit and push

## Memory Commands
- \`/memory\` - Show project memory status
- \`/memory warmup\` - Generate project memory
- \`/memory refresh\` - Update project memory

## Task Planning
- \`/plans\` - List all task plans
- \`/plan\` - Show current plan details
- \`/phases\` - Show phases of current plan
- \`/pause\` - Pause current plan execution
- \`/resume\` - Resume paused plan
- \`/skip\` - Skip current phase
- \`/abandon\` - Abandon current plan

## Background Tasks
- \`/tasks\` - List background tasks
- \`/task <id>\` - View task output
- \`/kill <id>\` - Kill a background task

## Checkpoints
- \`/rewind\` - Rewind to previous checkpoint
- \`/checkpoints\` - List checkpoint statistics
- \`/checkpoint-clean\` - Clean old checkpoints

## System
- \`/help\` - Show this help message
- \`/shortcuts\` - Show keyboard shortcuts
- \`/usage\` - Show API usage statistics
- \`/doctor\` - Run health check diagnostics
- \`/mcp\` - Open MCP server dashboard
- \`/permissions\` - View/manage tool permissions
- \`/theme\` - Switch color theme
- \`/commands\` - List custom commands
- \`/exit\` - Exit the application

## Keyboard Shortcuts
Press \`Ctrl+/\` for quick keyboard shortcut reference.

---
*Powered by ${providerName}*`;

  addChatEntry(context.setChatHistory, createAssistantMessage(helpText));
  context.clearInput();

  return { handled: true };
}

/**
 * Handle /shortcuts command
 */
export async function handleShortcutsCommand(
  context: CommandContext,
  onKeyboardHelp?: () => void
): Promise<CommandResult> {
  // If callback provided, trigger the UI overlay
  if (onKeyboardHelp) {
    onKeyboardHelp();
    context.clearInput();
    return { handled: true };
  }

  // Otherwise show inline help
  const shortcutsText = getKeyboardShortcutGuideText();
  addChatEntry(context.setChatHistory, createAssistantMessage(shortcutsText));
  context.clearInput();

  return { handled: true };
}

/**
 * Handle /usage command
 */
export async function handleUsageCommand(
  context: CommandContext
): Promise<CommandResult> {
  const usageTracker = getUsageTracker();
  const stats = usageTracker.getSessionStats();
  const provider = getActiveProvider();
  const providerName = provider?.displayName || "Provider";

  const formatNumber = (n: number) => n.toLocaleString();

  const usageText = `# API Usage Statistics

## Session Usage
- **Total Requests**: ${formatNumber(stats.totalRequests)}
- **Prompt Tokens**: ${formatNumber(stats.totalPromptTokens)}
- **Completion Tokens**: ${formatNumber(stats.totalCompletionTokens)}
- **Total Tokens**: ${formatNumber(stats.totalTokens)}
- **Reasoning Tokens**: ${formatNumber(stats.totalReasoningTokens)}
- **Cached Tokens**: ${formatNumber(stats.totalCachedTokens)}

## Usage by Model
${Array.from(stats.byModel.entries()).map(([model, usage]) =>
  `- **${model}**: ${formatNumber(usage.totalTokens)} tokens (${usage.requests} requests)`
).join('\n') || '- No model usage recorded'}

---
*${providerName} API usage tracking*`;

  addChatEntry(context.setChatHistory, createAssistantMessage(usageText));
  context.clearInput();

  return { handled: true };
}
