/**
 * Max File Length Rule
 *
 * Files should not exceed 300 lines for better maintainability
 */

import { BaseValidationRule } from '../../base-rule.js';
import type { Violation, Severity } from '../../../../types/analysis.js';
import type { RuleCategory } from '../../types.js';

export class MaxFileLengthRule extends BaseValidationRule {
  readonly id = 'max-file-length';
  readonly name = 'Max File Length';
  readonly description = 'Files should not exceed 300 lines for better maintainability';
  readonly severity: Severity = 'low';
  readonly category: RuleCategory = 'maintainability';
  readonly autoFixable = false;

  private readonly MAX_LINES = 300;

  async check(filePath: string, content: string): Promise<Violation[]> {
    const violations: Violation[] = [];

    const lines = content.split('\n');
    const lineCount = lines.length;

    if (lineCount > this.MAX_LINES) {
      violations.push(
        this.createViolation(
          filePath,
          1,
          1,
          `File has ${lineCount} lines, exceeds maximum of ${this.MAX_LINES}.`,
          'Consider splitting this file into smaller, focused modules',
          { lineCount, limit: this.MAX_LINES }
        )
      );
    }

    return violations;
  }
}
