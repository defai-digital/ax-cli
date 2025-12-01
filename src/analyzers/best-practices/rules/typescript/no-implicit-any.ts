/**
 * No Implicit Any Rule
 *
 * Function parameters and variables should have explicit types
 */

import { BaseValidationRule } from '../../base-rule.js';
import type { Violation, Severity } from '../../../../types/analysis.js';
import type { RuleCategory } from '../../types.js';

export class NoImplicitAnyRule extends BaseValidationRule {
  readonly id = 'no-implicit-any';
  readonly name = 'No Implicit Any';
  readonly description = 'Function parameters and variables should have explicit types';
  readonly severity: Severity = 'medium';
  readonly category: RuleCategory = 'type-safety';
  readonly autoFixable = false;

  async check(filePath: string, content: string): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Pattern: function parameters without type annotations
    const functionPattern = /function\s+\w+\s*\(([^)]+)\)/g;
    const arrowFunctionPattern = /\(([^)]+)\)\s*=>/g;

    this.checkPattern(content, filePath, functionPattern, violations);
    this.checkPattern(content, filePath, arrowFunctionPattern, violations);

    return violations;
  }

  private checkPattern(
    content: string,
    filePath: string,
    pattern: RegExp,
    violations: Violation[]
  ): void {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const params = match[1];

      // Check each parameter
      const paramList = params.split(',').map(p => p.trim());
      for (const param of paramList) {
        // If parameter doesn't have a type annotation (no ':')
        if (param && !param.includes(':') && param !== '...args') {
          const pos = this.getPosition(content, match.index);

          violations.push(
            this.createViolation(
              filePath,
              pos.line,
              pos.column,
              `Parameter "${param}" has implicit "any" type. Add explicit type annotation.`,
              `Add type annotation: "${param}: SomeType"`
            )
          );
        }
      }
    }
  }
}
