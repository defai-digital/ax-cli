/**
 * Best Practice Validator Types
 *
 * Type definitions for validation rules and results
 */

import type { Violation, ValidationResult, BatchValidationResult } from '../../types/analysis.js';
import type { Severity } from '../../types/analysis.js';

/**
 * Rule category classification
 */
export type RuleCategory =
  | 'type-safety'
  | 'code-quality'
  | 'maintainability'
  | 'performance'
  | 'security'
  | 'best-practices';

/**
 * Validation rule interface
 * All rules must implement this interface
 */
export interface ValidationRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: Severity;
  readonly category: RuleCategory;
  readonly autoFixable: boolean;

  /**
   * Check a file for violations of this rule
   */
  check(filePath: string, content: string): Promise<Violation[]>;

  /**
   * Generate automated fix for a violation (if autoFixable)
   */
  fix?(violation: Violation, content: string): Promise<ViolationFix | null>;
}

/**
 * Automated fix for a violation
 */
export interface ViolationFix {
  readonly description: string;
  readonly edits: ReadonlyArray<TextEdit>;
}

/**
 * Text edit for automated fixes
 */
export interface TextEdit {
  readonly range: TextRange;
  readonly newText: string;
}

/**
 * Text range
 */
export interface TextRange {
  readonly start: Position;
  readonly end: Position;
}

/**
 * Position in text
 */
export interface Position {
  readonly line: number;
  readonly column: number;
}

/**
 * Rule configuration
 */
export interface RuleConfig {
  readonly enabled: boolean;
  readonly severity?: Severity;
  readonly options?: Readonly<Record<string, unknown>>;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  readonly rules?: Readonly<Record<string, RuleConfig>>;
  readonly language?: 'typescript' | 'javascript';
  readonly fix?: boolean;
}

/**
 * Rule registry interface
 * Manages all available rules
 */
export interface RuleRegistry {
  register(rule: ValidationRule): void;
  get(id: string): ValidationRule | undefined;
  getAll(): readonly ValidationRule[];
  getByCategory(category: RuleCategory): readonly ValidationRule[];
}

// Re-export types from analysis
export type { Violation, ValidationResult, BatchValidationResult };
