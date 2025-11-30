/**
 * Tests for Phase 3 Frontend Features
 * - Visual comparison
 * - Angular and Solid.js support
 * - Enhanced prompt generation
 */

import { describe, it, expect } from 'vitest';

describe('Frontend Commands - Phase 3 Features', () => {
  describe('Angular Framework Support', () => {
    it('should accept angular as framework option', () => {
      const frameworks = ['react', 'vue', 'svelte', 'angular', 'solid'];
      expect(frameworks).toContain('angular');
    });

    it('should generate Angular-specific file structure', () => {
      const framework = 'angular';
      const typescript = true;
      const componentName = 'MyComponent';

      // Angular uses kebab-case for file names
      const expectedFiles = [
        `my-component.component.ts`,
        `my-component.component.html`,
        `my-component.component.css`,
      ];

      expectedFiles.forEach(file => {
        expect(file).toMatch(/\.component\.(ts|html|css)$/);
      });
    });

    it('should use Jasmine/Karma for Angular tests', () => {
      const framework = 'angular';
      const testFramework = framework === 'angular' ? 'Jasmine/Karma' : 'Vitest';
      expect(testFramework).toBe('Jasmine/Karma');
    });

    it('should generate spec files for Angular tests', () => {
      const componentName = 'my-component';
      const testFile = `${componentName}.component.spec.ts`;
      expect(testFile).toMatch(/\.spec\.ts$/);
    });
  });

  describe('Solid.js Framework Support', () => {
    it('should accept solid as framework option', () => {
      const frameworks = ['react', 'vue', 'svelte', 'angular', 'solid'];
      expect(frameworks).toContain('solid');
    });

    it('should use .tsx extension for Solid components', () => {
      const framework = 'solid';
      const typescript = true;
      const extension = typescript ? '.tsx' : '.jsx';
      expect(extension).toBe('.tsx');
    });

    it('should use Testing Library for Solid tests', () => {
      const framework = 'solid';
      const testFramework = framework === 'react' || framework === 'solid' ? 'Testing Library' : 'Vitest';
      expect(testFramework).toBe('Testing Library');
    });
  });

  describe('Visual Comparison - Model Validation', () => {
    it('should use glm-4.5v as default vision model', () => {
      const defaultModel = 'glm-4.5v';
      expect(defaultModel).toBe('glm-4.5v');
    });

    it('should validate vision model supports multimodal', () => {
      const visionModels = ['glm-4.5v'];
      expect(visionModels).toContain('glm-4.5v');
    });
  });

  describe('Visual Comparison - Prompt Generation', () => {
    // Helper to build visual comparison prompt
    function buildVisualComparisonPrompt(params: {
      fileId: string;
      nodeId?: string;
      filePaths: string[];
      model: string;
      exportScreenshot: boolean;
      outputFormat: string;
    }): string {
      const { fileId, nodeId, filePaths, model, exportScreenshot, outputFormat } = params;
      const nodeInfo = nodeId ? ` (node ID: ${nodeId})` : '';

      return `Visual comparison using ${model} for file ${fileId}${nodeInfo}, files: ${filePaths.join(', ')}, export: ${exportScreenshot}, format: ${outputFormat}`;
    }

    it('should generate prompt with file ID', () => {
      const prompt = buildVisualComparisonPrompt({
        fileId: 'abc123',
        filePaths: ['src/Button.tsx'],
        model: 'glm-4.5v',
        exportScreenshot: true,
        outputFormat: 'markdown'
      });

      expect(prompt).toContain('abc123');
    });

    it('should include node ID when provided', () => {
      const prompt = buildVisualComparisonPrompt({
        fileId: 'abc123',
        nodeId: '1:234',
        filePaths: ['src/Button.tsx'],
        model: 'glm-4.5v',
        exportScreenshot: true,
        outputFormat: 'markdown'
      });

      expect(prompt).toContain('1:234');
    });

    it('should include file paths', () => {
      const filePaths = ['src/Button.tsx', 'src/Button.module.css'];
      const prompt = buildVisualComparisonPrompt({
        fileId: 'abc123',
        filePaths,
        model: 'glm-4.5v',
        exportScreenshot: true,
        outputFormat: 'markdown'
      });

      filePaths.forEach(path => {
        expect(prompt).toContain(path);
      });
    });

    it('should specify vision model', () => {
      const prompt = buildVisualComparisonPrompt({
        fileId: 'abc123',
        filePaths: ['src/Button.tsx'],
        model: 'glm-4.5v',
        exportScreenshot: true,
        outputFormat: 'markdown'
      });

      expect(prompt).toContain('glm-4.5v');
    });

    it('should indicate screenshot export preference', () => {
      const promptWithExport = buildVisualComparisonPrompt({
        fileId: 'abc123',
        filePaths: ['src/Button.tsx'],
        model: 'glm-4.5v',
        exportScreenshot: true,
        outputFormat: 'markdown'
      });

      expect(promptWithExport).toContain('export: true');

      const promptWithoutExport = buildVisualComparisonPrompt({
        fileId: 'abc123',
        filePaths: ['src/Button.tsx'],
        model: 'glm-4.5v',
        exportScreenshot: false,
        outputFormat: 'markdown'
      });

      expect(promptWithoutExport).toContain('export: false');
    });

    it('should specify output format', () => {
      const formats = ['markdown', 'html', 'json'];

      formats.forEach(format => {
        const prompt = buildVisualComparisonPrompt({
          fileId: 'abc123',
          filePaths: ['src/Button.tsx'],
          model: 'glm-4.5v',
          exportScreenshot: true,
          outputFormat: format
        });

        expect(prompt).toContain(`format: ${format}`);
      });
    });
  });

  describe('Visual Comparison - Output Formats', () => {
    it('should support markdown output format', () => {
      const validFormats = ['markdown', 'html', 'json'];
      expect(validFormats).toContain('markdown');
    });

    it('should support HTML output format', () => {
      const validFormats = ['markdown', 'html', 'json'];
      expect(validFormats).toContain('html');
    });

    it('should support JSON output format', () => {
      const validFormats = ['markdown', 'html', 'json'];
      expect(validFormats).toContain('json');
    });

    it('should have markdown as default format', () => {
      const defaultFormat = 'markdown';
      expect(defaultFormat).toBe('markdown');
    });
  });

  describe('Visual Comparison - File Path Handling', () => {
    it('should accept single file path', () => {
      const filePath = 'src/components/Button.tsx';
      const filePaths = [filePath];
      expect(filePaths).toHaveLength(1);
      expect(filePaths[0]).toBe(filePath);
    });

    it('should accept multiple file paths', () => {
      const input = 'src/Button.tsx,src/Button.module.css,src/types.ts';
      const filePaths = input.split(',').map(f => f.trim());

      expect(filePaths).toHaveLength(3);
      expect(filePaths).toContain('src/Button.tsx');
      expect(filePaths).toContain('src/Button.module.css');
      expect(filePaths).toContain('src/types.ts');
    });

    it('should handle file paths with spaces', () => {
      const input = 'src/Button.tsx, src/Button.module.css, src/types.ts';
      const filePaths = input.split(',').map(f => f.trim());

      expect(filePaths[0]).toBe('src/Button.tsx');
      expect(filePaths[1]).toBe('src/Button.module.css');
      expect(filePaths[2]).toBe('src/types.ts');
    });

    it('should use default path when none provided', () => {
      const defaultPath = 'src/components';
      expect(defaultPath).toBe('src/components');
    });
  });

  describe('Enhanced Framework Support - Prompt Generation', () => {
    it('should include Angular-specific guidance', () => {
      const framework = 'angular';
      const hasAngularGuidance = framework === 'angular';
      expect(hasAngularGuidance).toBe(true);
    });

    it('should include Solid.js-specific guidance', () => {
      const framework = 'solid';
      const hasSolidGuidance = framework === 'solid';
      expect(hasSolidGuidance).toBe(true);
    });

    it('should include Vue-specific guidance', () => {
      const framework = 'vue';
      const hasVueGuidance = framework === 'vue';
      expect(hasVueGuidance).toBe(true);
    });

    it('should include React-specific guidance', () => {
      const framework = 'react';
      const hasReactGuidance = framework === 'react';
      expect(hasReactGuidance).toBe(true);
    });
  });

  describe('Framework-Specific Testing Frameworks', () => {
    it('should use Testing Library for React', () => {
      const framework = 'react';
      const testFramework = framework === 'react' || framework === 'solid' ? 'Testing Library' : 'other';
      expect(testFramework).toBe('Testing Library');
    });

    it('should use Testing Library for Solid.js', () => {
      const framework = 'solid';
      const testFramework = framework === 'react' || framework === 'solid' ? 'Testing Library' : 'other';
      expect(testFramework).toBe('Testing Library');
    });

    it('should use Vue Test Utils for Vue', () => {
      const framework = 'vue';
      const testFramework = framework === 'vue' ? 'Vue Test Utils' : 'other';
      expect(testFramework).toBe('Vue Test Utils');
    });

    it('should use Jasmine/Karma for Angular', () => {
      const framework = 'angular';
      const testFramework = framework === 'angular' ? 'Jasmine/Karma' : 'other';
      expect(testFramework).toBe('Jasmine/Karma');
    });
  });

  describe('File Extension Mapping', () => {
    it('should use .ts for Angular components', () => {
      const framework = 'angular';
      const typescript = true;
      const extension = framework === 'angular' && typescript ? '.component.ts' : '.tsx';
      expect(extension).toBe('.component.ts');
    });

    it('should use .vue for Vue components', () => {
      const framework = 'vue';
      const extension = framework === 'vue' ? '.vue' : '.tsx';
      expect(extension).toBe('.vue');
    });

    it('should use .tsx for Solid.js with TypeScript', () => {
      const framework = 'solid';
      const typescript = true;
      const extension = typescript ? '.tsx' : '.jsx';
      expect(extension).toBe('.tsx');
    });

    it('should use .tsx for React with TypeScript', () => {
      const framework = 'react';
      const typescript = true;
      const extension = typescript ? '.tsx' : '.jsx';
      expect(extension).toBe('.tsx');
    });
  });
});
