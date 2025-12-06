/**
 * Text manipulation utilities for terminal input handling
 * Inspired by Gemini CLI's text processing capabilities
 */

export interface TextPosition {
  index: number;
  line: number;
  column: number;
}

export interface TextSelection {
  start: number;
  end: number;
}

/**
 * Check if a character is a word boundary
 * Handles Unicode surrogate pairs correctly
 */
export function isWordBoundary(char: string | undefined): boolean {
  if (!char) return true;
  // Handle potential surrogate pairs - if char is a high surrogate,
  // it's incomplete and should be treated as non-boundary
  const code = char.charCodeAt(0);
  if (code >= 0xD800 && code <= 0xDBFF) {
    // High surrogate (first half of pair) - not a boundary
    return false;
  }
  if (code >= 0xDC00 && code <= 0xDFFF) {
    // Low surrogate (second half of pair) - not a boundary
    return false;
  }
  return /\s/.test(char) || /[^\w]/.test(char);
}

/**
 * Find the start of the current word at the given position
 */
export function findWordStart(text: string, position: number): number {
  if (position <= 0) return 0;
  
  let pos = position - 1;
  while (pos > 0 && !isWordBoundary(text[pos])) {
    pos--;
  }
  
  // If we stopped at a word boundary, move forward to the actual word start
  if (pos > 0 && isWordBoundary(text[pos])) {
    pos++;
  }
  
  return pos;
}

/**
 * Find the end of the current word at the given position
 */
export function findWordEnd(text: string, position: number): number {
  if (position >= text.length) return text.length;
  
  let pos = position;
  while (pos < text.length && !isWordBoundary(text[pos])) {
    pos++;
  }
  
  return pos;
}

/**
 * Move cursor to the previous word boundary
 */
export function moveToPreviousWord(text: string, position: number): number {
  if (position <= 0) return 0;
  
  let pos = position - 1;
  
  // Skip whitespace
  while (pos > 0 && isWordBoundary(text[pos])) {
    pos--;
  }
  
  // Find start of the word
  while (pos > 0 && !isWordBoundary(text[pos - 1])) {
    pos--;
  }
  
  return pos;
}

/**
 * Move cursor to the next word boundary
 */
export function moveToNextWord(text: string, position: number): number {
  if (position >= text.length) return text.length;
  
  let pos = position;
  
  // Skip current word
  while (pos < text.length && !isWordBoundary(text[pos])) {
    pos++;
  }
  
  // Skip whitespace
  while (pos < text.length && isWordBoundary(text[pos])) {
    pos++;
  }
  
  return pos;
}

/**
 * Delete the word before the cursor
 */
export function deleteWordBefore(text: string, position: number): { text: string; position: number } {
  const wordStart = moveToPreviousWord(text, position);
  const newText = text.slice(0, wordStart) + text.slice(position);
  
  return {
    text: newText,
    position: wordStart,
  };
}

/**
 * Delete the word after the cursor
 */
export function deleteWordAfter(text: string, position: number): { text: string; position: number } {
  const wordEnd = moveToNextWord(text, position);
  const newText = text.slice(0, position) + text.slice(wordEnd);
  
  return {
    text: newText,
    position,
  };
}

/**
 * Get the current line and column from text position
 * Optimized to avoid splitting the entire string
 */
export function getTextPosition(text: string, index: number): TextPosition {
  const beforeCursor = text.slice(0, index);
  let line = 0;
  let lastNewlinePos = -1;

  // Count newlines and track last position
  for (let i = 0; i < beforeCursor.length; i++) {
    if (beforeCursor[i] === '\n') {
      line++;
      lastNewlinePos = i;
    }
  }

  const column = lastNewlinePos === -1 ? index : index - lastNewlinePos - 1;

  return { index, line, column };
}

/**
 * Move to the beginning of the current line
 */
export function moveToLineStart(text: string, position: number): number {
  const beforeCursor = text.slice(0, position);
  const lastNewlineIndex = beforeCursor.lastIndexOf('\n');
  return lastNewlineIndex === -1 ? 0 : lastNewlineIndex + 1;
}

/**
 * Move to the end of the current line
 */
export function moveToLineEnd(text: string, position: number): number {
  const afterCursor = text.slice(position);
  const nextNewlineIndex = afterCursor.indexOf('\n');
  return nextNewlineIndex === -1 ? text.length : position + nextNewlineIndex;
}

/**
 * Handle proper Unicode-aware character deletion
 */
export function deleteCharBefore(text: string, position: number): { text: string; position: number } {
  if (position <= 0) {
    return { text, position };
  }
  
  // Handle surrogate pairs and combining characters
  let deleteCount = 1;
  const charBefore = text.charAt(position - 1);
  
  // Check for high surrogate (first part of surrogate pair)
  if (position >= 2) {
    const charBeforeBefore = text.charAt(position - 2);
    if (charBeforeBefore >= '\uD800' && charBeforeBefore <= '\uDBFF' && 
        charBefore >= '\uDC00' && charBefore <= '\uDFFF') {
      deleteCount = 2;
    }
  }
  
  const newText = text.slice(0, position - deleteCount) + text.slice(position);
  return {
    text: newText,
    position: position - deleteCount,
  };
}

/**
 * Handle proper Unicode-aware character deletion forward
 */
export function deleteCharAfter(text: string, position: number): { text: string; position: number } {
  if (position >= text.length) {
    return { text, position };
  }
  
  // Handle surrogate pairs and combining characters
  let deleteCount = 1;
  const charAfter = text.charAt(position);
  
  // Check for high surrogate (first part of surrogate pair)
  if (position + 1 < text.length) {
    const charAfterAfter = text.charAt(position + 1);
    if (charAfter >= '\uD800' && charAfter <= '\uDBFF' && 
        charAfterAfter >= '\uDC00' && charAfterAfter <= '\uDFFF') {
      deleteCount = 2;
    }
  }
  
  const newText = text.slice(0, position) + text.slice(position + deleteCount);
  return {
    text: newText,
    position,
  };
}

/**
 * Insert text at the given position with proper Unicode handling
 */
export function insertText(text: string, position: number, insert: string): { text: string; position: number } {
  const newText = text.slice(0, position) + insert + text.slice(position);
  // Use code unit length for position since String operations use code units, not graphemes
  // This ensures cursor position stays aligned with String.length and slice operations
  return {
    text: newText,
    position: position + insert.length,
  };
}