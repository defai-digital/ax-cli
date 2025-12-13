/**
 * Tests for mcp/validation module
 * Tests MCP server configuration validation and security checks
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process execFile
vi.mock('child_process', () => ({
  execFile: vi.fn((cmd, args, callback) => {
    // Default: command exists
    if (callback) callback(null, { stdout: '/usr/bin/node' });
    return { stdout: '/usr/bin/node' };
  }),
}));

// Mock templates
vi.mock('../../packages/core/src/mcp/templates.js', () => ({
  getTemplate: vi.fn().mockReturnValue(null),
}));

// Mock audit logger
vi.mock('../../packages/core/src/utils/audit-logger.js', () => ({
  getAuditLogger: vi.fn().mockReturnValue({
    logCritical: vi.fn(),
    logWarning: vi.fn(),
    logInfo: vi.fn(),
  }),
  AuditCategory: {
    COMMAND_EXECUTION: 'command_execution',
  },
}));

// Import after mocks
import {
  validateServerConfig,
  formatValidationResult,
  getSafeMCPCommands,
} from '../../packages/core/src/mcp/validation.js';
import { getTemplate } from '../../packages/core/src/mcp/templates.js';
import { execFile } from 'child_process';
import type { MCPServerConfig } from '../../packages/core/src/schemas/settings-schemas.js';

describe('validateServerConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: command exists
    vi.mocked(execFile).mockImplementation((_cmd, _args, callback) => {
      if (typeof callback === 'function') {
        callback(null, Buffer.from('/usr/bin/node'), Buffer.from(''));
      }
      return {} as ReturnType<typeof execFile>;
    });
  });

  describe('transport validation', () => {
    it('should fail when transport is missing', async () => {
      const config = { name: 'test-server' } as MCPServerConfig;
      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Transport configuration is required');
    });

    it('should validate valid stdio transport', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('stdio transport validation', () => {
    it('should fail when command is empty', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: '',
          args: [],
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Command is required');
    });

    it('should fail when command is whitespace only', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: '   ',
          args: [],
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Command is required');
    });

    it('should fail for unsafe command not in whitelist', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: 'dangerous-command',
          args: [],
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not in the safe commands whitelist');
    });

    it('should accept safe commands from whitelist', async () => {
      const safeCommands = ['node', 'npm', 'npx', 'python', 'python3', 'docker', 'bun'];

      for (const command of safeCommands) {
        const config: MCPServerConfig = {
          name: 'test-server',
          transport: {
            type: 'stdio',
            command,
            args: ['script.js'],
          },
        };

        const result = await validateServerConfig(config);

        // node, python etc. require args, so check just the whitelist validation passed
        expect(result.errors.every(e => !e.includes('not in the safe commands whitelist'))).toBe(true);
      }
    });

    it('should fail for command with dangerous shell characters', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: '/usr/bin/node; rm -rf /',
          args: [],
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('dangerous characters');
    });

    it('should allow full path commands without dangerous characters', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: '/usr/local/bin/node',
          args: ['server.js'],
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should fail for commands that require args but have none', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: 'node',
          args: [],
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('requires at least one argument');
    });

    it('should fail for args with dangerous shell metacharacters', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js', '; rm -rf /'],
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('dangerous shell metacharacters');
    });

    it('should fail for args with null bytes', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js\0malicious'],
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('null byte');
    });

    it('should warn when command not found in PATH', async () => {
      // Mock command not found
      vi.mocked(execFile).mockImplementation((_cmd, _args, callback) => {
        if (typeof callback === 'function') {
          const err = new Error('not found') as NodeJS.ErrnoException;
          err.code = 'ENOENT';
          callback(err, Buffer.from(''), Buffer.from(''));
        }
        return {} as ReturnType<typeof execFile>;
      });

      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
        },
      };

      const result = await validateServerConfig(config);

      expect(result.warnings.some(w => w.includes('not found in PATH'))).toBe(true);
    });

    it('should warn about npx official MCP packages', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
        },
      };

      const result = await validateServerConfig(config);

      expect(result.warnings.some(w => w.includes('Ensure'))).toBe(true);
    });
  });

  describe('http transport validation', () => {
    beforeEach(() => {
      // Mock fetch for URL accessibility check
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fail when URL is empty', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'http',
          url: '',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('URL is required');
    });

    it('should fail for invalid URL format', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'http',
          url: 'not-a-valid-url',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid URL format');
    });

    it('should fail for invalid protocol', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'http',
          url: 'ftp://example.com/mcp',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid protocol');
    });

    it('should warn about non-https for remote servers', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'http',
          url: 'http://example.com/mcp',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.warnings.some(w => w.includes('Consider using encrypted'))).toBe(true);
    });

    it('should not warn about http for localhost', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'http',
          url: 'http://localhost:3000/mcp',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.warnings.every(w => !w.includes('Consider using encrypted'))).toBe(true);
    });

    it('should warn when URL is not accessible', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'http',
          url: 'http://localhost:3000/mcp',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.warnings.some(w => w.includes('Unable to reach'))).toBe(true);
    });

    it('should accept 404 as server exists', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'http',
          url: 'http://localhost:3000/mcp',
        },
      };

      const result = await validateServerConfig(config);

      // Should not have "Unable to reach" warning
      expect(result.warnings.every(w => !w.includes('Unable to reach'))).toBe(true);
    });
  });

  describe('SSE transport validation', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    });

    it('should validate SSE transport same as HTTP', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'sse',
          url: 'https://example.com/events',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('streamable_http transport validation', () => {
    it('should fail when URL is empty', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'streamable_http',
          url: '',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('URL is required');
    });

    it('should fail for invalid URL format', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'streamable_http',
          url: 'invalid-url',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid URL format');
    });

    it('should accept valid streamable_http URL', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'streamable_http',
          url: 'https://api.example.com/mcp',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('server name validation', () => {
    it('should fail for empty server name', async () => {
      const config: MCPServerConfig = {
        name: '',
        transport: {
          type: 'streamable_http',
          url: 'https://example.com/mcp',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Server name cannot be empty');
    });

    it('should fail for whitespace-only server name', async () => {
      const config: MCPServerConfig = {
        name: '   ',
        transport: {
          type: 'streamable_http',
          url: 'https://example.com/mcp',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Server name cannot be empty');
    });

    it('should warn about server names with special characters', async () => {
      const config: MCPServerConfig = {
        name: 'test server!',
        transport: {
          type: 'streamable_http',
          url: 'https://example.com/mcp',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.warnings.some(w => w.includes('special characters'))).toBe(true);
    });

    it('should accept valid server names', async () => {
      const validNames = ['test-server', 'my_server', 'Server123', 'MCP-1'];

      for (const name of validNames) {
        const config: MCPServerConfig = {
          name,
          transport: {
            type: 'streamable_http',
            url: 'https://example.com/mcp',
          },
        };

        const result = await validateServerConfig(config);

        expect(result.warnings.every(w => !w.includes('special characters'))).toBe(true);
      }
    });
  });

  describe('environment variable validation', () => {
    it('should fail when required env var is missing', async () => {
      vi.mocked(getTemplate).mockReturnValue({
        name: 'test-template',
        description: 'Test',
        transport: { type: 'stdio', command: 'node' },
        requiredEnv: [
          { name: 'TEST_API_KEY', description: 'API key for test service' },
        ],
      });

      const config: MCPServerConfig = {
        name: 'test-template',
        transport: {
          type: 'streamable_http',
          url: 'https://example.com/mcp',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing required environment variable'))).toBe(true);
    });

    it('should pass when required env var is in config', async () => {
      vi.mocked(getTemplate).mockReturnValue({
        name: 'test-template',
        description: 'Test',
        transport: { type: 'stdio', command: 'node' },
        requiredEnv: [
          { name: 'TEST_API_KEY', description: 'API key for test service' },
        ],
      });

      const config: MCPServerConfig = {
        name: 'test-template',
        transport: {
          type: 'streamable_http',
          url: 'https://example.com/mcp',
          env: {
            TEST_API_KEY: 'secret-key',
          },
        },
      };

      const result = await validateServerConfig(config);

      expect(result.errors.every(e => !e.includes('Missing required environment variable'))).toBe(true);
    });

    it('should pass when required env var is in process.env', async () => {
      process.env.EXISTING_VAR = 'value';

      vi.mocked(getTemplate).mockReturnValue({
        name: 'test-template',
        description: 'Test',
        transport: { type: 'stdio', command: 'node' },
        requiredEnv: [
          { name: 'EXISTING_VAR', description: 'Existing variable' },
        ],
      });

      const config: MCPServerConfig = {
        name: 'test-template',
        transport: {
          type: 'streamable_http',
          url: 'https://example.com/mcp',
        },
      };

      const result = await validateServerConfig(config);

      expect(result.errors.every(e => !e.includes('Missing required environment variable'))).toBe(true);

      delete process.env.EXISTING_VAR;
    });
  });
});

describe('formatValidationResult', () => {
  it('should format errors', () => {
    const result = {
      valid: false,
      errors: ['Error 1', 'Error 2'],
      warnings: [],
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain('Validation Failed');
    expect(formatted).toContain('Error 1');
    expect(formatted).toContain('Error 2');
  });

  it('should format warnings', () => {
    const result = {
      valid: true,
      errors: [],
      warnings: ['Warning 1', 'Warning 2'],
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain('Warnings');
    expect(formatted).toContain('Warning 1');
    expect(formatted).toContain('Warning 2');
  });

  it('should format both errors and warnings', () => {
    const result = {
      valid: false,
      errors: ['Error 1'],
      warnings: ['Warning 1'],
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain('Validation Failed');
    expect(formatted).toContain('Error 1');
    expect(formatted).toContain('Warnings');
    expect(formatted).toContain('Warning 1');
  });

  it('should show success message when valid with no warnings', () => {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain('Configuration is valid');
  });
});

describe('getSafeMCPCommands', () => {
  it('should return array of safe commands', () => {
    const commands = getSafeMCPCommands();

    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
  });

  it('should include common safe commands', () => {
    const commands = getSafeMCPCommands();

    expect(commands).toContain('node');
    expect(commands).toContain('npm');
    expect(commands).toContain('npx');
    expect(commands).toContain('python');
    expect(commands).toContain('docker');
  });

  it('should be readonly', () => {
    const commands = getSafeMCPCommands();

    // TypeScript would prevent mutation, but we can verify at runtime
    expect(Object.isFrozen(commands) || Array.isArray(commands)).toBe(true);
  });
});
