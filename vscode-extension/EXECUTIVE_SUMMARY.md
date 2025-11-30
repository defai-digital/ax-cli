# Executive Summary: VSCode Extension with Claude Code-like Diff Preview

## What You Want
A VSCode extension that integrates AX CLI with **diff preview functionality** - showing before/after file changes and requiring user approval before applying them, **just like Claude Code**.

## Current State ❌

**Problem**: The extension just applies changes directly without showing previews.

```
User: "Add a hello() function to index.ts"
 ↓
AX CLI executes
 ↓
File changed ✅ (NO PREVIEW, NO APPROVAL)
```

## Desired State ✅ (Claude Code-like)

```
User: "Add a hello() function to index.ts"
 ↓
AX CLI proposes change
 ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│ 📄 index.ts - Proposed Changes       │
│                                       │
│ BEFORE         │  AFTER               │
│ ─────────────  │  ─────────────       │
│ export {}      │  export {}           │
│                │  function hello() {  │
│                │    console.log("Hi") │
│                │  }                   │
│                                       │
│ [Accept] [Reject] [Show in Editor]   │
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ↓ (User clicks Accept)
 ↓
File changed ✅
```

## Why Current Implementation Doesn't Work

**You had the right idea** with `cli-bridge-sdk.ts` (SDK integration), but:

1. ❌ SDK import errors (we disabled it to fix build)
2. ❌ Missing tool interception in AX CLI SDK
3. ❌ Diff viewer not connected to approval flow
4. ❌ No communication between SDK events and webview

## The Solution (3 Parts)

### Part 1: Add Tool Interception to AX CLI SDK
**File**: `/Users/akiralam/code/ax-cli/src/agent/llm-agent.ts`

Currently:
```typescript
private async executeTool(toolCall) {
  // Just executes - no events, no approval
  return await this.textEditor.execute(args);
}
```

Needs to become:
```typescript
private async executeTool(toolCall) {
  // 1. Emit event
  this.emit('tool:approval_required', toolCall);

  // 2. Wait for approval (from VSCode extension)
  const approved = await this.waitForApproval(toolCall);

  // 3. Only execute if approved
  if (approved) {
    return await this.textEditor.execute(args);
  } else {
    return { success: false, error: 'User rejected' };
  }
}
```

### Part 2: Fix VSCode SDK Bridge
**File**: `vscode-extension/src/cli-bridge-sdk.ts`

```typescript
export class CLIBridgeSDK {
  async initialize() {
    this.agent = await createAgent({ maxToolRounds: 50 });

    // Enable approval requirement
    this.agent.setRequireToolApproval(true);

    // Listen for approval requests
    this.agent.on('tool:approval_required', (toolCall) => {
      // Extract file changes
      const change = {
        id: toolCall.id,
        file: toolCall.function.arguments.file_path,
        oldContent: readCurrentFile(),
        newContent: toolCall.function.arguments.new_content
      };

      // Show diff in webview
      this.showDiffPreview(change);
    });
  }

  // Called when user clicks Accept/Reject
  approveChange(changeId, approved) {
    this.agent.approveToolCall(changeId, approved);
  }
}
```

### Part 3: Connect Diff Viewer to Webview
**File**: `vscode-extension/media/main.js`

```javascript
// When extension sends diff data
window.addEventListener('message', event => {
  if (event.data.type === 'showDiff') {
    // Use existing DiffViewer class
    const viewer = new DiffViewer(container);
    viewer.render(oldContent, newContent, fileName);

    // Connect buttons
    window.acceptDiff = () => {
      vscode.postMessage({ type: 'approveDiff', changeId });
    };
  }
});
```

## What I've Created for You

### 📋 Documentation
1. **ARCHITECTURE.md** - Complete system design
2. **IMPLEMENTATION_PLAN.md** - Step-by-step code changes with actual code
3. **This summary** - Executive overview

### 📂 Files You Already Have
✅ `media/diff-viewer.js` - Diff UI (ready to use!)
✅ `src/chat-view-provider.ts` - Chat interface
✅ `src/cli-bridge-sdk.ts` - SDK integration (needs fixes)
✅ `src/cli-bridge.ts` - CLI spawning (backup approach)

## Implementation Effort

### Minimal Version (1-2 days)
- ✅ Add tool approval to AX CLI SDK (~2 hours)
- ✅ Fix SDK bridge in VSCode extension (~3 hours)
- ✅ Connect diff viewer to approval flow (~2 hours)
- ✅ Basic testing (~1 hour)

### Full Version (3-5 days)
- Everything above, plus:
- ✅ VSCode native diff viewer option
- ✅ Configuration settings
- ✅ Batch approval for multiple files
- ✅ Comprehensive testing
- ✅ User documentation

## Key Benefits

### For Users
- 🔍 **See changes before they happen**
- ✅ **Control over what gets applied**
- 🔄 **Undo by rejecting**
- 📝 **Review mode for safe AI coding**

### For You
- 🚀 **Competitive with Claude Code**
- 💎 **Professional UX**
- 🎯 **Unique selling point**
- 📈 **Higher user confidence**

## Technical Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| SDK doesn't support approval | ✅ We control AX CLI SDK - can add it |
| Performance issues | ✅ SDK is in-process, no spawning overhead |
| Complex integration | ✅ Clear architecture & implementation plan |
| Breaking changes | ✅ Feature-flagged, can disable if needed |

## Decision Points

### ✅ Recommendation: Go with SDK Approach

**Why:**
1. Real-time events (no polling)
2. In-process (faster than spawning)
3. Full control over agent lifecycle
4. Can intercept BEFORE execution
5. Professional UX like Claude Code

**Alternative (not recommended):**
- CLI spawning with --dry-run flag
- Slower, requires two invocations
- Less real-time feedback

## Next Steps (Your Call)

### Option A: Implement Now
I can start implementing the changes in this order:
1. Add tool approval to AX CLI SDK
2. Fix VSCode SDK bridge
3. Test basic diff preview workflow
4. Add polish (native diff viewer, config, etc.)

### Option B: Review & Plan
- Review the architecture docs
- Discuss any concerns
- Prioritize features
- Then implement

### Option C: Proof of Concept First
- Implement just Part 1 & 2 (core functionality)
- Test with basic example
- Decide on full implementation

## What Would You Like to Do?

**A)** Start implementing now (I'll begin with AX CLI SDK changes)
**B)** Review docs first, then decide
**C)** Build proof of concept
**D)** Something else (let me know!)

---

**All code and detailed implementations are in:**
- `ARCHITECTURE.md` - System design
- `IMPLEMENTATION_PLAN.md` - Exact code to add/modify
