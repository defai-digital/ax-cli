import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadConfig,
  validateTokens,
  getRuleSeverity,
  getSchemaPath,
  DEFAULT_CONFIG,
} from '../../../packages/core/src/design-check/config.js';
import {
  scanFiles,
  readFileSafe,
  filterIgnoredViolations,
  hasIgnoreLineComment,
  getLocationFromIndex,
} from '../../../packages/core/src/design-check/scanner.js';
import {
  applyFixes,
  writeFixedFile,
  fixFile,
  calculateCoverage,
  createBackup,
  restoreFromBackup,
  cleanupBackup,
} from '../../../packages/core/src/design-check/fixer.js';
import {
  formatConsoleOutput,
  formatCompactOutput,
  printResults,
} from '../../../packages/core/src/design-check/reporter/console.js';
import {
  formatJsonOutput,
  formatCompactJsonOutput,
  printJsonResults,
} from '../../../packages/core/src/design-check/reporter/json.js';
import * as reporterIndex from '../../../packages/core/src/design-check/reporter/index.js';
import { runDesignCheckWithOutput } from '../../../packages/core/src/design-check/index.js';
import type { CheckResult, FileContent, Violation } from '../../../packages/core/src/design-check/types.js';

const FIXTURES_DIR = path.join(__dirname, '../fixtures');

describe('design-check modules', () => {
  let tempDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-check-unit-'));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('config', () => {
    it('merges discovered project config and CLI ignore patterns', async () => {
      process.chdir(tempDir);
      const configDir = path.join(tempDir, '.ax-cli');
      fs.mkdirSync(configDir, { recursive: true });
      const configPath = path.join(configDir, 'design.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          tokens: { colors: { primary: '#123456' }, spacing: { md: '20px' } },
          rules: { 'no-inline-styles': 'off' },
          ignore: ['**/generated/**'],
        })
      );

      const config = await loadConfig(undefined, ['**/tmp-ignore/**']);

      expect(config.tokens.colors.primary).toBe('#123456');
      expect(config.rules['no-inline-styles']).toBe('off');
      expect(config.ignore).toContain('**/generated/**');
      expect(config.ignore).toContain('**/tmp-ignore/**');
    });

    it('throws on missing CLI config path and invalid JSON', async () => {
      await expect(loadConfig('/definitely/missing.json')).rejects.toThrow('Config file not found');

      const badConfig = path.join(tempDir, 'bad.json');
      fs.writeFileSync(badConfig, '{invalid-json');
      await expect(loadConfig(badConfig)).rejects.toThrow(/Invalid JSON/);
    });

    it('validates tokens and rule severities', () => {
      const errors = validateTokens({
        colors: { bad: '12345' },
        spacing: { bad: 'abc' },
      });

      expect(errors).toHaveLength(2);
      expect(getRuleSeverity('custom', { ...DEFAULT_CONFIG, rules: { ...DEFAULT_CONFIG.rules, custom: 'warn' } })).toBe('warning');
      expect(getRuleSeverity('custom', { ...DEFAULT_CONFIG, rules: { ...DEFAULT_CONFIG.rules, custom: 'off' } })).toBeNull();
      expect(fs.existsSync(getSchemaPath())).toBe(true);
    });

    it('accepts valid color and spacing token formats', () => {
      const valid = validateTokens({
        colors: { hex: '#fff', rgb: 'rgb(10, 20, 30)', hsl: 'hsl(0, 0%, 0%)', named: 'blue' },
        spacing: { zero: '0', px: '12px', rem: '1.5rem', em: '2em' },
      });

      expect(valid).toEqual([]);
    });
  });

  describe('scanner', () => {
    it('scans provided paths, respects include/ignore patterns, and normalizes locations', async () => {
      const includedDir = path.join(tempDir, 'included');
      const ignoredDir = path.join(tempDir, 'ignored');
      fs.mkdirSync(includedDir, { recursive: true });
      fs.mkdirSync(ignoredDir, { recursive: true });

      const includedFile = path.join(includedDir, 'component.tsx');
      const ignoredFile = path.join(ignoredDir, 'ignore-me.tsx');
      fs.writeFileSync(includedFile, '<div />');
      fs.writeFileSync(ignoredFile, '<span />');

      const results = await scanFiles(
        [tempDir],
        ['**/*.tsx'],
        ['**/ignored/**', '**/*ignore-me.tsx']
      );

      expect(results).toContain(includedFile);
      expect(results).not.toContain(ignoredFile);
      expect(getLocationFromIndex('line1\nline2', 6)).toEqual({ line: 2, column: 1 });
    });

    it('reads small files and handles missing ignore hints safely', async () => {
      const readableFile = path.join(tempDir, 'readable.tsx');
      fs.writeFileSync(readableFile, '<div />');

      const content = await readFileSafe(readableFile);
      expect(content?.lines.length).toBeGreaterThan(0);

      expect(hasIgnoreLineComment(['only one line'], 1, 'no-hardcoded-colors')).toBe(false);
      expect(hasIgnoreLineComment(['', ''], 5, 'no-hardcoded-colors')).toBe(false);
    });

    it('skips unreadable files and honors inline ignore hints', async () => {
      const bigFile = path.join(tempDir, 'big.tsx');
      fs.writeFileSync(bigFile, 'x'.repeat(1024 * 1024 + 1));
      expect(await readFileSafe(bigFile)).toBeNull();

      const binaryFile = path.join(tempDir, 'binary.tsx');
      fs.writeFileSync(binaryFile, 'abc\0def');
      expect(await readFileSafe(binaryFile)).toBeNull();

      const lines = ['// ax-ignore-file', 'const color = "#fff"'];
      const violations: Violation[] = [{ rule: 'no-hardcoded-colors', severity: 'error', message: '', file: '', line: 2, column: 1, found: '#fff' }];
      expect(filterIgnoredViolations(violations, lines)).toEqual([]);

      const ruleSpecificLines = ['// ax-ignore-next-line no-hardcoded-colors', 'const color = "#fff";'];
      expect(hasIgnoreLineComment(ruleSpecificLines, 2, 'no-hardcoded-colors')).toBe(true);
      expect(hasIgnoreLineComment(ruleSpecificLines, 2, 'no-raw-spacing')).toBe(false);
    });
  });

  describe('fixer', () => {
    const baseFile: FileContent = {
      path: '',
      content: "const styles = { padding: '10px', color: 'rgb(171, 205, 239)' };",
      lines: ["const styles = { padding: '10px', color: 'rgb(171, 205, 239)' };"],
    };

    const config = {
      ...DEFAULT_CONFIG,
      tokens: {
        colors: { primary: '#abcdef' },
        spacing: { sm: '8px', md: '12px' },
      },
    };

    it('applies fixes, skips impossible ones, and picks nearest spacing token', () => {
      const violations: Violation[] = [
        { rule: 'no-raw-spacing', severity: 'warning', message: '', file: '', line: 1, column: 22, found: '10px', fixable: true },
        { rule: 'no-hardcoded-colors', severity: 'error', message: '', file: '', line: 1, column: 40, found: 'rgb(171, 205, 239)', fixable: true },
        { rule: 'no-hardcoded-colors', severity: 'error', message: '', file: '', line: 10, column: 1, found: '#ffffff', fixable: true },
      ];

      const result = applyFixes(baseFile, violations, config);

      expect(result.appliedCount).toBe(2);
      expect(result.skippedCount).toBe(1);
      expect(result.fixedContent).toContain('8px');
      expect(result.fixedContent.toLowerCase()).toContain('#abcdef');
    });

    it('handles backups and unsupported or already-correct violations', () => {
      const filePath = path.join(tempDir, 'backup.tsx');
      fs.writeFileSync(filePath, baseFile.content);

      const backupPath = createBackup(filePath);
      fs.writeFileSync(filePath, 'mutated');
      restoreFromBackup(filePath, backupPath);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(baseFile.content);
      cleanupBackup(backupPath);
      expect(fs.existsSync(backupPath)).toBe(false);

      const unsupported = applyFixes(baseFile, [
        { rule: 'no-inline-styles', severity: 'warning', message: '', file: '', line: 1, column: 1, found: 'style', fixable: true },
      ], config);
      expect(unsupported.appliedCount).toBe(0);
      expect(unsupported.skippedCount).toBe(1);

      const alreadyCorrectFile: FileContent = {
        ...baseFile,
        content: baseFile.content.replace('10px', '8px'),
        lines: [baseFile.content.replace('10px', '8px')],
      };

      const alreadyCorrect = applyFixes(alreadyCorrectFile, [
        { rule: 'no-raw-spacing', severity: 'warning', message: '', file: '', line: 1, column: 22, found: '8px', fixable: true },
      ], config);
      expect(alreadyCorrect.appliedCount).toBe(0);
      expect(alreadyCorrect.skippedCount).toBeGreaterThan(0);
    });

    it('respects dry runs, writes backups, and surfaces coverage totals', () => {
      const filePath = path.join(tempDir, 'fix-target.tsx');
      fs.writeFileSync(filePath, baseFile.content);

      const fixResult = {
        file: filePath,
        originalContent: baseFile.content,
        fixedContent: baseFile.content.replace('10px', '8px'),
        fixes: [],
        appliedCount: 1,
        skippedCount: 0,
      };

      const dryRunWrite = writeFixedFile(fixResult, { dryRun: true });
      expect(dryRunWrite.success).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toContain('10px');

      const realWrite = writeFixedFile(fixResult, { backup: true });
      expect(realWrite.success).toBe(true);
      expect(realWrite.backupPath && fs.existsSync(realWrite.backupPath)).toBe(true);

      const nonFixableViolation: Violation = {
        rule: 'no-raw-spacing',
        severity: 'warning',
        message: '',
        file: '',
        line: 1,
        column: 1,
        found: '50px',
        fixable: true,
      };

      const fixless = applyFixes(baseFile, [nonFixableViolation], config);
      expect(fixless.appliedCount).toBe(0);
      expect(fixless.skippedCount).toBe(1);

      const coverage = calculateCoverage(1, 2, 1, 0);
      expect(coverage.colorCoverage).toBe(0);
      expect(coverage.spacingCoverage).toBe(100);
      expect(coverage.overallCoverage).toBe(0);
    });

    it('returns write state from fixFile when nothing is applied', async () => {
      const filePath = path.join(tempDir, 'noop.tsx');
      fs.writeFileSync(filePath, baseFile.content);

      const file: FileContent = { ...baseFile, path: filePath };
      const result = await fixFile(file, [], config, { backup: false });

      expect(result.written).toBe(false);
      expect(result.appliedCount).toBe(0);
      expect(result.backupPath).toBeUndefined();
    });
  });

  describe('reporters', () => {
    const sampleResult: CheckResult = {
      summary: { files: 1, filesWithViolations: 1, errors: 1, warnings: 1, skipped: 0 },
      results: [
        {
          file: '/tmp/sample.tsx',
          violations: [
            { rule: 'no-hardcoded-colors', severity: 'error', message: 'bad color', file: '/tmp/sample.tsx', line: 1, column: 1, found: '#fff', fixable: true },
            { rule: 'no-raw-spacing', severity: 'warning', message: 'bad spacing', file: '/tmp/sample.tsx', line: 2, column: 5, found: '12px', fixable: false },
          ],
        },
        {
          file: '/tmp/clean.tsx',
          violations: [],
        },
      ],
    };

    it('formats console output in quiet mode and compact mode', () => {
      const quietOutput = formatConsoleOutput(
        { ...sampleResult, summary: { ...sampleResult.summary, errors: 0 } },
        { quiet: true, noColor: true }
      );
      expect(quietOutput).toBe('');

      const compact = formatCompactOutput(sampleResult);
      expect(compact.split('\n')).toHaveLength(2);

      expect(reporterIndex.formatConsoleOutput).toBe(formatConsoleOutput);
      expect(reporterIndex.formatJsonOutput).toBe(formatJsonOutput);
    });

    it('formats JSON outputs and prints compact reports', () => {
      const json = JSON.parse(formatJsonOutput(sampleResult));
      expect(json.summary.fixable).toBe(1);
      expect(json.results.length).toBe(1); // filters empty files

      const compactJson = JSON.parse(formatCompactJsonOutput(sampleResult));
      expect(compactJson.summary.filesWithViolations).toBe(1);

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      printJsonResults(sampleResult, true);
      expect(logSpy).toHaveBeenCalledWith(formatCompactJsonOutput(sampleResult));
      logSpy.mockRestore();
    });

    it('exits with error when warnings exceed threshold and JSON output is requested', async () => {
      const warningFile = path.join(tempDir, 'warnings-only.tsx');
      fs.writeFileSync(
        warningFile,
        "export const Component = () => <div style={{ margin: '10px' }} />;"
      );

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const code = await runDesignCheckWithOutput([warningFile], { maxWarnings: 0, format: 'json' });
      logSpy.mockRestore();

      expect(code).toBe(1);
    });

    it('prints quiet errors only and returns exit codes from runner', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      printResults(sampleResult, { quiet: true, noColor: true });
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failureCode = await runDesignCheckWithOutput([], { config: '/missing-config.json' });
      expect(failureCode).toBe(2);
      errorSpy.mockRestore();
    });
  });
});
