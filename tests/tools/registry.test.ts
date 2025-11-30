import { describe, it, expect, vi } from 'vitest';
import { ToolRegistry, type ToolDefinition } from '../../src/tools/registry.js';

describe('ToolRegistry', () => {
  describe('register', () => {
    it('should register a valid tool', () => {
      const registry = new ToolRegistry();
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      };

      const result = registry.register(tool);
      expect(result.success).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should reject invalid tool names', () => {
      const registry = new ToolRegistry();
      const tool: ToolDefinition = {
        name: 'InvalidName',
        description: 'A test tool',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      };

      const result = registry.register(tool);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid tool name');
    });

    it('should accept valid tool names with underscores', () => {
      const registry = new ToolRegistry();
      const tool: ToolDefinition = {
        name: 'valid_tool_name',
        description: 'A test tool',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      };

      const result = registry.register(tool);
      expect(result.success).toBe(true);
    });

    it('should reject duplicate tool names', () => {
      const registry = new ToolRegistry();
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      };

      registry.register(tool);
      const result = registry.register(tool);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('already registered');
    });

    it('should validate tool dependencies', () => {
      const registry = new ToolRegistry();
      const tool: ToolDefinition = {
        name: 'dependent_tool',
        description: 'Depends on another tool',
        version: '1.0.0',
        category: 'custom',
        dependencies: ['missing_tool'],
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      };

      const result = registry.register(tool);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Missing dependency');
    });

    it('should allow tools with satisfied dependencies', () => {
      const registry = new ToolRegistry();

      const baseTool: ToolDefinition = {
        name: 'base_tool',
        description: 'Base tool',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      };

      const dependentTool: ToolDefinition = {
        name: 'dependent_tool',
        description: 'Dependent tool',
        version: '1.0.0',
        category: 'custom',
        dependencies: ['base_tool'],
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      };

      registry.register(baseTool);
      const result = registry.register(dependentTool);

      expect(result.success).toBe(true);
      expect(registry.size).toBe(2);
    });

    it('should reject tools with invalid schema', () => {
      const registry = new ToolRegistry();
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'string', properties: {} } as any // Invalid schema type
      };

      const result = registry.register(tool);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('must have object schema');
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', () => {
      const registry = new ToolRegistry();
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      };

      registry.register(tool);
      const result = registry.unregister('test_tool');

      expect(result.success).toBe(true);
      expect(registry.size).toBe(0);
    });

    it('should return error for non-existent tool', () => {
      const registry = new ToolRegistry();
      const result = registry.unregister('non_existent');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });

    it('should prevent unregistering tools with dependencies', () => {
      const registry = new ToolRegistry();

      const baseTool: ToolDefinition = {
        name: 'base_tool',
        description: 'Base tool',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      };

      const dependentTool: ToolDefinition = {
        name: 'dependent_tool',
        description: 'Dependent tool',
        version: '1.0.0',
        category: 'custom',
        dependencies: ['base_tool'],
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      };

      registry.register(baseTool);
      registry.register(dependentTool);

      const result = registry.unregister('base_tool');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('depends on it');
    });

    it('should allow unregistering after dependent is removed', () => {
      const registry = new ToolRegistry();

      const baseTool: ToolDefinition = {
        name: 'base_tool',
        description: 'Base tool',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      };

      const dependentTool: ToolDefinition = {
        name: 'dependent_tool',
        description: 'Dependent tool',
        version: '1.0.0',
        category: 'custom',
        dependencies: ['base_tool'],
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      };

      registry.register(baseTool);
      registry.register(dependentTool);

      // Remove dependent first
      registry.unregister('dependent_tool');

      // Now base can be removed
      const result = registry.unregister('base_tool');
      expect(result.success).toBe(true);
    });
  });

  describe('get', () => {
    it('should get a registered tool', () => {
      const registry = new ToolRegistry();
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      };

      registry.register(tool);
      const retrieved = registry.get('test_tool');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test_tool');
      expect(retrieved?.description).toBe('A test tool');
    });

    it('should return undefined for non-existent tool', () => {
      const registry = new ToolRegistry();
      const retrieved = registry.get('non_existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list all tools', () => {
      const registry = new ToolRegistry();

      registry.register({
        name: 'tool1',
        description: 'Tool 1',
        version: '1.0.0',
        category: 'file',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      });

      registry.register({
        name: 'tool2',
        description: 'Tool 2',
        version: '1.0.0',
        category: 'command',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      });

      const tools = registry.list();
      expect(tools).toHaveLength(2);
    });

    it('should filter tools by category', () => {
      const registry = new ToolRegistry();

      registry.register({
        name: 'file_tool',
        description: 'File tool',
        version: '1.0.0',
        category: 'file',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      });

      registry.register({
        name: 'command_tool',
        description: 'Command tool',
        version: '1.0.0',
        category: 'command',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      });

      const fileTools = registry.list('file');
      expect(fileTools).toHaveLength(1);
      expect(fileTools[0].name).toBe('file_tool');
    });

    it('should return empty array for non-matching category', () => {
      const registry = new ToolRegistry();

      registry.register({
        name: 'file_tool',
        description: 'File tool',
        version: '1.0.0',
        category: 'file',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      });

      const analysisTools = registry.list('analysis');
      expect(analysisTools).toHaveLength(0);
    });
  });

  describe('execute', () => {
    it('should execute a registered tool', async () => {
      const registry = new ToolRegistry();
      const executeFn = vi.fn().mockResolvedValue({ success: true, output: 'test' });

      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        version: '1.0.0',
        category: 'custom',
        execute: executeFn,
        schema: { type: 'object', properties: {} }
      };

      registry.register(tool);
      const result = await registry.execute('test_tool', { input: 'test' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('test');
      expect(executeFn).toHaveBeenCalledWith({ input: 'test' });
    });

    it('should return error for non-existent tool', async () => {
      const registry = new ToolRegistry();
      const result = await registry.execute('non_existent', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });

    it('should handle tool execution errors', async () => {
      const registry = new ToolRegistry();
      const executeFn = vi.fn().mockRejectedValue(new Error('Execution failed'));

      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        version: '1.0.0',
        category: 'custom',
        execute: executeFn,
        schema: { type: 'object', properties: {} }
      };

      registry.register(tool);
      const result = await registry.execute('test_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Execution failed');
    });

    it('should handle non-Error exceptions', async () => {
      const registry = new ToolRegistry();
      const executeFn = vi.fn().mockRejectedValue('String error');

      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        version: '1.0.0',
        category: 'custom',
        execute: executeFn,
        schema: { type: 'object', properties: {} }
      };

      registry.register(tool);
      const result = await registry.execute('test_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });

  describe('toLLMTools', () => {
    it('should convert tools to LLM format', () => {
      const registry = new ToolRegistry();

      registry.register({
        name: 'test_tool',
        description: 'A test tool',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        }
      });

      const llmTools = registry.toLLMTools();

      expect(llmTools).toHaveLength(1);
      expect(llmTools[0].type).toBe('function');
      expect(llmTools[0].function.name).toBe('test_tool');
      expect(llmTools[0].function.description).toContain('A test tool');
      expect(llmTools[0].function.description).toContain('v1.0.0');
      expect(llmTools[0].function.parameters.properties).toHaveProperty('input');
    });

    it('should return empty array for empty registry', () => {
      const registry = new ToolRegistry();
      const llmTools = registry.toLLMTools();

      expect(llmTools).toHaveLength(0);
    });
  });

  describe('size', () => {
    it('should return correct tool count', () => {
      const registry = new ToolRegistry();

      expect(registry.size).toBe(0);

      registry.register({
        name: 'tool1',
        description: 'Tool 1',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      });

      expect(registry.size).toBe(1);

      registry.register({
        name: 'tool2',
        description: 'Tool 2',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      });

      expect(registry.size).toBe(2);

      registry.unregister('tool1');

      expect(registry.size).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all tools', () => {
      const registry = new ToolRegistry();

      registry.register({
        name: 'tool1',
        description: 'Tool 1',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      });

      registry.register({
        name: 'tool2',
        description: 'Tool 2',
        version: '1.0.0',
        category: 'custom',
        execute: async () => ({ success: true }),
        schema: { type: 'object', properties: {} }
      });

      expect(registry.size).toBe(2);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.list()).toHaveLength(0);
    });
  });
});
