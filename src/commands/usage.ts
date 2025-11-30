import { Command } from 'commander';
import chalk from 'chalk';
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

        if (options.json) {
          console.log(JSON.stringify({
            provider,
            session: stats,
            supportsHistoricalData: provider === 'z.ai' ? false : 'unknown'
          }, null, 2));
          return;
        }

        // Display in human-readable format
        console.log();
        console.log(chalk.bold.blue('📊 API Usage Statistics'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log();

        console.log(chalk.bold('Provider:'), getProviderDisplay(provider, baseURL));
        console.log();

        if (stats.totalRequests === 0) {
          console.log(chalk.yellow('No API requests made in this session.'));
          console.log();
          return;
        }

        console.log(chalk.bold('Current Session:'));
        console.log(`  Total Requests:      ${chalk.cyan(stats.totalRequests.toLocaleString())}`);
        console.log(`  Prompt Tokens:       ${chalk.green(stats.totalPromptTokens.toLocaleString())}`);
        console.log(`  Completion Tokens:   ${chalk.green(stats.totalCompletionTokens.toLocaleString())}`);
        console.log(`  Total Tokens:        ${chalk.bold.green(stats.totalTokens.toLocaleString())}`);

        if (stats.totalReasoningTokens > 0) {
          console.log(`  Reasoning Tokens:    ${chalk.magenta(stats.totalReasoningTokens.toLocaleString())}`);
        }

        // GLM-4.6: Estimated cost calculation
        // z.ai pricing: ~$2/1M input tokens, ~$10/1M output tokens (approx)
        const cacheSavings = tracker.getCacheSavings();
        const uncachedPromptTokens = stats.totalPromptTokens - cacheSavings.cachedTokens;
        const cachedCost = cacheSavings.cachedTokens * 0.0000005; // $0.50/1M for cached
        const uncachedCost = uncachedPromptTokens * 0.000002; // $2/1M for uncached input
        const outputCost = stats.totalCompletionTokens * 0.00001; // $10/1M for output
        const reasoningCost = stats.totalReasoningTokens * 0.000002; // Similar to input
        const estimatedTotalCost = cachedCost + uncachedCost + outputCost + reasoningCost;

        if (estimatedTotalCost > 0) {
          console.log(`  Est. Session Cost:   ${chalk.yellow('~$' + estimatedTotalCost.toFixed(4))}`);
        }

        // GLM 4.6 OPTIMIZATION: Display cache savings
        // Shows users how much they're saving via Z.AI's automatic context caching
        if (cacheSavings.cachedTokens > 0) {
          console.log();
          console.log(chalk.bold('💰 Cache Savings (GLM 4.6):'));
          console.log(`  Cached Tokens:       ${chalk.cyan(cacheSavings.cachedTokens.toLocaleString())}`);
          console.log(`  Estimated Savings:   ${chalk.green('$' + cacheSavings.estimatedSavings.toFixed(4))}`);
          // BUG FIX: Guard against division by zero when totalPromptTokens is 0
          const cacheRate = stats.totalPromptTokens > 0
            ? ((cacheSavings.cachedTokens / stats.totalPromptTokens) * 100).toFixed(1)
            : '0.0';
          console.log(`  Cache Hit Rate:      ${chalk.yellow(cacheRate + '%')}`);
        }

        console.log();

        // Show per-model breakdown if detailed flag is set
        if (options.detailed && stats.byModel.size > 0) {
          console.log(chalk.bold('Breakdown by Model:'));
          console.log();

          for (const [model, modelStats] of stats.byModel.entries()) {
            console.log(chalk.bold(`  ${model}:`));
            console.log(`    Requests:           ${modelStats.requests.toLocaleString()}`);
            console.log(`    Prompt Tokens:      ${modelStats.promptTokens.toLocaleString()}`);
            console.log(`    Completion Tokens:  ${modelStats.completionTokens.toLocaleString()}`);
            console.log(`    Total Tokens:       ${modelStats.totalTokens.toLocaleString()}`);

            if (modelStats.reasoningTokens > 0) {
              console.log(`    Reasoning Tokens:   ${modelStats.reasoningTokens.toLocaleString()}`);
            }
            console.log();
          }
        }

        // Show provider-specific information
        if (provider === 'z.ai') {
          console.log(chalk.gray('💡 Note: Historical usage data is available at:'));
          console.log(chalk.gray('   https://z.ai/manage-apikey/billing'));
          console.log();
          console.log(chalk.gray('   Billing reflects consumption from the previous day (n-1).'));
        } else {
          console.log(chalk.yellow(`⚠️  Provider "${provider}" usage tracking: Information unavailable`));
          console.log(chalk.gray('   Only session-based tracking is available for this provider.'));
          console.log(chalk.gray('   Historical data may be available through the provider\'s dashboard.'));
        }

        console.log();

      } catch (error: any) {
        ConsoleMessenger.error('usage_commands.error_showing_usage', { error: error.message });
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
      } catch (error: any) {
        ConsoleMessenger.error('usage_commands.error_resetting_usage', { error: error.message });
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
