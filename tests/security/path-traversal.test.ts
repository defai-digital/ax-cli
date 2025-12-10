/**
 * Security Tests: Path Traversal Prevention
 *
 * Tests REQ-SEC-002 implementation.
 * Covers 30+ attack vectors for path traversal.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import {
  validatePathSecure,
  validatePathSecureSync,
  getDangerousPathsForOS,
  isDangerousFile,
  canonicalizePath,
} from '../../packages/core/src/utils/path-security.js';

describe('REQ-SEC-002: Path Traversal Prevention', () => {
  const testRoot = process.cwd();
  const homeDir = os.homedir();

  describe('validatePathSecure', () => {
    it('should allow paths within project directory', async () => {
      const testPath = path.join(testRoot, 'src', 'index.ts');
      const result = await validatePathSecure(testPath);

      expect(result.success).toBe(true);
      expect(result.path).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should allow paths within .ax-cli directory', async () => {
      const configPath = path.join(homeDir, '.ax-cli', 'config.json');
      const result = await validatePathSecure(configPath);

      expect(result.success).toBe(true);
    });

    it('should block paths outside project directory', async () => {
      if (process.platform !== 'win32') {
        const evilPath = '/etc/passwd';
        const result = await validatePathSecure(evilPath);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/outside allowed directories|system directory/);
      }
    });

    it('should block parent directory traversal (../)', async () => {
      const traversalPath = path.join(testRoot, '..', '..', '..', 'etc', 'passwd');
      const result = await validatePathSecure(traversalPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('outside allowed directories');
    });

    it('should block absolute path to system directory', async () => {
      if (process.platform !== 'win32') {
        const result = await validatePathSecure('/etc/shadow');

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/outside allowed directories|system directory/);
      }
    });

    it('should handle non-existent files (for creation)', async () => {
      const newFile = path.join(testRoot, 'new-file-12345.txt');
      const result = await validatePathSecure(newFile);

      expect(result.success).toBe(true);
    });

    it('should handle relative paths', async () => {
      const relativePath = './src/index.ts';
      const result = await validatePathSecure(relativePath);

      expect(result.success).toBe(true);
    });

    it('should handle paths with . and ..', async () => {
      const weirdPath = path.join(testRoot, 'src', '.', '..', 'src', 'index.ts');
      const result = await validatePathSecure(weirdPath);

      expect(result.success).toBe(true);
    });
  });

  describe('Platform-specific dangerous paths', () => {
    it('should block macOS system directories', async () => {
      if (process.platform === 'darwin') {
        const paths = ['/System', '/Library', '/private/etc'];

        for (const dangerous of paths) {
          const result = await validatePathSecure(dangerous);
          expect(result.success).toBe(false);
        }
      }
    });

    it('should block Windows system directories', async () => {
      if (process.platform === 'win32') {
        const paths = ['C:\\Windows', 'C:\\Program Files'];

        for (const dangerous of paths) {
          const result = await validatePathSecure(dangerous);
          expect(result.success).toBe(false);
        }
      }
    });

    it('should block Linux/Unix system directories', async () => {
      if (process.platform !== 'win32') {
        const paths = ['/etc', '/sys', '/proc', '/dev', '/root'];

        for (const dangerous of paths) {
          const result = await validatePathSecure(dangerous);
          expect(result.success).toBe(false);
        }
      }
    });
  });

  describe('getDangerousPathsForOS', () => {
    it('should return OS-specific dangerous paths', () => {
      const paths = getDangerousPathsForOS();
      expect(paths.length).toBeGreaterThan(5);

      if (process.platform === 'darwin') {
        expect(paths).toContain('/System');
      } else if (process.platform === 'win32') {
        expect(paths).toContain('C:\\Windows');
      } else {
        expect(paths).toContain('/etc');
      }
    });
  });

  describe('isDangerousFile', () => {
    it('should block SSH private keys', () => {
      expect(isDangerousFile('/home/user/.ssh/id_rsa')).toBe(true);
      expect(isDangerousFile('/home/user/.ssh/id_ed25519')).toBe(true);
      expect(isDangerousFile('/home/user/.ssh/id_ecdsa')).toBe(true);
    });

    it('should block AWS credentials', () => {
      expect(isDangerousFile('/home/user/.aws/credentials')).toBe(true);
      expect(isDangerousFile('/home/user/.aws/config')).toBe(true);
    });

    it('should block .env files', () => {
      expect(isDangerousFile('/home/user/project/.env')).toBe(true);
      expect(isDangerousFile('/home/user/project/.env.local')).toBe(true);
      expect(isDangerousFile('/home/user/project/.env.production')).toBe(true);
    });

    it('should block shell history files', () => {
      expect(isDangerousFile('/home/user/.bash_history')).toBe(true);
      expect(isDangerousFile('/home/user/.zsh_history')).toBe(true);
    });

    it('should block system files', () => {
      expect(isDangerousFile('/etc/passwd')).toBe(true);
      expect(isDangerousFile('/etc/shadow')).toBe(true);
      expect(isDangerousFile('/etc/sudoers')).toBe(true);
    });

    it('should allow normal files', () => {
      expect(isDangerousFile('/home/user/project/src/index.ts')).toBe(false);
      expect(isDangerousFile('/home/user/documents/report.pdf')).toBe(false);
      expect(isDangerousFile('/tmp/test.txt')).toBe(false);
    });
  });

  describe('canonicalizePath', () => {
    it('should resolve absolute paths', async () => {
      const canonical = await canonicalizePath(testRoot);
      expect(path.isAbsolute(canonical)).toBe(true);
    });

    it('should handle non-existent paths', async () => {
      const nonExistent = path.join(testRoot, 'non-existent-file-12345.txt');
      const canonical = await canonicalizePath(nonExistent);
      expect(canonical).toBeDefined();
    });
  });

  describe('validatePathSecureSync', () => {
    it('should allow safe paths', () => {
      const safePath = path.join(testRoot, 'src', 'index.ts');
      const result = validatePathSecureSync(safePath);

      expect(result.success).toBe(true);
    });

    it('should block dangerous paths', () => {
      if (process.platform !== 'win32') {
        const result = validatePathSecureSync('/etc/passwd');

        expect(result.success).toBe(false);
      }
    });
  });

  describe('Attack Scenarios', () => {
    it('should prevent reading /etc/passwd', async () => {
      if (process.platform !== 'win32') {
        const result = await validatePathSecure('/etc/passwd');
        expect(result.success).toBe(false);
      }
    });

    it('should prevent reading /etc/shadow', async () => {
      if (process.platform !== 'win32') {
        const result = await validatePathSecure('/etc/shadow');
        expect(result.success).toBe(false);
      }
    });

    it('should prevent writing to /etc/hosts', async () => {
      if (process.platform !== 'win32') {
        const result = await validatePathSecure('/etc/hosts');
        expect(result.success).toBe(false);
      }
    });

    it('should prevent accessing SSH keys', async () => {
      const sshKey = path.join(homeDir, '.ssh', 'id_rsa');
      const result = await validatePathSecure(sshKey);
      expect(result.success).toBe(false);
    });

    it('should prevent accessing AWS credentials', async () => {
      const awsCreds = path.join(homeDir, '.aws', 'credentials');
      const result = await validatePathSecure(awsCreds);
      expect(result.success).toBe(false);
    });

    it('should prevent traversal to parent of project', async () => {
      const parentTraversal = path.join(testRoot, '..', '..', '..', 'sensitive-file.txt');
      const result = await validatePathSecure(parentTraversal);
      expect(result.success).toBe(false);
    });

    it('should prevent accessing .env files', async () => {
      const envFile = path.join(testRoot, '.env');
      const result = await validatePathSecure(envFile);
      expect(result.success).toBe(false);
    });

    it('should prevent accessing .bash_history', async () => {
      const history = path.join(homeDir, '.bash_history');
      const result = await validatePathSecure(history);
      expect(result.success).toBe(false);
    });

    it('should prevent multiple parent directory traversal', async () => {
      const multiTraversal = '../../../../../../../etc/passwd';
      const result = await validatePathSecure(multiTraversal);
      expect(result.success).toBe(false);
    });

    it('should prevent mixed traversal attempts', async () => {
      const mixed = path.join(testRoot, '..', 'sibling', '..', '..', 'etc', 'passwd');
      const result = await validatePathSecure(mixed);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty path', async () => {
      const result = await validatePathSecure('');
      // Should resolve to current directory which is allowed
      expect(result.success).toBe(true);
    });

    it('should handle dot path', async () => {
      const result = await validatePathSecure('.');
      expect(result.success).toBe(true);
    });

    it('should handle multiple slashes', async () => {
      const multiSlash = path.join(testRoot, 'src', '/', '/', 'index.ts');
      const result = await validatePathSecure(multiSlash);
      expect(result.success).toBe(true);
    });
  });
});
