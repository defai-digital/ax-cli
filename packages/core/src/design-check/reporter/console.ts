/**
 * Console Reporter
 * Formats check results in ESLint-style output for terminal display
 */

import chalk from 'chalk';
import type { CheckResult, FileResult, Violation } from '../types.js';

/**
 * Format a single violation for display
 */
function formatViolation(violation: Violation, useColor: boolean): string {
  const location = `${violation.line}:${violation.column}`.padEnd(8);

  const severityText = violation.severity === 'error' ? 'error' : 'warn';
  const severity = useColor
    ? violation.severity === 'error'
      ? chalk.red(severityText.padEnd(7))
      : chalk.yellow(severityText.padEnd(7))
    : severityText.padEnd(7);

  const message = violation.message;
  const rule = useColor ? chalk.gray(violation.rule) : violation.rule;

  return `  ${location}${severity}${message}  ${rule}`;
}

/**
 * Format results for a single file
 */
function formatFileResult(result: FileResult, useColor: boolean): string {
  if (result.violations.length === 0) {
    return '';
  }

  const lines: string[] = [];

  // File path header
  const filePath = useColor ? chalk.underline(result.file) : result.file;
  lines.push(filePath);

  // Each violation
  for (const violation of result.violations) {
    lines.push(formatViolation(violation, useColor));
  }

  return lines.join('\n');
}

/**
 * Format the summary line
 */
function formatSummary(
  errorCount: number,
  warningCount: number,
  useColor: boolean
): string {
  const total = errorCount + warningCount;

  if (total === 0) {
    return useColor ? chalk.green('No problems found') : 'No problems found';
  }

  const symbol = useColor ? chalk.red('✖') : '✖';
  const problems = total === 1 ? 'problem' : 'problems';
  const errors = errorCount === 1 ? 'error' : 'errors';
  const warnings = warningCount === 1 ? 'warning' : 'warnings';

  return `${symbol} ${total} ${problems} (${errorCount} ${errors}, ${warningCount} ${warnings})`;
}

/**
 * Format fixable hint
 */
function formatFixableHint(fixableCount: number, useColor: boolean): string {
  if (fixableCount === 0) {
    return '';
  }

  const hint = `Run with --fix to auto-fix ${fixableCount} ${fixableCount === 1 ? 'problem' : 'problems'}.`;
  return useColor ? chalk.gray(hint) : hint;
}

/**
 * Format check results for console output
 */
export function formatConsoleOutput(
  result: CheckResult,
  options: { noColor?: boolean; quiet?: boolean } = {}
): string {
  const useColor = !options.noColor && process.stdout.isTTY !== false;

  // In quiet mode, filter to only show errors
  const effectiveResult: CheckResult = options.quiet
    ? {
        ...result,
        results: result.results.map((r) => ({
          ...r,
          violations: r.violations.filter((v) => v.severity === 'error'),
        })),
        summary: {
          ...result.summary,
          warnings: 0,
        },
      }
    : result;

  // If quiet mode and no errors, return empty
  if (options.quiet && effectiveResult.summary.errors === 0) {
    return '';
  }

  const lines: string[] = [];

  // Format each file with violations
  for (const fileResult of effectiveResult.results) {
    const formatted = formatFileResult(fileResult, useColor);
    if (formatted) {
      lines.push(formatted);
      lines.push(''); // Empty line between files
    }
  }

  // Summary
  lines.push(formatSummary(effectiveResult.summary.errors, effectiveResult.summary.warnings, useColor));

  // Fixable hint
  const fixableCount = effectiveResult.results
    .flatMap((r) => r.violations)
    .filter((v) => v.fixable).length;

  const fixableHint = formatFixableHint(fixableCount, useColor);
  if (fixableHint) {
    lines.push('');
    lines.push(fixableHint);
  }

  return lines.join('\n');
}

/**
 * Format a compact single-line output per file
 */
export function formatCompactOutput(result: CheckResult): string {
  const lines: string[] = [];

  for (const fileResult of result.results) {
    for (const violation of fileResult.violations) {
      lines.push(
        `${fileResult.file}:${violation.line}:${violation.column}: ${violation.severity} - ${violation.message} (${violation.rule})`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Print results to console
 */
export function printResults(
  result: CheckResult,
  options: { noColor?: boolean; quiet?: boolean } = {}
): void {
  // In quiet mode, only show errors
  if (options.quiet) {
    const errorResults: CheckResult = {
      ...result,
      results: result.results.map((r) => ({
        ...r,
        violations: r.violations.filter((v) => v.severity === 'error'),
      })),
      summary: {
        ...result.summary,
        warnings: 0,
      },
    };

    const output = formatConsoleOutput(errorResults, options);
    if (errorResults.summary.errors > 0) {
      console.log(output);
    }
    return;
  }

  const output = formatConsoleOutput(result, options);
  console.log(output);
}
