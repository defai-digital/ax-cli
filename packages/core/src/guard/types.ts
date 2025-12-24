/**
 * Guard System Types
 *
 * Internal types for the guard implementation.
 * Public types are exported from @defai.digital/ax-schemas.
 *
 * @packageDocumentation
 */

import type {
  GateType,
  GateResult,
  GateContext,
  GateConfig,
  GuardCheckResult,
  GuardResult,
  GuardPolicy,
  GuardMetrics,
} from '@defai.digital/ax-schemas';

// Re-export public types
export type {
  GateType,
  GateResult,
  GateContext,
  GateConfig,
  GuardCheckResult,
  GuardResult,
  GuardPolicy,
  GuardMetrics,
};

/**
 * Interface for gate implementations
 *
 * @invariant INV-GUARD-001: check() MUST NOT modify context or any external state
 * @invariant INV-GUARD-004: Same input MUST produce same output (deterministic)
 */
export interface GateImplementation {
  /**
   * Perform the security check
   *
   * @param context - Read-only context for the check
   * @param config - Optional configuration for this gate
   * @returns The result of the check
   */
  check(context: Readonly<GateContext>, config?: GateConfig): GuardCheckResult;
}

/**
 * Options for guard checks
 */
export interface GuardCheckOptions {
  /** Specific policy to use (overrides default) */
  policy?: string;

  /** Skip the check entirely */
  skip?: boolean;

  /** Extra context to merge */
  extraContext?: Partial<GateContext>;
}

/**
 * Guard configuration
 */
export interface GuardConfig {
  /** Whether the guard system is enabled */
  enabled: boolean;

  /** Default policy to use when none specified */
  defaultPolicy: string;

  /** Custom policies */
  customPolicies?: GuardPolicy[];
}

/**
 * Error thrown when guard blocks an operation
 */
export class GuardBlockedError extends Error {
  constructor(
    public readonly result: GuardResult,
    message?: string
  ) {
    super(
      message ||
        `Operation blocked by guard policy '${result.policy}': ${result.checks
          .filter((c) => c.result === 'FAIL')
          .map((c) => c.message)
          .join('; ')}`
    );
    this.name = 'GuardBlockedError';
  }

  /**
   * Get the failed checks
   */
  get failedChecks(): GuardCheckResult[] {
    return this.result.checks.filter((c) => c.result === 'FAIL');
  }

  /**
   * Get the warning checks
   */
  get warningChecks(): GuardCheckResult[] {
    return this.result.checks.filter((c) => c.result === 'WARN');
  }
}

/**
 * Hooks for guard lifecycle events
 */
export interface GuardHooks {
  /** Called before a policy check */
  onBeforeCheck?: (policyId: string, context: GateContext) => void;

  /** Called after a policy check */
  onAfterCheck?: (result: GuardResult) => void;

  /** Called when a check fails */
  onFail?: (result: GuardResult) => void;

  /** Called when a check warns */
  onWarn?: (result: GuardResult) => void;
}

/**
 * Create an empty metrics object
 */
export function createEmptyMetrics(): GuardMetrics {
  return {
    totalChecks: 0,
    passCount: 0,
    warnCount: 0,
    failCount: 0,
    averageDuration: 0,
    byGate: {} as GuardMetrics['byGate'],
    byPolicy: {},
  };
}
