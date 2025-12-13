/**
 * JSON Reporter
 * Formats check results as machine-readable JSON
 */

import type { CheckResult, FileResult, Violation } from '../types.js';

/**
 * JSON output format for violations
 */
interface JsonViolation {
  rule: string;
  severity: string;
  message: string;
  line: number;
  column: number;
  found: string;
  suggestion?: string;
  fixable: boolean;
}

/**
 * JSON output format for file results
 */
interface JsonFileResult {
  file: string;
  violations: JsonViolation[];
  errorCount: number;
  warningCount: number;
}

/**
 * JSON output format for full report
 */
interface JsonReport {
  summary: {
    files: number;
    filesWithViolations: number;
    errors: number;
    warnings: number;
    fixable: number;
  };
  results: JsonFileResult[];
}

/**
 * Convert a violation to JSON format
 */
function violationToJson(violation: Violation): JsonViolation {
  return {
    rule: violation.rule,
    severity: violation.severity,
    message: violation.message,
    line: violation.line,
    column: violation.column,
    found: violation.found,
    suggestion: violation.suggestion,
    fixable: violation.fixable ?? false,
  };
}

/**
 * Convert file results to JSON format
 */
function fileResultToJson(result: FileResult): JsonFileResult {
  const violations = result.violations.map(violationToJson);
  return {
    file: result.file,
    violations,
    errorCount: violations.filter((v) => v.severity === 'error').length,
    warningCount: violations.filter((v) => v.severity === 'warning').length,
  };
}

/**
 * Format check results as JSON
 */
export function formatJsonOutput(result: CheckResult): string {
  const fixableCount = result.results
    .flatMap((r) => r.violations)
    .filter((v) => v.fixable).length;

  const report: JsonReport = {
    summary: {
      files: result.summary.files,
      filesWithViolations: result.summary.filesWithViolations,
      errors: result.summary.errors,
      warnings: result.summary.warnings,
      fixable: fixableCount,
    },
    results: result.results
      .filter((r) => r.violations.length > 0)
      .map(fileResultToJson),
  };

  return JSON.stringify(report, null, 2);
}

/**
 * Format check results as compact JSON (one line)
 */
export function formatCompactJsonOutput(result: CheckResult): string {
  const fixableCount = result.results
    .flatMap((r) => r.violations)
    .filter((v) => v.fixable).length;

  const report: JsonReport = {
    summary: {
      files: result.summary.files,
      filesWithViolations: result.summary.filesWithViolations,
      errors: result.summary.errors,
      warnings: result.summary.warnings,
      fixable: fixableCount,
    },
    results: result.results
      .filter((r) => r.violations.length > 0)
      .map(fileResultToJson),
  };

  return JSON.stringify(report);
}

/**
 * Print JSON results to console
 */
export function printJsonResults(result: CheckResult, compact: boolean = false): void {
  const output = compact
    ? formatCompactJsonOutput(result)
    : formatJsonOutput(result);

  console.log(output);
}
