/**
 * Self-Correction Module
 *
 * Provides failure detection and self-correction capabilities
 * for the agent loop.
 *
 * @module agent/correction
 *
 * @example
 * ```typescript
 * import {
 *   SelfCorrectionEngine,
 *   FailureDetector,
 *   createSelfCorrectionEngine
 * } from './correction';
 *
 * // Create engine with default config
 * const engine = createSelfCorrectionEngine();
 *
 * // Analyze tool result for failures
 * const failure = engine.analyzeResult(toolCall, result);
 *
 * if (failure && engine.shouldAttemptCorrection(failure)) {
 *   // Attempt correction
 *   for await (const chunk of engine.attemptCorrection(failure, llm, messages)) {
 *     console.log(chunk);
 *   }
 * }
 * ```
 */

// Types
export type {
  FailureType,
  FailureSeverity,
  FailureContext,
  FailureSignal,
  FailureSignature,
  FailureRecord,
  FailureDetectorState,
  FailureDetectionOptions,
  CorrectionStatus,
  CorrectionAttempt,
  CorrectionResult,
  FailureDetectedEvent,
  CorrectionStartedEvent,
  CorrectionCompletedEvent,
  CorrectionEvent,
} from './types.js';

export { DEFAULT_FAILURE_DETECTION_OPTIONS } from './types.js';

// Failure Detector
export { FailureDetector } from './failure-detector.js';

// Reflection Prompts
export {
  buildReflectionPrompt,
  buildQuickReflectionPrompt,
  buildExhaustionPrompt,
  buildSuccessAcknowledgment,
} from './reflection-prompts.js';

export type { ReflectionPromptOptions } from './reflection-prompts.js';

// Self-Correction Engine
export {
  SelfCorrectionEngine,
  createSelfCorrectionEngine,
} from './self-correction.js';

export type {
  CorrectionContext,
  CorrectionStreamChunk,
} from './self-correction.js';
