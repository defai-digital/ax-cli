import * as vscode from 'vscode';
import * as path from 'path';
import { CLIBridgeSDK, CLIRequest, CLIResponse, CLIError, PendingChange } from './cli-bridge-sdk.js';
import { EditorContext } from './context-provider.js';
import type { StreamChunkPayload } from './ipc-server.js';
import type { ChatSession } from './session-manager.js';
import { generateId, generateNonce } from './utils.js';
import {
  FILE_SEARCH_DEBOUNCE_MS,
  MAX_WORKSPACE_FILES,
  MAX_GIT_DIFF_LENGTH,
  MAX_FILE_PICKER_RESULTS,
  MAX_CHAT_MESSAGES,
  COMPACT_HISTORY_KEEP_COUNT
} from './constants.js';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  context?: EditorContext;
  files?: Array<{ path: string; name: string }>;
  images?: Array<{ path: string; name: string; dataUri?: string }>;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ax-cli.chatView';

  // Maximum messages imported from constants for memory management

  private _view?: vscode.WebviewView;
  private messages: Message[] = [];
  private pendingChanges: Map<string, PendingChange> = new Map();
  private messageListener?: vscode.Disposable;
  private currentSession: ChatSession | null = null;
  private fileSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Dispose previous listener if view is being re-resolved
    this.messageListener?.dispose();

    // Handle messages from the webview - store disposable for cleanup
    this.messageListener = webviewView.webview.onDidReceiveMessage(async (data: any) => {
      // Guard against disposed webview - messages may arrive after webview is disposed
      if (!this._view) {
        console.warn('[ChatView] Received message after webview was disposed, ignoring');
        return;
      }

      try {
        switch (data.type) {
          case 'sendMessage': {
          // Convert webview context format to EditorContext
          type WebviewFile = string | { path: string; name: string };
          type WebviewImage = { path: string; name?: string; dataUri?: string };

          const context: EditorContext | undefined = data.context ? {
            // Files come as array of paths from webview, convert to FileAttachment
            files: data.context.files?.map((f: WebviewFile) =>
              typeof f === 'string'
                ? { path: f, name: f.split('/').pop() || f }
                : { path: f.path, name: f.name }
            ),
            // Images come with dataUri from webview
            images: data.context.images?.map((i: WebviewImage) => ({
              path: i.path,
              name: i.name || i.path.split('/').pop() || 'image',
              dataUri: i.dataUri
            })),
            extendedThinking: data.context.extendedThinking
          } : undefined;
          await this.handleUserMessage(data.message, context);
          break;
        }

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
          // Debounce to prevent excessive workspace searches on every keystroke
          this.debouncedFileSearch(data.query);
          break;

        case 'selectModel':
          // User wants to change model via /model command
          await vscode.commands.executeCommand('ax-cli.selectModel');
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

        case 'requestImagePicker':
          // User clicked image button in webview, open native picker
          await this.openImagePicker();
          break;

        case 'rewind':
          // User wants to rewind to checkpoint
          vscode.commands.executeCommand('ax-cli.rewind');
          break;

        case 'manageSessions':
          // User wants to manage sessions
          vscode.commands.executeCommand('ax-cli.manageSessions');
          break;

        case 'autoFixErrors':
          // User wants to auto-fix errors
          vscode.commands.executeCommand('ax-cli.autoFixErrors');
          break;

        case 'manageHooks':
          // User wants to manage hooks
          vscode.commands.executeCommand('ax-cli.manageHooks');
          break;
        }
      } catch (error) {
        // Log and show error to user - prevents unhandled promise rejection
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ChatView] Message handler error:', error);
        vscode.window.showErrorMessage(`Chat error: ${errorMessage}`);
      }
    });
  }

  // Extended thinking state (used when sending messages)
  private extendedThinkingEnabled = false;

  private get extendedThinking(): boolean {
    return this.extendedThinkingEnabled;
  }

  private set extendedThinking(value: boolean) {
    this.extendedThinkingEnabled = value;
  }

  public sendMessage(prompt: string, context?: EditorContext) {
    this.handleUserMessage(prompt, context);
  }

  /**
   * Insert file references into the chat (called from native file picker)
   * Similar to Claude Code's Cmd+Option+K functionality
   */
  public insertFileReferences(filePaths: string[]): void {
    if (!this._view) return;

    this._view.webview.postMessage({
      type: 'insertFiles',
      files: filePaths.map(filePath => ({
        path: filePath,
        name: path.basename(filePath)
      }))
    });
  }

  /**
   * Attach images to the chat
   * Sends image data to webview for display and context
   */
  public async attachImages(imagePaths: string[]): Promise<void> {
    if (!this._view) return;

    const images: Array<{ path: string; name: string; dataUri?: string }> = [];

    for (const imagePath of imagePaths) {
      try {
        const uri = vscode.Uri.file(imagePath);
        const data = await vscode.workspace.fs.readFile(uri);
        const ext = path.extname(imagePath).toLowerCase().slice(1);
        const mimeType = this.getMimeType(ext);
        const base64 = Buffer.from(data).toString('base64');
        const dataUri = `data:${mimeType};base64,${base64}`;

        images.push({
          path: imagePath,
          name: path.basename(imagePath),
          dataUri
        });
      } catch (error) {
        console.error(`[ChatView] Failed to read image ${imagePath}:`, error);
        vscode.window.showWarningMessage(`Failed to attach image: ${path.basename(imagePath)}`);
      }
    }

    if (images.length > 0) {
      this._view.webview.postMessage({
        type: 'attachImages',
        images
      });
    }
  }

  /**
   * Get MIME type for image extension
   */
  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'svg': 'image/svg+xml'
    };
    return mimeTypes[ext] || 'image/png';
  }

  /**
   * Open native image picker dialog
   * Called from webview when user clicks the image button
   */
  private async openImagePicker(): Promise<void> {
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
      await this.attachImages(files.map(f => f.fsPath));
    }
  }

  /**
   * Set the current session and load its messages
   */
  public setSession(session: ChatSession): void {
    this.currentSession = session;
    // Deep copy session messages to prevent race conditions if session manager
    // modifies the original session while we're processing
    this.messages = session.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      // Deep copy arrays to prevent shared references
      files: m.files ? m.files.map(f => ({ ...f })) : undefined,
      images: m.images ? m.images.map(i => ({ ...i })) : undefined
    }));

    // Batch both updates atomically to prevent race conditions
    // when setSession is called rapidly
    if (this._view) {
      // Send session change first so webview knows context before messages arrive
      this._view.webview.postMessage({
        type: 'sessionChanged',
        session: {
          id: session.id,
          name: session.name
        }
      });
      // Then send messages - order is guaranteed for same webview
      this._view.webview.postMessage({
        type: 'updateMessages',
        messages: this.messages,
      });
    }
  }

  /**
   * Get the current session
   */
  public getSession(): ChatSession | null {
    return this.currentSession;
  }

  /**
   * Handle streaming chunk from CLI via IPC
   * Forwards to webview for real-time display
   */
  public handleStreamChunk(payload: StreamChunkPayload): void {
    if (!this._view) {
      console.debug('[ChatView] Stream chunk ignored: no active webview');
      return;
    }

    try {
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
    } catch (error) {
      console.error('[ChatView] Failed to forward stream chunk:', error);
      // Try to reset loading state on error
      try {
        this._view?.webview.postMessage({ type: 'loading', value: false });
      } catch {
        // Webview may be disposed, ignore
      }
    }
  }

  /**
   * Show diff preview in webview
   * Called by CLI Bridge when agent wants to modify a file
   */
  private showDiffPreview(change: PendingChange): void {
    console.log('[ChatView] Showing diff preview for:', change.file);

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
   * Uses a unique scheme per diff to avoid conflicts with the global ax-cli-diff provider
   */
  private async showNativeDiff(changeId: string): Promise<void> {
    const change = this.pendingChanges.get(changeId);
    if (!change) {
      console.error('[ChatView] Change not found:', changeId);
      vscode.window.showWarningMessage('Change not found - it may have expired');
      return;
    }

    // Use unique scheme per diff to avoid conflicts with global provider in extension.ts
    const uniqueScheme = `ax-cli-chat-diff-${changeId}`;
    let registration: vscode.Disposable | undefined;
    let editorCloseListener: vscode.Disposable | undefined;

    try {
      // Create temporary URIs for diff viewer with unique scheme
      const originalUri = vscode.Uri.parse(`${uniqueScheme}:${change.file}?original`);
      const modifiedUri = vscode.Uri.parse(`${uniqueScheme}:${change.file}?modified`);

      // Register content provider with unique scheme
      const provider = new class implements vscode.TextDocumentContentProvider {
        provideTextDocumentContent(uri: vscode.Uri): string {
          return uri.query.includes('original') ? change.oldContent : change.newContent;
        }
      };

      registration = vscode.workspace.registerTextDocumentContentProvider(uniqueScheme, provider);

      // Open diff view
      await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        modifiedUri,
        `${change.file} (AX CLI Proposed Changes)`,
        { preview: true }
      );

      // Track if user made a decision to avoid orphaned changes
      let decisionMade = false;

      // Listen for editor close to handle cases where user dismisses without action
      editorCloseListener = vscode.window.onDidChangeVisibleTextEditors((editors) => {
        // Check if the diff editor is still open
        const diffStillOpen = editors.some(e =>
          e.document.uri.scheme === uniqueScheme
        );
        // If diff was closed and no decision was made, reject the change
        if (!diffStillOpen && !decisionMade && this.pendingChanges.has(changeId)) {
          console.log('[ChatView] Diff closed without decision, auto-rejecting:', changeId);
          this.cliBridge.approveChange(changeId, false);
          this.pendingChanges.delete(changeId);
          this.updateWebview();
        }
      });

      // Show info message with action buttons
      const action = await vscode.window.showInformationMessage(
        `Review changes to ${change.file}`,
        'Accept',
        'Reject'
      );

      decisionMade = true;

      // Check if change still exists (may have been auto-rejected by editorCloseListener)
      if (!this.pendingChanges.has(changeId)) {
        console.log('[ChatView] Change already processed (likely auto-rejected on editor close)');
        return;
      }

      if (action === 'Accept') {
        this.cliBridge.approveChange(changeId, true);
        this.pendingChanges.delete(changeId);
        vscode.window.showInformationMessage(`Changes applied to ${change.file}`);
      } else if (action === 'Reject') {
        this.cliBridge.approveChange(changeId, false);
        this.pendingChanges.delete(changeId);
        vscode.window.showInformationMessage(`Changes rejected for ${change.file}`);
      } else {
        // User dismissed the dialog without choosing - treat as reject
        this.cliBridge.approveChange(changeId, false);
        this.pendingChanges.delete(changeId);
        console.log('[ChatView] User dismissed diff dialog without action, change rejected');
      }

      this.updateWebview();

    } catch (error) {
      console.error('[ChatView] Error showing native diff:', error);
      vscode.window.showErrorMessage(`Failed to show diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Clean up orphaned change on error
      if (this.pendingChanges.has(changeId)) {
        this.cliBridge.approveChange(changeId, false);
        this.pendingChanges.delete(changeId);
        this.updateWebview();
      }
    } finally {
      // Always clean up the registration and listener
      if (registration) {
        registration.dispose();
      }
      if (editorCloseListener) {
        editorCloseListener.dispose();
      }
    }
  }

  private async handleUserMessage(prompt: string, context?: EditorContext) {
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
      context,
      files: context?.files?.map(f => ({ path: f.path, name: f.name })),
      images: context?.images?.map(i => ({ path: i.path, name: i.name, dataUri: i.dataUri })),
    };

    this.addMessage(userMessage);
    this.updateWebview();

    // Show loading state
    this._view?.webview.postMessage({
      type: 'loading',
      value: true,
    });

    try {
      // Load file contents for attached files
      const filesWithContent = await this.loadFileContents(context?.files);

      // Build CLI request with files and images
      const request: CLIRequest = {
        id: generateId(),
        prompt,
        context: context ? {
          file: context.file,
          selection: context.selection,
          lineRange: context.lineRange,
          gitDiff: context.gitDiff,
          // Include file attachments with content
          files: filesWithContent,
          // Include image attachments with base64 data
          images: context.images?.map(img => ({
            path: img.path,
            name: img.name,
            dataUri: img.dataUri,
            mimeType: img.mimeType
          })),
          extendedThinking: context.extendedThinking,
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

  /**
   * Load file contents for attached files
   */
  private async loadFileContents(files?: Array<{ path: string; name: string }>): Promise<Array<{ path: string; name: string; content?: string }> | undefined> {
    if (!files || files.length === 0) return undefined;

    const result: Array<{ path: string; name: string; content?: string }> = [];

    for (const file of files) {
      try {
        const uri = vscode.Uri.file(file.path);
        const content = await vscode.workspace.fs.readFile(uri);
        result.push({
          path: file.path,
          name: file.name,
          content: Buffer.from(content).toString('utf-8')
        });
      } catch (error) {
        console.warn(`[ChatView] Failed to read file ${file.path}:`, error);
        // Include file without content
        result.push({ path: file.path, name: file.name });
      }
    }

    return result;
  }

  private isError(response: CLIResponse | CLIError): response is CLIError {
    return 'error' in response;
  }

  private handleSuccess(response: CLIResponse) {
    // Add assistant messages from response
    for (const msg of response.messages) {
      if (msg.role === 'assistant') {
        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: msg.content,
          timestamp: new Date().toISOString(),
        };
        this.addMessage(assistantMessage);
      }
    }

    this.updateWebview();
  }

  private handleError(error: CLIError) {
    const errorMessage: Message = {
      id: generateId(),
      role: 'system',
      content: `Error: ${error.error.message}`,
      timestamp: new Date().toISOString(),
    };

    this.addMessage(errorMessage);
    this.updateWebview();

    vscode.window.showErrorMessage(`AX CLI Error: ${error.error.message}`);
  }

  private clearHistory() {
    this.messages = [];
    this.pendingChanges.clear();
    this.updateWebview();
  }

  /**
   * Calculate fuzzy match score between query and target string
   * Returns score (higher is better) and match positions
   */
  private fuzzyMatch(query: string, target: string): { score: number; positions: number[] } {
    if (!query) return { score: 1, positions: [] };

    const queryLower = query.toLowerCase();
    const targetLower = target.toLowerCase();
    const positions: number[] = [];

    let queryIndex = 0;
    let score = 0;
    let consecutiveBonus = 0;
    let prevMatchIndex = -1;

    for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
      if (targetLower[i] === queryLower[queryIndex]) {
        positions.push(i);

        // Base score for match
        score += 1;

        // Consecutive character bonus
        if (prevMatchIndex === i - 1) {
          consecutiveBonus += 2;
          score += consecutiveBonus;
        } else {
          consecutiveBonus = 0;
        }

        // Bonus for matching at word boundary (after . / - _ or start)
        if (i === 0 || /[.\-_\/\\]/.test(target[i - 1])) {
          score += 5;
        }

        // Bonus for exact case match
        if (target[i] === query[queryIndex]) {
          score += 1;
        }

        prevMatchIndex = i;
        queryIndex++;
      }
    }

    // Only count as match if all query characters were found
    if (queryIndex < queryLower.length) {
      return { score: 0, positions: [] };
    }

    // Bonus for shorter targets (more precise matches)
    score += Math.max(0, 20 - target.length);

    // Bonus for match starting earlier in the string
    if (positions.length > 0) {
      score += Math.max(0, 10 - positions[0]);
    }

    return { score, positions };
  }

  /**
   * Debounced file search to prevent excessive workspace searches
   * Waits 150ms after last keystroke before triggering search
   */
  private debouncedFileSearch(query: string): void {
    // Clear any pending search
    if (this.fileSearchDebounceTimer) {
      clearTimeout(this.fileSearchDebounceTimer);
    }

    // Schedule new search after debounce delay
    this.fileSearchDebounceTimer = setTimeout(() => {
      this.fileSearchDebounceTimer = null;
      this.handleFileSearch(query).catch(err => {
        console.error('[ChatView] File search error:', err);
      });
    }, FILE_SEARCH_DEBOUNCE_MS);
  }

  /**
   * Search for files in workspace matching query with fuzzy matching
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
      // Get all files (limit for performance)
      const excludePattern = '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.next/**,**/coverage/**,**/__pycache__/**,**/*.pyc}';
      const files = await vscode.workspace.findFiles('**/*', excludePattern, MAX_WORKSPACE_FILES);

      const workspaceRoot = workspaceFolders[0].uri.fsPath;

      // Define scored file type
      interface ScoredFile {
        path: string;
        name: string;
        relativePath: string;
        score: number;
        positions: number[];
      }

      // Score and filter files
      const scoredFiles: ScoredFile[] = files
        .map((file): ScoredFile => {
          const relativePath = path.relative(workspaceRoot, file.fsPath);
          const name = path.basename(file.fsPath);

          // Try matching against filename first, then full path
          const nameMatch = this.fuzzyMatch(query, name);
          const pathMatch = this.fuzzyMatch(query, relativePath);

          // Use better score (filename matches are preferred)
          const score = Math.max(nameMatch.score * 1.5, pathMatch.score);

          return {
            path: file.fsPath,
            name,
            relativePath,
            score,
            positions: nameMatch.score >= pathMatch.score ? nameMatch.positions : pathMatch.positions
          };
        })
        .filter((f: ScoredFile) => f.score > 0 || !query) // Keep all files if no query
        .sort((a: ScoredFile, b: ScoredFile) => {
          // Sort by score descending
          if (b.score !== a.score) return b.score - a.score;
          // Tie-breaker: shorter paths first
          return a.relativePath.length - b.relativePath.length;
        })
        .slice(0, MAX_FILE_PICKER_RESULTS);

      this._view?.webview.postMessage({
        type: 'filesResult',
        files: scoredFiles.map((f: ScoredFile) => ({
          path: f.path,
          name: f.name,
          relativePath: f.relativePath
        }))
      });
    } catch (error) {
      console.error('[ChatView] File search error:', error);
      // Provide user feedback about the error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showWarningMessage(`File search failed: ${errorMessage}`);
      this._view?.webview.postMessage({
        type: 'filesResult',
        files: [],
        error: errorMessage
      });
    }
  }

  /**
   * Compact conversation history by summarizing older messages
   */
  private compactHistory(): void {
    if (this.messages.length <= COMPACT_HISTORY_KEEP_COUNT) {
      vscode.window.showInformationMessage('Conversation is already compact');
      return;
    }

    // Keep recent messages, summarize the rest
    const keepCount = COMPACT_HISTORY_KEEP_COUNT;
    const oldMessages = this.messages.slice(0, -keepCount);
    const recentMessages = this.messages.slice(-keepCount);

    // Create a summary message
    const summaryMessage: Message = {
      id: generateId(),
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
   * Uses promisified exec to properly handle async/await pattern
   */
  private async addGitDiffContext(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Add timeout to prevent hanging if git command stalls
      const { stdout } = await execAsync('git diff', {
        cwd: workspaceFolder.uri.fsPath,
        timeout: 10000  // 10 second timeout
      });

      if (!stdout.trim()) {
        vscode.window.showInformationMessage('No uncommitted changes found');
        return;
      }

      // Add diff as a system message
      const diffMessage: Message = {
        id: generateId(),
        role: 'system',
        content: `**Git Diff (uncommitted changes):**\n\`\`\`diff\n${stdout.substring(0, MAX_GIT_DIFF_LENGTH)}${stdout.length > MAX_GIT_DIFF_LENGTH ? '\n... (truncated)' : ''}\n\`\`\``,
        timestamp: new Date().toISOString(),
      };

      this.addMessage(diffMessage);
      this.updateWebview();
    } catch (error) {
      console.error('[ChatView] Git diff error:', error);
      vscode.window.showWarningMessage('Failed to get git diff');
    }
  }

  private async applyCodeChanges(code: string, filePath?: string): Promise<void> {
    try {
      if (!filePath) {
        // Create new file
        const doc = await vscode.workspace.openTextDocument({
          content: code,
          language: 'typescript',
        });
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage('New file created with code');
      } else {
        // Apply to existing file
        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const edit = new vscode.WorkspaceEdit();

        // Handle empty document case - lineCount can be 0 for empty files
        let fullRange: vscode.Range;
        if (doc.lineCount === 0) {
          // Empty document - use position 0,0
          fullRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));
        } else {
          fullRange = new vscode.Range(
            doc.lineAt(0).range.start,
            doc.lineAt(doc.lineCount - 1).range.end
          );
        }

        edit.replace(uri, fullRange, code);
        const success = await vscode.workspace.applyEdit(edit);
        if (!success) {
          throw new Error('Failed to apply edit - workspace rejected the changes');
        }
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage('Code applied successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ChatView] Failed to apply code changes:', error);
      vscode.window.showErrorMessage(`Failed to apply code: ${errorMessage}`);
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

  private getHtmlForWebview(webview: vscode.Webview) {
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
    const nonce = generateNonce();

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

  /**
   * Add a message and prune old messages if limit exceeded
   * Prevents unbounded memory growth in long-running sessions
   */
  private addMessage(message: Message): void {
    this.messages.push(message);

    // Prune oldest messages if we exceed the limit
    if (this.messages.length > MAX_CHAT_MESSAGES) {
      const excessCount = this.messages.length - MAX_CHAT_MESSAGES;
      this.messages.splice(0, excessCount);
      console.log(`[ChatView] Pruned ${excessCount} old message(s), keeping ${this.messages.length}`);
    }
  }

  /**
   * Dispose resources to prevent memory leaks
   */
  public dispose(): void {
    this.messageListener?.dispose();
    this.messageListener = undefined;
    this.pendingChanges.clear();
    this.messages = [];  // Clear messages to free memory
    if (this.fileSearchDebounceTimer) {
      clearTimeout(this.fileSearchDebounceTimer);
      this.fileSearchDebounceTimer = null;
    }
    this._view = undefined;
  }
}
