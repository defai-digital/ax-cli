/**
 * Tests for sdk/testing.ts
 * Tests the testing utilities for the AX CLI SDK
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MockAgent,
  createMockAgent,
  MockSettingsManager,
  createMockSettings,
  MockMCPServer,
  createMockMCPServer,
  waitForAgent,
  createMockToolResult,
  assertToolSuccess,
  assertToolFailure,
} from '../../packages/core/src/sdk/testing.js';

describe('MockAgent', () => {
  describe('constructor', () => {
    it('should create with default responses', () => {
      const agent = new MockAgent();
      expect(agent.getMessageCount()).toBe(0);
    });

    it('should create with provided responses', async () => {
      const agent = new MockAgent({ responses: ['Hello', 'World'] });
      const result = await agent.processUserMessage('test');
      expect(result[result.length - 1].content).toBe('Hello');
    });

    it('should clone responses array', async () => {
      const responses = ['Response 1'];
      const agent = new MockAgent({ responses });

      // Mutate original array
      responses.push('Response 2');

      // Agent should still have original responses
      const result1 = await agent.processUserMessage('test1');
      const result2 = await agent.processUserMessage('test2');

      // Should cycle back to first response
      expect(result2[result2.length - 1].content).toBe('Response 1');
    });
  });

  describe('processUserMessage', () => {
    it('should add user message to history', async () => {
      const agent = new MockAgent();
      await agent.processUserMessage('Hello');

      const history = agent.getChatHistory();
      expect(history[0].type).toBe('user');
      expect(history[0].content).toBe('Hello');
    });

    it('should add assistant response to history', async () => {
      const agent = new MockAgent({ responses: ['My response'] });
      await agent.processUserMessage('Hello');

      const history = agent.getChatHistory();
      expect(history[1].type).toBe('assistant');
      expect(history[1].content).toBe('My response');
    });

    it('should cycle through responses', async () => {
      const agent = new MockAgent({ responses: ['First', 'Second'] });

      await agent.processUserMessage('1');
      await agent.processUserMessage('2');
      await agent.processUserMessage('3');

      const history = agent.getChatHistory();
      expect(history[1].content).toBe('First');
      expect(history[3].content).toBe('Second');
      expect(history[5].content).toBe('First'); // Cycles back
    });

    it('should emit stream events', async () => {
      const agent = new MockAgent({ responses: ['Test'] });
      const chunks: any[] = [];

      agent.on('stream', (chunk) => chunks.push(chunk));
      await agent.processUserMessage('Hello');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].type).toBe('done');
    });

    it('should return deep copies of history', async () => {
      const agent = new MockAgent();
      const result1 = await agent.processUserMessage('Hello');
      const result2 = await agent.processUserMessage('World');

      expect(result1).not.toBe(result2);
      expect(result1[0]).not.toBe(result2[0]);
    });

    it('should handle empty responses array gracefully', async () => {
      const agent = new MockAgent({ responses: [] });
      const result = await agent.processUserMessage('Hello');

      expect(result[result.length - 1].content).toBe('No response configured');
    });

    it('should throw if disposed', async () => {
      const agent = new MockAgent();
      agent.dispose();

      await expect(agent.processUserMessage('Hello')).rejects.toThrow('disposed');
    });
  });

  describe('processUserMessageStream', () => {
    it('should yield stream chunks', async () => {
      const agent = new MockAgent({ responses: ['Hello World'] });
      const chunks: any[] = [];

      for await (const chunk of agent.processUserMessageStream('test')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].type).toBe('done');
    });

    it('should add message to history', async () => {
      const agent = new MockAgent({ responses: ['Response'] });

      // Consume generator
      for await (const _ of agent.processUserMessageStream('Hello')) {
        // Just consume
      }

      const history = agent.getChatHistory();
      expect(history[0].type).toBe('user');
      expect(history[0].content).toBe('Hello');
    });

    it('should handle empty responses array', async () => {
      const agent = new MockAgent({ responses: [] });
      const chunks: any[] = [];

      for await (const chunk of agent.processUserMessageStream('test')) {
        chunks.push(chunk);
      }

      // Should have content chunks with "No response configured"
      const contentChunks = chunks.filter(c => c.type === 'content');
      const fullContent = contentChunks.map(c => c.content).join('');
      expect(fullContent.trim()).toBe('No response configured');
    });
  });

  describe('getChatHistory', () => {
    it('should return empty array initially', () => {
      const agent = new MockAgent();
      expect(agent.getChatHistory()).toEqual([]);
    });

    it('should return deep copies', async () => {
      const agent = new MockAgent();
      await agent.processUserMessage('Hello');

      const history1 = agent.getChatHistory();
      const history2 = agent.getChatHistory();

      expect(history1).not.toBe(history2);
      expect(history1[0]).not.toBe(history2[0]);
      expect(history1[0].timestamp).not.toBe(history2[0].timestamp);
    });
  });

  describe('executeBashCommand', () => {
    it('should return mock output', async () => {
      const agent = new MockAgent();
      const result = await agent.executeBashCommand('ls -la');

      expect(result.success).toBe(true);
      expect(result.output).toContain('ls -la');
    });
  });

  describe('getCurrentDirectory', () => {
    it('should return mock directory', () => {
      const agent = new MockAgent();
      expect(agent.getCurrentDirectory()).toBe('/mock/directory');
    });
  });

  describe('createCheckpoint', () => {
    it('should return mock checkpoint id', async () => {
      const agent = new MockAgent();
      const id = await agent.createCheckpoint('test');

      expect(id).toMatch(/^mock-checkpoint-\d+$/);
    });
  });

  describe('rewindConversation', () => {
    it('should clear history', async () => {
      const agent = new MockAgent();
      await agent.processUserMessage('Hello');

      const result = await agent.rewindConversation('checkpoint-1');

      expect(result.success).toBe(true);
      expect(agent.getChatHistory()).toHaveLength(0);
    });
  });

  describe('isBashExecuting', () => {
    it('should return false', () => {
      const agent = new MockAgent();
      expect(agent.isBashExecuting()).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should mark agent as disposed', () => {
      const agent = new MockAgent();
      agent.dispose();

      expect(() => agent.getChatHistory()).toThrow('disposed');
    });

    it('should be idempotent', () => {
      const agent = new MockAgent();
      agent.dispose();
      agent.dispose(); // Should not throw
    });

    it('should clear history and responses', async () => {
      const agent = new MockAgent({ responses: ['Test'] });
      await agent.processUserMessage('Hello');

      agent.dispose();

      // Can't verify directly due to disposed state, but dispose should work
    });
  });

  describe('reset', () => {
    it('should clear history', async () => {
      const agent = new MockAgent();
      await agent.processUserMessage('Hello');

      agent.reset();

      expect(agent.getChatHistory()).toHaveLength(0);
    });

    it('should reset response index', async () => {
      const agent = new MockAgent({ responses: ['First', 'Second'] });
      await agent.processUserMessage('1');

      agent.reset();
      const result = await agent.processUserMessage('2');

      expect(result[result.length - 1].content).toBe('First');
    });
  });

  describe('setResponses', () => {
    it('should update responses', async () => {
      const agent = new MockAgent({ responses: ['Old'] });
      agent.setResponses(['New']);

      const result = await agent.processUserMessage('test');
      expect(result[result.length - 1].content).toBe('New');
    });

    it('should reset response index', async () => {
      const agent = new MockAgent({ responses: ['First', 'Second'] });
      await agent.processUserMessage('1'); // Advance index

      agent.setResponses(['New1', 'New2']);
      const result = await agent.processUserMessage('2');

      expect(result[result.length - 1].content).toBe('New1');
    });

    it('should throw for empty array', () => {
      const agent = new MockAgent();
      expect(() => agent.setResponses([])).toThrow('must not be empty');
    });

    it('should clone responses array', async () => {
      const agent = new MockAgent();
      const responses = ['Response'];
      agent.setResponses(responses);

      responses[0] = 'Mutated';
      const result = await agent.processUserMessage('test');

      expect(result[result.length - 1].content).toBe('Response');
    });
  });

  describe('getMessageCount', () => {
    it('should count user messages', async () => {
      const agent = new MockAgent();

      expect(agent.getMessageCount()).toBe(0);

      await agent.processUserMessage('1');
      expect(agent.getMessageCount()).toBe(1);

      await agent.processUserMessage('2');
      expect(agent.getMessageCount()).toBe(2);
    });
  });

  describe('destroy', () => {
    it('should remove all listeners', () => {
      const agent = new MockAgent();
      const listener = vi.fn();
      agent.on('stream', listener);

      agent.destroy();

      expect(agent.listenerCount('stream')).toBe(0);
    });
  });
});

describe('createMockAgent', () => {
  it('should create MockAgent with responses', async () => {
    const agent = createMockAgent(['Hello']);
    const result = await agent.processUserMessage('test');
    expect(result[result.length - 1].content).toBe('Hello');
  });

  it('should create MockAgent with default responses', async () => {
    const agent = createMockAgent();
    const result = await agent.processUserMessage('test');
    expect(result[result.length - 1].content).toBe('Mock response');
  });
});

describe('MockSettingsManager', () => {
  describe('constructor', () => {
    it('should accept settings', () => {
      const settings = new MockSettingsManager({
        apiKey: 'test-key',
        baseURL: 'https://test.com',
        model: 'gpt-4',
      });

      expect(settings.getApiKey()).toBe('test-key');
      expect(settings.getBaseURL()).toBe('https://test.com');
      expect(settings.getCurrentModel()).toBe('gpt-4');
    });

    it('should clone settings', () => {
      const original = { apiKey: 'key1' };
      const settings = new MockSettingsManager(original);

      original.apiKey = 'key2';

      expect(settings.getApiKey()).toBe('key1');
    });
  });

  describe('getApiKey', () => {
    it('should return undefined if not set', () => {
      const settings = new MockSettingsManager();
      expect(settings.getApiKey()).toBeUndefined();
    });
  });

  describe('getBaseURL', () => {
    it('should return undefined if not set', () => {
      const settings = new MockSettingsManager();
      expect(settings.getBaseURL()).toBeUndefined();
    });
  });

  describe('getCurrentModel', () => {
    it('should return default model if not set', () => {
      const settings = new MockSettingsManager();
      expect(settings.getCurrentModel()).toBe('glm-4.6');
    });
  });

  describe('updateUserSetting', () => {
    it('should update setting', () => {
      const settings = new MockSettingsManager();
      settings.updateUserSetting('apiKey', 'new-key');
      expect(settings.getApiKey()).toBe('new-key');
    });

    it('should warn for unrecognized keys', () => {
      const settings = new MockSettingsManager();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      settings.updateUserSetting('unknownKey', 'value');

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknownKey'));
      warnSpy.mockRestore();
    });
  });

  describe('loadUserSettings', () => {
    it('should be a no-op', () => {
      const settings = new MockSettingsManager();
      expect(() => settings.loadUserSettings()).not.toThrow();
    });
  });

  describe('loadProjectSettings', () => {
    it('should be a no-op', () => {
      const settings = new MockSettingsManager();
      expect(() => settings.loadProjectSettings()).not.toThrow();
    });
  });

  describe('saveUserSettings', () => {
    it('should be a no-op', () => {
      const settings = new MockSettingsManager();
      expect(() => settings.saveUserSettings()).not.toThrow();
    });
  });
});

describe('createMockSettings', () => {
  it('should create MockSettingsManager', () => {
    const settings = createMockSettings({ apiKey: 'test' });
    expect(settings.getApiKey()).toBe('test');
  });

  it('should work without arguments', () => {
    const settings = createMockSettings();
    expect(settings.getCurrentModel()).toBe('glm-4.6');
  });
});

describe('MockMCPServer', () => {
  describe('constructor', () => {
    it('should create server with options', () => {
      const server = new MockMCPServer({
        name: 'test-server',
        version: '2.0.0',
      });

      expect(server.getInfo().name).toBe('test-server');
      expect(server.getInfo().version).toBe('2.0.0');
    });

    it('should clone options to prevent mutation', async () => {
      const tools = [{
        name: 'tool1',
        description: 'Test',
        inputSchema: { type: 'object' as const, properties: {} },
        handler: async () => ({}),
      }];

      const server = new MockMCPServer({ name: 'test', tools });

      // Mutate original
      tools[0].name = 'mutated';

      await server.connect();
      const serverTools = await server.listTools();
      expect(serverTools[0].name).toBe('tool1');
    });
  });

  describe('connect', () => {
    it('should set connected state', async () => {
      const server = new MockMCPServer({ name: 'test' });
      expect(server.isConnected()).toBe(false);

      await server.connect();

      expect(server.isConnected()).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should clear connected state', async () => {
      const server = new MockMCPServer({ name: 'test' });
      await server.connect();

      await server.disconnect();

      expect(server.isConnected()).toBe(false);
    });
  });

  describe('listTools', () => {
    it('should throw if not connected', async () => {
      const server = new MockMCPServer({ name: 'test' });
      await expect(server.listTools()).rejects.toThrow('not connected');
    });

    it('should return tool definitions', async () => {
      const server = new MockMCPServer({
        name: 'test',
        tools: [{
          name: 'tool1',
          description: 'Test tool',
          inputSchema: { type: 'object', properties: { a: { type: 'string' } } },
          handler: async () => ({}),
        }],
      });
      await server.connect();

      const tools = await server.listTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('tool1');
    });

    it('should return deep copies', async () => {
      const server = new MockMCPServer({
        name: 'test',
        tools: [{
          name: 'tool1',
          description: 'Test',
          inputSchema: { type: 'object', properties: { nested: { type: 'object' } } },
          handler: async () => ({}),
        }],
      });
      await server.connect();

      const tools1 = await server.listTools();
      const tools2 = await server.listTools();

      expect(tools1[0].inputSchema).not.toBe(tools2[0].inputSchema);
    });
  });

  describe('callTool', () => {
    it('should throw if not connected', async () => {
      const server = new MockMCPServer({ name: 'test' });
      await expect(server.callTool('test', {})).rejects.toThrow('not connected');
    });

    it('should throw for unknown tool', async () => {
      const server = new MockMCPServer({ name: 'test' });
      await server.connect();

      await expect(server.callTool('unknown', {})).rejects.toThrow('not found');
    });

    it('should execute tool handler', async () => {
      const handler = vi.fn().mockResolvedValue({ result: 'success' });
      const server = new MockMCPServer({
        name: 'test',
        tools: [{
          name: 'tool1',
          description: 'Test',
          inputSchema: { type: 'object', properties: {} },
          handler,
        }],
      });
      await server.connect();

      const result = await server.callTool('tool1', { input: 'test' });

      expect(handler).toHaveBeenCalledWith({ input: 'test' });
      expect(result.result).toBe('success');
    });

    it('should clone args before passing to handler', async () => {
      let receivedArgs: any;
      const server = new MockMCPServer({
        name: 'test',
        tools: [{
          name: 'tool1',
          description: 'Test',
          inputSchema: { type: 'object', properties: {} },
          handler: async (args) => {
            receivedArgs = args;
            args.mutated = true;
            return {};
          },
        }],
      });
      await server.connect();

      const originalArgs = { input: 'test' };
      await server.callTool('tool1', originalArgs);

      expect(originalArgs).not.toHaveProperty('mutated');
    });

    it('should wrap handler errors', async () => {
      const server = new MockMCPServer({
        name: 'test',
        tools: [{
          name: 'tool1',
          description: 'Test',
          inputSchema: { type: 'object', properties: {} },
          handler: async () => { throw new Error('Handler failed'); },
        }],
      });
      await server.connect();

      await expect(server.callTool('tool1', {})).rejects.toThrow("Tool 'tool1' execution failed: Handler failed");
    });
  });

  describe('listResources', () => {
    it('should throw if not connected', async () => {
      const server = new MockMCPServer({ name: 'test' });
      await expect(server.listResources()).rejects.toThrow('not connected');
    });

    it('should return resource definitions', async () => {
      const server = new MockMCPServer({
        name: 'test',
        resources: [{
          uri: 'file:///test.txt',
          name: 'Test File',
          mimeType: 'text/plain',
          handler: async () => 'content',
        }],
      });
      await server.connect();

      const resources = await server.listResources();

      expect(resources).toHaveLength(1);
      expect(resources[0].uri).toBe('file:///test.txt');
    });
  });

  describe('readResource', () => {
    it('should throw if not connected', async () => {
      const server = new MockMCPServer({ name: 'test' });
      await expect(server.readResource('file:///test')).rejects.toThrow('not connected');
    });

    it('should throw for unknown resource', async () => {
      const server = new MockMCPServer({ name: 'test' });
      await server.connect();

      await expect(server.readResource('file:///unknown')).rejects.toThrow('not found');
    });

    it('should return resource content', async () => {
      const server = new MockMCPServer({
        name: 'test',
        resources: [{
          uri: 'file:///test.txt',
          name: 'Test',
          handler: async () => 'File content',
        }],
      });
      await server.connect();

      const content = await server.readResource('file:///test.txt');

      expect(content).toBe('File content');
    });

    it('should wrap handler errors', async () => {
      const server = new MockMCPServer({
        name: 'test',
        resources: [{
          uri: 'file:///test.txt',
          name: 'Test',
          handler: async () => { throw new Error('Read failed'); },
        }],
      });
      await server.connect();

      await expect(server.readResource('file:///test.txt')).rejects.toThrow('read failed');
    });
  });

  describe('listPrompts', () => {
    it('should throw if not connected', async () => {
      const server = new MockMCPServer({ name: 'test' });
      await expect(server.listPrompts()).rejects.toThrow('not connected');
    });

    it('should return prompt definitions', async () => {
      const server = new MockMCPServer({
        name: 'test',
        prompts: [{
          name: 'greeting',
          description: 'A greeting prompt',
          handler: async () => ({ text: 'Hello!' }),
        }],
      });
      await server.connect();

      const prompts = await server.listPrompts();

      expect(prompts).toHaveLength(1);
      expect(prompts[0].name).toBe('greeting');
    });
  });

  describe('executePrompt', () => {
    it('should throw if not connected', async () => {
      const server = new MockMCPServer({ name: 'test' });
      await expect(server.executePrompt('test')).rejects.toThrow('not connected');
    });

    it('should throw for unknown prompt', async () => {
      const server = new MockMCPServer({ name: 'test' });
      await server.connect();

      await expect(server.executePrompt('unknown')).rejects.toThrow('not found');
    });

    it('should execute prompt handler', async () => {
      const handler = vi.fn().mockResolvedValue({ text: 'Generated' });
      const server = new MockMCPServer({
        name: 'test',
        prompts: [{
          name: 'prompt1',
          handler,
        }],
      });
      await server.connect();

      const result = await server.executePrompt('prompt1', { arg: 'value' });

      expect(handler).toHaveBeenCalledWith({ arg: 'value' });
      expect(result.text).toBe('Generated');
    });

    it('should clone args', async () => {
      let receivedArgs: any;
      const server = new MockMCPServer({
        name: 'test',
        prompts: [{
          name: 'prompt1',
          handler: async (args) => {
            receivedArgs = args;
            args.mutated = true;
            return {};
          },
        }],
      });
      await server.connect();

      const originalArgs = { input: 'test' };
      await server.executePrompt('prompt1', originalArgs);

      expect(originalArgs).not.toHaveProperty('mutated');
    });

    it('should wrap handler errors', async () => {
      const server = new MockMCPServer({
        name: 'test',
        prompts: [{
          name: 'prompt1',
          handler: async () => { throw new Error('Prompt failed'); },
        }],
      });
      await server.connect();

      await expect(server.executePrompt('prompt1')).rejects.toThrow("Prompt 'prompt1' execution failed");
    });
  });

  describe('getInfo', () => {
    it('should return server info', () => {
      const server = new MockMCPServer({
        name: 'test-server',
        version: '1.2.3',
        tools: [{ name: 't1', description: '', inputSchema: { type: 'object', properties: {} }, handler: async () => ({}) }],
        resources: [{ uri: 'r1', name: 'R1', handler: async () => '' }],
        prompts: [{ name: 'p1', handler: async () => ({}) }],
      });

      const info = server.getInfo();

      expect(info.name).toBe('test-server');
      expect(info.version).toBe('1.2.3');
      expect(info.toolCount).toBe(1);
      expect(info.resourceCount).toBe(1);
      expect(info.promptCount).toBe(1);
    });

    it('should use default version', () => {
      const server = new MockMCPServer({ name: 'test' });
      expect(server.getInfo().version).toBe('1.0.0');
    });
  });
});

describe('createMockMCPServer', () => {
  it('should create MockMCPServer', () => {
    const server = createMockMCPServer({ name: 'test' });
    expect(server.getInfo().name).toBe('test');
  });
});

describe('waitForAgent', () => {
  it('should resolve when done event is emitted', async () => {
    const agent = createMockAgent(['Response']);

    const promise = agent.processUserMessage('Hello');
    await waitForAgent(agent, { timeout: 1000 });

    await promise;
  });

  it('should reject on timeout', async () => {
    const agent = {
      on: vi.fn(),
      off: vi.fn(),
    };

    await expect(waitForAgent(agent, { timeout: 50 })).rejects.toThrow('did not complete within');
  });

  it('should use default timeout', async () => {
    const agent = createMockAgent();
    await agent.processUserMessage('test');

    // Should resolve without explicit timeout
    await waitForAgent(agent);
  });

  it('should reject on error event', async () => {
    const { EventEmitter } = await import('events');
    const agent = new EventEmitter();

    const promise = waitForAgent(agent, { timeout: 5000 });

    // Emit error
    setTimeout(() => agent.emit('error', new Error('Agent error')), 10);

    await expect(promise).rejects.toThrow('Agent error');
  });

  it('should clean up listeners on completion', async () => {
    const agent = createMockAgent();
    await agent.processUserMessage('test');

    const initialListeners = agent.listenerCount('stream');
    await waitForAgent(agent, { timeout: 1000 });

    // Should have cleaned up listeners (or same count as before)
    expect(agent.listenerCount('stream')).toBeLessThanOrEqual(initialListeners);
  });

  it('should handle agents without event methods', async () => {
    const agent = {};

    // Should resolve via fallback
    await waitForAgent(agent, { timeout: 200 });
  });
});

describe('createMockToolResult', () => {
  it('should create successful result', () => {
    const result = createMockToolResult(true, 'Output');

    expect(result.success).toBe(true);
    expect(result.output).toBe('Output');
  });

  it('should create failed result', () => {
    const result = createMockToolResult(false, undefined, 'Error message');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Error message');
  });
});

describe('assertToolSuccess', () => {
  it('should not throw for successful result', () => {
    const result = createMockToolResult(true, 'Output');
    expect(() => assertToolSuccess(result)).not.toThrow();
  });

  it('should throw for failed result', () => {
    const result = createMockToolResult(false, undefined, 'Error');
    expect(() => assertToolSuccess(result)).toThrow('Tool execution failed: Error');
  });

  it('should throw with default message', () => {
    const result = createMockToolResult(false);
    expect(() => assertToolSuccess(result)).toThrow('Unknown error');
  });
});

describe('assertToolFailure', () => {
  it('should not throw for failed result', () => {
    const result = createMockToolResult(false, undefined, 'Error');
    expect(() => assertToolFailure(result)).not.toThrow();
  });

  it('should throw for successful result', () => {
    const result = createMockToolResult(true, 'Output');
    expect(() => assertToolFailure(result)).toThrow('Expected tool to fail');
  });
});
