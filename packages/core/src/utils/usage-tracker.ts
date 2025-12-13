/**
 * Usage Tracker - Session-based API usage tracking
 *
 * Tracks token usage across API calls in the current session.
 * Phase 1: Support for z.ai and session-based tracking
 * Phase 2: Add support for historical tracking and other providers
 * Phase 3: Performance metrics (response times, tool usage, server tools)
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

/**
 * Performance metrics for response times
 */
export interface PerformanceMetrics {
  /** Total number of API calls measured */
  totalCalls: number;
  /** Total response time across all calls (ms) */
  totalResponseTimeMs: number;
  /** Average response time (ms) */
  avgResponseTimeMs: number;
  /** Minimum response time (ms) */
  minResponseTimeMs: number;
  /** Maximum response time (ms) */
  maxResponseTimeMs: number;
  /** P50 response time (ms) - median */
  p50ResponseTimeMs: number;
  /** P95 response time (ms) */
  p95ResponseTimeMs: number;
  /** P99 response time (ms) */
  p99ResponseTimeMs: number;
}

/**
 * Tool usage statistics
 */
export interface ToolUsageStats {
  /** Tool name */
  name: string;
  /** Number of times called */
  calls: number;
  /** Number of successful executions */
  successes: number;
  /** Number of failed executions */
  failures: number;
  /** Total execution time (ms) */
  totalExecutionTimeMs: number;
  /** Average execution time (ms) */
  avgExecutionTimeMs: number;
}

/**
 * Grok server tool metrics (xAI Agent Tools API)
 */
export interface ServerToolMetrics {
  /** web_search usage */
  webSearch: {
    calls: number;
    totalResults: number;
    avgResultsPerCall: number;
  };
  /** x_search usage (X/Twitter posts) */
  xSearch: {
    calls: number;
    totalResults: number;
    avgResultsPerCall: number;
    bySearchType: {
      keyword: number;
      semantic: number;
    };
  };
  /** code_execution usage */
  codeExecution: {
    calls: number;
    successes: number;
    failures: number;
    totalExecutionTimeMs: number;
  };
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
  /** Performance metrics (Phase 3) */
  performance: PerformanceMetrics;
  /** Tool usage statistics (Phase 3) */
  toolUsage: Map<string, ToolUsageStats>;
  /** Server tool metrics for Grok (Phase 3) */
  serverTools: ServerToolMetrics;
}

/**
 * Helper to create default performance metrics
 */
function createDefaultPerformanceMetrics(): PerformanceMetrics {
  return {
    totalCalls: 0,
    totalResponseTimeMs: 0,
    avgResponseTimeMs: 0,
    minResponseTimeMs: Infinity,
    maxResponseTimeMs: 0,
    p50ResponseTimeMs: 0,
    p95ResponseTimeMs: 0,
    p99ResponseTimeMs: 0,
  };
}

/**
 * Helper to create default server tool metrics
 */
function createDefaultServerToolMetrics(): ServerToolMetrics {
  return {
    webSearch: { calls: 0, totalResults: 0, avgResultsPerCall: 0 },
    xSearch: {
      calls: 0,
      totalResults: 0,
      avgResultsPerCall: 0,
      bySearchType: { keyword: 0, semantic: 0 },
    },
    codeExecution: { calls: 0, successes: 0, failures: 0, totalExecutionTimeMs: 0 },
  };
}

/**
 * UsageTracker - Singleton for tracking API usage
 */
export class UsageTracker {
  private static instance: UsageTracker | null = null;

  /** Response times for percentile calculations */
  private responseTimes: number[] = [];

  private sessionStats: SessionStats = {
    totalRequests: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalReasoningTokens: 0,
    totalCachedTokens: 0,
    byModel: new Map(),
    performance: createDefaultPerformanceMetrics(),
    toolUsage: new Map(),
    serverTools: createDefaultServerToolMetrics(),
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

    const toolUsageCopy = new Map<string, ToolUsageStats>();
    for (const [tool, stats] of this.sessionStats.toolUsage.entries()) {
      toolUsageCopy.set(tool, { ...stats });
    }

    return {
      ...this.sessionStats,
      byModel: modelsCopy,
      performance: { ...this.sessionStats.performance },
      toolUsage: toolUsageCopy,
      serverTools: {
        webSearch: { ...this.sessionStats.serverTools.webSearch },
        xSearch: {
          ...this.sessionStats.serverTools.xSearch,
          bySearchType: { ...this.sessionStats.serverTools.xSearch.bySearchType },
        },
        codeExecution: { ...this.sessionStats.serverTools.codeExecution },
      },
    };
  }

  /**
   * Reset session statistics
   */
  resetSession(): void {
    this.responseTimes = [];
    this.sessionStats = {
      totalRequests: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalReasoningTokens: 0,
      totalCachedTokens: 0,
      byModel: new Map(),
      performance: createDefaultPerformanceMetrics(),
      toolUsage: new Map(),
      serverTools: createDefaultServerToolMetrics(),
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
   * Returns a copy to prevent external mutation
   */
  getModelStats(model: string): UsageStats | null {
    const stats = this.sessionStats.byModel.get(model);
    // BUG FIX: Return a copy to prevent external mutation of internal state
    // This is consistent with getSessionStats() which also returns a deep copy
    return stats ? { ...stats } : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 3: Performance Metrics
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Track API response time
   *
   * @param responseTimeMs - Response time in milliseconds
   */
  trackResponseTime(responseTimeMs: number): void {
    const perf = this.sessionStats.performance;

    // Update basic metrics
    perf.totalCalls++;
    perf.totalResponseTimeMs += responseTimeMs;
    perf.avgResponseTimeMs = perf.totalResponseTimeMs / perf.totalCalls;

    // Update min/max
    if (responseTimeMs < perf.minResponseTimeMs) {
      perf.minResponseTimeMs = responseTimeMs;
    }
    if (responseTimeMs > perf.maxResponseTimeMs) {
      perf.maxResponseTimeMs = responseTimeMs;
    }

    // Store for percentile calculations
    this.responseTimes.push(responseTimeMs);

    // Recalculate percentiles
    this.updatePercentiles();
  }

  /**
   * Calculate percentiles from response times
   */
  private updatePercentiles(): void {
    if (this.responseTimes.length === 0) return;

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const perf = this.sessionStats.performance;

    perf.p50ResponseTimeMs = this.getPercentile(sorted, 50);
    perf.p95ResponseTimeMs = this.getPercentile(sorted, 95);
    perf.p99ResponseTimeMs = this.getPercentile(sorted, 99);
  }

  /**
   * Get percentile value from sorted array
   */
  private getPercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const perf = this.sessionStats.performance;
    return {
      ...perf,
      // Return 0 instead of Infinity if no calls made
      minResponseTimeMs: perf.minResponseTimeMs === Infinity ? 0 : perf.minResponseTimeMs,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 3: Tool Usage Statistics
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Track tool execution
   *
   * @param toolName - Name of the tool
   * @param success - Whether execution was successful
   * @param executionTimeMs - Execution time in milliseconds
   */
  trackToolUsage(toolName: string, success: boolean, executionTimeMs: number): void {
    const existing = this.sessionStats.toolUsage.get(toolName) || {
      name: toolName,
      calls: 0,
      successes: 0,
      failures: 0,
      totalExecutionTimeMs: 0,
      avgExecutionTimeMs: 0,
    };

    existing.calls++;
    if (success) {
      existing.successes++;
    } else {
      existing.failures++;
    }
    existing.totalExecutionTimeMs += executionTimeMs;
    existing.avgExecutionTimeMs = existing.totalExecutionTimeMs / existing.calls;

    this.sessionStats.toolUsage.set(toolName, existing);
  }

  /**
   * Get tool usage statistics
   */
  getToolUsageStats(): Map<string, ToolUsageStats> {
    const copy = new Map<string, ToolUsageStats>();
    for (const [tool, stats] of this.sessionStats.toolUsage.entries()) {
      copy.set(tool, { ...stats });
    }
    return copy;
  }

  /**
   * Get top tools by usage count
   */
  getTopTools(limit: number = 10): ToolUsageStats[] {
    const tools = Array.from(this.sessionStats.toolUsage.values());
    return tools
      .sort((a, b) => b.calls - a.calls)
      .slice(0, limit)
      .map(stats => ({ ...stats }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 3: Grok Server Tool Metrics (xAI Agent Tools API)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Track web_search server tool usage
   *
   * @param resultCount - Number of results returned
   */
  trackWebSearch(resultCount: number): void {
    const ws = this.sessionStats.serverTools.webSearch;
    ws.calls++;
    ws.totalResults += resultCount;
    ws.avgResultsPerCall = ws.totalResults / ws.calls;
  }

  /**
   * Track x_search server tool usage (X/Twitter posts)
   *
   * @param resultCount - Number of results returned
   * @param searchType - Type of search ('keyword' or 'semantic')
   */
  trackXSearch(resultCount: number, searchType: 'keyword' | 'semantic'): void {
    const xs = this.sessionStats.serverTools.xSearch;
    xs.calls++;
    xs.totalResults += resultCount;
    xs.avgResultsPerCall = xs.totalResults / xs.calls;
    xs.bySearchType[searchType]++;
  }

  /**
   * Track code_execution server tool usage
   *
   * @param success - Whether execution was successful
   * @param executionTimeMs - Execution time in milliseconds
   */
  trackCodeExecution(success: boolean, executionTimeMs: number): void {
    const ce = this.sessionStats.serverTools.codeExecution;
    ce.calls++;
    if (success) {
      ce.successes++;
    } else {
      ce.failures++;
    }
    ce.totalExecutionTimeMs += executionTimeMs;
  }

  /**
   * Get server tool metrics
   */
  getServerToolMetrics(): ServerToolMetrics {
    return {
      webSearch: { ...this.sessionStats.serverTools.webSearch },
      xSearch: {
        ...this.sessionStats.serverTools.xSearch,
        bySearchType: { ...this.sessionStats.serverTools.xSearch.bySearchType },
      },
      codeExecution: { ...this.sessionStats.serverTools.codeExecution },
    };
  }
}

/**
 * Get the singleton usage tracker instance
 */
export function getUsageTracker(): UsageTracker {
  return UsageTracker.getInstance();
}
