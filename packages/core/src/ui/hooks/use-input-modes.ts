/**
 * Input Modes Hook
 *
 * Manages UI mode state for the chat interface including:
 * - Auto-edit mode (automatic approval of operations)
 * - Verbosity levels (quiet, concise, verbose)
 * - Background mode (run commands in background)
 * - Thinking mode (enable/disable LLM reasoning)
 *
 * @packageDocumentation
 */

import { useState, useCallback } from "react";
import { VerbosityLevel } from "../../constants.js";
import { ConfirmationService } from "../../utils/confirmation-service.js";
import type { LLMAgent } from "../../agent/llm-agent.js";

/**
 * Callback props for mode change notifications
 */
export interface InputModeCallbacks {
  /** Called when verbose mode changes */
  onVerboseModeChange?: (enabled: boolean) => void;
  /** Called when background mode changes */
  onBackgroundModeChange?: (enabled: boolean) => void;
  /** Called when auto-edit mode changes */
  onAutoEditModeChange?: (enabled: boolean) => void;
  /** Called when thinking mode changes */
  onThinkingModeChange?: (enabled: boolean) => void;
  /** Called when a task is moved to background */
  onTaskMovedToBackground?: (taskId: string) => void;
}

/**
 * Props for useInputModes hook
 */
export interface UseInputModesProps {
  /** LLM Agent for mode interactions */
  agent: LLMAgent;
  /** Callbacks for mode change notifications */
  callbacks?: InputModeCallbacks;
}

/**
 * Return type for useInputModes hook
 */
export interface UseInputModesReturn {
  // State
  /** Whether auto-edit mode is enabled */
  autoEditEnabled: boolean;
  /** Legacy verbose mode boolean */
  verboseMode: boolean;
  /** Current verbosity level (0=quiet, 1=concise, 2=verbose) */
  verbosityLevel: VerbosityLevel;
  /** Whether background mode is enabled */
  backgroundMode: boolean;
  /** Whether thinking mode is enabled */
  thinkingModeEnabled: boolean;

  // Toggles
  /** Toggle auto-edit mode on/off */
  toggleAutoEditMode: () => void;
  /** Cycle through verbosity levels */
  handleVerboseToggle: () => void;
  /** Toggle background mode or move current bash to background */
  handleBackgroundModeToggle: () => void;
  /** Toggle thinking mode on/off */
  handleThinkingModeToggle: () => void;

  // Setters (for direct control)
  /** Set auto-edit mode directly */
  setAutoEditEnabled: (enabled: boolean) => void;
  /** Set verbosity level directly */
  setVerbosityLevel: (level: VerbosityLevel) => void;
  /** Set background mode directly */
  setBackgroundMode: (enabled: boolean) => void;
  /** Set thinking mode directly */
  setThinkingModeEnabled: (enabled: boolean) => void;
}

/**
 * Hook for managing UI input modes.
 *
 * @example
 * ```tsx
 * const {
 *   autoEditEnabled,
 *   verbosityLevel,
 *   toggleAutoEditMode,
 *   handleVerboseToggle,
 * } = useInputModes({
 *   agent,
 *   callbacks: {
 *     onAutoEditModeChange: (enabled) => showToast(enabled ? 'Auto-edit ON' : 'Auto-edit OFF'),
 *   },
 * });
 * ```
 */
export function useInputModes({
  agent,
  callbacks,
}: UseInputModesProps): UseInputModesReturn {
  // Initialize auto-edit from session state
  const [autoEditEnabled, setAutoEditEnabled] = useState(() => {
    const confirmationService = ConfirmationService.getInstance();
    const sessionFlags = confirmationService.getSessionFlags();
    // Default to true (auto-edit enabled by default)
    return sessionFlags.allOperations !== undefined ? sessionFlags.allOperations : true;
  });

  // Verbosity state
  const [verboseMode, setVerboseMode] = useState(false); // Legacy boolean for backward compat
  const [verbosityLevel, setVerbosityLevel] = useState<VerbosityLevel>(VerbosityLevel.QUIET);

  // Background mode state
  const [backgroundMode, setBackgroundMode] = useState(false);

  // Thinking mode state
  const [thinkingModeEnabled, setThinkingModeEnabled] = useState(true);

  /**
   * Toggle auto-edit mode on/off
   */
  const toggleAutoEditMode = useCallback(() => {
    const newAutoEditState = !autoEditEnabled;
    setAutoEditEnabled(newAutoEditState);

    const confirmationService = ConfirmationService.getInstance();
    if (newAutoEditState) {
      // Enable auto-edit: set all operations to be accepted
      confirmationService.setSessionFlag("allOperations", true);
    } else {
      // Disable auto-edit: reset session flags
      confirmationService.resetSession();
    }
    // Notify parent for toast/flash feedback
    callbacks?.onAutoEditModeChange?.(newAutoEditState);
  }, [autoEditEnabled, callbacks]);

  /**
   * Cycle through verbosity levels: QUIET -> CONCISE -> VERBOSE -> QUIET
   */
  const handleVerboseToggle = useCallback(() => {
    setVerbosityLevel((prev) => {
      const nextLevel = (prev + 1) % 3; // Cycle through 0, 1, 2

      // Update legacy verboseMode for backward compatibility
      setVerboseMode(nextLevel === VerbosityLevel.VERBOSE);

      // Notify parent for toast/flash feedback
      callbacks?.onVerboseModeChange?.(nextLevel === VerbosityLevel.VERBOSE);

      return nextLevel as VerbosityLevel;
    });
  }, [callbacks]);

  /**
   * Toggle background mode or move current bash execution to background
   */
  const handleBackgroundModeToggle = useCallback(() => {
    // Check if a bash command is currently executing
    if (agent.isBashExecuting()) {
      const taskId = agent.moveBashToBackground();
      if (taskId) {
        // Notify parent for toast feedback
        callbacks?.onTaskMovedToBackground?.(taskId);
        return;
      }
    }
    // Otherwise toggle background mode preference
    setBackgroundMode((prev) => {
      const newState = !prev;
      // Notify parent for toast/flash feedback
      callbacks?.onBackgroundModeChange?.(newState);
      return newState;
    });
  }, [agent, callbacks]);

  /**
   * Toggle thinking mode on/off
   */
  const handleThinkingModeToggle = useCallback(() => {
    setThinkingModeEnabled((prev) => {
      const newState = !prev;
      // Update agent thinking configuration
      if (newState) {
        agent.setThinkingConfig({ type: "enabled" });
      } else {
        agent.setThinkingConfig({ type: "disabled" });
      }
      // Notify parent for toast/flash feedback
      callbacks?.onThinkingModeChange?.(newState);
      return newState;
    });
  }, [agent, callbacks]);

  return {
    // State
    autoEditEnabled,
    verboseMode,
    verbosityLevel,
    backgroundMode,
    thinkingModeEnabled,

    // Toggles
    toggleAutoEditMode,
    handleVerboseToggle,
    handleBackgroundModeToggle,
    handleThinkingModeToggle,

    // Setters
    setAutoEditEnabled,
    setVerbosityLevel,
    setBackgroundMode,
    setThinkingModeEnabled,
  };
}

/**
 * Get display text for verbosity level
 */
export function getVerbosityDisplayText(level: VerbosityLevel): string {
  switch (level) {
    case VerbosityLevel.QUIET:
      return "Quiet";
    case VerbosityLevel.CONCISE:
      return "Concise";
    case VerbosityLevel.VERBOSE:
      return "Verbose";
    default:
      return "Unknown";
  }
}

/**
 * Get short display text for verbosity level
 */
export function getVerbosityShortText(level: VerbosityLevel): string {
  switch (level) {
    case VerbosityLevel.QUIET:
      return "Q";
    case VerbosityLevel.CONCISE:
      return "C";
    case VerbosityLevel.VERBOSE:
      return "V";
    default:
      return "?";
  }
}
