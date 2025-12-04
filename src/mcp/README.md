# MCP Module

Model Context Protocol (MCP) client implementation for AX CLI.

## Overview

This module provides MCP server management capabilities including:
- Server lifecycle management (add, remove, shutdown)
- Multiple transport types (stdio, HTTP, SSE)
- Tool execution via MCP servers
- Configuration loading and validation

## Architecture

The MCP module uses a layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    MCPManager (v1)                       │
│              Backward-compatible wrapper                 │
│                  (throws on errors)                      │
├─────────────────────────────────────────────────────────┤
│                   MCPManagerV2 (v2)                      │
│            Type-safe with Result types                   │
│              (recommended for new code)                  │
├─────────────────────────────────────────────────────────┤
│                     Transports                           │
│         stdio | HTTP | SSE | Content-Length              │
├─────────────────────────────────────────────────────────┤
│                  MCP SDK (@modelcontextprotocol/sdk)     │
└─────────────────────────────────────────────────────────┘
```

## Module Organization

### Core API

| File | Purpose |
|------|---------|
| `client.ts` | MCPManager v1 API (legacy, throws on errors) |
| `client-v2.ts` | MCPManagerV2 v2 API (recommended, Result types) |

### Configuration

| File | Purpose |
|------|---------|
| `config.ts` | Config loading, server add/remove, templates |
| `config-detector.ts` | Auto-detect config format |
| `config-migrator.ts` | Migrate between config formats |

### Transports

| File | Purpose |
|------|---------|
| `transports.ts` | Transport factory and types |
| `content-length-transport.ts` | LSP-style Content-Length framing |

### Features (MCP 2025-06-18 Spec)

| File | Purpose |
|------|---------|
| `progress.ts` | Progress tracking for long operations |
| `cancellation.ts` | Request cancellation support |
| `subscriptions.ts` | Resource change subscriptions |
| `schema-validator.ts` | Tool output schema validation |

### Utilities

| File | Purpose |
|------|---------|
| `constants.ts` | Centralized timeouts, limits, error codes |
| `type-safety.ts` | Brand types, Result types, toError |
| `mutex-safe.ts` | Thread-safe mutex with linear types |
| `error-formatter.ts` | User-friendly error messages |
| `error-remediation.ts` | Error pattern matching and hints |
| `resources.ts` | MCP resource reference resolution |
| `prompts.ts` | MCP prompt utilities |

### Z.AI Integration

| File | Purpose |
|------|---------|
| `zai-templates.ts` | Z.AI MCP server templates |
| `zai-detector.ts` | Z.AI service detection and validation |

## Usage

### Recommended: v2 API with Brand Types

```typescript
import {
  MCPManagerV2,
  createServerName,
  createToolName,
  Ok,
  Err,
} from '../mcp/index.js';

// Create manager
const manager = new MCPManagerV2();

// Use brand types for type safety
const serverName = createServerName('github');
if (!serverName) {
  throw new Error('Invalid server name');
}

// Add server with Result type
const result = await manager.addServerV2(serverName, {
  transport: { type: 'stdio', command: 'npx', args: ['-y', '@mcp/github'] }
});

if (!result.success) {
  console.error('Failed:', result.error);
  return;
}

// Call tool
const toolResult = await manager.callToolV2(
  serverName,
  createToolName('create_issue')!,
  { title: 'Bug report', body: 'Description...' }
);
```

### Legacy: v1 API

```typescript
import { MCPManager } from '../mcp/index.js';

const manager = new MCPManager();

try {
  await manager.addServer('github', {
    transport: { type: 'stdio', command: 'npx', args: ['-y', '@mcp/github'] }
  });

  const result = await manager.callTool('github', 'create_issue', { ... });
} catch (error) {
  console.error('Failed:', error);
}
```

## Constants

The module uses centralized constants from `constants.ts`:

```typescript
import { MCP_TIMEOUTS, MCP_LIMITS, MCP_ERROR_CODES } from '../mcp/index.js';

// Timeouts (in milliseconds)
MCP_TIMEOUTS.DEFAULT_TOOL_CALL  // 60,000 (60s)
MCP_TIMEOUTS.STARTUP            // 30,000 (30s)
MCP_TIMEOUTS.HEALTH_CHECK_INTERVAL // 60,000 (60s)

// Limits
MCP_LIMITS.MAX_BUFFER_SIZE      // 100 MB
MCP_LIMITS.MAX_RECONNECT_ATTEMPTS // 5
MCP_LIMITS.MAX_SERVER_NAME_LENGTH // 64 chars
MCP_LIMITS.MAX_TOOL_NAME_LENGTH   // 128 chars

// Error codes (JSON-RPC)
MCP_ERROR_CODES.CANCELLED       // -32800
```

## Type Safety

### Brand Types

Brand types prevent mixing up different string IDs:

```typescript
import { createServerName, createToolName, type ServerName, type ToolName } from '../mcp/index.js';

// These are distinct types - can't accidentally swap them
const server: ServerName = createServerName('github')!;
const tool: ToolName = createToolName('create_issue')!;

// Compile-time error: Type 'ToolName' is not assignable to type 'ServerName'
// callTool(tool, server, args);  // Won't compile!
```

### Result Types

Explicit error handling without exceptions:

```typescript
import { Result, Ok, Err, mapResult, andThen } from '../mcp/index.js';

function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) return Err(new Error('Division by zero'));
  return Ok(a / b);
}

const result = divide(10, 2);
if (result.success) {
  console.log('Result:', result.value);  // 5
} else {
  console.error('Error:', result.error);
}

// Chain operations
const chained = andThen(
  divide(10, 2),
  (x) => divide(x, 2)
);
```

## Error Handling

### Error Remediation

The module provides pattern-based error hints:

```typescript
import { matchErrorPattern, getTransportHints } from '../mcp/index.js';

const error = new Error('ENOENT: no such file');
const remediation = matchErrorPattern(error);

if (remediation) {
  console.log(remediation.title);  // "Command not found"
  console.log(remediation.hints);  // ["Check if command is installed", ...]
  console.log(remediation.command);  // "which <command>"
}
```

## Thread Safety

### SafeMutex

Linear type enforcement prevents double-release bugs:

```typescript
import { SafeMutex } from '../mcp/mutex-safe.js';

const mutex = new SafeMutex();

// Acquire returns a token that must be released exactly once
const token = await mutex.acquire('operation-name');
try {
  // Critical section
} finally {
  token.release();  // Must be called exactly once
  // token.release();  // Second call throws error!
}

// Or use runExclusive for automatic cleanup
const result = await mutex.runExclusive('operation', async () => {
  // Critical section
  return computeValue();
});
```

## Testing

Tests are located in `tests/mcp/`:

```bash
# Run all MCP tests
pnpm test tests/mcp/

# Run specific test file
npx vitest run tests/mcp/mutex-safe.test.ts
npx vitest run tests/mcp/type-safety.test.ts
```

## Related Documentation

- [ADR-003: MCP Module Consolidation](../../docs/adr/003-mcp-consolidation.md)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
