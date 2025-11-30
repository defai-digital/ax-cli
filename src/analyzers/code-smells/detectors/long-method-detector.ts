/**
 * Long Method Detector
 *
 * Detects functions/methods that exceed a threshold line count
 */

import { BaseSmellDetector } from '../base-smell-detector.js';
import { SmellType, SmellSeverity, type CodeSmell, type DetectorConfig } from '../types.js';

export class LongMethodDetector extends BaseSmellDetector {
  constructor(config: DetectorConfig = { enabled: true, thresholds: { maxLines: 50 } }) {
    super(SmellType.LONG_METHOD, config);
  }

  async detect(filePath: string): Promise<CodeSmell[]> {
    if (!this.isEnabled()) return [];

    const smells: CodeSmell[] = [];
    const maxLines = this.getThreshold('maxLines', 50);

    try {
      const ast = await this.astParser.parseFile(filePath);

      // Check functions
      for (const func of ast.functions) {
        if (func.length > maxLines) {
          const severity = this.getSeverity(func.length, maxLines);
          smells.push(
            this.createSmell(
              filePath,
              func.startLine,
              func.endLine,
              `Function '${func.name}' is too long (${func.length} lines)`,
              `Consider breaking this function into smaller, focused functions. Aim for functions under ${maxLines} lines.`,
              severity,
              { functionName: func.name, lines: func.length, threshold: maxLines }
            )
          );
        }
      }

      // Check methods in classes
      for (const cls of ast.classes) {
        for (const method of cls.methods) {
          if (method.length > maxLines) {
            const severity = this.getSeverity(method.length, maxLines);
            smells.push(
              this.createSmell(
                filePath,
                method.startLine,
                method.endLine,
                `Method '${cls.name}.${method.name}' is too long (${method.length} lines)`,
                `Consider extracting parts of this method into smaller helper methods.`,
                severity,
                { className: cls.name, methodName: method.name, lines: method.length, threshold: maxLines }
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

  private getSeverity(lines: number, threshold: number): SmellSeverity.LOW | SmellSeverity.MEDIUM | SmellSeverity.HIGH | SmellSeverity.CRITICAL {
    // Guard against division by zero
    if (threshold === 0) return SmellSeverity.LOW;
    const ratio = lines / threshold;
    if (ratio >= 4) return SmellSeverity.CRITICAL;
    if (ratio >= 2) return SmellSeverity.HIGH;
    if (ratio >= 1.5) return SmellSeverity.MEDIUM;
    return SmellSeverity.LOW;
  }
}
