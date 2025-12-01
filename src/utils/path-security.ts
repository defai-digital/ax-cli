/**
 * Path Security Utilities
 *
 * Provides comprehensive path validation to prevent path traversal,
 * symlink attacks, and access to dangerous system directories (REQ-SEC-002).
 *
 * @module path-security
 */

import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { CONFIG_DIR_NAME } from '../constants.js';

/**
 * Result of path validation
 */
export interface PathValidationResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Options for path validation
 */
export interface PathValidationOptions {
  allowSymlinks?: boolean;
  allowedRoots?: string[];
  checkExists?: boolean;
}

// Cache dangerous paths per platform (computed once)
let _dangerousPathsCache: string[] | null = null;

/**
 * Get OS-specific dangerous paths that should never be accessed.
 * Results are cached for performance.
 *
 * @returns Array of dangerous path prefixes
 */
export function getDangerousPathsForOS(): string[] {
  if (_dangerousPathsCache) return _dangerousPathsCache;

  const platform = process.platform;

  // Common dangerous paths (Unix-like)
  const commonPaths = [
    '/etc', '/sys', '/proc', '/dev', '/root', '/boot', '/var',
    '/lib', '/lib64', '/usr/lib', '/usr/local/lib',
    '/bin', '/sbin', '/usr/bin', '/usr/sbin',
  ];

  if (platform === 'darwin') {
    _dangerousPathsCache = [
      ...commonPaths,
      '/System', '/Library', '/private/etc', '/private/var',
      '/Volumes', '/Applications',
    ];
  } else if (platform === 'win32') {
    _dangerousPathsCache = [
      'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)',
      'C:\\ProgramData', 'C:\\System Volume Information', 'C:\\$Recycle.Bin',
    ];
  } else {
    _dangerousPathsCache = [...commonPaths, '/snap', '/mnt', '/media', '/run'];
  }

  return _dangerousPathsCache;
}

// Cache dangerous file patterns (computed once)
let _dangerousFilePatternsCache: Array<string | RegExp> | null = null;

/**
 * Get dangerous file patterns that should be blocked.
 * Results are cached for performance.
 *
 * @returns Array of dangerous file patterns (strings or regexes)
 */
export function getDangerousFilePatterns(): Array<string | RegExp> {
  if (_dangerousFilePatternsCache) return _dangerousFilePatternsCache;

  _dangerousFilePatternsCache = [
    // SSH keys
    /\.ssh\/id_rsa$/, /\.ssh\/id_ed25519$/, /\.ssh\/id_ecdsa$/,
    /\.ssh\/authorized_keys$/, /\.ssh\/known_hosts$/,
    // AWS credentials
    /\.aws\/credentials$/, /\.aws\/config$/,
    // Other credentials
    '.npmrc', '.gitconfig', '.docker/config.json',
    // Shell history
    /\.bash_history$/, /\.zsh_history$/, /\.sh_history$/,
    // Environment files
    /\.env$/, /\.env\.local$/, /\.env\.production$/,
    // System files (Unix)
    '/etc/passwd', '/etc/shadow', '/etc/sudoers', '/etc/hosts', '/etc/ssh/sshd_config',
  ];

  return _dangerousFilePatternsCache;
}

/**
 * Check if a path matches a dangerous file pattern.
 *
 * @param filePath - Path to check
 * @returns True if file matches dangerous pattern
 */
export function isDangerousFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const patterns = getDangerousFilePatterns();

  return patterns.some(pattern => {
    if (typeof pattern === 'string') {
      return normalized.includes(pattern) || normalized.endsWith(pattern);
    } else {
      return pattern.test(normalized);
    }
  });
}

/**
 * Canonicalize a path by resolving symlinks and normalizing.
 *
 * @param filePath - Path to canonicalize
 * @returns Canonicalized path or original if canonicalization fails
 */
export async function canonicalizePath(filePath: string): Promise<string> {
  try {
    // Use fs.realpath to resolve symlinks
    const canonical = await fs.realpath(filePath);
    return canonical;
  } catch (error) {
    // If realpath fails (e.g., file doesn't exist), just resolve
    return path.resolve(filePath);
  }
}

/**
 * Check if a path contains symlinks in any component.
 *
 * @param filePath - Path to check
 * @returns True if any component is a symlink
 */
export async function containsSymlinks(filePath: string): Promise<boolean> {
  const resolved = path.resolve(filePath);
  const components = resolved.split(path.sep).filter(c => c);

  let currentPath = path.isAbsolute(filePath) ? path.sep : '.';

  for (const component of components) {
    currentPath = path.join(currentPath, component);

    try {
      const stats = await fs.lstat(currentPath);
      if (stats.isSymbolicLink()) {
        return true;
      }
    } catch (error) {
      // If stat fails, path doesn't exist yet - not a symlink
      continue;
    }
  }

  return false;
}

/**
 * Validate a file path for security.
 *
 * Performs comprehensive checks:
 * 1. Canonicalization (resolve symlinks)
 * 2. Allowed root validation
 * 3. Dangerous path blocking
 * 4. Symlink detection
 * 5. Dangerous file detection
 *
 * @param filePath - Path to validate
 * @param options - Validation options
 * @returns Validation result with success status and validated path
 */
export async function validatePathSecure(
  filePath: string,
  options: PathValidationOptions = {}
): Promise<PathValidationResult> {
  try {
    // 1. Canonicalize path (resolves symlinks)
    const canonical = await canonicalizePath(filePath);

    // 2. Resolve to absolute path
    const resolved = path.resolve(canonical);

    // 3. Check if within allowed directory roots
    const allowedRoots = options.allowedRoots || [
      process.cwd(),
      path.join(os.homedir(), CONFIG_DIR_NAME),
    ];

    const isAllowed = allowedRoots.some(root => {
      const normalizedRoot = path.resolve(root);
      return (
        resolved === normalizedRoot ||
        resolved.startsWith(normalizedRoot + path.sep)
      );
    });

    if (!isAllowed) {
      return {
        success: false,
        error: `Path "${filePath}" is outside allowed directories. Allowed roots: ${allowedRoots.join(', ')}`,
      };
    }

    // 4. Check for dangerous paths (OS-specific)
    const dangerousPaths = getDangerousPathsForOS();
    for (const dangerous of dangerousPaths) {
      const normalizedDangerous = path.resolve(dangerous);
      if (
        resolved.startsWith(normalizedDangerous + path.sep) ||
        resolved === normalizedDangerous
      ) {
        return {
          success: false,
          error: `Access to system directory "${dangerous}" denied`,
        };
      }
    }

    // 5. Check for dangerous files
    if (isDangerousFile(resolved)) {
      return {
        success: false,
        error: `Access to sensitive file denied: "${filePath}"`,
      };
    }

    // 6. Check for symlinks (if not allowed)
    if (!options.allowSymlinks) {
      const hasSymlinks = await containsSymlinks(filePath);
      if (hasSymlinks) {
        return {
          success: false,
          error: `Path contains symlinks: "${filePath}". Symlinks are not allowed for security.`,
        };
      }
    }

    // 7. Optionally check if path exists
    if (options.checkExists) {
      const exists = await fs.pathExists(resolved);
      if (!exists) {
        return {
          success: false,
          error: `Path does not exist: "${filePath}"`,
        };
      }
    }

    // All checks passed
    return {
      success: true,
      path: resolved,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Path validation error: ${error.message}`,
    };
  }
}

/**
 * Synchronous version of validatePathSecure.
 * Less secure (doesn't resolve symlinks), use async version when possible.
 *
 * @param filePath - Path to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validatePathSecureSync(
  filePath: string,
  options: PathValidationOptions = {}
): PathValidationResult {
  try {
    // Resolve to absolute path (no symlink resolution in sync version)
    const resolved = path.resolve(filePath);

    // Check allowed roots
    const allowedRoots = options.allowedRoots || [
      process.cwd(),
      path.join(os.homedir(), CONFIG_DIR_NAME),
    ];

    const isAllowed = allowedRoots.some(root => {
      const normalizedRoot = path.resolve(root);
      return (
        resolved === normalizedRoot ||
        resolved.startsWith(normalizedRoot + path.sep)
      );
    });

    if (!isAllowed) {
      return {
        success: false,
        error: `Path outside allowed directories`,
      };
    }

    // Check dangerous paths
    const dangerousPaths = getDangerousPathsForOS();
    for (const dangerous of dangerousPaths) {
      const normalizedDangerous = path.resolve(dangerous);
      if (
        resolved.startsWith(normalizedDangerous + path.sep) ||
        resolved === normalizedDangerous
      ) {
        return {
          success: false,
          error: `Access to system directory denied`,
        };
      }
    }

    // Check dangerous files
    if (isDangerousFile(resolved)) {
      return {
        success: false,
        error: `Access to sensitive file denied`,
      };
    }

    return {
      success: true,
      path: resolved,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Create a safe path joiner that validates the result.
 *
 * @param basePath - Base directory path
 * @param relativePath - Relative path to join
 * @param options - Validation options
 * @returns Validated joined path or null if invalid
 */
export async function safePathJoin(
  basePath: string,
  relativePath: string,
  options: PathValidationOptions = {}
): Promise<string | null> {
  const joined = path.join(basePath, relativePath);
  const validation = await validatePathSecure(joined, options);

  if (!validation.success || !validation.path) {
    return null;
  }

  return validation.path;
}
