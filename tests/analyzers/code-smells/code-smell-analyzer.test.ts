/**
 * Code Smell Analyzer Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CodeSmellAnalyzer } from '../../../src/analyzers/code-smells/code-smell-analyzer.js';
import { SmellType, SmellSeverity } from '../../../src/analyzers/code-smells/types.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('CodeSmellAnalyzer', () => {
  let analyzer: CodeSmellAnalyzer;
  let tempDir: string;

  beforeEach(async () => {
    analyzer = new CodeSmellAnalyzer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smell-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createTestFile = async (filename: string, content: string): Promise<string> => {
    const filePath = path.join(tempDir, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  };

  describe('Long Method Detection', () => {
    it('should detect long functions', async () => {
      const longFunction = `
        export function veryLongFunction() {
          ${Array.from({ length: 60 }, (_, i) => `  const x${i} = ${i};`).join('\n')}
        }
      `;

      await createTestFile('long-method.ts', longFunction);
      const result = await analyzer.analyzeDirectory(tempDir);

      const longMethodSmells = result.smells.filter(s => s.type === SmellType.LONG_METHOD);
      expect(longMethodSmells.length).toBeGreaterThan(0);
      expect(longMethodSmells[0].message).toContain('too long');
    });

    it('should not detect short functions', async () => {
      await createTestFile('short-method.ts', `
        export function shortFunction() {
          return 42;
        }
      `);

      const result = await analyzer.analyzeDirectory(tempDir);
      const longMethodSmells = result.smells.filter(s => s.type === SmellType.LONG_METHOD);
      expect(longMethodSmells.length).toBe(0);
    });
  });

  describe('Large Class Detection', () => {
    it('should detect large classes', async () => {
      const methods = Array.from({ length: 25 }, (_, i) => `
        method${i}() {
          return ${i};
        }
      `).join('\n');

      await createTestFile('large-class.ts', `
        export class VeryLargeClass {
          ${methods}
        }
      `);

      const result = await analyzer.analyzeDirectory(tempDir);
      const largeClassSmells = result.smells.filter(s => s.type === SmellType.LARGE_CLASS);
      expect(largeClassSmells.length).toBeGreaterThan(0);
    });
  });

  describe('Long Parameter List Detection', () => {
    it('should detect functions with too many parameters', async () => {
      await createTestFile('long-params.ts', `
        export function manyParams(a: number, b: string, c: boolean, d: number, e: string, f: boolean, g: number) {
          return a + b;
        }
      `);

      const result = await analyzer.analyzeDirectory(tempDir);
      const paramSmells = result.smells.filter(s => s.type === SmellType.LONG_PARAMETER_LIST);
      expect(paramSmells.length).toBeGreaterThan(0);
      expect(paramSmells[0].message).toContain('too many parameters');
    });
  });

  describe('Magic Numbers Detection', () => {
    it('should detect magic numbers', async () => {
      await createTestFile('magic.ts', `
        export function calculate() {
          return 42 * 3.14159 + 1337;
        }
      `);

      const result = await analyzer.analyzeDirectory(tempDir);
      const magicSmells = result.smells.filter(s => s.type === SmellType.MAGIC_NUMBERS);
      expect(magicSmells.length).toBeGreaterThan(0);
    });

    it('should not flag allowed numbers', async () => {
      await createTestFile('allowed.ts', `
        export function calculate() {
          return 0 + 1 + 2 - 1 + 10 * 100;
        }
      `);

      const result = await analyzer.analyzeDirectory(tempDir);
      const magicSmells = result.smells.filter(s => s.type === SmellType.MAGIC_NUMBERS);
      expect(magicSmells.length).toBe(0);
    });
  });

  describe('Nested Conditionals Detection', () => {
    it('should detect deeply nested conditionals', async () => {
      await createTestFile('nested.ts', `
        export function deeplyNested(a: number, b: number, c: number, d: number) {
          if (a > 0) {
            if (b > 0) {
              if (c > 0) {
                if (d > 0) {
                  return true;
                }
              }
            }
          }
          return false;
        }
      `);

      const result = await analyzer.analyzeDirectory(tempDir);
      const nestedSmells = result.smells.filter(s => s.type === SmellType.NESTED_CONDITIONALS);
      expect(nestedSmells.length).toBeGreaterThan(0);
    });
  });

  describe('Dead Code Detection', () => {
    it('should detect unused variables', async () => {
      await createTestFile('dead.ts', `
        const unusedVar = 42;
        export const used = 100;
      `);

      const result = await analyzer.analyzeDirectory(tempDir);
      const deadSmells = result.smells.filter(s => s.type === SmellType.DEAD_CODE);
      expect(deadSmells.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeFile', () => {
    it('should analyze single file', async () => {
      const filePath = await createTestFile('single.ts', `
        export function longFunction() {
          ${Array.from({ length: 60 }, (_, i) => `  const x${i} = ${i};`).join('\n')}
        }
      `);

      const smells = await analyzer.analyzeFile(filePath);
      expect(smells.length).toBeGreaterThan(0);
    });
  });

  describe('Summary Statistics', () => {
    it('should calculate summary correctly', async () => {
      await createTestFile('test1.ts', `
        export function longFunction() {
          ${Array.from({ length: 60 }, (_, i) => `  const x${i} = ${i};`).join('\n')}
        }
      `);

      await createTestFile('test2.ts', `
        export function manyParams(a: number, b: string, c: boolean, d: number, e: string, f: boolean) {
          return a;
        }
      `);

      const result = await analyzer.analyzeDirectory(tempDir);

      expect(result.summary.totalSmells).toBeGreaterThan(0);
      expect(result.summary.filesAnalyzed).toBeGreaterThanOrEqual(2);
      expect(result.summary.codeHealthScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.codeHealthScore).toBeLessThanOrEqual(100);
    });

    it('should calculate smells by type', async () => {
      await createTestFile('test.ts', `
        export function longFunction() {
          ${Array.from({ length: 60 }, (_, i) => `  const x${i} = ${i};`).join('\n')}
        }
      `);

      const result = await analyzer.analyzeDirectory(tempDir);

      expect(result.summary.smellsByType).toBeDefined();
      expect(result.summary.smellsByType[SmellType.LONG_METHOD]).toBeGreaterThan(0);
    });

    it('should calculate smells by severity', async () => {
      await createTestFile('test.ts', `
        export function longFunction() {
          ${Array.from({ length: 100 }, (_, i) => `  const x${i} = ${i};`).join('\n')}
        }
      `);

      const result = await analyzer.analyzeDirectory(tempDir);

      expect(result.summary.smellsBySeverity).toBeDefined();
      const totalBySeverity = Object.values(result.summary.smellsBySeverity).reduce((sum, count) => sum + count, 0);
      expect(totalBySeverity).toBe(result.summary.totalSmells);
    });

    it('should handle empty directory', async () => {
      const result = await analyzer.analyzeDirectory(tempDir);

      expect(result.smells).toEqual([]);
      expect(result.summary.totalSmells).toBe(0);
      expect(result.summary.filesAnalyzed).toBe(0);
      expect(result.summary.codeHealthScore).toBe(100);
    });

    it('should include timestamp', async () => {
      const result = await analyzer.analyzeDirectory(tempDir);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should calculate average smells per file', async () => {
      await createTestFile('test1.ts', `
        export function longFunction() {
          ${Array.from({ length: 60 }, (_, i) => `  const x${i} = ${i};`).join('\n')}
        }
      `);

      await createTestFile('test2.ts', `
        export const clean = 42;
      `);

      const result = await analyzer.analyzeDirectory(tempDir);
      expect(result.summary.averageSmellsPerFile).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration', () => {
    it('should respect ignore patterns', async () => {
      await createTestFile('src/index.ts', `
        export function longFunction() {
          ${Array.from({ length: 60 }, (_, i) => `  const x${i} = ${i};`).join('\n')}
        }
      `);

      await createTestFile('test.test.ts', `
        export function longFunction() {
          ${Array.from({ length: 60 }, (_, i) => `  const x${i} = ${i};`).join('\n')}
        }
      `);

      const result = await analyzer.analyzeDirectory(tempDir);

      // Test files should be automatically ignored
      const testFiles = result.smells.filter(s => s.filePath.includes('.test.'));
      expect(testFiles.length).toBe(0);
    });

    it('should handle parse errors gracefully', async () => {
      await createTestFile('invalid.ts', 'this is not valid TypeScript {{{');

      const result = await analyzer.analyzeDirectory(tempDir);
      // Should not throw, just skip invalid files
      expect(result).toBeDefined();
    });
  });

  describe('Health Score Calculation', () => {
    it('should return high score for clean code', async () => {
      await createTestFile('clean.ts', `
        export function shortFunction() {
          return 42;
        }
      `);

      const result = await analyzer.analyzeDirectory(tempDir);
      expect(result.summary.codeHealthScore).toBeGreaterThan(90);
    });

    it('should return lower score for smelly code', async () => {
      // Create multiple smells
      await createTestFile('smelly.ts', `
        export function veryLongFunctionWithManyIssues(a: number, b: string, c: boolean, d: number, e: string, f: boolean) {
          ${Array.from({ length: 100 }, (_, i) => `  const x${i} = ${i} * 3.14159;`).join('\n')}

          if (a > 0) {
            if (b !== '') {
              if (c) {
                if (d > 0) {
                  return true;
                }
              }
            }
          }
          return false;
        }
      `);

      const result = await analyzer.analyzeDirectory(tempDir);
      expect(result.summary.codeHealthScore).toBeLessThan(100);
    });
  });
});
