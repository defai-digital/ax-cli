/**
 * MCP Prompts Module
 *
 * Handles discovering and executing MCP server prompts.
 * Prompts are exposed as slash commands with the format:
 * /mcp__<servername>__<promptname>
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Prompt, GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

// ============================================================================
// Shared MCP Identifier Parsing (used by prompts.ts and collapsible-tool-result.tsx)
// ============================================================================

/**
 * Parse MCP identifier with double-underscore separator
 * Handles formats like "mcp__server__name" or "/mcp__server__name"
 *
 * @param identifier - The MCP identifier string
 * @param prefix - Optional prefix to strip (e.g., "/mcp__" or "mcp__")
 * @returns Parsed server and name, or null if invalid
 */
export function parseMCPIdentifier(
  identifier: string,
  prefix: string
): { serverName: string; name: string } | null {
  if (!identifier.startsWith(prefix)) {
    return null;
  }

  const withoutPrefix = identifier.slice(prefix.length);
  const parts = withoutPrefix.split("__");

  if (parts.length < 2) {
    return null;
  }

  const serverName = parts[0];
  const name = parts.slice(1).join("__");

  // Validate non-empty parts
  if (!serverName || !name) {
    return null;
  }

  return { serverName, name };
}

/**
 * MCP Prompt with server context
 */
export interface MCPPrompt {
  /** Server this prompt belongs to */
  serverName: string;
  /** Prompt name from server */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Required arguments for templating */
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * List prompts from an MCP server
 */
export async function listServerPrompts(
  client: Client,
  serverName: string
): Promise<MCPPrompt[]> {
  try {
    const result = await client.listPrompts();
    return result.prompts.map((prompt: Prompt) => ({
      serverName,
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
    }));
  } catch {
    // Server may not support prompts - this is not an error
    return [];
  }
}

/**
 * Get a specific prompt from an MCP server
 */
export async function getServerPrompt(
  client: Client,
  _serverName: string,
  promptName: string,
  args?: Record<string, string>
): Promise<GetPromptResult | null> {
  try {
    const result = await client.getPrompt({
      name: promptName,
      arguments: args,
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Convert MCP prompt to slash command name
 * Format: /mcp__servername__promptname
 */
export function promptToSlashCommand(prompt: MCPPrompt): string {
  return `/mcp__${prompt.serverName}__${prompt.name}`;
}

/**
 * Parse slash command to extract server and prompt names
 * Uses shared parseMCPIdentifier for consistency
 */
export function parsePromptCommand(
  command: string
): { serverName: string; promptName: string } | null {
  const parsed = parseMCPIdentifier(command, "/mcp__");
  if (!parsed) return null;
  return { serverName: parsed.serverName, promptName: parsed.name };
}

/**
 * Format prompt result for chat display
 * BUG FIX: Handle array content which is valid per MCP protocol
 */
export function formatPromptResult(result: GetPromptResult): string {
  const messages = result.messages || [];
  if (messages.length === 0) {
    return result.description || "No prompt content available";
  }

  // Helper to extract text from a single content item
  const extractText = (content: unknown): string => {
    if (typeof content === "string") {
      return content;
    }
    if (content && typeof content === "object" && "text" in content) {
      const textValue = (content as { text: unknown }).text;
      // BUG FIX: Ensure text is actually a string before returning
      return typeof textValue === "string" ? textValue : JSON.stringify(content);
    }
    return JSON.stringify(content);
  };

  // Combine all message contents
  return messages
    .map((msg) => {
      // Handle array content (valid per MCP protocol)
      if (Array.isArray(msg.content)) {
        return msg.content.map(extractText).join("\n");
      }
      return extractText(msg.content);
    })
    .join("\n\n");
}

/**
 * Generate command description for auto-complete
 */
export function getPromptDescription(prompt: MCPPrompt): string {
  let desc = prompt.description || `MCP prompt from ${prompt.serverName}`;
  if (prompt.arguments && prompt.arguments.length > 0) {
    const argNames = prompt.arguments.map((a) => (a.required ? a.name : `[${a.name}]`));
    desc += ` (${argNames.join(", ")})`;
  }
  return desc;
}
