import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectAnalyzer } from '../../src/utils/project-analyzer.js';
import { expectPathsToBeEqual } from '../helpers/path-assertions.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ProjectAnalyzer', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-analyzer-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('analyze', () => {
    it('should analyze a basic project', async () => {
      // Create a minimal project
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        type: 'module',
      };
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const analyzer = new ProjectAnalyzer(tempDir);
      const result = await analyzer.analyze();

      expect(result.success).toBe(true);
      expect(result.projectInfo).toBeDefined();
      expect(result.projectInfo!.name).toBe('test-project');
      expect(result.projectInfo!.version).toBe('1.0.0');
    });

    it('should detect TypeScript projects', async () => {
      const packageJson = {
        name: 'ts-project',
        devDependencies: { typescript: '^5.0.0' },
      };
      const tsconfig = {
        compilerOptions: {
          strict: true,
          module: 'NodeNext',
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      fs.writeFileSync(
        path.join(tempDir, 'tsconfig.json'),
        JSON.stringify(tsconfig, null, 2)
      );

      const analyzer = new ProjectAnalyzer(tempDir);
      const result = await analyzer.analyze();

      expect(result.success).toBe(true);
      expect(result.projectInfo!.primaryLanguage).toBe('TypeScript');
      expect(result.projectInfo!.conventions.typeChecker).toBe('TypeScript');
      expect(result.projectInfo!.conventions.importExtension).toBe('.js');
    });

    it('should detect CLI projects', async () => {
      const packageJson = {
        name: 'cli-tool',
        bin: {
          'my-cli': './dist/index.js',
        },
        dependencies: {
          commander: '^12.0.0',
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const analyzer = new ProjectAnalyzer(tempDir);
      const result = await analyzer.analyze();

      expect(result.success).toBe(true);
      expect(result.projectInfo!.projectType).toBe('cli');
      expect(result.projectInfo!.techStack).toContain('Commander');
      expect(result.projectInfo!.entryPoint).toBe('./dist/index.js');
    });

    it('should detect test frameworks', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          vitest: '^4.0.0',
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      fs.writeFileSync(path.join(tempDir, 'vitest.config.ts'), '// config');

      const analyzer = new ProjectAnalyzer(tempDir);
      const result = await analyzer.analyze();

      expect(result.success).toBe(true);
      expect(result.projectInfo!.conventions.testFramework).toBe('vitest');
      expect(result.projectInfo!.techStack).toContain('Vitest');
    });

    it('should detect project directories', async () => {
      const packageJson = { name: 'test-project' };
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create directories
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.mkdirSync(path.join(tempDir, 'tests'));
      fs.mkdirSync(path.join(tempDir, 'src', 'tools'));

      const analyzer = new ProjectAnalyzer(tempDir);
      const result = await analyzer.analyze();

      expect(result.success).toBe(true);
      expect(result.projectInfo!.directories.source).toBe('src');
      expect(result.projectInfo!.directories.tests).toBe('tests');
      expectPathsToBeEqual(result.projectInfo!.directories.tools, 'src/tools');
    });

    it('should handle projects without package.json', async () => {
      // Empty directory
      const analyzer = new ProjectAnalyzer(tempDir);
      const result = await analyzer.analyze();

      expect(result.success).toBe(true);
      expect(result.projectInfo!.name).toBe(path.basename(tempDir));
      expect(result.projectInfo!.primaryLanguage).toBe('Unknown');
    });

    it('should detect validation libraries', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          zod: '^3.0.0',
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const analyzer = new ProjectAnalyzer(tempDir);
      const result = await analyzer.analyze();

      expect(result.success).toBe(true);
      expect(result.projectInfo!.conventions.validation).toBe('zod');
      expect(result.projectInfo!.techStack).toContain('Zod');
    });

    it('should detect package managers', async () => {
      const packageJson = { name: 'test-project' };
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      fs.writeFileSync(path.join(tempDir, 'bun.lockb'), '');

      const analyzer = new ProjectAnalyzer(tempDir);
      const result = await analyzer.analyze();

      expect(result.success).toBe(true);
      expect(result.projectInfo!.packageManager).toBe('bun');
    });

    it('should detect scripts from package.json', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: {
          build: 'tsc',
          test: 'vitest',
          lint: 'eslint .',
          dev: 'tsx src/index.ts',
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const analyzer = new ProjectAnalyzer(tempDir);
      const result = await analyzer.analyze();

      expect(result.success).toBe(true);
      expect(result.projectInfo!.scripts.build).toBe('tsc');
      expect(result.projectInfo!.scripts.test).toBe('vitest');
      expect(result.projectInfo!.scripts.lint).toBe('eslint .');
      expect(result.projectInfo!.scripts.dev).toBe('tsx src/index.ts');
    });
  });
});
