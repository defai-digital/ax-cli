/**
 * Magic Numbers Detector
 *
 * Detects hardcoded numeric literals (excluding common values like 0, 1, -1, 100)
 */

import { BaseSmellDetector } from '../base-smell-detector.js';
import { SmellType, SmellSeverity, type CodeSmell, type DetectorConfig } from '../types.js';
import { SyntaxKind } from 'ts-morph';

export class MagicNumbersDetector extends BaseSmellDetector {
  private readonly ALLOWED_NUMBERS = new Set([0, 1, -1, 2, 10, 100, 1000]);

  constructor(config: DetectorConfig = { enabled: true }) {
    super(SmellType.MAGIC_NUMBERS, config);
  }

  async detect(filePath: string): Promise<CodeSmell[]> {
    if (!this.isEnabled()) return [];

    const smells: CodeSmell[] = [];

    try {
      // This detector requires ts-morph semantic analysis (TypeScript/JavaScript only)
      const sourceFile = this.astParser.getSourceFile(filePath);
      if (!sourceFile) return [];

      const magicNumbers = new Map<number, Array<{ line: number; text: string }>>();

      // Find all numeric literals
      sourceFile.forEachDescendant((node) => {
        if (node.getKind() === SyntaxKind.NumericLiteral) {
          const value = Number(node.getText());

          // Skip allowed numbers
          if (this.ALLOWED_NUMBERS.has(value)) return;

          // Skip if in const declaration (already named)
          const parent = node.getParent();
          if (parent && parent.getKind() === SyntaxKind.VariableDeclaration) {
            return;
          }

          const line = node.getStartLineNumber();
          const existing = magicNumbers.get(value) ?? [];
          existing.push({ line, text: node.getText() });
          magicNumbers.set(value, existing);
        }
      });

      // Create smells for magic numbers
      for (const [value, occurrences] of magicNumbers.entries()) {
        if (occurrences.length > 0) {
          const firstOccurrence = occurrences[0];
          smells.push(
            this.createSmell(
              filePath,
              firstOccurrence.line,
              firstOccurrence.line,
              `Magic number '${value}' found (${occurrences.length} occurrence${occurrences.length > 1 ? 's' : ''})`,
              `Replace this magic number with a named constant to improve code readability and maintainability.`,
              occurrences.length >= 3 ? SmellSeverity.MEDIUM : SmellSeverity.LOW,
              { value, occurrences: occurrences.length, lines: occurrences.map(o => o.line) }
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
