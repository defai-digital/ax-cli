/**
 * Feature Envy Detector
 *
 * Detects methods that use more features from other classes than their own
 */

import { BaseSmellDetector } from '../base-smell-detector.js';
import { SmellType, SmellSeverity, type CodeSmell, type DetectorConfig } from '../types.js';
import { SyntaxKind } from 'ts-morph';

export class FeatureEnvyDetector extends BaseSmellDetector {
  constructor(config: DetectorConfig = { enabled: true, thresholds: { ratio: 0.7 } }) {
    super(SmellType.FEATURE_ENVY, config);
  }

  async detect(filePath: string): Promise<CodeSmell[]> {
    if (!this.isEnabled()) return [];

    const smells: CodeSmell[] = [];
    const envyRatio = this.getThreshold('ratio', 0.7);

    try {
      // This detector requires ts-morph semantic analysis (TypeScript/JavaScript only)
      const sourceFile = this.astParser.getSourceFile(filePath);
      if (!sourceFile) return [];

      const classes = sourceFile.getClasses();

      for (const cls of classes) {
        const className = cls.getName() || 'anonymous';
        const classProperties = new Set(cls.getProperties().map((p: { getName(): string }) => p.getName()));

        for (const method of cls.getMethods()) {
          const methodName = method.getName();
          let ownPropertyAccess = 0;
          let externalPropertyAccess = 0;

          // Count property accesses
          method.forEachDescendant((node) => {
            if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
              const text = node.getText();

              // Check if accessing own property
              if (text.startsWith('this.')) {
                const propName = text.slice(5).split('.')[0];
                // BUG FIX: Skip empty property names (e.g., malformed "this." without property)
                if (propName) {
                  if (classProperties.has(propName)) {
                    ownPropertyAccess++;
                  } else {
                    externalPropertyAccess++;
                  }
                }
              } else {
                externalPropertyAccess++;
              }
            }
          });

          const totalAccess = ownPropertyAccess + externalPropertyAccess;
          if (totalAccess > 5) {
            // Only check if significant number of accesses
            const externalRatio = externalPropertyAccess / totalAccess;

            if (externalRatio >= envyRatio) {
              smells.push(
                this.createSmell(
                  filePath,
                  method.getStartLineNumber(),
                  method.getEndLineNumber(),
                  `Method '${className}.${methodName}' exhibits feature envy (${Math.round(externalRatio * 100)}% external access)`,
                  `This method accesses more external properties than its own. Consider moving this logic to the class it's most interested in.`,
                  externalRatio >= 0.9 ? SmellSeverity.HIGH : SmellSeverity.MEDIUM,
                  { className, methodName, ownAccess: ownPropertyAccess, externalAccess: externalPropertyAccess }
                )
              );
            }
          }
        }
      }
    } catch {
      // Skip files that can't be parsed
    }

    return smells;
  }
}
