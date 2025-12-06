/**
 * File Mentions Parser
 *
 * Parses @filename syntax in user input and expands it to include file contents.
 *
 * @packageDocumentation
 */

import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

/**
 * A file mention found in input
 */
export interface FileMention {
  /** The full match string (e.g., "@src/index.ts") */
  match: string;
  /** The file path (e.g., "src/index.ts") */
  path: string;
  /** Start position in the input */
  start: number;
  /** End position in the input */
  end: number;
  /** Whether the file exists */
  exists: boolean;
  /** Whether it's a directory */
  isDirectory: boolean;
  /** File content if it exists and is readable */
  content?: string;
  /** Error message if file couldn't be read */
  error?: string;
}

/**
 * Result of parsing file mentions
 */
export interface ParseResult {
  /** Original input */
  originalInput: string;
  /** Expanded input with file contents */
  expandedInput: string;
  /** List of file mentions found */
  mentions: FileMention[];
  /** Whether any mentions were found */
  hasMentions: boolean;
}

/**
 * Configuration for file mention parsing
 */
export interface ParseConfig {
  /** Base directory for relative paths */
  baseDir?: string;
  /** Maximum file size to include (bytes, default: 100KB) */
  maxFileSize?: number;
  /** Maximum number of mentions to process (default: 10) */
  maxMentions?: number;
  /** Whether to include file contents in expansion (default: true) */
  includeContents?: boolean;
  /** File extensions to allow (default: all) */
  allowedExtensions?: string[];
}

/** Default maximum file size (100KB) */
const DEFAULT_MAX_FILE_SIZE = 100 * 1024;

/** Default maximum mentions */
const DEFAULT_MAX_MENTIONS = 10;

/**
 * Pattern to match @filename mentions
 * Matches: @path/to/file.ext or @./path or @../path
 * Does not match: email@example.com, @username (without path separators or extensions)
 */
const FILE_MENTION_PATTERN = /@(\.{0,2}\/[^\s@]+|[^\s@]+\.[a-zA-Z0-9]+)/g;

/**
 * Check if a path looks like a file path (not an email or username)
 */
function isFilePath(pathStr: string): boolean {
  // Must have a file extension or be a relative/absolute path
  if (pathStr.includes("/") || pathStr.includes("\\")) {
    return true;
  }

  // Check for file extension
  const extMatch = pathStr.match(/\.([a-zA-Z0-9]+)$/);
  if (extMatch) {
    // Exclude common non-file extensions (email domains)
    const ext = extMatch[1].toLowerCase();
    const emailDomains = ["com", "org", "net", "io", "dev", "co", "ai"];
    if (emailDomains.includes(ext)) {
      // Could be an email - check if there's @ before this
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Read file content with size limit
 */
function readFileContent(
  filePath: string,
  maxSize: number
): { content: string; error?: string } {
  try {
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      // List directory contents
      const entries = fs.readdirSync(filePath);
      const content = entries
        .map((entry) => {
          const fullPath = path.join(filePath, entry);
          const isDir = fs.statSync(fullPath).isDirectory();
          return isDir ? `${entry}/` : entry;
        })
        .join("\n");
      return { content: `Directory listing for ${filePath}:\n${content}` };
    }

    if (stats.size > maxSize) {
      return {
        content: "",
        error: `File too large (${Math.round(stats.size / 1024)}KB > ${Math.round(maxSize / 1024)}KB limit)`,
      };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    return { content };
  } catch (error) {
    return {
      content: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Resolve a file path, handling globs
 */
async function resolvePath(
  pathStr: string,
  baseDir: string
): Promise<string[]> {
  // Handle absolute paths
  if (path.isAbsolute(pathStr)) {
    if (fs.existsSync(pathStr)) {
      return [pathStr];
    }
    return [];
  }

  // Resolve relative to base directory
  const resolvedPath = path.resolve(baseDir, pathStr);

  // Check if it's a glob pattern
  if (pathStr.includes("*")) {
    try {
      const matches = await glob(pathStr, { cwd: baseDir, absolute: true });
      return matches;
    } catch {
      return [];
    }
  }

  if (fs.existsSync(resolvedPath)) {
    return [resolvedPath];
  }

  return [];
}

/**
 * Parse file mentions in user input
 */
export async function parseFileMentions(
  input: string,
  config: ParseConfig = {}
): Promise<ParseResult> {
  const {
    baseDir = process.cwd(),
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    maxMentions = DEFAULT_MAX_MENTIONS,
    includeContents = true,
    allowedExtensions,
  } = config;

  const mentions: FileMention[] = [];
  const expansions: Array<{ match: string; expansion: string }> = [];
  let mentionCount = 0;

  // Find all potential file mentions
  const matches = Array.from(input.matchAll(FILE_MENTION_PATTERN));

  for (const match of matches) {
    if (mentionCount >= maxMentions) {
      break;
    }

    const fullMatch = match[0];
    const pathStr = match[1];

    // Skip if it doesn't look like a file path
    if (!isFilePath(pathStr)) {
      continue;
    }

    // Check allowed extensions
    if (allowedExtensions && allowedExtensions.length > 0) {
      const ext = path.extname(pathStr).toLowerCase().slice(1);
      if (ext && !allowedExtensions.includes(ext)) {
        continue;
      }
    }

    // Resolve the path
    const resolvedPaths = await resolvePath(pathStr, baseDir);

    if (resolvedPaths.length === 0) {
      mentions.push({
        match: fullMatch,
        path: pathStr,
        start: match.index || 0,
        end: (match.index || 0) + fullMatch.length,
        exists: false,
        isDirectory: false,
        error: "File not found",
      });
      mentionCount++;
      continue;
    }

    // Process each resolved path
    for (const resolvedPath of resolvedPaths) {
      if (mentionCount >= maxMentions) {
        break;
      }

      let isDirectory = false;
      try {
        isDirectory = fs.statSync(resolvedPath).isDirectory();
      } catch {
        // File was deleted between check and now, skip it
        continue;
      }
      const { content, error } = includeContents
        ? readFileContent(resolvedPath, maxFileSize)
        : { content: undefined, error: undefined };

      const mention: FileMention = {
        match: fullMatch,
        path: pathStr,
        start: match.index || 0,
        end: (match.index || 0) + fullMatch.length,
        exists: true,
        isDirectory,
        content,
        error,
      };

      mentions.push(mention);
      mentionCount++;

      // Collect expansion for later (to avoid replacing inside already-expanded content)
      if (includeContents && content) {
        const relativePath = path.relative(baseDir, resolvedPath);
        const expansion = `\n\n<file path="${relativePath}">\n${content}\n</file>\n\n`;
        expansions.push({ match: fullMatch, expansion });
      }
    }
  }

  // Apply expansions to input (each match only once, using unique marker)
  let expandedInput = input;
  const processed = new Set<string>();
  for (const { match, expansion } of expansions) {
    if (!processed.has(match)) {
      expandedInput = expandedInput.replace(match, `${match}${expansion}`);
      processed.add(match);
    }
  }

  return {
    originalInput: input,
    expandedInput: mentions.length > 0 ? expandedInput : input,
    mentions,
    hasMentions: mentions.length > 0,
  };
}

/**
 * Simple synchronous version for quick checks
 */
export function hasFileMentions(input: string): boolean {
  const matches = input.match(FILE_MENTION_PATTERN);
  if (!matches) return false;

  return matches.some((match) => {
    const pathStr = match.slice(1); // Remove @
    return isFilePath(pathStr);
  });
}

/**
 * Extract just the file paths from mentions (without reading content)
 */
export function extractFilePaths(input: string): string[] {
  const matches = Array.from(input.matchAll(FILE_MENTION_PATTERN));
  const paths: string[] = [];

  for (const match of matches) {
    const pathStr = match[1];
    if (isFilePath(pathStr)) {
      paths.push(pathStr);
    }
  }

  return paths;
}
