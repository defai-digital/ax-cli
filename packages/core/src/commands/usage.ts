import { Command } from 'commander';
import chalk from 'chalk';
import * as prompts from '@clack/prompts';
import { getSettingsManager } from '../utils/settings-manager.js';
import { ConsoleMessenger } from '../utils/console-messenger.js';
import { getUsageTracker } from '../utils/usage-tracker.js';

/**
 * Create the usage command
 *
 * Phase 1: Support z.ai provider with session-based usage tracking
 * Phase 2: Add support for other providers (OpenAI, Anthropic, etc.)
 */
export function createUsageCommand(): Command {
  const usageCommand = new Command('usage');
  usageCommand.description('View API usage statistics');

  // Show usage command
  usageCommand
    .command('show')
    .description('Show current session usage statistics')
    .option('-d, --detailed', 'Show detailed breakdown by model')
    .option('-j, --json', 'Output in JSON format')
    .action((options) => {
      try {
        const tracker = getUsageTracker();
        const manager = getSettingsManager();
        const baseURL = manager.getBaseURL() || 'unknown';
        const currentModel = manager.getCurrentModel() || 'unknown';
        const provider = detectProvider(baseURL);

        const stats = tracker.getSessionStats();

        // JSON mode - plain output for scripting
        if (options.json) {
          console.log(JSON.stringify({
            provider,
            model: currentModel,
            session: stats,
            supportsHistoricalData: provider === 'z.ai' || provider === 'xai' ? false : 'unknown'
          }, null, 2));
          return;
        }

        // Interactive mode with @clack/prompts
        prompts.intro(chalk.cyan('API Usage Statistics'));

        // Provider info
        prompts.log.message(`Provider: ${getProviderDisplay(provider, baseURL)}`);
        prompts.log.message(`Model: ${chalk.cyan(currentModel)}`);

        if (stats.totalRequests === 0) {
          prompts.log.warn('No API requests made in this session.');
          prompts.outro(chalk.dim('Start a conversation to see usage statistics'));
          return;
        }

        // Session statistics
        const sessionLines = [
          `Total Requests:      ${chalk.cyan(stats.totalRequests.toLocaleString())}`,
          `Prompt Tokens:       ${chalk.green(stats.totalPromptTokens.toLocaleString())}`,
          `Completion Tokens:   ${chalk.green(stats.totalCompletionTokens.toLocaleString())}`,
          `Total Tokens:        ${chalk.bold.green(stats.totalTokens.toLocaleString())}`,
        ];

        if (stats.totalReasoningTokens > 0) {
          sessionLines.push(`Reasoning Tokens:    ${chalk.magenta(stats.totalReasoningTokens.toLocaleString())}`);
        }

        // Calculate costs based on provider
        const cacheSavings = tracker.getCacheSavings();
        let estimatedTotalCost = 0;

        if (provider === 'xai') {
          // xAI/Grok pricing
          const pricing = getGrokPricing(currentModel);
          const uncachedPromptTokens = stats.totalPromptTokens - cacheSavings.cachedTokens;
          const cachedCost = cacheSavings.cachedTokens * pricing.cached;
          const uncachedCost = uncachedPromptTokens * pricing.input;
          const outputCost = stats.totalCompletionTokens * pricing.output;
          estimatedTotalCost = cachedCost + uncachedCost + outputCost;
        } else if (provider === 'z.ai') {
          // GLM pricing
          const uncachedPromptTokens = stats.totalPromptTokens - cacheSavings.cachedTokens;
          const cachedCost = cacheSavings.cachedTokens * GLM_PRICING.cached;
          const uncachedCost = uncachedPromptTokens * GLM_PRICING.input;
          const outputCost = stats.totalCompletionTokens * GLM_PRICING.output;
          const reasoningCost = stats.totalReasoningTokens * GLM_PRICING.reasoning;
          estimatedTotalCost = cachedCost + uncachedCost + outputCost + reasoningCost;
        }

        if (estimatedTotalCost > 0) {
          sessionLines.push(`Est. Session Cost:   ${chalk.yellow('~$' + estimatedTotalCost.toFixed(4))}`);
        }

        prompts.note(sessionLines.join('\n'), 'Current Session');

        // Cache savings (if applicable)
        if (cacheSavings.cachedTokens > 0) {
          const cacheRate = stats.totalPromptTokens > 0
            ? ((cacheSavings.cachedTokens / stats.totalPromptTokens) * 100).toFixed(1)
            : '0.0';

          // Calculate savings based on provider
          let savingsAmount = cacheSavings.estimatedSavings;
          if (provider === 'xai') {
            const pricing = getGrokPricing(currentModel);
            savingsAmount = cacheSavings.cachedTokens * (pricing.input - pricing.cached);
          }

          const cacheLines = [
            `Cached Tokens:       ${chalk.cyan(cacheSavings.cachedTokens.toLocaleString())}`,
            `Estimated Savings:   ${chalk.green('$' + savingsAmount.toFixed(4))}`,
            `Cache Hit Rate:      ${chalk.yellow(cacheRate + '%')}`,
          ];

          const cacheTitle = provider === 'xai' ? '💰 Cache Savings (Grok)' : '💰 Cache Savings (GLM)';
          prompts.note(cacheLines.join('\n'), cacheTitle);
        }

        // Per-model breakdown if detailed
        if (options.detailed && stats.byModel.size > 0) {
          for (const [model, modelStats] of stats.byModel.entries()) {
            const modelLines = [
              `Requests:           ${modelStats.requests.toLocaleString()}`,
              `Prompt Tokens:      ${modelStats.promptTokens.toLocaleString()}`,
              `Completion Tokens:  ${modelStats.completionTokens.toLocaleString()}`,
              `Total Tokens:       ${modelStats.totalTokens.toLocaleString()}`,
            ];

            if (modelStats.reasoningTokens > 0) {
              modelLines.push(`Reasoning Tokens:   ${modelStats.reasoningTokens.toLocaleString()}`);
            }

            // Calculate per-model cost
            let modelCost = 0;
            if (provider === 'xai') {
              const pricing = getGrokPricing(model);
              modelCost = modelStats.promptTokens * pricing.input + modelStats.completionTokens * pricing.output;
            } else if (provider === 'z.ai') {
              modelCost = modelStats.promptTokens * GLM_PRICING.input +
                          modelStats.completionTokens * GLM_PRICING.output +
                          modelStats.reasoningTokens * GLM_PRICING.reasoning;
            }
            if (modelCost > 0) {
              modelLines.push(`Est. Cost:          ${chalk.yellow('~$' + modelCost.toFixed(4))}`);
            }

            prompts.note(modelLines.join('\n'), `Model: ${model}`);
          }
        }

        // Provider-specific tips
        if (provider === 'xai') {
          prompts.log.info('Historical usage: https://console.x.ai (Usage Explorer)');
          prompts.log.info('Billing info: https://console.x.ai/team (Manage Billing)');
          prompts.outro(chalk.dim('Session tracking only - check xAI console for historical data'));
        } else if (provider === 'z.ai') {
          prompts.log.info('Historical usage: https://z.ai/manage-apikey/billing');
          prompts.outro(chalk.dim('Billing reflects consumption from the previous day (n-1)'));
        } else {
          prompts.log.warn(`Provider "${provider}": Only session tracking available`);
          prompts.outro(chalk.dim('Check provider dashboard for historical data'));
        }

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        prompts.log.error(`Error: ${message}`);
        process.exit(1);
      }
    });

  // Reset usage command
  usageCommand
    .command('reset')
    .description('Reset current session usage statistics')
    .action(() => {
      try {
        const tracker = getUsageTracker();
        tracker.resetSession();
        console.log(chalk.green('✓ Session usage statistics reset'));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        ConsoleMessenger.error('usage_commands.error_resetting_usage', { error: message });
        process.exit(1);
      }
    });

  // Performance metrics command (Phase 3)
  usageCommand
    .command('perf')
    .description('Show performance metrics (response times, latency)')
    .option('-j, --json', 'Output in JSON format')
    .action((options) => {
      try {
        const tracker = getUsageTracker();
        const perf = tracker.getPerformanceMetrics();

        if (options.json) {
          console.log(JSON.stringify(perf, null, 2));
          return;
        }

        prompts.intro(chalk.cyan('⚡ Performance Metrics'));

        if (perf.totalCalls === 0) {
          prompts.log.warn('No API calls recorded in this session.');
          prompts.outro(chalk.dim('Start a conversation to see performance metrics'));
          return;
        }

        const perfLines = [
          `Total API Calls:     ${chalk.cyan(perf.totalCalls.toLocaleString())}`,
          ``,
          `${chalk.bold('Response Time (ms):')}`,
          `  Average:           ${chalk.green(perf.avgResponseTimeMs.toFixed(0))}`,
          `  Min:               ${chalk.green(perf.minResponseTimeMs.toFixed(0))}`,
          `  Max:               ${chalk.yellow(perf.maxResponseTimeMs.toFixed(0))}`,
          ``,
          `${chalk.bold('Percentiles:')}`,
          `  P50 (median):      ${chalk.green(perf.p50ResponseTimeMs.toFixed(0))}`,
          `  P95:               ${chalk.yellow(perf.p95ResponseTimeMs.toFixed(0))}`,
          `  P99:               ${chalk.red(perf.p99ResponseTimeMs.toFixed(0))}`,
        ];

        prompts.note(perfLines.join('\n'), 'API Latency');
        prompts.outro(chalk.dim('Lower response times = faster API responses'));

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        prompts.log.error(`Error: ${message}`);
        process.exit(1);
      }
    });

  // Tool usage command (Phase 3)
  usageCommand
    .command('tools')
    .description('Show tool usage statistics')
    .option('-l, --limit <number>', 'Limit number of tools shown', '10')
    .option('-j, --json', 'Output in JSON format')
    .action((options) => {
      try {
        const tracker = getUsageTracker();
        const limit = parseInt(options.limit, 10) || 10;
        const topTools = tracker.getTopTools(limit);

        if (options.json) {
          console.log(JSON.stringify(topTools, null, 2));
          return;
        }

        prompts.intro(chalk.cyan('🔧 Tool Usage Statistics'));

        if (topTools.length === 0) {
          prompts.log.warn('No tool calls recorded in this session.');
          prompts.outro(chalk.dim('Tools will be tracked as they are used'));
          return;
        }

        for (const tool of topTools) {
          const successRate = tool.calls > 0
            ? ((tool.successes / tool.calls) * 100).toFixed(1)
            : '0.0';
          const successColor = parseFloat(successRate) >= 90 ? chalk.green : chalk.yellow;

          const toolLines = [
            `Calls:              ${chalk.cyan(tool.calls.toLocaleString())}`,
            `Success Rate:       ${successColor(successRate + '%')}`,
            `Avg Exec Time:      ${chalk.dim(tool.avgExecutionTimeMs.toFixed(0) + 'ms')}`,
          ];

          prompts.note(toolLines.join('\n'), `🔧 ${tool.name}`);
        }

        prompts.outro(chalk.dim(`Showing top ${topTools.length} tools by usage`));

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        prompts.log.error(`Error: ${message}`);
        process.exit(1);
      }
    });

  // Server tools command (Phase 3 - Grok specific)
  usageCommand
    .command('server-tools')
    .description('Show Grok server tool metrics (xAI Agent Tools API)')
    .option('-j, --json', 'Output in JSON format')
    .action((options) => {
      try {
        const tracker = getUsageTracker();
        const serverTools = tracker.getServerToolMetrics();

        if (options.json) {
          console.log(JSON.stringify(serverTools, null, 2));
          return;
        }

        prompts.intro(chalk.cyan('🌐 Grok Server Tools (xAI Agent Tools API)'));

        const totalCalls = serverTools.webSearch.calls +
                          serverTools.xSearch.calls +
                          serverTools.codeExecution.calls;

        if (totalCalls === 0) {
          prompts.log.warn('No server tool calls recorded in this session.');
          prompts.log.info('Server tools are exclusive to Grok models:');
          prompts.log.message('  • web_search: Real-time web search');
          prompts.log.message('  • x_search: X (Twitter) posts search');
          prompts.log.message('  • code_execution: Python sandbox');
          prompts.outro(chalk.dim('Use ax-grok with --fast flag for best server tool performance'));
          return;
        }

        // Web Search
        if (serverTools.webSearch.calls > 0) {
          const wsLines = [
            `Calls:              ${chalk.cyan(serverTools.webSearch.calls.toLocaleString())}`,
            `Total Results:      ${chalk.green(serverTools.webSearch.totalResults.toLocaleString())}`,
            `Avg Results/Call:   ${chalk.dim(serverTools.webSearch.avgResultsPerCall.toFixed(1))}`,
          ];
          prompts.note(wsLines.join('\n'), '🔍 web_search');
        }

        // X Search
        if (serverTools.xSearch.calls > 0) {
          const xsLines = [
            `Calls:              ${chalk.cyan(serverTools.xSearch.calls.toLocaleString())}`,
            `Total Results:      ${chalk.green(serverTools.xSearch.totalResults.toLocaleString())}`,
            `Avg Results/Call:   ${chalk.dim(serverTools.xSearch.avgResultsPerCall.toFixed(1))}`,
            ``,
            `${chalk.bold('By Search Type:')}`,
            `  Keyword:          ${serverTools.xSearch.bySearchType.keyword}`,
            `  Semantic:         ${serverTools.xSearch.bySearchType.semantic}`,
          ];
          prompts.note(xsLines.join('\n'), '📱 x_search');
        }

        // Code Execution
        if (serverTools.codeExecution.calls > 0) {
          const successRate = serverTools.codeExecution.calls > 0
            ? ((serverTools.codeExecution.successes / serverTools.codeExecution.calls) * 100).toFixed(1)
            : '0.0';
          const ceLines = [
            `Calls:              ${chalk.cyan(serverTools.codeExecution.calls.toLocaleString())}`,
            `Success Rate:       ${chalk.green(successRate + '%')}`,
            `Total Exec Time:    ${chalk.dim(serverTools.codeExecution.totalExecutionTimeMs.toFixed(0) + 'ms')}`,
          ];
          prompts.note(ceLines.join('\n'), '💻 code_execution');
        }

        prompts.outro(chalk.dim('Server tools run on xAI infrastructure'));

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        prompts.log.error(`Error: ${message}`);
        process.exit(1);
      }
    });

  // Default action (show usage)
  usageCommand.action(() => {
    usageCommand.commands.find(cmd => cmd.name() === 'show')?.parseAsync(['node', 'ax', 'usage', 'show'], { from: 'user' });
  });

  return usageCommand;
}

/**
 * Detect provider from base URL using proper URL parsing
 * to prevent incomplete URL substring sanitization attacks
 */
function detectProvider(baseURL: string): string {
  try {
    const urlObj = new URL(baseURL);
    const hostname = urlObj.hostname.toLowerCase();

    // xAI/Grok detection (api.x.ai)
    // BUG FIX: Use exact match instead of includes() to prevent false positives
    if (hostname === 'api.x.ai' || hostname.endsWith('.x.ai')) {
      return 'xai';
    }

    // Z.AI/GLM detection
    if (hostname === 'z.ai' || hostname.endsWith('.z.ai')) {
      return 'z.ai';
    }

    if (hostname === 'api.openai.com' || hostname.endsWith('.openai.com')) {
      return 'openai';
    }

    if (hostname === 'api.anthropic.com' || hostname.endsWith('.anthropic.com')) {
      return 'anthropic';
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'local';
    }

    // Extract second-level domain as provider name
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts[parts.length - 2]; // Return second-level domain
    }
  } catch {
    // Ignore URL parsing errors
  }

  return 'unknown';
}

/**
 * Get display name for provider
 */
function getProviderDisplay(provider: string, baseURL: string): string {
  const providerMap: Record<string, string> = {
    'xai': 'xAI (Grok Models)',
    'z.ai': 'Z.AI (GLM Models)',
    'openai': 'OpenAI',
    'anthropic': 'Anthropic (Claude)',
    'local': `Local (${baseURL})`
  };

  return providerMap[provider] || `${provider} (${baseURL})`;
}

/**
 * Grok API pricing per token (as of Dec 2025)
 * Source: https://docs.x.ai/docs/models
 *
 * Grok 4.1 Models (Dec 2025):
 * - grok-4.1: $3.00/$15.00 per 1M tokens (input/output), 131K context
 * - grok-4.1-fast-reasoning: $0.20/$0.50 per 1M tokens, 2M context (best for agentic tasks)
 * - grok-4.1-fast-non-reasoning: $0.20/$0.50 per 1M tokens, 2M context
 * - grok-4.1-mini: $0.30/$0.50 per 1M tokens
 *
 * Legacy Models:
 * - grok-4: Same as grok-4.1
 * - grok-3/grok-2: Legacy pricing
 */
const GROK_PRICING = {
  // Grok 4.1 (default flagship model)
  'grok-4.1': {
    input: 3.0 / 1_000_000,      // $3.00 per 1M tokens
    output: 15.0 / 1_000_000,    // $15.00 per 1M tokens
    cached: 0.75 / 1_000_000,    // $0.75 per 1M tokens (75% discount)
  },
  // Grok 4.1 Fast Reasoning (best for agentic/coding tasks, 2M context!)
  'grok-4.1-fast-reasoning': {
    input: 0.20 / 1_000_000,     // $0.20 per 1M tokens
    output: 0.50 / 1_000_000,    // $0.50 per 1M tokens
    cached: 0.05 / 1_000_000,    // $0.05 per 1M tokens (75% discount)
  },
  // Grok 4.1 Fast Non-Reasoning (fastest, 2M context)
  'grok-4.1-fast-non-reasoning': {
    input: 0.20 / 1_000_000,     // $0.20 per 1M tokens
    output: 0.50 / 1_000_000,    // $0.50 per 1M tokens
    cached: 0.05 / 1_000_000,    // $0.05 per 1M tokens
  },
  // Grok 4.1 Mini (cost-effective variant)
  'grok-4.1-mini': {
    input: 0.30 / 1_000_000,     // $0.30 per 1M tokens
    output: 0.50 / 1_000_000,    // $0.50 per 1M tokens
    cached: 0.075 / 1_000_000,   // $0.075 per 1M tokens
  },
  // Grok 4 (alias to 4.1)
  'grok-4': {
    input: 3.0 / 1_000_000,      // $3.00 per 1M tokens
    output: 15.0 / 1_000_000,    // $15.00 per 1M tokens
    cached: 0.75 / 1_000_000,    // $0.75 per 1M tokens
  },
  // Legacy: Grok 3
  'grok-3': {
    input: 3.0 / 1_000_000,      // $3.00 per 1M tokens
    output: 15.0 / 1_000_000,    // $15.00 per 1M tokens
    cached: 0.75 / 1_000_000,    // $0.75 per 1M tokens
  },
  // Legacy: Grok 3 Mini
  'grok-3-mini': {
    input: 0.30 / 1_000_000,     // $0.30 per 1M tokens
    output: 0.50 / 1_000_000,    // $0.50 per 1M tokens
    cached: 0.075 / 1_000_000,
  },
  // Legacy: Grok 2
  'grok-2': {
    input: 2.0 / 1_000_000,      // $2.00 per 1M tokens
    output: 10.0 / 1_000_000,    // $10.00 per 1M tokens
    cached: 0.50 / 1_000_000,
  },
} as const;

/**
 * Get Grok pricing for a model
 */
function getGrokPricing(model: string): { input: number; output: number; cached: number } {
  const modelLower = model.toLowerCase();

  // Grok 4.1 Fast variants (best value for agentic tasks)
  if (modelLower.includes('grok-4.1-fast-reasoning') || modelLower.includes('grok-fast')) {
    return GROK_PRICING['grok-4.1-fast-reasoning'];
  }
  if (modelLower.includes('grok-4.1-fast-non-reasoning') || modelLower.includes('grok-fast-nr')) {
    return GROK_PRICING['grok-4.1-fast-non-reasoning'];
  }
  // Grok 4.1 Mini
  if (modelLower.includes('grok-4.1-mini') || modelLower.includes('grok-mini')) {
    return GROK_PRICING['grok-4.1-mini'];
  }
  // Grok 4.1 (flagship)
  if (modelLower.includes('grok-4.1') || modelLower.includes('grok-latest')) {
    return GROK_PRICING['grok-4.1'];
  }
  // Grok 4 (alias to 4.1)
  if (modelLower.includes('grok-4')) {
    return GROK_PRICING['grok-4'];
  }
  // Legacy model pricing (kept for backwards compatibility with old usage data)
  if (modelLower.includes('grok-3-mini')) {
    return GROK_PRICING['grok-3-mini'];
  }
  if (modelLower.includes('grok-3')) {
    return GROK_PRICING['grok-3'];
  }
  if (modelLower.includes('grok-2')) {
    return GROK_PRICING['grok-2'];
  }

  // Default to Grok 4.1 pricing (current default model)
  return GROK_PRICING['grok-4.1'];
}

/**
 * GLM API pricing per token
 * Source: https://z.ai
 */
const GLM_PRICING = {
  input: 2.0 / 1_000_000,        // $2.00 per 1M tokens (uncached)
  output: 10.0 / 1_000_000,      // $10.00 per 1M tokens
  cached: 0.50 / 1_000_000,      // $0.50 per 1M tokens (cached)
  reasoning: 2.0 / 1_000_000,    // $2.00 per 1M tokens (thinking)
};
