import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MorphEditorTool } from '../../src/tools/morph-editor.js';
import * as fs from 'fs-extra';
import axios from 'axios';
import * as path from 'path';
import { ConfirmationService } from '../../src/utils/confirmation-service.js';

// Mock dependencies
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
  },
  pathExists: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('../../src/utils/confirmation-service.js', () => ({
  ConfirmationService: {
    getInstance: vi.fn(),
  },
}));

describe('MorphEditorTool', () => {
  let morphEditor: MorphEditorTool;
  let mockConfirmationService: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock ConfirmationService
    mockConfirmationService = {
      getSessionFlags: vi.fn().mockReturnValue({
        fileOperations: false,
        allOperations: false,
      }),
      requestConfirmation: vi.fn().mockResolvedValue({
        confirmed: true,
        feedback: null,
      }),
    };

    vi.mocked(ConfirmationService.getInstance).mockReturnValue(mockConfirmationService);

    // Initialize MorphEditorTool with test API key
    morphEditor = new MorphEditorTool('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with provided API key', () => {
      const tool = new MorphEditorTool('my-api-key');
      expect(tool.getApiKey()).toBe('my-api-key');
    });

    it('should use MORPH_API_KEY from environment if not provided', () => {
      const originalEnv = process.env.MORPH_API_KEY;
      process.env.MORPH_API_KEY = 'env-api-key';

      const tool = new MorphEditorTool();
      expect(tool.getApiKey()).toBe('env-api-key');

      process.env.MORPH_API_KEY = originalEnv;
    });

    it('should default to empty string if no API key available', () => {
      const originalEnv = process.env.MORPH_API_KEY;
      delete process.env.MORPH_API_KEY;

      const tool = new MorphEditorTool();
      expect(tool.getApiKey()).toBe('');

      process.env.MORPH_API_KEY = originalEnv;
    });

    it('should warn if MORPH_API_KEY not found', () => {
      const originalEnv = process.env.MORPH_API_KEY;
      delete process.env.MORPH_API_KEY;

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      new MorphEditorTool();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'MORPH_API_KEY not found. Morph editor functionality will be limited.'
      );

      consoleWarnSpy.mockRestore();
      process.env.MORPH_API_KEY = originalEnv;
    });
  });

  describe('setApiKey and getApiKey', () => {
    it('should set and get API key correctly', () => {
      morphEditor.setApiKey('new-key');
      expect(morphEditor.getApiKey()).toBe('new-key');
    });

    it('should update API key dynamically', () => {
      expect(morphEditor.getApiKey()).toBe('test-api-key');
      morphEditor.setApiKey('updated-key');
      expect(morphEditor.getApiKey()).toBe('updated-key');
    });
  });

  describe('view', () => {
    it('should view file contents successfully', async () => {
      const mockContent = 'line1\nline2\nline3';
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      const result = await morphEditor.view('test.txt');

      expect(result.success).toBe(true);
      expect(result.output).toContain('test.txt');
      expect(result.output).toContain('1: line1');
      expect(result.output).toContain('2: line2');
    });

    it('should view directory contents', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.readdir).mockResolvedValue(['file1.txt', 'file2.js'] as any);

      const result = await morphEditor.view('testdir');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Directory contents');
      expect(result.output).toContain('file1.txt');
      expect(result.output).toContain('file2.js');
    });

    it('should view specific line range', async () => {
      const mockContent = 'line1\nline2\nline3\nline4\nline5';
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      const result = await morphEditor.view('test.txt', [2, 4]);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Lines 2-4');
      expect(result.output).toContain('2: line2');
      expect(result.output).toContain('4: line4');
      expect(result.output).not.toContain('1: line1');
      expect(result.output).not.toContain('5: line5');
    });

    it('should truncate long file preview', async () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`);
      const mockContent = lines.join('\n');
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      const result = await morphEditor.view('test.txt');

      expect(result.success).toBe(true);
      expect(result.output).toContain('1: line1');
      expect(result.output).toContain('10: line10');
      expect(result.output).toContain('+10 lines');
    });

    it('should return error if file not found', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(false);

      const result = await morphEditor.view('nonexistent.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File or directory not found');
    });

    it('should handle read errors gracefully', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockRejectedValue(new Error('Permission denied'));

      const result = await morphEditor.view('forbidden.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Error viewing');
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('editFile', () => {
    const testFilePath = '/test/file.ts';
    const initialCode = 'function test() {\n  return 1;\n}';
    const mergedCode = 'function test() {\n  return 2;\n}';

    beforeEach(() => {
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockResolvedValue(initialCode);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it('should successfully edit file with Morph API', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: mergedCode,
              },
            },
          ],
        },
      });

      const result = await morphEditor.editFile(
        testFilePath,
        'Change return value to 2',
        'return 2;'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Updated');
      expect(vi.mocked(axios.post)).toHaveBeenCalledWith(
        'https://api.morphllm.com/v1/chat/completions',
        expect.objectContaining({
          model: 'morph-v3-large',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Change return value to 2'),
            }),
          ]),
        }),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should return error if file not found', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(false);

      const result = await morphEditor.editFile(
        testFilePath,
        'Some instruction',
        'some code'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should return error if MORPH_API_KEY not configured', async () => {
      // Save and clear environment variable
      const originalKey = process.env.MORPH_API_KEY;
      delete process.env.MORPH_API_KEY;

      // Create a new editor with no API key
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const editorNoKey = new MorphEditorTool();
      consoleWarnSpy.mockRestore();

      // Verify API key is empty
      expect(editorNoKey.getApiKey()).toBe('');

      // Mock only pathExists
      vi.mocked(fs.pathExists).mockResolvedValue(true);

      const result = await editorNoKey.editFile(
        testFilePath,
        'Some instruction',
        'some code'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('MORPH_API_KEY not configured');

      // Restore environment
      if (originalKey) process.env.MORPH_API_KEY = originalKey;
    });

    it('should request user confirmation when not auto-approved', async () => {
      mockConfirmationService.getSessionFlags.mockReturnValue({
        fileOperations: false,
        allOperations: false,
      });

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          choices: [{ message: { content: mergedCode } }],
        },
      });

      await morphEditor.editFile(
        testFilePath,
        'Test instruction',
        'test code'
      );

      expect(mockConfirmationService.requestConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'Edit file with Morph Fast Apply',
          filename: testFilePath,
        }),
        'file'
      );
    });

    it('should skip confirmation when fileOperations flag is set', async () => {
      mockConfirmationService.getSessionFlags.mockReturnValue({
        fileOperations: true,
        allOperations: false,
      });

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          choices: [{ message: { content: mergedCode } }],
        },
      });

      await morphEditor.editFile(
        testFilePath,
        'Test instruction',
        'test code'
      );

      expect(mockConfirmationService.requestConfirmation).not.toHaveBeenCalled();
    });

    it('should skip confirmation when allOperations flag is set', async () => {
      mockConfirmationService.getSessionFlags.mockReturnValue({
        fileOperations: false,
        allOperations: true,
      });

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          choices: [{ message: { content: mergedCode } }],
        },
      });

      await morphEditor.editFile(
        testFilePath,
        'Test instruction',
        'test code'
      );

      expect(mockConfirmationService.requestConfirmation).not.toHaveBeenCalled();
    });

    it('should cancel if user rejects confirmation', async () => {
      mockConfirmationService.requestConfirmation.mockResolvedValue({
        confirmed: false,
        feedback: 'User cancelled',
      });

      const result = await morphEditor.editFile(
        testFilePath,
        'Test instruction',
        'test code'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('User cancelled');
      expect(vi.mocked(axios.post)).not.toHaveBeenCalled();
    });

    it('should handle Morph API errors gracefully', async () => {
      vi.mocked(axios.post).mockRejectedValue({
        response: {
          status: 429,
          data: 'Rate limit exceeded',
        },
      });

      const result = await morphEditor.editFile(
        testFilePath,
        'Test instruction',
        'test code'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Morph API error');
      expect(result.error).toContain('429');
    });

    it('should handle network errors', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Network error'));

      const result = await morphEditor.editFile(
        testFilePath,
        'Test instruction',
        'test code'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Error editing');
      expect(result.error).toContain('Network error');
    });

    it('should handle invalid API response format', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: {
          // Missing choices array
        },
      });

      const result = await morphEditor.editFile(
        testFilePath,
        'Test instruction',
        'test code'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response format');
    });

    it('should write merged code to file', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: {
          choices: [{ message: { content: mergedCode } }],
        },
      });

      await morphEditor.editFile(
        testFilePath,
        'Test instruction',
        'test code'
      );

      expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
        path.resolve(testFilePath),
        mergedCode,
        'utf-8'
      );
    });

    it('should generate diff showing changes', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: {
          choices: [{ message: { content: mergedCode } }],
        },
      });

      const result = await morphEditor.editFile(
        testFilePath,
        'Change return value',
        'return 2;'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Updated');
      expect(result.output).toContain('---');
      expect(result.output).toContain('+++');
      expect(result.output).toContain('-'); // Deletions
      expect(result.output).toContain('+'); // Additions
    });
  });

  describe('generateDiff (via editFile)', () => {
    beforeEach(() => {
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it('should show additions', async () => {
      const initialCode = 'line1\nline2';
      const mergedCode = 'line1\nline2\nline3';

      vi.mocked(fs.readFile).mockResolvedValue(initialCode);
      vi.mocked(axios.post).mockResolvedValue({
        data: { choices: [{ message: { content: mergedCode } }] },
      });

      const result = await morphEditor.editFile(
        'test.txt',
        'Add line3',
        'line3'
      );

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/1 addition/);
      expect(result.output).toContain('+line3');
    });

    it('should show removals', async () => {
      const initialCode = 'line1\nline2\nline3';
      const mergedCode = 'line1\nline3';

      vi.mocked(fs.readFile).mockResolvedValue(initialCode);
      vi.mocked(axios.post).mockResolvedValue({
        data: { choices: [{ message: { content: mergedCode } }] },
      });

      const result = await morphEditor.editFile(
        'test.txt',
        'Remove line2',
        ''
      );

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/removal/);
      expect(result.output).toContain('-line2');
    });

    it('should show both additions and removals', async () => {
      const initialCode = 'line1\nline2\nline3';
      const mergedCode = 'line1\nline2-modified\nline3\nline4';

      vi.mocked(fs.readFile).mockResolvedValue(initialCode);
      vi.mocked(axios.post).mockResolvedValue({
        data: { choices: [{ message: { content: mergedCode } }] },
      });

      const result = await morphEditor.editFile(
        'test.txt',
        'Modify and add',
        ''
      );

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/addition/);
      expect(result.output).toMatch(/removal/);
    });

    it('should handle no changes', async () => {
      const sameCode = 'line1\nline2\nline3';

      vi.mocked(fs.readFile).mockResolvedValue(sameCode);
      vi.mocked(axios.post).mockResolvedValue({
        data: { choices: [{ message: { content: sameCode } }] },
      });

      const result = await morphEditor.editFile(
        'test.txt',
        'No change',
        ''
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('No changes applied');
    });

    it('should use plural form correctly', async () => {
      const initialCode = 'line1';
      const mergedCode = 'line1\nline2\nline3';

      vi.mocked(fs.readFile).mockResolvedValue(initialCode);
      vi.mocked(axios.post).mockResolvedValue({
        data: { choices: [{ message: { content: mergedCode } }] },
      });

      const result = await morphEditor.editFile(
        'test.txt',
        'Add lines',
        ''
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('2 additions'); // plural
    });

    it('should use singular form for single change', async () => {
      const initialCode = 'line1';
      const mergedCode = 'line1\nline2';

      vi.mocked(fs.readFile).mockResolvedValue(initialCode);
      vi.mocked(axios.post).mockResolvedValue({
        data: { choices: [{ message: { content: mergedCode } }] },
      });

      const result = await morphEditor.editFile(
        'test.txt',
        'Add line',
        ''
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('1 addition'); // singular
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file content', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
      vi.mocked(fs.readFile).mockResolvedValue('');

      const result = await morphEditor.view('empty.txt');

      expect(result.success).toBe(true);
      expect(result.output).toContain('empty.txt');
    });

    it('should handle special characters in file path', async () => {
      const specialPath = '/path/with spaces/and-special@chars.txt';
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
      vi.mocked(fs.readFile).mockResolvedValue('content');

      const result = await morphEditor.view(specialPath);

      expect(result.success).toBe(true);
      expect(vi.mocked(fs.pathExists)).toHaveBeenCalledWith(path.resolve(specialPath));
    });

    it('should handle Unicode content in files', async () => {
      const unicodeContent = '你好世界\n👍🏽\n🚀';
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
      vi.mocked(fs.readFile).mockResolvedValue(unicodeContent);

      const result = await morphEditor.view('unicode.txt');

      expect(result.success).toBe(true);
      expect(result.output).toContain('👍🏽');
    });

    it('should handle large instructions and code edits', async () => {
      const largeInstruction = 'A'.repeat(10000);
      const largeCode = 'B'.repeat(10000);

      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockResolvedValue('initial');
      vi.mocked(axios.post).mockResolvedValue({
        data: { choices: [{ message: { content: 'merged' } }] },
      });

      const result = await morphEditor.editFile(
        'test.txt',
        largeInstruction,
        largeCode
      );

      expect(vi.mocked(axios.post)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining(largeInstruction),
            }),
          ]),
        }),
        expect.any(Object)
      );
    });

    it('should resolve relative paths to absolute', async () => {
      const relativePath = './relative/path/file.txt';
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
      vi.mocked(fs.readFile).mockResolvedValue('content');

      await morphEditor.view(relativePath);

      expect(vi.mocked(fs.pathExists)).toHaveBeenCalledWith(
        path.resolve(relativePath)
      );
    });
  });

  describe('API Integration', () => {
    it('should send correct payload to Morph API', async () => {
      const testFile = 'test.ts';
      const initialCode = 'const x = 1;';
      const instruction = 'Change x to 2';
      const codeEdit = 'const x = 2;';

      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockResolvedValue(initialCode);
      vi.mocked(axios.post).mockResolvedValue({
        data: { choices: [{ message: { content: 'const x = 2;' } }] },
      });

      await morphEditor.editFile(testFile, instruction, codeEdit);

      expect(vi.mocked(axios.post)).toHaveBeenCalledWith(
        'https://api.morphllm.com/v1/chat/completions',
        {
          model: 'morph-v3-large',
          messages: [
            {
              role: 'user',
              content: `<instruction>${instruction}</instruction>\n<code>${initialCode}</code>\n<update>${codeEdit}</update>`,
            },
          ],
        },
        {
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should use correct Morph API base URL', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockResolvedValue('code');
      vi.mocked(axios.post).mockResolvedValue({
        data: { choices: [{ message: { content: 'new code' } }] },
      });

      await morphEditor.editFile('test.ts', 'instr', 'edit');

      expect(vi.mocked(axios.post)).toHaveBeenCalledWith(
        expect.stringContaining('https://api.morphllm.com/v1'),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should include Authorization header with Bearer token', async () => {
      const customKey = 'custom-test-key';
      const editor = new MorphEditorTool(customKey);

      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.readFile).mockResolvedValue('code');
      vi.mocked(axios.post).mockResolvedValue({
        data: { choices: [{ message: { content: 'new code' } }] },
      });

      await editor.editFile('test.ts', 'instr', 'edit');

      expect(vi.mocked(axios.post)).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${customKey}`,
          }),
        })
      );
    });
  });
});
