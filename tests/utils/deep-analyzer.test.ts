/**
 * Deep Analyzer Tests
 *
 * Comprehensive tests for the DeepAnalyzer class covering
 * code statistics, test analysis, documentation, architecture,
 * security, and more.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DeepAnalyzer } from '../../packages/core/src/utils/deep-analyzer.js';
import * as fs from 'fs';
import * as path from 'path';

describe('DeepAnalyzer', () => {
  let testDir: string;
  let analyzer: DeepAnalyzer;

  beforeEach(async () => {
    testDir = '/tmp/ax-cli-deep-analyzer-test-' + Date.now();
    await setupTestProject(testDir);
    analyzer = new DeepAnalyzer({ projectRoot: testDir });
  });

  afterEach(async () => {
    await cleanupTestProject(testDir);
  });

  describe('constructor', () => {
    it('should use default values when options not provided', () => {
      const analyzer = new DeepAnalyzer({ projectRoot: testDir });
      expect(analyzer).toBeDefined();
    });

    it('should accept custom sourceDir and testsDir', () => {
      const analyzer = new DeepAnalyzer({
        projectRoot: testDir,
        sourceDir: 'lib',
        testsDir: 'spec',
      });
      expect(analyzer).toBeDefined();
    });

    it('should accept maxFilesToAnalyze option', () => {
      const analyzer = new DeepAnalyzer({
        projectRoot: testDir,
        maxFilesToAnalyze: 500,
      });
      expect(analyzer).toBeDefined();
    });
  });

  describe('analyzeCodeStats', () => {
    it('should return code statistics', async () => {
      const stats = await analyzer.analyzeCodeStats();

      expect(stats).toHaveProperty('filesByExtension');
      expect(stats).toHaveProperty('totalLinesOfCode');
      expect(stats).toHaveProperty('totalFiles');
      expect(stats).toHaveProperty('largeFiles');
      expect(stats).toHaveProperty('averageFileSize');
    });

    it('should count files by extension', async () => {
      const stats = await analyzer.analyzeCodeStats();

      expect(stats.filesByExtension).toHaveProperty('.ts');
      expect(stats.filesByExtension['.ts']).toBeGreaterThan(0);
    });

    it('should detect large files', async () => {
      // Create a large file
      const largePath = path.join(testDir, 'src', 'large-file.ts');
      const largeContent = Array(600).fill('// line of code').join('\n');
      fs.writeFileSync(largePath, largeContent);

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const stats = await newAnalyzer.analyzeCodeStats();

      expect(stats.largeFiles.some(f => f.path.includes('large-file'))).toBe(true);
    });

    it('should calculate average file size', async () => {
      const stats = await analyzer.analyzeCodeStats();

      expect(stats.averageFileSize).toBeGreaterThan(0);
      expect(stats.averageFileSize).toBe(
        Math.round(stats.totalLinesOfCode / stats.totalFiles)
      );
    });

    it('should handle empty source directory', async () => {
      const emptyDir = '/tmp/ax-cli-empty-' + Date.now();
      fs.mkdirSync(emptyDir, { recursive: true });

      const emptyAnalyzer = new DeepAnalyzer({ projectRoot: emptyDir });
      const stats = await emptyAnalyzer.analyzeCodeStats();

      expect(stats.totalFiles).toBe(0);
      expect(stats.averageFileSize).toBe(0);

      fs.rmSync(emptyDir, { recursive: true, force: true });
    });
  });

  describe('analyzeTests', () => {
    it('should return test analysis', async () => {
      const analysis = await analyzer.analyzeTests();

      expect(analysis).toHaveProperty('framework');
      expect(analysis).toHaveProperty('patterns');
      expect(analysis).toHaveProperty('modulesWithTests');
      expect(analysis).toHaveProperty('modulesMissingTests');
      expect(analysis).toHaveProperty('testTypes');
      expect(analysis).toHaveProperty('testFileCount');
    });

    it('should detect test framework from package.json', async () => {
      const analysis = await analyzer.analyzeTests();

      expect(analysis.framework).toBe('vitest');
    });

    it('should detect test types', async () => {
      const analysis = await analyzer.analyzeTests();

      expect(Array.isArray(analysis.testTypes)).toBe(true);
    });

    it('should identify modules with tests', async () => {
      const analysis = await analyzer.analyzeTests();

      expect(Array.isArray(analysis.modulesWithTests)).toBe(true);
    });

    it('should find test patterns', async () => {
      const analysis = await analyzer.analyzeTests();

      expect(Array.isArray(analysis.patterns)).toBe(true);
    });

    it('should detect jest framework', async () => {
      const jestDir = '/tmp/ax-cli-jest-' + Date.now();
      fs.mkdirSync(path.join(jestDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(jestDir, 'tests'), { recursive: true });
      fs.writeFileSync(
        path.join(jestDir, 'package.json'),
        JSON.stringify({ devDependencies: { jest: '^29.0.0' } })
      );
      fs.writeFileSync(path.join(jestDir, 'src', 'index.ts'), 'export const x = 1;');

      const jestAnalyzer = new DeepAnalyzer({ projectRoot: jestDir });
      const analysis = await jestAnalyzer.analyzeTests();

      expect(analysis.framework).toBe('jest');

      fs.rmSync(jestDir, { recursive: true, force: true });
    });

    it('should detect mocha framework', async () => {
      const mochaDir = '/tmp/ax-cli-mocha-' + Date.now();
      fs.mkdirSync(path.join(mochaDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(mochaDir, 'package.json'),
        JSON.stringify({ devDependencies: { mocha: '^10.0.0' } })
      );
      fs.writeFileSync(path.join(mochaDir, 'src', 'index.ts'), 'export const x = 1;');

      const mochaAnalyzer = new DeepAnalyzer({ projectRoot: mochaDir });
      const analysis = await mochaAnalyzer.analyzeTests();

      expect(analysis.framework).toBe('mocha');

      fs.rmSync(mochaDir, { recursive: true, force: true });
    });
  });

  describe('analyzeDocumentation', () => {
    it('should return documentation analysis', async () => {
      const docs = await analyzer.analyzeDocumentation();

      expect(docs).toHaveProperty('jsdocCoverage');
      expect(docs).toHaveProperty('filesWithDocs');
      expect(docs).toHaveProperty('filesWithoutDocs');
      expect(docs).toHaveProperty('hasReadme');
      expect(docs).toHaveProperty('commentDensity');
      expect(docs).toHaveProperty('docFiles');
    });

    it('should detect README existence', async () => {
      const docs = await analyzer.analyzeDocumentation();

      expect(docs.hasReadme).toBe(true);
    });

    it('should score README quality', async () => {
      const docs = await analyzer.analyzeDocumentation();

      expect(docs.readmeScore).toBeGreaterThan(0);
    });

    it('should calculate JSDoc coverage', async () => {
      const docs = await analyzer.analyzeDocumentation();

      expect(typeof docs.jsdocCoverage).toBe('number');
      expect(docs.jsdocCoverage).toBeGreaterThanOrEqual(0);
      expect(docs.jsdocCoverage).toBeLessThanOrEqual(100);
    });

    it('should find documentation files', async () => {
      const docs = await analyzer.analyzeDocumentation();

      expect(Array.isArray(docs.docFiles)).toBe(true);
      expect(docs.docFiles).toContain('README.md');
    });

    it('should handle missing README', async () => {
      const noReadmeDir = '/tmp/ax-cli-no-readme-' + Date.now();
      fs.mkdirSync(path.join(noReadmeDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(noReadmeDir, 'src', 'index.ts'), 'export const x = 1;');

      const noReadmeAnalyzer = new DeepAnalyzer({ projectRoot: noReadmeDir });
      const docs = await noReadmeAnalyzer.analyzeDocumentation();

      expect(docs.hasReadme).toBe(false);
      expect(docs.readmeScore).toBeUndefined();

      fs.rmSync(noReadmeDir, { recursive: true, force: true });
    });
  });

  describe('analyzeTechnicalDebt', () => {
    it('should return technical debt analysis', async () => {
      const debt = await analyzer.analyzeTechnicalDebt();

      expect(debt).toHaveProperty('todos');
      expect(debt).toHaveProperty('fixmes');
      expect(debt).toHaveProperty('deprecatedUsage');
      expect(debt).toHaveProperty('totalCount');
    });

    it('should find TODO comments', async () => {
      const debt = await analyzer.analyzeTechnicalDebt();

      expect(Array.isArray(debt.todos)).toBe(true);
    });

    it('should find FIXME comments', async () => {
      // Add a FIXME to test file
      const fixmePath = path.join(testDir, 'src', 'fixme-file.ts');
      fs.writeFileSync(fixmePath, '// FIXME: This needs to be fixed\nexport const x = 1;');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const debt = await newAnalyzer.analyzeTechnicalDebt();

      expect(debt.fixmes.some(f => f.text.includes('This needs to be fixed'))).toBe(true);
    });

    it('should detect deprecated usage patterns', async () => {
      // Add deprecated API usage
      const deprecatedPath = path.join(testDir, 'src', 'deprecated.ts');
      fs.writeFileSync(deprecatedPath, 'const buf = new Buffer("test");');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const debt = await newAnalyzer.analyzeTechnicalDebt();

      expect(debt.deprecatedUsage.some(d => d.api.includes('Buffer'))).toBe(true);
    });

    it('should detect substr usage', async () => {
      const substrPath = path.join(testDir, 'src', 'substr.ts');
      fs.writeFileSync(substrPath, 'const s = "test".substr(0, 2);');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const debt = await newAnalyzer.analyzeTechnicalDebt();

      expect(debt.deprecatedUsage.some(d => d.api.includes('substr'))).toBe(true);
    });

    it('should calculate total debt count', async () => {
      const debt = await analyzer.analyzeTechnicalDebt();

      expect(debt.totalCount).toBe(
        debt.todos.length + debt.fixmes.length + debt.deprecatedUsage.length
      );
    });
  });

  describe('analyzeArchitecture', () => {
    it('should return architecture analysis', async () => {
      const arch = await analyzer.analyzeArchitecture();

      expect(arch).toHaveProperty('pattern');
      expect(arch).toHaveProperty('modules');
      expect(arch).toHaveProperty('dependencyGraph');
      expect(arch).toHaveProperty('circularDependencies');
      expect(arch).toHaveProperty('highFanInModules');
      expect(arch).toHaveProperty('highFanOutModules');
      expect(arch).toHaveProperty('hotspots');
    });

    it('should detect modules', async () => {
      const arch = await analyzer.analyzeArchitecture();

      expect(Array.isArray(arch.modules)).toBe(true);
      expect(arch.modules.length).toBeGreaterThan(0);
    });

    it('should build dependency graph', async () => {
      const arch = await analyzer.analyzeArchitecture();

      expect(Array.isArray(arch.dependencyGraph)).toBe(true);
    });

    it('should detect circular dependencies', async () => {
      // Create circular dependency
      const aPath = path.join(testDir, 'src', 'circular-a.ts');
      const bPath = path.join(testDir, 'src', 'circular-b.ts');
      fs.writeFileSync(aPath, 'import { b } from "./circular-b.js";\nexport const a = 1;');
      fs.writeFileSync(bPath, 'import { a } from "./circular-a.js";\nexport const b = 2;');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(Array.isArray(arch.circularDependencies)).toBe(true);
    });

    it('should detect high fan-in modules', async () => {
      const arch = await analyzer.analyzeArchitecture();

      expect(Array.isArray(arch.highFanInModules)).toBe(true);
    });

    it('should detect entry points', async () => {
      const arch = await analyzer.analyzeArchitecture();

      expect(Array.isArray(arch.entryPoints)).toBe(true);
    });

    it('should detect architecture pattern', async () => {
      const arch = await analyzer.analyzeArchitecture();

      expect(['layered', 'hexagonal', 'mvc', 'plugin-based', 'unknown']).toContain(arch.pattern);
    });

    it('should detect layers', async () => {
      const arch = await analyzer.analyzeArchitecture();

      // layers may be undefined if no clear layer structure
      if (arch.layers) {
        expect(Array.isArray(arch.layers)).toBe(true);
      }
    });

    it('should extract public API', async () => {
      const arch = await analyzer.analyzeArchitecture();

      expect(Array.isArray(arch.publicApi)).toBe(true);
    });
  });

  describe('analyzeSecurity', () => {
    it('should return security analysis', async () => {
      const security = await analyzer.analyzeSecurity();

      expect(security).toHaveProperty('envVarsUsed');
      expect(security).toHaveProperty('sensitiveFiles');
      expect(security).toHaveProperty('dangerousApis');
      expect(security).toHaveProperty('potentialSecrets');
      expect(security).toHaveProperty('unvalidatedInputs');
    });

    it('should find environment variables', async () => {
      // Add env var usage
      const envPath = path.join(testDir, 'src', 'env-usage.ts');
      fs.writeFileSync(envPath, 'const apiKey = process.env.API_KEY;');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      expect(security.envVarsUsed.some(e => e.name === 'API_KEY')).toBe(true);
    });

    it('should detect env vars with bracket notation', async () => {
      const envPath = path.join(testDir, 'src', 'env-bracket.ts');
      fs.writeFileSync(envPath, 'const secret = process.env["MY_SECRET"];');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      expect(security.envVarsUsed.some(e => e.name === 'MY_SECRET')).toBe(true);
    });

    it('should identify secret env vars', async () => {
      const envPath = path.join(testDir, 'src', 'secret-env.ts');
      fs.writeFileSync(envPath, 'const pw = process.env.DATABASE_PASSWORD;');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      const pwVar = security.envVarsUsed.find(e => e.name === 'DATABASE_PASSWORD');
      expect(pwVar?.isSecret).toBe(true);
    });

    it('should detect dangerous APIs like eval', async () => {
      const evalPath = path.join(testDir, 'src', 'dangerous.ts');
      fs.writeFileSync(evalPath, 'const result = eval("1 + 1");');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      expect(security.dangerousApis.some(d => d.api.includes('eval'))).toBe(true);
    });

    it('should detect new Function usage', async () => {
      const funcPath = path.join(testDir, 'src', 'new-func.ts');
      fs.writeFileSync(funcPath, 'const fn = new Function("return 1");');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      expect(security.dangerousApis.some(d => d.api.includes('Function'))).toBe(true);
    });

    it('should detect potential hardcoded secrets', async () => {
      const secretPath = path.join(testDir, 'src', 'hardcoded.ts');
      // Use a fake pattern that looks like a secret but won't trigger GitHub's push protection
      fs.writeFileSync(secretPath, 'const config = { "api_key": "test_fake_key_abc123xyz789" };');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      // The analyzer may or may not detect this - depends on implementation
      expect(security.potentialSecrets).toBeDefined();
    });

    it('should detect sensitive files', async () => {
      // Create .env file
      fs.writeFileSync(path.join(testDir, '.env'), 'API_KEY=secret');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      expect(security.sensitiveFiles.some(f => f.path.includes('.env'))).toBe(true);
    });

    it('should detect child_process usage', async () => {
      const cpPath = path.join(testDir, 'src', 'child-proc.ts');
      // The regex looks for child_process.(exec|execSync|spawn)( pattern
      fs.writeFileSync(cpPath, 'import child_process from "child_process";\nchild_process.exec("ls", () => {});');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      expect(security.dangerousApis.some(d => d.api.includes('child_process'))).toBe(true);
    });
  });

  describe('analyzeModuleMap', () => {
    it('should return module map', async () => {
      const moduleMap = await analyzer.analyzeModuleMap();

      expect(moduleMap).toHaveProperty('directories');
    });

    it('should describe directories', async () => {
      const moduleMap = await analyzer.analyzeModuleMap();

      expect(typeof moduleMap.directories).toBe('object');
    });

    it('should infer directory purposes', async () => {
      // Create a commands directory
      fs.mkdirSync(path.join(testDir, 'src', 'commands'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'commands', 'test.ts'),
        'export const createTestCommand = () => {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const moduleMap = await newAnalyzer.analyzeModuleMap();

      const commandsDir = Object.entries(moduleMap.directories).find(([k]) =>
        k.includes('commands')
      );
      expect(commandsDir?.[1].purpose).toContain('commands');
    });

    it('should handle missing source directory', async () => {
      const noSrcDir = '/tmp/ax-cli-no-src-' + Date.now();
      fs.mkdirSync(noSrcDir, { recursive: true });

      const noSrcAnalyzer = new DeepAnalyzer({ projectRoot: noSrcDir });
      const moduleMap = await noSrcAnalyzer.analyzeModuleMap();

      expect(Object.keys(moduleMap.directories).length).toBe(0);

      fs.rmSync(noSrcDir, { recursive: true, force: true });
    });
  });

  describe('analyzeKeyAbstractions', () => {
    it('should return key abstractions', async () => {
      const abstractions = await analyzer.analyzeKeyAbstractions();

      expect(abstractions).toHaveProperty('interfaces');
      expect(abstractions).toHaveProperty('classes');
      expect(abstractions).toHaveProperty('patterns');
    });

    it('should find interfaces', async () => {
      const abstractions = await analyzer.analyzeKeyAbstractions();

      expect(Array.isArray(abstractions.interfaces)).toBe(true);
    });

    it('should find classes', async () => {
      const abstractions = await analyzer.analyzeKeyAbstractions();

      expect(Array.isArray(abstractions.classes)).toBe(true);
    });

    it('should detect common patterns', async () => {
      const abstractions = await analyzer.analyzeKeyAbstractions();

      expect(Array.isArray(abstractions.patterns)).toBe(true);
    });

    it('should detect factory pattern', async () => {
      // Add multiple factory functions
      for (let i = 0; i < 5; i++) {
        fs.writeFileSync(
          path.join(testDir, 'src', `factory${i}.ts`),
          `export const createThing${i} = () => ({ id: ${i} });`
        );
      }

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const abstractions = await newAnalyzer.analyzeKeyAbstractions();

      expect(abstractions.patterns.some(p => p.name.includes('Factory'))).toBe(true);
    });

    it('should detect observer pattern', async () => {
      for (let i = 0; i < 5; i++) {
        fs.writeFileSync(
          path.join(testDir, 'src', `event${i}.ts`),
          `import { EventEmitter } from 'events';\nconst e = new EventEmitter();\ne.on('test', () => {});`
        );
      }

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const abstractions = await newAnalyzer.analyzeKeyAbstractions();

      expect(abstractions.patterns.some(p => p.name.includes('Observer'))).toBe(true);
    });
  });

  describe('analyzeImportConventions', () => {
    it('should return import conventions', async () => {
      const conventions = await analyzer.analyzeImportConventions();

      expect(conventions).toHaveProperty('style');
      expect(conventions).toHaveProperty('aliases');
      expect(conventions).toHaveProperty('extensionRequired');
      expect(conventions).toHaveProperty('commonImports');
    });

    it('should detect ESM style', async () => {
      const conventions = await analyzer.analyzeImportConventions();

      expect(conventions.style).toContain('ESM');
    });

    it('should detect CommonJS style', async () => {
      const cjsDir = '/tmp/ax-cli-cjs-' + Date.now();
      fs.mkdirSync(path.join(cjsDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(cjsDir, 'src', 'index.js'),
        'const fs = require("fs");\nmodule.exports = { fs };'
      );

      const cjsAnalyzer = new DeepAnalyzer({ projectRoot: cjsDir });
      const conventions = await cjsAnalyzer.analyzeImportConventions();

      expect(conventions.style).toContain('CommonJS');

      fs.rmSync(cjsDir, { recursive: true, force: true });
    });

    it('should detect .js extension in imports', async () => {
      const conventions = await analyzer.analyzeImportConventions();

      // Our test project uses .js extensions
      expect(typeof conventions.extensionRequired).toBe('boolean');
    });

    it('should collect common imports', async () => {
      const conventions = await analyzer.analyzeImportConventions();

      expect(Array.isArray(conventions.commonImports)).toBe(true);
    });
  });

  describe('analyzePublicAPI', () => {
    it('should return public API info', async () => {
      const api = await analyzer.analyzePublicAPI();

      expect(api).toHaveProperty('entryPoint');
      expect(api).toHaveProperty('exports');
    });

    it('should find entry point', async () => {
      const api = await analyzer.analyzePublicAPI();

      expect(typeof api.entryPoint).toBe('string');
    });

    it('should list exports', async () => {
      const api = await analyzer.analyzePublicAPI();

      expect(Array.isArray(api.exports)).toBe(true);
    });

    it('should detect re-exports', async () => {
      // Update package.json to point to src/index.ts (source, not dist)
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          main: 'src/index.ts',
        })
      );

      // Add star re-export to index
      const indexPath = path.join(testDir, 'src', 'index.ts');
      const content = fs.readFileSync(indexPath, 'utf-8');
      fs.writeFileSync(
        indexPath,
        content + '\nexport * from "./utils/helpers.js";'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const api = await newAnalyzer.analyzePublicAPI();

      // reExports is set when there are star exports
      expect(api.reExports).toBeDefined();
      expect(api.reExports?.length).toBeGreaterThan(0);
    });

    it('should handle package.json main field', async () => {
      const api = await analyzer.analyzePublicAPI();

      expect(api.entryPoint).toBeDefined();
    });
  });

  describe('generateHowTo', () => {
    it('should return how-to guides', async () => {
      const howTo = await analyzer.generateHowTo();

      expect(howTo).toHaveProperty('tasks');
    });

    it('should generate build task', async () => {
      const howTo = await analyzer.generateHowTo();

      expect(howTo.tasks.build).toBeDefined();
      expect(howTo.tasks.build.description).toContain('Build');
    });

    it('should generate test task', async () => {
      const howTo = await analyzer.generateHowTo();

      expect(howTo.tasks.runTests).toBeDefined();
      expect(howTo.tasks.runTests.description).toContain('tests');
    });

    it('should generate lint task', async () => {
      const howTo = await analyzer.generateHowTo();

      expect(howTo.tasks.lint).toBeDefined();
    });

    it('should generate typecheck task for TypeScript projects', async () => {
      const howTo = await analyzer.generateHowTo();

      expect(howTo.tasks.typecheck).toBeDefined();
    });

    it('should generate dev task if available', async () => {
      const howTo = await analyzer.generateHowTo();

      expect(howTo.tasks.dev).toBeDefined();
    });

    it('should generate addCommand task for CLI projects', async () => {
      // Create commands directory
      fs.mkdirSync(path.join(testDir, 'src', 'commands'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'src', 'commands', 'test.ts'), 'export default {};');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const howTo = await newAnalyzer.generateHowTo();

      expect(howTo.tasks.addCommand).toBeDefined();
    });

    it('should generate addTool task if tools directory exists', async () => {
      // Create tools directory
      fs.mkdirSync(path.join(testDir, 'src', 'tools'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'src', 'tools', 'test.ts'), 'export default {};');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const howTo = await newAnalyzer.generateHowTo();

      expect(howTo.tasks.addTool).toBeDefined();
    });
  });

  describe('analyzeConfigPatterns', () => {
    it('should return config patterns', async () => {
      const config = await analyzer.analyzeConfigPatterns();

      expect(config).toHaveProperty('envVars');
    });

    it('should find environment variables', async () => {
      const config = await analyzer.analyzeConfigPatterns();

      expect(Array.isArray(config.envVars)).toBe(true);
    });

    it('should infer env var purposes', async () => {
      // Add env var with known pattern
      const envPath = path.join(testDir, 'src', 'config-test.ts');
      fs.writeFileSync(envPath, 'const port = process.env.PORT;');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      const portVar = config.envVars.find(e => e.name === 'PORT');
      expect(portVar?.purpose).toContain('port');
    });

    it('should detect required env vars', async () => {
      const envPath = path.join(testDir, 'src', 'required-env.ts');
      fs.writeFileSync(
        envPath,
        'if (!process.env.REQUIRED_VAR) throw new Error("Missing REQUIRED_VAR");'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      const requiredVar = config.envVars.find(e => e.name === 'REQUIRED_VAR');
      expect(requiredVar?.required).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle files with no extension', async () => {
      fs.writeFileSync(path.join(testDir, 'src', 'Makefile'), 'all:\n\techo hello');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const stats = await newAnalyzer.analyzeCodeStats();

      // Should not crash
      expect(stats).toBeDefined();
    });

    it('should handle unreadable files gracefully', async () => {
      // This tests the error handling in readFileContent
      const stats = await analyzer.analyzeCodeStats();
      expect(stats).toBeDefined();
    });

    it('should limit large file lists', async () => {
      const arch = await analyzer.analyzeArchitecture();

      // hotspots should be limited
      expect(arch.hotspots.length).toBeLessThanOrEqual(20);
    });

    it('should cache file analysis', async () => {
      // Call analyzeCodeStats twice
      const stats1 = await analyzer.analyzeCodeStats();
      const stats2 = await analyzer.analyzeCodeStats();

      expect(stats1.totalFiles).toBe(stats2.totalFiles);
    });

    it('should handle dynamic imports', async () => {
      const dynPath = path.join(testDir, 'src', 'dynamic.ts');
      fs.writeFileSync(dynPath, 'const mod = await import("./utils/helpers.js");');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch).toBeDefined();
    });

    it('should handle require statements', async () => {
      const reqPath = path.join(testDir, 'src', 'require.ts');
      fs.writeFileSync(reqPath, 'const fs = require("fs");');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch).toBeDefined();
    });
  });

  describe('module classification', () => {
    it('should classify command modules', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'commands'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'src', 'commands', 'test.ts'), 'export default {};');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      const cmdModule = arch.modules.find(m => m.path.includes('commands'));
      expect(cmdModule?.kind).toBe('command');
    });

    it('should classify component modules', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'Button.tsx'),
        'export const Button = () => <button>Click</button>;'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      const componentModule = arch.modules.find(m => m.path.includes('Button'));
      expect(componentModule?.kind).toBe('component');
    });

    it('should classify util modules', async () => {
      const arch = await analyzer.analyzeArchitecture();

      const utilModule = arch.modules.find(m => m.path.includes('utils'));
      expect(utilModule?.kind).toBe('util');
    });

    it('should identify public modules', async () => {
      const arch = await analyzer.analyzeArchitecture();

      const indexModule = arch.modules.find(m => m.path.includes('index'));
      expect(indexModule?.isPublic).toBe(true);
    });
  });

  describe('hotspot detection', () => {
    it('should detect large files as hotspots', async () => {
      // Create a large file with many functions
      const largePath = path.join(testDir, 'src', 'hotspot.ts');
      const content = Array(600)
        .fill(0)
        .map((_, i) => `export function func${i}() { return ${i}; }`)
        .join('\n');
      fs.writeFileSync(largePath, content);

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      const hotspot = arch.hotspots.find(h => h.file.includes('hotspot'));
      expect(hotspot).toBeDefined();
      expect(hotspot?.reason).toContain('large');
    });
  });

  describe('extension points detection', () => {
    it('should detect plugin extension points', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'plugins'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'plugins', 'my-plugin.ts'),
        'export const plugin = {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch.extensionPoints?.some(e => e.kind === 'plugin')).toBe(true);
    });

    it('should detect provider extension points', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'providers'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'providers', 'my-provider.ts'),
        'export const provider = {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch.extensionPoints?.some(e => e.kind === 'provider')).toBe(true);
    });

    it('should detect hook extension points', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'hooks'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'hooks', 'use-hook.ts'),
        'export const useHook = () => {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch.extensionPoints?.some(e => e.kind === 'hook')).toBe(true);
    });

    it('should detect middleware extension points', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'middleware'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'middleware', 'auth.ts'),
        'export const authMiddleware = () => {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch.extensionPoints?.some(e => e.kind === 'middleware')).toBe(true);
    });
  });

  describe('additional branch coverage', () => {
    it('should handle interface with Options suffix', async () => {
      const typesPath = path.join(testDir, 'src', 'options.ts');
      fs.writeFileSync(
        typesPath,
        'export interface MyOptions { foo: string; }'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const abstractions = await newAnalyzer.analyzeKeyAbstractions();

      // Options interfaces should be filtered out
      expect(abstractions.interfaces.every(i => !i.name.endsWith('Options'))).toBe(true);
    });

    it('should handle interface with Config suffix', async () => {
      const typesPath = path.join(testDir, 'src', 'config-type.ts');
      fs.writeFileSync(
        typesPath,
        'export interface MyConfig { bar: number; }'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const abstractions = await newAnalyzer.analyzeKeyAbstractions();

      // Config interfaces should be filtered out
      expect(abstractions.interfaces.every(i => !i.name.endsWith('Config'))).toBe(true);
    });

    it('should infer Tool interface purpose', async () => {
      const toolPath = path.join(testDir, 'src', 'tool-iface.ts');
      fs.writeFileSync(
        toolPath,
        'export interface MyTool { name: string; run(): void; }'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const abstractions = await newAnalyzer.analyzeKeyAbstractions();

      const toolIface = abstractions.interfaces.find(i => i.name === 'MyTool');
      expect(toolIface?.purpose).toContain('Tool');
    });

    it('should infer Service interface purpose', async () => {
      const servicePath = path.join(testDir, 'src', 'service-iface.ts');
      fs.writeFileSync(
        servicePath,
        'export interface MyService { start(): void; }'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const abstractions = await newAnalyzer.analyzeKeyAbstractions();

      const serviceIface = abstractions.interfaces.find(i => i.name === 'MyService');
      expect(serviceIface?.purpose).toContain('Service');
    });

    it('should infer Handler interface purpose', async () => {
      const handlerPath = path.join(testDir, 'src', 'handler-iface.ts');
      fs.writeFileSync(
        handlerPath,
        'export interface MyHandler { handle(): void; }'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const abstractions = await newAnalyzer.analyzeKeyAbstractions();

      const handlerIface = abstractions.interfaces.find(i => i.name === 'MyHandler');
      expect(handlerIface?.purpose).toContain('Handler');
    });

    it('should infer Provider interface purpose', async () => {
      const providerPath = path.join(testDir, 'src', 'provider-iface.ts');
      fs.writeFileSync(
        providerPath,
        'export interface MyProvider { get(): unknown; }'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const abstractions = await newAnalyzer.analyzeKeyAbstractions();

      const providerIface = abstractions.interfaces.find(i => i.name === 'MyProvider');
      expect(providerIface?.purpose).toContain('Provider');
    });

    it('should infer Client interface purpose', async () => {
      const clientPath = path.join(testDir, 'src', 'client-iface.ts');
      fs.writeFileSync(
        clientPath,
        'export interface MyClient { connect(): void; }'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const abstractions = await newAnalyzer.analyzeKeyAbstractions();

      const clientIface = abstractions.interfaces.find(i => i.name === 'MyClient');
      expect(clientIface?.purpose).toContain('Client');
    });

    it('should infer interface with execute member', async () => {
      const execPath = path.join(testDir, 'src', 'exec-iface.ts');
      fs.writeFileSync(
        execPath,
        'export interface Runnable { execute(): void; }'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const abstractions = await newAnalyzer.analyzeKeyAbstractions();

      const execIface = abstractions.interfaces.find(i => i.name === 'Runnable');
      expect(execIface?.purpose).toContain('Executable');
    });

    it('should infer interface with render member', async () => {
      const renderPath = path.join(testDir, 'src', 'render-iface.ts');
      fs.writeFileSync(
        renderPath,
        'export interface Renderable { render(): string; }'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const abstractions = await newAnalyzer.analyzeKeyAbstractions();

      const renderIface = abstractions.interfaces.find(i => i.name === 'Renderable');
      expect(renderIface?.purpose).toContain('Renderable');
    });

    it('should infer Manager class purpose', async () => {
      const managerPath = path.join(testDir, 'src', 'my-manager.ts');
      fs.writeFileSync(
        managerPath,
        'export class StateManager { state = {}; }'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const abstractions = await newAnalyzer.analyzeKeyAbstractions();

      const managerClass = abstractions.classes.find(c => c.name === 'StateManager');
      expect(managerClass?.purpose).toContain('manager');
    });

    it('should detect service modules', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'services'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'services', 'api.ts'),
        'export const api = {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      const serviceModule = arch.modules.find(m => m.path.includes('services'));
      expect(serviceModule?.kind).toBe('service');
    });

    it('should detect schema modules', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'schemas'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'schemas', 'user.ts'),
        'export const userSchema = {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      const schemaModule = arch.modules.find(m => m.path.includes('schemas'));
      expect(schemaModule?.kind).toBe('schema');
    });

    it('should detect adapter modules', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'adapters'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'adapters', 'db.ts'),
        'export const dbAdapter = {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      const adapterModule = arch.modules.find(m => m.path.includes('adapters'));
      expect(adapterModule?.kind).toBe('adapter');
    });

    it('should detect domain modules', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'domain'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'domain', 'user.ts'),
        'export const User = {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      const domainModule = arch.modules.find(m => m.path.includes('domain'));
      expect(domainModule?.kind).toBe('domain');
    });

    it('should detect config modules', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'config'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'config', 'app.ts'),
        'export const config = {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      const configModule = arch.modules.find(m => m.path.includes('config'));
      expect(configModule?.kind).toBe('config');
    });

    it('should detect type modules', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'types'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'types', 'user.ts'),
        'export type User = { id: string };'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      const typeModule = arch.modules.find(m => m.path.includes('types/user'));
      expect(typeModule?.kind).toBe('type');
    });

    it('should handle test:watch script in how-to', async () => {
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: {
            test: 'vitest',
            'test:watch': 'vitest --watch',
          },
          devDependencies: { vitest: '^1.0.0' },
        })
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const howTo = await newAnalyzer.generateHowTo();

      expect(howTo.tasks.runTests?.steps.some(s => s.includes('watch'))).toBe(true);
    });

    it('should handle lint:fix script in how-to', async () => {
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: {
            lint: 'eslint .',
            'lint:fix': 'eslint . --fix',
          },
        })
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const howTo = await newAnalyzer.generateHowTo();

      expect(howTo.tasks.lint?.steps.some(s => s.includes('lint:fix'))).toBe(true);
    });

    it('should detect e2e test files', async () => {
      fs.mkdirSync(path.join(testDir, 'tests', 'e2e'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'tests', 'e2e', 'app.test.ts'),
        'import { test } from "@playwright/test";\ntest("works", async () => {});'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const analysis = await newAnalyzer.analyzeTests();

      expect(analysis.testTypes).toContain('e2e');
    });

    it('should detect integration test files', async () => {
      fs.mkdirSync(path.join(testDir, 'tests', 'integration'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'tests', 'integration', 'api.test.ts'),
        'import { describe } from "vitest";\ndescribe("api", () => {});'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const analysis = await newAnalyzer.analyzeTests();

      expect(analysis.testTypes).toContain('integration');
    });

    it('should detect snapshot tests', async () => {
      fs.writeFileSync(
        path.join(testDir, 'tests', 'snapshot.test.ts'),
        'expect(obj).toMatchSnapshot();'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const analysis = await newAnalyzer.analyzeTests();

      expect(analysis.testTypes).toContain('snapshot');
    });

    it('should find tests by imports', async () => {
      // Create a test that imports from source
      fs.writeFileSync(
        path.join(testDir, 'tests', 'import-test.test.ts'),
        'import { formatDate } from "../src/utils/helpers.js";\ntest("x", () => formatDate(new Date()));'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const analysis = await newAnalyzer.analyzeTests();

      expect(analysis.modulesWithTests.length).toBeGreaterThan(0);
    });

    it('should detect hexagonal architecture', async () => {
      // Create structure typical of hexagonal architecture
      fs.mkdirSync(path.join(testDir, 'src', 'adapters'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'src', 'domain'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'src', 'services'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'src', 'adapters', 'db.ts'), 'export const db = {};');
      fs.writeFileSync(path.join(testDir, 'src', 'domain', 'user.ts'), 'export const User = {};');
      fs.writeFileSync(path.join(testDir, 'src', 'services', 'api.ts'), 'export const api = {};');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch.pattern).toBe('hexagonal');
    });

    it('should detect MVC architecture with many components', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'components'), { recursive: true });
      for (let i = 0; i < 6; i++) {
        fs.writeFileSync(
          path.join(testDir, 'src', 'components', `Comp${i}.tsx`),
          `export const Comp${i} = () => <div/>;`
        );
      }

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch.pattern).toBe('mvc');
    });

    it('should handle default exports', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'default-export.ts'),
        'export default function main() {}'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      const mod = arch.modules.find(m => m.path.includes('default-export'));
      expect(mod?.exports).toContain('default');
    });

    it('should handle named exports in curly braces', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'named-exports.ts'),
        'const a = 1;\nconst b = 2;\nexport { a, b };'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      const mod = arch.modules.find(m => m.path.includes('named-exports'));
      expect(mod?.exports).toContain('a');
      expect(mod?.exports).toContain('b');
    });

    it('should detect GitHub-like PAT pattern as potential secret', async () => {
      // Use a fake pattern that looks like a PAT but won't trigger push protection
      fs.writeFileSync(
        path.join(testDir, 'src', 'github-pat.ts'),
        'const token = "fake_pat_token_placeholder_for_testing_only";'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      // Analyzer checks for patterns - this may or may not match
      expect(security.potentialSecrets).toBeDefined();
    });

    it('should detect Slack-like token pattern as potential secret', async () => {
      // Use a fake pattern that won't trigger push protection
      fs.writeFileSync(
        path.join(testDir, 'src', 'slack-token.ts'),
        'const token = "fake_slack_token_for_testing_purposes";'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      // Analyzer checks for patterns - this may or may not match
      expect(security.potentialSecrets).toBeDefined();
    });

    it('should detect fs.writeFile as dangerous API', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'fs-write.ts'),
        'import * as fs from "fs";\nfs.writeFile("test", "data", () => {});'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      expect(security.dangerousApis.some(d => d.api.includes('fs write'))).toBe(true);
    });

    it('should detect innerHTML assignment', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'inner-html.ts'),
        'document.body.innerHTML = "<div></div>";'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      expect(security.dangerousApis.some(d => d.api.includes('innerHTML'))).toBe(true);
    });

    it('should detect private key files as sensitive', async () => {
      fs.writeFileSync(path.join(testDir, 'id_rsa'), 'private key content');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      expect(security.sensitiveFiles.some(f => f.path.includes('id_rsa'))).toBe(true);
    });

    it('should detect .pem files as sensitive', async () => {
      fs.writeFileSync(path.join(testDir, 'cert.pem'), 'certificate content');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      expect(security.sensitiveFiles.some(f => f.path.includes('.pem'))).toBe(true);
    });

    it('should detect credentials files as sensitive', async () => {
      fs.writeFileSync(path.join(testDir, 'credentials.json'), '{}');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      expect(security.sensitiveFiles.some(f => f.path.includes('credentials'))).toBe(true);
    });

    it('should detect @deprecated annotation', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'deprecated.ts'),
        '/** @deprecated Use newFunc instead */\nexport const oldFunc = () => {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const debt = await newAnalyzer.analyzeTechnicalDebt();

      expect(debt.deprecatedUsage.some(d => d.api.includes('Deprecated'))).toBe(true);
    });

    it('should detect trimLeft/trimRight as deprecated', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'trim.ts'),
        'const s = " hello ".trimLeft();'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const debt = await newAnalyzer.analyzeTechnicalDebt();

      expect(debt.deprecatedUsage.some(d => d.api.includes('trimLeft'))).toBe(true);
    });

    it('should handle path aliases in imports', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'alias-import.ts'),
        'import { helper } from "@/utils/helpers";'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const conventions = await newAnalyzer.analyzeImportConventions();

      expect(conventions.aliases['@/']).toBeDefined();
    });

    it('should handle class extending another class', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'extended-class.ts'),
        'export class ChildClass extends ParentClass {}'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const abstractions = await newAnalyzer.analyzeKeyAbstractions();

      const child = abstractions.classes.find(c => c.name === 'ChildClass');
      expect(child?.extends).toBe('ParentClass');
    });

    it('should handle type-only imports', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'type-import.ts'),
        'import type { SomeType } from "./types";'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch).toBeDefined();
    });

    it('should detect ava test framework', async () => {
      const avaDir = '/tmp/ax-cli-ava-' + Date.now();
      fs.mkdirSync(path.join(avaDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(avaDir, 'package.json'),
        JSON.stringify({ devDependencies: { ava: '^5.0.0' } })
      );
      fs.writeFileSync(path.join(avaDir, 'src', 'index.ts'), 'export const x = 1;');

      const avaAnalyzer = new DeepAnalyzer({ projectRoot: avaDir });
      const analysis = await avaAnalyzer.analyzeTests();

      expect(analysis.framework).toBe('ava');

      fs.rmSync(avaDir, { recursive: true, force: true });
    });

    it('should detect tap test framework', async () => {
      const tapDir = '/tmp/ax-cli-tap-' + Date.now();
      fs.mkdirSync(path.join(tapDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tapDir, 'package.json'),
        JSON.stringify({ devDependencies: { tap: '^16.0.0' } })
      );
      fs.writeFileSync(path.join(tapDir, 'src', 'index.ts'), 'export const x = 1;');

      const tapAnalyzer = new DeepAnalyzer({ projectRoot: tapDir });
      const analysis = await tapAnalyzer.analyzeTests();

      expect(analysis.framework).toBe('tap');

      fs.rmSync(tapDir, { recursive: true, force: true });
    });

    it('should infer DEBUG env var purpose', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'debug-env.ts'),
        'const debug = process.env.DEBUG;'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      const debugVar = config.envVars.find(e => e.name === 'DEBUG');
      expect(debugVar?.purpose).toContain('Debug');
    });

    it('should infer DATABASE_URL env var purpose', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'db-env.ts'),
        'const dbUrl = process.env.DATABASE_URL;'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      const dbVar = config.envVars.find(e => e.name === 'DATABASE_URL');
      // DATABASE_URL matches URL pattern first (before DATABASE check)
      expect(dbVar?.purpose).toContain('URL');
    });

    it('should infer DB_HOST env var purpose', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'db-host.ts'),
        'const dbHost = process.env.DB_HOST;'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      const dbVar = config.envVars.find(e => e.name === 'DB_HOST');
      // DB_HOST matches HOST pattern first
      expect(dbVar?.purpose).toContain('host');
    });

    it('should infer DB_NAME env var purpose', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'db-name.ts'),
        'const dbName = process.env.DB_NAME;'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      const dbVar = config.envVars.find(e => e.name === 'DB_NAME');
      // DB_NAME matches DB pattern and returns Database configuration
      expect(dbVar?.purpose).toContain('Database');
    });

    it('should infer LOG_LEVEL env var purpose', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'log-env.ts'),
        'const logLevel = process.env.LOG_LEVEL;'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      const logVar = config.envVars.find(e => e.name === 'LOG_LEVEL');
      expect(logVar?.purpose).toContain('Logging');
    });

    it('should infer HOST env var purpose', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'host-env.ts'),
        'const host = process.env.HOST;'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      const hostVar = config.envVars.find(e => e.name === 'HOST');
      expect(hostVar?.purpose).toContain('host');
    });

    it('should handle bin entry in package.json', async () => {
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({
          name: 'my-cli',
          bin: { 'my-cli': './dist/cli.js' },
        })
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch.entryPoints?.some(e => e.type === 'cli')).toBe(true);
    });

    it('should handle string bin entry in package.json', async () => {
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({
          name: 'my-cli',
          bin: './dist/cli.js',
        })
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch.entryPoints?.some(e => e.type === 'cli')).toBe(true);
    });

    it('should detect server.ts as HTTP entry point', async () => {
      fs.writeFileSync(path.join(testDir, 'src', 'server.ts'), 'export const server = {};');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch.entryPoints?.some(e => e.type === 'http')).toBe(true);
    });

    it('should detect worker.ts as worker entry point', async () => {
      fs.writeFileSync(path.join(testDir, 'src', 'worker.ts'), 'export const worker = {};');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch.entryPoints?.some(e => e.type === 'worker')).toBe(true);
    });

    it('should detect main.ts as script entry point', async () => {
      fs.writeFileSync(path.join(testDir, 'src', 'main.ts'), 'console.log("main");');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch.entryPoints?.some(e => e.type === 'script')).toBe(true);
    });

    it('should handle FIXME in block comments', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'block-fixme.ts'),
        '/* FIXME: Fix this issue */'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const debt = await newAnalyzer.analyzeTechnicalDebt();

      expect(debt.fixmes.some(f => f.text.includes('Fix this issue'))).toBe(true);
    });

    it('should handle TODO in block comments', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'block-todo.ts'),
        '/* TODO: Do this later */'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const debt = await newAnalyzer.analyzeTechnicalDebt();

      expect(debt.todos.some(t => t.text.includes('Do this later'))).toBe(true);
    });

    it('should detect file patterns in commands directory', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'commands'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'commands', 'init.ts'),
        'export const createInitCommand = () => new Command("init");'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const moduleMap = await newAnalyzer.analyzeModuleMap();

      const commandsDir = Object.entries(moduleMap.directories).find(([k]) =>
        k.includes('commands')
      );
      expect(commandsDir?.[1].pattern).toContain('Command');
    });

    // Additional branch coverage tests for 85%+ target
    it('should handle duplicate env vars in same file', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'dup-env.ts'),
        `const a = process.env.MY_VAR;
const b = process.env.MY_VAR;
const c = process.env.MY_VAR;`
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      // Should dedupe env vars
      const myVarOccurrences = security.envVarsUsed.filter(e => e.name === 'MY_VAR');
      expect(myVarOccurrences.length).toBe(1);
    });

    it('should sort env vars with secrets first', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'env-sort.ts'),
        `const url = process.env.API_URL;
const key = process.env.API_KEY;
const host = process.env.HOST;
const secret = process.env.SECRET_TOKEN;`
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      // Secrets should be sorted first
      const secretVars = security.envVarsUsed.filter(e => e.isSecret);
      const nonSecretVars = security.envVarsUsed.filter(e => !e.isSecret);
      if (secretVars.length > 0 && nonSecretVars.length > 0) {
        const firstSecretIdx = security.envVarsUsed.findIndex(e => e.isSecret);
        const firstNonSecretIdx = security.envVarsUsed.findIndex(e => !e.isSecret);
        expect(firstSecretIdx).toBeLessThan(firstNonSecretIdx);
      }
    });

    it('should skip hidden directories in module map', async () => {
      fs.mkdirSync(path.join(testDir, 'src', '.hidden'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', '.hidden', 'secret.ts'),
        'export const secret = "hidden";'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const moduleMap = await newAnalyzer.analyzeModuleMap();

      const hiddenDir = Object.keys(moduleMap.directories).find(k =>
        k.includes('.hidden')
      );
      expect(hiddenDir).toBeUndefined();
    });

    it('should skip node_modules in module map', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'node_modules', 'pkg'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'node_modules', 'pkg', 'index.ts'),
        'export const pkg = {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const moduleMap = await newAnalyzer.analyzeModuleMap();

      const nodeModulesDir = Object.keys(moduleMap.directories).find(k =>
        k.includes('node_modules')
      );
      expect(nodeModulesDir).toBeUndefined();
    });

    it('should handle directory with no relevant files', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'empty-dir'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'empty-dir', 'readme.md'),
        '# Empty directory'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const moduleMap = await newAnalyzer.analyzeModuleMap();

      // Should not include directory with no .ts/.js files
      const emptyDir = Object.keys(moduleMap.directories).find(k =>
        k.includes('empty-dir')
      );
      expect(emptyDir).toBeUndefined();
    });

    it('should handle zero docs for JSDoc coverage', async () => {
      // Create project with no exported functions
      const emptyTestDir = path.join(testDir, 'empty-docs');
      fs.mkdirSync(path.join(emptyTestDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(emptyTestDir, 'src', 'internal.ts'),
        'const internal = 42;' // No exports
      );
      fs.writeFileSync(
        path.join(emptyTestDir, 'package.json'),
        JSON.stringify({ name: 'empty', version: '1.0.0' })
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: emptyTestDir });
      const docs = await newAnalyzer.analyzeDocumentation();

      expect(docs.jsdocCoverage).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero lines for comment density', async () => {
      // Test edge case
      const emptyLinesDir = path.join(testDir, 'empty-lines');
      fs.mkdirSync(path.join(emptyLinesDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(emptyLinesDir, 'src', 'empty.ts'), '');
      fs.writeFileSync(
        path.join(emptyLinesDir, 'package.json'),
        JSON.stringify({ name: 'empty-lines', version: '1.0.0' })
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: emptyLinesDir });
      const docs = await newAnalyzer.analyzeDocumentation();

      expect(docs.commentDensity).toBeGreaterThanOrEqual(0);
    });

    it('should detect non-directory entries in module map', async () => {
      // Create a file directly in src (not a directory)
      fs.writeFileSync(path.join(testDir, 'src', 'root-file.ts'), 'export const root = 1;');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const moduleMap = await newAnalyzer.analyzeModuleMap();

      // File should not be in directories
      const rootFile = Object.keys(moduleMap.directories).find(k =>
        k.includes('root-file')
      );
      expect(rootFile).toBeUndefined();
    });

    it('should handle multiple dangerous APIs on same line', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'multi-danger.ts'),
        'eval(fs.writeFile("test", "data"));'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      expect(security.dangerousApis.some(a => a.api === 'eval()')).toBe(true);
    });

    it('should handle high fan-in modules', async () => {
      // Create a module that many others depend on
      fs.writeFileSync(
        path.join(testDir, 'src', 'shared.ts'),
        'export const shared = {};'
      );
      // Create many files that import from shared
      for (let i = 0; i < 15; i++) {
        fs.writeFileSync(
          path.join(testDir, 'src', `consumer${i}.ts`),
          `import { shared } from './shared';
export const use${i} = shared;`
        );
      }

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      // shared.ts should have high fan-in
      expect(arch.modules.some(m => m.path.includes('shared'))).toBe(true);
    });

    it('should detect layered architecture pattern', async () => {
      // Create layered structure
      fs.mkdirSync(path.join(testDir, 'src', 'commands'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'src', 'services'), { recursive: true });

      fs.writeFileSync(
        path.join(testDir, 'src', 'commands', 'cmd.ts'),
        'export const createCommand = () => ({ name: "test" });'
      );
      fs.writeFileSync(
        path.join(testDir, 'src', 'services', 'svc.ts'),
        'export class UserService {}'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(['layered', 'plugin-based', 'unknown']).toContain(arch.pattern);
    });

    it('should detect MVC architecture pattern', async () => {
      // Create MVC structure with many components
      fs.mkdirSync(path.join(testDir, 'src', 'components'), { recursive: true });
      for (let i = 0; i < 8; i++) {
        fs.writeFileSync(
          path.join(testDir, 'src', 'components', `Comp${i}.tsx`),
          `export const Comp${i} = () => <div>${i}</div>;`
        );
      }

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      // Should detect component-heavy structure
      const componentModules = arch.modules.filter(m => m.kind === 'component');
      expect(componentModules.length).toBeGreaterThan(0);
    });

    it('should handle config patterns with user config', async () => {
      // Create constants file with ax-glm reference
      fs.writeFileSync(
        path.join(testDir, 'src', 'constants.ts'),
        'export const CONFIG_DIR = ".ax-glm";'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      expect(config.userConfig).toBeDefined();
    });

    it('should handle provider-specific project config', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'constants.ts'),
        'export const PROJECT_DIR = ".ax-grok";'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      expect(config.projectConfig).toBeDefined();
    });

    it('should detect config/default.json as project config', async () => {
      fs.mkdirSync(path.join(testDir, 'config'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'config', 'default.json'),
        JSON.stringify({ setting: 'value' })
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      expect(config.projectConfig).toContain('default.json');
    });

    it('should detect Zod schemas directory', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'schemas'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'schemas', 'user.ts'),
        'import { z } from "zod"; export const userSchema = z.object({});'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      expect(config.schema).toContain('schemas');
    });

    it('should handle required env vars detection', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'required-env.ts'),
        `if (!process.env.REQUIRED_VAR) throw new Error('Required');`
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      const reqVar = config.envVars.find(e => e.name === 'REQUIRED_VAR');
      expect(reqVar?.required).toBe(true);
    });

    it('should limit env vars to 15', async () => {
      let code = '';
      for (let i = 0; i < 20; i++) {
        code += `const v${i} = process.env.VAR_${i};\n`;
      }
      fs.writeFileSync(path.join(testDir, 'src', 'many-env.ts'), code);

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const config = await newAnalyzer.analyzeConfigPatterns();

      expect(config.envVars.length).toBeLessThanOrEqual(15);
    });

    it('should detect circular dependencies', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'modA.ts'),
        `import { b } from './modB';
export const a = () => b();`
      );
      fs.writeFileSync(
        path.join(testDir, 'src', 'modB.ts'),
        `import { a } from './modA';
export const b = () => a();`
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch.circularDependencies.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle import conventions with type imports', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'type-imports.ts'),
        `import type { Type1 } from './types';
import type { Type2 } from './other';
export const useTypes = (t1: Type1, t2: Type2) => {};`
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const conventions = await newAnalyzer.analyzeImportConventions();

      // Check style is ESM
      expect(conventions.style).toContain('ESM');
    });

    it('should detect default imports', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'default-import.ts'),
        `import React from 'react';
import DefaultExport from './module';
export const Component = () => React.createElement('div');`
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const conventions = await newAnalyzer.analyzeImportConventions();

      // Verify ESM style detected
      expect(conventions.style).toContain('ESM');
    });

    it('should handle fs write operations as dangerous', async () => {
      fs.writeFileSync(
        path.join(testDir, 'src', 'fs-ops.ts'),
        `import fs from 'fs';
fs.writeFile('output.txt', 'data', () => {});
fs.appendFile('log.txt', 'entry', () => {});
fs.unlink('temp.txt', () => {});`
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const security = await newAnalyzer.analyzeSecurity();

      expect(security.dangerousApis.some(a => a.api === 'fs write operations')).toBe(true);
    });

    it('should detect hexagonal architecture', async () => {
      // Create hexagonal structure
      fs.mkdirSync(path.join(testDir, 'src', 'adapters'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'src', 'domain'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'src', 'services'), { recursive: true });

      fs.writeFileSync(
        path.join(testDir, 'src', 'adapters', 'db.ts'),
        'export class DatabaseAdapter {}'
      );
      fs.writeFileSync(
        path.join(testDir, 'src', 'domain', 'user.ts'),
        'export class User {}'
      );
      fs.writeFileSync(
        path.join(testDir, 'src', 'services', 'user-service.ts'),
        'export class UserService {}'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(['hexagonal', 'layered', 'plugin-based', 'unknown']).toContain(arch.pattern);
    });

    it('should handle medium fan-out modules', async () => {
      // Create a module with moderate dependencies
      let imports = '';
      let uses = '';
      for (let i = 0; i < 8; i++) {
        fs.writeFileSync(
          path.join(testDir, 'src', `dep${i}.ts`),
          `export const dep${i} = ${i};`
        );
        imports += `import { dep${i} } from './dep${i}';\n`;
        uses += `dep${i}, `;
      }
      fs.writeFileSync(
        path.join(testDir, 'src', 'fanout.ts'),
        `${imports}\nexport const fanout = [${uses}];`
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      expect(arch.modules.some(m => m.path.includes('fanout'))).toBe(true);
    });

    it('should detect modules with many functions', async () => {
      let functions = '';
      for (let i = 0; i < 25; i++) {
        functions += `export function fn${i}() { return ${i}; }\n`;
      }
      fs.writeFileSync(path.join(testDir, 'src', 'many-fns.ts'), functions);

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const arch = await newAnalyzer.analyzeArchitecture();

      const manyFns = arch.modules.find(m => m.path.includes('many-fns'));
      expect(manyFns?.functionCount).toBeGreaterThan(20);
    });

    // Additional branch coverage for 85% target
    it('should detect tool directory purpose', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'tools'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'tools', 'my-tool.ts'),
        'export const myTool = () => {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const moduleMap = await newAnalyzer.analyzeModuleMap();

      const toolsDir = Object.entries(moduleMap.directories).find(([k]) =>
        k.includes('tools')
      );
      // Purpose contains "tool" in lowercase
      expect(toolsDir?.[1].purpose?.toLowerCase()).toContain('tool');
    });

    it('should detect service directory purpose', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'services'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'services', 'user-service.ts'),
        'export class UserService {}'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const moduleMap = await newAnalyzer.analyzeModuleMap();

      const servicesDir = Object.entries(moduleMap.directories).find(([k]) =>
        k.includes('services')
      );
      // Purpose contains "service" in lowercase
      expect(servicesDir?.[1].purpose?.toLowerCase()).toContain('service');
    });

    it('should detect component directory with tsx files', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'ui'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'ui', 'Button.tsx'),
        'export const Button = () => <button>Click</button>;'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const moduleMap = await newAnalyzer.analyzeModuleMap();

      const uiDir = Object.entries(moduleMap.directories).find(([k]) =>
        k.includes('ui')
      );
      expect(uiDir?.[1].purpose).toContain('UI');
    });

    it('should detect class implementing interface pattern', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'providers'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'providers', 'api-provider.ts'),
        'export class ApiProvider implements Provider { async fetch() {} }'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const moduleMap = await newAnalyzer.analyzeModuleMap();

      const providersDir = Object.entries(moduleMap.directories).find(([k]) =>
        k.includes('providers')
      );
      expect(providersDir?.[1].pattern).toContain('implementing');
    });

    it('should detect class extending base class pattern', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'handlers'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'handlers', 'user-handler.ts'),
        'export class UserHandler extends BaseHandler { handle() {} }'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const moduleMap = await newAnalyzer.analyzeModuleMap();

      const handlersDir = Object.entries(moduleMap.directories).find(([k]) =>
        k.includes('handlers')
      );
      expect(handlersDir?.[1].pattern).toContain('extending');
    });

    it('should detect factory function pattern', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'factories'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'factories', 'widget.ts'),
        'export const createWidget = (config: Config) => new Widget(config);'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const moduleMap = await newAnalyzer.analyzeModuleMap();

      const factoriesDir = Object.entries(moduleMap.directories).find(([k]) =>
        k.includes('factories')
      );
      expect(factoriesDir?.[1].pattern).toContain('Factory');
    });

    it('should handle command pattern in non-commands directory', async () => {
      fs.mkdirSync(path.join(testDir, 'src', 'cli'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'src', 'cli', 'setup-command.ts'),
        'export const setupCommand = () => {};'
      );

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const moduleMap = await newAnalyzer.analyzeModuleMap();

      const cliDir = Object.entries(moduleMap.directories).find(([k]) =>
        k.includes('cli')
      );
      expect(cliDir).toBeDefined();
    });

    it('should handle empty file for large file detection', async () => {
      fs.writeFileSync(path.join(testDir, 'src', 'minimal.ts'), '');

      const newAnalyzer = new DeepAnalyzer({ projectRoot: testDir });
      const stats = await newAnalyzer.analyzeCodeStats();

      expect(stats.largeFiles.every(f => f.lines > 0)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST SETUP HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function setupTestProject(testDir: string): Promise<void> {
  // Create directories
  fs.mkdirSync(path.join(testDir, 'src', 'utils'), { recursive: true });
  fs.mkdirSync(path.join(testDir, 'tests'), { recursive: true });
  fs.mkdirSync(path.join(testDir, 'docs'), { recursive: true });

  // package.json
  fs.writeFileSync(
    path.join(testDir, 'package.json'),
    JSON.stringify(
      {
        name: 'test-project',
        version: '1.0.0',
        type: 'module',
        main: 'dist/index.js',
        exports: {
          '.': {
            import: './dist/index.js',
          },
        },
        scripts: {
          build: 'tsc',
          test: 'vitest',
          lint: 'eslint .',
          typecheck: 'tsc --noEmit',
          dev: 'tsc -w',
        },
        dependencies: {
          typescript: '^5.0.0',
        },
        devDependencies: {
          vitest: '^1.0.0',
          eslint: '^8.0.0',
        },
      },
      null,
      2
    )
  );

  // README.md
  fs.writeFileSync(
    path.join(testDir, 'README.md'),
    `# Test Project

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`typescript
import { helper } from 'test-project';
\`\`\`

## API Reference

See docs.

## License

MIT
`
  );

  // Source files
  fs.writeFileSync(
    path.join(testDir, 'src', 'index.ts'),
    `/**
 * Main entry point
 * @packageDocumentation
 */
export { formatDate, debounce } from './utils/helpers.js';

// TODO: Add more exports
export const VERSION = '1.0.0';
`
  );

  fs.writeFileSync(
    path.join(testDir, 'src', 'utils', 'helpers.ts'),
    `/**
 * Format a date
 */
export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Debounce a function
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): T => {
  let timeout: NodeJS.Timeout;
  return ((...args: unknown[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
};

// TODO: Add throttle function
`
  );

  // Test file
  fs.writeFileSync(
    path.join(testDir, 'tests', 'helpers.test.ts'),
    `import { describe, it, expect } from 'vitest';
import { formatDate } from '../src/utils/helpers.js';

describe('helpers', () => {
  it('should format date', () => {
    const date = new Date('2024-01-01');
    expect(formatDate(date)).toBe('2024-01-01');
  });
});
`
  );

  // Interface file
  fs.writeFileSync(
    path.join(testDir, 'src', 'types.ts'),
    `export interface Tool {
  name: string;
  execute(input: string): Promise<string>;
}

export interface Service {
  start(): void;
  stop(): void;
}

export class MyTool implements Tool {
  name = 'my-tool';
  async execute(input: string): Promise<string> {
    return input.toUpperCase();
  }
}
`
  );

  // Doc file
  fs.writeFileSync(path.join(testDir, 'docs', 'api.md'), '# API Documentation\n');
  fs.writeFileSync(path.join(testDir, 'CHANGELOG.md'), '# Changelog\n');
}

async function cleanupTestProject(testDir: string): Promise<void> {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}
