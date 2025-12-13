/**
 * UI Hooks
 *
 * Custom React hooks for the chat interface.
 *
 * ## Architecture
 *
 * - `useInputHandler` - Main orchestrating hook used by the chat interface.
 *   Contains the complete implementation for input handling, streaming, etc.
 *
 * - Extracted hooks (`useKeyboardShortcuts`, `useStreamingHandler`, etc.) -
 *   Standalone hooks exported for SDK users who want fine-grained control
 *   or need individual pieces of functionality. These are not consumed
 *   internally by useInputHandler but provide the same logic patterns.
 *
 * @packageDocumentation
 */

// Main orchestrating hook
export { useInputHandler } from './use-input-handler.js';

// Core input hooks
export { useEnhancedInput, type Key } from './use-enhanced-input.js';
export { useInputHistory } from './use-input-history.js';
export { useChatReducer, type ChatAction, type ChatState } from './use-chat-reducer.js';

// Standalone hooks for SDK users - keyboard shortcuts
export {
  useKeyboardShortcuts,
  type UseKeyboardShortcutsOptions,
  type UseKeyboardShortcutsResult,
} from './use-keyboard-shortcuts.js';

// Standalone hooks for SDK users - command suggestions
export {
  useCommandSuggestions,
  type CommandSuggestion,
  type ModelOption,
  type UseCommandSuggestionsResult,
} from './use-command-suggestions.js';

// Standalone hooks for SDK users - input modes
export {
  useInputModes,
  getVerbosityDisplayText,
  getVerbosityShortText,
  type InputModeCallbacks,
  type UseInputModesProps,
  type UseInputModesReturn,
} from './use-input-modes.js';

// Standalone hooks for SDK users - streaming handler
export {
  useStreamingHandler,
  shouldIgnoreContentChunk,
  processStream,
  type UseStreamingHandlerProps,
  type UseStreamingHandlerReturn,
} from './use-streaming-handler.js';
