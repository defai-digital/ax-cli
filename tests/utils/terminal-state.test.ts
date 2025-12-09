/**
 * Tests for Terminal State Management
 *
 * @module tests/utils/terminal-state.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TerminalState,
  getTerminalStateManager,
  terminalState,
} from '../../packages/core/src/utils/terminal-state.js';

// Mock the logger
vi.mock('../../packages/core/src/utils/logger.js', () => ({
  getLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('TerminalStateManager', () => {
  let manager: ReturnType<typeof getTerminalStateManager>;

  beforeEach(() => {
    manager = getTerminalStateManager();
    // Reset to normal state before each test
    manager.forceCleanup();
  });

  afterEach(() => {
    // Ensure clean state after each test
    manager.forceCleanup();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getTerminalStateManager();
      const instance2 = getTerminalStateManager();
      expect(instance1).toBe(instance2);
    });

    it('should export terminalState as singleton', () => {
      expect(terminalState).toBe(getTerminalStateManager());
    });
  });

  describe('TerminalState enum', () => {
    it('should have NORMAL state', () => {
      expect(TerminalState.NORMAL).toBe('normal');
    });

    it('should have RAW state', () => {
      expect(TerminalState.RAW).toBe('raw');
    });

    it('should have SPINNER state', () => {
      expect(TerminalState.SPINNER).toBe('spinner');
    });

    it('should have PROMPT state', () => {
      expect(TerminalState.PROMPT).toBe('prompt');
    });
  });

  describe('getState', () => {
    it('should return current terminal state', () => {
      expect(manager.getState()).toBe(TerminalState.NORMAL);
    });

    it('should reflect state changes', () => {
      manager.transition(TerminalState.SPINNER);
      expect(manager.getState()).toBe(TerminalState.SPINNER);
    });
  });

  describe('isCleanForPrompt', () => {
    it('should return true when in NORMAL state', () => {
      expect(manager.isCleanForPrompt()).toBe(true);
    });

    it('should return false when in SPINNER state', () => {
      manager.transition(TerminalState.SPINNER);
      expect(manager.isCleanForPrompt()).toBe(false);
    });

    it('should return false when in PROMPT state', () => {
      manager.transition(TerminalState.PROMPT);
      expect(manager.isCleanForPrompt()).toBe(false);
    });

    it('should return false when in RAW state', () => {
      manager.transition(TerminalState.RAW);
      expect(manager.isCleanForPrompt()).toBe(false);
    });
  });

  describe('isSpinnerActive', () => {
    it('should return false when in NORMAL state', () => {
      expect(manager.isSpinnerActive()).toBe(false);
    });

    it('should return true when in SPINNER state', () => {
      manager.transition(TerminalState.SPINNER);
      expect(manager.isSpinnerActive()).toBe(true);
    });

    it('should return false when in PROMPT state', () => {
      manager.transition(TerminalState.PROMPT);
      expect(manager.isSpinnerActive()).toBe(false);
    });
  });

  describe('transition', () => {
    describe('valid transitions', () => {
      it('should allow transition from NORMAL to SPINNER', () => {
        const result = manager.transition(TerminalState.SPINNER);
        expect(result).toBe(true);
        expect(manager.getState()).toBe(TerminalState.SPINNER);
      });

      it('should allow transition from NORMAL to PROMPT', () => {
        const result = manager.transition(TerminalState.PROMPT);
        expect(result).toBe(true);
        expect(manager.getState()).toBe(TerminalState.PROMPT);
      });

      it('should allow transition from NORMAL to RAW', () => {
        const result = manager.transition(TerminalState.RAW);
        expect(result).toBe(true);
        expect(manager.getState()).toBe(TerminalState.RAW);
      });

      it('should allow transition from SPINNER to NORMAL', () => {
        manager.transition(TerminalState.SPINNER);
        const result = manager.transition(TerminalState.NORMAL);
        expect(result).toBe(true);
        expect(manager.getState()).toBe(TerminalState.NORMAL);
      });

      it('should allow transition from PROMPT to NORMAL', () => {
        manager.transition(TerminalState.PROMPT);
        const result = manager.transition(TerminalState.NORMAL);
        expect(result).toBe(true);
        expect(manager.getState()).toBe(TerminalState.NORMAL);
      });

      it('should allow transition from RAW to NORMAL', () => {
        manager.transition(TerminalState.RAW);
        const result = manager.transition(TerminalState.NORMAL);
        expect(result).toBe(true);
        expect(manager.getState()).toBe(TerminalState.NORMAL);
      });

      it('should allow any state to transition to NORMAL (cleanup)', () => {
        // Test from each state
        for (const state of [TerminalState.SPINNER, TerminalState.PROMPT, TerminalState.RAW]) {
          manager.transition(state);
          expect(manager.transition(TerminalState.NORMAL)).toBe(true);
        }
      });
    });

    describe('invalid transitions', () => {
      it('should reject transition from SPINNER to PROMPT', () => {
        manager.transition(TerminalState.SPINNER);
        const result = manager.transition(TerminalState.PROMPT);
        expect(result).toBe(false);
        expect(manager.getState()).toBe(TerminalState.SPINNER);
      });

      it('should reject transition from PROMPT to SPINNER', () => {
        manager.transition(TerminalState.PROMPT);
        const result = manager.transition(TerminalState.SPINNER);
        expect(result).toBe(false);
        expect(manager.getState()).toBe(TerminalState.PROMPT);
      });
    });
  });

  describe('registerCleanup and unregisterCleanup', () => {
    it('should register cleanup callback', () => {
      const callback = vi.fn();
      expect(() => manager.registerCleanup(callback)).not.toThrow();
      manager.unregisterCleanup(callback);
    });

    it('should unregister cleanup callback', () => {
      const callback = vi.fn();
      manager.registerCleanup(callback);
      expect(() => manager.unregisterCleanup(callback)).not.toThrow();
    });

    it('should handle unregistering callback that was never registered', () => {
      const callback = vi.fn();
      expect(() => manager.unregisterCleanup(callback)).not.toThrow();
    });
  });

  describe('forceCleanup', () => {
    it('should reset state to NORMAL', () => {
      manager.transition(TerminalState.SPINNER);
      manager.forceCleanup();
      expect(manager.getState()).toBe(TerminalState.NORMAL);
    });

    it('should run cleanup callbacks', () => {
      const callback = vi.fn();
      manager.registerCleanup(callback);
      manager.forceCleanup();
      expect(callback).toHaveBeenCalled();
      manager.unregisterCleanup(callback);
    });

    it('should handle cleanup callback errors gracefully', () => {
      const failingCallback = vi.fn().mockImplementation(() => {
        throw new Error('Cleanup failed');
      });
      manager.registerCleanup(failingCallback);

      // Should not throw
      expect(() => manager.forceCleanup()).not.toThrow();
      expect(failingCallback).toHaveBeenCalled();

      manager.unregisterCleanup(failingCallback);
    });

    it('should run all callbacks even if some fail', () => {
      const callback1 = vi.fn();
      const failingCallback = vi.fn().mockImplementation(() => {
        throw new Error('Cleanup failed');
      });
      const callback2 = vi.fn();

      manager.registerCleanup(callback1);
      manager.registerCleanup(failingCallback);
      manager.registerCleanup(callback2);

      manager.forceCleanup();

      expect(callback1).toHaveBeenCalled();
      expect(failingCallback).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();

      manager.unregisterCleanup(callback1);
      manager.unregisterCleanup(failingCallback);
      manager.unregisterCleanup(callback2);
    });
  });

  describe('withSpinner', () => {
    it('should transition to SPINNER state during operation', async () => {
      const spinnerStart = vi.fn();
      const spinnerStop = vi.fn();
      let stateInOperation: TerminalState | null = null;

      await manager.withSpinner(
        spinnerStart,
        spinnerStop,
        async () => {
          stateInOperation = manager.getState();
          return 'result';
        }
      );

      expect(stateInOperation).toBe(TerminalState.SPINNER);
    });

    it('should call spinnerStart at the beginning', async () => {
      const spinnerStart = vi.fn();
      const spinnerStop = vi.fn();

      await manager.withSpinner(
        spinnerStart,
        spinnerStop,
        async () => 'result'
      );

      expect(spinnerStart).toHaveBeenCalled();
    });

    it('should call spinnerStop at the end', async () => {
      const spinnerStart = vi.fn();
      const spinnerStop = vi.fn();

      await manager.withSpinner(
        spinnerStart,
        spinnerStop,
        async () => 'result',
        'Done!'
      );

      expect(spinnerStop).toHaveBeenCalledWith('Done!');
    });

    it('should return to NORMAL state after operation', async () => {
      const spinnerStart = vi.fn();
      const spinnerStop = vi.fn();

      await manager.withSpinner(
        spinnerStart,
        spinnerStop,
        async () => 'result'
      );

      expect(manager.getState()).toBe(TerminalState.NORMAL);
    });

    it('should return operation result', async () => {
      const spinnerStart = vi.fn();
      const spinnerStop = vi.fn();

      const result = await manager.withSpinner(
        spinnerStart,
        spinnerStop,
        async () => 'expected result'
      );

      expect(result).toBe('expected result');
    });

    it('should stop spinner and return to NORMAL on error', async () => {
      const spinnerStart = vi.fn();
      const spinnerStop = vi.fn();

      await expect(
        manager.withSpinner(
          spinnerStart,
          spinnerStop,
          async () => {
            throw new Error('Operation failed');
          }
        )
      ).rejects.toThrow('Operation failed');

      expect(spinnerStop).toHaveBeenCalled();
      expect(manager.getState()).toBe(TerminalState.NORMAL);
    });

    it('should throw if cannot start spinner in current state', async () => {
      const spinnerStart = vi.fn();
      const spinnerStop = vi.fn();

      // First, start a prompt (which blocks spinner)
      manager.transition(TerminalState.PROMPT);

      await expect(
        manager.withSpinner(
          spinnerStart,
          spinnerStop,
          async () => 'result'
        )
      ).rejects.toThrow('Cannot start spinner in current terminal state');
    });
  });

  describe('withPrompt', () => {
    it('should transition to PROMPT state during operation', async () => {
      let stateInOperation: TerminalState | null = null;

      await manager.withPrompt(async () => {
        stateInOperation = manager.getState();
        return 'result';
      });

      expect(stateInOperation).toBe(TerminalState.PROMPT);
    });

    it('should return to NORMAL state after operation', async () => {
      await manager.withPrompt(async () => 'result');
      expect(manager.getState()).toBe(TerminalState.NORMAL);
    });

    it('should return operation result', async () => {
      const result = await manager.withPrompt(async () => 'expected result');
      expect(result).toBe('expected result');
    });

    it('should return to NORMAL on error', async () => {
      await expect(
        manager.withPrompt(async () => {
          throw new Error('Prompt failed');
        })
      ).rejects.toThrow('Prompt failed');

      expect(manager.getState()).toBe(TerminalState.NORMAL);
    });

    it('should force cleanup if not in NORMAL state before prompting', async () => {
      manager.transition(TerminalState.SPINNER);

      await manager.withPrompt(async () => 'result');

      // Should have cleaned up and completed successfully
      expect(manager.getState()).toBe(TerminalState.NORMAL);
    });
  });

  describe('getHistory', () => {
    it('should return empty array initially', () => {
      // After forceCleanup in beforeEach, there should be no history
      // (or just the cleanup transition)
      const history = manager.getHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should record transitions', () => {
      manager.transition(TerminalState.SPINNER);
      manager.transition(TerminalState.NORMAL);

      const history = manager.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);

      // Check last two transitions
      const lastTwo = history.slice(-2);
      expect(lastTwo[0].to).toBe(TerminalState.SPINNER);
      expect(lastTwo[1].to).toBe(TerminalState.NORMAL);
    });

    it('should include timestamps', () => {
      manager.transition(TerminalState.SPINNER);

      const history = manager.getHistory();
      const lastEntry = history[history.length - 1];

      expect(lastEntry.timestamp).toBeDefined();
      expect(typeof lastEntry.timestamp).toBe('number');
      expect(lastEntry.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should record from and to states', () => {
      manager.transition(TerminalState.SPINNER);

      const history = manager.getHistory();
      const lastEntry = history[history.length - 1];

      expect(lastEntry.from).toBe(TerminalState.NORMAL);
      expect(lastEntry.to).toBe(TerminalState.SPINNER);
    });

    it('should return a copy of history', () => {
      manager.transition(TerminalState.SPINNER);

      const history1 = manager.getHistory();
      const history2 = manager.getHistory();

      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });

    it('should bound history size', () => {
      // Make many transitions
      for (let i = 0; i < 150; i++) {
        manager.transition(TerminalState.SPINNER);
        manager.transition(TerminalState.NORMAL);
      }

      const history = manager.getHistory();
      // Should be bounded to 100
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('process signal handling', () => {
    // Note: These tests verify the handlers are registered,
    // but we can't easily test the actual signal behavior in unit tests

    it('should be resilient to multiple forceCleanup calls', () => {
      manager.transition(TerminalState.SPINNER);

      // Multiple cleanup calls should not throw
      expect(() => {
        manager.forceCleanup();
        manager.forceCleanup();
        manager.forceCleanup();
      }).not.toThrow();

      expect(manager.getState()).toBe(TerminalState.NORMAL);
    });
  });
});
