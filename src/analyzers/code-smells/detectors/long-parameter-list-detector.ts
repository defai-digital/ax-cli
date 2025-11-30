/**
 * Long Parameter List Detector
 *
 * Detects functions with too many parameters
 */

import { BaseSmellDetector } from '../base-smell-detector.js';
import { SmellType, SmellSeverity, type CodeSmell, type DetectorConfig } from '../types.js';

export class LongParameterListDetector extends BaseSmellDetector {
  constructor(config: DetectorConfig = { enabled: true, thresholds: { maxParams: 5 } }) {
    super(SmellType.LONG_PARAMETER_LIST, config);
  }

  async detect(filePath: string): Promise<CodeSmell[]> {
    if (!this.isEnabled()) return [];

    const smells: CodeSmell[] = [];
    const maxParams = this.getThreshold('maxParams', 5);

    try {
      const ast = await this.astParser.parseFile(filePath);

      // Check functions
      for (const func of ast.functions) {
        if (func.parameters.length > maxParams) {
          smells.push(
            this.createSmell(
              filePath,
              func.startLine,
              func.endLine,
              `Function '${func.name}' has too many parameters (${func.parameters.length})`,
              `Consider using a parameter object or builder pattern to reduce the parameter count. Aim for ${maxParams} or fewer parameters.`,
              this.getSeverity(func.parameters.length, maxParams),
              { functionName: func.name, paramCount: func.parameters.length, threshold: maxParams }
            )
          );
        }
      }

      // Check methods
      for (const cls of ast.classes) {
        for (const method of cls.methods) {
          if (method.parameters.length > maxParams) {
            smells.push(
              this.createSmell(
                filePath,
                method.startLine,
                method.endLine,
                `Method '${cls.name}.${method.name}' has too many parameters (${method.parameters.length})`,
                `Consider using a parameter object or refactoring to reduce dependencies.`,
                this.getSeverity(method.parameters.length, maxParams),
                { className: cls.name, methodName: method.name, paramCount: method.parameters.length, threshold: maxParams }
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

  private getSeverity(count: number, threshold: number): SmellSeverity.LOW | SmellSeverity.MEDIUM | SmellSeverity.HIGH | SmellSeverity.CRITICAL {
    // Guard against division by zero
    if (threshold === 0) return SmellSeverity.LOW;
    const ratio = count / threshold;
    if (ratio >= 2.5) return SmellSeverity.CRITICAL;
    if (ratio >= 2) return SmellSeverity.HIGH;
    if (ratio >= 1.5) return SmellSeverity.MEDIUM;
    return SmellSeverity.LOW;
  }
}
