/**
 * Nested Conditionals Detector
 *
 * Detects deeply nested if/else/switch statements
 */

import { BaseSmellDetector } from '../base-smell-detector.js';
import { SmellType, SmellSeverity, type CodeSmell, type DetectorConfig } from '../types.js';
import { SyntaxKind, Node } from 'ts-morph';

export class NestedConditionalsDetector extends BaseSmellDetector {
  constructor(config: DetectorConfig = { enabled: true, thresholds: { maxDepth: 3 } }) {
    super(SmellType.NESTED_CONDITIONALS, config);
  }

  async detect(filePath: string): Promise<CodeSmell[]> {
    if (!this.isEnabled()) return [];

    const smells: CodeSmell[] = [];
    const maxDepth = this.getThreshold('maxDepth', 3);

    try {
      // This detector requires ts-morph semantic analysis (TypeScript/JavaScript only)
      const sourceFile = this.astParser.getSourceFile(filePath);
      if (!sourceFile) return [];

      // Check each function/method
      const functions = sourceFile.getFunctions();
      for (const func of functions) {
        const depth = this.getMaxNestingDepth(func);
        if (depth > maxDepth) {
          smells.push(
            this.createSmell(
              filePath,
              func.getStartLineNumber(),
              func.getEndLineNumber(),
              `Function '${func.getName() || 'anonymous'}' has deeply nested conditionals (depth: ${depth})`,
              `Reduce nesting by using early returns, extracting methods, or simplifying logic.`,
              this.getSeverity(depth, maxDepth),
              { functionName: func.getName() || 'anonymous', depth, threshold: maxDepth }
            )
          );
        }
      }

      // Check methods
      const classes = sourceFile.getClasses();
      for (const cls of classes) {
        for (const method of cls.getMethods()) {
          const depth = this.getMaxNestingDepth(method);
          if (depth > maxDepth) {
            smells.push(
              this.createSmell(
                filePath,
                method.getStartLineNumber(),
                method.getEndLineNumber(),
                `Method '${cls.getName()}.${method.getName()}' has deeply nested conditionals (depth: ${depth})`,
                `Reduce nesting by using guard clauses or extracting sub-methods.`,
                this.getSeverity(depth, maxDepth),
                { className: cls.getName(), methodName: method.getName(), depth, threshold: maxDepth }
              )
            );
          }
        }
      }
    } catch {
      // Skip files that can't be parsed
    }

    return smells;
  }

  private getMaxNestingDepth(node: Node): number {
    let maxDepth = 0;

    const traverse = (n: Node, currentDepth: number): void => {
      const kind = n.getKind();

      // Increment depth for conditional statements
      const isConditional =
        kind === SyntaxKind.IfStatement ||
        kind === SyntaxKind.SwitchStatement ||
        kind === SyntaxKind.ConditionalExpression;

      const newDepth = isConditional ? currentDepth + 1 : currentDepth;
      maxDepth = Math.max(maxDepth, newDepth);

      // Traverse children
      n.forEachChild((child) => traverse(child, newDepth));
    };

    traverse(node, 0);
    return maxDepth;
  }

  private getSeverity(depth: number, threshold: number): SmellSeverity.LOW | SmellSeverity.MEDIUM | SmellSeverity.HIGH | SmellSeverity.CRITICAL {
    // Guard against division by zero
    if (threshold === 0) return SmellSeverity.LOW;
    const ratio = depth / threshold;
    if (ratio >= 2.5) return SmellSeverity.CRITICAL;
    if (ratio >= 2) return SmellSeverity.HIGH;
    if (ratio >= 1.5) return SmellSeverity.MEDIUM;
    return SmellSeverity.LOW;
  }
}
