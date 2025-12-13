/**
 * Tests for llm/tools module
 * Tests MCP manager singleton, tool conversion, and tool merging
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules before imports
vi.mock('../../packages/core/src/mcp/client.js', () => {
  const mockGetTools = vi.fn().mockReturnValue([]);
  const mockGetServers = vi.fn().mockReturnValue([]);
  const mockAddServer = vi.fn().mockResolvedValue(undefined);
  const mockDispose = vi.fn().mockResolvedValue(undefined);
  const mockGetConnectionStatus = vi.fn().mockReturnValue({ connected: 0, failed: 0, connecting: 0, total: 0 });
  const mockGetPrompts = vi.fn().mockReturnValue([]);
  const mockDiscoverPrompts = vi.fn().mockResolvedValue(undefined);
  const mockEnsureServersInitialized = vi.fn().mockResolvedValue(undefined);

  class MockMCPManager {
    getTools = mockGetTools;
    getServers = mockGetServers;
    addServer = mockAddServer;
    dispose = mockDispose;
    getConnectionStatus = mockGetConnectionStatus;
    getPrompts = mockGetPrompts;
    discoverPrompts = mockDiscoverPrompts;
    ensureServersInitialized = mockEnsureServersInitialized;
  }

  return {
    MCPManager: MockMCPManager,
    mockGetTools,
    mockGetServers,
    mockAddServer,
    mockDispose,
    mockGetConnectionStatus,
    mockGetPrompts,
    mockDiscoverPrompts,
    mockEnsureServersInitialized,
  };
});

vi.mock('../../packages/core/src/mcp/config.js', () => ({
  loadMCPConfig: vi.fn().mockReturnValue({ servers: [] }),
}));

vi.mock('../../packages/core/src/tools/definitions/index.js', () => ({
  TOOL_DEFINITIONS: [],
}));

vi.mock('../../packages/core/src/tools/format-generators.js', () => ({
  toOpenAIFormat: vi.fn((def) => ({
    type: 'function',
    function: { name: def?.name || 'mock_tool', description: 'mock', parameters: {} },
  })),
}));

vi.mock('../../packages/core/src/tools/priority-registry.js', () => ({
  getPriorityRegistry: vi.fn().mockReturnValue({
    filterTools: vi.fn((tools) => ({ filtered: tools, hidden: [] })),
  }),
}));

vi.mock('../../packages/core/src/mcp/resources.js', () => ({
  listAllResources: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../packages/core/src/utils/error-handler.js', () => ({
  extractErrorMessage: vi.fn((error: unknown) => error instanceof Error ? error.message : String(error)),
}));

import {
  getMCPManager,
  resetMCPManager,
  getMCPClientConfig,
  getMcpConnectionCount,
  initializeMCPServers,
  convertMCPToolToLLMTool,
  mergeWithMCPTools,
  getAllTools,
  getMCPConnectionStatus,
  getMCPPrompts,
  discoverMCPPrompts,
  getMCPResources,
  LLM_TOOLS,
} from '../../packages/core/src/llm/tools.js';

import { loadMCPConfig } from '../../packages/core/src/mcp/config.js';
import { getPriorityRegistry } from '../../packages/core/src/tools/priority-registry.js';

// Access mocks
import * as mcpClientMock from '../../packages/core/src/mcp/client.js';
const mockGetTools = (mcpClientMock as unknown as { mockGetTools: ReturnType<typeof vi.fn> }).mockGetTools;
const mockGetServers = (mcpClientMock as unknown as { mockGetServers: ReturnType<typeof vi.fn> }).mockGetServers;
const mockAddServer = (mcpClientMock as unknown as { mockAddServer: ReturnType<typeof vi.fn> }).mockAddServer;
const mockGetConnectionStatus = (mcpClientMock as unknown as { mockGetConnectionStatus: ReturnType<typeof vi.fn> }).mockGetConnectionStatus;
const mockGetPrompts = (mcpClientMock as unknown as { mockGetPrompts: ReturnType<typeof vi.fn> }).mockGetPrompts;
const mockDiscoverPrompts = (mcpClientMock as unknown as { mockDiscoverPrompts: ReturnType<typeof vi.fn> }).mockDiscoverPrompts;
const mockEnsureServersInitialized = (mcpClientMock as unknown as { mockEnsureServersInitialized: ReturnType<typeof vi.fn> }).mockEnsureServersInitialized;

describe('MCP Manager Singleton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMCPManager();
  });

  afterEach(() => {
    resetMCPManager();
  });

  it('should return singleton instance', () => {
    const manager1 = getMCPManager();
    const manager2 = getMCPManager();
    expect(manager1).toBe(manager2);
  });

  it('should create manager with client config', () => {
    const config = { name: 'test-client', version: '1.0.0' };
    getMCPManager(config);
    expect(getMCPClientConfig()).toEqual(config);
  });

  it('should ignore config on subsequent calls', () => {
    const config1 = { name: 'first', version: '1.0' };
    const config2 = { name: 'second', version: '2.0' };

    getMCPManager(config1);
    getMCPManager(config2); // Should be ignored

    expect(getMCPClientConfig()).toEqual(config1);
  });

  it('should reset manager and config', () => {
    getMCPManager({ name: 'test' });
    resetMCPManager();

    expect(getMCPClientConfig()).toBeUndefined();

    // New manager should be created
    const newManager = getMCPManager({ name: 'new' });
    expect(newManager).toBeDefined();
    expect(getMCPClientConfig()).toEqual({ name: 'new' });
  });
});

describe('getMcpConnectionCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMCPManager();
  });

  afterEach(() => {
    resetMCPManager();
  });

  it('should return 0 when manager not initialized', () => {
    expect(getMcpConnectionCount()).toBe(0);
  });

  it('should return count of connected servers', () => {
    getMCPManager();
    mockGetServers.mockReturnValue([{ name: 'server1' }, { name: 'server2' }]);

    expect(getMcpConnectionCount()).toBe(2);
  });
});

describe('initializeMCPServers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMCPManager();
  });

  afterEach(() => {
    resetMCPManager();
  });

  it('should initialize servers from config', async () => {
    vi.mocked(loadMCPConfig).mockReturnValue({
      servers: [
        { name: 'server1', transport: { type: 'stdio', command: 'cmd1', args: [] } },
        { name: 'server2', transport: { type: 'stdio', command: 'cmd2', args: [] } },
      ],
    });

    await initializeMCPServers();

    expect(mockAddServer).toHaveBeenCalledTimes(2);
  });

  it('should handle server initialization failures', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockAddServer.mockRejectedValueOnce(new Error('Connection failed'));

    vi.mocked(loadMCPConfig).mockReturnValue({
      servers: [
        { name: 'failing-server', transport: { type: 'stdio', command: 'cmd', args: [] } },
      ],
    });

    await initializeMCPServers();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to initialize MCP server failing-server'),
      expect.anything()
    );

    warnSpy.mockRestore();
  });

  it('should pass client config to manager', async () => {
    vi.mocked(loadMCPConfig).mockReturnValue({ servers: [] });

    await initializeMCPServers({ name: 'ax-cli', version: '4.0.0' });

    expect(getMCPClientConfig()).toEqual({ name: 'ax-cli', version: '4.0.0' });
  });

  it('should log when all servers fail', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockAddServer.mockRejectedValue(new Error('All fail'));

    vi.mocked(loadMCPConfig).mockReturnValue({
      servers: [
        { name: 'server1', transport: { type: 'stdio', command: 'cmd', args: [] } },
        { name: 'server2', transport: { type: 'stdio', command: 'cmd', args: [] } },
      ],
    });

    await initializeMCPServers();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('All 2 MCP server(s) failed to initialize')
    );

    warnSpy.mockRestore();
  });
});

describe('convertMCPToolToLLMTool', () => {
  it('should convert basic MCP tool', () => {
    const mcpTool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: {
        type: 'object',
        properties: { arg1: { type: 'string' } },
        required: ['arg1'],
      },
    };

    const result = convertMCPToolToLLMTool(mcpTool);

    expect(result.type).toBe('function');
    expect(result.function.name).toBe('test_tool');
    expect(result.function.description).toBe('A test tool');
    expect(result.function.parameters).toEqual(mcpTool.inputSchema);
  });

  it('should provide default parameters when inputSchema is missing', () => {
    const mcpTool = {
      name: 'simple_tool',
      description: 'Simple tool',
    };

    const result = convertMCPToolToLLMTool(mcpTool);

    expect(result.function.parameters).toEqual({
      type: 'object',
      properties: {},
      required: [],
    });
  });

  it('should include output schema in description', () => {
    const mcpTool = {
      name: 'output_tool',
      description: 'Tool with output',
      outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
    };

    const result = convertMCPToolToLLMTool(mcpTool);

    expect(result.function.description).toContain('Output schema:');
    expect(result.function.description).toContain('result');
  });

  it('should handle string output schema', () => {
    const mcpTool = {
      name: 'string_output',
      description: 'String output schema',
      outputSchema: 'Returns a string value',
    };

    const result = convertMCPToolToLLMTool(mcpTool);

    expect(result.function.description).toContain('Output schema: Returns a string value');
  });
});

describe('mergeWithMCPTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMCPManager();
  });

  afterEach(() => {
    resetMCPManager();
  });

  it('should return base tools when no MCP manager', () => {
    const baseTools = [
      { type: 'function' as const, function: { name: 'tool1', description: 'Tool 1', parameters: {} } },
    ];

    const result = mergeWithMCPTools(baseTools);

    expect(result).toEqual(baseTools);
  });

  it('should merge base tools with MCP tools', () => {
    getMCPManager();
    mockGetTools.mockReturnValue([
      { name: 'mcp_tool', description: 'MCP Tool' },
    ]);

    const baseTools = [
      { type: 'function' as const, function: { name: 'base_tool', description: 'Base Tool', parameters: {} } },
    ];

    const result = mergeWithMCPTools(baseTools);

    expect(result).toHaveLength(2);
    expect(result.map(t => t.function.name)).toContain('base_tool');
    expect(result.map(t => t.function.name)).toContain('mcp_tool');
  });

  it('should apply priority filter by default', () => {
    getMCPManager();
    mockGetTools.mockReturnValue([]);

    const mockFilterTools = vi.fn().mockReturnValue({ filtered: [], hidden: [] });
    vi.mocked(getPriorityRegistry).mockReturnValue({ filterTools: mockFilterTools });

    mergeWithMCPTools([]);

    expect(mockFilterTools).toHaveBeenCalled();
  });

  it('should skip priority filter when disabled', () => {
    getMCPManager();
    mockGetTools.mockReturnValue([]);

    const mockFilterTools = vi.fn().mockReturnValue({ filtered: [], hidden: [] });
    vi.mocked(getPriorityRegistry).mockReturnValue({ filterTools: mockFilterTools });

    mergeWithMCPTools([], { applyPriorityFilter: false });

    expect(mockFilterTools).not.toHaveBeenCalled();
  });

  it('should log hidden tools in debug mode', () => {
    const originalDebug = process.env.DEBUG;
    process.env.DEBUG = 'true';

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    getMCPManager();
    mockGetTools.mockReturnValue([]);

    const hiddenTool = { type: 'function' as const, function: { name: 'hidden', description: 'Hidden', parameters: {} } };
    vi.mocked(getPriorityRegistry).mockReturnValue({
      filterTools: vi.fn().mockReturnValue({
        filtered: [],
        hidden: [{ tool: hiddenTool, reason: 'lower priority' }],
      }),
    });

    mergeWithMCPTools([hiddenTool]);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Priority Filter'));

    logSpy.mockRestore();
    process.env.DEBUG = originalDebug;
  });
});

describe('getAllTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMCPManager();
  });

  afterEach(() => {
    resetMCPManager();
  });

  it('should return merged tools', async () => {
    mockGetTools.mockReturnValue([
      { name: 'mcp_tool', description: 'MCP Tool' },
    ]);
    mockEnsureServersInitialized.mockResolvedValue(undefined);

    const tools = await getAllTools();

    expect(Array.isArray(tools)).toBe(true);
  });

  it('should handle initialization timeout', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Make ensureServersInitialized hang
    mockEnsureServersInitialized.mockImplementation(() => new Promise(() => {}));

    // Use fake timers for this test
    vi.useFakeTimers();

    const toolsPromise = getAllTools();

    // Advance past the timeout
    vi.advanceTimersByTime(65000);

    const tools = await toolsPromise;

    expect(warnSpy).toHaveBeenCalledWith(
      'MCP server initialization failed:',
      expect.stringContaining('timeout')
    );

    expect(Array.isArray(tools)).toBe(true);

    vi.useRealTimers();
    warnSpy.mockRestore();
  });

  it('should handle initialization error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockEnsureServersInitialized.mockRejectedValue(new Error('Init failed'));

    const tools = await getAllTools();

    expect(warnSpy).toHaveBeenCalledWith(
      'MCP server initialization failed:',
      'Init failed'
    );
    expect(Array.isArray(tools)).toBe(true);

    warnSpy.mockRestore();
  });
});

describe('getMCPConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMCPManager();
    // Reset mock return values to defaults
    mockGetConnectionStatus.mockReturnValue({ connected: 0, failed: 0, connecting: 0, total: 0 });
  });

  afterEach(() => {
    resetMCPManager();
  });

  it('should return zeros when manager not initialized', () => {
    // Manager not initialized yet - test runs first before any getMCPManager calls
    const status = getMCPConnectionStatus();

    expect(status).toEqual({
      connected: 0,
      failed: 0,
      connecting: 0,
      total: 0,
    });
  });

  it('should return connection status', () => {
    getMCPManager();
    mockGetConnectionStatus.mockReturnValue({
      connected: 2,
      failed: 1,
      connecting: 0,
      total: 3,
    });

    const status = getMCPConnectionStatus();

    expect(status).toEqual({
      connected: 2,
      failed: 1,
      connecting: 0,
      total: 3,
    });
  });
});

describe('getMCPPrompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMCPManager();
    // Reset mock return values to defaults
    mockGetPrompts.mockReturnValue([]);
  });

  afterEach(() => {
    resetMCPManager();
  });

  it('should return empty array when manager not initialized', () => {
    const prompts = getMCPPrompts();
    expect(prompts).toEqual([]);
  });

  it('should return prompts from manager', () => {
    getMCPManager();
    mockGetPrompts.mockReturnValue([
      { serverName: 'server1', name: 'prompt1', description: 'A prompt' },
    ]);

    const prompts = getMCPPrompts();

    expect(prompts).toHaveLength(1);
    expect(prompts[0].name).toBe('prompt1');
  });
});

describe('discoverMCPPrompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMCPManager();
  });

  afterEach(() => {
    resetMCPManager();
  });

  it('should call manager discoverPrompts', async () => {
    getMCPManager();

    await discoverMCPPrompts();

    expect(mockDiscoverPrompts).toHaveBeenCalled();
  });

  it('should not throw when manager not initialized', async () => {
    await expect(discoverMCPPrompts()).resolves.not.toThrow();
  });
});

describe('getMCPResources', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetMCPManager();
    // Reset mock return values to defaults
    const { listAllResources } = await import('../../packages/core/src/mcp/resources.js');
    vi.mocked(listAllResources).mockResolvedValue([]);
  });

  afterEach(() => {
    resetMCPManager();
  });

  it('should return empty array when manager not initialized', async () => {
    const resources = await getMCPResources();
    expect(resources).toEqual([]);
  });

  it('should return resources from manager', async () => {
    getMCPManager();

    const { listAllResources } = await import('../../packages/core/src/mcp/resources.js');
    vi.mocked(listAllResources).mockResolvedValue([
      { uri: 'file:///test', name: 'test', serverName: 'server1', reference: '@mcp:test' },
    ]);

    const resources = await getMCPResources();

    expect(resources).toHaveLength(1);
    expect(resources[0].uri).toBe('file:///test');
  });
});

describe('LLM_TOOLS export', () => {
  it('should be an array', () => {
    expect(Array.isArray(LLM_TOOLS)).toBe(true);
  });
});
