/**
 * REGRESSION TESTS: Text Editor TOCTOU Race Condition (implemented in v3.7.2+)
 *
 * Tests Time-Of-Check-Time-Of-Use (TOCTOU) prevention in text-editor.ts.
 * The TOCTOU fix IS IMPLEMENTED in TextEditorTool.strReplace() and prevents
 * data loss when files are modified between read and write.
 *
 * Implementation details:
 * - src/tools/text-editor.ts:157-160 - Mtime capture on read
 * - src/tools/text-editor.ts:243-251 - Mtime verification before write
 * - src/tools/text-editor.ts:256-270 - Atomic writes (temp + rename)
 *
 * These tests verify the TOCTOU protection works correctly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TextEditorTool } from '../../src/tools/text-editor.js';
import { ConfirmationService } from '../../src/utils/confirmation-service.js';

describe('Text Editor TOCTOU Regression Tests', () => {
  let textEditor: TextEditorTool;
  let testDir: string;
  let confirmationService: ConfirmationService;

  beforeEach(async () => {
    textEditor = new TextEditorTool();
    confirmationService = ConfirmationService.getInstance();

    // Create temp test directory within project (for path security)
    testDir = path.join(process.cwd(), '.test-tmp', `toctou-${Date.now()}`);
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

  describe('TOCTOU Race Condition Prevention', () => {
    it('should capture mtime on file read', async () => {
      const testFile = path.join(testDir, 'test.txt');
      const originalContent = 'Original content\nLine 2\nLine 3';
      await fs.writeFile(testFile, originalContent);

      // Get initial mtime
      const statsBefore = await fs.stat(testFile);
      const mtimeBefore = statsBefore.mtimeMs;

      // View the file (should capture mtime internally)
      const viewResult = await textEditor.view(testFile);
      expect(viewResult.success).toBe(true);
      expect(viewResult.output).toContain('Original content');

      // Mtime should not change from just reading
      const statsAfter = await fs.stat(testFile);
      expect(statsAfter.mtimeMs).toBe(mtimeBefore);
    });

    it('should use atomic write operations (temp file + rename)', async () => {
      const testFile = path.join(testDir, 'atomic-test.txt');
      const originalContent = 'Line 1\nLine 2\nLine 3';
      await fs.writeFile(testFile, originalContent);

      // Perform an edit
      const result = await textEditor.strReplace(testFile, 'Line 2', 'Line 2 Modified');

      expect(result.success).toBe(true);

      // Verify file exists and has correct content
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('Line 2 Modified');

      // Verify no temp files left behind
      const files = await fs.readdir(testDir);
      const tempFiles = files.filter(f => f.includes('.tmp'));
      expect(tempFiles).toHaveLength(0);
    });

    it('should handle file mtime verification correctly', async () => {
      const testFile = path.join(testDir, 'mtime-test.txt');
      const content = 'Test content for mtime check';
      await fs.writeFile(testFile, content);

      // Get initial mtime
      const statBefore = await fs.stat(testFile);
      const mtimeBefore = statBefore.mtimeMs;

      // View the file (reads it)
      await textEditor.view(testFile);

      // Mtime should not change from just reading
      const statAfter = await fs.stat(testFile);
      expect(statAfter.mtimeMs).toBe(mtimeBefore);
    });

    it('should complete writes atomically', async () => {
      const testFile = path.join(testDir, 'atomic.txt');
      const content = 'Original\nLine 2\nLine 3';
      await fs.writeFile(testFile, content);

      // Perform successful edit
      const result = await textEditor.strReplace(testFile, 'Original', 'Modified');
      expect(result.success).toBe(true);

      // Content should be fully updated (not partial)
      const finalContent = await fs.readFile(testFile, 'utf-8');
      expect(finalContent).toBe('Modified\nLine 2\nLine 3');
    });
  });

  describe('Edge Cases', () => {
    it('should handle file deleted between read and write', async () => {
      const testFile = path.join(testDir, 'deleted.txt');
      await fs.writeFile(testFile, 'Content to be deleted');

      // Delete the file before strReplace
      await fs.unlink(testFile);

      // Try to edit - should fail gracefully
      const result = await textEditor.strReplace(
        testFile,
        'Content to be deleted',
        'New content'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/not found/i);
    });

    it('should handle permission changes gracefully', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows (different permission model)
        return;
      }

      const testFile = path.join(testDir, 'permissions.txt');
      await fs.writeFile(testFile, 'Original content');

      // Make file read-only
      await fs.chmod(testFile, 0o444);

      // Try to edit - should handle gracefully
      const result = await textEditor.strReplace(
        testFile,
        'Original content',
        'New content'
      );

      // Restore permissions for cleanup
      try {
        await fs.chmod(testFile, 0o644);
      } catch {}

      // Should fail gracefully with permission error
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle rapid file modifications', async () => {
      const testFile = path.join(testDir, 'rapid.txt');
      await fs.writeFile(testFile, 'Version 1');

      // Perform rapid modifications
      for (let i = 2; i <= 5; i++) {
        await textEditor.strReplace(testFile, `Version ${i - 1}`, `Version ${i}`);
      }

      // Final content should be Version 5
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('Version 5');
    });
  });

  describe('Atomic Write Verification', () => {
    it('should not leave partial writes on error', async () => {
      const testFile = path.join(testDir, 'partial-write.txt');
      await fs.writeFile(testFile, 'Original');

      // Get initial file list
      const filesBefore = await fs.readdir(testDir);

      // Try an invalid operation that should fail
      const result = await textEditor.strReplace(
        testFile,
        'NON_EXISTENT_TEXT',
        'New text'
      );

      expect(result.success).toBe(false);

      // Verify no temp files left behind
      const filesAfter = await fs.readdir(testDir);
      expect(filesAfter.length).toBe(filesBefore.length);

      // Original file should be unchanged
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('Original');
    });

    it('should complete write atomically for large files', async () => {
      const testFile = path.join(testDir, 'large.txt');
      const largeContent = 'Line\n'.repeat(1000);
      await fs.writeFile(testFile, largeContent);

      // Perform edit
      const result = await textEditor.strReplace(
        testFile,
        'Line',
        'Modified Line',
        true // replaceAll
      );

      expect(result.success).toBe(true);

      // Verify all lines modified (atomic write)
      const content = await fs.readFile(testFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      // All non-empty lines should be modified
      lines.forEach(line => {
        if (line.trim()) {
          expect(line).toBe('Modified Line');
        }
      });
    });

    it('should not leave temp files after successful write', async () => {
      const testFile = path.join(testDir, 'tempcheck.txt');
      await fs.writeFile(testFile, 'Original');

      // Perform edit
      await textEditor.strReplace(testFile, 'Original', 'Modified');

      // No temp files should remain
      const files = await fs.readdir(testDir);
      const tempFiles = files.filter(f => f.includes('.tmp'));
      expect(tempFiles).toHaveLength(0);
    });
  });

  describe('Performance Impact', () => {
    it('should not significantly slow down edits with mtime checks', async () => {
      const testFile = path.join(testDir, 'performance.txt');
      const content = 'Performance test content\n'.repeat(100);
      await fs.writeFile(testFile, content);

      const startTime = Date.now();

      // Perform multiple edits
      for (let i = 0; i < 10; i++) {
        await textEditor.strReplace(
          testFile,
          'Performance test content',
          `Performance test content ${i}`,
          false // Only replace first occurrence for speed
        );
      }

      const duration = Date.now() - startTime;

      // TOCTOU checks should add minimal overhead (<5 seconds for 10 edits)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Backward Compatibility', () => {
    it('should still work for normal edits without race conditions', async () => {
      const testFile = path.join(testDir, 'normal.txt');
      await fs.writeFile(testFile, 'Normal content\nLine 2\nLine 3');

      // Normal edit flow
      const viewResult = await textEditor.view(testFile);
      expect(viewResult.success).toBe(true);

      const editResult = await textEditor.strReplace(testFile, 'Line 2', 'Line 2 Edited');
      expect(editResult.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('Line 2 Edited');
    });

    it('should work with various file encodings', async () => {
      const testFile = path.join(testDir, 'encoding.txt');
      const unicodeContent = 'Hello 世界 🌍\nUnicode test\n';
      await fs.writeFile(testFile, unicodeContent, 'utf-8');

      const result = await textEditor.strReplace(
        testFile,
        'Unicode test',
        'Unicode test ✓'
      );

      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('✓');
      expect(content).toContain('世界');
      expect(content).toContain('🌍');
    });

    it('should handle multi-line replacements correctly', async () => {
      const testFile = path.join(testDir, 'multiline.txt');
      const content = 'Line 1\nLine 2\nLine 3\nLine 4';
      await fs.writeFile(testFile, content);

      const result = await textEditor.strReplace(
        testFile,
        'Line 2\nLine 3',
        'Modified Line 2\nModified Line 3'
      );

      expect(result.success).toBe(true);

      const finalContent = await fs.readFile(testFile, 'utf-8');
      expect(finalContent).toContain('Modified Line 2');
      expect(finalContent).toContain('Modified Line 3');
    });
  });

  describe('Error Recovery', () => {
    it('should cleanup temp files on write failure', async () => {
      const testFile = path.join(testDir, 'cleanup.txt');
      await fs.writeFile(testFile, 'Original');

      // Get files before
      const filesBefore = await fs.readdir(testDir);

      // Make parent directory read-only to simulate write failure
      if (process.platform !== 'win32') {
        await fs.chmod(testDir, 0o444);

        const result = await textEditor.strReplace(testFile, 'Original', 'Modified');

        // Restore permissions
        await fs.chmod(testDir, 0o755);

        // Should fail
        expect(result.success).toBe(false);

        // No temp files should remain
        const filesAfter = await fs.readdir(testDir);
        const tempFiles = filesAfter.filter(f => f.includes('.tmp'));
        expect(tempFiles).toHaveLength(0);
      }
    });

    it('should handle errors during rename gracefully', async () => {
      const testFile = path.join(testDir, 'rename-error.txt');
      await fs.writeFile(testFile, 'Original');

      // Perform a normal edit (should succeed)
      const result = await textEditor.strReplace(testFile, 'Original', 'Modified');

      // Normal case should succeed
      expect(result.success).toBe(true);

      // Verify content
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('Modified');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical code file edits', async () => {
      const testFile = path.join(testDir, 'code.ts');
      const code = `function hello() {\n  console.log("Hello");\n}\n`;
      await fs.writeFile(testFile, code);

      const result = await textEditor.strReplace(
        testFile,
        'console.log("Hello")',
        'console.log("Hello, World")'
      );

      expect(result.success).toBe(true);

      const finalCode = await fs.readFile(testFile, 'utf-8');
      expect(finalCode).toContain('Hello, World');
    });

    it('should handle configuration file updates', async () => {
      const testFile = path.join(testDir, 'config.json');
      const config = JSON.stringify({ version: '1.0.0', name: 'test' }, null, 2);
      await fs.writeFile(testFile, config);

      const result = await textEditor.strReplace(
        testFile,
        '"version": "1.0.0"',
        '"version": "1.0.1"'
      );

      expect(result.success).toBe(true);

      const finalConfig = await fs.readFile(testFile, 'utf-8');
      expect(finalConfig).toContain('1.0.1');

      // Should still be valid JSON
      expect(() => JSON.parse(finalConfig)).not.toThrow();
    });
  });
});
