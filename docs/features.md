# AX CLI - Comprehensive Features Guide

Welcome to the complete features documentation for **AX CLI**, an enterprise-class AI command line interface designed for GLM (General Language Model) with multi-provider support.

---

## Table of Contents

1. [GLM-First Architecture](#glm-first-architecture)
2. [Multi-Provider AI Support](#multi-provider-ai-support)
3. [Intelligent Automation](#intelligent-automation)
4. [Extensibility](#extensibility)
5. [Developer Experience](#developer-experience)
6. [Enterprise Quality](#enterprise-quality)
7. [GLM 4.6 - Advanced AI Features](#glm-46---advanced-ai-features)

---

## GLM-First Architecture

AX CLI is optimized specifically for **GLM (General Language Model)** deployments, making it the ideal choice for organizations leveraging GLM technology.

### Key Capabilities

#### Primary Support
- **Optimized for GLM**: Built from the ground up with GLM's architecture and capabilities in mind
- **GLM 4.6 Default**: Production-ready with 200K context window and advanced reasoning capabilities
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
- `glm-4.6`: Flagship model with 200K context window and reasoning mode
- `grok-code-fast-1`: Optimized for fast code generation
- `glm-4-air`: Lightweight variant for efficiency
- `glm-4-airx`: Ultra-fast inference model

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
ollama pull llama2
ollama serve

# Use with AX CLI (default port 11434)
ax-cli --model llama2
```

### Cloud Providers

AX CLI works with leading AI service providers:

- **OpenAI**: GPT-4, GPT-4 Turbo (via OpenAI-compatible API)
- **Anthropic**: Claude models
- **Google**: Gemini models
- **X.AI**: Grok models
- **OpenRouter**: Multi-provider access
- **Groq**: Ultra-fast inference
- **Z.AI Platform**: Native support for Z.AI GLM API server

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

### Backward Compatibility

**Full Support**: All models from the original grok-cli remain fully supported and functional.

**Configuration Priority**
The system respects this configuration hierarchy:
1. **CLI Flags** (highest priority)
2. **Environment Variables**
3. **Project Settings** (`.ax-cli/settings.json`)
4. **User Settings** (`~/.ax-cli/config.json`)
5. **Defaults** (glm-4.6, lowest priority)

**Example: Configuration**
```bash
# CLI flag
ax-cli --model glm-4.6 --temperature 0.7

# Environment variable
export GROK_MODEL=glm-4.6
ax-cli

# Project settings (.ax-cli/settings.json)
{
  "model": "glm-4.6",
  "temperature": 0.7
}

# User settings (~/.ax-cli/config.json)
{
  "defaultModel": "glm-4.6"
}
```

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
# Round 1: Read auth files (bash/search)
# Round 2: Analyze code (reasoning)
# Round 3-5: Create test files (editor)
# Round 6-10: Update auth implementation (editor)
# Round 11: Run tests (bash)
# Round 12-15: Update docs (editor)
# ... etc
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

### Project Analysis

**Automatic Structure Detection**
- `ax-cli init`: Auto-detects tech stack, conventions, and structure
- Generates appropriate configuration
- Creates custom instructions for AI behavior

**Example: Project Initialization**
```bash
cd my-project
ax-cli init

# Detects:
# - Language: TypeScript
# - Framework: React
# - Testing: Vitest
# - Linting: ESLint
# - Package Manager: npm
# - Git workflow: GitHub
#
# Creates: .ax-cli/settings.json with appropriate defaults
```

---

## Extensibility

AX CLI provides multiple ways to extend functionality and customize behavior.

### MCP Protocol Support

**Model Context Protocol Integration**
- Integrate any MCP server for extended capabilities
- Dynamic tool registration from servers
- Both stdio and HTTP transports supported

**Common MCP Integrations**

| Server | Capabilities | Transport |
|--------|--------------|-----------|
| **Linear** | Issue tracking, project management | HTTP/SSE |
| **GitHub** | Repository access, PR management | stdio |
| **Filesystem** | Advanced file operations | stdio |
| **Web Search** | Internet search capability | HTTP |

**Configuration Example**
```json
{
  "mcpServers": {
    "linear": {
      "transport": "sse",
      "url": "https://mcp.linear.app/sse",
      "apiKey": "YOUR_API_KEY"
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

## Documentation
- Update README for new features
- Add JSDoc comments to exported functions
- Keep CHANGELOG.md updated
```

### Plugin Architecture

**Extend with Popular Tools**
- Linear: Issue tracking and project management
- GitHub: Repository and PR operations
- Slack: Team notifications (via MCP)
- Jira: Issue management (via MCP)
- Custom servers: Build your own MCP servers

### Morph Fast Apply

**High-Speed Code Editing** (Optional)
- **4,500+ tokens/second** editing performance
- Dramatically faster for large codebase modifications
- Optional integration (requires Morph API key)

**Use Case**
```bash
# Standard editing (via built-in text editor)
ax-cli -p "Update all imports in the entire codebase to use new paths"
# May take moderate time for large projects

# With Morph Fast Apply (when enabled)
# Same operation completes 5-10x faster
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
- Reasoning display for GLM 4.6

**Launch Interactive Mode**
```bash
ax-cli              # Start interactive session
ax-cli init         # Initialize project with guided setup
ax-cli mcp list     # Manage MCP servers interactively
```

**Interactive Features**
- Multi-turn conversation history
- Edit previous messages
- Clear/reset conversation
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

**CI/CD Example**
```yaml
# GitHub Actions
- name: Auto-generate changelog
  run: |
    ax-cli --model glm-4.6 \
           -p "Generate changelog since last release" \
           > CHANGELOG_ENTRY.md
```

### Beautiful UI

**Terminal User Interface Features**
- **Ink-Based Design**: React components in terminal
- **Syntax Highlighting**: Code displays with proper coloring
- **Responsive Layout**: Adapts to terminal size
- **Real-Time Streaming**: See responses as they generate
- **Thinking Indicator**: Visual "💭 Thinking..." for reasoning mode
- **Error Handling**: Clear error messages with suggestions

**UI Components**
```
┌─────────────────────────────────────────┐
│  AX CLI - Interactive Mode              │
├─────────────────────────────────────────┤
│                                         │
│  You: Analyze the codebase              │
│                                         │
│  💭 Thinking...                         │
│                                         │
│  AI: I've analyzed your TypeScript      │
│  codebase. Here are the findings:       │
│                                         │
│  1. Strong typing: 98% coverage         │
│  2. Good test suite: 350+ tests         │
│  3. ...                                 │
│                                         │
├─────────────────────────────────────────┤
│  You: [Type your message here...]       │
└─────────────────────────────────────────┘
```

### Global Installation

**Use Anywhere**
- Install globally: `npm install -g ax-cli`
- Works in any directory
- Configurable per-project or globally

**Installation & Usage**
```bash
# Install globally
npm install -g ax-cli

# Use from any directory
cd any/project
ax-cli -p "Generate component tests"

# Or start interactive session
cd my-project
ax-cli
```

---

## Enterprise Quality

AX CLI meets production standards with comprehensive testing, type safety, and automation.

### Test Coverage

**98.29% Test Coverage**
- Comprehensive test suite: 80+ tests
- Focus areas:
  - **Text utilities**: Unicode handling, string operations
  - **Token counting**: Accurate usage tracking
  - **Schema validation**: Input validation with Zod
  - **Tool execution**: All tools thoroughly tested

**Coverage Breakdown**
| Component | Coverage |
|-----------|----------|
| Text Utils | 98%+ |
| Token Counter | 95%+ |
| Schemas/Validation | 95%+ |
| Tools | 70%+ |
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

### Automated CI/CD

**Continuous Integration Pipeline**
- Tests run on every commit
- Tests run on every PR
- Build verification
- Coverage reporting
- Automated release process

**GitHub Actions Workflow**
```yaml
- Run tests on every PR
- Check code coverage
- Lint and type checking
- Build verification
- Deploy to npm (on release)
```

### Comprehensive Documentation

**Documentation Resources**
- Main README: User-focused features and quick start
- This Guide: Detailed feature documentation
- GLM 4.6 Usage Guide: Model-specific capabilities
- GLM 4.6 Migration Guide: Upgrading from previous versions
- API References: Programmatic usage documentation
- CLAUDE.md: Development guidelines and architecture

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

GLM 4.6 is the **default model** in AX CLI, chosen for its exceptional performance across all use cases:

| Feature | GLM 4.6 | Industry Average |
|---------|---------|------------------|
| **Context Window** | 200,000 tokens | 32,000-128,000 |
| **Max Output** | 128,000 tokens | 4,000-8,000 |
| **Reasoning Mode** | ✅ Built-in | ❌ Rare |
| **Temperature Range** | 0.6-1.0 (optimized) | 0.0-2.0 (unstable) |
| **Token Efficiency** | 30% better | Baseline |
| **Local Support** | ✅ Via Ollama | Limited |
| **Cloud Support** | ✅ Via Z.AI | Limited |

### Thinking Mode (Reasoning)

**See the AI's Reasoning Process**

GLM 4.6's thinking mode shows the AI's reasoning before providing answers, creating transparency and explainability.

#### How It Works

When you ask GLM 4.6 a complex question, it:
1. **Thinks** (reasoning phase) - Analyzes the problem internally
2. **Shows reasoning** (optional) - Displays thinking process
3. **Provides answer** - Delivers final response based on reasoning

#### Example Session

```
You: Explain the best approach to refactor this codebase

💭 Thinking...
Let me analyze the codebase structure first. I see it uses TypeScript with ESM modules.
The main issues appear to be:
1. Circular dependencies in the utils/ folder
2. Inconsistent error handling patterns
3. Missing type definitions for external APIs

Based on this analysis, I recommend a phased approach rather than a big-bang refactoring,
since the codebase is already in production with active users.

AI: Here's my recommended refactoring strategy:

## Phase 1: Dependency Graph Resolution (Weeks 1-2)
- Break circular dependencies by extracting shared types into separate modules
- Create interface files for cross-module contracts
- Update import statements to use new module structure

## Phase 2: Error Handling Standardization (Weeks 3-4)
- Define error handling patterns in error-handler.ts
- Implement custom error classes
- Update all tools to use standard error handling

## Phase 3: Type Definitions (Weeks 5-6)
- Generate missing type definitions
- Add JSDoc comments
- Update external API integrations

## Benefits of This Approach
- Lower risk through phased implementation
- Maintains system stability during refactoring
- Allows for testing at each phase
- Team can learn new patterns incrementally
```

#### Benefits

- **🔍 Transparency**: See exactly how the AI arrives at conclusions
- **🎯 Better Decisions**: Understand the reasoning behind suggestions
- **🐛 Easier Debugging**: Identify where AI logic went wrong
- **📚 Learning Tool**: Learn problem-solving approaches from AI

#### Enable Thinking Mode

```typescript
// Automatic in AX CLI - thinking mode enabled by default for GLM 4.6
ax-cli --model glm-4.6  // Thinking mode active

// Programmatic control (advanced)
const client = new GrokClient(apiKey, 'glm-4.6');
await client.chat(messages, {
  thinking: {
    type: 'enabled',
    budget_tokens: 2000  // Optional: limit thinking tokens
  }
});
```

### Massive Context Window

**200,000 Tokens of Context**

With a 200,000 token context window, you can analyze entire codebases in a single conversation without losing important details.

#### What Fits in 200K Tokens?

- **📦 40+ average TypeScript files** (~5K tokens each)
  - Complete src/ directory for medium-sized projects
  - All utility functions and helpers
  - Full test suites

- **📚 Complete documentation sets**
  - README + API docs + guides
  - Architecture documentation
  - Type definitions

- **💬 Extended conversations**
  - 500+ back-and-forth messages
  - Full conversation history
  - Multiple files and discussions

- **🔍 Full repository context**
  - Directory structure
  - Key files
  - Test files
  - Configuration files

#### Real-World Examples

```bash
# Analyze entire project structure
ax-cli -p "Review all TypeScript files in src/ and suggest architectural improvements"

# Long debugging sessions
ax-cli -p "Let's debug this issue step by step, checking all related files"
# ... 100+ messages later, GLM 4.6 still remembers the original context

# Documentation generation
ax-cli -p "Generate API documentation for all exported functions in src/"

# Comprehensive refactoring
ax-cli -p "Help me migrate this codebase from CommonJS to ESM modules"
# All files kept in context for consistent refactoring
```

#### Token Efficiency

- **30% Better Efficiency**: Uses tokens more effectively than alternatives
- **Lower Costs**: Accomplish more with fewer tokens
- **Faster Responses**: Fewer tokens = faster processing

### UI/UX Enhancements

#### ReasoningDisplay Component

Beautiful rendering of GLM 4.6's thinking process:
- Clean visual presentation of reasoning steps
- Collapsible/expandable sections
- Visual separation from final answer
- Streaming support with "Thinking..." indicator
- Integrated into main chat interface

**Visual Example**
```
┌──────────────────────────────────────────┐
│ 💭 Thinking (expandable)                 │
├──────────────────────────────────────────┤
│ Analyzing the codebase structure...      │
│ Found 15 TypeScript files in src/        │
│ Checking dependencies...                 │
│ Identified 3 circular dependencies       │
│ Generating recommendations...            │
└──────────────────────────────────────────┘
```

#### Real-Time Streaming

- **Thinking content** streams as it's generated
- **Final answer** streams separately
- **Token usage** tracked independently
- **Visual indicators** show current phase

#### Smart Context Management

**Automatic Pruning Strategy**
- Pruning begins at 75% usage (150K tokens)
- **Preserves**: First messages, recent work, critical context
- **Removes**: Less relevant older messages
- **Maintains coherence**: Keeps conversation meaningful

**Token Management**
```
Conversation State         Action
0-150K tokens              Keep all messages
150-170K tokens            Remove less important older messages
170K+ tokens               Aggressive pruning of old context
New user message           Auto-adjust before sending to API
```

### Advanced Configuration

#### Temperature Control

**Optimized Range: 0.6-1.0**

GLM 4.6 has an optimized temperature range that differs from other models.

```typescript
// GLM 4.6 enforces optimal temperature range
validateTemperature(0.7, 'glm-4.6');  // ✅ Valid (in range 0.6-1.0)
validateTemperature(0.5, 'glm-4.6');  // ❌ Error: out of range
validateTemperature(1.1, 'glm-4.6');  // ❌ Error: out of range

// Valid range for GLM 4.6
// 0.6 = More consistent, focused responses
// 0.7 = Balanced (recommended default)
// 0.8 = More creative, diverse responses
// 1.0 = Maximum creativity and variation
```

**Configuration Examples**
```bash
# Conservative, focused responses
ax-cli --model glm-4.6 --temperature 0.6 -p "Generate critical bug fixes"

# Balanced approach
ax-cli --model glm-4.6 --temperature 0.7 -p "Analyze this code"

# Creative, exploratory responses
ax-cli --model glm-4.6 --temperature 0.9 -p "Brainstorm new features"
```

#### Output Token Control

**Up to 128,000 Output Tokens**

Generate extensive long-form content:

```typescript
// Generate long-form content
await client.chat(messages, {
  model: 'glm-4.6',
  maxTokens: 100000,  // 100K tokens = ~75,000 words
});
```

**Use Cases**
- **Comprehensive guides**: 20,000+ word documentation
- **Complete code implementations**: Multi-file projects
- **Detailed analyses**: In-depth reports and recommendations
- **Long-form content**: Extended explanations and tutorials

#### Thinking Budget

**Optional Constraint on Reasoning**

Limit reasoning tokens for faster responses:

```typescript
// Budget thinking for quick responses
await client.chat(messages, {
  model: 'glm-4.6',
  thinking: {
    type: 'enabled',
    budget_tokens: 500  // Quick thinking mode
  }
});

// Unlimited thinking (default)
await client.chat(messages, {
  model: 'glm-4.6',
  thinking: {
    type: 'enabled',
    budget_tokens: null  // No limit
  }
});
```

**Thinking Budget Guidelines**
- **500 tokens**: Quick analyses, straightforward problems
- **2000 tokens** (default): Complex reasoning, architecture decisions
- **5000+ tokens**: Very complex problems, deep analysis
- **No limit**: Open-ended exploration and learning

### Type Safety & Validation

**Full TypeScript Support with Runtime Validation**

```typescript
import {
  validateTemperature,
  validateMaxTokens,
  validateThinking
} from '@ax-cli/schemas';

// Temperature validation (model-specific ranges)
validateTemperature(0.7, 'glm-4.6');  // ✅ OK (0.6-1.0)
validateTemperature(0.5, 'glm-4.6');  // ❌ Error: out of range

// Max tokens validation (respects model limits)
validateMaxTokens(100000, 'glm-4.6');  // ✅ OK (< 128K)
validateMaxTokens(150000, 'glm-4.6');  // ❌ Error: exceeds limit

// Thinking validation
validateThinking({
  enabled: true,
  budget_tokens: 2000
}, 'glm-4.6');  // ✅ OK
```

**Validation Benefits**
- Compile-time type safety with TypeScript
- Runtime validation catches user errors
- Clear error messages guide users
- Model-specific constraints enforced

---

## Getting Started

### Quick Start

```bash
# Install globally
npm install -g ax-cli

# Initialize your project
ax-cli init

# Start using AX CLI
ax-cli

# Or use with a specific prompt
ax-cli -p "Analyze this codebase and suggest improvements"
```

### Configuration

Create `.ax-cli/settings.json` in your project:

```json
{
  "model": "glm-4.6",
  "temperature": 0.7,
  "maxToolRounds": 200,
  "customInstructions": true,
  "mcpServers": {}
}
```

Create `~/.ax-cli/config.json` for global settings:

```json
{
  "apiKey": "your-api-key",
  "baseUrl": "https://api.z.ai/v1",
  "defaultModel": "glm-4.6"
}
```

### Next Steps

- Read the [GLM 4.6 Usage Guide](./glm-4.6-usage-guide.md) for detailed model capabilities
- Check the [GLM 4.6 Migration Guide](./glm-4.6-migration-guide.md) if upgrading
- Review CLAUDE.md in the repository for development guidelines
- Explore MCP integration for extended capabilities

---

## Summary

AX CLI combines the power of GLM 4.6 with a flexible, extensible architecture that supports multiple AI providers. Whether you're working locally or in the cloud, with simple tasks or complex workflows, AX CLI provides the tools and intelligence to accelerate your development process.

**Key Takeaways:**
- ✅ Default support for GLM 4.6 with 200K context window
- ✅ Works with any OpenAI-compatible API
- ✅ Local deployment option with zero internet dependency
- ✅ Up to 400 tool rounds for complex automation
- ✅ 98%+ test coverage and enterprise-grade quality
- ✅ Extensible via MCP protocol
- ✅ Beautiful terminal UI with real-time streaming
