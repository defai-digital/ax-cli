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
    // Prevent path traversal attempts
    const normalized = path.normalize(filePath);

    // Check for suspicious patterns
    return (
      !normalized.includes('..') &&
      !normalized.startsWith('/etc') &&
      !normalized.startsWith('/sys') &&
      !normalized.startsWith('/proc')
    );
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

  return resolvedPath.startsWith(resolvedBase);
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

      if (options.mustBeFile) {
        const stats = await fs.stat(resolved);
        if (!stats.isFile()) {
          return {
            success: false,
            error: `Not a file: ${filePath}`
          };
        }
      }

      if (options.mustBeDirectory) {
        const stats = await fs.stat(resolved);
        if (!stats.isDirectory()) {
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
