/**
 * Cross-platform path utility functions
 *
 * This module provides utilities for handling file paths consistently
 * across different operating systems (Windows, macOS, Linux).
 *
 * @module path-utils
 */

import path from 'node:path';
import os from 'node:os';
import { equalsIgnoreCase, containsIgnoreCase } from './string-utils.js';

/**
 * Normalize path separators to forward slashes (for display and logging)
 *
 * This function converts all path separators to forward slashes, which is
 * useful for consistent display across platforms and for comparison in tests.
 *
 * @example
 * // Windows
 * normalizePath('C:\\Users\\foo\\bar') // => 'C:/Users/foo/bar'
 *
 * // Unix
 * normalizePath('/Users/foo/bar') // => '/Users/foo/bar'
 *
 * @param filePath - The path to normalize
 * @returns Path with forward slashes (empty string if input is falsy)
 */
export function normalizePath(filePath: string): string {
  if (!filePath) return '';
  // Replace all backslashes with forward slashes
  // This works consistently across all platforms
  return filePath.replace(/\\/g, '/');
}

/**
 * Convert path to platform-native format (for filesystem operations)
 *
 * This function normalizes the path to use the platform's native separator,
 * which is necessary for filesystem operations.
 *
 * @example
 * // Windows
 * platformPath('foo/bar/baz') // => 'foo\\bar\\baz'
 *
 * // Unix
 * platformPath('foo/bar/baz') // => 'foo/bar/baz'
 *
 * @param filePath - The path to convert
 * @returns Path with platform-native separators (empty string if input is falsy)
 */
export function platformPath(filePath: string): string {
  if (!filePath) return '';
  return path.normalize(filePath);
}

/**
 * Check if running on Windows
 *
 * @returns True if running on Windows platform
 */
export function isWindows(): boolean {
  return os.platform() === 'win32';
}

/**
 * Compare two paths for equality (ignoring separator differences)
 *
 * This function compares two paths by normalizing both to forward slashes
 * and then comparing case-insensitively on Windows.
 *
 * @example
 * // Windows
 * pathsEqual('foo/bar', 'foo\\bar') // => true
 * pathsEqual('Foo/Bar', 'foo/bar') // => true
 *
 * // Unix
 * pathsEqual('foo/bar', 'foo/bar') // => true
 * pathsEqual('Foo/Bar', 'foo/bar') // => false
 *
 * @param path1 - First path to compare
 * @param path2 - Second path to compare
 * @returns True if paths are equal
 */
export function pathsEqual(path1: string, path2: string): boolean {
  // Handle null/undefined/empty cases
  if (!path1 || !path2) {
    return path1 === path2;
  }

  const normalized1 = normalizePath(path1);
  const normalized2 = normalizePath(path2);

  // Windows is case-insensitive
  if (isWindows()) {
    return equalsIgnoreCase(normalized1, normalized2);
  }

  return normalized1 === normalized2;
}

/**
 * Check if a path contains a segment (cross-platform)
 *
 * This function checks if a full path contains a specific segment,
 * normalizing both paths before comparison.
 *
 * @example
 * pathContains('/foo/bar/baz', 'bar/baz') // => true
 * pathContains('C:\\foo\\bar', 'bar') // => true
 *
 * @param fullPath - Full path to search in
 * @param segment - Segment to search for
 * @returns True if fullPath contains segment
 */
export function pathContains(fullPath: string, segment: string): boolean {
  if (!fullPath || !segment) {
    return false;
  }

  const normalizedFull = normalizePath(fullPath);
  const normalizedSegment = normalizePath(segment);

  // Windows is case-insensitive
  if (isWindows()) {
    return containsIgnoreCase(normalizedFull, normalizedSegment);
  }

  return normalizedFull.includes(normalizedSegment);
}
