# ADR-002: Agent Module Decomposition

## Status
**Accepted** - Implemented 2025-11-27

## Context

The `src/agent/llm-agent.ts` file had grown to 2,652 lines of code, containing:

1. **Tool Execution Logic**: Instantiation, parsing, execution of 15+ tools
2. **Streaming Handlers**: Complex chunk accumulation and state management
3. **Plan Execution**: Multi-phase task execution with progress tracking
4. **Agent Core**: Context management, conversation history, token counting

This monolithic structure caused:
- Difficult navigation and understanding
- High cognitive load for contributors
- Challenging testing of isolated concerns
- Risk of unintended side effects from changes

## Decision

Decompose `llm-agent.ts` into focused modules using callback-based dependency injection.

### Extracted Modules

| Module | File | Responsibility | LOC |
|--------|------|----------------|-----|
| ToolExecutor | `src/agent/execution/tool-executor.ts` | Tool instantiation and execution | ~350 |
| StreamHandler | `src/agent/streaming/stream-handler.ts` | Chunk processing and accumulation | ~250 |
| PlanExecutor | `src/agent/planning/plan-executor.ts` | Multi-phase task execution | ~200 |

### Design Principles

1. **Callback-Based Configuration**: Avoid tight coupling by passing callbacks instead of direct references
2. **Single Responsibility**: Each module handles exactly one concern
3. **Testable Units**: Modules can be tested in isolation with mock callbacks
4. **No Circular Dependencies**: Clear dependency direction from agent → modules

## Implementation

### ToolExecutor Interface

```typescript
export interface ToolExecutorConfig {
  workingDirectory: string;
  mcpManager?: MCPManagerV2;
  settingsManager: SettingsManager;
  getConversationHistory: () => ChatEntry[];
  emitter: EventEmitter;
}

export class ToolExecutor {
  constructor(config: ToolExecutorConfig);
  async executeTool(call: LLMToolCall): Promise<ToolResult>;
  getToolByName(name: string): BaseTool | undefined;
}
```

### StreamHandler Interface

```typescript
export interface StreamHandlerConfig {
  tokenCounter: TokenCounter;
  trackUsage: (model: string, usage: StreamUsage) => void;
  emitter: EventEmitter;
}

export class StreamHandler {
  constructor(config: StreamHandlerConfig);
  async processChunks(
    chunks: AsyncGenerator<GLM46StreamChunk>,
    model: string
  ): Promise<AccumulatedMessage>;
}
```

### PlanExecutor Interface

```typescript
export interface PlanExecutorConfig {
  llmClient: LLMClient;
  tokenCounter: TokenCounter;
  toolExecutor: ToolExecutor;
  getTools: () => LLMTool[];
  executeTool: (call: LLMToolCall) => Promise<ToolResult>;
  buildChatOptions: (options: Partial<ChatOptions>) => ChatOptions;
  emitter: EventEmitter;
  maxToolRounds?: number;
  setPlanningEnabled?: (enabled: boolean) => void;
}
```

## Consequences

### Positive

- **Reduced File Size**: `llm-agent.ts` reduced from 2,652 to 1,976 LOC (-25%)
- **Improved Testability**: Each module can be tested independently
- **Better Maintainability**: Changes isolated to specific modules
- **Clearer Architecture**: Explicit dependencies via configuration objects

### Negative

- **Indirection**: Multiple files to navigate for full picture
- **Configuration Overhead**: Callback setup in constructor

### Trade-offs

- Chose callback-based DI over constructor injection to avoid circular dependencies
- Kept some state in agent (planning enabled flag) with callback to update it

## Integration

The modules are integrated in `LLMAgent` constructor:

```typescript
constructor(config: AgentConfig) {
  // Initialize tool executor
  this.toolExecutor = new ToolExecutor({
    workingDirectory: config.workingDirectory,
    mcpManager: config.mcpManager,
    settingsManager: config.settingsManager,
    getConversationHistory: () => this.conversationHistory,
    emitter: this,
  });

  // Initialize stream handler
  this.streamHandler = new StreamHandler({
    tokenCounter: this.tokenCounter,
    trackUsage: (model, usage) => getUsageTracker().trackUsage(model, usage),
    emitter: this,
  });

  // Initialize plan executor
  this.planExecutor = new PlanExecutor({
    llmClient: this.llmClient,
    tokenCounter: this.tokenCounter,
    toolExecutor: this.toolExecutor,
    getTools: () => getAllGrokTools(),
    executeTool: (call) => this.executeTool(call),
    buildChatOptions: (options) => this.buildChatOptions(options),
    emitter: this,
    maxToolRounds: Math.min(this.maxToolRounds, 50),
    setPlanningEnabled: (enabled) => { this.planningEnabled = enabled; },
  });
}
```

## Verification

- All 2,024 tests passing
- TypeScript strict mode clean
- No functional regressions
- LOC reduction verified: 2,652 → 1,976 (-676 lines, 25%)
