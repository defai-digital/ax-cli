/**
 * Plan Verifier
 *
 * Orchestrates running verification callbacks after phase execution.
 *
 * @module planner/verification/verifier
 */

import type { EventEmitter } from 'events';
import type { PhaseResult, TaskPhase } from '../types.js';
import type { VerificationConfig } from '../../agent/config/agentic-config.js';
import { DEFAULT_VERIFICATION_CONFIG } from '../../agent/config/agentic-config.js';
import type {
  VerificationCallbackConfig,
  VerificationCallbackResult,
  PhaseVerificationResult,
  VerificationRunOptions,
  VerificationEvent,
} from './types.js';
import { DEFAULT_TYPECHECK_CONFIG } from './types.js';
import { runCallback } from './callbacks.js';

// ============================================================================
// PlanVerifier Class
// ============================================================================

/**
 * PlanVerifier - Runs verification callbacks after phase execution
 */
export class PlanVerifier {
  private config: VerificationConfig;
  private emitter?: EventEmitter;

  constructor(
    config: Partial<VerificationConfig> = {},
    emitter?: EventEmitter
  ) {
    this.config = { ...DEFAULT_VERIFICATION_CONFIG, ...config };
    this.emitter = emitter;
  }

  /**
   * Check if verification is enabled
   */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the callback configurations
   */
  get callbacks(): VerificationCallbackConfig[] {
    return this.config.callbacks;
  }

  /**
   * Verify a phase after execution
   *
   * @param phase - The phase that was executed
   * @param phaseResult - The result of phase execution
   * @param options - Verification run options
   * @returns Verification result
   */
  async verifyPhase(
    phase: TaskPhase,
    phaseResult: PhaseResult,
    options: VerificationRunOptions = {}
  ): Promise<PhaseVerificationResult> {
    const startedAt = new Date();
    const startTime = Date.now();

    // Filter enabled callbacks
    const enabledCallbacks = this.config.callbacks.filter(cb => cb.enabled !== false);

    // Skip optional if requested
    const callbacksToRun = options.skipOptional
      ? enabledCallbacks.filter(cb => cb.required)
      : enabledCallbacks;

    if (callbacksToRun.length === 0) {
      // No callbacks to run
      return {
        phaseId: phase.id,
        phaseResult,
        passed: true,
        callbackResults: [],
        totalDurationMs: 0,
        requiredFailures: 0,
        optionalFailures: 0,
        startedAt,
        completedAt: new Date(),
      };
    }

    // Emit verifying event
    this.emitEvent({
      type: 'phase:verifying',
      phaseId: phase.id,
      phase,
      callbacks: callbacksToRun,
    });

    const callbackResults: VerificationCallbackResult[] = [];
    let requiredFailures = 0;
    let optionalFailures = 0;

    // Run callbacks sequentially (to avoid overwhelming the system)
    for (const callback of callbacksToRun) {
      // Check for abort
      if (options.abortSignal?.aborted) {
        break;
      }

      // Emit callback start
      this.emitEvent({
        type: 'verification:callback_start',
        phaseId: phase.id,
        callback,
      });

      // Run the callback
      const result = await runCallback(callback, {
        cwd: options.cwd,
        abortSignal: options.abortSignal,
        modifiedFiles: options.modifiedFiles || phaseResult.filesModified,
        env: callback.env,
      });

      callbackResults.push(result);

      // Emit callback complete
      this.emitEvent({
        type: 'verification:callback_complete',
        phaseId: phase.id,
        result,
      });

      // Track failures
      if (!result.passed) {
        if (callback.required) {
          requiredFailures++;
        } else {
          optionalFailures++;
        }

        // Stop on required failure if not continuing
        if (callback.required && !options.continueOnFailure) {
          break;
        }
      }
    }

    const completedAt = new Date();
    const totalDurationMs = Date.now() - startTime;

    const verificationResult: PhaseVerificationResult = {
      phaseId: phase.id,
      phaseResult,
      passed: requiredFailures === 0,
      callbackResults,
      totalDurationMs,
      requiredFailures,
      optionalFailures,
      startedAt,
      completedAt,
    };

    // Emit appropriate event
    if (verificationResult.passed) {
      this.emitEvent({
        type: 'phase:verified',
        phaseId: phase.id,
        result: verificationResult,
      });
    } else {
      this.emitEvent({
        type: 'phase:verification_failed',
        phaseId: phase.id,
        result: verificationResult,
        requiredFailures: callbackResults.filter(
          (r, i) => !r.passed && callbacksToRun[i]?.required
        ),
      });
    }

    return verificationResult;
  }

  /**
   * Run only TypeScript verification (convenience method)
   */
  async verifyTypeScript(
    _phase: TaskPhase,
    phaseResult: PhaseResult,
    options: VerificationRunOptions = {}
  ): Promise<VerificationCallbackResult> {
    const typecheckConfig = this.config.callbacks.find(cb => cb.type === 'typecheck')
      || DEFAULT_TYPECHECK_CONFIG;

    return runCallback(typecheckConfig, {
      cwd: options.cwd,
      abortSignal: options.abortSignal,
      modifiedFiles: options.modifiedFiles || phaseResult.filesModified,
    });
  }

  /**
   * Check if verification should attempt correction on failure
   */
  shouldAttemptCorrection(): boolean {
    return this.config.attemptCorrectionOnFailure;
  }

  /**
   * Check if verification should roll back changes on failure
   */
  shouldRollbackOnFailure(): boolean {
    return this.config.rollbackOnFailure;
  }

  /**
   * Check if verification should run after each phase
   */
  shouldVerifyAfterEachPhase(): boolean {
    return this.config.verifyAfterEachPhase;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VerificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Add a custom callback
   */
  addCallback(callback: VerificationCallbackConfig): void {
    this.config.callbacks.push(callback);
  }

  /**
   * Remove a callback by name
   */
  removeCallback(name: string): void {
    this.config.callbacks = this.config.callbacks.filter(cb => cb.name !== name);
  }

  /**
   * Enable or disable a callback by name
   */
  setCallbackEnabled(name: string, enabled: boolean): void {
    const callback = this.config.callbacks.find(cb => cb.name === name);
    if (callback) {
      callback.enabled = enabled;
    }
  }

  /**
   * Emit a verification event
   */
  private emitEvent(event: VerificationEvent): void {
    if (this.emitter) {
      this.emitter.emit(event.type, event);
    }
  }

  /**
   * Get verification statistics
   */
  getStats(): {
    enabled: boolean;
    callbackCount: number;
    enabledCallbackCount: number;
    requiredCallbackCount: number;
  } {
    const enabledCallbacks = this.config.callbacks.filter(cb => cb.enabled !== false);
    const requiredCallbacks = enabledCallbacks.filter(cb => cb.required);

    return {
      enabled: this.config.enabled,
      callbackCount: this.config.callbacks.length,
      enabledCallbackCount: enabledCallbacks.length,
      requiredCallbackCount: requiredCallbacks.length,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new PlanVerifier with default TypeScript verification
 */
export function createPlanVerifier(
  config?: Partial<VerificationConfig>,
  emitter?: EventEmitter
): PlanVerifier {
  return new PlanVerifier(config, emitter);
}

/**
 * Create a TypeScript-only verifier
 */
export function createTypeScriptVerifier(
  emitter?: EventEmitter
): PlanVerifier {
  return new PlanVerifier(
    {
      enabled: true,
      callbacks: [DEFAULT_TYPECHECK_CONFIG],
      rollbackOnFailure: false,
      verifyAfterEachPhase: false,
      attemptCorrectionOnFailure: true,
    },
    emitter
  );
}
