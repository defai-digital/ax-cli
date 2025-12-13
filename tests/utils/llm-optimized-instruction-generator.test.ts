/**
 * Tests for utils/llm-optimized-instruction-generator module
 * Tests LLM-optimized instruction generation for projects
 */
import { describe, it, expect } from 'vitest';
import { LLMOptimizedInstructionGenerator } from '../../packages/core/src/utils/llm-optimized-instruction-generator.js';
import type { ProjectInfo } from '../../packages/core/src/types/project-analysis.js';

// Helper to create mock project info
function createMockProjectInfo(overrides: Partial<ProjectInfo> = {}): ProjectInfo {
  return {
    name: 'test-project',
    projectType: 'cli',
    primaryLanguage: 'TypeScript',
    techStack: ['Node.js', 'TypeScript', 'Vitest'],
    version: '1.0.0',
    description: 'A test CLI project',
    entryPoint: 'src/index.ts',
    packageManager: 'pnpm',
    directories: {
      source: 'src',
      tests: 'tests',
      config: '.config',
    },
    keyFiles: {
      'package.json': 'Package configuration',
      'tsconfig.json': 'TypeScript configuration',
    },
    conventions: {
      importExtension: '.js',
      validation: 'zod',
      moduleSystem: 'esm',
      testFramework: 'vitest',
    },
    scripts: {
      build: 'tsc',
      test: 'vitest run',
      lint: 'eslint .',
      dev: 'tsx src/index.ts',
      typecheck: 'tsc --noEmit',
    },
    cicdPlatform: 'GitHub Actions',
    gotchas: ['Use pnpm instead of npm', 'Run build before tests'],
    runtimeTargets: { node: '>=20.0.0' },
    lastAnalyzed: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('LLMOptimizedInstructionGenerator', () => {
  describe('constructor', () => {
    it('should create generator with default config', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      expect(generator).toBeInstanceOf(LLMOptimizedInstructionGenerator);
    });

    it('should create generator with custom config', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        compressionLevel: 'aggressive',
        hierarchyEnabled: false,
        criticalRulesCount: 3,
        includeDODONT: false,
        includeTroubleshooting: false,
      });
      expect(generator).toBeInstanceOf(LLMOptimizedInstructionGenerator);
    });

    it('should use defaults for missing config options', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        compressionLevel: 'none',
      });
      expect(generator).toBeInstanceOf(LLMOptimizedInstructionGenerator);
    });
  });

  describe('generateInstructions', () => {
    it('should generate instructions with all sections', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('# test-project - Quick Reference');
      expect(instructions).toContain('Critical Rules');
      expect(instructions).toContain('Project Overview');
      expect(instructions).toContain('Code Patterns');
      expect(instructions).toContain('Workflow');
      expect(instructions).toContain('Troubleshooting');
    });

    it('should include header with project info', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('**Type:** cli');
      expect(instructions).toContain('**Lang:** TypeScript');
      expect(instructions).toContain('**Ver:**  v1.0.0');
      expect(instructions).toContain('**CI:** GitHub Actions');
      expect(instructions).toContain('**Stack:** Node.js, TypeScript, Vitest');
    });

    it('should include description when available', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        description: 'A comprehensive test project',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('A comprehensive test project');
    });

    it('should skip description when not available', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        description: undefined,
      });

      const instructions = generator.generateInstructions(projectInfo);

      // Should still generate without errors
      expect(instructions).toContain('test-project');
    });

    it('should skip critical rules when hierarchyEnabled is false', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        hierarchyEnabled: false,
      });
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).not.toContain('Critical Rules');
    });

    it('should skip troubleshooting when includeTroubleshooting is false', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        includeTroubleshooting: false,
      });
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).not.toContain('Troubleshooting');
    });

    it('should include gotchas section when available', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        gotchas: ['Important tip 1', 'Important tip 2'],
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('Development Tips');
      expect(instructions).toContain('Important tip 1');
      expect(instructions).toContain('Important tip 2');
    });

    it('should skip gotchas section when empty', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        gotchas: [],
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).not.toContain('Development Tips');
    });

    it('should handle projects without version', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        version: undefined,
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).not.toContain('**Ver:**');
    });

    it('should handle projects without CI/CD', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        cicdPlatform: undefined,
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).not.toContain('**CI:**');
    });

    it('should handle projects without tech stack', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        techStack: [],
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).not.toContain('**Stack:**');
    });
  });

  describe('critical rules generation', () => {
    it('should include ESM import rule when importExtension is .js', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        conventions: {
          importExtension: '.js',
          moduleSystem: 'esm',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('**ESM Imports:**');
      expect(instructions).toContain('.js');
    });

    it('should include validation rule when validation is set', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        conventions: {
          validation: 'zod',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('**Validation:** Use zod');
    });

    it('should include TypeScript rule for TypeScript projects', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        primaryLanguage: 'TypeScript',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('**Types:**');
    });

    it('should include testing rule when test script exists', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        scripts: {
          test: 'vitest run',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('**Testing:**');
    });

    it('should include module system rule for ESM', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        conventions: {
          moduleSystem: 'esm',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('**Modules:**');
    });

    it('should limit rules to criticalRulesCount', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        criticalRulesCount: 2,
      });
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      // Should contain Critical Rules section but with limited items
      expect(instructions).toContain('Critical Rules');
    });
  });

  describe('project overview generation', () => {
    it('should include entry point when available', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        entryPoint: 'src/main.ts',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('**Entry:** `src/main.ts`');
    });

    it('should include package manager', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        packageManager: 'npm',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('**PM:** npm');
    });

    it('should include module system', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        conventions: {
          moduleSystem: 'cjs',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('**Module:** CJS');
    });

    it('should list directories', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        directories: {
          source: 'src',
          tests: 'tests',
          tools: 'tools',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('`src/` - Source code');
      expect(instructions).toContain('`tests/` - Tests');
      expect(instructions).toContain('`tools/` - Tools');
    });

    it('should add CLI-specific directories for CLI projects', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        projectType: 'cli',
        directories: {
          source: 'src',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('`src/commands/` - Commands');
      expect(instructions).toContain('`src/utils/` - Utilities');
    });

    it('should add API-specific directories for API projects', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        projectType: 'api',
        directories: {
          source: 'src',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('`src/commands/` - Commands');
    });
  });

  describe('code patterns generation', () => {
    it('should include TypeScript patterns with DO/DONT', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        includeDODONT: true,
      });
      const projectInfo = createMockProjectInfo({
        primaryLanguage: 'TypeScript',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('### TypeScript');
      expect(instructions).toContain('**DO:**');
      expect(instructions).toContain("**DON'T:**");
    });

    it('should skip DO/DONT patterns when includeDODONT is false', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        includeDODONT: false,
      });
      const projectInfo = createMockProjectInfo({
        primaryLanguage: 'TypeScript',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).not.toContain('**DO:**');
    });

    it('should include validation patterns when validation is set', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        includeDODONT: true,
      });
      const projectInfo = createMockProjectInfo({
        conventions: {
          validation: 'zod',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('### Validation (zod)');
      expect(instructions).toContain('safeParse');
    });

    it('should include CLI patterns for CLI projects', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        projectType: 'cli',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('### CLI Commands');
      expect(instructions).toContain('exit codes');
    });

    it('should include API patterns for API projects', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        projectType: 'api',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('### API Endpoints');
      expect(instructions).toContain('HTTP status codes');
    });

    it('should include library patterns for library projects', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        projectType: 'library',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('### Library API');
      expect(instructions).toContain('breaking changes');
    });
  });

  describe('workflow generation', () => {
    it('should include before/changes/after sections', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('**Before:**');
      expect(instructions).toContain('**Changes:**');
      expect(instructions).toContain('**After:**');
    });

    it('should include script commands in after section', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        scripts: {
          lint: 'eslint .',
          test: 'vitest run',
          build: 'tsc',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('Lint: `eslint .`');
      expect(instructions).toContain('Test: `vitest run`');
      expect(instructions).toContain('Build: `tsc`');
    });

    it('should include quick commands for npm', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        packageManager: 'npm',
        scripts: {
          dev: 'node index.js',
          test: 'jest',
          build: 'tsc',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('**Quick Commands:**');
      expect(instructions).toContain('npm run dev');
      expect(instructions).toContain('npm test');
      expect(instructions).toContain('npm run build');
    });

    it('should include quick commands for pnpm', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        packageManager: 'pnpm',
        scripts: {
          dev: 'node index.js',
          test: 'vitest',
          build: 'tsc',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('pnpm dev');
      expect(instructions).toContain('pnpm test');
      expect(instructions).toContain('pnpm build');
    });
  });

  describe('troubleshooting generation', () => {
    it('should include module not found issue for ESM', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        conventions: {
          importExtension: '.js',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('Module not found');
      expect(instructions).toContain('.js');
    });

    it('should include validation error issue', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        conventions: {
          validation: 'zod',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('zod validation errors');
      expect(instructions).toContain('safeParse');
    });

    it('should include test issue when test framework is set', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        conventions: {
          testFramework: 'vitest',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('Tests fail locally');
    });

    it('should include TypeScript compilation issue', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        primaryLanguage: 'TypeScript',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('TypeScript compilation errors');
      expect(instructions).toContain('tsconfig.json');
    });

    it('should return empty troubleshooting for minimal config', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        primaryLanguage: 'JavaScript',
        conventions: {},
      });

      const instructions = generator.generateInstructions(projectInfo);

      // Instructions should still be generated without Troubleshooting section
      expect(instructions).toContain('test-project');
    });
  });

  describe('generateSummary', () => {
    it('should generate valid JSON summary', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const summary = generator.generateSummary(projectInfo);
      const parsed = JSON.parse(summary);

      expect(parsed.schemaVersion).toBe('1.0');
      expect(parsed.generatedAt).toBeDefined();
      expect(parsed.project.name).toBe('test-project');
    });

    it('should include project core info', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        name: 'my-app',
        projectType: 'api',
        primaryLanguage: 'TypeScript',
        version: '2.0.0',
      });

      const summary = generator.generateSummary(projectInfo);
      const parsed = JSON.parse(summary);

      expect(parsed.project.name).toBe('my-app');
      expect(parsed.project.type).toBe('api');
      expect(parsed.project.language).toBe('TypeScript');
      expect(parsed.project.version).toBe('2.0.0');
    });

    it('should limit tech stack to 8 items', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        techStack: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
      });

      const summary = generator.generateSummary(projectInfo);
      const parsed = JSON.parse(summary);

      expect(parsed.project.techStack).toHaveLength(8);
    });

    it('should include top directories', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        directories: {
          source: 'src',
          tests: 'tests',
          config: '.config',
        },
      });

      const summary = generator.generateSummary(projectInfo);
      const parsed = JSON.parse(summary);

      expect(parsed.directories.source).toBe('src');
      expect(parsed.directories.tests).toBe('tests');
    });

    it('should include essential commands', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        scripts: {
          build: 'tsc',
          test: 'vitest',
          lint: 'eslint',
          dev: 'tsx watch',
          typecheck: 'tsc --noEmit',
        },
      });

      const summary = generator.generateSummary(projectInfo);
      const parsed = JSON.parse(summary);

      expect(parsed.commands.build).toBe('tsc');
      expect(parsed.commands.test).toBe('vitest');
      expect(parsed.commands.lint).toBe('eslint');
      expect(parsed.commands.dev).toBe('tsx watch');
      expect(parsed.commands.typecheck).toBe('tsc --noEmit');
    });

    it('should include top 3 gotchas', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        gotchas: ['Tip 1', 'Tip 2', 'Tip 3', 'Tip 4', 'Tip 5'],
      });

      const summary = generator.generateSummary(projectInfo);
      const parsed = JSON.parse(summary);

      expect(parsed.gotchas).toHaveLength(3);
      expect(parsed.gotchas).toContain('Tip 1');
      expect(parsed.gotchas).toContain('Tip 2');
      expect(parsed.gotchas).toContain('Tip 3');
    });

    it('should include reference to index file', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const summary = generator.generateSummary(projectInfo);
      const parsed = JSON.parse(summary);

      expect(parsed.indexFile).toBe('ax.index.json');
    });

    it('should include entry point when available', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        entryPoint: 'src/main.ts',
      });

      const summary = generator.generateSummary(projectInfo);
      const parsed = JSON.parse(summary);

      expect(parsed.project.entryPoint).toBe('src/main.ts');
    });

    it('should include package manager when available', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        packageManager: 'yarn',
      });

      const summary = generator.generateSummary(projectInfo);
      const parsed = JSON.parse(summary);

      expect(parsed.project.packageManager).toBe('yarn');
    });
  });

  describe('generateIndex', () => {
    it('should generate valid JSON index', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const index = generator.generateIndex(projectInfo);
      const parsed = JSON.parse(index);

      expect(parsed.schemaVersion).toBe('2.0');
      expect(parsed.name).toBe('test-project');
    });

    it('should include all tier 1 fields', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const index = generator.generateIndex(projectInfo);
      const parsed = JSON.parse(index);

      expect(parsed.name).toBeDefined();
      expect(parsed.version).toBeDefined();
      expect(parsed.primaryLanguage).toBeDefined();
      expect(parsed.techStack).toBeDefined();
      expect(parsed.projectType).toBeDefined();
      expect(parsed.entryPoint).toBeDefined();
      expect(parsed.directories).toBeDefined();
      expect(parsed.conventions).toBeDefined();
      expect(parsed.scripts).toBeDefined();
    });

    it('should include tier 2 fields when available', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        codeStats: { totalFiles: 100, totalLines: 5000 },
        testing: { hasTests: true, framework: 'vitest' },
        documentation: { hasReadme: true },
        technicalDebt: { warnings: [] },
      });

      const index = generator.generateIndex(projectInfo);
      const parsed = JSON.parse(index);

      expect(parsed.codeStats).toBeDefined();
      expect(parsed.testing).toBeDefined();
      expect(parsed.documentation).toBeDefined();
      expect(parsed.technicalDebt).toBeDefined();
    });

    it('should include tier 3 architecture when available', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        architecture: { pattern: 'monolith' },
      });

      const index = generator.generateIndex(projectInfo);
      const parsed = JSON.parse(index);

      expect(parsed.architecture).toBeDefined();
      expect(parsed.architecture.pattern).toBe('monolith');
    });

    it('should include tier 4 security when available', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        security: { hasSecurityFiles: true },
      });

      const index = generator.generateIndex(projectInfo);
      const parsed = JSON.parse(index);

      expect(parsed.security).toBeDefined();
    });
  });

  describe('extractTopDirectories', () => {
    it('should prioritize important directories', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        directories: {
          random: 'random',
          source: 'src',
          tests: 'tests',
          config: '.config',
          docs: 'docs',
          tools: 'tools',
          extra: 'extra',
        },
      });

      const summary = generator.generateSummary(projectInfo);
      const parsed = JSON.parse(summary);

      // Priority directories should be included
      expect(parsed.directories.source).toBeDefined();
      expect(parsed.directories.tests).toBeDefined();
      expect(parsed.directories.config).toBeDefined();
    });
  });

  describe('file organization section', () => {
    it('should include file organization in instructions', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('Project File Organization');
      expect(instructions).toContain('Standard Output Paths');
      expect(instructions).toContain('automatosx/');
      expect(instructions).toContain('PRD/');
      expect(instructions).toContain('REPORT/');
      expect(instructions).toContain('tmp/');
    });

    it('should include path usage guidelines', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('Path Usage Guidelines');
      expect(instructions).toContain('PRD (Product Requirement Documents)');
      expect(instructions).toContain('REPORT (Plans & Status)');
      expect(instructions).toContain('tmp (Temporary Files)');
    });

    it('should include file naming conventions', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('File Naming Conventions');
      expect(instructions).toContain('kebab-case');
      expect(instructions).toContain('YYYY-MM-DD');
    });

    it('should include gitignore rules', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('.gitignore Rules');
      expect(instructions).toContain('automatosx/tmp/');
    });
  });
});
