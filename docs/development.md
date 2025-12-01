# AX CLI Development Guide

A comprehensive guide for developers who want to contribute to AX CLI or set up a local development environment.

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Building and Running Locally](#building-and-running-locally)
3. [Running Tests](#running-tests)
4. [Code Style Guidelines](#code-style-guidelines)
5. [Project Structure](#project-structure)
6. [Contributing Guidelines](#contributing-guidelines)
7. [Making Pull Requests](#making-pull-requests)
8. [Debugging and Troubleshooting](#debugging-and-troubleshooting)
9. [Common Workflows](#common-workflows)

---

## Development Environment Setup

### Prerequisites

#### Required
- **Node.js 24+** (required for TypeScript strict mode and ESM support)
  ```bash
  # Check your Node.js version
  node --version  # Should be v24.0.0 or higher

  # Install from https://nodejs.org/
  ```

- **npm or bun** (package manager)
  ```bash
  # Verify npm is installed
  npm --version  # Should be included with Node.js

  # OR install bun (faster alternative)
  curl -fsSL https://bun.sh/install | bash
  ```

- **Git** (version control)
  ```bash
  git --version  # Should be 2.x or higher
  ```

#### Optional
- **Ollama** (0.1.0+) for testing with local LLM models
- **Docker** for isolated development environment

### Clone and Setup

```bash
# Clone the repository
git clone https://github.com/defai-digital/ax-cli
cd ax-cli

# Install dependencies
npm install

# Verify installation
npm run build
npm test
```

### Environment Variables (Local Development)

Create a `.env` file in the project root for local testing:

```bash
# For testing with local Ollama models
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=glm4:9b

# OR for testing with cloud providers
YOUR_API_KEY=your_api_key_here
AI_BASE_URL=https://api.x.ai/v1
AI_MODEL=grok-code-fast-1

# Debug mode
DEBUG=1
```

---

## Building and Running Locally

### Build Process

```bash
# Build TypeScript to dist/
npm run build

# TypeScript only (no emit)
npm run typecheck

# Build using bun (faster)
npm run build:bun
```

### Development Server

```bash
# Interactive development mode (using Bun - recommended)
npm run dev

# Interactive development mode (using Node/tsx)
npm run dev:node

# Run compiled CLI
npm start
npm start:bun

# Link CLI globally for development
npm link
ax-cli --version
```

### Testing Different Features During Development

```bash
# Test interactive mode
npm run dev

# Test headless mode with specific prompt
npm run dev -- --prompt "list all TypeScript files"

# Test with specific model and base URL
npm run dev -- --model glm-4.6 --base-url http://localhost:11434/v1

# Test git commands
npm run dev -- git commit-and-push

# Test MCP commands
npm run dev -- mcp list
npm run dev -- mcp add test-server --transport stdio --command "bun" --args "server.js"

# Test with custom tool rounds limit
npm run dev -- --prompt "complex task" --max-tool-rounds 50

# Enable debug output
DEBUG=1 npm run dev
```

---

## Running Tests

### Test Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (interactive)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Open interactive UI
npm run test:ui
```

### Test Coverage Standards

The project maintains **98%+ test coverage** with specific targets per module:

| Module | Target Coverage | Status |
|--------|-----------------|--------|
| Overall | 98%+ | 98.29% |
| Text Utils | 90%+ | 98.55% |
| Token Counter | 100% | 100% |
| Schemas | 95%+ | 95.23% |
| Tools | 70%+ | In Progress |
| UI Components | Lower priority | Partial |

### Writing Tests

All tests use **Vitest** with a standard structure:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Module or Feature', () => {
  describe('Function or Class', () => {
    it('should handle normal case', () => {
      expect(fn('input')).toBe('output');
    });

    it('should handle edge case', () => {
      expect(fn('')).toBe('default');
    });

    it('should handle Unicode correctly', () => {
      expect(fn('👍🏽')).toBe('expected'); // Test surrogate pairs
    });

    it('should handle errors gracefully', () => {
      expect(() => fn(null)).toThrow(TypeError);
    });
  });
});
```

### Critical Edge Cases to Test

Always include tests for:
- Empty strings and arrays
- Null and undefined values
- Unicode and emoji (including surrogate pairs)
- Boundary conditions
- Error paths and exceptions
- Concurrent operations

### Test Structure

```
tests/
├── utils/
│   ├── text-utils.test.ts        # ~150 test cases
│   └── token-counter.test.ts     # ~20 test cases
├── schemas/
│   └── validation.test.ts        # ~40 test cases
└── integration/
    └── agent.test.ts             # End-to-end tests
```

---

## Code Style Guidelines

### TypeScript Patterns

#### DO:

```typescript
// Strict typing
function processFile(path: string): Promise<FileResult> { }

// Const assertions for constants
const CONFIG = {
  MAX_SIZE: 1024,
  DEFAULT_TIMEOUT: 5000,
} as const;

// Explicit return types (always)
export function calculate(): number { }

// Zod validation for external input
const result = schema.safeParse(data);
if (!result.success) {
  handleError(result.error);
}

// Optional chaining for safety
const value = obj?.prop?.nested?.value;

// Type guards for narrowing
if (typeof value === 'string') {
  // Value is string here
}
```

#### DON'T:

```typescript
// No any types - ever
function process(data: any) { }  // ❌ FORBIDDEN

// No implicit return types
export function calc() { }  // ❌ Missing return type

// No unvalidated external input
const settings = JSON.parse(file);  // ❌ Use Zod instead

// No ignored errors
try {
  doSomething();
} catch (e) {
  // ❌ Don't ignore - at minimum log it
}

// No magic numbers
const timeout = 5000;  // ❌ Use constants
```

### File Organization

```typescript
// 1. File should export one primary item
export class MyTool { }  // ✅

// 2. Constants in constants.ts
import { MY_CONSTANT } from '../constants.js';

// 3. Schemas in schemas/
import { MySchema } from '../schemas/index.js';

// 4. Types in types/
import type { MyType } from '../types/index.js';

// 5. Index files for re-exports
export { MyTool } from './my-tool.js';
export type { MyType } from '../types/index.js';
```

### Import Order

Maintain this specific order:

```typescript
// 1. Node built-ins (first)
import { EventEmitter } from 'events';
import { readFile } from 'fs/promises';

// 2. External packages (second)
import { z } from 'zod';
import OpenAI from 'openai';

// 3. Internal modules (third)
// IMPORTANT: Always use .js extension (ESM requirement)
import { GrokClient } from '../grok/client.js';
import type { ToolResult } from '../types/index.js';
import { MY_CONSTANT } from '../constants.js';
```

### Code Style Standards

- **Line length**: Max 100 characters (configurable in ESLint)
- **Indentation**: 2 spaces (configured in ESLint)
- **Semicolons**: Required at end of statements
- **Quotes**: Single quotes for strings (except template literals)
- **Variable naming**: camelCase for variables/functions, PascalCase for classes
- **Constant naming**: UPPER_SNAKE_CASE for file-level constants
- **Comments**: JSDoc for public functions, inline for complex logic

### Linting

```bash
# Run ESLint on all TypeScript/JavaScript files
npm run lint

# Fix auto-correctable issues
npx eslint . --fix
```

---

## Project Structure

### Directory Overview

```
ax-cli/
├── src/
│   ├── index.ts                      # CLI entry point (Commander setup)
│   ├── constants.ts                  # Centralized configuration
│   │
│   ├── agent/
│   │   ├── grok-agent.ts             # Main AI orchestration agent
│   │   ├── context-manager.ts        # Conversation context management
│   │   └── index.ts
│   │
│   ├── grok/
│   │   ├── client.ts                 # OpenAI-compatible API client
│   │   ├── tools.ts                  # Tool registration and definitions
│   │   ├── types.ts                  # GLM-4.6 streaming types
│   │   └── index.ts
│   │
│   ├── tools/
│   │   ├── bash.ts                   # Shell command execution
│   │   ├── text-editor.ts            # Standard file editing
│   │   ├── search.ts                 # File search with ripgrep
│   │   ├── todo-tool.ts              # Todo list management
│   │   ├── confirmation-tool.ts      # User confirmations
│   │   └── index.ts
│   │
│   ├── mcp/
│   │   ├── client.ts                 # MCP protocol client
│   │   ├── config.ts                 # MCP configuration management
│   │   ├── transports.ts             # stdio, http, sse transports
│   │   └── index.ts
│   │
│   ├── ui/
│   │   ├── components/
│   │   │   ├── chat-interface.tsx    # Main chat UI
│   │   │   ├── reasoning-display.tsx # GLM-4.6 thinking mode display
│   │   │   └── ...
│   │   ├── utils/
│   │   │   ├── colors.ts             # Terminal colors
│   │   │   ├── markdown.ts           # Markdown rendering
│   │   │   └── syntax-highlight.ts   # Code syntax highlighting
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── settings-manager.ts       # Config file management (singleton)
│   │   ├── token-counter.ts          # tiktoken integration with caching
│   │   ├── text-utils.ts             # Unicode-aware text operations
│   │   ├── error-handler.ts          # Categorized error handling
│   │   ├── custom-instructions.ts    # Load .ax/AX.md
│   │   ├── project-analyzer.ts       # Project detection and analysis
│   │   ├── confirmation-service.ts   # Confirmation dialog service
│   │   ├── cache.ts                  # Generic caching utility
│   │   ├── path-validator.ts         # Path validation and normalization
│   │   └── index.ts
│   │
│   ├── schemas/
│   │   ├── index.ts                  # Main Zod schemas export
│   │   ├── api-schemas.ts            # API request/response schemas
│   │   ├── settings-schemas.ts       # Configuration schemas
│   │   ├── tool-schemas.ts           # Tool parameter schemas
│   │   └── confirmation-schemas.ts   # Confirmation schemas
│   │
│   ├── types/
│   │   ├── index.ts                  # Main type definitions
│   │   ├── project-analysis.ts       # Project analysis types
│   │   └── ...
│   │
│   ├── commands/
│   │   ├── init.ts                   # Project initialization command
│   │   ├── mcp.ts                    # MCP server management
│   │   ├── update.ts                 # CLI update command
│   │   └── index.ts
│   │
│   ├── hooks/
│   │   ├── use-input-handler.ts      # Input handling hook
│   │   ├── use-input-history.ts      # Input history management
│   │   ├── use-enhanced-input.ts     # Enhanced input features
│   │   └── index.ts
│   │
│   └── index.ts                      # Main CLI entry point
│
├── tests/
│   ├── utils/
│   │   ├── text-utils.test.ts        # Text manipulation tests
│   │   └── token-counter.test.ts     # Token counting tests
│   ├── schemas/
│   │   └── validation.test.ts        # Schema validation tests
│   └── integration/
│       └── agent.test.ts             # End-to-end tests
│
├── docs/
│   ├── development.md                # This file
│   ├── architecture.md               # System architecture
│   ├── cli-reference.md              # Command reference
│   ├── configuration.md              # Configuration guide
│   ├── features.md                   # Feature documentation
│   ├── glm-4.6-usage-guide.md       # GLM-4.6 specific guide
│   ├── glm-4.6-migration-guide.md   # Migration guide
│   └── mcp-integration-guide.md      # MCP integration guide
│
├── packages/
│   └── schemas/                      # Shared schema package
│       ├── src/
│       ├── dist/
│       └── package.json
│
├── .ax-cli/
│   ├── CUSTOM.md                     # Project custom instructions
│   └── settings.json                 # Project settings
│
├── src/
├── package.json                      # Project dependencies
├── tsconfig.json                     # TypeScript configuration
├── vitest.config.ts                  # Test runner configuration
├── eslint.config.js                  # Linting configuration
├── CLAUDE.md                         # AI development instructions
└── README.md                         # User documentation
```

### Key Architectural Patterns

#### 1. Agent-Tool Pattern

`GrokAgent` orchestrates AI interactions and delegates to specialized tools:

```typescript
class GrokAgent extends EventEmitter {
  private grokClient: GrokClient;       // API communication
  private textEditor: TextEditorTool;   // File editing
  private bash: BashTool;               // Shell commands
  private todoTool: TodoTool;           // Task tracking
  private search: SearchTool;           // File search

  async processUserMessage(prompt: string): Promise<ChatEntry[]>
}
```

#### 2. Tool Interface

All tools implement consistent interface:

```typescript
interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

interface Tool {
  execute(args: unknown): Promise<ToolResult>;
  getToolDefinition(): GrokTool;
}
```

#### 3. Type Safety Layers

Three levels of validation:

1. **TypeScript compile-time**: Strict mode, no implicit any
2. **Zod runtime validation**: All external inputs validated
3. **Error categorization**: Structured error handling

#### 4. Settings Management (Singleton)

```typescript
// SettingsManager singleton pattern
const manager = getSettingsManager();
manager.loadUserSettings();      // ~/.ax-cli/config.json
manager.loadProjectSettings();   // .ax-cli/settings.json
manager.getCurrentModel();       // Merged configuration
```

#### 5. Token Counting with Cache

```typescript
const counter = createTokenCounter(model);
const count = counter.countTokens(text);
const formatted = counter.formatTokenCount(count);  // "1.2k" format

// Cache: max 1000 entries, 5min TTL
const msgCount = counter.countMessageTokens(messages);
```

---

## Contributing Guidelines

### Before You Start

1. **Check existing issues and PRs** to avoid duplicating work
2. **Discuss major changes** in an issue first
3. **Set up your development environment** (see [Development Environment Setup](#development-environment-setup))
4. **Create a feature branch** from `main`

### Development Workflow

#### 1. Create a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# OR for bug fixes
git checkout -b fix/issue-number-short-description
```

#### 2. Make Changes

- Follow [Code Style Guidelines](#code-style-guidelines)
- Write tests for new functionality
- Maintain/increase test coverage
- Update documentation as needed

#### 3. Test Your Changes

```bash
# Run all tests
npm test

# Check coverage
npm run test:coverage

# Lint code
npm run lint

# Type check
npm run typecheck

# Try the CLI
npm run dev -- --prompt "test prompt"
```

#### 4. Commit Changes

Follow conventional commit format:

```bash
# Format: type(scope): description
# type: feat, fix, docs, style, refactor, test, chore, perf
# scope: feature area (tools, agent, ui, utils, etc)

git add .
git commit -m "feat(tools): add new bash tool feature"
git commit -m "fix(schemas): correct validation logic"
git commit -m "docs(README): update installation instructions"
git commit -m "test(utils): add comprehensive text-utils tests"
```

#### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a PR on GitHub (see [Making Pull Requests](#making-pull-requests)).

### Code Review Checklist

Before submitting, ensure:

- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] TypeScript strict mode compliance (`npm run typecheck`)
- [ ] Test coverage maintained (98%+)
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Commit messages follow conventional format
- [ ] No debugging code left (`console.log`, `debugger`, etc)

### Adding New Features

#### Adding a New Tool

1. **Create the tool file** (`src/tools/my-tool.ts`):

```typescript
import type { ToolResult } from '../types/index.js';

export class MyTool {
  async execute(args: { param: string }): Promise<ToolResult> {
    try {
      // Implementation
      return { success: true, output: 'result' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  getToolDefinition(): GrokTool {
    return {
      type: 'function',
      function: {
        name: 'my_tool',
        description: 'What this tool does',
        parameters: {
          type: 'object',
          properties: {
            param: { type: 'string', description: 'Parameter description' }
          },
          required: ['param']
        }
      }
    };
  }
}
```

2. **Export in** `src/tools/index.ts`:

```typescript
export { MyTool } from './my-tool.js';
```

3. **Register in** `src/grok/tools.ts`:

```typescript
function getAllGrokTools(): GrokTool[] {
  const myTool = new MyTool();
  return [
    myTool.getToolDefinition(),
    // ... other tools
  ];
}
```

4. **Instantiate in** `src/agent/grok-agent.ts`:

```typescript
private myTool = new MyTool();
```

5. **Add test** in `tests/tools/my-tool.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MyTool } from '../../src/tools/my-tool.js';

describe('MyTool', () => {
  it('should execute successfully', async () => {
    const tool = new MyTool();
    const result = await tool.execute({ param: 'test' });
    expect(result.success).toBe(true);
  });
});
```

#### Adding a New Model

1. **Update** `src/constants.ts`:

```typescript
export const GLM_MODELS = {
  "new-model": {
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsThinking: false,
    defaultTemperature: 0.7,
    temperatureRange: { min: 0.0, max: 2.0 },
    tokenEfficiency: 1.0,
  },
  // ... existing models
};
```

2. **Update type**:

```typescript
export type SupportedModel = keyof typeof GLM_MODELS;
```

3. **Test**:

```bash
npm run dev -- --model new-model
```

#### Adding a Schema

1. **Add to** `src/schemas/index.ts`:

```typescript
export const MySchema = z.object({
  field: z.string(),
  count: z.number().int().positive(),
});

export type MyType = z.infer<typeof MySchema>;

export function safeValidateMyType(data: unknown) {
  const result = MySchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}
```

2. **Add test** in `tests/schemas/validation.test.ts`:

```typescript
it('should validate MySchema correctly', () => {
  const valid = safeValidateMyType({ field: 'test', count: 5 });
  expect(valid.success).toBe(true);

  const invalid = safeValidateMyType({ field: 'test', count: -5 });
  expect(invalid.success).toBe(false);
});
```

---

## Making Pull Requests

### PR Title Format

Use conventional commit format:

```
feat(tools): add new bash tool capability
fix(schemas): correct user settings validation
docs(README): update installation guide
refactor(utils): simplify token counting logic
test(agent): add end-to-end integration tests
```

### PR Description Template

```markdown
## Summary
Brief description of what this PR does (1-2 sentences)

## Type of Change
- [ ] Feature (new functionality)
- [ ] Bug fix (fixes existing issue)
- [ ] Documentation (documentation only)
- [ ] Refactoring (code cleanup, no functional change)
- [ ] Performance improvement
- [ ] Testing (test additions/improvements)

## Related Issues
Closes #123

## Changes Made
- Specific change 1
- Specific change 2
- Specific change 3

## How to Test
Steps to verify the changes work:
1. Step 1
2. Step 2
3. Step 3

## Checklist
- [ ] Tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] TypeScript strict mode passing (`npm run typecheck`)
- [ ] Test coverage maintained (98%+)
- [ ] Documentation updated
- [ ] No debugging code left
- [ ] Commits follow conventional format

## Breaking Changes
None / Describe any breaking changes

## Additional Notes
Any other context about the PR
```

### PR Review Process

1. **Automated checks** run automatically
2. **Code review** by maintainers
3. **Address feedback** with new commits (avoid force-pushing)
4. **Merge** when approved

---

## Debugging and Troubleshooting

### Enable Debug Logging

```typescript
// In your code
if (process.env.DEBUG) {
  console.error('[DEBUG]', 'Message', data);
}
```

```bash
# Run with debug enabled
DEBUG=1 npm run dev

# Or in headless mode
DEBUG=1 npm run dev -- --prompt "test"
```

### Test Tool Execution

```bash
# Test specific scenario in headless mode
npm run dev -- --prompt "test this specific scenario" --max-tool-rounds 10

# Test interactive mode
npm run dev

# Test with specific model
npm run dev -- --model glm-4.6 --base-url http://localhost:11434/v1
```

### Inspect Streaming

```typescript
// In src/agent/grok-agent.ts or relevant file
this.on('stream', (chunk) => {
  console.error('[STREAM]', chunk.type, JSON.stringify(chunk, null, 2));
});
```

### Test MCP Servers

```bash
# List configured servers
npm run dev -- mcp list

# Test specific server connection
npm run dev -- mcp test server-name

# View server details
npm run dev -- mcp info server-name

# Test new server
npm run dev -- mcp add test-server \
  --transport stdio \
  --command "bun" \
  --args "server.js"
```

### Common Issues and Solutions

#### "TypeError: Cannot read property 'length' of undefined"

```typescript
// Problem
const len = value.length;  // ❌ value might be undefined

// Solution
const len = value?.length ?? 0;  // ✅ Safe with default
```

#### "Zod validation error"

```typescript
// Use safeParse to get better error messages
const result = schema.safeParse(data);
if (!result.success) {
  console.error('Validation errors:', result.error.errors);
}
```

#### "Module not found" errors

```
Error: Cannot find module '../grok/client'

Solutions:
1. Check file path is correct
2. Ensure .js extension in imports (ESM requirement)
3. Verify tsconfig.json moduleResolution is "Bundler"

// Correct
import { GrokClient } from '../grok/client.js';  // ✅

// Wrong
import { GrokClient } from '../grok/client';     // ❌
```

#### Tests failing locally but pass in CI

```bash
# Check Node version
node --version  # Must be 24+

# Clear dependencies and reinstall
rm -rf node_modules package-lock.json
npm install

# Run tests again
npm test
```

#### MCP server not connecting

```bash
# Debug checklist:
1. Verify transport type matches server (stdio/http/sse)
2. Check command/url in .ax-cli/settings.json
3. Test server independently first
4. Enable debug logging:
   DEBUG=1 npm run dev -- mcp list
```

### Performance Debugging

```bash
# Check token usage
npm run dev -- --prompt "simple task"

# Profile with max tool rounds limit
npm run dev -- --prompt "test" --max-tool-rounds 5

# Check memory with Node
node --max-old-space-size=4096 dist/index.js
```

---

## Common Workflows

### Local Development Workflow

```bash
# 1. Create branch
git checkout -b feature/my-feature

# 2. Make changes and test
npm run dev -- --prompt "test feature"
npm run lint
npm test

# 3. Run full check
npm run typecheck && npm run test:coverage

# 4. Commit
git add .
git commit -m "feat(area): description"

# 5. Push and create PR
git push origin feature/my-feature
```

### Testing Against Different Models

```bash
# Test with Ollama locally
npm run dev -- --model glm4:9b --base-url http://localhost:11434/v1

# Test with X.AI (Grok)
npm run dev -- --model grok-code-fast-1 --base-url https://api.x.ai/v1

# Test with Z.AI
npm run dev -- --model glm-4.6 --base-url https://api.z.ai/v1

# Test with OpenAI
npm run dev -- --model gpt-4o --base-url https://api.openai.com/v1
```

### Debugging MCP Integration

```bash
# 1. Add test server to config
npm run dev -- mcp add test \
  --transport stdio \
  --command "bun" \
  --args "test-server.ts"

# 2. List servers
npm run dev -- mcp list

# 3. Test connection
npm run dev -- mcp test test

# 4. Enable debug logs
DEBUG=1 npm run dev -- mcp test test

# 5. Remove server
npm run dev -- mcp remove test
```

### Performance Testing

```bash
# Profile token usage
npm run dev -- --prompt "complex task" | grep -i token

# Test with memory limits
node --max-old-space-size=512 dist/index.js --prompt "test"

# Benchmark tool execution
time npm run dev -- --prompt "list files" --max-tool-rounds 5
```

---

## Additional Resources

### Documentation
- [README.md](/Users/akiralam/code/ax-cli/README.md) - User guide and features
- [architecture.md](/Users/akiralam/code/ax-cli/docs/architecture.md) - System architecture
- [cli-reference.md](/Users/akiralam/code/ax-cli/docs/cli-reference.md) - Command reference
- [CLAUDE.md](/Users/akiralam/code/ax-cli/CLAUDE.md) - AI development instructions

### External Resources
- [Vitest Documentation](https://vitest.dev) - Test runner
- [Zod Documentation](https://zod.dev) - Schema validation
- [TypeScript Documentation](https://www.typescriptlang.org) - Language reference
- [Commander.js Documentation](https://github.com/tj/commander.js) - CLI framework
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification
- [Ink Documentation](https://github.com/vadimdemedes/ink) - React CLI UI

### Project Links
- [GitHub Repository](https://github.com/defai-digital/ax-cli)
- [NPM Package](https://www.npmjs.com/package/@defai.digital/ax-cli)
- [Issue Tracker](https://github.com/defai-digital/ax-cli/issues)
- [Discussions](https://github.com/defai-digital/ax-cli/discussions)

---

## Getting Help

### Before Asking for Help

1. Check [Debugging and Troubleshooting](#debugging-and-troubleshooting) section
2. Search existing issues: https://github.com/defai-digital/ax-cli/issues
3. Review relevant documentation
4. Enable debug output: `DEBUG=1 npm run dev`

### Getting Help

- **GitHub Issues**: Report bugs or request features
- **GitHub Discussions**: Ask questions or discuss ideas
- **Code Comments**: Ask for clarification in PRs
- **Documentation**: Check docs/ folder and README

---

**Last Updated**: 2025-11-19

**Built with quality standards**: TypeScript, 98%+ test coverage, Zod validation, ESM modules
