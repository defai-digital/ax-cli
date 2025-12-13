/**
 * Self-Correction Module - Type Definitions
 *
 * Types for failure detection, correction attempts, and recovery.
 *
 * @module agent/correction/types
 */

import type { LLMToolCall } from '../../llm/client.js';
import type { ToolResult } from '../../types/index.js';
import type { LoopDetectionResult } from '../loop-detector.js';

// ============================================================================
// Failure Detection Types
// ============================================================================

/**
 * Types of failures that can trigger correction
 */
export type FailureType =
  | 'tool_error'        // Tool execution returned error
  | 'repeated_failure'  // Same tool failed multiple times
  | 'no_progress'       // Agent making no meaningful progress
  | 'loop_detected'     // Infinite loop pattern detected
  | 'validation_error'  // Tool arguments failed validation
  | 'timeout'           // Operation timed out
  | 'custom';           // Custom pattern matched

/**
 * Severity levels for failures
 */
export type FailureSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Context about the failure for reflection
 */
export interface FailureContext {
  /** Name of the tool that failed */
  toolName: string;

  /** Parsed tool arguments */
  toolArgs: Record<string, unknown>;

  /** Error message if available */
  errorMessage?: string;

  /** Number of attempts made */
  attemptCount: number;

  /** File path if applicable */
  filePath?: string;

  /** Loop detection result if applicable */
  loopResult?: LoopDetectionResult;

  /** Pattern that matched (for custom failures) */
  matchedPattern?: string;

  /** Timestamp of the failure */
  timestamp: Date;
}

/**
 * A detected failure signal
 */
export interface FailureSignal {
  /** Unique identifier for this failure instance */
  id: string;

  /** Type of failure detected */
  type: FailureType;

  /** Severity assessment */
  severity: FailureSeverity;

  /** Detailed context */
  context: FailureContext;

  /** Suggested action (from detection logic) */
  suggestion?: string;

  /** Whether this failure is recoverable */
  recoverable: boolean;
}

// ============================================================================
// Correction Types
// ============================================================================

/**
 * Status of a correction attempt
 */
export type CorrectionStatus =
  | 'pending'     // Not yet attempted
  | 'reflecting'  // LLM analyzing the failure
  | 'retrying'    // Attempting the corrected action
  | 'succeeded'   // Correction worked
  | 'failed'      // Correction did not help
  | 'exhausted';  // Retry budget depleted

/**
 * Result of a single correction attempt
 */
export interface CorrectionAttempt {
  /** Attempt number (1-indexed) */
  attemptNumber: number;

  /** The reflection prompt sent to LLM */
  reflectionPrompt: string;

  /** LLM's analysis of what went wrong */
  analysis: string;

  /** LLM's proposed fix */
  proposedFix: string;

  /** Whether this attempt succeeded */
  succeeded: boolean;

  /** Error if attempt failed */
  error?: string;

  /** Duration of the attempt in ms */
  durationMs: number;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Complete result of a correction process
 */
export interface CorrectionResult {
  /** The original failure that triggered correction */
  originalFailure: FailureSignal;

  /** Final status after all attempts */
  status: CorrectionStatus;

  /** All correction attempts made */
  attempts: CorrectionAttempt[];

  /** Whether the correction ultimately succeeded */
  success: boolean;

  /** Total retries used */
  totalRetries: number;

  /** Remaining retry budget */
  remainingBudget: number;

  /** Total duration of correction process */
  totalDurationMs: number;

  /** Final tool result (if retry succeeded) */
  finalResult?: ToolResult;
}

// ============================================================================
// Failure History Types
// ============================================================================

/**
 * Signature for identifying similar failures
 */
export interface FailureSignature {
  /** Tool name */
  tool: string;

  /** Hash of relevant arguments */
  argsHash: string;

  /** Optional file path */
  filePath?: string;
}

/**
 * Record of past failures for pattern detection
 */
export interface FailureRecord {
  /** Failure signature */
  signature: FailureSignature;

  /** List of failure signals with this signature */
  failures: FailureSignal[];

  /** Number of correction attempts made */
  correctionAttempts: number;

  /** Whether any correction succeeded */
  everSucceeded: boolean;

  /** Last failure timestamp */
  lastFailureAt: Date;
}

// ============================================================================
// Detector State Types
// ============================================================================

/**
 * State maintained by the failure detector
 */
export interface FailureDetectorState {
  /** Active failure records by signature string */
  records: Map<string, FailureRecord>;

  /** Recent tool calls for sequence analysis */
  recentCalls: Array<{
    toolCall: LLMToolCall;
    result: ToolResult;
    timestamp: Date;
  }>;

  /** Total failures detected this session */
  totalFailures: number;

  /** Total corrections attempted */
  totalCorrections: number;

  /** Total successful corrections */
  successfulCorrections: number;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event emitted when a failure is detected
 */
export interface FailureDetectedEvent {
  type: 'failure_detected';
  failure: FailureSignal;
  willAttemptCorrection: boolean;
}

/**
 * Event emitted when correction starts
 */
export interface CorrectionStartedEvent {
  type: 'correction_started';
  failure: FailureSignal;
  attemptNumber: number;
  maxRetries: number;
}

/**
 * Event emitted when correction completes
 */
export interface CorrectionCompletedEvent {
  type: 'correction_completed';
  result: CorrectionResult;
}

/**
 * All correction-related events
 */
export type CorrectionEvent =
  | FailureDetectedEvent
  | CorrectionStartedEvent
  | CorrectionCompletedEvent;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Options for failure detection
 */
export interface FailureDetectionOptions {
  /** Include loop detector integration */
  includeLoopDetection: boolean;

  /** Custom patterns to detect (regex strings) */
  customPatterns: string[];

  /** Minimum severity to trigger correction */
  minSeverityForCorrection: FailureSeverity;

  /** Maximum failures to track per signature */
  maxFailuresPerSignature: number;

  /** Time window for failure history (ms) */
  failureHistoryWindowMs: number;
}

/**
 * Default failure detection options
 */
export const DEFAULT_FAILURE_DETECTION_OPTIONS: FailureDetectionOptions = {
  includeLoopDetection: true,
  customPatterns: [],
  minSeverityForCorrection: 'medium',
  maxFailuresPerSignature: 10,
  failureHistoryWindowMs: 5 * 60 * 1000, // 5 minutes
};
