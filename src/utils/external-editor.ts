/**
 * External Editor Integration (Phase 2: P2.3)
 *
 * Opens user's preferred $EDITOR to compose or edit messages.
 * Supports safety checks and temporary file cleanup.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

/**
 * Result of external editor operation
 */
export interface ExternalEditorResult {
  success: boolean;
  content?: string;
  error?: string;
  cancelled?: boolean;
}

/**
 * Options for opening external editor
 */
export interface ExternalEditorOptions {
  initialContent?: string;
  editor?: string; // Override $EDITOR
  fileExtension?: string; // Default: .txt
  timeout?: number; // Default: 5 minutes
}

/**
 * Get the preferred editor from environment
 * Falls back to sensible defaults based on platform
 */
export function getPreferredEditor(): string {
  // Check environment variables in order of preference
  const editor =
    process.env.VISUAL ||
    process.env.EDITOR ||
    process.env.GIT_EDITOR;

  if (editor) {
    return editor;
  }

  // Platform-specific defaults
  const platform = process.platform;

  if (platform === 'win32') {
    return 'notepad';
  } else if (platform === 'darwin') {
    // macOS - check for common editors
    if (existsSync('/usr/bin/nano')) return 'nano';
    if (existsSync('/usr/bin/vim')) return 'vim';
    return 'vi'; // Fallback
  } else {
    // Linux/Unix - prefer nano for better UX
    if (existsSync('/usr/bin/nano')) return 'nano';
    if (existsSync('/usr/bin/vim')) return 'vim';
    return 'vi'; // Fallback
  }
}

/**
 * Generate temporary file path for editor
 */
function getTempFilePath(extension: string = '.txt'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return join(tmpdir(), `ax-cli-editor-${timestamp}-${random}${extension}`);
}

/**
 * Open external editor and return edited content
 *
 * @param options Editor options
 * @returns Result containing edited content or error
 */
export async function openExternalEditor(
  options: ExternalEditorOptions = {}
): Promise<ExternalEditorResult> {
  const {
    initialContent = '',
    editor = getPreferredEditor(),
    fileExtension = '.txt',
    timeout = 300000, // 5 minutes default
  } = options;

  const tempFile = getTempFilePath(fileExtension);

  try {
    // Write initial content to temp file
    await writeFile(tempFile, initialContent, 'utf-8');

    // Build editor command
    // Handle editors that might have arguments (e.g., "code --wait")
    const editorCommand = `${editor} "${tempFile}"`;

    // Open editor and wait for user to close it
    try {
      await execAsync(editorCommand, {
        timeout,
      });
    } catch (error: any) {
      // Check if user cancelled (typical error code)
      if (error.code === 130 || error.signal === 'SIGINT') {
        return {
          success: false,
          cancelled: true,
          error: 'Editor cancelled by user',
        };
      }

      // Check for timeout
      if (error.killed && error.signal === 'SIGTERM') {
        return {
          success: false,
          error: `Editor timeout after ${timeout / 1000} seconds`,
        };
      }

      // Editor might return non-zero exit code but still saved file
      // Try to read the file anyway
    }

    // Read edited content
    const content = await readFile(tempFile, 'utf-8');

    // Check if content was actually changed or if user just closed editor
    if (content === initialContent) {
      return {
        success: false,
        cancelled: true,
        error: 'No changes made',
      };
    }

    // Check if file is empty (user deleted all content)
    if (content.trim() === '') {
      return {
        success: false,
        cancelled: true,
        error: 'Content is empty',
      };
    }

    return {
      success: true,
      content,
    };

  } catch (error: any) {
    return {
      success: false,
      error: `Failed to open editor: ${error.message}`,
    };
  } finally {
    // Clean up temp file
    try {
      if (existsSync(tempFile)) {
        await unlink(tempFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check if external editor is available
 *
 * @param editor Optional specific editor to check
 * @returns True if editor is available
 */
export async function isEditorAvailable(editor?: string): Promise<boolean> {
  const editorToCheck = editor || getPreferredEditor();

  try {
    // Try to get editor version/help (most editors support --version or --help)
    const command = editorToCheck.split(' ')[0]; // Get just the command name
    await execAsync(`command -v ${command}`, { timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get user-friendly editor name for display
 */
export function getEditorDisplayName(editor?: string): string {
  const editorToCheck = editor || getPreferredEditor();
  const command = editorToCheck.split(' ')[0]; // Get just the command name

  // Map common editors to friendly names
  const editorNames: Record<string, string> = {
    'vi': 'Vi',
    'vim': 'Vim',
    'nvim': 'Neovim',
    'nano': 'Nano',
    'emacs': 'Emacs',
    'code': 'VS Code',
    'subl': 'Sublime Text',
    'atom': 'Atom',
    'notepad': 'Notepad',
    'notepad++': 'Notepad++',
    'gedit': 'gedit',
    'kate': 'Kate',
  };

  return editorNames[command.toLowerCase()] || command;
}
