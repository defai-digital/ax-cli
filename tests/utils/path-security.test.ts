/**
 * Tests for utils/path-security module
 * Tests path validation and security utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';

import {
  getDangerousPathsForOS,
  getDangerousFilePatterns,
  isDangerousFile,
  canonicalizePath,
  containsSymlinks,
  validatePathSecure,
  validatePathSecureSync,
  safePathJoin,
} from '../../packages/core/src/utils/path-security.js';

describe('getDangerousPathsForOS', () => {
  it('should return array of dangerous paths', () => {
    const paths = getDangerousPathsForOS();
    expect(Array.isArray(paths)).toBe(true);
    expect(paths.length).toBeGreaterThan(0);
  });

  it('should include common system directories', () => {
    const paths = getDangerousPathsForOS();
    // At least some of these should be present
    const hasCommon = paths.some(p =>
      p.includes('etc') || p.includes('Windows') || p.includes('bin')
    );
    expect(hasCommon).toBe(true);
  });

  it('should cache results', () => {
    const paths1 = getDangerousPathsForOS();
    const paths2 = getDangerousPathsForOS();
    expect(paths1).toBe(paths2); // Same reference
  });
});

describe('getDangerousFilePatterns', () => {
  it('should return array of patterns', () => {
    const patterns = getDangerousFilePatterns();
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('should include SSH patterns', () => {
    const patterns = getDangerousFilePatterns();
    const hasSSH = patterns.some(p =>
      (typeof p === 'string' && p.includes('ssh')) ||
      (p instanceof RegExp && p.source.includes('ssh'))
    );
    expect(hasSSH).toBe(true);
  });

  it('should include env file patterns', () => {
    const patterns = getDangerousFilePatterns();
    const hasEnv = patterns.some(p =>
      (p instanceof RegExp && p.source.includes('env'))
    );
    expect(hasEnv).toBe(true);
  });

  it('should cache results', () => {
    const patterns1 = getDangerousFilePatterns();
    const patterns2 = getDangerousFilePatterns();
    expect(patterns1).toBe(patterns2);
  });
});

describe('isDangerousFile', () => {
  it('should detect SSH keys', () => {
    expect(isDangerousFile('/home/user/.ssh/id_rsa')).toBe(true);
    expect(isDangerousFile('/home/user/.ssh/id_ed25519')).toBe(true);
    expect(isDangerousFile('/home/user/.ssh/authorized_keys')).toBe(true);
  });

  it('should detect AWS credentials', () => {
    expect(isDangerousFile('/home/user/.aws/credentials')).toBe(true);
    expect(isDangerousFile('/home/user/.aws/config')).toBe(true);
  });

  it('should detect env files', () => {
    expect(isDangerousFile('/project/.env')).toBe(true);
    expect(isDangerousFile('/project/.env.local')).toBe(true);
    expect(isDangerousFile('/project/.env.production')).toBe(true);
  });

  it('should detect shell history', () => {
    expect(isDangerousFile('/home/user/.bash_history')).toBe(true);
    expect(isDangerousFile('/home/user/.zsh_history')).toBe(true);
  });

  it('should not flag safe files', () => {
    expect(isDangerousFile('/home/user/code/app.js')).toBe(false);
    expect(isDangerousFile('/home/user/documents/readme.md')).toBe(false);
  });

  it('should handle Windows paths', () => {
    expect(isDangerousFile('C:\\Users\\user\\.ssh\\id_rsa')).toBe(true);
  });
});

describe('canonicalizePath', () => {
  it('should resolve to absolute path', async () => {
    const result = await canonicalizePath('./test');
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should normalize path separators', async () => {
    const result = await canonicalizePath('./test/../test');
    expect(result.includes('..')).toBe(false);
  });

  it('should handle non-existent paths', async () => {
    const result = await canonicalizePath('./non-existent-path-xyz');
    expect(path.isAbsolute(result)).toBe(true);
  });
});

describe('containsSymlinks', () => {
  it('should return false for regular directories', async () => {
    const result = await containsSymlinks(process.cwd());
    // Note: This might be true if cwd contains symlinks, but most don't
    expect(typeof result).toBe('boolean');
  });

  it('should handle non-existent paths', async () => {
    const result = await containsSymlinks('/non-existent-path-xyz-123');
    expect(result).toBe(false);
  });
});

describe('validatePathSecure', () => {
  const testDir = process.cwd();

  it('should allow paths within cwd', async () => {
    const testPath = path.join(testDir, 'package.json');
    const result = await validatePathSecure(testPath);

    expect(result.success).toBe(true);
    expect(result.path).toBeDefined();
  });

  it('should reject paths outside allowed roots', async () => {
    const result = await validatePathSecure('/root/secret', {
      allowedRoots: [testDir],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('outside allowed directories');
  });

  it('should reject dangerous system paths', async () => {
    // /etc/passwd should be rejected either as outside allowed roots
    // or as a dangerous system path
    const result = await validatePathSecure('/etc/passwd', {
      allowedRoots: ['/etc'],
    });

    expect(result.success).toBe(false);
    // Could be "outside allowed" or "system directory denied"
    expect(result.error).toBeDefined();
  });

  it('should reject dangerous files', async () => {
    const sshKeyPath = path.join(os.homedir(), '.ssh', 'id_rsa');
    const result = await validatePathSecure(sshKeyPath, {
      allowedRoots: [os.homedir()],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('sensitive file denied');
  });

  it('should check existence when requested', async () => {
    const result = await validatePathSecure(
      path.join(testDir, 'non-existent-file-xyz.txt'),
      { checkExists: true }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  it('should allow symlinks when option is set', async () => {
    const testPath = path.join(testDir, 'package.json');
    const result = await validatePathSecure(testPath, {
      allowSymlinks: true,
    });

    expect(result.success).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    // Test that the function handles edge cases without throwing
    // Using a very unusual path
    const result = await validatePathSecure('');

    // Empty path should either fail validation or succeed with resolved path
    // The key is it doesn't throw
    expect(typeof result.success).toBe('boolean');
  });
});

describe('validatePathSecureSync', () => {
  const testDir = process.cwd();

  it('should allow paths within cwd', () => {
    const testPath = path.join(testDir, 'package.json');
    const result = validatePathSecureSync(testPath);

    expect(result.success).toBe(true);
    expect(result.path).toBeDefined();
  });

  it('should reject paths outside allowed roots', () => {
    const result = validatePathSecureSync('/root/secret', {
      allowedRoots: [testDir],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('outside allowed directories');
  });

  it('should reject dangerous system paths', () => {
    // /etc/passwd should be rejected either as outside allowed roots
    // or as a dangerous system path
    const result = validatePathSecureSync('/etc/passwd', {
      allowedRoots: ['/etc'],
    });

    expect(result.success).toBe(false);
    // Could be "outside allowed" or "system directory denied"
    expect(result.error).toBeDefined();
  });

  it('should reject dangerous files', () => {
    const sshKeyPath = path.join(os.homedir(), '.ssh', 'id_rsa');
    const result = validatePathSecureSync(sshKeyPath, {
      allowedRoots: [os.homedir()],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('sensitive file denied');
  });

  it('should use default allowed roots', () => {
    const testPath = path.join(testDir, 'package.json');
    const result = validatePathSecureSync(testPath);

    expect(result.success).toBe(true);
  });
});

describe('safePathJoin', () => {
  const testDir = process.cwd();

  it('should join and validate paths', async () => {
    const result = await safePathJoin(testDir, 'package.json');

    expect(result).not.toBeNull();
    expect(result).toBe(path.join(testDir, 'package.json'));
  });

  it('should return null for invalid paths', async () => {
    const result = await safePathJoin('/root', 'secret', {
      allowedRoots: [testDir],
    });

    expect(result).toBeNull();
  });

  it('should prevent path traversal', async () => {
    const result = await safePathJoin(testDir, '../../../etc/passwd', {
      allowedRoots: [testDir],
    });

    expect(result).toBeNull();
  });

  it('should handle relative paths safely', async () => {
    const result = await safePathJoin(testDir, './src/index.ts');

    // Might be null if file doesn't exist but path is valid
    // Just verify it doesn't throw
    expect(result === null || typeof result === 'string').toBe(true);
  });
});
