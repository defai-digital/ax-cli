# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Configuration Directories

**AX CLI** uses a clean, straightforward configuration system:

### User Settings (Global)
- **Path**: `~/.ax-cli/config.json`
- Contains API keys, default model, base URL, and global preferences

### Project Settings (Local)
- **Path**: `.ax-cli/settings.json`
- Project-specific settings that override user-level defaults
- Optional - if not present, uses user-level settings

---

## Project Overview

**AX CLI** is an enterprise-class AI command line interface primarily designed for **GLM (General Language Model)** with multi-provider support. This is a production-grade TypeScript project with 98%+ test coverage, built using AutomatosX multi-agent orchestration.

**Key Stats:**
- TypeScript 5.3+ with strict mode
- Node.js 24+ required
- 98.29% test coverage (83+ tests)
- Full Zod runtime validation
- ESM modules throughout

---

## Development Commands

### Building & Running

```bash
# Build TypeScript to dist/
npm run build

# Development mode (using Bun)
npm run dev

# Development mode (using Node/tsx)
npm run dev:node

# Run built CLI
npm start

# Link for global development
npm link
```

### Testing

```bash
# Run all tests
npm test

# Watch mode (interactive)
npm run test:watch

# Coverage report
npm run test:coverage

# Interactive UI
npm run test:ui
```

### Code Quality

```bash
# Type checking (no emit)
npm run typecheck

# Linting
npm run lint
```

### Testing Specific Features

```bash
# Test interactive mode
npm run dev

# Test headless mode
npm run dev -- --prompt "list all TypeScript files"

# Test with specific model
npm run dev -- --model glm-4.6 --base-url http://localhost:11434/v1

# Test git commands
npm run dev -- git commit-and-push

# Test MCP commands
npm run dev -- mcp list
npm run dev -- mcp add test-server --transport stdio --command "bun" --args "server.js"

# Test max tool rounds
npm run dev -- --prompt "complex task" --max-tool-rounds 50
```

---

## Architecture Overview

### High-Level Structure

```
src/
├── index.ts              # CLI entry point (Commander setup)
├── constants.ts          # Centralized config (models, limits, etc)
├── agent/
│   └── llm-agent.ts      # Main orchestration agent
├── llm/
│   ├── client.ts         # OpenAI-compatible API client
│   ├── tools.ts          # Tool registration & MCP integration
│   └── types.ts          # GLM-4.6 streaming types
├── tools/
│   ├── bash.ts           # Shell command execution
│   ├── text-editor.ts    # Standard file editing
│   ├── morph-editor.ts   # Fast Apply editing (optional)
│   ├── search.ts         # File search with ripgrep
│   ├── todo-tool.ts      # Todo list management
│   └── confirmation-tool.ts  # User confirmations
├── mcp/
│   ├── config.ts         # MCP server configuration
│   ├── client.ts         # MCP protocol client
│   └── transports/       # stdio, http, sse transports
├── ui/
│   ├── components/       # Ink/React terminal UI
│   │   ├── chat-interface.tsx
│   │   ├── reasoning-display.tsx  # GLM-4.6 thinking mode
│   │   └── ...
│   └── utils/            # Markdown, syntax highlighting
├── utils/
│   ├── settings-manager.ts   # Config file management
│   ├── token-counter.ts      # tiktoken integration
│   ├── text-utils.ts         # Unicode-aware text ops
│   ├── error-handler.ts      # Categorized error handling
│   └── custom-instructions.ts # Load .ax/AX.md
├── schemas/
│   └── index.ts          # Zod validation schemas
└── types/
    └── index.ts          # TypeScript interfaces
```

### Key Architectural Patterns

#### 1. **Two-Tier Configuration System**

User settings (`~/.ax/user-settings.json`) + Project settings (`.ax/settings.json`)

Priority: CLI flags > ENV vars > Project settings > User settings > Defaults

```typescript
// Settings managed by SettingsManager singleton
const manager = getSettingsManager();
manager.loadUserSettings();     // ~/.ax/user-settings.json
manager.loadProjectSettings();  // .ax/settings.json
manager.getCurrentModel();      // Merged config
```

#### 2. **Agent-Tool Pattern**

`LLMAgent` orchestrates AI interactions and delegates to specialized tools:

```typescript
// LLMAgent maintains conversation state
class LLMAgent extends EventEmitter {
  private llmClient: LLMClient;       // API communication
  private textEditor: TextEditorTool;   // File editing
  private bash: BashTool;               // Shell commands
  private todoTool: TodoTool;           // Task tracking
  private search: SearchTool;           // File search

  // Streaming event-driven updates
  async processUserMessage(prompt: string): Promise<ChatEntry[]>
}
```

Tools implement `execute(args)` and return `ToolResult`:

```typescript
interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}
```

#### 3. **Streaming Architecture**

GLM-4.6 supports streaming with reasoning tokens:

```typescript
// Chunks streamed via EventEmitter
interface StreamingChunk {
  type: "content" | "reasoning" | "tool_calls" | "done";
  content?: string;
  reasoningContent?: string;  // GLM-4.6 thinking mode
  toolCalls?: GrokToolCall[];
}

agent.on('stream', (chunk: StreamingChunk) => {
  // UI updates in real-time
});
```

#### 4. **MCP Integration**

Model Context Protocol servers extend capabilities:

```typescript
// MCP servers loaded from .ax/settings.json
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

// Tools dynamically registered from MCP servers
await initializeMCPServers(config);
const allTools = getAllLLMTools();  // Includes MCP tools
```

#### 5. **Type Safety Layers**

Three levels of validation:

1. **TypeScript compile-time**: Strict mode, no implicit any
2. **Zod runtime validation**: All external inputs validated
3. **Error categorization**: Structured error handling

```typescript
// Example: User settings validation
const result = safeValidateUserSettings(data);
if (!result.success) {
  handleError(ErrorCategory.VALIDATION, result.error);
}
```

---

## Model Configuration

GLM and other models configured in `src/constants.ts`:

```typescript
export const GLM_MODELS = {
  "glm-4.6": {
    contextWindow: 200000,      // 200K tokens
    maxOutputTokens: 128000,
    supportsThinking: true,     // Reasoning mode
    temperatureRange: { min: 0.6, max: 1.0 },
  },
  "glm-4-air": {
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsThinking: false,
  },
  // ... other models
};
```

Default model is `glm-4.6` but can be overridden via:
- `--model` flag
- `AI_MODEL` env var
- `.ax-cli/settings.json` project setting
- `~/.ax-cli/config.json` user setting

---

## Testing Philosophy

### Coverage Requirements

- **Overall**: 98%+ coverage maintained
- **Utils**: 90%+ coverage (text-utils, token-counter)
- **Schemas**: 95%+ coverage (Zod validation)
- **Tools**: 70%+ coverage target
- **UI**: Lower priority (Ink components)

### Test Structure

```
tests/
├── utils/
│   ├── text-utils.test.ts       # ~150 test cases
│   └── token-counter.test.ts    # ~20 test cases
└── schemas/
    └── validation.test.ts       # ~40 test cases
```

### Writing Tests

All tests use Vitest with standard patterns:

```typescript
import { describe, it, expect } from 'vitest';

describe('Module', () => {
  describe('function', () => {
    it('should handle normal case', () => {
      expect(fn('input')).toBe('output');
    });

    it('should handle edge case', () => {
      expect(fn('')).toBe('default');
    });

    it('should handle Unicode', () => {
      expect(fn('👍🏽')).toBe('expected'); // Test surrogate pairs
    });
  });
});
```

Critical edge cases to test:
- Empty strings/arrays
- Null/undefined values
- Unicode and emoji (surrogate pairs)
- Boundary conditions
- Error paths

---

## Key Implementation Details

### GLM-4.6 Reasoning Mode

The client supports GLM-4.6's thinking mode via streaming:

```typescript
// In LLMClient.chat()
const options: ChatOptions = {
  thinking: {
    enabled: true,
    budget_tokens: 2000,  // Optional thinking budget
  }
};

// Reasoning content streamed separately
chunk.choices[0].delta.reasoning_content  // Thinking process
chunk.choices[0].delta.content            // Final answer
```

UI displays reasoning in `ReasoningDisplay` component.

### Unicode-Aware Text Operations

All text manipulation in `text-utils.ts` handles Unicode correctly:

```typescript
// Properly handles surrogate pairs (emoji, etc)
export function deleteCharAtCursor(text: string, cursor: number): {
  text: string;
  cursor: number;
} {
  const chars = [...text];  // Split into grapheme clusters
  // ... safe deletion logic
}
```

Always use `[...text]` spread for character iteration, never `text[i]`.

### Token Counting

Uses `tiktoken` with caching for performance:

```typescript
const counter = createTokenCounter(model);
const count = counter.countTokens(text);
const formatted = counter.formatTokenCount(count);  // "1.2k" etc

// Message counting includes overhead
const msgCount = counter.countMessageTokens(messages);
```

Cache automatically manages memory (max 1000 entries, 5min TTL).

### Confirmation System

Headless mode auto-approves, interactive mode prompts:

```typescript
const service = ConfirmationService.getInstance();
service.setSessionFlag('allOperations', true);  // Auto-approve all

// In tools
if (!await service.shouldProceed('operation', details)) {
  return { success: false, error: 'Cancelled by user' };
}
```

### Error Handling

Categorized errors with user-friendly messages:

```typescript
enum ErrorCategory {
  API = 'API',
  VALIDATION = 'VALIDATION',
  FILE_SYSTEM = 'FILE_SYSTEM',
  TOOL_EXECUTION = 'TOOL_EXECUTION',
  MCP = 'MCP',
}

const message = createErrorMessage(ErrorCategory.API, error);
```

---

## Code Style Guidelines

### TypeScript Patterns

**DO:**
```typescript
// Strict typing
function processFile(path: string): Promise<FileResult> { }

// Const assertions for constants
const CONFIG = {
  MAX_SIZE: 1024,
} as const;

// Explicit return types
export function calculate(): number { }

// Zod validation for external input
const result = schema.safeParse(data);
```

**DON'T:**
```typescript
// No any types
function process(data: any) { }  // ❌

// No implicit returns
export function calc() { }  // ❌ (missing return type)

// No unvalidated external input
const settings = JSON.parse(file);  // ❌ (should use Zod)
```

### File Organization

- One export per file for tools/components
- Index files for re-exports
- Constants in `constants.ts`, never magic numbers
- Schemas in `schemas/`, types in `types/`

### Import Order

```typescript
// 1. Node built-ins
import { EventEmitter } from 'events';

// 2. External packages
import { z } from 'zod';
import OpenAI from 'openai';

// 3. Internal modules (use .js extension)
import { LLMClient } from '../llm/client.js';
import { ToolResult } from '../types/index.js';
```

Always use `.js` extension in imports (ESM requirement).

---

## Common Workflows

### Adding a New Tool

1. Create `src/tools/my-tool.ts`:
```typescript
import type { ToolResult } from '../types/index.js';

export class MyTool {
  async execute(args: { param: string }): Promise<ToolResult> {
    try {
      // Implementation
      return { success: true, output: 'result' };
    } catch (error) {
      return { success: false, error: error.message };
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
            param: { type: 'string', description: 'Parameter desc' }
          },
          required: ['param']
        }
      }
    };
  }
}
```

2. Export in `src/tools/index.ts`
3. Register in `src/llm/tools.ts` `getAllLLMTools()`
4. Instantiate in `LLMAgent` constructor
5. Add test in `tests/tools/my-tool.test.ts`

### Adding a New Model

1. Update `src/constants.ts`:
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

2. Update type: `export type SupportedModel = keyof typeof GLM_MODELS;`
3. Add to README model list
4. Test with `--model new-model`

### Adding a New Zod Schema

1. Add to `src/schemas/index.ts`:
```typescript
export const MySchema = z.object({
  field: z.string(),
});

export type MyType = z.infer<typeof MySchema>;

export function safeValidateMyType(data: unknown) {
  const result = MySchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}
```

2. Add test in `tests/schemas/validation.test.ts`

---

## Environment Variables

```bash
# Required for cloud providers
YOUR_API_KEY=your_api_key

# Optional overrides
GROK_BASE_URL=https://api.x.ai/v1   # Default: https://api.x.ai/v1
GROK_MODEL=glm-4.6                   # Default: glm-4.6
GROK_MAX_TOKENS=8192                 # Default: from model config
GROK_TEMPERATURE=0.7                 # Default: from model config

# Optional: Morph Fast Apply (4500+ tokens/sec editing)
MORPH_API_KEY=your_morph_key

# Not required for local models (Ollama)
# Just point base URL to http://localhost:11434/v1
```

---

## MCP Server Development

To test MCP integration:

1. Create a test MCP server (stdio example):
```typescript
// test-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'test-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'test_tool',
    description: 'A test tool',
    inputSchema: { type: 'object', properties: {} },
  }],
}));

await server.connect(new StdioServerTransport());
```

2. Add to `.ax/settings.json`:
```json
{
  "mcpServers": {
    "test": {
      "transport": "stdio",
      "command": "bun",
      "args": ["test-server.ts"]
    }
  }
}
```

3. Test: `npm run dev -- mcp list`

---

## Debugging Tips

### Enable Debug Logging

Add debug output in development:
```typescript
if (process.env.DEBUG) {
  console.error('[DEBUG]', 'Message', data);
}
```

Run with: `DEBUG=1 npm run dev`

### Test Tool Execution

Use headless mode to test specific prompts:
```bash
npm run dev -- --prompt "test this specific scenario" --max-tool-rounds 10
```

### Inspect Streaming

Add event listeners in `LLMAgent`:
```typescript
this.on('stream', (chunk) => {
  console.error('[STREAM]', chunk.type, chunk);
});
```

### Test MCP Servers

```bash
# List configured servers
npm run dev -- mcp list

# Test connection
npm run dev -- mcp test server-name

# View server details
npm run dev -- mcp info server-name
```

---

## Performance Considerations

### Token Usage Optimization

- Use `maxToolRounds` to limit API calls (default: 400)
- Enable caching in `TokenCounter` (automatic)
- Stream responses for faster perceived performance

### File Operations

- Max file size: 1MB (configurable in `FILE_CONFIG`)
- Use `ripgrep-node` for fast file search
- Morph Fast Apply: 4500+ tokens/sec for large edits

### Memory Management

- Token counter cache: 1000 entries max, 5min TTL
- MCP connections pooled and reused
- Settings loaded once, cached in singleton

---

## Release Process

The project uses semantic versioning and npm publishing:

```bash
# 1. Ensure tests pass
npm test

# 2. Update version in package.json
npm version patch  # or minor, major

# 3. Build
npm run build

# 4. Test built version
npm start -- --version

# 5. Publish to npm
npm publish --access public

# 6. Create git tag
git tag v0.2.1
git push --tags
```

---

## Troubleshooting Common Issues

### "TypeError: Cannot read property 'length' of undefined"
- Check for null/undefined before accessing properties
- Use optional chaining: `obj?.prop?.length`

### "Zod validation error"
- Check schema definitions in `src/schemas/index.ts`
- Validate against actual data structure
- Use `safeParse()` for better error messages

### "Module not found" errors
- Ensure `.js` extension in imports (ESM requirement)
- Check `tsconfig.json` moduleResolution is "Bundler"
- Verify file exists and path is correct

### Tests failing locally but pass in CI
- Check Node version (must be 24+)
- Clear `node_modules` and reinstall
- Check for environment-specific code

### MCP server not connecting
- Verify transport type matches server (stdio/http/sse)
- Check command/url in `.ax/settings.json`
- Test server independently first
- Enable debug logging

---

## Additional Resources

- **Main README**: Full user documentation
- **Test README**: `tests/README.md` - Testing guide
- **AutomatosX Integration**: For AI agent workflows (separate from core CLI)
- **MCP Protocol Docs**: https://modelcontextprotocol.io
- **Vitest Docs**: https://vitest.dev
- **Zod Docs**: https://zod.dev
- use the ./automatosx/tmp to store tmp files , test files and status report