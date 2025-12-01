/**
 * Base Validation Rule
 *
 * Abstract base class for all validation rules
 * Provides common functionality and helpers
 */

import type { ValidationRule, ViolationFix } from './types.js';
import type { Violation, Severity } from '../../types/analysis.js';
import type { RuleCategory } from './types.js';

/**
 * Abstract base class for validation rules
 * Provides common functionality for all rules
 */
export abstract class BaseValidationRule implements ValidationRule {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly severity: Severity;
  abstract readonly category: RuleCategory;
  abstract readonly autoFixable: boolean;

  /**
   * Check file for violations
   * Must be implemented by subclasses
   */
  abstract check(filePath: string, content: string): Promise<Violation[]>;

  /**
   * Generate fix for violation (optional)
   */
  async fix?(violation: Violation, content: string): Promise<ViolationFix | null>;

  /**
   * Helper: Create a violation object
   */
  protected createViolation(
    file: string,
    line: number,
    column: number,
    message: string,
    suggestion?: string,
    metadata?: Record<string, unknown>
  ): Violation {
    return Object.freeze({
      ruleId: this.id,
      severity: this.severity,
      file,
      line,
      column,
      message,
      suggestion,
      metadata: metadata ? Object.freeze(metadata) : undefined,
    });
  }

  /**
   * Helper: Find line and column from character index
   */
  protected getPosition(
    content: string,
    index: number
  ): { line: number; column: number } {
    const lines = content.substring(0, index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }

  /**
   * Helper: Count matches in content
   */
  protected countMatches(content: string, pattern: RegExp): number {
    const matches = content.match(pattern);
    return matches ? matches.length : 0;
  }
}
