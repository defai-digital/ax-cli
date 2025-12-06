/**
 * Tests for Paste Utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PasteDetector,
  shouldCollapsePaste,
  countLines,
  createPastedBlock,
  generatePlaceholder,
  extractPlaceholderId,
  findBlockAtCursor,
  expandAllPlaceholders,
  validatePasteSettings,
  type PastedBlock,
} from "../../src/utils/paste-utils.js";

// Mock settings manager
vi.mock("../../src/utils/settings-manager.js", () => ({
  getSettingsManager: vi.fn(() => ({
    getPasteConfig: vi.fn(() => ({
      autoCollapse: true,
      collapseThreshold: 20,
      previewLines: 2,
      showLineCount: true,
      showPreview: false,
    })),
  })),
}));

describe("Paste Utilities", () => {
  describe("PasteDetector", () => {
    let detector: PasteDetector;

    beforeEach(() => {
      detector = new PasteDetector();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("detectPaste", () => {
      it("should not detect paste for single character input", () => {
        expect(detector.detectPaste("a")).toBe(false);
      });

      it("should not detect paste for slow typing", () => {
        detector.detectPaste("a");
        vi.advanceTimersByTime(200); // Wait beyond detection window
        detector.detectPaste("b");
        expect(detector.detectPaste("c")).toBe(false);
      });

      it("should detect paste for rapid multi-character input", () => {
        // Simulate rapid input (within 100ms window)
        for (let i = 0; i < 5; i++) {
          detector.detectPaste("ab"); // 10 chars total (5 * 2)
        }
        expect(detector.detectPaste("c")).toBe(true);
      });

      it("should detect paste when threshold is reached", () => {
        // Input 10+ characters quickly
        const result = detector.detectPaste("abcdefghij");
        expect(result).toBe(true);
      });

      it("should clean old entries from buffer", () => {
        detector.detectPaste("abcdefghij"); // 10 chars
        expect(detector.detectPaste("")).toBe(true);

        vi.advanceTimersByTime(150); // Past detection window
        expect(detector.detectPaste("a")).toBe(false);
      });
    });

    describe("accumulatePasteInput", () => {
      it("should accumulate input within timeout", () => {
        expect(detector.accumulatePasteInput("abc")).toBe(null);
        expect(detector.accumulatePasteInput("def")).toBe(null);
        // Still accumulating, returns null
      });

      it("should return accumulated input after timeout", () => {
        detector.accumulatePasteInput("abc");
        vi.advanceTimersByTime(100); // Past default timeout (50ms)
        const result = detector.accumulatePasteInput("def");
        expect(result).toBe("abc");
      });

      it("should start new accumulation after timeout", () => {
        detector.accumulatePasteInput("first");
        vi.advanceTimersByTime(100);
        detector.accumulatePasteInput("second");
        vi.advanceTimersByTime(100);
        const result = detector.accumulatePasteInput("third");
        expect(result).toBe("second");
      });

      it("should respect custom timeout", () => {
        detector.accumulatePasteInput("abc", 200);
        vi.advanceTimersByTime(150); // Within custom timeout
        expect(detector.accumulatePasteInput("def", 200)).toBe(null);

        vi.advanceTimersByTime(250); // Past custom timeout
        const result = detector.accumulatePasteInput("ghi", 200);
        expect(result).toBe("abcdef");
      });
    });

    describe("getAccumulatedInput", () => {
      it("should return and clear accumulated input", () => {
        detector.accumulatePasteInput("test");
        expect(detector.getAccumulatedInput()).toBe("test");
        expect(detector.getAccumulatedInput()).toBe("");
      });

      it("should return empty string when nothing accumulated", () => {
        expect(detector.getAccumulatedInput()).toBe("");
      });
    });

    describe("reset", () => {
      it("should reset all state", () => {
        detector.detectPaste("abcdefghij");
        detector.accumulatePasteInput("test");
        detector.reset();

        expect(detector.getAccumulatedInput()).toBe("");
        expect(detector.detectPaste("a")).toBe(false);
      });
    });
  });

  describe("countLines", () => {
    it("should return 0 for empty string", () => {
      expect(countLines("")).toBe(0);
    });

    it("should return 0 for null/undefined", () => {
      expect(countLines(null as unknown as string)).toBe(0);
      expect(countLines(undefined as unknown as string)).toBe(0);
    });

    it("should count single line without newline", () => {
      expect(countLines("hello")).toBe(1);
    });

    it("should count single line with trailing newline", () => {
      expect(countLines("hello\n")).toBe(1);
    });

    it("should count multiple lines with \\n", () => {
      expect(countLines("line1\nline2\nline3")).toBe(3);
    });

    it("should count multiple lines with trailing \\n", () => {
      expect(countLines("line1\nline2\nline3\n")).toBe(3);
    });

    it("should handle Windows line endings (\\r\\n)", () => {
      expect(countLines("line1\r\nline2\r\nline3")).toBe(3);
    });

    it("should handle old Mac line endings (\\r)", () => {
      expect(countLines("line1\rline2\rline3")).toBe(3);
    });

    it("should handle mixed line endings", () => {
      expect(countLines("line1\nline2\r\nline3\rline4")).toBe(4);
    });
  });

  describe("shouldCollapsePaste", () => {
    it("should return true for content exceeding threshold", () => {
      const longContent = Array(25).fill("line").join("\n");
      expect(shouldCollapsePaste(longContent)).toBe(true);
    });

    it("should return false for content below threshold", () => {
      const shortContent = Array(5).fill("line").join("\n");
      expect(shouldCollapsePaste(shortContent)).toBe(false);
    });

    it("should return false when at exact threshold", () => {
      // 20 lines is the threshold (>=20 collapses)
      const exactContent = Array(19).fill("line").join("\n"); // 19 lines
      expect(shouldCollapsePaste(exactContent)).toBe(false);
    });
  });

  describe("createPastedBlock", () => {
    it("should create a pasted block with correct properties", () => {
      const content = "line1\nline2\nline3\nline4\nline5";
      const block = createPastedBlock(0, content, 10);

      expect(block.id).toBe(0);
      expect(block.content).toBe(content);
      expect(block.lineCount).toBe(5);
      expect(block.collapsed).toBe(true);
      expect(block.startPosition).toBe(10);
      expect(block.previewLines).toHaveLength(2); // Default previewLines is 2
      expect(block.previewLines[0]).toBe("line1");
      expect(block.previewLines[1]).toBe("line2");
    });

    it("should handle single line content", () => {
      const block = createPastedBlock(1, "single line", 0);

      expect(block.lineCount).toBe(1);
      expect(block.previewLines).toHaveLength(1);
      expect(block.previewLines[0]).toBe("single line");
    });

    it("should handle empty content", () => {
      const block = createPastedBlock(2, "", 5);

      expect(block.lineCount).toBe(0);
      // Empty string.split() returns [''], so length is 1
      expect(block.previewLines).toHaveLength(1);
      expect(block.previewLines[0]).toBe("");
    });
  });

  describe("generatePlaceholder", () => {
    it("should generate placeholder with line count", () => {
      const block: PastedBlock = {
        id: 0,
        content: "test\ncontent",
        lineCount: 2,
        collapsed: true,
        startPosition: 0,
        previewLines: ["test"],
      };

      const placeholder = generatePlaceholder(block);

      expect(placeholder).toContain("[Pasted text #1");
      expect(placeholder).toContain("+2 lines");
      expect(placeholder).toContain("^P to expand");
    });

    it("should use singular 'line' for single line", () => {
      const block: PastedBlock = {
        id: 0,
        content: "single",
        lineCount: 1,
        collapsed: true,
        startPosition: 0,
        previewLines: ["single"],
      };

      const placeholder = generatePlaceholder(block);

      expect(placeholder).toContain("+1 line");
      expect(placeholder).not.toContain("+1 lines");
    });

    it("should use 1-based numbering for display", () => {
      const block: PastedBlock = {
        id: 5, // 0-based internal ID
        content: "test",
        lineCount: 1,
        collapsed: true,
        startPosition: 0,
        previewLines: ["test"],
      };

      const placeholder = generatePlaceholder(block);

      expect(placeholder).toContain("[Pasted text #6"); // 1-based display
    });
  });

  describe("extractPlaceholderId", () => {
    it("should extract ID from valid placeholder", () => {
      const placeholder = "[Pasted text #1 +5 lines · ^P to expand]";
      expect(extractPlaceholderId(placeholder)).toBe(0); // 1-based to 0-based
    });

    it("should handle multi-digit IDs", () => {
      const placeholder = "[Pasted text #15 +10 lines · ^P to expand]";
      expect(extractPlaceholderId(placeholder)).toBe(14);
    });

    it("should return null for invalid placeholder", () => {
      expect(extractPlaceholderId("not a placeholder")).toBe(null);
    });

    it("should return null for empty string", () => {
      expect(extractPlaceholderId("")).toBe(null);
    });

    it("should return null for #0 (would give negative ID)", () => {
      const placeholder = "[Pasted text #0 +5 lines]";
      expect(extractPlaceholderId(placeholder)).toBe(null);
    });

    it("should return null for malformed placeholder", () => {
      expect(extractPlaceholderId("[Pasted text #abc]")).toBe(null);
      expect(extractPlaceholderId("[Pasted text #]")).toBe(null);
    });
  });

  describe("findBlockAtCursor", () => {
    const createTestBlock = (id: number, content: string, collapsed: boolean): PastedBlock => ({
      id,
      content,
      lineCount: countLines(content),
      collapsed,
      startPosition: 0,
      previewLines: content.split("\n").slice(0, 2),
    });

    it("should return null for empty input", () => {
      const blocks = [createTestBlock(0, "test", true)];
      expect(findBlockAtCursor("", 0, blocks)).toBe(null);
    });

    it("should return null for invalid cursor position", () => {
      const blocks = [createTestBlock(0, "test", true)];
      expect(findBlockAtCursor("some text", -1, blocks)).toBe(null);
      expect(findBlockAtCursor("some text", 100, blocks)).toBe(null);
    });

    it("should return null for empty blocks array", () => {
      expect(findBlockAtCursor("some text", 5, [])).toBe(null);
    });

    it("should find collapsed block at cursor", () => {
      const block = createTestBlock(0, "test content", true);
      const placeholder = generatePlaceholder(block);
      const input = `before ${placeholder} after`;
      const cursorPosition = input.indexOf(placeholder) + 5;

      const result = findBlockAtCursor(input, cursorPosition, [block]);

      expect(result).toBe(block);
    });

    it("should find expanded block at cursor", () => {
      const block = createTestBlock(0, "test content", false);
      const input = `before ${block.content} after`;
      const cursorPosition = input.indexOf(block.content) + 5;

      const result = findBlockAtCursor(input, cursorPosition, [block]);

      expect(result).toBe(block);
    });

    it("should return null when cursor is outside blocks", () => {
      const block = createTestBlock(0, "test content", false);
      const input = `before ${block.content} after`;
      const cursorPosition = 0; // In "before" text

      const result = findBlockAtCursor(input, cursorPosition, [block]);

      expect(result).toBe(null);
    });

    it("should skip empty content blocks", () => {
      const emptyBlock = createTestBlock(0, "", false);
      const validBlock = createTestBlock(1, "valid", false);
      const input = "valid";

      const result = findBlockAtCursor(input, 2, [emptyBlock, validBlock]);

      expect(result).toBe(validBlock);
    });
  });

  describe("expandAllPlaceholders", () => {
    const createTestBlock = (id: number, content: string): PastedBlock => ({
      id,
      content,
      lineCount: countLines(content),
      collapsed: true,
      startPosition: 0,
      previewLines: content.split("\n").slice(0, 2),
    });

    it("should return empty string for empty input", () => {
      expect(expandAllPlaceholders("", [])).toBe("");
    });

    it("should return original text if no blocks", () => {
      expect(expandAllPlaceholders("some text", [])).toBe("some text");
    });

    it("should return original text if blocks array is empty", () => {
      expect(expandAllPlaceholders("some text", [])).toBe("some text");
    });

    it("should expand single placeholder", () => {
      const block = createTestBlock(0, "expanded content");
      const placeholder = generatePlaceholder(block);
      const text = `before ${placeholder} after`;

      const result = expandAllPlaceholders(text, [block]);

      expect(result).toBe("before expanded content after");
    });

    it("should expand multiple placeholders", () => {
      const block1 = createTestBlock(0, "first");
      const block2 = createTestBlock(1, "second");
      const placeholder1 = generatePlaceholder(block1);
      const placeholder2 = generatePlaceholder(block2);
      const text = `${placeholder1} and ${placeholder2}`;

      const result = expandAllPlaceholders(text, [block1, block2]);

      expect(result).toBe("first and second");
    });

    it("should skip non-collapsed blocks", () => {
      const collapsedBlock = createTestBlock(0, "collapsed");
      const expandedBlock: PastedBlock = {
        ...createTestBlock(1, "expanded"),
        collapsed: false,
      };

      const placeholder = generatePlaceholder(collapsedBlock);
      const text = `${placeholder} and some text`;

      const result = expandAllPlaceholders(text, [collapsedBlock, expandedBlock]);

      expect(result).toBe("collapsed and some text");
    });

    it("should handle null text", () => {
      expect(expandAllPlaceholders(null as unknown as string, [])).toBe("");
    });

    it("should handle null blocks array", () => {
      expect(expandAllPlaceholders("text", null as unknown as PastedBlock[])).toBe("text");
    });
  });

  describe("validatePasteSettings", () => {
    it("should return true for null settings", () => {
      expect(validatePasteSettings(null)).toBe(true);
    });

    it("should return true for undefined settings", () => {
      expect(validatePasteSettings(undefined)).toBe(true);
    });

    it("should return true for empty object", () => {
      expect(validatePasteSettings({})).toBe(true);
    });

    it("should return true for valid settings", () => {
      const settings = {
        autoCollapse: true,
        collapseThreshold: 20,
        previewLines: 2,
      };
      expect(validatePasteSettings(settings)).toBe(true);
    });

    describe("autoCollapse validation", () => {
      it("should accept boolean autoCollapse", () => {
        expect(validatePasteSettings({ autoCollapse: true })).toBe(true);
        expect(validatePasteSettings({ autoCollapse: false })).toBe(true);
      });

      it("should reject non-boolean autoCollapse", () => {
        expect(validatePasteSettings({ autoCollapse: "true" })).toBe(false);
        expect(validatePasteSettings({ autoCollapse: 1 })).toBe(false);
        expect(validatePasteSettings({ autoCollapse: null })).toBe(false);
      });
    });

    describe("collapseThreshold validation", () => {
      it("should accept valid collapseThreshold", () => {
        expect(validatePasteSettings({ collapseThreshold: 1 })).toBe(true);
        expect(validatePasteSettings({ collapseThreshold: 50 })).toBe(true);
        expect(validatePasteSettings({ collapseThreshold: 100 })).toBe(true);
      });

      it("should reject invalid collapseThreshold", () => {
        expect(validatePasteSettings({ collapseThreshold: 0 })).toBe(false);
        expect(validatePasteSettings({ collapseThreshold: -1 })).toBe(false);
        expect(validatePasteSettings({ collapseThreshold: 101 })).toBe(false);
        expect(validatePasteSettings({ collapseThreshold: "20" })).toBe(false);
      });
    });

    describe("previewLines validation", () => {
      it("should accept valid previewLines", () => {
        expect(validatePasteSettings({ previewLines: 0 })).toBe(true);
        expect(validatePasteSettings({ previewLines: 5 })).toBe(true);
        expect(validatePasteSettings({ previewLines: 10 })).toBe(true);
      });

      it("should reject invalid previewLines", () => {
        expect(validatePasteSettings({ previewLines: -1 })).toBe(false);
        expect(validatePasteSettings({ previewLines: 11 })).toBe(false);
        expect(validatePasteSettings({ previewLines: "5" })).toBe(false);
      });
    });
  });
});
