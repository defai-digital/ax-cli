/**
 * God Object Anti-Pattern Detector
 *
 * Detects files that are too large and have too many responsibilities.
 * Indicates violation of Single Responsibility Principle.
 */

import { promises as fs } from 'fs';
import type { AntiPattern, ProjectStructure, FileInfo, Severity } from '../../../types/analysis.js';

export class GodObjectDetector {
  private readonly LINE_THRESHOLD = 500;
  private readonly METHOD_THRESHOLD = 20;
  private readonly LARGE_LINE_THRESHOLD = 1000;

  async detect(structure: ProjectStructure): Promise<AntiPattern[]> {
    const antiPatterns: AntiPattern[] = [];

    // Find large source files
    const largeFiles = structure.files.filter(
      (f) => f.lines > this.LINE_THRESHOLD && this.isSourceFile(f)
    );

    // Analyze each large file
    for (const file of largeFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        const methodCount = this.countMethods(content);
        const classCount = this.countClasses(content);

        // Only flag as God Object if it has many methods
        if (methodCount > this.METHOD_THRESHOLD) {
          antiPatterns.push(
            Object.freeze({
              name: 'God Object',
              severity: this.calculateSeverity(file.lines, methodCount),
              locations: [file.relativePath],
              description: `File has ${file.lines} lines and ${methodCount} methods, indicating a God Object anti-pattern`,
              suggestion:
                'Consider splitting this file into smaller, focused modules following the Single Responsibility Principle',
              impact:
                'Reduces maintainability, makes testing difficult, increases coupling, and violates SOLID principles',
              metadata: Object.freeze({
                lines: file.lines,
                methods: methodCount,
                classes: classCount,
                linesPerMethod: methodCount > 0 ? Math.round(file.lines / methodCount) : 0,
              }),
            })
          );
        }
      } catch (error) {
        // Skip files that can't be read
        console.warn(
          `Failed to analyze file ${file.relativePath}:`,
          (error as Error).message
        );
      }
    }

    return antiPatterns;
  }

  /**
   * Check if file is a source code file
   */
  private isSourceFile(file: FileInfo): boolean {
    return /\.(ts|js|tsx|jsx)$/.test(file.extension);
  }

  /**
   * Count methods/functions in file
   */
  private countMethods(content: string): number {
    let count = 0;

    // Function declarations
    const functionDeclarations = content.match(/function\s+\w+\s*\(/g);
    if (functionDeclarations) count += functionDeclarations.length;

    // Arrow functions assigned to variables/constants
    const arrowFunctions = content.match(/(const|let|var)\s+\w+\s*=\s*\([^)]*\)\s*=>/g);
    if (arrowFunctions) count += arrowFunctions.length;

    // Class methods
    const classMethods = content.match(/^\s+(public|private|protected|async|static)*\s*\w+\s*\([^)]*\)\s*[:{]/gm);
    if (classMethods) count += classMethods.length;

    // Object methods
    const objectMethods = content.match(/\w+\s*:\s*(async\s+)?function\s*\(/g);
    if (objectMethods) count += objectMethods.length;

    return count;
  }

  /**
   * Count classes in file
   */
  private countClasses(content: string): number {
    const classes = content.match(/class\s+\w+/g);
    return classes ? classes.length : 0;
  }

  /**
   * Calculate severity based on file size and method count
   */
  private calculateSeverity(lines: number, methods: number): Severity {
    // Critical: Extremely large or many methods
    if (lines > this.LARGE_LINE_THRESHOLD || methods > 50) {
      return 'critical';
    }

    // High: Very large
    if (lines > 750 || methods > 30) {
      return 'high';
    }

    // Medium: Large
    if (lines > 600 || methods > 25) {
      return 'medium';
    }

    // Low: Moderately large
    return 'low';
  }
}
