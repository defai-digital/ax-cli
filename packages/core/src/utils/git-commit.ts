import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

import type { ToolResult } from '../types/index.js';

function quoteBashLiteral(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function normalizeCommitMessage(message: string): string {
  const flattened = message.replace(/\r?\n/g, ' ').trim();

  if (
    flattened.length >= 2 &&
    ((flattened.startsWith('"') && flattened.endsWith('"')) ||
      (flattened.startsWith('\'') && flattened.endsWith('\'')))
  ) {
    return flattened.slice(1, -1).trim();
  }

  return flattened;
}

export async function commitWithMessageFile(
  executeCommand: (command: string) => Promise<ToolResult>,
  message: string
): Promise<{ command: string; result: ToolResult }> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'ax-cli-commit-'));
  const messageFile = path.join(tempDir, 'COMMIT_EDITMSG');
  const normalizedMessage = normalizeCommitMessage(message);

  try {
    await writeFile(messageFile, `${normalizedMessage}\n`, 'utf8');
    const command = `git commit -F ${quoteBashLiteral(messageFile)}`;
    const result = await executeCommand(command);
    return { command, result };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
