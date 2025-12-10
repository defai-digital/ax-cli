/**
 * Cross-platform path assertion helpers for tests
 *
 * These utilities ensure tests work consistently across platforms (Windows, macOS, Linux)
 * by normalizing path separators before comparison.
 */

import { expect } from 'vitest';
import { normalizePath, pathsEqual, pathContains } from '../../packages/core/src/utils/path-utils.js';

/**
 * Assert that two paths are equal (ignoring separator differences)
 *
 * @example
 * expectPathsToBeEqual('src/tools', 'src\\tools')  // passes on all platforms
 * expectPathsToBeEqual('src/tools', 'src/utils')  // fails
 *
 * @param actual - Actual path from code/test
 * @param expected - Expected path (use forward slashes)
 */
export function expectPathsToBeEqual(actual: string | undefined | null, expected: string): void {
  if (actual === undefined) {
    throw new Error(`Expected path to be ${expected}, but got undefined`);
  }

  if (actual === null) {
    throw new Error(`Expected path to be ${expected}, but got null`);
  }

  if (actual === '') {
    throw new Error(`Expected path to be ${expected}, but got empty string`);
  }

  const normalizedActual = normalizePath(actual);
  const normalizedExpected = normalizePath(expected);

  expect(normalizedActual).toBe(normalizedExpected);
}

/**
 * Assert that a path is normalized (uses forward slashes)
 *
 * @example
 * expectPathToBeNormalized('src/tools')    // passes
 * expectPathToBeNormalized('src\\tools')   // fails
 *
 * @param path - Path to check
 */
export function expectPathToBeNormalized(path: string): void {
  expect(path).toBe(normalizePath(path));
}

/**
 * Assert that a full path contains a segment (cross-platform)
 *
 * @example
 * expectPathToContain('/foo/bar/baz', 'bar/baz')  // passes
 * expectPathToContain('C:\\foo\\bar', 'bar')      // passes on Windows
 *
 * @param fullPath - Full path to search in
 * @param segment - Segment to search for
 */
export function expectPathToContain(fullPath: string, segment: string): void {
  if (!pathContains(fullPath, segment)) {
    throw new Error(`Expected "${fullPath}" to contain "${segment}"`);
  }
}

/**
 * Assert that two paths are NOT equal (ignoring separator differences)
 *
 * @example
 * expectPathsNotToBeEqual('src/tools', 'src/utils')  // passes
 * expectPathsNotToBeEqual('src/tools', 'src\\tools') // fails (they're equal)
 *
 * @param actual - Actual path from code/test
 * @param notExpected - Path that should NOT match
 */
export function expectPathsNotToBeEqual(actual: string, notExpected: string): void {
  if (pathsEqual(actual, notExpected)) {
    throw new Error(`Expected "${actual}" NOT to equal "${notExpected}"`);
  }
}
