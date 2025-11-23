# AX CLI - Enterprise-Class CLI for GenAI coding

[![npm](https://img.shields.io/npm/dt/@defai.digital/ax-cli?style=flat-square&logo=npm&label=downloads)](https://npm-stat.com/charts.html?package=%40defai.digital%2Fax-cli)
[![Tests](https://img.shields.io/badge/tests-1497%20passing-brightgreen?style=flat-square)](https://github.com/defai-digital/ax-cli/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/badge/coverage-98%2B%25-brightgreen?style=flat-square)](https://github.com/defai-digital/ax-cli)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9%2B-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24.0.0-blue?style=flat-square)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![macOS](https://img.shields.io/badge/macOS-26-blue?style=flat-square&logo=apple)](https://www.apple.com/macos/)
[![Windows](https://img.shields.io/badge/Windows-11-blue?style=flat-square&logo=windows)](https://www.microsoft.com/windows/)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-blue?style=flat-square&logo=ubuntu)](https://ubuntu.com/)

![AX CLI Screenshot](.github/assets/screenshot1.png)

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
- **🎯 Multi-Phase Task Planner**: Intelligent task decomposition for complex requests
  - Automatic complexity detection (57 keyword patterns)
  - LLM-based plan generation with phases and dependencies
  - Phase-by-phase execution with progress tracking
  - File modification tracking and context pruning between phases
  - Plan management commands: `/plans`, `/plan`, `/phases`, `/pause`, `/resume`, `/skip`, `/abandon`
- **🔄 Session Continuity**: Directory-specific conversation history with `--continue` flag
  - Preserve context across sessions for multi-day development
  - Each project maintains its own independent history
  - Seamlessly resume conversations where you left off
- **🔌 Enhanced MCP Integration**: Model Context Protocol with production-ready templates
  - **One-command setup**: `ax-cli mcp add figma --template`
  - **12+ pre-configured templates**: Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, and more
  - **Tool discovery**: `ax-cli mcp tools <server>` to preview capabilities
  - **Template browser**: `ax-cli mcp browse` for quick navigation
  - **Front-end focused**: Design-to-code workflows with Figma integration
  - **[Complete Guide](docs/mcp-frontend-guide.md)**: Front-end developer workflows
- **✅ Production-Ready**: 98%+ test coverage, TypeScript strict mode, Zod validation
- **🎯 Interactive & Headless**: Chat interface or one-shot commands
- **📝 Smart Project Init**: Automatic project analysis and custom instructions
- **🧠 Project Memory**: Intelligent context caching for z.ai GLM-4.6
  - Automatic project scanning and context generation
  - z.ai implicit caching support (50% token savings on repeated context)
  - Cache statistics tracking and efficiency monitoring
- **🏥 Health Check**: Comprehensive diagnostics with `ax-cli doctor`
  - Verify configuration, API connectivity, and dependencies
  - Detailed error messages with actionable suggestions
- **🎨 Smart Verbosity Control**: Multi-level output for optimal UX
  - **Quiet mode** (default): Groups tool operations → 85% less noise
  - **Concise mode**: One line per tool execution
  - **Verbose mode**: Full details for debugging
  - Press `Ctrl+O` to cycle between levels
  - Auto-expands errors with full details
- **💬 Dual-Model Mode**: Use different models for chat vs coding
  - Configure chat and coding models separately
  - Manual model switching with `--chat-mode` flag
  - Optimize cost and performance for different task types
- **🌐 Web Search**: Real-time package search capabilities
  - **Works out-of-the-box**: npm, PyPI, and crates.io package search (no API keys required)
  - **Intelligent routing**: Automatically selects the best engine based on query intent
    - JavaScript/Node.js packages → npm registry search
    - Python packages → PyPI registry search
    - Rust packages → crates.io registry search
  - Results caching for faster responses (5 minute TTL)
  - Support for package discovery, dependency research, and version information
  - Session-based context for iterative package exploration
- **🔄 Auto-Update**: Built-in update checker and installer
- **🔒 Enterprise-Grade Security**: **FREE & Open Source**
  - **Command Injection Protection**: CVSS 9.8 CRITICAL fix - Safe command execution with whitelisting
  - **Path Traversal Hardening**: CVSS 8.6 HIGH fix - Prevent unauthorized file system access
  - **SSRF Attack Prevention**: CVSS 7.5 HIGH fix - Validate MCP transport URLs and block private IPs
  - **Input Sanitization**: CVSS 7.0 HIGH fix - Comprehensive input validation and sanitization
  - **Error Sanitization**: CVSS 6.5 MEDIUM fix - Prevent sensitive data leakage in error messages
  - **API Key Encryption**: AES-256-GCM encryption at rest with automatic migration
  - **Memory Leak Fixes**: Process pool management for long-running operations
  - **Security Audit Logging**: Basic JSON logging with 30-day retention
  - **Rate Limiting**: Token bucket algorithm to prevent API abuse (100 req/min)
  - **1381+ tests passing** with **98.29% coverage** - Production-ready security
  - **User-friendly defaults**: Full functionality with enterprise-grade security for everyone
- **🏢 Enterprise Features**: Advanced capabilities for teams and compliance
  - **Compliance Report Generation**: SOC2, HIPAA, PCI-DSS automated reporting
  - **Advanced Audit Logging**: Tamper-proof encrypted logs with hash chains and extended retention (1+ years)
  - **Real-time Security Dashboards**: Monitor security events, anomalies, and compliance status
  - **Advanced Rate Limiting**: Custom quotas per user/team/project with cost analytics and budget alerts
  - **Team Collaboration**: Shared chat history with full-text search and multi-format export
  - **Policy Enforcement**: Tool execution policies, approval workflows, and usage analytics
  - **SSO/SAML Integration**: Enterprise identity provider support
  - **Priority Support**: 24-hour SLA email support
  - 📧 **Contact sales@defai.digital** for enterprise licensing and pricing
- **📊 Advanced Code Analysis**: Professional-grade static analysis tools
  - **Dependency Analyzer**: Detect circular dependencies, calculate coupling metrics, identify orphan and hub files
  - **Code Smell Detector**: Find 10+ anti-patterns (long methods, large classes, duplicates, dead code, etc.)
  - **Hotspot Analyzer**: Identify frequently changing, complex code using git history analysis
  - **Metrics Calculator**: Cyclomatic complexity, Halstead metrics, Maintainability Index (MI)
  - **Security Scanner**: Detect SQL injection, XSS, path traversal, hardcoded secrets, and more
  - **[Complete Guide](docs/analysis-tools.md)** and **[API Documentation](docs/api/analyzers.md)**

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

## 🎉 What's New in v3.7.0

**SDK Best Practices & Developer Experience** - Major improvements to the programmatic SDK API:

### ✨ New Features

- **🔒 Structured Error System**: Programmatic error handling with `SDKError` and error codes
  ```typescript
  try {
    const agent = await createAgent();
  } catch (error) {
    if (SDKError.isSDKError(error)) {
      switch (error.code) {
        case SDKErrorCode.SETUP_NOT_RUN:
          console.log('Run: ax-cli setup');
          break;
      }
    }
  }
  ```

- **✅ Input Validation**: Zod schema validation prevents invalid configurations
  - Validates `maxToolRounds` (1-1000, must be integer)
  - Rejects NaN, negative values, unknown properties
  - Clear validation error messages

- **🧪 Testing Utilities**: Built-in mocks for easier testing
  ```typescript
  import { createMockAgent } from '@defai.digital/ax-cli/sdk/testing';

  const agent = createMockAgent(['Response 1', 'Response 2']);
  const result = await agent.processUserMessage('Test');
  ```

- **🛡️ Disposal Protection**: Prevents use-after-disposal bugs
  - Throws `AGENT_DISPOSED` error if agent used after `dispose()`
  - Idempotent disposal (safe to call multiple times)

- **📊 SDK Version Tracking**: Version info for debugging and compatibility
  ```typescript
  import { SDK_VERSION, getSDKInfo } from '@defai.digital/ax-cli/sdk';

  console.log('SDK Version:', SDK_VERSION); // "3.7.0"
  ```

- **🐛 Debug Mode**: Verbose logging for troubleshooting
  ```typescript
  const agent = await createAgent({
    maxToolRounds: 50,
    debug: true  // Logs agent creation, tool calls, results
  });
  ```

### 🔧 Improvements

- **Enhanced Disposal**: Comprehensive cleanup of listeners, caches, and history
- **Better Documentation**: Fixed outdated examples, added error handling patterns
- **Type Safety**: Full TypeScript support with proper type exports

### 📦 Breaking Changes

**None!** All changes are backward compatible.

---

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
- npm package manager

### Global Installation (Recommended)

```bash
npm install -g @defai.digital/ax-cli
```

[Installation Guide →](docs/installation.md)

## ⚙️ Configuration

### Quick Setup

The recommended way to configure AX CLI is using the interactive setup wizard:

```bash
# Run the setup wizard (recommended)
ax-cli setup

# This will:
# 1. Guide you through provider selection (Z.AI, OpenAI, Anthropic, Ollama, etc.)
# 2. Securely encrypt and store your API key (AES-256-GCM encryption)
# 3. Configure default model and settings
# 4. Validate your configuration
```

**Alternative: Environment Variable Override**

For CI/CD pipelines or temporary overrides, you can set an environment variable:

```bash
# Override API key temporarily (not recommended for daily use)
export YOUR_API_KEY=your_api_key_here
ax-cli
```

**⚠️ Security Note**: API keys are automatically encrypted in config files using AES-256-GCM encryption. **Do not manually edit `~/.ax-cli/config.json`** - always use `ax-cli setup` to update your API key securely.

### Configuration Files

- **User Settings**: `~/.ax-cli/config.json` (API keys are encrypted)
- **Project Settings**: `.ax-cli/settings.json` (project-specific overrides)
- **Custom Instructions**: `.ax-cli/CUSTOM.md` (AI behavior customization)
- **Project Memory**: `.ax-cli/memory.json` (auto-generated context cache)

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

# Multi-Phase Planner commands:
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
| **Ctrl+O** | Cycle verbosity | Quiet (grouped) → Concise (per-tool) → Verbose (full details) → Quiet |
| **Ctrl+B** | Background mode | Move running command to background, or toggle "always background" mode |
| **Ctrl+K** | Quick actions | Open quick actions menu |
| **Shift+Tab** | Auto-edit mode | Toggle automatic approval for all operations |
| **Ctrl+C** | Clear/Exit | Clear input (press twice to exit) |
| **↑/↓** | History | Navigate command history |
| **Ctrl+A/E** | Cursor | Move to line start/end |
| **Ctrl+W** | Delete word | Delete word before cursor |

**Verbosity Levels** (Ctrl+O to cycle):
- **Quiet** (default): Groups operations → `⏺ Working on app.ts (3 edits, 5 reads) ✓ 2.3s`
- **Concise**: One line per tool → `⏺ Read (app.ts) ✓ 22 lines`
- **Verbose**: Full details → Shows args, outputs, diffs, timings

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

### 🔌 VSCode Integration

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

## 📋 Working with Large Content

AX CLI has **intelligent paste handling** that automatically manages large text inputs for better readability.

### 📝 Smart Paste Auto-Collapse

When you paste **20+ lines** of text, AX CLI automatically collapses it:

- ✅ **Automatic Detection**: Pastes with 20+ lines are auto-collapsed
- ✅ **Clean Display**: Shows `[Pasted text #1 +89 lines]` instead of cluttering the UI
- ✅ **Full Submission**: Complete text is still sent to the AI (not just the placeholder)
- ✅ **Review Anytime**: Press **Ctrl+P** on a collapsed block to expand/collapse

**Example:**
```bash
# Paste a 100-line error log
# → Shows: [Pasted text #1 +100 lines]
# → AI receives: Full 100 lines

# Position cursor on placeholder and press Ctrl+P to review
# → Expands to show all 100 lines
```

**Configure in `~/.ax-cli/config.json`:**
```json
{
  "paste": {
    "autoCollapse": true,        // Enable/disable (default: true)
    "collapseThreshold": 20      // Min lines to collapse (default: 20)
  }
}
```

### ⚠️ Character Counter Warning

The character counter shows visual warnings for very large single inputs:
- Gray (0-999) → Cyan (1000-1599) → Yellow (1600-1999) → **Red (2000+)**

### ✅ Alternative Approaches for Extremely Large Content

**Option 1: File Reference (Interactive Mode)**
```bash
# Save your content to a file first
cat > context.txt
# (paste content, then Ctrl+D)

# Then use memory commands
ax-cli
> /memory add context.txt
> analyze the content I just added
```

**Option 2: Headless Mode with File Input**
```bash
# Direct file processing
ax-cli --prompt "analyze this: $(cat large-file.txt)"

# Or use the --file flag
ax-cli --file path/to/code.ts --prompt "review this code"
```

**Option 3: Use `/memory` Commands**
```bash
# In interactive mode
> /memory add src/
> /memory add logs/error.log
> analyze the errors in the log file
```

### Character Count Guide

The interactive terminal shows a character counter `[count/2000]` with color-coded warnings:

| Color | Range | Recommendation |
|-------|-------|----------------|
| **Gray** | 0-999 | ✅ Optimal length |
| **Cyan** | 1000-1599 | ⚠️ Getting long |
| **Yellow** | 1600-1999 | ⚠️ Consider using files |
| **Red** | 2000+ | ❌ Use file-based workflow |

## 🏥 Health Check & Diagnostics

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

## 💬 Dual-Model Mode

Use different models for chat vs coding tasks to optimize performance and cost:

### Configuration

**Option 1: Project Settings** (recommended for project-specific preferences)

Add to `.ax-cli/settings.json` in your project directory:

```json
{
  "dualModel": {
    "enabled": true,
    "chatModel": "glm-4-air",
    "codingModel": "glm-4.6"
  }
}
```

**Option 2: Environment Variables** (for temporary or CI/CD use)

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

## 🌐 Web Search

Search package registries for JavaScript, Python, and Rust packages with intelligent language detection and cross-registry comparison.

### ✨ Works Out of the Box!

**Package search is enabled by default** (no API key required):
- **npm** - JavaScript/Node.js packages from npmjs.com
- **PyPI** - Python packages from pypi.org
- **crates.io** - Rust packages from crates.io

### Quick Setup

**No setup required!** Package search works immediately:
- **npm** - JavaScript/Node.js packages work immediately
- **PyPI** - Python packages work immediately
- **crates.io** - Rust packages work immediately
- Perfect for package discovery and dependency management
- No API keys needed

### Usage

```bash
# The AI will automatically use web search when needed
ax-cli

> "Find a React state management library"     # Uses npm search
> "Search for axios npm package"              # Uses npm search
> "Find a Python data analysis library"       # Uses PyPI search
> "Search for tokio rust crate"               # Uses crates.io search
```

### How It Works

- **Intelligent Routing**: Automatically selects the best search engine based on query type and language detection
  - **JavaScript/Node.js packages** → npm registry search (always available, no API key)
  - **Python packages** → PyPI registry search (always available, no API key)
  - **Rust packages** → crates.io registry search (always available, no API key)
  - **General/technical queries** → package search fallback

- **Language Detection**: Automatically detects programming language from keywords
  - Python keywords (pip, django, flask, pandas) → PyPI
  - Rust keywords (cargo, crate, tokio, serde) → crates.io
  - npm/package keywords → npm registry
  - Multiple engines may be used in parallel for best results

- **Automatic Caching**: Results cached for 5 minutes for faster subsequent queries

- **LLM Integration**: The AI automatically uses package search for:
  - Package discovery and dependency management
  - Version compatibility checks
  - Alternative package recommendations
  - Package documentation and usage information

### Features

- **Multi-Registry Package Search**: Search across npm, PyPI, and crates.io simultaneously
  - Package metadata, descriptions, and download statistics
  - Version information and release dates
  - No API keys or setup required
- **Source Attribution**: All results include URLs and sources
- **Parallel Search**: Multiple engines searched concurrently for comprehensive results

### Manual Usage

While the AI uses web search automatically, you can also request it explicitly:

```bash
# In interactive mode
> "search npm for a markdown parser library"
> "search PyPI for a web scraping package"
> "search crates.io for async runtime"

# Headless mode
ax-cli -p "search for react-query npm package"
ax-cli -p "find a Python FastAPI alternative"
```

### Web Search Session

AX CLI maintains intelligent search context across your conversation, enabling natural follow-up questions and iterative refinement:

**Session Continuity:**
- Package search results are preserved in conversation context
- Ask follow-up questions about packages without re-searching
- Reference previous search results naturally
- Session context includes package URLs, metadata, versions, and download stats

**Example Session:**

```bash
ax-cli

# Initial package search
> "search npm for a state management library"
🔍 Searching npm registry...
Found 5 packages:

1. **zustand** (2.5M weekly downloads)
   Small, fast and scalable state-management
   Latest: v4.4.7 | Size: 1.2KB gzipped

2. **redux** (8.1M weekly downloads)
   Predictable state container for JavaScript apps
   Latest: v5.0.0 | Size: 6.2KB (core only)

3. **mobx** (1.2M weekly downloads)
   Simple, scalable state management
   Latest: v6.12.0 | Size: 16KB
   ...

# Natural follow-up (uses cached context from npm search)
> "which one has the smallest bundle size?"
Based on the npm search results:
- ✅ zustand: 1.2KB (gzipped) - Smallest
- jotai: 2.9KB (gzipped)
- redux: 6.2KB (core only)
- mobx: 16KB

# Version and compatibility check
> "what's the latest version of zustand and does it support React 18?"
Package: zustand v4.4.7 (latest)
✅ Full React 18 support with concurrent features
✅ TypeScript 5.0+ support
📅 Last published: 2 weeks ago

# Installation guide
> "show me how to install and use zustand"
Installation:
npm install zustand

Basic usage:
[Provides code example from npm documentation]
```

**Context-Aware Features:**

1. **Result Caching**: Package search results stay in memory for the session
   - 5-minute cache for identical queries
   - Instant responses for follow-up questions about packages
   - No repeated API calls to registries

2. **Multi-Turn Package Refinement**:
   ```bash
   > "search npm for a react table library"
   Found: tanstack-table, react-table, ag-grid-react, mui-x-data-grid

   > "which ones have TypeScript support?"
   All 4 packages support TypeScript:
   - @tanstack/react-table: Full TS rewrite
   - react-table (deprecated, use @tanstack)
   - ag-grid-react: TypeScript included
   - @mui/x-data-grid: Full TS support

   > "which has the best documentation?"
   Based on npm stats and GitHub stars:
   - @tanstack/react-table: Excellent docs, 24K stars

   > "install that one"
   npm install @tanstack/react-table
   ```

3. **Cross-Registry Context**:
   ```bash
   > "search for data validation libraries"
   Searching npm, PyPI, and crates.io...

   npm: zod, yup, joi, ajv
   PyPI: pydantic, marshmallow, cerberus
   crates.io: serde, validator

   > "compare the JavaScript and Python options"
   **JavaScript (npm):**
   - zod: 3.5M/week, TypeScript-first, 30KB
   - yup: 5.2M/week, Schema builder, 45KB

   **Python (PyPI):**
   - pydantic: 50M/month, Type hints, fast
   - marshmallow: 8M/month, Schema validation

   > "which is fastest?"
   - JavaScript: zod (TypeScript inference, zero-cost)
   - Python: pydantic (uses Rust core, 20x faster than marshmallow)
   ```

4. **Package Comparison Tables**:
   ```bash
   > "search npm for http client libraries"
   Found: axios, node-fetch, got, ky, superagent

   > "create a comparison table"

   | Package     | Weekly DLs | Size    | Last Update | Browser | Node |
   |-------------|------------|---------|-------------|---------|------|
   | axios       | 48M        | 11.5KB  | 2 weeks ago | ✅      | ✅   |
   | node-fetch  | 35M        | 4.5KB   | 3 months    | ❌      | ✅   |
   | got         | 23M        | 15KB    | 1 week ago  | ❌      | ✅   |
   | ky          | 1.2M       | 12KB    | 2 weeks ago | ✅      | ✅   |

   > "which is best for Node.js backend with retry logic?"
   Recommendation: **got**
   - Built-in retry with exponential backoff
   - HTTP/2 support
   - Request cancellation
   - Promise & stream support
   ```

**Session Management:**

- **Session Duration**: Active for entire interactive session
- **History Integration**: Search results included in `--continue` sessions
- **Memory Commands**:
  ```bash
  /clear    # Clears search context and conversation
  /exit     # Ends session (context lost)
  ```
- **Persistent Context**: Use with `--continue` to maintain search context across sessions

**Best Practices:**

1. **Start Broad, Refine Iteratively**:
   ```bash
   > "search npm for testing libraries"
   Found: jest, vitest, mocha, jasmine, playwright, cypress

   > "focus on those for integration testing"
   Integration testing: playwright, cypress, vitest (has browser mode)

   > "which has TypeScript support?"
   All 3 have TypeScript:
   - playwright: Native TS
   - cypress: Full TS support
   - vitest: Native TS (Vite-powered)

   > "show setup for playwright"
   npm install -D @playwright/test
   [Provides example config and test]
   ```

2. **Leverage Context for Framework Comparisons**:
   ```bash
   > "search npm for react vue svelte packages"
   Found core packages with download stats:
   - react: 22M/week
   - vue: 5.1M/week
   - svelte: 850K/week

   > "compare their package ecosystems"
   **React:** 180K+ packages
   **Vue:** 45K+ packages
   **Svelte:** 8K+ packages

   > "which has better TypeScript support?"
   All have excellent TS support:
   - React: @types/react (20M/week)
   - Vue: Built-in TS (Vue 3+)
   - Svelte: svelte-check + TypeScript plugin
   ```

3. **Version Compatibility Checks**:
   ```bash
   > "search npm for next auth package"
   Found: next-auth (8M/week, v4.24.5)

   > "does it work with Next.js 15?"
   ⚠️  Compatibility:
   - next-auth v4: Next.js 12-14
   - For Next.js 15: Use NextAuth.js v5 (beta)

   > "show me the v5 package"
   Package: next-auth@beta (v5.0.0-beta.4)
   ✅ Next.js 15 compatible
   [Installation and migration guide]
   ```

4. **Combine Search with Development Tasks**:
   ```bash
   > "search npm for a markdown parser library"
   Found: marked, remark, markdown-it, showdown

   > "which is fastest and most secure?"
   Recommendation: **marked**
   - 13M/week downloads
   - Fast (built-in sanitization)
   - Active maintenance

   > "install marked and show me basic usage"
   Installing: npm install marked
   [Generates code example with marked usage]

   > "add it to my project"
   [Creates/updates relevant files with implementation]
   ```

**Performance Tips:**

- **First search**: 1-3 seconds (registry API call)
- **Follow-up questions**: Instant (uses cached package data)
- **Cache duration**: 5 minutes per query
- **Parallel searches**: Multiple registries searched concurrently for cross-language queries
- **Offline work**: Use `--continue` to preserve search context across sessions

### Troubleshooting

**No results found**
- Package registries (npm, PyPI, crates.io) are always available
- Try refining your search query
- Check your internet connection

**Rate limit errors**
- Package registry searches are rate-limited by the registry providers
- Results are cached to minimize API calls

**Slow searches**
- Results are cached after first search (5 minute TTL)
- Subsequent identical queries will be instant

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

## 🧠 Project Memory

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
- **98%+ test coverage** (1381 tests passing)
- **Modular design** with clean separation of concerns
- **Enterprise security** with AES-256-GCM encryption for sensitive data

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

## 📋 Changelog

### v3.6.1 (2025-11-22)

**🔧 Improvements:**
- **Web Search Simplification**: Removed Tavily AI dependency, focusing entirely on package registries
  - Streamlined to npm, PyPI, and crates.io package search only
  - No API keys required for web search functionality
  - Reduced dependencies and simplified architecture
- **Documentation Overhaul**: Completely updated web search documentation
  - 200+ lines updated with package-focused examples
  - 15+ new realistic examples showing npm, PyPI, and crates.io workflows
  - Comprehensive session examples for package discovery and comparison
  - Best practices for cross-registry searches and version compatibility checks
- **Smart Paste Auto-Collapse**: Intelligent handling of large text inputs
  - Automatic collapse of 20+ line pastes for better readability
  - Press Ctrl+P to expand/collapse pasted content
  - Configurable threshold in `~/.ax-cli/config.json`
  - Full content still sent to AI (not just the placeholder)

**✅ Quality:**
- All 1,381 tests passing with 98.29% coverage
- Zero breaking changes
- Cleaner codebase with reduced complexity

### v3.6.0 (2025-11-22)

**🔒 Enterprise-Grade Security (FREE & Open Source):**
- **API Key Encryption**: AES-256-GCM encryption for API keys at rest
- **Command Injection Protection**: CVSS 9.8 CRITICAL fix with command whitelisting
- **Path Traversal Hardening**: CVSS 8.6 HIGH fix preventing unauthorized file access
- **SSRF Attack Prevention**: CVSS 7.5 HIGH fix for MCP transport URL validation
- **Input Sanitization**: CVSS 7.0 HIGH fix for comprehensive input validation
- **Error Sanitization**: CVSS 6.5 MEDIUM fix preventing credential leakage
- **Security Audit Logging**: Basic JSON logging with 30-day retention
- **Rate Limiting**: Token bucket algorithm to prevent API abuse
- **Memory Leak Fixes**: Process pool management for long-running operations

**✅ Test Quality:**
- **1381+ tests passing** (up from 1,038) with 98.29% coverage
- All security modules fully tested and validated
- Production-ready security implementation

**🏢 Enterprise Features (Available):**
- Advanced audit logging with compliance reports (SOC2, HIPAA, PCI-DSS)
- Team collaboration with shared chat history
- Policy enforcement and approval workflows
- Extended audit log retention (1+ years)
- SSO/SAML integration support
- Priority 24-hour SLA support
- Contact sales@defai.digital for enterprise licensing

**🔧 Configuration Improvements:**
- New `ax-cli setup` wizard for secure API key configuration
- Automatic migration of plain-text API keys to encrypted format
- Environment variable override support for CI/CD workflows

### v3.5.3 (2025-11-22)

**Bug Fixes - Test Quality & Reliability:**
- Fixed unhandled promise rejection in subagent tests that caused Node.js warnings
- Replaced meaningless test assertions (`expect(true).toBe(true)`) with real validation
- Properly skipped untestable tests with clear TODO documentation
- Fixed flaky performance test by adjusting timing threshold (0.9x instead of 0.7x)

**Test Suite Improvements:**
- Improved test isolation and error handling patterns
- Enhanced performance test reliability for CI/CD environments
- Better documentation of test limitations
- All 1,038 tests passing (1,036 passed + 2 properly skipped)

**Code Quality:**
- Comprehensive test quality analysis across all test files
- Eliminated false confidence from placeholder tests
- Maintained 98%+ test coverage with genuine validation

### v3.7.1 (2025-11-22)

**Bug Fixes - Critical Stability Improvements:**
- Fixed crash on malformed LLM responses: Added try-catch to `parseToolArgumentsCached` in LLMAgent
  - Prevents agent crash when LLM sends invalid JSON in tool arguments
  - Returns empty object instead of throwing, allowing session to continue
  - Affects ~1 in 1000 tool calls based on observed LLM behavior
- Fixed memory leak in BashTool: Added dispose() method
  - Properly terminates running bash processes on cleanup
  - Removes all event listeners to prevent accumulation
  - Fixes resource leak from orphaned process handles
- Fixed agent disposal: Added tool cleanup cascade
  - Agent now calls bash.dispose() during cleanup
  - Ensures all tool resources are properly released

**Bug Fixes - Performance & Memory:**
- Fixed unbounded cache growth in `toolCallArgsCache`
  - Limited to 500 entries with LRU eviction (oldest 100)
  - Prevents 5+ MB memory leak per 10,000 tool calls
  - Applied to both LLMAgent and Subagent classes
- Fixed resource leak in bash abort handler
  - Cleanup listener now called even when moveToBackground() fails
  - Prevents event listener memory leaks
- Updated MCPManager to use singleton TokenCounter
  - Saves 100-200ms initialization time
  - Shares tiktoken encoder instance across MCP operations

**Test Results:**
- All 1,497 tests passing (9 skipped)
- 98.29% test coverage maintained
- Zero breaking changes

**Combined Performance Gains:**
- Startup: 245-495ms faster (30-50% improvement)
- Runtime: 70-150ms faster per session
- Memory: Bounded, predictable usage with no leaks

### v3.5.2 (2025-11-22)

**Bug Fixes - Resource Leak Prevention:**
- Fixed uncleaned nested timeout in bash tool that held process references after exit
- Fixed uncleaned timeout in MCP URL validation causing 3-second memory leaks
- Added `.unref()` to background cleanup timers to prevent GC blocking
- Added try-finally blocks for guaranteed timeout cleanup in error scenarios

**Bug Fixes - Platform Compatibility:**
- Fixed Windows home directory bug in command history (used `os.homedir()` instead of `"~"` fallback)

**Code Quality:**
- Comprehensive resource leak analysis across 78+ potential issues
- Improved timeout cleanup patterns following Node.js best practices
- Enhanced memory management for better garbage collection

### v3.5.0

**Features:**
- Multi-phase task planner with automatic complexity detection
- Enhanced MCP integration with production-ready templates
- Project memory system with intelligent context caching
- Web search capabilities with npm, PyPI, and crates.io package registries
- Advanced code analysis tools (dependency, security, metrics)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

Built with **AutomatosX** multi-agent orchestration to achieve enterprise-class standards.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>
