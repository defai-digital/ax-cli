/**
 * Prefer Const Rule
 *
 * Prefer const over let when variables are not reassigned
 */

import { BaseValidationRule } from '../../base-rule.js';
import type { Violation, Severity } from '../../../../types/analysis.js';
import type { RuleCategory } from '../../types.js';

export class PreferConstRule extends BaseValidationRule {
  readonly id = 'prefer-const';
  readonly name = 'Prefer Const';
  readonly description = 'Use "const" instead of "let" when variables are not reassigned';
  readonly severity: Severity = 'low';
  readonly category: RuleCategory = 'best-practices';
  readonly autoFixable = true;

  async check(filePath: string, content: string): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Simple heuristic: Look for 'let' declarations
    const letPattern = /\blet\s+(\w+)\s*=/g;

    let match: RegExpExecArray | null;
    while ((match = letPattern.exec(content)) !== null) {
      const variableName = match[1];
      const pos = this.getPosition(content, match.index);

      // Check if variable is reassigned later (simple check)
      // Escape special regex characters in variable name
      const escapedVarName = variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reassignmentPattern = new RegExp(`\\b${escapedVarName}\\s*=`, 'g');
      const reassignments = content.match(reassignmentPattern);

      // If only one assignment (the declaration), suggest const
      if (reassignments && reassignments.length === 1) {
        violations.push(
          this.createViolation(
            filePath,
            pos.line,
            pos.column,
            `Variable "${variableName}" is never reassigned. Use "const" instead of "let".`,
            `Change "let ${variableName}" to "const ${variableName}"`
          )
        );
      }
    }

    return violations;
  }
}
