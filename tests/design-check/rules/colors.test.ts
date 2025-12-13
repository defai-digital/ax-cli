/**
 * Unit tests for color detection rule
 */
import { describe, it, expect } from 'vitest';
import { checkColors, RULE_ID } from '../../../packages/core/src/design-check/rules/colors.js';
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
  tokens: {
    colors: {},
    spacing: {},
  },
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

describe('checkColors', () => {
  describe('hex color detection', () => {
    it('detects 6-digit hex colors', () => {
      const file = createFile(`const color = '#1e90ff';`);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].found).toBe('#1e90ff');
      expect(violations[0].rule).toBe(RULE_ID);
    });

    it('detects 3-digit shorthand hex colors', () => {
      const file = createFile(`const color = '#fff';`);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].found).toBe('#fff');
    });

    it('detects 8-digit hex colors with alpha', () => {
      const file = createFile(`const color = '#1e90ffcc';`);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].found).toBe('#1e90ffcc');
    });

    it('detects multiple hex colors in same file', () => {
      const file = createFile(`
        const primary = '#1e90ff';
        const secondary = '#ff6b6b';
        const white = '#ffffff';
      `);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(3);
    });

    it('detects hex colors in style props', () => {
      const file = createFile(`
        <div style={{ backgroundColor: '#ff0000' }}>Content</div>
      `);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].found).toBe('#ff0000');
    });

    it('detects hex colors in Tailwind arbitrary values', () => {
      const file = createFile(`
        <button className="bg-[#1e90ff] text-[#fff]">Click</button>
      `);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(2);
    });
  });

  describe('RGB color detection', () => {
    it('detects rgb() colors', () => {
      const file = createFile(`const color = 'rgb(255, 0, 0)';`);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].found).toMatch(/rgb\(255,\s*0,\s*0\)/);
    });

    it('detects rgba() colors', () => {
      const file = createFile(`const color = 'rgba(255, 0, 0, 0.5)';`);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].found).toMatch(/rgba\(255,\s*0,\s*0,\s*0\.5\)/);
    });
  });

  describe('HSL color detection', () => {
    it('detects hsl() colors', () => {
      const file = createFile(`const color = 'hsl(240, 100%, 50%)';`);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].found).toMatch(/hsl\(240,\s*100%,\s*50%\)/);
    });

    it('detects hsla() colors', () => {
      const file = createFile(`const color = 'hsla(240, 100%, 50%, 0.8)';`);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(1);
    });
  });

  describe('token matching', () => {
    it('allows colors that match tokens', () => {
      const config: DesignCheckConfig = {
        ...defaultConfig,
        tokens: {
          ...defaultConfig.tokens,
          colors: { primary: '#1e90ff' },
        },
      };

      const file = createFile(`const color = '#1e90ff';`);
      const violations = checkColors(file, config);

      expect(violations).toHaveLength(0);
    });

    it('allows shorthand that matches expanded token', () => {
      const config: DesignCheckConfig = {
        ...defaultConfig,
        tokens: {
          ...defaultConfig.tokens,
          colors: { white: '#ffffff' },
        },
      };

      const file = createFile(`const color = '#fff';`);
      const violations = checkColors(file, config);

      expect(violations).toHaveLength(0);
    });

    it('suggests nearest token for similar colors', () => {
      const config: DesignCheckConfig = {
        ...defaultConfig,
        tokens: {
          ...defaultConfig.tokens,
          colors: { primary: '#1e90ff' },
        },
      };

      // #1e90fe is very close to #1e90ff
      const file = createFile(`const color = '#1e90fe';`);
      const violations = checkColors(file, config);

      expect(violations).toHaveLength(1);
      expect(violations[0].suggestion).toBe('primary');
    });
  });

  describe('comment handling', () => {
    it('ignores colors in single-line comments', () => {
      const file = createFile(`
        // const color = '#ff0000';
        const valid = 'text';
      `);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('ignores colors in multi-line comments', () => {
      const file = createFile(`
        /*
         * const color = '#ff0000';
         * background: #00ff00;
         */
        const valid = 'text';
      `);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });
  });

  describe('location tracking', () => {
    it('reports correct line number', () => {
      const file = createFile(`line1
line2
const color = '#ff0000';
line4`);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(3);
    });

    it('reports correct column number', () => {
      const file = createFile(`const color = '#ff0000';`);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].column).toBeGreaterThan(0);
    });
  });

  describe('fixable flag', () => {
    it('marks violations as fixable', () => {
      const file = createFile(`const color = '#ff0000';`);
      const violations = checkColors(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].fixable).toBe(true);
    });
  });
});
