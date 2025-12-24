/**
 * Guard System - Security Governance Layer
 *
 * The Guard System provides a security governance layer that validates
 * operations before execution, preventing dangerous actions like path
 * traversal attacks, credential exposure, and injection attempts.
 *
 * ## Usage
 *
 * ```typescript
 * import { createGuard, getDefaultGuard } from '@defai.digital/ax-core/guard';
 *
 * // Create a new guard instance
 * const guard = createGuard();
 *
 * // Check an operation
 * const result = guard.check('file-write', {
 *   cwd: process.cwd(),
 *   filePath: '/some/path/file.txt',
 *   content: 'file content'
 * });
 *
 * if (result.overallResult === 'FAIL') {
 *   console.error('Operation blocked:', result.checks);
 * }
 * ```
 *
 * ## Invariants
 *
 * - INV-GUARD-001: Guard MUST NOT modify any state, only read and validate
 * - INV-GUARD-002: All gates in policy MUST be evaluated, even after FAIL
 * - INV-GUARD-003: Any FAIL gate makes overall result FAIL
 * - INV-GUARD-004: Same input MUST produce same guard result (deterministic)
 * - INV-GUARD-005: Path checks MUST normalize paths before comparison
 *
 * @packageDocumentation
 */

// Types
export type {
  GateImplementation,
  GuardCheckOptions,
  GuardConfig,
  GuardHooks,
} from './types.js';

export { GuardBlockedError, createEmptyMetrics } from './types.js';

// Re-export schema types
export type {
  GateType,
  GateResult,
  GateContext,
  GateConfig,
  GuardCheckResult,
  GuardResult,
  GuardPolicy,
  GuardMetrics,
  PathViolationConfig,
  CredentialExposureConfig,
  InjectionAttemptConfig,
  SchemaViolationConfig,
} from '@defai.digital/ax-schemas';

export {
  computeOverallResult,
  normalizePath,
  isPathUnder,
  validateGateContext,
  safeParseGateContext,
  validateGuardPolicy,
  safeParseGuardPolicy,
  validateGuardResult,
} from '@defai.digital/ax-schemas';

// Guard class
export {
  Guard,
  createGuard,
  getDefaultGuard,
  resetDefaultGuard,
  type GuardOptions,
} from './guard.js';

// Gates
export {
  PathViolationGate,
  CredentialExposureGate,
  InjectionAttemptGate,
  SchemaViolationGate,
  registerToolSchema,
  getToolSchema,
  clearToolSchemas,
} from './gates/index.js';

// Policies
export {
  TOOL_EXECUTION_POLICY,
  FILE_WRITE_POLICY,
  FILE_READ_POLICY,
  COMMAND_EXECUTION_POLICY,
  OUTPUT_SCREENING_POLICY,
  INPUT_VALIDATION_POLICY,
  COMPREHENSIVE_POLICY,
  MINIMAL_POLICY,
  DEFAULT_POLICIES,
  getPolicy,
  registerPolicy,
  getAllPolicies,
} from './policies.js';
