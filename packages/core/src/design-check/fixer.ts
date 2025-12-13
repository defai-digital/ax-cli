/**
 * Design Check Fixer
 * Auto-fix module for design system violations
 */

import * as fs from 'fs';
import type { Violation, FileContent, DesignCheckConfig } from './types.js';

/**
 * Result of fixing a single violation
 */
export interface FixResult {
  /** The original violation */
  violation: Violation;
  /** Whether the fix was applied */
  applied: boolean;
  /** The replacement value used */
  replacement?: string;
  /** Error message if fix failed */
  error?: string;
}

/**
 * Result of fixing a file
 */
export interface FileFixResult {
  /** File path */
  file: string;
  /** Original content */
  originalContent: string;
  /** Fixed content */
  fixedContent: string;
  /** Backup file path */
  backupPath?: string;
  /** Individual fix results */
  fixes: FixResult[];
  /** Total fixes applied */
  appliedCount: number;
  /** Total fixes skipped/failed */
  skippedCount: number;
}

/**
 * Options for the fixer
 */
export interface FixerOptions {
  /** Create backup files before modifying */
  backup: boolean;
  /** Dry run - don't actually write files */
  dryRun: boolean;
}

const DEFAULT_OPTIONS: FixerOptions = {
  backup: true,
  dryRun: false,
};

/**
 * Create a backup of a file
 */
export function createBackup(filePath: string): string {
  const backupPath = `${filePath}.ax-backup`;
  const content = fs.readFileSync(filePath, 'utf-8');
  fs.writeFileSync(backupPath, content, 'utf-8');
  return backupPath;
}

/**
 * Restore a file from backup
 */
export function restoreFromBackup(filePath: string, backupPath: string): void {
  if (fs.existsSync(backupPath)) {
    const content = fs.readFileSync(backupPath, 'utf-8');
    fs.writeFileSync(filePath, content, 'utf-8');
    fs.unlinkSync(backupPath);
  }
}

/**
 * Clean up backup file after successful fix
 */
export function cleanupBackup(backupPath: string): void {
  if (fs.existsSync(backupPath)) {
    fs.unlinkSync(backupPath);
  }
}

/**
 * Normalize a color to lowercase hex format
 */
function normalizeColorToHex(color: string): string {
  const trimmed = color.trim().toLowerCase();

  // Already hex
  if (trimmed.startsWith('#')) {
    // Expand shorthand: #fff -> #ffffff
    if (trimmed.length === 4) {
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
    }
    return trimmed.substring(0, 7);
  }

  // Convert RGB to hex
  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  return trimmed;
}

/**
 * Find the matching token for a color
 */
function findColorToken(
  color: string,
  tokens: Record<string, string>
): string | null {
  const normalizedColor = normalizeColorToHex(color);

  for (const [name, value] of Object.entries(tokens)) {
    const normalizedToken = normalizeColorToHex(value);
    if (normalizedColor === normalizedToken) {
      return name;
    }
  }

  return null;
}

/**
 * Find the matching token for a spacing value
 */
function findSpacingToken(
  value: string,
  tokens: Record<string, string>
): string | null {
  const normalized = value.toLowerCase();

  for (const [name, tokenValue] of Object.entries(tokens)) {
    if (tokenValue.toLowerCase() === normalized) {
      return name;
    }
  }

  return null;
}

/**
 * Generate replacement for a color violation
 * Returns the token name or CSS variable
 */
function generateColorReplacement(
  found: string,
  config: DesignCheckConfig
): string | null {
  const token = findColorToken(found, config.tokens.colors);
  if (token) {
    // Return the token value for direct replacement
    return config.tokens.colors[token];
  }
  return null;
}

/**
 * Generate replacement for a spacing violation
 */
function generateSpacingReplacement(
  found: string,
  config: DesignCheckConfig
): string | null {
  const token = findSpacingToken(found, config.tokens.spacing);
  if (token) {
    return config.tokens.spacing[token];
  }

  // Try to find nearest token for better UX
  const pxValue = parseInt(found.replace('px', ''), 10);
  if (isNaN(pxValue)) return null;

  let nearestToken: string | null = null;
  let nearestDistance = Infinity;

  for (const [name, value] of Object.entries(config.tokens.spacing)) {
    const tokenPx = parseInt(value.replace('px', ''), 10);
    if (isNaN(tokenPx)) continue;

    const distance = Math.abs(pxValue - tokenPx);
    if (distance < nearestDistance && distance <= 4) {
      // Only suggest if within 4px
      nearestDistance = distance;
      nearestToken = name;
    }
  }

  if (nearestToken) {
    return config.tokens.spacing[nearestToken];
  }

  return null;
}

/**
 * Apply a single fix to content
 * Returns the new content and whether the fix was applied
 */
function applySingleFix(
  content: string,
  violation: Violation,
  config: DesignCheckConfig
): { content: string; applied: boolean; replacement?: string; error?: string } {
  // Only fix fixable violations
  if (!violation.fixable) {
    return { content, applied: false, error: 'Not fixable' };
  }

  let replacement: string | null = null;

  // Generate replacement based on rule
  switch (violation.rule) {
    case 'no-hardcoded-colors':
      replacement = generateColorReplacement(violation.found, config);
      break;
    case 'no-raw-spacing':
      replacement = generateSpacingReplacement(violation.found, config);
      break;
    default:
      return { content, applied: false, error: 'Rule not supported for auto-fix' };
  }

  if (!replacement) {
    return { content, applied: false, error: 'No matching token found' };
  }

  // If the replacement is the same as what's found, skip
  if (replacement.toLowerCase() === violation.found.toLowerCase()) {
    return { content, applied: false, error: 'Already using correct value' };
  }

  // Find and replace the violation
  // We search for the value on the specified line
  const lines = content.split('\n');
  const lineIndex = violation.line - 1;

  if (lineIndex < 0 || lineIndex >= lines.length) {
    return { content, applied: false, error: 'Line out of bounds' };
  }

  const line = lines[lineIndex];

  // Search for the found value anywhere on the line
  const valueRegex = new RegExp(escapeRegExp(violation.found), 'gi');
  const matches = [...line.matchAll(valueRegex)];

  if (matches.length === 0) {
    return { content, applied: false, error: 'Could not locate violation value on line' };
  }

  // If multiple matches, prefer the one closest to the reported column
  let bestMatch = matches[0];
  const colIndex = violation.column - 1;

  if (matches.length > 1) {
    let minDistance = Infinity;
    for (const match of matches) {
      const distance = Math.abs((match.index ?? 0) - colIndex);
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = match;
      }
    }
  }

  // Replace only the first occurrence found (the best match)
  const matchIndex = bestMatch.index ?? 0;
  const beforeMatch = line.substring(0, matchIndex);
  const afterMatch = line.substring(matchIndex + violation.found.length);
  lines[lineIndex] = beforeMatch + replacement + afterMatch;

  return {
    content: lines.join('\n'),
    applied: true,
    replacement,
  };
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Apply fixes to a file
 */
export function applyFixes(
  file: FileContent,
  violations: Violation[],
  config: DesignCheckConfig,
  _options: Partial<FixerOptions> = {}
): FileFixResult {
  // Note: options are used by writeFixedFile, not here
  const result: FileFixResult = {
    file: file.path,
    originalContent: file.content,
    fixedContent: file.content,
    fixes: [],
    appliedCount: 0,
    skippedCount: 0,
  };

  // Filter to only fixable violations
  const fixableViolations = violations.filter((v) => v.fixable);

  if (fixableViolations.length === 0) {
    return result;
  }

  // Sort violations by position (reverse order) to apply from end to start
  // This prevents position shifts from affecting earlier fixes
  const sortedViolations = [...fixableViolations].sort((a, b) => {
    if (a.line !== b.line) return b.line - a.line;
    return b.column - a.column;
  });

  // Apply each fix
  let currentContent = file.content;

  for (const violation of sortedViolations) {
    const fixAttempt = applySingleFix(currentContent, violation, config);

    const fixResult: FixResult = {
      violation,
      applied: fixAttempt.applied,
      replacement: fixAttempt.replacement,
      error: fixAttempt.error,
    };

    result.fixes.push(fixResult);

    if (fixAttempt.applied) {
      currentContent = fixAttempt.content;
      result.appliedCount++;
    } else {
      result.skippedCount++;
    }
  }

  result.fixedContent = currentContent;

  return result;
}

/**
 * Write fixes to file with backup
 */
export function writeFixedFile(
  fixResult: FileFixResult,
  options: Partial<FixerOptions> = {}
): { success: boolean; backupPath?: string; error?: string } {
  const opts: FixerOptions = { ...DEFAULT_OPTIONS, ...options };

  // Nothing to write if no fixes applied
  if (fixResult.appliedCount === 0) {
    return { success: true };
  }

  // Dry run - don't write
  if (opts.dryRun) {
    return { success: true };
  }

  try {
    // Create backup if enabled
    let backupPath: string | undefined;
    if (opts.backup) {
      backupPath = createBackup(fixResult.file);
    }

    // Write the fixed content
    fs.writeFileSync(fixResult.file, fixResult.fixedContent, 'utf-8');

    return { success: true, backupPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Fix a single file end-to-end
 */
export async function fixFile(
  file: FileContent,
  violations: Violation[],
  config: DesignCheckConfig,
  options: Partial<FixerOptions> = {}
): Promise<FileFixResult & { written: boolean; error?: string }> {
  // Apply fixes
  const fixResult = applyFixes(file, violations, config, options);

  // Write to disk
  const writeResult = writeFixedFile(fixResult, options);

  return {
    ...fixResult,
    backupPath: writeResult.backupPath,
    written: writeResult.success && fixResult.appliedCount > 0,
    error: writeResult.error,
  };
}

/**
 * Calculate token coverage statistics
 */
export interface CoverageStats {
  /** Total color values found */
  totalColors: number;
  /** Colors using tokens */
  tokenizedColors: number;
  /** Color coverage percentage */
  colorCoverage: number;
  /** Total spacing values found */
  totalSpacing: number;
  /** Spacing using tokens */
  tokenizedSpacing: number;
  /** Spacing coverage percentage */
  spacingCoverage: number;
  /** Overall coverage percentage */
  overallCoverage: number;
}

/**
 * Calculate token coverage from check results
 */
export function calculateCoverage(
  totalColorViolations: number,
  totalSpacingViolations: number,
  estimatedTotalColors: number,
  estimatedTotalSpacing: number
): CoverageStats {
  const tokenizedColors = Math.max(0, estimatedTotalColors - totalColorViolations);
  const tokenizedSpacing = Math.max(0, estimatedTotalSpacing - totalSpacingViolations);

  const colorCoverage = estimatedTotalColors > 0
    ? (tokenizedColors / estimatedTotalColors) * 100
    : 100;

  const spacingCoverage = estimatedTotalSpacing > 0
    ? (tokenizedSpacing / estimatedTotalSpacing) * 100
    : 100;

  const totalValues = estimatedTotalColors + estimatedTotalSpacing;
  const totalTokenized = tokenizedColors + tokenizedSpacing;
  const overallCoverage = totalValues > 0
    ? (totalTokenized / totalValues) * 100
    : 100;

  return {
    totalColors: estimatedTotalColors,
    tokenizedColors,
    colorCoverage: Math.round(colorCoverage * 10) / 10,
    totalSpacing: estimatedTotalSpacing,
    tokenizedSpacing,
    spacingCoverage: Math.round(spacingCoverage * 10) / 10,
    overallCoverage: Math.round(overallCoverage * 10) / 10,
  };
}
