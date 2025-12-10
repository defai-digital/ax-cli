# ADR-001: Type Consolidation
Last reviewed: 2025-02-21  
Status: Accepted (historical) — kept for reference.

## Status
**Accepted** - Implemented 2025-11-26

## Context

The AX-CLI codebase had type definitions scattered across multiple files, leading to:

1. **Type Duplication**: `ChatEntry`, `StreamingChunk`, and `AccumulatedMessage` were defined in multiple places
2. **Inconsistent Imports**: Different parts of the codebase imported the same types from different locations
3. **Maintenance Burden**: Changes to shared types required updates in multiple files
4. **Risk of Drift**: Duplicated types could diverge over time, causing subtle bugs

### Specific Issues Found

- `ChatEntry` defined in both `src/agent/llm-agent.ts` and `packages/schemas/src/agent/`
- `StreamingChunk` types inconsistent between streaming handlers
- `ToolResult` had variations across tool implementations

## Decision

Consolidate all shared types into the `@ax-cli/schemas` package as the Single Source of Truth (SSOT).

### Implementation Strategy

1. **Move types to `@ax-cli/schemas`**:
   - `ChatEntry` → `packages/schemas/src/agent/chat-types.ts`
   - `StreamingChunk` → `packages/schemas/src/agent/streaming-types.ts`
   - `AccumulatedMessage` → `packages/schemas/src/agent/message-types.ts`

2. **Use re-exports for backward compatibility**:
   - Original files re-export from schemas package
   - No breaking changes for existing consumers

3. **Add brand types for ID safety**:
   - `ServerName`, `ToolName` branded types prevent ID mixing
   - Compile-time safety for MCP identifiers

## Consequences

### Positive

- **Single Source of Truth**: All types defined in one place
- **Consistent Imports**: All consumers import from `@ax-cli/schemas`
- **Type Safety**: Brand types prevent ID mixing bugs
- **Easier Maintenance**: Type changes only need one update

### Negative

- **Build Dependency**: `@ax-cli/schemas` must build before main package
- **Indirection**: One more package to navigate

### Neutral

- **Migration Effort**: Required updating ~50 import statements (one-time cost)

## Implementation Details

```typescript
// packages/schemas/src/agent/chat-types.ts
export interface ChatEntry {
  type: "user" | "assistant" | "tool_result" | "tool_call";
  content: string;
  timestamp: Date;
  toolCalls?: LLMToolCall[];
  toolCall?: LLMToolCall;
  toolResult?: { success: boolean; output?: string; error?: string };
  isStreaming?: boolean;
  reasoningContent?: string;
  isReasoningStreaming?: boolean;
}

// Re-export in src/agent/llm-agent.ts for backward compatibility
export type { ChatEntry } from '@ax-cli/schemas';
```

## Verification

- All 2,024 tests passing
- TypeScript strict mode clean
- No runtime behavior changes
