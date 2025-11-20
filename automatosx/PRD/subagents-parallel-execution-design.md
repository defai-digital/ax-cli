# Subagents & Parallel Execution System - Architecture Design

**Date:** 2025-11-20
**Feature:** Autonomous Subagents with Parallel Task Execution
**Inspired By:** Claude Code's subagent system for specialized tasks

---

## Executive Summary

Implement a subagent system that:
- Delegates specialized tasks to purpose-built AI agents
- Executes multiple agents in parallel for concurrent workflows
- Supports agent-to-agent communication and coordination
- Provides progress tracking and result aggregation
- Integrates seamlessly with existing LLMAgent architecture

---

## Requirements

### Functional Requirements

1. **Agent Spawning**
   - Main agent can spawn subagents for specific tasks
   - Subagents inherit context from parent
   - Each subagent has isolated execution environment
   - Subagents can be specialized (e.g., "testing", "documentation", "refactoring")

2. **Parallel Execution**
   - Run multiple subagents concurrently
   - Coordinate dependencies between agents
   - Aggregate results from parallel execution
   - Handle failures gracefully (one agent failure doesn't crash others)

3. **Agent Communication**
   - Parent can send messages to subagents
   - Subagents can report progress to parent
   - Agents can share context/results
   - Message queue for async communication

4. **Specialized Agents**
   - **TestingAgent**: Generate and run tests
   - **DocumentationAgent**: Generate documentation
   - **RefactoringAgent**: Code refactoring tasks
   - **AnalysisAgent**: Code analysis and bug detection
   - **SecurityAgent**: Security vulnerability scanning
   - **GeneralAgent**: Generic tasks (default)

### Non-Functional Requirements

1. **Performance**
   - Spawn agent < 100ms
   - Support up to 10 concurrent agents
   - Efficient resource management
   - No blocking main thread

2. **Reliability**
   - Graceful agent failure handling
   - Automatic retry on transient failures
   - Progress preservation on crash
   - Clean agent termination

3. **Observability**
   - Real-time progress tracking
   - Agent status visibility
   - Execution logs per agent
   - Metrics collection

---

## Architecture

### High-Level Design

```
┌──────────────────────────────────────────────────────┐
│            Main LLMAgent (Orchestrator)              │
├──────────────────────────────────────────────────────┤
│  - Receives user request                             │
│  - Decides to spawn subagents                        │
│  - Coordinates parallel execution                    │
│  - Aggregates results                                │
└─────────────┬────────────────────────────────────────┘
              │
              ├──── SubagentOrchestrator
              │     ├─> spawn()
              │     ├─> monitor()
              │     ├─> aggregate()
              │     └─> terminate()
              │
              ▼
┌─────────────────────────────────────────────────────┐
│              SubagentOrchestrator                    │
├─────────────────────────────────────────────────────┤
│  - Manages subagent lifecycle                       │
│  - Coordinates parallel execution                   │
│  - Handles inter-agent communication                │
│  - Aggregates results                               │
└──────┬──────────────┬──────────────┬────────────────┘
       │              │              │
       ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│ Subagent │   │ Subagent │   │ Subagent │
│    #1    │   │    #2    │   │    #3    │
├──────────┤   ├──────────┤   ├──────────┤
│ Type:    │   │ Type:    │   │ Type:    │
│ Testing  │   │ Docs     │   │ Refactor │
│          │   │          │   │          │
│ Status:  │   │ Status:  │   │ Status:  │
│ Running  │   │ Running  │   │ Complete │
└──────────┘   └──────────┘   └──────────┘
```

### Component Breakdown

#### 1. SubagentOrchestrator

**Responsibility:** Manage subagent lifecycle and coordination

**Interface:**
```typescript
interface SubagentOrchestrator {
  // Spawn new subagent
  spawn(config: SubagentConfig): Promise<Subagent>;

  // Spawn multiple subagents in parallel
  spawnParallel(configs: SubagentConfig[]): Promise<Subagent[]>;

  // Monitor subagent execution
  monitor(agentId: string): SubagentStatus;

  // Get all active subagents
  getActive(): Subagent[];

  // Wait for all subagents to complete
  waitAll(): Promise<SubagentResult[]>;

  // Terminate subagent
  terminate(agentId: string): Promise<void>;

  // Terminate all subagents
  terminateAll(): Promise<void>;

  // Send message to subagent
  sendMessage(agentId: string, message: string): Promise<void>;
}

interface SubagentConfig {
  type: AgentType;                   // Agent specialization
  task: string;                      // Task description
  context?: SubagentContext;         // Inherited context
  maxToolRounds?: number;            // Tool execution limit
  timeout?: number;                  // Execution timeout (ms)
  priority?: number;                 // Execution priority
}

type AgentType =
  | 'general'
  | 'testing'
  | 'documentation'
  | 'refactoring'
  | 'analysis'
  | 'security'
  | 'performance';

interface SubagentContext {
  files?: string[];                  // File paths to include
  codeSnippets?: CodeSnippet[];      // Code snippets
  conversationHistory?: ChatEntry[]; // Relevant conversation
  dependencies?: string[];           // Other agents to wait for
}

interface CodeSnippet {
  path: string;
  content: string;
  language: string;
}

interface SubagentStatus {
  id: string;
  type: AgentType;
  state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;                  // 0-100
  startTime: Date;
  endTime?: Date;
  error?: string;
  currentAction?: string;            // What agent is currently doing
}

interface SubagentResult {
  id: string;
  type: AgentType;
  success: boolean;
  output: string;                    // Agent's final response
  filesModified?: string[];          // Files changed by agent
  toolCalls?: LLMToolCall[];         // Tools used
  error?: string;
  executionTime: number;             // ms
}
```

#### 2. Subagent Class

**Responsibility:** Individual agent execution

**Interface:**
```typescript
class Subagent {
  id: string;
  type: AgentType;
  config: SubagentConfig;
  private agent: LLMAgent;
  private status: SubagentStatus;

  constructor(config: SubagentConfig);

  // Execute subagent task
  async execute(): Promise<SubagentResult>;

  // Get current status
  getStatus(): SubagentStatus;

  // Send message to this agent
  async receiveMessage(message: string): Promise<void>;

  // Abort execution
  async abort(): Promise<void>;

  // Get execution logs
  getLogs(): string[];
}
```

#### 3. Agent Specializations

**TestingAgent:**
```typescript
class TestingAgent extends Subagent {
  constructor(config: SubagentConfig) {
    super({
      ...config,
      type: 'testing',
    });
  }

  // Override to provide testing-specific system prompt
  protected getSystemPrompt(): string {
    return `You are a specialized testing agent. Your role is to:
    - Generate comprehensive unit tests
    - Ensure high test coverage
    - Follow testing best practices
    - Use appropriate testing frameworks
    - Write clear test descriptions`;
  }
}
```

**DocumentationAgent:**
```typescript
class DocumentationAgent extends Subagent {
  constructor(config: SubagentConfig) {
    super({
      ...config,
      type: 'documentation',
    });
  }

  protected getSystemPrompt(): string {
    return `You are a specialized documentation agent. Your role is to:
    - Generate clear, comprehensive documentation
    - Follow documentation standards
    - Include usage examples
    - Document edge cases and limitations
    - Write in clear, concise language`;
  }
}
```

**RefactoringAgent:**
```typescript
class RefactoringAgent extends Subagent {
  constructor(config: SubagentConfig) {
    super({
      ...config,
      type: 'refactoring',
    });
  }

  protected getSystemPrompt(): string {
    return `You are a specialized refactoring agent. Your role is to:
    - Improve code structure and readability
    - Apply SOLID principles
    - Reduce code duplication
    - Optimize performance where applicable
    - Maintain backward compatibility`;
  }
}
```

#### 4. Integration with Main Agent

**LLMAgent Extensions:**
```typescript
// In src/agent/llm-agent.ts

export class LLMAgent extends EventEmitter {
  private orchestrator: SubagentOrchestrator;

  constructor(...) {
    // ... existing code ...
    this.orchestrator = new SubagentOrchestrator(this);
  }

  // New method: Spawn subagent
  async spawnSubagent(config: SubagentConfig): Promise<Subagent> {
    return this.orchestrator.spawn(config);
  }

  // New method: Execute tasks in parallel
  async executeParallel(tasks: SubagentConfig[]): Promise<SubagentResult[]> {
    const agents = await this.orchestrator.spawnParallel(tasks);
    return this.orchestrator.waitAll();
  }

  // New method: Detect when to use subagents
  private shouldUseSubagents(userMessage: string): boolean {
    // Heuristics:
    // - User asks for parallel work (e.g., "build backend and frontend")
    // - Task has multiple independent components
    // - Task mentions "tests and documentation"
    // - Complexity score > threshold

    const parallelKeywords = [
      'and also',
      'at the same time',
      'in parallel',
      'simultaneously',
      'while you',
    ];

    return parallelKeywords.some(kw => userMessage.toLowerCase().includes(kw));
  }
}
```

---

## Usage Patterns

### Pattern 1: Explicit Parallel Tasks

**User Request:**
```
Build a REST API endpoint for user authentication AND generate tests for it
```

**Agent Response:**
```typescript
// Main agent decides to spawn 2 subagents
const results = await this.executeParallel([
  {
    type: 'general',
    task: 'Build a REST API endpoint for user authentication',
    context: { files: ['src/api/'] },
  },
  {
    type: 'testing',
    task: 'Generate tests for user authentication endpoint',
    context: { files: ['src/api/', 'tests/'] },
  },
]);

// Aggregate results
return `I've completed both tasks in parallel:

**API Endpoint** (completed in ${results[0].executionTime}ms)
${results[0].output}

**Tests** (completed in ${results[1].executionTime}ms)
${results[1].output}`;
```

### Pattern 2: Implicit Parallel Execution

**User Request:**
```
Refactor the authentication module
```

**Agent Decision Tree:**
```typescript
// Main agent analyzes task complexity
const complexity = this.analyzeTaskComplexity(userMessage);

if (complexity.score > 0.7) {
  // Spawn subagents for different aspects
  const results = await this.executeParallel([
    {
      type: 'refactoring',
      task: 'Refactor authentication business logic',
      context: { files: ['src/auth/'] },
    },
    {
      type: 'testing',
      task: 'Update tests after refactoring',
      context: { files: ['tests/auth/'] },
      dependencies: ['refactoring'], // Wait for refactoring to complete
    },
    {
      type: 'documentation',
      task: 'Update authentication documentation',
      context: { files: ['docs/auth.md'] },
    },
  ]);
}
```

### Pattern 3: Sequential Subagents with Dependencies

**User Request:**
```
Add OAuth integration to our app
```

**Agent Workflow:**
```typescript
// Step 1: Analysis subagent (runs first)
const analysisAgent = await this.spawnSubagent({
  type: 'analysis',
  task: 'Analyze current authentication system and plan OAuth integration',
});
const analysis = await analysisAgent.execute();

// Step 2: Parallel implementation (after analysis completes)
const implementationResults = await this.executeParallel([
  {
    type: 'general',
    task: 'Implement OAuth provider integration',
    context: { codeSnippets: [analysis.output] },
  },
  {
    type: 'security',
    task: 'Review OAuth implementation for security issues',
    dependencies: ['general'],
  },
]);

// Step 3: Testing subagent (runs last)
const testingAgent = await this.spawnSubagent({
  type: 'testing',
  task: 'Generate OAuth integration tests',
  context: {
    files: implementationResults[0].filesModified,
  },
});
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (Priority 1)

**Files to Create:**
1. `src/agent/subagent-orchestrator.ts` - Orchestrator class
2. `src/agent/subagent.ts` - Subagent base class
3. `src/agent/specialized-agents.ts` - Specialized agent classes
4. `src/agent/types.ts` - TypeScript interfaces
5. `src/agent/agent-registry.ts` - Agent type registry

**Files to Modify:**
1. `src/agent/llm-agent.ts` - Add orchestrator integration
2. `src/constants.ts` - Add subagent configuration constants

**Tasks:**
- [ ] Create SubagentOrchestrator
- [ ] Implement Subagent base class
- [ ] Create specialized agent classes
- [ ] Add Zod schemas for validation
- [ ] Write unit tests (90%+ coverage)

### Phase 2: Parallel Execution (Priority 2)

**Files to Create:**
1. `src/agent/execution-coordinator.ts` - Coordinate parallel execution
2. `src/agent/dependency-resolver.ts` - Resolve agent dependencies
3. `src/agent/message-queue.ts` - Inter-agent communication

**Tasks:**
- [ ] Implement parallel execution engine
- [ ] Add dependency resolution
- [ ] Implement message queue
- [ ] Add progress tracking
- [ ] Write integration tests

### Phase 3: UI Integration (Priority 3)

**Files to Create:**
1. `src/ui/components/subagent-monitor.tsx` - Monitor active subagents
2. `src/ui/components/parallel-progress.tsx` - Show parallel progress

**Files to Modify:**
1. `src/ui/components/chat-interface.tsx` - Show subagent activity

**Tasks:**
- [ ] Create subagent monitoring UI
- [ ] Add parallel progress indicators
- [ ] Show agent status in chat
- [ ] Add keyboard shortcuts for agent management

### Phase 4: Advanced Features (Priority 4)

**Tasks:**
- [ ] Add agent-to-agent communication
- [ ] Implement result caching
- [ ] Add agent pools (reuse agents)
- [ ] Implement smart task distribution
- [ ] Add performance metrics

---

## Storage Format

### Agent Execution Logs

```
.ax-cli/
├── agents/
│   ├── logs/
│   │   ├── 2025-11-20/
│   │   │   ├── agent-abc123.log
│   │   │   ├── agent-def456.log
│   │   │   └── agent-ghi789.log
│   │   └── metadata.json
│   └── results/
│       ├── agent-abc123-result.json
│       └── agent-def456-result.json
```

### Agent Result Format

```json
{
  "id": "abc123def456",
  "type": "testing",
  "task": "Generate tests for authentication module",
  "status": "completed",
  "startTime": "2025-11-20T10:30:45.123Z",
  "endTime": "2025-11-20T10:32:15.456Z",
  "executionTime": 90333,
  "result": {
    "success": true,
    "output": "I've generated comprehensive tests...",
    "filesModified": [
      "tests/auth/login.test.ts",
      "tests/auth/logout.test.ts"
    ],
    "toolCalls": [
      { "name": "text_editor", "count": 2 },
      { "name": "bash", "count": 3 }
    ]
  },
  "metrics": {
    "tokensUsed": 5432,
    "apiCalls": 12,
    "toolRoundsUsed": 8
  }
}
```

---

## User Experience

### Example 1: Parallel Development

```bash
$ ax-cli

You: Build a user registration API with tests and documentation

AI: I'll tackle this using parallel execution with 3 specialized agents:

🤖 Spawning agents:
  1. API Development Agent - Building registration endpoint
  2. Testing Agent - Generating comprehensive tests
  3. Documentation Agent - Creating API documentation

┌─────────────────────────────────────────────┐
│ Active Agents (3)                           │
├─────────────────────────────────────────────┤
│ 🟢 API Development    [████████░░] 80%      │
│    Currently: Writing user validation logic │
│                                             │
│ 🟢 Testing           [██████████] 100%      │
│    Status: Completed - 15 tests generated   │
│                                             │
│ 🟡 Documentation     [█████░░░░░] 50%       │
│    Currently: Documenting error responses   │
└─────────────────────────────────────────────┘

[2 minutes later]

✅ All agents completed successfully!

**Results Summary:**

🔹 **API Development Agent** (completed in 1m 45s)
- Created /api/register endpoint
- Added input validation
- Implemented password hashing
- Files modified: 3

🔹 **Testing Agent** (completed in 1m 30s)
- Generated 15 comprehensive tests
- Coverage: 95%
- All tests passing
- Files created: 2

🔹 **Documentation Agent** (completed in 2m 10s)
- Created API reference
- Added usage examples
- Documented error codes
- Files modified: 1

Total time: 2m 10s (saved ~3 minutes with parallel execution!)
```

### Example 2: Sequential with Dependencies

```bash
You: Migrate our database from MySQL to PostgreSQL

AI: This is a complex migration. I'll coordinate multiple agents:

📋 Execution Plan:
  1. Analysis Agent → Analyze current schema
  2. Migration Agent → Generate migration scripts (depends on #1)
  3. Testing Agent → Test migrations (depends on #2)
  4. Documentation Agent → Update docs (depends on #2)

Executing...

🔍 Step 1/4: Analysis Agent (running)
   Analyzing MySQL schema...
   [████████████████████████] 100%
   ✅ Completed in 45s

🔄 Step 2/4: Migration Agent (running)
   Generating PostgreSQL migration scripts...
   [████████████████████████] 100%
   ✅ Completed in 2m 15s

⚡ Step 3/4: Testing Agent (running in parallel with step 4)
   [████████████████░░░░░░░░] 70%

📚 Step 4/4: Documentation Agent (running in parallel with step 3)
   [██████████████████████░░] 90%

[Both complete]

✅ Migration completed successfully!
```

---

## Configuration

### Settings Schema

```typescript
// In .ax-cli/settings.json or ~/.ax-cli/config.json
interface SubagentConfig {
  enabled: boolean;                  // Enable/disable subagents
  maxConcurrentAgents: number;       // Max agents running in parallel (default: 10)
  defaultTimeout: number;            // Default agent timeout in ms (default: 300000)
  autoSpawnThreshold: number;        // Complexity threshold for auto-spawn (default: 0.7)
  specializedAgents: {
    testing: boolean;                // Enable TestingAgent
    documentation: boolean;          // Enable DocumentationAgent
    refactoring: boolean;            // Enable RefactoringAgent
    analysis: boolean;               // Enable AnalysisAgent
    security: boolean;               // Enable SecurityAgent
    performance: boolean;            // Enable PerformanceAgent
  };
  logging: {
    enabled: boolean;                // Enable agent logging
    level: 'debug' | 'info' | 'warn' | 'error';
    persistLogs: boolean;            // Save logs to disk
  };
}
```

### Default Configuration

```json
{
  "subagents": {
    "enabled": true,
    "maxConcurrentAgents": 10,
    "defaultTimeout": 300000,
    "autoSpawnThreshold": 0.7,
    "specializedAgents": {
      "testing": true,
      "documentation": true,
      "refactoring": true,
      "analysis": true,
      "security": true,
      "performance": true
    },
    "logging": {
      "enabled": true,
      "level": "info",
      "persistLogs": true
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/agent/subagent-orchestrator.test.ts
describe('SubagentOrchestrator', () => {
  it('spawns subagent successfully', async () => {
    const orchestrator = new SubagentOrchestrator(mainAgent);
    const subagent = await orchestrator.spawn({
      type: 'testing',
      task: 'Generate tests',
    });

    expect(subagent.id).toBeDefined();
    expect(subagent.type).toBe('testing');
  });

  it('executes multiple subagents in parallel', async () => {
    const orchestrator = new SubagentOrchestrator(mainAgent);
    const results = await orchestrator.spawnParallel([
      { type: 'testing', task: 'Task 1' },
      { type: 'documentation', task: 'Task 2' },
    ]);

    expect(results).toHaveLength(2);
  });

  it('handles subagent failure gracefully', async () => {
    // Test error handling
  });

  it('resolves dependencies correctly', async () => {
    // Test dependency resolution
  });
});

// tests/agent/specialized-agents.test.ts
describe('Specialized Agents', () => {
  it('TestingAgent generates tests', async () => {
    // Test TestingAgent
  });

  it('DocumentationAgent generates docs', async () => {
    // Test DocumentationAgent
  });

  it('RefactoringAgent refactors code', async () => {
    // Test RefactoringAgent
  });
});
```

### Integration Tests

```typescript
// tests/integration/parallel-execution.test.ts
describe('Parallel Execution Integration', () => {
  it('executes tasks in parallel and aggregates results', async () => {
    // Test end-to-end parallel execution
  });

  it('handles agent communication', async () => {
    // Test inter-agent messaging
  });

  it('respects agent dependencies', async () => {
    // Test sequential execution with dependencies
  });
});
```

---

## Performance Considerations

### Optimization Strategies

1. **Agent Pooling**
   - Reuse agents for similar tasks
   - Warm-up agents with common context
   - Avoid repeated initialization

2. **Smart Scheduling**
   - Priority-based execution
   - Load balancing across agents
   - Adaptive concurrency limits

3. **Resource Management**
   - Monitor memory per agent
   - Throttle API calls across agents
   - Share token counter cache

4. **Result Caching**
   - Cache agent results for similar tasks
   - Deduplicate identical subagent requests
   - Share context across agents

---

## Security Considerations

1. **Agent Isolation**
   - Each agent has isolated file access
   - Limit cross-agent communication
   - Validate agent-to-agent messages

2. **Resource Limits**
   - Max concurrent agents (prevent DoS)
   - Timeout per agent
   - Token usage limits per agent

3. **Input Validation**
   - Validate all subagent configs
   - Sanitize task descriptions
   - Verify file paths

---

## Success Metrics

1. **Performance**
   - Agent spawn time < 100ms (95th percentile)
   - Parallel speedup: 2-5x for eligible tasks
   - Aggregate overhead < 10%

2. **Reliability**
   - Agent success rate > 95%
   - Graceful failure rate 100%
   - Resource leak rate 0%

3. **User Adoption**
   - 40% of complex tasks use subagents
   - Average 2-3 parallel agents per session
   - 90% user satisfaction with parallel execution

---

**Status:** Ready for Implementation
**Priority:** High
**Estimated Effort:** 7-10 days (1 developer)
**Dependencies:** None (can start immediately)
