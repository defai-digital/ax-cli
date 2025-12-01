/**
 * Path validation utilities to prevent security issues
 * Protects against path traversal attacks and invalid file operations
 */

import * as path from 'path';
import { z } from 'zod';

/**
 * Path validation schema
 */
export const PathSchema = z.string().min(1).refine(
  (filePath) => {
    // Resolve to absolute path and check if it's within the current working directory
    const resolved = path.resolve(filePath);
    const cwd = process.cwd();

    // Ensure path is within current working directory
    const isWithinCwd = resolved === cwd || resolved.startsWith(cwd + path.sep);
    if (!isWithinCwd) {
      return false;
    }

    // Additional check: block access to sensitive system directories
    // This is a defense-in-depth measure
    const dangerousPaths = ['/etc', '/sys', '/proc', '/dev', '/root', '/boot'];
    for (const dangerous of dangerousPaths) {
      if (resolved.startsWith(dangerous + path.sep) || resolved === dangerous) {
        return false;
      }
    }

    return true;
  },
  {
    message: 'Invalid or potentially dangerous file path',
  }
);

/**
 * Validate and resolve a file path safely
 * @throws Error if path is invalid or dangerous
 */
export function validatePath(filePath: string): string {
  const result = PathSchema.safeParse(filePath);

  if (!result.success) {
    throw new Error(`Invalid path: ${result.error.message}`);
  }

  return path.resolve(filePath);
}

/**
 * Check if a path is within a specific directory
 */
export function isPathWithin(filePath: string, baseDir: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);

  // Exact match or starts with base + path separator
  // This prevents false positives like /home/user/projects matching /home/user/project
  return resolvedPath === resolvedBase ||
         resolvedPath.startsWith(resolvedBase + path.sep);
}

/**
 * Safely join paths with validation
 */
export function safeJoin(...paths: string[]): string {
  const joined = path.join(...paths);
  return validatePath(joined);
}

/**
 * Check if path is safe for file operations
 */
export function isPathSafe(filePath: string): boolean {
  try {
    validatePath(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get relative path safely
 */
export function safeRelative(from: string, to: string): string {
  const validFrom = validatePath(from);
  const validTo = validatePath(to);
  return path.relative(validFrom, validTo);
}

/**
 * Result type for path resolution with validation
 */
export interface PathResolutionResult {
  success: true;
  path: string;
}

export interface PathResolutionError {
  success: false;
  error: string;
}

export type PathResolution = PathResolutionResult | PathResolutionError;

/**
 * Resolve and validate a path with optional file existence checks
 *
 * @param filePath - The path to resolve
 * @param options - Optional validation requirements
 * @returns PathResolution with either the resolved path or an error
 *
 * @example
 * ```typescript
 * const result = await resolveAndValidatePath('/path/to/file', {
 *   mustExist: true,
 *   mustBeFile: true
 * });
 * if (!result.success) {
 *   return { success: false, error: result.error };
 * }
 * const resolvedPath = result.path;
 * ```
 */
export async function resolveAndValidatePath(
  filePath: string,
  options?: {
    mustExist?: boolean;
    mustBeFile?: boolean;
    mustBeDirectory?: boolean;
  }
): Promise<PathResolution> {
  try {
    // Validate path safety first
    const resolved = validatePath(filePath);

    // If existence check requested, import fs-extra dynamically
    if (options?.mustExist) {
      const fs = await import('fs-extra');

      if (!(await fs.pathExists(resolved))) {
        return {
          success: false,
          error: `Path not found: ${filePath}`
        };
      }

      // Perform stat call once if type checking is needed
      if (options.mustBeFile || options.mustBeDirectory) {
        const stats = await fs.stat(resolved);

        if (options.mustBeFile && !stats.isFile()) {
          return {
            success: false,
            error: `Not a file: ${filePath}`
          };
        }

        if (options.mustBeDirectory && !stats.isDirectory()) {
          return {
            success: false,
            error: `Not a directory: ${filePath}`
          };
        }
      }
    }

    return {
      success: true,
      path: resolved
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Invalid path: ${error.message}`
    };
  }
}
