import * as vscode from 'vscode';

export interface EditorContext {
  file?: string;
  selection?: string;
  lineRange?: string;
  gitDiff?: boolean;
  diagnostics?: vscode.Diagnostic[];
}

export class ContextProvider {
  async getCurrentFileContext(editor: vscode.TextEditor): Promise<EditorContext> {
    const config = vscode.workspace.getConfiguration('ax-cli');
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
    const config = vscode.workspace.getConfiguration('ax-cli');
    if (config.get<boolean>('autoIncludeDiagnostics', true)) {
      try {
        const allDiagnostics = vscode.languages.getDiagnostics(editor.document.uri);
        context.diagnostics = allDiagnostics.filter((diag: vscode.Diagnostic) =>
          // Guard against malformed diagnostics with missing/invalid range
          diag.range && editor.selection.contains(diag.range)
        );
      } catch (error) {
        console.warn('[ContextProvider] Failed to get diagnostics:', error);
        context.diagnostics = [];
      }
    }

    return context;
  }

  async getGitDiffContext(): Promise<EditorContext> {
    const context: EditorContext = {
      gitDiff: true,
    };

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
      const indexUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.ax-cli', 'index.json');
      const indexContent = await vscode.workspace.fs.readFile(indexUri);
      const projectInfo = JSON.parse(indexContent.toString());

      return {
        projectType: projectInfo.type,
        techStack: projectInfo.techStack,
        customInstructions: projectInfo.customInstructions,
      };
    } catch {
      // .ax-cli/index.json doesn't exist
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
