/**
 * Session Command Handlers
 *
 * Handlers for /exit, /clear
 *
 * NOTE: /continue and /retry are STREAMING commands that require direct
 * access to the agent's processUserMessageStream() and real-time state updates.
 * They remain in use-input-handler.ts for now as they don't fit the CommandResult
 * pattern cleanly. When we add a StreamingCommandHandler pattern, they can be migrated.
 *
 * @packageDocumentation
 */

import type { CommandDefinition, CommandContext, CommandResult } from "../types.js";
import { ConfirmationService } from "../../utils/confirmation-service.js";
import { getHistoryManager } from "../../utils/history-manager.js";
import { clearToolGroupCache } from "../../ui/utils/tool-grouper.js";

/**
 * /exit command handler
 */
export function handleExit(_args: string, _ctx: CommandContext): CommandResult {
  return {
    handled: true,
    clearInput: true,
    asyncAction: async () => {
      process.exit(0);
    },
  };
}

/**
 * /clear command handler
 */
export function handleClear(_args: string, ctx: CommandContext): CommandResult {
  // Clear chat history
  ctx.setChatHistory(() => []);

  // Clear saved history from disk
  const historyManager = getHistoryManager();
  historyManager.clearHistory();

  // Clear tool grouper cache to prevent memory leaks
  clearToolGroupCache();

  // Reset processing states
  ctx.setIsProcessing(false);
  ctx.setIsStreaming(false);
  ctx.setTokenCount?.(0);
  ctx.setProcessingTime?.(0);
  if (ctx.processingStartTime) {
    ctx.processingStartTime.current = 0;
  }

  // Reset confirmation service session flags
  const confirmationService = ConfirmationService.getInstance();
  confirmationService.resetSession();

  // Notify parent for toast feedback
  ctx.onChatCleared?.();

  // Reset input history
  ctx.resetHistory();

  return {
    handled: true,
    clearInput: true,
  };
}

/**
 * Session command definitions for registration
 */
export const sessionCommands: CommandDefinition[] = [
  {
    name: "exit",
    aliases: ["quit", "q"],
    description: "Exit the application",
    category: "session",
    handler: handleExit,
  },
  {
    name: "clear",
    description: "Clear chat history",
    category: "session",
    handler: handleClear,
  },
];
