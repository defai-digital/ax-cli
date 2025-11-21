# AX CLI - Enterprise-Class GLM AI CLI

[![Tests](https://img.shields.io/badge/tests-562%20passing-brightgreen?style=flat-square)](https://github.com/defai-digital/ax-cli/actions/workflows/test.yml)
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
  <strong>GLM-Optimized CLI • Enterprise Architecture • 98%+ Test Coverage • TypeScript & Zod</strong>
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

- **🤖 GLM-Focused AI CLI**: Optimized for Z.AI's GLM models (glm-4.6, glm-4-air, glm-4-airx)
  - **Note**: For xAI Grok models, use [grok-cli](https://github.com/superagent-ai/grok-cli)
  - **Note**: For Anthropic Claude models, use [claude-code](https://claude.ai/code)
- **🧠 GLM 4.6 Optimized**: Primary support for General Language Model with advanced reasoning
  - **32K max tokens** (industry-standard, matches Claude Code CLI)
  - 200K context window, 128K max output capability
  - 30% more token efficient than GLM 4.5
  - Optimized for complex code generation and refactoring
- **🎯 Multi-Phase Task Planner** (NEW in v3.0.0): Intelligent task decomposition for complex requests
  - Automatic complexity detection (57 keyword patterns)
  - LLM-based plan generation with phases and dependencies
  - Phase-by-phase execution with progress tracking
  - File modification tracking and context pruning between phases
  - Plan management commands: `/plans`, `/plan`, `/phases`, `/pause`, `/resume`, `/skip`, `/abandon`
- **🔄 Session Continuity**: Directory-specific conversation history with `--continue` flag
  - Preserve context across sessions for multi-day development
  - Each project maintains its own independent history
  - Seamlessly resume conversations where you left off
- **🔌 MCP Integration**: Model Context Protocol for extensible tool support
- **✅ Production-Ready**: 98%+ test coverage, TypeScript strict mode, Zod validation
- **🎯 Interactive & Headless**: Chat interface or one-shot commands
- **📝 Smart Project Init**: Automatic project analysis and custom instructions
- **🧠 Project Memory** (NEW): Intelligent context caching for z.ai GLM-4.6
  - Automatic project scanning and context generation
  - z.ai implicit caching support (50% token savings on repeated context)
  - Cache statistics tracking and efficiency monitoring
- **🏥 Health Check** (NEW): Comprehensive diagnostics with `ax-cli doctor`
  - Verify configuration, API connectivity, and dependencies
  - Detailed error messages with actionable suggestions
- **💬 Dual-Model Mode** (NEW): Use different models for chat vs coding
  - Configure chat and coding models separately
  - Manual model switching with `--chat-mode` flag
  - Optimize cost and performance for different task types
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
- **Project Memory**: `.ax-cli/memory.json` (auto-generated)

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
/doctor            # Run health check diagnostics
/tasks             # List background tasks
/task <id>         # View background task output
/kill <id>         # Kill a background task
/version           # Show AX CLI version
/commit-and-push   # AI-powered git commit
/exit              # Exit application

# Multi-Phase Planner commands (NEW in v3.0.0):
/plans             # List all execution plans
/plan              # Show current plan details
/phases            # Show phase progress
/pause             # Pause current plan execution
/resume            # Resume paused plan
/skip              # Skip current phase
/abandon           # Abandon current plan
```

### ⌨️ Keyboard Shortcuts (Claude Code-style)

AX CLI supports powerful keyboard shortcuts for enhanced productivity:

| Shortcut | Action | Description |
|----------|--------|-------------|
| **Ctrl+O** | Toggle verbose mode | Default: concise single-line output. Verbose: full details, diffs, file contents |
| **Ctrl+B** | Background mode | Move running command to background, or toggle "always background" mode |
| **Ctrl+K** | Quick actions | Open quick actions menu |
| **Shift+Tab** | Auto-edit mode | Toggle automatic approval for all operations |
| **Ctrl+C** | Clear/Exit | Clear input (press twice to exit) |
| **↑/↓** | History | Navigate command history |
| **Ctrl+A/E** | Cursor | Move to line start/end |
| **Ctrl+W** | Delete word | Delete word before cursor |

### 🔄 Background Tasks

Run long-running commands in the background (like Claude Code's Ctrl+B):

```bash
# Method 1: Append ' &' to any command
> npm run dev &
🔄 Background task started
Task ID: bg_abc123

# Method 2: Press Ctrl+B during execution to move to background

# Method 3: Toggle "always background" mode with Ctrl+B when idle

# Manage background tasks:
/tasks              # List all background tasks
/task bg_abc123     # View task output
/kill bg_abc123     # Kill a running task
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

## 🏥 Health Check & Diagnostics (NEW)

Run comprehensive diagnostics to verify your AX CLI configuration:

```bash
# Run full diagnostic check
ax-cli doctor

# Get detailed diagnostic information
ax-cli doctor --verbose

# Output results as JSON
ax-cli doctor --json
```

The `doctor` command checks:
- ✓ Node.js version (24+)
- ✓ Configuration files (user and project)
- ✓ API key and base URL
- ✓ API connectivity and authentication
- ✓ Model configuration
- ✓ MCP server configuration
- ✓ Dependencies (ripgrep, git)

## 💬 Dual-Model Mode (NEW)

Use different models for chat vs coding tasks to optimize performance and cost:

### Configuration

Add to `~/.ax-cli/config.json` or `.ax-cli/settings.json`:

```json
{
  "dualModel": {
    "enabled": true,
    "chatModel": "glm-4-air",
    "codingModel": "glm-4.6"
  }
}
```

### Usage

```bash
# Use faster chat model for questions
ax-cli --chat-mode -p "explain what this project does"

# Use coding model (default) for implementation
ax-cli -p "implement user authentication"

# In interactive mode, default is coding model
ax-cli
```

### Environment Variables

```bash
# Enable dual-model mode
export AI_DUAL_MODEL_ENABLED=true
export AI_CHAT_MODEL=glm-4-air
export AI_CODING_MODEL=glm-4.6

ax-cli --chat-mode
```

**Benefits:**
- 💰 **Cost savings**: Use faster/cheaper models for simple queries
- ⚡ **Better performance**: Match model capability to task complexity
- 🎯 **Manual control**: You decide when to use each model

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

## 🧠 Project Memory (NEW)

Project Memory enables intelligent context caching for z.ai GLM-4.6, reducing token costs and improving response consistency:

```bash
# Initialize project memory (scans codebase)
ax-cli memory warmup

# Output:
# ✓ Project memory generated (3,305 tokens)
#
# 📊 Context breakdown:
#    Structure:  1,252 tokens (38%)
#    README:     1,111 tokens (34%)
#    Config:       835 tokens (25%)
#    Patterns:      99 tokens (3%)
```

### How It Works

1. **Warmup**: Scans your project structure, README, configs, and detects architecture patterns
2. **Auto-Injection**: Memory context is automatically prepended to system prompts
3. **z.ai Caching**: Identical prompt prefixes are automatically cached by z.ai (50% token savings)
4. **Statistics**: Track cache efficiency with `ax-cli memory cache-stats`

### Memory Commands

```bash
ax-cli memory warmup        # Create project memory
ax-cli memory refresh       # Update after changes
ax-cli memory status        # Show memory status & token distribution
ax-cli memory clear         # Remove project memory
ax-cli memory cache-stats   # Show cache efficiency statistics

# Options
ax-cli memory warmup -d 5           # Custom scan depth (1-10)
ax-cli memory warmup -m 12000       # Custom max tokens
ax-cli memory warmup --dry-run      # Preview without saving
ax-cli memory status --verbose      # Show full context
ax-cli memory status --json         # JSON output
```

### Token Distribution Visualization

```
📊 Token Distribution:
   ████████░░░░░░░░░░░░  Structure  (38%)
   ███████░░░░░░░░░░░░░  README     (34%)
   █████░░░░░░░░░░░░░░░  Config     (25%)
   █░░░░░░░░░░░░░░░░░░░  Patterns   (3%)
```

### Recommended Workflow

```bash
# 1. Initialize project (if not done)
ax-cli init

# 2. Create project memory
ax-cli memory warmup

# 3. Use ax-cli normally - memory is auto-injected
ax-cli -p "refactor authentication module"

# 4. After major changes, refresh memory
ax-cli memory refresh
```

## 🎯 Multi-Phase Task Planner (v3.0.0)

AX CLI now includes an intelligent multi-phase task planner that automatically decomposes complex requests:

```bash
# Complex requests are automatically detected and planned
> "Refactor the authentication system, add tests, and update documentation"

📋 Plan Generated: 4 phases
├── Phase 1: Analysis (low risk)
├── Phase 2: Implementation (medium risk)
├── Phase 3: Testing (low risk)
└── Phase 4: Documentation (low risk)

Executing Phase 1/4: Analysis...
```

**Features:**
- **Automatic Complexity Detection**: 57 keyword patterns detect when planning is needed
- **LLM-Based Decomposition**: Intelligent breakdown into logical phases
- **Dependency Management**: Phases execute in proper order
- **Progress Tracking**: Real-time updates on phase completion
- **File Tracking**: Monitors which files are modified per phase
- **Context Pruning**: Automatically manages token limits between phases

**Complexity Triggers:**
- Refactoring, migration, or restructuring tasks
- Multi-file changes or feature implementations
- Testing and documentation requests
- Architecture or design tasks
- Multi-step instructions (first...then...finally)

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
- **98%+ test coverage** (562 tests)
- **Modular design** with clean separation of concerns

[Architecture Documentation →](docs/architecture.md)

## 📚 Documentation

- [Features](docs/features.md) - Complete feature list and capabilities
- [Installation](docs/installation.md) - Detailed installation guide
- [Configuration](docs/configuration.md) - Configuration options and settings
- [Usage](docs/usage.md) - Comprehensive usage guide
- [CLI Reference](docs/cli-reference.md) - Command-line interface reference
- [MCP Integration](docs/mcp.md) - Model Context Protocol guide
- [Project Memory](automatosx/prd/project-memory-prd.md) - Project memory feature specification
- [Architecture](docs/architecture.md) - Technical architecture details
- [Development](docs/development.md) - Development and contribution guide
- [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

Built with **AutomatosX** multi-agent orchestration to achieve enterprise-class standards.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/defai-digital">DefAI Digital</a>
</p>
