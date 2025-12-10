/**
 * Tests for File Mentions Parser
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  parseFileMentions,
  hasFileMentions,
  extractFilePaths,
  type ParseConfig,
  type FileMention,
} from "../../packages/core/src/utils/file-mentions.js";

describe("File Mentions Parser", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(process.cwd(), `.test-file-mentions-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  function createTestFile(relativePath: string, content: string): string {
    const fullPath = path.join(testDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
    return fullPath;
  }

  describe("hasFileMentions", () => {
    it("should return true for @path/to/file.ts", () => {
      expect(hasFileMentions("Look at @src/index.ts")).toBe(true);
    });

    it("should return true for @./relative/path.ts", () => {
      expect(hasFileMentions("Check @./file.ts")).toBe(true);
    });

    it("should return true for @../parent/path.ts", () => {
      expect(hasFileMentions("See @../file.ts")).toBe(true);
    });

    it("should return true for @file.ts (with extension)", () => {
      expect(hasFileMentions("Edit @file.ts")).toBe(true);
    });

    it("should return false for email addresses", () => {
      expect(hasFileMentions("Contact user@example.com")).toBe(false);
    });

    it("should return false for @username without extension", () => {
      expect(hasFileMentions("Tag @johndoe in the review")).toBe(false);
    });

    it("should return false when no mentions", () => {
      expect(hasFileMentions("No file mentions here")).toBe(false);
    });

    it("should return false for common email domains", () => {
      expect(hasFileMentions("Email me at name@gmail.com")).toBe(false);
      expect(hasFileMentions("Contact support@company.org")).toBe(false);
      expect(hasFileMentions("Write to dev@startup.io")).toBe(false);
    });
  });

  describe("extractFilePaths", () => {
    it("should extract file paths from mentions", () => {
      const paths = extractFilePaths("Look at @src/index.ts and @src/utils.ts");
      expect(paths).toEqual(["src/index.ts", "src/utils.ts"]);
    });

    it("should extract relative paths", () => {
      const paths = extractFilePaths("Check @./local.ts and @../parent.ts");
      expect(paths).toEqual(["./local.ts", "../parent.ts"]);
    });

    it("should return empty array when no mentions", () => {
      const paths = extractFilePaths("No file mentions");
      expect(paths).toEqual([]);
    });

    it("should ignore email addresses", () => {
      const paths = extractFilePaths("Email user@example.com about @file.ts");
      expect(paths).toEqual(["file.ts"]);
    });

    it("should handle multiple mentions of same file", () => {
      const paths = extractFilePaths("See @file.ts, also @file.ts again");
      expect(paths).toEqual(["file.ts", "file.ts"]);
    });
  });

  describe("parseFileMentions", () => {
    it("should return no mentions for input without @", async () => {
      const result = await parseFileMentions("Plain text without mentions");

      expect(result.hasMentions).toBe(false);
      expect(result.mentions).toHaveLength(0);
      expect(result.expandedInput).toBe("Plain text without mentions");
    });

    it("should find file that exists", async () => {
      createTestFile("test.ts", "console.log('test');");

      const result = await parseFileMentions("Check @test.ts", { baseDir: testDir });

      expect(result.hasMentions).toBe(true);
      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0].exists).toBe(true);
      expect(result.mentions[0].content).toContain("console.log");
    });

    it("should mark non-existent file", async () => {
      const result = await parseFileMentions("Check @nonexistent.ts", { baseDir: testDir });

      expect(result.hasMentions).toBe(true);
      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0].exists).toBe(false);
      expect(result.mentions[0].error).toContain("not found");
    });

    it("should expand file contents in input", async () => {
      createTestFile("hello.ts", "const x = 1;");

      const result = await parseFileMentions("Look at @hello.ts", { baseDir: testDir });

      expect(result.expandedInput).toContain("@hello.ts");
      expect(result.expandedInput).toContain("<file");
      expect(result.expandedInput).toContain("const x = 1");
      expect(result.expandedInput).toContain("</file>");
    });

    it("should respect maxFileSize limit", async () => {
      const largeContent = "x".repeat(10000);
      createTestFile("large.ts", largeContent);

      const result = await parseFileMentions("Check @large.ts", {
        baseDir: testDir,
        maxFileSize: 1000, // 1KB limit
      });

      expect(result.mentions[0].error).toContain("too large");
    });

    it("should respect maxMentions limit", async () => {
      createTestFile("a.ts", "a");
      createTestFile("b.ts", "b");
      createTestFile("c.ts", "c");

      const result = await parseFileMentions("Check @a.ts @b.ts @c.ts", {
        baseDir: testDir,
        maxMentions: 2,
      });

      expect(result.mentions).toHaveLength(2);
    });

    it("should not include content when includeContents is false", async () => {
      createTestFile("file.ts", "content here");

      const result = await parseFileMentions("Check @file.ts", {
        baseDir: testDir,
        includeContents: false,
      });

      expect(result.mentions[0].content).toBeUndefined();
      expect(result.expandedInput).toBe("Check @file.ts");
    });

    it("should filter by allowed extensions", async () => {
      createTestFile("file.ts", "typescript");
      createTestFile("file.js", "javascript");

      const result = await parseFileMentions("Check @file.ts and @file.js", {
        baseDir: testDir,
        allowedExtensions: ["ts"],
      });

      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0].path).toBe("file.ts");
    });

    it("should handle directories", async () => {
      const dirPath = path.join(testDir, "subdir");
      fs.mkdirSync(dirPath, { recursive: true });
      fs.writeFileSync(path.join(dirPath, "file1.txt"), "content1");
      fs.writeFileSync(path.join(dirPath, "file2.txt"), "content2");

      // Use @./subdir to trigger isFilePath (needs path separator)
      const result = await parseFileMentions("List @./subdir", { baseDir: testDir });

      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0].isDirectory).toBe(true);
      expect(result.mentions[0].content).toContain("Directory listing");
      expect(result.mentions[0].content).toContain("file1.txt");
    });

    it("should handle absolute paths", async () => {
      const absolutePath = createTestFile("absolute.ts", "absolute content");

      const result = await parseFileMentions(`Check @${absolutePath}`, { baseDir: testDir });

      expect(result.hasMentions).toBe(true);
      expect(result.mentions[0].exists).toBe(true);
    });

    it("should handle glob patterns", async () => {
      createTestFile("src/a.ts", "a");
      createTestFile("src/b.ts", "b");

      const result = await parseFileMentions("Check @src/*.ts", { baseDir: testDir });

      expect(result.hasMentions).toBe(true);
      expect(result.mentions.length).toBeGreaterThanOrEqual(1);
    });

    it("should return correct start/end positions", async () => {
      createTestFile("file.ts", "content");

      const result = await parseFileMentions("See @file.ts here", { baseDir: testDir });

      const mention = result.mentions[0];
      expect(mention.start).toBe(4); // Position of @
      expect(mention.end).toBe(12); // Position after file.ts
    });

    it("should handle multiple mentions of same file", async () => {
      createTestFile("file.ts", "content");

      const result = await parseFileMentions("@file.ts and @file.ts again", { baseDir: testDir });

      // Should expand only once
      const fileTagCount = (result.expandedInput.match(/<file/g) || []).length;
      expect(fileTagCount).toBe(1);
    });

    it("should preserve original input", async () => {
      const original = "Check @file.ts for details";
      const result = await parseFileMentions(original, { baseDir: testDir });

      expect(result.originalInput).toBe(original);
    });

    it("should use process.cwd as default baseDir", async () => {
      // This test just verifies the function runs with defaults
      const result = await parseFileMentions("Check @package.json");

      expect(result).toBeDefined();
      expect(result.originalInput).toBe("Check @package.json");
    });

    it("should handle nested directories in path", async () => {
      createTestFile("src/utils/helper.ts", "helper content");

      const result = await parseFileMentions("Check @src/utils/helper.ts", { baseDir: testDir });

      expect(result.mentions[0].exists).toBe(true);
      expect(result.mentions[0].content).toContain("helper content");
    });

    it("should handle file read errors gracefully", async () => {
      // Create a file and then remove read permissions (Unix only)
      const filePath = createTestFile("noperm.ts", "content");

      // Skip on Windows
      if (process.platform !== "win32") {
        fs.chmodSync(filePath, 0o000);

        const result = await parseFileMentions("Check @noperm.ts", { baseDir: testDir });

        expect(result.mentions[0].error).toBeDefined();

        // Restore permissions for cleanup
        fs.chmodSync(filePath, 0o644);
      }
    });
  });

  describe("parseFileMentions edge cases", () => {
    it("should handle empty input", async () => {
      const result = await parseFileMentions("");
      expect(result.hasMentions).toBe(false);
      expect(result.expandedInput).toBe("");
    });

    it("should handle input with only @", async () => {
      const result = await parseFileMentions("Just @ symbol");
      expect(result.hasMentions).toBe(false);
    });

    it("should handle mixed valid and invalid mentions", async () => {
      createTestFile("valid.ts", "valid content");

      const result = await parseFileMentions(
        "Check @valid.ts and email@example.com and @invalid.ts",
        { baseDir: testDir }
      );

      expect(result.mentions).toHaveLength(2);
      expect(result.mentions[0].exists).toBe(true);
      expect(result.mentions[1].exists).toBe(false);
    });

    it("should handle path with special characters", async () => {
      // Most special chars are fine in filenames
      createTestFile("file-name_here.ts", "content");

      const result = await parseFileMentions("Check @file-name_here.ts", { baseDir: testDir });

      expect(result.mentions[0].exists).toBe(true);
    });

    it("should handle very long paths", async () => {
      const longDir = "a".repeat(50) + "/" + "b".repeat(50);
      const filePath = path.join(longDir, "file.ts");
      createTestFile(filePath, "content");

      const result = await parseFileMentions(`Check @${filePath}`, { baseDir: testDir });

      expect(result.mentions[0].exists).toBe(true);
    });
  });
});
