import { useState, useCallback, useRef } from "react";
import {
  deleteCharBefore,
  deleteCharAfter,
  deleteWordBefore,
  deleteWordAfter,
  insertText,
  moveToLineStart,
  moveToPreviousWord,
  moveToNextWord,
} from "../utils/text-utils.js";
import { useInputHistory } from "./use-input-history.js";

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

export interface EnhancedInputHook {
  input: string;
  cursorPosition: number;
  isMultiline: boolean;
  setInput: (text: string) => void;
  setCursorPosition: (position: number) => void;
  clearInput: () => void;
  insertAtCursor: (text: string) => void;
  resetHistory: () => void;
  handleInput: (inputChar: string, key: Key) => void;
}

interface UseEnhancedInputProps {
  onSubmit?: (text: string) => void;
  onEscape?: () => void;
  onSpecialKey?: (key: Key) => boolean; // Return true to prevent default handling
  onVerboseToggle?: () => void; // Ctrl+O toggles verbose mode
  onQuickActions?: () => void; // Ctrl+K opens quick actions
  onBackgroundModeToggle?: () => void; // Ctrl+B toggles background mode
  onCopyLastResponse?: () => void; // Ctrl+Y copies last response
  disabled?: boolean;
  multiline?: boolean;
}

export function useEnhancedInput({
  onSubmit,
  onEscape,
  onSpecialKey,
  onVerboseToggle,
  onQuickActions,
  onBackgroundModeToggle,
  onCopyLastResponse,
  disabled = false,
  multiline = false,
}: UseEnhancedInputProps = {}): EnhancedInputHook {
  const [input, setInputState] = useState("");
  const [cursorPosition, setCursorPositionState] = useState(0);
  const isMultilineRef = useRef(multiline);

  // Keep ref in sync with prop to avoid stale closure
  isMultilineRef.current = multiline;

  const {
    addToHistory,
    navigateHistory,
    resetHistory,
    setOriginalInput,
    isNavigatingHistory,
  } = useInputHistory();

  const setInput = useCallback((text: string) => {
    setInputState(text);
    // Use functional update to get the current cursor position, avoiding stale closure
    setCursorPositionState((currentCursor) => Math.min(text.length, currentCursor));
    if (!isNavigatingHistory()) {
      setOriginalInput(text);
    }
  }, [isNavigatingHistory, setOriginalInput]);

  const setCursorPosition = useCallback((position: number) => {
    // Use functional update to access current input state without stale closure
    setInputState((currentInput) => {
      setCursorPositionState(Math.max(0, Math.min(currentInput.length, position)));
      return currentInput; // No change to input, just accessing for bounds check
    });
  }, []);

  const clearInput = useCallback(() => {
    setInputState("");
    setCursorPositionState(0);
    setOriginalInput("");
  }, [setOriginalInput]);

  const insertAtCursor = useCallback((text: string) => {
    const result = insertText(input, cursorPosition, text);
    setInputState(result.text);
    setCursorPositionState(result.position);
    setOriginalInput(result.text);
  }, [input, cursorPosition, setOriginalInput]);

  const handleSubmit = useCallback(() => {
    if (input.trim()) {
      addToHistory(input);
      onSubmit?.(input);
      clearInput();
    }
  }, [input, addToHistory, onSubmit, clearInput]);

  const handleInput = useCallback((inputChar: string, key: Key) => {
    if (disabled) return;

    // Handle Ctrl+C - check multiple ways it could be detected
    if ((key.ctrl && inputChar === "c") || inputChar === "\x03") {
      setInputState("");
      setCursorPositionState(0);
      setOriginalInput("");
      return;
    }

    // Allow special key handler to override default behavior
    if (onSpecialKey?.(key)) {
      return;
    }

    // Handle Escape
    if (key.escape) {
      onEscape?.();
      return;
    }

    // Handle Enter/Return
    if (key.return) {
      if (isMultilineRef.current && key.shift) {
        // Shift+Enter in multiline mode inserts newline
        const result = insertText(input, cursorPosition, "\n");
        setInputState(result.text);
        setCursorPositionState(result.position);
        setOriginalInput(result.text);
      } else {
        handleSubmit();
      }
      return;
    }

    // Handle history navigation
    if ((key.upArrow || key.name === 'up') && !key.ctrl && !key.meta) {
      const historyInput = navigateHistory("up");
      if (historyInput !== null) {
        setInputState(historyInput);
        setCursorPositionState(historyInput.length);
      }
      return;
    }

    if ((key.downArrow || key.name === 'down') && !key.ctrl && !key.meta) {
      const historyInput = navigateHistory("down");
      if (historyInput !== null) {
        setInputState(historyInput);
        setCursorPositionState(historyInput.length);
      }
      return;
    }

    // Handle cursor movement - ignore meta flag for arrows as it's unreliable in terminals
    // Only do word movement if ctrl is pressed AND no arrow escape sequence is in inputChar
    if ((key.leftArrow || key.name === 'left') && key.ctrl && !inputChar.includes('[')) {
      const newPos = moveToPreviousWord(input, cursorPosition);
      setCursorPositionState(newPos);
      return;
    }

    if ((key.rightArrow || key.name === 'right') && key.ctrl && !inputChar.includes('[')) {
      const newPos = moveToNextWord(input, cursorPosition);
      setCursorPositionState(newPos);
      return;
    }

    // Handle regular cursor movement - single character (ignore meta flag)
    if (key.leftArrow || key.name === 'left') {
      const newPos = Math.max(0, cursorPosition - 1);
      setCursorPositionState(newPos);
      return;
    }

    if (key.rightArrow || key.name === 'right') {
      const newPos = Math.min(input.length, cursorPosition + 1);
      setCursorPositionState(newPos);
      return;
    }

    // Handle Home/End keys or Ctrl+A/E
    if ((key.ctrl && inputChar === "a") || key.name === "home") {
      setCursorPositionState(0); // Simple start of input
      return;
    }

    if ((key.ctrl && inputChar === "e") || key.name === "end") {
      setCursorPositionState(input.length); // Simple end of input
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
      if (key.ctrl || key.meta) {
        // Ctrl/Cmd + Backspace: Delete word before cursor
        const result = deleteWordBefore(input, cursorPosition);
        setInputState(result.text);
        setCursorPositionState(result.position);
        setOriginalInput(result.text);
      } else {
        // Regular backspace
        const result = deleteCharBefore(input, cursorPosition);
        setInputState(result.text);
        setCursorPositionState(result.position);
        setOriginalInput(result.text);
      }
      return;
    }

    // Handle forward delete (Del key) - but not if it was already handled as backspace above
    // Note: Ctrl+D is also treated as delete character (standard terminal behavior)
    if (key.delete && inputChar !== '') {
      if (key.ctrl || key.meta) {
        // Ctrl/Cmd + Delete: Delete word after cursor
        const result = deleteWordAfter(input, cursorPosition);
        setInputState(result.text);
        setCursorPositionState(result.position);
        setOriginalInput(result.text);
      } else {
        // Regular delete
        const result = deleteCharAfter(input, cursorPosition);
        setInputState(result.text);
        setCursorPositionState(result.position);
        setOriginalInput(result.text);
      }
      return;
    }

    // Handle Ctrl+D: Delete character after cursor (standard terminal behavior)
    if (key.ctrl && inputChar === "d") {
      const result = deleteCharAfter(input, cursorPosition);
      setInputState(result.text);
      setCursorPositionState(result.position);
      setOriginalInput(result.text);
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
      const lineStart = moveToLineStart(input, cursorPosition);
      const newText = input.slice(0, lineStart) + input.slice(cursorPosition);
      setInputState(newText);
      setCursorPositionState(lineStart);
      setOriginalInput(newText);
      return;
    }

    // Handle Ctrl+W: Delete word before cursor
    // Check both key.ctrl with 'w' and raw ASCII code \x17 (Ctrl+W = ASCII 23)
    if ((key.ctrl && inputChar === "w") || inputChar === "\x17") {
      const result = deleteWordBefore(input, cursorPosition);
      setInputState(result.text);
      setCursorPositionState(result.position);
      setOriginalInput(result.text);
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
      return;
    }

    // Handle regular character input
    if (inputChar && !key.ctrl && !key.meta) {
      const result = insertText(input, cursorPosition, inputChar);
      setInputState(result.text);
      setCursorPositionState(result.position);
      setOriginalInput(result.text);
    }
  }, [disabled, onSpecialKey, onVerboseToggle, onQuickActions, onBackgroundModeToggle, onCopyLastResponse, input, cursorPosition, multiline, handleSubmit, navigateHistory, setOriginalInput]);

  return {
    input,
    cursorPosition,
    isMultiline: isMultilineRef.current,
    setInput,
    setCursorPosition,
    clearInput,
    insertAtCursor,
    resetHistory,
    handleInput,
  };
}