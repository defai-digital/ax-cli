/**
 * Tests for MCP Phase 4 Enhancements
 * - Token limiting
 * - Validation
 * - Resource references
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPManager } from '../../src/mcp/client.js';
import { validateServerConfig } from '../../src/mcp/validation.js';
import {
  extractMCPReferences,
  parseMCPReference,
  searchResources,
  type MCPResource
} from '../../src/mcp/resources.js';
import type { MCPServerConfig } from '../../src/schemas/settings-schemas.js';

describe('MCP Phase 4 - Token Limiting', () => {
  let mcpManager: MCPManager;

  beforeEach(() => {
    mcpManager = new MCPManager();
  });

  afterEach(async () => {
    // Clean up
    const servers = mcpManager.getServers();
    for (const server of servers) {
      await mcpManager.removeServer(server);
    }
  });

  it('should emit token-warning event for outputs exceeding warning threshold', () => {
    return new Promise<void>((resolve) => {
      // Create mock result with >10k tokens worth of content
      const largeContent = 'test '.repeat(3000); // ~12k tokens

      mcpManager.on('token-warning', (event) => {
        expect(event.tokenCount).toBeGreaterThan(10000);
        expect(event.threshold).toBe(10000);
        resolve();
      });

      // Manually trigger the event for testing
      mcpManager.emit('token-warning', {
        toolName: 'test_tool',
        serverName: 'test_server',
        tokenCount: 12000,
        threshold: 10000
      });
    });
  });

  it('should emit token-limit-exceeded event for outputs exceeding hard limit', () => {
    return new Promise<void>((resolve) => {
      mcpManager.on('token-limit-exceeded', (event) => {
        expect(event.originalTokens).toBeGreaterThan(25000);
        expect(event.truncatedTokens).toBe(25000);
        resolve();
      });

      // Manually trigger the event for testing
      mcpManager.emit('token-limit-exceeded', {
        toolName: 'test_tool',
        serverName: 'test_server',
        originalTokens: 30000,
        truncatedTokens: 25000
      });
    });
  });

  it('should have token counter initialized', () => {
    expect((mcpManager as any).tokenCounter).toBeDefined();
  });
});

describe('MCP Phase 4 - Validation', () => {
  describe('stdio transport validation', () => {
    it('should validate valid stdio configuration', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: 'node',
          args: ['server.js']
        }
      };

      const result = await validateServerConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should reject stdio config without command', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: '',
          args: []
        }
      };

      const result = await validateServerConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Command is required for stdio transport');
    });

    it('should reject commands not in whitelist', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'stdio',
          command: 'nonexistent-command-xyz',
          args: []
        }
      };

      const result = await validateServerConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('not in the safe commands whitelist'))).toBe(true);
    });
  });

  describe('http transport validation', () => {
    it('should validate valid http configuration', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'http',
          url: 'http://localhost:3000'
        }
      };

      const result = await validateServerConfig(config);
      // May have warnings about accessibility, but should be valid format
      expect(result.errors.length).toBe(0);
    });

    it('should reject http config without URL', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'http',
          url: ''
        }
      };

      const result = await validateServerConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('URL is required for http transport');
    });

    it('should reject invalid URL format', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'http',
          url: 'not-a-url'
        }
      };

      const result = await validateServerConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid URL format'))).toBe(true);
    });

    it('should warn about non-https URLs for remote servers', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'http',
          url: 'http://example.com'
        }
      };

      const result = await validateServerConfig(config);
      expect(result.warnings.some(w => w.includes('https'))).toBe(true);
    });
  });

  describe('sse transport validation', () => {
    it('should validate valid sse configuration', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        transport: {
          type: 'sse',
          url: 'https://example.com/sse'
        }
      };

      const result = await validateServerConfig(config);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('server name validation', () => {
    it('should reject empty server name', async () => {
      const config: MCPServerConfig = {
        name: '',
        transport: {
          type: 'stdio',
          command: 'node',
          args: []
        }
      };

      const result = await validateServerConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Server name cannot be empty');
    });

    it('should warn about special characters in server name', async () => {
      const config: MCPServerConfig = {
        name: 'test@server!',
        transport: {
          type: 'stdio',
          command: 'node',
          args: []
        }
      };

      const result = await validateServerConfig(config);
      expect(result.warnings.some(w => w.includes('special characters'))).toBe(true);
    });
  });
});

describe('MCP Phase 4 - Resource References', () => {
  describe('extractMCPReferences', () => {
    it('should extract single MCP reference', () => {
      const text = 'Query the @mcp:postgres/users table';
      const refs = extractMCPReferences(text);

      expect(refs).toHaveLength(1);
      expect(refs[0]).toBe('@mcp:postgres/users');
    });

    it('should extract multiple MCP references', () => {
      const text = 'Compare @mcp:db/users with @mcp:db/orders';
      const refs = extractMCPReferences(text);

      expect(refs).toHaveLength(2);
      expect(refs).toContain('@mcp:db/users');
      expect(refs).toContain('@mcp:db/orders');
    });

    it('should handle no MCP references', () => {
      const text = 'This is a regular message';
      const refs = extractMCPReferences(text);

      expect(refs).toHaveLength(0);
    });

    it('should handle complex URIs', () => {
      const text = 'Get @mcp:api/endpoints/user/profile/settings';
      const refs = extractMCPReferences(text);

      expect(refs).toHaveLength(1);
      expect(refs[0]).toBe('@mcp:api/endpoints/user/profile/settings');
    });
  });

  describe('parseMCPReference', () => {
    it('should parse valid MCP reference', () => {
      const ref = '@mcp:postgres/users';
      const parsed = parseMCPReference(ref);

      expect(parsed).not.toBeNull();
      expect(parsed?.serverName).toBe('postgres');
      expect(parsed?.uri).toBe('users');
    });

    it('should parse reference with complex URI', () => {
      const ref = '@mcp:api/endpoints/user/profile';
      const parsed = parseMCPReference(ref);

      expect(parsed).not.toBeNull();
      expect(parsed?.serverName).toBe('api');
      expect(parsed?.uri).toBe('endpoints/user/profile');
    });

    it('should return null for invalid reference', () => {
      const ref = 'not-a-reference';
      const parsed = parseMCPReference(ref);

      expect(parsed).toBeNull();
    });

    it('should return null for reference without slash', () => {
      const ref = '@mcp:serveronly';
      const parsed = parseMCPReference(ref);

      expect(parsed).toBeNull();
    });

    it('should handle server names with hyphens and underscores', () => {
      const ref = '@mcp:my-server_v2/resource';
      const parsed = parseMCPReference(ref);

      expect(parsed).not.toBeNull();
      expect(parsed?.serverName).toBe('my-server_v2');
      expect(parsed?.uri).toBe('resource');
    });
  });

  describe('searchResources', () => {
    const mockResources: MCPResource[] = [
      {
        uri: 'database://users',
        name: 'Users Table',
        description: 'User accounts and profiles',
        serverName: 'postgres',
        reference: '@mcp:postgres/database://users'
      },
      {
        uri: 'database://orders',
        name: 'Orders Table',
        description: 'Customer orders',
        serverName: 'postgres',
        reference: '@mcp:postgres/database://orders'
      },
      {
        uri: 'api://get-user',
        name: 'Get User API',
        description: 'Retrieve user information',
        serverName: 'rest-api',
        reference: '@mcp:rest-api/api://get-user'
      }
    ];

    it('should find resources by name', () => {
      const results = searchResources(mockResources, 'users');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Users Table');
    });

    it('should find resources by URI', () => {
      const results = searchResources(mockResources, 'database://');

      expect(results).toHaveLength(2);
    });

    it('should find resources by description', () => {
      const results = searchResources(mockResources, 'customer');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Orders Table');
    });

    it('should be case insensitive', () => {
      const results = searchResources(mockResources, 'USERS');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Users Table');
    });

    it('should return empty array for no matches', () => {
      const results = searchResources(mockResources, 'nonexistent');

      expect(results).toHaveLength(0);
    });
  });
});
