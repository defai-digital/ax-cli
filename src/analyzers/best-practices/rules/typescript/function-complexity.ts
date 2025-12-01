/**
 * Function Complexity Rule
 *
 * Functions should have low cyclomatic complexity (max 10)
 */

import { BaseValidationRule } from '../../base-rule.js';
import type { Violation, Severity } from '../../../../types/analysis.js';
import type { RuleCategory } from '../../types.js';

export class FunctionComplexityRule extends BaseValidationRule {
  readonly id = 'function-complexity';
  readonly name = 'Function Complexity';
  readonly description = 'Functions should have low cyclomatic complexity (max 10)';
  readonly severity: Severity = 'medium';
  readonly category: RuleCategory = 'maintainability';
  readonly autoFixable = false;

  private readonly MAX_COMPLEXITY = 10;

  async check(filePath: string, content: string): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Find all function definitions
    const functionPattern = /function\s+(\w+)\s*\([^)]*\)\s*\{/g;

    let match: RegExpExecArray | null;
    while ((match = functionPattern.exec(content)) !== null) {
      const functionName = match[1];

      // Extract function body (simplified - finds next closing brace)
      const startIndex = match.index + match[0].length;
      const functionBody = this.extractFunctionBody(content, startIndex);

      // Calculate cyclomatic complexity
      const complexity = this.calculateComplexity(functionBody);

      if (complexity > this.MAX_COMPLEXITY) {
        const pos = this.getPosition(content, match.index);

        violations.push(
          this.createViolation(
            filePath,
            pos.line,
            pos.column,
            `Function "${functionName}" has complexity of ${complexity}, exceeds maximum of ${this.MAX_COMPLEXITY}.`,
            'Break down the function into smaller, focused functions',
            { complexity, limit: this.MAX_COMPLEXITY }
          )
        );
      }
    }

    return violations;
  }

  /**
   * Extract function body (simplified version)
   */
  private extractFunctionBody(content: string, startIndex: number): string {
    let braceCount = 1;
    let endIndex = startIndex;

    for (let i = startIndex; i < content.length && braceCount > 0; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
      endIndex = i;
    }

    return content.substring(startIndex, endIndex);
  }

  /**
   * Calculate cyclomatic complexity
   * Complexity = 1 + number of decision points (if, for, while, case, &&, ||, ?, catch)
   */
  private calculateComplexity(code: string): number {
    let complexity = 1;

    // Count decision points
    const decisionKeywords = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /&&/g,
      /\|\|/g,
      /\?/g,
    ];

    for (const pattern of decisionKeywords) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }
}
