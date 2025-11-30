/**
 * No Unused Variables Rule
 *
 * Remove unused variables to keep code clean
 */

import { BaseValidationRule } from '../../base-rule.js';
import type { Violation, Severity } from '../../../../types/analysis.js';
import type { RuleCategory } from '../../types.js';

export class NoUnusedVarsRule extends BaseValidationRule {
  readonly id = 'no-unused-vars';
  readonly name = 'No Unused Variables';
  readonly description = 'Remove unused variables to keep code clean';
  readonly severity: Severity = 'medium';
  readonly category: RuleCategory = 'code-quality';
  readonly autoFixable = true;

  async check(filePath: string, content: string): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Simple heuristic: Look for variable declarations and check if they're used
    const varPattern = /(?:const|let|var)\s+(\w+)\s*=/g;

    let match: RegExpExecArray | null;
    while ((match = varPattern.exec(content)) !== null) {
      const varName = match[1];

      // Don't check common patterns
      if (varName.startsWith('_')) continue; // Intentionally unused

      // Count occurrences of the variable name
      // Escape special regex characters in variable name
      const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const usagePattern = new RegExp(`\\b${escapedVarName}\\b`, 'g');
      const usages = content.match(usagePattern);

      // If only appears once (the declaration), it's unused
      if (usages && usages.length === 1) {
        const pos = this.getPosition(content, match.index);

        violations.push(
          this.createViolation(
            filePath,
            pos.line,
            pos.column,
            `Variable "${varName}" is declared but never used.`,
            `Remove the unused variable or prefix with "_" if intentionally unused`
          )
        );
      }
    }

    return violations;
  }
}
