/**
 * Doctor Command Handler
 *
 * Handler for /doctor - runs AX CLI diagnostics
 *
 * @packageDocumentation
 */

import type { CommandDefinition, CommandContext, CommandResult } from "../types.js";
import { TIMEOUT_CONFIG } from "../../constants.js";
import { extractErrorMessage } from "../../utils/error-handler.js";

/**
 * /doctor command handler - runs diagnostic checks
 *
 * This command shows an initial "running" message, then executes
 * the ax-cli doctor command asynchronously and updates the chat
 * with the results.
 */
export function handleDoctor(_args: string, ctx: CommandContext): CommandResult {
  const initialContent = "🏥 **Running AX CLI Diagnostics...**\n\n";

  return {
    handled: true,
    entries: [
      {
        type: "assistant",
        content: initialContent,
        timestamp: new Date(),
      },
    ],
    clearInput: true,
    setProcessing: true,
    asyncAction: async () => {
      try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        // Use the provider-specific CLI name (e.g., 'ax-glm doctor' or 'ax-grok doctor')
        const cliName = ctx.provider.branding.cliName;

        // Disable chalk colors (FORCE_COLOR=0) since output goes to markdown
        const { stdout, stderr } = await execAsync(`${cliName} doctor`, {
          encoding: "utf-8",
          timeout: TIMEOUT_CONFIG.BASH_DEFAULT,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          env: { ...process.env, FORCE_COLOR: "0" },
        });

        // Convert plain text output to markdown with proper emoji indicators
        const output = (stdout || stderr)
          .replace(/✓/g, "✅")
          .replace(/✗/g, "❌")
          .replace(/⚠/g, "⚠️");

        ctx.setChatHistory((prev) => [
          ...prev,
          {
            type: "assistant",
            content: output,
            timestamp: new Date(),
          },
        ]);
      } catch (error: unknown) {
        const errorMessage = extractErrorMessage(error);
        ctx.setChatHistory((prev) => [
          ...prev,
          {
            type: "assistant",
            content: `❌ **Doctor diagnostics failed:**\n\n\`\`\`\n${errorMessage}\n\`\`\``,
            timestamp: new Date(),
          },
        ]);
      } finally {
        ctx.setIsProcessing(false);
      }
    },
  };
}

/**
 * Doctor command definition for registration
 */
export const doctorCommands: CommandDefinition[] = [
  {
    name: "doctor",
    description: "Run health check diagnostics",
    category: "info",
    handler: handleDoctor,
  },
];
