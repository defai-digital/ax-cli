import * as fs from 'fs';
import * as path from 'path';

export function loadCustomInstructions(workingDirectory: string = process.cwd()): string | null {
  try {
    // NEW: Try .ax-cli/CUSTOM.md first, fallback to .grok/GROK.md for backward compatibility
    const newInstructionsPath = path.join(workingDirectory, '.ax-cli', 'CUSTOM.md');
    const oldInstructionsPath = path.join(workingDirectory, '.grok', 'GROK.md');

    // Prefer new path if it exists, otherwise use old path
    let instructionsPath: string | null = null;
    if (fs.existsSync(newInstructionsPath)) {
      instructionsPath = newInstructionsPath;
    } else if (fs.existsSync(oldInstructionsPath)) {
      instructionsPath = oldInstructionsPath;
    }

    if (!instructionsPath) {
      return null;
    }

    const customInstructions = fs.readFileSync(instructionsPath, 'utf-8');
    return customInstructions.trim();
  } catch (error) {
    console.warn('Failed to load custom instructions:', error);
    return null;
  }
}