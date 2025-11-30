/**
 * Large Class Detector
 *
 * Detects classes that are too large (lines or method count)
 */

import { BaseSmellDetector } from '../base-smell-detector.js';
import { SmellType, SmellSeverity, type CodeSmell, type DetectorConfig } from '../types.js';

export class LargeClassDetector extends BaseSmellDetector {
  constructor(config: DetectorConfig = { enabled: true, thresholds: { maxLines: 300, maxMethods: 20 } }) {
    super(SmellType.LARGE_CLASS, config);
  }

  async detect(filePath: string): Promise<CodeSmell[]> {
    if (!this.isEnabled()) return [];

    const smells: CodeSmell[] = [];
    const maxLines = this.getThreshold('maxLines', 300);
    const maxMethods = this.getThreshold('maxMethods', 20);

    try {
      const ast = await this.astParser.parseFile(filePath);

      for (const cls of ast.classes) {
        const issues: string[] = [];
        let severity: SmellSeverity.LOW | SmellSeverity.MEDIUM | SmellSeverity.HIGH | SmellSeverity.CRITICAL = SmellSeverity.LOW;

        // Check line count
        if (cls.length > maxLines) {
          issues.push(`${cls.length} lines (threshold: ${maxLines})`);
          severity = this.updateSeverity(severity, this.getSeverityByRatio(cls.length, maxLines));
        }

        // Check method count
        if (cls.methods.length > maxMethods) {
          issues.push(`${cls.methods.length} methods (threshold: ${maxMethods})`);
          severity = this.updateSeverity(severity, this.getSeverityByRatio(cls.methods.length, maxMethods));
        }

        if (issues.length > 0) {
          smells.push(
            this.createSmell(
              filePath,
              cls.startLine,
              cls.endLine,
              `Class '${cls.name}' is too large: ${issues.join(', ')}`,
              `Consider splitting this class into smaller, more focused classes following the Single Responsibility Principle.`,
              severity,
              { className: cls.name, lines: cls.length, methods: cls.methods.length }
            )
          );
        }
      }
    } catch {
      // Skip files that can't be parsed
    }

    return smells;
  }

  private getSeverityByRatio(value: number, threshold: number): SmellSeverity.LOW | SmellSeverity.MEDIUM | SmellSeverity.HIGH | SmellSeverity.CRITICAL {
    // Guard against division by zero
    if (threshold === 0) return SmellSeverity.LOW;
    const ratio = value / threshold;
    if (ratio >= 3) return SmellSeverity.CRITICAL;
    if (ratio >= 2) return SmellSeverity.HIGH;
    if (ratio >= 1.5) return SmellSeverity.MEDIUM;
    return SmellSeverity.LOW;
  }

  private updateSeverity(
    current: SmellSeverity.LOW | SmellSeverity.MEDIUM | SmellSeverity.HIGH | SmellSeverity.CRITICAL,
    newSev: SmellSeverity.LOW | SmellSeverity.MEDIUM | SmellSeverity.HIGH | SmellSeverity.CRITICAL
  ): SmellSeverity.LOW | SmellSeverity.MEDIUM | SmellSeverity.HIGH | SmellSeverity.CRITICAL {
    const order = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
    return order[newSev] > order[current] ? newSev : current;
  }
}
