# AX CLI - Comprehensive Features Guide

Welcome to the complete features documentation for **AX CLI**, an enterprise-class AI command line interface designed for GLM (General Language Model) with multi-provider support.

**Current Version:** v3.8.7

---

## Table of Contents

1. [GLM-First Architecture](#glm-first-architecture)
2. [Multi-Provider AI Support](#multi-provider-ai-support)
3. [Enterprise-Grade Security](#enterprise-grade-security)
4. [Intelligent Automation](#intelligent-automation)
5. [Extensibility](#extensibility)
6. [Developer Experience](#developer-experience)
7. [Enterprise Quality](#enterprise-quality)
8. [GLM 4.6 - Advanced AI Features](#glm-46---advanced-ai-features)

---

## GLM-First Architecture

AX CLI is optimized specifically for **GLM (General Language Model)** deployments, making it the ideal choice for organizations leveraging GLM technology.

### Key Capabilities

#### Primary Support
- **Optimized for GLM**: Built from the ground up with GLM's architecture and capabilities in mind
- **GLM 4.6 Default**: Production-ready with 200K context window and advanced reasoning capabilities
- **32K Max Tokens**: Industry-standard output (matches Claude Code CLI)
- **Purpose-Built**: Every feature designed to maximize GLM's potential

#### Local Deployment
- **Run GLM 4.6 Locally**: Deploy GLM 4.6 and other GLM models locally via Ollama
- **Complete Privacy**: Zero internet dependency for absolute data security
- **No API Keys Required**: Self-contained deployments without external dependencies
- **Full Offline Capabilities**: Complete conversational AI capabilities without any cloud connectivity

**Example: Running GLM locally**
```bash
# Start Ollama with GLM
ollama pull glm-4.6
ollama serve

# In another terminal, use AX CLI with local GLM
ax-cli --base-url http://localhost:11434/v1 --model glm-4.6
```

#### Cloud Deployment
- **Cloud-Hosted GLM Services**: Connect to cloud-hosted GLM services such as Z.AI
- **Seamless Integration**: Switch between local and cloud deployments without code changes
- **Scalability**: Leverage cloud infrastructure for demanding workloads

**Example: Cloud deployment**
```bash
# Use cloud-hosted GLM via Z.AI
ax-cli --base-url https://api.z.ai/v1 --model glm-4.6 --api-key YOUR_KEY
```

---

## Multi-Provider AI Support

While optimized for GLM, AX CLI supports a wide ecosystem of AI providers and models, giving you maximum flexibility.

### Primary Models

**GLM Models** (Default, Recommended)
- `glm-4.6`: Flagship model with 200K context window and reasoning mode (32K max output)
- `glm-4.5v`: Vision-capable variant for multimodal workflows

### Local Models via Ollama

Deploy any Ollama-supported model locally:

- **Llama 3.1**: Meta's state-of-the-art language model
- **Qwen 2.5**: Alibaba's powerful multilingual model
- **DeepSeek**: Advanced reasoning capabilities
- **And more**: Any model available in Ollama registry

**Quick Start - Local Models**
```bash
# Install Ollama from ollama.ai

# Pull and run a model
ollama pull llama3.1
ollama serve

# Use with AX CLI (default port 11434)
ax-cli --model llama3.1
```

### Cloud Providers

AX CLI works with leading AI service providers via OpenAI-compatible API:

- **Z.AI Platform**: Native support for Z.AI GLM API server (recommended)
- **OpenAI**: GPT-4, GPT-4 Turbo
- **Anthropic**: Claude models (via compatible endpoints)
- **Google**: Gemini models (via compatible endpoints)
- **OpenRouter**: Multi-provider access
- **Groq**: Ultra-fast inference

**Example: Using OpenAI GPT-4**
```bash
ax-cli --base-url https://api.openai.com/v1 \
       --model gpt-4 \
       --api-key sk-YOUR_KEY
```

### OpenAI-Compatible API

**Universal Support**: Works with ANY OpenAI-compatible endpoint

```bash
# Works with any OpenAI-compatible API
ax-cli --base-url http://your-server:8000/v1 \
       --model your-model \
       --api-key your-key
```

### Configuration Priority

The system respects this configuration hierarchy:
1. **CLI Flags** (highest priority)
2. **Environment Variables**
3. **Project Settings** (`.ax-cli/settings.json`)
4. **User Settings** (`~/.ax-cli/config.json`)
5. **Defaults** (glm-4.6, lowest priority)

**Example: Configuration**
```bash
# CLI flag (highest priority)
ax-cli --model glm-4.6 --temperature 0.7

# Environment variable
export AI_MODEL=glm-4.6
ax-cli

# Project settings (.ax-cli/settings.json)
{
  "model": "glm-4.6",
  "temperature": 0.7
}

# User settings (~/.ax-cli/config.json)
{
  "defaultModel": "glm-4.6",
  "apiKey": "encrypted..."
}
```

---

## Enterprise-Grade Security

**NEW in v3.6.0** - Production-ready security features, **FREE & Open Source**.

### Security Features

**Command Injection Protection** (CVSS 9.8 CRITICAL fix)
- Safe command execution with whitelisting
- Input sanitization and validation
- Prevents arbitrary command execution

**Path Traversal Hardening** (CVSS 8.6 HIGH fix)
- Prevents unauthorized file system access
- Validates all file paths
- Sandboxed file operations

**SSRF Attack Prevention** (CVSS 7.5 HIGH fix)
- MCP transport URL validation
- Blocks private IP ranges
- Prevents internal network access

**Input Sanitization** (CVSS 7.0 HIGH fix)
- Comprehensive input validation
- XSS prevention
- SQL injection protection

**Error Sanitization** (CVSS 6.5 MEDIUM fix)
- Prevents sensitive data leakage
- Sanitized error messages
- No credential exposure

**API Key Encryption**
- AES-256-GCM encryption at rest
- Automatic migration from plain-text
- Secure key storage

**Memory Leak Fixes**
- Process pool management
- Proper resource cleanup
- Long-running operation optimization

**Security Audit Logging**
- Basic JSON logging
- 30-day retention
- Compliance tracking

**Rate Limiting**
- Token bucket algorithm
- 100 requests/minute default
- Prevents API abuse

### Production-Ready

- **1381+ tests passing** with **98.29% coverage**
- All security modules fully tested
- User-friendly defaults
- Zero configuration required

---

## Intelligent Automation

AX CLI leverages AI to automate complex development workflows, reducing manual effort and increasing productivity.

### Smart File Operations

**Automatic Intelligence**
- AI automatically reads, creates, and edits files based on conversation context
- Understands intent without explicit file path specifications
- Learns from previous operations in the conversation

**Example: Intelligent File Handling**
```bash
# AI infers the right files to read
ax-cli -p "What security vulnerabilities exist in our authentication code?"
# -> Automatically finds and reads auth-related files

# AI creates files when needed
ax-cli -p "Generate a test file for the user service"
# -> Creates tests/user.test.ts with appropriate structure

# AI edits multiple files intelligently
ax-cli -p "Update all deprecated API calls to v2"
# -> Finds and updates all files referencing old API
```

### Bash Integration

**Natural Shell Commands**
- Execute shell commands through conversational prompts
- Receive AI interpretation of command results
- Chain operations naturally

**Example: Bash Execution**
```bash
# Natural language to shell
ax-cli -p "Show me all TypeScript files that don't have tests"
# -> Executes ripgrep search, interprets results

# Complex operations
ax-cli -p "Find all TODO comments and create a task list"
# -> Finds TODOs, creates structured task summary

# CI/CD integration
ax-cli -p "Run tests, commit changes, and create a pull request"
# -> Executes test suite, stages changes, creates PR
```

### Automatic Tool Selection

**Intelligent Decision Making**
- AI determines which tools are needed for a task
- No manual tool selection required
- Adapts approach based on task complexity

**Available Tools**
- **Text Editor**: File creation and modification
- **Bash**: Shell command execution
- **Search**: Intelligent file searching with ripgrep
- **Todo Tool**: Task tracking and management
- **Confirmation Tool**: User approval workflows
- **MCP Tools**: Extended capabilities via Model Context Protocol

### Multi-Step Task Execution

**Complex Workflow Support**
- Handle intricate workflows with up to **400 tool rounds**
- Each tool round: AI decision → action → result → learning
- Supports loops, conditionals, and error recovery

**Example: Multi-Step Workflow**
```bash
ax-cli -p "Refactor the authentication module:
1. Analyze current implementation
2. Identify code smells
3. Create test cases
4. Implement improvements
5. Verify tests still pass
6. Update documentation"

# This might use 20-50 tool rounds:
# Round 1-3: Read and analyze auth files
# Round 4-8: Create comprehensive test files
# Round 9-15: Update auth implementation
# Round 16: Run tests
# Round 17-20: Update documentation
```

### Smart Paste Auto-Collapse

**NEW in v3.6.1** - Intelligent handling of large text inputs

- **Automatic collapse**: 20+ line pastes auto-collapse for readability
- **Ctrl+P to expand**: Review pasted content anytime
- **Full AI submission**: Complete text sent to AI (not just placeholder)
- **Configurable threshold**: Customize in `~/.ax-cli/config.json`

```json
{
  "paste": {
    "autoCollapse": true,
    "collapseThreshold": 20
  }
}
```

### Intelligent Context Management

**Infinite Conversation Support**
- Automatic pruning at 75% token usage (150K tokens for GLM 4.6)
- Preserves critical context (initial messages, recent work)
- Maintains conversation coherence across pruning

**How It Works**
```
Token Usage                    Action
0-75% (0-150K)                All messages kept
75-85% (150-170K)             Begin pruning less important messages
85%+ (170K+)                  Aggressive pruning, keep essentials
New message received           Context auto-adjusted before API call
```

### Project Memory

**NEW in v3.5.0** - Intelligent context caching for z.ai GLM-4.6

- Automatic project scanning and context generation
- z.ai implicit caching support (50% token savings)
- Cache statistics tracking and efficiency monitoring

```bash
# Initialize project memory
ax-cli memory warmup

# Show memory status
ax-cli memory status

# Cache statistics
ax-cli memory cache-stats
```

---

## Extensibility

AX CLI provides multiple ways to extend functionality and customize behavior.

### MCP Protocol Support

**Model Context Protocol Integration**
- Integrate any MCP server for extended capabilities
- Dynamic tool registration from servers
- stdio, HTTP, and SSE transports supported

**12+ Pre-configured Templates**
- Figma, GitHub, Vercel, Puppeteer
- Storybook, Sentry, Linear, and more
- One-command setup: `ax-cli mcp add figma --template`

**Common MCP Integrations**

| Server | Capabilities | Transport |
|--------|--------------|-----------|
| **Linear** | Issue tracking, project management | SSE |
| **GitHub** | Repository access, PR management | stdio |
| **Figma** | Design-to-code workflows | SSE |
| **Filesystem** | Advanced file operations | stdio |

**Configuration Example**
```json
{
  "mcpServers": {
    "linear": {
      "transport": "sse",
      "url": "https://mcp.linear.app/sse"
    },
    "github": {
      "transport": "stdio",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"]
    }
  }
}
```

### Custom Instructions

**Project-Specific AI Behavior**
- Create `.ax-cli/CUSTOM.md` for project-specific guidance
- Influences how AI approaches tasks
- Examples: coding standards, project conventions, security requirements

**Example: Custom Instructions**
```markdown
# AX CLI Custom Instructions

## Code Style
- Use Prettier for formatting
- Follow ESLint rules in .eslintrc
- Maximum line length: 100 characters

## Testing
- All new code must have 80%+ test coverage
- Use Vitest for unit tests
- Use Playwright for E2E tests

## Security
- Never log sensitive data
- Always validate user input
- Use environment variables for secrets
```

---

## Developer Experience

AX CLI provides multiple interfaces optimized for different workflows.

### Interactive Mode

**Conversational AI in Your Terminal**
- Natural back-and-forth conversation with AI
- Real-time streaming of responses
- Beautiful Ink-based terminal UI
- Syntax highlighting for code
- Smart paste auto-collapse

**Launch Interactive Mode**
```bash
ax-cli              # Start interactive session
ax-cli init         # Initialize project with guided setup
ax-cli mcp list     # Manage MCP servers interactively
```

**Interactive Features**
- Multi-turn conversation history with `--continue`
- Character counter with visual warnings
- Keyboard shortcuts (Ctrl+P for paste expand/collapse)
- Export conversation logs
- Visual reasoning display (GLM 4.6)

### Headless Mode

**Scriptable Single-Prompt Execution**
- Perfect for CI/CD pipelines
- Scriptable automation
- Deterministic output
- Suitable for automated workflows

**Launch Headless Mode**
```bash
# Single prompt execution
ax-cli -p "Analyze security vulnerabilities"

# With specific model
ax-cli --model glm-4.6 -p "Generate API documentation"

# In CI/CD pipeline
ax-cli --model glm-4.6 \
       --max-tool-rounds 20 \
       -p "Run tests and create release notes"
```

### Health Check & Diagnostics

**NEW in v3.5.0** - Comprehensive system diagnostics

```bash
ax-cli doctor

# Checks:
# ✓ API connectivity
# ✓ Model configuration
# ✓ MCP server configuration
# ✓ Dependencies (ripgrep, git)
```

---

## Enterprise Quality

AX CLI meets production standards with comprehensive testing, type safety, and automation.

### Test Coverage

**98.29% Test Coverage** (v3.6.1)
- Comprehensive test suite: **1,381 tests**
- Focus areas:
  - Text utilities: Unicode handling, string operations
  - Token counting: Accurate usage tracking
  - Schema validation: Input validation with Zod
  - Tool execution: All tools thoroughly tested
  - Security modules: Fully tested and validated

**Coverage Breakdown**
| Component | Coverage |
|-----------|----------|
| Text Utils | 98%+ |
| Token Counter | 95%+ |
| Schemas/Validation | 95%+ |
| Tools | 70%+ |
| Security Modules | 100% |
| UI Components | 50%+ |

**Run Tests**
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode for development
npm run test:coverage      # Generate coverage report
npm run test:ui            # Interactive test UI
```

### TypeScript + Zod

**Type Safety Stack**
- **TypeScript 5.3+**: Strict mode enabled, no implicit any
- **Zod Runtime Validation**: All external inputs validated at runtime
- **Compile-Time Safety**: Comprehensive type checking
- **Runtime Safety**: Zod schemas catch invalid data

**Example: Type Safety**
```typescript
// Compile-time type checking
function processMessage(msg: ChatMessage): Promise<void> {
  // TypeScript prevents type errors at compile time
}

// Runtime validation with Zod
const result = safeValidateUserSettings(data);
if (!result.success) {
  // Handle validation error
  console.error('Settings invalid:', result.error);
}
```

### Single Source of Truth (SSOT)

**@defai.digital/ax-cli-schemas** package provides:
- Centralized Zod schemas
- Brand types for ID safety
- Centralized enums
- Type safety across all modules

### Node.js 24+ Support

**Modern JavaScript Runtime**
- Latest JavaScript features
- ESM modules throughout (no CommonJS)
- Better performance and reliability
- Future-proof architecture

**Requirements**
```bash
node --version  # Must be 24.0.0 or higher
npm --version   # 10.0.0 or higher recommended
```

---

## GLM 4.6 - Advanced AI Features

AX CLI provides **first-class support for GLM 4.6**, the flagship model with industry-leading capabilities.

### Why GLM 4.6?

GLM 4.6 is the **default model** in AX CLI, chosen for its exceptional performance:

| Feature | GLM 4.6 | Industry Average |
|---------|---------|------------------|
| **Context Window** | 200,000 tokens | 32,000-128,000 |
| **Max Output** | 32,000 tokens | 4,000-8,000 |
| **Reasoning Mode** | ✅ Built-in | ❌ Rare |
| **Temperature Range** | 0.6-1.0 (optimized) | 0.0-2.0 |
| **Token Efficiency** | 30% better | Baseline |
| **Local Support** | ✅ Via Ollama | Limited |
| **Cloud Support** | ✅ Via Z.AI | Limited |

### Thinking Mode (Reasoning)

**See the AI's Reasoning Process**

GLM 4.6's thinking mode shows the AI's reasoning before providing answers, creating transparency and explainability.

#### Example Session

```
You: Explain the best approach to refactor this codebase

💭 Thinking...
Let me analyze the codebase structure first. I see it uses TypeScript with ESM modules.
The main issues appear to be:
1. Circular dependencies in the utils/ folder
2. Inconsistent error handling patterns
3. Missing type definitions for external APIs

AI: Here's my recommended refactoring strategy:

## Phase 1: Dependency Graph Resolution
- Break circular dependencies
- Extract shared types into separate modules
...
```

#### Benefits

- **🔍 Transparency**: See exactly how the AI arrives at conclusions
- **🎯 Better Decisions**: Understand the reasoning behind suggestions
- **🐛 Easier Debugging**: Identify where AI logic went wrong
- **📚 Learning Tool**: Learn problem-solving approaches

### Massive Context Window

**200,000 Tokens of Context**

- **📦 40+ average TypeScript files** (~5K tokens each)
- **📚 Complete documentation sets**
- **💬 500+ back-and-forth messages**
- **🔍 Full repository context**

### Token Efficiency

- **30% Better Efficiency**: Uses tokens more effectively
- **Lower Costs**: Accomplish more with fewer tokens
- **Faster Responses**: Fewer tokens = faster processing

---

## Getting Started

### Quick Start

```bash
# Install globally
npm install -g @defai.digital/ax-cli

# Initialize your project
ax-cli init

# Start using AX CLI
ax-cli

# Or use with a specific prompt
ax-cli -p "Analyze this codebase and suggest improvements"
```

### Secure Configuration

Use the setup wizard for secure API key configuration:

```bash
ax-cli setup

# Features:
# - Interactive API key input
# - AES-256-GCM encryption
# - Automatic migration from plain-text
# - Secure storage in ~/.ax-cli/config.json
```

### Next Steps

- Read the [Main README](../README.md) for quick start guide
- Check the [MCP Integration Guide](./mcp.md) for extended capabilities
- Review [Development Guide](./development.md) for contributing
- Explore [CLI Reference](./cli-reference.md) for all commands

---

## Summary

AX CLI v3.6.1 combines the power of GLM 4.6 with enterprise-grade security and a flexible, extensible architecture.

**Key Takeaways:**
- ✅ GLM 4.6 with 200K context window (32K max output)
- ✅ Enterprise-grade security (FREE & Open Source)
- ✅ 1,381 tests with 98.29% coverage
- ✅ Smart paste auto-collapse for better UX
- ✅ MCP protocol for extensibility
- ✅ Beautiful terminal UI with real-time streaming
- ✅ Works locally or in the cloud
