/**
 * Duplicate Code Detector
 *
 * Detects similar code blocks (simplified heuristic-based detection)
 */

import { BaseSmellDetector } from '../base-smell-detector.js';
import { SmellType, SmellSeverity, type CodeSmell, type DetectorConfig } from '../types.js';

export class DuplicateCodeDetector extends BaseSmellDetector {
  constructor(config: DetectorConfig = { enabled: true, thresholds: { minLines: 5 } }) {
    super(SmellType.DUPLICATE_CODE, config);
  }

  async detect(filePath: string): Promise<CodeSmell[]> {
    if (!this.isEnabled()) return [];

    const smells: CodeSmell[] = [];

    try {
      const ast = this.astParser.parseFile(filePath);

      // Simplified detection: Check for functions/methods with identical names (potential copy-paste)
      const functionSignatures = new Map<string, Array<{ name: string; line: number; params: number }>>();

      // Collect function signatures
      for (const func of ast.functions) {
        const signature = `${func.name}_${func.parameters.length}`;
        if (!functionSignatures.has(signature)) {
          functionSignatures.set(signature, []);
        }
        functionSignatures.get(signature)!.push({
          name: func.name,
          line: func.startLine,
          params: func.parameters.length,
        });
      }

      // Check for methods with very similar signatures across classes
      const methodMap = new Map<string, number>();
      for (const cls of ast.classes) {
        for (const method of cls.methods) {
          const key = `${method.name}_${method.parameters.length}`;
          methodMap.set(key, (methodMap.get(key) || 0) + 1);

          // If same method appears in multiple classes, might be code duplication
          if (methodMap.get(key)! > 1) {
            smells.push(
              this.createSmell(
                filePath,
                method.startLine,
                method.endLine,
                `Potential code duplication: Method '${method.name}' with ${method.parameters.length} parameters appears in multiple classes`,
                `Consider extracting common logic into a shared utility function or base class.`,
                SmellSeverity.MEDIUM,
                { methodName: method.name, occurrences: methodMap.get(key) }
              )
            );
          }
        }
      }
    } catch (error) {
      // Skip files that can't be parsed
    }

    return smells;
  }
}
