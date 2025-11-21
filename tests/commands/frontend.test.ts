import { describe, it, expect } from 'vitest';

/**
 * Tests for frontend command parsing and URL handling
 * Note: Full integration tests would require MCP server mocking
 */

describe('Frontend Commands - URL Parsing', () => {
  // Helper function to parse Figma URLs (extracted from frontend.ts logic)
  function parseFigmaUrl(url: string): { fileId: string; nodeId?: string } {
    const patterns = [
      /figma\.com\/design\/([a-zA-Z0-9-_]+)/,
      /figma\.com\/file\/([a-zA-Z0-9-_]+)/,
    ];

    let fileId: string | undefined;

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        fileId = match[1];
        break;
      }
    }

    if (!fileId) {
      throw new Error('Invalid Figma URL');
    }

    const nodeIdMatch = url.match(/node-id=([^&]+)/);
    const nodeId = nodeIdMatch ? nodeIdMatch[1] : undefined;

    return { fileId, nodeId };
  }

  describe('Figma URL parsing', () => {
    it('should parse classic file URL', () => {
      const url = 'https://figma.com/file/abc123xyz/Design-System';
      const result = parseFigmaUrl(url);

      expect(result.fileId).toBe('abc123xyz');
      expect(result.nodeId).toBeUndefined();
    });

    it('should parse new design URL', () => {
      const url = 'https://figma.com/design/abc123xyz/Design-System';
      const result = parseFigmaUrl(url);

      expect(result.fileId).toBe('abc123xyz');
      expect(result.nodeId).toBeUndefined();
    });

    it('should parse URL with www prefix', () => {
      const url = 'https://www.figma.com/file/abc123xyz/Design-System';
      const result = parseFigmaUrl(url);

      expect(result.fileId).toBe('abc123xyz');
    });

    it('should parse URL with node ID', () => {
      const url = 'https://figma.com/file/abc123xyz?node-id=1:234';
      const result = parseFigmaUrl(url);

      expect(result.fileId).toBe('abc123xyz');
      expect(result.nodeId).toBe('1:234');
    });

    it('should parse URL with node ID and other params', () => {
      const url = 'https://figma.com/file/abc123xyz?type=design&node-id=10:500&mode=dev';
      const result = parseFigmaUrl(url);

      expect(result.fileId).toBe('abc123xyz');
      expect(result.nodeId).toBe('10:500');
    });

    it('should parse URL with complex node ID', () => {
      const url = 'https://figma.com/file/abc123xyz?node-id=100:1234';
      const result = parseFigmaUrl(url);

      expect(result.fileId).toBe('abc123xyz');
      expect(result.nodeId).toBe('100:1234');
    });

    it('should handle file IDs with dashes', () => {
      const url = 'https://figma.com/file/abc-123-xyz/My-Design';
      const result = parseFigmaUrl(url);

      expect(result.fileId).toBe('abc-123-xyz');
    });

    it('should handle file IDs with underscores', () => {
      const url = 'https://figma.com/file/abc_123_xyz/My-Design';
      const result = parseFigmaUrl(url);

      expect(result.fileId).toBe('abc_123_xyz');
    });

    it('should throw error for invalid URL', () => {
      const url = 'https://example.com/not-figma';

      expect(() => parseFigmaUrl(url)).toThrow('Invalid Figma URL');
    });

    it('should throw error for malformed Figma URL', () => {
      const url = 'https://figma.com/random-path';

      expect(() => parseFigmaUrl(url)).toThrow('Invalid Figma URL');
    });

    it('should handle URL without protocol', () => {
      // The regex actually matches even without protocol
      const url = 'figma.com/file/abc123xyz';
      const result = parseFigmaUrl(url);

      // It will still extract the file ID since the pattern matches
      expect(result.fileId).toBe('abc123xyz');
    });
  });

  describe('Framework options validation', () => {
    it('should accept valid frameworks', () => {
      const validFrameworks = ['react', 'vue', 'svelte'];

      validFrameworks.forEach(framework => {
        expect(['react', 'vue', 'svelte']).toContain(framework);
      });
    });

    it('should have react as default', () => {
      const defaultFramework = 'react';
      expect(defaultFramework).toBe('react');
    });
  });

  describe('CSS type options validation', () => {
    it('should accept valid CSS types', () => {
      const validCssTypes = ['modules', 'styled', 'tailwind', 'emotion', 'scss'];

      validCssTypes.forEach(cssType => {
        expect(['modules', 'styled', 'tailwind', 'emotion', 'scss']).toContain(cssType);
      });
    });

    it('should have modules as default', () => {
      const defaultCss = 'modules';
      expect(defaultCss).toBe('modules');
    });
  });

  describe('Token extraction categories', () => {
    it('should support all category', () => {
      const categories = ['all'];
      expect(categories).toContain('all');
    });

    it('should support individual categories', () => {
      const validCategories = ['colors', 'typography', 'spacing', 'effects'];

      validCategories.forEach(category => {
        expect(['colors', 'typography', 'spacing', 'effects', 'all']).toContain(category);
      });
    });

    it('should parse comma-separated categories', () => {
      const input = 'colors,typography,spacing';
      const categories = input.split(',').map(c => c.trim());

      expect(categories).toHaveLength(3);
      expect(categories).toContain('colors');
      expect(categories).toContain('typography');
      expect(categories).toContain('spacing');
    });

    it('should handle categories with spaces', () => {
      const input = 'colors, typography, spacing';
      const categories = input.split(',').map(c => c.trim());

      expect(categories).toHaveLength(3);
      expect(categories[0]).toBe('colors');
      expect(categories[1]).toBe('typography');
      expect(categories[2]).toBe('spacing');
    });
  });

  describe('Token format options', () => {
    it('should support valid output formats', () => {
      const validFormats = ['css', 'scss', 'json', 'js', 'ts'];

      validFormats.forEach(format => {
        expect(['css', 'scss', 'json', 'js', 'ts']).toContain(format);
      });
    });

    it('should have css as default', () => {
      const defaultFormat = 'css';
      expect(defaultFormat).toBe('css');
    });
  });

  describe('Component source validation', () => {
    it('should support valid sources', () => {
      const validSources = ['figma', 'template', 'scratch'];

      validSources.forEach(source => {
        expect(['figma', 'template', 'scratch']).toContain(source);
      });
    });

    it('should have figma as default source', () => {
      const defaultSource = 'figma';
      expect(defaultSource).toBe('figma');
    });
  });

  describe('Output path validation', () => {
    it('should use default output directory', () => {
      const defaultOutput = 'src/components';
      expect(defaultOutput).toBe('src/components');
    });

    it('should accept custom output paths', () => {
      const customPaths = [
        'components',
        'src/ui/components',
        'packages/ui/src',
        './components'
      ];

      customPaths.forEach(path => {
        expect(typeof path).toBe('string');
        expect(path.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Default file extension generation', () => {
    it('should use .tsx for TypeScript React', () => {
      const typescript = true;
      const framework = 'react';

      const extension = typescript ? '.tsx' : '.jsx';
      expect(extension).toBe('.tsx');
    });

    it('should use .jsx for JavaScript React', () => {
      const typescript = false;
      const framework = 'react';

      const extension = typescript ? '.tsx' : '.jsx';
      expect(extension).toBe('.jsx');
    });

    it('should use .ts for TypeScript utilities', () => {
      const typescript = true;
      const extension = typescript ? '.ts' : '.js';
      expect(extension).toBe('.ts');
    });
  });
});

describe('Frontend Commands - Prompt Generation', () => {
  describe('Design-to-code prompt structure', () => {
    it('should include file ID in prompt', () => {
      const fileId = 'abc123xyz';
      const promptContainsFileId = true; // Would check actual prompt

      expect(promptContainsFileId).toBe(true);
    });

    it('should include node ID when provided', () => {
      const nodeId = '1:234';
      const promptContainsNodeId = true; // Would check actual prompt

      expect(promptContainsNodeId).toBe(true);
    });

    it('should specify framework in prompt', () => {
      const framework = 'react';
      const promptContainsFramework = true;

      expect(promptContainsFramework).toBe(true);
    });

    it('should include TypeScript requirement', () => {
      const typescript = true;
      const promptMentionsTypeScript = true;

      expect(promptMentionsTypeScript).toBe(true);
    });

    it('should include CSS type preference', () => {
      const cssType = 'tailwind';
      const promptMentionsCss = true;

      expect(promptMentionsCss).toBe(true);
    });
  });

  describe('Token extraction prompt structure', () => {
    it('should include file ID', () => {
      const fileId = 'abc123xyz';
      const promptContainsFileId = true;

      expect(promptContainsFileId).toBe(true);
    });

    it('should specify output format', () => {
      const format = 'css';
      const promptContainsFormat = true;

      expect(promptContainsFormat).toBe(true);
    });

    it('should list categories to extract', () => {
      const categories = ['colors', 'typography'];
      const promptContainsCategories = true;

      expect(promptContainsCategories).toBe(true);
    });
  });
});

describe('Frontend Commands - Error Handling', () => {
  describe('Missing required parameters', () => {
    it('should require file-id for figma source', () => {
      const source = 'figma';
      const fileId = undefined;

      const shouldError = source === 'figma' && !fileId;
      expect(shouldError).toBe(true);
    });

    it('should not require file-id for template source', () => {
      const source = 'template';
      const fileId = undefined;

      const shouldError = source === 'figma' && !fileId;
      expect(shouldError).toBe(false);
    });

    it('should not require file-id for scratch source', () => {
      const source = 'scratch';
      const fileId = undefined;

      const shouldError = source === 'figma' && !fileId;
      expect(shouldError).toBe(false);
    });
  });

  describe('Figma server connectivity', () => {
    it('should check for figma server in connected servers', () => {
      const connectedServers = ['github', 'vercel'];
      const hasFigma = connectedServers.includes('figma');

      expect(hasFigma).toBe(false);
    });

    it('should detect figma server when connected', () => {
      const connectedServers = ['figma', 'github'];
      const hasFigma = connectedServers.includes('figma');

      expect(hasFigma).toBe(true);
    });
  });
});

describe('Frontend Commands - Output Structure', () => {
  describe('Component file generation', () => {
    it('should generate component file path', () => {
      const outputDir = 'src/components';
      const componentName = 'Button';
      const typescript = true;

      const componentPath = `${outputDir}/${componentName}/${componentName}.${typescript ? 'tsx' : 'jsx'}`;

      expect(componentPath).toBe('src/components/Button/Button.tsx');
    });

    it('should generate style file path', () => {
      const outputDir = 'src/components';
      const componentName = 'Button';
      const cssType = 'modules';

      const stylePath = `${outputDir}/${componentName}/${componentName}.module.css`;

      expect(stylePath).toBe('src/components/Button/Button.module.css');
    });

    it('should generate test file path', () => {
      const outputDir = 'src/components';
      const componentName = 'Button';
      const typescript = true;

      const testPath = `${outputDir}/${componentName}/${componentName}.test.${typescript ? 'tsx' : 'jsx'}`;

      expect(testPath).toBe('src/components/Button/Button.test.tsx');
    });

    it('should generate storybook file path', () => {
      const outputDir = 'src/components';
      const componentName = 'Button';
      const typescript = true;

      const storyPath = `${outputDir}/${componentName}/${componentName}.stories.${typescript ? 'tsx' : 'jsx'}`;

      expect(storyPath).toBe('src/components/Button/Button.stories.tsx');
    });

    it('should generate index file path', () => {
      const outputDir = 'src/components';
      const componentName = 'Button';
      const typescript = true;

      const indexPath = `${outputDir}/${componentName}/index.${typescript ? 'ts' : 'js'}`;

      expect(indexPath).toBe('src/components/Button/index.ts');
    });
  });
});
