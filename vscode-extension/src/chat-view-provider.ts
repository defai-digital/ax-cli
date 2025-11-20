import * as vscode from 'vscode';
import { CLIBridge, CLIRequest, CLIResponse, CLIError } from './cli-bridge';
import { EditorContext } from './context-provider';

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

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly cliBridge: CLIBridge
  ) {}

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
      }
    });
  }

  public sendMessage(prompt: string, context?: EditorContext) {
    this.handleUserMessage(prompt, context);
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

      // Send to CLI
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
    this.updateWebview();
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
