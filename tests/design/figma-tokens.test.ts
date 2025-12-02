import { describe, it, expect } from 'vitest';
import {
  extractTokensFromVariables,
  formatTokens,
  tokensToTailwind,
  compareTokens,
  formatComparison,
} from '../../src/design/figma-tokens.js';
import type { FigmaVariablesResponse } from '@ax-cli/schemas';

describe('figma-tokens', () => {
  // Mock Figma variables response
  const createMockVariablesResponse = (): FigmaVariablesResponse => ({
    status: 200,
    error: false,
    meta: {
      variables: {
        'var-color-1': {
          id: 'var-color-1',
          name: 'Color/Primary/500',
          key: 'color-primary-500',
          variableCollectionId: 'collection-1',
          resolvedType: 'COLOR',
          description: 'Primary brand color',
          hiddenFromPublishing: false,
          scopes: ['ALL_FILLS'],
          codeSyntax: {},
          valuesByMode: {
            'mode-1': { r: 0.2, g: 0.4, b: 0.8, a: 1 },
          },
        },
        'var-color-2': {
          id: 'var-color-2',
          name: 'Color/Primary/300',
          key: 'color-primary-300',
          variableCollectionId: 'collection-1',
          resolvedType: 'COLOR',
          description: '',
          hiddenFromPublishing: false,
          scopes: ['ALL_FILLS'],
          codeSyntax: {},
          valuesByMode: {
            'mode-1': { r: 0.4, g: 0.6, b: 0.9, a: 0.8 },
          },
        },
        'var-spacing-1': {
          id: 'var-spacing-1',
          name: 'Spacing/Small',
          key: 'spacing-small',
          variableCollectionId: 'collection-1',
          resolvedType: 'FLOAT',
          description: 'Small spacing value',
          hiddenFromPublishing: false,
          scopes: ['GAP'],
          codeSyntax: {},
          valuesByMode: {
            'mode-1': 8,
          },
        },
        'var-radius-1': {
          id: 'var-radius-1',
          name: 'Radii/Medium',
          key: 'radius-medium',
          variableCollectionId: 'collection-1',
          resolvedType: 'FLOAT',
          description: '',
          hiddenFromPublishing: false,
          scopes: ['CORNER_RADIUS'],
          codeSyntax: {},
          valuesByMode: {
            'mode-1': 12,
          },
        },
        'var-hidden': {
          id: 'var-hidden',
          name: 'Hidden/Value',
          key: 'hidden-value',
          variableCollectionId: 'collection-1',
          resolvedType: 'STRING',
          description: '',
          hiddenFromPublishing: true,
          scopes: [],
          codeSyntax: {},
          valuesByMode: {
            'mode-1': 'secret',
          },
        },
      },
      variableCollections: {
        'collection-1': {
          id: 'collection-1',
          name: 'Design System',
          key: 'ds-collection',
          modes: [{ modeId: 'mode-1', name: 'Default' }],
          defaultModeId: 'mode-1',
          remote: false,
          hiddenFromPublishing: false,
        },
      },
    },
  });

  describe('extractTokensFromVariables', () => {
    it('should extract color tokens in hex format', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response, { colorFormat: 'hex' });

      expect(tokens.colors).toBeDefined();
      expect(tokens.colors?.primary?.['500']).toBeDefined();
      expect((tokens.colors?.primary?.['500'] as any).value).toBe('#3366cc');
    });

    it('should extract color tokens in rgb format', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response, { colorFormat: 'rgb' });

      expect(tokens.colors?.primary?.['500']).toBeDefined();
      expect((tokens.colors?.primary?.['500'] as any).value).toBe('rgb(51, 102, 204)');
    });

    it('should extract color tokens in hsl format', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response, { colorFormat: 'hsl' });

      expect(tokens.colors?.primary?.['500']).toBeDefined();
      expect((tokens.colors?.primary?.['500'] as any).value).toContain('hsl(');
    });

    it('should handle colors with alpha', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response, { colorFormat: 'hex' });

      expect(tokens.colors?.primary?.['300']).toBeDefined();
      // Alpha color should have 8 characters (RGBA)
      expect((tokens.colors?.primary?.['300'] as any).value.length).toBe(9);
    });

    it('should extract spacing tokens in px', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response, { dimensionUnit: 'px' });

      expect(tokens.spacing?.small).toBeDefined();
      expect((tokens.spacing?.small as any).value).toBe('8px');
    });

    it('should extract spacing tokens in rem', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response, { dimensionUnit: 'rem', remBase: 16 });

      expect(tokens.spacing?.small).toBeDefined();
      expect((tokens.spacing?.small as any).value).toBe('0.5rem');
    });

    it('should extract radii tokens', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response, { dimensionUnit: 'px' });

      expect(tokens.radii?.medium).toBeDefined();
      expect((tokens.radii?.medium as any).value).toBe('12px');
    });

    it('should skip hidden variables', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response);

      // Hidden token should not be present
      expect(tokens.hidden).toBeUndefined();
    });

    it('should include descriptions when enabled', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response, { includeDescription: true });

      expect((tokens.colors?.primary?.['500'] as any).description).toBe('Primary brand color');
    });
  });

  describe('formatTokens', () => {
    it('should format tokens as JSON', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response);
      const output = formatTokens(tokens, 'json');

      expect(output).toContain('{');
      expect(output).toContain('}');
      const parsed = JSON.parse(output);
      expect(parsed.colors).toBeDefined();
    });

    it('should format tokens as CSS variables', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response);
      const output = formatTokens(tokens, 'css');

      expect(output).toContain(':root {');
      expect(output).toContain('--');
      expect(output).toContain('}');
    });

    it('should format tokens as SCSS variables', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response);
      const output = formatTokens(tokens, 'scss');

      expect(output).toContain('$');
      expect(output).toContain(':');
    });

    it('should format tokens as Tailwind config', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response);
      const output = formatTokens(tokens, 'tailwind');

      expect(output).toContain('module.exports');
      expect(output).toContain('theme');
      expect(output).toContain('extend');
    });
  });

  describe('tokensToTailwind', () => {
    it('should convert colors to Tailwind format', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response);
      const tailwind = tokensToTailwind(tokens) as any;

      expect(tailwind.theme.extend.colors).toBeDefined();
    });

    it('should convert spacing to Tailwind format', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response);
      const tailwind = tokensToTailwind(tokens) as any;

      expect(tailwind.theme.extend.spacing).toBeDefined();
    });

    it('should convert radii to borderRadius', () => {
      const response = createMockVariablesResponse();
      const tokens = extractTokensFromVariables(response);
      const tailwind = tokensToTailwind(tokens) as any;

      expect(tailwind.theme.extend.borderRadius).toBeDefined();
    });
  });

  describe('compareTokens', () => {
    it('should detect added tokens', () => {
      const figmaTokens = {
        colors: {
          primary: { value: '#ff0000', type: 'color' },
          secondary: { value: '#00ff00', type: 'color' },
        },
      };
      const localTokens = {
        colors: {
          primary: { value: '#ff0000', type: 'color' },
        },
      };

      const result = compareTokens(figmaTokens, localTokens);

      expect(result.summary.added).toBe(1);
      expect(result.differences.some(d => d.type === 'added')).toBe(true);
    });

    it('should detect removed tokens', () => {
      const figmaTokens = {
        colors: {
          primary: { value: '#ff0000', type: 'color' },
        },
      };
      const localTokens = {
        colors: {
          primary: { value: '#ff0000', type: 'color' },
          secondary: { value: '#00ff00', type: 'color' },
        },
      };

      const result = compareTokens(figmaTokens, localTokens);

      expect(result.summary.removed).toBe(1);
      expect(result.differences.some(d => d.type === 'removed')).toBe(true);
    });

    it('should detect modified tokens', () => {
      const figmaTokens = {
        colors: {
          primary: { value: '#ff0000', type: 'color' },
        },
      };
      const localTokens = {
        colors: {
          primary: { value: '#00ff00', type: 'color' },
        },
      };

      const result = compareTokens(figmaTokens, localTokens);

      expect(result.summary.modified).toBe(1);
      expect(result.differences.some(d => d.type === 'modified')).toBe(true);
    });

    it('should detect unchanged tokens', () => {
      const figmaTokens = {
        colors: {
          primary: { value: '#ff0000', type: 'color' },
        },
      };
      const localTokens = {
        colors: {
          primary: { value: '#ff0000', type: 'color' },
        },
      };

      const result = compareTokens(figmaTokens, localTokens);

      expect(result.summary.unchanged).toBe(1);
    });

    it('should include metadata', () => {
      const result = compareTokens({}, {}, 'file-key', '/path/to/local');

      expect(result.figmaFileKey).toBe('file-key');
      expect(result.localFilePath).toBe('/path/to/local');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('formatComparison', () => {
    it('should format comparison result as string', () => {
      const result = compareTokens(
        { colors: { primary: { value: '#ff0000', type: 'color' } } },
        { colors: { secondary: { value: '#00ff00', type: 'color' } } }
      );

      const output = formatComparison(result);

      expect(output).toContain('Token Comparison Summary');
      expect(output).toContain('Added');
      expect(output).toContain('Removed');
    });
  });
});
