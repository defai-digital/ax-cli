import * as fs from 'fs';
import * as path from 'path';

export function loadCustomInstructions(workingDirectory: string = process.cwd()): string | null {
  try {
    const instructionsPath = path.join(workingDirectory, '.ax-cli', 'CUSTOM.md');

    if (!fs.existsSync(instructionsPath)) {
      return null;
    }

    const customInstructions = fs.readFileSync(instructionsPath, 'utf-8');
    return customInstructions.trim();
  } catch (error) {
    // Distinguish between expected (file not found) and unexpected errors
    const isNodeError = error instanceof Error && 'code' in error;
    const errorCode = isNodeError ? (error as NodeJS.ErrnoException).code : null;

    if (errorCode === 'ENOENT') {
      // File doesn't exist - expected, return silently
      return null;
    }

    // Permission denied, corrupted file, or other read errors - log as error
    console.error('Failed to load custom instructions:', error);
    return null;
  }
}