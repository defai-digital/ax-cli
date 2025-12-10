/**
 * Deep Project Analyzer
 *
 * Performs comprehensive analysis of a codebase including:
 * - Tier 2: Code statistics, test coverage, documentation analysis
 * - Tier 3: Architecture analysis, dependency graphs, hotspots
 * - Tier 4: Security analysis (optional)
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  CodeStatistics,
  TestAnalysis,
  DocumentationAnalysis,
  TechnicalDebt,
  ArchitectureAnalysis,
  ModuleInfo,
  DependencyEdge,
  SecurityAnalysis,
} from '../types/project-analysis.js';

interface DeepAnalyzerOptions {
  projectRoot: string;
  sourceDir?: string;
  testsDir?: string;
  tier?: 1 | 2 | 3 | 4;
  includeNodeModules?: boolean;
  maxFilesToAnalyze?: number;
}

interface FileInfo {
  path: string;
  relativePath: string;
  extension: string;
  lines: number;
  imports: string[];
  exports: string[];
  hasJsDoc: boolean;
  todos: Array<{ line: number; text: string }>;
  fixmes: Array<{ line: number; text: string }>;
  functionCount: number;
  isTest: boolean;
}

export class DeepAnalyzer {
  private projectRoot: string;
  private sourceDir: string;
  private testsDir: string;
  private maxFiles: number;
  private fileCache: Map<string, FileInfo> = new Map();

  constructor(options: DeepAnalyzerOptions) {
    this.projectRoot = options.projectRoot;
    this.sourceDir = options.sourceDir || 'src';
    this.testsDir = options.testsDir || 'tests';
    this.maxFiles = options.maxFilesToAnalyze ?? 1000;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN ANALYSIS METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Analyze code statistics (Tier 2)
   */
  async analyzeCodeStats(): Promise<CodeStatistics> {
    const files = this.getAllSourceFiles();
    const filesByExtension: Record<string, number> = {};
    let totalLoc = 0;
    const largeFiles: Array<{ path: string; lines: number }> = [];

    for (const file of files) {
      const info = this.analyzeFile(file);
      const ext = info.extension || 'no-ext';
      filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;
      totalLoc += info.lines;

      if (info.lines > 500) {
        largeFiles.push({ path: info.relativePath, lines: info.lines });
      }
    }

    // Sort large files by size descending
    largeFiles.sort((a, b) => b.lines - a.lines);

    return {
      filesByExtension,
      totalLinesOfCode: totalLoc,
      totalFiles: files.length,
      largeFiles: largeFiles.slice(0, 20), // Top 20 largest
      averageFileSize: files.length > 0 ? Math.round(totalLoc / files.length) : 0,
    };
  }

  /**
   * Analyze test coverage (Tier 2)
   */
  async analyzeTests(): Promise<TestAnalysis> {
    const sourceFiles = this.getAllSourceFiles().filter(f => !this.isTestFile(f));
    const testFiles = this.getAllTestFiles();

    // Map source modules to their test files
    const sourceModules = new Set<string>();
    const testedModules = new Set<string>();

    for (const file of sourceFiles) {
      const moduleName = this.getModuleName(file);
      sourceModules.add(moduleName);
    }

    for (const testFile of testFiles) {
      // Try to find which module this test covers
      const testedModule = this.findTestedModule(testFile, sourceModules);
      if (testedModule) {
        testedModules.add(testedModule);
      }
    }

    const modulesWithTests = Array.from(testedModules);
    const modulesMissingTests = Array.from(sourceModules).filter(m => !testedModules.has(m));

    // Detect test types
    const testTypes = this.detectTestTypes(testFiles);

    // Detect test patterns
    const patterns = this.detectTestPatterns();

    return {
      framework: this.detectTestFramework(),
      patterns,
      modulesWithTests,
      modulesMissingTests: modulesMissingTests.slice(0, 50), // Limit for readability
      testTypes,
      testFileCount: testFiles.length,
    };
  }

  /**
   * Analyze documentation (Tier 2)
   */
  async analyzeDocumentation(): Promise<DocumentationAnalysis> {
    const files = this.getAllSourceFiles().filter(f => !this.isTestFile(f));
    let filesWithDocs = 0;
    let filesWithoutDocs = 0;
    let totalComments = 0;
    let totalLines = 0;

    for (const file of files) {
      const info = this.analyzeFile(file);
      totalLines += info.lines;

      if (info.hasJsDoc) {
        filesWithDocs++;
      } else {
        filesWithoutDocs++;
      }

      // Count comment lines (rough estimate)
      const content = this.readFileContent(file);
      const commentMatches = content.match(/\/\/|\/\*|\*\//g);
      totalComments += commentMatches?.length || 0;
    }

    // Check README
    const readmePath = path.join(this.projectRoot, 'README.md');
    const hasReadme = fs.existsSync(readmePath);
    let readmeScore: number | undefined;

    if (hasReadme) {
      readmeScore = this.scoreReadme(readmePath);
    }

    // Find doc files
    const docFiles = this.findDocFiles();

    const totalDocs = filesWithDocs + filesWithoutDocs;
    const jsdocCoverage = totalDocs > 0 ? Math.round((filesWithDocs / totalDocs) * 100) : 0;
    const commentDensity = totalLines > 0 ? Math.round((totalComments / totalLines) * 100) : 0;

    return {
      jsdocCoverage,
      filesWithDocs,
      filesWithoutDocs,
      hasReadme,
      readmeScore,
      commentDensity,
      docFiles,
    };
  }

  /**
   * Analyze technical debt (Tier 2)
   */
  async analyzeTechnicalDebt(): Promise<TechnicalDebt> {
    const files = this.getAllSourceFiles();
    const todos: Array<{ file: string; line: number; text: string }> = [];
    const fixmes: Array<{ file: string; line: number; text: string }> = [];
    const deprecatedUsage: Array<{ file: string; api: string; suggestion?: string }> = [];

    for (const file of files) {
      const info = this.analyzeFile(file);

      for (const todo of info.todos) {
        todos.push({ file: info.relativePath, ...todo });
      }

      for (const fixme of info.fixmes) {
        fixmes.push({ file: info.relativePath, ...fixme });
      }

      // Check for deprecated patterns
      const content = this.readFileContent(file);
      const deprecatedPatterns = this.findDeprecatedUsage(content, info.relativePath);
      deprecatedUsage.push(...deprecatedPatterns);
    }

    return {
      todos: todos.slice(0, 100), // Limit to 100
      fixmes: fixmes.slice(0, 100),
      deprecatedUsage: deprecatedUsage.slice(0, 50),
      totalCount: todos.length + fixmes.length + deprecatedUsage.length,
    };
  }

  /**
   * Analyze architecture (Tier 3)
   */
  async analyzeArchitecture(): Promise<ArchitectureAnalysis> {
    const files = this.getAllSourceFiles().filter(f => !this.isTestFile(f));
    const modules: ModuleInfo[] = [];
    const dependencyGraph: DependencyEdge[] = [];
    const moduleImports = new Map<string, string[]>();
    const moduleExports = new Map<string, string[]>();

    // First pass: collect all modules and their imports/exports
    for (const file of files) {
      const info = this.analyzeFile(file);
      const modulePath = info.relativePath;

      moduleImports.set(modulePath, info.imports);
      moduleExports.set(modulePath, info.exports);

      modules.push({
        path: modulePath,
        kind: this.classifyModule(modulePath),
        exports: info.exports,
        isPublic: this.isPublicModule(modulePath),
        loc: info.lines,
        functionCount: info.functionCount,
        dependencies: [],
        dependents: [],
      });
    }

    // Second pass: build dependency graph
    for (const [modulePath, imports] of moduleImports) {
      for (const imp of imports) {
        const resolvedImport = this.resolveImport(imp, modulePath);
        if (resolvedImport && moduleImports.has(resolvedImport)) {
          dependencyGraph.push({
            from: modulePath,
            to: resolvedImport,
            type: this.getImportType(imp),
          });
        }
      }
    }

    // Calculate fan-in and fan-out
    const fanIn = new Map<string, number>();
    const fanOut = new Map<string, number>();

    for (const edge of dependencyGraph) {
      fanOut.set(edge.from, (fanOut.get(edge.from) || 0) + 1);
      fanIn.set(edge.to, (fanIn.get(edge.to) || 0) + 1);
    }

    // Update modules with dependency info
    for (const mod of modules) {
      mod.dependencies = dependencyGraph.filter(e => e.from === mod.path).map(e => e.to);
      mod.dependents = dependencyGraph.filter(e => e.to === mod.path).map(e => e.from);
    }

    // Find circular dependencies
    const circularDependencies = this.findCircularDependencies(dependencyGraph);

    // Find high fan-in/fan-out modules
    const highFanInModules = Array.from(fanIn.entries())
      .filter(([_, count]) => count >= 5)
      .map(([module, count]) => ({ module, fanIn: count }))
      .sort((a, b) => b.fanIn - a.fanIn)
      .slice(0, 15);

    const highFanOutModules = Array.from(fanOut.entries())
      .filter(([_, count]) => count >= 10)
      .map(([module, count]) => ({ module, fanOut: count }))
      .sort((a, b) => b.fanOut - a.fanOut)
      .slice(0, 15);

    // Detect hotspots
    const hotspots = this.detectHotspots(modules, fanIn, fanOut);

    // Detect architecture pattern
    const pattern = this.detectArchitecturePattern(modules);

    // Detect layers
    const layers = this.detectLayers(modules);

    // Public API
    const publicApi = this.extractPublicApi(modules, moduleExports);

    // Entry points
    const entryPoints = this.findEntryPoints();

    // Extension points
    const extensionPoints = this.findExtensionPoints(modules);

    return {
      pattern,
      modules,
      dependencyGraph,
      circularDependencies,
      highFanInModules,
      highFanOutModules,
      hotspots,
      layers,
      publicApi,
      entryPoints,
      extensionPoints,
    };
  }

  /**
   * Analyze security (Tier 4 - Optional)
   */
  async analyzeSecurity(): Promise<SecurityAnalysis> {
    const files = this.getAllSourceFiles();
    const envVarsUsed: Array<{ name: string; files: string[]; isSecret: boolean }> = [];
    const sensitiveFiles: Array<{ path: string; reason: string }> = [];
    const dangerousApis: Array<{ file: string; line: number; api: string; risk: 'low' | 'medium' | 'high'; suggestion?: string }> = [];
    const potentialSecrets: Array<{ file: string; line: number; pattern: string; confidence: 'low' | 'medium' | 'high' }> = [];
    const unvalidatedInputs: Array<{ file: string; location: string; inputType: string }> = [];

    const envVarMap = new Map<string, Set<string>>();

    for (const file of files) {
      const content = this.readFileContent(file);
      const relativePath = path.relative(this.projectRoot, file);
      const lines = content.split('\n');

      // Find env var usage
      const envMatches = content.matchAll(/process\.env\.(\w+)|process\.env\[['"](\w+)['"]\]/g);
      for (const match of envMatches) {
        const varName = match[1] || match[2];
        if (!envVarMap.has(varName)) {
          envVarMap.set(varName, new Set());
        }
        envVarMap.get(varName)!.add(relativePath);
      }

      // Find dangerous APIs
      const dangerousPatterns = [
        { pattern: /\beval\s*\(/g, api: 'eval()', risk: 'high' as const, suggestion: 'Avoid eval - use safer alternatives' },
        { pattern: /new\s+Function\s*\(/g, api: 'new Function()', risk: 'high' as const, suggestion: 'Avoid dynamic function creation' },
        { pattern: /child_process\.(exec|execSync|spawn)\s*\(/g, api: 'child_process', risk: 'medium' as const, suggestion: 'Validate/sanitize command inputs' },
        { pattern: /fs\.(writeFile|appendFile|unlink|rmdir)\s*\(/g, api: 'fs write operations', risk: 'medium' as const, suggestion: 'Validate file paths' },
        { pattern: /\.innerHTML\s*=/g, api: 'innerHTML assignment', risk: 'medium' as const, suggestion: 'Use textContent or sanitize HTML' },
      ];

      for (const { pattern, api, risk, suggestion } of dangerousPatterns) {
        let lineNum = 0;
        for (const line of lines) {
          lineNum++;
          if (pattern.test(line)) {
            dangerousApis.push({ file: relativePath, line: lineNum, api, risk, suggestion });
          }
        }
      }

      // Find potential hardcoded secrets
      const secretPatterns = [
        { pattern: /['"](?:api[_-]?key|apikey|secret|password|token|auth)['"]\s*[:=]\s*['"][^'"]{8,}['"]/gi, type: 'Hardcoded credential', confidence: 'medium' as const },
        { pattern: /(?:sk|pk)[-_](?:live|test)[-_][a-zA-Z0-9]{20,}/g, type: 'Stripe key pattern', confidence: 'high' as const },
        { pattern: /ghp_[a-zA-Z0-9]{36}/g, type: 'GitHub PAT pattern', confidence: 'high' as const },
        { pattern: /xox[baprs]-[a-zA-Z0-9-]{10,}/g, type: 'Slack token pattern', confidence: 'high' as const },
      ];

      let lineNum = 0;
      for (const line of lines) {
        lineNum++;
        for (const { pattern, type, confidence } of secretPatterns) {
          if (pattern.test(line)) {
            potentialSecrets.push({ file: relativePath, line: lineNum, pattern: type, confidence });
          }
        }
      }
    }

    // Convert env var map to array
    for (const [name, files] of envVarMap) {
      const isSecret = /key|secret|password|token|auth|credential/i.test(name);
      envVarsUsed.push({ name, files: Array.from(files), isSecret });
    }

    // Find sensitive files
    const sensitivePatterns = [
      { pattern: /\.env(?:\..+)?$/, reason: 'Environment file with potential secrets' },
      { pattern: /\.pem$|\.key$|id_rsa/, reason: 'Private key file' },
      { pattern: /credentials|secrets/i, reason: 'Credentials/secrets file' },
    ];

    const allFiles = this.getAllFiles();
    for (const file of allFiles) {
      const relativePath = path.relative(this.projectRoot, file);
      for (const { pattern, reason } of sensitivePatterns) {
        if (pattern.test(relativePath)) {
          sensitiveFiles.push({ path: relativePath, reason });
          break;
        }
      }
    }

    return {
      envVarsUsed: envVarsUsed.sort((a, b) => (b.isSecret ? 1 : 0) - (a.isSecret ? 1 : 0)),
      sensitiveFiles,
      dangerousApis: dangerousApis.slice(0, 50),
      unvalidatedInputs,
      potentialSecrets: potentialSecrets.slice(0, 30),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private getAllSourceFiles(): string[] {
    const sourceDir = path.join(this.projectRoot, this.sourceDir);
    if (!fs.existsSync(sourceDir)) {
      return [];
    }
    return this.walkDir(sourceDir, ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
  }

  private getAllTestFiles(): string[] {
    const files: string[] = [];

    // Check tests directory
    const testsDir = path.join(this.projectRoot, this.testsDir);
    if (fs.existsSync(testsDir)) {
      files.push(...this.walkDir(testsDir, ['.ts', '.tsx', '.js', '.jsx']));
    }

    // Check for test files in source
    const sourceDir = path.join(this.projectRoot, this.sourceDir);
    if (fs.existsSync(sourceDir)) {
      const sourceFiles = this.walkDir(sourceDir, ['.ts', '.tsx', '.js', '.jsx']);
      files.push(...sourceFiles.filter(f => this.isTestFile(f)));
    }

    return files;
  }

  private getAllFiles(): string[] {
    return this.walkDir(this.projectRoot, [], ['node_modules', '.git', 'dist', 'build', 'coverage']);
  }

  private walkDir(dir: string, extensions: string[], exclude: string[] = ['node_modules', '.git', 'dist', 'build']): string[] {
    const files: string[] = [];
    if (!fs.existsSync(dir)) return files;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue;
      if (files.length >= this.maxFiles) break;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...this.walkDir(fullPath, extensions, exclude));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.length === 0 || extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  private analyzeFile(filePath: string): FileInfo {
    const cached = this.fileCache.get(filePath);
    if (cached) return cached;

    const content = this.readFileContent(filePath);
    const lines = content.split('\n');
    const relativePath = path.relative(this.projectRoot, filePath);

    const info: FileInfo = {
      path: filePath,
      relativePath,
      extension: path.extname(filePath),
      lines: lines.length,
      imports: this.extractImports(content),
      exports: this.extractExports(content),
      hasJsDoc: /\/\*\*[\s\S]*?\*\//.test(content),
      todos: this.extractTodos(lines),
      fixmes: this.extractFixmes(lines),
      functionCount: this.countFunctions(content),
      isTest: this.isTestFile(filePath),
    };

    this.fileCache.set(filePath, info);
    return info;
  }

  private readFileContent(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return '';
    }
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const staticImports = content.matchAll(/import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g);
    const dynamicImports = content.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    const requires = content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);

    for (const match of staticImports) imports.push(match[1]);
    for (const match of dynamicImports) imports.push(match[1]);
    for (const match of requires) imports.push(match[1]);

    return imports;
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];

    // Named exports: export { foo, bar }
    const namedExports = content.matchAll(/export\s*\{\s*([^}]+)\s*\}/g);
    for (const match of namedExports) {
      const names = match[1].split(',').map(n => n.trim().split(' as ')[0].trim());
      exports.push(...names);
    }

    // Direct exports: export function foo, export class Bar, export const baz
    const directExports = content.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g);
    for (const match of directExports) {
      exports.push(match[1]);
    }

    // Default export
    if (/export\s+default/.test(content)) {
      exports.push('default');
    }

    return [...new Set(exports)];
  }

  private extractTodos(lines: string[]): Array<{ line: number; text: string }> {
    const todos: Array<{ line: number; text: string }> = [];
    lines.forEach((line, index) => {
      const match = line.match(/\/\/\s*TODO[:\s]*(.*)/i) || line.match(/\/\*\s*TODO[:\s]*(.*)\*\//i);
      if (match) {
        todos.push({ line: index + 1, text: match[1].trim() });
      }
    });
    return todos;
  }

  private extractFixmes(lines: string[]): Array<{ line: number; text: string }> {
    const fixmes: Array<{ line: number; text: string }> = [];
    lines.forEach((line, index) => {
      const match = line.match(/\/\/\s*FIXME[:\s]*(.*)/i) || line.match(/\/\*\s*FIXME[:\s]*(.*)\*\//i);
      if (match) {
        fixmes.push({ line: index + 1, text: match[1].trim() });
      }
    });
    return fixmes;
  }

  private countFunctions(content: string): number {
    const patterns = [
      /function\s+\w+/g,
      /\w+\s*:\s*(?:async\s+)?function/g,
      /(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/g,
      /(?:async\s+)?\w+\s*\([^)]*\)\s*(?::\s*\w+(?:<[^>]+>)?)?\s*\{/g,
    ];

    let count = 0;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      count += matches?.length || 0;
    }

    return Math.max(1, Math.floor(count / 2)); // Rough dedup
  }

  private isTestFile(filePath: string): boolean {
    const name = path.basename(filePath);
    return /\.(test|spec)\.[jt]sx?$/.test(name) ||
      filePath.includes('__tests__') ||
      filePath.includes('/tests/') ||
      filePath.includes('/test/');
  }

  private getModuleName(filePath: string): string {
    const relative = path.relative(path.join(this.projectRoot, this.sourceDir), filePath);
    return relative.replace(/\.[jt]sx?$/, '');
  }

  private findTestedModule(testFile: string, sourceModules: Set<string>): string | null {
    const testName = path.basename(testFile).replace(/\.(test|spec)\.[jt]sx?$/, '');

    for (const module of sourceModules) {
      const moduleName = path.basename(module);
      if (moduleName === testName || moduleName === `${testName}.ts` || moduleName === `${testName}.js`) {
        return module;
      }
    }

    // Try to find by directory structure
    const content = this.readFileContent(testFile);
    const imports = this.extractImports(content);
    for (const imp of imports) {
      if (imp.startsWith('.') || imp.startsWith('@/')) {
        const cleanImport = imp.replace(/^@\//, '').replace(/\.[jt]sx?$/, '');
        for (const module of sourceModules) {
          if (module.includes(cleanImport)) {
            return module;
          }
        }
      }
    }

    return null;
  }

  private detectTestTypes(testFiles: string[]): Array<'unit' | 'integration' | 'e2e' | 'snapshot'> {
    const types = new Set<'unit' | 'integration' | 'e2e' | 'snapshot'>();

    for (const file of testFiles) {
      const content = this.readFileContent(file);
      const filePath = file.toLowerCase();

      if (filePath.includes('e2e') || filePath.includes('end-to-end') || /playwright|cypress|puppeteer/.test(content)) {
        types.add('e2e');
      }
      if (filePath.includes('integration') || /supertest|request\(app\)/.test(content)) {
        types.add('integration');
      }
      if (/toMatchSnapshot|toMatchInlineSnapshot/.test(content)) {
        types.add('snapshot');
      }
      if (!filePath.includes('e2e') && !filePath.includes('integration')) {
        types.add('unit');
      }
    }

    return Array.from(types);
  }

  private detectTestPatterns(): string[] {
    const patterns: string[] = [];

    if (fs.existsSync(path.join(this.projectRoot, this.testsDir))) {
      patterns.push(`${this.testsDir}/**/*.test.ts`);
    }
    if (fs.existsSync(path.join(this.projectRoot, this.sourceDir))) {
      patterns.push(`${this.sourceDir}/**/*.test.ts`);
      patterns.push(`${this.sourceDir}/**/*.spec.ts`);
    }
    patterns.push('**/__tests__/**/*.ts');

    return patterns;
  }

  private detectTestFramework(): string | undefined {
    const pkgPath = path.join(this.projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) return undefined;

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['vitest']) return 'vitest';
      if (deps['jest']) return 'jest';
      if (deps['mocha']) return 'mocha';
      if (deps['ava']) return 'ava';
      if (deps['tap']) return 'tap';
    } catch {
      // Ignore parse errors
    }

    return undefined;
  }

  private scoreReadme(readmePath: string): number {
    const content = this.readFileContent(readmePath);
    let score = 0;

    // Check for common sections
    if (/^#\s/m.test(content)) score += 10;
    if (/installation|getting started/i.test(content)) score += 20;
    if (/usage|how to use/i.test(content)) score += 20;
    if (/```/.test(content)) score += 15; // Code examples
    if (/## api|## reference/i.test(content)) score += 15;
    if (/license/i.test(content)) score += 10;
    if (/contributing/i.test(content)) score += 10;

    return Math.min(100, score);
  }

  private findDocFiles(): string[] {
    const docPatterns = ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'API.md', 'docs/**/*.md'];
    const docFiles: string[] = [];

    for (const pattern of docPatterns) {
      if (pattern.includes('**')) {
        const docsDir = path.join(this.projectRoot, 'docs');
        if (fs.existsSync(docsDir)) {
          docFiles.push(...this.walkDir(docsDir, ['.md']).map(f => path.relative(this.projectRoot, f)));
        }
      } else {
        const filePath = path.join(this.projectRoot, pattern);
        if (fs.existsSync(filePath)) {
          docFiles.push(pattern);
        }
      }
    }

    return docFiles;
  }

  private findDeprecatedUsage(content: string, filePath: string): Array<{ file: string; api: string; suggestion?: string }> {
    const deprecated: Array<{ file: string; api: string; suggestion?: string }> = [];

    const patterns = [
      { pattern: /@deprecated/gi, api: 'Deprecated annotation found' },
      { pattern: /\.substr\(/g, api: 'String.substr()', suggestion: 'Use String.slice() instead' },
      { pattern: /new Buffer\(/g, api: 'new Buffer()', suggestion: 'Use Buffer.from() or Buffer.alloc()' },
      { pattern: /\.trimLeft\(\)|\.trimRight\(\)/g, api: 'trimLeft/trimRight', suggestion: 'Use trimStart/trimEnd' },
    ];

    for (const { pattern, api, suggestion } of patterns) {
      if (pattern.test(content)) {
        deprecated.push({ file: filePath, api, suggestion });
      }
    }

    return deprecated;
  }

  private classifyModule(modulePath: string): ModuleInfo['kind'] {
    const lowerPath = modulePath.toLowerCase();

    if (lowerPath.includes('command') || lowerPath.includes('cmd')) return 'command';
    if (lowerPath.includes('component') || /\.tsx$/.test(modulePath)) return 'component';
    if (lowerPath.includes('util') || lowerPath.includes('helper')) return 'util';
    if (lowerPath.includes('service')) return 'service';
    if (lowerPath.includes('schema') || lowerPath.includes('validator')) return 'schema';
    if (lowerPath.includes('adapter') || lowerPath.includes('provider')) return 'adapter';
    if (lowerPath.includes('domain') || lowerPath.includes('model') || lowerPath.includes('entity')) return 'domain';
    if (lowerPath.includes('config') || lowerPath.includes('constant')) return 'config';
    if (lowerPath.includes('type') || lowerPath.includes('interface')) return 'type';
    if (this.isTestFile(modulePath)) return 'test';

    return 'other';
  }

  private isPublicModule(modulePath: string): boolean {
    // Index files are typically public
    if (/index\.[jt]sx?$/.test(modulePath)) return true;

    // Files in root of src are typically public
    const parts = modulePath.split(path.sep);
    if (parts.length <= 2) return true;

    return false;
  }

  private resolveImport(importPath: string, fromModule: string): string | null {
    // Skip external packages
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
      return null;
    }

    // Resolve relative path
    const fromDir = path.dirname(fromModule);
    let resolved = importPath.startsWith('@/')
      ? importPath.replace('@/', `${this.sourceDir}/`)
      : path.join(fromDir, importPath);

    // Normalize and add extension if needed
    resolved = resolved.replace(/\.[jt]sx?$/, '');

    // Try common extensions
    for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
      const withExt = resolved + ext;
      const fullPath = path.join(this.projectRoot, withExt);
      if (fs.existsSync(fullPath)) {
        return withExt;
      }
    }

    return resolved;
  }

  private getImportType(importPath: string): DependencyEdge['type'] {
    if (importPath.includes('type') || /^import\s+type/.test(importPath)) {
      return 'type-only';
    }
    return 'static';
  }

  private findCircularDependencies(graph: DependencyEdge[]): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();
    const currentPath: string[] = [];

    const adjacency = new Map<string, string[]>();
    for (const edge of graph) {
      if (!adjacency.has(edge.from)) {
        adjacency.set(edge.from, []);
      }
      adjacency.get(edge.from)!.push(edge.to);
    }

    const dfs = (node: string): void => {
      if (stack.has(node)) {
        // Found cycle
        const cycleStart = currentPath.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push([...currentPath.slice(cycleStart), node]);
        }
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      stack.add(node);
      currentPath.push(node);

      const neighbors = adjacency.get(node) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }

      stack.delete(node);
      currentPath.pop();
    };

    for (const node of adjacency.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    // Limit to 10 cycles max
    return cycles.slice(0, 10);
  }

  private detectHotspots(
    modules: ModuleInfo[],
    fanIn: Map<string, number>,
    fanOut: Map<string, number>
  ): Array<{ file: string; reason: string; score: number }> {
    const hotspots: Array<{ file: string; reason: string; score: number }> = [];

    for (const mod of modules) {
      let score = 0;
      const reasons: string[] = [];

      // High LOC
      if (mod.loc > 500) {
        score += 30;
        reasons.push('large file');
      } else if (mod.loc > 300) {
        score += 15;
        reasons.push('medium-large file');
      }

      // High fan-out (too many dependencies)
      const out = fanOut.get(mod.path) || 0;
      if (out > 15) {
        score += 25;
        reasons.push('high fan-out');
      } else if (out > 10) {
        score += 10;
        reasons.push('medium fan-out');
      }

      // High fan-in (many dependents - risky to change)
      const inCount = fanIn.get(mod.path) || 0;
      if (inCount > 10) {
        score += 20;
        reasons.push('high fan-in');
      }

      // Many functions (might need splitting)
      if (mod.functionCount > 20) {
        score += 15;
        reasons.push('many functions');
      }

      if (score >= 30) {
        hotspots.push({
          file: mod.path,
          reason: reasons.join(', '),
          score,
        });
      }
    }

    return hotspots.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  private detectArchitecturePattern(modules: ModuleInfo[]): ArchitectureAnalysis['pattern'] {
    const kinds = new Map<string, number>();
    for (const mod of modules) {
      kinds.set(mod.kind, (kinds.get(mod.kind) || 0) + 1);
    }

    // Check for layered architecture
    const hasCommands = (kinds.get('command') || 0) > 0;
    const hasServices = (kinds.get('service') || 0) > 0;
    const hasDomain = (kinds.get('domain') || 0) > 0;
    const hasAdapters = (kinds.get('adapter') || 0) > 0;

    if (hasAdapters && hasDomain && hasServices) {
      return 'hexagonal';
    }

    if (hasCommands && hasServices && (kinds.get('component') || 0) === 0) {
      return 'layered';
    }

    if ((kinds.get('component') || 0) > 5) {
      return 'mvc';
    }

    if (hasCommands || hasAdapters) {
      return 'plugin-based';
    }

    return 'unknown';
  }

  private detectLayers(modules: ModuleInfo[]): ArchitectureAnalysis['layers'] {
    const layers: ArchitectureAnalysis['layers'] = [];

    const kindGroups = new Map<string, string[]>();
    for (const mod of modules) {
      if (!kindGroups.has(mod.kind)) {
        kindGroups.set(mod.kind, []);
      }
      kindGroups.get(mod.kind)!.push(mod.path);
    }

    const layerMap: Record<string, { name: string; pattern: string }> = {
      command: { name: 'Commands', pattern: '**/commands/**' },
      component: { name: 'UI Components', pattern: '**/components/**' },
      service: { name: 'Services', pattern: '**/services/**' },
      domain: { name: 'Domain', pattern: '**/domain/**' },
      adapter: { name: 'Adapters', pattern: '**/adapters/**' },
      util: { name: 'Utilities', pattern: '**/utils/**' },
      schema: { name: 'Schemas', pattern: '**/schemas/**' },
    };

    for (const [kind, modules] of kindGroups) {
      const mapping = layerMap[kind];
      if (mapping && modules.length > 0) {
        layers.push({
          name: mapping.name,
          pattern: mapping.pattern,
          modules: modules.slice(0, 20), // Limit for readability
        });
      }
    }

    return layers.length > 0 ? layers : undefined;
  }

  private extractPublicApi(
    modules: ModuleInfo[],
    moduleExports: Map<string, string[]>
  ): ArchitectureAnalysis['publicApi'] {
    const publicApi: ArchitectureAnalysis['publicApi'] = [];

    for (const mod of modules) {
      if (!mod.isPublic) continue;

      const exports = moduleExports.get(mod.path) || [];
      if (exports.length === 0) continue;

      // Determine export type (simplified)
      const type = exports.some(e => /^[A-Z]/.test(e) && !/^[A-Z_]+$/.test(e))
        ? 'class'
        : 'function';

      publicApi.push({
        module: mod.path,
        exports: exports.slice(0, 20),
        type,
      });
    }

    return publicApi.slice(0, 30);
  }

  private findEntryPoints(): ArchitectureAnalysis['entryPoints'] {
    const entryPoints: ArchitectureAnalysis['entryPoints'] = [];

    // Check package.json for bin entries
    const pkgPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

        if (pkg.bin) {
          const bins = typeof pkg.bin === 'string'
            ? { [pkg.name]: pkg.bin }
            : pkg.bin;

          for (const [name, binPath] of Object.entries(bins)) {
            entryPoints.push({
              path: binPath as string,
              type: 'cli',
              description: `CLI command: ${name}`,
            });
          }
        }

        if (pkg.main) {
          entryPoints.push({
            path: pkg.main,
            type: 'library',
            description: 'Main entry point',
          });
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Check for common entry patterns
    const commonEntries = [
      { path: 'src/index.ts', type: 'library' as const },
      { path: 'src/main.ts', type: 'script' as const },
      { path: 'src/server.ts', type: 'http' as const },
      { path: 'src/app.ts', type: 'http' as const },
      { path: 'src/worker.ts', type: 'worker' as const },
    ];

    for (const entry of commonEntries) {
      const fullPath = path.join(this.projectRoot, entry.path);
      if (fs.existsSync(fullPath) && !entryPoints.some(e => e.path === entry.path)) {
        entryPoints.push({ ...entry });
      }
    }

    return entryPoints;
  }

  private findExtensionPoints(modules: ModuleInfo[]): ArchitectureAnalysis['extensionPoints'] {
    const extensionPoints: ArchitectureAnalysis['extensionPoints'] = [];

    for (const mod of modules) {
      const lowerPath = mod.path.toLowerCase();

      if (lowerPath.includes('plugin')) {
        extensionPoints.push({ kind: 'plugin', path: mod.path });
      }
      if (lowerPath.includes('provider')) {
        extensionPoints.push({ kind: 'provider', path: mod.path });
      }
      if (lowerPath.includes('hook')) {
        extensionPoints.push({ kind: 'hook', path: mod.path });
      }
      if (lowerPath.includes('middleware')) {
        extensionPoints.push({ kind: 'middleware', path: mod.path });
      }
    }

    return extensionPoints.length > 0 ? extensionPoints.slice(0, 20) : undefined;
  }
}
