/**
 * Inappropriate Intimacy Detector
 *
 * Detects classes that are too tightly coupled
 */

import { BaseSmellDetector } from '../base-smell-detector.js';
import { SmellType, SmellSeverity, type CodeSmell, type DetectorConfig } from '../types.js';
import { SyntaxKind } from 'ts-morph';

export class InappropriateIntimacyDetector extends BaseSmellDetector {
  constructor(config: DetectorConfig = { enabled: true, thresholds: { maxAccess: 10 } }) {
    super(SmellType.INAPPROPRIATE_INTIMACY, config);
  }

  async detect(filePath: string): Promise<CodeSmell[]> {
    if (!this.isEnabled()) return [];

    const smells: CodeSmell[] = [];
    const maxAccess = this.getThreshold('maxAccess', 10);

    try {
      // This detector requires ts-morph semantic analysis (TypeScript/JavaScript only)
      const sourceFile = this.astParser.getSourceFile(filePath);
      if (!sourceFile) return [];

      const classes = sourceFile.getClasses();

      for (const cls of classes) {
        const className = cls.getName() || 'anonymous';
        const externalClassAccess = new Map<string, number>();

        // Count accesses to other classes
        cls.forEachDescendant((node) => {
          if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
            const text = node.getText();

            // Skip 'this.' accesses
            if (text.startsWith('this.')) return;

            // Extract potential class name from property access (e.g., 'otherClass.property')
            const parts = text.split('.');
            if (parts.length >= 2) {
              const potentialClass = parts[0];
              // Simple heuristic: capitalized names or common object names
              if (potentialClass.length > 0 && /^[a-z][a-zA-Z]*$/.test(potentialClass)) {
                externalClassAccess.set(potentialClass, (externalClassAccess.get(potentialClass) || 0) + 1);
              }
            }
          }
        });

        // Report excessive coupling
        for (const [externalClass, accessCount] of externalClassAccess.entries()) {
          if (accessCount > maxAccess) {
            smells.push(
              this.createSmell(
                filePath,
                cls.getStartLineNumber(),
                cls.getEndLineNumber(),
                `Class '${className}' is too intimate with '${externalClass}' (${accessCount} accesses)`,
                `Consider refactoring to reduce coupling. Move shared functionality to a common base class or use composition.`,
                accessCount >= 20 ? SmellSeverity.HIGH : SmellSeverity.MEDIUM,
                { className, targetClass: externalClass, accessCount, threshold: maxAccess }
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
}
