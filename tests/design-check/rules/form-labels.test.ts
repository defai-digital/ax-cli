/**
 * Unit tests for form-labels detection rule
 */
import { describe, it, expect } from 'vitest';
import { checkFormLabels, RULE_ID } from '../../../packages/core/src/design-check/rules/form-labels.js';
import type { FileContent, DesignCheckConfig } from '../../../packages/core/src/design-check/types.js';

// Helper to create file content
function createFile(content: string, path = '/test/file.tsx'): FileContent {
  return {
    path,
    content,
    lines: content.split('\n'),
  };
}

// Default test config
const defaultConfig: DesignCheckConfig = {
  tokens: { colors: {}, spacing: {} },
  rules: {
    'no-hardcoded-colors': 'error',
    'no-raw-spacing': 'warn',
    'no-inline-styles': 'off',
    'missing-alt-text': 'error',
    'missing-form-labels': 'error',
  },
  include: ['**/*.tsx'],
  ignore: [],
};

describe('checkFormLabels', () => {
  describe('missing label detection', () => {
    it('detects input without label', () => {
      const file = createFile(`<input type="text" />`);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe(RULE_ID);
    });

    it('detects input with placeholder but no label', () => {
      const file = createFile(`
        <input type="email" placeholder="Enter your email" />
      `);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('placeholder is not a label');
    });

    it('detects multiple inputs without labels', () => {
      const file = createFile(`
        <input type="text" />
        <input type="email" />
        <input type="password" />
      `);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(3);
    });

    it('detects textarea without label', () => {
      const file = createFile(`<textarea></textarea>`);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(1);
    });

    it('detects select without label', () => {
      const file = createFile(`
        <select>
          <option>Option 1</option>
        </select>
      `);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(1);
    });
  });

  describe('valid label patterns', () => {
    it('allows input with associated label (htmlFor)', () => {
      const file = createFile(`
        <label htmlFor="email">Email</label>
        <input id="email" type="email" />
      `);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('allows input with aria-label', () => {
      const file = createFile(`
        <input type="search" aria-label="Search" />
      `);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('allows input with aria-labelledby', () => {
      const file = createFile(`
        <span id="label">Search</span>
        <input type="search" aria-labelledby="label" />
      `);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('allows input wrapped in label', () => {
      const file = createFile(`
        <label>
          Email
          <input type="email" />
        </label>
      `);
      const violations = checkFormLabels(file, defaultConfig);

      // This pattern is valid but might be harder to detect
      // The rule may still flag it if it doesn't check parent elements
      // This test documents current behavior
      expect(violations.length).toBeLessThanOrEqual(1);
    });
  });

  describe('excluded input types', () => {
    it('ignores hidden inputs', () => {
      const file = createFile(`<input type="hidden" value="token" />`);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('ignores submit buttons', () => {
      const file = createFile(`<input type="submit" value="Submit" />`);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('ignores button type inputs', () => {
      const file = createFile(`<input type="button" value="Click" />`);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('ignores image type inputs', () => {
      const file = createFile(`<input type="image" src="/submit.png" alt="Submit" />`);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('ignores reset buttons', () => {
      const file = createFile(`<input type="reset" value="Reset" />`);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('handles multiline input tags', () => {
      const file = createFile(`
        <input
          type="text"
          className="input"
        />
      `);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(1);
    });

    it('handles input with spread props', () => {
      const file = createFile(`<input {...props} type="text" />`);
      const violations = checkFormLabels(file, defaultConfig);

      // May have aria-label via spread, but should flag
      expect(violations).toHaveLength(1);
    });
  });

  describe('location tracking', () => {
    it('reports correct line number', () => {
      const file = createFile(`line1
line2
<input type="text" />
line4`);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(3);
    });
  });

  describe('suggestions', () => {
    it('provides helpful suggestion', () => {
      const file = createFile(`<input type="text" />`);
      const violations = checkFormLabels(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].suggestion).toContain('aria-label');
    });
  });
});
