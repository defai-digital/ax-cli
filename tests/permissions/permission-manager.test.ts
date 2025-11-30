/**
 * Tests for Permission System (Phase 3)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PermissionManager,
  PermissionTier,
  getPermissionManager,
} from '../../src/permissions/permission-manager.js';

describe('PermissionManager', () => {
  let manager: PermissionManager;

  beforeEach(() => {
    manager = new PermissionManager();
  });

  describe('Permission Tiers', () => {
    it('should auto-approve read operations', async () => {
      const result = await manager.checkPermission({
        tool: 'view_file',
        args: { path: '/test/file.ts' },
        context: { filePath: '/test/file.ts', riskLevel: 'low' },
      });

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe(PermissionTier.AutoApprove);
    });

    it('should notify for file creation', async () => {
      const result = await manager.checkPermission({
        tool: 'create_file',
        args: { path: '/test/new.ts' },
        context: { filePath: '/test/new.ts', riskLevel: 'low' },
      });

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe(PermissionTier.Notify);
    });

    it('should require confirmation for dangerous bash commands', async () => {
      const result = await manager.checkPermission({
        tool: 'bash',
        args: { command: 'rm -rf /tmp/test' },
        context: { command: 'rm -rf /tmp/test', riskLevel: 'high' },
      });

      expect(result.allowed).toBe(false);
      expect(result.tier).toBe(PermissionTier.Confirm);
    });

    it('should block dangerous patterns', async () => {
      // Test fork bomb pattern which is explicitly blocked
      const result = await manager.checkPermission({
        tool: 'bash',
        args: { command: ':(){ :|:& };:' },
        context: { command: ':(){ :|:& };:', riskLevel: 'critical' },
      });

      expect(result.allowed).toBe(false);
      expect(result.tier).toBe(PermissionTier.Block);
    });
  });

  describe('Pattern Matching', () => {
    it('should auto-approve safe bash commands', async () => {
      const result = await manager.checkPermission({
        tool: 'bash',
        args: { command: 'ls -la' },
        context: { command: 'ls -la', riskLevel: 'low' },
      });

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe(PermissionTier.AutoApprove);
    });

    it('should notify for npm commands', async () => {
      const result = await manager.checkPermission({
        tool: 'bash',
        args: { command: 'npm test' },
        context: { command: 'npm test', riskLevel: 'low' },
      });

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe(PermissionTier.Notify);
    });

    it('should auto-approve git status', async () => {
      const result = await manager.checkPermission({
        tool: 'bash',
        args: { command: 'git status' },
        context: { command: 'git status', riskLevel: 'low' },
      });

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe(PermissionTier.AutoApprove);
    });
  });

  describe('File-Specific Confirmations', () => {
    it('should require confirmation for sensitive files', async () => {
      const result = await manager.checkPermission({
        tool: 'str_replace_editor',
        args: { path: '.env.local' },
        context: { filePath: '.env.local', riskLevel: 'high' },
      });

      expect(result.allowed).toBe(false);
      expect(result.tier).toBe(PermissionTier.Confirm);
    });

    it('should require confirmation for config files', async () => {
      const result = await manager.checkPermission({
        tool: 'create_file',
        args: { path: 'app.config.js' },
        context: { filePath: 'app.config.js', riskLevel: 'medium' },
      });

      expect(result.allowed).toBe(false);
      expect(result.tier).toBe(PermissionTier.Confirm);
    });
  });

  describe('Session Approvals', () => {
    it('should allow after session approval', async () => {
      // First check should require confirmation
      const firstResult = await manager.checkPermission({
        tool: 'bash',
        args: { command: 'rm test.txt' },
        context: { command: 'rm test.txt', riskLevel: 'medium' },
      });
      expect(firstResult.allowed).toBe(false);

      // Grant session approval
      manager.grantSessionApproval('bash:rm');

      // Second check should be allowed
      const secondResult = await manager.checkPermission({
        tool: 'bash',
        args: { command: 'rm another.txt' },
        context: { command: 'rm another.txt', riskLevel: 'medium' },
      });
      expect(secondResult.allowed).toBe(true);
      expect(secondResult.userApproved).toBe(true);
    });

    it('should clear session approvals', async () => {
      manager.grantSessionApproval('bash:rm');
      manager.clearSessionApprovals();

      const result = await manager.checkPermission({
        tool: 'bash',
        args: { command: 'rm test.txt' },
        context: { command: 'rm test.txt', riskLevel: 'medium' },
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe('Risk Assessment', () => {
    it('should assess critical risk for rm -rf', () => {
      const risk = manager.assessRisk({
        tool: 'bash',
        args: { command: 'rm -rf /tmp' },
        context: { command: 'rm -rf /tmp', riskLevel: 'high' },
      });
      expect(risk).toBe('critical');
    });

    it('should assess high risk for .env files', () => {
      const risk = manager.assessRisk({
        tool: 'str_replace_editor',
        args: { path: '.env' },
        context: { filePath: '.env', riskLevel: 'medium' },
      });
      expect(risk).toBe('high');
    });

    it('should assess medium risk for config files', () => {
      const risk = manager.assessRisk({
        tool: 'str_replace_editor',
        args: { path: 'config.json' },
        context: { filePath: 'config.json', riskLevel: 'low' },
      });
      expect(risk).toBe('medium');
    });
  });

  describe('Events', () => {
    it('should emit notify event for notify tier', async () => {
      const notifyHandler = vi.fn();
      manager.on('permission:notify', notifyHandler);

      await manager.checkPermission({
        tool: 'create_file',
        args: { path: '/test/file.ts' },
        context: { filePath: '/test/file.ts', riskLevel: 'low' },
      });

      expect(notifyHandler).toHaveBeenCalled();
    });
  });
});
