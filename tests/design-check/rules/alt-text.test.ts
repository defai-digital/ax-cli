/**
 * Unit tests for alt-text detection rule
 */
import { describe, it, expect } from 'vitest';
import { checkAltText, RULE_ID } from '../../../packages/core/src/design-check/rules/alt-text.js';
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

describe('checkAltText', () => {
  describe('missing alt detection', () => {
    it('detects img without alt attribute', () => {
      const file = createFile(`<img src="/logo.png" />`);
      const violations = checkAltText(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe(RULE_ID);
    });

    it('detects self-closing img without alt', () => {
      const file = createFile(`<img src="/logo.png"/>`);
      const violations = checkAltText(file, defaultConfig);

      expect(violations).toHaveLength(1);
    });

    it('detects multiple images without alt', () => {
      const file = createFile(`
        <img src="/logo.png" />
        <img src="/hero.jpg" />
        <img src="/icon.svg" />
      `);
      const violations = checkAltText(file, defaultConfig);

      expect(violations).toHaveLength(3);
    });

    it('detects img with other attributes but no alt', () => {
      const file = createFile(`
        <img src="/logo.png" className="logo" width={100} height={50} />
      `);
      const violations = checkAltText(file, defaultConfig);

      expect(violations).toHaveLength(1);
    });
  });

  describe('valid alt attributes', () => {
    it('allows img with alt text', () => {
      const file = createFile(`<img src="/logo.png" alt="Company Logo" />`);
      const violations = checkAltText(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('allows img with empty alt (decorative)', () => {
      const file = createFile(`<img src="/decoration.png" alt="" />`);
      const violations = checkAltText(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('allows img with alt as first attribute', () => {
      const file = createFile(`<img alt="Logo" src="/logo.png" />`);
      const violations = checkAltText(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('allows img with dynamic alt', () => {
      const file = createFile(`<img src={src} alt={altText} />`);
      const violations = checkAltText(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('handles multiline img tags', () => {
      const file = createFile(`
        <img
          src="/logo.png"
          className="logo"
        />
      `);
      const violations = checkAltText(file, defaultConfig);

      expect(violations).toHaveLength(1);
    });

    it('handles img with spread props', () => {
      const file = createFile(`<img {...props} src="/logo.png" />`);
      const violations = checkAltText(file, defaultConfig);

      // May or may not have alt via spread props - should flag as missing
      expect(violations).toHaveLength(1);
    });
  });

  describe('location tracking', () => {
    it('reports correct line number', () => {
      const file = createFile(`line1
line2
<img src="/logo.png" />
line4`);
      const violations = checkAltText(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(3);
    });
  });

  describe('suggestions', () => {
    it('provides helpful suggestion', () => {
      const file = createFile(`<img src="/logo.png" />`);
      const violations = checkAltText(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].suggestion).toContain('alt=');
    });
  });
});
