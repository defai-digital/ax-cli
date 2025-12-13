/**
 * Keyboard Shortcuts Hook
 *
 * Handles keyboard shortcuts and mode toggles for the chat interface.
 * Extracted from use-input-handler.ts for better testability.
 *
 * @packageDocumentation
 */

import { useState, useCallback } from "react";
import { ConfirmationService } from "../../utils/confirmation-service.js";
import { VerbosityLevel } from "../../constants.js";
import type { LLMAgent } from "../../agent/llm-agent.js";
import type { Key } from "./use-enhanced-input.js";

/**
 * Options for useKeyboardShortcuts hook
 */
export interface UseKeyboardShortcutsOptions {
  /** The LLM agent instance */
  agent: LLMAgent;
  /** Whether the confirmation dialog is active */
  isConfirmationActive?: boolean;
  /** Whether processing is in progress */
  isProcessing: boolean;
  /** Whether streaming is in progress */
  isStreaming: boolean;
  /** Callback when processing state changes */
  setIsProcessing: (processing: boolean) => void;
  /** Callback when streaming state changes */
  setIsStreaming: (streaming: boolean) => void;
  /** Callback when token count changes */
  setTokenCount: (count: number) => void;
  /** Callback when processing time changes */
  setProcessingTime: (time: number) => void;
  /** Reference to processing start time */
  processingStartTime: React.MutableRefObject<number>;
  /** Callback when verbose mode changes */
  onVerboseModeChange?: (enabled: boolean) => void;
  /** Callback when background mode changes */
  onBackgroundModeChange?: (enabled: boolean) => void;
  /** Callback when auto-edit mode changes */
  onAutoEditModeChange?: (enabled: boolean) => void;
  /** Callback when operation is interrupted */
  onOperationInterrupted?: () => void;
  /** Callback when thinking mode changes */
  onThinkingModeChange?: (enabled: boolean) => void;
}

/**
 * Result from useKeyboardShortcuts hook
 */
export interface UseKeyboardShortcutsResult {
  /** Current auto-edit mode state */
  autoEditEnabled: boolean;
  /** Toggle auto-edit mode */
  toggleAutoEditMode: () => void;
  /** Current verbosity level */
  verbosityLevel: VerbosityLevel;
  /** Set verbosity level */
  setVerbosityLevel: React.Dispatch<React.SetStateAction<VerbosityLevel>>;
  /** Legacy verbose mode boolean */
  verboseMode: boolean;
  /** Toggle verbose mode */
  handleVerboseToggle: () => void;
  /** Current background mode state */
  backgroundMode: boolean;
  /** Toggle background mode */
  handleBackgroundModeToggle: () => void;
  /** Current thinking mode state */
  thinkingModeEnabled: boolean;
  /** Toggle thinking mode */
  handleThinkingModeToggle: () => void;
  /** Handle special keyboard keys */
  handleSpecialKey: (
    key: Key,
    options: {
      showCommandSuggestions: boolean;
      setShowCommandSuggestions: (show: boolean) => void;
      setSelectedCommandIndex: (index: number | ((prev: number) => number)) => void;
      suggestionMode: "command" | "resource";
      setResourceSuggestions: (resources: unknown[]) => void;
      setSuggestionMode: (mode: "command" | "resource") => void;
      currentSuggestions: Array<{ command: string; description: string }>;
      selectedCommandIndex: number;
      input: string;
      setInput: (input: string) => void;
      setCursorPosition: (position: number) => void;
    }
  ) => boolean;
}

/**
 * Hook for managing keyboard shortcuts and mode toggles
 *
 * @param options - Hook options
 * @returns Keyboard shortcut handlers and mode states
 *
 * @example
 * ```tsx
 * const {
 *   autoEditEnabled,
 *   toggleAutoEditMode,
 *   verbosityLevel,
 *   handleVerboseToggle,
 *   handleSpecialKey,
 * } = useKeyboardShortcuts({
 *   agent,
 *   isProcessing,
 *   isStreaming,
 *   // ... other options
 * });
 * ```
 */
export function useKeyboardShortcuts({
  agent,
  isConfirmationActive = false,
  isProcessing,
  isStreaming,
  setIsProcessing,
  setIsStreaming,
  setTokenCount,
  setProcessingTime,
  processingStartTime,
  onVerboseModeChange,
  onBackgroundModeChange,
  onAutoEditModeChange,
  onOperationInterrupted,
  onThinkingModeChange,
}: UseKeyboardShortcutsOptions): UseKeyboardShortcutsResult {
  // Auto-edit mode state
  const [autoEditEnabled, setAutoEditEnabled] = useState(() => {
    const confirmationService = ConfirmationService.getInstance();
    const sessionFlags = confirmationService.getSessionFlags();
    // Default to true (auto-edit enabled by default)
    return sessionFlags.allOperations !== undefined ? sessionFlags.allOperations : true;
  });

  // Verbosity mode states
  const [verboseMode, setVerboseMode] = useState(false);
  const [verbosityLevel, setVerbosityLevel] = useState<VerbosityLevel>(VerbosityLevel.QUIET);

  // Background mode state
  const [backgroundMode, setBackgroundMode] = useState(false);

  // Thinking mode state
  const [thinkingModeEnabled, setThinkingModeEnabled] = useState(true);

  /**
   * Toggle auto-edit mode
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
    onAutoEditModeChange?.(newAutoEditState);
  }, [autoEditEnabled, onAutoEditModeChange]);

  /**
   * Toggle verbose mode (cycles through levels)
   */
  const handleVerboseToggle = useCallback(() => {
    setVerbosityLevel((prev) => {
      const nextLevel = ((prev + 1) % 3) as VerbosityLevel;

      // Update legacy verboseMode for backward compatibility
      setVerboseMode(nextLevel === VerbosityLevel.VERBOSE);

      // Notify parent for toast/flash feedback
      onVerboseModeChange?.(nextLevel === VerbosityLevel.VERBOSE);

      return nextLevel;
    });
  }, [onVerboseModeChange]);

  /**
   * Toggle background mode
   */
  const handleBackgroundModeToggle = useCallback(() => {
    setBackgroundMode((prev) => {
      const newMode = !prev;
      onBackgroundModeChange?.(newMode);
      return newMode;
    });
  }, [onBackgroundModeChange]);

  /**
   * Toggle thinking mode
   */
  const handleThinkingModeToggle = useCallback(() => {
    setThinkingModeEnabled((prev) => {
      const newMode = !prev;
      // Update agent thinking configuration
      if (newMode) {
        agent.setThinkingConfig({ type: "enabled" });
      } else {
        agent.setThinkingConfig({ type: "disabled" });
      }
      // Notify parent for toast/flash feedback
      onThinkingModeChange?.(newMode);
      return newMode;
    });
  }, [agent, onThinkingModeChange]);

  /**
   * Handle special keyboard keys (escape, arrows, tab, etc.)
   */
  const handleSpecialKey = useCallback((
    key: Key,
    options: {
      showCommandSuggestions: boolean;
      setShowCommandSuggestions: (show: boolean) => void;
      setSelectedCommandIndex: (index: number | ((prev: number) => number)) => void;
      suggestionMode: "command" | "resource";
      setResourceSuggestions: (resources: unknown[]) => void;
      setSuggestionMode: (mode: "command" | "resource") => void;
      currentSuggestions: Array<{ command: string; description: string }>;
      selectedCommandIndex: number;
      input: string;
      setInput: (input: string) => void;
      setCursorPosition: (position: number) => void;
    }
  ): boolean => {
    // Don't handle input if confirmation dialog is active
    if (isConfirmationActive) {
      return true; // Prevent default handling
    }

    // Handle shift+tab to toggle auto-edit mode
    if (key.shift && key.tab) {
      toggleAutoEditMode();
      return true;
    }

    // Handle escape key for closing menus
    if (key.escape) {
      if (options.showCommandSuggestions) {
        options.setShowCommandSuggestions(false);
        options.setSelectedCommandIndex(0);
        // Reset resource mode if active
        if (options.suggestionMode === "resource") {
          options.setResourceSuggestions([]);
          options.setSuggestionMode("command");
        }
        return true;
      }
      if (isProcessing || isStreaming) {
        agent.abortCurrentOperation();
        setIsProcessing(false);
        setIsStreaming(false);
        setTokenCount(0);
        setProcessingTime(0);
        processingStartTime.current = 0;
        // Notify parent for toast feedback
        onOperationInterrupted?.();
        return true;
      }
      return false; // Let default escape handling work
    }

    // Handle command/resource suggestions navigation
    if (options.showCommandSuggestions) {
      const { currentSuggestions } = options;

      if (currentSuggestions.length === 0) {
        options.setShowCommandSuggestions(false);
        options.setSelectedCommandIndex(0);
        return false; // Continue processing
      }

      if (key.upArrow) {
        options.setSelectedCommandIndex((prev) =>
          prev === 0 ? currentSuggestions.length - 1 : prev - 1
        );
        return true;
      }

      if (key.downArrow) {
        options.setSelectedCommandIndex(
          (prev) => (prev + 1) % currentSuggestions.length
        );
        return true;
      }

      if (key.tab || key.return) {
        // Check if there are any suggestions available
        if (currentSuggestions.length === 0) {
          return true; // No suggestions, do nothing
        }

        const safeIndex = Math.min(
          options.selectedCommandIndex,
          currentSuggestions.length - 1
        );
        const selected = currentSuggestions[safeIndex];

        if (options.suggestionMode === "resource") {
          // Replace @mcp:partial with the full reference
          const mcpMatch = options.input.match(/@mcp:[^\s]*$/);
          if (mcpMatch) {
            const newInput = options.input.replace(/@mcp:[^\s]*$/, selected.command + " ");
            options.setInput(newInput);
            options.setCursorPosition(newInput.length);
          }
          // Reset resource mode
          options.setResourceSuggestions([]);
          options.setSuggestionMode("command");
        } else {
          // Command suggestion - replace entire input
          const newInput = selected.command + " ";
          options.setInput(newInput);
          options.setCursorPosition(newInput.length);
        }

        options.setShowCommandSuggestions(false);
        options.setSelectedCommandIndex(0);
        return true;
      }
    }

    return false; // Let default handling proceed
  }, [
    isConfirmationActive,
    isProcessing,
    isStreaming,
    toggleAutoEditMode,
    agent,
    setIsProcessing,
    setIsStreaming,
    setTokenCount,
    setProcessingTime,
    processingStartTime,
    onOperationInterrupted,
  ]);

  return {
    autoEditEnabled,
    toggleAutoEditMode,
    verbosityLevel,
    setVerbosityLevel,
    verboseMode,
    handleVerboseToggle,
    backgroundMode,
    handleBackgroundModeToggle,
    thinkingModeEnabled,
    handleThinkingModeToggle,
    handleSpecialKey,
  };
}
