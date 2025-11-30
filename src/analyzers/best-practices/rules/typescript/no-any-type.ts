/**
 * No Any Type Rule
 *
 * Detect usage of the 'any' type which defeats TypeScript's type safety
 */

import { BaseValidationRule } from '../../base-rule.js';
import type { Violation, Severity } from '../../../../types/analysis.js';
import type { RuleCategory } from '../../types.js';

export class NoAnyTypeRule extends BaseValidationRule {
  readonly id = 'no-any-type';
  readonly name = 'No Any Type';
  readonly description = 'Avoid using the "any" type - use specific types instead';
  readonly severity: Severity = 'high';
  readonly category: RuleCategory = 'type-safety';
  readonly autoFixable = false;

  async check(filePath: string, content: string): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Pattern to match: any type annotations
    // Matches: ': any', '<any>', 'Array<any>', etc.
    const anyTypePattern = /:\s*any\b|<any>|Array<any>/g;

    let match: RegExpExecArray | null;
    while ((match = anyTypePattern.exec(content)) !== null) {
      const pos = this.getPosition(content, match.index);

      violations.push(
        this.createViolation(
          filePath,
          pos.line,
          pos.column,
          'Avoid using "any" type. Use specific types for better type safety.',
          'Replace "any" with a specific type (e.g., string, number, SomeInterface)'
        )
      );
    }

    return violations;
  }
}
