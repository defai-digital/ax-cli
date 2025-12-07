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
        const provider = detectProvider(baseURL);

        const stats = tracker.getSessionStats();

        // JSON mode - plain output for scripting
        if (options.json) {
          console.log(JSON.stringify({
            provider,
            session: stats,
            supportsHistoricalData: provider === 'z.ai' ? false : 'unknown'
          }, null, 2));
          return;
        }

        // Interactive mode with @clack/prompts
        prompts.intro(chalk.cyan('API Usage Statistics'));

        // Provider info
        prompts.log.message(`Provider: ${getProviderDisplay(provider, baseURL)}`);

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

        // Calculate costs
        const cacheSavings = tracker.getCacheSavings();
        const uncachedPromptTokens = stats.totalPromptTokens - cacheSavings.cachedTokens;
        const cachedCost = cacheSavings.cachedTokens * 0.0000005;
        const uncachedCost = uncachedPromptTokens * 0.000002;
        const outputCost = stats.totalCompletionTokens * 0.00001;
        const reasoningCost = stats.totalReasoningTokens * 0.000002;
        const estimatedTotalCost = cachedCost + uncachedCost + outputCost + reasoningCost;

        if (estimatedTotalCost > 0) {
          sessionLines.push(`Est. Session Cost:   ${chalk.yellow('~$' + estimatedTotalCost.toFixed(4))}`);
        }

        prompts.note(sessionLines.join('\n'), 'Current Session');

        // Cache savings (if applicable)
        if (cacheSavings.cachedTokens > 0) {
          const cacheRate = stats.totalPromptTokens > 0
            ? ((cacheSavings.cachedTokens / stats.totalPromptTokens) * 100).toFixed(1)
            : '0.0';

          const cacheLines = [
            `Cached Tokens:       ${chalk.cyan(cacheSavings.cachedTokens.toLocaleString())}`,
            `Estimated Savings:   ${chalk.green('$' + cacheSavings.estimatedSavings.toFixed(4))}`,
            `Cache Hit Rate:      ${chalk.yellow(cacheRate + '%')}`,
          ];

          prompts.note(cacheLines.join('\n'), '💰 Cache Savings (GLM 4.6)');
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

            prompts.note(modelLines.join('\n'), `Model: ${model}`);
          }
        }

        // Provider-specific tips
        if (provider === 'z.ai') {
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
 * Detect provider from base URL
 */
function detectProvider(baseURL: string): string {
  const url = baseURL.toLowerCase();

  if (url.includes('z.ai') || url.includes('api.x.ai')) {
    return 'z.ai';
  }

  if (url.includes('openai.com')) {
    return 'openai';
  }

  if (url.includes('anthropic.com')) {
    return 'anthropic';
  }

  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return 'local';
  }

  // Try to extract domain name
  try {
    const urlObj = new URL(baseURL);
    const hostname = urlObj.hostname;
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
    'z.ai': 'Z.AI (GLM Models)',
    'openai': 'OpenAI',
    'anthropic': 'Anthropic (Claude)',
    'local': `Local (${baseURL})`
  };

  return providerMap[provider] || `${provider} (${baseURL})`;
}
