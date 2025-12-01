# AX CLI SDK

Programmatic API for AX CLI - Use AX CLI as a library instead of spawning CLI processes.

## Installation

```bash
npm install @defai.digital/ax-cli
```

## Quick Start

### Basic Usage

```typescript
import { createAgent } from '@defai.digital/ax-cli/sdk';

// Create agent with configuration
const agent = await createAgent({
  model: 'glm-4.6',
  maxToolRounds: 50,
  enablePlanning: true
});

// Listen to streaming responses
agent.on('stream', (chunk) => {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content);
  }
});

// Process user message
const result = await agent.processUserMessage('List all TypeScript files in src/');
console.log('\nCompleted!');
```

### With Custom Configuration

```typescript
import { initializeSDK, createAgent, getSettingsManager } from '@defai.digital/ax-cli/sdk';

// Initialize SDK with your settings
await initializeSDK({
  apiKey: process.env.GROK_API_KEY,
  model: 'glm-4.6',
  baseURL: 'https://api.x.ai/v1',
  mcpServers: {
    'github': {
      transport: 'stdio',
      command: 'npx',
      args: ['@modelcontextprotocol/server-github']
    }
  }
});

// Create agent
const agent = await createAgent({
  maxToolRounds: 100,
  customInstructions: 'You are a senior TypeScript developer.'
});

// Use the agent
const chatHistory = await agent.processUserMessage('Analyze this codebase');
```

## Advanced Features

### Event Streaming

```typescript
agent.on('stream', (chunk) => {
  switch (chunk.type) {
    case 'content':
      console.log('Content:', chunk.content);
      break;
    case 'reasoning':
      console.log('Thinking:', chunk.reasoningContent);
      break;
    case 'tool_calls':
      console.log('Tools:', chunk.toolCalls);
      break;
  }
});

agent.on('tool_start', (toolCall) => {
  console.log(`Executing: ${toolCall.function.name}`);
});

agent.on('tool_complete', (toolCall, result) => {
  console.log(`Completed: ${toolCall.function.name}`, result.success);
});
```

### Using Subagents

```typescript
import { createSubagent, SubagentRole } from '@defai.digital/ax-cli/sdk';

// Create specialized testing subagent
const testAgent = createSubagent(SubagentRole.TESTING, {
  maxToolRounds: 20,
  priority: 2
});

// Listen to subagent events
testAgent.on('progress', (progress) => {
  console.log(`Progress: ${progress}%`);
});

testAgent.on('state_change', (state) => {
  console.log(`State: ${state}`);
});

// Execute task
const result = await testAgent.execute({
  id: 'test-auth',
  description: 'Write comprehensive unit tests for the auth module',
  context: {
    files: ['src/auth.ts'],
    requirements: ['Test all edge cases', 'Achieve 90%+ coverage']
  }
});

console.log(result);
```

### Context Management

```typescript
import { createAgent, ContextManager } from '@defai.digital/ax-cli/sdk';

const agent = await createAgent();

// Access context manager
const contextManager = agent['contextManager']; // Private, but accessible via SDK

// Get current context usage
const usage = await contextManager.getCurrentUsage();
console.log(`Context: ${usage.percentage}% used`);

// Optimize context if needed
if (usage.percentage > 80) {
  await contextManager.optimizeContext();
}
```

### Checkpoints

```typescript
import { createAgent, getCheckpointManager } from '@defai.digital/ax-cli/sdk';

const agent = await createAgent({ enableCheckpoints: true });
const checkpointManager = getCheckpointManager();

// Create checkpoint
await checkpointManager.createCheckpoint(agent.getChatHistory());

// List checkpoints
const checkpoints = await checkpointManager.listCheckpoints();

// Rewind to checkpoint
if (checkpoints.length > 0) {
  const snapshot = await checkpointManager.rewindToCheckpoint(checkpoints[0].id);
  agent.loadChatHistory(snapshot.chatHistory);
}
```

### Planning Mode

```typescript
import { createAgent, isComplexRequest } from '@defai.digital/ax-cli/sdk';

const agent = await createAgent({ enablePlanning: true });

const userRequest = 'Refactor the entire authentication system to use JWT tokens';

// Check if request needs planning
if (isComplexRequest(userRequest)) {
  console.log('Complex request detected - planning mode enabled');
}

// Agent will automatically create and execute plan
const result = await agent.processUserMessage(userRequest);
```

## VSCode Extension Integration

Replace CLI spawning with SDK for better performance:

### Before (Slow - Process Spawning)

```typescript
import { spawn } from 'child_process';

const cliProcess = spawn('ax-cli', ['--prompt', userMessage]);
// ~50-200ms startup overhead + IPC serialization
```

### After (Fast - Direct SDK)

```typescript
import { createAgent } from '@defai.digital/ax-cli/sdk';

const agent = await createAgent({ model: 'glm-4.6' });

agent.on('stream', (chunk) => {
  // Real-time streaming to UI
  webview.postMessage({ type: 'stream', chunk });
});

const result = await agent.processUserMessage(userMessage);
// ~5ms (direct function call)
```

## API Reference

### Core Functions

#### `createAgent(options?: AgentOptions): Promise<LLMAgent>`

Create a new LLM Agent instance.

**Options:**
- `apiKey?: string` - API key (uses settings if not provided)
- `model?: string` - Model to use (default: from settings)
- `baseURL?: string` - API base URL (default: from settings)
- `maxToolRounds?: number` - Max tool execution rounds (default: 400)
- `customInstructions?: string` - Additional system prompt instructions
- `enablePlanning?: boolean` - Enable automatic planning for complex requests
- `enableCheckpoints?: boolean` - Enable conversation checkpointing
- `samplingConfig?: SamplingConfig` - Deterministic/reproducible mode config

#### `createSubagent(role: SubagentRole, config?: SubagentConfig): Subagent`

Create a specialized subagent for specific tasks.

**Roles:**
- `SubagentRole.GENERAL` - General purpose
- `SubagentRole.TESTING` - Test generation and execution
- `SubagentRole.DOCUMENTATION` - Documentation writing
- `SubagentRole.REFACTORING` - Code refactoring
- `SubagentRole.ANALYSIS` - Code analysis
- `SubagentRole.DEBUG` - Debugging assistance
- `SubagentRole.PERFORMANCE` - Performance optimization

#### `initializeSDK(config): Promise<void>`

Initialize SDK with configuration (optional - can also configure via settings).

### Classes

- **LLMAgent** - Main AI agent for processing messages
- **Subagent** - Specialized agent for focused tasks
- **LLMClient** - Low-level LLM API client
- **ContextManager** - Context window management
- **CheckpointManager** - Conversation checkpointing
- **TaskPlanner** - Automatic task planning

### Types

All types are available from `@defai.digital/ax-cli/sdk` or `@defai.digital/ax-cli/sdk/types`.

See [types.ts](./types.ts) for complete type definitions.

## Performance Comparison

| Method | Startup Time | Memory Overhead | IPC Cost | Type Safety |
|--------|--------------|-----------------|----------|-------------|
| CLI Spawn | 50-200ms | +10-50MB | High | ❌ |
| SDK Import | ~5ms | Shared | None | ✅ |

**SDK is 10-40x faster** for integrations!

## Examples

See [examples/](../../examples/) directory for complete examples:

- `basic-agent.ts` - Simple agent usage
- `streaming.ts` - Event streaming
- `subagents.ts` - Using specialized subagents
- `vscode-integration.ts` - VSCode extension integration
- `checkpoint-system.ts` - Using checkpoints
- `planning-mode.ts` - Automatic task planning

## License

MIT - See [LICENSE](../../LICENSE)
