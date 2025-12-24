/**
 * Guard System Schemas - Public API
 *
 * @packageDocumentation
 */

export {
  // Gate Types
  GateTypeSchema,
  GateResultSchema,
  type GateType,
  type GateResult,

  // Context
  GateContextSchema,
  type GateContext,

  // Check Results
  GuardCheckResultSchema,
  GuardResultSchema,
  type GuardCheckResult,
  type GuardResult,

  // Configuration
  PathViolationConfigSchema,
  CredentialExposureConfigSchema,
  InjectionAttemptConfigSchema,
  SchemaViolationConfigSchema,
  GateConfigSchema,
  type PathViolationConfig,
  type CredentialExposureConfig,
  type InjectionAttemptConfig,
  type SchemaViolationConfig,
  type GateConfig,

  // Policy
  GuardPolicySchema,
  type GuardPolicy,

  // Metrics
  GuardMetricsSchema,
  type GuardMetrics,

  // Validators
  validateGateContext,
  safeParseGateContext,
  validateGuardPolicy,
  safeParseGuardPolicy,
  validateGuardResult,

  // Utilities
  computeOverallResult,
  normalizePath,
  isPathUnder,
} from './schemas.js';
