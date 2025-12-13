/**
 * Design Check - Main Entry Point
 * Orchestrates the design system violation checker
 */

import { loadConfig } from './config.js';
import { scanFiles, readFileSafe } from './scanner.js';
import { runRules, getAllRuleIds } from './rules/index.js';
import { printResults } from './reporter/console.js';
import { printJsonResults } from './reporter/json.js';
import { applyFixes, writeFixedFile, calculateCoverage } from './fixer.js';
import type {
  CheckResult,
  FileResult,
  DesignCheckOptions,
} from './types.js';
import type { FileFixResult, CoverageStats } from './fixer.js';

/**
 * Default options
 */
const DEFAULT_OPTIONS: DesignCheckOptions = {
  format: 'stylish',
  quiet: false,
  maxWarnings: -1,
  ignorePatterns: [],
  noColor: false,
  fix: false,
};

/**
 * Extended check result with fix information
 */
export interface CheckResultWithFixes extends CheckResult {
  /** Fix results per file (when --fix is used) */
  fixResults?: FileFixResult[];
  /** Total fixes applied */
  totalFixesApplied?: number;
  /** Total fixes skipped */
  totalFixesSkipped?: number;
  /** Token coverage stats */
  coverage?: CoverageStats;
}

/**
 * Run design check on files
 */
export async function runDesignCheck(
  paths: string[],
  options: Partial<DesignCheckOptions> = {}
): Promise<CheckResultWithFixes> {
  const opts: DesignCheckOptions = { ...DEFAULT_OPTIONS, ...options };

  // Load configuration
  const config = await loadConfig(opts.config, opts.ignorePatterns);

  // Scan for files
  const filePaths = await scanFiles(paths, config.include, config.ignore);

  // Process each file
  const results: FileResult[] = [];
  const fixResults: FileFixResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let skippedCount = 0;
  let totalFixesApplied = 0;
  let totalFixesSkipped = 0;

  // Track totals for coverage calculation
  let totalColorValues = 0;
  let totalSpacingValues = 0;

  for (const filePath of filePaths) {
    const fileContent = await readFileSafe(filePath);

    if (!fileContent) {
      skippedCount++;
      results.push({
        file: filePath,
        violations: [],
        skipped: true,
        skipReason: 'Could not read file',
      });
      continue;
    }

    // Run rules on file
    const violations = runRules(fileContent, config, opts.rule);

    // Count errors and warnings
    const errors = violations.filter((v) => v.severity === 'error').length;
    const warnings = violations.filter((v) => v.severity === 'warning').length;
    totalErrors += errors;
    totalWarnings += warnings;

    // Count color and spacing violations for coverage
    const colorViolations = violations.filter((v) => v.rule === 'no-hardcoded-colors').length;
    const spacingViolations = violations.filter((v) => v.rule === 'no-raw-spacing').length;

    // Estimate total values (violations + assumed tokenized usage)
    // This is a rough estimate - violations are definitely non-tokenized
    totalColorValues += colorViolations;
    totalSpacingValues += spacingViolations;

    // Apply fixes if requested
    if (opts.fix && violations.some((v) => v.fixable)) {
      const fixResult = applyFixes(fileContent, violations, config, { backup: true, dryRun: false });

      // Always track skipped fixes for reporting
      totalFixesSkipped += fixResult.skippedCount;

      if (fixResult.appliedCount > 0) {
        // Write fixed file
        const writeResult = writeFixedFile(fixResult, { backup: true, dryRun: false });

        if (writeResult.success) {
          fixResult.backupPath = writeResult.backupPath;
          totalFixesApplied += fixResult.appliedCount;

          // Update violations to remove fixed ones
          const fixedViolationIds = new Set(
            fixResult.fixes
              .filter((f) => f.applied)
              .map((f) => `${f.violation.line}:${f.violation.column}:${f.violation.rule}`)
          );

          const remainingViolations = violations.filter(
            (v) => !fixedViolationIds.has(`${v.line}:${v.column}:${v.rule}`)
          );

          results.push({
            file: filePath,
            violations: remainingViolations,
          });

          fixResults.push(fixResult);
          continue;
        }
      }

      // Record fix results even if nothing was applied (to show skip reasons)
      if (fixResult.skippedCount > 0) {
        fixResults.push(fixResult);
      }
    }

    results.push({
      file: filePath,
      violations,
    });
  }

  // Recalculate totals after fixes
  const finalErrors = results.reduce(
    (sum, r) => sum + r.violations.filter((v) => v.severity === 'error').length,
    0
  );
  const finalWarnings = results.reduce(
    (sum, r) => sum + r.violations.filter((v) => v.severity === 'warning').length,
    0
  );

  // Calculate coverage
  const coverage = calculateCoverage(
    totalColorValues,
    totalSpacingValues,
    totalColorValues + 10, // Assume some tokenized colors exist
    totalSpacingValues + 10 // Assume some tokenized spacing exists
  );

  const result: CheckResultWithFixes = {
    summary: {
      files: filePaths.length,
      filesWithViolations: results.filter((r) => r.violations.length > 0).length,
      errors: opts.fix ? finalErrors : totalErrors,
      warnings: opts.fix ? finalWarnings : totalWarnings,
      skipped: skippedCount,
    },
    results,
    coverage,
  };

  if (opts.fix) {
    result.fixResults = fixResults;
    result.totalFixesApplied = totalFixesApplied;
    result.totalFixesSkipped = totalFixesSkipped;
  }

  return result;
}

/**
 * Run design check and print results
 */
export async function runDesignCheckWithOutput(
  paths: string[],
  options: Partial<DesignCheckOptions> = {}
): Promise<number> {
  const opts: DesignCheckOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    const result = await runDesignCheck(paths, opts);

    // Output results
    if (opts.format === 'json') {
      printJsonResults(result);
    } else {
      printResults(result, {
        noColor: opts.noColor,
        quiet: opts.quiet,
      });
    }

    // Determine exit code
    if (result.summary.errors > 0) {
      return 1;
    }

    // Check max warnings
    if (opts.maxWarnings >= 0 && result.summary.warnings > opts.maxWarnings) {
      return 1;
    }

    return 0;
  } catch (error) {
    console.error('Error running design check:', error);
    return 2;
  }
}

/**
 * Get available rule IDs
 */
export function getAvailableRules(): string[] {
  return getAllRuleIds();
}

// Re-export types
export type {
  CheckResult,
  FileResult,
  Violation,
  DesignCheckConfig,
  DesignCheckOptions,
  FileContent,
} from './types.js';

export type {
  FileFixResult,
  FixResult,
  CoverageStats,
  FixerOptions,
} from './fixer.js';

// Re-export utilities
export { loadConfig, DEFAULT_CONFIG, SCHEMA_URL, getSchemaPath } from './config.js';
export { scanFiles, readFileSafe } from './scanner.js';
export { runRules, RULES } from './rules/index.js';
export { formatConsoleOutput, formatJsonOutput } from './reporter/index.js';
export {
  applyFixes,
  writeFixedFile,
  createBackup,
  restoreFromBackup,
  calculateCoverage,
} from './fixer.js';
