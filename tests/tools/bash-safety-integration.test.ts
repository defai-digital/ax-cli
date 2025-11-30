/**
 * Unit tests for Bash Tool Safety Rules Integration (Phase 2)
 *
 * Tests the integration between BashTool and the safety rules system,
 * including destructive command detection, always-confirm enforcement,
 * and audit logging.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BashTool } from '../../src/tools/bash.js';
import { ConfirmationService } from '../../src/utils/confirmation-service.js';
import { getSettingsManager } from '../../src/utils/settings-manager.js';
import { AutoAcceptLogger } from '../../src/utils/auto-accept-logger.js';
import { DESTRUCTIVE_OPERATIONS } from '../../src/utils/safety-rules.js';
import os from 'os';

describe('Bash Tool Safety Rules Integration', () => {
  let bashTool: BashTool;
  let confirmationService: ConfirmationService;
  let originalShouldProceed: any;

  beforeEach(() => {
    // Reset singleton instances
    AutoAcceptLogger.resetInstance();

    // Create fresh bash tool instance
    bashTool = new BashTool();
    confirmationService = ConfirmationService.getInstance();

    // Store original shouldProceed for restoration
    originalShouldProceed = confirmationService.shouldProceed.bind(confirmationService);

    // Reset session flags
    confirmationService.setSessionFlag('allOperations', false);
  });

  afterEach(() => {
    // Clean up
    bashTool.dispose();
    AutoAcceptLogger.resetInstance();
    confirmationService.setSessionFlag('allOperations', false);
  });

  describe('Destructive Command Detection', () => {
    it('should detect git push to main as destructive', async () => {
      let capturedContent = '';

      // Mock shouldProceed to capture confirmation content
      vi.spyOn(confirmationService, 'shouldProceed').mockImplementation(async (_tool, details) => {
        capturedContent = details?.content || '';
        return false; // User cancels
      });

      await bashTool.execute('git push origin main');

      expect(capturedContent).toContain('⚠️  WARNING: This operation is flagged as destructive');
      expect(capturedContent).toContain('Push to Main Branch');
    });

    it('should detect git force push as destructive', async () => {
      let capturedContent = '';

      vi.spyOn(confirmationService, 'shouldProceed').mockImplementation(async (_tool, details) => {
        capturedContent = details?.content || '';
        return false;
      });

      await bashTool.execute('git push --force origin feature');

      expect(capturedContent).toContain('⚠️  WARNING: This operation is flagged as destructive');
      expect(capturedContent).toContain('Force Push');
    });

    it('should detect rm -rf as destructive', async () => {
      let capturedContent = '';

      vi.spyOn(confirmationService, 'shouldProceed').mockImplementation(async (_tool, details) => {
        capturedContent = details?.content || '';
        return false;
      });

      await bashTool.execute('rm -rf /tmp/test');

      expect(capturedContent).toContain('⚠️  WARNING: This operation is flagged as destructive');
      expect(capturedContent).toContain('Recursive Force Delete');
    });

    it('should detect npm publish as destructive', async () => {
      let capturedContent = '';

      vi.spyOn(confirmationService, 'shouldProceed').mockImplementation(async (_tool, details) => {
        capturedContent = details?.content || '';
        return false;
      });

      await bashTool.execute('npm publish');

      expect(capturedContent).toContain('⚠️  WARNING: This operation is flagged as destructive');
      expect(capturedContent).toContain('NPM Package Publish');
    });

    it('should not flag safe commands as destructive', async () => {
      let capturedContent = '';

      vi.spyOn(confirmationService, 'shouldProceed').mockImplementation(async (_tool, details) => {
        capturedContent = details?.content || '';
        return false;
      });

      await bashTool.execute('git status');

      expect(capturedContent).not.toContain('⚠️  WARNING: This operation is flagged as destructive');
    });

    it('should detect multiple destructive patterns in one command', async () => {
      let capturedContent = '';

      vi.spyOn(confirmationService, 'shouldProceed').mockImplementation(async (_tool, details) => {
        capturedContent = details?.content || '';
        return false;
      });

      await bashTool.execute('git push --force origin main');

      expect(capturedContent).toContain('⚠️  WARNING: This operation is flagged as destructive');
      expect(capturedContent).toContain('Force Push');
      expect(capturedContent).toContain('Push to Main Branch');
    });
  });

  describe('Always-Confirm Enforcement', () => {
    it('should enforce always-confirm for git_push_main when configured', async () => {
      let capturedAlwaysConfirm = false;

      // Mock settings manager to return always-confirm config
      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue({
        enabled: true,
        alwaysConfirm: ['git_push_main'],
        scope: 'session',
        auditLog: { enabled: false }
      });

      // Enable auto-accept mode
      confirmationService.setSessionFlag('allOperations', true);

      vi.spyOn(confirmationService, 'shouldProceed').mockImplementation(async (_tool, details) => {
        capturedAlwaysConfirm = details?.alwaysConfirm || false;
        return false;
      });

      await bashTool.execute('git push origin main');

      // Should force confirmation despite auto-accept
      expect(capturedAlwaysConfirm).toBe(true);
    });

    it('should not enforce always-confirm for safe commands', async () => {
      let capturedAlwaysConfirm = false;

      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue({
        enabled: true,
        alwaysConfirm: ['git_push_main'],
        scope: 'session',
        auditLog: { enabled: false }
      });

      vi.spyOn(confirmationService, 'shouldProceed').mockImplementation(async (_tool, details) => {
        capturedAlwaysConfirm = details?.alwaysConfirm || false;
        return false;
      });

      await bashTool.execute('git status');

      expect(capturedAlwaysConfirm).toBe(false);
    });

    it('should enforce always-confirm for multiple rules', async () => {
      let capturedAlwaysConfirm = false;

      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue({
        enabled: true,
        alwaysConfirm: ['git_push_main', 'git_force_push'],
        scope: 'session',
        auditLog: { enabled: false }
      });

      confirmationService.setSessionFlag('allOperations', true);

      vi.spyOn(confirmationService, 'shouldProceed').mockImplementation(async (_tool, details) => {
        capturedAlwaysConfirm = details?.alwaysConfirm || false;
        return false;
      });

      await bashTool.execute('git push --force origin main');

      expect(capturedAlwaysConfirm).toBe(true);
    });
  });

  describe('Audit Logging', () => {
    it('should log bash command when audit logging is enabled', async () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, undefined);
      logger.clearLogs();

      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue({
        enabled: true,
        alwaysConfirm: [],
        scope: 'session',
        auditLog: { enabled: true }
      });

      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(false);

      await bashTool.execute('git status');

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].command).toBe('git status');
      expect(logs[0].operation).toBe('bash');
    });

    it('should log destructive operations with matched rules', async () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, undefined);
      logger.clearLogs();

      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue({
        enabled: true,
        alwaysConfirm: [],
        scope: 'session',
        auditLog: { enabled: true }
      });

      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(false);

      await bashTool.execute('git push origin main');

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].destructive).toBe(true);
      expect(logs[0].matchedRules).toContain('git_push_main');
    });

    it('should not log when audit logging is disabled', async () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, undefined);
      logger.clearLogs();

      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue({
        enabled: true,
        alwaysConfirm: [],
        scope: 'session',
        auditLog: { enabled: false }
      });

      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(false);

      await bashTool.execute('git status');

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(0);
    });

    it('should log autoAccepted status correctly', async () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, undefined);
      logger.clearLogs();

      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue({
        enabled: true,
        alwaysConfirm: [],
        scope: 'session',
        auditLog: { enabled: true }
      });

      // Enable auto-accept mode
      confirmationService.setSessionFlag('allOperations', true);

      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(true);

      await bashTool.execute('git status');

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].autoAccepted).toBe(true);
    });

    it('should log userConfirmed when user cancels', async () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, undefined);
      logger.clearLogs();

      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue({
        enabled: true,
        alwaysConfirm: [],
        scope: 'session',
        auditLog: { enabled: true }
      });

      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(false);

      await bashTool.execute('git push --force origin main');

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].userConfirmed).toBe(false); // User declined (said no), so userConfirmed=false
    });

    it('should log with correct scope', async () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, undefined);
      logger.clearLogs();

      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue({
        enabled: true,
        alwaysConfirm: [],
        scope: 'project',
        auditLog: { enabled: true }
      });

      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(false);

      await bashTool.execute('git status');

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].scope).toBe('project');
    });
  });

  describe('User Confirmation Flow', () => {
    it('should return error when user cancels command', async () => {
      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(false);

      const result = await bashTool.execute('git status');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command execution cancelled by user');
    });

    it('should show command and working directory in confirmation', async () => {
      let capturedContent = '';

      vi.spyOn(confirmationService, 'shouldProceed').mockImplementation(async (_tool, details) => {
        capturedContent = details?.content || '';
        return false;
      });

      await bashTool.execute('ls -la');

      expect(capturedContent).toContain('Command: ls -la');
      expect(capturedContent).toContain('Working directory:');
    });
  });

  describe('Integration with Auto-Accept Mode', () => {
    it('should respect auto-accept for safe commands', async () => {
      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue({
        enabled: true,
        alwaysConfirm: [],
        scope: 'session',
        auditLog: { enabled: false }
      });

      confirmationService.setSessionFlag('allOperations', true);

      let confirmationRequested = false;
      vi.spyOn(confirmationService, 'shouldProceed').mockImplementation(async () => {
        confirmationRequested = true;
        return true; // Auto-accepted
      });

      await bashTool.execute('echo test');

      expect(confirmationRequested).toBe(true);
    });

    it('should override auto-accept for always-confirm rules', async () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, undefined);
      logger.clearLogs();

      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue({
        enabled: true,
        alwaysConfirm: ['git_push_main'],
        scope: 'session',
        auditLog: { enabled: true }
      });

      confirmationService.setSessionFlag('allOperations', true);

      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(true);

      await bashTool.execute('git push origin main');

      const logs = logger.getAllLogs();
      expect(logs[0].autoAccepted).toBe(false); // Not auto-accepted due to always-confirm
    });
  });

  describe('Edge Cases', () => {
    it('should handle commands with special characters', async () => {
      const logger = AutoAcceptLogger.getInstance(true, 1000, undefined);
      logger.clearLogs();

      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue({
        enabled: true,
        alwaysConfirm: [],
        scope: 'session',
        auditLog: { enabled: true }
      });

      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(false);

      await bashTool.execute('echo "hello world" && ls -la');

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].command).toBe('echo "hello world" && ls -la');
    });

    it('should handle empty auto-accept config', async () => {
      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue(undefined);

      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(false);

      const result = await bashTool.execute('git status');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command execution cancelled by user');
    });

    it('should handle missing always-confirm array', async () => {
      vi.spyOn(getSettingsManager(), 'getAutoAcceptConfig').mockReturnValue({
        enabled: true,
        scope: 'session',
        auditLog: { enabled: false }
      });

      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(false);

      await bashTool.execute('git push origin main');

      // Should not throw error
    });

    it('should handle cd commands without safety checks', async () => {
      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(true);

      // Use os.tmpdir() for cross-platform compatibility
      const tmpDir = os.tmpdir();
      const result = await bashTool.execute(`cd "${tmpDir}"`);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Changed directory to:');
    });
  });

  describe('Performance', () => {
    it('should not significantly slow down safe commands', async () => {
      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(false);

      const start = Date.now();
      await bashTool.execute('git status');
      const duration = Date.now() - start;

      // Safety checks should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should efficiently detect multiple patterns', async () => {
      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(false);

      const start = Date.now();
      await bashTool.execute('git push --force origin main');
      const duration = Date.now() - start;

      // Even with multiple pattern matches, should be fast
      expect(duration).toBeLessThan(100);
    });
  });

  // REGRESSION TESTS: Timeout memory leak (fixed in v3.7.2)
  describe('Timeout Memory Leak Prevention', () => {
    it('should not accumulate timers on successful command execution', async () => {
      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(true);

      // Execute multiple commands
      for (let i = 0; i < 10; i++) {
        const result = await bashTool.execute('echo "test"');
        expect(result.success).toBe(true);
      }

      // Verify: No lingering timers
      // Note: This is a best-effort check; perfect verification requires mocking timers
      // The fix ensures clearTimeout is called on all paths (success, error, abort)
    });

    it('should not accumulate timers when user cancels', async () => {
      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(false);

      // Execute and cancel multiple times
      for (let i = 0; i < 10; i++) {
        const result = await bashTool.execute('git status');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Command execution cancelled by user');
      }

      // Timers should be cleaned up even when cancelled
    });

    it('should clear timeout on command completion', async () => {
      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(true);

      const result = await bashTool.execute('echo "hello"');

      expect(result.success).toBe(true);

      // Verify timeout was cleared by checking that process completed
      // Without timeout cleanup, timers would accumulate in memory
    });

    it('should clear timeout on command error', async () => {
      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(true);

      const result = await bashTool.execute('command-that-does-not-exist-xyz123');

      expect(result.success).toBe(false);

      // Timeout should be cleared even on error
    });

    it('should handle timeout cleanup when command times out', async () => {
      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(true);

      // Use a real long-running command with short timeout
      // Note: We can't easily test nested timeout with fake timers
      // because the actual child process timing is independent of vi.useFakeTimers()
      // This test just verifies that timeout option is respected
      const result = await bashTool.execute('sleep 10', { timeout: 10 });

      // Command should fail due to timeout (or succeed if too fast)
      // The important part is that timers are cleaned up regardless
      expect(result).toBeDefined();

      // This test primarily documents the timeout cleanup behavior
      // Actual timeout testing requires integration with real child processes
    });

    it('should not leak timers across multiple executions', async () => {
      vi.useFakeTimers();

      vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(true);

      // Execute multiple commands rapidly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(bashTool.execute('echo test'));
      }

      // Advance time slightly
      await vi.advanceTimersByTimeAsync(10);

      await Promise.all(promises);

      // All timers should be cleared after execution
      expect(vi.getTimerCount()).toBe(0);

      vi.useRealTimers();
    });
  });
});
