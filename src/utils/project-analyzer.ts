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
        name: await this.detectProjectName(),
        version: await this.detectVersion(),
        primaryLanguage: await this.detectPrimaryLanguage(),
        techStack: await this.detectTechStack(),
        projectType: await this.detectProjectType(),
        entryPoint: await this.detectEntryPoint(),
        directories: await this.detectDirectories(),
        keyFiles: await this.detectKeyFiles(),
        conventions: await this.detectConventions(),
        scripts: await this.detectScripts(),
        packageManager: await this.detectPackageManager(),
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

  private async detectProjectName(): Promise<string> {
    const packageJson = this.getPackageJson();
    if (packageJson?.name) {
      return packageJson.name;
    }

    // Fallback to directory name
    return path.basename(this.projectRoot);
  }

  private async detectVersion(): Promise<string | undefined> {
    const packageJson = this.getPackageJson();
    return packageJson?.version;
  }

  private async detectPrimaryLanguage(): Promise<string> {
    // Check for config files to determine language
    if (fs.existsSync(path.join(this.projectRoot, 'tsconfig.json'))) {
      return 'TypeScript';
    }
    if (fs.existsSync(path.join(this.projectRoot, 'package.json'))) {
      return 'JavaScript';
    }
    if (fs.existsSync(path.join(this.projectRoot, 'requirements.txt')) ||
        fs.existsSync(path.join(this.projectRoot, 'setup.py')) ||
        fs.existsSync(path.join(this.projectRoot, 'pyproject.toml'))) {
      return 'Python';
    }
    if (fs.existsSync(path.join(this.projectRoot, 'go.mod'))) {
      return 'Go';
    }
    if (fs.existsSync(path.join(this.projectRoot, 'Cargo.toml'))) {
      return 'Rust';
    }

    return 'Unknown';
  }

  private async detectTechStack(): Promise<string[]> {
    const stack: string[] = [];
    const packageJson = this.getPackageJson();

    if (packageJson) {
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Framework detection
      if (allDeps['react']) stack.push('React');
      if (allDeps['vue']) stack.push('Vue');
      if (allDeps['@angular/core']) stack.push('Angular');
      if (allDeps['svelte']) stack.push('Svelte');
      if (allDeps['next']) stack.push('Next.js');
      if (allDeps['nuxt']) stack.push('Nuxt');

      // Backend frameworks
      if (allDeps['express']) stack.push('Express');
      if (allDeps['fastify']) stack.push('Fastify');
      if (allDeps['koa']) stack.push('Koa');
      if (allDeps['@nestjs/core']) stack.push('NestJS');

      // Testing
      if (allDeps['vitest']) stack.push('Vitest');
      if (allDeps['jest']) stack.push('Jest');
      if (allDeps['mocha']) stack.push('Mocha');
      if (allDeps['playwright']) stack.push('Playwright');
      if (allDeps['cypress']) stack.push('Cypress');

      // Build tools
      if (allDeps['vite']) stack.push('Vite');
      if (allDeps['webpack']) stack.push('Webpack');
      if (allDeps['esbuild']) stack.push('ESBuild');
      if (allDeps['rollup']) stack.push('Rollup');

      // Validation
      if (allDeps['zod']) stack.push('Zod');
      if (allDeps['yup']) stack.push('Yup');
      if (allDeps['joi']) stack.push('Joi');

      // CLI
      if (allDeps['commander']) stack.push('Commander');
      if (allDeps['yargs']) stack.push('Yargs');
      if (allDeps['ink']) stack.push('Ink');

      // Database
      if (allDeps['prisma']) stack.push('Prisma');
      if (allDeps['typeorm']) stack.push('TypeORM');
      if (allDeps['mongoose']) stack.push('Mongoose');

      // Runtime
      if (packageJson.type === 'module') stack.push('ESM');
    }

    // TypeScript detection
    if (fs.existsSync(path.join(this.projectRoot, 'tsconfig.json'))) {
      stack.push('TypeScript');
    }

    return stack;
  }

  private async detectProjectType(): Promise<string> {
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

  private async detectEntryPoint(): Promise<string | undefined> {
    const packageJson = this.getPackageJson();

    if (packageJson) {
      // CLI tools
      if (packageJson.bin) {
        if (typeof packageJson.bin === 'string') {
          return packageJson.bin;
        }
        // Get first bin entry (with bounds check)
        const binValues = Object.values(packageJson.bin);
        if (binValues.length > 0) {
          return binValues[0] as string;
        }
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
    for (const entry of commonEntries) {
      if (fs.existsSync(path.join(this.projectRoot, entry))) {
        return entry;
      }
    }

    return undefined;
  }

  private async detectDirectories(): Promise<ProjectInfo['directories']> {
    const dirs: ProjectInfo['directories'] = {};

    // Source directory
    const sourceDirs = ['src', 'lib', 'source'];
    for (const dir of sourceDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        dirs.source = dir;
        break;
      }
    }

    // Test directory
    const testDirs = ['tests', 'test', '__tests__', 'spec'];
    for (const dir of testDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        dirs.tests = dir;
        break;
      }
    }

    // Config directory
    const configDirs = ['config', 'configs', '.config'];
    for (const dir of configDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        dirs.config = dir;
        break;
      }
    }

    // Tools directory (normalize for cross-platform compatibility)
    if (dirs.source) {
      const toolsPath = path.join(this.projectRoot, dirs.source, 'tools');
      if (fs.existsSync(toolsPath) && fs.statSync(toolsPath).isDirectory()) {
        dirs.tools = normalizePath(path.join(dirs.source, 'tools'));
      }
    }

    return dirs;
  }

  private async detectKeyFiles(): Promise<Record<string, string>> {
    const keyFiles: Record<string, string> = {};

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

    for (const [file, description] of Object.entries(fileMap)) {
      if (fs.existsSync(path.join(this.projectRoot, file))) {
        keyFiles[file] = description;
      }
    }

    return keyFiles;
  }

  private async detectConventions(): Promise<CodeConventions> {
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
    if (fs.existsSync(path.join(this.projectRoot, 'vitest.config.ts')) ||
        fs.existsSync(path.join(this.projectRoot, 'vitest.config.js'))) {
      conventions.testFramework = 'vitest';
    } else if (fs.existsSync(path.join(this.projectRoot, 'jest.config.js')) ||
               fs.existsSync(path.join(this.projectRoot, 'jest.config.ts'))) {
      conventions.testFramework = 'jest';
    }

    // Linter
    if (fs.existsSync(path.join(this.projectRoot, '.eslintrc.js')) ||
        fs.existsSync(path.join(this.projectRoot, '.eslintrc.json')) ||
        fs.existsSync(path.join(this.projectRoot, 'eslint.config.js'))) {
      conventions.linter = 'eslint';
    }

    // Validation library from package.json (reuse cached packageJson)
    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps['zod']) conventions.validation = 'zod';
      else if (deps['yup']) conventions.validation = 'yup';
      else if (deps['joi']) conventions.validation = 'joi';
    }

    return conventions;
  }

  private async detectScripts(): Promise<ProjectInfo['scripts']> {
    const scripts: ProjectInfo['scripts'] = {};
    const packageJson = this.getPackageJson();

    if (packageJson?.scripts) {
      scripts.build = packageJson.scripts.build;
      scripts.test = packageJson.scripts.test;
      scripts.lint = packageJson.scripts.lint;
      scripts.dev = packageJson.scripts.dev || packageJson.scripts.start;
    }

    return scripts;
  }

  private async detectPackageManager(): Promise<string | undefined> {
    if (fs.existsSync(path.join(this.projectRoot, 'bun.lockb'))) return 'bun';
    if (fs.existsSync(path.join(this.projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(this.projectRoot, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(this.projectRoot, 'package-lock.json'))) return 'npm';
    return undefined;
  }
}
