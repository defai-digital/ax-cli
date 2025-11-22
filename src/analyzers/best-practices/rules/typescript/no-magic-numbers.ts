/**
 * No Magic Numbers Rule
 *
 * Use named constants instead of magic numbers
 */

import { BaseValidationRule } from '../../base-rule.js';
import type { Violation, Severity } from '../../../../types/analysis.js';
import type { RuleCategory } from '../../types.js';

export class NoMagicNumbersRule extends BaseValidationRule {
  readonly id = 'no-magic-numbers';
  readonly name = 'No Magic Numbers';
  readonly description = 'Use named constants instead of magic numbers';
  readonly severity: Severity = 'low';
  readonly category: RuleCategory = 'best-practices';
  readonly autoFixable = false;

  async check(filePath: string, content: string): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Pattern: numeric literals (excluding 0, 1, -1 which are common)
    const magicNumberPattern = /(?<!\w)(?:[2-9]|[1-9]\d+)(?!\w|:)/g;

    let match: RegExpExecArray | null;
    while ((match = magicNumberPattern.exec(content)) !== null) {
      const number = match[0];

      // Skip if it's part of a const declaration
      const beforeMatch = content.substring(Math.max(0, match.index - 50), match.index);
      if (/const\s+\w+\s*=\s*$/.test(beforeMatch)) {
        continue; // This IS a constant declaration
      }

      const pos = this.getPosition(content, match.index);

      violations.push(
        this.createViolation(
          filePath,
          pos.line,
          pos.column,
          `Magic number "${number}" found. Use a named constant instead.`,
          `const MEANINGFUL_NAME = ${number};`
        )
      );
    }

    return violations;
  }
}
