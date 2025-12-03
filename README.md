# AX CLI - Enterprise-Class CLI for Vibe Coding

[![npm](https://img.shields.io/npm/dt/@defai.digital/ax-cli?style=flat-square&logo=npm&label=downloads)](https://npm-stat.com/charts.html?package=%40defai.digital%2Fax-cli)
[![Tests](https://img.shields.io/badge/tests-2112%20passing-brightgreen?style=flat-square)](https://github.com/defai-digital/ax-cli/actions/workflows/test.yml)
[![Coverage](https://img.shields.io/badge/coverage-98%2B%25-brightgreen?style=flat-square)](https://github.com/defai-digital/ax-cli)
[![macOS](https://img.shields.io/badge/macOS-26.0-blue?style=flat-square&logo=apple)](https://www.apple.com/macos/)
[![Windows](https://img.shields.io/badge/Windows-10%2B-blue?style=flat-square&logo=windows)](https://www.microsoft.com/windows)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-blue?style=flat-square&logo=ubuntu)](https://ubuntu.com/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

<p align="center">
  <img src=".github/assets/screenshot1.png" alt="AX CLI Screenshot" width="800"/>
</p>

<p align="center">
  <strong>GLM-Optimized CLI • Enterprise Architecture • 98%+ Test Coverage</strong>
</p>

---

## Quick Start

```bash
# Install globally
npm install -g @defai.digital/ax-cli

# Configure (secure API key setup)
ax-cli setup

# Initialize your project
ax-cli init

# Start coding!
ax-cli
```

**That's it!** AX CLI is now ready to help you build, debug, and ship code faster.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [MCP Integration](#mcp-integration)
- [Figma Integration](#figma-integration)
- [Project Memory](#project-memory)
- [Multi-Phase Planner](#multi-phase-task-planner)
- [Security](#security)
- [Architecture](#architecture)
- [Changelog](#changelog)
- [Recent Changes (v3.15.3)](#recent-changes-v3153)
- [Documentation](#documentation)

---

## Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **GLM-Optimized** | Primary support for Z.AI's GLM-4.6 (200K context) and GLM-4.5v (vision) |
| **Multi-Phase Planner** | Intelligent task decomposition for complex requests |
| **Session Continuity** | Directory-specific conversation history with `--continue` |
| **MCP Integration** | Model Context Protocol with 12+ production-ready templates |
| **Project Memory** | Intelligent context caching with 50% token savings |
| **Smart Verbosity** | Three-level output control (Quiet → Concise → Verbose) |
| **Auto-Update** | Automatic update check on startup with user confirmation |

### AI Provider Support

- **Z.AI GLM-4.6** (default) - 200K context, optimized for complex code generation
- **Z.AI GLM-4.5v** (vision) - 64K multimodal context, auto-switches for image analysis
- **OpenAI** - GPT-4, GPT-3.5
- **Anthropic** - Claude models
- **Ollama** - Local models
- **Custom endpoints** - Any OpenAI-compatible API

> **Note**: For xAI Grok, use [grok-cli](https://github.com/superagent-ai/grok-cli). For Anthropic Claude, use [claude-code](https://claude.ai/code).

### Security (Enterprise-Grade, FREE)

| Protection | Severity | Description |
|------------|----------|-------------|
| API Key Encryption | - | AES-256-GCM encryption at rest |
| Command Injection | CVSS 9.8 | Safe command execution with whitelisting |
| Path Traversal | CVSS 8.6 | Prevent unauthorized file system access |
| SSRF Prevention | CVSS 7.5 | Validate MCP transport URLs |
| Input Sanitization | CVSS 7.0 | Comprehensive input validation |
| Rate Limiting | - | Token bucket algorithm (100 req/min) |

### Code Analysis Tools

- **Dependency Analyzer** - Circular dependencies, coupling metrics
- **Code Smell Detector** - 10+ anti-patterns detection
- **Hotspot Analyzer** - Git history-based complexity analysis
- **Security Scanner** - SQL injection, XSS, hardcoded secrets
- **Multi-Language Support** - TypeScript, JavaScript, Python, Rust, Go, C, C++, Swift, HTML, CSS

---

## Installation

### Supported Platforms

| Platform | Versions | Architecture |
|----------|----------|--------------|
| **macOS** | 26+ | x64, ARM64 (Apple Silicon) |
| **Windows** | 11+ | x64, ARM64 |
| **Ubuntu** | 24.04+ | x64, ARM64 |

### Prerequisites

- Node.js 24.0.0 or higher
- npm package manager

### Install

```bash
npm install -g @defai.digital/ax-cli
```

---

## Configuration

### Quick Setup (Recommended)

```bash
ax-cli setup
```

This interactive wizard will:
1. Guide you through provider selection
2. Securely encrypt and store your API key (AES-256-GCM)
3. Configure default model and settings
4. Validate your configuration

### Environment Variable Override

For CI/CD pipelines:

```bash
export YOUR_API_KEY=your_api_key_here
ax-cli
```

### Configuration Files

| File | Purpose |
|------|---------|
| `~/.ax-cli/config.json` | User settings (API keys encrypted) |
| `.ax-cli/settings.json` | Project-specific overrides |
| `.ax-cli/CUSTOM.md` | AI behavior customization |
| `.ax-cli/memory.json` | Auto-generated context cache |

### Auto-Update Settings

AX CLI automatically checks for updates on startup and prompts you to install. Configure in `~/.ax-cli/config.json`:

```json
{
  "autoUpdate": {
    "enabled": true,
    "checkIntervalHours": 24,
    "autoInstall": false
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable/disable automatic update checks |
| `checkIntervalHours` | `24` | Hours between update checks (0 = always check) |
| `autoInstall` | `false` | Auto-install without prompting (not recommended) |

---

## Usage

### Interactive Mode

```bash
# Start interactive chat
ax-cli

# Continue previous conversation
ax-cli --continue
ax-cli -c
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/continue` | Continue incomplete response |
| `/init` | Initialize project |
| `/clear` | Clear chat history |
| `/models` | Switch AI model |
| `/usage` | Show API usage statistics |
| `/doctor` | Run health check diagnostics |
| `/tasks` | List background tasks |
| `/exit` | Exit application |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+O** | Cycle verbosity (Quiet → Concise → Verbose) |
| **Ctrl+B** | Move command to background |
| **Ctrl+K** | Quick actions menu |
| **Shift+Tab** | Toggle auto-edit mode |
| **Ctrl+C** | Clear input (press twice to exit) |
| **Esc×2** | Clear input (press Escape twice quickly) |
| **↑/↓** | Navigate command history |

### Headless Mode

```bash
# One-shot commands
ax-cli -p "analyze this codebase"
ax-cli -p "fix TypeScript errors" -d /path/to/project
ax-cli -p "write tests" --max-tool-rounds 50

# With specific model
ax-cli -p "refactor" --model glm-4.6
```

### Background Tasks

```bash
# Append '&' to run in background
> npm run dev &

# Or press Ctrl+B during execution

# Manage tasks
/tasks              # List all
/task bg_abc123     # View output
/kill bg_abc123     # Kill task
```

### Health Check

```bash
ax-cli doctor           # Run diagnostics
ax-cli doctor --verbose # Detailed output
ax-cli doctor --json    # JSON format
```

---

## MCP Integration

Extend AX CLI with Model Context Protocol servers:

```bash
# Add from template (one command!)
ax-cli mcp add figma --template

# Add custom server
ax-cli mcp add linear --transport sse --url https://mcp.linear.app/sse

# List servers
ax-cli mcp list

# Preview tools
ax-cli mcp tools <server>

# Browse templates
ax-cli mcp browse
```

### Available Templates

Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, and 6+ more.

### Per-Server Timeout

For long-running tools (e.g., AutomatosX):

```json
{
  "mcpServers": {
    "automatosx": {
      "transport": { "type": "stdio", "command": "ax", "args": ["mcp"] },
      "timeout": 2700000
    }
  }
}
```

---

## Figma Integration

Connect AX CLI with Figma for design-to-code workflows:

### Interactive Mode (Recommended)

```bash
# Start interactive mode
ax-cli

# Then use natural language:
> Map my Figma file ABC123xyz
> Extract design tokens from my Figma file and format as Tailwind
> Audit my design for accessibility issues
> Search for all button components in my Figma file
```

### CLI Commands

```bash
# Authenticate with Figma
ax-cli design auth login

# Map your Figma file structure
ax-cli design map YOUR_FILE_KEY

# Extract design tokens
ax-cli design tokens pull YOUR_FILE_KEY --format tailwind

# Audit design consistency
ax-cli design audit YOUR_FILE_KEY --rules all
```

For the complete guide, see **[Figma Integration Guide](docs/figma-guide.md)**.

---

## Project Memory

Intelligent context caching for reduced token costs:

```bash
# Initialize (scans codebase)
ax-cli memory warmup

# Output:
# ✓ Project memory generated (3,305 tokens)
# 📊 Token Distribution:
#    Structure:  1,252 tokens (38%)
#    README:     1,111 tokens (34%)
#    Config:       835 tokens (25%)
#    Patterns:      99 tokens (3%)
```

### Commands

| Command | Description |
|---------|-------------|
| `memory warmup` | Create project memory |
| `memory refresh` | Update after changes |
| `memory status` | Show status & token distribution |
| `memory clear` | Remove project memory |
| `memory cache-stats` | Show cache efficiency |

### Options

```bash
ax-cli memory warmup -d 5           # Custom scan depth (1-10)
ax-cli memory warmup -m 12000       # Custom max tokens
ax-cli memory warmup --dry-run      # Preview without saving
```

---

## Multi-Phase Task Planner

Automatic decomposition for complex requests:

```bash
> "Refactor auth, add tests, update docs"

📋 Plan Generated: 4 phases
├── Phase 1: Analysis (low risk)
├── Phase 2: Implementation (medium risk)
├── Phase 3: Testing (low risk)
└── Phase 4: Documentation (low risk)
```

### Plan Commands

| Command | Description |
|---------|-------------|
| `/plans` | List all execution plans |
| `/plan` | Show current plan details |
| `/phases` | Show phase progress |
| `/pause` | Pause current plan |
| `/resume` | Resume paused plan |
| `/skip` | Skip current phase |
| `/abandon` | Abandon current plan |

### Complexity Triggers

- Refactoring, migration, restructuring
- Multi-file changes
- Testing and documentation requests
- Multi-step instructions

---

## Security

### API Key Protection

- **AES-256-GCM** encryption at rest
- **PBKDF2** key derivation (600,000 iterations)
- **Secure permissions** (0600 owner-only)
- **Auto-migration** from plain-text

### Best Practices

1. **CI/CD**: Use environment variables
2. **Permissions**: Verify `ls -la ~/.ax-cli/config.json` shows `-rw-------`
3. **Git**: Add `.ax-cli/` to `.gitignore`
4. **Rotation**: Update regularly via `ax-cli setup`

### Privacy

- API keys: **Never logged**
- Telemetry: **None collected**
- Errors: Sanitized to remove sensitive data

### Report Issues

Email: **security@defai.digital** (private disclosure)

---

## Architecture

- **SSOT Type System** via `@ax-cli/schemas`
- **TypeScript strict mode** with Zod validation
- **98%+ test coverage** (2112+ tests)
- **Modular design** with clean separation
- **Enterprise security** with AES-256-GCM encryption

---

## Recent Changes (v3.15.3)

### Bug Fixes

- **Z.AI MCP HTTP Transport Fix**: Fixed critical bug where Z.AI web search and web reader MCP servers couldn't connect due to missing `Accept` header. The MCP Streamable HTTP transport now correctly sets `Accept: application/json, text/event-stream` as required by the MCP specification.

## Previous Changes (v3.15.2)

### Bug Fixes

- **Z.AI Vision Timeout Fix**: Fixed MCP timeout issue where existing `zai-vision` configs were using the default 60s timeout instead of the required 120s. Now auto-applies the correct timeout for Z.AI Vision servers.
- **Z.AI Vision Quiet Mode Fix**: Fixed INFO log messages still appearing despite quiet mode. Now auto-applies `quiet: true` for Z.AI Vision servers to suppress console output.

These fixes are backward-compatible - existing users don't need to re-run setup; the defaults are applied automatically when loading configs.

## Previous Changes (v3.15.1)

### Improvements

- **MCP Init Timeout Configuration**: Added `initTimeout` option for MCP server initialization (separate from tool call timeout). Useful for servers that need longer startup time (e.g., npx-based servers that download packages).
- **Z.AI Vision MCP Quiet Mode**: Suppressed INFO/DEBUG logs and npm warnings from Z.AI Vision MCP server for cleaner console output.

## Previous Changes (v3.15.0)

### New Features

- **MCP Progress Tracking**: Support for `notifications/progress` to track long-running MCP operations with real-time progress updates
- **MCP Cancellation Support**: Full cancellation support via `notifications/cancelled` to abort long-running operations
- **MCP Resource Subscriptions**: Subscribe to resource changes with `resources/subscribe` and `resources/unsubscribe`
- **MCP Output Schema Validation**: Automatic validation of tool outputs against JSON Schema definitions
- **Figma MCP Template Update**: Switched to community `mcp-figma` package for better compatibility

### Bug Fixes

- **Non-Interactive Environment Fix**: Setup wizard now gracefully handles non-interactive environments (CI/tests)
- **AutomatosX Auto-Update**: `ax-cli update` now automatically updates AutomatosX after successful ax-cli update

## Previous Changes (v3.14.15)

### New Features

- **AutomatosX Integration in Setup**: Setup wizard now detects AutomatosX and offers to update (if installed) or install (if not) for multi-agent AI orchestration with persistent memory.

## Previous Changes (v3.14.14)

### Bug Fixes

- **MCP SDK HTTP Transport Integration**: Replaced custom HTTP transport with MCP SDK's official `StreamableHTTPClientTransport` for proper MCP protocol support. This enables Z.AI MCP servers (web-search, web-reader, vision) to connect and work correctly.
- **MCP SSE Transport Update**: Updated SSE transport to use MCP SDK's official `SSEClientTransport` for better compatibility.

## Previous Changes (v3.14.13)

### Bug Fixes

- **Z.AI MCP HTTP Transport Fix**: Fixed HTTP transport to post directly to the endpoint URL instead of appending `/rpc`. This enables Z.AI MCP servers (web-search, web-reader) to connect properly.
- **MCP Health Check Removed**: Removed unnecessary HTTP health check that was failing for MCP endpoints without `/health` endpoints.

## Previous Changes (v3.14.12)

### Bug Fixes

- **MCP Setup Hang Fix**: Fixed critical issue where `ax-cli setup` would hang indefinitely after enabling Z.AI MCP servers. The setup was incorrectly connecting to MCP servers (spawning long-running processes) instead of just saving the configuration.

## Previous Changes (v3.14.11)

### Bug Fixes

- **Settings Save Fix**: Fixed issue where `ax-cli setup` would fail with "Cannot save settings: failed to decrypt existing API key" when the existing encrypted API key was corrupted or undecryptable. Now correctly uses the new API key provided by the user instead of failing.
- **History Navigation Fix**: Fixed state management bug in input history where pressing down arrow at the last history item didn't properly reset the navigation state.
- **Non-null Assertion Fixes**: Removed unsafe non-null assertions in `figma-map.ts` and `image-handler.ts` with proper null-safe alternatives.
- **Type Safety Improvements**: Fixed TypeScript type errors and removed unused variable warnings across multiple files.

## Previous Changes (v3.14.10)

### Security Fix

- **MCP SDK Update**: Updated `@modelcontextprotocol/sdk` from 1.22.0 to 1.24.0 to fix DNS rebinding protection vulnerability (GHSA-w48q-cv73-mx4w)

## Previous Changes (v3.14.9)

### AST Parser Simplification

- **Removed tree-sitter Dependency**: Simplified AST parsing to focus on TypeScript/JavaScript via ts-morph, reducing dependencies and complexity
- **Extended Language Detection**: Added file extension detection for Java, Ruby, PHP, Kotlin, Dart, C#, JSON, YAML, and TOML

### Checkpoint System Improvements

- **File Integrity Verification**: Added hash verification before restoring checkpoint files to detect corruption
- **Configuration Validation**: Improved validation for `pruneAfterDays` and `compressAfterDays` settings
- **Error Isolation**: Maintenance operations now continue even if individual stages fail

## Previous Changes (v3.14.8)

### CI/CD Improvements

- **NPM Publish Fix**: Added `--tag latest` to npm publish command to support version rollbacks in CI/CD

## Previous Changes (v3.14.7)

### Code Refactoring

- **Image Handler Optimization**: Consolidated duplicate regex patterns, reducing from 6 to 3 patterns with `lastIndex` reset for quick checks
- **Simplified Message Builder**: Streamlined `buildMessageContent` function with direct `push()` calls for better readability
- **Path Security Cleanup**: Simplified path traversal security check with improved readability using `.catch()` pattern

### Bug Fixes

- **Vision Model Max Tokens**: Fixed "Max tokens exceeds limit" error when auto-switching to glm-4.5v for image processing - now automatically clamps max tokens to model limit

## Previous Changes (v3.14.4)

### Improvements

- **Absolute Path Access**: Images from any location (Downloads, Desktop, etc.) now accessible when using absolute paths - security checks only apply to relative paths to prevent traversal attacks

### New Features (v3.14.3)

- **Quoted Path Support**: Image paths with spaces now supported using quotes (`@"path with spaces/image.png"` or `'/path/file name.jpg'`)

### Bug Fixes

- **Image Path Security**: Fixed edge case where root directory as base path incorrectly rejected valid files
- **Windows Path Support**: Added support for Windows absolute paths (`C:\path`) and UNC paths (`\\server\share`) in direct image input
- **Error Message Consistency**: Improved error messages to consistently include file path context
- **Token Constant Consolidation**: Unified `TOKENS_PER_IMAGE` to use single source of truth from configuration

---

## Previous Changes (v3.14.1)

### New Features

- **Image/Multimodal Support**: Send images directly in chat messages with automatic vision model switching (glm-4.5v)
- **Image Processing**: Support for PNG, JPG, JPEG, GIF, and WebP formats up to 10MB
- **Terminal Title**: Shows "ax-cli" instead of "node" in VS Code terminal

### Improvements

- **Token Counting**: Enhanced token estimation for multimodal messages
- **Chat Display**: Images shown as `[Image attached]` in chat history

---

## Previous Changes (v3.14.0)

### New Features

- **Z.AI MCP Auto-Detection**: Automatic detection and template suggestion for Z.AI's native MCP servers including Context7, Puppeteer, Memory, Filesystem, Exa, and PostgreSQL
- **Enhanced MCP Templates**: Updated MCP template system with Z.AI-optimized configurations
- **Improved Setup Flow**: Streamlined setup wizard with better provider detection

### SDK Updates (v1.3.0)

- **New Export**: `getMCPConnectionStatus()` returns `{ connected, failed, connecting, total }` for MCP server status monitoring

---

## Previous Changes (v3.13.0)

### New Features

- **MCP Status Indicator**: Status bar now shows MCP connection status with color coding (`mcp: ✓ 2/2` green, `mcp: ◐ 1/2` yellow/connecting, `mcp: ✗ 1/2` red/failed)
- **Enhanced MCP Error Messages**: Comprehensive error remediation for 20+ error codes including network errors (ECONNREFUSED, ETIMEDOUT), SSL errors, HTTP status codes (401, 403, 500), and MCP-specific errors with actionable troubleshooting steps

---

## Previous Changes (v3.12.10)

### Bug Fixes

- **Fixed parseInt NaN bug**: Git churn calculator now properly handles binary file stats (shown as `-` in git output) by defaulting to 0 instead of NaN.
- **Code quality improvements**: Multiple refactoring passes to improve readability, reduce duplication, and optimize performance across UI components and core modules.

---

## Previous Changes (v3.12.8)

### Bug Fixes

- **Fixed `/doctor` color display**: The `/doctor` command inside the CLI now shows proper colors - passing checks display with ✅ green checkmarks instead of red text. Fixed by disabling ANSI codes in subprocess output and converting to emoji indicators.

---

## Previous Changes (v3.12.7)

### New Features

- **VS Code File Reveal**: Files automatically open in VS Code after creation or modification, similar to Claude Code's IDE integration. Newly created files also appear in the Explorer panel.
- **File Organization Guidelines**: Added comprehensive prompt instructions for standardized file output paths (`automatosx/tmp/`, `automatosx/PRD/`, `automatosx/REPORT/`).

### VS Code Extension (v0.3.2)

- Added `file_reveal` IPC message type for automatic file display
- Files open in preview mode by default after write operations
- New files are revealed in VS Code Explorer

---

## Previous Changes (v3.12.6)

### New Features

- **Rolling Tool Display**: Implements Claude Code-style rolling display for consecutive tool operations. When there are more than 5 consecutive tool calls, older entries are collapsed with a "... X more (ctrl+o to expand)" summary, keeping the UI clean and focused on recent activity.

### Configuration

- **`max_visible_tool_lines`**: New UI setting (default: 5) to control how many consecutive tool operations are visible before older ones are rolled up.

---

## Previous Changes (v3.12.5)

### Bug Fixes

- **Fixed `[INFO]` logging pollution**: Analyzer log messages no longer appear in CLI output. Set `DEBUG=1` to enable verbose logging.
- **Fixed `ask_user` tool**: Implemented complete interactive question dialog system with EventEmitter pattern, multi-question flow support, and graceful fallback in non-TTY mode.

### New Features

- **QuestionDialog UI Component**: New interactive dialog for AI to ask clarifying questions during task execution
- **Multi-question support**: Ask multiple questions with progress indicators (e.g., "1/3")
- **Custom input option**: Users can select "Other" to provide free-text responses

### Technical Improvements

- Refactored `AskUserService` to use EventEmitter pattern (consistent with `ConfirmationService`)
- Added 13 new tests for question dialog functionality
- Improved code quality and test coverage

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Features](docs/features.md) | Complete feature list |
| [Installation](docs/installation.md) | Detailed installation guide |
| [Configuration](docs/configuration.md) | Configuration options |
| [Usage](docs/usage.md) | Comprehensive usage guide |
| [CLI Reference](docs/cli-reference.md) | Command-line reference |
| [MCP Integration](docs/mcp.md) | Model Context Protocol guide |
| [Figma Integration](docs/figma-guide.md) | Design-to-code workflow with Figma |
| [Architecture](docs/architecture.md) | Technical architecture |
| [Troubleshooting](docs/troubleshooting.md) | Common issues |

---

## Enterprise Features

For teams requiring advanced capabilities:

- **Compliance Reports** - SOC2, HIPAA, PCI-DSS
- **Advanced Audit Logging** - Tamper-proof with 1+ year retention
- **Team Collaboration** - Shared history with full-text search
- **Policy Enforcement** - Approval workflows
- **SSO/SAML** - Enterprise identity provider support
- **Priority Support** - 24-hour SLA

Contact: **sales@defai.digital**

---

## Acknowledgments

This project was inspired by and partially based on [grok-cli](https://github.com/superagent-ai/grok-cli). Thanks to the original authors for their open-source contributions.

### AI Co-Authors

This project is developed with assistance from multiple AI coding assistants:

- [AutomatosX](https://github.com/defai-digital/automatosx) - AI agent orchestration platform
- [Claude](https://github.com/claude) - Anthropic's AI assistant
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) - Google's AI coding assistant
- [Codex](https://github.com/openai/codex) - OpenAI's code generation model

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>


