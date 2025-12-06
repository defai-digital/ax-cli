/**
 * Token Estimator
 *
 * Estimates token usage for phases and plans.
 * Uses heuristics based on objectives and tools.
 */

import { TaskPhase, TaskPlan, RiskLevel } from "./types.js";
import { ExecutionBatch } from "./dependency-resolver.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Base token costs per tool type
 */
const TOOL_TOKEN_COSTS: Record<string, number> = {
  // File operations
  view_file: 500,
  str_replace_editor: 800,
  text_editor: 800,
  write_file: 600,

  // Search
  search: 400,
  grep: 300,
  find: 200,

  // Shell
  bash: 1000,
  execute_command: 1000,

  // Navigation
  list_directory: 200,
  read_file: 500,

  // Analysis
  analyze: 1500,
  understand: 1200,

  // Testing
  test: 2000,
  run_tests: 2000,

  // Documentation
  document: 1500,
  write_docs: 1500,

  // Default for unknown tools
  default: 500,
};

/**
 * Complexity multipliers
 */
const COMPLEXITY_MULTIPLIERS: Record<string, number> = {
  simple: 1.0,
  moderate: 1.5,
  complex: 2.5,
};

/**
 * Objective complexity indicators (keywords that increase estimates)
 */
const COMPLEX_OBJECTIVE_KEYWORDS = [
  "refactor",
  "rewrite",
  "migrate",
  "implement",
  "create",
  "design",
  "optimize",
  "integrate",
  "test",
  "comprehensive",
  "full",
  "entire",
  "all",
];

/**
 * Simple objective keywords (decrease estimates)
 */
const SIMPLE_OBJECTIVE_KEYWORDS = [
  "read",
  "view",
  "check",
  "list",
  "find",
  "locate",
  "identify",
  "examine",
  "review",
];

// ============================================================================
// Token Estimator Class
// ============================================================================

export class TokenEstimator {
  private baseTokensPerPhase: number;
  private tokensPerObjective: number;

  constructor(options?: {
    baseTokensPerPhase?: number;
    tokensPerObjective?: number;
  }) {
    this.baseTokensPerPhase = options?.baseTokensPerPhase || 2000;
    this.tokensPerObjective = options?.tokensPerObjective || 500;
  }

  /**
   * Estimate tokens for a single phase
   */
  estimatePhase(phase: TaskPhase): number {
    let estimate = this.baseTokensPerPhase;

    // Add tokens for each objective
    for (const objective of phase.objectives) {
      let objectiveTokens = this.tokensPerObjective;

      // Adjust based on objective complexity
      const lowerObjective = objective.toLowerCase();

      if (COMPLEX_OBJECTIVE_KEYWORDS.some((kw) => lowerObjective.includes(kw))) {
        objectiveTokens *= 1.5;
      } else if (
        SIMPLE_OBJECTIVE_KEYWORDS.some((kw) => lowerObjective.includes(kw))
      ) {
        objectiveTokens *= 0.7;
      }

      estimate += objectiveTokens;
    }

    // Add tokens for each required tool
    for (const tool of phase.toolsRequired) {
      const toolCost = TOOL_TOKEN_COSTS[tool] || TOOL_TOKEN_COSTS.default;
      estimate += toolCost;
    }

    // Multiply by risk level
    switch (phase.riskLevel) {
      case RiskLevel.HIGH:
        estimate *= 1.3; // Higher risk = more validation/care
        break;
      case RiskLevel.MEDIUM:
        estimate *= 1.1;
        break;
      case RiskLevel.LOW:
      default:
        break;
    }

    return Math.round(estimate);
  }

  /**
   * Estimate tokens for an entire plan
   */
  estimatePlan(plan: TaskPlan): number {
    let total = 0;

    for (const phase of plan.phases) {
      total += this.estimatePhase(phase);
    }

    // Apply complexity multiplier
    const multiplier =
      COMPLEXITY_MULTIPLIERS[plan.complexity] ||
      COMPLEXITY_MULTIPLIERS.moderate;

    // Add overhead for plan coordination
    const coordinationOverhead = plan.phases.length * 200;

    return Math.round(total * multiplier + coordinationOverhead);
  }

  /**
   * Estimate tokens for an execution batch
   */
  estimateBatch(batch: ExecutionBatch): number {
    let total = 0;

    for (const phase of batch.phases) {
      total += this.estimatePhase(phase);
    }

    // Parallel execution has some overhead
    if (batch.canRunInParallel && batch.phases.length > 1) {
      total *= 1.1; // 10% overhead for coordination
    }

    return Math.round(total);
  }

  /**
   * Estimate duration for a phase (in milliseconds)
   */
  estimatePhaseDuration(phase: TaskPhase): number {
    const tokens = this.estimatePhase(phase);

    // Rough estimate: 50 tokens per second processing
    const baseTime = (tokens / 50) * 1000;

    // Add time for tool executions
    let toolTime = 0;
    for (const tool of phase.toolsRequired) {
      switch (tool) {
        case "bash":
        case "execute_command":
          toolTime += 5000; // 5 seconds per bash command
          break;
        case "test":
        case "run_tests":
          toolTime += 30000; // 30 seconds for tests
          break;
        case "search":
        case "grep":
          toolTime += 2000; // 2 seconds for search
          break;
        default:
          toolTime += 1000; // 1 second default
      }
    }

    return Math.round(baseTime + toolTime);
  }

  /**
   * Estimate total duration for a plan
   */
  estimatePlanDuration(
    _plan: TaskPlan,
    batches: ExecutionBatch[]
  ): number {
    let totalDuration = 0;

    for (const batch of batches) {
      if (batch.canRunInParallel && batch.phases.length > 1) {
        // Parallel: take the max duration
        const durations = batch.phases.map((p) =>
          this.estimatePhaseDuration(p)
        );
        totalDuration += Math.max(...durations);
      } else {
        // Sequential: sum all durations
        for (const phase of batch.phases) {
          totalDuration += this.estimatePhaseDuration(phase);
        }
      }
    }

    return totalDuration;
  }

  /**
   * Check if a plan will fit within context limits
   */
  willFitInContext(plan: TaskPlan, contextLimit: number): {
    fits: boolean;
    estimatedTokens: number;
    remainingTokens: number;
  } {
    const estimatedTokens = this.estimatePlan(plan);
    return {
      fits: estimatedTokens < contextLimit,
      estimatedTokens,
      remainingTokens: contextLimit - estimatedTokens,
    };
  }

  /**
   * Suggest phase splits if plan is too large
   */
  suggestSplits(
    plan: TaskPlan,
    contextLimit: number
  ): { shouldSplit: boolean; suggestions: string[] } {
    const estimated = this.estimatePlan(plan);

    if (estimated <= contextLimit) {
      return { shouldSplit: false, suggestions: [] };
    }

    const suggestions: string[] = [];

    // Find the largest phases
    const phaseEstimates = plan.phases.map((p) => ({
      phase: p,
      tokens: this.estimatePhase(p),
    }));

    phaseEstimates.sort((a, b) => b.tokens - a.tokens);

    // Suggest splitting large phases
    for (const { phase, tokens } of phaseEstimates.slice(0, 3)) {
      if (tokens > contextLimit * 0.3) {
        suggestions.push(
          `Phase "${phase.name}" is estimated at ${tokens} tokens. ` +
            `Consider breaking it into smaller phases.`
        );
      }
    }

    // Suggest reducing objectives
    const totalObjectives = plan.phases.reduce(
      (sum, p) => sum + p.objectives.length,
      0
    );
    if (totalObjectives > 15) {
      suggestions.push(
        `Plan has ${totalObjectives} objectives. Consider reducing scope.`
      );
    }

    return { shouldSplit: true, suggestions };
  }

  /**
   * Format token estimate for display
   */
  formatEstimate(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  }

  /**
   * Format duration for display
   */
  formatDuration(durationMs: number): string {
    if (durationMs < 1000) {
      return `${durationMs}ms`;
    }

    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let estimatorInstance: TokenEstimator | null = null;

/**
 * Get the singleton TokenEstimator instance
 */
export function getTokenEstimator(): TokenEstimator {
  if (!estimatorInstance) {
    estimatorInstance = new TokenEstimator();
  }
  return estimatorInstance;
}
