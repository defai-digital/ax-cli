/**
 * Injection Attempt Gate
 *
 * Detects injection attacks in inputs.
 *
 * @invariant INV-INJ-001: Check all string inputs
 * @invariant INV-INJ-002: Detect SQL, command, path, and template injection
 * @invariant INV-INJ-003: Log detected attempts for security audit
 *
 * @packageDocumentation
 */

import type {
  GateContext,
  GuardCheckResult,
  InjectionAttemptConfig,
} from '@defai.digital/ax-schemas';

import type { GateImplementation } from '../types.js';
import { pass, fail, findMatchingPatterns } from './base.js';

/**
 * SQL injection patterns
 */
const SQL_INJECTION_PATTERNS: RegExp[] = [
  /(?:union\s+select|union\s+all\s+select)/i,
  /;\s*(?:drop|delete|truncate|alter|update|insert)\s/i,
  /(?:'\s*or\s+'1'\s*=\s*'1|"\s*or\s+"1"\s*=\s*"1)/i,
  /(?:'\s*or\s+1\s*=\s*1|"\s*or\s+1\s*=\s*1)/i,
  /(?:'--\s*$|"--\s*$)/,
  /;\s*--\s*$/,
  /\/\*.*\*\//,
  /waitfor\s+delay/i,
  /benchmark\s*\(/i,
  /sleep\s*\(/i,
];

/**
 * Command injection patterns
 */
const COMMAND_INJECTION_PATTERNS: RegExp[] = [
  /(?:\||;|`|\$\(|\$\{).*(?:cat|ls|rm|mv|cp|chmod|chown|curl|wget|nc|bash|sh|python|perl|ruby|node)/i,
  /(?:&&|\|\|)\s*(?:cat|ls|rm|mv|cp|chmod|chown|curl|wget|nc|bash|sh|python|perl|ruby|node)/i,
  /\$\([^)]+\)/,
  /`[^`]+`/,
  />\s*\/(?:etc|dev|tmp)/i,
  /;\s*(?:cat|ls|rm|chmod|chown)\s/i,
  /\|\s*(?:bash|sh|zsh|ksh)\s*$/i,
];

/**
 * Path traversal patterns
 */
const PATH_TRAVERSAL_PATTERNS: RegExp[] = [
  // Basic path traversal - any ../ or ..\ at start or after separator
  /(?:^|[\/\\])\.\.(?:[\/\\]|$)/,
  // URL encoded traversal
  /(?:%2e%2e|%252e%252e)/i,
  /(?:%2f|%5c)/i,
  /(?:\.\.%2f|\.\.%5c)/i,
  // Null byte injection
  /(?:%00|%0a|%0d)/i,
];

/**
 * Template injection patterns
 */
const TEMPLATE_INJECTION_PATTERNS: RegExp[] = [
  /\{\{.*(?:constructor|prototype|__proto__|__defineGetter__|__defineSetter__).*\}\}/,
  /\$\{.*(?:process|require|import|eval|Function).*\}/,
  /<%.*(?:require|process|child_process).*%>/,
  /\{\{.*(?:self|config|settings|env).*\}\}/i,
  /#\{.*(?:system|exec|spawn).*\}/i,
];

/**
 * Script injection patterns
 */
const SCRIPT_INJECTION_PATTERNS: RegExp[] = [
  /<script\b[^>]*>[\s\S]*?<\/script>/i,
  /javascript:\s*[a-z]/i,
  /on(?:load|error|click|mouseover|focus)\s*=/i,
  /<img\s+[^>]*onerror\s*=/i,
  /<svg\s+[^>]*onload\s*=/i,
  /data:\s*text\/html/i,
];

/**
 * All default injection patterns
 */
const DEFAULT_INJECTION_PATTERNS: RegExp[] = [
  ...SQL_INJECTION_PATTERNS,
  ...COMMAND_INJECTION_PATTERNS,
  ...PATH_TRAVERSAL_PATTERNS,
  ...TEMPLATE_INJECTION_PATTERNS,
  ...SCRIPT_INJECTION_PATTERNS,
];

/**
 * Recursively extract all string values from a nested structure
 * Handles objects, arrays, and primitives up to a max depth to prevent DoS
 */
function extractStringsFromValue(
  value: unknown,
  strings: string[],
  depth = 0,
  maxDepth = 10
): void {
  // Prevent infinite recursion and DoS via deeply nested structures
  if (depth > maxDepth) {
    return;
  }

  if (typeof value === 'string') {
    strings.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      extractStringsFromValue(item, strings, depth + 1, maxDepth);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      extractStringsFromValue((value as Record<string, unknown>)[key], strings, depth + 1, maxDepth);
    }
  }
  // Skip null, undefined, numbers, booleans
}

/**
 * Injection Attempt Gate Implementation
 */
export class InjectionAttemptGate implements GateImplementation {
  check(
    context: Readonly<GateContext>,
    config?: InjectionAttemptConfig
  ): GuardCheckResult {
    const startTime = Date.now();

    // Collect all string inputs to check
    const stringsToCheck: string[] = [];

    if (context.content) {
      stringsToCheck.push(context.content);
    }

    if (context.command) {
      stringsToCheck.push(context.command);
    }

    if (context.filePath) {
      stringsToCheck.push(context.filePath);
    }

    // Check tool arguments (including nested values)
    if (context.toolArguments) {
      extractStringsFromValue(context.toolArguments, stringsToCheck);
    }

    // Nothing to check
    if (stringsToCheck.length === 0) {
      return pass('injection_attempt', 'No inputs to check', startTime);
    }

    // Build patterns list
    const patterns: (string | RegExp)[] = [];

    if (config?.useDefaultPatterns !== false) {
      patterns.push(...DEFAULT_INJECTION_PATTERNS);
    }

    if (config?.customPatterns) {
      patterns.push(
        ...config.customPatterns.map((p) => new RegExp(p, 'i'))
      );
    }

    // INV-INJ-001 & INV-INJ-002: Check all inputs
    for (const input of stringsToCheck) {
      const matches = findMatchingPatterns(input, patterns);

      if (matches.length > 0) {
        // INV-INJ-003: Return details for audit
        return fail(
          'injection_attempt',
          `Potential injection attack detected`,
          startTime,
          {
            matchCount: matches.length,
            patterns: matches.slice(0, 3), // Limit for security
            inputLength: input.length,
            reason: 'injection_detected',
            // Don't include the actual input for security
          }
        );
      }
    }

    return pass('injection_attempt', 'No injection patterns detected', startTime);
  }
}
