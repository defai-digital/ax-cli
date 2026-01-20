/**
 * Self-Correction Engine
 *
 * Coordinates failure detection and correction attempts.
 * Injects reflection prompts into the conversation and manages
 * retry budgets.
 *
 * @module agent/correction/self-correction
 */

import type { EventEmitter } from 'events';
import type { LLMClient, LLMMessage, LLMToolCall } from '../../llm/client.js';
import type { ToolResult } from '../../types/index.js';
import type { ThinkingConfig } from '../../llm/types.js';
import type { SelfCorrectionConfig } from '../config/agentic-config.js';
import { DEFAULT_CORRECTION_CONFIG } from '../config/agentic-config.js';
import { FailureDetector, RecoveryStrategy } from './failure-detector.js';
import {
  buildReflectionPrompt,
  buildQuickReflectionPrompt,
  buildExhaustionPrompt,
} from './reflection-prompts.js';
import { extractErrorMessage } from '../../utils/error-handler.js';
import type {
  FailureSignal,
  CorrectionResult,
  CorrectionAttempt,
  CorrectionStatus,
  CorrectionEvent,
} from './types.js';

// ============================================================================
// PRD-001 P1: Recovery Strategy Types
// ============================================================================

/**
 * Strategy-specific recovery context
 * PRD-001 P1: Multi-strategy recovery support
 */
export interface StrategyRecoveryContext {
  /** The recovery strategy being applied */
  strategy: RecoveryStrategy;

  /** Strategy-specific prompts/guidance */
  strategyPrompt: string;

  /** Files to search for alternatives (for search_alternative strategy) */
  alternativeSearchPaths?: string[];

  /** Whether to suggest escalation to user */
  shouldEscalate?: boolean;

  /** Suggested alternative approaches */
  alternatives?: string[];
}

// ============================================================================
// Types
// ============================================================================

/**
 * Context for correction attempts
 */
export interface CorrectionContext {
  /** The original task being performed */
  originalTask?: string;

  /** Recent conversation history */
  recentHistory?: Array<{
    role: string;
    content: string;
    toolName?: string;
  }>;

  /** Additional context to include in reflection */
  additionalContext?: string;

  /** Current attempt number (1-indexed, defaults to 1) */
  attemptNumber?: number;
}

/**
 * Streaming chunk types for correction process
 */
export interface CorrectionStreamChunk {
  type: 'correction_start' | 'correction_reflecting' | 'correction_retrying' | 'correction_complete';
  failure?: FailureSignal;
  attempt?: number;
  maxRetries?: number;
  result?: CorrectionResult;
  content?: string;
}

// ============================================================================
// SelfCorrectionEngine
// ============================================================================

/**
 * SelfCorrectionEngine - Manages failure detection and correction
 */
export class SelfCorrectionEngine {
  private config: SelfCorrectionConfig;
  private detector: FailureDetector;
  private retryBudgets: Map<string, number>;
  private emitter?: EventEmitter;

  constructor(
    config: Partial<SelfCorrectionConfig> = {},
    emitter?: EventEmitter
  ) {
    this.config = { ...DEFAULT_CORRECTION_CONFIG, ...config };
    this.detector = new FailureDetector({
      customPatterns: this.config.customFailurePatterns,
    });
    this.retryBudgets = new Map();
    this.emitter = emitter;
  }

  /**
   * Check if correction is enabled
   */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Analyze a tool result for failures
   *
   * @returns FailureSignal if failure detected, null otherwise
   */
  analyzeResult(
    toolCall: LLMToolCall,
    result: ToolResult,
    loopResult?: { isLoop: boolean; reason?: string }
  ): FailureSignal | null {
    if (!this.config.enabled) {
      return null;
    }

    return this.detector.detectFailure(
      toolCall,
      result,
      loopResult ? { ...loopResult, count: 0, threshold: 0 } : undefined
    );
  }

  /**
   * Check if correction should be attempted for a failure
   */
  shouldAttemptCorrection(failure: FailureSignal): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (!this.detector.shouldAttemptCorrection(failure)) {
      return false;
    }

    // Check retry budget (use strategy-specific max retries if available)
    const budgetKey = this.getFailureKey(failure);
    const maxRetries = this.getMaxRetriesForFailure(failure);
    const remaining = this.getRemainingBudgetWithMax(budgetKey, maxRetries);

    return remaining > 0;
  }

  /**
   * PRD-001 P1: Get the recovery strategy for a failure
   * @returns The appropriate recovery strategy based on the failure type and error message
   */
  getRecoveryStrategy(failure: FailureSignal): RecoveryStrategy | null {
    return this.detector.getRecoveryStrategy(
      failure.type,
      failure.context.errorMessage
    );
  }

  /**
   * PRD-001 P1: Get strategy-specific recovery context
   * Builds additional context based on the recovery strategy
   */
  buildStrategyRecoveryContext(failure: FailureSignal): StrategyRecoveryContext | null {
    const strategy = this.getRecoveryStrategy(failure);
    if (!strategy) {
      return null;
    }

    const context: StrategyRecoveryContext = {
      strategy,
      strategyPrompt: strategy.prompt,
    };

    // Add strategy-specific guidance
    switch (strategy.strategy) {
      case 'search_alternative':
        context.alternativeSearchPaths = this.suggestAlternativePaths(failure);
        context.alternatives = [
          'Try searching for similar filenames with different extensions',
          'Check if the file was recently renamed or moved',
          'Search in parent or sibling directories',
        ];
        break;

      case 'escalate':
        context.shouldEscalate = true;
        context.alternatives = [
          'Report this issue to the user for manual intervention',
          'Suggest alternative approaches that avoid this operation',
          'Provide diagnostic information for troubleshooting',
        ];
        break;

      case 'broaden_search':
        context.alternatives = [
          'Try less specific search terms',
          'Remove file type filters',
          'Search in a wider directory scope',
          'Consider alternative naming conventions',
        ];
        break;

      case 'reread_and_retry':
        context.alternatives = [
          'Use view_file to read the current file contents',
          'Copy the exact text from the file before editing',
          'Check for whitespace differences',
        ];
        break;

      case 'simplify':
        context.alternatives = [
          'Break the operation into smaller steps',
          'Use simpler patterns or commands',
          'Process fewer items at once',
        ];
        break;

      case 'different_approach':
        context.alternatives = [
          'Consider using a different tool for this task',
          'Try an alternative algorithm or method',
          'Approach the problem from a different angle',
        ];
        break;

      case 'verify_first':
        context.alternatives = [
          'Verify the input format is correct',
          'Check that prerequisites are met',
          'Validate assumptions before proceeding',
        ];
        break;

      case 'background_retry':
        context.alternatives = [
          'Run this operation in the background',
          'Increase the timeout limit',
          'Split into smaller operations that complete faster',
        ];
        break;
    }

    return context;
  }

  /**
   * PRD-001 P1: Suggest alternative file paths based on the failure context
   */
  private suggestAlternativePaths(failure: FailureSignal): string[] {
    const originalPath = failure.context.filePath;
    if (!originalPath) {
      return [];
    }

    const suggestions: string[] = [];
    const pathParts = originalPath.split('/');
    const filename = pathParts[pathParts.length - 1];
    const dir = pathParts.slice(0, -1).join('/');

    // Suggest common variations
    if (filename.includes('.')) {
      const [name, ext] = filename.split('.');
      // Try different extensions
      const commonExts = ['ts', 'js', 'tsx', 'jsx', 'mjs', 'cjs'];
      for (const newExt of commonExts) {
        if (newExt !== ext) {
          suggestions.push(`${dir}/${name}.${newExt}`);
        }
      }
    }

    // Suggest index file if looking for a directory-like path
    suggestions.push(`${originalPath}/index.ts`);
    suggestions.push(`${originalPath}/index.js`);

    return suggestions.slice(0, 5); // Limit suggestions
  }

  /**
   * PRD-001 P1: Get max retries for a specific failure (strategy-aware)
   */
  getMaxRetriesForFailure(failure: FailureSignal): number {
    // First check strategy-specific max retries
    const strategyMax = this.detector.getMaxRetriesForFailure(failure);
    // Use the smaller of strategy-specific and global config
    return Math.min(strategyMax, this.config.maxRetries);
  }

  /**
   * PRD-001 P1: Get remaining budget with custom max
   */
  private getRemainingBudgetWithMax(key: string, maxRetries: number): number {
    const used = this.retryBudgets.get(key) || 0;
    return Math.max(0, maxRetries - used);
  }

  /**
   * Attempt to correct a failure
   *
   * This is an async generator that yields status updates during the correction process.
   */
  async *attemptCorrection(
    failure: FailureSignal,
    llmClient: LLMClient,
    messages: LLMMessage[],
    context: CorrectionContext = {}
  ): AsyncGenerator<CorrectionStreamChunk> {
    const budgetKey = this.getFailureKey(failure);
    const startTime = Date.now();
    const attempts: CorrectionAttempt[] = [];

    // Get attempt number from context (defaults to 1 for backwards compatibility)
    const attemptNumber = context.attemptNumber ?? 1;

    // PRD-001 P1: Get strategy-specific max retries
    const maxRetries = this.getMaxRetriesForFailure(failure);

    // Emit start event
    this.emitEvent({
      type: 'correction_started',
      failure,
      attemptNumber,
      maxRetries,
    });

    yield {
      type: 'correction_start',
      failure,
      attempt: attemptNumber,
      maxRetries,
    };

    // PRD-001 P1: Get recovery strategy context
    const strategyContext = this.buildStrategyRecoveryContext(failure);

    // Build reflection prompt with strategy-specific guidance
    let reflectionPrompt: string;

    if (this.config.reflectionDepth === 'deep') {
      // Include strategy-specific context in the additional context
      let enhancedContext = context.additionalContext || '';

      if (strategyContext) {
        enhancedContext += `\n\nRecovery Strategy: ${strategyContext.strategy.strategy}\n`;
        enhancedContext += `Guidance: ${strategyContext.strategyPrompt}\n`;

        if (strategyContext.alternatives && strategyContext.alternatives.length > 0) {
          enhancedContext += `\nSuggested approaches:\n`;
          enhancedContext += strategyContext.alternatives.map(a => `- ${a}`).join('\n');
        }

        if (strategyContext.shouldEscalate) {
          enhancedContext += `\n\n⚠️ This issue should be escalated to the user for manual intervention.`;
        }
      }

      reflectionPrompt = buildReflectionPrompt({
        failure,
        depth: 'deep',
        recentHistory: context.recentHistory,
        originalTask: context.originalTask,
        additionalContext: enhancedContext,
      });
    } else {
      // Quick reflection with strategy hint
      reflectionPrompt = buildQuickReflectionPrompt(failure);

      if (strategyContext) {
        reflectionPrompt += `\n\n${strategyContext.strategyPrompt}`;
      }
    }

    yield {
      type: 'correction_reflecting',
      content: '\n\n*Analyzing what went wrong...*\n',
    };

    // Inject reflection into conversation
    const reflectionMessages: LLMMessage[] = [
      ...messages,
      { role: 'user', content: reflectionPrompt },
    ];

    try {
      // Get LLM's reflection (use thinking mode if configured)
      const thinkingConfig: ThinkingConfig | undefined = this.config.useThinkingModeForReflection
        ? { type: 'enabled' }
        : undefined;

      const response = await llmClient.chat(
        reflectionMessages,
        [], // No tools during reflection
        { thinking: thinkingConfig }
      );

      const reflection = response.choices[0]?.message;
      const analysis = reflection?.reasoning_content || '';
      const proposedFix = reflection?.content || '';

      // Record the attempt
      const attempt: CorrectionAttempt = {
        attemptNumber,
        reflectionPrompt,
        analysis,
        proposedFix,
        succeeded: true, // Reflection succeeded, actual retry is separate
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
      };
      attempts.push(attempt);

      // Consume retry budget
      this.consumeBudget(budgetKey);
      this.detector.recordCorrectionAttempt(failure, true);

      yield {
        type: 'correction_retrying',
        content: proposedFix,
      };

      // Build final result
      const result: CorrectionResult = {
        originalFailure: failure,
        status: 'succeeded' as CorrectionStatus,
        attempts,
        success: true,
        totalRetries: 1,
        remainingBudget: this.getRemainingBudgetWithMax(budgetKey, maxRetries),
        totalDurationMs: Date.now() - startTime,
      };

      this.emitEvent({
        type: 'correction_completed',
        result,
      });

      yield {
        type: 'correction_complete',
        result,
      };

    } catch (error) {
      // Correction attempt failed
      const attempt: CorrectionAttempt = {
        attemptNumber,
        reflectionPrompt,
        analysis: '',
        proposedFix: '',
        succeeded: false,
        error: extractErrorMessage(error),
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
      };
      attempts.push(attempt);

      this.consumeBudget(budgetKey);
      this.detector.recordCorrectionAttempt(failure, false);

      const remaining = this.getRemainingBudgetWithMax(budgetKey, maxRetries);
      const status: CorrectionStatus = remaining > 0 ? 'failed' : 'exhausted';

      const result: CorrectionResult = {
        originalFailure: failure,
        status,
        attempts,
        success: false,
        totalRetries: 1,
        remainingBudget: remaining,
        totalDurationMs: Date.now() - startTime,
      };

      // If exhausted, add acknowledgment message
      if (status === 'exhausted') {
        yield {
          type: 'correction_reflecting',
          content: buildExhaustionPrompt(failure, maxRetries),
        };
      }

      this.emitEvent({
        type: 'correction_completed',
        result,
      });

      yield {
        type: 'correction_complete',
        result,
      };
    }
  }

  /**
   * Get a unique key for tracking retries per failure
   */
  private getFailureKey(failure: FailureSignal): string {
    const args = failure.context.toolArgs;
    const filePath = failure.context.filePath || '';
    const argsStr = JSON.stringify(args, Object.keys(args).sort());
    return `${failure.context.toolName}:${filePath}:${argsStr.substring(0, 100)}`;
  }

  /**
   * Get remaining retry budget for a failure key
   */
  getRemainingBudget(key: string): number {
    const used = this.retryBudgets.get(key) || 0;
    return Math.max(0, this.config.maxRetries - used);
  }

  /**
   * Consume one retry from the budget
   */
  private consumeBudget(key: string): void {
    const current = this.retryBudgets.get(key) || 0;
    this.retryBudgets.set(key, current + 1);
  }

  /**
   * Reset retry budget for a key (called on success)
   */
  resetBudget(key: string): void {
    if (this.config.resetBudgetOnSuccess) {
      this.retryBudgets.delete(key);
    }
  }

  /**
   * Reset budget for a failure (convenience method)
   */
  resetBudgetForFailure(failure: FailureSignal): void {
    const key = this.getFailureKey(failure);
    this.resetBudget(key);
  }

  /**
   * Record successful tool execution (resets budget if configured)
   */
  recordSuccess(toolCall: LLMToolCall): void {
    if (!this.config.resetBudgetOnSuccess) {
      return;
    }

    // Build a key similar to failure key
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(toolCall.function.arguments || '{}');
    } catch {
      args = {};
    }

    const filePath = (args.path || args.file_path || args.filename || '') as string;
    const argsStr = JSON.stringify(args, Object.keys(args).sort());
    const key = `${toolCall.function.name}:${filePath}:${argsStr.substring(0, 100)}`;

    this.resetBudget(key);
  }

  /**
   * Emit a correction event
   */
  private emitEvent(event: CorrectionEvent): void {
    if (this.emitter) {
      this.emitter.emit(event.type, event);
    }
  }

  /**
   * Get detector statistics
   */
  getStats(): {
    totalFailures: number;
    totalCorrections: number;
    successfulCorrections: number;
    activeRecords: number;
    successRate: number;
    activeBudgets: number;
  } {
    const detectorStats = this.detector.getStats();
    return {
      ...detectorStats,
      activeBudgets: this.retryBudgets.size,
    };
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.detector.reset();
    this.retryBudgets.clear();
  }

  /**
   * Cleanup old records
   */
  cleanup(): void {
    this.detector.cleanup();

    // Also clean up old retry budgets (older entries may be stale)
    // For now, we keep all budgets until reset
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SelfCorrectionConfig>): void {
    this.config = { ...this.config, ...config };

    // Update detector with new patterns
    if (config.customFailurePatterns) {
      this.detector = new FailureDetector({
        customPatterns: config.customFailurePatterns,
      });
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new SelfCorrectionEngine with default configuration
 */
export function createSelfCorrectionEngine(
  config?: Partial<SelfCorrectionConfig>,
  emitter?: EventEmitter
): SelfCorrectionEngine {
  return new SelfCorrectionEngine(config, emitter);
}
