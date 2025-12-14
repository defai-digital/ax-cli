import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import * as prompts from '@clack/prompts';
import {
  handleCommandError,
  withSpinner,
  outputResult,
  formatBytes,
  formatDate,
  printSeparator,
  confirmAction,
  exitIfCancelled,
} from '../../packages/core/src/commands/utils.js';
import { extractErrorMessage } from '../../packages/core/src/utils/error-handler.js';
import { getTerminalStateManager } from '../../packages/core/src/utils/terminal-state.js';
import { exitCancelled } from '../../packages/core/src/utils/exit-handler.js';

vi.mock('@clack/prompts', () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

vi.mock('../../packages/core/src/utils/error-handler.js', () => ({
  extractErrorMessage: vi.fn((error: unknown) =>
    error instanceof Error ? error.message : String(error)
  ),
}));

vi.mock('../../packages/core/src/utils/terminal-state.js', () => ({
  getTerminalStateManager: vi.fn(() => ({
    forceCleanup: vi.fn(),
  })),
}));

vi.mock('../../packages/core/src/utils/exit-handler.js', () => ({
  exitCancelled: vi.fn(),
}));

describe('commands/utils', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleCommandError', () => {
    it('logs errors and exits by default', () => {
      const error = new Error('boom');

      handleCommandError(error);

      expect(extractErrorMessage).toHaveBeenCalledWith(error);
      expect(prompts.log.error).toHaveBeenCalledWith('boom');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('logs suggestions and respects exit=false', () => {
      handleCommandError('fail', { suggestion: 'try again', exit: false });

      expect(prompts.log.info).toHaveBeenCalledWith('try again');
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('withSpinner', () => {
    it('stops spinner with computed success message', async () => {
      const spinner = { start: vi.fn(), stop: vi.fn() };
      (prompts.spinner as vi.Mock).mockReturnValue(spinner);
      const operation = vi.fn().mockResolvedValue('ok');

      const result = await withSpinner('work', operation, {
        successMessage: (value) => `done ${value}`,
      });

      expect(spinner.start).toHaveBeenCalledWith('work');
      expect(spinner.stop).toHaveBeenCalledWith('done ok');
      expect(result).toBe('ok');
    });

    it('stops spinner on failure and rethrows', async () => {
      const spinner = { start: vi.fn(), stop: vi.fn() };
      (prompts.spinner as vi.Mock).mockReturnValue(spinner);
      const error = new Error('nope');
      const operation = vi.fn().mockRejectedValue(error);

      await expect(withSpinner('work', operation)).rejects.toThrow(error);
      expect(spinner.stop).toHaveBeenCalledWith('Failed');
    });
  });

  describe('outputResult', () => {
    it('prints JSON when json flag is set', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const payload = { key: 'value' };

      outputResult(payload, { json: true }, vi.fn());

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(payload, null, 2));
      consoleSpy.mockRestore();
    });

    it('delegates to formatter when json flag is false', () => {
      const formatter = vi.fn();
      outputResult(42, { json: false }, formatter);
      expect(formatter).toHaveBeenCalledWith(42);
    });
  });

  describe('formatBytes', () => {
    it('formats edge cases and negatives', () => {
      expect(formatBytes(NaN)).toBe('0 B');
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(0.4)).toBe('< 1 B');
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1536)).toBe('1.50 KB');
      expect(formatBytes(-2048)).toBe('-2.00 KB');
    });
  });

  describe('formatDate', () => {
    it('formats dates regardless of input type', () => {
      const localeSpy = vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('locale');
      expect(formatDate(new Date())).toBe('locale');
      expect(formatDate(0)).toBe('locale');
      expect(formatDate('2024-01-01')).toBe('locale');
      localeSpy.mockRestore();
    });

    it('returns Invalid Date for bad input', () => {
      const result = formatDate('not-a-date');
      expect(result).toBe('Invalid Date');
    });
  });

  describe('printSeparator', () => {
    it('prints a gray separator at the requested width', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      printSeparator();
      expect(consoleSpy).toHaveBeenCalledWith(chalk.gray('─'.repeat(60)));

      printSeparator(10);
      expect(consoleSpy).toHaveBeenCalledWith(chalk.gray('─'.repeat(10)));
      consoleSpy.mockRestore();
    });
  });

  describe('confirmAction', () => {
    it('returns true immediately when --yes flag is set', async () => {
      const result = await confirmAction('Proceed?', { yes: true });
      expect(result).toBe(true);
      expect(prompts.confirm).not.toHaveBeenCalled();
    });

    it('honors cancel and default value from prompts', async () => {
      (prompts.confirm as vi.Mock).mockResolvedValueOnce('cancel');
      (prompts.isCancel as vi.Mock).mockReturnValueOnce(true);
      const cancelled = await confirmAction('Proceed?', { defaultValue: true });
      expect(cancelled).toBe(false);
      expect(prompts.confirm).toHaveBeenCalledWith({
        message: 'Proceed?',
        initialValue: true,
      });
    });
  });

  describe('exitIfCancelled', () => {
    it('cleans up and exits when prompt is cancelled', () => {
      (prompts.isCancel as vi.Mock).mockReturnValueOnce(true);
      const manager = { forceCleanup: vi.fn() };
      (getTerminalStateManager as vi.Mock).mockReturnValue(manager);
      exitIfCancelled(Symbol.for('cancelled'), 'Stopped');

      expect(manager.forceCleanup).toHaveBeenCalled();
      expect(prompts.cancel).toHaveBeenCalledWith('Stopped');
      expect(exitCancelled).toHaveBeenCalledWith('Stopped');
    });

    it('returns early when value is not cancelled', () => {
      (prompts.isCancel as vi.Mock).mockReturnValueOnce(false);
      exitIfCancelled('ok');
      expect(exitCancelled).not.toHaveBeenCalled();
    });
  });
});
