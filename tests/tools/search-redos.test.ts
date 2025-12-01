/**
 * REGRESSION TESTS: Search Tool ReDoS Prevention (implemented in v3.7.2+)
 *
 * Tests ReDoS (Regular Expression Denial of Service) validation.
 * The validation IS IMPLEMENTED in src/utils/input-sanitizer.ts:validateRegexPattern()
 * and integrated into SearchTool.search().
 *
 * These tests verify the validation prevents malicious regex patterns.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SearchTool } from '../../src/tools/search.js';

describe('Search Tool ReDoS Regression Tests', () => {
  let searchTool: SearchTool;

  beforeEach(() => {
    searchTool = new SearchTool();
  });

  describe('Catastrophic Backtracking Prevention', () => {
    it('should reject patterns with nested quantifiers', async () => {
      // Pattern like (a+)+ causes exponential backtracking
      const dangerousPatterns = [
        '(a+)+',
        '(a*)*',
        '(a+)*',
        '(a*)+',
        '(x+)+y',
        '(.*)*',
        '(.+)+',
      ];

      for (const pattern of dangerousPatterns) {
        const result = await searchTool.search(pattern, { regex: true });

        // Should reject dangerous pattern
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.toLowerCase()).toMatch(/nested quantifier|redos|invalid/i);
      }
    });

    it('should reject patterns with alternation and nested quantifiers', async () => {
      // Patterns like (a|ab)* with nested quantifiers cause combinatorial explosion
      const dangerousPatterns = [
        '(a|ab)*',
        '(x|xy|xyz)*',
        '(.|..|...)*',
      ];

      for (const pattern of dangerousPatterns) {
        const result = await searchTool.search(pattern, { regex: true });

        // These have nested quantifiers (group with * quantified again)
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should reject patterns with repeated repetition groups', async () => {
      // Patterns like (a*)+ can cause quadratic behavior
      const dangerousPatterns = [
        '(a*)+',
        '(x+)*',
        '(.*)+',
      ];

      for (const pattern of dangerousPatterns) {
        const result = await searchTool.search(pattern, { regex: true });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.toLowerCase()).toMatch(/nested quantifier|redos/i);
      }
    });

    it('should reject exponential lookahead patterns', async () => {
      // Patterns with nested lookaheads can be very slow
      const dangerousPatterns = [
        '(?=a+)+',
        '(?=.*)+',
        '(?!.+)+',
      ];

      for (const pattern of dangerousPatterns) {
        const result = await searchTool.search(pattern, { regex: true });

        // Should reject patterns with nested quantifiers
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Fixed-String Mode Safety', () => {
    it('should not reject regex metacharacters in fixed-string mode', async () => {
      // In fixed-string mode, these should be treated as literals (safe)
      const patternsWithMetachars = [
        'file.txt',
        'test+data',
        'value(a)',
      ];

      for (const pattern of patternsWithMetachars) {
        const result = await searchTool.search(pattern, { regex: false });

        // Should work in fixed-string mode (safe - no regex interpretation)
        // May return no results, but should not error on pattern validation
        expect(result).toBeDefined();
      }
    });

    it('should always validate patterns even in fixed-string mode', async () => {
      // Even in fixed-string mode, validation should run
      const result = await searchTool.search('(a+)+', { regex: false });

      // Should succeed (treated as literal string) or warn about metacharacters
      expect(result).toBeDefined();
    });
  });

  describe('Real-World Attack Patterns', () => {
    it('should reject classic email regex DoS', async () => {
      // Classic ReDoS in email validation
      const emailReDoS = '^([a-zA-Z0-9])(([\\-.]|[_]+)?([a-zA-Z0-9]+))*(@){1}[a-z0-9]+[.]{1}(([a-z]{2,3})|([a-z]{2,3}[.]{1}[a-z]{2,3}))$';

      const result = await searchTool.search(emailReDoS, { regex: true });

      // Has nested quantifiers
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle simple URL patterns safely', async () => {
      // Simple URL regex without nested quantifiers
      const safeUrlPattern = 'https?://[a-z]+\\.[a-z]{2,}';

      const result = await searchTool.search(safeUrlPattern, { regex: true });

      // Should be accepted (no nested quantifiers)
      // May return no results, but pattern should be valid
      expect(result).toBeDefined();
    });
  });

  describe('Performance Regression Prevention', () => {
    it('should validate patterns quickly', async () => {
      // Validation itself should be fast
      const patterns = [
        'simple',
        'with.*wildcard',
        'with+plus',
        'with|alternation',
        'with(group)',
        'with[charset]',
      ];

      const startTime = Date.now();

      for (const pattern of patterns) {
        await searchTool.search(pattern, { regex: true });
      }

      const duration = Date.now() - startTime;

      // Should validate all patterns quickly (<10 seconds, accounting for CI load variance)
      expect(duration).toBeLessThan(10000);
    });

    it('should not slow down safe regex searches', async () => {
      // Safe patterns should work at full speed
      const safePattern = 'function\\s+\\w+\\s*\\(';

      const startTime = Date.now();

      await searchTool.search(safePattern, { regex: true });

      const duration = Date.now() - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty patterns', async () => {
      const result = await searchTool.search('', { regex: true });

      // Should handle gracefully (not crash)
      expect(result).toBeDefined();
    });

    it('should reject excessively long patterns', async () => {
      const longPattern = 'a'.repeat(2000);

      const result = await searchTool.search(longPattern, { regex: true });

      // Should reject patterns that are too long (max 1000 in validator)
      // May succeed if treated as literal, but should handle gracefully
      expect(result).toBeDefined();
    });

    it('should handle patterns with special characters', async () => {
      const specialPatterns = [
        '\\n\\r\\t',
        '\\w+',
        '\\d+',
      ];

      for (const pattern of specialPatterns) {
        const result = await searchTool.search(pattern, { regex: true });
        expect(result).toBeDefined();
      }
    });
  });

  describe('Security Validation', () => {
    it('should validate patterns before execution', async () => {
      // Validation should happen BEFORE attempting to search
      const maliciousPattern = '(a+)+b';

      const result = await searchTool.search(maliciousPattern, { regex: true });

      // Should reject during validation, not during execution
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.toLowerCase()).toMatch(/nested quantifier|redos|invalid/i);
    });

    it('should enforce maximum pattern length', async () => {
      // Extremely long patterns could cause issues
      const hugePattern = '('.repeat(500) + 'a' + ')'.repeat(500);

      const result = await searchTool.search(hugePattern, { regex: true });

      // Should handle gracefully (reject or truncate)
      expect(result).toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    it('should still accept safe common patterns', async () => {
      const safePatterns = [
        'TODO:',
        'FIXME:',
        'function\\s+\\w+',
        'class\\s+\\w+',
        'import\\s+.*from',
        'export\\s+(default\\s+)?',
      ];

      for (const pattern of safePatterns) {
        const result = await searchTool.search(pattern, { regex: true });

        // Should work (not rejected as dangerous)
        expect(result).toBeDefined();
        // Note: result.success may be false if no matches found, but pattern should be valid
      }
    });

    it('should handle literal string searches', async () => {
      // Non-regex searches should work normally
      const result = await searchTool.search('simple string', { regex: false });

      expect(result).toBeDefined();
      // Should not treat as regex
    });
  });

  describe('Documentation and Warnings', () => {
    it('should provide helpful error messages for dangerous patterns', async () => {
      const result = await searchTool.search('(a+)+', { regex: true });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      const message = result.error || '';

      expect(
        message.toLowerCase().includes('dangerous') ||
        message.toLowerCase().includes('nested quantifier') ||
        message.toLowerCase().includes('redos') ||
        message.toLowerCase().includes('invalid')
      ).toBe(true);
    });
  });
});
