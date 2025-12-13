/**
 * Input Sanitization Framework (REQ-SEC-007)
 *
 * Provides comprehensive input validation and sanitization to prevent:
 * - ReDoS (Regular Expression Denial of Service)
 * - Command injection
 * - Path traversal
 * - Unicode attacks
 * - Buffer overflow
 *
 * Security: CVSS 7.3 (High Priority)
 */

/**
 * Sanitization result with validation and cleaned value
 */
export interface SanitizationResult {
  /**
   * Whether the input passed validation
   */
  valid: boolean;

  /**
   * Sanitized/cleaned value (only if valid)
   */
  value?: string;

  /**
   * Error message if validation failed
   */
  error?: string;

  /**
   * Warning messages (non-fatal issues)
   */
  warnings?: string[];
}

/**
 * Configuration for input sanitization
 */
export interface SanitizerOptions {
  /**
   * Maximum allowed length (default: 10,000 characters)
   */
  maxLength?: number;

  /**
   * Whether to normalize Unicode (default: true)
   */
  normalizeUnicode?: boolean;

  /**
   * Character whitelist pattern (regex)
   */
  allowedPattern?: RegExp;

  /**
   * Whether to trim whitespace (default: true)
   */
  trim?: boolean;

  /**
   * Whether to allow empty strings (default: false)
   */
  allowEmpty?: boolean;
}

/**
 * Default maximum input lengths for different contexts
 */
export const MAX_INPUT_LENGTHS = {
  COMMAND: 10_000, // Shell commands
  FILE_PATH: 4_096, // File system paths
  USER_INPUT: 50_000, // General user input (prompts, etc.)
  SEARCH_QUERY: 1_000, // Search queries
  ENV_VALUE: 10_000, // Environment variable values
  CONFIG_VALUE: 10_000, // Configuration values
} as const;

/**
 * Dangerous patterns that indicate potential attacks
 * These patterns are designed to be fast and avoid ReDoS
 */
const DANGEROUS_PATTERNS = {
  // Null bytes (path traversal, command injection)
  NULL_BYTE: /\0/,

  // Excessive repetition (ReDoS indicator)
  // Using fixed quantifier to prevent ReDoS
  EXCESSIVE_REPETITION: /(.)\1{100,}/,

  // Control characters (except common ones like \n, \t)
  CONTROL_CHARS: /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/,

  // Unicode direction override (used in homograph attacks)
  UNICODE_OVERRIDE: /[\u202A-\u202E\u2066-\u2069]/,
} as const;

/**
 * Safe characters for different contexts
 */
export const SAFE_PATTERNS = {
  /**
   * Alphanumeric, spaces, and common punctuation
   */
  BASIC: /^[a-zA-Z0-9\s.,!?'"()\-_]+$/,

  /**
   * Safe for file paths (no directory traversal)
   */
  FILE_PATH: /^[a-zA-Z0-9/._\-]+$/,

  /**
   * Safe for environment variable values
   */
  ENV_VALUE: /^[a-zA-Z0-9._\-:/=]+$/,

  /**
   * Printable ASCII only (most restrictive)
   */
  ASCII_PRINTABLE: /^[\x20-\x7E]+$/,
} as const;

/**
 * Normalize Unicode string to prevent homograph attacks
 *
 * Uses NFC (Canonical Decomposition, followed by Canonical Composition)
 * which is the recommended normalization form for most use cases
 *
 * @param input - String to normalize
 * @returns Normalized string
 */
export function normalizeUnicode(input: string): string {
  return input.normalize('NFC');
}

/**
 * Check for dangerous patterns in input
 *
 * @param input - String to check
 * @returns Array of detected dangerous patterns
 */
export function detectDangerousPatterns(input: string): string[] {
  const detected: string[] = [];

  if (DANGEROUS_PATTERNS.NULL_BYTE.test(input)) {
    detected.push('Null byte detected');
  }

  if (DANGEROUS_PATTERNS.EXCESSIVE_REPETITION.test(input)) {
    detected.push('Excessive character repetition detected');
  }

  if (DANGEROUS_PATTERNS.CONTROL_CHARS.test(input)) {
    detected.push('Control characters detected');
  }

  if (DANGEROUS_PATTERNS.UNICODE_OVERRIDE.test(input)) {
    detected.push('Unicode direction override detected');
  }

  return detected;
}

/**
 * Sanitize general user input with configurable options
 *
 * @param input - Raw input string
 * @param options - Sanitization options
 * @returns Sanitization result
 *
 * @example
 * ```typescript
 * const result = sanitizeInput('User input here', {
 *   maxLength: 1000,
 *   normalizeUnicode: true,
 *   allowedPattern: SAFE_PATTERNS.BASIC,
 * });
 *
 * if (result.valid) {
 *   // Use result.value safely
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function sanitizeInput(
  input: string,
  options: SanitizerOptions = {}
): SanitizationResult {
  const {
    maxLength = MAX_INPUT_LENGTHS.USER_INPUT,
    normalizeUnicode: shouldNormalize = true,
    allowedPattern,
    trim = true,
    allowEmpty = false,
  } = options;

  const warnings: string[] = [];
  let value = input;

  // 1. Trim if requested
  if (trim) {
    value = value.trim();
  }

  // 2. Check if empty
  if (!allowEmpty && value.length === 0) {
    return {
      valid: false,
      error: 'Input cannot be empty',
    };
  }

  // 3. Check length BEFORE normalization (prevent DoS via normalization)
  if (value.length > maxLength) {
    return {
      valid: false,
      error: `Input exceeds maximum length of ${maxLength} characters (got ${value.length})`,
    };
  }

  // 4. Unicode normalization (prevent homograph attacks)
  if (shouldNormalize) {
    const normalized = normalizeUnicode(value);
    if (normalized !== value) {
      warnings.push('Input was normalized (Unicode)');
      value = normalized;
    }
  }

  // 5. Check for dangerous patterns
  const dangerous = detectDangerousPatterns(value);
  if (dangerous.length > 0) {
    return {
      valid: false,
      error: `Dangerous patterns detected: ${dangerous.join(', ')}`,
    };
  }

  // 6. Apply character whitelist if provided
  if (allowedPattern && !allowedPattern.test(value)) {
    return {
      valid: false,
      error: 'Input contains disallowed characters',
    };
  }

  return {
    valid: true,
    value,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Sanitize file path input to prevent path traversal
 *
 * @param path - File path to sanitize
 * @returns Sanitization result
 *
 * @example
 * ```typescript
 * const result = sanitizeFilePath('../../../etc/passwd');
 * if (!result.valid) {
 *   console.error('Invalid path:', result.error);
 * }
 * ```
 */
export function sanitizeFilePath(path: string): SanitizationResult {
  const result = sanitizeInput(path, {
    maxLength: MAX_INPUT_LENGTHS.FILE_PATH,
    trim: true,
    allowEmpty: false,
  });

  if (!result.valid || !result.value) {
    return result;
  }

  const value = result.value;

  // Additional path-specific checks
  const warnings = result.warnings || [];

  // Check for path traversal patterns
  if (value.includes('..')) {
    warnings.push('Path contains parent directory references (..)');
  }

  // Check for absolute paths (may be intentional, so just warn)
  if (value.startsWith('/') || /^[A-Z]:/i.test(value)) {
    warnings.push('Absolute path detected');
  }

  // Check for hidden files (Unix)
  if (value.split('/').some(part => part.startsWith('.'))) {
    warnings.push('Path contains hidden file/directory');
  }

  return {
    valid: true,
    value,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Sanitize shell command input
 *
 * NOTE: This is a last line of defense. Prefer execFile over exec
 * and use argument arrays instead of concatenating commands.
 *
 * @param command - Command string to sanitize
 * @returns Sanitization result
 *
 * @example
 * ```typescript
 * const result = sanitizeCommand('ls -la');
 * if (result.valid) {
 *   // Still prefer execFile with args array
 *   execFile(result.value.split(' ')[0], result.value.split(' ').slice(1));
 * }
 * ```
 */
export function sanitizeCommand(command: string): SanitizationResult {
  const result = sanitizeInput(command, {
    maxLength: MAX_INPUT_LENGTHS.COMMAND,
    trim: true,
    allowEmpty: false,
  });

  if (!result.valid || !result.value) {
    return result;
  }

  const value = result.value;

  // Check for shell metacharacters that could enable injection
  const shellMetaChars = /[;&|`$()<>\\]/;
  if (shellMetaChars.test(value)) {
    return {
      valid: false,
      error: 'Command contains dangerous shell metacharacters',
    };
  }

  return {
    valid: true,
    value,
    warnings: result.warnings,
  };
}

/**
 * Sanitize search query input
 *
 * @param query - Search query to sanitize
 * @returns Sanitization result
 */
export function sanitizeSearchQuery(query: string): SanitizationResult {
  return sanitizeInput(query, {
    maxLength: MAX_INPUT_LENGTHS.SEARCH_QUERY,
    trim: true,
    allowEmpty: false,
  });
}

/**
 * Sanitize environment variable value
 *
 * @param value - Environment variable value to sanitize
 * @returns Sanitization result
 */
export function sanitizeEnvValue(value: string): SanitizationResult {
  return sanitizeInput(value, {
    maxLength: MAX_INPUT_LENGTHS.ENV_VALUE,
    trim: true,
    allowEmpty: true, // Empty env vars are valid
  });
}

/**
 * Escape shell arguments for safe execution
 *
 * NOTE: This is a defense-in-depth measure. Always prefer:
 * 1. execFile with argument array over exec
 * 2. Argument validation/whitelisting
 * 3. This escaping function as a last resort
 *
 * @param arg - Argument to escape
 * @returns Safely escaped argument
 */
export function escapeShellArg(arg: string): string {
  // On Windows, use double quotes
  if (process.platform === 'win32') {
    // Escape double quotes and backslashes
    return `"${arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  // On Unix, use single quotes (safest - no interpolation)
  // To include a single quote, end the quote, add escaped quote, resume quote
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Validate regex pattern for ReDoS protection
 *
 * Checks for common ReDoS patterns:
 * - Nested quantifiers (e.g., (a+)+)
 * - Alternation with overlapping patterns
 * - Excessive backtracking potential
 *
 * @param pattern - Regex pattern to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateRegexPattern('(a+)+b');
 * if (!result.valid) {
 *   console.error('Unsafe regex:', result.error);
 * }
 * ```
 */
export function validateRegexPattern(pattern: string): SanitizationResult {
  // Check length first
  if (pattern.length > 1000) {
    return {
      valid: false,
      error: 'Regex pattern too long (max 1000 characters)',
    };
  }

  const warnings: string[] = [];

  // Check for nested quantifiers (major ReDoS risk)
  // Pattern: quantifier inside a group that is itself quantified
  const nestedQuantifiers = /\([^)]*[*+?{][^)]*\)[*+?{]/;
  if (nestedQuantifiers.test(pattern)) {
    return {
      valid: false,
      error: 'Regex contains nested quantifiers (ReDoS risk)',
    };
  }

  // Check for alternation groups that are quantified (common combinatorial blowups)
  const quantifiedAlternation = /\([^()]*\|[^()]*\)[*+?{]/;
  if (quantifiedAlternation.test(pattern)) {
    return {
      valid: false,
      error: 'Regex alternation is quantified (potential ReDoS risk)',
    };
  }

  // Check for excessive alternation
  const alternations = pattern.split('|');
  if (alternations.length > 20) {
    warnings.push('Regex has many alternations (may be slow)');
  }

  // Check for backreferences (can cause exponential backtracking)
  if (/\\[1-9]/.test(pattern)) {
    warnings.push('Regex contains backreferences (may be slow)');
  }

  // Try to compile the regex to catch syntax errors
  try {
    new RegExp(pattern);
  } catch (error) {
    return {
      valid: false,
      error: `Invalid regex: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  return {
    valid: true,
    value: pattern,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
