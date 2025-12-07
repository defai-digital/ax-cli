/**
 * Terminal state management utility
 *
 * Manages terminal state transitions to prevent corruption from:
 * - Overlapping spinners and prompts
 * - Raw mode state leaks
 * - Unclean exits
 */

import { getLogger } from './logger.js';

export enum TerminalState {
  NORMAL = 'normal',
  RAW = 'raw',
  SPINNER = 'spinner',
  PROMPT = 'prompt',
}

interface StateTransition {
  from: TerminalState;
  to: TerminalState;
  timestamp: number;
}

class TerminalStateManager {
  private static instance: TerminalStateManager;
  private currentState: TerminalState = TerminalState.NORMAL;
  private stateHistory: StateTransition[] = [];
  private cleanupCallbacks: Array<() => void> = [];

  private constructor() {
    // Register cleanup on process exit
    process.on('exit', () => this.forceCleanup());
    process.on('SIGINT', () => this.forceCleanup());
    process.on('SIGTERM', () => this.forceCleanup());
  }

  public static getInstance(): TerminalStateManager {
    if (!TerminalStateManager.instance) {
      TerminalStateManager.instance = new TerminalStateManager();
    }
    return TerminalStateManager.instance;
  }

  /**
   * Get current terminal state
   */
  public getState(): TerminalState {
    return this.currentState;
  }

  /**
   * Check if terminal is in a clean state for prompts
   */
  public isCleanForPrompt(): boolean {
    return this.currentState === TerminalState.NORMAL;
  }

  /**
   * Check if a spinner is currently active
   */
  public isSpinnerActive(): boolean {
    return this.currentState === TerminalState.SPINNER;
  }

  /**
   * Transition to a new state
   * Returns false if transition is invalid
   */
  public transition(newState: TerminalState): boolean {
    const logger = getLogger();

    // Validate transition
    if (!this.isValidTransition(this.currentState, newState)) {
      logger.warn('Invalid terminal state transition', {
        from: this.currentState,
        to: newState,
      });
      return false;
    }

    // Record transition
    this.stateHistory.push({
      from: this.currentState,
      to: newState,
      timestamp: Date.now(),
    });

    // Keep history bounded
    if (this.stateHistory.length > 100) {
      this.stateHistory.shift();
    }

    this.currentState = newState;

    logger.debug('Terminal state transition', {
      from: this.stateHistory[this.stateHistory.length - 1]?.from,
      to: newState,
    });

    return true;
  }

  /**
   * Check if a state transition is valid
   */
  private isValidTransition(from: TerminalState, to: TerminalState): boolean {
    // Allow any transition to NORMAL (cleanup)
    if (to === TerminalState.NORMAL) {
      return true;
    }

    // From NORMAL, can go to any state
    if (from === TerminalState.NORMAL) {
      return true;
    }

    // From SPINNER, must go to NORMAL before PROMPT
    if (from === TerminalState.SPINNER && to === TerminalState.PROMPT) {
      return false;
    }

    // From PROMPT, must go to NORMAL before SPINNER
    if (from === TerminalState.PROMPT && to === TerminalState.SPINNER) {
      return false;
    }

    return true;
  }

  /**
   * Register a cleanup callback
   */
  public registerCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Unregister a cleanup callback
   */
  public unregisterCleanup(callback: () => void): void {
    const index = this.cleanupCallbacks.indexOf(callback);
    if (index !== -1) {
      this.cleanupCallbacks.splice(index, 1);
    }
  }

  /**
   * Force cleanup of terminal state
   * Called on process exit to ensure terminal is restored
   */
  public forceCleanup(): void {
    const logger = getLogger();

    // Run all cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        logger.debug('Cleanup callback failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Reset terminal to normal state
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      try {
        process.stdin.setRawMode(false);
      } catch {
        // Ignore - terminal may already be in normal mode
      }
    }

    // Clear any pending output
    try {
      process.stdout.write('\x1b[?25h'); // Show cursor
      process.stdout.write('\x1b[0m'); // Reset colors
    } catch {
      // Ignore - stdout may not be available
    }

    this.currentState = TerminalState.NORMAL;
  }

  /**
   * Safely execute a function that uses a spinner
   * Ensures spinner is stopped before returning
   */
  public async withSpinner<T>(
    spinnerStart: () => void,
    spinnerStop: (message?: string) => void,
    operation: () => Promise<T>,
    stopMessage?: string
  ): Promise<T> {
    if (!this.transition(TerminalState.SPINNER)) {
      throw new Error('Cannot start spinner in current terminal state');
    }

    try {
      spinnerStart();
      const result = await operation();
      spinnerStop(stopMessage);
      this.transition(TerminalState.NORMAL);
      return result;
    } catch (error) {
      spinnerStop();
      this.transition(TerminalState.NORMAL);
      throw error;
    }
  }

  /**
   * Safely execute a function that shows a prompt
   * Ensures terminal is in clean state before prompt
   */
  public async withPrompt<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    // Ensure we're in normal state before prompting
    if (this.currentState !== TerminalState.NORMAL) {
      this.forceCleanup();
    }

    if (!this.transition(TerminalState.PROMPT)) {
      throw new Error('Cannot start prompt in current terminal state');
    }

    try {
      const result = await operation();
      this.transition(TerminalState.NORMAL);
      return result;
    } catch (error) {
      this.transition(TerminalState.NORMAL);
      throw error;
    }
  }

  /**
   * Get recent state history for debugging
   */
  public getHistory(): StateTransition[] {
    return [...this.stateHistory];
  }
}

/**
 * Get the singleton terminal state manager
 */
export function getTerminalStateManager(): TerminalStateManager {
  return TerminalStateManager.getInstance();
}

/**
 * Convenience export
 */
export const terminalState = TerminalStateManager.getInstance();
