/**
 * Tests for utils/custom-instructions module
 * Tests loading custom instructions from project config directory
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

// Mock provider config
vi.mock('../../packages/core/src/provider/config.js', () => ({
  getActiveConfigPaths: vi.fn().mockReturnValue({
    DIR_NAME: '.ax-test',
  }),
}));

// Mock constants
vi.mock('../../packages/core/src/constants.js', () => ({
  FILE_NAMES: {
    CUSTOM_MD: 'CUSTOM.md',
  },
}));

import { loadCustomInstructions } from '../../packages/core/src/utils/custom-instructions.js';

describe('loadCustomInstructions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load and trim custom instructions from file', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('  Custom instructions content  \n\n');

    const result = loadCustomInstructions('/project');

    expect(result).toBe('Custom instructions content');
    expect(fs.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.ax-test'),
      'utf-8'
    );
  });

  it('should return null when file does not exist (ENOENT)', () => {
    const error = new Error('File not found') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw error;
    });

    const result = loadCustomInstructions('/project');

    expect(result).toBeNull();
  });

  it('should return null and log error for permission denied (EACCES)', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Permission denied') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw error;
    });

    const result = loadCustomInstructions('/project');

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load custom instructions:', error);
    consoleErrorSpy.mockRestore();
  });

  it('should return null and log error for other read errors', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Corrupted file');
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw error;
    });

    const result = loadCustomInstructions('/project');

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load custom instructions:', error);
    consoleErrorSpy.mockRestore();
  });

  it('should use default working directory when not specified', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('Instructions');

    const result = loadCustomInstructions();

    expect(result).toBe('Instructions');
    expect(fs.readFileSync).toHaveBeenCalled();
  });

  it('should handle empty file content', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('   \n\n\t  ');

    const result = loadCustomInstructions('/project');

    expect(result).toBe('');
  });

  it('should handle multi-line instructions', () => {
    const multiLineContent = `
# Custom Instructions

- Rule 1
- Rule 2
- Rule 3

## Additional Notes
Some notes here
`;
    vi.mocked(fs.readFileSync).mockReturnValue(multiLineContent);

    const result = loadCustomInstructions('/project');

    expect(result).toContain('# Custom Instructions');
    expect(result).toContain('- Rule 1');
    expect(result).toContain('## Additional Notes');
  });

  it('should handle non-Error throws', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw 'string error';
    });

    const result = loadCustomInstructions('/project');

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should construct correct path from working directory and config paths', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('Content');

    loadCustomInstructions('/my/project/dir');

    expect(fs.readFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/\/my\/project\/dir.*\.ax-test.*CUSTOM\.md/),
      'utf-8'
    );
  });
});
