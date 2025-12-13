# AX-Grok Enhancement Plan

## Executive Summary

This document outlines a comprehensive plan to enhance `ax-grok` to fully leverage Grok's unique capabilities, particularly the **xAI Agent Tools API** for server-side tool execution. Based on analysis of the current codebase, xAI API documentation, and multi-agent consultation, this plan targets a **50%+ reduction in agent loop completion time** and **100% coverage of Grok core tools**.

---

## Current State Analysis

### What ax-grok Has Today
```
packages/ax-grok/src/index.ts (29 lines)
└── Thin wrapper calling runCLI() with GROK_PROVIDER
    └── @defai.digital/ax-core handles everything else
```

### GROK_PROVIDER Configuration (packages/core/src/provider/config.ts)
- **Models**: grok-4.1, grok-4.1-fast-reasoning (2M context!), grok-4.1-fast-non-reasoning, grok-4.1-mini
- **Features**: supportsThinking=true, supportsVision=true, supportsSearch=true, supportsSeed=true
- **Missing**: supportsParallelFunctionCalling, supportsServerTools, supportsXSearch

### Current Tool Execution (packages/core/src/agent/)
- `parallel-tools.ts`: CLIENT-SIDE parallel execution (partitions tools, runs concurrently)
- `llm-agent.ts`: Generic agent loop, not optimized for Grok's server-side tools
- No integration with xAI Agent Tools API

---

## xAI API Capabilities (Research Findings)

### Agent Tools API (Server-Side)
From [xAI Documentation](https://docs.x.ai/docs/guides/tools/overview):

```python
# xAI SDK Example
from xai_sdk import Client
from xai_sdk.tools import web_search, x_search, code_execution

client = Client(api_key=os.getenv("XAI_API_KEY"))
chat = client.chat.create(
    model="grok-4-1-fast-reasoning",  # Best for agentic tasks
    tools=[
        web_search(),      # Real-time web search
        x_search(),        # X/Twitter posts search
        code_execution(),  # Server-side Python execution
    ],
)
```

### Key Parameters
| Parameter | Default | Description |
|-----------|---------|-------------|
| `parallel_function_calling` | `true` | Server-side parallel tool execution |
| `tools` | `[]` | xAI Agent Tools (server-side) |
| `reasoning_effort` | N/A | NOT supported on Grok 4.1 Fast |

### Pricing
- Input: $0.2/1M tokens
- Output: $0.5/1M tokens
- Tool invocations: Included in token cost

---

## Architecture Design

### Dual-Mode Provider Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                      ax-grok CLI                            │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  --server mode  │  │  --client mode  │  (config-driven) │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                            │
│           ▼                    ▼                            │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ GrokServerAdapter│  │ GrokClientAdapter│                 │
│  │   (xai-sdk)     │  │ (OpenAI-compat) │                  │
│  │                 │  │                  │                  │
│  │ web_search()    │  │ Local tools     │                  │
│  │ x_search()      │  │ + parallel-     │                  │
│  │ code_execution()│  │   tools.ts      │                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                            │
│           └────────┬───────────┘                            │
│                    ▼                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Unified Response Normalizer                         │   │
│  │  (xAI response → OpenAI-compatible format)           │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  @defai.digital/ax-core                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ LLMAgent    │  │ToolRegistry │  │ProviderDef  │         │
│  │ (unchanged) │  │ (extended)  │  │ (extended)  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Provider Capability Flags
```typescript
// packages/core/src/provider/config.ts
export interface ProviderFeatures {
  // Existing
  supportsThinking: boolean;
  supportsVision: boolean;
  supportsSearch: boolean;
  supportsSeed: boolean;
  supportsDoSample: boolean;
  thinkingModeStyle?: 'thinking_mode' | 'reasoning_effort';

  // NEW: Grok-specific capabilities
  supportsParallelFunctionCalling?: boolean;  // Server-side parallel
  supportsServerTools?: boolean;              // xAI Agent Tools API
  supportsXSearch?: boolean;                  // X posts search
  supportsCodeExecution?: boolean;            // Server-side code execution
}
```

---

## Implementation Plan

### Phase 1: Quick Wins (1-2 days)

#### 1.1 Add Grok-Specific CLI Flags
**File**: `packages/ax-grok/src/index.ts`

```typescript
#!/usr/bin/env node
import { runCLI, GROK_PROVIDER } from '@defai.digital/ax-core';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// Parse CLI flags
const args = process.argv.slice(2);
const isFast = args.includes('--fast');
const isServerMode = args.includes('--server') || !args.includes('--client');

// Model selection based on flags
let modelOverride: string | undefined;
if (isFast) {
  modelOverride = 'grok-4.1-fast-reasoning';
}

// Run the CLI with Grok configuration
runCLI({
  provider: GROK_PROVIDER,
  version: pkg.version,
  modelOverride,
  providerOptions: {
    useServerTools: isServerMode,
    parallelFunctionCalling: true,
  },
});
```

#### 1.2 Update Provider Features
**File**: `packages/core/src/provider/config.ts`

```typescript
export const GROK_PROVIDER: ProviderDefinition = {
  // ... existing config
  features: {
    supportsThinking: true,
    supportsVision: true,
    supportsSearch: true,
    supportsSeed: true,
    supportsDoSample: false,
    thinkingModeStyle: 'reasoning_effort',
    // NEW
    supportsParallelFunctionCalling: true,
    supportsServerTools: true,
    supportsXSearch: true,
    supportsCodeExecution: true,
  },
};
```

#### 1.3 Add Model Aliases
**File**: `packages/core/src/provider/config.ts`

```typescript
export const MODEL_ALIASES: Record<string, string> = {
  // Existing aliases...

  // Enhanced Grok aliases
  'grok-latest': 'grok-4.1',
  'grok-fast': 'grok-4.1-fast-reasoning',
  'grok-fast-nr': 'grok-4.1-fast-non-reasoning',
  'grok-mini': 'grok-4.1-mini',
  'grok-agentic': 'grok-4.1-fast-reasoning',  // Best for tool calling
  'grok-image': 'grok-2-image-1212',
};
```

### Phase 2: Server-Side Tool Integration (3-5 days)

#### 2.1 Create Grok Server Adapter
**File**: `packages/ax-grok/src/grok-server-adapter.ts` (NEW)

```typescript
/**
 * Grok Server Adapter
 *
 * Integrates xAI Agent Tools API for server-side tool execution.
 * Tools run entirely on xAI infrastructure (no local sandbox needed).
 */

import type { LLMMessage, LLMTool, LLMToolCall } from '@defai.digital/ax-core';

// Tool configurations for xAI Agent Tools
export interface GrokServerToolConfig {
  webSearch?: {
    enabled: boolean;
    maxResults?: number;
  };
  xSearch?: {
    enabled: boolean;
    searchType?: 'keyword' | 'semantic';
    timeRange?: string;
  };
  codeExecution?: {
    enabled: boolean;
    timeout?: number;
  };
}

// Default tool configuration
export const DEFAULT_GROK_TOOLS: GrokServerToolConfig = {
  webSearch: { enabled: true, maxResults: 10 },
  xSearch: { enabled: true, searchType: 'semantic' },
  codeExecution: { enabled: true, timeout: 30000 },
};

/**
 * Build xAI API request with server-side tools
 */
export function buildGrokServerRequest(
  messages: LLMMessage[],
  tools: LLMTool[],
  config: GrokServerToolConfig = DEFAULT_GROK_TOOLS
): Record<string, unknown> {
  const serverTools: string[] = [];

  if (config.webSearch?.enabled) {
    serverTools.push('web_search');
  }
  if (config.xSearch?.enabled) {
    serverTools.push('x_search');
  }
  if (config.codeExecution?.enabled) {
    serverTools.push('code_execution');
  }

  return {
    messages,
    tools: [
      ...tools,  // Client-side tools (if any)
    ],
    // xAI-specific parameters
    parallel_function_calling: true,
    server_tools: serverTools,
    server_tool_config: {
      web_search: config.webSearch,
      x_search: config.xSearch,
      code_execution: config.codeExecution,
    },
  };
}

/**
 * Normalize xAI response to OpenAI-compatible format
 */
export function normalizeGrokResponse(xaiResponse: unknown): {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: LLMToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
} {
  // Implementation handles xAI response format differences
  // ... response normalization logic
  return xaiResponse as ReturnType<typeof normalizeGrokResponse>;
}
```

#### 2.2 Extend LLM Client for Grok
**File**: `packages/core/src/llm/client.ts` (MODIFY)

```typescript
// Add to ChatOptions interface
export interface ChatOptions {
  // ... existing options

  // Grok-specific options
  parallelFunctionCalling?: boolean;
  serverTools?: string[];
  serverToolConfig?: Record<string, unknown>;
}

// In chat() method, add Grok-specific handling
private buildRequestBody(
  messages: LLMMessage[],
  tools: LLMTool[],
  options?: ChatOptions
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: this.model,
    messages,
    tools: tools.length > 0 ? tools : undefined,
    ...this.getProviderSpecificParams(options),
  };

  // Add Grok-specific parameters
  if (this.isGrokProvider()) {
    if (options?.parallelFunctionCalling !== false) {
      body.parallel_function_calling = true;  // Default ON for Grok
    }
    if (options?.serverTools) {
      body.server_tools = options.serverTools;
    }
    if (options?.serverToolConfig) {
      body.server_tool_config = options.serverToolConfig;
    }
  }

  return body;
}

private isGrokProvider(): boolean {
  return this.model.toLowerCase().includes('grok');
}
```

#### 2.3 Add Grok-Specific System Prompt
**File**: `packages/core/src/agent/config/system-prompt-builder.ts` (MODIFY)

```typescript
// Add Grok-specific prompt section
function getGrokSpecificInstructions(): string {
  return `
## Grok-Specific Capabilities

You have access to powerful server-side tools:

1. **web_search**: Real-time web search for current information
   - Use for: Latest news, documentation, technical references
   - Automatically parallelized with other tools

2. **x_search**: Search X (Twitter) posts
   - Use for: Developer discussions, trending topics, community sentiment
   - Supports keyword and semantic search modes

3. **code_execution**: Server-side Python execution
   - Use for: Calculations, data processing, quick validations
   - Runs in isolated sandbox with 30s timeout

**Best Practices:**
- Prefer parallel tool calls when multiple tools apply
- Use x_search for real-time developer discussions and trends
- Use web_search for authoritative documentation
- Use code_execution sparingly for lightweight computations
`;
}

// Integrate into system prompt builder
export function buildSystemPrompt(config: SystemPromptConfig): string {
  let prompt = BASE_SYSTEM_PROMPT;

  // Add provider-specific instructions
  if (config.provider?.name === 'grok') {
    prompt += getGrokSpecificInstructions();
  }

  // ... rest of prompt building
  return prompt;
}
```

### Phase 3: X Search Integration (2-3 days)

#### 3.1 Add x-search CLI Command
**File**: `packages/ax-grok/src/commands/x-search.ts` (NEW)

```typescript
/**
 * X Search Command
 *
 * CLI command for searching X (Twitter) posts using Grok's x_search tool.
 * Usage: ax-grok x-search "query" [--semantic] [--time-range 24h]
 */

import { getSettingsManager } from '@defai.digital/ax-core/utils';

export interface XSearchOptions {
  query: string;
  searchType: 'keyword' | 'semantic';
  timeRange?: string;
  maxResults?: number;
}

export async function executeXSearch(options: XSearchOptions): Promise<{
  success: boolean;
  results: Array<{
    id: string;
    text: string;
    author: string;
    timestamp: string;
    engagement: { likes: number; retweets: number; replies: number };
  }>;
  error?: string;
}> {
  const manager = getSettingsManager();
  const apiKey = manager.getApiKey();

  if (!apiKey) {
    return { success: false, results: [], error: 'No API key configured. Run: ax-grok setup' };
  }

  // Build x_search request
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-4.1-fast-reasoning',
      messages: [
        { role: 'user', content: `Search X posts for: ${options.query}` }
      ],
      server_tools: ['x_search'],
      server_tool_config: {
        x_search: {
          search_type: options.searchType,
          time_range: options.timeRange,
          max_results: options.maxResults || 10,
        },
      },
    }),
  });

  // ... parse and return results
}
```

#### 3.2 Add x-search to CLI Entry Point
**File**: `packages/ax-grok/src/index.ts` (MODIFY)

```typescript
// Add command handling
const command = args[0];

if (command === 'x-search') {
  const query = args[1];
  const isSemantic = args.includes('--semantic');
  const timeRangeIdx = args.indexOf('--time-range');
  const timeRange = timeRangeIdx !== -1 ? args[timeRangeIdx + 1] : undefined;

  const { executeXSearch } = await import('./commands/x-search.js');
  const result = await executeXSearch({
    query,
    searchType: isSemantic ? 'semantic' : 'keyword',
    timeRange,
  });

  // Format and display results
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}
```

### Phase 4: Performance Monitoring (1-2 days)

#### 4.1 Add Grok-Specific Metrics
**File**: `packages/core/src/metrics/grok-metrics.ts` (NEW)

```typescript
/**
 * Grok Performance Metrics
 *
 * Tracks tool call latency, token usage, and parallel execution efficiency.
 */

export interface GrokMetrics {
  toolCalls: {
    total: number;
    parallel: number;
    sequential: number;
    averageLatencyMs: number;
    byTool: Record<string, { count: number; avgLatencyMs: number }>;
  };
  tokenUsage: {
    input: number;
    output: number;
    total: number;
    costUsd: number;
  };
  agentLoops: {
    count: number;
    averageDurationMs: number;
    successRate: number;
  };
}

export class GrokMetricsCollector {
  private metrics: GrokMetrics = {
    toolCalls: { total: 0, parallel: 0, sequential: 0, averageLatencyMs: 0, byTool: {} },
    tokenUsage: { input: 0, output: 0, total: 0, costUsd: 0 },
    agentLoops: { count: 0, averageDurationMs: 0, successRate: 0 },
  };

  recordToolCall(toolName: string, latencyMs: number, isParallel: boolean): void {
    this.metrics.toolCalls.total++;
    if (isParallel) this.metrics.toolCalls.parallel++;
    else this.metrics.toolCalls.sequential++;

    // Update per-tool stats
    if (!this.metrics.toolCalls.byTool[toolName]) {
      this.metrics.toolCalls.byTool[toolName] = { count: 0, avgLatencyMs: 0 };
    }
    const toolStats = this.metrics.toolCalls.byTool[toolName];
    toolStats.avgLatencyMs = (toolStats.avgLatencyMs * toolStats.count + latencyMs) / (toolStats.count + 1);
    toolStats.count++;
  }

  recordTokenUsage(input: number, output: number): void {
    this.metrics.tokenUsage.input += input;
    this.metrics.tokenUsage.output += output;
    this.metrics.tokenUsage.total += input + output;
    // Grok pricing: $0.2/1M input, $0.5/1M output
    this.metrics.tokenUsage.costUsd += (input * 0.0000002) + (output * 0.0000005);
  }

  getReport(): GrokMetrics {
    return { ...this.metrics };
  }
}
```

---

## Testing Strategy

### Unit Tests
```typescript
// packages/ax-grok/tests/grok-server-adapter.test.ts
describe('GrokServerAdapter', () => {
  it('should build request with parallel_function_calling=true', () => {
    const request = buildGrokServerRequest(messages, tools);
    expect(request.parallel_function_calling).toBe(true);
  });

  it('should include server tools when configured', () => {
    const request = buildGrokServerRequest(messages, tools, {
      webSearch: { enabled: true },
      xSearch: { enabled: true },
    });
    expect(request.server_tools).toContain('web_search');
    expect(request.server_tools).toContain('x_search');
  });

  it('should normalize xAI response to OpenAI format', () => {
    const normalized = normalizeGrokResponse(xaiResponse);
    expect(normalized.choices[0].message.role).toBe('assistant');
  });
});
```

### Integration Tests
```typescript
// packages/ax-grok/tests/integration/x-search.test.ts
describe('X Search Integration', () => {
  it('should search X posts for developer topics', async () => {
    const result = await executeXSearch({
      query: 'React 19 release',
      searchType: 'semantic',
      timeRange: '7d',
    });
    expect(result.success).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
  });
});
```

### Performance Tests
```typescript
// packages/ax-grok/tests/performance/parallel-tools.test.ts
describe('Parallel Tool Performance', () => {
  it('should complete agent loop in < 5 seconds', async () => {
    const start = Date.now();
    await agent.processUserMessage('Search for React news and summarize');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });
});
```

---

## Migration Guide

### For Existing ax-grok Users

**No Breaking Changes** - All existing functionality remains unchanged.

**New Opt-in Features:**

```bash
# Use fastest model for agentic tasks
ax-grok --fast "your prompt"

# Enable server-side tools (default in v4.5+)
ax-grok --server "search the web for latest React docs"

# X Search command
ax-grok x-search "React 19" --semantic --time-range 24h

# Force client-side tools (backward compat)
ax-grok --client "your prompt"
```

**Configuration:**

```json
// ~/.ax-grok/config.json
{
  "defaultMode": "server",
  "parallelFunctionCalling": true,
  "serverTools": {
    "webSearch": { "enabled": true },
    "xSearch": { "enabled": true },
    "codeExecution": { "enabled": true }
  }
}
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| xAI API changes | Medium | High | Version lock xai-sdk, monthly API audit |
| Cost overruns | Low | Medium | Built-in quota monitoring, usage alerts |
| Tool execution failures | Low | Medium | Graceful degradation to client-side tools |
| Provider abstraction leakage | Medium | Low | Strict interface boundaries, adapter pattern |
| Performance regression | Low | High | Benchmark suite, performance tests in CI |

---

## Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1**: Quick Wins | 1-2 days | CLI flags, model aliases, provider features |
| **Phase 2**: Server Tools | 3-5 days | Grok adapter, LLM client extension, system prompt |
| **Phase 3**: X Search | 2-3 days | x-search command, integration tests |
| **Phase 4**: Metrics | 1-2 days | Performance monitoring, telemetry |
| **Total** | **7-12 days** | Full ax-grok enhancement |

---

## Success Criteria

- [ ] Agent loop completion time < 5 seconds (baseline: ~10s)
- [ ] 100% coverage of Grok core tools (web_search, x_search, code_execution)
- [ ] No breaking changes for existing users
- [ ] All tests passing with 80%+ coverage
- [ ] Documentation updated with Grok-specific examples

---

## References

- [xAI Agent Tools API](https://docs.x.ai/docs/guides/tools/overview)
- [Grok 4.1 Fast Announcement](https://x.ai/news/grok-4-1-fast)
- [xAI Function Calling Guide](https://docs.x.ai/docs/guides/function-calling)
- [xAI API Reference](https://x.ai/api)

---

*Generated with Claude Code + AutomatosX Multi-Agent Analysis*
