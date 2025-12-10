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
    if (hostname === 'api.x.ai' || hostname.endsWith('.x.ai') || hostname.includes('xai.')) {
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
 */
const GROK_PRICING = {
  // Grok 4 pricing
  'grok-4': {
    input: 3.0 / 1_000_000,      // $3.00 per 1M tokens
    output: 15.0 / 1_000_000,    // $15.00 per 1M tokens
    cached: 0.75 / 1_000_000,    // $0.75 per 1M tokens
  },
  // Grok 4.1 Fast pricing
  'grok-4.1-fast': {
    input: 0.20 / 1_000_000,     // $0.20 per 1M tokens
    output: 0.50 / 1_000_000,    // $0.50 per 1M tokens
    cached: 0.05 / 1_000_000,    // estimated
  },
  // Grok 3 pricing
  'grok-3': {
    input: 3.0 / 1_000_000,      // $3.00 per 1M tokens
    output: 15.0 / 1_000_000,    // $15.00 per 1M tokens
    cached: 0.75 / 1_000_000,    // $0.75 per 1M tokens
  },
  // Grok 3 Mini pricing
  'grok-3-mini': {
    input: 0.30 / 1_000_000,     // $0.30 per 1M tokens
    output: 0.50 / 1_000_000,    // $0.50 per 1M tokens
    cached: 0.075 / 1_000_000,   // estimated
  },
  // Grok 2 pricing (legacy)
  'grok-2': {
    input: 2.0 / 1_000_000,      // $2.00 per 1M tokens
    output: 10.0 / 1_000_000,    // $10.00 per 1M tokens
    cached: 0.50 / 1_000_000,    // estimated
  },
} as const;

/**
 * Get Grok pricing for a model
 */
function getGrokPricing(model: string): { input: number; output: number; cached: number } {
  const modelLower = model.toLowerCase();

  if (modelLower.includes('grok-4.1-fast') || modelLower.includes('grok-4.1')) {
    return GROK_PRICING['grok-4.1-fast'];
  }
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

  // Default to Grok 4 pricing (current default model)
  return GROK_PRICING['grok-4'];
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
