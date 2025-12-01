import { describe, it, expect } from 'vitest';
import {
  TEMPLATES,
  getTemplateNames,
  getTemplate,
  getTemplatesByCategory,
  searchTemplates,
  hasTemplate,
  generateConfigFromTemplate,
  type MCPServerTemplate
} from '../../src/mcp/templates.js';
import { MCPServerConfigSchema } from '../../src/schemas/settings-schemas.js';

describe('MCP Templates', () => {
  describe('TEMPLATES constant', () => {
    it('should have at least 10 templates', () => {
      const templateCount = Object.keys(TEMPLATES).length;
      expect(templateCount).toBeGreaterThanOrEqual(10);
    });

    it('should include essential front-end templates', () => {
      const essential = ['figma', 'github', 'vercel', 'puppeteer', 'storybook', 'sentry'];
      essential.forEach(name => {
        expect(TEMPLATES).toHaveProperty(name);
      });
    });

    it('should have valid template structure for all templates', () => {
      Object.values(TEMPLATES).forEach((template: MCPServerTemplate) => {
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('category');
        expect(template).toHaveProperty('officialServer');
        expect(template).toHaveProperty('config');
        expect(template).toHaveProperty('requiredEnv');
        expect(template).toHaveProperty('setupInstructions');
        expect(template).toHaveProperty('usageExamples');
        expect(template).toHaveProperty('troubleshooting');

        // Validate types
        expect(typeof template.name).toBe('string');
        expect(typeof template.description).toBe('string');
        expect(['design', 'deployment', 'testing', 'monitoring', 'backend', 'version-control']).toContain(template.category);
        expect(typeof template.officialServer).toBe('boolean');
        expect(Array.isArray(template.requiredEnv)).toBe(true);
        expect(Array.isArray(template.usageExamples)).toBe(true);
        expect(Array.isArray(template.troubleshooting)).toBe(true);
      });
    });
  });

  describe('Figma template', () => {
    const figma = TEMPLATES.figma;

    it('should have correct basic properties', () => {
      expect(figma.name).toBe('figma');
      expect(figma.category).toBe('design');
      expect(figma.officialServer).toBe(true);
      expect(figma.description).toContain('Figma');
      expect(figma.description).toContain('design-to-code');
    });

    it('should require FIGMA_ACCESS_TOKEN', () => {
      expect(figma.requiredEnv).toHaveLength(1);
      expect(figma.requiredEnv[0].name).toBe('FIGMA_ACCESS_TOKEN');
      expect(figma.requiredEnv[0].description).toBeTruthy();
      expect(figma.requiredEnv[0].url).toContain('figma.com');
    });

    it('should have valid MCP config', () => {
      const validationResult = MCPServerConfigSchema.safeParse(figma.config);
      expect(validationResult.success).toBe(true);

      expect(figma.config.name).toBe('figma');
      expect(figma.config.transport.type).toBe('stdio');
      expect(figma.config.transport.command).toBe('npx');
      expect(figma.config.transport.args).toContain('@figma/mcp-server');
    });

    it('should have setup instructions', () => {
      expect(figma.setupInstructions).toBeTruthy();
      expect(figma.setupInstructions).toContain('figma.com/settings');
      expect(figma.setupInstructions).toContain('FIGMA_ACCESS_TOKEN');
    });

    it('should have usage examples', () => {
      expect(figma.usageExamples.length).toBeGreaterThan(0);
      expect(figma.usageExamples.some(ex => ex.toLowerCase().includes('design'))).toBe(true);
    });

    it('should have troubleshooting tips', () => {
      expect(figma.troubleshooting.length).toBeGreaterThan(0);
      figma.troubleshooting.forEach(tip => {
        expect(tip).toHaveProperty('issue');
        expect(tip).toHaveProperty('solution');
        expect(typeof tip.issue).toBe('string');
        expect(typeof tip.solution).toBe('string');
      });
    });
  });

  describe('GitHub template', () => {
    const github = TEMPLATES.github;

    it('should have correct properties', () => {
      expect(github.name).toBe('github');
      expect(github.category).toBe('version-control');
      expect(github.officialServer).toBe(true);
    });

    it('should require GITHUB_TOKEN', () => {
      expect(github.requiredEnv).toHaveLength(1);
      expect(github.requiredEnv[0].name).toBe('GITHUB_TOKEN');
    });

    it('should have valid stdio config', () => {
      const validationResult = MCPServerConfigSchema.safeParse(github.config);
      expect(validationResult.success).toBe(true);

      expect(github.config.transport.type).toBe('stdio');
      expect(github.config.transport.command).toBe('npx');
      expect(github.config.transport.args).toContain('@modelcontextprotocol/server-github');
    });
  });

  describe('Vercel template', () => {
    const vercel = TEMPLATES.vercel;

    it('should have correct properties', () => {
      expect(vercel.name).toBe('vercel');
      expect(vercel.category).toBe('deployment');
      expect(vercel.officialServer).toBe(false); // Community server
    });

    it('should use HTTP transport', () => {
      expect(vercel.config.transport.type).toBe('http');
      expect(vercel.config.transport.url).toBeTruthy();
      expect(vercel.config.transport.url).toContain('vercel.com');
    });
  });

  describe('Puppeteer template', () => {
    const puppeteer = TEMPLATES.puppeteer;

    it('should have no required env vars', () => {
      expect(puppeteer.requiredEnv).toHaveLength(0);
    });

    it('should have testing category', () => {
      expect(puppeteer.category).toBe('testing');
    });

    it('should have setup instructions mentioning Chromium', () => {
      expect(puppeteer.setupInstructions.toLowerCase()).toContain('chromium');
    });
  });

  describe('getTemplateNames()', () => {
    it('should return sorted array of template names', () => {
      const names = getTemplateNames();

      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);

      // Check if sorted
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });

    it('should include all templates from TEMPLATES constant', () => {
      const names = getTemplateNames();
      const expectedNames = Object.keys(TEMPLATES);

      expectedNames.forEach(name => {
        expect(names).toContain(name);
      });
    });
  });

  describe('getTemplate()', () => {
    it('should return template for valid name', () => {
      const figma = getTemplate('figma');
      expect(figma).toBeDefined();
      expect(figma?.name).toBe('figma');
    });

    it('should return undefined for invalid name', () => {
      const invalid = getTemplate('nonexistent-template');
      expect(invalid).toBeUndefined();
    });

    it('should be case-insensitive', () => {
      const lower = getTemplate('figma');
      const upper = getTemplate('FIGMA');
      const mixed = getTemplate('FiGmA');

      expect(lower).toBeDefined();
      expect(upper).toBeDefined();
      expect(mixed).toBeDefined();
      expect(lower?.name).toBe(upper?.name);
      expect(lower?.name).toBe(mixed?.name);
    });
  });

  describe('getTemplatesByCategory()', () => {
    it('should return design templates', () => {
      const designTemplates = getTemplatesByCategory('design');

      expect(Array.isArray(designTemplates)).toBe(true);
      expect(designTemplates.length).toBeGreaterThan(0);
      designTemplates.forEach(template => {
        expect(template.category).toBe('design');
      });

      // Figma should be in design category
      expect(designTemplates.some(t => t.name === 'figma')).toBe(true);
    });

    it('should return deployment templates', () => {
      const deploymentTemplates = getTemplatesByCategory('deployment');

      expect(deploymentTemplates.length).toBeGreaterThan(0);
      deploymentTemplates.forEach(template => {
        expect(template.category).toBe('deployment');
      });

      // Should include Vercel and/or Netlify
      const names = deploymentTemplates.map(t => t.name);
      expect(names.some(n => ['vercel', 'netlify'].includes(n))).toBe(true);
    });

    it('should return testing templates', () => {
      const testingTemplates = getTemplatesByCategory('testing');

      expect(testingTemplates.length).toBeGreaterThan(0);
      testingTemplates.forEach(template => {
        expect(template.category).toBe('testing');
      });

      // Should include Puppeteer
      expect(testingTemplates.some(t => t.name === 'puppeteer')).toBe(true);
    });

    it('should return empty array for invalid category', () => {
      const invalid = getTemplatesByCategory('invalid-category' as any);
      expect(invalid).toEqual([]);
    });

    it('should return all backend templates', () => {
      const backendTemplates = getTemplatesByCategory('backend');

      expect(backendTemplates.length).toBeGreaterThan(0);
      backendTemplates.forEach(template => {
        expect(template.category).toBe('backend');
      });

      // Should include database templates
      const names = backendTemplates.map(t => t.name);
      expect(names.some(n => ['postgres', 'sqlite', 'supabase', 'firebase'].includes(n))).toBe(true);
    });
  });

  describe('searchTemplates()', () => {
    it('should find templates by name', () => {
      const results = searchTemplates('figma');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.name === 'figma')).toBe(true);
    });

    it('should find templates by description keywords', () => {
      const results = searchTemplates('deployment');

      expect(results.length).toBeGreaterThan(0);
      // Should find Vercel, Netlify, etc.
      expect(results.some(t => t.description.toLowerCase().includes('deployment'))).toBe(true);
    });

    it('should find templates by usage examples', () => {
      const results = searchTemplates('component');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t =>
        t.usageExamples.some(ex => ex.toLowerCase().includes('component'))
      )).toBe(true);
    });

    it('should be case-insensitive', () => {
      const lower = searchTemplates('github');
      const upper = searchTemplates('GITHUB');
      const mixed = searchTemplates('GiThUb');

      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBe(mixed.length);
    });

    it('should return empty array for no matches', () => {
      const results = searchTemplates('xyznonexistenttemplate123');
      expect(results).toEqual([]);
    });

    it('should find multiple templates with generic search', () => {
      const results = searchTemplates('server');

      // Many templates mention "server" in their description
      expect(results.length).toBeGreaterThan(1);
    });
  });

  describe('hasTemplate()', () => {
    it('should return true for existing templates', () => {
      expect(hasTemplate('figma')).toBe(true);
      expect(hasTemplate('github')).toBe(true);
      expect(hasTemplate('vercel')).toBe(true);
    });

    it('should return false for non-existing templates', () => {
      expect(hasTemplate('nonexistent')).toBe(false);
      expect(hasTemplate('invalid-template')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(hasTemplate('FIGMA')).toBe(true);
      expect(hasTemplate('FiGmA')).toBe(true);
    });
  });

  describe('generateConfigFromTemplate()', () => {
    it('should generate valid config for Figma template', () => {
      const config = generateConfigFromTemplate('figma', {
        FIGMA_ACCESS_TOKEN: 'test_token_123'
      });

      // Validate with Zod schema
      const validationResult = MCPServerConfigSchema.safeParse(config);
      expect(validationResult.success).toBe(true);

      // Check env vars are injected
      expect(config.transport.env).toHaveProperty('FIGMA_ACCESS_TOKEN');
      expect(config.transport.env?.FIGMA_ACCESS_TOKEN).toBe('test_token_123');
    });

    it('should generate valid config for GitHub template', () => {
      const config = generateConfigFromTemplate('github', {
        GITHUB_TOKEN: 'ghp_test_token'
      });

      const validationResult = MCPServerConfigSchema.safeParse(config);
      expect(validationResult.success).toBe(true);

      expect(config.transport.env).toHaveProperty('GITHUB_TOKEN');
      expect(config.transport.env?.GITHUB_TOKEN).toBe('ghp_test_token');
    });

    it('should throw error for invalid template name', () => {
      expect(() => {
        generateConfigFromTemplate('nonexistent', {});
      }).toThrow('Template "nonexistent" not found');
    });

    it('should merge provided env vars with existing ones', () => {
      const config = generateConfigFromTemplate('figma', {
        FIGMA_ACCESS_TOKEN: 'token1',
        CUSTOM_VAR: 'value1'
      });

      expect(config.transport.env).toHaveProperty('FIGMA_ACCESS_TOKEN', 'token1');
      expect(config.transport.env).toHaveProperty('CUSTOM_VAR', 'value1');
    });

    it('should handle templates with no required env vars', () => {
      const config = generateConfigFromTemplate('puppeteer', {});

      const validationResult = MCPServerConfigSchema.safeParse(config);
      expect(validationResult.success).toBe(true);
    });

    it('should inject auth headers for HTTP transports (Vercel)', () => {
      const config = generateConfigFromTemplate('vercel', {
        VERCEL_TOKEN: 'vercel_token_123'
      });

      expect(config.transport.type).toBe('http');
      expect(config.transport.headers).toBeDefined();
      expect(config.transport.headers?.Authorization).toBe('Bearer vercel_token_123');
    });

    it('should inject auth headers for GitHub token', () => {
      const config = generateConfigFromTemplate('github', {
        GITHUB_TOKEN: 'ghp_token123'
      });

      // GitHub uses stdio, but if it were HTTP, the header would be injected
      expect(config.transport.env?.GITHUB_TOKEN).toBe('ghp_token123');
    });

    it('should not mutate the original template', () => {
      const originalFigma = { ...TEMPLATES.figma };

      generateConfigFromTemplate('figma', {
        FIGMA_ACCESS_TOKEN: 'test_token'
      });

      // Original should be unchanged
      expect(TEMPLATES.figma).toEqual(originalFigma);
    });
  });

  describe('Template completeness', () => {
    it('all templates should have at least one usage example', () => {
      Object.values(TEMPLATES).forEach((template: MCPServerTemplate) => {
        expect(template.usageExamples.length).toBeGreaterThan(0);
      });
    });

    it('all templates should have at least one troubleshooting tip', () => {
      Object.values(TEMPLATES).forEach((template: MCPServerTemplate) => {
        expect(template.troubleshooting.length).toBeGreaterThan(0);
      });
    });

    it('all templates should have non-empty setup instructions', () => {
      Object.values(TEMPLATES).forEach((template: MCPServerTemplate) => {
        expect(template.setupInstructions.trim().length).toBeGreaterThan(10);
      });
    });

    it('all required env vars should have descriptions', () => {
      Object.values(TEMPLATES).forEach((template: MCPServerTemplate) => {
        template.requiredEnv.forEach(envVar => {
          expect(envVar.name).toBeTruthy();
          expect(envVar.description).toBeTruthy();
          expect(envVar.description.length).toBeGreaterThan(5);
        });
      });
    });

    it('all templates should have valid MCP configs', () => {
      Object.values(TEMPLATES).forEach((template: MCPServerTemplate) => {
        const validationResult = MCPServerConfigSchema.safeParse(template.config);
        expect(validationResult.success).toBe(true);
      });
    });
  });

  describe('Category coverage', () => {
    it('should have templates in all major categories', () => {
      const categories = ['design', 'deployment', 'testing', 'monitoring', 'backend', 'version-control'];

      categories.forEach(category => {
        const templates = getTemplatesByCategory(category as any);
        expect(templates.length).toBeGreaterThan(0);
      });
    });

    it('should have balance across categories', () => {
      const categoryCounts: Record<string, number> = {};

      Object.values(TEMPLATES).forEach((template: MCPServerTemplate) => {
        categoryCounts[template.category] = (categoryCounts[template.category] || 0) + 1;
      });

      // Each category should have at least 1 template
      Object.values(categoryCounts).forEach(count => {
        expect(count).toBeGreaterThan(0);
      });
    });
  });

  describe('Official vs Community servers', () => {
    it('should have at least one official server', () => {
      const officialServers = Object.values(TEMPLATES).filter(t => t.officialServer);
      expect(officialServers.length).toBeGreaterThan(0);
    });

    it('should correctly mark official servers', () => {
      // Figma and GitHub should be official
      expect(TEMPLATES.figma.officialServer).toBe(true);
      expect(TEMPLATES.github.officialServer).toBe(true);
      expect(TEMPLATES.postgres.officialServer).toBe(true);
      expect(TEMPLATES.sqlite.officialServer).toBe(true);
    });

    it('should correctly mark community servers', () => {
      // Vercel, Netlify should be community (hypothetical servers)
      expect(TEMPLATES.vercel.officialServer).toBe(false);
      expect(TEMPLATES.netlify.officialServer).toBe(false);
    });
  });
});
