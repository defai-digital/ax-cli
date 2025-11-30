# VSCode Extension - Claude Code-like Diff Preview Implementation Plan

## Overview
Transform the VSCode extension to show diff previews before applying file changes, just like Claude Code.

## Critical Discovery

**Current AX CLI SDK (`src/agent/llm-agent.ts:1874`)**:
```typescript
private async executeTool(toolCall: LLMToolCall): Promise<ToolResult> {
  // Tools are executed directly without emitting events
  // No way to intercept or pause execution
}
```

**What We Need:**
```typescript
private async executeTool(toolCall: LLMToolCall): Promise<ToolResult> {
  // 1. Emit 'tool:before' event
  this.emit('tool:before', toolCall);

  // 2. If tool requires approval, wait for it
  if (this.requiresApproval(toolCall)) {
    const approved = await this.waitForApproval(toolCall);
    if (!approved) {
      return { success: false, error: 'User rejected' };
    }
  }

  // 3. Execute tool
  const result = await this.actuallyExecuteTool(toolCall);

  // 4. Emit 'tool:after' event
  this.emit('tool:after', { toolCall, result });

  return result;
}
```

## Implementation Steps

### Step 1: Enhance AX CLI SDK (Main Project)

**File**: `/Users/akiralam/code/ax-cli/src/agent/llm-agent.ts`

Add tool interception capability:

```typescript
// Add to LLMAgent class (around line 78)
export class LLMAgent extends EventEmitter {
  // ... existing code ...

  private toolApprovalCallbacks: Map<string, (approved: boolean) => void> = new Map();
  private requireApprovalForTools: boolean = false; // SDK can enable this

  /**
   * Enable/disable requiring approval for text_editor operations
   * This is used by VSCode extension to show diff preview
   */
  public setRequireToolApproval(enabled: boolean): void {
    this.requireApprovalForTools = enabled;
  }

  /**
   * Approve or reject a pending tool call
   * Called by external integrations (VSCode extension)
   */
  public approveToolCall(toolCallId: string, approved: boolean): void {
    const callback = this.toolApprovalCallbacks.get(toolCallId);
    if (callback) {
      callback(approved);
      this.toolApprovalCallbacks.delete(toolCallId);
    }
  }

  private waitForToolApproval(toolCall: LLMToolCall): Promise<boolean> {
    return new Promise((resolve) => {
      // Emit event so VSCode can show diff
      this.emit('tool:approval_required', toolCall);

      // Store callback
      this.toolApprovalCallbacks.set(toolCall.id, resolve);

      // Timeout after 5 minutes (auto-reject)
      setTimeout(() => {
        if (this.toolApprovalCallbacks.has(toolCall.id)) {
          this.toolApprovalCallbacks.delete(toolCall.id);
          resolve(false);
        }
      }, 5 * 60 * 1000);
    });
  }

  // Modify existing executeTool method (line 1874)
  private async executeTool(toolCall: LLMToolCall): Promise<ToolResult> {
    try {
      // Emit before event
      this.emit('tool:before', toolCall);

      // Check if approval required (text_editor operations)
      if (this.requireApprovalForTools &&
          (toolCall.function.name === 'text_editor' ||
           toolCall.function.name === 'apply_edit')) {

        const approved = await this.waitForToolApproval(toolCall);

        if (!approved) {
          this.emit('tool:rejected', toolCall);
          return {
            success: false,
            error: 'Change rejected by user'
          };
        }

        this.emit('tool:approved', toolCall);
      }

      // ... existing execution logic ...
      const parseResult = this.parseToolArguments(toolCall, 'Tool');
      if (!parseResult.success) {
        // ... existing error handling ...
      }

      // Execute the tool
      const result = await this.actuallyExecuteTool(toolCall); // Rename existing logic

      // Emit after event
      this.emit('tool:after', { toolCall, result });

      return result;

    } catch (error) {
      // ... existing error handling ...
    }
  }

  // Rename existing execution logic
  private async actuallyExecuteTool(toolCall: LLMToolCall): Promise<ToolResult> {
    // Move existing executeTool logic here
    switch (toolCall.function.name) {
      case "text_editor":
        return await this.textEditor.execute(args);
      // ... etc
    }
  }
}
```

### Step 2: Fix VSCode Extension SDK Bridge

**File**: `vscode-extension/src/cli-bridge-sdk.ts`

Enable the file (undo the .disabled rename):

```bash
mv src/cli-bridge-sdk.ts.disabled src/cli-bridge-sdk.ts
```

Then fix it:

```typescript
import * as vscode from 'vscode';
import {
  createAgent,
  type LLMAgent,
  type StreamingChunk,
  type ChatEntry,
  SDKError,
  SDKErrorCode
} from '@defai.digital/ax-cli/sdk';
import type { ToolResult } from '@defai.digital/ax-cli/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface PendingChange {
  id: string;
  file: string;
  oldContent: string;
  newContent: string;
  command: 'write_file' | 'apply_edit' | 'insert_text';
  lineStart?: number;
  lineEnd?: number;
}

export class CLIBridgeSDK {
  private agent: LLMAgent | null = null;
  private pendingChanges: Map<string, PendingChange> = new Map();
  private streamHandlers: Map<string, (chunk: StreamingChunk) => void> = new Map();
  private onDiffPreview?: (change: PendingChange) => void;

  async initialize(): Promise<void> {
    if (this.agent) return;

    try {
      this.agent = await createAgent({
        maxToolRounds: 50,
        debug: true,
      });

      // Enable tool approval requirement
      this.agent.setRequireToolApproval(true);

      // Listen for tool approval requests
      this.agent.on('tool:approval_required', async (toolCall: any) => {
        await this.handleToolApprovalRequest(toolCall);
      });

      // Listen for other events
      this.agent.on('tool:approved', (toolCall: any) => {
        console.log('[AX SDK] Tool approved:', toolCall.function.name);
      });

      this.agent.on('tool:rejected', (toolCall: any) => {
        console.log('[AX SDK] Tool rejected:', toolCall.function.name);
      });

      this.agent.on('stream', (chunk: StreamingChunk) => {
        this.streamHandlers.forEach(handler => handler(chunk));
      });

      this.agent.on('error', (error: Error) => {
        console.error('[AX SDK] Agent error:', error);
      });

      console.log('[AX SDK] Agent initialized successfully');
    } catch (error) {
      console.error('[AX SDK] Initialization failed:', error);
      throw error;
    }
  }

  private async handleToolApprovalRequest(toolCall: any): Promise<void> {
    try {
      const args = toolCall.function.arguments;

      // Read current file content
      const filePath = args.file_path || args.path;
      const fullPath = path.join(
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
        filePath
      );

      let oldContent = '';
      try {
        oldContent = await fs.readFile(fullPath, 'utf-8');
      } catch (error) {
        // File doesn't exist yet (new file)
        oldContent = '';
      }

      // Create pending change
      const change: PendingChange = {
        id: toolCall.id,
        file: filePath,
        oldContent,
        newContent: args.new_content || args.content || '',
        command: toolCall.function.name,
        lineStart: args.line_start,
        lineEnd: args.line_end,
      };

      this.pendingChanges.set(toolCall.id, change);

      // Notify webview to show diff
      if (this.onDiffPreview) {
        this.onDiffPreview(change);
      }

    } catch (error) {
      console.error('[AX SDK] Error handling tool approval:', error);
      // Auto-reject on error
      this.agent?.approveToolCall(toolCall.id, false);
    }
  }

  public setDiffPreviewHandler(handler: (change: PendingChange) => void): void {
    this.onDiffPreview = handler;
  }

  public approveChange(changeId: string, approved: boolean): void {
    if (!this.agent) return;

    this.agent.approveToolCall(changeId, approved);
    this.pendingChanges.delete(changeId);
  }

  public getPendingChange(changeId: string): PendingChange | undefined {
    return this.pendingChanges.get(changeId);
  }

  async sendRequest(
    request: { prompt: string },
    onStream?: (chunk: StreamingChunk) => void
  ): Promise<{ messages: ChatEntry[] }> {
    await this.initialize();

    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    if (onStream) {
      const requestId = `req-${Date.now()}`;
      this.streamHandlers.set(requestId, onStream);
    }

    const chatHistory = await this.agent.processUserMessage(request.prompt);

    return { messages: chatHistory };
  }

  dispose(): void {
    if (this.agent) {
      this.agent.dispose();
      this.agent = null;
    }
    this.streamHandlers.clear();
    this.pendingChanges.clear();
  }

  isReady(): boolean {
    return this.agent !== null;
  }
}
```

### Step 3: Update Chat View Provider

**File**: `vscode-extension/src/chat-view-provider.ts`

```typescript
import * as vscode from 'vscode';
import { CLIBridgeSDK, PendingChange } from './cli-bridge-sdk';
import { EditorContext } from './context-provider';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ax-cli.chatView';

  private _view?: vscode.WebviewView;
  private messages: Message[] = [];
  private pendingChanges: Map<string, PendingChange> = new Map();

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly cliBridge: CLIBridgeSDK
  ) {
    // Set up diff preview handler
    this.cliBridge.setDiffPreviewHandler((change) => {
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
          this.cliBridge.approveChange(data.changeId, true);
          this.pendingChanges.delete(data.changeId);
          this.updateWebview();
          break;

        case 'rejectDiff':
          this.cliBridge.approveChange(data.changeId, false);
          this.pendingChanges.delete(data.changeId);
          this.updateWebview();
          break;

        case 'showDiffInEditor':
          await this.showNativeDiff(data.changeId);
          break;

        case 'clearHistory':
          this.clearHistory();
          break;
      }
    });
  }

  private showDiffPreview(change: PendingChange): void {
    this.pendingChanges.set(change.id, change);

    // Send to webview
    if (this._view) {
      this._view.webview.postMessage({
        type: 'showDiff',
        change: {
          id: change.id,
          file: change.file,
          oldContent: change.oldContent,
          newContent: change.newContent,
        }
      });
    }
  }

  private async showNativeDiff(changeId: string): Promise<void> {
    const change = this.pendingChanges.get(changeId);
    if (!change) return;

    // Create temporary files for diff
    const originalUri = vscode.Uri.parse(`ax-cli-diff:${change.file}?original&${changeId}`);
    const modifiedUri = vscode.Uri.parse(`ax-cli-diff:${change.file}?modified&${changeId}`);

    // Register content provider
    const provider = new class implements vscode.TextDocumentContentProvider {
      provideTextDocumentContent(uri: vscode.Uri): string {
        return uri.query.includes('original') ? change.oldContent : change.newContent;
      }
    };

    const registration = vscode.workspace.registerTextDocumentContentProvider('ax-cli-diff', provider);

    try {
      // Open diff view
      await vscode.commands.executeCommand('vscode.diff',
        originalUri,
        modifiedUri,
        `${change.file} (AX CLI Proposed Changes)`,
        { preview: true }
      );
    } finally {
      // Clean up after a delay
      setTimeout(() => registration.dispose(), 10000);
    }
  }

  // ... rest of existing code ...
}
```

### Step 4: Update Webview (main.js)

**File**: `vscode-extension/media/main.js`

Add diff handling:

```javascript
// Listen for messages from extension
window.addEventListener('message', event => {
  const message = event.data;

  switch (message.type) {
    case 'updateMessages':
      updateMessages(message.messages);
      break;

    case 'showDiff':
      showDiffViewer(message.change);
      break;

    case 'loading':
      toggleLoading(message.value);
      break;
  }
});

function showDiffViewer(change) {
  const container = document.getElementById('diff-container');
  if (!container) {
    // Create diff container
    const diffContainer = document.createElement('div');
    diffContainer.id = 'diff-container';
    document.body.appendChild(diffContainer);
  }

  // Use DiffViewer class
  const viewer = new DiffViewer(document.getElementById('diff-container'));
  viewer.render(change.oldContent, change.newContent, change.file);

  // Override acceptDiff/rejectDiff functions
  window.acceptDiff = function() {
    vscode.postMessage({ type: 'approveDiff', changeId: change.id });
    document.getElementById('diff-container').innerHTML = '';
  };

  window.rejectDiff = function() {
    vscode.postMessage({ type: 'rejectDiff', changeId: change.id });
    document.getElementById('diff-container').innerHTML = '';
  };

  window.showInEditor = function() {
    vscode.postMessage({ type: 'showDiffInEditor', changeId: change.id });
  };
}
```

### Step 5: Update Extension.ts to Use SDK Bridge

**File**: `vscode-extension/src/extension.ts`

```typescript
import * as vscode from 'vscode';
import { CLIBridgeSDK } from './cli-bridge-sdk';  // Use SDK instead of CLI spawning
import { ChatViewProvider } from './chat-view-provider';
import { ContextProvider } from './context-provider';
import { StatusBarManager } from './status-bar';

let cliBridge: CLIBridgeSDK | undefined;
let chatProvider: ChatViewProvider | undefined;
let contextProvider: ContextProvider | undefined;
let statusBar: StatusBarManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('AX CLI extension is now active');

  // Initialize components with SDK bridge
  cliBridge = new CLIBridgeSDK();
  contextProvider = new ContextProvider();
  statusBar = new StatusBarManager();
  chatProvider = new ChatViewProvider(context.extensionUri, cliBridge);

  // ... rest of activation ...
}
```

## Testing Plan

### Test 1: Basic Diff Preview

1. Open VSCode with extension installed
2. Open AX CLI chat
3. Send message: "Add a new function `hello()` to src/index.ts"
4. **Expected**: Diff viewer appears showing proposed changes
5. Click "Accept"
6. **Expected**: Changes applied to file

### Test 2: Reject Changes

1. Send message: "Delete all code in src/index.ts"
2. **Expected**: Diff viewer shows deletion
3. Click "Reject"
4. **Expected**: No changes applied, agent continues or stops

### Test 3: Multiple File Changes

1. Send message: "Refactor the codebase - split index.ts into three files"
2. **Expected**: Multiple diff viewers appear sequentially
3. Approve some, reject others
4. **Expected**: Only approved changes applied

### Test 4: Native VSCode Diff

1. Trigger diff preview
2. Click "Show in Editor"
3. **Expected**: VSCode native diff viewer opens
4. Can still approve/reject from there

## Configuration

Add to `package.json`:

```json
{
  "ax-cli.diffPreview.enabled": {
    "type": "boolean",
    "default": true,
    "description": "Show diff preview before applying changes"
  },
  "ax-cli.diffPreview.autoApprove": {
    "type": "boolean",
    "default": false,
    "description": "Auto-approve all changes (bypass diff preview)"
  },
  "ax-cli.diffPreview.mode": {
    "type": "string",
    "enum": ["webview", "editor", "both"],
    "default": "webview",
    "description": "How to show diff previews"
  }
}
```

## Next Steps

1. ✅ Design architecture
2. ⏳ Add tool approval events to AX CLI SDK
3. ⏳ Fix and re-enable SDK bridge in VSCode extension
4. ⏳ Connect diff viewer to approval flow
5. ⏳ Test end-to-end workflow
6. ⏳ Add configuration options
7. ⏳ Create user documentation

## Questions Resolved

Q: Does SDK support tool interception?
A: **No, but we can add it easily** by modifying `executeTool()` in `llm-agent.ts`

Q: Should we use CLI spawning or SDK?
A: **SDK** - gives us real-time control and event-driven architecture

Q: What if user rejects a change?
A: Agent receives `{ success: false, error: 'User rejected' }` and can decide next steps

Q: Batch approval?
A: Start with sequential (one at a time), can add batch later
