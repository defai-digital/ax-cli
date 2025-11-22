/**
 * JSON Parsing Utilities
 * Centralized JSON operations with validation and error handling
 *
 * Security: REQ-SEC-005 - Prototype Pollution Prevention
 * - Sanitizes dangerous keys (__proto__, constructor, prototype)
 * - Validates JSON structure before use
 * - Prevents object property injection attacks
 */

import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, copyFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { z } from 'zod';

/**
 * Dangerous keys that can cause prototype pollution
 * These keys should never be allowed in parsed JSON
 */
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

/**
 * Sanitize parsed JSON by removing dangerous keys
 * Prevents prototype pollution attacks (REQ-SEC-005)
 *
 * @param obj - Object to sanitize (recursively)
 * @returns Sanitized object with dangerous keys removed
 */
function sanitizeObject<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as T;
  }

  // Handle objects
  const sanitized: Record<string, unknown> = {};

  for (const key in obj) {
    // Skip dangerous keys
    if (DANGEROUS_KEYS.includes(key as typeof DANGEROUS_KEYS[number])) {
      continue;
    }

    // Skip inherited properties
    if (!Object.prototype.hasOwnProperty.call(obj, key)) {
      continue;
    }

    // Recursively sanitize nested objects
    const value = (obj as Record<string, unknown>)[key];
    sanitized[key] = sanitizeObject(value);
  }

  return sanitized as T;
}

/**
 * Parse JSON string with Zod schema validation
 */
export function parseJson<T>(
  jsonString: string,
  schema?: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  try {
    const rawData = JSON.parse(jsonString);

    // SECURITY: Sanitize to prevent prototype pollution (REQ-SEC-005)
    const data = sanitizeObject(rawData);

    if (schema) {
      const result = schema.safeParse(data);
      if (!result.success) {
        return {
          success: false,
          error: `Validation failed: ${result.error.message}`,
        };
      }
      return { success: true, data: result.data };
    }

    return { success: true, data: data as T };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
}

/**
 * Parse JSON file with Zod schema validation
 */
export function parseJsonFile<T>(
  filePath: string,
  schema?: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  try {
    const content = readFileSync(filePath, 'utf8');
    return parseJson<T>(content, schema);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read file',
    };
  }
}

/**
 * Safely stringify JSON with error handling
 */
export function stringifyJson(
  data: unknown,
  pretty = false
): { success: true; json: string } | { success: false; error: string } {
  try {
    const json = JSON.stringify(data, null, pretty ? 2 : 0);
    return { success: true, json };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stringify',
    };
  }
}

/**
 * Write JSON file with validation and formatting
 * Uses atomic write pattern (temp file + rename) to prevent corruption
 *
 * Bug fixes:
 * - Uses unique temp file names (PID + timestamp) to prevent race conditions
 * - Handles cross-filesystem renames with copy+delete fallback
 * - Ensures parent directory exists
 * - Cleans up stale temp files
 */
export function writeJsonFile<T>(
  filePath: string,
  data: T,
  schema?: z.ZodSchema<T>,
  pretty = true
): { success: true } | { success: false; error: string } {
  let tempFile: string | undefined;

  try {
    // Validate before writing
    if (schema) {
      const result = schema.safeParse(data);
      if (!result.success) {
        return {
          success: false,
          error: `Validation failed: ${result.error.message}`,
        };
      }
    }

    const stringifyResult = stringifyJson(data, pretty);
    if (!stringifyResult.success) {
      return stringifyResult;
    }

    // Ensure parent directory exists (Bug #24 fix)
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
      } catch (mkdirError) {
        return {
          success: false,
          error: `Cannot create directory ${dir}: ${mkdirError instanceof Error ? mkdirError.message : 'Unknown error'}`,
        };
      }
    }

    // Create unique temp file name to prevent race conditions (Bug #21 fix)
    // Format: <filepath>.tmp.<pid>.<timestamp>
    tempFile = `${filePath}.tmp.${process.pid}.${Date.now()}`;

    // Clean up any stale temp files from this process (Bug #23 fix)
    // Check if our specific temp file already exists from a crashed previous write
    try {
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    } catch {
      // Ignore stale file cleanup errors
    }

    // Atomic write pattern: write to temp file, then rename
    // This prevents corruption if process crashes during write
    writeFileSync(tempFile, stringifyResult.json, 'utf8');

    // Atomic rename - if this succeeds, we know the write was complete
    try {
      renameSync(tempFile, filePath);
    } catch (renameError: any) {
      // Handle cross-filesystem rename (Bug #22 fix)
      if (renameError.code === 'EXDEV') {
        // Fallback: copy + delete (not atomic, but works across filesystems)
        try {
          copyFileSync(tempFile, filePath);
          unlinkSync(tempFile);
        } catch (copyError) {
          throw new Error(`Cross-filesystem copy failed: ${copyError instanceof Error ? copyError.message : 'Unknown error'}`);
        }
      } else {
        throw renameError;
      }
    }

    return { success: true };
  } catch (error) {
    // Clean up temp file if it exists
    if (tempFile) {
      try {
        if (existsSync(tempFile)) {
          unlinkSync(tempFile);
        }
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to write file',
    };
  }
}

/**
 * Parse JSON with fallback value on error
 */
export function parseJsonWithFallback<T>(
  jsonString: string,
  fallback: T,
  schema?: z.ZodSchema<T>
): T {
  const result = parseJson<T>(jsonString, schema);
  return result.success ? result.data : fallback;
}

/**
 * Parse JSON file with fallback value on error
 */
export function parseJsonFileWithFallback<T>(
  filePath: string,
  fallback: T,
  schema?: z.ZodSchema<T>
): T {
  const result = parseJsonFile<T>(filePath, schema);
  return result.success ? result.data : fallback;
}

/**
 * Sanitize an object to prevent prototype pollution
 * Exported for testing purposes
 *
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeJson<T>(obj: T): T {
  return sanitizeObject(obj);
}
