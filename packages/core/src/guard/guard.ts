/**
 * Guard - Security Governance Orchestrator
 *
 * The main Guard class orchestrates security checks across multiple gates.
 *
 * @invariant INV-GUARD-001: Guard MUST NOT modify any state, only read and validate
 * @invariant INV-GUARD-002: All gates in policy MUST be evaluated, even after FAIL
 * @invariant INV-GUARD-003: Any FAIL gate makes overall result FAIL
 * @invariant INV-GUARD-004: Same input MUST produce same guard result (deterministic)
 * @invariant INV-GUARD-005: Path checks MUST normalize paths before comparison
 *
 * @packageDocumentation
 */

import type {
  GateType,
  GateContext,
  GateConfig,
  GuardCheckResult,
  GuardResult,
  GuardPolicy,
  GuardMetrics,
} from '@defai.digital/ax-schemas';
import { computeOverallResult } from '@defai.digital/ax-schemas';

import type { GateImplementation, GuardHooks } from './types.js';
import { createEmptyMetrics } from './types.js';
import {
  PathViolationGate,
  CredentialExposureGate,
  InjectionAttemptGate,
  SchemaViolationGate,
} from './gates/index.js';
import { DEFAULT_POLICIES } from './policies.js';

/**
 * Deep freeze an object to prevent any modifications
 * This ensures INV-GUARD-001: Guard MUST NOT modify any state
 */
function deepFreeze<T extends object>(obj: T): Readonly<T> {
  // Get all property names (including symbols)
  const propNames = Object.getOwnPropertyNames(obj);

  // Freeze each property value before freezing the object itself
  for (const name of propNames) {
    const value = (obj as Record<string, unknown>)[name];

    // Only freeze plain objects and arrays, skip functions and primitives
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  }

  return Object.freeze(obj);
}

/**
 * Guard configuration options
 */
export interface GuardOptions {
  /** Whether the guard is enabled */
  enabled?: boolean;

  /** Default policy to use */
  defaultPolicy?: string;

  /** Custom policies to register */
  customPolicies?: GuardPolicy[];

  /** Lifecycle hooks */
  hooks?: GuardHooks;
}

/**
 * Counter for generating unique temporary policy IDs
 * This prevents race conditions when checkWithPolicy is called multiple times
 */
let tempPolicyCounter = 0;

/**
 * Guard - Security Governance Orchestrator
 */
export class Guard {
  private gates = new Map<GateType, GateImplementation>();
  private policies = new Map<string, GuardPolicy>();
  private metrics: GuardMetrics = createEmptyMetrics();
  private enabled: boolean;
  private defaultPolicy: string;
  private hooks: GuardHooks;

  constructor(options: GuardOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.defaultPolicy = options.defaultPolicy ?? 'tool-execution';
    this.hooks = options.hooks ?? {};

    // Register default gates
    this.registerDefaultGates();

    // Register default policies
    this.registerDefaultPolicies();

    // Register custom policies
    if (options.customPolicies) {
      for (const policy of options.customPolicies) {
        this.registerPolicy(policy);
      }
    }
  }

  /**
   * Register the default gate implementations
   */
  private registerDefaultGates(): void {
    this.gates.set('path_violation', new PathViolationGate());
    this.gates.set('credential_exposure', new CredentialExposureGate());
    this.gates.set('injection_attempt', new InjectionAttemptGate());
    this.gates.set('schema_violation', new SchemaViolationGate());
  }

  /**
   * Register the default policies
   */
  private registerDefaultPolicies(): void {
    for (const policy of DEFAULT_POLICIES) {
      this.policies.set(policy.id, policy);
    }
  }

  /**
   * Register a gate implementation
   */
  registerGate(type: GateType, implementation: GateImplementation): void {
    this.gates.set(type, implementation);
  }

  /**
   * Register a policy
   */
  registerPolicy(policy: GuardPolicy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Get a registered policy
   */
  getPolicy(policyId: string): GuardPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Check if the guard is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable the guard
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable the guard
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Perform a guard check
   *
   * @param policyId - The policy to use
   * @param context - The context for the check
   * @param configOverrides - Optional config overrides to merge with policy config
   * @returns The guard result
   */
  check(
    policyId: string,
    context: GateContext,
    configOverrides?: Record<string, Record<string, unknown>>
  ): GuardResult {
    const startTime = Date.now();

    // If disabled, return PASS
    if (!this.enabled) {
      return this.createPassResult(policyId, startTime);
    }

    // Get the policy
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Unknown guard policy: ${policyId}`);
    }

    // Check if policy is enabled
    if (!policy.enabled) {
      return this.createPassResult(policyId, startTime);
    }

    // Call beforeCheck hook
    this.hooks.onBeforeCheck?.(policyId, context);

    // INV-GUARD-001: Deep copy and freeze context to prevent any modification
    // We need to deep copy first because deepFreeze modifies the object in place
    const contextCopy = JSON.parse(JSON.stringify(context)) as GateContext;
    const frozenContext = deepFreeze(contextCopy);

    // INV-GUARD-002: Evaluate ALL gates, no early return
    const checks: GuardCheckResult[] = [];

    for (const gateType of policy.gates) {
      const gate = this.gates.get(gateType);

      if (!gate) {
        console.warn(`Gate '${gateType}' not registered, skipping`);
        continue;
      }

      // Get gate-specific config, merging policy config with overrides
      const policyGateConfig = policy.config?.[gateType] as Record<string, unknown> | undefined;
      const overrideGateConfig = configOverrides?.[gateType];
      const gateConfig = overrideGateConfig
        ? { ...policyGateConfig, ...overrideGateConfig } as GateConfig
        : policyGateConfig as GateConfig | undefined;

      // Execute the gate check
      const result = gate.check(frozenContext, gateConfig);
      checks.push(result);

      // Update gate metrics
      this.updateGateMetrics(gateType, result.result);
    }

    // INV-GUARD-003: Compute overall result (FAIL if any FAIL)
    const overallResult = computeOverallResult(checks);

    const guardResult: GuardResult = {
      policy: policyId,
      overallResult,
      checks,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    };

    // Update metrics
    this.updatePolicyMetrics(policyId, overallResult, guardResult.duration);

    // Call afterCheck hook
    this.hooks.onAfterCheck?.(guardResult);

    // Call specific hooks
    if (overallResult === 'FAIL') {
      this.hooks.onFail?.(guardResult);
    } else if (overallResult === 'WARN') {
      this.hooks.onWarn?.(guardResult);
    }

    return guardResult;
  }

  /**
   * Check with the default policy
   */
  checkDefault(context: GateContext): GuardResult {
    return this.check(this.defaultPolicy, context);
  }

  /**
   * Check with a specific policy (convenience method)
   *
   * Uses a unique counter to avoid race conditions when called multiple times
   * in rapid succession (within the same millisecond).
   */
  checkWithPolicy(policy: GuardPolicy, context: GateContext): GuardResult {
    // Temporarily register the policy with unique ID
    // Counter ensures uniqueness even when called multiple times in same millisecond
    const tempId = `temp_${Date.now()}_${++tempPolicyCounter}`;
    const tempPolicy = { ...policy, id: tempId };
    this.policies.set(tempId, tempPolicy);

    try {
      return this.check(tempId, context);
    } finally {
      // Clean up
      this.policies.delete(tempId);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): GuardMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = createEmptyMetrics();
  }

  /**
   * Create a PASS result (used when disabled)
   */
  private createPassResult(policyId: string, startTime: number): GuardResult {
    return {
      policy: policyId,
      overallResult: 'PASS',
      checks: [],
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Update gate-level metrics
   */
  private updateGateMetrics(gateType: GateType, result: 'PASS' | 'WARN' | 'FAIL'): void {
    if (!this.metrics.byGate[gateType]) {
      this.metrics.byGate[gateType] = {
        total: 0,
        pass: 0,
        warn: 0,
        fail: 0,
      };
    }

    const gateMetrics = this.metrics.byGate[gateType]!;
    gateMetrics.total++;

    switch (result) {
      case 'PASS':
        gateMetrics.pass++;
        break;
      case 'WARN':
        gateMetrics.warn++;
        break;
      case 'FAIL':
        gateMetrics.fail++;
        break;
    }
  }

  /**
   * Update policy-level metrics
   */
  private updatePolicyMetrics(
    policyId: string,
    result: 'PASS' | 'WARN' | 'FAIL',
    duration: number
  ): void {
    this.metrics.totalChecks++;

    switch (result) {
      case 'PASS':
        this.metrics.passCount++;
        break;
      case 'WARN':
        this.metrics.warnCount++;
        break;
      case 'FAIL':
        this.metrics.failCount++;
        break;
    }

    // Update average duration
    this.metrics.averageDuration =
      (this.metrics.averageDuration * (this.metrics.totalChecks - 1) + duration) /
      this.metrics.totalChecks;

    // Update policy metrics
    if (!this.metrics.byPolicy[policyId]) {
      this.metrics.byPolicy[policyId] = {
        total: 0,
        pass: 0,
        warn: 0,
        fail: 0,
      };
    }

    const policyMetrics = this.metrics.byPolicy[policyId]!;
    policyMetrics.total++;

    switch (result) {
      case 'PASS':
        policyMetrics.pass++;
        break;
      case 'WARN':
        policyMetrics.warn++;
        break;
      case 'FAIL':
        policyMetrics.fail++;
        break;
    }
  }
}

/**
 * Create a new Guard instance with default configuration
 */
export function createGuard(options?: GuardOptions): Guard {
  return new Guard(options);
}

/**
 * Singleton guard instance for convenience
 */
let defaultGuard: Guard | null = null;

/**
 * Get or create the default guard instance
 */
export function getDefaultGuard(): Guard {
  if (!defaultGuard) {
    defaultGuard = createGuard();
  }
  return defaultGuard;
}

/**
 * Reset the default guard instance (for testing)
 */
export function resetDefaultGuard(): void {
  defaultGuard = null;
}
