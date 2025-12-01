/**
 * Data Clumps Detector
 *
 * Detects groups of parameters that frequently appear together
 */

import { BaseSmellDetector } from '../base-smell-detector.js';
import { SmellType, SmellSeverity, type CodeSmell, type DetectorConfig } from '../types.js';

export class DataClumpsDetector extends BaseSmellDetector {
  constructor(config: DetectorConfig = { enabled: true, thresholds: { minOccurrences: 3, minParams: 3 } }) {
    super(SmellType.DATA_CLUMPS, config);
  }

  async detect(filePath: string): Promise<CodeSmell[]> {
    if (!this.isEnabled()) return [];

    const smells: CodeSmell[] = [];
    const minOccurrences = this.getThreshold('minOccurrences', 3);
    const minParams = this.getThreshold('minParams', 3);

    try {
      const ast = await this.astParser.parseFile(filePath);

      // Collect parameter combinations
      const paramCombinations = new Map<string, Array<{ location: string; line: number; params: string[] }>>();

      // Check functions
      for (const func of ast.functions) {
        if (func.parameters.length >= minParams) {
          const paramNames = func.parameters.map(p => p.name).sort().join(',');
          const existing = paramCombinations.get(paramNames) ?? [];
          existing.push({
            location: `function ${func.name}`,
            line: func.startLine,
            params: func.parameters.map(p => p.name),
          });
          paramCombinations.set(paramNames, existing);
        }
      }

      // Check methods
      for (const cls of ast.classes) {
        for (const method of cls.methods) {
          if (method.parameters.length >= minParams) {
            const paramNames = method.parameters.map(p => p.name).sort().join(',');
            const existing = paramCombinations.get(paramNames) ?? [];
            existing.push({
              location: `${cls.name}.${method.name}`,
              line: method.startLine,
              params: method.parameters.map(p => p.name),
            });
            paramCombinations.set(paramNames, existing);
          }
        }
      }

      // Report data clumps
      for (const [, occurrences] of paramCombinations.entries()) {
        if (occurrences.length >= minOccurrences) {
          const firstOccurrence = occurrences[0];
          smells.push(
            this.createSmell(
              filePath,
              firstOccurrence.line,
              firstOccurrence.line,
              `Data clump detected: Parameters (${firstOccurrence.params.join(', ')}) appear together in ${occurrences.length} locations`,
              `Consider creating a data class or configuration object to group these related parameters.`,
              occurrences.length >= 5 ? SmellSeverity.HIGH : SmellSeverity.MEDIUM,
              { parameters: firstOccurrence.params, occurrences: occurrences.length, locations: occurrences.map(o => o.location) }
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
