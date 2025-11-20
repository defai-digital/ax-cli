# AX CLI - Enterprise-Class AI CLI

[![Tests](https://img.shields.io/badge/tests-306%20passing-brightgreen?style=flat-square)](https://github.com/defai-digital/ax-cli/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/badge/coverage-98.29%25-brightgreen?style=flat-square)](https://github.com/defai-digital/ax-cli)
[![npm](https://img.shields.io/npm/dt/@defai.digital/ax-cli?style=flat-square&logo=npm&label=downloads)](https://npm-stat.com/charts.html?package=%40defai.digital%2Fax-cli)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24.0.0-blue?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9%2B-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![macOS](https://img.shields.io/badge/macOS-26-blue?style=flat-square&logo=apple)](https://www.apple.com/macos/)
[![Windows](https://img.shields.io/badge/Windows-11-blue?style=flat-square&logo=windows)](https://www.microsoft.com/windows/)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-blue?style=flat-square&logo=ubuntu)](https://ubuntu.com/)

![AX CLI Logo](.github/assets/ax-cli.png)

<p align="center">
  <strong>Enterprise-Grade Architecture • 98%+ Test Coverage • TypeScript & Zod Validation</strong>
</p>

---

## 🚀 Quick Start

```bash
# Install globally
npm install -g @defai.digital/ax-cli

# Configure your API key
ax-cli setup

# Initialize your project
ax-cli init

# Start interactive mode
ax-cli
```

## ✨ Features

- **🤖 Multi-Provider Support**: Z.AI (GLM), xAI (Grok), OpenAI, Anthropic (Claude), Ollama (local)
- **🧠 GLM 4.6 Optimized**: Primary support for General Language Model with advanced reasoning
  - **32K max tokens** (industry-standard, matches Claude Code CLI)
  - 200K context window, 128K max output capability
  - 30% more token efficient than GLM 4.5
  - Optimized for complex code generation and refactoring
- **🔄 Session Continuity**: Directory-specific conversation history with `--continue` flag
  - Preserve context across sessions for multi-day development
  - Each project maintains its own independent history
  - Seamlessly resume conversations where you left off
- **🔌 MCP Integration**: Model Context Protocol for extensible tool support
- **✅ Production-Ready**: 98%+ test coverage, TypeScript strict mode, Zod validation
- **🎯 Interactive & Headless**: Chat interface or one-shot commands
- **📝 Smart Project Init**: Automatic project analysis and custom instructions
- **🔄 Auto-Update**: Built-in update checker and installer

### Max Tokens Configuration

AX CLI uses **industry-standard max tokens** based on research of leading AI coding tools:

| Tool | Max Tokens | Notes |
|------|-----------|-------|
| **Claude Code CLI** | 16k - 32k | Industry standard |
| **GitHub Copilot** | 64k | GPT-4o default |
| **Cursor AI** | 200k | With intelligent pruning |
| **AX CLI (GLM 4.6)** | **32k** ✅ | Matches Claude Code upper default |
| **AX CLI (Others)** | 8k | Appropriate for each model |

**Why 32k for GLM 4.6?**
- Competitive with industry leaders (Claude Code, GitHub Copilot)
- GLM 4.6 supports up to 128k max output (our 32k is conservative at 25%)
- Better for complex code generation, large file modifications, and multi-file context
- Based on official Z.AI documentation and industry benchmarking

[View all features →](docs/features.md)

## 📦 Installation

### Supported Platforms

AX CLI officially supports the following platforms:

| Platform | Versions | Architecture |
|----------|----------|--------------|
| 🍎 **macOS** | 26+ | x64, ARM64 (Apple Silicon) |
| 🪟 **Windows** | 11+ | x64, ARM64 |
| 🐧 **Ubuntu** | 24.04+ | x64, ARM64 |

**Note:** AX CLI may work on other platforms and older versions, but the above platforms are officially tested and supported.

### Prerequisites

- Node.js 24.0.0 or higher
- npm or bun package manager

### Global Installation (Recommended)

```bash
npm install -g @defai.digital/ax-cli
```

[Installation Guide →](docs/installation.md)

## ⚙️ Configuration

### Quick Setup

```bash
# Set your API key (for cloud providers)
export YOUR_API_KEY=your_api_key_here

# Or configure in settings
ax-cli  # Will prompt for API key on first run
```

### Configuration Files

- **User Settings**: `~/.ax-cli/config.json`
- **Project Settings**: `.ax-cli/settings.json`
- **Custom Instructions**: `.ax-cli/CUSTOM.md`

[Configuration Guide →](docs/configuration.md)

## 🎯 Usage Examples

### Interactive Mode

```bash
# Start interactive chat
ax-cli

# Continue the most recent conversation in this directory
ax-cli --continue
# or
ax-cli -c

# Available slash commands:
/help              # Show help
/continue          # Continue incomplete response
/init              # Initialize project
/clear             # Clear chat history
/models            # Switch AI model
/usage             # Show API usage statistics
/version           # Show AX CLI version
/commit-and-push   # AI-powered git commit
/exit              # Exit application
```

### Headless Mode

```bash
# One-shot commands
ax-cli -p "analyze this codebase"
ax-cli -p "fix TypeScript errors" -d /path/to/project
ax-cli -p "write tests for utils/" --max-tool-rounds 50

# With specific model
ax-cli -p "refactor" --model glm-4.6
```

### 🔌 VSCode Integration (NEW!)

AX CLI integrates seamlessly with Visual Studio Code via tasks and keyboard shortcuts:

```bash
# Analyze current file
ax-cli --prompt "Analyze this file" --file src/index.ts --json --vscode

# Explain selected code
ax-cli --prompt "Explain this code" --selection "function foo() {...}" --json --vscode

# Review git changes
ax-cli --prompt "Review my changes" --git-diff --json --vscode

# Analyze specific line range
ax-cli --prompt "Optimize this section" --file app.ts --line-range 50-100 --json
```

**Quick Setup:**
```bash
# Copy VSCode templates to your project
cd your-project
mkdir -p .vscode
cp node_modules/@defai.digital/ax-cli/templates/vscode/*.json .vscode/

# Start using with Cmd+Shift+P → "Tasks: Run Task" → Select AX task
```

**Pre-configured Tasks:**
- 🔍 Analyze Current File
- 📝 Explain Selection
- 🔄 Review Git Changes
- 🧪 Generate Tests
- 📚 Document Code
- ♻️ Refactor Selection
- 🐛 Find Bugs
- ⚡ Optimize Performance

[VSCode Integration Guide →](docs/vscode-integration-guide.md)

### 🔄 Session Continuity (`--continue`)

Resume conversations seamlessly with directory-specific session history:

```bash
# Start a conversation in your project
cd /path/to/your/project
ax-cli
# > Work on some features, then exit

# Later, continue where you left off
cd /path/to/your/project
ax-cli --continue
# All previous context is restored!

# Each project maintains its own independent history
cd /path/to/another/project
ax-cli --continue
# Fresh context for this project
```

**How It Works:**
- Each project directory gets its own conversation session
- History includes all messages, tool calls, and results
- Integrated with `.ax-cli/CUSTOM.md` for project-specific context
- Sessions stored in `~/.ax-cli/sessions/` by project hash
- Up to 50 most recent messages preserved per session

**Use Cases:**
- Multi-day feature development with accumulated knowledge
- Resume after interruptions without losing context
- Maintain separate conversations per project
- Natural workflow continuity across sessions

### Project Initialization

```bash
# Analyze and initialize project
ax-cli init

# Force regeneration
ax-cli init --force

# Verbose output
ax-cli init --verbose
```

### Usage Tracking

Track your API usage across the current session:

```bash
# Show current session usage statistics
ax-cli usage show

# Show detailed breakdown by model
ax-cli usage show --detailed

# Export as JSON
ax-cli usage show --json

# Reset session statistics
ax-cli usage reset
```

**Phase 1**: Z.AI provider with session-based tracking
- Tracks prompt tokens, completion tokens, and reasoning tokens
- Per-model breakdown available
- Historical data available via Z.AI dashboard: https://z.ai/manage-apikey/billing

**Phase 2** (Coming Soon): Support for additional providers (OpenAI, Anthropic, etc.)

[CLI Reference →](docs/cli-reference.md) | [Usage Guide →](docs/usage.md)

## 🔌 MCP (Model Context Protocol)

Extend AX CLI with MCP servers for additional capabilities:

```bash
# Add MCP server
ax-cli mcp add linear --transport sse --url https://mcp.linear.app/sse

# List servers
ax-cli mcp list

# Remove server
ax-cli mcp remove linear
```

[MCP Integration Guide →](docs/mcp.md)

## 🤖 Advanced Multi-Agent Orchestration

**AX CLI** is designed as a focused, single-agent CLI tool for direct AI-powered development tasks. For advanced multi-agent orchestration, collaborative AI workflows, and complex task automation, we recommend **[AutomatosX](https://automatosx.com)**.

### When to Use AutomatosX Instead

- **Multi-Agent Collaboration**: Coordinate multiple AI agents working together on complex projects
- **Specialized Agent Teams**: Use domain-specific agents (QA, architecture, security, etc.)
- **Advanced Workflows**: Build sophisticated automation pipelines with agent orchestration
- **Enterprise Scale**: Large-scale projects requiring parallel agent execution and coordination

AX CLI focuses on being a reliable, single-agent development assistant, while AutomatosX provides the full multi-agent orchestration platform for advanced use cases.

## 🏗️ Architecture

AX CLI implements enterprise-grade architecture with:

- **Single Source of Truth (SSOT)** type system via `@ax-cli/schemas`
- **TypeScript strict mode** with Zod runtime validation
- **98%+ test coverage** (306 tests)
- **Modular design** with clean separation of concerns

[Architecture Documentation →](docs/architecture.md)

## 📚 Documentation

- [Features](docs/features.md) - Complete feature list and capabilities
- [Installation](docs/installation.md) - Detailed installation guide
- [Configuration](docs/configuration.md) - Configuration options and settings
- [Usage](docs/usage.md) - Comprehensive usage guide
- [CLI Reference](docs/cli-reference.md) - Command-line interface reference
- [MCP Integration](docs/mcp.md) - Model Context Protocol guide
- [Architecture](docs/architecture.md) - Technical architecture details
- [Development](docs/development.md) - Development and contribution guide
- [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions

## 🤝 Contributing

We welcome contributions! Please see our [Development Guide](docs/development.md) for details on:

- Setting up your development environment
- Running tests
- Code style guidelines
- Submitting pull requests

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

Originally forked from [grok-cli](https://github.com/superagent-ai/grok-cli), AX CLI has been extensively upgraded using **AutomatosX** multi-agent orchestration to achieve enterprise-class standards.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/defai-digital">DefAI Digital</a>
</p>
