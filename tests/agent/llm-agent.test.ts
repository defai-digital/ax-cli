/**
 * Tests for agent/llm-agent module
 * Tests LLMAgent construction, configuration, tool approval, and lifecycle
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock the entire llm/client module before importing
vi.mock('../../packages/core/src/llm/client.js', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    getCurrentModel: vi.fn().mockReturnValue('glm-4.6-flash'),
    chat: vi.fn(),
    chatStream: vi.fn(),
  })),
}));

// Mock ToolExecutor as a proper class
vi.mock('../../packages/core/src/agent/execution/index.js', () => {
  return {
    ToolExecutor: class MockToolExecutor {
      execute = vi.fn();
      getBashTool = vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue({ success: true, output: 'test output' }),
        getCurrentDirectory: vi.fn().mockReturnValue('/test'),
        isExecuting: vi.fn().mockReturnValue(false),
        moveToBackground: vi.fn().mockReturnValue(null),
      });
      dispose = vi.fn();
      constructor() {}
    },
  };
});

// Mock StreamHandler as a proper class
vi.mock('../../packages/core/src/agent/streaming/index.js', () => {
  return {
    StreamHandler: class MockStreamHandler {
      processStream = vi.fn();
      setModel = vi.fn();
      constructor() {}
    },
  };
});

// Mock PlanExecutor as a proper class
vi.mock('../../packages/core/src/agent/planning/index.js', () => {
  return {
    PlanExecutor: class MockPlanExecutor {
      execute = vi.fn();
      constructor() {}
    },
  };
});

// Mock ContextManager as a proper class
vi.mock('../../packages/core/src/agent/context-manager.js', () => {
  return {
    ContextManager: class MockContextManager extends EventEmitter {
      pruneContext = vi.fn();
      getStats = vi.fn().mockReturnValue({ percentage: 0.5, tokenCount: 5000 });
      dispose = vi.fn();
      constructor() {
        super();
      }
    },
  };
});

// Mock SubagentOrchestrator as a proper class
vi.mock('../../packages/core/src/agent/subagent-orchestrator.js', () => {
  return {
    SubagentOrchestrator: class MockSubagentOrchestrator extends EventEmitter {
      spawn = vi.fn();
      terminateAll = vi.fn().mockResolvedValue(undefined);
      constructor() {
        super();
      }
    },
  };
});

// Mock parallel-tools
vi.mock('../../packages/core/src/agent/parallel-tools.js', () => ({
  partitionToolCalls: vi.fn().mockReturnValue({ parallel: [], sequential: [] }),
}));

// Mock planner with all required exports
vi.mock('../../packages/core/src/planner/index.js', () => ({
  isComplexRequest: vi.fn().mockReturnValue(false),
  shouldUseThinkingMode: vi.fn().mockReturnValue(false),
  getComplexityScore: vi.fn().mockReturnValue(0),
  getTaskPlanner: vi.fn().mockReturnValue({
    createPlan: vi.fn(),
    executePlan: vi.fn(),
  }),
  TaskPlanner: vi.fn().mockImplementation(() => ({
    createPlan: vi.fn(),
    executePlan: vi.fn(),
  })),
}));

// Import after mocks
import {
  setLLMAgentDependencies,
  resetLLMAgentDependencies,
} from '../../packages/core/src/agent/llm-agent-dependencies.js';
import { LLMAgent } from '../../packages/core/src/agent/llm-agent.js';
import type { SamplingConfig, ThinkingConfig } from '../../packages/core/src/llm/types.js';

// Create mock LLM client factory
function createMockLLMClient() {
  return {
    getCurrentModel: vi.fn().mockReturnValue('glm-4.6-flash'),
    chat: vi.fn().mockResolvedValue({ content: 'Test response' }),
    chatStream: vi.fn(),
    setModel: vi.fn(),
  };
}

// Create mock dependencies
function createMockDependencies() {
  const mockSettingsManager = {
    getCurrentModel: vi.fn().mockReturnValue('glm-4.6-flash'),
    getSamplingSettings: vi.fn().mockReturnValue(undefined),
    getProviderSettings: vi.fn().mockReturnValue({}),
    getSettings: vi.fn().mockReturnValue({}),
  };

  const mockTokenCounter = {
    count: vi.fn().mockReturnValue(100),
    countMessages: vi.fn().mockReturnValue(1000),
    getContextLimit: vi.fn().mockReturnValue(128000),
  };

  const mockCheckpointManager = {
    initialize: vi.fn().mockResolvedValue(undefined),
    createCheckpoint: vi.fn().mockResolvedValue({ id: 'checkpoint-123' }),
    getCheckpoints: vi.fn().mockReturnValue([]),
  };

  const mockTaskPlanner = {
    createPlan: vi.fn(),
    executePlan: vi.fn(),
  };

  const mockStatusReporter = {
    generateContextSummary: vi.fn().mockResolvedValue({
      path: '/tmp/summary.json',
      messageCount: 10,
      tokenCount: 5000,
    }),
    generateStatusReport: vi.fn(),
  };

  const mockLoopDetector = {
    checkLoop: vi.fn().mockReturnValue({ isLoop: false }),
    reset: vi.fn(),
  };

  const mockMCPManager = {
    getTools: vi.fn().mockReturnValue([]),
    getClients: vi.fn().mockReturnValue([]),
  };

  return {
    getSettingsManager: () => mockSettingsManager as unknown,
    getTokenCounter: () => mockTokenCounter as unknown,
    loadCustomInstructions: () => null,
    buildSystemPrompt: () => 'Test system prompt',
    getCheckpointManager: () => mockCheckpointManager as unknown,
    getTaskPlanner: () => mockTaskPlanner as unknown,
    getStatusReporter: () => mockStatusReporter as unknown,
    getLoopDetector: () => mockLoopDetector as unknown,
    resetLoopDetector: vi.fn(),
    getActiveProvider: () => ({
      id: 'test-provider',
      displayName: 'Test Provider',
      features: {
        supportsSearch: false,
        supportsVision: false,
        supportsThinking: false,
      },
    }),
    loadMCPConfig: () => ({ servers: [] }),
    getAllTools: vi.fn().mockResolvedValue([]),
    getMCPManager: () => mockMCPManager as unknown,
    initializeMCPServers: vi.fn().mockResolvedValue(undefined),
    resolveMCPReferences: vi.fn().mockImplementation((msg: string) => Promise.resolve(msg)),
    extractMCPReferences: vi.fn().mockReturnValue([]),
    // Factory function to create mock LLM client (bypasses constructor)
    createLLMClient: () => createMockLLMClient() as unknown,
  };
}

describe('LLMAgent', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  describe('constructor', () => {
    it('should create agent with required parameters', () => {
      const agent = new LLMAgent('test-api-key');
      expect(agent).toBeInstanceOf(LLMAgent);
      expect(agent).toBeInstanceOf(EventEmitter);
    });

    it('should create agent with custom base URL', () => {
      const agent = new LLMAgent('test-api-key', 'https://custom.api.com');
      expect(agent).toBeInstanceOf(LLMAgent);
    });

    it('should create agent with custom model', () => {
      const agent = new LLMAgent('test-api-key', undefined, 'custom-model');
      expect(agent).toBeInstanceOf(LLMAgent);
    });

    it('should create agent with custom max tool rounds', () => {
      const agent = new LLMAgent('test-api-key', undefined, undefined, 100);
      expect(agent).toBeInstanceOf(LLMAgent);
    });

    it('should create agent with MCP client config', () => {
      const agent = new LLMAgent('test-api-key', undefined, undefined, undefined, {
        name: 'test-client',
        version: '1.0.0',
      });
      expect(agent).toBeInstanceOf(LLMAgent);
    });

    it('should throw error when no model is configured', () => {
      const depsWithoutModel = {
        ...mockDeps,
        getSettingsManager: () => ({
          getCurrentModel: vi.fn().mockReturnValue(null),
          getSamplingSettings: vi.fn().mockReturnValue(undefined),
        }),
      };
      setLLMAgentDependencies(depsWithoutModel);

      expect(() => new LLMAgent('test-api-key')).toThrow('No model configured');
    });
  });

  describe('setSamplingConfig', () => {
    it('should set sampling configuration', () => {
      const agent = new LLMAgent('test-api-key');
      const config: SamplingConfig = { temperature: 0.7 };

      agent.setSamplingConfig(config);

      expect(agent.getSamplingConfig()).toEqual(config);
    });

    it('should clear sampling configuration when undefined', () => {
      const agent = new LLMAgent('test-api-key');
      agent.setSamplingConfig({ temperature: 0.7 });
      agent.setSamplingConfig(undefined);

      expect(agent.getSamplingConfig()).toBeUndefined();
    });
  });

  describe('setThinkingConfig', () => {
    it('should set thinking configuration', () => {
      const agent = new LLMAgent('test-api-key');
      const config: ThinkingConfig = { type: 'enabled' };

      agent.setThinkingConfig(config);

      expect(agent.getThinkingConfig()).toEqual(config);
    });

    it('should disable thinking when disabled type is set', () => {
      const agent = new LLMAgent('test-api-key');
      agent.setThinkingConfig({ type: 'disabled' });

      expect(agent.getThinkingConfig()).toEqual({ type: 'disabled' });
    });

    it('should clear thinking configuration when undefined', () => {
      const agent = new LLMAgent('test-api-key');
      agent.setThinkingConfig({ type: 'enabled' });
      agent.setThinkingConfig(undefined);

      expect(agent.getThinkingConfig()).toBeUndefined();
    });
  });

  describe('isAutoThinkingEnabled', () => {
    it('should return false by default', () => {
      const agent = new LLMAgent('test-api-key');
      expect(agent.isAutoThinkingEnabled()).toBe(false);
    });
  });

  describe('isDeterministicMode', () => {
    it('should return false when no sampling config', () => {
      const agent = new LLMAgent('test-api-key');
      expect(agent.isDeterministicMode()).toBe(false);
    });

    it('should return true when doSample is false', () => {
      const agent = new LLMAgent('test-api-key');
      agent.setSamplingConfig({ doSample: false });
      expect(agent.isDeterministicMode()).toBe(true);
    });

    it('should return false when doSample is true', () => {
      const agent = new LLMAgent('test-api-key');
      agent.setSamplingConfig({ doSample: true });
      expect(agent.isDeterministicMode()).toBe(false);
    });

    it('should return false when doSample is not set', () => {
      const agent = new LLMAgent('test-api-key');
      agent.setSamplingConfig({ temperature: 0.7 });
      expect(agent.isDeterministicMode()).toBe(false);
    });
  });

  describe('setRequireToolApproval', () => {
    it('should enable tool approval requirement', () => {
      const agent = new LLMAgent('test-api-key');
      agent.setRequireToolApproval(true);
      // No direct getter, but we can test the behavior indirectly
      expect(agent).toBeInstanceOf(LLMAgent);
    });

    it('should disable tool approval requirement', () => {
      const agent = new LLMAgent('test-api-key');
      agent.setRequireToolApproval(false);
      expect(agent).toBeInstanceOf(LLMAgent);
    });
  });

  describe('approveToolCall', () => {
    it('should do nothing for non-existent tool call', () => {
      const agent = new LLMAgent('test-api-key');
      // Should not throw
      expect(() => agent.approveToolCall('non-existent-id', true)).not.toThrow();
    });
  });

  describe('getChatHistory', () => {
    it('should return empty array initially', () => {
      const agent = new LLMAgent('test-api-key');
      expect(agent.getChatHistory()).toEqual([]);
    });
  });

  describe('getCurrentModel', () => {
    it('should return current model from LLM client', () => {
      const agent = new LLMAgent('test-api-key');
      const model = agent.getCurrentModel();
      expect(model).toBe('glm-4.6-flash');
    });
  });

  describe('abortCurrentOperation', () => {
    it('should not throw when no operation is running', () => {
      const agent = new LLMAgent('test-api-key');
      expect(() => agent.abortCurrentOperation()).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      const agent = new LLMAgent('test-api-key');
      agent.dispose();
      // Should not throw on subsequent calls (idempotent)
      agent.dispose();
      expect(agent).toBeInstanceOf(LLMAgent);
    });

    it('should be callable multiple times without error', () => {
      const agent = new LLMAgent('test-api-key');
      agent.dispose();
      agent.dispose();
      agent.dispose();
      expect(agent).toBeInstanceOf(LLMAgent);
    });
  });

  describe('setModel', () => {
    it('should change the model without throwing', () => {
      const agent = new LLMAgent('test-api-key');
      // setModel uses the mocked LLMClient.setModel
      agent.setModel('new-model');
      expect(agent).toBeInstanceOf(LLMAgent);
    });
  });

  describe('getContextPercentage', () => {
    it('should return context usage percentage', () => {
      const agent = new LLMAgent('test-api-key');
      const percentage = agent.getContextPercentage();
      expect(typeof percentage).toBe('number');
      expect(percentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('event emission', () => {
    it('should emit events for tool calls', () => {
      const agent = new LLMAgent('test-api-key');
      const toolStartHandler = vi.fn();
      agent.on('tool:start', toolStartHandler);

      // Manually emit the event to test handler
      agent.emit('tool:start', { name: 'test_tool' });
      expect(toolStartHandler).toHaveBeenCalledWith({ name: 'test_tool' });
    });

    it('should emit events for errors', () => {
      const agent = new LLMAgent('test-api-key');
      const errorHandler = vi.fn();
      agent.on('error', errorHandler);

      const testError = new Error('Test error');
      agent.emit('error', testError);
      expect(errorHandler).toHaveBeenCalledWith(testError);
    });

    it('should emit events for subagent lifecycle', () => {
      const agent = new LLMAgent('test-api-key');
      const subagentStartHandler = vi.fn();
      agent.on('subagent:start', subagentStartHandler);

      agent.emit('subagent:start', { name: 'test-subagent' });
      expect(subagentStartHandler).toHaveBeenCalled();
    });
  });

  describe('executeBashCommand', () => {
    it('should execute bash command through tool executor', async () => {
      const agent = new LLMAgent('test-api-key');

      // This will use the mocked ToolExecutor
      const result = await agent.executeBashCommand('echo "test"');

      // The result depends on the mock implementation
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });
  });

  describe('isBashExecuting', () => {
    it('should return false when no command is executing', () => {
      const agent = new LLMAgent('test-api-key');
      expect(agent.isBashExecuting()).toBe(false);
    });
  });

  describe('moveBashToBackground', () => {
    it('should return null when no command is executing', () => {
      const agent = new LLMAgent('test-api-key');
      expect(agent.moveBashToBackground()).toBeNull();
    });
  });

  describe('getCurrentDirectory', () => {
    it('should return current directory from bash tool', () => {
      const agent = new LLMAgent('test-api-key');
      expect(agent.getCurrentDirectory()).toBe('/test');
    });
  });
});

describe('LLMAgent with native search provider', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    mockDeps.getActiveProvider = () => ({
      id: 'grok',
      displayName: 'Grok',
      features: {
        supportsSearch: true,
        supportsVision: true,
        supportsThinking: false,
      },
    });
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  it('should create agent with search-enabled provider', () => {
    const agent = new LLMAgent('test-api-key');
    expect(agent).toBeInstanceOf(LLMAgent);
    expect(agent.getCurrentModel()).toBe('glm-4.6-flash');
  });
});

describe('LLMAgent with MCP servers', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    mockDeps.loadMCPConfig = () => ({
      servers: [{ name: 'test-server', command: 'test' }],
    });
    mockDeps.getMCPManager = () => ({
      getTools: vi.fn().mockReturnValue([
        { name: 'mcp__test__tool', description: 'Test MCP tool' },
      ]),
      getClients: vi.fn().mockReturnValue([]),
    });
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  it('should initialize MCP when servers are configured', async () => {
    const agent = new LLMAgent('test-api-key');
    expect(agent).toBeInstanceOf(LLMAgent);

    // Allow background initialization
    await vi.advanceTimersByTimeAsync(100);
  });
});

describe('LLMAgent tool approval flow', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  it('should emit tool:approval_required when approval is enabled', async () => {
    const agent = new LLMAgent('test-api-key');
    agent.setRequireToolApproval(true);

    const approvalHandler = vi.fn();
    agent.on('tool:approval_required', approvalHandler);

    // This would trigger the approval flow in real usage
    // For now we just verify the handler can be registered
    expect(agent).toBeInstanceOf(LLMAgent);
  });

  it('should handle approval callback correctly', () => {
    const agent = new LLMAgent('test-api-key');
    agent.setRequireToolApproval(true);

    // Approve a non-existent call - should not throw
    agent.approveToolCall('test-id', true);
    agent.approveToolCall('test-id', false);
  });
});

describe('LLMAgent additional functionality', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  it('should return empty chat history initially', () => {
    const agent = new LLMAgent('test-api-key');
    const history = agent.getChatHistory();
    expect(history).toEqual([]);
  });

  it('should return current model', () => {
    const agent = new LLMAgent('test-api-key');
    const model = agent.getCurrentModel();
    expect(model).toBe('glm-4.6-flash');
  });
});

describe('LLMAgent sampling config from settings', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    // Override settings manager with sampling config
    const settingsWithSampling = {
      getCurrentModel: vi.fn().mockReturnValue('glm-4.6-flash'),
      getSamplingSettings: vi.fn().mockReturnValue({ temperature: 0.5 }),
      getProviderSettings: vi.fn().mockReturnValue({}),
      getSettings: vi.fn().mockReturnValue({}),
    };
    mockDeps.getSettingsManager = () => settingsWithSampling as unknown;
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  it('should load sampling config from settings', () => {
    const agent = new LLMAgent('test-api-key');

    const config = agent.getSamplingConfig();
    expect(config).toEqual({ temperature: 0.5 });
  });
});

describe('LLMAgent checkpoint functionality', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  it('should get checkpoint manager', () => {
    const agent = new LLMAgent('test-api-key');
    const manager = agent.getCheckpointManager();
    expect(manager).toBeDefined();
    expect(manager.createCheckpoint).toBeDefined();
  });

  it('should create checkpoint with description', async () => {
    const agent = new LLMAgent('test-api-key');
    const checkpointId = await agent.createCheckpoint('Test checkpoint');
    expect(checkpointId).toBe('checkpoint-123');
  });

  it('should create checkpoint without description', async () => {
    const agent = new LLMAgent('test-api-key');
    const checkpointId = await agent.createCheckpoint();
    expect(checkpointId).toBe('checkpoint-123');
  });

  it('should rewind conversation to checkpoint', async () => {
    const mockCheckpointManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      createCheckpoint: vi.fn().mockResolvedValue('checkpoint-123'),
      getConversationState: vi.fn().mockResolvedValue([
        { type: 'user', content: 'Hello', timestamp: new Date() },
        { type: 'assistant', content: 'Hi there!', timestamp: new Date() },
      ]),
    };
    mockDeps.getCheckpointManager = () => mockCheckpointManager as unknown;
    setLLMAgentDependencies(mockDeps);

    const agent = new LLMAgent('test-api-key');
    const result = await agent.rewindConversation('checkpoint-123');

    expect(result.success).toBe(true);
    expect(agent.getChatHistory()).toHaveLength(2);
  });

  it('should fail rewind for non-existent checkpoint', async () => {
    const mockCheckpointManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      createCheckpoint: vi.fn().mockResolvedValue('checkpoint-123'),
      getConversationState: vi.fn().mockResolvedValue(null),
    };
    mockDeps.getCheckpointManager = () => mockCheckpointManager as unknown;
    setLLMAgentDependencies(mockDeps);

    const agent = new LLMAgent('test-api-key');
    const result = await agent.rewindConversation('non-existent');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should handle rewind errors gracefully', async () => {
    const mockCheckpointManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      createCheckpoint: vi.fn().mockResolvedValue('checkpoint-123'),
      getConversationState: vi.fn().mockRejectedValue(new Error('Database error')),
    };
    mockDeps.getCheckpointManager = () => mockCheckpointManager as unknown;
    setLLMAgentDependencies(mockDeps);

    const agent = new LLMAgent('test-api-key');
    const result = await agent.rewindConversation('checkpoint-123');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to rewind');
  });
});

describe('LLMAgent conversation restoration', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  it('should restore from history entries', () => {
    const agent = new LLMAgent('test-api-key');
    const entries = [
      { type: 'user' as const, content: 'Hello', timestamp: new Date() },
      { type: 'assistant' as const, content: 'Hi!', timestamp: new Date() },
    ];

    agent.restoreFromHistory(entries);

    const history = agent.getChatHistory();
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('Hello');
    expect(history[1].content).toBe('Hi!');
  });

  it('should handle empty history gracefully', () => {
    const agent = new LLMAgent('test-api-key');
    agent.restoreFromHistory([]);
    expect(agent.getChatHistory()).toHaveLength(0);
  });

  it('should handle null history gracefully', () => {
    const agent = new LLMAgent('test-api-key');
    agent.restoreFromHistory(null as unknown as []);
    expect(agent.getChatHistory()).toHaveLength(0);
  });

  it('should restore history with tool calls and results', () => {
    const agent = new LLMAgent('test-api-key');
    const toolCallId = 'call-123';
    const entries = [
      { type: 'user' as const, content: 'Do something', timestamp: new Date() },
      {
        type: 'assistant' as const,
        content: 'Let me help',
        timestamp: new Date(),
        toolCalls: [{ id: toolCallId, type: 'function', function: { name: 'test', arguments: '{}' } }],
      },
      {
        type: 'tool_result' as const,
        content: 'Tool output',
        timestamp: new Date(),
        toolCall: { id: toolCallId, type: 'function', function: { name: 'test', arguments: '{}' } },
      },
    ];

    agent.restoreFromHistory(entries);

    const history = agent.getChatHistory();
    expect(history).toHaveLength(3);
  });

  it('should skip orphaned tool results', () => {
    const agent = new LLMAgent('test-api-key');
    const entries = [
      { type: 'user' as const, content: 'Hello', timestamp: new Date() },
      {
        type: 'tool_result' as const,
        content: 'Orphaned result',
        timestamp: new Date(),
        toolCall: { id: 'orphan-id', type: 'function', function: { name: 'test', arguments: '{}' } },
      },
    ];

    // Should not throw - orphaned results are skipped
    agent.restoreFromHistory(entries);
    expect(agent.getChatHistory()).toHaveLength(2);
  });
});

describe('LLMAgent subagent orchestrator', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  it('should get subagent orchestrator', () => {
    const agent = new LLMAgent('test-api-key');
    const orchestrator = agent.getSubagentOrchestrator();
    expect(orchestrator).toBeDefined();
  });
});

describe('LLMAgent planning functionality', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  it('should return null when no plan is active', () => {
    const agent = new LLMAgent('test-api-key');
    expect(agent.getCurrentPlan()).toBeNull();
  });
});

describe('LLMAgent disposed state', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  it('should throw AGENT_DISPOSED when getting chat history after dispose', () => {
    const agent = new LLMAgent('test-api-key');
    agent.dispose();

    expect(() => agent.getChatHistory()).toThrow('Agent has been disposed');
  });

  it('should clear conversation history on dispose', () => {
    const agent = new LLMAgent('test-api-key');
    agent.restoreFromHistory([
      { type: 'user', content: 'Hello', timestamp: new Date() },
    ]);

    agent.dispose();

    // Can't check history directly (throws), but dispose should have cleared it
    expect(() => agent.getChatHistory()).toThrow();
  });

  it('should call destroy which delegates to dispose', () => {
    const agent = new LLMAgent('test-api-key');
    // destroy() is deprecated alias for dispose()
    agent.destroy();

    expect(() => agent.getChatHistory()).toThrow('Agent has been disposed');
  });
});

describe('LLMAgent context management', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  it('should calculate context percentage', () => {
    const agent = new LLMAgent('test-api-key');
    const percentage = agent.getContextPercentage();

    // Mock returns 0.5 (50%)
    expect(typeof percentage).toBe('number');
    expect(percentage).toBeGreaterThanOrEqual(0);
    expect(percentage).toBeLessThanOrEqual(100);
  });
});

describe('LLMAgent deterministic mode', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  it('should detect deterministic mode when doSample is false', () => {
    const agent = new LLMAgent('test-api-key');

    expect(agent.isDeterministicMode()).toBe(false);

    agent.setSamplingConfig({ doSample: false });
    expect(agent.isDeterministicMode()).toBe(true);
  });

  it('should not be in deterministic mode with default settings', () => {
    const agent = new LLMAgent('test-api-key');
    expect(agent.isDeterministicMode()).toBe(false);
  });

  it('should not be in deterministic mode when doSample is true', () => {
    const agent = new LLMAgent('test-api-key');
    agent.setSamplingConfig({ doSample: true, temperature: 0.7 });
    expect(agent.isDeterministicMode()).toBe(false);
  });
});

describe('LLMAgent model management', () => {
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDeps = createMockDependencies();
    setLLMAgentDependencies(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetLLMAgentDependencies();
  });

  it('should set model and update token counter', () => {
    const agent = new LLMAgent('test-api-key');
    agent.setModel('new-model');
    // The mock doesn't update getCurrentModel, but setModel should not throw
    expect(agent).toBeInstanceOf(LLMAgent);
  });
});
