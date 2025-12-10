/**
 * Tests for MCP Phase 5 Enhancements
 * - Registry integration
 * - Automatic reconnection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  extractPackageName,
  determineTransport,
  determineCategory,
  extractServerName,
  formatRegistryServer,
  generateConfigFromRegistry,
  type RegistryServer
} from '../../packages/core/src/mcp/registry.js';
import {
  ReconnectionManager,
  DEFAULT_STRATEGY,
  type ReconnectionStrategy
} from '../../packages/core/src/mcp/reconnection.js';

describe('MCP Phase 5 - Registry Integration', () => {
  describe('Server parsing utilities', () => {
    it('should extract server name from repository name', () => {
      expect(extractServerName('mcp-server-github')).toBe('github');
      expect(extractServerName('server-postgres')).toBe('postgres');
      expect(extractServerName('mcp-figma')).toBe('figma');
      expect(extractServerName('linear-integration')).toBe('linear-integration');
    });

    it('should determine transport from topics', () => {
      expect(determineTransport(['http', 'rest'])).toBe('http');
      expect(determineTransport(['sse', 'streaming'])).toBe('sse');
      expect(determineTransport(['stdio', 'cli'])).toBe('stdio');
      expect(determineTransport(['other'])).toBe('stdio'); // default
    });

    it('should determine category from topics', () => {
      expect(determineCategory(['design', 'figma'])).toBe('design');
      expect(determineCategory(['database', 'postgres'])).toBe('database');
      expect(determineCategory(['api', 'rest'])).toBe('api');
      expect(determineCategory(['deployment', 'vercel'])).toBe('deployment');
      expect(determineCategory(['unknown'])).toBe('other');
    });

    it('should extract package name from official repos', () => {
      const repo = {
        owner: { login: 'modelcontextprotocol' },
        name: 'server-github',
        description: 'GitHub MCP Server'
      };
      expect(extractPackageName(repo)).toBe('@modelcontextprotocol/server-github');
    });

    it('should extract package name from description', () => {
      const repo = {
        owner: { login: 'someuser' },
        name: 'my-server',
        description: 'My awesome server @myorg/mcp-server'
      };
      expect(extractPackageName(repo)).toBe('@myorg/mcp-server');
    });

    it('should return undefined for repos without package name', () => {
      const repo = {
        owner: { login: 'someuser' },
        name: 'my-server',
        description: 'No package name here'
      };
      expect(extractPackageName(repo)).toBeUndefined();
    });
  });

  describe('generateConfigFromRegistry', () => {
    it('should generate stdio config for npm packages', () => {
      const server: RegistryServer = {
        name: 'github',
        displayName: 'GitHub',
        description: 'GitHub integration',
        repository: 'https://github.com/modelcontextprotocol/server-github',
        stars: 100,
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

    it('should generate http config for http servers', () => {
      const server: RegistryServer = {
        name: 'api-server',
        displayName: 'API Server',
        description: 'API integration',
        repository: 'https://github.com/user/api-server',
        stars: 50,
        category: 'api',
        transport: 'http',
        installCommand: 'See repository',
        verified: false,
        author: 'user',
        homepage: 'https://api-server.com'
      };

      const config = generateConfigFromRegistry(server);

      expect(config.name).toBe('api-server');
      expect(config.transport.type).toBe('http');
      expect(config.transport.url).toBe('https://api-server.com');
    });
  });

  describe('formatRegistryServer', () => {
    const mockServer: RegistryServer = {
      name: 'github',
      displayName: 'GitHub',
      description: 'GitHub integration',
      repository: 'https://github.com/modelcontextprotocol/server-github',
      stars: 100,
      category: 'version-control',
      transport: 'stdio',
      packageName: '@modelcontextprotocol/server-github',
      installCommand: 'npx @modelcontextprotocol/server-github',
      verified: true,
      author: 'modelcontextprotocol'
    };

    it('should format server in compact mode', () => {
      const formatted = formatRegistryServer(mockServer, true);
      expect(formatted).toContain('GitHub');
      expect(formatted).toContain('✓');
      expect(formatted).toContain('100');
      expect(formatted).toContain('GitHub integration');
    });

    it('should format server in detailed mode', () => {
      const formatted = formatRegistryServer(mockServer, false);
      expect(formatted).toContain('GitHub');
      expect(formatted).toContain('verified');
      expect(formatted).toContain('version-control');
      expect(formatted).toContain('stdio');
      expect(formatted).toContain('100');
      expect(formatted).toContain('@modelcontextprotocol/server-github');
      expect(formatted).toContain('ax-cli mcp install github');
    });
  });
});

describe('MCP Phase 5 - Automatic Reconnection', () => {
  let reconnectionManager: ReconnectionManager;
  let mockReconnectFn: vi.Mock;

  beforeEach(() => {
    reconnectionManager = new ReconnectionManager();
    mockReconnectFn = vi.fn();
  });

  afterEach(() => {
    reconnectionManager.cancelAll();
  });

  describe('ReconnectionManager initialization', () => {
    it('should initialize with default strategy', () => {
      const strategy = reconnectionManager.getStrategy();
      expect(strategy.maxRetries).toBe(DEFAULT_STRATEGY.maxRetries);
      expect(strategy.baseDelayMs).toBe(DEFAULT_STRATEGY.baseDelayMs);
      expect(strategy.maxDelayMs).toBe(DEFAULT_STRATEGY.maxDelayMs);
      expect(strategy.backoffMultiplier).toBe(DEFAULT_STRATEGY.backoffMultiplier);
    });

    it('should accept custom strategy', () => {
      const customStrategy: ReconnectionStrategy = {
        maxRetries: 3,
        baseDelayMs: 500,
        maxDelayMs: 10000,
        backoffMultiplier: 1.5,
        jitter: false
      };

      const manager = new ReconnectionManager(customStrategy);
      const strategy = manager.getStrategy();

      expect(strategy.maxRetries).toBe(3);
      expect(strategy.baseDelayMs).toBe(500);
      expect(strategy.maxDelayMs).toBe(10000);
      expect(strategy.backoffMultiplier).toBe(1.5);
      expect(strategy.jitter).toBe(false);
    });
  });

  describe('Reconnection scheduling', () => {
    it('should schedule reconnection attempt', async () => {
      return new Promise<void>((resolve) => {
        reconnectionManager.on('reconnection-scheduled', (event) => {
          expect(event.serverName).toBe('test-server');
          expect(event.attempt).toBe(1);
          expect(event.delayMs).toBeGreaterThan(0);
          reconnectionManager.cancelReconnection('test-server');
          resolve();
        });

        const mockConfig = { name: 'test-server', transport: { type: 'stdio' as const, command: 'test', args: [] } };
        reconnectionManager.scheduleReconnection('test-server', mockConfig, mockReconnectFn);
      });
    });

    it('should not schedule if already reconnecting', async () => {
      const mockConfig = { name: 'test-server', transport: { type: 'stdio' as const, command: 'test', args: [] } };

      await reconnectionManager.scheduleReconnection('test-server', mockConfig, mockReconnectFn);
      const isReconnecting = reconnectionManager.isReconnecting('test-server');

      expect(isReconnecting).toBe(true);

      // Try to schedule again
      await reconnectionManager.scheduleReconnection('test-server', mockConfig, mockReconnectFn);

      // Should still only be one active reconnection
      expect(reconnectionManager.getActiveReconnections()).toBe(1);

      reconnectionManager.cancelReconnection('test-server');
    });

    it('should track reconnection state', async () => {
      const mockConfig = { name: 'test-server', transport: { type: 'stdio' as const, command: 'test', args: [] } };

      await reconnectionManager.scheduleReconnection('test-server', mockConfig, mockReconnectFn);

      const state = reconnectionManager.getState('test-server');

      expect(state).not.toBeNull();
      expect(state?.serverName).toBe('test-server');
      expect(state?.status).toBe('scheduled');
      expect(state?.attempts).toBe(0);
      expect(state?.nextAttempt).toBeGreaterThan(Date.now());

      reconnectionManager.cancelReconnection('test-server');
    });
  });

  describe('Reconnection cancellation', () => {
    it('should cancel reconnection for specific server', async () => {
      const mockConfig = { name: 'test-server', transport: { type: 'stdio' as const, command: 'test', args: [] } };

      await reconnectionManager.scheduleReconnection('test-server', mockConfig, mockReconnectFn);
      expect(reconnectionManager.isReconnecting('test-server')).toBe(true);

      reconnectionManager.cancelReconnection('test-server');
      expect(reconnectionManager.isReconnecting('test-server')).toBe(false);
    });

    it('should cancel all reconnections', async () => {
      const mockConfig1 = { name: 'server-1', transport: { type: 'stdio' as const, command: 'test', args: [] } };
      const mockConfig2 = { name: 'server-2', transport: { type: 'stdio' as const, command: 'test', args: [] } };

      await reconnectionManager.scheduleReconnection('server-1', mockConfig1, mockReconnectFn);
      await reconnectionManager.scheduleReconnection('server-2', mockConfig2, mockReconnectFn);

      expect(reconnectionManager.getActiveReconnections()).toBe(2);

      reconnectionManager.cancelAll();

      expect(reconnectionManager.getActiveReconnections()).toBe(0);
    });

    it('should emit cancellation event', () => {
      return new Promise<void>((resolve) => {
        reconnectionManager.on('reconnection-cancelled', (event) => {
          expect(event.serverName).toBe('test-server');
          resolve();
        });

        const mockConfig = { name: 'test-server', transport: { type: 'stdio' as const, command: 'test', args: [] } };
        reconnectionManager.scheduleReconnection('test-server', mockConfig, mockReconnectFn);
        reconnectionManager.cancelReconnection('test-server');
      });
    });
  });

  describe('Retry counter management', () => {
    it('should reset retry counter', () => {
      reconnectionManager.resetRetries('test-server');
      const state = reconnectionManager.getState('test-server');
      expect(state).toBeNull(); // No state until scheduled
    });
  });

  describe('State queries', () => {
    it('should return null for non-existent server', () => {
      const state = reconnectionManager.getState('nonexistent');
      expect(state).toBeNull();
    });

    it('should return all states', async () => {
      const mockConfig1 = { name: 'server-1', transport: { type: 'stdio' as const, command: 'test', args: [] } };
      const mockConfig2 = { name: 'server-2', transport: { type: 'stdio' as const, command: 'test', args: [] } };

      await reconnectionManager.scheduleReconnection('server-1', mockConfig1, mockReconnectFn);
      await reconnectionManager.scheduleReconnection('server-2', mockConfig2, mockReconnectFn);

      const states = reconnectionManager.getAllStates();

      expect(states).toHaveLength(2);
      expect(states.map(s => s.serverName)).toContain('server-1');
      expect(states.map(s => s.serverName)).toContain('server-2');

      reconnectionManager.cancelAll();
    });
  });

  describe('Strategy updates', () => {
    it('should update strategy', () => {
      reconnectionManager.setStrategy({ maxRetries: 10, baseDelayMs: 2000 });

      const strategy = reconnectionManager.getStrategy();

      expect(strategy.maxRetries).toBe(10);
      expect(strategy.baseDelayMs).toBe(2000);
      // Other values should remain from default
      expect(strategy.maxDelayMs).toBe(DEFAULT_STRATEGY.maxDelayMs);
    });
  });

  describe('Helper functions', () => {
    it('should format next attempt time', () => {
      const now = Date.now();

      expect(ReconnectionManager.formatNextAttempt(now - 1000)).toBe('now');
      expect(ReconnectionManager.formatNextAttempt(now + 5000)).toContain('s');
      expect(ReconnectionManager.formatNextAttempt(now + 90000)).toContain('m');
    });
  });
});

// Helper functions exposed for testing
function extractServerName(repoName: string): string {
  let name = repoName
    .replace(/^mcp-server-/i, '')
    .replace(/^server-/i, '')
    .replace(/^mcp-/i, '');
  return name.toLowerCase();
}

function determineTransport(topics: string[]): 'stdio' | 'http' | 'sse' {
  if (topics.includes('http') || topics.includes('rest')) return 'http';
  if (topics.includes('sse') || topics.includes('server-sent-events')) return 'sse';
  return 'stdio';
}

function determineCategory(topics: string[]): string {
  const categoryMap: Record<string, string> = {
    'design': 'design',
    'figma': 'design',
    'deployment': 'deployment',
    'vercel': 'deployment',
    'database': 'database',
    'postgres': 'database',
    'api': 'api',
  };

  for (const topic of topics) {
    if (categoryMap[topic]) {
      return categoryMap[topic];
    }
  }

  return 'other';
}

function extractPackageName(repo: any): string | undefined {
  const description = repo.description || '';
  const packageMatch = description.match(/@[\w-]+\/[\w-]+/);
  if (packageMatch) {
    return packageMatch[0];
  }

  if (repo.owner.login === 'modelcontextprotocol' && repo.name.startsWith('server-')) {
    return `@modelcontextprotocol/${repo.name}`;
  }

  return undefined;
}
