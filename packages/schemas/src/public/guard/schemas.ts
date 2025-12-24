/**
 * Guard System Schemas
 *
 * Zod schemas for the security governance layer.
 * These are the source of truth for guard-related types.
 *
 * @invariant INV-GUARD-001: Guard MUST NOT modify any state, only read and validate
 * @invariant INV-GUARD-002: All gates in policy MUST be evaluated, even after FAIL
 * @invariant INV-GUARD-003: Any FAIL gate makes overall result FAIL
 * @invariant INV-GUARD-004: Same input MUST produce same guard result (deterministic)
 * @invariant INV-GUARD-005: Path checks MUST normalize paths before comparison
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// =============================================================================
// Gate Types
// =============================================================================

/**
 * Available gate types for security checks
 */
export const GateTypeSchema = z.enum([
  'path_violation',
  'credential_exposure',
  'injection_attempt',
  'schema_violation',
]);

export type GateType = z.infer<typeof GateTypeSchema>;

/**
 * Gate result indicating the outcome of a security check
 */
export const GateResultSchema = z.enum(['PASS', 'WARN', 'FAIL']);

export type GateResult = z.infer<typeof GateResultSchema>;

// =============================================================================
// Gate Context
// =============================================================================

/**
 * Context provided to gates for security evaluation
 */
export const GateContextSchema = z.object({
  /** Current session ID */
  sessionId: z.string().optional(),

  /** Current working directory */
  cwd: z.string(),

  /** File path being accessed (for file operations) */
  filePath: z.string().optional(),

  /** Content being written or processed */
  content: z.string().optional(),

  /** Command being executed */
  command: z.string().optional(),

  /** Name of the tool being invoked */
  toolName: z.string().optional(),

  /** Arguments passed to the tool */
  toolArguments: z.record(z.string(), z.unknown()).optional(),

  /** Additional metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type GateContext = z.infer<typeof GateContextSchema>;

// =============================================================================
// Gate Check Result
// =============================================================================

/**
 * Result of a single gate check
 */
export const GuardCheckResultSchema = z.object({
  /** Which gate produced this result */
  gate: GateTypeSchema,

  /** The result of the check */
  result: GateResultSchema,

  /** Human-readable message explaining the result */
  message: z.string(),

  /** Additional details about the check */
  details: z.record(z.string(), z.unknown()).optional(),

  /** Duration of the check in milliseconds */
  duration: z.number().int().nonnegative().optional(),
});

export type GuardCheckResult = z.infer<typeof GuardCheckResultSchema>;

// =============================================================================
// Guard Result
// =============================================================================

/**
 * Overall result from the guard system
 *
 * @invariant INV-GUARD-003: overallResult is FAIL if any check.result is FAIL
 */
export const GuardResultSchema = z.object({
  /** Policy that was evaluated */
  policy: z.string(),

  /** Overall result (FAIL if any gate failed) */
  overallResult: GateResultSchema,

  /** Individual check results from each gate */
  checks: z.array(GuardCheckResultSchema),

  /** Timestamp of the evaluation */
  timestamp: z.string().datetime(),

  /** Total duration of all checks in milliseconds */
  duration: z.number().int().nonnegative(),
});

export type GuardResult = z.infer<typeof GuardResultSchema>;

// =============================================================================
// Gate Configuration
// =============================================================================

/**
 * Configuration for PathViolationGate
 */
export const PathViolationConfigSchema = z.object({
  /** Paths that are always blocked */
  blockedPaths: z.array(z.string()).optional(),

  /** Regex patterns for blocked paths */
  blockedPatterns: z.array(z.string()).optional(),

  /** Paths that are explicitly allowed (whitelist) */
  allowedPaths: z.array(z.string()).optional(),

  /** Whether to warn when accessing paths outside cwd */
  warnOutsideCwd: z.boolean().optional(),
});

export type PathViolationConfig = z.infer<typeof PathViolationConfigSchema>;

/**
 * Configuration for CredentialExposureGate
 */
export const CredentialExposureConfigSchema = z.object({
  /** Custom regex patterns for credential detection */
  customPatterns: z.array(z.string()).optional(),

  /** Whether to use default patterns */
  useDefaultPatterns: z.boolean().optional(),
});

export type CredentialExposureConfig = z.infer<typeof CredentialExposureConfigSchema>;

/**
 * Configuration for InjectionAttemptGate
 */
export const InjectionAttemptConfigSchema = z.object({
  /** Custom regex patterns for injection detection */
  customPatterns: z.array(z.string()).optional(),

  /** Whether to use default patterns */
  useDefaultPatterns: z.boolean().optional(),
});

export type InjectionAttemptConfig = z.infer<typeof InjectionAttemptConfigSchema>;

/**
 * Configuration for SchemaViolationGate
 */
export const SchemaViolationConfigSchema = z.object({
  /** Whether to use strict mode (fail on unknown properties) */
  strictMode: z.boolean().optional(),

  /** Whether to allow tools without defined schemas */
  allowUnknownTools: z.boolean().optional(),
});

export type SchemaViolationConfig = z.infer<typeof SchemaViolationConfigSchema>;

/**
 * Union of all gate configurations
 */
export const GateConfigSchema = z.union([
  PathViolationConfigSchema,
  CredentialExposureConfigSchema,
  InjectionAttemptConfigSchema,
  SchemaViolationConfigSchema,
  z.record(z.string(), z.unknown()),
]);

export type GateConfig = z.infer<typeof GateConfigSchema>;

// =============================================================================
// Guard Policy
// =============================================================================

/**
 * A guard policy defines which gates to run and their configuration
 */
export const GuardPolicySchema = z.object({
  /** Unique identifier for the policy */
  id: z.string().min(1),

  /** Human-readable name */
  name: z.string().min(1),

  /** Description of what this policy protects against */
  description: z.string().optional(),

  /** Gates to execute in this policy */
  gates: z.array(GateTypeSchema).min(1),

  /** Per-gate configuration */
  config: z.record(z.string(), z.unknown()).optional(),

  /** Whether this policy is enabled */
  enabled: z.boolean(),
});

export type GuardPolicy = z.infer<typeof GuardPolicySchema>;

// =============================================================================
// Guard Metrics
// =============================================================================

/**
 * Statistics for a single gate or policy
 */
const StatsSchema = z.object({
  total: z.number().int().nonnegative(),
  pass: z.number().int().nonnegative(),
  warn: z.number().int().nonnegative(),
  fail: z.number().int().nonnegative(),
});

/**
 * Metrics for observability
 */
export const GuardMetricsSchema = z.object({
  /** Total number of checks performed */
  totalChecks: z.number().int().nonnegative(),

  /** Number of PASS results */
  passCount: z.number().int().nonnegative(),

  /** Number of WARN results */
  warnCount: z.number().int().nonnegative(),

  /** Number of FAIL results */
  failCount: z.number().int().nonnegative(),

  /** Average check duration in milliseconds */
  averageDuration: z.number().nonnegative(),

  /** Per-gate statistics */
  byGate: z.record(z.string(), StatsSchema),

  /** Per-policy statistics */
  byPolicy: z.record(z.string(), StatsSchema),
});

export type GuardMetrics = z.infer<typeof GuardMetricsSchema>;

// =============================================================================
// Validators
// =============================================================================

/**
 * Validate a GateContext (throws on error)
 */
export function validateGateContext(context: unknown): GateContext {
  return GateContextSchema.parse(context);
}

/**
 * Safely parse a GateContext (returns result object)
 */
export function safeParseGateContext(context: unknown) {
  return GateContextSchema.safeParse(context);
}

/**
 * Validate a GuardPolicy (throws on error)
 */
export function validateGuardPolicy(policy: unknown): GuardPolicy {
  return GuardPolicySchema.parse(policy);
}

/**
 * Safely parse a GuardPolicy (returns result object)
 */
export function safeParseGuardPolicy(policy: unknown) {
  return GuardPolicySchema.safeParse(policy);
}

/**
 * Validate a GuardResult (throws on error)
 */
export function validateGuardResult(result: unknown): GuardResult {
  return GuardResultSchema.parse(result);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Compute overall result from individual check results
 *
 * @invariant INV-GUARD-003: Any FAIL makes overall FAIL
 */
export function computeOverallResult(checks: GuardCheckResult[]): GateResult {
  if (checks.some((c) => c.result === 'FAIL')) return 'FAIL';
  if (checks.some((c) => c.result === 'WARN')) return 'WARN';
  return 'PASS';
}

/**
 * Normalize a file path for consistent comparison
 *
 * @invariant INV-GUARD-005: Always normalize before comparison
 */
export function normalizePath(filePath: string): string {
  // Expand home directory
  const home = process.env['HOME'] ?? '~';
  let normalized = filePath.replace(/^~/, home);

  // Windows to Unix separators
  normalized = normalized.replace(/\\/g, '/');

  // Resolve .. and . path components to prevent path traversal
  // Split into parts and resolve
  const parts = normalized.split('/');
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '' && resolved.length === 0) {
      // Keep leading slash for absolute paths
      resolved.push('');
    } else if (part === '..') {
      // Go up one directory (but don't go above root)
      if (resolved.length > 1 || (resolved.length === 1 && resolved[0] !== '')) {
        resolved.pop();
      }
    } else if (part !== '.' && part !== '') {
      // Skip . and empty parts (from duplicate slashes)
      resolved.push(part);
    }
  }

  // Join back and handle edge cases
  let result = resolved.join('/');

  // Ensure absolute paths start with /
  if (normalized.startsWith('/') && !result.startsWith('/')) {
    result = '/' + result;
  }

  // Handle empty result (root directory)
  if (result === '' && normalized.startsWith('/')) {
    result = '/';
  }

  return result;
}

/**
 * Check if a path is under a base path
 */
export function isPathUnder(path: string, basePath: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedBase = normalizePath(basePath);

  // Handle root path specially - all absolute paths are under root
  if (normalizedBase === '/') {
    return normalizedPath.startsWith('/');
  }

  return (
    normalizedPath === normalizedBase || normalizedPath.startsWith(normalizedBase + '/')
  );
}
