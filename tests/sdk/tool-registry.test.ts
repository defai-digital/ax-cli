/**
 * Tests for sdk/tool-registry.ts
 * Tests the shared tool registry for AX <-> ax-cli integration
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ToolRegistry,
  getToolRegistry,
  registerTools,
  createToolExecutor,
  type ToolExecutionContext,
  type ToolExecutor,
  type RegisteredTool,
} from '../../packages/core/src/sdk/tool-registry.js';
import type { LLMTool } from '../../packages/core/src/llm/client.js';

describe('ToolRegistry', () => {
  beforeEach(() => {
    // Reset singleton before each test
    ToolRegistry.reset();
  });

  afterEach(() => {
    // Clean up after each test
    ToolRegistry.reset();
  });

  const createTestTool = (name: string = 'test_tool'): LLMTool => ({
    type: 'function',
    function: {
      name,
      description: `Test tool: ${name}`,
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Test input' },
        },
        required: ['input'],
      },
    },
  });

  const createTestExecutor = (response: string = 'success'): ToolExecutor => {
    return async (args, context) => ({
      success: true,
      output: `${response}: ${JSON.stringify(args)}`,
      data: { context },
    });
  };

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ToolRegistry.getInstance();
      const instance2 = ToolRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = ToolRegistry.getInstance();
      ToolRegistry.reset();
      const instance2 = ToolRegistry.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('registerTool', () => {
    it('should register a tool from ax-cli', () => {
      const registry = ToolRegistry.getInstance();
      const tool = createTestTool();
      const executor = createTestExecutor();

      registry.registerTool('ax-cli', tool, executor);

      expect(registry.hasTool('test_tool')).toBe(true);
      expect(registry.getToolNames()).toContain('test_tool');
    });

    it('should register a tool from automatosx', () => {
      const registry = ToolRegistry.getInstance();
      const tool = createTestTool('auto_tool');
      const executor = createTestExecutor();

      registry.registerTool('automatosx', tool, executor);

      expect(registry.hasTool('auto_tool')).toBe(true);
      expect(registry.getToolNamesBySource('automatosx')).toContain('auto_tool');
    });

    it('should throw when registering duplicate tool without allowOverwrite', () => {
      const registry = ToolRegistry.getInstance();
      const tool = createTestTool();
      const executor = createTestExecutor();

      registry.registerTool('ax-cli', tool, executor);

      expect(() => {
        registry.registerTool('ax-cli', tool, executor);
      }).toThrow("Tool 'test_tool' is already registered");
    });

    it('should allow overwriting with allowOverwrite option', () => {
      const registry = ToolRegistry.getInstance();
      const tool = createTestTool();
      const executor1 = createTestExecutor('first');
      const executor2 = createTestExecutor('second');

      registry.registerTool('ax-cli', tool, executor1);
      registry.registerTool('ax-cli', tool, executor2, { allowOverwrite: true });

      const registered = registry.getTool('test_tool');
      expect(registered).toBeDefined();
    });

    it('should handle source change when overwriting', () => {
      const registry = ToolRegistry.getInstance();
      const tool = createTestTool();
      const executor = createTestExecutor();

      registry.registerTool('ax-cli', tool, executor);
      registry.registerTool('automatosx', tool, executor, { allowOverwrite: true });

      expect(registry.getToolNamesBySource('ax-cli')).not.toContain('test_tool');
      expect(registry.getToolNamesBySource('automatosx')).toContain('test_tool');
    });

    it('should store tags correctly', () => {
      const registry = ToolRegistry.getInstance();
      const tool = createTestTool();
      const executor = createTestExecutor();

      registry.registerTool('ax-cli', tool, executor, { tags: ['file', 'utility'] });

      const definitions = registry.getToolDefinitionsByTag('file');
      expect(definitions).toHaveLength(1);
      expect(definitions[0].function.name).toBe('test_tool');
    });

    it('should clone definition to prevent external mutation', () => {
      const registry = ToolRegistry.getInstance();
      const tool = createTestTool();
      const executor = createTestExecutor();

      registry.registerTool('ax-cli', tool, executor);

      // Mutate original
      tool.function.name = 'mutated';
      tool.function.parameters = {};

      // Registry should be unaffected
      const registered = registry.getTool('test_tool');
      expect(registered?.definition.function.name).toBe('test_tool');
    });
  });

  describe('unregisterTool', () => {
    it('should remove a registered tool', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool(), createTestExecutor());

      const result = registry.unregisterTool('test_tool');

      expect(result).toBe(true);
      expect(registry.hasTool('test_tool')).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      const registry = ToolRegistry.getInstance();
      const result = registry.unregisterTool('non_existent');
      expect(result).toBe(false);
    });

    it('should remove from source tracking', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool(), createTestExecutor());

      registry.unregisterTool('test_tool');

      expect(registry.getToolNamesBySource('ax-cli')).not.toContain('test_tool');
    });
  });

  describe('getTool', () => {
    it('should return undefined for non-existent tool', () => {
      const registry = ToolRegistry.getInstance();
      expect(registry.getTool('non_existent')).toBeUndefined();
    });

    it('should return deep copy of tool', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool(), createTestExecutor(), {
        tags: ['test'],
      });

      const tool1 = registry.getTool('test_tool');
      const tool2 = registry.getTool('test_tool');

      expect(tool1).not.toBe(tool2);
      expect(tool1?.definition).not.toBe(tool2?.definition);
      expect(tool1?.tags).not.toBe(tool2?.tags);
    });

    it('should include all tool properties', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('automatosx', createTestTool(), createTestExecutor(), {
        tags: ['tag1', 'tag2'],
      });

      const tool = registry.getTool('test_tool');

      expect(tool?.registeredBy).toBe('automatosx');
      expect(tool?.registeredAt).toBeTypeOf('number');
      expect(tool?.tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('getAllToolDefinitions', () => {
    it('should return empty array when no tools registered', () => {
      const registry = ToolRegistry.getInstance();
      expect(registry.getAllToolDefinitions()).toEqual([]);
    });

    it('should return all tool definitions', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool('tool1'), createTestExecutor());
      registry.registerTool('automatosx', createTestTool('tool2'), createTestExecutor());

      const definitions = registry.getAllToolDefinitions();

      expect(definitions).toHaveLength(2);
      expect(definitions.map(d => d.function.name)).toContain('tool1');
      expect(definitions.map(d => d.function.name)).toContain('tool2');
    });

    it('should return deep copies', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool(), createTestExecutor());

      const defs1 = registry.getAllToolDefinitions();
      const defs2 = registry.getAllToolDefinitions();

      expect(defs1[0]).not.toBe(defs2[0]);
    });
  });

  describe('getToolDefinitionsBySource', () => {
    it('should filter by source', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool('cli_tool'), createTestExecutor());
      registry.registerTool('automatosx', createTestTool('ax_tool'), createTestExecutor());

      const cliTools = registry.getToolDefinitionsBySource('ax-cli');
      const axTools = registry.getToolDefinitionsBySource('automatosx');

      expect(cliTools).toHaveLength(1);
      expect(cliTools[0].function.name).toBe('cli_tool');
      expect(axTools).toHaveLength(1);
      expect(axTools[0].function.name).toBe('ax_tool');
    });

    it('should return empty for source with no tools', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool(), createTestExecutor());

      expect(registry.getToolDefinitionsBySource('automatosx')).toEqual([]);
    });
  });

  describe('getToolDefinitionsByTag', () => {
    it('should filter by tag', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool('file_tool'), createTestExecutor(), {
        tags: ['file', 'utility'],
      });
      registry.registerTool('ax-cli', createTestTool('network_tool'), createTestExecutor(), {
        tags: ['network'],
      });

      const fileTools = registry.getToolDefinitionsByTag('file');
      const utilityTools = registry.getToolDefinitionsByTag('utility');
      const networkTools = registry.getToolDefinitionsByTag('network');

      expect(fileTools).toHaveLength(1);
      expect(utilityTools).toHaveLength(1);
      expect(networkTools).toHaveLength(1);
      expect(fileTools[0].function.name).toBe('file_tool');
    });

    it('should return empty for non-existent tag', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool(), createTestExecutor());

      expect(registry.getToolDefinitionsByTag('non_existent')).toEqual([]);
    });
  });

  describe('executeTool', () => {
    it('should execute registered tool successfully', async () => {
      const registry = ToolRegistry.getInstance();
      const executor = vi.fn().mockResolvedValue({
        success: true,
        output: 'executed',
      });
      registry.registerTool('ax-cli', createTestTool(), executor);

      const context: ToolExecutionContext = { source: 'ax-cli' };
      const result = await registry.executeTool('test_tool', { input: 'test' }, context);

      expect(result.success).toBe(true);
      expect(result.output).toBe('executed');
      expect(executor).toHaveBeenCalled();
    });

    it('should return error for non-existent tool', async () => {
      const registry = ToolRegistry.getInstance();
      const context: ToolExecutionContext = { source: 'ax-cli' };

      const result = await registry.executeTool('non_existent', {}, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle executor errors', async () => {
      const registry = ToolRegistry.getInstance();
      const executor = vi.fn().mockRejectedValue(new Error('Execution failed'));
      registry.registerTool('ax-cli', createTestTool(), executor);

      const context: ToolExecutionContext = { source: 'ax-cli' };
      const result = await registry.executeTool('test_tool', {}, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Execution failed');
    });

    it('should handle non-Error exceptions', async () => {
      const registry = ToolRegistry.getInstance();
      const executor = vi.fn().mockRejectedValue('string error');
      registry.registerTool('ax-cli', createTestTool(), executor);

      const context: ToolExecutionContext = { source: 'ax-cli' };
      const result = await registry.executeTool('test_tool', {}, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown execution error');
    });

    it('should clone args and context before passing to executor', async () => {
      const registry = ToolRegistry.getInstance();
      let receivedArgs: any;
      let receivedContext: any;

      const executor: ToolExecutor = async (args, context) => {
        receivedArgs = args;
        receivedContext = context;
        // Try to mutate
        args.input = 'mutated';
        context.agentId = 'mutated';
        return { success: true };
      };
      registry.registerTool('ax-cli', createTestTool(), executor);

      const originalArgs = { input: 'original' };
      const originalContext: ToolExecutionContext = {
        source: 'ax-cli',
        agentId: 'original-agent',
        metadata: { key: 'value' },
      };

      await registry.executeTool('test_tool', originalArgs, originalContext);

      // Original should be unchanged
      expect(originalArgs.input).toBe('original');
      expect(originalContext.agentId).toBe('original-agent');
    });

    it('should include error data for Error instances', async () => {
      const registry = ToolRegistry.getInstance();
      const error = new Error('Test error');
      error.name = 'TestError';
      const executor = vi.fn().mockRejectedValue(error);
      registry.registerTool('ax-cli', createTestTool(), executor);

      const context: ToolExecutionContext = { source: 'ax-cli' };
      const result = await registry.executeTool('test_tool', {}, context);

      expect(result.data).toBeDefined();
      expect((result.data as any).errorName).toBe('TestError');
      expect((result.data as any).errorMessage).toBe('Test error');
    });
  });

  describe('getToolNames', () => {
    it('should return all tool names', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool('tool1'), createTestExecutor());
      registry.registerTool('ax-cli', createTestTool('tool2'), createTestExecutor());

      const names = registry.getToolNames();

      expect(names).toHaveLength(2);
      expect(names).toContain('tool1');
      expect(names).toContain('tool2');
    });
  });

  describe('getToolNamesBySource', () => {
    it('should return tool names for specific source', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool('cli1'), createTestExecutor());
      registry.registerTool('ax-cli', createTestTool('cli2'), createTestExecutor());
      registry.registerTool('automatosx', createTestTool('ax1'), createTestExecutor());

      expect(registry.getToolNamesBySource('ax-cli')).toHaveLength(2);
      expect(registry.getToolNamesBySource('automatosx')).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should clear all tools', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool('tool1'), createTestExecutor());
      registry.registerTool('automatosx', createTestTool('tool2'), createTestExecutor());

      registry.clear();

      expect(registry.getToolNames()).toHaveLength(0);
    });

    it('should clear only specific source', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool('cli_tool'), createTestExecutor());
      registry.registerTool('automatosx', createTestTool('ax_tool'), createTestExecutor());

      registry.clear('ax-cli');

      expect(registry.hasTool('cli_tool')).toBe(false);
      expect(registry.hasTool('ax_tool')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool('tool1'), createTestExecutor(), {
        tags: ['tag1', 'tag2'],
      });
      registry.registerTool('ax-cli', createTestTool('tool2'), createTestExecutor(), {
        tags: ['tag1'],
      });
      registry.registerTool('automatosx', createTestTool('tool3'), createTestExecutor());

      const stats = registry.getStats();

      expect(stats.total).toBe(3);
      expect(stats.bySource['ax-cli']).toBe(2);
      expect(stats.bySource['automatosx']).toBe(1);
      expect(stats.byTag['tag1']).toBe(2);
      expect(stats.byTag['tag2']).toBe(1);
    });
  });

  describe('exportDefinitions', () => {
    it('should export all tools with stats', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool('tool1'), createTestExecutor(), {
        tags: ['file'],
      });

      const exported = registry.exportDefinitions();

      expect(exported.tools).toHaveLength(1);
      expect(exported.tools[0].name).toBe('tool1');
      expect(exported.tools[0].tags).toEqual(['file']);
      expect(exported.stats.total).toBe(1);
    });

    it('should return deep copies', () => {
      const registry = ToolRegistry.getInstance();
      registry.registerTool('ax-cli', createTestTool(), createTestExecutor());

      const exported1 = registry.exportDefinitions();
      const exported2 = registry.exportDefinitions();

      expect(exported1.tools[0]).not.toBe(exported2.tools[0]);
    });
  });
});

describe('getToolRegistry', () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  afterEach(() => {
    ToolRegistry.reset();
  });

  it('should return the singleton registry', () => {
    const registry = getToolRegistry();
    expect(registry).toBe(ToolRegistry.getInstance());
  });
});

describe('registerTools', () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  afterEach(() => {
    ToolRegistry.reset();
  });

  const createTestTool = (name: string): LLMTool => ({
    type: 'function',
    function: {
      name,
      description: `Test tool: ${name}`,
      parameters: { type: 'object', properties: {} },
    },
  });

  it('should register multiple tools at once', () => {
    const result = registerTools('ax-cli', [
      { definition: createTestTool('tool1'), executor: async () => ({ success: true }) },
      { definition: createTestTool('tool2'), executor: async () => ({ success: true }) },
    ]);

    expect(result.registered).toEqual(['tool1', 'tool2']);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle registration errors', () => {
    const registry = getToolRegistry();
    registry.registerTool('ax-cli', createTestTool('existing'), async () => ({ success: true }));

    const result = registerTools('ax-cli', [
      { definition: createTestTool('existing'), executor: async () => ({ success: true }) },
    ]);

    expect(result.registered).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].name).toBe('existing');
  });

  it('should handle malformed tool input', () => {
    const result = registerTools('ax-cli', [
      null as any,
      { definition: null as any, executor: async () => ({ success: true }) },
      { definition: createTestTool('valid'), executor: null as any },
    ]);

    expect(result.registered).toHaveLength(0);
    expect(result.errors).toHaveLength(3);
  });

  it('should continue registering after errors', () => {
    const registry = getToolRegistry();
    registry.registerTool('ax-cli', createTestTool('existing'), async () => ({ success: true }));

    const result = registerTools('ax-cli', [
      { definition: createTestTool('existing'), executor: async () => ({ success: true }) },
      { definition: createTestTool('new_tool'), executor: async () => ({ success: true }) },
    ]);

    expect(result.registered).toContain('new_tool');
    expect(result.errors).toHaveLength(1);
  });
});

describe('createToolExecutor', () => {
  it('should create executor that calls handler', async () => {
    const handler = vi.fn().mockResolvedValue({ success: true, output: 'done' });
    const executor = createToolExecutor(handler);

    const context: ToolExecutionContext = { source: 'ax-cli' };
    const result = await executor({ key: 'value' }, context);

    expect(handler).toHaveBeenCalledWith({ key: 'value' });
    expect(result.success).toBe(true);
    expect(result.output).toBe('done');
  });

  it('should pass typed arguments to handler', async () => {
    interface MyArgs {
      name: string;
      count: number;
    }

    const handler = vi.fn<[MyArgs], Promise<{ success: boolean }>>(async (args) => {
      return { success: args.count > 0 };
    });

    const executor = createToolExecutor<MyArgs>(handler);
    const context: ToolExecutionContext = { source: 'ax-cli' };
    const result = await executor({ name: 'test', count: 5 }, context);

    expect(result.success).toBe(true);
    expect(handler).toHaveBeenCalledWith({ name: 'test', count: 5 });
  });
});
