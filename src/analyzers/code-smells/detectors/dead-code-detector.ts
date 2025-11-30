/**
 * Dead Code Detector
 *
 * Detects unused exports and variables
 */

import { BaseSmellDetector } from '../base-smell-detector.js';
import { SmellType, SmellSeverity, type CodeSmell, type DetectorConfig } from '../types.js';

export class DeadCodeDetector extends BaseSmellDetector {
  constructor(config: DetectorConfig = { enabled: true }) {
    super(SmellType.DEAD_CODE, config);
  }

  async detect(filePath: string): Promise<CodeSmell[]> {
    if (!this.isEnabled()) return [];

    const smells: CodeSmell[] = [];

    try {
      // This detector requires ts-morph semantic analysis (TypeScript/JavaScript only)
      const sourceFile = this.astParser.getSourceFile(filePath);
      if (!sourceFile) {
        // Skip non-TS/JS files - they don't support reference analysis
        return [];
      }

      const ast = await this.astParser.parseFile(filePath);

      // Find all exported symbols
      const exportedSymbols = new Set(ast.exports.map(e => e.name));

      // Find all variable declarations
      const variables = sourceFile.getVariableDeclarations();

      for (const variable of variables) {
        const name = variable.getName();

        // Skip exported variables
        if (exportedSymbols.has(name)) continue;

        // Check if variable is referenced
        const references = variable.findReferencesAsNodes();

        // If only 1 reference (the declaration itself), it's unused
        if (references.length <= 1) {
          smells.push(
            this.createSmell(
              filePath,
              variable.getStartLineNumber(),
              variable.getEndLineNumber(),
              `Unused variable '${name}'`,
              `Remove this unused variable or export it if needed elsewhere.`,
              SmellSeverity.LOW,
              { variableName: name, references: references.length }
            )
          );
        }
      }

      // Check for unused functions (not exported and not called)
      const functions = sourceFile.getFunctions();
      for (const func of functions) {
        const name = func.getName();
        if (!name || exportedSymbols.has(name)) continue;

        const references = func.findReferencesAsNodes();
        if (references.length <= 1) {
          smells.push(
            this.createSmell(
              filePath,
              func.getStartLineNumber(),
              func.getEndLineNumber(),
              `Unused function '${name}'`,
              `Remove this unused function or export it if needed.`,
              SmellSeverity.MEDIUM,
              { functionName: name, references: references.length }
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
