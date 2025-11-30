# Type Governance

This document defines the governance rules for the `@ax-cli/schemas` package, which serves as the **Single Source of Truth (SSOT)** for all shared types in the ax-cli ecosystem.

## Core Principles

1. **SSOT**: All shared types MUST be defined in this package
2. **No Duplication**: Types defined here MUST NOT be duplicated elsewhere
3. **Backward Compatibility**: Breaking changes require major version bump
4. **Extension Over Duplication**: Main package can extend schema types (e.g., with concrete implementations like `LLMToolCall`), but must not redefine the base structure

## Type Categories

### Core Types (`src/public/core/`)

| Type | Purpose | Breaking Change Policy |
|------|---------|------------------------|
| Brand Types | Phantom types for ID safety | Major version only |
| ID Types | Branded identifiers (UserId, SessionId, etc.) | Major version only |
| Enums | Shared enumerations | Minor version for additions, major for removals |

### Agent Types (`src/public/agent/`)

| Type | Purpose | Breaking Change Policy |
|------|---------|------------------------|
| `ChatEntry` | Chat history entries | Major version only |
| `StreamingChunk` | Streaming response chunks | Major version only |
| `AccumulatedMessage` | Accumulated streaming content | Major version only |
| `LLMToolCallRef` | Reference type for tool calls | Major version only |
| `ToolResultRef` | Reference type for tool results | Major version only |

## Extension Pattern

When the main `ax-cli` package needs to use concrete types (like OpenAI SDK types), it should **extend** the schema types rather than duplicate them:

```typescript
// CORRECT: Extend schema type
import type { ChatEntry as SchemaChatEntry } from '@ax-cli/schemas';
import type { LLMToolCall } from '../llm/client.js';

export interface ChatEntry extends Omit<SchemaChatEntry, 'toolCalls' | 'toolCall'> {
  toolCalls?: LLMToolCall[];  // Concrete type from OpenAI SDK
  toolCall?: LLMToolCall;
}

// INCORRECT: Duplicate the type
export interface ChatEntry {
  type: "user" | "assistant" | "tool_result" | "tool_call";
  content: string;
  // ... (duplicating all properties)
}
```

## Adding New Types

1. Create the type in the appropriate category directory
2. Export from the category's `index.ts`
3. Export from the main `src/index.ts`
4. Add to this governance document
5. Update tests if needed

## Modifying Existing Types

1. **Adding optional properties**: Minor version bump
2. **Adding required properties**: Major version bump (breaking)
3. **Removing properties**: Major version bump (breaking)
4. **Changing property types**: Major version bump (breaking)

## Review Checklist

Before merging type changes:

- [ ] Type is in the correct category
- [ ] Type is exported from main index
- [ ] No duplication in main `ax-cli` package
- [ ] Tests pass
- [ ] VERSION is appropriately bumped
- [ ] This document is updated if new type category added

## Related Files

- `src/index.ts` - Main exports
- `src/public/core/` - Core types (brand, ID, enums)
- `src/public/agent/` - Agent types (chat, streaming)
