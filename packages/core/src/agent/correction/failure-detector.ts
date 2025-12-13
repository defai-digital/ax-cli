/**
 * Failure Detector
 *
 * Detects failure patterns in tool executions and determines
 * when self-correction should be triggered.
 *
 * Integrates with the existing LoopDetector for loop-based failures.
 *
 * @module agent/correction/failure-detector
 */

import { createHash } from 'crypto';
import type { LLMToolCall } from '../../llm/client.js';
import type { ToolResult } from '../../types/index.js';
import type { LoopDetectionResult } from '../loop-detector.js';
import type {
  FailureSignal,
  FailureType,
  FailureSeverity,
  FailureContext,
  FailureSignature,
  FailureDetectorState,
  FailureDetectionOptions,
} from './types.js';
import { DEFAULT_FAILURE_DETECTION_OPTIONS } from './types.js';

/**
 * Generates unique IDs for failure signals
 */
function generateFailureId(): string {
  return `fail_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Creates a hash of tool arguments for signature matching
 */
function hashArgs(args: Record<string, unknown>): string {
  const normalized = JSON.stringify(args, Object.keys(args).sort());
  return createHash('md5').update(normalized).digest('hex').substring(0, 12);
}

/**
 * Extracts file path from tool arguments if present
 */
function extractFilePath(args: Record<string, unknown>): string | undefined {
  return (args.path || args.file_path || args.filename) as string | undefined;
}

/**
 * Severity mapping for failure types
 */
const FAILURE_SEVERITY_MAP: Record<FailureType, FailureSeverity> = {
  tool_error: 'medium',
  repeated_failure: 'high',
  no_progress: 'medium',
  loop_detected: 'high',
  validation_error: 'low',
  timeout: 'medium',
  custom: 'medium',
};

/**
 * Common error patterns that indicate specific failure types
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp; type: FailureType; severity: FailureSeverity }> = [
  // File not found errors
  { pattern: /ENOENT|no such file|file not found/i, type: 'tool_error', severity: 'medium' },
  // Permission errors
  { pattern: /EACCES|permission denied|access denied/i, type: 'tool_error', severity: 'high' },
  // Syntax/parse errors
  { pattern: /syntax error|parse error|unexpected token/i, type: 'validation_error', severity: 'medium' },
  // Timeout patterns
  { pattern: /timeout|timed out|deadline exceeded/i, type: 'timeout', severity: 'medium' },
  // Search not found (might indicate wrong approach)
  { pattern: /no matches found|nothing found|0 results/i, type: 'no_progress', severity: 'low' },
  // Edit failures
  { pattern: /old_string not found|no match for replacement|string not found/i, type: 'tool_error', severity: 'high' },
];

/**
 * FailureDetector - Identifies failures and determines correction eligibility
 */
export class FailureDetector {
  private state: FailureDetectorState;
  private options: FailureDetectionOptions;
  private customPatterns: RegExp[];

  constructor(options: Partial<FailureDetectionOptions> = {}) {
    this.options = { ...DEFAULT_FAILURE_DETECTION_OPTIONS, ...options };
    this.customPatterns = this.options.customPatterns.map(p => new RegExp(p, 'i'));
    this.state = this.createInitialState();
  }

  /**
   * Create fresh detector state
   */
  private createInitialState(): FailureDetectorState {
    return {
      records: new Map(),
      recentCalls: [],
      totalFailures: 0,
      totalCorrections: 0,
      successfulCorrections: 0,
    };
  }

  /**
   * Analyze a tool result and detect any failures
   *
   * @param toolCall - The tool call that was executed
   * @param result - The result from execution
   * @param loopResult - Optional loop detection result
   * @returns FailureSignal if failure detected, null otherwise
   */
  detectFailure(
    toolCall: LLMToolCall,
    result: ToolResult,
    loopResult?: LoopDetectionResult
  ): FailureSignal | null {
    // Parse arguments safely
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(toolCall.function.arguments || '{}');
    } catch {
      args = {};
    }

    // Record this call
    this.recordCall(toolCall, result);

    // Check for various failure conditions
    const failure = this.checkForFailure(toolCall, result, args, loopResult);

    if (failure) {
      this.recordFailure(failure);
      return failure;
    }

    return null;
  }

  /**
   * Check all failure conditions
   */
  private checkForFailure(
    toolCall: LLMToolCall,
    result: ToolResult,
    args: Record<string, unknown>,
    loopResult?: LoopDetectionResult
  ): FailureSignal | null {
    const toolName = toolCall.function.name;
    const filePath = extractFilePath(args);
    const signature = this.createSignature(toolName, args);

    // 1. Check for tool execution error
    if (!result.success) {
      return this.createFailureSignal(
        'tool_error',
        toolName,
        args,
        result.error,
        filePath,
        undefined,
        signature
      );
    }

    // 2. Check for loop detection
    if (this.options.includeLoopDetection && loopResult?.isLoop) {
      return this.createFailureSignal(
        'loop_detected',
        toolName,
        args,
        loopResult.reason,
        filePath,
        loopResult,
        signature
      );
    }

    // 3. Check for repeated failures (same signature failed before)
    const record = this.state.records.get(this.signatureToString(signature));
    if (record && record.failures.length >= 2 && !record.everSucceeded) {
      return this.createFailureSignal(
        'repeated_failure',
        toolName,
        args,
        `Same operation failed ${record.failures.length} times`,
        filePath,
        undefined,
        signature
      );
    }

    // 4. Check for custom patterns in output
    const output = result.output || '';
    for (let i = 0; i < this.customPatterns.length; i++) {
      if (this.customPatterns[i].test(output)) {
        return this.createFailureSignal(
          'custom',
          toolName,
          args,
          `Custom pattern matched: ${this.options.customPatterns[i]}`,
          filePath,
          undefined,
          signature,
          this.options.customPatterns[i]
        );
      }
    }

    // 5. Check for known error patterns in successful but problematic results
    const errorPattern = this.matchErrorPattern(output);
    if (errorPattern) {
      return this.createFailureSignal(
        errorPattern.type,
        toolName,
        args,
        `Pattern detected: ${errorPattern.pattern.source}`,
        filePath,
        undefined,
        signature
      );
    }

    // No failure detected
    return null;
  }

  /**
   * Match output against known error patterns
   */
  private matchErrorPattern(
    output: string
  ): { pattern: RegExp; type: FailureType; severity: FailureSeverity } | null {
    for (const { pattern, type, severity } of ERROR_PATTERNS) {
      if (pattern.test(output)) {
        return { pattern, type, severity };
      }
    }
    return null;
  }

  /**
   * Create a failure signal
   */
  private createFailureSignal(
    type: FailureType,
    toolName: string,
    args: Record<string, unknown>,
    errorMessage: string | undefined,
    filePath: string | undefined,
    loopResult: LoopDetectionResult | undefined,
    signature: FailureSignature,
    matchedPattern?: string
  ): FailureSignal {
    const record = this.state.records.get(this.signatureToString(signature));
    const attemptCount = record ? record.failures.length + 1 : 1;

    // Determine severity
    let severity = FAILURE_SEVERITY_MAP[type];

    // Escalate severity for repeated failures
    if (attemptCount >= 3) {
      severity = 'high';
    }
    if (attemptCount >= 5) {
      severity = 'critical';
    }

    const context: FailureContext = {
      toolName,
      toolArgs: args,
      errorMessage,
      attemptCount,
      filePath,
      loopResult,
      matchedPattern,
      timestamp: new Date(),
    };

    return {
      id: generateFailureId(),
      type,
      severity,
      context,
      suggestion: this.generateSuggestion(type, toolName, args, errorMessage),
      recoverable: this.isRecoverable(type, severity, attemptCount),
    };
  }

  /**
   * Generate a suggestion for fixing the failure
   */
  private generateSuggestion(
    type: FailureType,
    toolName: string,
    _args: Record<string, unknown>,
    errorMessage?: string
  ): string {
    switch (type) {
      case 'tool_error':
        if (errorMessage?.includes('not found')) {
          return `The file or resource may not exist. Try searching for it first or check the path.`;
        }
        if (errorMessage?.includes('permission')) {
          return `Permission denied. Check if the file is writable or try a different approach.`;
        }
        if (errorMessage?.includes('old_string not found')) {
          return `The text to replace was not found. Read the file first to get the exact content.`;
        }
        return `Review the error message and adjust the ${toolName} arguments accordingly.`;

      case 'repeated_failure':
        return `This operation has failed multiple times. Consider a completely different approach.`;

      case 'loop_detected':
        return `You appear to be repeating the same actions. Step back and try a new strategy.`;

      case 'no_progress':
        return `No meaningful progress is being made. Re-evaluate your approach to the problem.`;

      case 'validation_error':
        return `The tool arguments appear to be invalid. Check the expected format.`;

      case 'timeout':
        return `The operation timed out. Try breaking it into smaller steps or use a simpler approach.`;

      case 'custom':
        return `A problematic pattern was detected in the output. Review and adjust.`;

      default:
        return `An unexpected error occurred. Review and try again.`;
    }
  }

  /**
   * Determine if a failure is recoverable through correction
   */
  private isRecoverable(
    _type: FailureType,
    severity: FailureSeverity,
    attemptCount: number
  ): boolean {
    // Too many attempts - not recoverable
    if (attemptCount >= 5) {
      return false;
    }

    // Critical severity usually means fundamental issue
    if (severity === 'critical') {
      return false;
    }

    // Most failure types are recoverable with reflection
    return true;
  }

  /**
   * Create a signature for a tool call
   */
  private createSignature(
    toolName: string,
    args: Record<string, unknown>
  ): FailureSignature {
    return {
      tool: toolName,
      argsHash: hashArgs(args),
      filePath: extractFilePath(args),
    };
  }

  /**
   * Convert signature to string key
   */
  private signatureToString(sig: FailureSignature): string {
    return `${sig.tool}:${sig.argsHash}:${sig.filePath || ''}`;
  }

  /**
   * Record a tool call in history
   */
  private recordCall(toolCall: LLMToolCall, result: ToolResult): void {
    this.state.recentCalls.push({
      toolCall,
      result,
      timestamp: new Date(),
    });

    // Trim history
    const cutoff = Date.now() - this.options.failureHistoryWindowMs;
    this.state.recentCalls = this.state.recentCalls.filter(
      c => c.timestamp.getTime() > cutoff
    );
  }

  /**
   * Record a detected failure
   */
  private recordFailure(failure: FailureSignal): void {
    const sigStr = this.signatureToString({
      tool: failure.context.toolName,
      argsHash: hashArgs(failure.context.toolArgs),
      filePath: failure.context.filePath,
    });

    let record = this.state.records.get(sigStr);
    if (!record) {
      record = {
        signature: {
          tool: failure.context.toolName,
          argsHash: hashArgs(failure.context.toolArgs),
          filePath: failure.context.filePath,
        },
        failures: [],
        correctionAttempts: 0,
        everSucceeded: false,
        lastFailureAt: new Date(),
      };
      this.state.records.set(sigStr, record);
    }

    record.failures.push(failure);
    record.lastFailureAt = new Date();

    // Trim failures per signature
    if (record.failures.length > this.options.maxFailuresPerSignature) {
      record.failures = record.failures.slice(-this.options.maxFailuresPerSignature);
    }

    this.state.totalFailures++;
  }

  /**
   * Record that a correction was attempted
   */
  recordCorrectionAttempt(failure: FailureSignal, succeeded: boolean): void {
    const sigStr = this.signatureToString({
      tool: failure.context.toolName,
      argsHash: hashArgs(failure.context.toolArgs),
      filePath: failure.context.filePath,
    });

    const record = this.state.records.get(sigStr);
    if (record) {
      record.correctionAttempts++;
      if (succeeded) {
        record.everSucceeded = true;
        this.state.successfulCorrections++;
      }
    }

    this.state.totalCorrections++;
  }

  /**
   * Check if correction should be attempted for a failure
   */
  shouldAttemptCorrection(failure: FailureSignal): boolean {
    // Not recoverable
    if (!failure.recoverable) {
      return false;
    }

    // Below minimum severity threshold
    const severityOrder: FailureSeverity[] = ['low', 'medium', 'high', 'critical'];
    const failureSeverityIndex = severityOrder.indexOf(failure.severity);
    const minSeverityIndex = severityOrder.indexOf(this.options.minSeverityForCorrection);

    if (failureSeverityIndex < minSeverityIndex) {
      return false;
    }

    return true;
  }

  /**
   * Get current detector statistics
   */
  getStats(): {
    totalFailures: number;
    totalCorrections: number;
    successfulCorrections: number;
    activeRecords: number;
    successRate: number;
  } {
    const successRate = this.state.totalCorrections > 0
      ? this.state.successfulCorrections / this.state.totalCorrections
      : 0;

    return {
      totalFailures: this.state.totalFailures,
      totalCorrections: this.state.totalCorrections,
      successfulCorrections: this.state.successfulCorrections,
      activeRecords: this.state.records.size,
      successRate,
    };
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.state = this.createInitialState();
  }

  /**
   * Clean up old records
   */
  cleanup(): void {
    const cutoff = Date.now() - this.options.failureHistoryWindowMs;

    for (const [key, record] of this.state.records) {
      if (record.lastFailureAt.getTime() < cutoff) {
        this.state.records.delete(key);
      }
    }
  }
}
