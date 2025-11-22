/**
 * Paste handling utilities for detecting and managing large paste operations
 * Implements smart paste detection, collapsing, and expansion
 */

import { getSettingsManager } from "./settings-manager.js";

/**
 * Represents a pasted block of text
 */
export interface PastedBlock {
  id: number;                 // Unique sequential ID
  content: string;            // Full pasted text
  lineCount: number;          // Number of lines in paste
  collapsed: boolean;         // Current collapsed state
  startPosition: number;      // Position in input where inserted
  previewLines: string[];     // First N lines for preview
}

/**
 * Input buffer entry for paste detection
 */
interface InputBufferEntry {
  char: string;
  timestamp: number;
}

/**
 * Paste detection and management class
 */
export class PasteDetector {
  private inputBuffer: InputBufferEntry[] = [];
  private readonly PASTE_DETECTION_WINDOW = 100; // 100ms window
  private readonly PASTE_THRESHOLD = 10; // 10+ chars = paste
  private accumulatedInput = "";
  private lastInputTime = 0;

  /**
   * Detect if input is part of a paste operation
   * @param inputChar - Character(s) being input
   * @returns true if paste detected
   */
  public detectPaste(inputChar: string): boolean {
    const now = Date.now();

    // Add to buffer
    this.inputBuffer.push({ char: inputChar, timestamp: now });

    // Clean old entries (older than detection window)
    this.inputBuffer = this.inputBuffer.filter(
      entry => now - entry.timestamp < this.PASTE_DETECTION_WINDOW
    );

    // Count total characters in window
    const totalChars = this.inputBuffer.reduce(
      (sum, entry) => sum + entry.char.length,
      0
    );

    return totalChars >= this.PASTE_THRESHOLD;
  }

  /**
   * Accumulate input during paste operation
   * @param inputChar - Character(s) being input
   * @param timeout - Timeout to consider paste complete (ms)
   * @returns accumulated paste content or null if still accumulating
   */
  public accumulatePasteInput(inputChar: string, timeout = 50): string | null {
    const now = Date.now();

    // If too much time passed, start new accumulation
    if (now - this.lastInputTime > timeout && this.accumulatedInput) {
      const result = this.accumulatedInput;
      this.accumulatedInput = inputChar;
      this.lastInputTime = now;
      return result;
    }

    // Accumulate
    this.accumulatedInput += inputChar;
    this.lastInputTime = now;

    return null;
  }

  /**
   * Get and clear accumulated input
   */
  public getAccumulatedInput(): string {
    const result = this.accumulatedInput;
    this.accumulatedInput = "";
    this.lastInputTime = 0;
    return result;
  }

  /**
   * Reset detector state
   */
  public reset(): void {
    this.inputBuffer = [];
    this.accumulatedInput = "";
    this.lastInputTime = 0;
  }
}

/**
 * Check if pasted content should be collapsed
 * @param content - Pasted content
 * @returns true if should collapse
 */
export function shouldCollapsePaste(content: string): boolean {
  const settings = getSettingsManager();
  const userSettings = settings.loadUserSettings();

  // Check if auto-collapse is enabled (default: true)
  const autoCollapse = userSettings.paste?.autoCollapse ?? true;
  if (!autoCollapse) {
    return false;
  }

  // Get collapse threshold (default: 20 lines)
  const threshold = userSettings.paste?.collapseThreshold ?? 20;

  // Count lines
  const lineCount = countLines(content);

  return lineCount >= threshold;
}

/**
 * Count lines in text (handles different line endings)
 * @param text - Text to count lines in
 * @returns number of lines
 */
export function countLines(text: string): number {
  if (!text) return 0;

  // Normalize line endings to \n
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Count newlines + 1 (for last line without \n)
  const newlineCount = (normalized.match(/\n/g) || []).length;

  // If normalized text ends with newline, don't count extra line
  return normalized.endsWith('\n') ? newlineCount : newlineCount + 1;
}

/**
 * Create a pasted block from content
 * @param id - Unique block ID
 * @param content - Pasted content
 * @param startPosition - Position in input where inserted
 * @returns PastedBlock object
 */
export function createPastedBlock(
  id: number,
  content: string,
  startPosition: number
): PastedBlock {
  const settings = getSettingsManager();
  const userSettings = settings.loadUserSettings();

  const lineCount = countLines(content);
  const previewLineCount = userSettings.paste?.previewLines ?? 2;

  // Extract preview lines
  const lines = content.split(/\r?\n/);
  const previewLines = lines.slice(0, previewLineCount);

  return {
    id,
    content,
    lineCount,
    collapsed: true,
    startPosition,
    previewLines,
  };
}

/**
 * Generate placeholder text for collapsed paste
 * @param block - Pasted block
 * @returns placeholder string
 */
export function generatePlaceholder(block: PastedBlock): string {
  const settings = getSettingsManager();
  const userSettings = settings.loadUserSettings();

  const showLineCount = userSettings.paste?.showLineCount ?? true;
  const showPreview = userSettings.paste?.showPreview ?? false;

  let placeholder = `[Pasted text #${block.id}`;

  if (showLineCount) {
    placeholder += ` +${block.lineCount} lines`;
  }

  placeholder += `]`;

  // Add preview if enabled
  if (showPreview && block.previewLines.length > 0) {
    const preview = block.previewLines
      .map(line => line.slice(0, 60)) // Max 60 chars per line
      .join('\n');
    placeholder += `\n${preview}`;
    if (block.lineCount > block.previewLines.length) {
      placeholder += `\n... (${block.lineCount - block.previewLines.length} more lines)`;
    }
  }

  return placeholder;
}

/**
 * Extract placeholder ID from placeholder text
 * @param placeholder - Placeholder text
 * @returns block ID or null if not a placeholder
 */
export function extractPlaceholderId(placeholder: string): number | null {
  const match = placeholder.match(/\[Pasted text #(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Find pasted block at cursor position
 * @param input - Current input text
 * @param cursorPosition - Cursor position
 * @param pastedBlocks - Array of pasted blocks
 * @returns PastedBlock if cursor is on one, null otherwise
 */
export function findBlockAtCursor(
  input: string,
  cursorPosition: number,
  pastedBlocks: PastedBlock[]
): PastedBlock | null {
  // Find all blocks that contain the cursor position
  // This handles cases where multiple paste blocks exist in the input
  for (const block of pastedBlocks) {
    // Check if block is collapsed (placeholder in input)
    if (block.collapsed) {
      const placeholder = generatePlaceholder(block);

      // Find all occurrences of this placeholder
      let searchStart = 0;
      while (searchStart < input.length) {
        const blockStart = input.indexOf(placeholder, searchStart);

        if (blockStart === -1) break;

        const blockEnd = blockStart + placeholder.length;

        if (cursorPosition >= blockStart && cursorPosition <= blockEnd) {
          return block;
        }

        searchStart = blockStart + 1;
      }
    } else {
      // Block is expanded (full content in input)
      // Find all occurrences of this content
      let searchStart = 0;
      while (searchStart < input.length) {
        const blockStart = input.indexOf(block.content, searchStart);

        if (blockStart === -1) break;

        const blockEnd = blockStart + block.content.length;

        if (cursorPosition >= blockStart && cursorPosition <= blockEnd) {
          return block;
        }

        searchStart = blockStart + 1;
      }
    }
  }

  return null;
}

/**
 * Expand all placeholders in text
 * @param text - Text with placeholders
 * @param pastedBlocks - Array of pasted blocks
 * @returns text with all placeholders expanded
 */
export function expandAllPlaceholders(
  text: string,
  pastedBlocks: PastedBlock[]
): string {
  let result = text;

  // Find all placeholder occurrences with their positions
  interface PlaceholderOccurrence {
    block: PastedBlock;
    position: number;
    placeholder: string;
  }

  const occurrences: PlaceholderOccurrence[] = [];

  for (const block of pastedBlocks) {
    const placeholder = generatePlaceholder(block);
    let searchStart = 0;

    while (searchStart < result.length) {
      const position = result.indexOf(placeholder, searchStart);
      if (position === -1) break;

      occurrences.push({ block, position, placeholder });
      searchStart = position + 1;
    }
  }

  // Sort by position descending (replace from end to start to avoid position shifts)
  occurrences.sort((a, b) => b.position - a.position);

  // Replace each occurrence
  for (const occurrence of occurrences) {
    result =
      result.substring(0, occurrence.position) +
      occurrence.block.content +
      result.substring(occurrence.position + occurrence.placeholder.length);
  }

  return result;
}

/**
 * Validate paste settings
 * @param settings - Paste settings to validate
 * @returns true if valid
 */
export function validatePasteSettings(settings: any): boolean {
  if (!settings) return true;

  if (typeof settings.autoCollapse !== 'undefined' && typeof settings.autoCollapse !== 'boolean') {
    return false;
  }

  if (typeof settings.collapseThreshold !== 'undefined') {
    if (typeof settings.collapseThreshold !== 'number' ||
        settings.collapseThreshold < 1 ||
        settings.collapseThreshold > 100) {
      return false;
    }
  }

  if (typeof settings.previewLines !== 'undefined') {
    if (typeof settings.previewLines !== 'number' ||
        settings.previewLines < 0 ||
        settings.previewLines > 10) {
      return false;
    }
  }

  return true;
}
