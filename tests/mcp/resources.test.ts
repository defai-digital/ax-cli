/**
 * Tests for mcp/resources module
 * Tests MCP resource parsing, extraction, and searching
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock error-handler
vi.mock('../../packages/core/src/utils/error-handler.js', () => ({
  extractErrorMessage: vi.fn((error: unknown) => error instanceof Error ? error.message : String(error)),
}));

// Mock MCPManagerV2
vi.mock('../../packages/core/src/mcp/client-v2.js', () => ({
  MCPManagerV2: class MockMCPManagerV2 {},
  createServerName: vi.fn((name: string) => name ? name : null),
}));

import {
  parseMCPReference,
  extractMCPReferences,
  searchResources,
  listServerResources,
  getResourceContent,
  listAllResources,
  resolveMCPReferences,
  type MCPResource,
} from '../../packages/core/src/mcp/resources.js';
import { MCPManagerV2, createServerName } from '../../packages/core/src/mcp/client-v2.js';

describe('parseMCPReference', () => {
  it('should parse valid MCP reference', () => {
    const result = parseMCPReference('@mcp:myserver/database://users');

    expect(result).toEqual({
      serverName: 'myserver',
      uri: 'database://users',
    });
  });

  it('should parse reference with complex URI', () => {
    const result = parseMCPReference('@mcp:api-server/api://endpoints/get-user/123');

    expect(result).toEqual({
      serverName: 'api-server',
      uri: 'api://endpoints/get-user/123',
    });
  });

  it('should return null for non-MCP reference', () => {
    expect(parseMCPReference('@file:something')).toBeNull();
    expect(parseMCPReference('not-a-reference')).toBeNull();
    expect(parseMCPReference('')).toBeNull();
  });

  it('should return null for reference without slash', () => {
    expect(parseMCPReference('@mcp:server-only')).toBeNull();
  });

  it('should return null for empty server name', () => {
    expect(parseMCPReference('@mcp:/uri')).toBeNull();
  });

  it('should return null for empty URI', () => {
    expect(parseMCPReference('@mcp:server/')).toBeNull();
  });
});

describe('extractMCPReferences', () => {
  it('should extract single reference from text', () => {
    const text = 'Check out @mcp:db/users table for data.';
    const refs = extractMCPReferences(text);

    expect(refs).toEqual(['@mcp:db/users']);
  });

  it('should extract multiple references', () => {
    const text = 'Use @mcp:api/endpoint and @mcp:db/users together.';
    const refs = extractMCPReferences(text);

    expect(refs).toHaveLength(2);
    expect(refs).toContain('@mcp:api/endpoint');
    expect(refs).toContain('@mcp:db/users');
  });

  it('should return empty array for text without references', () => {
    const text = 'No references here.';
    const refs = extractMCPReferences(text);

    expect(refs).toEqual([]);
  });

  it('should exclude trailing punctuation', () => {
    const text = 'Check @mcp:db/users, and @mcp:api/data. Also @mcp:cache/key!';
    const refs = extractMCPReferences(text);

    expect(refs).toEqual(['@mcp:db/users', '@mcp:api/data', '@mcp:cache/key']);
  });

  it('should handle references at end of parentheses', () => {
    const text = '(see @mcp:db/info)';
    const refs = extractMCPReferences(text);

    expect(refs).toEqual(['@mcp:db/info']);
  });

  it('should handle hyphenated server names', () => {
    const text = '@mcp:my-server/resource';
    const refs = extractMCPReferences(text);

    expect(refs).toEqual(['@mcp:my-server/resource']);
  });

  it('should handle underscored server names', () => {
    const text = '@mcp:my_server/resource';
    const refs = extractMCPReferences(text);

    expect(refs).toEqual(['@mcp:my_server/resource']);
  });
});

describe('searchResources', () => {
  const mockResources: MCPResource[] = [
    {
      uri: 'database://users',
      name: 'Users Table',
      description: 'Contains user data',
      serverName: 'db-server',
      reference: '@mcp:db-server/database://users',
    },
    {
      uri: 'api://auth/login',
      name: 'Login Endpoint',
      description: 'Authentication API',
      serverName: 'api-server',
      reference: '@mcp:api-server/api://auth/login',
    },
    {
      uri: 'cache://session',
      name: 'Session Cache',
      serverName: 'cache-server',
      reference: '@mcp:cache-server/cache://session',
    },
  ];

  it('should find resources by name', () => {
    const results = searchResources(mockResources, 'Users');

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Users Table');
  });

  it('should find resources by URI', () => {
    const results = searchResources(mockResources, 'auth');

    expect(results).toHaveLength(1);
    expect(results[0].uri).toBe('api://auth/login');
  });

  it('should find resources by description', () => {
    const results = searchResources(mockResources, 'Authentication');

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Login Endpoint');
  });

  it('should be case-insensitive', () => {
    const results = searchResources(mockResources, 'DATABASE');

    expect(results).toHaveLength(1);
    expect(results[0].uri).toBe('database://users');
  });

  it('should return empty array for no matches', () => {
    const results = searchResources(mockResources, 'nonexistent');

    expect(results).toEqual([]);
  });

  it('should handle resources without description', () => {
    const results = searchResources(mockResources, 'Session');

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Session Cache');
  });
});

describe('listServerResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array for invalid server name', async () => {
    vi.mocked(createServerName).mockReturnValue(null);

    const mockManager = {
      listResources: vi.fn(),
    };

    const result = await listServerResources(mockManager as unknown as MCPManagerV2, '');

    expect(result).toEqual([]);
  });

  it('should return empty array when listResources fails', async () => {
    vi.mocked(createServerName).mockReturnValue('test-server');

    const mockManager = {
      listResources: vi.fn().mockResolvedValue({ success: false }),
    };

    // Need to mock the internal v2 property
    const mockV1Manager = {
      v2: mockManager,
    };

    const result = await listServerResources(mockV1Manager as unknown as MCPManagerV2, 'test-server');

    expect(result).toEqual([]);
  });

  it('should convert resources to correct format', async () => {
    vi.mocked(createServerName).mockReturnValue('db-server');

    const mockManager = {
      listResources: vi.fn().mockResolvedValue({
        success: true,
        value: [
          { uri: 'database://users', name: 'Users', description: 'User table', mimeType: 'text/plain' },
          { uri: 'database://posts' }, // No name, description, or mimeType
        ],
      }),
    };

    const mockV1Manager = {
      v2: mockManager,
    };

    const result = await listServerResources(mockV1Manager as unknown as MCPManagerV2, 'db-server');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      uri: 'database://users',
      name: 'Users',
      description: 'User table',
      mimeType: 'text/plain',
      serverName: 'db-server',
      reference: '@mcp:db-server/database://users',
    });
    expect(result[1].name).toBe('database://posts'); // Fallback to URI
  });
});

describe('getResourceContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw for invalid server name', async () => {
    vi.mocked(createServerName).mockReturnValue(null);

    const mockManager = {};

    await expect(
      getResourceContent(mockManager as unknown as MCPManagerV2, '', 'some://uri')
    ).rejects.toThrow('Invalid server name');
  });

  it('should throw when readResource fails', async () => {
    vi.mocked(createServerName).mockReturnValue('server');

    const mockManager = {
      readResource: vi.fn().mockResolvedValue({
        success: false,
        error: new Error('Read failed'),
      }),
    };

    const mockV1Manager = {
      v2: mockManager,
    };

    await expect(
      getResourceContent(mockV1Manager as unknown as MCPManagerV2, 'server', 'resource://uri')
    ).rejects.toThrow('Failed to read resource');
  });

  it('should return content when successful', async () => {
    vi.mocked(createServerName).mockReturnValue('server');

    const mockManager = {
      readResource: vi.fn().mockResolvedValue({
        success: true,
        value: 'Resource content here',
      }),
    };

    const mockV1Manager = {
      v2: mockManager,
    };

    const result = await getResourceContent(
      mockV1Manager as unknown as MCPManagerV2,
      'server',
      'resource://uri'
    );

    expect(result).toBe('Resource content here');
  });
});

describe('listAllResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should aggregate resources from all servers', async () => {
    vi.mocked(createServerName).mockImplementation((name: string) => name);

    const mockManager = {
      getServers: vi.fn().mockReturnValue(['server1', 'server2']),
      listResources: vi.fn()
        .mockResolvedValueOnce({
          success: true,
          value: [{ uri: 'res1', name: 'Resource 1' }],
        })
        .mockResolvedValueOnce({
          success: true,
          value: [{ uri: 'res2', name: 'Resource 2' }],
        }),
    };

    const mockV1Manager = {
      v2: mockManager,
    };

    const result = await listAllResources(mockV1Manager as unknown as MCPManagerV2);

    expect(result).toHaveLength(2);
  });

  it('should handle server errors gracefully', async () => {
    vi.mocked(createServerName).mockImplementation((name: string) => name);

    // Spy on console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mockManager = {
      getServers: vi.fn().mockReturnValue(['server1', 'failing-server']),
      listResources: vi.fn()
        .mockResolvedValueOnce({
          success: true,
          value: [{ uri: 'res1', name: 'Resource 1' }],
        })
        .mockRejectedValueOnce(new Error('Server error')),
    };

    const mockV1Manager = {
      v2: mockManager,
    };

    const result = await listAllResources(mockV1Manager as unknown as MCPManagerV2);

    expect(result).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe('resolveMCPReferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should replace references with content', async () => {
    vi.mocked(createServerName).mockImplementation((name: string) => name);

    const mockManager = {
      readResource: vi.fn().mockResolvedValue({
        success: true,
        value: 'User data here',
      }),
    };

    const mockV1Manager = {
      v2: mockManager,
    };

    const text = 'Check @mcp:db/users for info.';
    const result = await resolveMCPReferences(text, mockV1Manager as unknown as MCPManagerV2);

    expect(result).toContain('--- Resource: @mcp:db/users ---');
    expect(result).toContain('User data here');
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(createServerName).mockReturnValue(null);

    const mockManager = {};

    const text = 'Check @mcp:invalid/resource for info.';
    const result = await resolveMCPReferences(text, mockManager as unknown as MCPManagerV2);

    expect(result).toContain('[Error: Could not load resource @mcp:invalid/resource]');
  });

  it('should handle text without references', async () => {
    const mockManager = {};

    const text = 'No references here.';
    const result = await resolveMCPReferences(text, mockManager as unknown as MCPManagerV2);

    expect(result).toBe('No references here.');
  });
});
