/**
 * Usage Tracker - Session-based API usage tracking
 *
 * Tracks token usage across API calls in the current session.
 * Phase 1: Support for z.ai and session-based tracking
 * Phase 2: Add support for historical tracking and other providers
 */

export interface UsageStats {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  /** Tokens served from cache (50% cost savings) */
  cachedTokens: number;
}

export interface SessionStats {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalReasoningTokens: number;
  /** Total tokens served from cache across all requests */
  totalCachedTokens: number;
  byModel: Map<string, UsageStats>;
}

/**
 * UsageTracker - Singleton for tracking API usage
 */
export class UsageTracker {
  private static instance: UsageTracker | null = null;

  private sessionStats: SessionStats = {
    totalRequests: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalReasoningTokens: 0,
    totalCachedTokens: 0,
    byModel: new Map()
  };

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker();
    }
    return UsageTracker.instance;
  }

  /**
   * Track usage from API response
   *
   * @param model - The model identifier
   * @param usage - Usage data from API response including prompt_tokens_details for cache info
   */
  trackUsage(model: string, usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
    /** xAI API returns cached token info in prompt_tokens_details */
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
  }): void {
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (promptTokens + completionTokens);
    const reasoningTokens = usage.reasoning_tokens || 0;
    // Extract cached tokens from prompt_tokens_details (xAI API format)
    const cachedTokens = usage.prompt_tokens_details?.cached_tokens || 0;

    // Update total stats
    this.sessionStats.totalRequests++;
    this.sessionStats.totalPromptTokens += promptTokens;
    this.sessionStats.totalCompletionTokens += completionTokens;
    this.sessionStats.totalTokens += totalTokens;
    this.sessionStats.totalReasoningTokens += reasoningTokens;
    this.sessionStats.totalCachedTokens += cachedTokens;

    // Update per-model stats
    const modelStats = this.sessionStats.byModel.get(model) || {
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cachedTokens: 0
    };

    modelStats.requests++;
    modelStats.promptTokens += promptTokens;
    modelStats.completionTokens += completionTokens;
    modelStats.totalTokens += totalTokens;
    modelStats.reasoningTokens += reasoningTokens;
    modelStats.cachedTokens += cachedTokens;

    this.sessionStats.byModel.set(model, modelStats);
  }

  /**
   * Get current session statistics
   */
  getSessionStats(): SessionStats {
    // Deep copy to prevent external mutation of stats
    const modelsCopy = new Map<string, UsageStats>();
    for (const [model, stats] of this.sessionStats.byModel.entries()) {
      modelsCopy.set(model, { ...stats });
    }

    return {
      ...this.sessionStats,
      byModel: modelsCopy
    };
  }

  /**
   * Reset session statistics
   */
  resetSession(): void {
    this.sessionStats = {
      totalRequests: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalReasoningTokens: 0,
      totalCachedTokens: 0,
      byModel: new Map()
    };
  }

  /**
   * Get estimated cost savings from caching
   * Cached tokens are typically billed at reduced rates compared to standard input tokens
   */
  getCacheSavings(): { cachedTokens: number; estimatedSavings: number } {
    const cachedTokens = this.sessionStats.totalCachedTokens;
    // Estimated savings calculation based on typical pricing difference
    // Standard input: ~$1.00 per 1M tokens ($0.001 per 1K tokens)
    // Cached input: ~$0.25 per 1M tokens ($0.00025 per 1K tokens)
    // Savings per token: ($0.001 - $0.00025) / 1000 = $0.00000075 per token
    const savingsPerToken = 0.00000075;
    const estimatedSavings = cachedTokens * savingsPerToken;
    return { cachedTokens, estimatedSavings };
  }

  /**
   * Get statistics for a specific model
   */
  getModelStats(model: string): UsageStats | null {
    return this.sessionStats.byModel.get(model) || null;
  }
}

/**
 * Get the singleton usage tracker instance
 */
export function getUsageTracker(): UsageTracker {
  return UsageTracker.getInstance();
}
