# AX-GLM - GLM AI Coding Assistant CLI

[![npm version](https://img.shields.io/npm/v/@defai.digital/ax-glm.svg)](https://www.npmjs.com/package/@defai.digital/ax-glm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Enterprise-grade AI coding assistant powered by Z.AI's GLM-4.7** - Terminal-based vibe coding with enhanced reasoning, thinking mode, vision, web search, and MCP integration.

## Quick Start

```bash
npm install -g @defai.digital/ax-glm
ax-glm setup
ax-glm
```

## Features

- **GLM 4.7**: Latest model with enhanced reasoning and improved coding performance
- **GLM 4.6 Thinking Mode**: Detailed thought processes and planning
- **200K Context Window**: Handle large codebases and long conversations
- **Vision Support**: Analyze images with GLM-4.6V
- **Image Generation**: Create images with CogView-4
- **17 Built-in Tools**: File editing, bash execution, search, todos, and more
- **MCP Integration**: Model Context Protocol with 12+ production-ready templates
- **AutomatosX Agents**: 20+ specialized AI agents for complex tasks
- **Chinese Language Support**: Native support for Chinese language tasks

## Supported Models

| Model | Context | Features |
|-------|---------|----------|
| `glm-4.7` | 200K | **Latest**: Enhanced reasoning, improved coding, best performance |
| `glm-4.6` | 200K | Thinking mode: detailed thought processes and planning |
| `glm-4.6v` | 128K | Vision + Thinking: multimodal function calling |
| `glm-4-flash` | 128K | Fast, efficient for quick tasks |
| `cogview-4` | - | Image generation: text-to-image |

## Usage

### Interactive Mode
```bash
ax-glm              # Start interactive session
ax-glm --continue   # Resume previous conversation
```

### Headless Mode
```bash
ax-glm -p "analyze this codebase"
ax-glm -p "fix TypeScript errors" -d /path/to/project
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
~/.ax-glm/config.json    # User settings (encrypted API key)
.ax-glm/settings.json    # Project overrides
.ax-glm/CUSTOM.md        # Custom AI instructions

# Environment variable
export ZAI_API_KEY=your_key
```

## Part of AX CLI Ecosystem

| Package | Description |
|---------|-------------|
| [@defai.digital/ax-glm](https://www.npmjs.com/package/@defai.digital/ax-glm) | GLM-optimized CLI (this package) |
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
