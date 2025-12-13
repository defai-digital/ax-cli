/**
 * Verification Module - Type Definitions
 *
 * Types for post-execution verification callbacks.
 *
 * @module planner/verification/types
 */

import type { PhaseResult, TaskPhase } from '../types.js';
import type {
  VerificationCallbackType,
  VerificationCallbackConfig,
} from '../../agent/config/agentic-config.js';

// Re-export shared types from agentic-config to avoid duplication
export type {
  VerificationCallbackType,
  VerificationCallbackConfig,
} from '../../agent/config/agentic-config.js';

// ============================================================================
// Verification Callback Types
// ============================================================================

/**
 * Status of a verification run
 */
export type VerificationStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'timeout';

/**
 * Result of a single verification callback
 */
export interface VerificationCallbackResult {
  /** Callback name */
  name: string;

  /** Type of verification */
  type: VerificationCallbackType;

  /** Whether verification passed */
  passed: boolean;

  /** Status of the verification */
  status: VerificationStatus;

  /** Output from the verification command */
  output: string;

  /** Error output (stderr) */
  errorOutput?: string;

  /** Exit code from the command */
  exitCode?: number;

  /** Duration in milliseconds */
  durationMs: number;

  /** Timestamp when verification started */
  startedAt: Date;

  /** Timestamp when verification completed */
  completedAt: Date;

  /** Number of issues found (if applicable) */
  issueCount?: number;

  /** Detailed issues (if available) */
  issues?: VerificationIssue[];
}

/**
 * A single verification issue
 */
export interface VerificationIssue {
  /** File path where issue was found */
  file?: string;

  /** Line number */
  line?: number;

  /** Column number */
  column?: number;

  /** Issue severity */
  severity: 'error' | 'warning' | 'info';

  /** Issue message */
  message: string;

  /** Issue code/rule */
  code?: string;
}

/**
 * Result of verifying a phase
 */
export interface PhaseVerificationResult {
  /** Phase ID */
  phaseId: string;

  /** Phase result that was verified */
  phaseResult: PhaseResult;

  /** Overall verification passed */
  passed: boolean;

  /** Results from each callback */
  callbackResults: VerificationCallbackResult[];

  /** Total duration of all verifications */
  totalDurationMs: number;

  /** Number of required callbacks that failed */
  requiredFailures: number;

  /** Number of optional callbacks that failed */
  optionalFailures: number;

  /** Timestamp when verification started */
  startedAt: Date;

  /** Timestamp when verification completed */
  completedAt: Date;
}

// ============================================================================
// Verification Events
// ============================================================================

/**
 * Event emitted when phase verification starts
 */
export interface PhaseVerifyingEvent {
  type: 'phase:verifying';
  phaseId: string;
  phase: TaskPhase;
  callbacks: VerificationCallbackConfig[];
}

/**
 * Event emitted when a single callback starts
 */
export interface CallbackStartEvent {
  type: 'verification:callback_start';
  phaseId: string;
  callback: VerificationCallbackConfig;
}

/**
 * Event emitted when a single callback completes
 */
export interface CallbackCompleteEvent {
  type: 'verification:callback_complete';
  phaseId: string;
  result: VerificationCallbackResult;
}

/**
 * Event emitted when phase verification completes
 */
export interface PhaseVerifiedEvent {
  type: 'phase:verified';
  phaseId: string;
  result: PhaseVerificationResult;
}

/**
 * Event emitted when verification fails
 */
export interface VerificationFailedEvent {
  type: 'phase:verification_failed';
  phaseId: string;
  result: PhaseVerificationResult;
  requiredFailures: VerificationCallbackResult[];
}

/**
 * All verification events
 */
export type VerificationEvent =
  | PhaseVerifyingEvent
  | CallbackStartEvent
  | CallbackCompleteEvent
  | PhaseVerifiedEvent
  | VerificationFailedEvent;

// ============================================================================
// Verification Options
// ============================================================================

/**
 * Options for running verification
 */
export interface VerificationRunOptions {
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;

  /** Override working directory */
  cwd?: string;

  /** Files modified in the phase (for scoped verification) */
  modifiedFiles?: string[];

  /** Skip optional (non-required) callbacks */
  skipOptional?: boolean;

  /** Continue running callbacks after a failure */
  continueOnFailure?: boolean;
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default TypeScript verification callback
 */
export const DEFAULT_TYPECHECK_CONFIG: VerificationCallbackConfig = {
  name: 'TypeScript Check',
  type: 'typecheck',
  enabled: true,
  timeout: 60000,
  required: true,
  scopeToModifiedFiles: false,
};

/**
 * Default ESLint verification callback (disabled by default)
 */
export const DEFAULT_LINT_CONFIG: VerificationCallbackConfig = {
  name: 'ESLint',
  type: 'lint',
  enabled: false,
  timeout: 60000,
  required: false,
  scopeToModifiedFiles: true,
};

/**
 * Default test verification callback (disabled by default)
 */
export const DEFAULT_TEST_CONFIG: VerificationCallbackConfig = {
  name: 'Tests',
  type: 'test',
  enabled: false,
  timeout: 300000, // 5 minutes
  required: false,
  scopeToModifiedFiles: true,
};
