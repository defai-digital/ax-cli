/**
 * Design Check File Scanner
 * Handles file discovery and content loading
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import type { FileContent } from './types.js';

/**
 * Maximum file size to process (1MB)
 */
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * File extensions we support
 */
const SUPPORTED_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js', '.css', '.scss'];

/**
 * Scan for files matching include patterns, excluding ignore patterns
 */
export async function scanFiles(
  paths: string[],
  include: string[],
  ignore: string[]
): Promise<string[]> {
  const cwd = process.cwd();
  const allFiles: Set<string> = new Set();

  // If specific paths provided, use those
  if (paths.length > 0) {
    for (const p of paths) {
      const absolutePath = path.isAbsolute(p) ? p : path.join(cwd, p);

      if (fs.existsSync(absolutePath)) {
        const stat = fs.statSync(absolutePath);

        if (stat.isDirectory()) {
          // Scan directory with include patterns
          const files = await scanDirectory(absolutePath, include, ignore);
          files.forEach((f) => allFiles.add(f));
        } else if (stat.isFile()) {
          // Add single file if supported and not ignored
          if (isSupportedFile(absolutePath) && !isIgnored(absolutePath, ignore)) {
            allFiles.add(absolutePath);
          }
        }
      }
    }
  } else {
    // No paths provided, scan with include patterns from cwd
    for (const pattern of include) {
      const matches = await glob(pattern, {
        cwd,
        absolute: true,
        ignore,
        nodir: true,
      });
      matches.forEach((f) => allFiles.add(f));
    }
  }

  return Array.from(allFiles).sort();
}

/**
 * Scan a directory for matching files
 */
async function scanDirectory(
  dir: string,
  include: string[],
  ignore: string[]
): Promise<string[]> {
  const files: string[] = [];

  for (const pattern of include) {
    const matches = await glob(pattern, {
      cwd: dir,
      absolute: true,
      ignore,
      nodir: true,
    });
    files.push(...matches);
  }

  return files;
}

/**
 * Check if a file extension is supported
 */
function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Check if a file matches any ignore pattern
 * Supports common glob patterns: **, *, ?
 */
function isIgnored(filePath: string, ignorePatterns: string[]): boolean {
  if (ignorePatterns.length === 0) {
    return false;
  }

  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileName = path.basename(normalizedPath);

  for (const pattern of ignorePatterns) {
    if (matchesPattern(normalizedPath, fileName, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Match a file path against a glob pattern
 */
function matchesPattern(filePath: string, fileName: string, pattern: string): boolean {
  // Normalize pattern
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // Handle **/ prefix (any directory depth)
  if (normalizedPattern.startsWith('**/')) {
    const rest = normalizedPattern.slice(3);
    // Check against filename or any suffix of the path
    if (matchesSimplePattern(fileName, rest)) {
      return true;
    }
    // Check if any suffix of path matches
    const parts = filePath.split('/');
    for (let i = 0; i < parts.length; i++) {
      const suffix = parts.slice(i).join('/');
      if (matchesSimplePattern(suffix, rest)) {
        return true;
      }
    }
    return false;
  }

  // Handle exact or simple patterns
  return matchesSimplePattern(filePath, normalizedPattern) ||
         matchesSimplePattern(fileName, normalizedPattern);
}

/**
 * Match a string against a simple glob pattern (with * and ?)
 */
function matchesSimplePattern(str: string, pattern: string): boolean {
  // Convert glob to regex, escaping special chars except * and ?
  let regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
    .replace(/\*\*/g, '{{GLOBSTAR}}')       // Temp placeholder for **
    .replace(/\*/g, '[^/]*')                // * matches any chars except /
    .replace(/{{GLOBSTAR}}/g, '.*')         // ** matches anything including /
    .replace(/\?/g, '.');                   // ? matches single char

  try {
    const regex = new RegExp(`^${regexStr}$`, 'i');
    return regex.test(str);
  } catch {
    return false;
  }
}

/**
 * Read a file safely, handling errors and limits
 */
export async function readFileSafe(filePath: string): Promise<FileContent | null> {
  try {
    // Check file exists
    if (!fs.existsSync(filePath)) {
      return null;
    }

    // Check file size
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      console.warn(`Skipping ${filePath}: file too large (${formatSize(stats.size)})`);
      return null;
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for binary content (null bytes)
    if (content.includes('\0')) {
      return null;
    }

    // Split into lines for location tracking
    const lines = content.split('\n');

    return {
      path: filePath,
      content,
      lines,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Skipping ${filePath}: ${message}`);
    return null;
  }
}

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get line and column from an index in content
 */
export function getLocationFromIndex(
  content: string,
  index: number
): { line: number; column: number } {
  const beforeMatch = content.substring(0, index);
  const lines = beforeMatch.split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;

  return { line, column };
}

/**
 * Check for ignore comments in file content
 */
export function hasIgnoreFileComment(lines: string[]): boolean {
  // Check first 10 lines for file-level ignore
  const checkLines = lines.slice(0, 10);
  return checkLines.some((line) =>
    /\/\/\s*ax-ignore-file|\/\*\s*ax-ignore-file\s*\*\//.test(line)
  );
}

/**
 * Check if a specific line has an ignore comment for a rule
 */
export function hasIgnoreLineComment(
  lines: string[],
  lineNumber: number,
  ruleId: string
): boolean {
  // Check the line before for ignore-next-line comment
  if (lineNumber <= 1) {
    return false;
  }

  const prevLine = lines[lineNumber - 2]; // lines is 0-indexed, lineNumber is 1-indexed
  if (!prevLine) {
    return false;
  }

  // Match: // ax-ignore-next-line or // ax-ignore-next-line rule-id
  const ignoreMatch = prevLine.match(
    /\/\/\s*ax-ignore-next-line(?:\s+(\S+))?|\/\*\s*ax-ignore-next-line(?:\s+(\S+))?\s*\*\//
  );

  if (!ignoreMatch) {
    return false;
  }

  const specifiedRule = ignoreMatch[1] || ignoreMatch[2];

  // If no specific rule mentioned, ignore all rules
  if (!specifiedRule) {
    return true;
  }

  // If specific rule mentioned, only ignore that rule
  return specifiedRule === ruleId;
}

/**
 * Filter violations based on ignore comments
 */
export function filterIgnoredViolations<T extends { rule: string; line: number }>(
  violations: T[],
  lines: string[]
): T[] {
  // Check for file-level ignore
  if (hasIgnoreFileComment(lines)) {
    return [];
  }

  // Filter out violations with line-level ignores
  return violations.filter((v) => !hasIgnoreLineComment(lines, v.line, v.rule));
}
