/**
 * Tests for MetricsAnalyzer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetricsAnalyzer } from '../../../src/analyzers/metrics/metrics-analyzer.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('MetricsAnalyzer', () => {
  let analyzer: MetricsAnalyzer;
  let tempDir: string;

  beforeEach(async () => {
    analyzer = new MetricsAnalyzer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'metrics-test-'));
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

  describe('analyze', () => {
    it('should analyze files in directory', async () => {
      await createTestFile('module.ts', `
        export function add(a: number, b: number): number {
          return a + b;
        }

        export function subtract(a: number, b: number): number {
          return a - b;
        }
      `);

      const result = await analyzer.analyze(tempDir, {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/node_modules/**'],
      });

      expect(result).toBeDefined();
      expect(result.fileMetrics).toBeDefined();
      expect(Array.isArray(result.fileMetrics)).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should calculate file metrics correctly', async () => {
      await createTestFile('calc.ts', `
        export function calculate(x: number, y: number): number {
          if (x > 0) {
            return x + y;
          } else {
            return x - y;
          }
        }
      `);

      const result = await analyzer.analyze(tempDir, {
        includePatterns: ['calc.ts'],
      });

      expect(result.fileMetrics.length).toBeGreaterThan(0);

      const fileMetric = result.fileMetrics[0];
      expect(fileMetric).toBeDefined();
      expect(fileMetric.filePath).toBeDefined();
      expect(fileMetric.halstead).toBeDefined();
      expect(fileMetric.maintainability).toBeDefined();
      expect(fileMetric.averageComplexity).toBeGreaterThanOrEqual(0);
      expect(fileMetric.maxComplexity).toBeGreaterThanOrEqual(0);
      expect(fileMetric.totalFunctions).toBeGreaterThanOrEqual(0);
    });

    it('should include Halstead metrics', async () => {
      await createTestFile('math.ts', `
        export function multiply(a: number, b: number): number {
          return a * b;
        }
      `);

      const result = await analyzer.analyze(tempDir, {
        includePatterns: ['math.ts'],
      });

      const fileMetric = result.fileMetrics[0];
      const halstead = fileMetric.halstead;

      expect(halstead.n1).toBeGreaterThanOrEqual(0); // Distinct operators
      expect(halstead.n2).toBeGreaterThanOrEqual(0); // Distinct operands
      expect(halstead.N1).toBeGreaterThanOrEqual(0); // Total operators
      expect(halstead.N2).toBeGreaterThanOrEqual(0); // Total operands
      expect(halstead.vocabulary).toBeGreaterThanOrEqual(0);
      expect(halstead.length).toBeGreaterThanOrEqual(0);
      expect(halstead.volume).toBeGreaterThanOrEqual(0);
      expect(halstead.difficulty).toBeGreaterThanOrEqual(0);
      expect(halstead.effort).toBeGreaterThanOrEqual(0);
      expect(halstead.time).toBeGreaterThanOrEqual(0);
      expect(halstead.bugs).toBeGreaterThanOrEqual(0);
    });

    it('should include Maintainability Index', async () => {
      await createTestFile('utils.ts', `
        export function isEven(n: number): boolean {
          return n % 2 === 0;
        }
      `);

      const result = await analyzer.analyze(tempDir, {
        includePatterns: ['utils.ts'],
      });

      const fileMetric = result.fileMetrics[0];
      const mi = fileMetric.maintainability;

      expect(mi.score).toBeGreaterThanOrEqual(0);
      expect(mi.score).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(mi.rating);
      expect(mi.halsteadVolume).toBeGreaterThanOrEqual(0);
      expect(mi.cyclomaticComplexity).toBeGreaterThanOrEqual(0);
      expect(mi.linesOfCode).toBeGreaterThanOrEqual(0);
    });

    it('should calculate summary statistics', async () => {
      await createTestFile('file1.ts', `
        export function fn1() { return 1; }
      `);
      await createTestFile('file2.ts', `
        export function fn2() { return 2; }
      `);

      const result = await analyzer.analyze(tempDir, {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.test.ts', '**/*.spec.ts'],
      });

      const summary = result.summary;

      expect(summary.filesAnalyzed).toBeGreaterThan(0);
      expect(summary.averageMaintainability).toBeGreaterThanOrEqual(0);
      expect(summary.averageMaintainability).toBeLessThanOrEqual(100);
      expect(summary.averageHalsteadVolume).toBeGreaterThanOrEqual(0);
      expect(summary.averageComplexity).toBeGreaterThanOrEqual(0);
      expect(summary.lowMaintainabilityCount).toBeGreaterThanOrEqual(0);
      expect(summary.highComplexityCount).toBeGreaterThanOrEqual(0);
    });

    it('should respect include patterns', async () => {
      await createTestFile('target.ts', `export const x = 1;`);
      await createTestFile('ignore.tsx', `export const y = 2;`);

      const result = await analyzer.analyze(tempDir, {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.tsx'],
      });

      expect(result.fileMetrics.length).toBeGreaterThan(0);
      for (const metric of result.fileMetrics) {
        expect(metric.filePath).toContain('.ts');
        expect(metric.filePath).not.toContain('.tsx');
      }
    });

    it('should respect exclude patterns', async () => {
      await createTestFile('code.ts', `export const c = 3;`);
      await createTestFile('code.test.ts', `import { c } from './code';`);

      const result = await analyzer.analyze(tempDir, {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.test.ts', '**/*.spec.ts'],
      });

      for (const metric of result.fileMetrics) {
        expect(metric.filePath).not.toContain('.test.ts');
        expect(metric.filePath).not.toContain('.spec.ts');
      }
    });

    it('should handle empty directory gracefully', async () => {
      const result = await analyzer.analyze(tempDir, {
        includePatterns: ['nonexistent-pattern-*.ts'],
      });

      expect(result.fileMetrics).toEqual([]);
      expect(result.summary.filesAnalyzed).toBe(0);
      expect(result.summary.averageMaintainability).toBe(0);
      expect(result.summary.averageHalsteadVolume).toBe(0);
      expect(result.summary.averageComplexity).toBe(0);
    });

    it('should identify low maintainability files', async () => {
      await createTestFile('simple.ts', `export const s = 1;`);
      await createTestFile('complex.ts', `
        export function veryComplexFunction(a: number, b: number, c: number, d: number) {
          if (a > 0) {
            if (b > 0) {
              if (c > 0) {
                if (d > 0) {
                  return a + b + c + d;
                } else {
                  return a + b + c - d;
                }
              } else {
                return a + b - c;
              }
            } else {
              return a - b;
            }
          } else {
            return -a;
          }
        }
      `);

      const result = await analyzer.analyze(tempDir, {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.test.ts'],
      });

      // Check that lowMaintainabilityCount is calculated
      expect(result.summary.lowMaintainabilityCount).toBeGreaterThanOrEqual(0);

      // Verify it matches actual count
      const actualLowMICount = result.fileMetrics.filter(
        (m) => m.maintainability.score < 65
      ).length;
      expect(result.summary.lowMaintainabilityCount).toBe(actualLowMICount);
    });

    it('should identify high complexity files', async () => {
      await createTestFile('low.ts', `export const x = 1;`);
      await createTestFile('high.ts', `
        export function highComplexity(n: number): number {
          if (n === 0) return 0;
          if (n === 1) return 1;
          if (n === 2) return 2;
          if (n === 3) return 3;
          if (n === 4) return 4;
          if (n === 5) return 5;
          if (n === 6) return 6;
          if (n === 7) return 7;
          if (n === 8) return 8;
          if (n === 9) return 9;
          if (n === 10) return 10;
          return -1;
        }
      `);

      const result = await analyzer.analyze(tempDir, {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.test.ts'],
      });

      // Check that highComplexityCount is calculated
      expect(result.summary.highComplexityCount).toBeGreaterThanOrEqual(0);

      // Verify it matches actual count
      const actualHighComplexityCount = result.fileMetrics.filter(
        (m) => m.maxComplexity > 10
      ).length;
      expect(result.summary.highComplexityCount).toBe(
        actualHighComplexityCount
      );
    });

    it('should sort files consistently', async () => {
      await createTestFile('z-file.ts', `export const z = 1;`);
      await createTestFile('a-file.ts', `export const a = 2;`);
      await createTestFile('m-file.ts', `export const m = 3;`);

      const result = await analyzer.analyze(tempDir, {
        includePatterns: ['**/*.ts'],
      });

      // Files should be sorted alphabetically
      const filePaths = result.fileMetrics.map((m) => m.filePath);
      const sortedPaths = [...filePaths].sort();
      expect(filePaths).toEqual(sortedPaths);
    });
  });
});
