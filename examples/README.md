# AX CLI SDK Examples

Example code demonstrating how to use the AX CLI SDK programmatically.

## Running Examples

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run an example with tsx (TypeScript execution)
npx tsx examples/basic-agent.ts
```

## Examples

### 1. Basic Agent (`basic-agent.ts`)

Simple example showing how to create an agent and process messages.

```bash
npx tsx examples/basic-agent.ts
```

### 2. VSCode Integration (`vscode-integration.ts`)

Demonstrates how to integrate AX CLI SDK into a VSCode extension, replacing slow CLI spawning with fast direct SDK calls.

**Performance Improvement:**
- Before (CLI spawn): 50-200ms overhead per message
- After (SDK): ~5ms per message
- **10-40x faster!**

### 3. Streaming Events (`streaming.ts`)

Shows how to handle different types of streaming events from the agent.

```bash
npx tsx examples/streaming.ts
```

### 4. Subagents (`subagents.ts`)

Example of using specialized subagents for focused tasks like testing, documentation, etc.

```bash
npx tsx examples/subagents.ts
```

### 5. Checkpoint System (`checkpoint-system.ts`)

Demonstrates conversation checkpointing and rewinding functionality.

```bash
npx tsx examples/checkpoint-system.ts
```

### 6. Planning Mode (`planning-mode.ts`)

Shows automatic task planning for complex requests.

```bash
npx tsx examples/planning-mode.ts
```

## Integration Patterns

### CLI Tool
Use `spawn('ax-cli')` - appropriate for external integrations

### VSCode Extension
Use SDK - 10-40x faster than spawning

### Web Server
Use SDK - share agent instances, better resource management

### CI/CD Pipeline
Use CLI or SDK depending on needs

## Best Practices

1. **Reuse Agent Instances** - Create once, use many times
2. **Listen to Events** - Use event streaming for real-time UI updates
3. **Handle Errors** - Always handle agent errors gracefully
4. **Cleanup** - Call `dispose()` when done
5. **Configuration** - Use `initializeSDK()` for global config

## TypeScript Support

All examples are fully typed. Import types from:

```typescript
import { createAgent, type ChatEntry, type StreamingChunk } from '@defai.digital/ax-cli/sdk';
import type { AgentEvents } from '@defai.digital/ax-cli/sdk/types';
```

## Learn More

- [SDK Documentation](../src/sdk/README.md)
- [API Reference](../docs/api-reference.md)
- [VSCode Extension Guide](../vscode-extension/README.md)
