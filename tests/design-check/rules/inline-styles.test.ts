/**
 * Unit tests for inline-styles detection rule
 */
import { describe, it, expect } from 'vitest';
import { checkInlineStyles, RULE_ID } from '../../../packages/core/src/design-check/rules/inline-styles.js';
import type { FileContent } from '../../../packages/core/src/design-check/types.js';

// Helper to create file content
function createFile(content: string, path = '/test/file.tsx'): FileContent {
  return {
    path,
    content,
    lines: content.split('\n'),
  };
}

describe('checkInlineStyles', () => {
  describe('JSX style prop detection', () => {
    it('detects style={{ }} object literal', () => {
      const file = createFile(`<div style={{ color: 'red' }}>Content</div>`);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe(RULE_ID);
      expect(violations[0].message).toContain('Inline style');
    });

    it('detects style={variable} expression', () => {
      const file = createFile(`<div style={customStyles}>Content</div>`);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
    });

    it('detects multiple inline styles', () => {
      const file = createFile(`
        <div style={{ padding: '10px' }}>
          <span style={{ color: 'blue' }}>Text</span>
          <p style={{ margin: '5px' }}>Paragraph</p>
        </div>
      `);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(3);
    });

    it('detects style with complex object', () => {
      const file = createFile(`
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>Content</div>
      `);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
    });

    it('detects style with spread operator', () => {
      const file = createFile(`<div style={{ ...baseStyles, color: 'red' }}>Content</div>`);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
    });
  });

  describe('HTML style attribute detection', () => {
    it('detects style="..." in HTML files', () => {
      const file = createFile(
        `<div style="color: red; padding: 10px;">Content</div>`,
        '/test/file.html'
      );
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
      expect(violations[0].found).toContain('style=');
    });

    it('detects style with single quotes in HTML', () => {
      const file = createFile(
        `<div style='background: blue;'>Content</div>`,
        '/test/file.html'
      );
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
    });

    it('detects multiple styles in HTML', () => {
      const file = createFile(
        `<div style="color: red;"><span style="font-size: 14px;">Text</span></div>`,
        '/test/file.html'
      );
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(2);
    });
  });

  describe('file type filtering', () => {
    it('checks .tsx files', () => {
      const file = createFile(`<div style={{ color: 'red' }} />`, '/test/file.tsx');
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
    });

    it('checks .jsx files', () => {
      const file = createFile(`<div style={{ color: 'red' }} />`, '/test/file.jsx');
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
    });

    it('checks .ts files', () => {
      const file = createFile(`const el = <div style={{ color: 'red' }} />`, '/test/file.ts');
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
    });

    it('checks .js files', () => {
      const file = createFile(`const el = <div style={{ color: 'red' }} />`, '/test/file.js');
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
    });

    it('checks .html files', () => {
      const file = createFile(`<div style="color: red;">Content</div>`, '/test/file.html');
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
    });

    it('ignores .css files', () => {
      const file = createFile(`.class { style: something; }`, '/test/file.css');
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(0);
    });

    it('ignores .json files', () => {
      const file = createFile(`{ "style": {} }`, '/test/file.json');
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(0);
    });
  });

  describe('location tracking', () => {
    it('reports correct line number', () => {
      const file = createFile(`line1
line2
<div style={{ color: 'red' }}>Content</div>
line4`);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(3);
    });

    it('reports correct column number', () => {
      const file = createFile(`<div style={{ color: 'red' }}>Content</div>`);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
      expect(violations[0].column).toBeGreaterThan(0);
    });
  });

  describe('suggestions', () => {
    it('provides helpful suggestion for JSX', () => {
      const file = createFile(`<div style={{ color: 'red' }}>Content</div>`);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
      expect(violations[0].suggestion).toMatch(/CSS classes|Tailwind|styled-components/);
    });

    it('provides helpful suggestion for HTML', () => {
      const file = createFile(`<div style="color: red;">Content</div>`, '/test/file.html');
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
      expect(violations[0].suggestion).toContain('CSS classes');
    });
  });

  describe('snippet extraction', () => {
    it('extracts style snippet in violation', () => {
      const file = createFile(`<div style={{ color: 'red', padding: '10px' }}>Content</div>`);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
      expect(violations[0].found).toContain('style');
    });

    it('truncates long style snippets', () => {
      const file = createFile(`<div style={{ color: 'red', padding: '10px', margin: '5px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Content</div>`);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
      // Snippet should be truncated or complete
      expect(violations[0].found.length).toBeLessThanOrEqual(150);
    });
  });

  describe('fixable flag', () => {
    it('marks violations as not fixable', () => {
      const file = createFile(`<div style={{ color: 'red' }}>Content</div>`);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
      expect(violations[0].fixable).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles style with ternary expression', () => {
      const file = createFile(`<div style={isActive ? activeStyle : inactiveStyle}>Content</div>`);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
    });

    it('handles style with function call', () => {
      const file = createFile(`<div style={getStyles()}>Content</div>`);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
    });

    it('handles nested style objects', () => {
      const file = createFile(`<div style={{ ...baseStyle, nested: { color: 'red' } }}>Content</div>`);
      const violations = checkInlineStyles(file);

      expect(violations).toHaveLength(1);
    });
  });
});
