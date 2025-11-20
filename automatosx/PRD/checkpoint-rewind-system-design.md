# Checkpoint/Rewind System - Architecture Design

**Date:** 2025-11-20
**Feature:** Automatic Checkpoint & Rewind System
**Inspired By:** Claude Code's checkpoint system (Esc+Esc to rewind)

---

## Executive Summary

Implement an automatic checkpoint system that:
- Saves code state before every file modification
- Allows instant rewind to any previous state
- Integrates with existing `history-manager.ts` for persistence
- Provides `/rewind` slash command and keyboard shortcut
- Maintains conversation context alongside code states

---

## Requirements

### Functional Requirements

1. **Automatic Checkpoints**
   - Create checkpoint before every file write/edit operation
   - Store file content, path, and timestamp
   - Capture conversation state at checkpoint time
   - Limit checkpoint storage (max 100 checkpoints, auto-prune oldest)

2. **Rewind Capability**
   - `/rewind` command to list and select checkpoints
   - Interactive selection with preview
   - Apply selected checkpoint (restore files + conversation)
   - Confirm before applying destructive changes

3. **Checkpoint Storage**
   - Store in `.ax-cli/checkpoints/` directory
   - JSON format for easy inspection
   - Compress old checkpoints (7 days+)
   - Auto-clean on session end (optional, configurable)

4. **UI Integration**
   - Show checkpoint indicator in status
   - Display "💾 Checkpoint created" messages
   - Interactive rewind selection UI
   - Preview diff before applying

### Non-Functional Requirements

1. **Performance**
   - Checkpoint creation < 50ms
   - No impact on file operations
   - Lazy loading of checkpoint data
   - Background compression

2. **Storage**
   - Max 100 checkpoints per project
   - Auto-prune after 30 days
   - Compress checkpoints > 7 days old
   - Configurable storage limits

3. **Reliability**
   - Atomic checkpoint operations
   - Corruption detection
   - Graceful degradation if checkpoints unavailable

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────┐
│         LLMAgent (Main Orchestrator)        │
├─────────────────────────────────────────────┤
│  processUserMessage()                       │
│  └─> Creates checkpoints before file ops   │
└────────────────┬────────────────────────────┘
                 │
                 ├─────────────────────────────┐
                 │                             │
                 ▼                             ▼
    ┌────────────────────────┐   ┌────────────────────────┐
    │  CheckpointManager     │   │  TextEditorTool        │
    ├────────────────────────┤   ├────────────────────────┤
    │ createCheckpoint()     │◄──│ execute()              │
    │ listCheckpoints()      │   │  └─> Before write      │
    │ applyCheckpoint()      │   └────────────────────────┘
    │ pruneCheckpoints()     │
    └────────────┬───────────┘
                 │
                 ▼
    ┌────────────────────────┐
    │  CheckpointStorage     │
    ├────────────────────────┤
    │ save()                 │
    │ load()                 │
    │ list()                 │
    │ delete()               │
    └────────────────────────┘
                 │
                 ▼
          .ax-cli/checkpoints/
```

### Component Breakdown

#### 1. CheckpointManager

**Responsibility:** Coordinate checkpoint creation, listing, and application

**Interface:**
```typescript
interface CheckpointManager {
  // Create checkpoint with current state
  createCheckpoint(options: CheckpointOptions): Promise<Checkpoint>;

  // List available checkpoints
  listCheckpoints(filter?: CheckpointFilter): Promise<Checkpoint[]>;

  // Apply checkpoint (restore state)
  applyCheckpoint(checkpointId: string): Promise<void>;

  // Delete old checkpoints
  pruneCheckpoints(): Promise<void>;

  // Get checkpoint details
  getCheckpoint(checkpointId: string): Promise<Checkpoint | null>;
}

interface CheckpointOptions {
  description?: string;         // User-provided description
  files: FileSnapshot[];         // Files to snapshot
  conversationState: ChatEntry[]; // Conversation at this point
  metadata?: Record<string, any>; // Extra metadata
}

interface Checkpoint {
  id: string;                    // Unique checkpoint ID (UUID)
  timestamp: Date;               // When checkpoint was created
  description: string;           // Auto-generated or user-provided
  files: FileSnapshot[];         // Snapshotted files
  conversationState: ChatEntry[]; // Conversation state
  metadata: Record<string, any>; // Extra metadata
}

interface FileSnapshot {
  path: string;                  // Absolute file path
  content: string;               // File content at checkpoint time
  hash: string;                  // SHA-256 hash for integrity
}

interface CheckpointFilter {
  since?: Date;                  // After this date
  until?: Date;                  // Before this date
  limit?: number;                // Max results
  filesChanged?: string[];       // Filter by files changed
}
```

#### 2. CheckpointStorage

**Responsibility:** Persist checkpoints to disk

**Interface:**
```typescript
interface CheckpointStorage {
  // Save checkpoint to disk
  save(checkpoint: Checkpoint): Promise<void>;

  // Load checkpoint from disk
  load(checkpointId: string): Promise<Checkpoint | null>;

  // List all checkpoint IDs
  list(): Promise<string[]>;

  // Delete checkpoint
  delete(checkpointId: string): Promise<void>;

  // Compress old checkpoints
  compress(checkpointId: string): Promise<void>;

  // Get storage stats
  getStats(): Promise<StorageStats>;
}

interface StorageStats {
  totalCheckpoints: number;
  totalSize: number;            // Bytes
  oldestCheckpoint: Date;
  newestCheckpoint: Date;
  compressedCount: number;
}
```

#### 3. Integration Points

**TextEditorTool Integration:**
```typescript
// In text-editor.ts execute()
async execute(args: { operation: string; path?: string; content?: string }): Promise<ToolResult> {
  // BEFORE any file modification:
  if (operation === 'write' || operation === 'edit') {
    await this.createCheckpointIfNeeded(args.path);
  }

  // Proceed with normal operation
  const result = await this.performOperation(args);

  return result;
}

private async createCheckpointIfNeeded(path: string): Promise<void> {
  const manager = getCheckpointManager();
  const content = fs.existsSync(path) ? fs.readFileSync(path, 'utf-8') : '';

  await manager.createCheckpoint({
    description: `Before modifying ${path}`,
    files: [{ path, content, hash: sha256(content) }],
    conversationState: this.agent.getChatHistory(),
  });
}
```

**Slash Command Integration:**
```typescript
// Add to index.ts slash commands
if (trimmedInput === '/rewind') {
  await handleRewindCommand(agent);
  continue;
}

async function handleRewindCommand(agent: LLMAgent) {
  const manager = getCheckpointManager();
  const checkpoints = await manager.listCheckpoints({ limit: 20 });

  if (checkpoints.length === 0) {
    console.log('No checkpoints available');
    return;
  }

  // Show interactive selection UI
  const selected = await showCheckpointSelector(checkpoints);

  if (selected) {
    const confirm = await confirmRewind(selected);
    if (confirm) {
      await manager.applyCheckpoint(selected.id);
      console.log(`✅ Rewound to checkpoint: ${selected.description}`);
    }
  }
}
```

---

## Storage Format

### Directory Structure

```
.ax-cli/
├── checkpoints/
│   ├── metadata.json           # Index of all checkpoints
│   ├── 2025-11-20/             # Organized by date
│   │   ├── checkpoint-abc123.json
│   │   ├── checkpoint-def456.json
│   │   └── checkpoint-ghi789.json.gz  # Compressed (7+ days old)
│   └── 2025-11-19/
│       └── checkpoint-jkl012.json
└── config.json
```

### Checkpoint File Format

```json
{
  "id": "abc123def456",
  "timestamp": "2025-11-20T10:30:45.123Z",
  "description": "Before modifying src/index.ts",
  "files": [
    {
      "path": "/Users/user/project/src/index.ts",
      "content": "// File content here...",
      "hash": "sha256:abcdef123456..."
    }
  ],
  "conversationState": [
    {
      "type": "user",
      "content": "Refactor the authentication module",
      "timestamp": "2025-11-20T10:30:40.000Z"
    },
    {
      "type": "assistant",
      "content": "I'll refactor the authentication...",
      "timestamp": "2025-11-20T10:30:42.000Z"
    }
  ],
  "metadata": {
    "model": "glm-4.6",
    "toolRounds": 5,
    "triggeredBy": "text_editor_tool"
  }
}
```

### Metadata Index

```json
{
  "checkpoints": [
    {
      "id": "abc123",
      "timestamp": "2025-11-20T10:30:45.123Z",
      "description": "Before modifying src/index.ts",
      "filesChanged": ["src/index.ts"],
      "compressed": false
    },
    {
      "id": "def456",
      "timestamp": "2025-11-20T09:15:30.456Z",
      "description": "Before modifying tests/auth.test.ts",
      "filesChanged": ["tests/auth.test.ts"],
      "compressed": true
    }
  ],
  "stats": {
    "totalCount": 2,
    "totalSize": 45678,
    "oldestDate": "2025-11-19T08:00:00.000Z"
  }
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (Priority 1)

**Files to Create:**
1. `src/checkpoint/manager.ts` - CheckpointManager class
2. `src/checkpoint/storage.ts` - CheckpointStorage class
3. `src/checkpoint/types.ts` - TypeScript interfaces
4. `src/checkpoint/index.ts` - Exports

**Files to Modify:**
1. `src/tools/text-editor.ts` - Add checkpoint creation before writes
2. `src/index.ts` - Add `/rewind` command
3. `src/agent/llm-agent.ts` - Add checkpoint awareness

**Tasks:**
- [ ] Create checkpoint directory structure
- [ ] Implement CheckpointManager
- [ ] Implement CheckpointStorage
- [ ] Add Zod schemas for validation
- [ ] Write unit tests (90%+ coverage)

### Phase 2: UI Integration (Priority 2)

**Files to Create:**
1. `src/ui/components/checkpoint-selector.tsx` - Interactive selection UI
2. `src/ui/components/checkpoint-preview.tsx` - Preview diff before applying

**Files to Modify:**
1. `src/ui/components/chat-interface.tsx` - Show checkpoint indicators

**Tasks:**
- [ ] Create checkpoint selector UI
- [ ] Add diff preview functionality
- [ ] Show "💾 Checkpoint created" notifications
- [ ] Add keyboard shortcut (future: Esc+Esc)

### Phase 3: Advanced Features (Priority 3)

**Tasks:**
- [ ] Implement checkpoint compression (gzip)
- [ ] Add auto-pruning (30-day limit)
- [ ] Add storage stats dashboard
- [ ] Add checkpoint search/filter
- [ ] Add checkpoint export/import

---

## User Experience

### Automatic Checkpoint Creation

```bash
$ ax-cli

You: Refactor the authentication module

AI: I'll refactor the authentication. Let me start by reading the current implementation.

[Tool: read_file - src/auth.ts]
[Tool: text_editor - write src/auth.ts]
💾 Checkpoint created: Before modifying src/auth.ts

AI: I've refactored the authentication module...
```

### Rewind Command

```bash
You: /rewind

📋 Available Checkpoints (last 20):

1. 2025-11-20 10:30:45 - Before modifying src/index.ts
   Files: src/index.ts

2. 2025-11-20 09:15:30 - Before modifying tests/auth.test.ts
   Files: tests/auth.test.ts

3. 2025-11-20 08:45:12 - Before modifying src/utils/helper.ts
   Files: src/utils/helper.ts

Select checkpoint (1-3, or 'q' to quit): 1

📄 Preview Changes:
───────────────────────────────────────────
File: src/index.ts

Current (lines 15-25):
  export function main() {
    const newImplementation = refactored();
    return newImplementation;
  }

Checkpoint (lines 15-25):
  export function main() {
    const oldImplementation = legacy();
    return oldImplementation;
  }
───────────────────────────────────────────

⚠️  This will restore 1 file to its previous state.
Continue? (y/N): y

✅ Rewound to checkpoint: Before modifying src/index.ts
Files restored: src/index.ts
Conversation rewound to: 2025-11-20 10:30:40
```

---

## Configuration

### Settings Schema

```typescript
// In .ax-cli/settings.json or ~/.ax-cli/config.json
interface CheckpointConfig {
  enabled: boolean;                 // Enable/disable checkpoints
  maxCheckpoints: number;           // Max checkpoints to keep (default: 100)
  autoCompress: boolean;            // Auto-compress old checkpoints (default: true)
  compressAfterDays: number;        // Compress after N days (default: 7)
  pruneAfterDays: number;           // Delete after N days (default: 30)
  createBeforeOperations: string[]; // Operations to checkpoint before (default: ['write', 'edit'])
  storageLimit: number;             // Max storage in MB (default: 100)
}
```

### Default Configuration

```json
{
  "checkpoint": {
    "enabled": true,
    "maxCheckpoints": 100,
    "autoCompress": true,
    "compressAfterDays": 7,
    "pruneAfterDays": 30,
    "createBeforeOperations": ["write", "edit", "delete"],
    "storageLimit": 100
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/checkpoint/manager.test.ts
describe('CheckpointManager', () => {
  it('creates checkpoint with file snapshot', async () => {
    const manager = new CheckpointManager();
    const checkpoint = await manager.createCheckpoint({
      description: 'Test checkpoint',
      files: [{ path: '/test.ts', content: 'test', hash: 'hash123' }],
      conversationState: [],
    });

    expect(checkpoint.id).toBeDefined();
    expect(checkpoint.files).toHaveLength(1);
  });

  it('lists checkpoints with filters', async () => {
    // Test checkpoint filtering
  });

  it('applies checkpoint and restores files', async () => {
    // Test checkpoint application
  });

  it('prunes old checkpoints', async () => {
    // Test auto-pruning
  });
});

// tests/checkpoint/storage.test.ts
describe('CheckpointStorage', () => {
  it('saves checkpoint to disk', async () => {
    // Test persistence
  });

  it('compresses old checkpoints', async () => {
    // Test compression
  });

  it('handles corrupted checkpoints gracefully', async () => {
    // Test error handling
  });
});
```

### Integration Tests

```typescript
// tests/integration/checkpoint.test.ts
describe('Checkpoint Integration', () => {
  it('creates checkpoint before file write', async () => {
    // Test TextEditorTool integration
  });

  it('restores conversation state on rewind', async () => {
    // Test conversation restoration
  });

  it('handles multiple file checkpoints', async () => {
    // Test multi-file snapshots
  });
});
```

---

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**
   - Load checkpoint metadata only (not full content)
   - Load full content only when needed (preview/apply)

2. **Background Operations**
   - Compress checkpoints in background thread
   - Prune checkpoints asynchronously

3. **Caching**
   - Cache recent checkpoints in memory
   - Cache metadata index for fast listing

4. **Diff Storage** (Future Enhancement)
   - Store diffs instead of full snapshots for efficiency
   - Reconstruct files from diffs on demand

---

## Security Considerations

1. **File Hash Verification**
   - SHA-256 hash for integrity checks
   - Detect corruption before applying

2. **Path Validation**
   - Validate file paths before restoration
   - Prevent directory traversal attacks

3. **Storage Limits**
   - Enforce max checkpoint count
   - Enforce max storage size
   - Prevent disk space exhaustion

---

## Future Enhancements

1. **Diff-Based Storage** - Store only changes, not full snapshots
2. **Keyboard Shortcut** - Esc+Esc to trigger rewind (like Claude Code)
3. **Git Integration** - Link checkpoints with git commits
4. **Cloud Backup** - Optional cloud storage for checkpoints
5. **Checkpoint Branches** - Multiple rewind paths (like git branches)
6. **Visual Timeline** - Graph view of checkpoints
7. **Smart Descriptions** - AI-generated checkpoint descriptions
8. **Checkpoint Annotations** - User-added notes/tags

---

## Success Metrics

1. **Performance**
   - Checkpoint creation < 50ms (95th percentile)
   - Rewind operation < 500ms (95th percentile)

2. **Storage**
   - Average checkpoint size < 50KB
   - Compression ratio > 70% for old checkpoints

3. **Reliability**
   - 99.9% checkpoint success rate
   - 0% data corruption rate

4. **User Adoption**
   - 80% of users with checkpoints enabled
   - Average 20+ checkpoints per project
   - Rewind used 5+ times per week per active user

---

**Status:** Ready for Implementation
**Priority:** High
**Estimated Effort:** 3-5 days (1 developer)
