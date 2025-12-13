/**
 * Memory Command Handlers
 *
 * Handles /memory, /memory warmup, and /memory refresh commands.
 *
 * Note: This module provides the command handler structure.
 * The actual implementation uses the memory module APIs directly.
 *
 * @packageDocumentation
 */

import type { CommandContext, CommandResult } from "./types.js";
import { createAssistantMessage, addChatEntry } from "./types.js";
import { parseMemoryCommand } from "../utils/command-parsers.js";

/**
 * Handle /memory command (status, warmup, refresh)
 *
 * Note: Full implementation is in use-input-handler.ts due to
 * complex async dependencies with the memory module.
 * This handler provides the command parsing structure.
 */
export async function handleMemoryCommand(
  context: CommandContext,
  _callbacks?: {
    onMemoryWarmed?: (tokens: number) => void;
    onMemoryRefreshed?: () => void;
  }
): Promise<CommandResult> {
  const parsed = parseMemoryCommand(context.input);

  // For now, show a message indicating the command was received
  // Full implementation is handled by the main input handler
  const message = parsed.action === "status"
    ? "Use `/memory` in the chat interface to see memory status."
    : parsed.action === "warmup"
    ? "Use `/memory warmup` in the chat interface to generate project memory."
    : "Use `/memory refresh` in the chat interface to update project memory.";

  addChatEntry(context.setChatHistory, createAssistantMessage(message));
  context.clearInput();

  return { handled: true };
}

/**
 * Memory action types for external handlers
 */
export type { MemoryAction } from "../utils/command-parsers.js";
