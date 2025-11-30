# AX-CLI Module Dependency Graph

This document describes the high-level module dependencies in the AX-CLI codebase after the architecture revamp (Phases 1-5).

## Module Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLI Entry Point                                 │
│                              (src/index.ts)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Commands Layer                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  setup   │ │   mcp    │ │  doctor  │ │  memory  │ │   init   │ ...      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Agent Layer                                     │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                         LLMAgent (Core)                             │     │
│  │                       src/agent/llm-agent.ts                        │     │
│  │                          (~1,976 LOC)                               │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│           │                    │                    │                        │
│           ▼                    ▼                    ▼                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ ToolExecutor │    │StreamHandler │    │ PlanExecutor │                   │
│  │  execution/  │    │  streaming/  │    │  planning/   │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    Subagent Orchestrator                            │     │
│  │              src/agent/subagent-orchestrator.ts                     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌────────────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│      LLM Client        │ │    Tools Layer   │ │    MCP Client    │
│     src/llm/           │ │   src/tools/     │ │    src/mcp/      │
│  ┌────────────────┐    │ │ ┌──────────────┐ │ │ ┌──────────────┐ │
│  │   client.ts    │    │ │ │  bash-tool   │ │ │ │   client.ts  │ │
│  │   types.ts     │    │ │ │ text-editor  │ │ │ │ client-v2.ts │ │
│  │ tool-defs.ts   │    │ │ │   search     │ │ │ │  config.ts   │ │
│  └────────────────┘    │ │ │    todo      │ │ │ │transports.ts │ │
│                        │ │ │ confirmation │ │ │ └──────────────┘ │
│                        │ │ │  analyzers   │ │ │                  │
│                        │ │ └──────────────┘ │ │                  │
└────────────────────────┘ └──────────────────┘ └──────────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Utilities Layer                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Error     │ │  Security   │ │   Config    │ │    Paths    │           │
│  │  Handling   │ │             │ │             │ │             │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Caching   │ │    Text     │ │   Process   │ │  Analysis   │           │
│  │             │ │ Processing  │ │ Management  │ │             │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Logging   │ │   History   │ │    Init     │ │    Core     │           │
│  │             │ │             │ │             │ │             │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Schemas Package                                    │
│                        @ax-cli/schemas (SSOT)                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  ChatEntry  │ │ Streaming   │ │   Config    │ │    Tool     │           │
│  │   Types     │ │   Types     │ │   Schemas   │ │   Types     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Dependencies

### Agent → Extracted Modules

```
LLMAgent
├── ToolExecutor (src/agent/execution/)
│   ├── Instantiates all tools
│   ├── Parses tool arguments
│   └── Executes tool calls
├── StreamHandler (src/agent/streaming/)
│   ├── Processes LLM chunks
│   ├── Accumulates content
│   └── Tracks usage
└── PlanExecutor (src/agent/planning/)
    ├── Executes task phases
    ├── Builds phase prompts
    └── Manages planning state
```

### LLM Client → External APIs

```
LLMClient (src/llm/client.ts)
├── OpenAI SDK (openai package)
│   └── GLM-4.6 API (z.ai)
├── Rate Limiter (src/utils/rate-limiter.ts)
├── Retry Helper (src/utils/retry-helper.ts)
└── Audit Logger (src/utils/audit-logger.ts)
```

### MCP Client → Transports

```
MCPManager (src/mcp/client.ts)
├── MCPManagerV2 (src/mcp/client-v2.ts)
│   └── Brand types (ServerName, ToolName)
├── Transports (src/mcp/transports.ts)
│   ├── StdioTransport
│   ├── HTTPTransport
│   └── SSETransport
└── Config (src/mcp/config.ts)
```

## Utility Groupings

The `src/utils/` directory is organized into 12 logical groupings (documented in `src/utils/index.ts`):

| Group | Files | Purpose |
|-------|-------|---------|
| Error Handling | 4 | Error extraction, formatting, translation |
| Security | 5 | Command validation, encryption, sanitization |
| Configuration | 4 | Settings, config loading, templates |
| Paths | 3 | Path constants, manipulation, validation |
| Caching | 3 | Generic caching, file caching, rate limiting |
| Text Processing | 5 | Text/string utils, JSON, clipboard |
| Process Management | 3 | Background tasks, process pooling, retry |
| Analysis | 3 | Project analysis, parallel analysis, logging |
| Logging | 3 | Audit, auto-accept, console logging |
| History | 2 | Conversation history, migration |
| Initialization | 4 | Init preview, validation, onboarding |
| Core | 8 | Tokens, usage, version, performance |

## Circular Dependency Prevention

The architecture uses callback-based configuration to prevent circular dependencies:

```typescript
// Instead of:
class LLMAgent {
  constructor() {
    this.toolExecutor = new ToolExecutor(this); // Circular!
  }
}

// We use:
class LLMAgent {
  constructor() {
    this.toolExecutor = new ToolExecutor({
      getConversationHistory: () => this.conversationHistory,
      emitter: this,
    });
  }
}
```

## Import Guidelines

1. **Types**: Always import from `@ax-cli/schemas`
2. **MCP**: Import from `src/mcp/index.js`
3. **Utils**: Import from `src/utils/index.js` or specific files
4. **Agent Modules**: Import from respective index files

```typescript
// Good
import type { ChatEntry } from '@ax-cli/schemas';
import { MCPManager } from '../mcp/index.js';
import { extractErrorMessage } from '../utils/index.js';

// Avoid
import type { ChatEntry } from '../agent/llm-agent.js'; // Use schemas
import { MCPManager } from '../mcp/client.js'; // Use index
```
