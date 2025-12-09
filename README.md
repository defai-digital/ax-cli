# AX CLI - AI Coding Assistant for GLM & Grok

[![npm](https://img.shields.io/npm/dt/@defai.digital/ax-cli?style=flat-square&logo=npm&label=downloads)](https://npm-stat.com/charts.html?package=%40defai.digital%2Fax-cli)
[![Tests](https://img.shields.io/badge/tests-3725%20passing-brightgreen?style=flat-square)](https://github.com/defai-digital/ax-cli/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/badge/coverage-98%2B%25-brightgreen?style=flat-square)](https://github.com/defai-digital/ax-cli)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24.0.0-blue?style=flat-square&logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Quick Start](#quick-start)
- [Why AX CLI?](#why-ax-cli)
- [Supported Models](#supported-models)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [MCP Integration](#mcp-integration)
- [VSCode Extension](#vscode-extension)
- [Project Memory](#project-memory)
- [Security](#security)
- [Architecture](#architecture)
- [Packages](#packages)
- [Changelog](#changelog)
- [Documentation](#documentation)
- [Enterprise](#enterprise)

---

<p align="center">
  <img src=".github/assets/glm.png" alt="AX-GLM" width="400"/>
  <img src=".github/assets/grok.png" alt="AX-Grok" width="400"/>
</p>

<p align="center">
  <strong>Enterprise-grade AI coding assistant optimized for GLM and Grok</strong>
</p>

## Quick Start

Get started in under a minute. Choose your AI provider and install the dedicated CLI:

<table>
<tr>
<td width="50%">

### GLM (Z.AI)

```bash
npm install -g @defai.digital/ax-glm
ax-glm setup
ax-glm
```

**Best for:** 200K context, thinking mode, Chinese language support

</td>
<td width="50%">

### Grok (xAI)

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**Best for:** Live web search, vision, extended reasoning

</td>
</tr>
</table>

Run `/init` inside the CLI to initialize your project context.

> **Which CLI should I install?** Install `ax-glm` if you have a Z.AI API key, or `ax-grok` if you have an xAI API key. Both provide the same full-featured coding assistant, optimized for their respective providers.

---

## Why AX CLI?

| Feature | Description |
|---------|-------------|
| **Provider Optimized** | First-class support for GLM (Z.AI) and Grok (xAI) with provider-specific parameters |
| **17 Built-in Tools** | File editing, bash execution, search, todos, and more |
| **MCP Integration** | Model Context Protocol with 12+ production-ready templates |
| **Project Memory** | Intelligent context caching with 50% token savings |
| **Enterprise Security** | AES-256-GCM encryption, no telemetry, CVSS-rated protections |
| **98%+ Test Coverage** | 3725+ tests with strict TypeScript |

---

## Supported Models

### GLM (Z.AI)

| Model | Context | Features | Alias |
|-------|---------|----------|-------|
| `glm-4.6` | 200K | **Thinking mode**: detailed thought processes and planning | `glm-latest` |
| `glm-4.6v` | 128K | **Vision + Thinking**: latest vision model with native multimodal function calling | `glm-vision` |
| `glm-4-flash` | 128K | Fast, efficient for quick tasks | `glm-fast` |
| `cogview-4` | - | **Image generation**: text-to-image with variable resolutions | `glm-image` |

### Grok (xAI)

| Model | Context | Features | Alias |
|-------|---------|----------|-------|
| `grok-4-0709` | 131K | **Most capable**: advanced reasoning, coding, vision | `grok-latest` |
| `grok-4.1-fast` | 131K | Fast Grok 4.1 with agent tools support | `grok-fast` |
| `grok-3` | 131K | **Reasoning effort**: advanced thinking mode | |
| `grok-3-mini` | 131K | Fast, cost-effective with thinking | `grok-mini` |
| `grok-2-vision-1212` | 32K | **Image understanding**: analyze visual input | `grok-vision` |
| `grok-2-image-1212` | 32K | **Image generation**: text-to-image | `grok-image` |

> **Model Aliases**: Use convenient aliases like `ax-grok -m grok-latest` instead of full model names.

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

The setup wizard will guide you through:
1. Securely encrypting and storing your API key (using AES-256-GCM encryption).
2. Configuring your default AI model and other preferences.
3. Validating your configuration to ensure everything is set up correctly.

---

## Usage

### Interactive Mode

```bash
ax-glm              # Starts the interactive CLI session
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

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+O` | Toggle verbosity | Show or hide detailed logs and internal processes |
| `Ctrl+K` | Quick actions | Open the quick actions menu for common commands |
| `Ctrl+B` | Background mode | Run the current task in the background |
| `Shift+Tab` | Auto-edit | Trigger AI-powered code suggestions |
| `Esc` ×2 | Cancel | Clear current input or cancel ongoing operation |

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

Extend capabilities with [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — an open standard for connecting AI assistants to external tools, APIs, and data sources:

```bash
ax-glm mcp add figma --template
ax-glm mcp add github --template
ax-glm mcp list
```

**Available Templates:** Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, Jira, Confluence, Slack, Google Drive, and more.

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

Reduce token costs and improve context recall with intelligent caching that stores and retrieves relevant project information, avoiding redundant processing.

```bash
ax-glm memory warmup    # Generate context cache
ax-glm memory status    # View token distribution
```

---

## Security

- **API Key Encryption:** AES-256-GCM with PBKDF2 (600K iterations)
- **No Telemetry:** Zero data collection
- **CVSS Protections:** Robust safeguards against common vulnerabilities like Command Injection (CVSS 9.8), Path Traversal (CVSS 8.6), and SSRF (CVSS 7.5).

---

## Architecture

AX CLI uses a modular architecture with provider-specific CLIs built on a shared core:

```
┌─────────────────────────────────────────────────────────────┐
│                      User Installs                          │
├─────────────────────────────┬───────────────────────────────┤
│      @defai.digital/ax-glm  │    @defai.digital/ax-grok     │
│         (ax-glm CLI)        │       (ax-grok CLI)           │
│                             │                               │
│  • GLM-4.6 thinking mode    │  • Grok 3 extended reasoning  │
│  • Z.AI API defaults        │  • xAI API defaults           │
│  • 200K context window      │  • Live web search            │
│  • ~/.ax-glm/ config        │  • ~/.ax-grok/ config         │
├─────────────────────────────┴───────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  Shared functionality: 17 tools, MCP client, memory,        │
│  checkpoints, React/Ink UI, file operations, git support    │
└─────────────────────────────────────────────────────────────┘
```

**Why separate CLIs?**
- **Isolated configuration:** Run `ax-glm` and `ax-grok` simultaneously without conflicts
- **Provider optimization:** Each CLI has tuned defaults for its AI provider
- **Cleaner setup:** `ax-glm setup` only asks for Z.AI config, `ax-grok setup` only asks for xAI config

---

## Packages

| Package | Install? | Description |
|---------|:--------:|-------------|
| [@defai.digital/ax-glm](https://www.npmjs.com/package/@defai.digital/ax-glm) | **Yes** | GLM-optimized CLI for Z.AI users |
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **Yes** | Grok-optimized CLI for xAI users |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | No | Shared core library (auto-installed as dependency) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | No | Shared Zod schemas (auto-installed as dependency) |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | No | Legacy package (use ax-glm or ax-grok instead) |

---

## Changelog

Stay up-to-date with the latest improvements and features.

### Recent Highlights:

*   **v4.3.13**: UI refresh and bug fixes - Updated ASCII branding for AX-GLM and AX-GROK, fixed parseInt validation in design commands to prevent NaN errors, improved retry-helper documentation, refined welcome panel avatar animations.
*   **v4.3.12**: Transport cleanup improvements - Added `destroy()` methods to SSETransport and StreamableHttpTransport classes for complete EventEmitter cleanup coverage.
*   **v4.3.11**: Code quality improvements - Added `destroy()` methods to all EventEmitter classes to prevent memory leaks, fixed duplicate function implementations, improved resource cleanup across MCP, agent, and SDK modules.
*   **v4.3.10**: Bug fixes - Fixed `mcp remove` command failing when server not connected, added `.unref()` to timer intervals to prevent process exit blocking, fixed TypeScript `any` type errors in doctor.ts and mcp-migrate.ts.
*   **v4.3.9**: Fixed `/usage` slash command to show xAI/Grok info instead of GLM when using ax-grok.
*   **v4.3.8**: New models and features - Added Grok 4 (`grok-4-0709`, `grok-4.1-fast`) and GLM 4.6V models, model alias system (`grok-latest`, `glm-fast`), fixed `/usage` CLI command for xAI with accurate Grok pricing, fixed reasoning_effort for Grok 4 models.
*   **v4.3.7**: Bug fixes - Fixed ax-grok web search (native search instructions now added regardless of MCP tools), fixed temp file cleanup in history manager.
*   **v4.3.6**: Code quality improvements - ESLint configuration updates, TypeScript strict mode fixes, and dependency updates.
*   **v4.3.5**: Tool Priority System refactoring - improved code quality, reduced duplication, performance optimizations, and bug fixes.
*   **v4.3.4**: Improved AutomatosX MCP agent output formatting (clean, readable results instead of raw NDJSON).
*   **v4.3.3**: Stability improvements and code cleanup.
*   **v4.3.2**: Fixed Enter key not working in certain terminal environments.
*   **v4.3.1**: Minor stability improvements and bug fixes.
*   **v4.3.0**: Major upgrade to MCP client (V2) with enhanced resource handling and connection reliability.
*   **v4.2.0**: Introduced provider-specific MCP configurations, allowing `ax-glm` and `ax-grok` to run simultaneously without conflicts.

For a complete history of changes, please refer to the [full release notes on GitHub](https://github.com/defai-digital/ax-cli/releases).

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
