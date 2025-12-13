/**
 * Unit tests for spacing detection rule
 */
import { describe, it, expect } from 'vitest';
import { checkSpacing, RULE_ID } from '../../../packages/core/src/design-check/rules/spacing.js';
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
    spacing: {
      '0': '0',
      px: '1px',
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
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

describe('checkSpacing', () => {
  describe('pixel value detection', () => {
    it('detects pixel values in style props', () => {
      const file = createFile(`
        <div style={{ padding: '15px' }}>Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].found).toBe('15px');
      expect(violations[0].rule).toBe(RULE_ID);
    });

    it('detects multiple spacing violations', () => {
      const file = createFile(`
        <div style={{
          padding: '15px',
          margin: '20px',
          gap: '12px'
        }}>Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(3);
    });

    it('detects spacing in camelCase properties', () => {
      const file = createFile(`
        <div style={{
          paddingTop: '15px',
          marginBottom: '20px'
        }}>Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(2);
    });
  });

  describe('Tailwind arbitrary value detection', () => {
    it('detects Tailwind arbitrary spacing', () => {
      const file = createFile(`
        <div className="p-[15px] m-[20px]">Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(2);
    });

    it('detects Tailwind directional spacing', () => {
      const file = createFile(`
        <div className="pt-[15px] mr-[20px] mb-[12px] pl-[10px]">Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations.length).toBeGreaterThanOrEqual(4);
    });

    it('detects width and height arbitrary values', () => {
      const file = createFile(`
        <div className="w-[100px] h-[50px]">Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(2);
    });
  });

  describe('allowed values', () => {
    it('allows 0px', () => {
      const file = createFile(`
        <div style={{ padding: '0px' }}>Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('allows 1px (border width)', () => {
      const file = createFile(`
        <div style={{ padding: '1px' }}>Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('allows values matching spacing tokens', () => {
      const file = createFile(`
        <div style={{
          padding: '8px',
          margin: '16px',
          gap: '24px'
        }}>Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });
  });

  describe('suggestions', () => {
    it('suggests nearest token for close values', () => {
      const file = createFile(`
        <div style={{ padding: '15px' }}>Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].suggestion).toMatch(/md \(16px\)/);
    });

    it('suggests sm for values close to 8px', () => {
      const file = createFile(`
        <div style={{ padding: '9px' }}>Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].suggestion).toMatch(/sm \(8px\)/);
    });
  });

  describe('non-spacing properties', () => {
    it('ignores font-size', () => {
      const file = createFile(`
        <div style={{ fontSize: '14px' }}>Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });

    it('ignores border-radius', () => {
      const file = createFile(`
        <div style={{ borderRadius: '8px' }}>Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(0);
    });
  });

  describe('location tracking', () => {
    it('reports correct line number', () => {
      const file = createFile(`line1
line2
<div style={{ padding: '15px' }}>Content</div>
line4`);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(3);
    });
  });

  describe('fixable flag', () => {
    it('marks violations as fixable when suggestion available', () => {
      const file = createFile(`
        <div style={{ padding: '15px' }}>Content</div>
      `);
      const violations = checkSpacing(file, defaultConfig);

      expect(violations).toHaveLength(1);
      expect(violations[0].fixable).toBe(true);
    });
  });
});
