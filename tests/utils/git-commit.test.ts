import { access, readFile } from 'fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { commitWithMessageFile, normalizeCommitMessage } from '../../packages/core/src/utils/git-commit.js';

describe('normalizeCommitMessage', () => {
  it('removes wrapping quotes', () => {
    expect(normalizeCommitMessage('"feat: add tests"')).toBe('feat: add tests');
  });

  it('flattens newlines', () => {
    expect(normalizeCommitMessage('feat: add tests\nmore context')).toBe('feat: add tests more context');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeCommitMessage("  'fix: tighten validation'  ")).toBe('fix: tighten validation');
  });
});

describe('commitWithMessageFile', () => {
  it('commits via a temporary message file instead of embedding the message in the shell command', async () => {
    let observedPath = '';
    const executeCommand = vi.fn(async (command: string) => {
      expect(command.startsWith('git commit -F ')).toBe(true);
      expect(command.includes('feat: safe commit')).toBe(false);

      observedPath = command.slice('git commit -F '.length).replace(/^'|'$/g, '');
      const fileContents = await readFile(observedPath, 'utf8');
      expect(fileContents).toBe('feat: safe commit\n');

      return { success: true, output: 'ok' };
    });

    const result = await commitWithMessageFile(executeCommand, 'feat: safe commit');

    expect(result.result.success).toBe(true);
    expect(executeCommand).toHaveBeenCalledTimes(1);
    await expect(access(observedPath)).rejects.toThrow();
  });
});
