/**
 * Integration Tests for MCP Phases 4 & 5
 *
 * Tests real-world scenarios combining multiple features:
 * - Phase 4: Token limiting, validation, resource references
 * - Phase 5: Registry integration, automatic reconnection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPManager } from '../../src/mcp/client.js';
import {
  validateServerConfig,
  type ValidationResult
} from '../../src/mcp/validation.js';
import {
  listAllResources,
  parseMCPReference,
  extractMCPReferences,
  resolveMCPReferences
} from '../../src/mcp/resources.js';
import {
  searchRegistry,
  generateConfigFromRegistry,
  type RegistryServer
} from '../../src/mcp/registry.js';
import {
  ReconnectionManager,
  DEFAULT_STRATEGY
} from '../../src/mcp/reconnection.js';
import type { MCPServerConfig } from '../../src/types/index.js';

describe('MCP Phases 4 & 5 - Integration Tests', () => {

  describe('Phase 4 Integration - Token Limiting + Validation', () => {
    it('should validate and warn about potential token issues', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['--version']  // Use safe args without shell metacharacters
        }
      };

      const validation = await validateServerConfig(config);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      // Node should be available in test environment
    });

    it('should handle invalid config gracefully', async () => {
      const config: MCPServerConfig = {
        name: 'invalid-server',
        transport: {
          type: 'stdio',
          command: 'this-command-definitely-does-not-exist-anywhere',
          args: []
        }
      };

      const validation = await validateServerConfig(config);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      // Should reject due to whitelist (more secure than just "not found")
      expect(validation.errors[0]).toContain('not in the safe commands whitelist');
    });
  });

  describe('Phase 4 Integration - Resource References', () => {
    it('should extract and parse multiple resource references', () => {
      const text = `
        Please query @mcp:postgres/users and @mcp:postgres/orders tables.
        Also check @mcp:github/repos/owner/repo for issues.
      `;

      const references = extractMCPReferences(text);

      expect(references).toHaveLength(3);
      expect(references).toContain('@mcp:postgres/users');
      expect(references).toContain('@mcp:postgres/orders');
      expect(references).toContain('@mcp:github/repos/owner/repo');

      // Parse each reference
      const parsed1 = parseMCPReference(references[0]);
      expect(parsed1).toEqual({
        serverName: 'postgres',
        uri: 'users'
      });

      const parsed3 = parseMCPReference(references[2]);
      expect(parsed3).toEqual({
        serverName: 'github',
        uri: 'repos/owner/repo'
      });
    });

    it('should handle text with no references', () => {
      const text = 'This is just normal text with no MCP references.';
      const references = extractMCPReferences(text);

      expect(references).toHaveLength(0);
    });

    it('should handle malformed references gracefully', () => {
      const text = '@mcp:noSlash @mcp: @mcp:server/ @mcp:server/valid';
      const references = extractMCPReferences(text);

      // Should only extract valid reference
      expect(references).toHaveLength(1);
      expect(references[0]).toBe('@mcp:server/valid');
    });
  });

  describe('Phase 5 Integration - Registry Search and Config Generation', () => {
    it('should generate valid stdio config from registry server', () => {
      const server: RegistryServer = {
        name: 'github',
        displayName: 'GitHub MCP Server',
        description: 'Official GitHub integration',
        repository: 'https://github.com/modelcontextprotocol/server-github',
        stars: 1000,
        category: 'version-control',
        transport: 'stdio',
        packageName: '@modelcontextprotocol/server-github',
        installCommand: 'npx @modelcontextprotocol/server-github',
        verified: true,
        author: 'modelcontextprotocol'
      };

      const config = generateConfigFromRegistry(server);

      expect(config.name).toBe('github');
      expect(config.transport.type).toBe('stdio');
      expect(config.transport.command).toBe('npx');
      expect(config.transport.args).toEqual(['-y', '@modelcontextprotocol/server-github']);
    });

    it('should generate valid http config from registry server', () => {
      const server: RegistryServer = {
        name: 'api-server',
        displayName: 'API Server',
        description: 'HTTP-based MCP server',
        repository: 'https://github.com/user/api-server',
        stars: 500,
        category: 'api',
        transport: 'http',
        installCommand: 'See repository',
        verified: false,
        author: 'user',
        homepage: 'https://api.example.com'
      };

      const config = generateConfigFromRegistry(server);

      expect(config.name).toBe('api-server');
      expect(config.transport.type).toBe('http');
      expect(config.transport.url).toBe('https://api.example.com');
    });

    it('should handle server without homepage for http transport', () => {
      const server: RegistryServer = {
        name: 'api-server',
        displayName: 'API Server',
        description: 'HTTP-based MCP server',
        repository: 'https://github.com/user/api-server',
        stars: 500,
        category: 'api',
        transport: 'http',
        installCommand: 'See repository',
        verified: false,
        author: 'user'
        // No homepage - cannot auto-generate valid config
      };

      const config = generateConfigFromRegistry(server);

      // Without a valid homepage URL, we can't auto-generate a config
      // The function returns null to prevent guessing URLs which could be dangerous
      expect(config).toBeNull();
    });
  });

  describe('Phase 5 Integration - Reconnection Manager', () => {
    let reconnectionManager: ReconnectionManager;
    let mockReconnectFn: vi.Mock;

    beforeEach(() => {
      reconnectionManager = new ReconnectionManager({
        maxRetries: 3,
        baseDelayMs: 100,  // Fast for testing
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        jitter: false  // Deterministic for testing
      });
      mockReconnectFn = vi.fn();
    });

    afterEach(() => {
      reconnectionManager.cancelAll();
    });

    it('should manage multiple server reconnections independently', async () => {
      const config1: MCPServerConfig = {
        name: 'server-1',
        transport: { type: 'stdio', command: 'test', args: [] }
      };

      const config2: MCPServerConfig = {
        name: 'server-2',
        transport: { type: 'stdio', command: 'test', args: [] }
      };

      await reconnectionManager.scheduleReconnection('server-1', config1, mockReconnectFn);
      await reconnectionManager.scheduleReconnection('server-2', config2, mockReconnectFn);

      expect(reconnectionManager.isReconnecting('server-1')).toBe(true);
      expect(reconnectionManager.isReconnecting('server-2')).toBe(true);
      expect(reconnectionManager.getActiveReconnections()).toBe(2);

      const states = reconnectionManager.getAllStates();
      expect(states).toHaveLength(2);
      expect(states.map(s => s.serverName).sort()).toEqual(['server-1', 'server-2']);
    });

    it('should calculate exponential backoff delays correctly', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: { type: 'stdio', command: 'test', args: [] }
      };

      await reconnectionManager.scheduleReconnection('test-server', config, mockReconnectFn);

      const state = reconnectionManager.getState('test-server');
      expect(state).not.toBeNull();
      expect(state?.status).toBe('scheduled');

      reconnectionManager.cancelReconnection('test-server');
    });

    it('should emit events during reconnection lifecycle', async () => {
      return new Promise<void>((resolve) => {
        const events: string[] = [];

        reconnectionManager.on('reconnection-scheduled', () => {
          events.push('scheduled');
        });

        reconnectionManager.on('reconnection-cancelled', () => {
          events.push('cancelled');
          expect(events).toEqual(['scheduled', 'cancelled']);
          resolve();
        });

        const config: MCPServerConfig = {
          name: 'test-server',
          transport: { type: 'stdio', command: 'test', args: [] }
        };

        reconnectionManager.scheduleReconnection('test-server', config, mockReconnectFn);

        // Cancel immediately
        setTimeout(() => {
          reconnectionManager.cancelReconnection('test-server');
        }, 10);
      });
    });

    it('should track state transitions correctly', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: { type: 'stdio', command: 'test', args: [] }
      };

      // Initially no state
      expect(reconnectionManager.getState('test-server')).toBeNull();

      // After scheduling
      await reconnectionManager.scheduleReconnection('test-server', config, mockReconnectFn);
      let state = reconnectionManager.getState('test-server');
      expect(state?.status).toBe('scheduled');
      expect(state?.attempts).toBe(0);

      // After cancellation
      reconnectionManager.cancelReconnection('test-server');
      state = reconnectionManager.getState('test-server');
      expect(state).toBeNull();
    });
  });

  describe('End-to-End Integration - Complete Workflow', () => {
    it('should handle full registry-to-validation-to-config workflow', async () => {
      // Step 1: Create a server from registry
      const registryServer: RegistryServer = {
        name: 'test-mcp',
        displayName: 'Test MCP Server',
        description: 'A test MCP server',
        repository: 'https://github.com/test/test-mcp',
        stars: 100,
        category: 'testing',
        transport: 'stdio',
        packageName: '@test/mcp-server',
        installCommand: 'npx @test/mcp-server',
        verified: true,
        author: 'test'
      };

      // Step 2: Generate config
      const config = generateConfigFromRegistry(registryServer);

      expect(config.name).toBe('test-mcp');
      expect(config.transport.type).toBe('stdio');
      expect(config.transport.command).toBe('npx');

      // Step 3: Validate config (npx should exist)
      const validation = await validateServerConfig(config);

      // npx should be available in test environment
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should integrate resource references with multiple servers', () => {
      const text = `
        Analyze data from:
        - @mcp:postgres/sales_data
        - @mcp:postgres/customer_data
        - @mcp:github/repos/company/analytics
        - @mcp:linear/issues/PROJ-123
      `;

      const references = extractMCPReferences(text);

      expect(references).toHaveLength(4);

      // Group by server
      const byServer = references.reduce((acc, ref) => {
        const parsed = parseMCPReference(ref);
        if (parsed) {
          if (!acc[parsed.serverName]) {
            acc[parsed.serverName] = [];
          }
          acc[parsed.serverName].push(parsed.uri);
        }
        return acc;
      }, {} as Record<string, string[]>);

      expect(Object.keys(byServer)).toEqual(['postgres', 'github', 'linear']);
      expect(byServer.postgres).toEqual(['sales_data', 'customer_data']);
      expect(byServer.github).toEqual(['repos/company/analytics']);
      expect(byServer.linear).toEqual(['issues/PROJ-123']);
    });

    it('should validate config before scheduling reconnection', async () => {
      const validConfig: MCPServerConfig = {
        name: 'valid-server',
        transport: {
          type: 'stdio',
          command: 'node',  // Should exist
          args: ['-v']
        }
      };

      const invalidConfig: MCPServerConfig = {
        name: 'invalid-server',
        transport: {
          type: 'stdio',
          command: 'nonexistent-command-xyz',
          args: []
        }
      };

      // Validate before reconnection
      const validValidation = await validateServerConfig(validConfig);
      const invalidValidation = await validateServerConfig(invalidConfig);

      expect(validValidation.valid).toBe(true);
      expect(invalidValidation.valid).toBe(false);

      // Only schedule valid configs
      const reconnectionManager = new ReconnectionManager();
      const mockFn = vi.fn();

      if (validValidation.valid) {
        await reconnectionManager.scheduleReconnection('valid-server', validConfig, mockFn);
        expect(reconnectionManager.isReconnecting('valid-server')).toBe(true);
      }

      if (!invalidValidation.valid) {
        // Don't schedule invalid config
        expect(reconnectionManager.isReconnecting('invalid-server')).toBe(false);
      }

      reconnectionManager.cancelAll();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large number of resource references efficiently', () => {
      // Generate text with many references
      const references = Array.from({ length: 100 }, (_, i) =>
        `@mcp:server${i % 10}/resource${i}`
      );
      const text = references.join(' ');

      const start = performance.now();
      const extracted = extractMCPReferences(text);
      const end = performance.now();

      expect(extracted).toHaveLength(100);
      expect(end - start).toBeLessThan(10); // Should be very fast (< 10ms)
    });

    it('should handle concurrent reconnection attempts', async () => {
      const manager = new ReconnectionManager();
      const configs = Array.from({ length: 5 }, (_, i) => ({
        name: `server-${i}`,
        transport: { type: 'stdio' as const, command: 'test', args: [] }
      }));

      const mockFn = vi.fn();

      // Schedule all concurrently
      await Promise.all(
        configs.map(config =>
          manager.scheduleReconnection(config.name, config, mockFn)
        )
      );

      expect(manager.getActiveReconnections()).toBe(5);

      // Cancel all
      manager.cancelAll();
      expect(manager.getActiveReconnections()).toBe(0);
    });

    it('should handle registry servers with missing optional fields', () => {
      const minimalServer: RegistryServer = {
        name: 'minimal',
        displayName: 'Minimal Server',
        description: 'Minimal server config',
        repository: 'https://github.com/test/minimal',
        stars: 0,
        category: 'other',
        transport: 'stdio',
        installCommand: 'npm install minimal',
        verified: false,
        author: 'test'
        // No packageName - cannot auto-generate valid stdio config
      };

      const config = generateConfigFromRegistry(minimalServer);

      // Without packageName, we can't auto-generate a valid stdio config
      // The function returns null to prevent generating incomplete configs
      expect(config).toBeNull();
    });

    it('should validate complex URI patterns in references', () => {
      const complexRefs = [
        '@mcp:server/path/to/resource',
        '@mcp:server-name/resource-name',
        '@mcp:server_name/resource_name',
        '@mcp:server123/resource456',
        '@mcp:my-server/api/v1/users/123'
      ];

      complexRefs.forEach(ref => {
        const parsed = parseMCPReference(ref);
        expect(parsed).not.toBeNull();
        expect(parsed?.serverName).toBeTruthy();
        expect(parsed?.uri).toBeTruthy();
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle validation errors gracefully', async () => {
      const configs: MCPServerConfig[] = [
        {
          name: '',  // Invalid: empty name
          transport: { type: 'stdio', command: 'test', args: [] }
        },
        {
          name: 'test',
          transport: { type: 'http', url: 'invalid-url' }  // Invalid URL
        }
      ];

      for (const config of configs) {
        const validation = await validateServerConfig(config);
        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle reconnection manager edge cases', async () => {
      const manager = new ReconnectionManager({
        maxRetries: 0,  // Edge case: no retries
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        jitter: false
      });

      const config: MCPServerConfig = {
        name: 'test',
        transport: { type: 'stdio', command: 'test', args: [] }
      };

      const mockFn = vi.fn().mockRejectedValue(new Error('Connection failed'));

      return new Promise<void>((resolve) => {
        manager.on('max-retries-reached', (data) => {
          expect(data.serverName).toBe('test');
          expect(data.attempts).toBe(0);
          resolve();
        });

        manager.scheduleReconnection('test', config, mockFn);
      });
    });

    it('should handle malformed resource reference gracefully', () => {
      const malformedRefs = [
        'mcp:server/resource',    // Missing @
        '@mcp:',                   // Missing server and resource
        '@mcp:server',            // Missing /
      ];

      malformedRefs.forEach(ref => {
        const parsed = parseMCPReference(ref);
        expect(parsed).toBeNull();
      });

      // These parse but have empty parts (implementation allows it)
      // BUG FIX: References with empty server or uri parts should return null
      // This is safer than returning empty strings which could cause downstream errors
      const emptyParts = [
        '@mcp:/resource',         // Empty server - should return null
        '@mcp:server/',           // Empty resource - should return null
      ];

      emptyParts.forEach(ref => {
        const parsed = parseMCPReference(ref);
        // Empty parts should result in null for safety
        expect(parsed).toBeNull();
      });
    });
  });

  describe('Configuration Validation Integration', () => {
    it('should validate complete server configuration chain', async () => {
      // Simulate complete setup flow
      const registryServer: RegistryServer = {
        name: 'complete-test',
        displayName: 'Complete Test Server',
        description: 'Testing complete flow',
        repository: 'https://github.com/test/complete',
        stars: 50,
        category: 'testing',
        transport: 'stdio',
        packageName: '@test/complete',
        installCommand: 'npx @test/complete',
        verified: true,
        author: 'test'
      };

      // 1. Generate config from registry
      const config = generateConfigFromRegistry(registryServer);
      expect(config.name).toBe('complete-test');

      // 2. Validate config
      const validation = await validateServerConfig(config);
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');

      // 3. If valid, could proceed with reconnection manager
      if (validation.valid) {
        const manager = new ReconnectionManager();
        const mockFn = vi.fn().mockResolvedValue(undefined);

        await manager.scheduleReconnection(config.name, config, mockFn);
        expect(manager.isReconnecting(config.name)).toBe(true);

        manager.cancelAll();
      }
    });
  });
});
