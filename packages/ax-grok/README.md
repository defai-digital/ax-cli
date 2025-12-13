# AX-Grok - Grok AI Coding Assistant CLI

[![npm version](https://img.shields.io/npm/v/@defai.digital/ax-grok.svg)](https://www.npmjs.com/package/@defai.digital/ax-grok)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Enterprise-grade AI coding assistant powered by xAI's Grok 4** - Terminal-based vibe coding with extended reasoning, vision, live web search, and MCP integration.

## Quick Start

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

## Features

- **Grok 4 Models**: Most capable reasoning, coding, vision, and search
- **Live Web Search**: Built-in real-time web search capability
- **Vision Support**: Analyze images and screenshots
- **Extended Thinking**: Deep reasoning with `reasoning_effort` parameter
- **17 Built-in Tools**: File editing, bash execution, search, todos, and more
- **MCP Integration**: Model Context Protocol with 12+ production-ready templates
- **AutomatosX Agents**: 20+ specialized AI agents for complex tasks

## Supported Models

| Model | Context | Features |
|-------|---------|----------|
| `grok-4-0709` | 131K | Most capable: reasoning, coding, vision, search (default) |
| `grok-4.1-fast` | 131K | Fast variant with agent tools support |
| `grok-2-image-1212` | 32K | Image generation: text-to-image |

## Usage

### Interactive Mode
```bash
ax-grok              # Start interactive session
ax-grok --continue   # Resume previous conversation
```

### Headless Mode
```bash
ax-grok -p "analyze this codebase"
ax-grok -p "fix TypeScript errors" -d /path/to/project
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
~/.ax-grok/config.json    # User settings (encrypted API key)
.ax-grok/settings.json    # Project overrides
.ax-grok/CUSTOM.md        # Custom AI instructions

# Environment variable
export XAI_API_KEY=your_key
```

## Part of AX CLI Ecosystem

| Package | Description |
|---------|-------------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | Grok-optimized CLI (this package) |
| [@defai.digital/ax-glm](https://www.npmjs.com/package/@defai.digital/ax-glm) | GLM-optimized CLI |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | Shared core library |

## Documentation

- [Full Documentation](https://github.com/defai-digital/ax-cli#readme)
- [MCP Integration Guide](https://github.com/defai-digital/ax-cli/blob/main/docs/mcp.md)
- [AutomatosX Guide](https://github.com/defai-digital/ax-cli/blob/main/docs/AutomatosX-Integration.md)

## License

MIT License - see [LICENSE](https://github.com/defai-digital/ax-cli/blob/main/LICENSE)

---

Made with love by [DEFAI Digital](https://github.com/defai-digital)
