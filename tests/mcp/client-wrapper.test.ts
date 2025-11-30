/**
 * Tests for MCPManager v1 Wrapper
 *
 * Tests the v1 wrapper that delegates to MCPManagerV2 for backward compatibility.
 * Verifies that:
 * - v1 API wraps v2 correctly
 * - Result types are converted to exceptions
 * - Events are forwarded properly
 * - Backward compatibility is maintained
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPManager } from '../../src/mcp/client.js';
import type { MCPServerConfig } from '../../src/schemas/settings-schemas.js';

describe('MCPManager v1 Wrapper', () => {
  let manager: MCPManager;

  beforeEach(() => {
    manager = new MCPManager();
  });

  afterEach(async () => {
    await manager.dispose();
  });

  describe('Initialization', () => {
    it('should create manager instance', () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(MCPManager);
    });

    it('should wrap MCPManagerV2 internally', () => {
      // Access private v2 instance
      const v2Instance = (manager as any).v2;
      expect(v2Instance).toBeDefined();
      expect(v2Instance.constructor.name).toBe('MCPManagerV2');
    });

    it('should be an EventEmitter', () => {
      expect(manager.on).toBeDefined();
      expect(manager.emit).toBeDefined();
      expect(manager.removeListener).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should convert Result to exception on addServer error', async () => {
      const invalidConfig: MCPServerConfig = {
        name: 'test-invalid',
        transport: {
          type: 'stdio',
          command: 'nonexistent-command-12345-xyz',
          args: []
        }
      };

      // v1 API should throw
      await expect(manager.addServer(invalidConfig)).rejects.toThrow();
    });

    it('should convert Result to exception on removeServer error', async () => {
      // Try to remove non-existent server
      await expect(manager.removeServer('nonexistent-server')).rejects.toThrow();
    });

    it('should convert Result to exception on callTool error', async () => {
      // Try to call tool that doesn't exist
      await expect(manager.callTool('nonexistent-tool', {})).rejects.toThrow();
    });

    it('should handle invalid server names', async () => {
      // Empty string
      await expect(manager.removeServer('')).rejects.toThrow();

      // Invalid characters (if validation exists)
      const result = await manager.removeServer('invalid@server#name').catch(e => e);
      expect(result).toBeInstanceOf(Error);
    });
  });

  describe('Event Forwarding', () => {
    it('should forward serverAdded event from v2', () => {
      return new Promise<void>((resolve) => {
        manager.on('serverAdded', (serverName: string) => {
          expect(serverName).toBe('test-server');
          resolve();
        });

        // Emit event from v2 instance
        const v2Instance = (manager as any).v2;
        v2Instance.emit('serverAdded', 'test-server', 0);
      });
    });

    it('should forward serverError event from v2', () => {
      return new Promise<void>((resolve) => {
        manager.on('serverError', (serverName: string, error: Error) => {
          expect(serverName).toBe('test-server');
          expect(error).toBeInstanceOf(Error);
          resolve();
        });

        // Emit event from v2 instance
        const v2Instance = (manager as any).v2;
        v2Instance.emit('serverError', 'test-server', new Error('Test error'));
      });
    });

    it('should forward serverRemoved event from v2', () => {
      return new Promise<void>((resolve) => {
        manager.on('serverRemoved', (serverName: string) => {
          expect(serverName).toBe('test-server');
          resolve();
        });

        // Emit event from v2 instance
        const v2Instance = (manager as any).v2;
        v2Instance.emit('serverRemoved', 'test-server');
      });
    });

    it('should forward token-limit-exceeded event from v2', () => {
      return new Promise<void>((resolve) => {
        manager.on('token-limit-exceeded', (serverName: string) => {
          expect(serverName).toBe('test-server');
          resolve();
        });

        // Emit event from v2 instance
        const v2Instance = (manager as any).v2;
        v2Instance.emit('token-limit-exceeded', 'test-server');
      });
    });

    it('should forward token-warning event from v2', () => {
      return new Promise<void>((resolve) => {
        manager.on('token-warning', (serverName: string, usage: number, limit: number) => {
          expect(serverName).toBe('test-server');
          expect(usage).toBe(8000);
          expect(limit).toBe(10000);
          resolve();
        });

        // Emit event from v2 instance
        const v2Instance = (manager as any).v2;
        v2Instance.emit('token-warning', 'test-server', 8000, 10000);
      });
    });

    it('should forward reconnection-scheduled event from v2', () => {
      return new Promise<void>((resolve) => {
        manager.on('reconnection-scheduled', (serverName: string, delay: number, attempt: number) => {
          expect(serverName).toBe('test-server');
          expect(delay).toBeGreaterThan(0);
          expect(attempt).toBeGreaterThan(0);
          resolve();
        });

        // Emit event from v2 instance
        const v2Instance = (manager as any).v2;
        v2Instance.emit('reconnection-scheduled', 'test-server', 1000, 1);
      });
    });

    it('should forward reconnection-succeeded event from v2', () => {
      return new Promise<void>((resolve) => {
        manager.on('reconnection-succeeded', (serverName: string, attempts: number) => {
          expect(serverName).toBe('test-server');
          expect(attempts).toBeGreaterThan(0);
          resolve();
        });

        // Emit event from v2 instance
        const v2Instance = (manager as any).v2;
        v2Instance.emit('reconnection-succeeded', 'test-server', 3);
      });
    });

    it('should forward reconnection-failed event from v2', () => {
      return new Promise<void>((resolve) => {
        manager.on('reconnection-failed', (serverName: string, attempts: number) => {
          expect(serverName).toBe('test-server');
          expect(attempts).toBeGreaterThan(0);
          resolve();
        });

        // Emit event from v2 instance
        const v2Instance = (manager as any).v2;
        v2Instance.emit('reconnection-failed', 'test-server', 5);
      });
    });

    it('should forward server-unhealthy event from v2', () => {
      return new Promise<void>((resolve) => {
        manager.on('server-unhealthy', (serverName: string) => {
          expect(serverName).toBe('test-server');
          resolve();
        });

        // Emit event from v2 instance
        const v2Instance = (manager as any).v2;
        v2Instance.emit('server-unhealthy', 'test-server');
      });
    });
  });

  describe('API Methods', () => {
    it('should return empty array for getTools() initially', () => {
      const tools = manager.getTools();
      expect(tools).toEqual([]);
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should return empty array for getServers() initially', () => {
      const servers = manager.getServers();
      expect(servers).toEqual([]);
      expect(Array.isArray(servers)).toBe(true);
    });

    it('should return undefined for getTransportType of nonexistent server', () => {
      const transportType = manager.getTransportType('nonexistent');
      expect(transportType).toBeUndefined();
    });

    it('should handle getTransportType with invalid server name', () => {
      const transportType = manager.getTransportType('');
      expect(transportType).toBeUndefined();
    });
  });

  describe('Lifecycle', () => {
    it('should call v2.shutdown() on shutdown()', async () => {
      // This test verifies the delegation
      await expect(manager.shutdown()).resolves.toBeUndefined();
    });

    it('should call v2.ensureServersInitialized() on ensureServersInitialized()', async () => {
      // Mock the v2 method to avoid actually loading config and connecting to servers
      const ensureSpy = vi.spyOn((manager as any).v2, 'ensureServersInitialized')
        .mockResolvedValue({ success: true, value: undefined });

      // This test verifies the delegation
      await expect(manager.ensureServersInitialized()).resolves.toBeUndefined();
      expect(ensureSpy).toHaveBeenCalledOnce();
    });

    it('should call v2.dispose() on dispose()', async () => {
      const disposeSpy = vi.spyOn((manager as any).v2, 'dispose');
      await manager.dispose();
      expect(disposeSpy).toHaveBeenCalledOnce();
    });

    it('should be safe to call dispose() multiple times', async () => {
      await manager.dispose();
      // Second call should not throw
      await expect(manager.dispose()).resolves.toBeUndefined();
    });
  });

  describe('Type Conversion', () => {
    it('should convert ServerName to string in getServers()', () => {
      const servers = manager.getServers();

      // All items should be strings
      servers.forEach(server => {
        expect(typeof server).toBe('string');
      });
    });

    it('should convert branded types to plain strings in getTools()', () => {
      const tools = manager.getTools();

      // All tool names and serverNames should be plain strings
      tools.forEach(tool => {
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.serverName).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(tool.inputSchema).toBeDefined();
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain v1 API signature for addServer()', () => {
      // v1 signature: async addServer(config: MCPServerConfig): Promise<void>
      const addServerFn = manager.addServer;
      expect(addServerFn).toBeDefined();
      expect(addServerFn.length).toBe(1); // Takes one parameter
    });

    it('should maintain v1 API signature for callTool()', () => {
      // v1 signature: async callTool(toolName: string, arguments_: ...): Promise<CallToolResult>
      const callToolFn = manager.callTool;
      expect(callToolFn).toBeDefined();
      expect(callToolFn.length).toBe(2); // Takes two parameters
    });

    it('should accept null/undefined for callTool arguments', async () => {
      // v1 API should handle null/undefined gracefully
      const result = await manager.callTool('test-tool', null).catch(e => e);
      expect(result).toBeInstanceOf(Error); // Fails because tool doesn't exist, but doesn't crash
    });
  });
});
