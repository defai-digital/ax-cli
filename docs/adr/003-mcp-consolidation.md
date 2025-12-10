# ADR-003: MCP Module Consolidation
Last reviewed: 2025-02-21  
Status: Accepted (historical) — kept for reference.

## Status
**Accepted** - Implemented 2025-11-27

## Context

The MCP (Model Context Protocol) module had accumulated technical debt:

1. **Version Proliferation**: Parallel v1 and v2 implementations
2. **Unused Code**: Several v2 files were prepared but never integrated
3. **No Clean API**: Missing barrel export file for clean imports
4. **Confusing Structure**: Unclear which version to use for what purpose

### Files Before Consolidation

```
src/mcp/
├── client.ts              # v1 wrapper around client-v2
├── client-v2.ts           # Actual implementation with brand types
├── config.ts              # v1 config (used)
├── config-v2.ts           # v2 config (unused)
├── config-detector.ts     # v1 detector (used)
├── config-detector-v2.ts  # v2 detector (unused)
├── config-migrator.ts     # v1 migrator (used)
├── config-migrator-v2.ts  # v2 migrator (unused)
├── transports.ts          # v1 transports (used)
├── transports-v2.ts       # v2 transports (unused)
├── detection.ts           # MCP detection
└── resources.ts           # MCP resources
```

**Total**: 9,445 LOC across 12 files

## Decision

Consolidate to a clean, single-version architecture:

1. **Remove unused v2 files**: Delete files that were prepared but never integrated
2. **Keep working v2 implementation**: `client-v2.ts` is the real implementation
3. **Add barrel export**: Create `index.ts` for clean module API
4. **Maintain backward compatibility**: Keep `client.ts` as wrapper

### Files Removed

| File | Reason |
|------|--------|
| `config-v2.ts` | Never integrated, v1 config used throughout |
| `config-detector-v2.ts` | Never integrated, v1 detector used |
| `config-migrator-v2.ts` | Never integrated, v1 migrator used |
| `transports-v2.ts` | Never integrated, v1 transports used |

### Files After Consolidation

```
src/mcp/
├── index.ts               # NEW: Clean barrel exports
├── client.ts              # v1 API wrapper (backward compat)
├── client-v2.ts           # Actual implementation
├── config.ts              # Configuration
├── config-detector.ts     # Detection logic
├── config-migrator.ts     # Migration logic
├── transports.ts          # Transport implementations
├── detection.ts           # MCP detection
└── resources.ts           # MCP resources
```

**Total**: 7,510 LOC across 9 files (-20%)

## Implementation

### Barrel Export (`src/mcp/index.ts`)

```typescript
/**
 * MCP Module - Clean Public API
 *
 * This module provides Model Context Protocol functionality with type-safe
 * server and tool name handling using branded types.
 */

// Core client - backward-compatible wrapper (v1 API)
export { MCPManager } from "./client.js";
export type { MCPTool, MCPServerConfig, MCPTransportConfig } from "./client.js";

// Type-safe client (v2 API) - recommended for new code
export { MCPManagerV2, createServerName, createToolName } from "./client-v2.js";
export type {
  ServerName,
  ToolName,
  MCPServerConfigV2,
  MCPToolV2,
} from "./client-v2.js";

// Configuration
export { loadMCPConfig, saveMCPConfig } from "./config.js";
export type { MCPConfig } from "./config.js";

// Transports
export {
  createTransport,
  StdioTransport,
  HTTPTransport,
  SSETransport,
} from "./transports.js";

// Detection
export { detectMCPConfig, isMCPConfigured } from "./detection.js";

// Migration
export { migrateMCPConfig } from "./config-migrator.js";

// Resources
export { MCPResourceManager } from "./resources.js";
```

## Consequences

### Positive

- **Cleaner API**: Single import point for all MCP functionality
- **Reduced Confusion**: Clear which files are active vs legacy
- **Smaller Footprint**: 20% LOC reduction
- **Maintained Compatibility**: Existing code using v1 API still works

### Negative

- **Removed Tests**: 24 tests in `config-v2.integration.test.ts` removed with unused files

### Migration Path

For new code, use v2 API with brand types:

```typescript
// New code - use v2 with brand types
import { MCPManagerV2, createServerName, createToolName } from '../mcp/index.js';

const serverName = createServerName('my-server');  // Type-safe
const toolName = createToolName('my-tool');        // Type-safe
```

For existing code, v1 API continues to work:

```typescript
// Legacy code - still works
import { MCPManager } from '../mcp/index.js';
```

## Verification

- All 2,059 tests passing (after removing 24 tests for deleted files)
- TypeScript strict mode clean
- No functional regressions
- LOC reduction verified: 9,445 → 7,510 (-1,935 lines, 20%)
