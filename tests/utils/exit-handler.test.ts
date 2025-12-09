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

  // Note: exitWithError, exitSuccess, exitCancelled, exitConfigError, exitNetworkError
  // are not tested here because they call process.exit() which interferes with the test runner.
  // In production, these functions are tested through integration tests.

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
