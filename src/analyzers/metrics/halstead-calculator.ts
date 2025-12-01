/**
 * Halstead Complexity Calculator
 *
 * Calculates Halstead metrics from source code tokens
 */

import { SyntaxKind } from 'ts-morph';
import type { HalsteadMetrics } from './types.js';
import { ASTParser } from '../ast/parser.js';

export class HalsteadCalculator {
  private astParser: ASTParser;

  constructor() {
    this.astParser = new ASTParser();
  }

  /**
   * Calculate Halstead metrics for a file
   */
  calculateMetrics(filePath: string): HalsteadMetrics {
    const sourceFile = this.astParser.getSourceFile(filePath);

    const operators = new Set<string>();
    const operands = new Set<string>();
    let operatorCount = 0;
    let operandCount = 0;

    // Traverse AST and count operators/operands
    sourceFile.forEachDescendant((node) => {
      const kind = node.getKind();
      const text = node.getText();

      // Operators
      if (this.isOperator(kind)) {
        operators.add(this.getOperatorSymbol(kind));
        operatorCount++;
      }
      // Operands (identifiers, literals)
      else if (this.isOperand(kind)) {
        operands.add(text);
        operandCount++;
      }
    });

    const n1 = operators.size;
    const n2 = operands.size;
    const N1 = operatorCount;
    const N2 = operandCount;

    return this.computeMetrics(n1, n2, N1, N2);
  }

  /**
   * Compute Halstead metrics from counts
   */
  private computeMetrics(n1: number, n2: number, N1: number, N2: number): HalsteadMetrics {
    const vocabulary = n1 + n2;
    const length = N1 + N2;

    const calculatedLength = n1 > 0 && n2 > 0
      ? n1 * Math.log2(n1) + n2 * Math.log2(n2)
      : 0;

    const volume = length > 0 && vocabulary > 0
      ? length * Math.log2(vocabulary)
      : 0;

    const difficulty = n1 > 0 && n2 > 0 && N2 > 0
      ? (n1 / 2) * (N2 / n2)
      : 0;

    const effort = difficulty * volume;
    const time = effort / 18; // Seconds to program
    const bugs = volume / 3000; // Estimated delivered bugs

    return Object.freeze({
      n1,
      n2,
      N1,
      N2,
      vocabulary,
      length,
      calculatedLength: Math.round(calculatedLength * 100) / 100,
      volume: Math.round(volume * 100) / 100,
      difficulty: Math.round(difficulty * 100) / 100,
      effort: Math.round(effort * 100) / 100,
      time: Math.round(time * 100) / 100,
      bugs: Math.round(bugs * 1000) / 1000,
    });
  }

  /**
   * Check if node is an operator
   */
  private isOperator(kind: SyntaxKind): boolean {
    const operators = [
      SyntaxKind.PlusToken,
      SyntaxKind.MinusToken,
      SyntaxKind.AsteriskToken,
      SyntaxKind.SlashToken,
      SyntaxKind.PercentToken,
      SyntaxKind.EqualsToken,
      SyntaxKind.EqualsEqualsToken,
      SyntaxKind.EqualsEqualsEqualsToken,
      SyntaxKind.ExclamationEqualsToken,
      SyntaxKind.ExclamationEqualsEqualsToken,
      SyntaxKind.LessThanToken,
      SyntaxKind.GreaterThanToken,
      SyntaxKind.LessThanEqualsToken,
      SyntaxKind.GreaterThanEqualsToken,
      SyntaxKind.AmpersandAmpersandToken,
      SyntaxKind.BarBarToken,
      SyntaxKind.ExclamationToken,
      SyntaxKind.QuestionToken,
      SyntaxKind.PlusPlusToken,
      SyntaxKind.MinusMinusToken,
      SyntaxKind.AmpersandToken,
      SyntaxKind.BarToken,
      SyntaxKind.CaretToken,
      SyntaxKind.TildeToken,
      SyntaxKind.LessThanLessThanToken,
      SyntaxKind.GreaterThanGreaterThanToken,
    ];

    return operators.includes(kind);
  }

  /**
   * Check if node is an operand
   */
  private isOperand(kind: SyntaxKind): boolean {
    return (
      kind === SyntaxKind.Identifier ||
      kind === SyntaxKind.NumericLiteral ||
      kind === SyntaxKind.StringLiteral ||
      kind === SyntaxKind.TrueKeyword ||
      kind === SyntaxKind.FalseKeyword ||
      kind === SyntaxKind.NullKeyword
    );
  }

  /**
   * Get operator symbol for syntax kind
   */
  private getOperatorSymbol(kind: SyntaxKind): string {
    const symbols: Record<number, string> = {
      [SyntaxKind.PlusToken]: '+',
      [SyntaxKind.MinusToken]: '-',
      [SyntaxKind.AsteriskToken]: '*',
      [SyntaxKind.SlashToken]: '/',
      [SyntaxKind.PercentToken]: '%',
      [SyntaxKind.EqualsToken]: '=',
      [SyntaxKind.EqualsEqualsToken]: '==',
      [SyntaxKind.EqualsEqualsEqualsToken]: '===',
      [SyntaxKind.ExclamationEqualsToken]: '!=',
      [SyntaxKind.ExclamationEqualsEqualsToken]: '!==',
      [SyntaxKind.LessThanToken]: '<',
      [SyntaxKind.GreaterThanToken]: '>',
      [SyntaxKind.LessThanEqualsToken]: '<=',
      [SyntaxKind.GreaterThanEqualsToken]: '>=',
      [SyntaxKind.AmpersandAmpersandToken]: '&&',
      [SyntaxKind.BarBarToken]: '||',
      [SyntaxKind.ExclamationToken]: '!',
      [SyntaxKind.QuestionToken]: '?',
      [SyntaxKind.PlusPlusToken]: '++',
      [SyntaxKind.MinusMinusToken]: '--',
    };

    return symbols[kind] || kind.toString();
  }
}
