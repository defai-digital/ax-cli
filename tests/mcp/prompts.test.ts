/**
 * Tests for MCP prompts module
 * Tests prompt parsing, formatting, and server interactions
 */
import { describe, it, expect, vi } from 'vitest';
import {
  parseMCPIdentifier,
  listServerPrompts,
  getServerPrompt,
  promptToSlashCommand,
  parsePromptCommand,
  formatPromptResult,
  getPromptDescription,
  type MCPPrompt,
} from '../../packages/core/src/mcp/prompts.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

describe('parseMCPIdentifier', () => {
  it('should parse valid identifier with prefix', () => {
    const result = parseMCPIdentifier('mcp__server__promptname', 'mcp__');
    expect(result).toEqual({ serverName: 'server', name: 'promptname' });
  });

  it('should parse identifier with slash prefix', () => {
    const result = parseMCPIdentifier('/mcp__server__promptname', '/mcp__');
    expect(result).toEqual({ serverName: 'server', name: 'promptname' });
  });

  it('should return null for wrong prefix', () => {
    const result = parseMCPIdentifier('wrong__server__name', 'mcp__');
    expect(result).toBeNull();
  });

  it('should return null for missing separator', () => {
    const result = parseMCPIdentifier('mcp__server', 'mcp__');
    expect(result).toBeNull();
  });

  it('should return null for empty server name', () => {
    const result = parseMCPIdentifier('mcp____promptname', 'mcp__');
    expect(result).toBeNull();
  });

  it('should return null for empty prompt name', () => {
    const result = parseMCPIdentifier('mcp__server__', 'mcp__');
    expect(result).toBeNull();
  });

  it('should handle multiple underscores in prompt name', () => {
    const result = parseMCPIdentifier('mcp__server__prompt__with__parts', 'mcp__');
    expect(result).toEqual({ serverName: 'server', name: 'prompt__with__parts' });
  });

  it('should handle simple names without extra underscores', () => {
    const result = parseMCPIdentifier('/mcp__myserver__myprompt', '/mcp__');
    expect(result).toEqual({ serverName: 'myserver', name: 'myprompt' });
  });

  it('should handle server names with hyphens', () => {
    const result = parseMCPIdentifier('mcp__my-server__prompt', 'mcp__');
    expect(result).toEqual({ serverName: 'my-server', name: 'prompt' });
  });

  it('should return null for just prefix', () => {
    const result = parseMCPIdentifier('mcp__', 'mcp__');
    expect(result).toBeNull();
  });
});

describe('listServerPrompts', () => {
  it('should list prompts from server', async () => {
    const mockClient = {
      listPrompts: vi.fn().mockResolvedValue({
        prompts: [
          { name: 'prompt1', description: 'First prompt' },
          { name: 'prompt2', description: 'Second prompt', arguments: [{ name: 'arg1', required: true }] },
        ],
      }),
    } as unknown as Client;

    const result = await listServerPrompts(mockClient, 'test-server');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      serverName: 'test-server',
      name: 'prompt1',
      description: 'First prompt',
      arguments: undefined,
    });
    expect(result[1]).toEqual({
      serverName: 'test-server',
      name: 'prompt2',
      description: 'Second prompt',
      arguments: [{ name: 'arg1', required: true }],
    });
  });

  it('should return empty array when server does not support prompts', async () => {
    const mockClient = {
      listPrompts: vi.fn().mockRejectedValue(new Error('Method not found')),
    } as unknown as Client;

    const result = await listServerPrompts(mockClient, 'test-server');

    expect(result).toEqual([]);
  });

  it('should return empty array for empty prompts list', async () => {
    const mockClient = {
      listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
    } as unknown as Client;

    const result = await listServerPrompts(mockClient, 'test-server');

    expect(result).toEqual([]);
  });

  it('should include all prompt fields', async () => {
    const mockClient = {
      listPrompts: vi.fn().mockResolvedValue({
        prompts: [
          {
            name: 'complex-prompt',
            description: 'A complex prompt',
            arguments: [
              { name: 'arg1', description: 'First arg', required: true },
              { name: 'arg2', description: 'Second arg', required: false },
            ],
          },
        ],
      }),
    } as unknown as Client;

    const result = await listServerPrompts(mockClient, 'my-server');

    expect(result[0].arguments).toHaveLength(2);
    expect(result[0].arguments![0].required).toBe(true);
    expect(result[0].arguments![1].required).toBe(false);
  });
});

describe('getServerPrompt', () => {
  it('should get prompt from server', async () => {
    const mockResult: GetPromptResult = {
      messages: [{ role: 'user', content: { type: 'text', text: 'Hello' } }],
    };
    const mockClient = {
      getPrompt: vi.fn().mockResolvedValue(mockResult),
    } as unknown as Client;

    const result = await getServerPrompt(mockClient, 'server', 'prompt-name');

    expect(result).toEqual(mockResult);
    expect(mockClient.getPrompt).toHaveBeenCalledWith({ name: 'prompt-name', arguments: undefined });
  });

  it('should pass arguments to getPrompt', async () => {
    const mockResult: GetPromptResult = {
      messages: [{ role: 'user', content: { type: 'text', text: 'Generated' } }],
    };
    const mockClient = {
      getPrompt: vi.fn().mockResolvedValue(mockResult),
    } as unknown as Client;

    const args = { name: 'John', age: '30' };
    await getServerPrompt(mockClient, 'server', 'greet', args);

    expect(mockClient.getPrompt).toHaveBeenCalledWith({ name: 'greet', arguments: args });
  });

  it('should return null on error', async () => {
    const mockClient = {
      getPrompt: vi.fn().mockRejectedValue(new Error('Not found')),
    } as unknown as Client;

    const result = await getServerPrompt(mockClient, 'server', 'nonexistent');

    expect(result).toBeNull();
  });
});

describe('promptToSlashCommand', () => {
  it('should convert prompt to slash command', () => {
    const prompt: MCPPrompt = {
      serverName: 'myserver',
      name: 'myprompt',
    };
    const result = promptToSlashCommand(prompt);
    expect(result).toBe('/mcp__myserver__myprompt');
  });

  it('should handle server names with hyphens', () => {
    const prompt: MCPPrompt = {
      serverName: 'my-server',
      name: 'my-prompt',
    };
    const result = promptToSlashCommand(prompt);
    expect(result).toBe('/mcp__my-server__my-prompt');
  });

  it('should handle underscores in name', () => {
    const prompt: MCPPrompt = {
      serverName: 'server',
      name: 'prompt_with_underscores',
    };
    const result = promptToSlashCommand(prompt);
    expect(result).toBe('/mcp__server__prompt_with_underscores');
  });
});

describe('parsePromptCommand', () => {
  it('should parse valid slash command', () => {
    const result = parsePromptCommand('/mcp__server__promptname');
    expect(result).toEqual({ serverName: 'server', promptName: 'promptname' });
  });

  it('should return null for invalid command', () => {
    const result = parsePromptCommand('/other__command');
    expect(result).toBeNull();
  });

  it('should return null for command without server', () => {
    const result = parsePromptCommand('/mcp__prompt');
    expect(result).toBeNull();
  });

  it('should handle underscores in prompt name', () => {
    const result = parsePromptCommand('/mcp__server__complex__prompt__name');
    expect(result).toEqual({ serverName: 'server', promptName: 'complex__prompt__name' });
  });

  it('should return null for empty string', () => {
    const result = parsePromptCommand('');
    expect(result).toBeNull();
  });

  it('should return null for command without prefix', () => {
    const result = parsePromptCommand('mcp__server__prompt');
    expect(result).toBeNull();
  });
});

describe('formatPromptResult', () => {
  it('should format single text message', () => {
    const result: GetPromptResult = {
      messages: [{ role: 'user', content: { type: 'text', text: 'Hello world' } }],
    };
    const formatted = formatPromptResult(result);
    expect(formatted).toBe('Hello world');
  });

  it('should format multiple messages', () => {
    const result: GetPromptResult = {
      messages: [
        { role: 'user', content: { type: 'text', text: 'First message' } },
        { role: 'assistant', content: { type: 'text', text: 'Second message' } },
      ],
    };
    const formatted = formatPromptResult(result);
    expect(formatted).toBe('First message\n\nSecond message');
  });

  it('should handle empty messages array', () => {
    const result: GetPromptResult = {
      messages: [],
      description: 'Fallback description',
    };
    const formatted = formatPromptResult(result);
    expect(formatted).toBe('Fallback description');
  });

  it('should return default when no messages and no description', () => {
    const result: GetPromptResult = {
      messages: [],
    };
    const formatted = formatPromptResult(result);
    expect(formatted).toBe('No prompt content available');
  });

  it('should handle string content directly', () => {
    const result: GetPromptResult = {
      messages: [{ role: 'user', content: 'Direct string content' as unknown }],
    } as GetPromptResult;
    const formatted = formatPromptResult(result);
    expect(formatted).toBe('Direct string content');
  });

  it('should handle array content', () => {
    const result: GetPromptResult = {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: 'Part 2' },
          ],
        },
      ],
    } as unknown as GetPromptResult;
    const formatted = formatPromptResult(result);
    expect(formatted).toBe('Part 1\nPart 2');
  });

  it('should JSON stringify non-text content', () => {
    const result: GetPromptResult = {
      messages: [{ role: 'user', content: { type: 'image', data: 'base64' } as unknown }],
    } as GetPromptResult;
    const formatted = formatPromptResult(result);
    expect(formatted).toContain('"type":"image"');
    expect(formatted).toContain('"data":"base64"');
  });

  it('should handle content with non-string text', () => {
    const result: GetPromptResult = {
      messages: [{ role: 'user', content: { type: 'text', text: { nested: 'object' } } as unknown }],
    } as GetPromptResult;
    const formatted = formatPromptResult(result);
    expect(formatted).toContain('nested');
  });

  it('should handle undefined messages', () => {
    const result = {} as GetPromptResult;
    const formatted = formatPromptResult(result);
    expect(formatted).toBe('No prompt content available');
  });
});

describe('getPromptDescription', () => {
  it('should return description from prompt', () => {
    const prompt: MCPPrompt = {
      serverName: 'server',
      name: 'prompt',
      description: 'Custom description',
    };
    const result = getPromptDescription(prompt);
    expect(result).toBe('Custom description');
  });

  it('should use default description when not provided', () => {
    const prompt: MCPPrompt = {
      serverName: 'myserver',
      name: 'prompt',
    };
    const result = getPromptDescription(prompt);
    expect(result).toBe('MCP prompt from myserver');
  });

  it('should include required arguments', () => {
    const prompt: MCPPrompt = {
      serverName: 'server',
      name: 'prompt',
      description: 'A prompt',
      arguments: [
        { name: 'name', required: true },
        { name: 'age', required: true },
      ],
    };
    const result = getPromptDescription(prompt);
    expect(result).toBe('A prompt (name, age)');
  });

  it('should show optional arguments in brackets', () => {
    const prompt: MCPPrompt = {
      serverName: 'server',
      name: 'prompt',
      description: 'A prompt',
      arguments: [
        { name: 'required', required: true },
        { name: 'optional', required: false },
      ],
    };
    const result = getPromptDescription(prompt);
    expect(result).toBe('A prompt (required, [optional])');
  });

  it('should handle all optional arguments', () => {
    const prompt: MCPPrompt = {
      serverName: 'server',
      name: 'prompt',
      description: 'A prompt',
      arguments: [
        { name: 'opt1', required: false },
        { name: 'opt2' }, // undefined required treated as optional
      ],
    };
    const result = getPromptDescription(prompt);
    expect(result).toBe('A prompt ([opt1], [opt2])');
  });

  it('should handle empty arguments array', () => {
    const prompt: MCPPrompt = {
      serverName: 'server',
      name: 'prompt',
      description: 'A prompt',
      arguments: [],
    };
    const result = getPromptDescription(prompt);
    expect(result).toBe('A prompt');
  });
});
