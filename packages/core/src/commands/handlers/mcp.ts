/**
 * MCP Command Handlers
 *
 * Handlers for /mcp commands - MCP server management
 *
 * @packageDocumentation
 */

import type { CommandDefinition, CommandContext, CommandResult } from "../types.js";

/**
 * /mcp command handler - toggle MCP dashboard
 */
export function handleMcp(_args: string, ctx: CommandContext): CommandResult {
  // Toggle the MCP dashboard
  if (ctx.onMcpDashboardToggle) {
    ctx.onMcpDashboardToggle();
  }

  return {
    handled: true,
    clearInput: true,
    // No entries - the dashboard toggle is the action
  };
}

/**
 * MCP command definitions for registration
 */
export const mcpCommands: CommandDefinition[] = [
  {
    name: "mcp",
    description: "Open MCP server dashboard",
    category: "mcp",
    handler: handleMcp,
  },
];
