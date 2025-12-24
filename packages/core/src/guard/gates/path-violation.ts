/**
 * Path Violation Gate
 *
 * Prevents access to dangerous file system paths.
 *
 * @invariant INV-PATH-001: Always normalize paths before comparison
 * @invariant INV-PATH-002: Block absolute paths outside workspace by default
 * @invariant INV-PATH-003: Block known dangerous paths (/etc, /root, ~/.ssh)
 * @invariant INV-PATH-004: Extract and check paths from shell commands
 *
 * @packageDocumentation
 */

import type {
  GateContext,
  GuardCheckResult,
  PathViolationConfig,
} from '@defai.digital/ax-schemas';
import { normalizePath, isPathUnder } from '@defai.digital/ax-schemas';

import type { GateImplementation } from '../types.js';
import { pass, warn, fail, matchesAnyPattern } from './base.js';

/**
 * Extract file paths from a shell command string
 * Looks for absolute paths and common file operation patterns
 *
 * @invariant INV-PATH-005: Handle quoted paths ("path" and 'path')
 * @invariant INV-PATH-006: Handle paths after command options (-n, --verbose, etc.)
 */
function extractPathsFromCommand(command: string): string[] {
  const paths: string[] = [];
  let match;

  // Match quoted absolute paths (double or single quotes)
  const quotedAbsolutePathRegex = /["'](\/[^"']+)["']/g;
  while ((match = quotedAbsolutePathRegex.exec(command)) !== null) {
    paths.push(match[1]);
  }

  // Match quoted home directory paths
  const quotedHomePathRegex = /["'](~\/[^"']+)["']/g;
  while ((match = quotedHomePathRegex.exec(command)) !== null) {
    paths.push(match[1]);
  }

  // Match unquoted absolute paths (Unix-style)
  const absolutePathRegex = /(?:^|\s|[;|&`$(){}])(\/[^\s;|&`$(){}'"]+)/g;
  while ((match = absolutePathRegex.exec(command)) !== null) {
    paths.push(match[1]);
  }

  // Match unquoted home directory paths
  const homePathRegex = /(?:^|\s|[;|&`$(){}])(~\/[^\s;|&`$(){}'"]+)/g;
  while ((match = homePathRegex.exec(command)) !== null) {
    paths.push(match[1]);
  }

  // Extract ALL arguments after common file commands and filter for paths
  // This handles commands like: cat -n /etc/passwd, rm -rf /tmp/file
  const fileCommands = ['cat', 'less', 'more', 'head', 'tail', 'vim', 'vi', 'nano', 'rm', 'mv', 'cp', 'chmod', 'chown', 'touch', 'mkdir', 'rmdir', 'ls', 'source', 'curl', 'wget'];
  const fileCommandPattern = new RegExp(`\\b(?:${fileCommands.join('|')})\\s+(.+?)(?:;|\\||&&|$)`, 'gi');
  while ((match = fileCommandPattern.exec(command)) !== null) {
    const argsString = match[1];
    // Split by whitespace but respect quotes
    const args = parseCommandArgs(argsString);
    for (const arg of args) {
      // Skip options (start with -)
      if (arg.startsWith('-')) continue;
      // Check if it looks like a path
      if (arg.includes('/') || arg.startsWith('~')) {
        paths.push(arg);
      }
    }
  }

  // Match redirect targets (both quoted and unquoted)
  const redirectRegex = /[<>]+\s*["']?([^\s;|&`$(){}'"]+)["']?/g;
  while ((match = redirectRegex.exec(command)) !== null) {
    const arg = match[1];
    if (arg.includes('/') || arg.startsWith('~')) {
      paths.push(arg);
    }
  }

  return [...new Set(paths)]; // Deduplicate
}

/**
 * Parse command arguments respecting quotes
 * Handles: arg1 "arg with spaces" 'another arg' arg4
 */
function parseCommandArgs(argsString: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];

    if (inQuote) {
      if (char === inQuote) {
        // End of quoted section
        inQuote = null;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      // Start of quoted section
      inQuote = char;
    } else if (char === ' ' || char === '\t') {
      // Whitespace outside quotes - end of argument
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  // Don't forget the last argument
  if (current) {
    args.push(current);
  }

  return args;
}

/**
 * Default blocked paths (system directories)
 */
const DEFAULT_BLOCKED_PATHS = [
  '/etc',
  '/root',
  '/var',
  '/usr/bin',
  '/usr/sbin',
  '/bin',
  '/sbin',
  '/System',
  '/Library',
  '/private',
];

/**
 * Default blocked path patterns (sensitive files)
 */
const DEFAULT_BLOCKED_PATTERNS = [
  /\.env$/,
  /\.env\.[^/]+$/,
  /id_rsa/,
  /id_ed25519/,
  /id_ecdsa/,
  /id_dsa/,
  /\.pem$/,
  /\.key$/,
  /credentials\.json$/,
  /secrets?\./i,
  /\.aws\/credentials$/,
  /\.ssh\/config$/,
  /\.gnupg\//,
  /\.netrc$/,
  /\.npmrc$/,
  /\.pypirc$/,
];

/**
 * Home directory blocked paths (relative to ~)
 */
const HOME_BLOCKED_PATHS = ['.ssh', '.gnupg', '.aws', '.config'];

/**
 * Path Violation Gate Implementation
 */
export class PathViolationGate implements GateImplementation {
  check(
    context: Readonly<GateContext>,
    config?: PathViolationConfig
  ): GuardCheckResult {
    const startTime = Date.now();

    // Collect all paths to check
    const pathsToCheck: string[] = [];

    // Add explicit file path if provided
    if (context.filePath) {
      pathsToCheck.push(context.filePath);
    }

    // INV-PATH-004: Extract paths from shell commands
    if (context.command) {
      const commandPaths = extractPathsFromCommand(context.command);
      pathsToCheck.push(...commandPaths);
    }

    // No paths to check
    if (pathsToCheck.length === 0) {
      return pass('path_violation', 'No file paths to check', startTime);
    }

    // INV-PATH-001: Always normalize paths
    const normalizedCwd = normalizePath(context.cwd);

    // Helper to resolve a path (handles relative vs absolute)
    const resolvePath = (filePath: string): string => {
      if (filePath.startsWith('/') || filePath.startsWith('~')) {
        return normalizePath(filePath);
      } else {
        return normalizePath(`${context.cwd}/${filePath}`);
      }
    };

    // Get configuration
    const blockedPaths = [
      ...DEFAULT_BLOCKED_PATHS,
      ...(config?.blockedPaths ?? []),
    ];

    const blockedPatterns: (string | RegExp)[] = [
      ...DEFAULT_BLOCKED_PATTERNS,
      ...(config?.blockedPatterns?.map((p) => new RegExp(p, 'i')) ?? []),
    ];

    const allowedPaths = config?.allowedPaths ?? [];
    const warnOutsideCwd = config?.warnOutsideCwd ?? true;

    // Track if any path is outside cwd (for WARN at the end)
    let outsideCwdPath: string | null = null;

    // Check each path
    for (const pathToCheck of pathsToCheck) {
      const normalizedPath = resolvePath(pathToCheck);

      // Check against allowed paths first (whitelist)
      if (allowedPaths.length > 0) {
        const isAllowed = allowedPaths.some((allowed) =>
          isPathUnder(normalizedPath, normalizePath(allowed))
        );
        if (isAllowed) {
          continue; // This path is allowed, check next
        }
      }

      // INV-PATH-003: Check blocked paths
      for (const blocked of blockedPaths) {
        const normalizedBlocked = normalizePath(blocked);
        if (isPathUnder(normalizedPath, normalizedBlocked)) {
          return fail(
            'path_violation',
            `Access to '${blocked}' is blocked`,
            startTime,
            {
              path: normalizedPath,
              blockedPath: normalizedBlocked,
              reason: 'blocked_path',
              source: context.command ? 'command' : 'filePath',
            }
          );
        }
      }

      // Check home directory blocked paths
      const home = process.env.HOME || '';
      if (home) {
        for (const homeBlocked of HOME_BLOCKED_PATHS) {
          const fullBlockedPath = normalizePath(`${home}/${homeBlocked}`);
          if (isPathUnder(normalizedPath, fullBlockedPath)) {
            return fail(
              'path_violation',
              `Access to ~/${homeBlocked} is blocked`,
              startTime,
              {
                path: normalizedPath,
                blockedPath: fullBlockedPath,
                reason: 'home_blocked_path',
                source: context.command ? 'command' : 'filePath',
              }
            );
          }
        }
      }

      // Check blocked patterns
      const patternMatch = matchesAnyPattern(normalizedPath, blockedPatterns);
      if (patternMatch.matched) {
        return fail(
          'path_violation',
          `Path matches blocked pattern: ${patternMatch.pattern}`,
          startTime,
          {
            path: normalizedPath,
            matchedPattern: patternMatch.pattern,
            reason: 'blocked_pattern',
            source: context.command ? 'command' : 'filePath',
          }
        );
      }

      // INV-PATH-002: Track if outside cwd (for WARN)
      if (warnOutsideCwd && !isPathUnder(normalizedPath, normalizedCwd)) {
        outsideCwdPath = normalizedPath;
      }
    }

    // If any path was outside cwd, warn about it
    if (outsideCwdPath) {
      return warn(
        'path_violation',
        `Path is outside current working directory`,
        startTime,
        {
          path: outsideCwdPath,
          cwd: normalizedCwd,
          reason: 'outside_cwd',
        }
      );
    }

    return pass('path_violation', 'All paths are valid', startTime, {
      checkedPaths: pathsToCheck.length,
    });
  }
}
