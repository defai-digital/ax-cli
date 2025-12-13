/**
 * Tests for ui/utils/bracketed-paste-handler module
 * Tests bracketed paste mode handling and state machine
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BracketedPasteHandler } from '../../../packages/core/src/ui/utils/bracketed-paste-handler.js';

describe('BracketedPasteHandler', () => {
  let handler: BracketedPasteHandler;

  // Bracketed paste markers
  const START_MARKER = '\x1b[200~';
  const END_MARKER = '\x1b[201~';

  beforeEach(() => {
    handler = new BracketedPasteHandler();
    vi.useFakeTimers();
  });

  describe('basic functionality', () => {
    it('should start in idle state', () => {
      expect(handler.getState()).toBe('idle');
      expect(handler.isAccumulating()).toBe(false);
    });

    it('should return normal input without markers', () => {
      const result = handler.handleInput('hello');

      expect(result.isPaste).toBe(false);
      expect(result.content).toBe('hello');
      expect(result.isAccumulating).toBe(false);
    });

    it('should handle single character input', () => {
      const result = handler.handleInput('x');

      expect(result.isPaste).toBe(false);
      expect(result.content).toBe('x');
    });
  });

  describe('full paste detection', () => {
    it('should detect complete paste with start and end markers', () => {
      const chunk = `${START_MARKER}hello world${END_MARKER}`;
      const result = handler.handleInput(chunk);

      expect(result.isPaste).toBe(true);
      expect(result.content).toBe('hello world');
      expect(result.isAccumulating).toBe(false);
    });

    it('should handle empty paste', () => {
      const chunk = `${START_MARKER}${END_MARKER}`;
      const result = handler.handleInput(chunk);

      expect(result.isPaste).toBe(true);
      expect(result.content).toBe('');
    });

    it('should handle multiline paste', () => {
      const chunk = `${START_MARKER}line1\nline2\nline3${END_MARKER}`;
      const result = handler.handleInput(chunk);

      expect(result.isPaste).toBe(true);
      expect(result.content).toBe('line1\nline2\nline3');
    });

    it('should normalize line endings in paste', () => {
      const chunk = `${START_MARKER}line1\r\nline2\rline3${END_MARKER}`;
      const result = handler.handleInput(chunk);

      expect(result.isPaste).toBe(true);
      expect(result.content).toBe('line1\nline2\nline3');
    });
  });

  describe('split paste detection', () => {
    it('should accumulate paste content across multiple inputs', () => {
      // Start marker only
      let result = handler.handleInput(START_MARKER);
      expect(result.isPaste).toBe(false);
      expect(result.isAccumulating).toBe(true);
      expect(handler.getState()).toBe('accumulating');

      // Content
      result = handler.handleInput('content');
      expect(result.isPaste).toBe(false);
      expect(result.isAccumulating).toBe(true);

      // End marker
      result = handler.handleInput(END_MARKER);
      expect(result.isPaste).toBe(true);
      expect(result.content).toBe('content');
      expect(handler.getState()).toBe('idle');
    });

    it('should handle partial start marker', () => {
      // Partial escape sequence
      let result = handler.handleInput('\x1b');
      expect(result.content).toBe('');
      expect(result.isAccumulating).toBe(false);

      // Complete the sequence
      result = handler.handleInput('[200~test' + END_MARKER);
      expect(result.isPaste).toBe(true);
      expect(result.content).toBe('test');
    });
  });

  describe('content sanitization', () => {
    it('should sanitize escape sequences in normal input', () => {
      // Test sanitization via direct paste (start+content+end in one input)
      // Use simpler escape sequence that doesn't look like a marker
      const chunk = `${START_MARKER}hello\x1b7cursor\x1b8world${END_MARKER}`;
      const result = handler.handleInput(chunk);

      expect(result.isPaste).toBe(true);
      // Escape sequences should be removed
      expect(result.content).toBe('hellocursorworld');
    });

    it('should remove OSC sequences', () => {
      const chunk = `${START_MARKER}hello\x1b]0;title\x07world${END_MARKER}`;
      const result = handler.handleInput(chunk);

      expect(result.isPaste).toBe(true);
      expect(result.content).toBe('helloworld');
    });

    it('should handle content with literal bracket sequences', () => {
      // Test that normal bracket sequences are preserved
      const chunk = `${START_MARKER}array[200]${END_MARKER}`;
      const result = handler.handleInput(chunk);

      expect(result.isPaste).toBe(true);
      // Regular bracket notation should be preserved
      expect(result.content).toBe('array[200]');
    });
  });

  describe('escape buffer handling', () => {
    it('should handle overflow of escape buffer', () => {
      // Input that exceeds escape buffer size without being an escape sequence
      const longInput = 'a'.repeat(50);
      const result = handler.handleInput(longInput);

      expect(result.isPaste).toBe(false);
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should emit plain input when garbage precedes a paste marker', () => {
      const garbage = '>>>noise';
      const result = handler.handleInput(garbage + '\x1b');

      expect(result.isPaste).toBe(false);
      expect(result.content).toContain('noise');
    });

    it('should return content before start marker', () => {
      const chunk = 'prefix' + START_MARKER;
      const result = handler.handleInput(chunk);

      expect(result.isPaste).toBe(false);
      expect(result.content).toBe('prefix');
    });
  });

  describe('paste size limits', () => {
    it('should return accumulated content when paste exceeds max size', () => {
      // Enter accumulating state with some buffered content
      handler.handleInput(START_MARKER + 'abc');

      const largeChunk = 'a'.repeat(105 * 1024 * 1024);
      const result = handler.handleInput(largeChunk);

      expect(result.isPaste).toBe(true);
      expect(result.content).toBe('abc');
      expect(result.isAccumulating).toBe(false);
    });

    it('should handle size limit when nothing accumulated', () => {
      const largeChunk = 'a'.repeat(105 * 1024 * 1024);
      const result = handler.handleInput(largeChunk);

      expect(result.isPaste).toBe(false);
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  describe('timeout handling', () => {
    it('should reset state after timeout', () => {
      // Start accumulating
      handler.handleInput(START_MARKER);
      handler.handleInput('content');
      expect(handler.getState()).toBe('accumulating');

      // Fast forward past timeout
      vi.advanceTimersByTime(35000);

      // State should be idle but content preserved
      expect(handler.getState()).toBe('idle');
    });

    it('should preserve content on timeout', () => {
      handler.handleInput(START_MARKER);
      handler.handleInput('important');

      // Fast forward past timeout
      vi.advanceTimersByTime(35000);

      // Content should be retrievable
      const content = handler.retrieveOrphanedContent();
      expect(content).toContain('important');
    });
  });

  describe('reset functionality', () => {
    it('should reset to initial state', () => {
      // Set up some state
      handler.handleInput(START_MARKER);
      handler.handleInput('content');
      expect(handler.getState()).toBe('accumulating');

      // Reset
      handler.reset();

      expect(handler.getState()).toBe('idle');
      expect(handler.isAccumulating()).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should track paste count', () => {
      expect(handler.getStats().pasteCount).toBe(0);

      handler.handleInput(`${START_MARKER}paste1${END_MARKER}`);
      expect(handler.getStats().pasteCount).toBe(1);

      handler.handleInput(`${START_MARKER}paste2${END_MARKER}`);
      expect(handler.getStats().pasteCount).toBe(2);
    });
  });

  describe('orphaned content retrieval', () => {
    it('should return empty when no orphaned content', () => {
      expect(handler.retrieveOrphanedContent()).toBe('');
    });

    it('should return and clear orphaned content', () => {
      // Create orphaned content via timeout
      handler.handleInput(START_MARKER);
      handler.handleInput('orphaned');
      vi.advanceTimersByTime(35000);

      const content = handler.retrieveOrphanedContent();
      expect(content).toContain('orphaned');

      // Second call should return empty
      expect(handler.retrieveOrphanedContent()).toBe('');
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      handler.handleInput(START_MARKER);
      handler.handleInput('content');

      handler.dispose();

      expect(handler.getState()).toBe('idle');
      expect(handler.isAccumulating()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple pastes in sequence', () => {
      let result = handler.handleInput(`${START_MARKER}first${END_MARKER}`);
      expect(result.isPaste).toBe(true);
      expect(result.content).toBe('first');

      result = handler.handleInput(`${START_MARKER}second${END_MARKER}`);
      expect(result.isPaste).toBe(true);
      expect(result.content).toBe('second');
    });

    it('should handle special characters in paste', () => {
      const special = 'hello\ttab\0null';
      const result = handler.handleInput(`${START_MARKER}${special}${END_MARKER}`);

      expect(result.isPaste).toBe(true);
      expect(result.content).toContain('tab');
    });

    it('should handle unicode in paste', () => {
      const unicode = 'Hello \u{1F600} World \u{1F4BB}';
      const result = handler.handleInput(`${START_MARKER}${unicode}${END_MARKER}`);

      expect(result.isPaste).toBe(true);
      expect(result.content).toBe(unicode);
    });
  });
});
