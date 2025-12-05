import * as vscode from 'vscode';
import { CLIBridgeSDK } from './cli-bridge-sdk.js'; // Use SDK instead of CLI spawning!
import { ChatViewProvider } from './chat-view-provider.js';
import { ContextProvider } from './context-provider.js';
import { StatusBarManager } from './status-bar.js';
import { IPCServer, DiffPayload, TaskSummaryPayload, StreamChunkPayload, FileRevealPayload } from './ipc-server.js';
import { initializeSecretStorage, SecretStorageService } from './secret-storage.js';

let cliBridge: CLIBridgeSDK | undefined;
let chatProvider: ChatViewProvider | undefined;
let contextProvider: ContextProvider | undefined;
let statusBar: StatusBarManager | undefined;
let ipcServer: IPCServer | undefined;
let diffContentProvider: DiffContentProvider | undefined;
let secretStorage: SecretStorageService | undefined;

export async function activate(context: vscode.ExtensionContext) {
  console.log('AX CLI extension is now active (SDK mode with diff preview)');

  // Initialize secret storage for secure API key management
  secretStorage = initializeSecretStorage(context);

  // Migrate any existing plaintext API key to SecretStorage
  // Wrap in try-catch to prevent extension activation failure
  try {
    const migrated = await secretStorage.migrateFromPlaintextSettings();
    if (migrated) {
      vscode.window.showInformationMessage(
        'AX CLI: Your API key has been migrated to secure storage.'
      );
    }
  } catch (error) {
    // Log error but continue activation - secret storage migration is not critical
    console.error('[AX] Failed to migrate API key to secret storage:', error);
  }

  // Initialize components with SDK bridge (Claude Code-like integration)
  cliBridge = new CLIBridgeSDK(secretStorage);
  contextProvider = new ContextProvider();
  statusBar = new StatusBarManager();
  chatProvider = new ChatViewProvider(context.extensionUri, cliBridge);

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider)
  );

  // Register commands
  registerCommands(context);

  // Show status bar
  statusBar.show();

  // Register singleton diff content provider
  diffContentProvider = new DiffContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('ax-cli-diff', diffContentProvider),
    diffContentProvider  // Add to subscriptions for proper disposal
  );

  // Start IPC server for CLI communication
  startIPCServer(context);
}

/**
 * Start the IPC server for communication with terminal CLI
 */
async function startIPCServer(context: vscode.ExtensionContext) {
  ipcServer = new IPCServer();

  // Set up diff preview handler - shows diff in VS Code and waits for approval
  ipcServer.setDiffPreviewHandler(async (payload: DiffPayload): Promise<boolean> => {
    return await showDiffPreview(payload);
  });

  // Set up task complete handler - shows summary popup
  ipcServer.setTaskCompleteHandler((payload: TaskSummaryPayload) => {
    showTaskSummary(payload);
  });

  // Set up status update handler
  ipcServer.setStatusUpdateHandler((status: string) => {
    statusBar?.updateStatus(status);
  });

  // Set up stream chunk handler - forwards streaming to chat panel
  ipcServer.setStreamChunkHandler((payload: StreamChunkPayload) => {
    chatProvider?.handleStreamChunk(payload);
  });

  // Set up file reveal handler - opens files in VS Code after writing (like Claude Code)
  ipcServer.setFileRevealHandler((payload: FileRevealPayload) => {
    revealFileInEditor(payload);
  });

  try {
    await ipcServer.start();
    console.log(`[AX] IPC server started on port ${ipcServer.getPort()}`);
  } catch (error) {
    console.error('[AX] Failed to start IPC server:', error);
    vscode.window.showWarningMessage('AX CLI: Failed to start IPC server for terminal integration');
  }

  context.subscriptions.push({
    dispose: () => {
      ipcServer?.dispose();
    }
  });
}

/**
 * Show diff preview in VS Code and wait for user approval
 */
async function showDiffPreview(payload: DiffPayload): Promise<boolean> {
  // Use path module to handle both Windows and Unix paths
  const path = await import('path');
  const fileName = path.basename(payload.file) || payload.file;

  if (!diffContentProvider) {
    // Fallback: auto-approve if provider not initialized
    console.warn('[AX] Diff content provider not initialized, auto-approving');
    return true;
  }

  // Store content in singleton provider keyed by diff ID
  diffContentProvider.setContent(payload.id, payload.oldContent, payload.newContent);

  // Create URIs for diff view
  const originalUri = vscode.Uri.parse(`ax-cli-diff:${encodeURIComponent(payload.file)}?type=original&id=${payload.id}`);
  const modifiedUri = vscode.Uri.parse(`ax-cli-diff:${encodeURIComponent(payload.file)}?type=modified&id=${payload.id}`);

  try {
    // Show the diff view
    await vscode.commands.executeCommand('vscode.diff',
      originalUri,
      modifiedUri,
      `AX CLI: ${payload.toolCall.command} - ${fileName}`
    );

    // Show approval buttons
    const result = await vscode.window.showInformationMessage(
      `AX CLI wants to ${payload.operation} "${fileName}"`,
      { modal: false },
      'Accept',
      'Reject',
      'View Details'
    );

    let approved = false;
    if (result === 'View Details') {
      // Show more details and ask again
      const detailResult = await vscode.window.showInformationMessage(
        `Operation: ${payload.toolCall.command}\nFile: ${payload.file}\n\nAccept this change?`,
        { modal: true },
        'Accept',
        'Reject'
      );
      approved = detailResult === 'Accept';
    } else {
      approved = result === 'Accept';
    }

    // Note: We intentionally don't auto-close the diff editor tab.
    // The user may have switched to another tab while reviewing, and
    // closing the "active" editor would close the wrong tab.
    // Users can manually close the diff tab when done reviewing.

    return approved;
  } finally {
    // Clean up stored content after approval/rejection
    diffContentProvider.removeContent(payload.id);
  }
}

/**
 * Show task completion summary
 */
function showTaskSummary(payload: TaskSummaryPayload) {
  const filesChanged = payload.changes.filesModified.length +
                       payload.changes.filesCreated.length +
                       payload.changes.filesDeleted.length;

  const statusIcon = payload.status === 'completed' ? '✅' :
                     payload.status === 'partial' ? '⚠️' : '❌';

  const duration = (payload.duration / 1000).toFixed(1);

  const message = `${statusIcon} Task ${payload.status}: ${filesChanged} file(s) changed, +${payload.changes.totalLinesAdded}/-${payload.changes.totalLinesRemoved} lines (${duration}s)`;

  // Show notification with option to see details
  // Use void to explicitly ignore the promise result (VS Code's Thenable doesn't have catch)
  void vscode.window.showInformationMessage(
    message,
    'Show Details'
  ).then(selection => {
    if (selection === 'Show Details') {
      showTaskSummaryPanel(payload);
    }
  });
}

/**
 * Show detailed task summary in a webview panel
 */
function showTaskSummaryPanel(payload: TaskSummaryPayload) {
  const panel = vscode.window.createWebviewPanel(
    'axTaskSummary',
    'AX CLI Task Summary',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = getTaskSummaryHtml(payload);
}

/**
 * Reveal/open a file in VS Code editor after it's been written.
 * This provides the same UX as Claude Code showing files in the IDE.
 */
async function revealFileInEditor(payload: FileRevealPayload): Promise<void> {
  try {
    const uri = vscode.Uri.file(payload.file);

    // Check if file exists
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      console.warn(`[AX] File not found for reveal: ${payload.file}`);
      return;
    }

    // Open the file in editor
    const document = await vscode.workspace.openTextDocument(uri);
    const options: vscode.TextDocumentShowOptions = {
      preview: payload.preview ?? true,  // Open in preview tab by default
      preserveFocus: !(payload.focus ?? true),  // Focus the editor by default
    };

    await vscode.window.showTextDocument(document, options);

    // Also reveal in explorer if it's a newly created file
    if (payload.operation === 'create') {
      vscode.commands.executeCommand('revealInExplorer', uri);
    }

    console.log(`[AX] Revealed file: ${payload.file}`);
  } catch (error) {
    console.error(`[AX] Failed to reveal file ${payload.file}:`, error);
  }
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate HTML for task summary panel
 */
function getTaskSummaryHtml(payload: TaskSummaryPayload): string {
  const statusColor = payload.status === 'completed' ? '#4caf50' :
                      payload.status === 'partial' ? '#ff9800' : '#f44336';

  const filesSection = [
    ...payload.changes.filesCreated.map(f => `<li class="created">+ ${escapeHtml(f)}</li>`),
    ...payload.changes.filesModified.map(f => `<li class="modified">~ ${escapeHtml(f)}</li>`),
    ...payload.changes.filesDeleted.map(f => `<li class="deleted">- ${escapeHtml(f)}</li>`)
  ].join('');

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; }
    h1 { color: var(--vscode-foreground); }
    .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      background: ${statusColor};
      color: white;
      font-weight: bold;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin: 20px 0;
    }
    .stat {
      background: var(--vscode-editor-background);
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { color: var(--vscode-descriptionForeground); }
    ul { list-style: none; padding: 0; }
    li { padding: 4px 8px; margin: 4px 0; border-radius: 4px; }
    .created { background: rgba(76, 175, 80, 0.2); }
    .modified { background: rgba(33, 150, 243, 0.2); }
    .deleted { background: rgba(244, 67, 54, 0.2); }
    .section { margin: 20px 0; }
    .section-title { font-weight: bold; margin-bottom: 8px; }
  </style>
</head>
<body>
  <h1>Task Summary</h1>
  <p><span class="status">${escapeHtml(payload.status.toUpperCase())}</span></p>
  <p>${escapeHtml(payload.description)}</p>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${payload.changes.filesModified.length + payload.changes.filesCreated.length + payload.changes.filesDeleted.length}</div>
      <div class="stat-label">Files Changed</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: #4caf50">+${payload.changes.totalLinesAdded}</div>
      <div class="stat-label">Lines Added</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: #f44336">-${payload.changes.totalLinesRemoved}</div>
      <div class="stat-label">Lines Removed</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Files Changed</div>
    <ul>${filesSection || '<li>No files changed</li>'}</ul>
  </div>

  <div class="section">
    <div class="section-title">Usage</div>
    <p>Tokens: ${payload.usage.inputTokens.toLocaleString()} in / ${payload.usage.outputTokens.toLocaleString()} out</p>
    <p>Tool calls: ${payload.usage.toolCalls}</p>
    <p>Duration: ${(payload.duration / 1000).toFixed(1)}s</p>
  </div>

  ${payload.errors?.length ? `
  <div class="section">
    <div class="section-title" style="color: #f44336">Errors</div>
    <ul>${payload.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
  </div>
  ` : ''}

  ${payload.warnings?.length ? `
  <div class="section">
    <div class="section-title" style="color: #ff9800">Warnings</div>
    <ul>${payload.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
  </div>
  ` : ''}
</body>
</html>`;
}

/**
 * Content provider for diff view - singleton that handles multiple concurrent diffs
 * Implements vscode.Disposable for proper resource cleanup
 */
class DiffContentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private contents: Map<string, { original: string; modified: string; timestamp: number }> = new Map();
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  // Maximum age for diff content (10 minutes) - after this, stale entries are cleaned up
  private static readonly MAX_AGE_MS = 10 * 60 * 1000;
  // Maximum number of entries to prevent unbounded growth
  private static readonly MAX_ENTRIES = 50;
  // Cleanup interval (every 2 minutes)
  private static readonly CLEANUP_INTERVAL_MS = 2 * 60 * 1000;

  constructor() {
    // Start periodic cleanup to remove stale entries
    this.cleanupIntervalId = setInterval(() => this.cleanupStaleEntries(), DiffContentProvider.CLEANUP_INTERVAL_MS);
  }

  setContent(id: string, original: string, modified: string): void {
    // Enforce max entries limit by removing oldest entries if needed
    if (this.contents.size >= DiffContentProvider.MAX_ENTRIES) {
      this.removeOldestEntry();
    }
    this.contents.set(id, { original, modified, timestamp: Date.now() });
  }

  removeContent(id: string): void {
    this.contents.delete(id);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    const params = new URLSearchParams(uri.query);
    const type = params.get('type');
    const id = params.get('id');

    if (!id) {
      return '';
    }

    const content = this.contents.get(id);
    if (!content) {
      return '';
    }

    return type === 'original' ? content.original : content.modified;
  }

  /**
   * Remove entries older than MAX_AGE_MS
   */
  private cleanupStaleEntries(): void {
    const now = Date.now();
    const staleIds: string[] = [];

    for (const [id, entry] of this.contents) {
      if (now - entry.timestamp > DiffContentProvider.MAX_AGE_MS) {
        staleIds.push(id);
      }
    }

    for (const id of staleIds) {
      this.contents.delete(id);
    }

    if (staleIds.length > 0) {
      console.log(`[AX] Cleaned up ${staleIds.length} stale diff entries`);
    }
  }

  /**
   * Remove the oldest entry to make room for new ones
   */
  private removeOldestEntry(): void {
    let oldestId: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [id, entry] of this.contents) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.contents.delete(oldestId);
      console.log(`[AX] Removed oldest diff entry to make room: ${oldestId}`);
    }
  }

  /**
   * Dispose resources - stops cleanup timer and clears content
   */
  dispose(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    this.contents.clear();
  }
}

/**
 * Helper to safely get context provider with proper error handling
 * Returns undefined and shows error message if not initialized
 */
function getContextProviderSafe(): ContextProvider | undefined {
  if (!contextProvider) {
    vscode.window.showErrorMessage('AX CLI: Extension not fully initialized. Please try again.');
    return undefined;
  }
  return contextProvider;
}

function registerCommands(context: vscode.ExtensionContext) {
  // Open chat command
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.openChat', () => {
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Analyze current file
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.analyzeFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const provider = getContextProviderSafe();
      if (!provider) return;

      const ctx = await provider.getCurrentFileContext(editor);
      chatProvider?.sendMessage('Analyze this file and suggest improvements', ctx);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Explain selection
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.explainSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('No text selected');
        return;
      }

      const provider = getContextProviderSafe();
      if (!provider) return;

      const ctx = await provider.getSelectionContext(editor);
      chatProvider?.sendMessage('Explain this code in detail', ctx);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Generate tests
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.generateTests', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const provider = getContextProviderSafe();
      if (!provider) return;

      const ctx = await provider.getCurrentFileContext(editor);
      chatProvider?.sendMessage('Generate comprehensive unit tests for this file', ctx);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Refactor selection
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.refactorSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('No text selected');
        return;
      }

      const provider = getContextProviderSafe();
      if (!provider) return;

      const ctx = await provider.getSelectionContext(editor);
      chatProvider?.sendMessage('Suggest refactorings to improve code quality', ctx);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Document code
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.documentCode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('No text selected');
        return;
      }

      const provider = getContextProviderSafe();
      if (!provider) return;

      const ctx = await provider.getSelectionContext(editor);
      chatProvider?.sendMessage('Generate documentation for this code', ctx);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Find bugs
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.findBugs', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const provider = getContextProviderSafe();
      if (!provider) return;

      const ctx = await provider.getCurrentFileContext(editor);
      chatProvider?.sendMessage('Analyze for potential bugs and security issues', ctx);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Review git changes
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.reviewChanges', async () => {
      const provider = getContextProviderSafe();
      if (!provider) return;

      const ctx = await provider.getGitDiffContext();
      if (!ctx.gitDiff) {
        vscode.window.showInformationMessage('No uncommitted changes found');
        return;
      }

      chatProvider?.sendMessage('Review these changes and suggest improvements', ctx);
      vscode.commands.executeCommand('ax-cli.chatView.focus');
    })
  );

  // Select model
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.selectModel', async () => {
      const models = [
        'grok-code-fast-1',
        'grok-4-latest',
        'glm-4.6',
        'claude-3-5-sonnet-20241022',
        'gpt-4o',
        'deepseek-chat',
      ];

      const selected = await vscode.window.showQuickPick(models, {
        placeHolder: 'Select AI model',
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration('ax-cli');
        await config.update('model', selected, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Model changed to: ${selected}`);
        statusBar?.updateModel(selected);
      }
    })
  );

  // Configure settings
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.configure', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'ax-cli');
    })
  );

  // Set API Key (secure storage)
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.setApiKey', async () => {
      if (secretStorage) {
        await secretStorage.promptForApiKey();
      }
    })
  );

  // Clear API Key
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.clearApiKey', async () => {
      if (secretStorage) {
        const confirm = await vscode.window.showWarningMessage(
          'Are you sure you want to remove your API key?',
          { modal: true },
          'Yes, Remove'
        );

        if (confirm === 'Yes, Remove') {
          await secretStorage.clearApiKey();
          vscode.window.showInformationMessage('API key removed');
        }
      }
    })
  );

  // Show API Key Status
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.showApiKeyStatus', async () => {
      if (secretStorage) {
        const hasKey = await secretStorage.hasApiKey();
        const masked = await secretStorage.getMaskedApiKey();

        if (hasKey) {
          const action = await vscode.window.showInformationMessage(
            `API Key: ${masked}`,
            'Change Key',
            'Remove Key'
          );

          if (action === 'Change Key') {
            await secretStorage.promptForApiKey();
          } else if (action === 'Remove Key') {
            vscode.commands.executeCommand('ax-cli.clearApiKey');
          }
        } else {
          const action = await vscode.window.showWarningMessage(
            'No API key configured',
            'Set API Key'
          );

          if (action === 'Set API Key') {
            await secretStorage.promptForApiKey();
          }
        }
      }
    })
  );
}

export function deactivate() {
  cliBridge?.dispose();
  statusBar?.dispose();
  ipcServer?.dispose();
  secretStorage?.dispose();
}
