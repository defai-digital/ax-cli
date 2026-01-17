/**
 * Tests for utils/llm-optimized-instruction-generator module
 * Tests LLM-optimized instruction generation for projects
 *
 * Updated to test the new AX.md format (v5.2.0+)
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
        depth: 'full',
        includeTroubleshooting: false,
        includeCodePatterns: false,
      });
      expect(generator).toBeInstanceOf(LLMOptimizedInstructionGenerator);
    });

    it('should use defaults for missing config options', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        depth: 'basic',
      });
      expect(generator).toBeInstanceOf(LLMOptimizedInstructionGenerator);
    });
  });

  describe('generateInstructions / generateAxMd', () => {
    it('should generate instructions with all main sections', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('# test-project');
      expect(instructions).toContain('## Build & Development');
      expect(instructions).toContain('## Architecture');
      expect(instructions).toContain('## Project-Specific Rules');
    });

    it('should include header with project info', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('**Type:** cli');
      expect(instructions).toContain('**Language:** TypeScript');
      expect(instructions).toContain('**PM:** pnpm');
      expect(instructions).toContain('**Version:** 1.0.0');
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

    it('should skip troubleshooting when includeTroubleshooting is false', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        includeTroubleshooting: false,
      });
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).not.toContain('## Troubleshooting');
    });

    it('should include development tips section when gotchas available', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        gotchas: ['Important tip 1', 'Important tip 2'],
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('## Development Tips');
      expect(instructions).toContain('Important tip 1');
      expect(instructions).toContain('Important tip 2');
    });

    it('should skip development tips section when empty', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        gotchas: [],
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).not.toContain('## Development Tips');
    });

    it('should handle projects without version', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        version: undefined,
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).not.toContain('**Version:**');
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

  describe('project rules generation', () => {
    it('should include ESM import rule when importExtension is .js', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        conventions: {
          importExtension: '.js',
          moduleSystem: 'esm',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('ESM imports require `.js` extension');
    });

    it('should include validation rule when validation is set', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        conventions: {
          validation: 'zod',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('Use zod for input validation');
    });

    it('should include TypeScript rule for TypeScript projects', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        primaryLanguage: 'TypeScript',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('TypeScript strict mode');
    });

    it('should include test framework rule when testFramework is set', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        conventions: {
          testFramework: 'vitest',
        },
        directories: {
          tests: 'tests',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('Tests use vitest');
      expect(instructions).toContain('tests/');
    });

    it('should include module system rule for ESM', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        conventions: {
          moduleSystem: 'esm',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('ES modules');
    });

    it('should include pnpm rule when packageManager is pnpm', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        packageManager: 'pnpm',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('Use pnpm for package management');
    });
  });

  describe('architecture overview generation', () => {
    it('should include entry point when available', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        entryPoint: 'src/main.ts',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('**Entry point:** `src/main.ts`');
    });

    it('should list directories', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        directories: {
          source: 'src',
          tests: 'tests',
          docs: 'docs',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('`src/` - Source code');
      expect(instructions).toContain('`tests/` - Tests');
      expect(instructions).toContain('`docs/` - Documentation');
    });

    it('should include key files section', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        keyFiles: {
          'package.json': 'Package config',
          'tsconfig.json': 'TypeScript config',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('### Key Files');
      expect(instructions).toContain('`package.json`');
      expect(instructions).toContain('`tsconfig.json`');
    });
  });

  describe('code patterns generation', () => {
    it('should include TypeScript patterns when depth is full', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        depth: 'full',
        includeCodePatterns: true,
      });
      const projectInfo = createMockProjectInfo({
        primaryLanguage: 'TypeScript',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('## Code Patterns');
      expect(instructions).toContain('### TypeScript');
    });

    it('should skip code patterns when includeCodePatterns is false', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        depth: 'full',
        includeCodePatterns: false,
      });
      const projectInfo = createMockProjectInfo({
        primaryLanguage: 'TypeScript',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).not.toContain('## Code Patterns');
    });

    it('should include validation patterns when validation is zod', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        depth: 'full',
        includeCodePatterns: true,
      });
      const projectInfo = createMockProjectInfo({
        conventions: {
          validation: 'zod',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('### Validation (Zod)');
      expect(instructions).toContain('safeParse');
    });
  });

  describe('build commands generation', () => {
    it('should include script commands', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        packageManager: 'pnpm',
        scripts: {
          lint: 'eslint .',
          test: 'vitest run',
          build: 'tsc',
          dev: 'tsx src/index.ts',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      // pnpm uses 'pnpm <cmd>' format without 'run' prefix
      expect(instructions).toContain('pnpm lint');
      expect(instructions).toContain('pnpm test');
      expect(instructions).toContain('pnpm build');
      expect(instructions).toContain('pnpm dev');
    });

    it('should use npm commands for npm package manager', () => {
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

      expect(instructions).toContain('npm install');
      expect(instructions).toContain('npm run dev');
      expect(instructions).toContain('npm test');
      expect(instructions).toContain('npm run build');
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

    it('should include TypeScript compilation issue', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        primaryLanguage: 'TypeScript',
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('TypeScript compilation errors');
      expect(instructions).toContain('tsconfig.json');
    });

    it('should include test issue when test framework is set', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        conventions: {
          testFramework: 'vitest',
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('Tests pass locally but fail in CI');
    });

    it('should return no troubleshooting section for minimal config', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        primaryLanguage: 'JavaScript',
        conventions: {},
      });

      const instructions = generator.generateInstructions(projectInfo);

      // No troubleshooting issues should be generated
      expect(instructions).not.toContain('## Troubleshooting');
    });
  });

  describe('generateSummary (deprecated)', () => {
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

    it('should include deprecation note', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const summary = generator.generateSummary(projectInfo);
      const parsed = JSON.parse(summary);

      expect(parsed.note).toContain('deprecated');
    });
  });

  describe('generateIndex / generateDeepAnalysis', () => {
    it('should generate valid JSON index', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const index = generator.generateIndex(projectInfo);
      const parsed = JSON.parse(index);

      expect(parsed.schemaVersion).toBe('2.0');
      expect(parsed.name).toBe('test-project');
    });

    it('should include all core fields', () => {
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

    it('should include optional fields when available', () => {
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

    it('should include architecture when available', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        architecture: { pattern: 'monolith' },
      });

      const index = generator.generateIndex(projectInfo);
      const parsed = JSON.parse(index);

      expect(parsed.architecture).toBeDefined();
      expect(parsed.architecture.pattern).toBe('monolith');
    });

    it('should include security when available', () => {
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

  describe('metadata header', () => {
    it('should include metadata header as HTML comment', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo();

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('<!--');
      expect(instructions).toContain('Generated by: ax-cli / ax-grok');
      expect(instructions).toContain('Last updated:');
      expect(instructions).toContain('Refresh: Run `/init`');
      expect(instructions).toContain('-->');
    });

    it('should include complexity info when available', () => {
      const generator = new LLMOptimizedInstructionGenerator();
      const projectInfo = createMockProjectInfo({
        complexity: {
          level: 'large',
          fileCount: 150,
          linesOfCode: 25000,
          dependencyCount: 50,
          score: 75,
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      expect(instructions).toContain('Complexity: large');
      expect(instructions).toContain('150 files');
      expect(instructions).toContain('~25000 LOC');
    });
  });

  describe('adaptive output', () => {
    it('should skip architecture for small projects with basic depth', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        depth: 'basic',
        adaptiveOutput: true,
      });
      const projectInfo = createMockProjectInfo({
        complexity: {
          level: 'small',
          fileCount: 10,
          linesOfCode: 500,
          dependencyCount: 5,
          score: 15,
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      // Small projects with basic depth should not have architecture section
      expect(instructions).not.toContain('## Architecture');
    });

    it('should include code patterns for enterprise projects', () => {
      const generator = new LLMOptimizedInstructionGenerator({
        depth: 'standard',
        includeCodePatterns: true,
        adaptiveOutput: true,
      });
      const projectInfo = createMockProjectInfo({
        primaryLanguage: 'TypeScript',
        complexity: {
          level: 'enterprise',
          fileCount: 1000,
          linesOfCode: 100000,
          dependencyCount: 200,
          score: 95,
        },
      });

      const instructions = generator.generateInstructions(projectInfo);

      // Enterprise projects should get code patterns even with standard depth
      expect(instructions).toContain('## Code Patterns');
    });
  });
});
