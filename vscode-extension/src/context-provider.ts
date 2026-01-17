import * as vscode from 'vscode';
import { AX_CLI_DIR } from './utils.js';
import { GIT_COMMAND_TIMEOUT_MS, CONFIG_NAMESPACE } from './constants.js';

/**
 * Image attachment with optional base64 data
 */
export interface ImageAttachment {
  path: string;
  name: string;
  dataUri?: string;  // Base64 data URI for sending to LLM
  mimeType?: string;
}

/**
 * File attachment
 */
export interface FileAttachment {
  path: string;
  name: string;
  content?: string;  // File content (loaded on demand)
}

export interface EditorContext {
  file?: string;
  selection?: string;
  lineRange?: string;
  gitDiff?: boolean;
  diagnostics?: vscode.Diagnostic[];
  // New: attached files and images
  files?: FileAttachment[];
  images?: ImageAttachment[];
  // Extended thinking mode
  extendedThinking?: boolean;
}

export class ContextProvider {
  async getCurrentFileContext(editor: vscode.TextEditor): Promise<EditorContext> {
    const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    const autoIncludeFile = config.get<boolean>('autoIncludeFile', true);
    const autoIncludeDiagnostics = config.get<boolean>('autoIncludeDiagnostics', true);

    const context: EditorContext = {};

    if (autoIncludeFile) {
      context.file = editor.document.uri.fsPath;
    }

    if (autoIncludeDiagnostics) {
      try {
        context.diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
      } catch (error) {
        console.warn('[ContextProvider] Failed to get diagnostics:', error);
        context.diagnostics = [];
      }
    }

    return context;
  }

  async getSelectionContext(editor: vscode.TextEditor): Promise<EditorContext> {
    const context: EditorContext = {};

    const selection = editor.document.getText(editor.selection);
    if (selection) {
      context.selection = selection;
      context.file = editor.document.uri.fsPath;

      // Add line range
      const startLine = editor.selection.start.line + 1;
      const endLine = editor.selection.end.line + 1;
      context.lineRange = `${startLine}-${endLine}`;
    }

    // Include diagnostics for selected range
    const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    if (config.get<boolean>('autoIncludeDiagnostics', true)) {
      try {
        const allDiagnostics = vscode.languages.getDiagnostics(editor.document.uri);
        context.diagnostics = allDiagnostics.filter((diag: vscode.Diagnostic) => {
          // Guard against malformed diagnostics with missing/invalid range
          if (!diag.range) {
            return false;
          }
          try {
            return editor.selection.contains(diag.range);
          } catch {
            // selection.contains can throw if range is malformed
            return false;
          }
        });
      } catch (error) {
        console.warn('[ContextProvider] Failed to get diagnostics:', error);
        context.diagnostics = [];
      }
    }

    return context;
  }

  async getGitDiffContext(): Promise<EditorContext> {
    const context: EditorContext = {};

    // Check if there are actual git changes before setting gitDiff: true
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      try {
        // Use spawn with array arguments instead of exec with string command
        // This is safer as it doesn't invoke a shell and handles special characters in cwd
        const { spawn } = await import('child_process');

        const result = await new Promise<string>((resolve, reject) => {
          const child = spawn('git', ['diff', '--stat'], {
            cwd: workspaceFolder.uri.fsPath,
            stdio: ['ignore', 'pipe', 'pipe']
            // Note: spawn doesn't support 'timeout' option - we implement manual timeout below
          });

          let stdout = '';
          let stderr = '';
          let killed = false;

          // Manual timeout implementation since spawn doesn't support timeout option
          const timeoutId = setTimeout(() => {
            killed = true;
            child.kill('SIGTERM');
            reject(new Error(`git command timed out after ${GIT_COMMAND_TIMEOUT_MS}ms`));
          }, GIT_COMMAND_TIMEOUT_MS);

          child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
          child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

          child.on('error', (err) => {
            clearTimeout(timeoutId);
            reject(err);
          });

          child.on('close', (code) => {
            clearTimeout(timeoutId);
            if (killed) return; // Already rejected by timeout
            if (code === 0) {
              resolve(stdout);
            } else {
              reject(new Error(stderr || `git exited with code ${code}`));
            }
          });
        });

        // Only set gitDiff to true if there are actual changes
        context.gitDiff = result.trim().length > 0;
      } catch {
        // Git command failed (not a git repo, git not installed, timeout, etc.)
        context.gitDiff = false;
      }
    } else {
      context.gitDiff = false;
    }

    return context;
  }

  async getWorkspaceContext(): Promise<EditorContext> {
    const context: EditorContext = {};

    // Get all open editors
    const openEditors = vscode.window.visibleTextEditors;
    if (openEditors.length > 0) {
      // Use the active editor if available
      const activeEditor = vscode.window.activeTextEditor;
      // Guard against null document (can happen during editor transitions)
      if (activeEditor?.document) {
        context.file = activeEditor.document.uri.fsPath;
      }
    }

    return context;
  }

  async getProjectContext(): Promise<{
    projectType?: string;
    techStack?: string[];
    customInstructions?: string;
  }> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {};
    }

    try {
      // Check for .ax-cli/index.json (from ax-cli init)
      const indexUri = vscode.Uri.joinPath(workspaceFolders[0].uri, AX_CLI_DIR, 'index.json');
      const indexContent = await vscode.workspace.fs.readFile(indexUri);
      const projectInfo = JSON.parse(indexContent.toString());

      return {
        projectType: projectInfo.type,
        techStack: projectInfo.techStack,
        customInstructions: projectInfo.customInstructions,
      };
    } catch {
      // index.json doesn't exist in project config directory
      return {};
    }
  }

  formatContextForDisplay(context: EditorContext): string {
    const parts: string[] = [];

    if (context.file) {
      parts.push(`📄 File: ${context.file}`);
    }

    if (context.selection) {
      parts.push(`📝 Selection: ${context.selection.length} characters`);
    }

    if (context.lineRange) {
      parts.push(`📏 Lines: ${context.lineRange}`);
    }

    if (context.gitDiff) {
      parts.push(`🔄 Git: Uncommitted changes`);
    }

    if (context.diagnostics && context.diagnostics.length > 0) {
      const errors = context.diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
      const warnings = context.diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;
      if (errors > 0) parts.push(`❌ Errors: ${errors}`);
      if (warnings > 0) parts.push(`⚠️ Warnings: ${warnings}`);
    }

    return parts.join(' • ');
  }
}
