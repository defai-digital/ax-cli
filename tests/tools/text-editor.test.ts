/**
 * Tests for tools/text-editor.ts
 * Tests the TextEditorTool class for file operations
 * Focuses on input validation and error handling paths
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';

// Mock all external dependencies before importing the module
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
    ensureDir: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
}));

vi.mock('../../packages/core/src/utils/confirmation-service.js', () => ({
  ConfirmationService: {
    getInstance: vi.fn(() => ({
      shouldProceed: vi.fn().mockResolvedValue(true),
      requestConfirmation: vi.fn().mockResolvedValue({ confirmed: true }),
      getSessionFlags: vi.fn().mockReturnValue({ fileOperations: false, allOperations: false }),
    })),
  },
}));

vi.mock('../../packages/core/src/utils/path-security.js', () => ({
  validatePathSecure: vi.fn(),
}));

vi.mock('../../packages/core/src/utils/message-optimizer.js', () => ({
  getMessageOptimizer: vi.fn().mockReturnValue({
    optimizeToolOutput: vi.fn((content: string) => ({ content, wasOptimized: false })),
  }),
}));

vi.mock('../../packages/core/src/utils/safety-rules.js', () => ({
  isDestructiveFileOperation: vi.fn().mockReturnValue({ isDestructive: false, matchedOperations: [] }),
}));

vi.mock('../../packages/core/src/utils/auto-accept-logger.js', () => ({
  getAutoAcceptLogger: vi.fn().mockReturnValue({
    logFileOperation: vi.fn(),
  }),
}));

vi.mock('../../packages/core/src/utils/settings-manager.js', () => ({
  getSettingsManager: vi.fn().mockReturnValue({
    getAutoAcceptConfig: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock('../../packages/core/src/utils/error-handler.js', () => ({
  ErrorCategory: { FILE_OPERATION: 'FILE_OPERATION' },
  createToolError: vi.fn((category, operation, error) => ({
    success: false,
    error: `${operation} failed: ${error.message}`,
  })),
}));

vi.mock('../../packages/core/src/ipc/index.js', () => ({
  getVSCodeIPCClient: vi.fn().mockReturnValue({
    revealFile: vi.fn(),
  }),
}));

import fs from 'fs-extra';
import { TextEditorTool } from '../../packages/core/src/tools/text-editor.js';
import { validatePathSecure } from '../../packages/core/src/utils/path-security.js';
import { ConfirmationService } from '../../packages/core/src/utils/confirmation-service.js';

describe('TextEditorTool', () => {
  let editor: TextEditorTool;
  let mockConfirmationService: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    editor = new TextEditorTool();

    mockConfirmationService = {
      shouldProceed: vi.fn().mockResolvedValue(true),
      requestConfirmation: vi.fn().mockResolvedValue({ confirmed: true }),
      getSessionFlags: vi.fn().mockReturnValue({ fileOperations: false, allOperations: false }),
    };
    vi.mocked(ConfirmationService.getInstance).mockReturnValue(mockConfirmationService as unknown as ReturnType<typeof ConfirmationService.getInstance>);
  });

  describe('view', () => {
    it('should return error for security validation failure', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: false, error: 'Path traversal detected' });

      const result = await editor.view('../../../etc/passwd');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Security');
    });

    it('should return error for non-existent path', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: '/test/nonexistent' });
      vi.mocked(fs.pathExists).mockResolvedValue(false);

      const result = await editor.view('/test/nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should view directory contents', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: '/test/dir' });
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.readdir).mockResolvedValue(['file1.txt', 'file2.txt'] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const result = await editor.view('/test/dir');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Directory contents');
      expect(result.output).toContain('file1.txt');
    });

    it('should view file with line range', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: '/test/file.txt' });
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2\nline3\nline4\nline5');

      const result = await editor.view('/test/file.txt', [2, 4]);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Lines 2-4');
    });

    it('should return error for invalid line range (start < 1)', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: '/test/file.txt' });
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2');

      const result = await editor.view('/test/file.txt', [0, 2]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid start line');
    });

    it('should return error for invalid line range (end < start)', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: '/test/file.txt' });
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2');

      const result = await editor.view('/test/file.txt', [3, 1]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid line range');
    });

    it('should return error for start line exceeding file length', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: '/test/file.txt' });
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2');

      const result = await editor.view('/test/file.txt', [10, 15]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds file length');
    });
  });

  describe('strReplace', () => {
    it('should return error for security validation failure', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: false, error: 'Unauthorized path' });

      const result = await editor.strReplace('/etc/passwd', 'old', 'new');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Security');
    });

    it('should return error for empty search string', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: '/test/file.txt' });

      const result = await editor.strReplace('/test/file.txt', '', 'replacement');

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should return error for file not found', async () => {
      const resolvedPath = path.resolve('/test/file.txt');
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: resolvedPath });
      vi.mocked(fs.pathExists).mockResolvedValue(false);

      const result = await editor.strReplace('/test/file.txt', 'hello', 'hi');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error when string not found in file', async () => {
      const resolvedPath = path.resolve('/test/file.txt');
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: resolvedPath });
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: 12345 } as unknown as Awaited<ReturnType<typeof fs.stat>>);
      vi.mocked(fs.readFile).mockResolvedValue('hello world');

      const result = await editor.strReplace('/test/file.txt', 'notfound', 'replacement');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('create', () => {
    it('should return error for security validation failure', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: false, error: 'Unauthorized' });

      const result = await editor.create('/etc/shadow', 'content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Security');
    });

    it('should return error if file already exists', async () => {
      const resolvedPath = path.resolve('/test/existing.txt');
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: resolvedPath });
      vi.mocked(fs.pathExists).mockResolvedValue(true);

      const result = await editor.create('/test/existing.txt', 'content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('replaceLines', () => {
    it('should return error for security validation failure', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: false, error: 'Unauthorized' });

      const result = await editor.replaceLines('/etc/passwd', 1, 2, 'new');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Security');
    });

    it('should return error for file not found', async () => {
      const resolvedPath = path.resolve('/test/file.txt');
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: resolvedPath });
      vi.mocked(fs.pathExists).mockResolvedValue(false);

      const result = await editor.replaceLines('/test/file.txt', 1, 2, 'new');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error for invalid start line', async () => {
      const resolvedPath = path.resolve('/test/file.txt');
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: resolvedPath });
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2');

      const result = await editor.replaceLines('/test/file.txt', 0, 1, 'replacement');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid start line');
    });

    it('should return error for invalid end line (< start)', async () => {
      const resolvedPath = path.resolve('/test/file.txt');
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: resolvedPath });
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2');

      const result = await editor.replaceLines('/test/file.txt', 2, 1, 'replacement');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid end line');
    });

    it('should return error for end line exceeding file length', async () => {
      const resolvedPath = path.resolve('/test/file.txt');
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: resolvedPath });
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2');

      const result = await editor.replaceLines('/test/file.txt', 1, 10, 'replacement');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid end line');
    });
  });

  describe('insert', () => {
    it('should return error for security validation failure', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: false, error: 'Unauthorized' });

      const result = await editor.insert('/etc/passwd', 1, 'content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Security');
    });

    it('should return error for file not found', async () => {
      const resolvedPath = path.resolve('/test/file.txt');
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: resolvedPath });
      vi.mocked(fs.pathExists).mockResolvedValue(false);

      const result = await editor.insert('/test/file.txt', 1, 'content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error for invalid insert line (< 1)', async () => {
      const resolvedPath = path.resolve('/test/file.txt');
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: resolvedPath });
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2');

      const result = await editor.insert('/test/file.txt', 0, 'content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid insert line');
    });

    it('should return error for insert line exceeding file length + 1', async () => {
      const resolvedPath = path.resolve('/test/file.txt');
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: resolvedPath });
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockResolvedValue('line1\nline2');

      const result = await editor.insert('/test/file.txt', 10, 'content');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid insert line');
    });
  });

  describe('multiEdit', () => {
    it('should return error for security validation failure', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: false, error: 'Unauthorized' });

      const result = await editor.multiEdit('/etc/passwd', [{ old_str: 'a', new_str: 'b' }]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Security');
    });

    it('should return error when no edits provided', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: '/test/file.txt' });

      const result = await editor.multiEdit('/test/file.txt', []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No edits');
    });

    it('should return error when edit has empty old_str', async () => {
      vi.mocked(validatePathSecure).mockResolvedValue({ success: true, path: '/test/file.txt' });

      const result = await editor.multiEdit('/test/file.txt', [
        { old_str: '', new_str: 'replacement' },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('old_str cannot be empty');
    });
  });

  describe('undoEdit', () => {
    it('should return error when no edits to undo', async () => {
      const result = await editor.undoEdit();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No edits to undo');
    });
  });

  describe('getEditHistory', () => {
    it('should return empty array initially', () => {
      const history = editor.getEditHistory();
      expect(history).toEqual([]);
    });
  });

  describe('setCheckpointCallback', () => {
    it('should accept checkpoint callback without error', () => {
      const callback = vi.fn();
      expect(() => editor.setCheckpointCallback(callback)).not.toThrow();
    });
  });
});
