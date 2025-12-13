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
import { FailureDetector } from './failure-detector.js';
import {
  buildReflectionPrompt,
  buildQuickReflectionPrompt,
  buildExhaustionPrompt,
} from './reflection-prompts.js';
import type {
  FailureSignal,
  CorrectionResult,
  CorrectionAttempt,
  CorrectionStatus,
  CorrectionEvent,
} from './types.js';

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

    // Check retry budget
    const budgetKey = this.getFailureKey(failure);
    const remaining = this.getRemainingBudget(budgetKey);

    return remaining > 0;
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

    // Emit start event
    this.emitEvent({
      type: 'correction_started',
      failure,
      attemptNumber: 1,
      maxRetries: this.config.maxRetries,
    });

    yield {
      type: 'correction_start',
      failure,
      attempt: 1,
      maxRetries: this.config.maxRetries,
    };

    // Build reflection prompt
    const reflectionPrompt = this.config.reflectionDepth === 'deep'
      ? buildReflectionPrompt({
          failure,
          depth: 'deep',
          recentHistory: context.recentHistory,
          originalTask: context.originalTask,
          additionalContext: context.additionalContext,
        })
      : buildQuickReflectionPrompt(failure);

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
        attemptNumber: 1,
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
        remainingBudget: this.getRemainingBudget(budgetKey),
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
        attemptNumber: 1,
        reflectionPrompt,
        analysis: '',
        proposedFix: '',
        succeeded: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
      };
      attempts.push(attempt);

      this.consumeBudget(budgetKey);
      this.detector.recordCorrectionAttempt(failure, false);

      const remaining = this.getRemainingBudget(budgetKey);
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
          content: buildExhaustionPrompt(failure, this.config.maxRetries),
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
