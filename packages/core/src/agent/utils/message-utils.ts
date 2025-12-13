/**
 * Message Utility Functions
 *
 * Pure functions for message processing, formatting, and content extraction.
 * Extracted from llm-agent.ts for better testability.
 *
 * @packageDocumentation
 */

import type { ToolResult } from "../../types/index.js";

/**
 * Content part types for multimodal messages
 */
export interface TextContentPart {
  type: 'text';
  text: string;
}

export interface ImageContentPart {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export type MessageContentPart = TextContentPart | ImageContentPart;

/**
 * Extract display-friendly content from multimodal message parts.
 * Converts image parts to placeholder text for display purposes.
 *
 * @param content - Array of message content parts
 * @returns Combined string with text content and image placeholders
 *
 * @example
 * ```ts
 * const parts = [
 *   { type: 'text', text: 'Hello' },
 *   { type: 'image_url', image_url: { url: 'data:...' } }
 * ];
 * extractDisplayContent(parts); // "Hello\n[Image attached]"
 * ```
 */
export function extractDisplayContent(content: MessageContentPart[]): string {
  const parts: string[] = [];

  for (const part of content) {
    if (part.type === 'text') {
      parts.push(part.text);
    } else if (part.type === 'image_url') {
      parts.push('[Image attached]');
    }
  }

  return parts.join('\n');
}

/**
 * Extract text content from a message that may be string or multimodal.
 * Used by planning and complexity detection systems.
 *
 * @param message - String or array of content parts
 * @returns Extracted text content
 *
 * @example
 * ```ts
 * getTextContentFromMessage("Hello"); // "Hello"
 * getTextContentFromMessage([{ type: 'text', text: 'Hello' }]); // "Hello"
 * ```
 */
export function getTextContentFromMessage(message: string | MessageContentPart[]): string {
  if (typeof message === 'string') {
    return message;
  }

  // Extract only text parts from multimodal content
  return message
    .filter((part): part is TextContentPart => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

/**
 * Check if a message array contains multimodal (image) content.
 *
 * @param messages - Array of LLM messages to check
 * @returns True if any message contains image content
 */
export function hasMultimodalContent(
  messages: Array<{ content: string | MessageContentPart[] }>
): boolean {
  return messages.some(msg => {
    if (typeof msg.content !== 'string' && Array.isArray(msg.content)) {
      return msg.content.some(part =>
        typeof part === 'object' && 'type' in part && part.type === 'image_url'
      );
    }
    return false;
  });
}

/**
 * Format tool result content for display or message.
 * Centralizes the common pattern of formatting success/error output.
 *
 * @param result - Tool execution result
 * @param defaultSuccess - Default message if success but no output (default: "Success")
 * @param defaultError - Default message if error but no error message (default: "Error occurred")
 * @returns Formatted content string
 *
 * @example
 * ```ts
 * formatToolResultContent({ success: true, output: "Done" }); // "Done"
 * formatToolResultContent({ success: false, error: "Failed" }); // "Failed"
 * formatToolResultContent({ success: true }); // "Success"
 * ```
 */
export function formatToolResultContent(
  result: ToolResult,
  defaultSuccess = "Success",
  defaultError = "Error occurred"
): string {
  return result.success
    ? result.output || defaultSuccess
    : result.error || defaultError;
}

/**
 * Loop detection result interface (used for warning messages)
 */
export interface LoopDetectionResult {
  isLoop: boolean;
  count: number;
  threshold: number;
  reason?: string;
  suggestion?: string;
}

/**
 * Generate a helpful warning message when a loop is detected.
 * Messages are designed to be professional and actionable,
 * avoiding alarming language like "infinite loop" which can confuse users.
 *
 * @param loopResult - Optional loop detection result with context
 * @returns Formatted warning message
 *
 * @example
 * ```ts
 * getLoopWarningMessage(); // Default warning without context
 * getLoopWarningMessage({ suggestion: "Try different file" }); // Context-aware warning
 * ```
 */
export function getLoopWarningMessage(loopResult?: LoopDetectionResult): string {
  const base = "\n\nI noticed I'm repeating similar operations without making progress.";

  if (loopResult) {
    const parts = [base];

    if (loopResult.suggestion) {
      parts.push(` ${loopResult.suggestion}`);
    }

    parts.push("\n\nLet me try a different approach or provide what I've accomplished so far.");

    return parts.join('');
  }

  return base + " Let me step back and try a different approach.";
}

/**
 * Create a cancellation message chunk.
 *
 * @returns Cancellation content string
 */
export function getCancellationMessage(): string {
  return "\n\n[Operation cancelled by user]";
}

/**
 * Format a context warning message.
 *
 * @param warning - Warning text to format
 * @returns Formatted warning with newlines
 */
export function formatContextWarning(warning: string): string {
  return `\n${warning}\n\n`;
}

/**
 * Parse JSON tool arguments safely.
 * Returns empty object on parse error.
 *
 * @param argsString - JSON string of tool arguments
 * @returns Parsed arguments object or empty object
 */
export function parseToolArguments(argsString: string | undefined): Record<string, unknown> {
  try {
    return JSON.parse(argsString || '{}');
  } catch {
    return {};
  }
}
