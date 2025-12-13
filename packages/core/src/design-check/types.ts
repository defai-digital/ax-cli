/**
 * Design Check Types
 * Core interfaces for the design system violation checker
 */

/**
 * Severity level for violations
 */
export type Severity = 'error' | 'warning';

/**
 * Rule configuration value
 */
export type RuleConfig = 'error' | 'warn' | 'off';

/**
 * A single violation detected in the code
 */
export interface Violation {
  /** Rule ID that triggered this violation */
  rule: string;
  /** Severity of the violation */
  severity: Severity;
  /** Human-readable message */
  message: string;
  /** File path where violation was found */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** The actual value found in code */
  found: string;
  /** Suggested replacement or token name */
  suggestion?: string;
  /** Whether this violation can be auto-fixed */
  fixable?: boolean;
}

/**
 * Result of checking a single file
 */
export interface FileResult {
  /** Absolute file path */
  file: string;
  /** List of violations found */
  violations: Violation[];
  /** Whether the file was skipped (e.g., too large, binary) */
  skipped?: boolean;
  /** Reason for skipping */
  skipReason?: string;
}

/**
 * Summary statistics for a check run
 */
export interface CheckSummary {
  /** Total files scanned */
  files: number;
  /** Files with violations */
  filesWithViolations: number;
  /** Total error count */
  errors: number;
  /** Total warning count */
  warnings: number;
  /** Files skipped */
  skipped: number;
}

/**
 * Complete result of a design check run
 */
export interface CheckResult {
  /** Summary statistics */
  summary: CheckSummary;
  /** Results per file */
  results: FileResult[];
}

/**
 * Design token configuration
 */
export interface TokenConfig {
  /** Color tokens: name -> hex value */
  colors: Record<string, string>;
  /** Spacing tokens: name -> px value */
  spacing: Record<string, string>;
}

/**
 * Rule configuration
 */
export interface RulesConfig {
  'no-hardcoded-colors': RuleConfig;
  'no-raw-spacing': RuleConfig;
  'no-inline-styles': RuleConfig;
  'missing-alt-text': RuleConfig;
  'missing-form-labels': RuleConfig;
  [key: string]: RuleConfig;
}

/**
 * Design check configuration
 */
export interface DesignCheckConfig {
  /** Design tokens to check against */
  tokens: TokenConfig;
  /** Rule severity settings */
  rules: RulesConfig;
  /** File patterns to include */
  include: string[];
  /** File patterns to ignore */
  ignore: string[];
}

/**
 * CLI options for the design check command
 */
export interface DesignCheckOptions {
  /** Output format */
  format: 'stylish' | 'json';
  /** Custom config file path */
  config?: string;
  /** Only report errors */
  quiet: boolean;
  /** Max warnings before non-zero exit */
  maxWarnings: number;
  /** Additional ignore patterns */
  ignorePatterns: string[];
  /** Run specific rule only */
  rule?: string;
  /** Disable colored output */
  noColor: boolean;
  /** Auto-fix violations (Phase 2) */
  fix: boolean;
}

/**
 * Loaded file content for processing
 */
export interface FileContent {
  /** Absolute file path */
  path: string;
  /** Raw file content */
  content: string;
  /** Content split into lines */
  lines: string[];
}

/**
 * A match found by regex detection
 */
export interface RegexMatch {
  /** The matched value */
  value: string;
  /** Index in the content string */
  index: number;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
}

/**
 * Rule function signature
 */
export type RuleFunction = (
  file: FileContent,
  config: DesignCheckConfig
) => Violation[];

/**
 * Rule definition
 */
export interface RuleDefinition {
  /** Rule identifier */
  id: string;
  /** Rule description */
  description: string;
  /** Default severity */
  defaultSeverity: Severity;
  /** Whether auto-fix is available */
  fixable: boolean;
  /** The check function */
  check: RuleFunction;
}
