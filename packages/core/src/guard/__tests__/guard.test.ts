/**
 * Guard System Tests
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

import {
  Guard,
  createGuard,
  getDefaultGuard,
  resetDefaultGuard,
  PathViolationGate,
  CredentialExposureGate,
  InjectionAttemptGate,
  SchemaViolationGate,
  registerToolSchema,
  clearToolSchemas,
  GuardBlockedError,
} from '../index.js';
import type { GuardPolicy } from '../index.js';

describe('Guard', () => {
  let guard: Guard;

  beforeEach(() => {
    guard = createGuard();
    clearToolSchemas();
  });

  afterEach(() => {
    resetDefaultGuard();
    clearToolSchemas();
  });

  describe('creation', () => {
    it('should create a guard with default options', () => {
      expect(guard).toBeInstanceOf(Guard);
      expect(guard.isEnabled()).toBe(true);
    });

    it('should create a disabled guard', () => {
      const disabledGuard = createGuard({ enabled: false });
      expect(disabledGuard.isEnabled()).toBe(false);
    });

    it('should get the default guard singleton', () => {
      const guard1 = getDefaultGuard();
      const guard2 = getDefaultGuard();
      expect(guard1).toBe(guard2);
    });
  });

  describe('enable/disable', () => {
    it('should toggle enabled state', () => {
      expect(guard.isEnabled()).toBe(true);
      guard.disable();
      expect(guard.isEnabled()).toBe(false);
      guard.enable();
      expect(guard.isEnabled()).toBe(true);
    });

    it('should return PASS when disabled', () => {
      guard.disable();
      const result = guard.check('tool-execution', {
        cwd: '/tmp',
        content: 'password=supersecret123',
      });
      expect(result.overallResult).toBe('PASS');
      expect(result.checks).toHaveLength(0);
    });
  });

  describe('policy management', () => {
    it('should have default policies registered', () => {
      expect(guard.getPolicy('tool-execution')).toBeDefined();
      expect(guard.getPolicy('file-write')).toBeDefined();
      expect(guard.getPolicy('file-read')).toBeDefined();
    });

    it('should register custom policy', () => {
      const customPolicy: GuardPolicy = {
        id: 'custom',
        name: 'Custom Policy',
        gates: ['injection_attempt'],
        enabled: true,
      };
      guard.registerPolicy(customPolicy);
      expect(guard.getPolicy('custom')).toEqual(customPolicy);
    });

    it('should throw on unknown policy', () => {
      expect(() => guard.check('unknown-policy', { cwd: '/tmp' })).toThrow(
        'Unknown guard policy: unknown-policy'
      );
    });
  });

  describe('check', () => {
    it('should return PASS for valid input', () => {
      // Use minimal policy to test basic check flow without schema_violation gate
      const result = guard.check('minimal', {
        cwd: '/tmp',
      });
      expect(result.overallResult).toBe('PASS');
    });

    it('should return FAIL for injection attempt', () => {
      const result = guard.check('tool-execution', {
        cwd: '/tmp',
        content: "; rm -rf / --no-preserve-root",
      });
      expect(result.overallResult).toBe('FAIL');
      expect(result.checks.some((c) => c.gate === 'injection_attempt')).toBe(true);
    });

    it('should include all gate results even after FAIL (INV-GUARD-002)', () => {
      const result = guard.check('comprehensive', {
        cwd: '/tmp',
        filePath: '/etc/passwd',
        content: 'password=secret123',
      });
      // Should have results from all gates
      expect(result.checks.length).toBeGreaterThan(1);
    });

    it('should compute overall result correctly (INV-GUARD-003)', () => {
      // FAIL takes precedence
      const failResult = guard.check('file-write', {
        cwd: '/tmp',
        filePath: '/etc/passwd',
      });
      expect(failResult.overallResult).toBe('FAIL');

      // PASS when all pass
      const passResult = guard.check('file-write', {
        cwd: '/tmp',
        filePath: '/tmp/safe-file.txt',
      });
      expect(passResult.overallResult).toBe('PASS');
    });
  });

  describe('metrics', () => {
    it('should track metrics', () => {
      guard.check('tool-execution', { cwd: '/tmp' });
      guard.check('tool-execution', { cwd: '/tmp', content: '; rm -rf /' });

      const metrics = guard.getMetrics();
      expect(metrics.totalChecks).toBe(2);
      expect(metrics.passCount).toBeGreaterThanOrEqual(1);
      expect(metrics.failCount).toBeGreaterThanOrEqual(1);
    });

    it('should reset metrics', () => {
      guard.check('tool-execution', { cwd: '/tmp' });
      guard.resetMetrics();

      const metrics = guard.getMetrics();
      expect(metrics.totalChecks).toBe(0);
    });
  });

  describe('checkWithPolicy', () => {
    it('should work with inline policy', () => {
      const customPolicy: GuardPolicy = {
        id: 'unused', // ID is ignored, a temp ID is generated
        name: 'Inline Test Policy',
        gates: ['injection_attempt'],
        enabled: true,
      };

      const result = guard.checkWithPolicy(customPolicy, {
        cwd: '/tmp',
        content: 'safe content',
      });
      expect(result.overallResult).toBe('PASS');
    });

    it('should handle multiple concurrent calls without collision (BUG FIX)', () => {
      const customPolicy: GuardPolicy = {
        id: 'temp-policy',
        name: 'Temp Policy',
        gates: ['injection_attempt'],
        enabled: true,
      };

      // Run multiple checks in quick succession (same timestamp possible)
      const results: Array<{ overallResult: string }> = [];
      for (let i = 0; i < 10; i++) {
        results.push(guard.checkWithPolicy(customPolicy, {
          cwd: '/tmp',
          content: 'safe content ' + i,
        }));
      }

      // All should pass without collision
      expect(results.every(r => r.overallResult === 'PASS')).toBe(true);

      // Temp policies should be cleaned up - no temp policies should remain
      expect(guard.getPolicy('temp-policy')).toBeUndefined();
    });
  });
});

describe('PathViolationGate', () => {
  const gate = new PathViolationGate();

  it('should PASS for paths within cwd', () => {
    const result = gate.check({
      cwd: '/home/user/project',
      filePath: '/home/user/project/src/file.ts',
    });
    expect(result.result).toBe('PASS');
  });

  it('should FAIL for blocked system paths', () => {
    const result = gate.check({
      cwd: '/home/user/project',
      filePath: '/etc/passwd',
    });
    expect(result.result).toBe('FAIL');
    expect(result.message).toContain('/etc');
  });

  it('should FAIL for .env files', () => {
    const result = gate.check({
      cwd: '/home/user/project',
      filePath: '/home/user/project/.env',
    });
    expect(result.result).toBe('FAIL');
  });

  it('should FAIL for SSH keys', () => {
    const result = gate.check({
      cwd: '/home/user/project',
      filePath: '/home/user/.ssh/id_rsa',
    });
    expect(result.result).toBe('FAIL');
  });

  it('should FAIL for path traversal attempts (BUG FIX)', () => {
    // Test that /tmp/../etc/passwd is properly normalized to /etc/passwd and blocked
    const result = gate.check({
      cwd: '/home/user/project',
      filePath: '/tmp/../etc/passwd',
    });
    expect(result.result).toBe('FAIL');
    expect(result.message).toContain('/etc');
  });

  it('should FAIL for nested path traversal attempts', () => {
    // Test that /home/user/project/../../../etc/shadow is blocked
    const result = gate.check({
      cwd: '/home/user/project',
      filePath: '/home/user/project/../../../etc/shadow',
    });
    expect(result.result).toBe('FAIL');
  });

  it('should WARN for paths outside cwd', () => {
    const result = gate.check({
      cwd: '/home/user/project',
      filePath: '/home/user/other-project/file.ts',
    });
    expect(result.result).toBe('WARN');
  });

  it('should PASS when no filePath provided', () => {
    const result = gate.check({ cwd: '/home/user/project' });
    expect(result.result).toBe('PASS');
  });

  it('should correctly handle root cwd (BUG FIX)', () => {
    // Test that paths under root / are correctly identified
    const result = gate.check({
      cwd: '/',
      filePath: '/home/user/file.txt',
    });
    // Should PASS since /home/user/file.txt is under /
    // (not blocked, not a sensitive file)
    expect(result.result).toBe('PASS');
  });

  it('should resolve relative paths against cwd (BUG FIX)', () => {
    // Test that relative path ../etc/passwd is resolved against cwd
    const result = gate.check({
      cwd: '/home/user',
      filePath: '../etc/passwd',
    });
    // Should resolve to /home/etc/passwd which is not blocked
    // (it's not /etc/passwd, but /home/etc/passwd)
    expect(result.result).toBe('WARN'); // WARN because outside cwd
  });

  it('should FAIL for relative path that resolves to blocked path (BUG FIX)', () => {
    // Test that relative path resolving to /etc is blocked
    const result = gate.check({
      cwd: '/home',
      filePath: '../etc/passwd',
    });
    // Should resolve to /etc/passwd which IS blocked
    expect(result.result).toBe('FAIL');
    expect(result.message).toContain('/etc');
  });

  it('should handle relative path within cwd', () => {
    const result = gate.check({
      cwd: '/home/user/project',
      filePath: 'src/file.ts',
    });
    // Should resolve to /home/user/project/src/file.ts
    expect(result.result).toBe('PASS');
  });

  it('should FAIL for bash command accessing blocked path (BUG FIX)', () => {
    const result = gate.check({
      cwd: '/home/user/project',
      command: 'cat /etc/passwd',
    });
    expect(result.result).toBe('FAIL');
    expect(result.message).toContain('/etc');
  });

  it('should FAIL for bash command with home directory blocked path (BUG FIX)', () => {
    const result = gate.check({
      cwd: '/home/user/project',
      command: 'cat ~/.ssh/id_rsa',
    });
    expect(result.result).toBe('FAIL');
    expect(result.message).toContain('.ssh');
  });

  it('should extract multiple paths from complex command (BUG FIX)', () => {
    const result = gate.check({
      cwd: '/home/user/project',
      command: 'cat /etc/passwd && ls /root',
    });
    expect(result.result).toBe('FAIL');
  });

  it('should FAIL for command with redirect to blocked path (BUG FIX)', () => {
    const result = gate.check({
      cwd: '/home/user/project',
      command: 'echo "test" > /etc/passwd',
    });
    expect(result.result).toBe('FAIL');
    expect(result.message).toContain('/etc');
  });

  it('should PASS for safe command without blocked paths', () => {
    const result = gate.check({
      cwd: '/home/user/project',
      command: 'ls -la && pwd',
    });
    expect(result.result).toBe('PASS');
  });

  it('should check both filePath and command', () => {
    // filePath is safe, but command has blocked path
    const result = gate.check({
      cwd: '/home/user/project',
      filePath: '/home/user/project/file.txt',
      command: 'cat /etc/shadow',
    });
    expect(result.result).toBe('FAIL');
  });

  it('should FAIL for quoted paths in commands (BUG FIX)', () => {
    // Double quoted path
    const result1 = gate.check({
      cwd: '/home/user/project',
      command: 'cat "/etc/passwd"',
    });
    expect(result1.result).toBe('FAIL');
    expect(result1.message).toContain('/etc');

    // Single quoted path
    const result2 = gate.check({
      cwd: '/home/user/project',
      command: "cat '/etc/shadow'",
    });
    expect(result2.result).toBe('FAIL');
  });

  it('should FAIL for paths after command options (BUG FIX)', () => {
    // Path after -n option
    const result1 = gate.check({
      cwd: '/home/user/project',
      command: 'cat -n /etc/passwd',
    });
    expect(result1.result).toBe('FAIL');

    // Path after multiple options
    const result2 = gate.check({
      cwd: '/home/user/project',
      command: 'rm -rf --verbose /etc/hosts',
    });
    expect(result2.result).toBe('FAIL');
  });

  it('should FAIL for quoted home directory paths (BUG FIX)', () => {
    const result = gate.check({
      cwd: '/home/user/project',
      command: 'cat "~/.ssh/id_rsa"',
    });
    expect(result.result).toBe('FAIL');
    expect(result.message).toContain('.ssh');
  });

  it('should handle paths with spaces in quotes (BUG FIX)', () => {
    // This path is outside cwd but not blocked - should WARN
    const result = gate.check({
      cwd: '/home/user/project',
      command: 'cat "/home/other user/file.txt"',
    });
    expect(result.result).toBe('WARN');
    expect(result.details?.reason).toBe('outside_cwd');
  });
});

describe('CredentialExposureGate', () => {
  const gate = new CredentialExposureGate();

  it('should PASS for safe content', () => {
    const result = gate.check({
      cwd: '/tmp',
      content: 'Hello, this is safe content.',
    });
    expect(result.result).toBe('PASS');
  });

  it('should FAIL for API key exposure', () => {
    const result = gate.check({
      cwd: '/tmp',
      content: 'api_key = "sk-abcdefghijklmnopqrstuvwxyz123456789012345678"',
    });
    expect(result.result).toBe('FAIL');
  });

  it('should FAIL for AWS access key', () => {
    const result = gate.check({
      cwd: '/tmp',
      content: 'AKIAIOSFODNN7EXAMPLE',
    });
    expect(result.result).toBe('FAIL');
  });

  it('should FAIL for private key', () => {
    const result = gate.check({
      cwd: '/tmp',
      content: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----',
    });
    expect(result.result).toBe('FAIL');
  });

  it('should FAIL for GitHub token', () => {
    const result = gate.check({
      cwd: '/tmp',
      content: 'token: ghp_abcdefghijklmnopqrstuvwxyz1234567890',
    });
    expect(result.result).toBe('FAIL');
  });

  it('should PASS when no content provided', () => {
    const result = gate.check({ cwd: '/tmp' });
    expect(result.result).toBe('PASS');
  });
});

describe('InjectionAttemptGate', () => {
  const gate = new InjectionAttemptGate();

  it('should PASS for safe content', () => {
    const result = gate.check({
      cwd: '/tmp',
      content: 'This is a normal message.',
    });
    expect(result.result).toBe('PASS');
  });

  it('should FAIL for SQL injection', () => {
    const result = gate.check({
      cwd: '/tmp',
      content: "'; DROP TABLE users; --",
    });
    expect(result.result).toBe('FAIL');
  });

  it('should FAIL for command injection', () => {
    const result = gate.check({
      cwd: '/tmp',
      command: 'ls | rm -rf /',
    });
    expect(result.result).toBe('FAIL');
  });

  it('should FAIL for path traversal', () => {
    const result = gate.check({
      cwd: '/tmp',
      filePath: '../../../etc/passwd',
    });
    expect(result.result).toBe('FAIL');
  });

  it('should FAIL for template injection', () => {
    const result = gate.check({
      cwd: '/tmp',
      content: '{{constructor.constructor("return process")()}}',
    });
    expect(result.result).toBe('FAIL');
  });

  it('should check tool arguments', () => {
    const result = gate.check({
      cwd: '/tmp',
      toolName: 'test',
      toolArguments: {
        query: "'; DROP TABLE users; --",
      },
    });
    expect(result.result).toBe('FAIL');
  });

  it('should FAIL for single ../ path traversal (BUG FIX)', () => {
    const result = gate.check({
      cwd: '/tmp',
      filePath: '../etc/passwd',
    });
    expect(result.result).toBe('FAIL');
  });

  it('should check nested objects in toolArguments (BUG FIX)', () => {
    const result = gate.check({
      cwd: '/tmp',
      toolName: 'test',
      toolArguments: {
        nested: {
          deep: {
            value: "'; DROP TABLE users; --",
          },
        },
      },
    });
    expect(result.result).toBe('FAIL');
  });

  it('should check nested arrays in toolArguments (BUG FIX)', () => {
    const result = gate.check({
      cwd: '/tmp',
      toolName: 'test',
      toolArguments: {
        data: [
          ['safe', "'; DROP TABLE users; --"],
        ],
      },
    });
    expect(result.result).toBe('FAIL');
  });

  it('should handle deeply nested structures without crashing (DoS protection)', () => {
    // Create a deeply nested structure (depth > 10)
    let deepObj: Record<string, unknown> = { value: 'safe' };
    for (let i = 0; i < 15; i++) {
      deepObj = { nested: deepObj };
    }

    const result = gate.check({
      cwd: '/tmp',
      toolName: 'test',
      toolArguments: deepObj,
    });
    // Should complete without hanging or crashing
    expect(result.result).toBe('PASS');
  });
});

describe('SchemaViolationGate', () => {
  const gate = new SchemaViolationGate();

  beforeEach(() => {
    clearToolSchemas();
  });

  it('should WARN for unknown tool (default config)', () => {
    const result = gate.check({
      cwd: '/tmp',
      toolName: 'unknown-tool',
      toolArguments: { foo: 'bar' },
    });
    expect(result.result).toBe('WARN');
  });

  it('should FAIL for unknown tool in strict mode', () => {
    const result = gate.check(
      {
        cwd: '/tmp',
        toolName: 'unknown-tool',
        toolArguments: { foo: 'bar' },
      },
      { allowUnknownTools: false }
    );
    expect(result.result).toBe('FAIL');
  });

  it('should PASS for valid tool arguments', () => {
    registerToolSchema(
      'test-tool',
      z.object({
        name: z.string(),
        count: z.number(),
      })
    );

    const result = gate.check({
      cwd: '/tmp',
      toolName: 'test-tool',
      toolArguments: { name: 'test', count: 5 },
    });
    expect(result.result).toBe('PASS');
  });

  it('should FAIL for invalid tool arguments', () => {
    registerToolSchema(
      'test-tool',
      z.object({
        name: z.string(),
        count: z.number(),
      })
    );

    const result = gate.check({
      cwd: '/tmp',
      toolName: 'test-tool',
      toolArguments: { name: 123, count: 'not a number' },
    });
    expect(result.result).toBe('FAIL');
    expect(result.details?.errors).toBeDefined();
  });

  it('should PASS when no toolName provided', () => {
    const result = gate.check({ cwd: '/tmp' });
    expect(result.result).toBe('PASS');
  });
});

describe('GuardBlockedError', () => {
  it('should create error with result', () => {
    const result = {
      policy: 'test-policy',
      overallResult: 'FAIL' as const,
      checks: [
        {
          gate: 'path_violation' as const,
          result: 'FAIL' as const,
          message: 'Path blocked',
        },
      ],
      timestamp: new Date().toISOString(),
      duration: 10,
    };

    const error = new GuardBlockedError(result);
    expect(error.name).toBe('GuardBlockedError');
    expect(error.result).toBe(result);
    expect(error.failedChecks).toHaveLength(1);
    expect(error.message).toContain('test-policy');
  });
});
