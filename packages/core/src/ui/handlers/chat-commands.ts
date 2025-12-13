/**
 * Chat Command Handlers
 *
 * Handles /continue, /retry, and /clear commands.
 *
 * @packageDocumentation
 */

import type { CommandContext, CommandResult } from "./types.js";
import { createAssistantMessage, createUserMessage, addChatEntry } from "./types.js";
import { clearToolGroupCache } from "../utils/tool-grouper.js";

/**
 * Handle /clear command
 */
export async function handleClearCommand(
  context: CommandContext,
  onChatCleared?: () => void
): Promise<CommandResult> {
  // Clear chat history while preserving agent state
  context.setChatHistory([]);

  // Clear the tool group cache to prevent stale data
  clearToolGroupCache();

  // Show confirmation message
  addChatEntry(
    context.setChatHistory,
    createAssistantMessage("Chat history cleared. Agent memory and context preserved.")
  );

  context.clearInput();

  // Notify parent for toast/flash feedback
  onChatCleared?.();

  return { handled: true };
}

/**
 * Get the last user message from chat history
 */
export function getLastUserMessage(chatHistory: import("../../agent/llm-agent.js").ChatEntry[]): string | null {
  // Search backwards for last user message
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const entry = chatHistory[i];
    if (entry.type === "user") {
      return entry.content;
    }
  }
  return null;
}

/**
 * Handle /retry command - returns the message to retry (for external processing)
 * The actual streaming is handled by the caller
 */
export function getRetryMessage(
  context: CommandContext
): { message: string | null; error?: string } {
  const lastUserMessage = getLastUserMessage(context.chatHistory);

  if (!lastUserMessage) {
    return { message: null, error: "No previous message to retry." };
  }

  return { message: lastUserMessage };
}

/**
 * Add retry user entry to chat history
 */
export function addRetryUserEntry(
  context: CommandContext,
  originalMessage: string
): void {
  addChatEntry(
    context.setChatHistory,
    createUserMessage(`/retry: ${originalMessage}`)
  );
}

/**
 * Add continue user entry to chat history
 */
export function addContinueUserEntry(context: CommandContext): void {
  addChatEntry(
    context.setChatHistory,
    createUserMessage("/continue")
  );
}

/**
 * Get the continue prompt
 */
export function getContinuePrompt(): string {
  return "Continue from where you left off.";
}
