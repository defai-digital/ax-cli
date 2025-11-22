/**
 * Proper Error Handling Rule
 *
 * Catch blocks should not be empty and should handle errors properly
 */

import { BaseValidationRule } from '../../base-rule.js';
import type { Violation, Severity } from '../../../../types/analysis.js';
import type { RuleCategory } from '../../types.js';

export class ProperErrorHandlingRule extends BaseValidationRule {
  readonly id = 'proper-error-handling';
  readonly name = 'Proper Error Handling';
  readonly description = 'Catch blocks should not be empty and should handle errors properly';
  readonly severity: Severity = 'high';
  readonly category: RuleCategory = 'code-quality';
  readonly autoFixable = false;

  async check(filePath: string, content: string): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Pattern: catch blocks with empty or minimal handling
    const emptyCatchPattern = /catch\s*\([^)]*\)\s*\{\s*\}/g;

    let match: RegExpExecArray | null;

    // Check for completely empty catch blocks
    while ((match = emptyCatchPattern.exec(content)) !== null) {
      const pos = this.getPosition(content, match.index);

      violations.push(
        this.createViolation(
          filePath,
          pos.line,
          pos.column,
          'Empty catch block. Handle or log the error properly.',
          'Add error logging: console.error(error) or rethrow the error'
        )
      );
    }

    return violations;
  }
}
