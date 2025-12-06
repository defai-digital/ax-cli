# AX CLI - AI Coding Assistant for GLM & Grok

[![npm](https://img.shields.io/npm/dt/@defai.digital/ax-cli?style=flat-square&logo=npm&label=downloads)](https://npm-stat.com/charts.html?package=%40defai.digital%2Fax-cli)
[![Tests](https://img.shields.io/badge/tests-2265%20passing-brightgreen?style=flat-square)](https://github.com/defai-digital/ax-cli/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/badge/coverage-98%2B%25-brightgreen?style=flat-square)](https://github.com/defai-digital/ax-cli)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24.0.0-blue?style=flat-square&logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

<p align="center">
  <img src=".github/assets/glm.png" alt="AX-GLM" width="400"/>
  <img src=".github/assets/grok.png" alt="AX-Grok" width="400"/>
</p>

<p align="center">
  <strong>Enterprise-grade AI coding assistant optimized for GLM and Grok</strong>
</p>

---

## Quick Start

### For GLM Users (Z.AI)

```bash
npm install -g @defai.digital/ax-glm
ax-glm setup
ax-glm
```

### For Grok Users (xAI)

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

That's it! Run `/init` inside the CLI to initialize your project.

> **Legacy Package:** `@defai.digital/ax-cli` is maintained for backward compatibility but new users should install `ax-glm` or `ax-grok` directly.

---

## Why AX CLI?

| Feature | Description |
|---------|-------------|
| **Provider Optimized** | First-class support for GLM (Z.AI) and Grok (xAI) with provider-specific parameters |
| **17 Built-in Tools** | File editing, bash execution, search, todos, and more |
| **MCP Integration** | Model Context Protocol with 12+ production-ready templates |
| **Project Memory** | Intelligent context caching with 50% token savings |
| **Enterprise Security** | AES-256-GCM encryption, no telemetry, CVSS-rated protections |
| **98%+ Test Coverage** | 2265+ tests with strict TypeScript |

---

## Supported Models

### GLM (Z.AI)

| Model | Context | Features |
|-------|---------|----------|
| `glm-4.6` | 200K | Thinking mode, optimized for code |
| `glm-4.5v` | 64K | Vision support for image analysis |
| `glm-4` | 128K | Balanced performance |

### Grok (xAI)

| Model | Features |
|-------|----------|
| `grok-3` | Reasoning effort (thinking mode), 131K context |
| `grok-3-mini` | Fast, cost-effective with thinking |
| `grok-2-vision` | Image understanding |
| `grok-2` | Live web search |

---

## Installation

### Requirements

- Node.js 24.0.0+
- macOS 14+, Windows 11+, or Ubuntu 24.04+

### Install

```bash
# Choose your provider
npm install -g @defai.digital/ax-glm    # GLM (Z.AI)
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### Setup

```bash
ax-glm setup   # or ax-grok setup
```

The setup wizard will:
1. Securely encrypt and store your API key (AES-256-GCM)
2. Configure your default model
3. Validate your configuration

---

## Usage

### Interactive Mode

```bash
ax-glm              # Start chat
ax-glm --continue   # Resume previous conversation
ax-glm -c           # Short form
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
| `/exit` | Exit CLI |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Toggle verbosity |
| `Ctrl+K` | Quick actions |
| `Ctrl+B` | Background mode |
| `Shift+Tab` | Auto-edit mode |
| `Esc` ×2 | Cancel/clear |

---

## Configuration

### Config Files

| File | Purpose |
|------|---------|
| `~/.ax-glm/config.json` | User settings (encrypted API key) |
| `.ax-glm/settings.json` | Project overrides |
| `.ax-glm/CUSTOM.md` | Custom AI instructions |

> Grok uses `~/.ax-grok/` and `.ax-grok/` directories.

### Environment Variables

```bash
# For CI/CD
export ZAI_API_KEY=your_key    # GLM
export XAI_API_KEY=your_key    # Grok
```

---

## MCP Integration

Extend capabilities with Model Context Protocol:

```bash
ax-glm mcp add figma --template
ax-glm mcp add github --template
ax-glm mcp list
```

**Available Templates:** Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, and more.

---

## VSCode Extension

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- Sidebar chat panel
- Diff preview for file changes
- Context-aware commands
- Checkpoint & rewind system

---

## Project Memory

Reduce token costs with intelligent caching:

```bash
ax-glm memory warmup    # Generate context cache
ax-glm memory status    # View token distribution
```

---

## Security

- **API Key Encryption:** AES-256-GCM with PBKDF2 (600K iterations)
- **No Telemetry:** Zero data collection
- **CVSS Protections:** Command injection (9.8), path traversal (8.6), SSRF (7.5)

---

## Packages

| Package | Description |
|---------|-------------|
| [@defai.digital/ax-glm](https://www.npmjs.com/package/@defai.digital/ax-glm) | GLM-optimized CLI |
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | Grok-optimized CLI |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | Shared core library |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Legacy launcher |

---

## Changelog

### v4.1.13 - SDK 1.4.0 Multi-Provider Support
- **SDK 1.4.0**: Multi-provider support with ProviderContext
- `createGLMAgent()` and `createGrokAgent()` factory functions
- Provider-specific context stores and file caching
- File locking for concurrent access safety
- Provider settings management

### v4.1.12 - Figma & MCP Improvements
- Figma component instance detection (`instanceOf` field)
- Figma text style extraction (fontSize, fontFamily, fontWeight, lineHeight)
- MCP debug mode with comprehensive diagnostics
- Alias validation command with batch support
- Fixed cache invalidation for parameterized Figma API calls

### v4.1.11 - Provider Branding
- Unique ASCII logos for ax-glm and ax-grok
- Provider-specific color schemes

### v4.1.10 - Grok Fixes
- `reasoning_effort` for Grok-3 thinking mode
- Enhanced web search parameters
- Auto-switch to grok-2-vision for images

### v4.1.9 - Setup Wizard
- Provider selection flow
- Provider-specific config directories

[View all releases](https://github.com/defai-digital/ax-cli/releases)

---

## Documentation

- [Features](docs/features.md)
- [Configuration](docs/configuration.md)
- [CLI Reference](docs/cli-reference.md)
- [MCP Integration](docs/mcp.md)
- [VSCode Guide](docs/vscode-integration-guide.md)
- [Figma Integration](docs/figma-guide.md)
- [Troubleshooting](docs/troubleshooting.md)

---

## Enterprise

For teams requiring advanced capabilities:

- Compliance reports (SOC2, HIPAA)
- Advanced audit logging
- SSO/SAML integration
- Priority support (24-hour SLA)

Contact: **sales@defai.digital**

---

## License

MIT License - see [LICENSE](LICENSE)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>
