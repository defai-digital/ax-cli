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
      const ast = await this.astParser.parseFile(filePath);

      // Simplified detection: Check for functions/methods with identical names (potential copy-paste)
      const functionSignatures = new Map<string, Array<{ name: string; line: number; params: number }>>();

      // Collect function signatures
      for (const func of ast.functions) {
        const signature = `${func.name}_${func.parameters.length}`;
        const existing = functionSignatures.get(signature) ?? [];
        existing.push({
          name: func.name,
          line: func.startLine,
          params: func.parameters.length,
        });
        functionSignatures.set(signature, existing);
      }

      // Check for methods with very similar signatures across classes
      const methodMap = new Map<string, Array<{ line: number; endLine: number; className: string }>>();
      for (const cls of ast.classes) {
        for (const method of cls.methods) {
          const key = `${method.name}_${method.parameters.length}`;
          const existing = methodMap.get(key) ?? [];
          existing.push({
            line: method.startLine,
            endLine: method.endLine,
            className: cls.name,
          });
          methodMap.set(key, existing);
        }
      }

      // Report duplicate methods (only once per signature)
      for (const [key, occurrences] of methodMap.entries()) {
        if (occurrences.length > 1) {
          // EDGE CASE FIX: Split on last underscore to extract method name and param count
          // Handle edge case where underscore might be at position 0 (e.g., "_3" for anonymous function)
          const lastUnderscoreIndex = key.lastIndexOf('_');
          if (lastUnderscoreIndex === -1) {
            // No underscore found - shouldn't happen with our format, but handle defensively
            console.warn(`Invalid method signature format: ${key}`);
            continue;
          }
          const methodName = key.substring(0, lastUnderscoreIndex);
          const paramCount = key.substring(lastUnderscoreIndex + 1);
          const firstOccurrence = occurrences[0];
          smells.push(
            this.createSmell(
              filePath,
              firstOccurrence.line,
              firstOccurrence.endLine,
              `Potential code duplication: Method '${methodName}' with ${paramCount} parameters appears in ${occurrences.length} classes`,
              `Consider extracting common logic into a shared utility function or base class.`,
              SmellSeverity.MEDIUM,
              { methodName, occurrences: occurrences.length, classes: occurrences.map(o => o.className) }
            )
          );
        }
      }
    } catch {
      // Skip files that can't be parsed
    }

    return smells;
  }
}
