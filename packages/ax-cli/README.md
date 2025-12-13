# AX-CLI - Local AI Coding Assistant

[![npm version](https://img.shields.io/npm/v/@defai.digital/ax-cli.svg)](https://www.npmjs.com/package/@defai.digital/ax-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Enterprise-grade AI coding assistant for local/offline models** - Terminal-based vibe coding with Ollama, LMStudio, vLLM, and DeepSeek Cloud support.

## Quick Start

```bash
npm install -g @defai.digital/ax-cli
ax-cli setup
ax-cli
```

## Features

- **Local-First**: Run with Ollama, LMStudio, or vLLM
- **DeepSeek Cloud**: Optional cloud support for DeepSeek models
- **17 Built-in Tools**: File editing, bash execution, search, todos, and more
- **MCP Integration**: Model Context Protocol with 12+ production-ready templates
- **AutomatosX Agents**: 20+ specialized AI agents for complex tasks
- **No API Key Required**: Run completely offline with local models

## Recommended Local Models

| Tier | Model | Best For |
|------|-------|----------|
| **T1** | Qwen 3 (8B/14B/32B/72B) | Best overall - coding leader |
| **T2** | GLM-4.6 (9B/32B) | Best for refactor + docs |
| **T3** | DeepSeek-Coder V2 (7B/16B) | Best speed/value |
| **T4** | Codestral / Mistral | C/C++/Rust systems languages |
| **T5** | Llama 3.1 / CodeLlama | Best fallback - most compatible |

## Usage

### Interactive Mode
```bash
ax-cli              # Start interactive session
ax-cli --continue   # Resume previous conversation
```

### Headless Mode
```bash
ax-cli -p "analyze this codebase"
ax-cli -p "fix TypeScript errors" -d /path/to/project
```

### Essential Commands

| Command | Description |
|---------|-------------|
| `/init` | Initialize project context |
| `/help` | Show all commands |
| `/models` | Switch AI model |
| `/doctor` | Run diagnostics |

## Configuration

```bash
# Config location
~/.ax-cli/config.json    # User settings
.ax-cli/settings.json    # Project overrides
.ax-cli/CUSTOM.md        # Custom AI instructions
```

## Part of AX CLI Ecosystem

| Package | Description |
|---------|-------------|
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Local-first CLI (this package) |
| [@defai.digital/ax-glm](https://www.npmjs.com/package/@defai.digital/ax-glm) | GLM-optimized CLI |
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | Grok-optimized CLI |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | Shared core library |

## Documentation

- [Full Documentation](https://github.com/defai-digital/ax-cli#readme)
- [MCP Integration Guide](https://github.com/defai-digital/ax-cli/blob/main/docs/mcp.md)
- [AutomatosX Guide](https://github.com/defai-digital/ax-cli/blob/main/docs/AutomatosX-Integration.md)

## License

MIT License - see [LICENSE](https://github.com/defai-digital/ax-cli/blob/main/LICENSE)

---

Made with love by [DEFAI Digital](https://github.com/defai-digital)
