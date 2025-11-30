/**
 * Consistent Naming Rule
 *
 * Use consistent naming conventions: camelCase for variables/functions, PascalCase for classes/interfaces
 */

import { BaseValidationRule } from '../../base-rule.js';
import type { Violation, Severity } from '../../../../types/analysis.js';
import type { RuleCategory } from '../../types.js';

export class ConsistentNamingRule extends BaseValidationRule {
  readonly id = 'consistent-naming';
  readonly name = 'Consistent Naming';
  readonly description =
    'Use consistent naming conventions: camelCase for variables/functions, PascalCase for classes/interfaces';
  readonly severity: Severity = 'low';
  readonly category: RuleCategory = 'best-practices';
  readonly autoFixable = false;

  async check(filePath: string, content: string): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Check class names (should be PascalCase)
    const classPattern = /class\s+([a-z][a-zA-Z0-9]*)/g;
    let match: RegExpExecArray | null;

    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1];
      const pos = this.getPosition(content, match.index);

      violations.push(
        this.createViolation(
          filePath,
          pos.line,
          pos.column,
          `Class name "${className}" should be in PascalCase (start with uppercase).`,
          `Rename to "${className.charAt(0).toUpperCase() + className.slice(1)}"`
        )
      );
    }

    // Check interface names (should be PascalCase)
    const interfacePattern = /interface\s+([a-z][a-zA-Z0-9]*)/g;

    while ((match = interfacePattern.exec(content)) !== null) {
      const interfaceName = match[1];
      const pos = this.getPosition(content, match.index);

      violations.push(
        this.createViolation(
          filePath,
          pos.line,
          pos.column,
          `Interface name "${interfaceName}" should be in PascalCase (start with uppercase).`,
          `Rename to "${interfaceName.charAt(0).toUpperCase() + interfaceName.slice(1)}"`
        )
      );
    }

    // Check function names (should be camelCase, not PascalCase)
    const functionPattern = /function\s+([A-Z][a-zA-Z0-9]*)/g;

    while ((match = functionPattern.exec(content)) !== null) {
      const functionName = match[1];
      const pos = this.getPosition(content, match.index);

      violations.push(
        this.createViolation(
          filePath,
          pos.line,
          pos.column,
          `Function name "${functionName}" should be in camelCase (start with lowercase).`,
          `Rename to "${functionName.charAt(0).toLowerCase() + functionName.slice(1)}"`
        )
      );
    }

    return violations;
  }
}
