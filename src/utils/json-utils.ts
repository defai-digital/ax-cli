/**
 * JSON Parsing Utilities
 * Centralized JSON operations with validation and error handling
 */

import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'fs';
import { z } from 'zod';

/**
 * Parse JSON string with Zod schema validation
 */
export function parseJson<T>(
  jsonString: string,
  schema?: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(jsonString);

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
 */
export function writeJsonFile<T>(
  filePath: string,
  data: T,
  schema?: z.ZodSchema<T>,
  pretty = true
): { success: true } | { success: false; error: string } {
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

    // Atomic write pattern: write to temp file, then rename
    // This prevents corruption if process crashes during write
    const tempFile = `${filePath}.tmp`;
    writeFileSync(tempFile, stringifyResult.json, 'utf8');

    // Atomic rename - if this succeeds, we know the write was complete
    renameSync(tempFile, filePath);

    return { success: true };
  } catch (error) {
    // Clean up temp file if it exists
    try {
      const tempFile = `${filePath}.tmp`;
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    } catch {
      // Ignore cleanup errors
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
