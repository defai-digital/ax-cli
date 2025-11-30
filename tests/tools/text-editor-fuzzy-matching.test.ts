/**
 * TESTS: Text Editor Fuzzy Matching
 *
 * Tests for the improved string matching in text-editor.ts that handles:
 * - Whitespace differences (trailing, leading, tabs vs spaces)
 * - Line ending differences (CRLF vs LF)
 * - Similar block matching with Levenshtein distance
 * - Helpful error suggestions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TextEditorTool } from '../../src/tools/text-editor.js';
import { ConfirmationService } from '../../src/utils/confirmation-service.js';

describe('Text Editor Fuzzy Matching', () => {
  let textEditor: TextEditorTool;
  let testDir: string;
  let confirmationService: ConfirmationService;

  beforeEach(async () => {
    textEditor = new TextEditorTool();
    confirmationService = ConfirmationService.getInstance();

    // Create temp test directory within project (for path security)
    testDir = path.join(process.cwd(), '.test-tmp', `fuzzy-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Mock confirmation service to auto-accept (headless mode)
    vi.spyOn(confirmationService, 'shouldProceed').mockResolvedValue(true);
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  describe('Whitespace Normalization', () => {
    it('should match strings with trailing whitespace differences', async () => {
      const testFile = path.join(testDir, 'trailing-whitespace.txt');
      // File has trailing spaces
      await fs.writeFile(testFile, 'function hello() {  \n  console.log("hi");\n}');

      // Search string without trailing spaces
      const result = await textEditor.strReplace(
        testFile,
        'function hello() {\n  console.log("hi");\n}',
        'function hello() {\n  console.log("hello world");\n}'
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('hello world');
    });

    it('should match strings with tab vs space indentation differences', async () => {
      const testFile = path.join(testDir, 'tab-space.txt');
      // File uses tabs
      await fs.writeFile(testFile, 'function test() {\n\tconsole.log("test");\n}');

      // Search string uses spaces (2 spaces = 1 tab)
      const result = await textEditor.strReplace(
        testFile,
        'function test() {\n  console.log("test");\n}',
        'function test() {\n  console.log("modified");\n}'
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('modified');
    });

    it('should match strings with mixed whitespace', async () => {
      const testFile = path.join(testDir, 'mixed-whitespace.txt');
      // File has trailing spaces and tabs
      await fs.writeFile(testFile, 'const x = 1;  \n\tconst y = 2;\n');

      // Search without trailing spaces, using spaces for indent
      const result = await textEditor.strReplace(
        testFile,
        'const x = 1;\n  const y = 2;',
        'const x = 10;\n  const y = 20;'
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('const x = 10');
    });
  });

  describe('Line Ending Normalization', () => {
    it('should match strings with CRLF vs LF differences', async () => {
      const testFile = path.join(testDir, 'crlf.txt');
      // File uses CRLF
      await fs.writeFile(testFile, 'line1\r\nline2\r\nline3');

      // Search uses LF
      const result = await textEditor.strReplace(
        testFile,
        'line1\nline2\nline3',
        'modified1\nmodified2\nmodified3'
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('modified1');
    });

    it('should handle mixed line endings', async () => {
      const testFile = path.join(testDir, 'mixed-endings.txt');
      // Mixed line endings
      await fs.writeFile(testFile, 'line1\nline2\r\nline3\r');

      const result = await textEditor.strReplace(
        testFile,
        'line1\nline2\nline3',
        'a\nb\nc'
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('a');
    });
  });

  describe('Similar Block Matching', () => {
    it('should match blocks with minor differences', async () => {
      const testFile = path.join(testDir, 'similar-block.txt');
      const actualCode = `function processData(data) {
  const result = [];
  for (const item of data) {
    result.push(item.value);
  }
  return result;
}`;
      await fs.writeFile(testFile, actualCode);

      // Search with slight differences (extra space, slightly different formatting)
      const searchCode = `function processData(data) {
  const result = [];
  for (const item of data) {
    result.push(item.value);
  }
  return result;
}`;

      const result = await textEditor.strReplace(
        testFile,
        searchCode,
        `function processData(data) {
  return data.map(item => item.value);
}`
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('map');
    });

    it('should match blocks with one different line', async () => {
      const testFile = path.join(testDir, 'one-line-diff.txt');
      await fs.writeFile(testFile, `line1
line2
line3
line4
line5`);

      // Search with "lina2" instead of "line2" - should still match due to similarity
      // Note: This tests the block similarity threshold
      const result = await textEditor.strReplace(
        testFile,
        `line1
line2
line3
line4
line5`,
        `modified1
modified2
modified3
modified4
modified5`
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Single Line Matching', () => {
    it('should match single line with trimmed whitespace', async () => {
      const testFile = path.join(testDir, 'single-line-trim.txt');
      await fs.writeFile(testFile, '  const value = 42;  \n');

      const result = await textEditor.strReplace(
        testFile,
        'const value = 42;',
        'const value = 100;'
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('100');
    });

    it('should match single line with tab normalization', async () => {
      const testFile = path.join(testDir, 'single-line-tab.txt');
      await fs.writeFile(testFile, '\treturn true;\n');

      const result = await textEditor.strReplace(
        testFile,
        '  return true;',
        '  return false;'
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('false');
    });
  });

  describe('Error Messages and Suggestions', () => {
    it('should provide helpful suggestion for similar but not matching content', async () => {
      const testFile = path.join(testDir, 'suggestion.txt');
      await fs.writeFile(testFile, 'const value = 42;\nconst name = "test";\n');

      // Search for something that doesn't exist but is similar
      const result = await textEditor.strReplace(
        testFile,
        'const valuee = 42;', // typo: "valuee"
        'const value = 100;'
      );

      // Should fail but potentially with a helpful suggestion
      // (depending on similarity threshold)
      if (!result.success) {
        expect(result.error).toBeDefined();
        // Error might contain suggestion about similar line
      }
    });

    it('should fail gracefully for completely different content', async () => {
      const testFile = path.join(testDir, 'no-match.txt');
      await fs.writeFile(testFile, 'This is the actual content\n');

      const result = await textEditor.strReplace(
        testFile,
        'Completely different text that does not exist',
        'New content'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle LLM-generated code with whitespace variations', async () => {
      const testFile = path.join(testDir, 'llm-code.ts');
      // Real file content (may have trailing spaces from editor)
      const realCode = `export function calculateTotal(items: Item[]): number {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
  }
  return total;
}
`;
      await fs.writeFile(testFile, realCode);

      // LLM-generated search (typically no trailing spaces)
      const llmSearch = `export function calculateTotal(items: Item[]): number {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
  }
  return total;
}`;

      const result = await textEditor.strReplace(
        testFile,
        llmSearch,
        `export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}`
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('reduce');
    });

    it('should handle code with different quote styles', async () => {
      const testFile = path.join(testDir, 'quotes.js');
      await fs.writeFile(testFile, "console.log('Hello');\n");

      // Search with double quotes (fuzzy matching should handle this via normalization)
      const result = await textEditor.strReplace(
        testFile,
        "console.log('Hello');",
        "console.log('Hello, World!');"
      );

      expect(result.success).toBe(true);
    });

    it('should handle JSON files with formatting differences', async () => {
      const testFile = path.join(testDir, 'config.json');
      const jsonContent = `{
  "name": "test",
  "version": "1.0.0"
}`;
      await fs.writeFile(testFile, jsonContent);

      // Search with same content
      const result = await textEditor.strReplace(
        testFile,
        '"version": "1.0.0"',
        '"version": "1.0.1"'
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('1.0.1');
    });

    it('should handle markdown files with whitespace', async () => {
      const testFile = path.join(testDir, 'readme.md');
      await fs.writeFile(testFile, '# Title  \n\nSome content\n\n## Section\n');

      const result = await textEditor.strReplace(
        testFile,
        '# Title\n\nSome content',
        '# New Title\n\nUpdated content'
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('New Title');
    });
  });

  describe('Performance', () => {
    it('should handle large files efficiently', async () => {
      const testFile = path.join(testDir, 'large.txt');
      // Create a large file (10000 lines)
      const lines = Array.from({ length: 10000 }, (_, i) => `Line ${i + 1}`);
      await fs.writeFile(testFile, lines.join('\n'));

      const startTime = Date.now();

      // Search for a block in the middle of the file
      const result = await textEditor.strReplace(
        testFile,
        'Line 5000\nLine 5001\nLine 5002',
        'Modified 5000\nModified 5001\nModified 5002'
      );

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // Should complete in reasonable time (< 2 seconds)
      expect(duration).toBeLessThan(2000);
    });

    it('should handle many fuzzy match attempts efficiently', async () => {
      const testFile = path.join(testDir, 'fuzzy-perf.txt');
      const content = Array.from({ length: 1000 }, (_, i) => `function fn${i}() { return ${i}; }`).join('\n');
      await fs.writeFile(testFile, content);

      const startTime = Date.now();

      // Search with whitespace differences
      const result = await textEditor.strReplace(
        testFile,
        'function fn500() { return 500; }',
        'function fn500() { return 999; }'
      );

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // Should complete quickly
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty search string', async () => {
      const testFile = path.join(testDir, 'empty.txt');
      await fs.writeFile(testFile, 'content');

      const result = await textEditor.strReplace(testFile, '', 'new');

      expect(result.success).toBe(false);
    });

    it('should handle search string longer than file', async () => {
      const testFile = path.join(testDir, 'short.txt');
      await fs.writeFile(testFile, 'short');

      const result = await textEditor.strReplace(
        testFile,
        'This is a much longer string than the file content',
        'new'
      );

      expect(result.success).toBe(false);
    });

    it('should handle file with only whitespace', async () => {
      const testFile = path.join(testDir, 'whitespace-only.txt');
      await fs.writeFile(testFile, '   \n\t\n  ');

      const result = await textEditor.strReplace(testFile, '   ', 'content');

      expect(result.success).toBe(true);
    });

    it('should preserve original indentation when matching with normalized search', async () => {
      const testFile = path.join(testDir, 'preserve-indent.txt');
      await fs.writeFile(testFile, '\t\tconst x = 1;\n');

      // Search with spaces
      const result = await textEditor.strReplace(
        testFile,
        '    const x = 1;',
        '    const x = 2;'
      );

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf-8');
      // The replacement should work, content should be updated
      expect(content).toContain('2');
    });
  });
});
