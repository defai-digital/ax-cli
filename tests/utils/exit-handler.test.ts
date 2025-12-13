/**
 * Tests for Unified Exit Handler
 *
 * @module tests/utils/exit-handler.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExitCode,
  registerCleanup,
  unregisterCleanup,
  logError,
} from '../../packages/core/src/utils/exit-handler.js';

// Mock the logger
vi.mock('../../packages/core/src/utils/logger.js', () => ({
  getLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    errorWithStack: vi.fn(),
  }),
}));

describe('ExitHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ExitCode enum', () => {
    it('should have SUCCESS as 0', () => {
      expect(ExitCode.SUCCESS).toBe(0);
    });

    it('should have GENERAL_ERROR as 1', () => {
      expect(ExitCode.GENERAL_ERROR).toBe(1);
    });

    it('should have MISUSE as 2', () => {
      expect(ExitCode.MISUSE).toBe(2);
    });

    it('should have CONFIG_ERROR as 78 (EX_CONFIG)', () => {
      expect(ExitCode.CONFIG_ERROR).toBe(78);
    });

    it('should have PERMISSION_DENIED as 77 (EX_NOPERM)', () => {
      expect(ExitCode.PERMISSION_DENIED).toBe(77);
    });

    it('should have NETWORK_ERROR as 76', () => {
      expect(ExitCode.NETWORK_ERROR).toBe(76);
    });

    it('should have CANCELLED as 130 (Ctrl+C convention)', () => {
      expect(ExitCode.CANCELLED).toBe(130);
    });
  });

  describe('registerCleanup and unregisterCleanup', () => {
    it('should register cleanup callback', () => {
      const callback = vi.fn();
      registerCleanup(callback);
      // Callback is registered - we can verify by unregistering
      unregisterCleanup(callback);
      // Should not throw
    });

    it('should unregister cleanup callback', () => {
      const callback = vi.fn();
      registerCleanup(callback);
      unregisterCleanup(callback);
      // Should not throw when unregistering again
      unregisterCleanup(callback);
    });

    it('should handle unregistering callback that was never registered', () => {
      const callback = vi.fn();
      // Should not throw
      expect(() => unregisterCleanup(callback)).not.toThrow();
    });

    it('should allow registering multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      registerCleanup(callback1);
      registerCleanup(callback2);
      registerCleanup(callback3);

      // Clean up
      unregisterCleanup(callback1);
      unregisterCleanup(callback2);
      unregisterCleanup(callback3);
    });
  });

  describe('exit functions', () => {
    // These tests mock process.exit to verify behavior without actually exiting
    let exitMock: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exitMock = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    });

    afterEach(() => {
      exitMock.mockRestore();
    });

    it('exitWithError should throw Exit requested', async () => {
      const { exitWithError } = await import('../../packages/core/src/utils/exit-handler.js');

      expect(() => exitWithError('Test error')).toThrow('Exit requested');
    });

    it('exitWithError should use GENERAL_ERROR code by default', async () => {
      const { exitWithError, ExitCode } = await import('../../packages/core/src/utils/exit-handler.js');

      try {
        exitWithError('Test error');
      } catch {
        // Expected
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(exitMock).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    it('exitWithError should use custom exit code', async () => {
      const { exitWithError, ExitCode } = await import('../../packages/core/src/utils/exit-handler.js');

      try {
        exitWithError('Permission denied', ExitCode.PERMISSION_DENIED);
      } catch {
        // Expected
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(exitMock).toHaveBeenCalledWith(ExitCode.PERMISSION_DENIED);
    });

    it('exitSuccess should throw Exit requested', async () => {
      const { exitSuccess } = await import('../../packages/core/src/utils/exit-handler.js');

      expect(() => exitSuccess()).toThrow('Exit requested');
    });

    it('exitSuccess should exit with SUCCESS code', async () => {
      const { exitSuccess, ExitCode } = await import('../../packages/core/src/utils/exit-handler.js');

      try {
        exitSuccess('Done');
      } catch {
        // Expected
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(exitMock).toHaveBeenCalledWith(ExitCode.SUCCESS);
    });

    it('exitCancelled should throw Exit requested', async () => {
      const { exitCancelled } = await import('../../packages/core/src/utils/exit-handler.js');

      expect(() => exitCancelled()).toThrow('Exit requested');
    });

    it('exitCancelled should exit with CANCELLED code', async () => {
      const { exitCancelled, ExitCode } = await import('../../packages/core/src/utils/exit-handler.js');

      try {
        exitCancelled();
      } catch {
        // Expected
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(exitMock).toHaveBeenCalledWith(ExitCode.CANCELLED);
    });

    it('exitCancelled should accept custom message', async () => {
      const { exitCancelled } = await import('../../packages/core/src/utils/exit-handler.js');

      expect(() => exitCancelled('User pressed Ctrl+C')).toThrow('Exit requested');
    });

    it('exitConfigError should throw Exit requested', async () => {
      const { exitConfigError } = await import('../../packages/core/src/utils/exit-handler.js');

      expect(() => exitConfigError('Missing config')).toThrow('Exit requested');
    });

    it('exitConfigError should exit with CONFIG_ERROR code', async () => {
      const { exitConfigError, ExitCode } = await import('../../packages/core/src/utils/exit-handler.js');

      try {
        exitConfigError('Missing config');
      } catch {
        // Expected
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(exitMock).toHaveBeenCalledWith(ExitCode.CONFIG_ERROR);
    });

    it('exitNetworkError should throw Exit requested', async () => {
      const { exitNetworkError } = await import('../../packages/core/src/utils/exit-handler.js');

      expect(() => exitNetworkError('Connection failed')).toThrow('Exit requested');
    });

    it('exitNetworkError should exit with NETWORK_ERROR code', async () => {
      const { exitNetworkError, ExitCode } = await import('../../packages/core/src/utils/exit-handler.js');

      try {
        exitNetworkError('Connection failed');
      } catch {
        // Expected
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(exitMock).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
    });
  });

  describe('logError', () => {
    it('should log error message without exiting', () => {
      expect(() => logError('Test error')).not.toThrow();
    });

    it('should log error with Error object', () => {
      expect(() => logError('Test error', new Error('Details'))).not.toThrow();
    });

    it('should log error with string error', () => {
      expect(() => logError('Test error', 'String error')).not.toThrow();
    });

    it('should log error with context', () => {
      expect(() => logError('Test error', undefined, { command: 'test' })).not.toThrow();
    });

    it('should log error with both error and context', () => {
      expect(() =>
        logError('Test error', new Error('Details'), { operation: 'testing' })
      ).not.toThrow();
    });
  });
});
