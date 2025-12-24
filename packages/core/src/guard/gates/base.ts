/**
 * Base Gate Implementation
 *
 * Provides common utilities for gate implementations.
 *
 * @packageDocumentation
 */

import type { GateType, GuardCheckResult, GateResult } from '@defai.digital/ax-schemas';

/**
 * Create a guard check result
 */
export function createCheckResult(
  gate: GateType,
  result: GateResult,
  message: string,
  startTime: number,
  details?: Record<string, unknown>
): GuardCheckResult {
  return {
    gate,
    result,
    message,
    details,
    duration: Date.now() - startTime,
  };
}

/**
 * Create a PASS result
 */
export function pass(
  gate: GateType,
  message: string,
  startTime: number,
  details?: Record<string, unknown>
): GuardCheckResult {
  return createCheckResult(gate, 'PASS', message, startTime, details);
}

/**
 * Create a WARN result
 */
export function warn(
  gate: GateType,
  message: string,
  startTime: number,
  details?: Record<string, unknown>
): GuardCheckResult {
  return createCheckResult(gate, 'WARN', message, startTime, details);
}

/**
 * Create a FAIL result
 */
export function fail(
  gate: GateType,
  message: string,
  startTime: number,
  details?: Record<string, unknown>
): GuardCheckResult {
  return createCheckResult(gate, 'FAIL', message, startTime, details);
}

/**
 * Test a string against a list of patterns
 */
export function matchesAnyPattern(
  value: string,
  patterns: (string | RegExp)[]
): { matched: boolean; pattern?: string } {
  for (const pattern of patterns) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    if (regex.test(value)) {
      return { matched: true, pattern: pattern.toString() };
    }
  }
  return { matched: false };
}

/**
 * Test a string against multiple pattern lists
 */
export function findMatchingPatterns(
  value: string,
  patterns: (string | RegExp)[]
): string[] {
  const matches: string[] = [];
  for (const pattern of patterns) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    if (regex.test(value)) {
      matches.push(pattern.toString());
    }
  }
  return matches;
}
