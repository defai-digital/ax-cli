# VSCode Extension Architecture - Claude Code-like Integration

## Vision
Create a VSCode extension that integrates AX CLI with **diff preview and approval** workflow, similar to Claude Code.

## Current State Analysis

### ✅ What We Have
1. **Diff Viewer UI** (`media/diff-viewer.js`)
   - Side-by-side and inline diff rendering
   - Accept/Reject buttons (not connected)

2. **CLI Bridge** (`src/cli-bridge.ts`)
   - Spawns AX CLI processes
   - Gets final results
   - **Problem**: No real-time interception of file changes

3. **SDK Bridge** (`src/cli-bridge-sdk.ts` - currently disabled)
   - Direct SDK integration
   - Real-time event streaming
   - **This is what we need!**

4. **Chat View** (`src/chat-view-provider.ts`)
   - Chat interface
   - `applyCodeChanges()` - applies changes WITHOUT preview

### ❌ What's Missing

1. **Real-time Tool Call Interception**
   - When AX CLI wants to edit a file, we need to intercept it BEFORE execution

2. **Diff Preview Workflow**
   - Show proposed changes in diff viewer
   - Wait for user approval
   - Only then apply changes

3. **Integration Between Components**
   - Diff viewer ↔ SDK bridge ↔ Chat view
   - Accept/Reject actions need to control tool execution

## Proposed Architecture

### Option 1: SDK-Based Approach (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│                    VSCode Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐          ┌─────────────────┐            │
│  │ Chat View    │◄────────►│ Change Preview  │            │
│  │ Provider     │          │ Manager          │            │
│  └──────┬───────┘          └────────┬────────┘            │
│         │                            │                     │
│         │                            │                     │
│  ┌──────▼────────────────────────────▼────────┐           │
│  │         CLI Bridge SDK                      │           │
│  │  - Intercepts tool calls                    │           │
│  │  - Pauses execution                         │           │
│  │  - Shows diff preview                       │           │
│  │  - Waits for approval                       │           │
│  │  - Executes or rejects                      │           │
│  └──────────────────┬──────────────────────────┘           │
│                     │                                       │
│              ┌──────▼────────┐                             │
│              │   AX CLI SDK   │                             │
│              │   (Direct)     │                             │
│              └────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

**How It Works:**

1. **User sends message** in chat
2. **SDK Bridge** creates agent and processes message
3. **Agent wants to edit file** → `text_editor.apply_edit()` tool call
4. **SDK Bridge intercepts** the tool call BEFORE execution:
   ```typescript
   agent.on('tool_pending', (toolCall) => {
     if (toolCall.function.name === 'apply_edit') {
       // Show diff preview and wait for approval
       showDiffPreview(toolCall.function.arguments);
     }
   });
   ```
5. **Show diff in webview** or VSCode native diff viewer
6. **User clicks Accept/Reject**:
   - Accept → Execute tool call → Apply changes
   - Reject → Cancel tool call → Continue with next action
7. **Continue agent execution** with user's decision

### Option 2: CLI Output Interception (Fallback)

If SDK doesn't support pausing tool execution, we can:

1. Run AX CLI with `--dry-run` or `--preview-only` flag (need to add this)
2. Get structured output of proposed changes
3. Show diffs
4. User approves
5. Run AX CLI again with `--apply-changes`

**Downside**: Slower, requires two CLI invocations

## Implementation Plan

### Phase 1: Enable SDK Integration

**File**: `src/cli-bridge-sdk.ts`

```typescript
import { createAgent, type LLMAgent, type StreamingChunk } from '@defai.digital/ax-cli/sdk';
import type { ToolResult } from '@defai.digital/ax-cli/sdk';

interface PendingChange {
  id: string;
  file: string;
  oldContent: string;
  newContent: string;
  approved: boolean | null; // null = waiting, true = approved, false = rejected
}

export class CLIBridgeSDK {
  private agent: LLMAgent | null = null;
  private pendingChanges: Map<string, PendingChange> = new Map();
  private changeApprovalCallbacks: Map<string, (approved: boolean) => void> = new Map();

  // When agent wants to edit a file
  private async interceptToolCall(toolCall: any): Promise<ToolResult> {
    if (toolCall.function.name === 'apply_edit') {
      const args = toolCall.function.arguments;
      const changeId = this.generateId();

      // Create pending change
      const pendingChange: PendingChange = {
        id: changeId,
        file: args.file_path,
        oldContent: await this.readFile(args.file_path),
        newContent: args.new_content,
        approved: null
      };

      this.pendingChanges.set(changeId, pendingChange);

      // Notify webview to show diff
      this.notifyDiffPreview(pendingChange);

      // Wait for user decision
      const approved = await this.waitForApproval(changeId);

      if (approved) {
        // Execute the tool call
        return await this.executeEdit(args);
      } else {
        // Reject - return error result
        return {
          success: false,
          error: 'User rejected change'
        };
      }
    }

    // Other tool calls pass through normally
    return await this.executeToolNormally(toolCall);
  }

  private waitForApproval(changeId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.changeApprovalCallbacks.set(changeId, resolve);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.changeApprovalCallbacks.has(changeId)) {
          this.changeApprovalCallbacks.delete(changeId);
          resolve(false); // Auto-reject on timeout
        }
      }, 5 * 60 * 1000);
    });
  }

  // Called by webview when user clicks Accept/Reject
  public approveChange(changeId: string, approved: boolean): void {
    const callback = this.changeApprovalCallbacks.get(changeId);
    if (callback) {
      callback(approved);
      this.changeApprovalCallbacks.delete(changeId);
      this.pendingChanges.delete(changeId);
    }
  }
}
```

### Phase 2: Update Chat View Provider

**File**: `src/chat-view-provider.ts`

Add diff preview handling:

```typescript
webviewView.webview.onDidReceiveMessage(async (data: any) => {
  switch (data.type) {
    case 'sendMessage':
      await this.handleUserMessage(data.message, data.context);
      break;

    case 'approveDiff':
      // User clicked "Accept" in diff viewer
      this.cliBridge.approveChange(data.changeId, true);
      break;

    case 'rejectDiff':
      // User clicked "Reject" in diff viewer
      this.cliBridge.approveChange(data.changeId, false);
      break;

    case 'showDiffInEditor':
      // Show diff in VSCode native diff viewer
      await this.showNativeDiff(data.changeId);
      break;
  }
});
```

### Phase 3: Update Diff Viewer

**File**: `media/diff-viewer.js`

Connect Accept/Reject buttons:

```javascript
// In diff viewer HTML
<div class="diff-actions">
  <button class="diff-action-btn" onclick="approveDiff('${changeId}')">
    <span class="codicon codicon-check"></span> Accept Changes
  </button>
  <button class="diff-action-btn secondary" onclick="rejectDiff('${changeId}')">
    <span class="codicon codicon-close"></span> Reject
  </button>
  <button class="diff-action-btn" onclick="showInEditor('${changeId}')">
    <span class="codicon codicon-diff"></span> Show in Editor
  </button>
</div>

<script>
function approveDiff(changeId) {
  vscode.postMessage({ type: 'approveDiff', changeId });
}

function rejectDiff(changeId) {
  vscode.postMessage({ type: 'rejectDiff', changeId });
}

function showInEditor(changeId) {
  vscode.postMessage({ type: 'showDiffInEditor', changeId });
}
</script>
```

### Phase 4: VSCode Native Diff Viewer

```typescript
private async showNativeDiff(changeId: string): Promise<void> {
  const change = this.pendingChanges.get(changeId);
  if (!change) return;

  // Create temporary files for diff
  const originalUri = vscode.Uri.parse(`ax-cli-diff:${change.file}?original`);
  const modifiedUri = vscode.Uri.parse(`ax-cli-diff:${change.file}?modified`);

  // Register content provider
  const provider = new class implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): string {
      return uri.query === 'original' ? change.oldContent : change.newContent;
    }
  };

  vscode.workspace.registerTextDocumentContentProvider('ax-cli-diff', provider);

  // Open diff view
  await vscode.commands.executeCommand('vscode.diff',
    originalUri,
    modifiedUri,
    `${change.file} (AX CLI Proposed Changes)`
  );
}
```

## Key Features

### 1. **Real-Time Diff Preview**
- Intercept file edits before execution
- Show side-by-side or inline diff
- User approval required

### 2. **VSCode Native Integration**
- Use VSCode's built-in diff viewer
- Familiar UX for developers
- Full syntax highlighting

### 3. **Batch Changes**
- If agent wants to modify multiple files
- Show all diffs
- User can approve/reject individually or all at once

### 4. **Streaming Updates**
- As agent generates code
- Show incremental diffs
- Real-time preview

## Configuration

Add to `package.json`:

```json
{
  "contributes": {
    "configuration": {
      "title": "AX CLI",
      "properties": {
        "ax-cli.diffPreview.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Show diff preview before applying changes"
        },
        "ax-cli.diffPreview.mode": {
          "type": "string",
          "enum": ["webview", "editor", "both"],
          "default": "both",
          "description": "Diff preview mode"
        },
        "ax-cli.autoApprove.enabled": {
          "type": "boolean",
          "default": false,
          "description": "Auto-approve all changes (Claude Code-like)"
        }
      }
    }
  }
}
```

## Next Steps

1. ✅ Understand current architecture
2. ⏳ Fix SDK integration errors
3. ⏳ Implement tool call interception
4. ⏳ Connect diff viewer to approval flow
5. ⏳ Add VSCode native diff viewer option
6. ⏳ Test end-to-end workflow
7. ⏳ Add configuration options
8. ⏳ Document user guide

## Questions to Resolve

1. **Does AX CLI SDK support pausing tool execution?**
   - Need to check if we can intercept tool calls before execution
   - If not, we may need to add this capability to the SDK

2. **Batch approval workflow?**
   - Single approval for all changes
   - Individual approval per file
   - Approve specific hunks only

3. **Fallback behavior?**
   - If user rejects a change, should agent:
     - Stop completely
     - Try alternative approach
     - Continue with remaining tasks

4. **Undo/Redo?**
   - Track applied changes
   - Allow undo within session
   - Integrate with VS Code's undo stack
