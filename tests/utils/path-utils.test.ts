/**
 * Tests for Path Utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizePath,
  platformPath,
  isWindows,
  pathsEqual,
  pathContains,
} from "../../packages/core/src/utils/path-utils.js";

// Note: We can't mock os.platform() in ESM, so we test based on actual platform
// and use conditional tests for platform-specific behavior

describe("Path Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("normalizePath", () => {
    it("should return empty string for empty input", () => {
      expect(normalizePath("")).toBe("");
    });

    it("should return empty string for falsy input", () => {
      expect(normalizePath(null as unknown as string)).toBe("");
      expect(normalizePath(undefined as unknown as string)).toBe("");
    });

    it("should convert backslashes to forward slashes", () => {
      expect(normalizePath("foo\\bar\\baz")).toBe("foo/bar/baz");
    });

    it("should keep forward slashes unchanged", () => {
      expect(normalizePath("foo/bar/baz")).toBe("foo/bar/baz");
    });

    it("should handle Windows-style absolute paths", () => {
      expect(normalizePath("C:\\Users\\foo\\bar")).toBe("C:/Users/foo/bar");
    });

    it("should handle Unix-style absolute paths", () => {
      expect(normalizePath("/Users/foo/bar")).toBe("/Users/foo/bar");
    });

    it("should handle mixed separators", () => {
      expect(normalizePath("foo\\bar/baz\\qux")).toBe("foo/bar/baz/qux");
    });

    it("should handle multiple consecutive backslashes", () => {
      expect(normalizePath("foo\\\\bar")).toBe("foo//bar");
    });

    it("should handle paths with spaces", () => {
      expect(normalizePath("C:\\Program Files\\App")).toBe("C:/Program Files/App");
    });

    it("should handle UNC paths", () => {
      expect(normalizePath("\\\\server\\share\\folder")).toBe("//server/share/folder");
    });

    it("should handle path with dots", () => {
      expect(normalizePath("./foo/../bar")).toBe("./foo/../bar");
    });

    it("should handle single backslash", () => {
      expect(normalizePath("\\")).toBe("/");
    });
  });

  describe("platformPath", () => {
    it("should return empty string for empty input", () => {
      expect(platformPath("")).toBe("");
    });

    it("should return empty string for falsy input", () => {
      expect(platformPath(null as unknown as string)).toBe("");
      expect(platformPath(undefined as unknown as string)).toBe("");
    });

    it("should normalize path to platform format", () => {
      const result = platformPath("foo/bar/baz");
      // The result depends on the platform - just verify it's a valid path
      expect(result).toContain("foo");
      expect(result).toContain("bar");
      expect(result).toContain("baz");
    });

    it("should handle relative paths", () => {
      const result = platformPath("./foo/bar");
      expect(result).toContain("foo");
      expect(result).toContain("bar");
    });

    it("should handle parent directory references", () => {
      const result = platformPath("../foo/bar");
      expect(result).toContain("foo");
      expect(result).toContain("bar");
    });

    it("should handle redundant separators", () => {
      const result = platformPath("foo//bar///baz");
      expect(result).toContain("foo");
      expect(result).toContain("bar");
      expect(result).toContain("baz");
    });

    it("should handle single segment", () => {
      expect(platformPath("foo")).toBe("foo");
    });
  });

  describe("isWindows", () => {
    it("should return a boolean", () => {
      const result = isWindows();
      expect(typeof result).toBe("boolean");
    });

    it("should match process.platform check", () => {
      const expected = process.platform === "win32";
      expect(isWindows()).toBe(expected);
    });
  });

  describe("pathsEqual", () => {
    describe("when paths are empty or falsy", () => {
      it("should return true for two empty strings", () => {
        expect(pathsEqual("", "")).toBe(true);
      });

      it("should return false when only one is empty", () => {
        expect(pathsEqual("", "foo")).toBe(false);
        expect(pathsEqual("foo", "")).toBe(false);
      });

      it("should return true when both are undefined", () => {
        expect(pathsEqual(
          undefined as unknown as string,
          undefined as unknown as string
        )).toBe(true);
      });

      it("should return false when one is undefined", () => {
        expect(pathsEqual(undefined as unknown as string, "foo")).toBe(false);
        expect(pathsEqual("foo", undefined as unknown as string)).toBe(false);
      });

      it("should return true when both are null", () => {
        expect(pathsEqual(
          null as unknown as string,
          null as unknown as string
        )).toBe(true);
      });
    });

    describe("cross-platform behavior", () => {
      it("should return true for identical paths", () => {
        expect(pathsEqual("foo/bar", "foo/bar")).toBe(true);
      });

      it("should return true for paths with different separators", () => {
        expect(pathsEqual("foo/bar", "foo\\bar")).toBe(true);
      });

      it("should return false for different paths", () => {
        expect(pathsEqual("foo/bar", "foo/baz")).toBe(false);
      });

      it("should handle absolute paths", () => {
        expect(pathsEqual("/foo/bar", "/foo/bar")).toBe(true);
      });

      it("should handle complex paths", () => {
        expect(pathsEqual("a/b/c/d", "a\\b\\c\\d")).toBe(true);
      });
    });

    // Platform-specific tests run based on actual platform
    if (process.platform === "win32") {
      describe("Windows-specific", () => {
        it("should be case-insensitive", () => {
          expect(pathsEqual("Foo/Bar", "foo/bar")).toBe(true);
        });

        it("should handle mixed case Windows paths", () => {
          expect(pathsEqual("C:\\Users\\Foo", "c:/users/foo")).toBe(true);
        });
      });
    } else {
      describe("Unix-specific", () => {
        it("should be case-sensitive", () => {
          expect(pathsEqual("Foo/Bar", "foo/bar")).toBe(false);
        });

        it("should distinguish case differences", () => {
          expect(pathsEqual("FOO", "foo")).toBe(false);
        });
      });
    }
  });

  describe("pathContains", () => {
    describe("when paths are empty or falsy", () => {
      it("should return false for empty full path", () => {
        expect(pathContains("", "foo")).toBe(false);
      });

      it("should return false for empty segment", () => {
        expect(pathContains("foo/bar", "")).toBe(false);
      });

      it("should return false for both empty", () => {
        expect(pathContains("", "")).toBe(false);
      });

      it("should return false for null/undefined fullPath", () => {
        expect(pathContains(null as unknown as string, "foo")).toBe(false);
        expect(pathContains(undefined as unknown as string, "foo")).toBe(false);
      });

      it("should return false for null/undefined segment", () => {
        expect(pathContains("foo", null as unknown as string)).toBe(false);
        expect(pathContains("foo", undefined as unknown as string)).toBe(false);
      });
    });

    describe("cross-platform behavior", () => {
      it("should find exact segment match", () => {
        expect(pathContains("/foo/bar/baz", "bar/baz")).toBe(true);
      });

      it("should find partial segment", () => {
        expect(pathContains("/foo/bar/baz", "bar")).toBe(true);
      });

      it("should return false when segment not found", () => {
        expect(pathContains("/foo/bar/baz", "qux")).toBe(false);
      });

      it("should handle different separators in segment", () => {
        // Both should be normalized before comparison
        expect(pathContains("foo/bar/baz", "bar/baz")).toBe(true);
        expect(pathContains("foo\\bar\\baz", "bar/baz")).toBe(true);
      });

      it("should find segment at start", () => {
        expect(pathContains("foo/bar/baz", "foo")).toBe(true);
      });

      it("should find segment at end", () => {
        expect(pathContains("foo/bar/baz", "baz")).toBe(true);
      });

      it("should handle single-segment path", () => {
        expect(pathContains("foo", "foo")).toBe(true);
        expect(pathContains("foo", "bar")).toBe(false);
      });
    });

    // Platform-specific tests run based on actual platform
    if (process.platform === "win32") {
      describe("Windows-specific", () => {
        it("should find segment case-insensitively", () => {
          expect(pathContains("/foo/bar/baz", "BAR")).toBe(true);
        });

        it("should handle Windows paths case-insensitively", () => {
          expect(pathContains("C:\\Users\\Foo", "users/foo")).toBe(true);
        });
      });
    } else {
      describe("Unix-specific", () => {
        it("should be case-sensitive", () => {
          expect(pathContains("/foo/bar/baz", "BAR")).toBe(false);
        });

        it("should distinguish case differences", () => {
          expect(pathContains("/foo/bar/baz", "Bar")).toBe(false);
        });
      });
    }
  });
});
