/**
 * Design Audit Schemas
 *
 * Zod schemas for rule-based design audit results.
 *
 * @module design/audit-types
 */

import { z } from 'zod';

// =============================================================================
// Audit Rule Types
// =============================================================================

/**
 * Audit rule severity levels
 */
export const AuditSeveritySchema = z.enum(['error', 'warning', 'info']);
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;

/**
 * Available audit rule IDs
 */
export const AuditRuleIdSchema = z.enum([
  'spacing-consistency',
  'color-contrast',
  'naming-convention',
  'token-usage',
  'missing-autolayout',
  'font-consistency',
  'layer-naming',
  'component-usage',
  'image-resolution',
  'text-overflow',
]);
export type AuditRuleId = z.infer<typeof AuditRuleIdSchema>;

/**
 * Audit rule definition
 */
export const AuditRuleSchema = z.object({
  id: AuditRuleIdSchema,
  name: z.string(),
  description: z.string(),
  severity: AuditSeveritySchema,
  category: z.enum(['consistency', 'accessibility', 'naming', 'performance', 'best-practices']),
  enabled: z.boolean().default(true),
});
export type AuditRule = z.infer<typeof AuditRuleSchema>;

// =============================================================================
// Audit Issue Types
// =============================================================================

/**
 * Location of an issue within the design
 */
export const AuditIssueLocationSchema = z.object({
  nodeId: z.string(),
  nodeName: z.string(),
  nodePath: z.string(), // e.g., "Page > Frame > Button"
  nodeType: z.string(),
});
export type AuditIssueLocation = z.infer<typeof AuditIssueLocationSchema>;

/**
 * Single audit issue
 */
export const AuditIssueSchema = z.object({
  ruleId: AuditRuleIdSchema,
  severity: AuditSeveritySchema,
  message: z.string(),
  location: AuditIssueLocationSchema,
  details: z.record(z.string(), z.unknown()).optional(),
  suggestion: z.string().optional(),
  // For comparisons (expected vs actual)
  expected: z.unknown().optional(),
  actual: z.unknown().optional(),
});
export type AuditIssue = z.infer<typeof AuditIssueSchema>;

// =============================================================================
// Audit Result Types
// =============================================================================

/**
 * Summary statistics for an audit
 */
export const AuditSummarySchema = z.object({
  totalNodes: z.number(),
  nodesAudited: z.number(),
  issueCount: z.object({
    error: z.number(),
    warning: z.number(),
    info: z.number(),
    total: z.number(),
  }),
  passRate: z.number().min(0).max(100), // Percentage
  rulesRun: z.array(AuditRuleIdSchema),
  duration: z.number(), // ms
});
export type AuditSummary = z.infer<typeof AuditSummarySchema>;

/**
 * Full audit result
 */
export const AuditResultSchema = z.object({
  fileKey: z.string(),
  fileName: z.string().optional(),
  targetNodeId: z.string().optional(),
  targetAlias: z.string().optional(),
  timestamp: z.string().datetime(),
  summary: AuditSummarySchema,
  issues: z.array(AuditIssueSchema),
  metadata: z.object({
    figmaVersion: z.string().optional(),
    axCliVersion: z.string().optional(),
    configPath: z.string().optional(),
  }).optional(),
});
export type AuditResult = z.infer<typeof AuditResultSchema>;

// =============================================================================
// Audit Configuration Types
// =============================================================================

/**
 * Rule-specific configuration overrides
 */
export const RuleConfigOverrideSchema = z.object({
  enabled: z.boolean().optional(),
  severity: AuditSeveritySchema.optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});
export type RuleConfigOverride = z.infer<typeof RuleConfigOverrideSchema>;

/**
 * Audit configuration options
 */
export const AuditConfigSchema = z.object({
  /** Which rules to run (default: all) */
  rules: z.array(AuditRuleIdSchema).optional(),
  /** Exclude specific rules */
  excludeRules: z.array(AuditRuleIdSchema).optional(),
  /** Per-rule configuration */
  ruleConfig: z.record(AuditRuleIdSchema, RuleConfigOverrideSchema).optional(),
  /** Maximum depth to traverse */
  maxDepth: z.number().positive().optional(),
  /** Fail on error-level issues */
  failOnError: z.boolean().default(true),
  /** Fail on warning-level issues */
  failOnWarning: z.boolean().default(false),
  /** Include hidden nodes */
  includeHidden: z.boolean().default(false),
  /** Reference tokens file for token-usage rule */
  tokensPath: z.string().optional(),
});
export type AuditConfig = z.infer<typeof AuditConfigSchema>;

// =============================================================================
// Rule-Specific Configuration Types
// =============================================================================

/**
 * Color contrast rule options
 */
export const ColorContrastOptionsSchema = z.object({
  /** WCAG level to check */
  level: z.enum(['AA', 'AAA']).default('AA'),
  /** Minimum contrast ratio for normal text */
  normalTextRatio: z.number().default(4.5),
  /** Minimum contrast ratio for large text */
  largeTextRatio: z.number().default(3),
  /** Font size threshold for "large text" (px) */
  largeTextSize: z.number().default(18),
});
export type ColorContrastOptions = z.infer<typeof ColorContrastOptionsSchema>;

/**
 * Spacing consistency rule options
 */
export const SpacingConsistencyOptionsSchema = z.object({
  /** Allowed spacing values (px) */
  allowedValues: z.array(z.number()).optional(),
  /** Base spacing unit */
  baseUnit: z.number().default(4),
  /** Allow multiples of base unit */
  allowMultiples: z.boolean().default(true),
});
export type SpacingConsistencyOptions = z.infer<typeof SpacingConsistencyOptionsSchema>;

/**
 * Naming convention rule options
 */
export const NamingConventionOptionsSchema = z.object({
  /** Pattern for frame names */
  framePattern: z.string().optional(),
  /** Pattern for component names */
  componentPattern: z.string().optional(),
  /** Pattern for layer names */
  layerPattern: z.string().optional(),
  /** Disallowed names */
  disallowed: z.array(z.string()).default(['Frame 1', 'Rectangle 1', 'Group 1']),
});
export type NamingConventionOptions = z.infer<typeof NamingConventionOptionsSchema>;

// =============================================================================
// CI/CD Output Types
// =============================================================================

/**
 * Exit code mapping for CI/CD
 */
export const AuditExitCodeSchema = z.object({
  code: z.number(),
  reason: z.enum(['success', 'warnings', 'errors', 'fatal']),
  summary: z.string(),
});
export type AuditExitCode = z.infer<typeof AuditExitCodeSchema>;

/**
 * Compute exit code from audit result
 */
export function computeAuditExitCode(
  result: AuditResult,
  config: Pick<AuditConfig, 'failOnError' | 'failOnWarning'>
): AuditExitCode {
  const { issueCount } = result.summary;

  if (issueCount.error > 0 && config.failOnError) {
    return {
      code: 1,
      reason: 'errors',
      summary: `${issueCount.error} error(s) found`,
    };
  }

  if (issueCount.warning > 0 && config.failOnWarning) {
    return {
      code: 1,
      reason: 'warnings',
      summary: `${issueCount.warning} warning(s) found`,
    };
  }

  if (issueCount.total === 0) {
    return {
      code: 0,
      reason: 'success',
      summary: 'No issues found',
    };
  }

  return {
    code: 0,
    reason: 'success',
    summary: `${issueCount.total} issue(s) found (non-blocking)`,
  };
}

// =============================================================================
// Default Rules
// =============================================================================

/**
 * Default audit rules configuration
 */
export const DEFAULT_AUDIT_RULES: AuditRule[] = [
  {
    id: 'spacing-consistency',
    name: 'Spacing Consistency',
    description: 'Check that spacing values match design system tokens',
    severity: 'warning',
    category: 'consistency',
    enabled: true,
  },
  {
    id: 'color-contrast',
    name: 'Color Contrast',
    description: 'Check WCAG color contrast requirements',
    severity: 'error',
    category: 'accessibility',
    enabled: true,
  },
  {
    id: 'naming-convention',
    name: 'Naming Convention',
    description: 'Check that layer names follow conventions',
    severity: 'info',
    category: 'naming',
    enabled: true,
  },
  {
    id: 'token-usage',
    name: 'Token Usage',
    description: 'Check that colors and text styles use defined tokens',
    severity: 'warning',
    category: 'consistency',
    enabled: true,
  },
  {
    id: 'missing-autolayout',
    name: 'Missing Auto-Layout',
    description: 'Identify frames without auto-layout that might benefit from it',
    severity: 'info',
    category: 'best-practices',
    enabled: true,
  },
  {
    id: 'font-consistency',
    name: 'Font Consistency',
    description: 'Check that fonts match design system typography',
    severity: 'warning',
    category: 'consistency',
    enabled: true,
  },
  {
    id: 'layer-naming',
    name: 'Layer Naming',
    description: 'Check for generic layer names (Frame 1, Rectangle 1, etc.)',
    severity: 'info',
    category: 'naming',
    enabled: true,
  },
  {
    id: 'component-usage',
    name: 'Component Usage',
    description: 'Check that components are used instead of detached instances',
    severity: 'warning',
    category: 'best-practices',
    enabled: true,
  },
  {
    id: 'image-resolution',
    name: 'Image Resolution',
    description: 'Check that images have sufficient resolution for export',
    severity: 'warning',
    category: 'performance',
    enabled: false, // Disabled by default, requires additional API calls
  },
  {
    id: 'text-overflow',
    name: 'Text Overflow',
    description: 'Detect text that may overflow its container',
    severity: 'warning',
    category: 'best-practices',
    enabled: true,
  },
];
