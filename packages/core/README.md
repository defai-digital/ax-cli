# AX-Core - Shared Core Library

[![npm version](https://img.shields.io/npm/v/@defai.digital/ax-core.svg)](https://www.npmjs.com/package/@defai.digital/ax-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Core library for the AX CLI ecosystem** - Shared tools, React UI components, MCP client, LLM agent infrastructure, and AutomatosX integration.

> **Note**: This package is automatically installed as a dependency. You typically don't need to install it directly.

## Installation

```bash
# Usually installed automatically as a dependency
npm install @defai.digital/ax-core
```

## What's Included

### 17 Built-in Tools
- File operations: `view_file`, `create_file`, `str_replace_editor`
- Search: `search_files`, `list_files`, `grep`
- Execution: `bash`, `execute_bash`
- Utilities: `todo`, `ask_user`, `web_search`, and more

### MCP Client
- Model Context Protocol support
- 12+ production-ready templates (GitHub, Figma, Vercel, etc.)
- SSE and HTTP transports

### LLM Agent Infrastructure
- Context management with automatic pruning
- Subagent orchestration for parallel tasks
- Loop detection and recovery
- Checkpoint and rewind system

### React/Ink UI Components
- Terminal-based UI components
- Streaming message display
- Progress indicators and status bars

### Provider Support
- GLM (Z.AI) with thinking mode
- Grok (xAI) with web search
- Local models via Ollama/LMStudio

## Subpath Exports

```typescript
import { runCLI, GLM_PROVIDER, GROK_PROVIDER } from '@defai.digital/ax-core';
import { LLMAgent } from '@defai.digital/ax-core/agent';
import { getSettingsManager } from '@defai.digital/ax-core/utils';
import { MCPManager } from '@defai.digital/ax-core/mcp';
import { createToolRegistry } from '@defai.digital/ax-core/tools';
```

## Part of AX CLI Ecosystem

| Package | Description |
|---------|-------------|
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | Shared core library (this package) |
| [@defai.digital/ax-glm](https://www.npmjs.com/package/@defai.digital/ax-glm) | GLM-optimized CLI |
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | Grok-optimized CLI |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Local-first CLI |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | Shared Zod schemas |

## Documentation

- [Full Documentation](https://github.com/defai-digital/ax-cli#readme)
- [Architecture](https://github.com/defai-digital/ax-cli#architecture)

## License

MIT License - see [LICENSE](https://github.com/defai-digital/ax-cli/blob/main/LICENSE)

---

Made with love by [DEFAI Digital](https://github.com/defai-digital)
