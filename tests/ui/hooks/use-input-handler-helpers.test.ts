import { describe, expect, it } from "vitest";
import { shouldIgnoreContentChunk } from "../../../src/ui/hooks/use-input-handler.js";

describe("use-input-handler helpers", () => {
  describe("shouldIgnoreContentChunk", () => {
    it("ignores empty content when no active streaming entry", () => {
      expect(shouldIgnoreContentChunk("", false)).toBe(true);
      expect(shouldIgnoreContentChunk("   ", false)).toBe(true);
      expect(shouldIgnoreContentChunk(undefined, false)).toBe(true);
    });

    it("allows content when a streaming entry exists", () => {
      expect(shouldIgnoreContentChunk("   ", true)).toBe(false);
      expect(shouldIgnoreContentChunk("message", true)).toBe(false);
    });

    it("allows non-empty content when no streaming entry yet", () => {
      expect(shouldIgnoreContentChunk("hello", false)).toBe(false);
    });
  });
});
