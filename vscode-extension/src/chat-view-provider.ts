import * as vscode from 'vscode';
import * as path from 'path';
import { CLIBridgeSDK, CLIRequest, CLIResponse, CLIError, PendingChange } from './cli-bridge-sdk.js';
import { EditorContext } from './context-provider.js';
import type { StreamChunkPayload } from './ipc-server.js';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  context?: EditorContext;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ax-cli.chatView';

  private _view?: vscode.WebviewView;
  private messages: Message[] = [];
  private pendingChanges: Map<string, PendingChange> = new Map();

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly cliBridge: CLIBridgeSDK
  ) {
    // Set up diff preview handler - THIS IS THE KEY CONNECTION!
    this.cliBridge.setDiffPreviewHandler((change: PendingChange) => {
      this.showDiffPreview(change);
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data: any) => {
      switch (data.type) {
        case 'sendMessage':
          await this.handleUserMessage(data.message, data.context);
          break;

        case 'approveDiff':
          // User clicked Accept in diff viewer
          this.cliBridge.approveChange(data.changeId, true);
          this.pendingChanges.delete(data.changeId);
          this.updateWebview();
          break;

        case 'rejectDiff':
          // User clicked Reject in diff viewer
          this.cliBridge.approveChange(data.changeId, false);
          this.pendingChanges.delete(data.changeId);
          this.updateWebview();
          break;

        case 'showDiffInEditor':
          // User wants to see diff in VSCode native editor
          await this.showNativeDiff(data.changeId);
          break;

        case 'clearHistory':
          this.clearHistory();
          break;

        case 'applyCode':
          await this.applyCodeChanges(data.code, data.filePath);
          break;

        case 'copyCode':
          await vscode.env.clipboard.writeText(data.code);
          vscode.window.showInformationMessage('Code copied to clipboard');
          break;

        case 'requestFiles':
          // User is searching for files with @-mention
          await this.handleFileSearch(data.query);
          break;

        case 'selectModel':
          // User wants to change model via /model command
          vscode.commands.executeCommand('ax-cli.selectModel');
          break;

        case 'setExtendedThinking':
          // User toggled extended thinking
          this.extendedThinking = data.value;
          break;

        case 'compactHistory':
          // User wants to compact conversation history
          this.compactHistory();
          break;

        case 'addGitDiff':
          // User wants to add git diff as context
          await this.addGitDiffContext();
          break;
      }
    });
  }

  // Extended thinking state (used when sending messages)
  private _extendedThinking = false;

  private get extendedThinking(): boolean {
    return this._extendedThinking;
  }

  private set extendedThinking(value: boolean) {
    this._extendedThinking = value;
  }

  public sendMessage(prompt: string, context?: EditorContext) {
    this.handleUserMessage(prompt, context);
  }

  /**
   * Handle streaming chunk from CLI via IPC
   * Forwards to webview for real-time display
   */
  public handleStreamChunk(payload: StreamChunkPayload): void {
    if (!this._view) return;

    // Forward to webview
    this._view.webview.postMessage({
      type: 'streamChunk',
      chunk: {
        sessionId: payload.sessionId,
        type: payload.type,
        content: payload.content,
        toolCall: payload.toolCall,
        toolResult: payload.toolResult,
        error: payload.error
      }
    });

    // If this is the 'done' chunk, also update loading state
    if (payload.type === 'done' || payload.type === 'error') {
      this._view.webview.postMessage({
        type: 'loading',
        value: false
      });
    }
  }

  /**
   * Show diff preview in webview
   * Called by CLI Bridge when agent wants to modify a file
   */
  private showDiffPreview(change: PendingChange): void {
    console.log('[Chat View] Showing diff preview for:', change.file);

    this.pendingChanges.set(change.id, change);

    // Send to webview to render diff
    if (this._view) {
      this._view.webview.postMessage({
        type: 'showDiff',
        change: {
          id: change.id,
          file: change.file,
          oldContent: change.oldContent,
          newContent: change.newContent,
          command: change.command
        }
      });
    }
  }

  /**
   * Show diff in VSCode native diff viewer
   */
  private async showNativeDiff(changeId: string): Promise<void> {
    const change = this.pendingChanges.get(changeId);
    if (!change) {
      console.error('[Chat View] Change not found:', changeId);
      return;
    }

    try {
      // Create temporary URIs for diff viewer
      const originalUri = vscode.Uri.parse(`ax-cli-diff:${change.file}?original&${changeId}`);
      const modifiedUri = vscode.Uri.parse(`ax-cli-diff:${change.file}?modified&${changeId}`);

      // Register content provider
      const provider = new class implements vscode.TextDocumentContentProvider {
        provideTextDocumentContent(uri: vscode.Uri): string {
          return uri.query.includes('original') ? change.oldContent : change.newContent;
        }
      };

      const registration = vscode.workspace.registerTextDocumentContentProvider('ax-cli-diff', provider);

      // Open diff view
      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        modifiedUri,
        `${change.file} (AX CLI Proposed Changes)`,
        { preview: true }
      );

      // Show info message with action buttons
      const action = await vscode.window.showInformationMessage(
        `Review changes to ${change.file}`,
        'Accept',
        'Reject'
      );

      if (action === 'Accept') {
        this.cliBridge.approveChange(changeId, true);
        this.pendingChanges.delete(changeId);
        vscode.window.showInformationMessage(`Changes applied to ${change.file}`);
      } else if (action === 'Reject') {
        this.cliBridge.approveChange(changeId, false);
        this.pendingChanges.delete(changeId);
        vscode.window.showInformationMessage(`Changes rejected for ${change.file}`);
      }

      // Clean up after a delay
      setTimeout(() => registration.dispose(), 10000);

    } catch (error) {
      console.error('[Chat View] Error showing native diff:', error);
      vscode.window.showErrorMessage(`Failed to show diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleUserMessage(prompt: string, context?: EditorContext) {
    const userMessage: Message = {
      id: this.generateId(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
      context,
    };

    this.messages.push(userMessage);
    this.updateWebview();

    // Show loading state
    this._view?.webview.postMessage({
      type: 'loading',
      value: true,
    });

    try {
      // Build CLI request
      const request: CLIRequest = {
        id: this.generateId(),
        prompt,
        context: context ? {
          file: context.file,
          selection: context.selection,
          lineRange: context.lineRange,
          gitDiff: context.gitDiff,
        } : undefined,
      };

      // Send to CLI Bridge (will trigger diff previews automatically!)
      const response = await this.cliBridge.sendRequest(request);

      // Handle response
      if (this.isError(response)) {
        this.handleError(response);
      } else {
        this.handleSuccess(response);
      }
    } catch (error) {
      this.handleError({
        id: userMessage.id,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'UnknownError',
        },
        timestamp: new Date().toISOString(),
      });
    } finally {
      this._view?.webview.postMessage({
        type: 'loading',
        value: false,
      });
    }
  }

  private isError(response: CLIResponse | CLIError): response is CLIError {
    return 'error' in response;
  }

  private handleSuccess(response: CLIResponse) {
    // Add assistant messages from response
    for (const msg of response.messages) {
      if (msg.role === 'assistant') {
        const assistantMessage: Message = {
          id: this.generateId(),
          role: 'assistant',
          content: msg.content,
          timestamp: new Date().toISOString(),
        };
        this.messages.push(assistantMessage);
      }
    }

    this.updateWebview();
  }

  private handleError(error: CLIError) {
    const errorMessage: Message = {
      id: this.generateId(),
      role: 'system',
      content: `Error: ${error.error.message}`,
      timestamp: new Date().toISOString(),
    };

    this.messages.push(errorMessage);
    this.updateWebview();

    vscode.window.showErrorMessage(`AX CLI Error: ${error.error.message}`);
  }

  private clearHistory() {
    this.messages = [];
    this.pendingChanges.clear();
    this.updateWebview();
  }

  /**
   * Search for files in workspace matching query
   */
  private async handleFileSearch(query: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this._view?.webview.postMessage({
        type: 'filesResult',
        files: []
      });
      return;
    }

    try {
      // Search for files matching the query
      const pattern = query ? `**/*${query}*` : '**/*';
      const excludePattern = '**/node_modules/**,**/.git/**,**/dist/**,**/build/**';

      const files = await vscode.workspace.findFiles(pattern, excludePattern, 50);

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const fileList = files.map(file => {
        // Use path.relative for cross-platform compatibility (Windows/macOS/Linux)
        const relativePath = path.relative(workspaceRoot, file.fsPath);
        const name = path.basename(file.fsPath);
        return {
          path: file.fsPath,
          name,
          relativePath
        };
      });

      // Sort by relevance (exact matches first, then by path length)
      fileList.sort((a, b) => {
        const aExact = a.name.toLowerCase() === query.toLowerCase();
        const bExact = b.name.toLowerCase() === query.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return a.relativePath.length - b.relativePath.length;
      });

      this._view?.webview.postMessage({
        type: 'filesResult',
        files: fileList
      });
    } catch (error) {
      console.error('[ChatView] File search error:', error);
      this._view?.webview.postMessage({
        type: 'filesResult',
        files: []
      });
    }
  }

  /**
   * Compact conversation history by summarizing older messages
   */
  private compactHistory(): void {
    if (this.messages.length <= 10) {
      vscode.window.showInformationMessage('Conversation is already compact');
      return;
    }

    // Keep last 10 messages, summarize the rest
    const keepCount = 10;
    const oldMessages = this.messages.slice(0, -keepCount);
    const recentMessages = this.messages.slice(-keepCount);

    // Create a summary message
    const summaryMessage: Message = {
      id: this.generateId(),
      role: 'system',
      content: `[Conversation compacted: ${oldMessages.length} earlier messages summarized]`,
      timestamp: new Date().toISOString(),
    };

    this.messages = [summaryMessage, ...recentMessages];
    this.updateWebview();

    vscode.window.showInformationMessage(`Compacted ${oldMessages.length} messages`);
  }

  /**
   * Add git diff to context
   */
  private async addGitDiffContext(): Promise<void> {
    try {
      const { exec } = require('child_process');
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

      if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      exec('git diff', { cwd: workspaceFolder.uri.fsPath }, (error: Error | null, stdout: string, _stderr: string) => {
        if (error) {
          vscode.window.showWarningMessage('Failed to get git diff');
          return;
        }

        if (!stdout.trim()) {
          vscode.window.showInformationMessage('No uncommitted changes found');
          return;
        }

        // Add diff as a system message
        const diffMessage: Message = {
          id: this.generateId(),
          role: 'system',
          content: `**Git Diff (uncommitted changes):**\n\`\`\`diff\n${stdout.substring(0, 5000)}${stdout.length > 5000 ? '\n... (truncated)' : ''}\n\`\`\``,
          timestamp: new Date().toISOString(),
        };

        this.messages.push(diffMessage);
        this.updateWebview();
      });
    } catch (error) {
      console.error('[ChatView] Git diff error:', error);
      vscode.window.showWarningMessage('Failed to get git diff');
    }
  }

  private async applyCodeChanges(code: string, filePath?: string) {
    if (!filePath) {
      // Create new file
      const doc = await vscode.workspace.openTextDocument({
        content: code,
        language: 'typescript',
      });
      await vscode.window.showTextDocument(doc);
    } else {
      // Apply to existing file
      const uri = vscode.Uri.file(filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        doc.lineAt(0).range.start,
        doc.lineAt(doc.lineCount - 1).range.end
      );
      edit.replace(uri, fullRange, code);
      await vscode.workspace.applyEdit(edit);
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage('Code applied successfully');
    }
  }

  private updateWebview() {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'updateMessages',
        messages: this.messages,
      });
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get URIs for resources
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
    );
    const diffViewerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'diff-viewer.js')
    );

    // Use a nonce to only allow specific scripts to be run
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link href="${styleUri}" rel="stylesheet">
  <title>AX CLI Chat</title>
</head>
<body>
  <div id="root"></div>
  <div id="diff-container"></div>
  <script nonce="${nonce}" src="${diffViewerUri}"></script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
