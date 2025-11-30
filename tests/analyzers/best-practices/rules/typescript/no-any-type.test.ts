/**
 * Tests for NoAnyTypeRule
 */

import { describe, it, expect } from 'vitest';
import { NoAnyTypeRule } from '../../../../../src/analyzers/best-practices/rules/typescript/no-any-type.js';

describe('NoAnyTypeRule', () => {
  const rule = new NoAnyTypeRule();

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(rule.id).toBe('no-any-type');
    });

    it('should have correct name', () => {
      expect(rule.name).toBe('No Any Type');
    });

    it('should have high severity', () => {
      expect(rule.severity).toBe('high');
    });

    it('should have type-safety category', () => {
      expect(rule.category).toBe('type-safety');
    });

    it('should not be auto-fixable', () => {
      expect(rule.autoFixable).toBe(false);
    });
  });

  describe('check', () => {
    it('should detect any type in parameter', async () => {
      const content = 'function greet(name: any): void {}';
      const violations = await rule.check('test.ts', content);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('any');
      expect(violations[0].line).toBe(1);
    });

    it('should detect any type in return type', async () => {
      const content = 'function getData(): any { return {}; }';
      const violations = await rule.check('test.ts', content);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('any');
    });

    it('should detect any in generic array', async () => {
      const content = 'const items: Array<any> = [];';
      const violations = await rule.check('test.ts', content);

      expect(violations).toHaveLength(1);
    });

    it('should detect multiple any types', async () => {
      const content = `
        function process(data: any): any {
          const items: Array<any> = [];
          return data;
        }
      `;
      const violations = await rule.check('test.ts', content);

      expect(violations.length).toBeGreaterThanOrEqual(3);
    });

    it('should not flag proper types', async () => {
      const content = `
        function greet(name: string): string {
          return name;
        }
        const items: Array<string> = [];
      `;
      const violations = await rule.check('test.ts', content);

      expect(violations).toHaveLength(0);
    });

    it('should not flag "any" in comments', async () => {
      const content = `
        // This function can take any value
        function process(value: string): string {
          return value;
        }
      `;
      const violations = await rule.check('test.ts', content);

      expect(violations).toHaveLength(0);
    });

    it('should provide helpful suggestion', async () => {
      const content = 'function test(param: any) {}';
      const violations = await rule.check('test.ts', content);

      expect(violations[0].suggestion).toBeDefined();
      expect(violations[0].suggestion).toContain('specific type');
    });

    it('should have correct rule ID in violation', async () => {
      const content = 'let x: any;';
      const violations = await rule.check('test.ts', content);

      expect(violations[0].ruleId).toBe('no-any-type');
    });
  });
});
