/**
 * Tests for mcp/registry module
 * Tests MCP server registry search and config generation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

// Mock error-handler
vi.mock('../../packages/core/src/utils/error-handler.js', () => ({
  extractErrorMessage: vi.fn((error: unknown) => error instanceof Error ? error.message : String(error)),
}));

import {
  searchRegistry,
  getRegistryServer,
  getPopularServers,
  getServersByCategory,
  generateConfigFromRegistry,
  formatRegistryServer,
  type RegistryServer,
} from '../../packages/core/src/mcp/registry.js';

describe('searchRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search GitHub for MCP servers', async () => {
    const mockResponse = {
      data: {
        items: [
          {
            name: 'mcp-server-test',
            description: 'Test MCP server @test/mcp-server',
            html_url: 'https://github.com/owner/mcp-server-test',
            stargazers_count: 100,
            topics: ['mcp', 'design'],
            owner: { login: 'owner' },
            homepage: 'https://example.com',
          },
        ],
      },
    };
    vi.mocked(axios.get).mockResolvedValue(mockResponse);

    const results = await searchRegistry({ query: 'design' });

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.github.com/search/repositories',
      expect.objectContaining({
        params: expect.objectContaining({
          q: expect.stringContaining('mcp-server'),
        }),
      })
    );
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('test');
  });

  it('should sort by stars by default', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { items: [] } });

    await searchRegistry({});

    expect(axios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          sort: 'stars',
        }),
      })
    );
  });

  it('should support sorting by updated', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { items: [] } });

    await searchRegistry({ sortBy: 'updated' });

    expect(axios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          sort: 'updated',
        }),
      })
    );
  });

  it('should limit results', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { items: [] } });

    await searchRegistry({ limit: 10 });

    expect(axios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          per_page: 10,
        }),
      })
    );
  });

  it('should throw on rate limit error', async () => {
    const error = new Error('Rate limited');
    (error as any).response = { status: 403 };
    vi.mocked(axios.get).mockRejectedValue(error);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);

    await expect(searchRegistry({})).rejects.toThrow('rate limit');
  });

  it('should throw on general error', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));
    vi.mocked(axios.isAxiosError).mockReturnValue(false);

    await expect(searchRegistry({})).rejects.toThrow('Failed to search registry');
  });
});

describe('getRegistryServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search by package name when starting with @', async () => {
    const mockResponse = {
      data: {
        items: [
          {
            name: 'server-test',
            description: '@test/mcp-server package',
            html_url: 'https://github.com/modelcontextprotocol/server-test',
            stargazers_count: 50,
            topics: ['mcp'],
            owner: { login: 'modelcontextprotocol' },
          },
        ],
      },
    };
    vi.mocked(axios.get).mockResolvedValue(mockResponse);

    const server = await getRegistryServer('@modelcontextprotocol/server-test');

    // It will search and try to find by packageName
    expect(axios.get).toHaveBeenCalled();
  });

  it('should search by name', async () => {
    const mockResponse = {
      data: {
        items: [
          {
            name: 'test-server',
            description: 'A test server',
            html_url: 'https://github.com/owner/test-server',
            stargazers_count: 25,
            topics: [],
            owner: { login: 'owner' },
          },
        ],
      },
    };
    vi.mocked(axios.get).mockResolvedValue(mockResponse);

    await getRegistryServer('test-server');

    expect(axios.get).toHaveBeenCalled();
  });

  it('should return null when not found', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { items: [] } });

    const server = await getRegistryServer('nonexistent');

    expect(server).toBeNull();
  });
});

describe('getPopularServers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch popular servers sorted by stars', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { items: [] } });

    await getPopularServers();

    expect(axios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          sort: 'stars',
          per_page: 20,
        }),
      })
    );
  });
});

describe('getServersByCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include category in search query', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { items: [] } });

    await getServersByCategory('design');

    expect(axios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          q: expect.stringContaining('topic:design'),
        }),
      })
    );
  });
});

describe('generateConfigFromRegistry', () => {
  it('should generate stdio config for server with packageName', () => {
    const server: RegistryServer = {
      name: 'test-server',
      displayName: 'Test Server',
      description: 'A test server',
      repository: 'https://github.com/owner/test-server',
      stars: 100,
      category: 'other',
      transport: 'stdio',
      packageName: '@test/mcp-server',
      installCommand: 'npx @test/mcp-server',
      verified: false,
      author: 'owner',
    };

    const config = generateConfigFromRegistry(server);

    expect(config).not.toBeNull();
    expect(config?.name).toBe('test-server');
    expect(config?.transport.type).toBe('stdio');
    if (config?.transport.type === 'stdio') {
      expect(config.transport.command).toBe('npx');
      expect(config.transport.args).toEqual(['-y', '@test/mcp-server']);
    }
  });

  it('should return null for stdio server without packageName', () => {
    const server: RegistryServer = {
      name: 'test-server',
      displayName: 'Test Server',
      description: 'A test server',
      repository: 'https://github.com/owner/test-server',
      stars: 100,
      category: 'other',
      transport: 'stdio',
      installCommand: 'See repository',
      verified: false,
      author: 'owner',
    };

    const config = generateConfigFromRegistry(server);

    expect(config).toBeNull();
  });

  it('should generate http config with homepage URL', () => {
    const server: RegistryServer = {
      name: 'http-server',
      displayName: 'HTTP Server',
      description: 'An HTTP server',
      repository: 'https://github.com/owner/http-server',
      stars: 50,
      category: 'api',
      transport: 'http',
      installCommand: 'npm install',
      verified: false,
      author: 'owner',
      homepage: 'https://api.example.com/mcp',
    };

    const config = generateConfigFromRegistry(server);

    expect(config).not.toBeNull();
    expect(config?.transport.type).toBe('http');
    if (config?.transport.type === 'http') {
      expect(config.transport.url).toBe('https://api.example.com/mcp');
    }
  });

  it('should return null for http server with only repo URL as homepage', () => {
    const server: RegistryServer = {
      name: 'http-server',
      displayName: 'HTTP Server',
      description: 'An HTTP server',
      repository: 'https://github.com/owner/http-server',
      stars: 50,
      category: 'api',
      transport: 'http',
      installCommand: 'npm install',
      verified: false,
      author: 'owner',
      homepage: 'https://github.com/owner/http-server',
    };

    const config = generateConfigFromRegistry(server);

    expect(config).toBeNull();
  });

  it('should return null for http server without homepage', () => {
    const server: RegistryServer = {
      name: 'http-server',
      displayName: 'HTTP Server',
      description: 'An HTTP server',
      repository: 'https://github.com/owner/http-server',
      stars: 50,
      category: 'api',
      transport: 'http',
      installCommand: 'npm install',
      verified: false,
      author: 'owner',
    };

    const config = generateConfigFromRegistry(server);

    expect(config).toBeNull();
  });

  it('should generate sse config with homepage URL', () => {
    const server: RegistryServer = {
      name: 'sse-server',
      displayName: 'SSE Server',
      description: 'An SSE server',
      repository: 'https://github.com/owner/sse-server',
      stars: 30,
      category: 'api',
      transport: 'sse',
      installCommand: 'npm install',
      verified: false,
      author: 'owner',
      homepage: 'https://sse.example.com/events',
    };

    const config = generateConfigFromRegistry(server);

    expect(config).not.toBeNull();
    expect(config?.transport.type).toBe('sse');
  });
});

describe('formatRegistryServer', () => {
  const mockServer: RegistryServer = {
    name: 'test-server',
    displayName: 'Test Server',
    description: 'A test MCP server',
    repository: 'https://github.com/owner/test-server',
    stars: 100,
    category: 'design',
    transport: 'stdio',
    packageName: '@test/mcp-server',
    installCommand: 'npx @test/mcp-server',
    verified: true,
    author: 'owner',
  };

  it('should format server in compact mode', () => {
    const formatted = formatRegistryServer(mockServer, true);

    expect(formatted).toContain('Test Server');
    expect(formatted).toContain('✓');
    expect(formatted).toContain('⭐ 100');
    expect(formatted).toContain('A test MCP server');
  });

  it('should format server in full mode', () => {
    const formatted = formatRegistryServer(mockServer, false);

    expect(formatted).toContain('Test Server');
    expect(formatted).toContain('(verified)');
    expect(formatted).toContain('Description: A test MCP server');
    expect(formatted).toContain('Category: design');
    expect(formatted).toContain('Transport: stdio');
    expect(formatted).toContain('Stars: 100');
    expect(formatted).toContain('Repository: https://github.com/owner/test-server');
    expect(formatted).toContain('Package: @test/mcp-server');
    expect(formatted).toContain('Install: ax-cli mcp install test-server');
  });

  it('should not show verified badge for unverified server', () => {
    const unverifiedServer = { ...mockServer, verified: false };
    const formatted = formatRegistryServer(unverifiedServer, false);

    expect(formatted).not.toContain('(verified)');
  });

  it('should not show package line when packageName is missing', () => {
    const serverWithoutPackage = { ...mockServer, packageName: undefined };
    const formatted = formatRegistryServer(serverWithoutPackage, false);

    expect(formatted).not.toContain('Package:');
  });
});
