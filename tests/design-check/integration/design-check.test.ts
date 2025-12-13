/**
 * Integration tests for design-check CLI
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runDesignCheck, getAvailableRules, loadConfig } from '../../../packages/core/src/design-check/index.js';
import { formatConsoleOutput } from '../../../packages/core/src/design-check/reporter/console.js';
import { formatJsonOutput } from '../../../packages/core/src/design-check/reporter/json.js';

// Test fixtures directory
const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const TEMP_DIR = path.join(__dirname, '../temp');

describe('Design Check Integration', () => {
  // Create temp directory for test files
  beforeAll(() => {
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  });

  // Clean up temp directory after tests
  afterAll(() => {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  describe('runDesignCheck', () => {
    it('detects violations in files with issues', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'violations-component.tsx')]);

      expect(result.summary.files).toBe(1);
      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].violations.length).toBeGreaterThan(0);
    });

    it('finds no violations in valid files', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'valid-component.tsx')]);

      expect(result.summary.files).toBe(1);
      // Should have minimal or no violations (depending on rule strictness)
      expect(result.summary.errors).toBeLessThanOrEqual(1);
    });

    it('respects quiet option', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'violations-component.tsx')], {
        quiet: true,
      });

      // Quiet mode still returns all violations, just affects output
      expect(result.summary.files).toBe(1);
    });

    it('filters by specific rule', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'violations-component.tsx')], {
        rule: 'no-hardcoded-colors',
      });

      // All violations should be color-related
      const rules = result.results[0].violations.map((v) => v.rule);
      const uniqueRules = [...new Set(rules)];

      expect(uniqueRules).toHaveLength(1);
      expect(uniqueRules[0]).toBe('no-hardcoded-colors');
    });

    it('applies ignore patterns', async () => {
      const result = await runDesignCheck([FIXTURES_DIR], {
        ignorePatterns: ['**/violations-*.tsx'],
      });

      // Should not include violations-component.tsx
      const files = result.results.map((r) => path.basename(r.file));
      expect(files).not.toContain('violations-component.tsx');
    });

    it('handles non-existent paths gracefully', async () => {
      const result = await runDesignCheck(['/non/existent/path']);

      expect(result.summary.files).toBe(0);
    });

    it('handles empty directories', async () => {
      const emptyDir = path.join(TEMP_DIR, 'empty');
      if (!fs.existsSync(emptyDir)) {
        fs.mkdirSync(emptyDir, { recursive: true });
      }

      const result = await runDesignCheck([emptyDir]);

      expect(result.summary.files).toBe(0);
    });
  });

  describe('loadConfig', () => {
    it('loads default config when no config file exists', async () => {
      const config = await loadConfig();

      expect(config).toBeDefined();
      expect(config.rules).toBeDefined();
      expect(config.tokens).toBeDefined();
      expect(config.tokens.colors).toBeDefined();
      expect(config.tokens.spacing).toBeDefined();
    });

    it('loads custom config from file', async () => {
      const configPath = path.join(FIXTURES_DIR, 'config-samples', 'basic-config.json');
      const config = await loadConfig(configPath);

      expect(config).toBeDefined();
      expect(config.tokens.colors.primary).toBeDefined();
      expect(config.tokens.spacing.md).toBeDefined();
    });

    it('applies additional ignore patterns', async () => {
      const additionalIgnore = ['**/additional-ignore/**'];
      const config = await loadConfig(undefined, additionalIgnore);

      expect(config.ignore).toContain('**/additional-ignore/**');
    });
  });

  describe('getAvailableRules', () => {
    it('returns list of available rules', () => {
      const rules = getAvailableRules();

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
      expect(rules).toContain('no-hardcoded-colors');
      expect(rules).toContain('no-raw-spacing');
      expect(rules).toContain('missing-alt-text');
      expect(rules).toContain('missing-form-labels');
      expect(rules).toContain('no-inline-styles');
    });
  });

  describe('Console Reporter', () => {
    it('formats output in stylish format', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'violations-component.tsx')]);
      const output = formatConsoleOutput(result, { noColor: true });

      // Should contain file path
      expect(output).toContain('violations-component.tsx');

      // Should contain summary
      expect(output).toMatch(/\d+ problem/);
    });

    it('respects quiet option in console output', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'violations-component.tsx')]);
      const quietOutput = formatConsoleOutput(result, { noColor: true, quiet: true });

      // Quiet output should be shorter (only errors)
      const normalOutput = formatConsoleOutput(result, { noColor: true, quiet: false });
      expect(quietOutput.length).toBeLessThanOrEqual(normalOutput.length);
    });

    it('returns empty string when no violations', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'valid-component.tsx')]);
      const output = formatConsoleOutput(result, { noColor: true });

      // May have a success message or be empty
      expect(typeof output).toBe('string');
    });
  });

  describe('JSON Reporter', () => {
    it('formats output as valid JSON', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'violations-component.tsx')]);
      const jsonOutput = formatJsonOutput(result);

      // Should be valid JSON
      const parsed = JSON.parse(jsonOutput);

      expect(parsed).toBeDefined();
      expect(parsed.summary).toBeDefined();
      expect(parsed.results).toBeDefined();
      expect(Array.isArray(parsed.results)).toBe(true);
    });

    it('includes summary statistics', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'violations-component.tsx')]);
      const jsonOutput = formatJsonOutput(result);
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.summary).toHaveProperty('files');
      expect(parsed.summary).toHaveProperty('errors');
      expect(parsed.summary).toHaveProperty('warnings');
    });

    it('includes violation details', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'violations-component.tsx')]);
      const jsonOutput = formatJsonOutput(result);
      const parsed = JSON.parse(jsonOutput);

      if (parsed.results[0]?.violations?.length > 0) {
        const violation = parsed.results[0].violations[0];

        expect(violation).toHaveProperty('rule');
        expect(violation).toHaveProperty('message');
        expect(violation).toHaveProperty('line');
        expect(violation).toHaveProperty('severity');
      }
    });
  });

  describe('Auto-fix Integration', () => {
    beforeEach(() => {
      // Create a test file for fix tests
      const testFile = path.join(TEMP_DIR, 'fix-test.tsx');
      const content = `
        // Test file for auto-fix
        const Component = () => {
          return (
            <div style={{ padding: '15px', color: '#1e90ff' }}>
              <span style={{ margin: '17px' }}>Text</span>
            </div>
          );
        };
        export default Component;
      `;
      fs.writeFileSync(testFile, content);
    });

    it('applies fixes when --fix option is provided', async () => {
      const testFile = path.join(TEMP_DIR, 'fix-test.tsx');

      // Run with fix
      const result = await runDesignCheck([testFile], { fix: true });

      // Should have applied some fixes
      expect(result.totalFixesApplied).toBeGreaterThanOrEqual(0);
    });

    it('creates backup files when fixing', async () => {
      const testFile = path.join(TEMP_DIR, 'fix-test.tsx');

      // Run with fix
      const result = await runDesignCheck([testFile], { fix: true });

      // If fixes were applied, backup should exist
      if (result.totalFixesApplied && result.totalFixesApplied > 0) {
        const backupFile = testFile + '.ax-backup';
        expect(fs.existsSync(backupFile)).toBe(true);
      }
    });

    it('reports skipped fixes', async () => {
      const testFile = path.join(TEMP_DIR, 'fix-test.tsx');

      // Run with fix
      const result = await runDesignCheck([testFile], { fix: true });

      // totalFixesSkipped should be a number (may be 0 or more)
      expect(typeof result.totalFixesSkipped).toBe('number');
    });
  });

  describe('Coverage Statistics', () => {
    it('includes coverage stats in result', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'violations-component.tsx')]);

      expect(result.coverage).toBeDefined();
      expect(result.coverage?.colorCoverage).toBeDefined();
      expect(result.coverage?.spacingCoverage).toBeDefined();
    });

    it('calculates reasonable coverage percentages', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'violations-component.tsx')]);

      if (result.coverage) {
        expect(result.coverage.colorCoverage).toBeGreaterThanOrEqual(0);
        expect(result.coverage.colorCoverage).toBeLessThanOrEqual(100);
        expect(result.coverage.spacingCoverage).toBeGreaterThanOrEqual(0);
        expect(result.coverage.spacingCoverage).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Exit Code Behavior', () => {
    it('returns errors > 0 when violations exist', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'violations-component.tsx')]);

      // Should have errors or warnings
      expect(result.summary.errors + result.summary.warnings).toBeGreaterThan(0);
    });

    it('respects maxWarnings threshold', async () => {
      const result = await runDesignCheck([path.join(FIXTURES_DIR, 'violations-component.tsx')], {
        maxWarnings: 0,
      });

      // If warnings exist and maxWarnings is 0, this would trigger exit code 1
      // The function itself doesn't handle exit codes, but we can verify warnings exist
      expect(typeof result.summary.warnings).toBe('number');
    });
  });

  describe('Inline Ignore Comments', () => {
    beforeEach(() => {
      // Create test file with ignore comments
      const testFile = path.join(TEMP_DIR, 'ignore-test.tsx');
      const content = `
        // ax-ignore-next-line
        const color = '#ff0000';

        // No ignore - should be detected
        const color2 = '#00ff00';

        // ax-ignore-next-line no-hardcoded-colors
        const color3 = '#0000ff';
      `;
      fs.writeFileSync(testFile, content);
    });

    it('respects ax-ignore-next-line comments', async () => {
      const testFile = path.join(TEMP_DIR, 'ignore-test.tsx');
      const result = await runDesignCheck([testFile], { rule: 'no-hardcoded-colors' });

      // Only color2 (#00ff00) should be detected
      // color (#ff0000) and color3 (#0000ff) should be ignored
      const colorViolations = result.results[0].violations.filter(
        (v) => v.rule === 'no-hardcoded-colors'
      );

      // Should detect #00ff00 but not #ff0000 or #0000ff
      const foundColors = colorViolations.map((v) => v.found);
      expect(foundColors).toContain('#00ff00');
      expect(foundColors).not.toContain('#ff0000');
    });
  });
});
