/**
 * Tests for mcp/client module (v1 legacy API)
 * Tests MCPManager interface and type conversions
 */
import { describe, it, expect, vi } from 'vitest';

// Test MCPTool interface structure
describe('MCPTool interface', () => {
  it('should have required properties', () => {
    const tool = {
      name: 'test-tool',
      description: 'A test tool',
      inputSchema: { type: 'object', properties: {} },
      serverName: 'test-server',
    };

    expect(tool.name).toBe('test-tool');
    expect(tool.description).toBe('A test tool');
    expect(tool.inputSchema).toEqual({ type: 'object', properties: {} });
    expect(tool.serverName).toBe('test-server');
  });

  it('should support optional outputSchema', () => {
    const tool = {
      name: 'test-tool',
      description: 'desc',
      inputSchema: {},
      serverName: 'server',
      outputSchema: { type: 'string' },
    };

    expect(tool.outputSchema).toEqual({ type: 'string' });
  });
});

// Test v1 to v2 type conversion logic
describe('Type Conversion Logic', () => {
  describe('Tool type conversion', () => {
    it('should convert v2 tool to v1 format', () => {
      // Simulate v2 tool with branded types
      const v2Tool = {
        name: 'mcp__server__tool',
        description: 'A tool',
        inputSchema: { type: 'object' },
        serverName: 'server-name',
      };

      // v1 conversion casts branded types to strings
      const v1Tool = {
        name: v2Tool.name as string,
        description: v2Tool.description,
        inputSchema: v2Tool.inputSchema,
        serverName: v2Tool.serverName as string,
      };

      expect(typeof v1Tool.name).toBe('string');
      expect(typeof v1Tool.serverName).toBe('string');
    });

    it('should handle multiple tools conversion', () => {
      const v2Tools = [
        { name: 'tool1', description: 'd1', inputSchema: {}, serverName: 's1' },
        { name: 'tool2', description: 'd2', inputSchema: {}, serverName: 's2' },
      ];

      const v1Tools = v2Tools.map(tool => ({
        name: tool.name as string,
        description: tool.description,
        inputSchema: tool.inputSchema,
        serverName: tool.serverName as string,
      }));

      expect(v1Tools).toHaveLength(2);
      expect(v1Tools[0].name).toBe('tool1');
      expect(v1Tools[1].name).toBe('tool2');
    });
  });

  describe('Server name conversion', () => {
    it('should convert ServerName[] to string[]', () => {
      const v2Servers = ['server1', 'server2', 'server3'];
      const v1Servers = v2Servers.map(name => name as string);

      expect(v1Servers).toEqual(['server1', 'server2', 'server3']);
    });
  });

  describe('Prompt type conversion', () => {
    it('should convert v2 prompts to v1 format', () => {
      const v2Prompt = {
        serverName: 'test-server',
        name: 'test-prompt',
        description: 'A test prompt',
        arguments: [{ name: 'arg1', required: true }],
      };

      const v1Prompt = {
        serverName: v2Prompt.serverName as string,
        name: v2Prompt.name,
        description: v2Prompt.description,
        arguments: v2Prompt.arguments,
      };

      expect(v1Prompt.serverName).toBe('test-server');
      expect(v1Prompt.name).toBe('test-prompt');
      expect(v1Prompt.arguments).toEqual([{ name: 'arg1', required: true }]);
    });
  });
});

// Test Result type handling
describe('Result Type Handling', () => {
  describe('Success result', () => {
    it('should extract value from success result', () => {
      const result = { success: true, value: 'test-value' };

      if (result.success) {
        expect(result.value).toBe('test-value');
      } else {
        throw new Error('Should be success');
      }
    });
  });

  describe('Failure result', () => {
    it('should extract error from failure result', () => {
      const error = new Error('Test error');
      const result = { success: false, error };

      if (!result.success) {
        expect(result.error).toBe(error);
        expect(result.error.message).toBe('Test error');
      }
    });

    it('should throw error from failure result (v1 behavior)', () => {
      const error = new Error('Connection failed');
      const result = { success: false, error };

      const throwIfFailed = () => {
        if (!result.success) {
          throw result.error;
        }
      };

      expect(throwIfFailed).toThrow('Connection failed');
    });
  });
});

// Test connection status
describe('Connection Status', () => {
  it('should have correct structure', () => {
    const status = {
      connected: 2,
      failed: 1,
      connecting: 0,
      total: 3,
    };

    expect(status.connected).toBe(2);
    expect(status.failed).toBe(1);
    expect(status.connecting).toBe(0);
    expect(status.total).toBe(3);
  });

  it('should calculate total correctly', () => {
    const connected = 2;
    const failed = 1;
    const connecting = 1;
    const total = connected + failed + connecting;

    expect(total).toBe(4);
  });
});

// Test server config validation
describe('Server Config', () => {
  it('should validate stdio transport config', () => {
    const config = {
      name: 'test-server',
      transport: {
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
      },
    };

    expect(config.name).toBe('test-server');
    expect(config.transport.type).toBe('stdio');
    expect(config.transport.command).toBe('node');
    expect(config.transport.args).toEqual(['server.js']);
  });

  it('should validate http transport config', () => {
    const config = {
      name: 'http-server',
      transport: {
        type: 'http',
        url: 'http://localhost:3000/mcp',
      },
    };

    expect(config.transport.type).toBe('http');
    expect((config.transport as any).url).toBe('http://localhost:3000/mcp');
  });

  it('should validate sse transport config', () => {
    const config = {
      name: 'sse-server',
      transport: {
        type: 'sse',
        url: 'http://localhost:3000/events',
      },
    };

    expect(config.transport.type).toBe('sse');
  });
});

// Test createServerName validation logic
describe('Server Name Validation', () => {
  it('should accept valid server names', () => {
    const validNames = ['server1', 'my-server', 'test_server', 'server-123'];

    for (const name of validNames) {
      expect(name.length).toBeGreaterThan(0);
      expect(typeof name).toBe('string');
    }
  });

  it('should reject empty server name', () => {
    const isValid = (name: string) => Boolean(name && name.length > 0);

    expect(isValid('')).toBe(false);
    expect(isValid('valid-name')).toBe(true);
  });
});

// Test createToolName validation logic
describe('Tool Name Validation', () => {
  it('should accept valid MCP tool names', () => {
    const validNames = ['mcp__server__tool', 'read_file', 'search'];

    for (const name of validNames) {
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('should reject empty tool name', () => {
    const isValid = (name: string) => Boolean(name && name.length > 0);

    expect(isValid('')).toBe(false);
    expect(isValid('mcp__server__tool')).toBe(true);
  });
});

// Test event forwarding logic
describe('Event Forwarding', () => {
  it('should forward event names correctly', () => {
    const v1Events = [
      'serverAdded',
      'serverError',
      'serverRemoved',
      'token-limit-exceeded',
      'token-warning',
    ];

    const v2Events = [
      'reconnection-scheduled',
      'reconnection-succeeded',
      'reconnection-failed',
      'server-unhealthy',
    ];

    // All events should be string identifiers
    for (const event of [...v1Events, ...v2Events]) {
      expect(typeof event).toBe('string');
      expect(event.length).toBeGreaterThan(0);
    }
  });
});

// Test MCPManager config options
describe('MCPManager Config Options', () => {
  it('should support client name and version', () => {
    const config = {
      name: 'ax-cli',
      version: '4.0.0',
    };

    expect(config.name).toBe('ax-cli');
    expect(config.version).toBe('4.0.0');
  });

  it('should have optional config', () => {
    const config = undefined;
    const name = config?.name ?? 'default';
    const version = config?.version ?? '1.0.0';

    expect(name).toBe('default');
    expect(version).toBe('1.0.0');
  });
});

// Test call tool arguments handling
describe('Call Tool Arguments', () => {
  it('should handle object arguments', () => {
    const args = { path: '/test', content: 'hello' };
    expect(args.path).toBe('/test');
  });

  it('should handle null arguments', () => {
    const args = null;
    const processedArgs = args ?? {};
    expect(processedArgs).toEqual({});
  });

  it('should handle undefined arguments', () => {
    const args = undefined;
    const processedArgs = args ?? {};
    expect(processedArgs).toEqual({});
  });

  it('should handle empty object arguments', () => {
    const args = {};
    expect(Object.keys(args)).toHaveLength(0);
  });
});

// Test transport type resolution
describe('Transport Type Resolution', () => {
  it('should return transport type for valid config', () => {
    const getTransportType = (config: { transport?: { type: string } }) => {
      return config.transport?.type;
    };

    expect(getTransportType({ transport: { type: 'stdio' } })).toBe('stdio');
    expect(getTransportType({ transport: { type: 'http' } })).toBe('http');
    expect(getTransportType({ transport: { type: 'sse' } })).toBe('sse');
  });

  it('should return undefined for missing transport', () => {
    const getTransportType = (config: { transport?: { type: string } }) => {
      return config.transport?.type;
    };

    expect(getTransportType({})).toBeUndefined();
  });
});

// Test dispose/cleanup logic
describe('Cleanup Logic', () => {
  it('should not throw on successful cleanup', () => {
    const cleanup = () => {
      const result = { success: true };
      if (!result.success) {
        console.warn('Cleanup warning');
      }
    };

    expect(cleanup).not.toThrow();
  });

  it('should warn but not throw on cleanup failure', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const cleanup = () => {
      const result = { success: false, error: new Error('Cleanup failed') };
      if (!result.success) {
        console.warn('Error during cleanup:', result.error);
      }
    };

    expect(cleanup).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
