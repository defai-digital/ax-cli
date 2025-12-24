/**
 * Memory Command Handlers
 *
 * Handlers for /memory commands - project memory management for z.ai caching
 *
 * @packageDocumentation
 */

import type { CommandDefinition, CommandContext, CommandResult } from "../types.js";
import { getContextStore } from "../../memory/context-store.js";
import { getStatsCollector } from "../../memory/stats-collector.js";
import { ContextGenerator } from "../../memory/context-generator.js";
import { extractErrorMessage } from "../../utils/error-handler.js";

/**
 * /memory status - show project memory status
 */
function handleMemoryStatus(_ctx: CommandContext): CommandResult {
  const store = getContextStore();
  const metadata = store.getMetadata();

  let content = "🧠 **Project Memory Status**\n\n";

  if (!metadata.exists) {
    content += "❌ No project memory found.\n\n";
    content += "Run `/memory warmup` to generate project memory for z.ai caching.\n";
  } else {
    content += `✅ Memory initialized\n\n`;
    content += `**Token Estimate:** ${metadata.tokenEstimate?.toLocaleString() || "N/A"} tokens\n`;
    content += `**Last Updated:** ${metadata.updatedAt ? new Date(metadata.updatedAt).toLocaleString() : "N/A"}\n`;
    content += `**Usage Count:** ${metadata.usageCount || 0}\n`;

    // Try to get section breakdown
    const loadResult = store.load();
    if (loadResult.success) {
      const sections = loadResult.data.context.sections as Record<string, number>;
      content += `\n**📊 Token Distribution:**\n`;
      const total = Object.values(sections).reduce((a: number, b: number) => a + b, 0);
      for (const [name, tokens] of Object.entries(sections)) {
        const pct = total > 0 ? Math.round(((tokens as number) / total) * 100) : 0;
        const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
        content += `   ${bar}  ${name.charAt(0).toUpperCase() + name.slice(1)}  (${pct}%)\n`;
      }
    }

    // Show cache stats if available
    const statsCollector = getStatsCollector();
    const formattedStats = statsCollector.getFormattedStats();
    if (formattedStats && formattedStats.usageCount > 0) {
      content += `\n**💾 Cache Statistics:**\n`;
      content += `   • Usage Count: ${formattedStats.usageCount}\n`;
      content += `   • Tokens Saved: ${formattedStats.tokensSaved.toLocaleString()}\n`;
      content += `   • Cache Rate: ${formattedStats.cacheRate}%\n`;
      content += `   • Est. Savings: $${formattedStats.estimatedSavings.toFixed(4)}\n`;
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
 * /memory warmup - generate project memory
 */
function handleMemoryWarmup(ctx: CommandContext): CommandResult {
  const initialEntry = {
    type: "assistant" as const,
    content: "🔄 Generating project memory...",
    timestamp: new Date(),
  };

  return {
    handled: true,
    entries: [initialEntry],
    clearInput: true,
    setProcessing: true,
    asyncAction: async () => {
      try {
        const generator = new ContextGenerator();
        const result = await generator.generate();

        if (result.success && result.memory) {
          const store = getContextStore();
          const memory = result.memory;
          const saveResult = store.save(memory);

          if (saveResult.success) {
            const sections = memory.context.sections;
            const tokenEstimate = memory.context.token_estimate;

            let resultContent = `✅ Project memory generated (${tokenEstimate.toLocaleString()} tokens)\n\n`;
            resultContent += `**📊 Context breakdown:**\n`;

            for (const [name, tokens] of Object.entries(sections)) {
              if (tokens !== undefined) {
                const tokenCount = tokens as number;
                const pct = Math.round((tokenCount / tokenEstimate) * 100);
                resultContent += `   ${name.charAt(0).toUpperCase() + name.slice(1)}: ${tokenCount.toLocaleString()} tokens (${pct}%)\n`;
              }
            }
            resultContent += `\n💾 Saved to ${ctx.configPaths.DIR_NAME}/memory.json`;

            ctx.setChatHistory((prev) => [
              ...prev,
              {
                type: "assistant",
                content: resultContent,
                timestamp: new Date(),
              },
            ]);

            // Trigger toast notification
            ctx.onMemoryWarmed?.(tokenEstimate);
          } else {
            throw new Error(saveResult.error);
          }
        } else {
          throw new Error(result.error);
        }
      } catch (error: unknown) {
        ctx.setChatHistory((prev) => [
          ...prev,
          {
            type: "assistant",
            content: `❌ Failed to generate memory: ${extractErrorMessage(error)}`,
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
 * /memory refresh - update project memory with new changes
 */
function handleMemoryRefresh(ctx: CommandContext): CommandResult {
  const initialEntry = {
    type: "assistant" as const,
    content: "🔄 Refreshing project memory...",
    timestamp: new Date(),
  };

  return {
    handled: true,
    entries: [initialEntry],
    clearInput: true,
    setProcessing: true,
    asyncAction: async () => {
      try {
        const store = getContextStore();
        const existing = store.load();
        const generator = new ContextGenerator();

        // Generate fresh memory
        const result = await generator.generate();

        if (result.success && result.memory) {
          const memory = result.memory;
          const saveResult = store.save(memory);

          if (saveResult.success) {
            const sections = memory.context.sections;
            const tokenEstimate = memory.context.token_estimate;
            const previousTokens = existing.success
              ? existing.data.context.token_estimate
              : 0;
            const tokenDiff = tokenEstimate - previousTokens;
            const diffStr =
              tokenDiff > 0
                ? `+${tokenDiff.toLocaleString()}`
                : tokenDiff.toLocaleString();

            let resultContent = `✅ Project memory refreshed (${tokenEstimate.toLocaleString()} tokens, ${diffStr})\n\n`;
            resultContent += `**📊 Context breakdown:**\n`;

            for (const [name, tokens] of Object.entries(sections)) {
              if (tokens !== undefined) {
                const tokenCount = tokens as number;
                const pct = Math.round((tokenCount / tokenEstimate) * 100);
                resultContent += `   ${name.charAt(0).toUpperCase() + name.slice(1)}: ${tokenCount.toLocaleString()} tokens (${pct}%)\n`;
              }
            }
            resultContent += `\n💾 Updated ${ctx.configPaths.DIR_NAME}/memory.json`;

            ctx.setChatHistory((prev) => [
              ...prev,
              {
                type: "assistant",
                content: resultContent,
                timestamp: new Date(),
              },
            ]);

            // Trigger toast notification
            ctx.onMemoryRefreshed?.();
          } else {
            throw new Error(saveResult.error);
          }
        } else {
          throw new Error(result.error);
        }
      } catch (error: unknown) {
        ctx.setChatHistory((prev) => [
          ...prev,
          {
            type: "assistant",
            content: `❌ Failed to refresh memory: ${extractErrorMessage(error)}`,
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
 * /memory command router
 */
export function handleMemory(args: string, ctx: CommandContext): CommandResult {
  const trimmedArgs = args.trim().toLowerCase();

  if (!trimmedArgs || trimmedArgs === "status") {
    return handleMemoryStatus(ctx);
  }

  if (trimmedArgs === "warmup") {
    return handleMemoryWarmup(ctx);
  }

  if (trimmedArgs === "refresh") {
    return handleMemoryRefresh(ctx);
  }

  // Show help for unknown subcommand
  return {
    handled: true,
    entries: [
      {
        type: "assistant",
        content: `**Memory Commands:**

- \`/memory\` - Show project memory status
- \`/memory warmup\` - Generate project memory context
- \`/memory refresh\` - Update memory after changes

Memory enables z.ai caching for faster, cheaper API calls.`,
        timestamp: new Date(),
      },
    ],
    clearInput: true,
  };
}

/**
 * Memory command definitions for registration
 */
export const memoryCommands: CommandDefinition[] = [
  {
    name: "memory",
    description: "Show project memory status",
    category: "memory",
    handler: handleMemory,
    examples: ["/memory", "/memory warmup", "/memory refresh"],
  },
];
