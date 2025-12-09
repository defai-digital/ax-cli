/**
 * Stats Collector - Collects and reports cache statistics
 *
 * Tracks z.ai cache performance by recording cached_tokens
 * from API responses and calculating efficiency metrics.
 */

import { ContextStore } from './context-store.js';
import type { CacheStats } from './types.js';

/**
 * Formatted statistics for display
 */
export interface FormattedStats {
  /** Human-readable stats text */
  text: string;
  /** Cache hit rate percentage (0-100) */
  cacheRate: number;
  /** Total tokens saved through caching */
  tokensSaved: number;
  /** Number of API calls */
  usageCount: number;
  /** Estimated cost savings (rough estimate) */
  estimatedSavings: number;
}

/**
 * Token pricing constants (rough estimates for z.ai)
 * These are approximate and should be updated based on actual pricing
 */
const PRICING = {
  /** Cost per 1K input tokens (USD) */
  INPUT_PER_1K: 0.002,
  /** Cost per 1K cached tokens (50% discount) */
  CACHED_PER_1K: 0.001,
} as const;

/**
 * StatsCollector - Manages cache statistics
 */
export class StatsCollector {
  private store: ContextStore;

  constructor(projectRoot: string = process.cwd()) {
    this.store = new ContextStore(projectRoot);
  }

  /**
   * Record API response statistics
   *
   * @param promptTokens - Total prompt tokens from response
   * @param cachedTokens - Cached tokens from response (from usage.prompt_tokens_details.cached_tokens)
   * @returns true if recording succeeded, false otherwise
   */
  recordResponse(promptTokens: number, cachedTokens: number): boolean {
    // BUG FIX: Handle the result of recordUsage instead of ignoring it
    // This prevents silent failures when stats can't be recorded
    const result = this.store.recordUsage(promptTokens, cachedTokens);
    if (!result.success && (process.env.DEBUG || process.env.AX_DEBUG)) {
      console.warn('Failed to record usage stats:', result.error);
    }
    return result.success;
  }

  /**
   * Get raw statistics
   */
  getStats(): CacheStats | null {
    const result = this.store.load();
    if (!result.success) {
      return null;
    }
    return result.data.stats || null;
  }

  /**
   * Calculate cache hit rate from last request
   */
  getLastCacheRate(): number {
    const stats = this.getStats();
    if (!stats || !stats.last_prompt_tokens || !stats.last_cached_tokens) {
      return 0;
    }
    return Math.round((stats.last_cached_tokens / stats.last_prompt_tokens) * 100);
  }

  /**
   * Calculate estimated cost savings
   */
  getEstimatedSavings(): number {
    const stats = this.getStats();
    if (!stats || !stats.total_tokens_saved) {
      return 0;
    }

    // Savings = tokens_saved * (regular_price - cached_price)
    const savingsPerToken = (PRICING.INPUT_PER_1K - PRICING.CACHED_PER_1K) / 1000;
    return stats.total_tokens_saved * savingsPerToken;
  }

  /**
   * Get formatted statistics for display
   */
  getFormattedStats(): FormattedStats | null {
    const stats = this.getStats();
    if (!stats) {
      return null;
    }

    const cacheRate = this.getLastCacheRate();
    const tokensSaved = stats.total_tokens_saved || 0;
    const usageCount = stats.usage_count || 0;
    const estimatedSavings = this.getEstimatedSavings();

    const lines: string[] = [
      '📈 Cache Statistics',
      '',
      `   Usage count:      ${usageCount}`,
      `   Last cache rate:  ${cacheRate}%`,
      `   Tokens saved:     ${tokensSaved.toLocaleString()}`,
      `   Est. savings:     $${estimatedSavings.toFixed(2)}`,
    ];

    if (stats.last_used_at) {
      const lastUsed = new Date(stats.last_used_at);
      lines.push(`   Last used:        ${lastUsed.toLocaleString()}`);
    }

    return {
      text: lines.join('\n'),
      cacheRate,
      tokensSaved,
      usageCount,
      estimatedSavings,
    };
  }

  /**
   * Format a brief cache status line for verbose output
   */
  formatBriefStatus(promptTokens: number, cachedTokens: number): string {
    const rate = promptTokens > 0
      ? Math.round((cachedTokens / promptTokens) * 100)
      : 0;

    return `cached: ${cachedTokens.toLocaleString()}/${promptTokens.toLocaleString()} tokens (${rate}% cache hit)`;
  }

  /**
   * Check if caching appears to be working
   * Returns a warning message if cache hits are consistently zero
   */
  checkCacheHealth(): string | null {
    const stats = this.getStats();
    if (!stats) {
      return null;
    }

    // If we've had multiple uses but no cache hits, something might be wrong
    if (stats.usage_count && stats.usage_count >= 3) {
      if (!stats.total_tokens_saved || stats.total_tokens_saved === 0) {
        return 'Warning: No cache hits detected after multiple uses. ' +
               'Consider running "ax memory refresh" to regenerate context.';
      }

      // Check for very low cache rate
      const avgSavedPerUse = stats.total_tokens_saved / stats.usage_count;
      if (avgSavedPerUse < 100) {
        return 'Note: Cache hit rate is lower than expected. ' +
               'This may indicate context has changed frequently.';
      }
    }

    return null;
  }

  /**
   * Reset statistics (keeps memory content, only clears stats)
   */
  resetStats(): boolean {
    const result = this.store.load();
    if (!result.success) {
      return false;
    }

    const memory = result.data;
    memory.stats = undefined;
    memory.updated_at = new Date().toISOString();

    const saveResult = this.store.save(memory);
    return saveResult.success;
  }
}

/**
 * Singleton instance
 */
let defaultCollector: StatsCollector | null = null;

/**
 * Get the default stats collector instance
 */
export function getStatsCollector(projectRoot?: string): StatsCollector {
  if (projectRoot) {
    return new StatsCollector(projectRoot);
  }

  if (!defaultCollector) {
    defaultCollector = new StatsCollector();
  }

  return defaultCollector;
}

/**
 * Reset the default collector (mainly for testing)
 */
export function resetDefaultCollector(): void {
  defaultCollector = null;
}
