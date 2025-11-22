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
  pastedBlocks: PastedBlock[];
  currentBlockAtCursor: PastedBlock | null;
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
  const [pastedBlocks, setPastedBlocks] = useState<PastedBlock[]>([]);
  const [pasteCounter, setPasteCounter] = useState(0);
  const [currentBlockAtCursor, setCurrentBlockAtCursor] = useState<PastedBlock | null>(null);
  const isMultilineRef = useRef(multiline);
  const pasteDetectorRef = useRef(new PasteDetector());
  const pasteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    // Set cursor position with bounds checking based on current input length
    // Use separate state reads to avoid nested state updates
    setInputState((currentInput) => {
      const boundedPosition = Math.max(0, Math.min(currentInput.length, position));
      // Schedule cursor update after current state update completes
      queueMicrotask(() => {
        setCursorPositionState(boundedPosition);
      });
      return currentInput; // No change to input, just accessing for bounds check
    });
  }, []);

  const clearInput = useCallback(() => {
    setInputState("");
    setCursorPositionState(0);
    setOriginalInput("");
    setPastedBlocks([]);
    setPasteCounter(0);
    pasteDetectorRef.current.reset();
  }, [setOriginalInput]);

  const insertAtCursor = useCallback((text: string) => {
    const result = insertText(input, cursorPosition, text);
    setInputState(result.text);
    setCursorPositionState(result.position);
    setOriginalInput(result.text);
  }, [input, cursorPosition, setOriginalInput]);

  // Handle paste completion (after accumulation timeout)
  const handlePasteComplete = useCallback((pastedContent: string) => {
    // Check if should collapse
    if (shouldCollapsePaste(pastedContent)) {
      // Create pasted block
      const block = createPastedBlock(pasteCounter, pastedContent, cursorPosition);
      setPasteCounter(prev => prev + 1);
      setPastedBlocks(prev => [...prev, block]);

      // Insert placeholder instead of full content
      const placeholder = generatePlaceholder(block);
      const result = insertText(input, cursorPosition, placeholder);
      setInputState(result.text);
      setCursorPositionState(result.position);
      setOriginalInput(result.text);
    } else {
      // Insert normally (below threshold)
      const result = insertText(input, cursorPosition, pastedContent);
      setInputState(result.text);
      setCursorPositionState(result.position);
      setOriginalInput(result.text);
    }
  }, [input, cursorPosition, pasteCounter, setOriginalInput]);

  // Toggle collapse/expand for block at cursor
  const toggleBlockAtCursor = useCallback(() => {
    const block = findBlockAtCursor(input, cursorPosition, pastedBlocks);
    if (!block) return;

    const placeholder = generatePlaceholder(block);

    if (block.collapsed) {
      // Expand: find the specific occurrence near cursor and replace it
      let searchStart = 0;
      let targetStart = -1;

      // Find the occurrence that contains the cursor
      while (searchStart < input.length) {
        const occurrenceStart = input.indexOf(placeholder, searchStart);
        if (occurrenceStart === -1) break;

        const occurrenceEnd = occurrenceStart + placeholder.length;
        if (cursorPosition >= occurrenceStart && cursorPosition <= occurrenceEnd) {
          targetStart = occurrenceStart;
          break;
        }

        searchStart = occurrenceStart + 1;
      }

      if (targetStart === -1) return; // Should not happen

      // Replace only this specific occurrence
      const newInput =
        input.substring(0, targetStart) +
        block.content +
        input.substring(targetStart + placeholder.length);

      setInputState(newInput);
      // Keep cursor at same position or adjust if needed
      const newCursor = cursorPosition + (block.content.length - placeholder.length);
      setCursorPositionState(Math.min(newInput.length, newCursor));
      setOriginalInput(newInput);

      // Update block state
      setPastedBlocks(prev =>
        prev.map(b => (b.id === block.id ? { ...b, collapsed: false } : b))
      );
    } else {
      // Collapse: find the specific occurrence near cursor and replace it
      let searchStart = 0;
      let targetStart = -1;

      // Find the occurrence that contains the cursor
      while (searchStart < input.length) {
        const occurrenceStart = input.indexOf(block.content, searchStart);
        if (occurrenceStart === -1) break;

        const occurrenceEnd = occurrenceStart + block.content.length;
        if (cursorPosition >= occurrenceStart && cursorPosition <= occurrenceEnd) {
          targetStart = occurrenceStart;
          break;
        }

        searchStart = occurrenceStart + 1;
      }

      if (targetStart === -1) return; // Should not happen

      // Replace only this specific occurrence
      const newInput =
        input.substring(0, targetStart) +
        placeholder +
        input.substring(targetStart + block.content.length);

      setInputState(newInput);
      // Adjust cursor to end of placeholder
      setCursorPositionState(targetStart + placeholder.length);
      setOriginalInput(newInput);

      // Update block state
      setPastedBlocks(prev =>
        prev.map(b => (b.id === block.id ? { ...b, collapsed: true } : b))
      );
    }
  }, [input, cursorPosition, pastedBlocks, setOriginalInput]);

  // Expand all placeholders for submission
  const expandPlaceholdersForSubmit = useCallback((text: string): string => {
    return expandAllPlaceholders(text, pastedBlocks);
  }, [pastedBlocks]);

  const handleSubmit = useCallback(() => {
    if (input.trim()) {
      // Expand all placeholders before submission
      const expandedInput = expandPlaceholdersForSubmit(input);
      addToHistory(expandedInput);
      onSubmit?.(expandedInput);
      clearInput();
    }
  }, [input, addToHistory, onSubmit, clearInput, expandPlaceholdersForSubmit]);

  const handleInput = useCallback((inputChar: string, key: Key) => {
    if (disabled) return;

    // Handle Ctrl+C - check multiple ways it could be detected
    if ((key.ctrl && inputChar === "c") || inputChar === "\x03") {
      setInputState("");
      setCursorPositionState(0);
      setOriginalInput("");
      return;
    }

    // Handle Ctrl+P: Toggle expand/collapse for paste at cursor
    // Check both key.ctrl with 'p' and raw ASCII code \x10 (Ctrl+P = ASCII 16)
    if ((key.ctrl && inputChar === "p") || inputChar === "\x10") {
      toggleBlockAtCursor();
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
      // Detect paste operation
      const isPaste = pasteDetectorRef.current.detectPaste(inputChar);

      if (isPaste) {
        // Clear any existing paste timeout
        if (pasteTimeoutRef.current) {
          clearTimeout(pasteTimeoutRef.current);
        }

        // Accumulate paste input
        pasteDetectorRef.current.accumulatePasteInput(inputChar);

        // Set timeout to finalize paste (50ms after last input)
        pasteTimeoutRef.current = setTimeout(() => {
          const accumulated = pasteDetectorRef.current.getAccumulatedInput();
          if (accumulated) {
            handlePasteComplete(accumulated);
          }
          pasteTimeoutRef.current = null;
        }, 50);
      } else {
        // Normal character input
        const result = insertText(input, cursorPosition, inputChar);
        setInputState(result.text);
        setCursorPositionState(result.position);
        setOriginalInput(result.text);
      }
    }
  }, [disabled, onSpecialKey, onVerboseToggle, onQuickActions, onBackgroundModeToggle, onCopyLastResponse, input, cursorPosition, multiline, handleSubmit, navigateHistory, setOriginalInput, toggleBlockAtCursor, handlePasteComplete]);

  // Update current block at cursor when cursor position or input changes
  useEffect(() => {
    const block = findBlockAtCursor(input, cursorPosition, pastedBlocks);
    setCurrentBlockAtCursor(block);
  }, [input, cursorPosition, pastedBlocks]);

  // Cleanup paste timeout on unmount
  useEffect(() => {
    return () => {
      if (pasteTimeoutRef.current) {
        clearTimeout(pasteTimeoutRef.current);
      }
    };
  }, []);

  return {
    input,
    cursorPosition,
    isMultiline: isMultilineRef.current,
    pastedBlocks,
    currentBlockAtCursor,
    setInput,
    setCursorPosition,
    clearInput,
    insertAtCursor,
    resetHistory,
    handleInput,
    expandPlaceholdersForSubmit,
  };
}