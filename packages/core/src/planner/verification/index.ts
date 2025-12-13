/**
 * Verification Module
 *
 * Post-execution verification callbacks for plan phases.
 * Primary focus: TypeScript type checking.
 *
 * @module planner/verification
 *
 * @example
 * ```typescript
 * import {
 *   PlanVerifier,
 *   createPlanVerifier,
 *   createTypeScriptVerifier,
 * } from './verification';
 *
 * // Create TypeScript-only verifier
 * const verifier = createTypeScriptVerifier();
 *
 * // Verify after phase execution
 * const result = await verifier.verifyPhase(phase, phaseResult);
 *
 * if (!result.passed) {
 *   console.log('Verification failed:', result.requiredFailures);
 * }
 * ```
 */

// Types
export type {
  VerificationCallbackType,
  VerificationStatus,
  VerificationCallbackResult,
  VerificationIssue,
  VerificationCallbackConfig,
  PhaseVerificationResult,
  PhaseVerifyingEvent,
  CallbackStartEvent,
  CallbackCompleteEvent,
  PhaseVerifiedEvent,
  VerificationFailedEvent,
  VerificationEvent,
  VerificationRunOptions,
} from './types.js';

export {
  DEFAULT_TYPECHECK_CONFIG,
  DEFAULT_LINT_CONFIG,
  DEFAULT_TEST_CONFIG,
} from './types.js';

// Callbacks
export {
  runTypecheck,
  runLint,
  runTests,
  runCustom,
  runCallback,
  getCallbackRunner,
  CALLBACK_RUNNERS,
} from './callbacks.js';

export type {
  CallbackRunOptions,
  CallbackRunner,
} from './callbacks.js';

// Verifier
export {
  PlanVerifier,
  createPlanVerifier,
  createTypeScriptVerifier,
} from './verifier.js';
