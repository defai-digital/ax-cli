import { useState, useCallback, useRef, useEffect } from "react";
import {
  deleteCharBefore,
  deleteCharAfter,
  deleteWordBefore,
  deleteWordAfter,
  insertText,
  moveToLineStart,
  moveToPreviousWord,
  moveToNextWord,
} from "../../utils/text-utils.js";
import { useInputHistory } from "./use-input-history.js";
import {
  PasteDetector,
  PastedBlock,
  shouldCollapsePaste,
  createPastedBlock,
  generatePlaceholder,
  findBlockAtCursor,
  expandAllPlaceholders,
} from "../../utils/paste-utils.js";
import { getSettingsManager } from "../../utils/settings-manager.js";
import type { RequiredInputSettings } from "../../schemas/settings-schemas.js";
import { BracketedPasteHandler } from "../utils/bracketed-paste-handler.js";

/** String literal state while parsing */
interface StringState {
  inSingleQuote: boolean;
  inDoubleQuote: boolean;
  inBacktick: boolean;
}

/** Check if currently inside any string literal */
function isInsideString(state: StringState): boolean {
  return state.inSingleQuote || state.inDoubleQuote || state.inBacktick;
}

/**
 * Parse text with escape-aware quote tracking.
 * Calls onChar for each non-escaped character with current string state.
 * Returns final string state after processing.
 */
function parseWithStringState(
  text: string,
  onChar?: (char: string, outsideString: boolean) => boolean | void
): StringState {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let isEscaped = false;

  for (const char of text) {
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (char === '\\') {
      isEscaped = true;
      continue;
    }

    // Update quote state
    if (char === "'" && !inDoubleQuote && !inBacktick) inSingleQuote = !inSingleQuote;
    else if (char === '"' && !inSingleQuote && !inBacktick) inDoubleQuote = !inDoubleQuote;
    else if (char === '`' && !inSingleQuote && !inDoubleQuote) inBacktick = !inBacktick;

    // Call handler if provided; return early if it returns true
    if (onChar) {
      const outsideString = !inSingleQuote && !inDoubleQuote && !inBacktick;
      if (onChar(char, outsideString) === true) {
        return { inSingleQuote, inDoubleQuote, inBacktick };
      }
    }
  }

  return { inSingleQuote, inDoubleQuote, inBacktick };
}

/** Get final string state after parsing text */
function getStringState(text: string): StringState {
  return parseWithStringState(text);
}

/** Check if any of the given characters appear outside of strings */
function hasCharOutsideStrings(text: string, chars: string[]): boolean {
  let found = false;
  parseWithStringState(text, (char, outsideString) => {
    if (outsideString && chars.includes(char)) {
      found = true;
      return true; // Stop parsing early
    }
    return undefined;
  });
  return found;
}

// Cached constant arrays for isIncompleteInput (avoid recreating on every call)
const TRAILING_OPERATORS = [
  '===', '!==', '...', '&&', '||', '==', '!=', '<=', '>=', '=>',
  '..', '+', '-', '*', '/', '%', '=', '<', '>', '&', '|', '^',
  '?', ':', ',', '.',
] as const;

const INCOMPLETE_KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case',
  'function', 'const', 'let', 'var', 'class', 'interface',
  'type', 'enum', 'import', 'export', 'return', 'throw',
  'try', 'catch', 'finally', 'async', 'await',
]);

/**
 * Check if input appears incomplete and should not be submitted
 * Used for smart mode to auto-insert newlines for incomplete input
 */
function isIncompleteInput(
  text: string,
  smartDetection?: {
    enabled: boolean;
    checkBrackets: boolean;
    checkOperators: boolean;
    checkStatements: boolean;
  }
): boolean {
  if (!smartDetection?.enabled) return false;

  const trimmed = text.trimEnd();
  if (!trimmed) return false;

  // Check for unclosed brackets using shared parser
  if (smartDetection.checkBrackets) {
    const brackets = { '(': 0, '[': 0, '{': 0 };
    parseWithStringState(trimmed, (char, outsideString) => {
      if (outsideString) {
        if (char === '(') brackets['(']++;
        else if (char === ')') brackets['(']--;
        else if (char === '[') brackets['[']++;
        else if (char === ']') brackets['[']--;
        else if (char === '{') brackets['{']++;
        else if (char === '}') brackets['{']--;
      }
    });

    if (brackets['('] > 0 || brackets['['] > 0 || brackets['{'] > 0) {
      return true;
    }
  }

  // Compute lastLine once for both operator and statement checks (avoid duplicate split)
  const needsLastLine = smartDetection.checkOperators || smartDetection.checkStatements;
  const lastLine = needsLastLine ? (trimmed.split('\n').pop() || '') : '';
  const lastLineState = needsLastLine ? getStringState(lastLine) : null;

  // Check for trailing operators
  if (smartDetection.checkOperators && lastLineState && !isInsideString(lastLineState)) {
    for (const op of TRAILING_OPERATORS) {
      if (trimmed.endsWith(op)) return true;
    }
  }

  // Check for incomplete statements
  if (smartDetection.checkStatements && lastLineState) {
    const state = lastLineState;

    if (!isInsideString(state)) {
      const words = lastLine.trim().split(/\s+/);
      const lastWord = words[words.length - 1];

      if (INCOMPLETE_KEYWORDS.has(lastWord)) return true;

      // Check for statement keywords at start without closing
      const firstWord = words[0];
      if (INCOMPLETE_KEYWORDS.has(firstWord)) {
        if (!hasCharOutsideStrings(lastLine, ['{', ';'])) {
          return true;
        }
      }
    }
  }

  return false;
}

export interface Key {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  sequence?: string;
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  return?: boolean;
  escape?: boolean;
  tab?: boolean;
  backspace?: boolean;
  delete?: boolean;
}

// Normalize Shift+Enter detection across terminals (Ink, CSI-u, xterm modifiers)
// See: https://github.com/anthropics/claude-code/issues/1259
// Many terminals send escape sequences for Shift+Enter that need special handling
export function isShiftEnterKey(inputChar: string, key: Key): boolean {
  // Method 1: Ink's built-in shift+return detection (works in some terminals)
  if (key.shift && key.return) {
    return true;
  }

  // Escape sequence patterns for Shift+Enter from various terminals
  // Full patterns (with ESC prefix)
  const fullPatterns = [
    /\u001b\[13;2u/,    // Kitty/WezTerm CSI-u format
    /\u001b\[13;2~/,    // xterm modifyOtherKeys
    /\u001bO2M/,        // SS3 modifier format
    /\u001b\[27;2;13~/, // xterm extended format
    /\x1b\[13;2u/,      // Alternative ESC notation
    /\x1b\[13;2~/,      // Alternative ESC notation
    /\x1bO2M/,          // Alternative ESC notation
  ];

  // Stripped patterns (ESC prefix removed by Ink/readline)
  const strippedPatterns = [
    /^\[13;2u$/,        // CSI-u without ESC
    /^\[13;2~$/,        // xterm without ESC
    /^O2M$/,            // SS3 without ESC
    /^\[27;2;13~$/,     // xterm extended without ESC
    /^\[1;2M$/,         // Some terminals
  ];

  // Method 2: Check key.sequence if available
  const sequence = key.sequence;
  if (sequence) {
    if (fullPatterns.some(pattern => pattern.test(sequence))) {
      return true;
    }
    if (strippedPatterns.some(pattern => pattern.test(sequence))) {
      return true;
    }
    // Partial match for CSI-u variants
    if (sequence.startsWith('[13;2') && (sequence.endsWith('u') || sequence.endsWith('~'))) {
      return true;
    }
    // Partial match for SS3 variants with Shift modifier (O + modifier 2-9 + M)
    // Note: OM (without digit) is plain Enter, O2M is Shift+Enter
    // Modifier 2 = Shift, 3 = Alt, 4 = Shift+Alt, 5 = Ctrl, etc.
    if (/^O[2-9]M$/.test(sequence)) {
      return true;
    }
  }

  // Method 3: Check inputChar for escape sequences
  // Ink passes the keypress.sequence as inputChar, which may contain the raw sequence
  if (inputChar) {
    if (fullPatterns.some(pattern => pattern.test(inputChar))) {
      return true;
    }
    if (strippedPatterns.some(pattern => pattern.test(inputChar))) {
      return true;
    }
    // Partial match for CSI-u variants
    if (inputChar.startsWith('[13;2') && (inputChar.endsWith('u') || inputChar.endsWith('~'))) {
      return true;
    }
    // Partial match for SS3 variants with Shift modifier
    // Note: OM (without digit) is plain Enter, O2M is Shift+Enter
    if (/^O[2-9]M$/.test(inputChar)) {
      return true;
    }
  }

  return false;
}

// Detect Option/Alt+Enter for newline insertion (Claude Code compatible)
// See: https://code.claude.com/docs/en/terminal-config
// Option+Enter is the default newline method on macOS after terminal configuration
export function isOptionEnterKey(inputChar: string, key: Key): boolean {
  // Method 1: Ink's built-in meta+return detection
  // Works when "Use Option as Meta Key" is enabled in Terminal.app/iTerm2
  if (key.meta && key.return) {
    return true;
  }

  // Method 2: ESC followed by Enter (when Option sends Esc+)
  // iTerm2 with "Left/Right Option key: Esc+" sends ESC then the character
  // ESC + CR = \x1b\r, ESC + LF = \x1b\n
  if (inputChar === '\x1b\r' || inputChar === '\x1b\n') {
    return true;
  }

  // Method 3: CSI-u format with Alt modifier (modifier 3 or higher odd numbers)
  // Modifier 3 = Alt, 5 = Ctrl, 7 = Ctrl+Alt, etc.
  const sequence = key.sequence;

  // Alt+Enter patterns
  const altPatterns = [
    /\u001b\[13;3u/,    // CSI-u Alt+Enter
    /\u001b\[13;3~/,    // xterm Alt+Enter
    /\u001bO3M/,        // SS3 Alt+Enter
    /\x1b\[13;3u/,      // Alternative notation
    /\x1b\[13;3~/,      // Alternative notation
  ];

  const strippedAltPatterns = [
    /^\[13;3u$/,        // CSI-u without ESC
    /^\[13;3~$/,        // xterm without ESC
    /^O3M$/,            // SS3 without ESC
  ];

  if (sequence) {
    if (altPatterns.some(pattern => pattern.test(sequence))) {
      return true;
    }
    if (strippedAltPatterns.some(pattern => pattern.test(sequence))) {
      return true;
    }
    // Partial match for CSI-u Alt variants
    if (sequence.startsWith('[13;3') && (sequence.endsWith('u') || sequence.endsWith('~'))) {
      return true;
    }
  }

  if (inputChar) {
    if (altPatterns.some(pattern => pattern.test(inputChar))) {
      return true;
    }
    if (strippedAltPatterns.some(pattern => pattern.test(inputChar))) {
      return true;
    }
    if (inputChar.startsWith('[13;3') && (inputChar.endsWith('u') || inputChar.endsWith('~'))) {
      return true;
    }
    // SS3 Alt+Enter
    if (inputChar === 'O3M') {
      return true;
    }
  }

  return false;
}

// Combined check for any modifier+Enter that should insert newline
// This is the primary function to use for newline detection
export function isNewlineModifierKey(inputChar: string, key: Key): boolean {
  return isShiftEnterKey(inputChar, key) || isOptionEnterKey(inputChar, key);
}

export interface EnhancedInputHook {
  input: string;
  cursorPosition: number;
  isMultiline: boolean;
  pastedBlocks: PastedBlock[];
  currentBlockAtCursor: PastedBlock | null;
  isPasting: boolean;
  setInput: (text: string) => void;
  setCursorPosition: (position: number) => void;
  clearInput: () => void;
  insertAtCursor: (text: string) => void;
  resetHistory: () => void;
  handleInput: (inputChar: string, key: Key) => void;
  expandPlaceholdersForSubmit: (text: string) => string;
}

interface UseEnhancedInputProps {
  onSubmit?: (text: string) => void;
  onEscape?: () => void;
  onSpecialKey?: (key: Key) => boolean; // Return true to prevent default handling
  onVerboseToggle?: () => void; // Ctrl+O toggles verbose mode
  onQuickActions?: () => void; // Ctrl+K opens quick actions
  onBackgroundModeToggle?: () => void; // Ctrl+B toggles background mode
  onCopyLastResponse?: () => void; // Ctrl+Y copies last response
  onAutoAcceptToggle?: () => void;
  onThinkingModeToggle?: () => void;
  onExternalEditor?: (currentInput: string) => Promise<string | null>;
  onLargePaste?: (charCount: number) => void;
  onPasteTruncated?: (originalLength: number, truncatedLength: number) => void;
  onKeyboardHelp?: () => void;
  disabled?: boolean;
  multiline?: boolean;
  projectDir?: string; // Project directory for command history isolation
}

export function useEnhancedInput({
  onSubmit,
  onEscape,
  onSpecialKey,
  onVerboseToggle,
  onQuickActions,
  onBackgroundModeToggle,
  onCopyLastResponse,
  onAutoAcceptToggle,
  onThinkingModeToggle,
  onExternalEditor,
  onLargePaste,
  onPasteTruncated,
  onKeyboardHelp,
  projectDir,
  disabled = false,
  multiline = false,
}: UseEnhancedInputProps = {}): EnhancedInputHook {
  const [input, setInputState] = useState("");
  const [cursorPosition, setCursorPositionState] = useState(0);
  const [pastedBlocks, setPastedBlocks] = useState<PastedBlock[]>([]);
  // BUG FIX: Use ref instead of state to prevent race conditions with concurrent pastes
  const pasteCounterRef = useRef(0);
  // BUG FIX: Use ref for pastedBlocks to ensure expandPlaceholdersForSubmit always has current value
  // This prevents race conditions when paste + submit happen rapidly before React re-renders
  const pastedBlocksRef = useRef<PastedBlock[]>(pastedBlocks);
  const [currentBlockAtCursor, setCurrentBlockAtCursor] = useState<PastedBlock | null>(null);
  const [isPasting, setIsPasting] = useState(false);

  // Load input configuration from settings
  const [inputConfig] = useState<RequiredInputSettings>(() => {
    return getSettingsManager().getInputConfig();
  });

  // Load paste configuration from settings (v3.8.0)
  const [pasteConfig] = useState(() => {
    return getSettingsManager().getPasteSettings();
  });

  const isMultilineRef = useRef(multiline);
  const pasteDetectorRef = useRef(new PasteDetector());
  const pasteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bracketedPasteHandlerRef = useRef(new BracketedPasteHandler());
  // Fallback paste accumulation buffer (for terminals that send paste in chunks)
  const fallbackPasteBufferRef = useRef<string>('');
  const fallbackPasteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackPasteLastChunkTimeRef = useRef<number>(0); // Track when last chunk arrived
  // FIX: Paste safety timeout - prevents premature submit when Enter arrives immediately after paste
  // Based on Gemini CLI's approach: 40ms is faster than any human can type (200 WPM = ~50ms/keystroke)
  // If Enter arrives within 40ms of paste completion, it was likely part of the paste
  const pasteCompletionTimeRef = useRef<number | null>(null);
  const PASTE_SAFETY_TIMEOUT_MS = 40; // 40ms safety window after paste completes
  // BUG FIX: Use refs for callbacks used in setTimeout to avoid stale closures
  const onLargePasteRef = useRef(onLargePaste);
  const onPasteTruncatedRef = useRef(onPasteTruncated);
  // BUG FIX: Track mounted state for async operations
  const isMountedRef = useRef(true);

  // Double-ESC detection: track last escape press time
  const lastEscapeTimeRef = useRef<number>(0);
  const DOUBLE_ESCAPE_WINDOW_MS = 500;

  // Keep ref in sync with prop to avoid stale closure
  isMultilineRef.current = multiline;
  onLargePasteRef.current = onLargePaste;
  onPasteTruncatedRef.current = onPasteTruncated;

  const {
    addToHistory,
    navigateHistory,
    resetHistory,
    setOriginalInput,
    isNavigatingHistory,
  } = useInputHistory(projectDir);

  const setInput = useCallback((text: string) => {
    setInputState(text);
    // Use functional update to get the current cursor position, avoiding stale closure
    const newCursor = Math.min(text.length, cursorPositionRef.current);
    setCursorPositionState(newCursor);
    if (!isNavigatingHistory()) {
      setOriginalInput(text);
    }
    // BUG FIX: Clear pasted blocks when input is completely replaced
    // The old block metadata is no longer valid for the new text
    pastedBlocksRef.current = [];
    setPastedBlocks([]);
    // BUG FIX: Synchronously update refs to prevent stale reads
    inputRef.current = text;
    cursorPositionRef.current = newCursor;
  }, [isNavigatingHistory, setOriginalInput]);

  const setCursorPosition = useCallback((position: number) => {
    // BUG FIX: Use inputRef for bounds checking instead of nested state update with queueMicrotask
    // This avoids race conditions where input changes between scheduling and execution
    const currentInputLength = inputRef.current.length;
    const boundedPosition = Math.max(0, Math.min(currentInputLength, position));
    setCursorPositionState(boundedPosition);
    // BUG FIX: Synchronously update ref to prevent stale reads
    cursorPositionRef.current = boundedPosition;
  }, []);

  const clearInput = useCallback(() => {
    setInputState("");
    setCursorPositionState(0);
    setOriginalInput("");
    pastedBlocksRef.current = [];
    setPastedBlocks([]);
    pasteCounterRef.current = 0; // BUG FIX: Reset counter ref
    setIsPasting(false);
    pasteDetectorRef.current.reset();
    bracketedPasteHandlerRef.current.reset();
    // Clear fallback paste buffer and timeout
    fallbackPasteBufferRef.current = '';
    fallbackPasteLastChunkTimeRef.current = 0;
    if (fallbackPasteTimeoutRef.current) {
      clearTimeout(fallbackPasteTimeoutRef.current);
      fallbackPasteTimeoutRef.current = null;
    }
    // BUG FIX: Synchronously update refs to prevent stale reads
    inputRef.current = '';
    cursorPositionRef.current = 0;
  }, [setOriginalInput]);

  const insertAtCursor = useCallback((text: string) => {
    // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
    // This ensures insertAtCursor sees the latest input/cursor even if called
    // rapidly after other state updates
    const currentInput = inputRef.current;
    const currentCursor = cursorPositionRef.current;
    const result = insertText(currentInput, currentCursor, text);
    setInputState(result.text);
    setCursorPositionState(result.position);
    setOriginalInput(result.text);
    // BUG FIX: Synchronously update refs to prevent stale reads
    inputRef.current = result.text;
    cursorPositionRef.current = result.position;
  }, [setOriginalInput]);

  // Handle paste completion
  // Note: No timeout or accumulation needed - Ink batches the entire paste for us
  // BUG FIX: Create refs to track latest values without causing re-renders
  const inputRef = useRef(input);
  const cursorPositionRef = useRef(cursorPosition);

  // Keep refs in sync with state
  useEffect(() => {
    inputRef.current = input;
    cursorPositionRef.current = cursorPosition;
  }, [input, cursorPosition]);

  // BUG FIX: Keep pastedBlocksRef in sync with state
  useEffect(() => {
    pastedBlocksRef.current = pastedBlocks;
  }, [pastedBlocks]);

  const handlePasteComplete = useCallback((pastedContent: string) => {
    // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
    const currentInput = inputRef.current;
    const currentCursor = cursorPositionRef.current;

    // FIX: Set paste completion timestamp for safety timeout
    // This prevents premature submit if Enter arrives immediately after paste
    pasteCompletionTimeRef.current = Date.now();

    // Preserve all formatting - no trimming or normalization
    // This ensures JSON indentation, newlines, and whitespace are intact

    // Check if should collapse based on line count or character count
    if (shouldCollapsePaste(pastedContent)) {
      // BUG FIX: Use ref and increment immediately to prevent race conditions
      const blockId = pasteCounterRef.current++;

      // Create pasted block with CURRENT cursor position
      const block = createPastedBlock(blockId, pastedContent, currentCursor);
      // BUG FIX: Sync ref immediately so expandPlaceholdersForSubmit has current value
      // even if submit happens before React processes the state update
      const newBlocks = [...pastedBlocksRef.current, block];
      pastedBlocksRef.current = newBlocks;
      setPastedBlocks(newBlocks);

      // Insert placeholder instead of full content
      const placeholder = generatePlaceholder(block);
      const result = insertText(currentInput, currentCursor, placeholder);
      setInputState(result.text);
      setCursorPositionState(result.position);
      setOriginalInput(result.text);
      // BUG FIX: Synchronously update refs to prevent stale reads in rapid operations
      inputRef.current = result.text;
      cursorPositionRef.current = result.position;
    } else {
      // Insert normally (below threshold) with all formatting preserved
      const result = insertText(currentInput, currentCursor, pastedContent);
      setInputState(result.text);
      setCursorPositionState(result.position);
      setOriginalInput(result.text);
      // BUG FIX: Synchronously update refs to prevent stale reads in rapid operations
      inputRef.current = result.text;
      cursorPositionRef.current = result.position;
    }
  }, [setOriginalInput]);

  // Toggle collapse/expand for block at cursor
  const toggleBlockAtCursor = useCallback(() => {
    // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
    const currentInput = inputRef.current;
    const currentCursor = cursorPositionRef.current;

    // BUG FIX: Use pastedBlocksRef.current instead of pastedBlocks to avoid stale closure
    const block = findBlockAtCursor(currentInput, currentCursor, pastedBlocksRef.current);
    if (!block) return;

    const placeholder = generatePlaceholder(block);

    if (block.collapsed) {
      // Expand: find the specific occurrence near cursor and replace it
      let searchStart = 0;
      let targetStart = -1;

      // Find the occurrence that contains the cursor
      while (searchStart < currentInput.length) {
        const occurrenceStart = currentInput.indexOf(placeholder, searchStart);
        if (occurrenceStart === -1) break;

        const occurrenceEnd = occurrenceStart + placeholder.length;
        if (currentCursor >= occurrenceStart && currentCursor <= occurrenceEnd) {
          targetStart = occurrenceStart;
          break;
        }

        searchStart = occurrenceStart + 1;
      }

      if (targetStart === -1) return; // Should not happen

      // Replace only this specific occurrence
      const newInput =
        currentInput.substring(0, targetStart) +
        block.content +
        currentInput.substring(targetStart + placeholder.length);

      setInputState(newInput);
      // Keep cursor at same position or adjust if needed
      const newCursor = currentCursor + (block.content.length - placeholder.length);
      const boundedCursor = Math.min(newInput.length, newCursor);
      setCursorPositionState(boundedCursor);
      setOriginalInput(newInput);
      // BUG FIX: Synchronously update refs to prevent stale reads
      inputRef.current = newInput;
      cursorPositionRef.current = boundedCursor;

      // Update block state
      // BUG FIX: Sync ref immediately for expandPlaceholdersForSubmit
      const updatedBlocks = pastedBlocksRef.current.map(b =>
        b.id === block.id ? { ...b, collapsed: false } : b
      );
      pastedBlocksRef.current = updatedBlocks;
      setPastedBlocks(updatedBlocks);
    } else {
      // Collapse: find the specific occurrence near cursor and replace it
      let searchStart = 0;
      let targetStart = -1;

      // Find the occurrence that contains the cursor
      while (searchStart < currentInput.length) {
        const occurrenceStart = currentInput.indexOf(block.content, searchStart);
        if (occurrenceStart === -1) break;

        const occurrenceEnd = occurrenceStart + block.content.length;
        if (currentCursor >= occurrenceStart && currentCursor <= occurrenceEnd) {
          targetStart = occurrenceStart;
          break;
        }

        searchStart = occurrenceStart + 1;
      }

      if (targetStart === -1) return; // Should not happen

      // Replace only this specific occurrence
      const newInput =
        currentInput.substring(0, targetStart) +
        placeholder +
        currentInput.substring(targetStart + block.content.length);

      setInputState(newInput);
      // Adjust cursor to end of placeholder
      const newCursor = targetStart + placeholder.length;
      setCursorPositionState(newCursor);
      setOriginalInput(newInput);
      // BUG FIX: Synchronously update refs to prevent stale reads
      inputRef.current = newInput;
      cursorPositionRef.current = newCursor;

      // Update block state
      // BUG FIX: Sync ref immediately for expandPlaceholdersForSubmit
      const updatedBlocks = pastedBlocksRef.current.map(b =>
        b.id === block.id ? { ...b, collapsed: true } : b
      );
      pastedBlocksRef.current = updatedBlocks;
      setPastedBlocks(updatedBlocks);
    }
  // BUG FIX: Remove pastedBlocks from dependencies - we use pastedBlocksRef.current instead
  }, [setOriginalInput]);

  // Expand all placeholders for submission
  // BUG FIX: Use ref to always get current pastedBlocks, avoiding stale closure
  // This ensures rapid paste + submit sequences work correctly before React re-renders
  const expandPlaceholdersForSubmit = useCallback((text: string): string => {
    return expandAllPlaceholders(text, pastedBlocksRef.current);
  }, []);

  const handleSubmit = useCallback(() => {
    // BUG FIX: Check for active bracketed paste mode before submitting
    // If we're in the middle of receiving a bracketed paste, don't submit yet
    if (bracketedPasteHandlerRef.current.isAccumulating()) {
      // Bracketed paste is in progress - wait for it to complete
      // The enter key will be part of the paste content
      return;
    }

    // BUG FIX: Check for pending fallback paste accumulation before submitting
    if (fallbackPasteBufferRef.current.length > 0) {
      // There's accumulated paste content - flush it first
      if (fallbackPasteTimeoutRef.current) {
        clearTimeout(fallbackPasteTimeoutRef.current);
        fallbackPasteTimeoutRef.current = null;
      }

      const accumulatedPaste = fallbackPasteBufferRef.current;
      fallbackPasteBufferRef.current = '';
      fallbackPasteLastChunkTimeRef.current = 0;

      // Add accumulated paste to input before submitting
      try {
        handlePasteComplete(accumulatedPaste);
      } catch {
        // BUG FIX: Silently ignore paste errors to avoid cluttering CLI output
        // The paste data is already cleared, so we just proceed
      }

      // Don't submit yet - let the paste complete first
      // User can hit Enter again to submit
      return;
    }

    // FIX: Paste safety timeout - prevent premature submit after paste
    // If Enter arrives within 40ms of paste completion, it was likely part of the paste
    // (trailing newline). Insert newline instead of submitting.
    if (pasteCompletionTimeRef.current !== null) {
      const elapsed = Date.now() - pasteCompletionTimeRef.current;
      if (elapsed < PASTE_SAFETY_TIMEOUT_MS) {
        // Enter arrived too soon after paste - treat as newline, not submit
        // This prevents accidental submission when paste includes trailing newline
        const currentInput = inputRef.current;
        const currentCursor = cursorPositionRef.current;
        const result = insertText(currentInput, currentCursor, "\n");
        setInputState(result.text);
        setCursorPositionState(result.position);
        setOriginalInput(result.text);
        inputRef.current = result.text;
        cursorPositionRef.current = result.position;
        return;
      }
      // Clear the timestamp since we're past the safety window
      pasteCompletionTimeRef.current = null;
    }

    // BUG FIX: Use inputRef.current to get the latest input value
    // This ensures we see updates from handlePasteComplete or other operations
    const currentInput = inputRef.current;
    if (currentInput.trim()) {
      // Expand all placeholders before submission
      const expandedInput = expandPlaceholdersForSubmit(currentInput);
      addToHistory(expandedInput);
      onSubmit?.(expandedInput);
      clearInput();
    }
  }, [addToHistory, onSubmit, clearInput, expandPlaceholdersForSubmit, handlePasteComplete, setOriginalInput]);

  const handleInput = useCallback((inputChar: string, key: Key) => {
    if (disabled) return;

    // Detect modifier+Enter (Shift+Enter or Option/Alt+Enter) for newline insertion
    // This matches Claude Code's behavior: https://code.claude.com/docs/en/terminal-config
    const newlineModifierDetected = isNewlineModifierKey(inputChar, key);
    // BUG FIX: Detect Enter from multiple sources:
    // 1. key.return (standard Ink detection)
    // 2. inputChar === '\r' (carriage return - some terminals send this for Enter)
    // 3. inputChar === '\n' without Ctrl modifier (newline - other terminals send this for Enter)
    // Note: Ctrl+J sends '\n' but should insert newline, not submit, so we exclude Ctrl modifier
    // Note: Also exclude meta modifier to avoid treating Option+Enter as plain Enter
    const isPlainEnter = (inputChar === '\r' || (inputChar === '\n' && !key.ctrl)) && !key.meta;
    const enterPressed = key.return || newlineModifierDetected || isPlainEnter;

    // Handle Ctrl+C - check multiple ways it could be detected
    if ((key.ctrl && inputChar === "c") || inputChar === "\x03") {
      setInputState("");
      setCursorPositionState(0);
      setOriginalInput("");
      // BUG FIX: Clear pasted blocks when input is cleared
      pastedBlocksRef.current = [];
      setPastedBlocks([]);
      // BUG FIX: Also clear pending paste accumulation to avoid unexpected behavior
      fallbackPasteBufferRef.current = '';
      fallbackPasteLastChunkTimeRef.current = 0;
      if (fallbackPasteTimeoutRef.current) {
        clearTimeout(fallbackPasteTimeoutRef.current);
        fallbackPasteTimeoutRef.current = null;
      }
      setIsPasting(false);
      bracketedPasteHandlerRef.current.reset();
      // BUG FIX: Synchronously update refs to prevent stale reads
      inputRef.current = '';
      cursorPositionRef.current = 0;
      return;
    }

    // Handle Ctrl+P: Toggle expand/collapse for paste at cursor
    // Check both key.ctrl with 'p' and raw ASCII code \x10 (Ctrl+P = ASCII 16)
    if ((key.ctrl && inputChar === "p") || inputChar === "\x10") {
      toggleBlockAtCursor();
      return;
    }

    // Handle Escape key with double-ESC detection for clearing input
    if (key.escape) {
      const now = Date.now();

      // Let special key handler try first (close menus, abort operations)
      if (onSpecialKey?.(key)) {
        // An action was taken (menu closed, operation aborted)
        // Reset double-ESC timer since we did something
        lastEscapeTimeRef.current = 0;
        return;
      }

      // Check for double-ESC to clear input
      const inputHasText = inputRef.current.length > 0;
      const isDoubleEscape = lastEscapeTimeRef.current > 0 &&
                             (now - lastEscapeTimeRef.current) < DOUBLE_ESCAPE_WINDOW_MS;

      if (inputHasText && isDoubleEscape) {
        // Double-ESC detected with text in input - clear it
        clearInput();
        lastEscapeTimeRef.current = 0;
        return;
      }

      // Record escape time for potential double-ESC
      lastEscapeTimeRef.current = now;
      onEscape?.();
      return;
    }

    // Allow special key handler to override default behavior for non-escape keys
    if (onSpecialKey?.(key)) {
      return;
    }

    // FIX: Handle Ctrl+J - reliable newline insertion across all terminals
    // This is the vi/Unix convention: Ctrl+J sends Line Feed (0x0A)
    // Unlike Shift+Enter which is undetectable in most terminals, Ctrl+J always works
    if (key.ctrl && (inputChar === "\n" || inputChar === "\x0a" || inputChar === "j")) {
      const currentInput = inputRef.current;
      const currentCursor = cursorPositionRef.current;
      const result = insertText(currentInput, currentCursor, "\n");
      setInputState(result.text);
      setCursorPositionState(result.position);
      setOriginalInput(result.text);
      inputRef.current = result.text;
      cursorPositionRef.current = result.position;
      return;
    }

    // Handle Enter/Return - configurable multi-line input
    if (enterPressed) {
      const enterBehavior = inputConfig?.enterBehavior || 'submit';

      // Check if user pressed modifier+Enter (Shift+Enter or Option/Alt+Enter)
      // Both are treated as newline triggers in 'submit' mode (Claude Code compatible)
      const isModifierEnter = newlineModifierDetected;

      // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
      const currentInput = inputRef.current;
      const currentCursor = cursorPositionRef.current;

      // FIX: Backslash escape for newline - universal shell convention
      // If there's a backslash immediately before cursor, remove it and insert newline
      // This works in all terminals regardless of Shift+Enter/Option+Enter support
      if (currentCursor > 0 && currentInput[currentCursor - 1] === '\\') {
        // Remove the backslash and insert newline instead
        const beforeBackslash = currentInput.slice(0, currentCursor - 1);
        const afterCursor = currentInput.slice(currentCursor);
        const newInput = beforeBackslash + "\n" + afterCursor;
        const newCursor = currentCursor; // Cursor stays at same position (after newline)
        setInputState(newInput);
        setCursorPositionState(newCursor);
        setOriginalInput(newInput);
        inputRef.current = newInput;
        cursorPositionRef.current = newCursor;
        return;
      }

      if (enterBehavior === 'newline') {
        // Newline mode: Enter inserts newline, modifier+Enter submits
        if (isModifierEnter) {
          handleSubmit();
        } else {
          const result = insertText(currentInput, currentCursor, "\n");
          setInputState(result.text);
          setCursorPositionState(result.position);
          setOriginalInput(result.text);
          // BUG FIX: Synchronously update refs to prevent stale reads
          inputRef.current = result.text;
          cursorPositionRef.current = result.position;
        }
      } else if (enterBehavior === 'submit') {
        // Submit mode (default): Enter submits, modifier+Enter inserts newline
        // Supports both Shift+Enter and Option/Alt+Enter (Claude Code compatible)
        if (isModifierEnter) {
          const result = insertText(currentInput, currentCursor, "\n");
          setInputState(result.text);
          setCursorPositionState(result.position);
          setOriginalInput(result.text);
          // BUG FIX: Synchronously update refs to prevent stale reads
          inputRef.current = result.text;
          cursorPositionRef.current = result.position;
        } else {
          handleSubmit();
        }
      } else if (enterBehavior === 'smart') {
        // Smart mode: Auto-detect incomplete input
        // Modifier+Enter always submits, otherwise check if input is incomplete
        if (isModifierEnter) {
          // Explicit submit with modifier+Enter
          handleSubmit();
        } else if (isIncompleteInput(currentInput, inputConfig?.smartDetection)) {
          // Input appears incomplete, insert newline
          const result = insertText(currentInput, currentCursor, "\n");
          setInputState(result.text);
          setCursorPositionState(result.position);
          setOriginalInput(result.text);
          // BUG FIX: Synchronously update refs to prevent stale reads
          inputRef.current = result.text;
          cursorPositionRef.current = result.position;
        } else {
          // Input looks complete, submit
          handleSubmit();
        }
      }
      return;
    }

    // Handle history navigation
    if ((key.upArrow || key.name === 'up') && !key.ctrl && !key.meta) {
      const historyInput = navigateHistory("up");
      if (historyInput !== null) {
        setInputState(historyInput);
        setCursorPositionState(historyInput.length);
        // BUG FIX: Clear pasted blocks when navigating history
        // History entries don't have associated paste blocks
        pastedBlocksRef.current = [];
        setPastedBlocks([]);
        // BUG FIX: Synchronously update refs to prevent stale reads
        inputRef.current = historyInput;
        cursorPositionRef.current = historyInput.length;
      }
      return;
    }

    if ((key.downArrow || key.name === 'down') && !key.ctrl && !key.meta) {
      const historyInput = navigateHistory("down");
      if (historyInput !== null) {
        setInputState(historyInput);
        setCursorPositionState(historyInput.length);
        // BUG FIX: Clear pasted blocks when navigating history
        // History entries don't have associated paste blocks
        pastedBlocksRef.current = [];
        setPastedBlocks([]);
        // BUG FIX: Synchronously update refs to prevent stale reads
        inputRef.current = historyInput;
        cursorPositionRef.current = historyInput.length;
      }
      return;
    }

    // Handle cursor movement - ignore meta flag for arrows as it's unreliable in terminals
    // Only do word movement if ctrl is pressed AND no arrow escape sequence is in inputChar
    if ((key.leftArrow || key.name === 'left') && key.ctrl && !inputChar.includes('[')) {
      // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
      const newPos = moveToPreviousWord(inputRef.current, cursorPositionRef.current);
      setCursorPositionState(newPos);
      // BUG FIX: Synchronously update ref to prevent stale reads
      cursorPositionRef.current = newPos;
      return;
    }

    if ((key.rightArrow || key.name === 'right') && key.ctrl && !inputChar.includes('[')) {
      // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
      const newPos = moveToNextWord(inputRef.current, cursorPositionRef.current);
      setCursorPositionState(newPos);
      // BUG FIX: Synchronously update ref to prevent stale reads
      cursorPositionRef.current = newPos;
      return;
    }

    // Handle regular cursor movement - single character (ignore meta flag)
    if (key.leftArrow || key.name === 'left') {
      // BUG FIX: Use ref to get CURRENT cursor position, avoiding stale closure
      const newPos = Math.max(0, cursorPositionRef.current - 1);
      setCursorPositionState(newPos);
      // BUG FIX: Synchronously update ref to prevent stale reads
      cursorPositionRef.current = newPos;
      return;
    }

    if (key.rightArrow || key.name === 'right') {
      // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
      const newPos = Math.min(inputRef.current.length, cursorPositionRef.current + 1);
      setCursorPositionState(newPos);
      // BUG FIX: Synchronously update ref to prevent stale reads
      cursorPositionRef.current = newPos;
      return;
    }

    // Handle Home/End keys or Ctrl+A/E
    if ((key.ctrl && inputChar === "a") || key.name === "home") {
      setCursorPositionState(0); // Simple start of input
      // BUG FIX: Synchronously update ref to prevent stale reads
      cursorPositionRef.current = 0;
      return;
    }

    if ((key.ctrl && inputChar === "e") || key.name === "end") {
      // BUG FIX: Use ref to get CURRENT input length, avoiding stale closure
      const endPos = inputRef.current.length;
      setCursorPositionState(endPos); // Simple end of input
      // BUG FIX: Synchronously update ref to prevent stale reads
      cursorPositionRef.current = endPos;
      return;
    }

    // Handle deletion - check multiple ways backspace might be detected
    // Backspace can be detected in different ways depending on terminal
    // In some terminals, backspace shows up as delete:true with empty inputChar
    const isBackspace = key.backspace ||
                       key.name === 'backspace' ||
                       inputChar === '\b' ||
                       inputChar === '\x7f' ||
                       (key.delete && inputChar === '' && !key.shift);

    if (isBackspace) {
      // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
      const currentInput = inputRef.current;
      const currentCursor = cursorPositionRef.current;
      if (key.ctrl || key.meta) {
        // Ctrl/Cmd + Backspace: Delete word before cursor
        const result = deleteWordBefore(currentInput, currentCursor);
        setInputState(result.text);
        setCursorPositionState(result.position);
        setOriginalInput(result.text);
        // BUG FIX: Synchronously update refs to prevent stale reads
        inputRef.current = result.text;
        cursorPositionRef.current = result.position;
      } else {
        // Regular backspace
        const result = deleteCharBefore(currentInput, currentCursor);
        setInputState(result.text);
        setCursorPositionState(result.position);
        setOriginalInput(result.text);
        // BUG FIX: Synchronously update refs to prevent stale reads
        inputRef.current = result.text;
        cursorPositionRef.current = result.position;
      }
      return;
    }

    // Handle forward delete (Del key) - but not if it was already handled as backspace above
    // Note: Ctrl+D is also treated as delete character (standard terminal behavior)
    if (key.delete && inputChar !== '') {
      // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
      const currentInput = inputRef.current;
      const currentCursor = cursorPositionRef.current;
      if (key.ctrl || key.meta) {
        // Ctrl/Cmd + Delete: Delete word after cursor
        const result = deleteWordAfter(currentInput, currentCursor);
        setInputState(result.text);
        setCursorPositionState(result.position);
        setOriginalInput(result.text);
        // BUG FIX: Synchronously update refs to prevent stale reads
        inputRef.current = result.text;
        cursorPositionRef.current = result.position;
      } else {
        // Regular delete
        const result = deleteCharAfter(currentInput, currentCursor);
        setInputState(result.text);
        setCursorPositionState(result.position);
        setOriginalInput(result.text);
        // BUG FIX: Synchronously update refs to prevent stale reads
        inputRef.current = result.text;
        cursorPositionRef.current = result.position;
      }
      return;
    }

    // Handle Ctrl+D: Delete character after cursor (standard terminal behavior)
    if (key.ctrl && inputChar === "d") {
      // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
      const result = deleteCharAfter(inputRef.current, cursorPositionRef.current);
      setInputState(result.text);
      setCursorPositionState(result.position);
      setOriginalInput(result.text);
      // BUG FIX: Synchronously update refs to prevent stale reads
      inputRef.current = result.text;
      cursorPositionRef.current = result.position;
      return;
    }

    // Handle Ctrl+K: Open quick actions menu
    // Check both key.ctrl with 'k' and raw ASCII code \x0b (Ctrl+K = ASCII 11)
    if ((key.ctrl && inputChar === "k") || inputChar === "\x0b") {
      onQuickActions?.();
      return;
    }

    // Handle Ctrl+U: Delete from cursor to start of line
    // Check both key.ctrl with 'u' and raw ASCII code \x15 (Ctrl+U = ASCII 21)
    if ((key.ctrl && inputChar === "u") || inputChar === "\x15") {
      // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
      const currentInput = inputRef.current;
      const currentCursor = cursorPositionRef.current;
      const lineStart = moveToLineStart(currentInput, currentCursor);
      const newText = currentInput.slice(0, lineStart) + currentInput.slice(currentCursor);
      setInputState(newText);
      setCursorPositionState(lineStart);
      setOriginalInput(newText);
      // BUG FIX: Synchronously update refs to prevent stale reads
      inputRef.current = newText;
      cursorPositionRef.current = lineStart;
      return;
    }

    // Handle Ctrl+W: Delete word before cursor
    // Check both key.ctrl with 'w' and raw ASCII code \x17 (Ctrl+W = ASCII 23)
    if ((key.ctrl && inputChar === "w") || inputChar === "\x17") {
      // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
      const result = deleteWordBefore(inputRef.current, cursorPositionRef.current);
      setInputState(result.text);
      setCursorPositionState(result.position);
      setOriginalInput(result.text);
      // BUG FIX: Synchronously update refs to prevent stale reads
      inputRef.current = result.text;
      cursorPositionRef.current = result.position;
      return;
    }

    // Handle Ctrl+O: Toggle verbose mode
    // Check both key.ctrl with 'o' and raw ASCII code \x0f (Ctrl+O = ASCII 15)
    if ((key.ctrl && inputChar === "o") || inputChar === "\x0f") {
      onVerboseToggle?.();
      return;
    }

    // Handle Ctrl+B: Toggle background mode
    // Check both key.ctrl with 'b' and raw ASCII code \x02 (Ctrl+B = ASCII 2)
    if ((key.ctrl && inputChar === "b") || inputChar === "\x02") {
      onBackgroundModeToggle?.();
      return;
    }

    // Handle Ctrl+Y: Copy last response to clipboard
    // Check both key.ctrl with 'y' and raw ASCII code \x19 (Ctrl+Y = ASCII 25)
    if ((key.ctrl && inputChar === "y") || inputChar === "\x19") {
      onCopyLastResponse?.();
      return;
    }

    // Handle Ctrl+X: Clear entire input
    // Check both key.ctrl with 'x' and raw ASCII code \x18 (Ctrl+X = ASCII 24)
    if ((key.ctrl && inputChar === "x") || inputChar === "\x18") {
      setInputState("");
      setCursorPositionState(0);
      setOriginalInput("");
      // BUG FIX: Clear pasted blocks when input is cleared
      pastedBlocksRef.current = [];
      setPastedBlocks([]);
      // BUG FIX: Also clear pending paste accumulation to avoid unexpected behavior
      fallbackPasteBufferRef.current = '';
      fallbackPasteLastChunkTimeRef.current = 0;
      if (fallbackPasteTimeoutRef.current) {
        clearTimeout(fallbackPasteTimeoutRef.current);
        fallbackPasteTimeoutRef.current = null;
      }
      setIsPasting(false);
      bracketedPasteHandlerRef.current.reset();
      // BUG FIX: Synchronously update refs to prevent stale reads
      inputRef.current = '';
      cursorPositionRef.current = 0;
      return;
    }

    // Handle Shift+Tab: Toggle auto-accept mode
    if (key.shift && key.tab) {
      onAutoAcceptToggle?.();
      return;
    }

    // Handle Tab (alone): Toggle thinking mode (only when input is empty)
    // BUG FIX: Use inputRef.current to check current input length, avoiding stale closure
    if (key.tab && !key.shift && !key.ctrl && !key.meta && inputRef.current.length === 0) {
      onThinkingModeToggle?.();
      return;
    }

    // Handle Ctrl+G: Open external editor
    if ((key.ctrl && inputChar === "g") || inputChar === "\x07") {
      // BUG FIX: Use inputRef.current to get the latest input value
      // This ensures the external editor receives current content even if
      // there were rapid updates just before Ctrl+G was pressed
      const currentInput = inputRef.current;
      // Call async external editor handler
      onExternalEditor?.(currentInput).then((editedContent) => {
        // BUG FIX: Check if component is still mounted before updating state
        if (!isMountedRef.current) return;
        if (editedContent !== null) {
          setInputState(editedContent);
          setCursorPositionState(editedContent.length);
          // BUG FIX: Also update original input for history tracking
          setOriginalInput(editedContent);
          // BUG FIX: Clear pasted blocks - external editor returns fully expanded content
          // The old block metadata is no longer valid
          pastedBlocksRef.current = [];
          setPastedBlocks([]);
          // BUG FIX: Clear pending paste accumulation to prevent it from overwriting
          // the external editor content when timeout fires
          fallbackPasteBufferRef.current = '';
          fallbackPasteLastChunkTimeRef.current = 0;
          if (fallbackPasteTimeoutRef.current) {
            clearTimeout(fallbackPasteTimeoutRef.current);
            fallbackPasteTimeoutRef.current = null;
          }
          setIsPasting(false);
          bracketedPasteHandlerRef.current.reset();
          // BUG FIX: Synchronously update refs to prevent stale reads
          inputRef.current = editedContent;
          cursorPositionRef.current = editedContent.length;
        }
      }).catch(() => {
        // Ignore errors - user will see error in UI
      });
      return;
    }

    // Handle ? key: Show keyboard shortcuts help (only when input is empty)
    // BUG FIX: Use inputRef.current to check current input length, avoiding stale closure
    if (inputChar === "?" && inputRef.current.length === 0) {
      onKeyboardHelp?.();
      return;
    }

    // Handle regular character input
    if (inputChar && !key.ctrl && !key.meta) {
      // Bracketed Paste Mode Detection
      // Uses industry-standard escape sequences for reliable paste detection
      // Falls back to simple batched detection if not supported

      const { enableBracketedPaste, enableFallback } = pasteConfig;

      // Use bracketed paste handler if enabled
      if (enableBracketedPaste) {
        // BUG FIX: Check for orphaned content from timeout first
        const orphanedContent = bracketedPasteHandlerRef.current.retrieveOrphanedContent();
        if (orphanedContent) {
          // Timeout occurred and we have accumulated content without end marker
          // Process it as a paste
          try {
            handlePasteComplete(orphanedContent);
          } catch {
            // BUG FIX: Silently ignore errors to avoid cluttering CLI output
            // Continue despite error - don't block current input
          }
          // Continue processing current input normally
        }

        const result = bracketedPasteHandlerRef.current.handleInput(inputChar);

        // Update pasting state for visual indicator
        if (result.isAccumulating !== isPasting) {
          setIsPasting(result.isAccumulating);
        }

        // If still accumulating, don't process yet
        if (result.isAccumulating) {
          return;
        }

        // If paste detected and complete via bracketed paste mode
        if (result.isPaste && result.content) {
          const pastedContent = result.content;

          // Large paste handling with truncation
          const settingsManager = getSettingsManager();
          const pasteSettings = settingsManager.getPasteSettings();
          const { allowLargePaste, maxPasteLength, warningThreshold } = pasteSettings;

          if (pastedContent.length >= warningThreshold) {
            onLargePaste?.(pastedContent.length);
          }

          let finalContent = pastedContent;
          if (!allowLargePaste && pastedContent.length > maxPasteLength) {
            finalContent = pastedContent.slice(0, maxPasteLength);
            onPasteTruncated?.(pastedContent.length, maxPasteLength);
          }

          handlePasteComplete(finalContent);
          return;
        }

        // Not detected via bracketed paste mode - use fallback if enabled
        // FIX: Only use fallback if bracketed paste is NOT currently accumulating
        // This prevents race conditions where fallback creates duplicate blocks
        if (enableFallback && result.content && result.content.length > 1 &&
            !bracketedPasteHandlerRef.current.isAccumulating()) {
          // BUG FIX: Accumulate chunks with timeout instead of immediate processing
          // This prevents multiple blocks when paste arrives in chunks (SSH, tmux, etc)

          const now = Date.now();
          const isActiveAccumulation = fallbackPasteBufferRef.current.length > 0;
          const timeSinceLastChunk = now - fallbackPasteLastChunkTimeRef.current;

          // BUG FIX: Check buffer size to prevent overflow (100MB limit)
          const MAX_BUFFER_SIZE = 100 * 1024 * 1024;
          if (fallbackPasteBufferRef.current.length + result.content.length > MAX_BUFFER_SIZE) {
            // Buffer overflow - process what we have immediately
            const accumulatedContent = fallbackPasteBufferRef.current;
            fallbackPasteBufferRef.current = '';
            fallbackPasteLastChunkTimeRef.current = 0;
            if (fallbackPasteTimeoutRef.current) {
              clearTimeout(fallbackPasteTimeoutRef.current);
              fallbackPasteTimeoutRef.current = null;
            }

            // BUG FIX: Apply paste settings like other paste paths
            const settingsManager = getSettingsManager();
            const pasteSettings = settingsManager.getPasteSettings();
            const { allowLargePaste, maxPasteLength, warningThreshold } = pasteSettings;

            // Check if paste exceeds warning threshold
            if (accumulatedContent.length >= warningThreshold) {
              onLargePaste?.(accumulatedContent.length);
            }

            // Handle truncation if needed
            let finalContent = accumulatedContent;
            if (!allowLargePaste && accumulatedContent.length > maxPasteLength) {
              finalContent = accumulatedContent.slice(0, maxPasteLength);
              onPasteTruncated?.(accumulatedContent.length, maxPasteLength);
            }

            // Process accumulated content
            try {
              handlePasteComplete(finalContent);
            } catch {
              // BUG FIX: Silently ignore - avoid cluttering CLI
            }
            return;
          }

          // Add to accumulation buffer
          fallbackPasteBufferRef.current += result.content;
          fallbackPasteLastChunkTimeRef.current = now;

          // Clear existing timeout
          if (fallbackPasteTimeoutRef.current) {
            clearTimeout(fallbackPasteTimeoutRef.current);
          }

          // Dynamic timeout: Use longer window if we're actively accumulating a paste
          // Initial chunk: 200ms (fast for single-burst pastes)
          // Subsequent chunks: 500ms (handles slow terminals/networks)
          const timeoutMs = isActiveAccumulation && timeSinceLastChunk < 1000 ? 500 : 200;

          // Set new timeout - if no more chunks arrive, process the paste
          fallbackPasteTimeoutRef.current = setTimeout(() => {
            // BUG FIX: Check if component is still mounted
            if (!isMountedRef.current) return;

            // BUG FIX: Clear refs FIRST to prevent race conditions
            const accumulatedContent = fallbackPasteBufferRef.current;
            fallbackPasteBufferRef.current = '';
            fallbackPasteLastChunkTimeRef.current = 0;
            fallbackPasteTimeoutRef.current = null;

            if (!accumulatedContent) return;

            const pastedContent = accumulatedContent.replace(/\r/g, '\n');

            const settingsManager = getSettingsManager();
            const pasteSettings = settingsManager.getPasteSettings();
            const { allowLargePaste, maxPasteLength, warningThreshold } = pasteSettings;

            if (pastedContent.length >= warningThreshold) {
              onLargePasteRef.current?.(pastedContent.length);
            }

            let finalContent = pastedContent;
            if (!allowLargePaste && pastedContent.length > maxPasteLength) {
              finalContent = pastedContent.slice(0, maxPasteLength);
              onPasteTruncatedRef.current?.(pastedContent.length, maxPasteLength);
            }

            try {
              handlePasteComplete(finalContent);
            } catch {
              // BUG FIX: Silently ignore - avoid cluttering CLI
            }
          }, timeoutMs);

          return;
        }

        // Normal single character input
        if (result.content) {
          // BUG FIX: If there's a pending paste accumulation, add character to it
          // This prevents splitting user input into paste + character
          if (fallbackPasteBufferRef.current.length > 0) {
            // Add single character to accumulation buffer
            fallbackPasteBufferRef.current += result.content;

            // Extend timeout slightly (paste likely complete, but give it 100ms more)
            if (fallbackPasteTimeoutRef.current) {
              clearTimeout(fallbackPasteTimeoutRef.current);
            }

            fallbackPasteTimeoutRef.current = setTimeout(() => {
              // BUG FIX: Check if component is still mounted
              if (!isMountedRef.current) return;

              const accumulatedContent = fallbackPasteBufferRef.current;
              fallbackPasteBufferRef.current = '';
              fallbackPasteTimeoutRef.current = null;
              fallbackPasteLastChunkTimeRef.current = 0;

              if (accumulatedContent) {
                // BUG FIX: Apply paste settings (truncation/warnings) like other paste paths
                const settingsManager = getSettingsManager();
                const pasteSettings = settingsManager.getPasteSettings();
                const { allowLargePaste, maxPasteLength, warningThreshold } = pasteSettings;

                // Check if paste exceeds warning threshold
                if (accumulatedContent.length >= warningThreshold) {
                  onLargePasteRef.current?.(accumulatedContent.length);
                }

                // Handle truncation if needed
                let finalContent = accumulatedContent;
                if (!allowLargePaste && accumulatedContent.length > maxPasteLength) {
                  finalContent = accumulatedContent.slice(0, maxPasteLength);
                  onPasteTruncatedRef.current?.(accumulatedContent.length, maxPasteLength);
                }

                try {
                  handlePasteComplete(finalContent);
                } catch {
                  // BUG FIX: Catch errors to prevent timeout callback crash
                  // BUG FIX: Silently ignore - avoid cluttering CLI
                }
              }
            }, 100); // Short timeout for single char after paste

            return;
          }

          // No pending paste - process normal input
          // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
          const result2 = insertText(inputRef.current, cursorPositionRef.current, result.content);
          setInputState(result2.text);
          setCursorPositionState(result2.position);
          setOriginalInput(result2.text);
          // BUG FIX: Synchronously update refs to prevent stale reads
          inputRef.current = result2.text;
          cursorPositionRef.current = result2.position;
        }
      } else if (enableFallback) {
        // Fallback: Simple batched detection (legacy behavior when bracketed paste disabled)
        // When inputChar.length > 1, it's likely pasted content
        const isPaste = inputChar.length > 1;

        if (isPaste) {
          // BUG FIX: Use same dynamic accumulation as bracketed paste fallback
          // This ensures consistent behavior regardless of bracketed paste support

          const now = Date.now();
          const isActiveAccumulation = fallbackPasteBufferRef.current.length > 0;
          const timeSinceLastChunk = now - fallbackPasteLastChunkTimeRef.current;

          // Normalize line endings: convert \r to \n
          const normalizedInput = inputChar.replace(/\r/g, '\n');

          // BUG FIX: Check buffer size to prevent overflow (100MB limit)
          const MAX_BUFFER_SIZE = 100 * 1024 * 1024;
          if (fallbackPasteBufferRef.current.length + normalizedInput.length > MAX_BUFFER_SIZE) {
            // Buffer overflow - process what we have immediately
            const accumulatedContent = fallbackPasteBufferRef.current;
            fallbackPasteBufferRef.current = '';
            fallbackPasteLastChunkTimeRef.current = 0;
            if (fallbackPasteTimeoutRef.current) {
              clearTimeout(fallbackPasteTimeoutRef.current);
              fallbackPasteTimeoutRef.current = null;
            }

            // BUG FIX: Apply paste settings like other paste paths
            const settingsManager = getSettingsManager();
            const pasteSettings = settingsManager.getPasteSettings();
            const { allowLargePaste, maxPasteLength, warningThreshold } = pasteSettings;

            // Check if paste exceeds warning threshold
            if (accumulatedContent.length >= warningThreshold) {
              onLargePaste?.(accumulatedContent.length);
            }

            // Handle truncation if needed
            let finalContent = accumulatedContent;
            if (!allowLargePaste && accumulatedContent.length > maxPasteLength) {
              finalContent = accumulatedContent.slice(0, maxPasteLength);
              onPasteTruncated?.(accumulatedContent.length, maxPasteLength);
            }

            // Process accumulated content
            try {
              handlePasteComplete(finalContent);
            } catch {
              // BUG FIX: Silently ignore - avoid cluttering CLI
            }
            return;
          }

          // Add to accumulation buffer
          fallbackPasteBufferRef.current += normalizedInput;
          fallbackPasteLastChunkTimeRef.current = now;

          // Clear existing timeout
          if (fallbackPasteTimeoutRef.current) {
            clearTimeout(fallbackPasteTimeoutRef.current);
          }

          // Dynamic timeout: Use longer window if we're actively accumulating a paste
          const timeoutMs = isActiveAccumulation && timeSinceLastChunk < 1000 ? 500 : 200;

          // Set new timeout - if no more chunks arrive, process the paste
          fallbackPasteTimeoutRef.current = setTimeout(() => {
            // BUG FIX: Check if component is still mounted
            if (!isMountedRef.current) return;

            // BUG FIX: Clear refs FIRST to prevent race conditions
            const accumulatedContent = fallbackPasteBufferRef.current;
            fallbackPasteBufferRef.current = '';
            fallbackPasteLastChunkTimeRef.current = 0;
            fallbackPasteTimeoutRef.current = null;

            if (!accumulatedContent) return;

            const settingsManager = getSettingsManager();
            const pasteSettings = settingsManager.getPasteSettings();
            const { allowLargePaste, maxPasteLength, warningThreshold } = pasteSettings;

            if (accumulatedContent.length >= warningThreshold) {
              onLargePasteRef.current?.(accumulatedContent.length);
            }

            let finalContent = accumulatedContent;
            if (!allowLargePaste && accumulatedContent.length > maxPasteLength) {
              finalContent = accumulatedContent.slice(0, maxPasteLength);
              onPasteTruncatedRef.current?.(accumulatedContent.length, maxPasteLength);
            }

            // Handle entire accumulated paste at once
            // Note: handlePasteComplete will use CURRENT input/cursor values from React state
            try {
              handlePasteComplete(finalContent);
            } catch {
              // BUG FIX: Catch errors to prevent timeout callback crash
              // BUG FIX: Silently ignore - avoid cluttering CLI
              // Don't attempt fallback - state might be inconsistent
              // The paste content is lost but system remains stable
            }
          }, timeoutMs);

          return;
        } else {
          // Normal single character input
          // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
          const result = insertText(inputRef.current, cursorPositionRef.current, inputChar);
          setInputState(result.text);
          setCursorPositionState(result.position);
          setOriginalInput(result.text);
          // BUG FIX: Synchronously update refs to prevent stale reads
          inputRef.current = result.text;
          cursorPositionRef.current = result.position;
        }
      } else {
        // Both bracketed paste and fallback disabled - normal input only
        // BUG FIX: Use refs to get CURRENT values, avoiding stale closures
        const result = insertText(inputRef.current, cursorPositionRef.current, inputChar);
        setInputState(result.text);
        setCursorPositionState(result.position);
        setOriginalInput(result.text);
        // BUG FIX: Synchronously update refs to prevent stale reads
        inputRef.current = result.text;
        cursorPositionRef.current = result.position;
      }
    }
  }, [disabled, onSpecialKey, onVerboseToggle, onQuickActions, onBackgroundModeToggle, onCopyLastResponse, onAutoAcceptToggle, onThinkingModeToggle, onKeyboardHelp, onLargePaste, onPasteTruncated, onExternalEditor, onEscape, inputConfig, multiline, handleSubmit, navigateHistory, setOriginalInput, toggleBlockAtCursor, handlePasteComplete, pasteConfig, isPasting]);

  // Update current block at cursor when cursor position or input changes
  useEffect(() => {
    const block = findBlockAtCursor(input, cursorPosition, pastedBlocks);
    setCurrentBlockAtCursor(block);
  }, [input, cursorPosition, pastedBlocks]);

  // BUG FIX: Comprehensive cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      // BUG FIX: Set mounted flag to false first to prevent async state updates
      isMountedRef.current = false;

      // Clear all timeouts
      if (pasteTimeoutRef.current) {
        clearTimeout(pasteTimeoutRef.current);
        pasteTimeoutRef.current = null;
      }
      if (fallbackPasteTimeoutRef.current) {
        clearTimeout(fallbackPasteTimeoutRef.current);
        fallbackPasteTimeoutRef.current = null;
      }

      // Reset all detectors and handlers
      pasteDetectorRef.current.reset();
      bracketedPasteHandlerRef.current.dispose();

      // Clear buffers
      fallbackPasteBufferRef.current = '';
      fallbackPasteLastChunkTimeRef.current = 0;
    };
  }, []);

  return {
    input,
    cursorPosition,
    isMultiline: isMultilineRef.current,
    pastedBlocks,
    currentBlockAtCursor,
    isPasting,
    setInput,
    setCursorPosition,
    clearInput,
    insertAtCursor,
    resetHistory,
    handleInput,
    expandPlaceholdersForSubmit,
  };
}
