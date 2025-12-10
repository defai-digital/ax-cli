/**
 * Project analysis utility for intelligent project setup
 *
 * Supports tiered analysis:
 * - Tier 1: Basic project info (fast)
 * - Tier 2: Quality metrics (medium)
 * - Tier 3: Architecture analysis (default - comprehensive)
 * - Tier 4: Security analysis (optional via settings)
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  ProjectInfo,
  CodeConventions,
  AnalysisResult,
  ProjectScripts,
} from '../types/project-analysis.js';
import { parseJsonFile } from './json-utils.js';
import { normalizePath } from './path-utils.js';
import { DeepAnalyzer } from './deep-analyzer.js';

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
  engines?: { node?: string; npm?: string; [key: string]: string | undefined };
  browserslist?: string | string[];
  [key: string]: unknown;
}

interface TsConfig {
  compilerOptions?: {
    module?: string;
    moduleResolution?: string;
    target?: string;
    strict?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface AnalyzerOptions {
  /** Analysis tier (1-4), default is 3 */
  tier?: 1 | 2 | 3 | 4;
  /** Include security analysis (Tier 4) */
  includeSecurity?: boolean;
  /** Maximum files to analyze */
  maxFiles?: number;
}

export class ProjectAnalyzer {
  private projectRoot: string;
  private warnings: string[] = [];
  private packageJsonCache: PackageJson | null | undefined = undefined;
  private tsConfigCache: TsConfig | null | undefined = undefined;
  private options: AnalyzerOptions;

  constructor(projectRoot: string = process.cwd(), options: AnalyzerOptions = {}) {
    this.projectRoot = projectRoot;
    this.options = {
      tier: options.tier ?? 3, // Default to Tier 3 (architecture analysis)
      includeSecurity: options.includeSecurity ?? false,
      maxFiles: options.maxFiles ?? 1000,
    };
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

  /** Read file content safely */
  private readFile(...segments: string[]): string | null {
    try {
      const fullPath = path.join(this.projectRoot, ...segments);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf-8');
      }
    } catch {
      // Ignore read errors
    }
    return null;
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
   * Default tier is 3 (architecture analysis)
   */
  async analyze(): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      this.warnings = [];

      // Tier 1: Basic project info (always included)
      const projectInfo: ProjectInfo = {
        schemaVersion: '2.0',
        name: this.detectProjectName(),
        version: this.detectVersion(),
        description: this.detectDescription(),
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
        cicdPlatform: this.detectCICDPlatform(),
        gotchas: this.detectGotchas(),
        runtimeTargets: this.detectRuntimeTargets(),
      };

      // Deep analysis for Tier 2+
      if (this.options.tier && this.options.tier >= 2) {
        const deepAnalyzer = new DeepAnalyzer({
          projectRoot: this.projectRoot,
          sourceDir: projectInfo.directories.source,
          testsDir: projectInfo.directories.tests,
          tier: this.options.tier,
          maxFilesToAnalyze: this.options.maxFiles,
        });

        // Tier 2: Quality metrics
        try {
          projectInfo.codeStats = await deepAnalyzer.analyzeCodeStats();
          projectInfo.testing = await deepAnalyzer.analyzeTests();
          projectInfo.documentation = await deepAnalyzer.analyzeDocumentation();
          projectInfo.technicalDebt = await deepAnalyzer.analyzeTechnicalDebt();
        } catch (error) {
          this.warnings.push(`Tier 2 analysis partial failure: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Tier 3: Architecture analysis (default)
        if (this.options.tier >= 3) {
          try {
            projectInfo.architecture = await deepAnalyzer.analyzeArchitecture();
          } catch (error) {
            this.warnings.push(`Tier 3 analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }

          // Tier 3+: Contextual understanding (HIGH VALUE for AI)
          try {
            projectInfo.moduleMap = await deepAnalyzer.analyzeModuleMap();
            projectInfo.keyAbstractions = await deepAnalyzer.analyzeKeyAbstractions();
            projectInfo.importConventions = await deepAnalyzer.analyzeImportConventions();
            projectInfo.publicAPI = await deepAnalyzer.analyzePublicAPI();
            projectInfo.howTo = await deepAnalyzer.generateHowTo();
            projectInfo.configPatterns = await deepAnalyzer.analyzeConfigPatterns();
          } catch (error) {
            this.warnings.push(`Contextual analysis partial failure: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Tier 4: Security analysis (optional)
        if (this.options.tier >= 4 || this.options.includeSecurity) {
          try {
            projectInfo.security = await deepAnalyzer.analyzeSecurity();
          } catch (error) {
            this.warnings.push(`Security analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      return {
        success: true,
        projectInfo,
        warnings: this.warnings.length > 0 ? this.warnings : undefined,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown analysis error',
        warnings: this.warnings.length > 0 ? this.warnings : undefined,
        duration: Date.now() - startTime,
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
    dirs.docs = this.findFirstDir(['docs', 'documentation', 'doc']);
    dirs.dist = this.findFirstDir(['dist', 'build', 'out', 'output']);

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
      'vitest.config.js': 'Vitest test configuration',
      'jest.config.js': 'Jest test configuration',
      'jest.config.ts': 'Jest test configuration',
      '.eslintrc.js': 'ESLint configuration',
      '.eslintrc.json': 'ESLint configuration',
      'eslint.config.js': 'ESLint flat configuration',
      '.prettierrc': 'Prettier configuration',
      '.prettierrc.json': 'Prettier configuration',
      'prettier.config.js': 'Prettier configuration',
      'README.md': 'Project documentation',
      'CLAUDE.md': 'Claude-specific instructions',
      'ax.index.json': 'AX CLI project index',
      'vite.config.ts': 'Vite build configuration',
      'vite.config.js': 'Vite build configuration',
      'webpack.config.js': 'Webpack build configuration',
      'rollup.config.js': 'Rollup build configuration',
      'Dockerfile': 'Docker container definition',
      'docker-compose.yml': 'Docker Compose configuration',
      '.env.example': 'Environment variables template',
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

  private detectScripts(): ProjectScripts {
    const packageJson = this.getPackageJson();
    if (!packageJson?.scripts) return {};

    const { build, test, lint, dev, start, typecheck, ...rest } = packageJson.scripts;

    const result: ProjectScripts = {
      build,
      test,
      lint,
      dev: dev || start,
      typecheck,
    };

    // Include custom scripts (non-standard ones)
    const standardScripts = ['build', 'test', 'lint', 'dev', 'start', 'typecheck', 'prepare', 'prepublishOnly', 'preversion', 'postversion'];
    const customScripts: Record<string, string> = {};

    for (const [name, command] of Object.entries(rest)) {
      if (!standardScripts.includes(name) && typeof command === 'string') {
        customScripts[name] = command;
      }
    }

    if (Object.keys(customScripts).length > 0) {
      result.custom = customScripts;
    }

    return result;
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

  /** Extract project description from README or package.json */
  private detectDescription(): string | undefined {
    // Try package.json first
    const pkgDescription = this.getPackageJson()?.description;
    if (pkgDescription && pkgDescription.length > 10) {
      return pkgDescription;
    }

    // Try README.md
    const readme = this.readFile('README.md');
    if (readme) {
      const lines = readme.split('\n');
      let foundHeader = false;

      for (const line of lines) {
        // Skip badges and images
        if (line.trim().startsWith('![') || line.trim().startsWith('[![')) continue;
        if (line.trim().startsWith('<p') || line.trim().startsWith('<img')) continue;

        // Found main header
        if (line.startsWith('# ') && !foundHeader) {
          foundHeader = true;
          continue;
        }

        // Skip secondary headers
        if (line.startsWith('#')) break;

        // Found paragraph after header
        if (foundHeader && line.trim().length > 20) {
          return line.trim().slice(0, 200);
        }
      }
    }

    return pkgDescription;
  }

  /** Detect CI/CD platform */
  private detectCICDPlatform(): string | undefined {
    if (this.isDirectory('.github', 'workflows')) return 'GitHub Actions';
    if (this.pathExists('.gitlab-ci.yml')) return 'GitLab CI';
    if (this.pathExists('.circleci', 'config.yml')) return 'CircleCI';
    if (this.pathExists('azure-pipelines.yml')) return 'Azure Pipelines';
    if (this.pathExists('Jenkinsfile')) return 'Jenkins';
    if (this.pathExists('bitbucket-pipelines.yml')) return 'Bitbucket Pipelines';
    return undefined;
  }

  /** Detect runtime targets */
  private detectRuntimeTargets(): string[] | undefined {
    const targets: string[] = [];
    const packageJson = this.getPackageJson();

    // Check engines field
    if (packageJson?.engines) {
      if (packageJson.engines.node) {
        targets.push(`Node.js ${packageJson.engines.node}`);
      }
      if (packageJson.engines.npm) {
        targets.push(`npm ${packageJson.engines.npm}`);
      }
    }

    // Check for browser targets
    if (packageJson?.browserslist) {
      targets.push('Browser');
    }

    // Check for Deno
    if (this.pathExists('deno.json') || this.pathExists('deno.jsonc')) {
      targets.push('Deno');
    }

    // Check for Bun
    if (this.pathExists('bun.lockb') || this.pathExists('bunfig.toml')) {
      targets.push('Bun');
    }

    return targets.length > 0 ? targets : undefined;
  }

  /** Detect common gotchas and development tips */
  private detectGotchas(): string[] | undefined {
    const gotchas: string[] = [];
    const conventions = this.detectConventions();
    const packageJson = this.getPackageJson();
    const deps = { ...packageJson?.dependencies, ...packageJson?.devDependencies };

    // ESM gotcha
    if (conventions.importExtension === '.js') {
      gotchas.push('ESM requires .js extension in imports even for TypeScript files');
    }

    // TypeScript strict mode
    const tsconfig = this.getTsConfig();
    if (tsconfig?.compilerOptions?.strict) {
      gotchas.push('TypeScript strict mode is enabled - null checks required');
    }

    // Monorepo tips
    if (this.pathExists('pnpm-workspace.yaml')) {
      gotchas.push('Monorepo: use pnpm --filter <pkg> to target specific packages');
    }

    // Test location hints
    if (this.isDirectory('tests') || this.isDirectory('test')) {
      gotchas.push(`Tests are in ${this.isDirectory('tests') ? 'tests/' : 'test/'} directory`);
    }

    // Debug tips
    if (deps?.['debug']) {
      gotchas.push('Use DEBUG=* for verbose debug output');
    }
    if (deps?.['vitest']) {
      gotchas.push('Run single test: pnpm test -- path/to/test.ts');
    }
    if (deps?.['prisma']) {
      gotchas.push('Use npx prisma studio to browse database');
    }

    return gotchas.length > 0 ? gotchas : undefined;
  }
}
