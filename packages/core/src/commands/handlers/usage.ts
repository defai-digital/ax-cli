/**
 * Usage Command Handler
 *
 * Handler for /usage - API usage statistics and cost estimates
 *
 * @packageDocumentation
 */

import type { CommandDefinition, CommandContext, CommandResult } from "../types.js";
import { getUsageTracker } from "../../utils/usage-tracker.js";
import { getGrokPricing, getGrokPricingName, calculateGrokCost } from "../../utils/grok-pricing.js";

/**
 * Session statistics interface
 */
interface SessionStats {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalReasoningTokens: number;
  byModel: Map<string, { totalTokens: number; requests: number }>;
}

/**
 * Format Grok-specific usage information
 */
function formatGrokUsageInfo(stats: SessionStats, currentModel: string): string {
  let content = `\n**🔑 xAI Account Usage & Limits:**\n`;
  content += `  ⚠️  API does not provide programmatic access to usage data\n`;
  content += `\n  **Check your account:**\n`;
  content += `  • Usage Explorer: https://console.x.ai\n`;
  content += `  • Billing & Team: https://console.x.ai/team\n`;
  content += `  • API Keys: https://console.x.ai/api-keys\n`;

  content += `\n**ℹ️  Notes:**\n`;
  content += `  • Usage is tracked in real-time on the xAI console\n`;
  content += `  • Cached input tokens: 75% discount\n`;

  // Use shared pricing utilities
  const pricing = getGrokPricing(currentModel);
  const pricingName = getGrokPricingName(currentModel);

  content += `\n**💰 ${pricingName} Pricing:**\n`;
  content += `  • Input: $${pricing.input.toFixed(2)} per 1M tokens\n`;
  content += `  • Output: $${pricing.output.toFixed(2)} per 1M tokens\n`;
  content += `  • Cached: $${pricing.cached.toFixed(2)} per 1M tokens\n`;

  if (stats.totalRequests > 0) {
    const cost = calculateGrokCost(currentModel, stats.totalPromptTokens, stats.totalCompletionTokens);
    content += `\n**💵 Estimated Session Cost:**\n`;
    content += `  • Input: $${cost.input.toFixed(6)} (${stats.totalPromptTokens.toLocaleString()} tokens)\n`;
    content += `  • Output: $${cost.output.toFixed(6)} (${stats.totalCompletionTokens.toLocaleString()} tokens)\n`;
    content += `  • **Total: ~$${cost.total.toFixed(6)}**\n`;
  }

  return content;
}

/**
 * Format GLM-specific usage information
 */
function formatGLMUsageInfo(stats: SessionStats): string {
  let content = `\n**🔑 Z.AI Account Usage & Limits:**\n`;
  content += `  ⚠️  API does not provide programmatic access to usage data\n`;
  content += `\n  **Check your account:**\n`;
  content += `  • Billing & Usage: https://z.ai/manage-apikey/billing\n`;
  content += `  • Rate Limits: https://z.ai/manage-apikey/rate-limits\n`;
  content += `  • API Keys: https://z.ai/manage-apikey/apikey-list\n`;

  content += `\n**ℹ️  Notes:**\n`;
  content += `  • Billing reflects previous day (n-1) consumption\n`;
  content += `  • Current day usage may not be immediately visible\n`;
  content += `  • Cached content: 1/5 of original price\n`;

  content += `\n**💰 GLM Pricing:**\n`;
  content += `  • Input: $2.00 per 1M tokens\n`;
  content += `  • Output: $10.00 per 1M tokens\n`;
  content += `  • Cached: $0.50 per 1M tokens\n`;

  if (stats.totalRequests > 0) {
    // Calculate estimated cost for this session
    const inputCost = (stats.totalPromptTokens / 1000000) * 2.0;
    const outputCost = (stats.totalCompletionTokens / 1000000) * 10.0;
    const totalCost = inputCost + outputCost;
    content += `\n**💵 Estimated Session Cost:**\n`;
    content += `  • Input: $${inputCost.toFixed(6)} (${stats.totalPromptTokens.toLocaleString()} tokens)\n`;
    content += `  • Output: $${outputCost.toFixed(6)} (${stats.totalCompletionTokens.toLocaleString()} tokens)\n`;
    content += `  • **Total: ~$${totalCost.toFixed(6)}**\n`;
  }

  return content;
}

/**
 * /usage command handler
 */
export function handleUsage(_args: string, ctx: CommandContext): CommandResult {
  const tracker = getUsageTracker();
  const stats = tracker.getSessionStats();
  const isGrok = ctx.provider.name === "grok";
  const currentModel = ctx.settings.getCurrentModel() || ctx.provider.defaultModel;

  const providerName = isGrok ? "xAI (Grok)" : "Z.AI (GLM)";
  let content = `📊 **API Usage & Limits (${providerName})**\n\n`;

  // Session statistics
  content += "**📱 Current Session:**\n";
  content += `  • Model: ${currentModel}\n`;

  if (stats.totalRequests === 0) {
    content += "  No API requests made yet. Ask me something to start tracking!\n";
  } else {
    content += `  • Requests: ${stats.totalRequests.toLocaleString()}\n`;
    content += `  • Prompt Tokens: ${stats.totalPromptTokens.toLocaleString()}\n`;
    content += `  • Completion Tokens: ${stats.totalCompletionTokens.toLocaleString()}\n`;
    content += `  • Total Tokens: ${stats.totalTokens.toLocaleString()}\n`;

    if (stats.totalReasoningTokens > 0) {
      content += `  • Reasoning Tokens: ${stats.totalReasoningTokens.toLocaleString()}\n`;
    }

    if (stats.byModel.size > 0) {
      content += `\n  **Models Used:**\n`;
      for (const [model, modelStats] of stats.byModel.entries()) {
        content += `    - ${model}: ${modelStats.totalTokens.toLocaleString()} tokens (${modelStats.requests} requests)\n`;
      }
    }
  }

  // Provider-specific information
  if (isGrok) {
    content += formatGrokUsageInfo(stats, currentModel);
  } else {
    content += formatGLMUsageInfo(stats);
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
 * Usage command definition for registration
 */
export const usageCommands: CommandDefinition[] = [
  {
    name: "usage",
    description: "Show API usage statistics",
    category: "info",
    handler: handleUsage,
  },
];
