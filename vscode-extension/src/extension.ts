import * as vscode from 'vscode';
import { CLIBridgeSDK } from './cli-bridge-sdk.js';
import { ChatViewProvider } from './chat-view-provider.js';
import { ContextProvider } from './context-provider.js';
import { StatusBarManager } from './status-bar.js';
import { IPCServer, DiffPayload, TaskSummaryPayload, StreamChunkPayload, FileRevealPayload } from './ipc-server.js';
import { CheckpointManager } from './checkpoint-manager.js';
import { AutoErrorRecovery } from './auto-error-recovery.js';
import { SessionManager } from './session-manager.js';
import { HooksManager } from './hooks-manager.js';

let cliBridge: CLIBridgeSDK | undefined;
let chatProvider: ChatViewProvider | undefined;
let contextProvider: ContextProvider | undefined;
let statusBar: StatusBarManager | undefined;
let ipcServer: IPCServer | undefined;
let diffContentProvider: DiffContentProvider | undefined;
let inlineDiffDecorator: InlineDiffDecorator | undefined;
let checkpointManager: CheckpointManager | undefined;
let autoErrorRecovery: AutoErrorRecovery | undefined;
let sessionManager: SessionManager | undefined;
let hooksManager: HooksManager | undefined;

export async function activate(context: vscode.ExtensionContext) {
  console.log('AX CLI extension is now active (supports ax-grok and ax-glm)');

  // Initialize components - API keys are handled by CLI tools via env vars
  cliBridge = new CLIBridgeSDK();
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

  // Initialize inline diff decorator for accept/reject in editor
  inlineDiffDecorator = new InlineDiffDecorator();
  context.subscriptions.push(inlineDiffDecorator);

  // Initialize checkpoint manager for /rewind functionality
  checkpointManager = new CheckpointManager();
  context.subscriptions.push(checkpointManager);

  // Initialize auto-error recovery
  autoErrorRecovery = new AutoErrorRecovery();
  context.subscriptions.push(autoErrorRecovery);

  // Initialize session manager for multiple chat sessions
  sessionManager = new SessionManager();
  context.subscriptions.push(sessionManager);

  // Initialize hooks manager
  hooksManager = new HooksManager();
  context.subscriptions.push(hooksManager);

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
    // Use .unref() to prevent timer from blocking process exit
    this.cleanupIntervalId = setInterval(() => this.cleanupStaleEntries(), DiffContentProvider.CLEANUP_INTERVAL_MS);
    this.cleanupIntervalId.unref();
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

  // Select model - grouped by provider
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.selectModel', async () => {
      interface ModelOption {
        label: string;
        description: string;
        model: string;
        kind?: vscode.QuickPickItemKind;
      }

      const models: ModelOption[] = [
        // Grok models (xAI) - Grok 4 has all capabilities built-in
        { label: '$(rocket) xAI Grok', description: '', model: '', kind: vscode.QuickPickItemKind.Separator },
        { label: 'Grok 4', description: 'Most capable: reasoning, vision, search', model: 'grok-4-0709' },
        { label: 'Grok 4.1 Fast', description: 'Fast with agent tools support', model: 'grok-4.1-fast' },
        // GLM models (Z.AI)
        { label: '$(beaker) Z.AI GLM', description: '', model: '', kind: vscode.QuickPickItemKind.Separator },
        { label: 'GLM-4.6', description: 'Primary coding model', model: 'glm-4.6' },
        { label: 'GLM-4.5 Flash', description: 'Fast inference', model: 'glm-4.5-flash' },
        { label: 'GLM-Z1 Air', description: 'Lightweight thinking', model: 'glm-z1-air' },
        { label: 'GLM-Z1 AirX', description: 'Extended thinking', model: 'glm-z1-airx' },
        { label: 'GLM-Z1 Flash', description: 'Fast thinking', model: 'glm-z1-flash' },
        // Claude models (Anthropic)
        { label: '$(hubot) Anthropic Claude', description: '', model: '', kind: vscode.QuickPickItemKind.Separator },
        { label: 'Claude Sonnet 4', description: 'Latest Claude model', model: 'claude-sonnet-4-20250514' },
        { label: 'Claude 3.5 Sonnet', description: 'Balanced model', model: 'claude-3-5-sonnet-20241022' },
        // OpenAI models
        { label: '$(symbol-misc) OpenAI', description: '', model: '', kind: vscode.QuickPickItemKind.Separator },
        { label: 'GPT-4o', description: 'Flagship model', model: 'gpt-4o' },
        { label: 'GPT-4o Mini', description: 'Fast & affordable', model: 'gpt-4o-mini' },
        { label: 'o1', description: 'Reasoning model', model: 'o1' },
        { label: 'o1 Mini', description: 'Fast reasoning', model: 'o1-mini' },
        // DeepSeek models
        { label: '$(search) DeepSeek', description: '', model: '', kind: vscode.QuickPickItemKind.Separator },
        { label: 'DeepSeek Chat', description: 'Coding model', model: 'deepseek-chat' },
        { label: 'DeepSeek Reasoner', description: 'Thinking model', model: 'deepseek-reasoner' },
      ];

      const selected = await vscode.window.showQuickPick(models, {
        placeHolder: 'Select AI model',
        matchOnDescription: true,
      });

      if (selected && selected.model) {
        const config = vscode.workspace.getConfiguration('ax-cli');
        await config.update('model', selected.model, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Model changed to: ${selected.label}`);
        statusBar?.updateModel(selected.model);
      }
    })
  );

  // Configure settings
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.configure', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'ax-cli');
    })
  );

  // Set API Key - show help on how to configure via environment variables
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.setApiKey', async () => {
      const config = vscode.workspace.getConfiguration('ax-cli');
      const model = config.get<string>('model', 'grok-4-0709');

      // Determine which env var to use based on model
      let envVar = 'XAI_API_KEY';
      let provider = 'xAI Grok';
      let docsUrl = 'https://github.com/defai-digital/ax-cli/tree/main/packages/ax-grok#readme';

      if (model.startsWith('glm-')) {
        envVar = 'Z_API_KEY';
        provider = 'Z.AI GLM';
        docsUrl = 'https://github.com/defai-digital/ax-cli/tree/main/packages/ax-glm#readme';
      } else if (model.startsWith('gpt-') || model.startsWith('o1')) {
        envVar = 'OPENAI_API_KEY';
        provider = 'OpenAI';
        docsUrl = 'https://github.com/defai-digital/ax-cli#configuration';
      } else if (model.startsWith('claude-')) {
        envVar = 'ANTHROPIC_API_KEY';
        provider = 'Anthropic';
        docsUrl = 'https://github.com/defai-digital/ax-cli#configuration';
      } else if (model.startsWith('deepseek-')) {
        envVar = 'DEEPSEEK_API_KEY';
        provider = 'DeepSeek';
        docsUrl = 'https://github.com/defai-digital/ax-cli#configuration';
      }

      const selection = await vscode.window.showInformationMessage(
        `To use ${provider}, set ${envVar} in your environment.\n\n` +
        `Example: export ${envVar}=your-api-key`,
        'View Docs',
        'Copy Command'
      );

      if (selection === 'View Docs') {
        await vscode.env.openExternal(vscode.Uri.parse(docsUrl));
      } else if (selection === 'Copy Command') {
        await vscode.env.clipboard.writeText(`export ${envVar}=your-api-key`);
        vscode.window.showInformationMessage('Command copied to clipboard');
      }
    })
  );

  // Clear API Key - now just shows info
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.clearApiKey', async () => {
      vscode.window.showInformationMessage(
        'API keys are managed via environment variables. ' +
        'Unset the appropriate variable (XAI_API_KEY, Z_API_KEY, etc.) to remove access.'
      );
    })
  );

  // Show API Key Status - show env var info
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.showApiKeyStatus', async () => {
      vscode.window.showInformationMessage(
        'API keys are managed via environment variables:\n' +
        '• XAI_API_KEY for Grok models\n' +
        '• Z_API_KEY for GLM models\n' +
        '• OPENAI_API_KEY for OpenAI models\n' +
        '• ANTHROPIC_API_KEY for Claude models\n' +
        '• DEEPSEEK_API_KEY for DeepSeek models'
      );
    })
  );

  // Insert File Path - Native file picker (like Claude Code Cmd+Option+K)
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.insertFilePath', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const defaultUri = workspaceFolders?.[0]?.uri;

      const files = await vscode.window.showOpenDialog({
        canSelectMany: true,
        canSelectFolders: false,
        defaultUri,
        title: 'Select files to add as context',
        openLabel: 'Add to Chat'
      });

      if (files && files.length > 0) {
        // Send file paths to chat provider
        chatProvider?.insertFileReferences(files.map(f => f.fsPath));
        // Focus the chat view
        vscode.commands.executeCommand('ax-cli.chatView.focus');
      }
    })
  );

  // Attach Image - Open image picker and attach to chat
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.attachImage', async () => {
      const files = await vscode.window.showOpenDialog({
        canSelectMany: true,
        canSelectFolders: false,
        filters: {
          'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']
        },
        title: 'Select images to attach',
        openLabel: 'Attach'
      });

      if (files && files.length > 0) {
        // Send image paths to chat provider
        chatProvider?.attachImages(files.map(f => f.fsPath));
        // Focus the chat view
        vscode.commands.executeCommand('ax-cli.chatView.focus');
      }
    })
  );

  // Accept inline diff
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.acceptInlineDiff', async (diffId: string) => {
      if (inlineDiffDecorator) {
        await inlineDiffDecorator.acceptDiff(diffId);
      }
    })
  );

  // Reject inline diff
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.rejectInlineDiff', async (diffId: string) => {
      if (inlineDiffDecorator) {
        await inlineDiffDecorator.rejectDiff(diffId);
      }
    })
  );

  // Rewind to checkpoint
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.rewind', async () => {
      if (checkpointManager) {
        await checkpointManager.showRewindPicker();
      }
    })
  );

  // Create checkpoint manually
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.createCheckpoint', async () => {
      if (checkpointManager) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active editor');
          return;
        }

        const description = await vscode.window.showInputBox({
          prompt: 'Enter checkpoint description',
          placeHolder: 'e.g., Before refactoring'
        });

        if (description) {
          await checkpointManager.createCheckpoint([editor.document.uri.fsPath], description);
          vscode.window.showInformationMessage(`Checkpoint created: ${description}`);
        }
      }
    })
  );

  // Auto-fix errors
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.autoFixErrors', async () => {
      if (autoErrorRecovery) {
        const errors = autoErrorRecovery.getAllErrors();
        if (errors.length === 0) {
          vscode.window.showInformationMessage('No errors to fix');
          return;
        }

        // Format errors and send to chat for fixing
        const errorSummary = autoErrorRecovery.formatErrors(errors);

        vscode.window.showInformationMessage(`Found ${errors.length} error(s). Sending to AI for analysis...`);

        // Send to chat provider
        chatProvider?.sendMessage(`Fix these errors:\n\n${errorSummary}`);
        vscode.commands.executeCommand('ax-cli.chatView.focus');
      }
    })
  );

  // Session management
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.newSession', () => {
      if (sessionManager) {
        const session = sessionManager.createSession();
        chatProvider?.setSession(session);
        vscode.window.showInformationMessage(`New session: ${session.name}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.switchSession', async () => {
      if (sessionManager) {
        const session = await sessionManager.showSessionPicker();
        if (session) {
          chatProvider?.setSession(session);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.manageSessions', async () => {
      if (sessionManager) {
        await sessionManager.showSessionMenu();
      }
    })
  );

  // Hooks management
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.manageHooks', async () => {
      if (hooksManager) {
        await hooksManager.showHooksMenu();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.createHooksConfig', async () => {
      if (hooksManager) {
        await hooksManager.createDefaultConfig();
      }
    })
  );

  // Accept/reject individual hunks
  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.acceptHunk', async (diffId: string, hunkId: string) => {
      if (inlineDiffDecorator) {
        await inlineDiffDecorator.acceptHunk(diffId, hunkId);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ax-cli.rejectHunk', async (diffId: string, hunkId: string) => {
      if (inlineDiffDecorator) {
        await inlineDiffDecorator.rejectHunk(diffId, hunkId);
      }
    })
  );
}

export function deactivate() {
  cliBridge?.dispose();
  chatProvider?.dispose();
  statusBar?.dispose();
  ipcServer?.dispose();
  diffContentProvider?.dispose();
  inlineDiffDecorator?.dispose();
  checkpointManager?.dispose();
  autoErrorRecovery?.dispose();
  sessionManager?.dispose();
  hooksManager?.dispose();
}

/**
 * Inline Diff Decorator - Shows accept/reject buttons in the editor gutter
 * Enhanced with multi-hunk support for granular accept/reject
 * Similar to Claude Code and GitHub Copilot inline diff experience
 */

interface DiffHunk {
  id: string;
  startLine: number;  // 0-indexed
  endLine: number;    // 0-indexed, inclusive
  oldLines: string[];
  newLines: string[];
  type: 'add' | 'remove' | 'modify';
}

interface InlineDiff {
  id: string;
  file: string;
  oldContent: string;
  newContent: string;
  hunks: DiffHunk[];
  acceptedHunks: Set<string>;
  rejectedHunks: Set<string>;
  editor?: vscode.TextEditor;
  resolveCallback?: (accepted: boolean) => void;
}

class InlineDiffDecorator implements vscode.Disposable {
  private diffs: Map<string, InlineDiff> = new Map();
  private disposables: vscode.Disposable[] = [];

  // Decoration types for added/removed/modified lines
  private addedDecoration: vscode.TextEditorDecorationType;
  private removedDecoration: vscode.TextEditorDecorationType;
  private modifiedDecoration: vscode.TextEditorDecorationType;
  private pendingDecoration: vscode.TextEditorDecorationType;

  constructor() {
    // Green background for added lines
    this.addedDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(46, 160, 67, 0.2)',
      isWholeLine: true,
      overviewRulerColor: 'rgba(46, 160, 67, 0.7)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      gutterIconPath: this.createSvgUri('add'),
      gutterIconSize: 'contain',
      before: {
        contentText: '+',
        color: '#2ea043',
        fontWeight: 'bold',
        margin: '0 4px 0 0'
      }
    });

    // Red background for removed lines
    this.removedDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(248, 81, 73, 0.2)',
      isWholeLine: true,
      overviewRulerColor: 'rgba(248, 81, 73, 0.7)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      gutterIconPath: this.createSvgUri('remove'),
      gutterIconSize: 'contain',
      before: {
        contentText: '-',
        color: '#f85149',
        fontWeight: 'bold',
        margin: '0 4px 0 0'
      }
    });

    // Yellow/orange background for modified lines
    this.modifiedDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(227, 179, 65, 0.2)',
      isWholeLine: true,
      overviewRulerColor: 'rgba(227, 179, 65, 0.7)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      before: {
        contentText: '~',
        color: '#d29922',
        fontWeight: 'bold',
        margin: '0 4px 0 0'
      }
    });

    // Pending changes (dimmed)
    this.pendingDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(128, 128, 128, 0.1)',
      isWholeLine: true,
      opacity: '0.6'
    });

    // Register code lens provider for accept/reject buttons
    this.disposables.push(
      vscode.languages.registerCodeLensProvider('*', {
        provideCodeLenses: (document) => this.provideCodeLenses(document)
      })
    );

    // Clean up decorations when editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.refreshDecorations();
      })
    );

    // Register inline diff content provider for viewing diffs
    this.disposables.push(
      vscode.workspace.registerTextDocumentContentProvider('ax-cli-inline', {
        provideTextDocumentContent: (uri) => this.provideInlineDiffContent(uri)
      })
    );
  }

  /**
   * Create a data URI for a simple SVG gutter icon
   */
  private createSvgUri(type: 'add' | 'remove'): vscode.Uri {
    const color = type === 'add' ? '#2ea043' : '#f85149';
    const symbol = type === 'add' ? '+' : '-';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" fill="${color}" opacity="0.8"/>
      <text x="8" y="12" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${symbol}</text>
    </svg>`;
    return vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  }

  /**
   * Provide content for inline diff URI scheme
   */
  private provideInlineDiffContent(uri: vscode.Uri): string {
    const isOriginal = uri.query.includes('original');

    for (const diff of this.diffs.values()) {
      if (uri.path.includes(diff.id)) {
        return isOriginal ? diff.oldContent : diff.newContent;
      }
    }

    return '';
  }

  /**
   * Parse diff to extract hunks
   */
  private parseHunks(oldContent: string, newContent: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    // Simple LCS-based diff algorithm
    const changes = this.computeLineDiff(oldLines, newLines);

    let currentHunk: DiffHunk | null = null;
    let hunkIndex = 0;

    for (const change of changes) {
      if (change.type === 'equal') {
        if (currentHunk) {
          hunks.push(currentHunk);
          currentHunk = null;
        }
      } else {
        if (!currentHunk) {
          currentHunk = {
            id: `hunk-${hunkIndex++}`,
            startLine: change.newIndex,
            endLine: change.newIndex,
            oldLines: [],
            newLines: [],
            type: change.type === 'add' ? 'add' : change.type === 'remove' ? 'remove' : 'modify'
          };
        }

        currentHunk.endLine = change.newIndex;

        if (change.type === 'remove') {
          currentHunk.oldLines.push(change.line);
          if (currentHunk.type === 'add') currentHunk.type = 'modify';
        } else if (change.type === 'add') {
          currentHunk.newLines.push(change.line);
          if (currentHunk.type === 'remove') currentHunk.type = 'modify';
        }
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    // If no hunks detected, create a single hunk for the whole file
    if (hunks.length === 0 && oldContent !== newContent) {
      hunks.push({
        id: 'hunk-0',
        startLine: 0,
        endLine: Math.max(oldLines.length, newLines.length) - 1,
        oldLines,
        newLines,
        type: 'modify'
      });
    }

    return hunks;
  }

  /**
   * Compute line-by-line diff
   */
  private computeLineDiff(oldLines: string[], newLines: string[]): Array<{
    type: 'equal' | 'add' | 'remove';
    line: string;
    oldIndex: number;
    newIndex: number;
  }> {
    const result: Array<{
      type: 'equal' | 'add' | 'remove';
      line: string;
      oldIndex: number;
      newIndex: number;
    }> = [];

    let oldIndex = 0;
    let newIndex = 0;

    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      if (oldIndex >= oldLines.length) {
        // Remaining lines are additions
        result.push({
          type: 'add',
          line: newLines[newIndex],
          oldIndex,
          newIndex
        });
        newIndex++;
      } else if (newIndex >= newLines.length) {
        // Remaining lines are deletions
        result.push({
          type: 'remove',
          line: oldLines[oldIndex],
          oldIndex,
          newIndex
        });
        oldIndex++;
      } else if (oldLines[oldIndex] === newLines[newIndex]) {
        // Lines are equal
        result.push({
          type: 'equal',
          line: oldLines[oldIndex],
          oldIndex,
          newIndex
        });
        oldIndex++;
        newIndex++;
      } else {
        // Check if line was removed or added
        const oldLineInNew = newLines.indexOf(oldLines[oldIndex], newIndex);
        const newLineInOld = oldLines.indexOf(newLines[newIndex], oldIndex);

        if (oldLineInNew === -1 && newLineInOld === -1) {
          // Line was modified
          result.push({
            type: 'remove',
            line: oldLines[oldIndex],
            oldIndex,
            newIndex
          });
          result.push({
            type: 'add',
            line: newLines[newIndex],
            oldIndex,
            newIndex
          });
          oldIndex++;
          newIndex++;
        } else if (oldLineInNew === -1 || (newLineInOld !== -1 && newLineInOld < oldLineInNew)) {
          // Line was removed
          result.push({
            type: 'remove',
            line: oldLines[oldIndex],
            oldIndex,
            newIndex
          });
          oldIndex++;
        } else {
          // Line was added
          result.push({
            type: 'add',
            line: newLines[newIndex],
            oldIndex,
            newIndex
          });
          newIndex++;
        }
      }
    }

    return result;
  }

  /**
   * Show an inline diff in the editor with multi-hunk support
   */
  async showInlineDiff(payload: DiffPayload): Promise<boolean> {
    const hunks = this.parseHunks(payload.oldContent, payload.newContent);

    return new Promise((resolve) => {
      const diff: InlineDiff = {
        id: payload.id,
        file: payload.file,
        oldContent: payload.oldContent,
        newContent: payload.newContent,
        hunks,
        acceptedHunks: new Set(),
        rejectedHunks: new Set(),
        resolveCallback: resolve
      };

      this.diffs.set(payload.id, diff);

      // Open the file and show decorations
      (async () => {
        try {
          const uri = vscode.Uri.file(payload.file);
          const document = await vscode.workspace.openTextDocument(uri);
          const editor = await vscode.window.showTextDocument(document, { preview: false });

          diff.editor = editor;
          this.applyDecorations(diff, editor);

          // Scroll to the first change
          if (hunks.length > 0) {
            const range = new vscode.Range(hunks[0].startLine, 0, hunks[0].startLine, 0);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
          }

          // Trigger code lens refresh
          vscode.commands.executeCommand('editor.action.codeLensRefresh');

        } catch (error) {
          console.error('[AX InlineDiff] Error showing inline diff:', error);
          this.diffs.delete(payload.id);
          resolve(false);
        }
      })();
    });
  }

  /**
   * Apply decorations to show diff changes
   */
  private applyDecorations(diff: InlineDiff, editor: vscode.TextEditor): void {
    const addedRanges: vscode.DecorationOptions[] = [];
    const removedRanges: vscode.DecorationOptions[] = [];
    const modifiedRanges: vscode.DecorationOptions[] = [];

    for (const hunk of diff.hunks) {
      // Skip accepted or rejected hunks
      if (diff.acceptedHunks.has(hunk.id) || diff.rejectedHunks.has(hunk.id)) {
        continue;
      }

      const startLine = Math.max(0, hunk.startLine);
      const endLine = Math.min(editor.document.lineCount - 1, hunk.endLine);

      for (let i = startLine; i <= endLine; i++) {
        if (i >= editor.document.lineCount) break;

        const lineText = editor.document.lineAt(i).text;
        const range = new vscode.Range(i, 0, i, lineText.length);

        const decoration: vscode.DecorationOptions = {
          range,
          hoverMessage: new vscode.MarkdownString(
            `**Hunk ${hunk.id}** (${hunk.type})\n\n` +
            `Click CodeLens above to accept or reject`
          )
        };

        switch (hunk.type) {
          case 'add':
            addedRanges.push(decoration);
            break;
          case 'remove':
            removedRanges.push(decoration);
            break;
          case 'modify':
            modifiedRanges.push(decoration);
            break;
        }
      }
    }

    editor.setDecorations(this.addedDecoration, addedRanges);
    editor.setDecorations(this.removedDecoration, removedRanges);
    editor.setDecorations(this.modifiedDecoration, modifiedRanges);
  }

  /**
   * Provide code lenses for accept/reject buttons (per-hunk)
   */
  private provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];

    for (const [diffId, diff] of this.diffs) {
      if (diff.file !== document.uri.fsPath) continue;

      // Add accept/reject all at the top
      const firstLine = new vscode.Range(0, 0, 0, 0);
      lenses.push(new vscode.CodeLens(firstLine, {
        title: '$(check-all) Accept All',
        command: 'ax-cli.acceptInlineDiff',
        arguments: [diffId],
        tooltip: 'Accept all changes'
      }));
      lenses.push(new vscode.CodeLens(firstLine, {
        title: '$(close-all) Reject All',
        command: 'ax-cli.rejectInlineDiff',
        arguments: [diffId],
        tooltip: 'Reject all changes'
      }));
      lenses.push(new vscode.CodeLens(firstLine, {
        title: '$(diff) View Full Diff',
        command: 'vscode.diff',
        arguments: [
          vscode.Uri.parse(`ax-cli-inline:${diffId}?original`),
          vscode.Uri.parse(`ax-cli-inline:${diffId}?modified`),
          `${diff.file} (AX Proposed Changes)`
        ],
        tooltip: 'View full diff in split view'
      }));

      // Add per-hunk accept/reject
      for (const hunk of diff.hunks) {
        if (diff.acceptedHunks.has(hunk.id) || diff.rejectedHunks.has(hunk.id)) {
          continue;
        }

        const line = Math.max(0, hunk.startLine);
        const range = new vscode.Range(line, 0, line, 0);

        lenses.push(new vscode.CodeLens(range, {
          title: `$(check) Accept`,
          command: 'ax-cli.acceptHunk',
          arguments: [diffId, hunk.id],
          tooltip: `Accept this hunk (lines ${hunk.startLine + 1}-${hunk.endLine + 1})`
        }));

        lenses.push(new vscode.CodeLens(range, {
          title: `$(x) Reject`,
          command: 'ax-cli.rejectHunk',
          arguments: [diffId, hunk.id],
          tooltip: `Reject this hunk (lines ${hunk.startLine + 1}-${hunk.endLine + 1})`
        }));
      }
    }

    return lenses;
  }

  /**
   * Accept a single hunk
   */
  async acceptHunk(diffId: string, hunkId: string): Promise<void> {
    const diff = this.diffs.get(diffId);
    if (!diff) return;

    diff.acceptedHunks.add(hunkId);
    this.refreshDecorations();
    vscode.commands.executeCommand('editor.action.codeLensRefresh');

    // Check if all hunks are processed
    this.checkAllHunksProcessed(diffId);
  }

  /**
   * Reject a single hunk
   */
  async rejectHunk(diffId: string, hunkId: string): Promise<void> {
    const diff = this.diffs.get(diffId);
    if (!diff) return;

    diff.rejectedHunks.add(hunkId);
    this.refreshDecorations();
    vscode.commands.executeCommand('editor.action.codeLensRefresh');

    // Check if all hunks are processed
    this.checkAllHunksProcessed(diffId);
  }

  /**
   * Check if all hunks have been processed
   */
  private async checkAllHunksProcessed(diffId: string): Promise<void> {
    const diff = this.diffs.get(diffId);
    if (!diff) return;

    const processedCount = diff.acceptedHunks.size + diff.rejectedHunks.size;
    if (processedCount < diff.hunks.length) return;

    // All hunks processed - apply accepted changes
    if (diff.acceptedHunks.size > 0) {
      await this.applyAcceptedHunks(diffId);
    } else {
      vscode.window.showInformationMessage('All changes rejected');
      this.clearDiff(diffId);
      diff.resolveCallback?.(false);
    }
  }

  /**
   * Apply only the accepted hunks
   */
  private async applyAcceptedHunks(diffId: string): Promise<void> {
    const diff = this.diffs.get(diffId);
    if (!diff) return;

    try {
      // For simplicity, if all hunks are accepted, apply full new content
      // More sophisticated partial application would require merging
      if (diff.acceptedHunks.size === diff.hunks.length) {
        const uri = vscode.Uri.file(diff.file);
        const edit = new vscode.WorkspaceEdit();
        const document = await vscode.workspace.openTextDocument(uri);
        const fullRange = new vscode.Range(0, 0, document.lineCount, 0);
        edit.replace(uri, fullRange, diff.newContent);
        await vscode.workspace.applyEdit(edit);
        await document.save();

        vscode.window.showInformationMessage(`All ${diff.hunks.length} changes accepted`);
      } else {
        // Partial acceptance - currently applies all changes but notifies user
        // Full implementation would require careful 3-way merging
        const uri = vscode.Uri.file(diff.file);
        const document = await vscode.workspace.openTextDocument(uri);
        const edit = new vscode.WorkspaceEdit();

        // Warn user that partial hunk acceptance applies all changes
        const proceed = await vscode.window.showWarningMessage(
          `Partial hunk acceptance is not fully implemented. ` +
          `Applying all changes (${diff.hunks.length} hunks) instead of just ${diff.acceptedHunks.size}.`,
          'Apply All',
          'Cancel'
        );

        if (proceed !== 'Apply All') {
          return;
        }

        const fullRange = new vscode.Range(0, 0, document.lineCount, 0);
        edit.replace(uri, fullRange, diff.newContent);
        await vscode.workspace.applyEdit(edit);
        await document.save();

        vscode.window.showInformationMessage(`Applied all ${diff.hunks.length} changes`);
      }

      this.clearDiff(diffId);
      diff.resolveCallback?.(true);
    } catch (error) {
      console.error('[AX InlineDiff] Error applying changes:', error);
      vscode.window.showErrorMessage(`Failed to apply changes: ${error}`);
    }
  }

  /**
   * Accept all changes in a diff
   */
  async acceptDiff(diffId: string): Promise<void> {
    const diff = this.diffs.get(diffId);
    if (!diff) return;

    try {
      const uri = vscode.Uri.file(diff.file);
      const edit = new vscode.WorkspaceEdit();
      const document = await vscode.workspace.openTextDocument(uri);
      const fullRange = new vscode.Range(0, 0, document.lineCount, 0);
      edit.replace(uri, fullRange, diff.newContent);
      await vscode.workspace.applyEdit(edit);
      await document.save();

      vscode.window.showInformationMessage(`Changes accepted for ${diff.file}`);
    } catch (error) {
      console.error('[AX InlineDiff] Error applying changes:', error);
      vscode.window.showErrorMessage(`Failed to apply changes: ${error}`);
    } finally {
      this.clearDiff(diffId);
      diff.resolveCallback?.(true);
    }
  }

  /**
   * Reject all changes in a diff
   */
  async rejectDiff(diffId: string): Promise<void> {
    const diff = this.diffs.get(diffId);
    if (!diff) return;

    vscode.window.showInformationMessage(`Changes rejected for ${diff.file}`);
    this.clearDiff(diffId);
    diff.resolveCallback?.(false);
  }

  /**
   * Clear a diff and its decorations
   */
  private clearDiff(diffId: string): void {
    const diff = this.diffs.get(diffId);
    if (diff?.editor) {
      diff.editor.setDecorations(this.addedDecoration, []);
      diff.editor.setDecorations(this.removedDecoration, []);
      diff.editor.setDecorations(this.modifiedDecoration, []);
      diff.editor.setDecorations(this.pendingDecoration, []);
    }
    this.diffs.delete(diffId);

    // Refresh code lenses
    vscode.commands.executeCommand('editor.action.codeLensRefresh');
  }

  /**
   * Refresh decorations on active editor
   */
  private refreshDecorations(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    for (const diff of this.diffs.values()) {
      if (diff.file === editor.document.uri.fsPath) {
        diff.editor = editor;
        this.applyDecorations(diff, editor);
      }
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.addedDecoration.dispose();
    this.removedDecoration.dispose();
    this.modifiedDecoration.dispose();
    this.pendingDecoration.dispose();
    this.diffs.clear();
    this.disposables.forEach(d => d.dispose());
  }
}
