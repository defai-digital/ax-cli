/**
 * Bracketed Paste Mode Handler
 *
 * Implements industry-standard bracketed paste detection for reliable paste handling
 * across all terminal types (SSH, tmux, iTerm2, etc.)
 *
 * Bracketed paste mode sends special escape sequences:
 * - Start: \x1b[200~ (ESC [200~)
 * - End: \x1b[201~ (ESC [201~)
 *
 * This handler implements a state machine that:
 * 1. Accumulates partial escape sequences across multiple input events
 * 2. Handles timeout/recovery if end marker never arrives
 * 3. Sanitizes escape sequences from pasted content (security)
 * 4. Falls back to simple batched detection if not supported
 */

export interface PasteDetectionResult {
  isPaste: boolean;
  content: string;
  isAccumulating: boolean;
}

export class BracketedPasteHandler {
  // State machine states
  private state: 'idle' | 'accumulating' = 'idle';

  // Content accumulation buffer
  private buffer: string = '';

  // Escape sequence accumulation buffer (for partial sequences)
  private escapeBuffer: string = '';

  // Timeout for paste accumulation (30 seconds max)
  private timeoutHandle: NodeJS.Timeout | null = null;
  private readonly PASTE_TIMEOUT_MS = 30000;

  // Bracketed paste markers
  private readonly START_MARKER = '\x1b[200~';
  private readonly END_MARKER = '\x1b[201~';

  // Maximum paste size (100MB hard limit for security)
  private readonly MAX_PASTE_SIZE = 100 * 1024 * 1024;

  // Statistics
  private pasteCount = 0;

  /**
   * Handle incoming input character(s)
   * Returns detection result indicating if paste is complete, accumulating, or normal input
   */
  handleInput(inputChar: string): PasteDetectionResult {
    // BUG FIX: Check for paste size limit (security)
    // Return accumulated content instead of discarding it
    if (this.buffer.length + inputChar.length > this.MAX_PASTE_SIZE) {
      // Paste too large - return what we have so far
      const accumulatedContent = this.buffer;
      this.reset();

      // If we accumulated meaningful content, return it as a paste
      if (accumulatedContent.length > 0) {
        this.pasteCount++;
        return {
          isPaste: true,
          content: this.sanitizeContent(accumulatedContent),
          isAccumulating: false,
        };
      }

      // Otherwise just return empty (nothing accumulated yet)
      return {
        isPaste: false,
        content: inputChar, // Return current input at least
        isAccumulating: false,
      };
    }

    // Handle idle state - looking for paste start
    if (this.state === 'idle') {
      return this.handleIdleState(inputChar);
    }

    // Handle accumulating state - collecting paste content
    if (this.state === 'accumulating') {
      return this.handleAccumulatingState(inputChar);
    }

    // Should never reach here
    return {
      isPaste: false,
      content: inputChar,
      isAccumulating: false,
    };
  }

  /**
   * Handle idle state - detect paste start marker
   */
  private handleIdleState(inputChar: string): PasteDetectionResult {
    // Accumulate input for escape sequence detection
    this.escapeBuffer += inputChar;

    // BUG FIX: Prevent escapeBuffer overflow - if it grows beyond reasonable escape sequence size,
    // treat accumulated content as normal input (safety limit: 32 bytes, escape sequences are ~6 bytes)
    const MAX_ESCAPE_BUFFER_SIZE = 32;
    if (this.escapeBuffer.length > MAX_ESCAPE_BUFFER_SIZE) {
      const content = this.escapeBuffer;
      this.escapeBuffer = '';
      return {
        isPaste: false,
        content: this.sanitizeContent(content, true),
        isAccumulating: false,
      };
    }

    // Check for complete start marker
    if (this.escapeBuffer.includes(this.START_MARKER)) {
      // Found complete start marker
      const startIdx = this.escapeBuffer.indexOf(this.START_MARKER);

      // BUG FIX: If there's content before the start marker, return it first
      if (startIdx > 0) {
        const contentBefore = this.escapeBuffer.substring(0, startIdx);
        // Keep the start marker and everything after for next call
        this.escapeBuffer = this.escapeBuffer.substring(startIdx);
        return {
          isPaste: false,
          // BUG FIX: Sanitize with removeLiteralMarkers=true (from escapeBuffer, not real paste)
          content: this.sanitizeContent(contentBefore, true),
          isAccumulating: false,
        };
      }

      // Transition to accumulating state
      this.state = 'accumulating';

      // Extract content after start marker
      this.buffer = this.escapeBuffer.substring(this.START_MARKER.length);
      this.escapeBuffer = '';

      // Set timeout for paste accumulation
      this.startTimeout();

      // BUG FIX: Check if end marker is also in the buffer (single input with full paste)
      // This handles the case where start+content+end arrive in one call
      if (this.buffer.includes(this.END_MARKER)) {
        const endIdx = this.buffer.indexOf(this.END_MARKER);
        const content = this.buffer.substring(0, endIdx);

        // Clear timeout
        this.clearTimeout();

        // Reset state
        this.state = 'idle';
        this.buffer = '';
        this.pasteCount++;

        // Sanitize and return content
        return {
          isPaste: true,
          content: this.sanitizeContent(content),
          isAccumulating: false,
        };
      }

      return {
        isPaste: false,
        content: '',
        isAccumulating: true,
      };
    }

    // Check if we're building toward a start marker (partial match)
    if (this.isPartialMatch(this.escapeBuffer, this.START_MARKER)) {
      // Keep accumulating - might be a partial escape sequence
      return {
        isPaste: false,
        content: '',
        isAccumulating: false,
      };
    }

    // No match - this is normal input
    const content = this.escapeBuffer;
    this.escapeBuffer = '';

    // Return as normal input (not a paste via bracketed paste mode)
    // The caller can decide if it wants to use fallback batched detection
    // BUG FIX: Sanitize with removeLiteralMarkers=true (from escapeBuffer, may have malformed markers)
    return {
      isPaste: false,
      content: this.sanitizeContent(content, true),
      isAccumulating: false,
    };
  }

  /**
   * Handle accumulating state - collect paste content until end marker
   */
  private handleAccumulatingState(inputChar: string): PasteDetectionResult {
    // Accumulate content
    this.buffer += inputChar;

    // Check for end marker
    if (this.buffer.includes(this.END_MARKER)) {
      // Found end marker - paste complete
      const endIdx = this.buffer.indexOf(this.END_MARKER);
      const content = this.buffer.substring(0, endIdx);

      // Clear timeout
      this.clearTimeout();

      // Reset state
      this.state = 'idle';
      this.buffer = '';
      this.pasteCount++;

      // Sanitize and return content
      return {
        isPaste: true,
        content: this.sanitizeContent(content),
        isAccumulating: false,
      };
    }

    // Still accumulating
    return {
      isPaste: false,
      content: '',
      isAccumulating: true,
    };
  }

  /**
   * Check if buffer is a partial match for a target string
   * Used to detect incomplete escape sequences
   */
  private isPartialMatch(buffer: string, target: string): boolean {
    if (buffer.length === 0 || buffer.length >= target.length) {
      return false;
    }

    // Check if buffer matches the start of target
    return target.startsWith(buffer);
  }

  /**
   * Sanitize pasted content - strip dangerous escape sequences
   * Security: Prevent terminal injection attacks
   *
   * @param content - Content to sanitize
   * @param removeLiteralMarkers - If true, also remove literal [200~ [201~ (for malformed pastes)
   *                                If false, only remove escape sequences (for proper bracketed pastes)
   */
  private sanitizeContent(content: string, removeLiteralMarkers: boolean = false): string {
    // Strip all escape sequences except newlines and common printable chars
    // This prevents malicious pastes from executing terminal commands

    let sanitized = content;

    // Remove bracketed paste markers (ONLY escape sequences, not literal text)
    sanitized = sanitized.replace(/\x1b\[200~/g, '');  // Full escape sequence
    sanitized = sanitized.replace(/\x1b\[201~/g, '');  // Full escape sequence

    // BUG FIX: Only remove literal markers for malformed pastes (escapeBuffer content)
    // Do NOT remove from proper bracketed paste content (would corrupt user data like "[200~300]")
    if (removeLiteralMarkers) {
      sanitized = sanitized.replace(/\[200~/g, '');      // Literal text (ESC stripped by terminal)
      sanitized = sanitized.replace(/\[201~/g, '');      // Literal text (ESC stripped by terminal)
    }

    // Remove other control sequences:
    // - OSC (Operating System Command): \x1b] ... \x07
    // - CSI (Control Sequence Introducer): \x1b[ ... (letters)
    // - Other escape codes

    // Remove OSC sequences (e.g., set window title)
    sanitized = sanitized.replace(/\x1b\][\s\S]*?\x07/g, '');

    // Remove CSI sequences (except bracketed paste which we already removed)
    // Match: ESC [ <params> <letter>
    sanitized = sanitized.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

    // BUG FIX: Remove other escape codes (ESC followed by single non-alphanumeric char)
    // OLD: /\x1b[^[]]/g - This was matching ESC + any char except '[', eating content!
    // NEW: Only match ESC followed by specific escape chars, not normal text
    sanitized = sanitized.replace(/\x1b[()=>]/g, ''); // G0-G3 charset, keypad modes
    sanitized = sanitized.replace(/\x1b[78]/g, '');   // Save/restore cursor
    sanitized = sanitized.replace(/\x1b[DEHM]/g, ''); // Various control codes

    // Normalize line endings (keep \n, convert \r to \n)
    sanitized = sanitized.replace(/\r\n/g, '\n');
    sanitized = sanitized.replace(/\r/g, '\n');

    return sanitized;
  }

  /**
   * Start timeout for paste accumulation
   * If paste doesn't complete within timeout, reset state
   */
  private startTimeout(): void {
    this.clearTimeout();
    this.timeoutHandle = setTimeout(() => {
      // BUG FIX: Timeout reached - paste took too long or end marker never arrived
      // Don't discard the content! The caller will need to retrieve it.
      // We just reset the state so new input can be processed normally.
      // The accumulated content stays in this.buffer for the caller to retrieve.
      if (this.state === 'accumulating') {
        this.state = 'idle';
        // NOTE: this.buffer is NOT cleared - caller must check and retrieve it
        // This prevents data loss when end marker is missing
      }
    }, this.PASTE_TIMEOUT_MS);
  }

  /**
   * Clear paste accumulation timeout
   */
  private clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  /**
   * Reset handler to initial state
   * Used when component unmounts or on errors
   */
  reset(): void {
    this.state = 'idle';
    this.buffer = '';
    this.escapeBuffer = '';
    this.clearTimeout();
  }

  /**
   * Check if currently accumulating paste
   */
  isAccumulating(): boolean {
    return this.state === 'accumulating';
  }

  /**
   * Get current state (for debugging/testing)
   */
  getState(): string {
    return this.state;
  }

  /**
   * Get paste statistics (for debugging/telemetry)
   */
  getStats(): { pasteCount: number } {
    return {
      pasteCount: this.pasteCount,
    };
  }

  /**
   * BUG FIX: Retrieve and clear orphaned buffer content
   * Use this when state is idle but buffer is not empty (timeout occurred)
   * @returns orphaned buffer content, or empty string if none
   */
  retrieveOrphanedContent(): string {
    if (this.state === 'idle' && this.buffer.length > 0) {
      const content = this.buffer;
      this.buffer = '';
      return this.sanitizeContent(content);
    }
    return '';
  }

  /**
   * Cleanup on destroy
   */
  dispose(): void {
    this.reset();
  }
}
