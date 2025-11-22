/**
 * Tests for BestPracticeValidator
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { BestPracticeValidator } from '../../../src/analyzers/best-practices/best-practice-validator.js';
import { getRuleRegistry } from '../../../src/analyzers/best-practices/rules/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('BestPracticeValidator', () => {
  let validator: BestPracticeValidator;
  let tempDir: string;

  beforeAll(async () => {
    validator = new BestPracticeValidator();
    // Use automatosx/tmp for test files
    tempDir = path.join(process.cwd(), 'automatosx', 'tmp', 'test-validator');

    // Create temp directory
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch {
      // Directory might already exist
    }
  });

  describe('constructor', () => {
    it('should create instance', () => {
      expect(validator).toBeDefined();
      expect(validator).toBeInstanceOf(BestPracticeValidator);
    });
  });

  describe('validateFile', () => {
    it('should validate a clean file', async () => {
      const testFile = path.join(tempDir, 'clean.ts');
      await fs.writeFile(testFile, 'const x: string = "hello";');

      const result = await validator.validateFile(testFile);

      expect(result.file).toBe(testFile);
      expect(result.language).toBe('typescript');
      expect(result.violations).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.summary).toBeDefined();

      // Cleanup
      await fs.unlink(testFile);
    });

    it('should detect violations', async () => {
      const testFile = path.join(tempDir, 'has-violations.ts');
      await fs.writeFile(testFile, 'function test(param: any) {}');

      const result = await validator.validateFile(testFile);

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);

      // Cleanup
      await fs.unlink(testFile);
    });

    it('should detect TypeScript language', async () => {
      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(testFile, 'const x = 1;');

      const result = await validator.validateFile(testFile);

      expect(result.language).toBe('typescript');

      await fs.unlink(testFile);
    });

    it('should detect JavaScript language', async () => {
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'const x = 1;');

      const result = await validator.validateFile(testFile);

      expect(result.language).toBe('javascript');

      await fs.unlink(testFile);
    });

    it('should include timing information', async () => {
      const testFile = path.join(tempDir, 'timing.ts');
      await fs.writeFile(testFile, 'const x = 1;');

      const result = await validator.validateFile(testFile);

      expect(result.timestamp).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      await fs.unlink(testFile);
    });

    it('should respect rule configuration', async () => {
      const testFile = path.join(tempDir, 'config-test.ts');
      await fs.writeFile(testFile, 'function test(param: any) {}');

      // Disable no-any-type rule
      const result = await validator.validateFile(testFile, {
        rules: {
          'no-any-type': { enabled: false },
        },
      });

      // Should have no violations since rule is disabled
      const anyViolations = result.violations.filter(v => v.ruleId === 'no-any-type');
      expect(anyViolations).toHaveLength(0);

      await fs.unlink(testFile);
    });
  });

  describe('validateBatch', () => {
    it('should validate multiple files', async () => {
      const file1 = path.join(tempDir, 'batch1.ts');
      const file2 = path.join(tempDir, 'batch2.ts');

      await fs.writeFile(file1, 'const x: string = "hello";');
      await fs.writeFile(file2, 'const y: number = 42;');

      const result = await validator.validateBatch([file1, file2]);

      expect(result.files).toHaveLength(2);
      expect(result.totalViolations).toBeGreaterThanOrEqual(0);
      expect(result.averageScore).toBeGreaterThanOrEqual(0);
      expect(result.averageScore).toBeLessThanOrEqual(100);

      await fs.unlink(file1);
      await fs.unlink(file2);
    });

    it('should aggregate violations', async () => {
      const file1 = path.join(tempDir, 'agg1.ts');
      const file2 = path.join(tempDir, 'agg2.ts');

      await fs.writeFile(file1, 'function test1(param: any) {}');
      await fs.writeFile(file2, 'function test2(param: any) {}');

      const result = await validator.validateBatch([file1, file2]);

      expect(result.totalViolations).toBeGreaterThan(0);
      expect(result.criticalCount).toBeGreaterThanOrEqual(0);
      expect(result.highCount).toBeGreaterThan(0); // any type is high severity

      await fs.unlink(file1);
      await fs.unlink(file2);
    });

    it('should handle empty file list', async () => {
      const result = await validator.validateBatch([]);

      expect(result.files).toHaveLength(0);
      expect(result.totalViolations).toBe(0);
    });

    it('should handle invalid files gracefully', async () => {
      const validFile = path.join(tempDir, 'valid.ts');
      const invalidFile = path.join(tempDir, 'nonexistent.ts');

      await fs.writeFile(validFile, 'const x = 1;');

      const result = await validator.validateBatch([validFile, invalidFile]);

      // Should process valid file, skip invalid
      expect(result.files.length).toBeGreaterThanOrEqual(1);

      await fs.unlink(validFile);
    });
  });

  describe('scoring', () => {
    it('should give perfect score for clean code', async () => {
      const testFile = path.join(tempDir, 'perfect.ts');
      await fs.writeFile(testFile, `
        export function greet(name: string): string {
          return \`Hello, \${name}\`;
        }
      `);

      const result = await validator.validateFile(testFile);

      expect(result.score).toBe(100);

      await fs.unlink(testFile);
    });

    it('should penalize for violations', async () => {
      const testFile = path.join(tempDir, 'violations.ts');
      await fs.writeFile(testFile, 'function test(a: any, b: any, c: any) {}');

      const result = await validator.validateFile(testFile);

      expect(result.score).toBeLessThan(100);

      await fs.unlink(testFile);
    });
  });

  describe('rule registry integration', () => {
    it('should use all registered rules', () => {
      const registry = getRuleRegistry();
      const allRules = registry.getAll();

      // Should have 10 TypeScript rules
      expect(allRules.length).toBeGreaterThanOrEqual(10);
    });

    it('should run all enabled rules', async () => {
      const testFile = path.join(tempDir, 'all-rules.ts');
      await fs.writeFile(testFile, 'const x = 1;');

      const result = await validator.validateFile(testFile);

      // Should have run validation (even if no violations)
      expect(result.violations).toBeDefined();

      await fs.unlink(testFile);
    });
  });
});
