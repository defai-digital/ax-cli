/**
 * Project analysis utility for intelligent project setup
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ProjectInfo, CodeConventions, AnalysisResult } from '../types/project-analysis.js';
import { parseJsonFile } from './json-utils.js';
import { normalizePath } from './path-utils.js';

interface PackageJson {
  name?: string;
  version?: string;
  type?: string;
  description?: string;
  main?: string;
  bin?: string | Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports?: string | Record<string, string | { import?: string; require?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface TsConfig {
  compilerOptions?: {
    module?: string;
    moduleResolution?: string;
    target?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export class ProjectAnalyzer {
  private projectRoot: string;
  private warnings: string[] = [];
  private packageJsonCache: PackageJson | null | undefined = undefined;
  private tsConfigCache: TsConfig | null | undefined = undefined;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /** Helper to check if path exists relative to project root */
  private pathExists(...segments: string[]): boolean {
    return fs.existsSync(path.join(this.projectRoot, ...segments));
  }

  /** Helper to get stat if path is directory */
  private isDirectory(...segments: string[]): boolean {
    const fullPath = path.join(this.projectRoot, ...segments);
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
  }

  /**
   * Helper: Read and cache package.json
   * Reduces file I/O from 8 reads to 1 read
   */
  private getPackageJson(): PackageJson | null {
    if (this.packageJsonCache !== undefined) {
      return this.packageJsonCache;
    }

    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    const result = parseJsonFile<PackageJson>(packageJsonPath);

    if (!result.success) {
      if (fs.existsSync(packageJsonPath)) {
        this.warnings.push(`Failed to parse package.json: ${result.error}`);
      }
      this.packageJsonCache = null;
      return null;
    }

    this.packageJsonCache = result.data;
    return result.data;
  }

  /**
   * Helper: Read and cache tsconfig.json
   */
  private getTsConfig(): TsConfig | null {
    if (this.tsConfigCache !== undefined) {
      return this.tsConfigCache;
    }

    const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
    const result = parseJsonFile<TsConfig>(tsconfigPath);

    if (!result.success) {
      this.tsConfigCache = null;
      return null;
    }

    this.tsConfigCache = result.data;
    return result.data;
  }

  /**
   * Analyze the project and extract comprehensive information
   */
  async analyze(): Promise<AnalysisResult> {
    try {
      this.warnings = [];

      const projectInfo: ProjectInfo = {
        name: this.detectProjectName(),
        version: this.detectVersion(),
        primaryLanguage: this.detectPrimaryLanguage(),
        techStack: this.detectTechStack(),
        projectType: this.detectProjectType(),
        entryPoint: this.detectEntryPoint(),
        directories: this.detectDirectories(),
        keyFiles: this.detectKeyFiles(),
        conventions: this.detectConventions(),
        scripts: this.detectScripts(),
        packageManager: this.detectPackageManager(),
        lastAnalyzed: new Date().toISOString(),
      };

      return {
        success: true,
        projectInfo,
        warnings: this.warnings.length > 0 ? this.warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown analysis error',
        warnings: this.warnings.length > 0 ? this.warnings : undefined,
      };
    }
  }

  private detectProjectName(): string {
    return this.getPackageJson()?.name ?? path.basename(this.projectRoot);
  }

  private detectVersion(): string | undefined {
    return this.getPackageJson()?.version;
  }

  private detectPrimaryLanguage(): string {
    if (this.pathExists('tsconfig.json')) return 'TypeScript';
    if (this.pathExists('package.json')) return 'JavaScript';
    if (this.pathExists('requirements.txt') || this.pathExists('setup.py') || this.pathExists('pyproject.toml')) {
      return 'Python';
    }
    if (this.pathExists('go.mod')) return 'Go';
    if (this.pathExists('Cargo.toml')) return 'Rust';
    return 'Unknown';
  }

  private detectTechStack(): string[] {
    const stack: string[] = [];
    const packageJson = this.getPackageJson();

    if (packageJson) {
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Dependency-to-stack-name mapping
      const depMap: Record<string, string> = {
        'react': 'React', 'vue': 'Vue', '@angular/core': 'Angular', 'svelte': 'Svelte',
        'next': 'Next.js', 'nuxt': 'Nuxt',
        'express': 'Express', 'fastify': 'Fastify', 'koa': 'Koa', '@nestjs/core': 'NestJS',
        'vitest': 'Vitest', 'jest': 'Jest', 'mocha': 'Mocha', 'playwright': 'Playwright', 'cypress': 'Cypress',
        'vite': 'Vite', 'webpack': 'Webpack', 'esbuild': 'ESBuild', 'rollup': 'Rollup',
        'zod': 'Zod', 'yup': 'Yup', 'joi': 'Joi',
        'commander': 'Commander', 'yargs': 'Yargs', 'ink': 'Ink',
        'prisma': 'Prisma', 'typeorm': 'TypeORM', 'mongoose': 'Mongoose',
      };

      for (const [dep, name] of Object.entries(depMap)) {
        if (allDeps[dep]) stack.push(name);
      }

      if (packageJson.type === 'module') stack.push('ESM');
    }

    if (this.pathExists('tsconfig.json')) stack.push('TypeScript');

    return stack;
  }

  private detectProjectType(): string {
    const packageJson = this.getPackageJson();

    if (packageJson) {
      // Check for bin field (CLI tool)
      if (packageJson.bin) return 'cli';

      // Check dependencies for framework hints
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps['react'] || deps['vue'] || deps['@angular/core'] || deps['svelte']) {
        if (deps['next'] || deps['nuxt']) return 'web-app-ssr';
        return 'web-app';
      }

      if (deps['express'] || deps['fastify'] || deps['koa'] || deps['@nestjs/core']) {
        return 'api';
      }

      // Check for library indicators
      if (packageJson.main || packageJson.exports) {
        return 'library';
      }
    }

    return 'application';
  }

  private detectEntryPoint(): string | undefined {
    const packageJson = this.getPackageJson();

    if (packageJson) {
      // CLI tools
      if (packageJson.bin) {
        if (typeof packageJson.bin === 'string') return packageJson.bin;
        const binValues = Object.values(packageJson.bin);
        if (binValues.length > 0) return binValues[0] as string;
      }

      // Libraries
      if (packageJson.main) return packageJson.main;
      if (packageJson.exports) {
        if (typeof packageJson.exports === 'string') return packageJson.exports;
        if (packageJson.exports['.']) {
          const mainExport = packageJson.exports['.'];
          if (typeof mainExport === 'string') return mainExport;
          if (mainExport.import) return mainExport.import;
          if (mainExport.require) return mainExport.require;
        }
      }
    }

    // Common entry points
    const commonEntries = ['src/index.ts', 'src/index.js', 'index.ts', 'index.js', 'src/main.ts', 'src/main.js'];
    return commonEntries.find(entry => this.pathExists(entry));
  }

  /** Helper to find first matching directory */
  private findFirstDir(candidates: string[]): string | undefined {
    return candidates.find(dir => this.isDirectory(dir));
  }

  private detectDirectories(): ProjectInfo['directories'] {
    const dirs: ProjectInfo['directories'] = {};

    dirs.source = this.findFirstDir(['src', 'lib', 'source']);
    dirs.tests = this.findFirstDir(['tests', 'test', '__tests__', 'spec']);
    dirs.config = this.findFirstDir(['config', 'configs', '.config']);

    // Tools directory
    if (dirs.source && this.isDirectory(dirs.source, 'tools')) {
      dirs.tools = normalizePath(path.join(dirs.source, 'tools'));
    }

    return dirs;
  }

  private detectKeyFiles(): Record<string, string> {
    const fileMap: Record<string, string> = {
      'package.json': 'Node.js package configuration',
      'tsconfig.json': 'TypeScript configuration',
      'vitest.config.ts': 'Vitest test configuration',
      'jest.config.js': 'Jest test configuration',
      '.eslintrc.js': 'ESLint configuration',
      '.prettierrc': 'Prettier configuration',
      'README.md': 'Project documentation',
      'CLAUDE.md': 'Claude-specific instructions',
      '.ax-cli/CUSTOM.md': 'AX CLI custom instructions',
      'vite.config.ts': 'Vite build configuration',
      'webpack.config.js': 'Webpack build configuration',
    };

    const keyFiles: Record<string, string> = {};
    for (const [file, description] of Object.entries(fileMap)) {
      if (this.pathExists(file)) keyFiles[file] = description;
    }
    return keyFiles;
  }

  private detectConventions(): CodeConventions {
    const conventions: CodeConventions = {};

    // Module system from package.json (use cached version)
    const packageJson = this.getPackageJson();
    if (packageJson) {
      conventions.moduleSystem = packageJson.type === 'module' ? 'esm' : 'commonjs';
    }

    // TypeScript config
    const tsconfig = this.getTsConfig();
    if (tsconfig) {
      conventions.typeChecker = 'TypeScript';

      // Check for ESM extensions requirement
      if (tsconfig.compilerOptions?.module === 'NodeNext' ||
          tsconfig.compilerOptions?.module === 'Node16' ||
          tsconfig.compilerOptions?.moduleResolution === 'NodeNext' ||
          tsconfig.compilerOptions?.moduleResolution === 'Bundler') {
        conventions.importExtension = '.js';
      }
    }

    // Testing framework
    if (this.pathExists('vitest.config.ts') || this.pathExists('vitest.config.js')) {
      conventions.testFramework = 'vitest';
    } else if (this.pathExists('jest.config.js') || this.pathExists('jest.config.ts')) {
      conventions.testFramework = 'jest';
    }

    // Linter
    if (this.pathExists('.eslintrc.js') || this.pathExists('.eslintrc.json') || this.pathExists('eslint.config.js')) {
      conventions.linter = 'eslint';
    }

    // Validation library
    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      conventions.validation = deps['zod'] ? 'zod' : deps['yup'] ? 'yup' : deps['joi'] ? 'joi' : undefined;
    }

    return conventions;
  }

  private detectScripts(): ProjectInfo['scripts'] {
    const packageJson = this.getPackageJson();
    if (!packageJson?.scripts) return {};

    return {
      build: packageJson.scripts.build,
      test: packageJson.scripts.test,
      lint: packageJson.scripts.lint,
      dev: packageJson.scripts.dev || packageJson.scripts.start,
    };
  }

  private detectPackageManager(): string | undefined {
    const lockFiles: Record<string, string> = {
      'bun.lockb': 'bun',
      'pnpm-lock.yaml': 'pnpm',
      'yarn.lock': 'yarn',
      'package-lock.json': 'npm',
    };
    for (const [file, pm] of Object.entries(lockFiles)) {
      if (this.pathExists(file)) return pm;
    }
    return undefined;
  }
}
