# AX CLI - Enterprise-Class Vibe Coding

[![downloads](https://img.shields.io/npm/dt/@defai.digital/automatosx?style=flat-square&logo=npm&label=downloads)](https://npm-stat.com/charts.html?package=%40defai.digital%2Fax-cli)
[![Tests](https://img.shields.io/badge/tests-6,210%20passing-brightgreen.svg)](#)
[![macOS](https://img.shields.io/badge/macOS-26.0-blue.svg)](https://www.apple.com/macos)
[![Windows](https://img.shields.io/badge/Windows-10+-blue.svg)](https://www.microsoft.com/windows)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-blue.svg)](https://ubuntu.com)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24.0.0-blue?style=flat-square&logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

<p align="center">
  <a href="./README.md">English</a> |
  <a href="./README.zh-CN.md">简体中文</a> |
  <a href="./README.zh-TW.md">繁體中文</a> |
  <a href="./README.ja.md">日本語</a> |
  <a href="./README.ko.md">한국어</a> |
  <a href="./README.de.md">Deutsch</a> |
  <a href="./README.es.md">Español</a> |
  <a href="./README.pt.md">Português</a> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.vi.md">Tiếng Việt</a> |
  <a href="./README.th.md">ไทย</a>
</p>

## Table of Contents

- [Quick Start](#quick-start)
- [GLM Users](#glm-users)
- [Why AX CLI?](#why-ax-cli)
- [Supported Models](#supported-models)
- [Installation](#installation)
- [Usage](#usage)
- [Project Initialization](#project-initialization)
- [Configuration](#configuration)
- [MCP Integration](#mcp-integration)
- [VSCode Extension](#vscode-extension)
- [AutomatosX Integration](#automatosx-integration)
- [Project Memory](#project-memory)
- [Security](#security)
- [Architecture](#architecture)
- [Packages](#packages)
- [Documentation](#documentation)
- [Enterprise](#enterprise)

---

## Quick Start

Get started in under a minute:

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**Best for:** Live web search, vision, extended reasoning, 2M context window

Run `/init` inside the CLI to initialize your project context.

---

## GLM Users

> **Note:** The `ax-glm` cloud package has been deprecated.
>
> **For GLM cloud API access, we recommend using [OpenCode](https://opencode.ai).**

**Local GLM models** (GLM-4.6, CodeGeeX4) are still fully supported via `ax-cli` for offline inference through Ollama, LMStudio, or vLLM. See [Local/Offline Models](#localoffline-models-ax-cli) below.

---

## Why AX CLI?

| Feature | Description |
|---------|-------------|
| **Provider Optimized** | First-class support for Grok (xAI) with provider-specific parameters |
| **17 Built-in Tools** | File editing, bash execution, search, todos, and more |
| **Agentic Behaviors** | ReAct reasoning loops, self-correction on failures, TypeScript verification |
| **AutomatosX Agents** | 20+ specialized AI agents for backend, frontend, security, DevOps, and more |
| **Autonomous Bug Fixing** | Scan and auto-fix timer leaks, resource issues, type errors with rollback safety |
| **Intelligent Refactoring** | Dead code removal, type safety fixes, complexity reduction with verification |
| **MCP Integration** | Model Context Protocol with 12+ production-ready templates |
| **Project Memory** | Intelligent context caching with 50% token savings |
| **Enterprise Security** | AES-256-GCM encryption, no telemetry, CVSS-rated protections |
| **65% Test Coverage** | 6,210 tests with strict TypeScript |

---

### Grok Highlights

- **Grok (ax-grok)**: Built-in web search, vision, reasoning_effort; **Grok 4.1 fast variants ship with 2M context, parallel server tools, x_search, and server-side code execution**. See `docs/grok-4.1-advanced-features.md` for details.

---

## Supported Models

### Grok (xAI)

> **Grok 4.1 advanced**: ax-grok now enables Grok 4.1's server-side agent tools (web_search, x_search, code_execution) with parallel function calling and 2M-context fast variants. See the full guide in `docs/grok-4.1-advanced-features.md`.

| Model | Context | Features | Alias |
|-------|---------|----------|-------|
| `grok-4.1` | 131K | Balanced default with built-in reasoning, vision, search | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | Best for agentic/tool-heavy sessions with reasoning | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | Fastest agentic runs without extended reasoning | `grok-fast-nr` |
| `grok-4-0709` | 131K | Original Grok 4 release (compatible) | `grok-4` |
| `grok-2-image-1212` | 32K | **Image generation**: text-to-image | `grok-image` |

> **Model Aliases**: Use convenient aliases like `ax-grok -m grok-latest` instead of full model names.

### Local/Offline Models (ax-cli)

For local inference via Ollama, LMStudio, or vLLM, use `ax-cli`:

```bash
npm install -g @defai.digital/ax-cli
ax-cli setup   # Configure your local server URL
```

ax-cli works with **any model** available on your local server. Just specify the model tag when configuring (e.g., `qwen3:14b`, `glm4:9b`).

**Recommended Model Families:**

| Model | Best For |
|-------|----------|
| **Qwen** | Best overall for coding tasks |
| **GLM** | Refactoring and documentation |
| **DeepSeek** | Fast iterations, good speed/quality |
| **Codestral** | C/C++/Rust and systems programming |
| **Llama** | Best compatibility and fallback |

---

## Installation

### Requirements

- Node.js 24.0.0+
- macOS 14+, Windows 11+, or Ubuntu 24.04+

### Install

```bash
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### Setup

```bash
ax-grok setup
```

The setup wizard will guide you through:
1. Securely encrypting and storing your API key (using AES-256-GCM encryption).
2. Configuring your default AI model and other preferences.
3. Validating your configuration to ensure everything is set up correctly.

---

## Usage

### Interactive Mode

```bash
ax-grok              # Starts the interactive CLI session
ax-grok --continue   # Resume previous conversation
ax-grok -c           # Short form
```

### Headless Mode

```bash
ax-grok -p "analyze this codebase"
ax-grok -p "fix TypeScript errors" -d /path/to/project
```

### Agentic Behavior Flags

```bash
# Enable ReAct reasoning mode (Thought → Action → Observation cycles)
ax-grok --react

# Enable TypeScript verification after plan phases
ax-grok --verify

# Disable self-correction on failures
ax-grok --no-correction
```

By default, self-correction is ON (agent automatically retries on failures with reflection). ReAct and verification are OFF by default but can be enabled for more structured reasoning and quality checks.

### Essential Commands

| Command | Description |
|---------|-------------|
| `/init` | Generate AX.md project context (see [Project Initialization](#project-initialization)) |
| `/help` | Show all commands |
| `/model` | Switch AI model |
| `/lang` | Change display language (11 languages) |
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

## Project Initialization

The `/init` command generates an `AX.md` file at your project root - a comprehensive context file that helps the AI understand your codebase.

### Basic Usage

```bash
ax-grok
> /init                    # Standard analysis (recommended)
> /init --depth=basic      # Quick scan for small projects
> /init --depth=full       # Deep analysis with architecture mapping
> /init --depth=security   # Include security audit (secrets, dangerous APIs)
```

### Depth Levels

| Depth | What's Analyzed | Best For |
|-------|-----------------|----------|
| `basic` | Name, language, tech stack, scripts | Quick setup, small projects |
| `standard` | + Code stats, test analysis, documentation | Most projects (default) |
| `full` | + Architecture, dependencies, hotspots, how-to guides | Large codebases |
| `security` | + Secret scanning, dangerous API detection, auth patterns | Security-sensitive projects |

### Adaptive Output

The `/init` command automatically adjusts output verbosity based on your project's complexity:

| Project Size | Files | Typical Output |
|--------------|-------|----------------|
| Small | <50 files | Concise, essential info only |
| Medium | 50-200 files | Standard documentation |
| Large | 200-500 files | Detailed with architecture notes |
| Enterprise | 500+ files | Comprehensive with all sections |

### Options

| Option | Description |
|--------|-------------|
| `--depth=<level>` | Set analysis depth (basic, standard, full, security) |
| `--force` | Force complete regeneration (default: auto-refresh if exists) |

> **Note:** Running `/init` when `AX.md` already exists will automatically refresh it. Use `--force` for a complete regeneration.

### Generated Files

| File | Purpose |
|------|---------|
| `AX.md` | Primary AI context file (always generated) |
| `.ax/analysis.json` | Deep analysis data (full/security depth only) |

### How Context Injection Works

When you start a conversation, AX CLI automatically reads your `AX.md` file and injects it into the AI's context window. This means:

1. **The AI knows your project** - Build commands, tech stack, conventions
2. **No repeated explanations** - The AI remembers your project structure
3. **Better code suggestions** - Follows your existing patterns and rules

```
You run: ax-grok
         ↓
System reads: AX.md from project root
         ↓
AI receives: <project-context source="AX.md">
             # Your Project
             ## Build Commands
             pnpm build
             ...
             </project-context>
         ↓
AI understands your project before you ask anything!
```

**Priority order** (if multiple context files exist):
1. `AX.md` (recommended) - New single-file format
2. `ax.summary.json` (legacy) - JSON summary
3. `ax.index.json` (legacy) - Full JSON index

### Migration from Legacy Format

If you have legacy files (`.ax-grok/CUSTOM.md`, `ax.index.json`, `ax.summary.json`), run:

```bash
> /init --force
```

This generates the new single-file `AX.md` format. Legacy files can then be removed.

---

## Configuration

### Config Files

| File | Purpose |
|------|---------|
| `~/.ax-grok/config.json` | User settings (encrypted API key) |
| `.ax-grok/settings.json` | Project overrides |
| `AX.md` | Project context file (generated by `/init`) |

### Environment Variables

```bash
# For CI/CD
export XAI_API_KEY=your_key    # Grok
```

---

## MCP Integration

Extend capabilities with [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — an open standard for connecting AI assistants to external tools, APIs, and data sources:

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
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

## AutomatosX Integration

AX CLI integrates with [AutomatosX](https://github.com/defai-digital/automatosx) - a multi-agent AI system with autonomous bug fixing, intelligent refactoring, and 20+ specialized agents.

In interactive mode (`ax-grok`), just ask naturally:

```
> please scan and fix bugs in this codebase

> refactor the authentication module, focus on removing dead code

> use the security agent to audit the API endpoints

> review this PRD and work with the product agent to improve it

> ask the backend and frontend agents to implement user registration together
```

**What you get:**
- **Bug fixing**: Detects timer leaks, missing cleanup, resource issues - auto-fixes with rollback safety
- **Refactoring**: Removes dead code, fixes type safety, reduces complexity - verified by typecheck
- **20+ agents**: Backend, frontend, security, architecture, DevOps, data, and more

See [AutomatosX Guide](docs/AutomatosX-Integration.md) for agent list, advanced options, and configuration

---

## Project Memory

Reduce token costs and improve context recall with intelligent caching that stores and retrieves relevant project information, avoiding redundant processing.

```bash
ax-grok memory warmup    # Generate context cache
ax-grok memory status    # View token distribution
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
├─────────────────────────────────────────────────────────────┤
│                 @defai.digital/ax-grok                      │
│                    (ax-grok CLI)                            │
│                                                             │
│  • Grok 4.1 extended reasoning                              │
│  • xAI API defaults                                         │
│  • Live web search                                          │
│  • ~/.ax-grok/ config                                       │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  Shared functionality: 17 tools, MCP client, memory,        │
│  checkpoints, React/Ink UI, file operations, git support    │
└─────────────────────────────────────────────────────────────┘
```

---

## Packages

| Package | Install? | Description |
|---------|:--------:|-------------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **Yes** | Grok-optimized CLI with web search, vision, extended thinking |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Optional | Local-first CLI for Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | No | Shared core library (auto-installed as dependency) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | No | Shared Zod schemas (auto-installed as dependency) |

> **GLM Cloud Users:** For GLM cloud API, we recommend [OpenCode](https://opencode.ai).

---


## Documentation

- [Features](docs/features.md)
- [Configuration](docs/configuration.md)
- [CLI Reference](docs/cli-reference.md)
- [MCP Integration](docs/mcp.md)
- [AutomatosX Guide](docs/AutomatosX-Integration.md)
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
