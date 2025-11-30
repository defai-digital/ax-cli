/**
 * Prefer Readonly Rule
 *
 * Use readonly for properties that are not modified after initialization
 */

import { BaseValidationRule } from '../../base-rule.js';
import type { Violation, Severity } from '../../../../types/analysis.js';
import type { RuleCategory } from '../../types.js';

export class PreferReadonlyRule extends BaseValidationRule {
  readonly id = 'prefer-readonly';
  readonly name = 'Prefer Readonly';
  readonly description = 'Use readonly for properties that are not modified after initialization';
  readonly severity: Severity = 'low';
  readonly category: RuleCategory = 'type-safety';
  readonly autoFixable = true;

  async check(filePath: string, content: string): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Pattern: class properties without readonly
    const propertyPattern = /^\s*(private|public|protected)\s+(?!readonly)(\w+):/gm;

    let match: RegExpExecArray | null;
    while ((match = propertyPattern.exec(content)) !== null) {
      const visibility = match[1];
      const propertyName = match[2];

      // Check if property is assigned after constructor (simple heuristic)
      // Escape special regex characters in property name
      const escapedPropName = propertyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const assignmentPattern = new RegExp(`this\\.${escapedPropName}\\s*=`, 'g');
      const assignments = content.match(assignmentPattern);

      // If only assigned once (likely in constructor), suggest readonly
      if (assignments && assignments.length === 1) {
        const pos = this.getPosition(content, match.index);

        violations.push(
          this.createViolation(
            filePath,
            pos.line,
            pos.column,
            `Property "${propertyName}" is never modified. Consider making it readonly.`,
            `${visibility} readonly ${propertyName}:`
          )
        );
      }
    }

    return violations;
  }
}
