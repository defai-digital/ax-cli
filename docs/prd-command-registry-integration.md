# PRD: Command Registry Integration

## Overview

Integrate the new `CommandRegistry` system into `use-input-handler.ts` to dispatch slash commands through the registry instead of inline handlers.

## Goals

1. **Reduce code in use-input-handler.ts** - From 2780 lines to ~800 lines
2. **Enable command dispatch via registry** - Single entry point for command execution
3. **Maintain backward compatibility** - All existing commands work identically
4. **Support streaming commands** - Keep streaming handlers inline but registry-aware

## Non-Goals

- Extracting streaming commands (`/continue`, `/retry`, `/commit-and-push`) - Future work
- Changing command behavior - Only changing dispatch mechanism
- Adding new commands - Focus on migration only

## Architecture

### Current Flow
```
User Input → use-input-handler.ts → 35 inline if/else handlers → Response
```

### New Flow
```
User Input → use-input-handler.ts → CommandRegistry.execute() → Handler → Response
                                  ↓
                          (streaming commands remain inline)
```

## Implementation Plan

### Phase 1: Initialize Registry on App Startup

**File:** `packages/core/src/commands/handlers/index.ts`

Add initialization function that registers all built-in commands.

### Phase 2: Create Command Context Builder

**File:** `packages/core/src/ui/hooks/use-input-handler.ts`

Create a function that builds `CommandContext` from hook props and state.

### Phase 3: Add Registry Dispatch

**File:** `packages/core/src/ui/hooks/use-input-handler.ts`

Add early dispatch to registry before inline handlers. Pattern:

```typescript
// Try registry first for non-streaming commands
const registry = getCommandRegistry();
const parsed = registry.parse(trimmedInput);

if (parsed.isSlashCommand && registry.has(parsed.command)) {
  const ctx = buildCommandContext(/* ... */);
  const result = await registry.execute(trimmedInput, ctx);

  if (result.handled) {
    if (result.entries) setChatHistory(prev => [...prev, ...result.entries]);
    if (result.asyncAction) await result.asyncAction();
    if (result.clearInput) clearInput();
    if (result.setProcessing) setIsProcessing(result.setProcessing);
    return true;
  }
}

// Fall through to streaming handlers...
```

### Phase 4: Remove Migrated Inline Handlers

Remove inline handlers for commands now in registry:
- `/help`, `/shortcuts`, `/terminal-setup`, `/commands`
- `/exit`, `/clear`
- `/tasks`, `/task`, `/kill`
- `/doctor`, `/usage`
- `/theme`, `/model`, `/permissions`
- `/init`
- `/memory`, `/memory warmup`, `/memory refresh`
- `/mcp`

### Phase 5: Update Command Suggestions

Replace hardcoded suggestions with registry-based generation:

```typescript
const commandSuggestions = useMemo(() => {
  const registry = getCommandRegistry();
  const builtIn = registry.getAll().map(cmd => ({
    command: `/${cmd.name}`,
    description: cmd.description,
  }));

  // Add streaming commands (not in registry)
  const streaming = [
    { command: "/continue", description: "Continue incomplete response" },
    { command: "/retry", description: "Re-send the last message" },
    { command: "/commit-and-push", description: "AI commit & push to remote" },
  ];

  // Add custom commands and MCP prompts...
  return [...builtIn, ...streaming, ...customSuggestions, ...mcpPromptSuggestions];
}, []);
```

## Success Criteria

1. ✅ All 20+ extracted commands work via registry dispatch
2. ✅ Streaming commands (`/continue`, `/retry`, `/commit-and-push`) work unchanged
3. ✅ Command suggestions include all commands
4. ✅ Build passes with no TypeScript errors
5. ✅ `use-input-handler.ts` reduced to <1000 lines

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing commands | Test each command after migration |
| Performance regression | Registry lookup is O(1) via Map |
| State management issues | CommandContext passes all necessary state setters |

## Files Modified

| File | Change |
|------|--------|
| `commands/handlers/index.ts` | Add `initializeCommandRegistry()` |
| `ui/hooks/use-input-handler.ts` | Add registry dispatch, remove inline handlers |
| `commands/registry.ts` | No changes needed |

## Timeline

- Phase 1-2: 10 minutes
- Phase 3: 15 minutes
- Phase 4: 30 minutes (careful removal)
- Phase 5: 10 minutes
- Testing: 15 minutes

**Total: ~1.5 hours**
