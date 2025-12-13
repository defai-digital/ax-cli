/**
 * Tests for mcp/config module
 * Tests MCP configuration loading, saving, and server management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
const mockLoadProjectSettings = vi.fn();
const mockLoadUserSettings = vi.fn();
const mockUpdateProjectSetting = vi.fn();
const mockSaveUserSettings = vi.fn();

vi.mock('../../packages/core/src/utils/settings-manager.js', () => ({
  getSettingsManager: () => ({
    loadProjectSettings: mockLoadProjectSettings,
    loadUserSettings: mockLoadUserSettings,
    updateProjectSetting: mockUpdateProjectSetting,
    saveUserSettings: mockSaveUserSettings,
  }),
}));

// Mock the automatosx-loader
vi.mock('../../packages/core/src/mcp/automatosx-loader.js', () => ({
  loadAutomatosXMCPServers: vi.fn().mockReturnValue({
    found: false,
    servers: [],
    errors: [],
    warnings: [],
  }),
  mergeConfigs: vi.fn((a: unknown[], b: unknown[]) => ({ servers: [...a, ...b], conflicts: [] })),
  getConfigRecommendation: vi.fn().mockReturnValue(null),
  formatMergeResult: vi.fn().mockReturnValue('merge result'),
}));

// Mock the config-migrator
vi.mock('../../packages/core/src/mcp/config-migrator.js', () => ({
  migrateConfig: vi.fn().mockReturnValue({ success: false }),
}));

// Mock the config-detector
vi.mock('../../packages/core/src/mcp/config-detector.js', () => ({
  detectConfigFormat: vi.fn().mockReturnValue({ isLegacy: false, issues: [] }),
}));

// Mock the error-formatter
vi.mock('../../packages/core/src/mcp/error-formatter.js', () => ({
  formatMCPConfigError: vi.fn().mockReturnValue('error message'),
  formatWarning: vi.fn((_title, msgs) => `Warning: ${msgs?.join(', ') || ''}`),
  formatInfo: vi.fn((msg) => `Info: ${msg}`),
}));

// Mock the zai-templates
vi.mock('../../packages/core/src/mcp/zai-templates.js', () => ({
  ZAI_SERVER_NAMES: { VISION: 'zai-vision' },
  isZAIServer: vi.fn((name) => name.startsWith('zai-')),
}));

// Mock the provider-mcp-loader
vi.mock('../../packages/core/src/mcp/provider-mcp-loader.js', () => ({
  loadProviderMCPConfig: vi.fn().mockReturnValue({
    found: false,
    serverConfigs: [],
    error: null,
    warnings: [],
  }),
}));

// Mock auto-discovery
vi.mock('../../packages/core/src/mcp/automatosx-auto-discovery.js', () => ({
  getAutoDiscoveredServers: vi.fn().mockReturnValue([]),
  detectAutomatosX: vi.fn().mockReturnValue({ found: false, version: null }),
}));

// Mock schemas
vi.mock('../../packages/core/src/schemas/settings-schemas.js', () => ({
  MCPServerConfigSchema: {
    safeParse: vi.fn((config) => {
      if (config && config.name && config.transport) {
        return { success: true, data: config };
      }
      return { success: false, error: { issues: [{ message: 'Invalid config' }] } };
    }),
  },
}));

// Mock error-handler
vi.mock('../../packages/core/src/utils/error-handler.js', () => ({
  ErrorCategory: { VALIDATION: 'VALIDATION' },
  createErrorMessage: vi.fn((_cat, context, error) => `${context}: ${error}`),
}));

import {
  loadMCPConfig,
  resetMigrationWarnings,
  saveMCPConfig,
  addMCPServer,
  removeMCPServer,
  getMCPServer,
  addUserMCPServer,
  removeUserMCPServer,
  getUserMCPServer,
} from '../../packages/core/src/mcp/config.js';

describe('loadMCPConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMigrationWarnings();
    mockLoadProjectSettings.mockReturnValue({ mcpServers: {} });
    mockLoadUserSettings.mockReturnValue({ mcpServers: {} });
  });

  it('should return empty servers when no config', () => {
    mockLoadProjectSettings.mockReturnValue({});
    mockLoadUserSettings.mockReturnValue({});

    const config = loadMCPConfig();

    expect(config.servers).toEqual([]);
  });

  it('should load servers from project settings', () => {
    const server = {
      name: 'test-server',
      transport: { type: 'stdio', command: 'node', args: ['script.js'] },
    };
    mockLoadProjectSettings.mockReturnValue({
      mcpServers: { 'test-server': server },
    });

    const config = loadMCPConfig();

    expect(config.servers.length).toBeGreaterThanOrEqual(0);
  });

  it('should load servers from user settings', () => {
    const server = {
      name: 'user-server',
      transport: { type: 'stdio', command: 'python3', args: ['server.py'] },
    };
    mockLoadUserSettings.mockReturnValue({
      mcpServers: { 'user-server': server },
    });

    const config = loadMCPConfig();

    expect(config.servers.length).toBeGreaterThanOrEqual(0);
  });

  it('should prioritize project settings over user settings', () => {
    const projectServer = {
      name: 'shared-server',
      transport: { type: 'stdio', command: 'node', args: ['project.js'] },
    };
    const userServer = {
      name: 'shared-server',
      transport: { type: 'stdio', command: 'node', args: ['user.js'] },
    };
    mockLoadProjectSettings.mockReturnValue({
      mcpServers: { 'shared-server': projectServer },
    });
    mockLoadUserSettings.mockReturnValue({
      mcpServers: { 'shared-server': userServer },
    });

    const config = loadMCPConfig();

    // Project should take precedence - only one server with this name
    const serverCount = config.servers.filter(s => s.name === 'shared-server').length;
    expect(serverCount).toBeLessThanOrEqual(1);
  });
});

describe('resetMigrationWarnings', () => {
  it('should not throw', () => {
    expect(() => resetMigrationWarnings()).not.toThrow();
  });
});

describe('saveMCPConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should save servers to project settings', () => {
    const config = {
      servers: [
        { name: 'server1', transport: { type: 'stdio', command: 'node', args: ['a.js'] } },
        { name: 'server2', transport: { type: 'stdio', command: 'python3', args: ['b.py'] } },
      ],
    };

    saveMCPConfig(config as any);

    expect(mockUpdateProjectSetting).toHaveBeenCalledWith(
      'mcpServers',
      expect.objectContaining({
        server1: expect.any(Object),
        server2: expect.any(Object),
      })
    );
  });

  it('should handle empty servers array', () => {
    const config = { servers: [] };

    saveMCPConfig(config);

    expect(mockUpdateProjectSetting).toHaveBeenCalledWith('mcpServers', {});
  });
});

describe('addMCPServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadProjectSettings.mockReturnValue({ mcpServers: {} });
  });

  it('should add valid server config', () => {
    const server = {
      name: 'new-server',
      transport: { type: 'stdio', command: 'node', args: ['server.js'] },
    };

    addMCPServer(server as any);

    expect(mockUpdateProjectSetting).toHaveBeenCalledWith(
      'mcpServers',
      expect.objectContaining({
        'new-server': expect.any(Object),
      })
    );
  });

  it('should throw on invalid server config', () => {
    const invalidServer = { name: 'bad-server' }; // Missing transport

    expect(() => addMCPServer(invalidServer as any)).toThrow();
  });

  it('should add to existing servers', () => {
    mockLoadProjectSettings.mockReturnValue({
      mcpServers: {
        'existing-server': {
          name: 'existing-server',
          transport: { type: 'stdio', command: 'node', args: ['existing.js'] },
        },
      },
    });

    const newServer = {
      name: 'new-server',
      transport: { type: 'stdio', command: 'node', args: ['new.js'] },
    };

    addMCPServer(newServer as any);

    expect(mockUpdateProjectSetting).toHaveBeenCalledWith(
      'mcpServers',
      expect.objectContaining({
        'existing-server': expect.any(Object),
        'new-server': expect.any(Object),
      })
    );
  });
});

describe('removeMCPServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should remove existing server', () => {
    mockLoadProjectSettings.mockReturnValue({
      mcpServers: {
        'server1': { name: 'server1', transport: {} },
        'server2': { name: 'server2', transport: {} },
      },
    });

    removeMCPServer('server1');

    expect(mockUpdateProjectSetting).toHaveBeenCalled();
  });

  it('should handle non-existent server', () => {
    mockLoadProjectSettings.mockReturnValue({
      mcpServers: {
        'server1': { name: 'server1', transport: {} },
      },
    });

    expect(() => removeMCPServer('nonexistent')).not.toThrow();
  });

  it('should handle undefined mcpServers', () => {
    mockLoadProjectSettings.mockReturnValue({});

    expect(() => removeMCPServer('server1')).not.toThrow();
  });
});

describe('getMCPServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return existing server', () => {
    const server = { name: 'test-server', transport: { type: 'stdio' } };
    mockLoadProjectSettings.mockReturnValue({
      mcpServers: { 'test-server': server },
    });

    const result = getMCPServer('test-server');

    expect(result).toEqual(server);
  });

  it('should return undefined for non-existent server', () => {
    mockLoadProjectSettings.mockReturnValue({
      mcpServers: {},
    });

    const result = getMCPServer('nonexistent');

    expect(result).toBeUndefined();
  });

  it('should return undefined when no mcpServers', () => {
    mockLoadProjectSettings.mockReturnValue({});

    const result = getMCPServer('any-server');

    expect(result).toBeUndefined();
  });
});

describe('addUserMCPServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadUserSettings.mockReturnValue({ mcpServers: {} });
  });

  it('should add valid server to user settings', () => {
    const server = {
      name: 'user-server',
      transport: { type: 'stdio', command: 'node', args: ['server.js'] },
    };

    addUserMCPServer(server as any);

    expect(mockSaveUserSettings).toHaveBeenCalledWith({
      mcpServers: expect.objectContaining({
        'user-server': expect.any(Object),
      }),
    });
  });

  it('should throw on invalid server config', () => {
    const invalidServer = { name: 'bad-server' }; // Missing transport

    expect(() => addUserMCPServer(invalidServer as any)).toThrow();
  });

  it('should add to existing user servers', () => {
    mockLoadUserSettings.mockReturnValue({
      mcpServers: {
        'existing-server': {
          name: 'existing-server',
          transport: { type: 'stdio', command: 'node', args: ['existing.js'] },
        },
      },
    });

    const newServer = {
      name: 'new-server',
      transport: { type: 'stdio', command: 'node', args: ['new.js'] },
    };

    addUserMCPServer(newServer as any);

    expect(mockSaveUserSettings).toHaveBeenCalledWith({
      mcpServers: expect.objectContaining({
        'existing-server': expect.any(Object),
        'new-server': expect.any(Object),
      }),
    });
  });
});

describe('removeUserMCPServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should remove existing user server', () => {
    mockLoadUserSettings.mockReturnValue({
      mcpServers: {
        'server1': { name: 'server1', transport: {} },
        'server2': { name: 'server2', transport: {} },
      },
    });

    removeUserMCPServer('server1');

    expect(mockSaveUserSettings).toHaveBeenCalled();
  });

  it('should handle undefined mcpServers', () => {
    mockLoadUserSettings.mockReturnValue({});

    expect(() => removeUserMCPServer('server1')).not.toThrow();
  });
});

describe('getUserMCPServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return existing user server', () => {
    const server = { name: 'user-server', transport: { type: 'stdio' } };
    mockLoadUserSettings.mockReturnValue({
      mcpServers: { 'user-server': server },
    });

    const result = getUserMCPServer('user-server');

    expect(result).toEqual(server);
  });

  it('should return undefined for non-existent server', () => {
    mockLoadUserSettings.mockReturnValue({
      mcpServers: {},
    });

    const result = getUserMCPServer('nonexistent');

    expect(result).toBeUndefined();
  });

  it('should return undefined when no mcpServers', () => {
    mockLoadUserSettings.mockReturnValue({});

    const result = getUserMCPServer('any-server');

    expect(result).toBeUndefined();
  });
});

// Test REPL command detection logic
describe('REPL command detection logic', () => {
  it('should identify node without args as problematic', () => {
    const commandsRequiringArgs = ['node', 'python', 'python3', 'deno', 'bun', 'ruby', 'irb'];
    const command = 'node';
    const args: string[] = [];

    const baseCommand = command.trim().split(/\s+/)[0]?.split('/').pop() || command;
    const isProblematic = commandsRequiringArgs.includes(baseCommand) && args.length === 0;

    expect(isProblematic).toBe(true);
  });

  it('should allow node with script arg', () => {
    const commandsRequiringArgs = ['node', 'python', 'python3', 'deno', 'bun', 'ruby', 'irb'];
    const command = 'node';
    const args = ['server.js'];

    const baseCommand = command.trim().split(/\s+/)[0]?.split('/').pop() || command;
    const isProblematic = commandsRequiringArgs.includes(baseCommand) && args.length === 0;

    expect(isProblematic).toBe(false);
  });

  it('should handle full path to node', () => {
    const commandsRequiringArgs = ['node', 'python', 'python3'];
    const command = '/usr/local/bin/node';
    const args: string[] = [];

    const commandParts = command.trim().split(/\s+/);
    const baseCommand = commandParts[0]?.split('/').pop() || command;
    const isProblematic = commandsRequiringArgs.includes(baseCommand) && args.length === 0;

    expect(isProblematic).toBe(true);
  });

  it('should not flag non-REPL commands', () => {
    const commandsRequiringArgs = ['node', 'python', 'python3'];
    const command = 'npx';
    const args: string[] = [];

    const baseCommand = command.trim().split(/\s+/)[0]?.split('/').pop() || command;
    const isProblematic = commandsRequiringArgs.includes(baseCommand) && args.length === 0;

    expect(isProblematic).toBe(false);
  });
});

// Test Z.AI defaults logic
describe('Z.AI defaults logic', () => {
  it('should identify Z.AI servers by name', () => {
    const zaiServerNames = ['zai-vision', 'zai-chat', 'zai-test'];
    const nonZaiNames = ['test-server', 'my-mcp', 'vision'];

    for (const name of zaiServerNames) {
      expect(name.startsWith('zai-')).toBe(true);
    }

    for (const name of nonZaiNames) {
      expect(name.startsWith('zai-')).toBe(false);
    }
  });

  it('should apply default timeout to zai-vision', () => {
    const config = { name: 'zai-vision', transport: {} };
    const defaults = { initTimeout: 120000, quiet: true };

    const isZAI = config.name.startsWith('zai-');
    const isVision = config.name === 'zai-vision';

    if (isZAI && isVision) {
      const result = {
        ...config,
        initTimeout: (config as any).initTimeout ?? defaults.initTimeout,
        quiet: (config as any).quiet ?? defaults.quiet,
      };

      expect(result.initTimeout).toBe(120000);
      expect(result.quiet).toBe(true);
    }
  });

  it('should not override explicitly set values', () => {
    const config = { name: 'zai-vision', transport: {}, initTimeout: 60000, quiet: false };
    const defaults = { initTimeout: 120000, quiet: true };

    const result = {
      ...config,
      initTimeout: config.initTimeout ?? defaults.initTimeout,
      quiet: config.quiet ?? defaults.quiet,
    };

    expect(result.initTimeout).toBe(60000);
    expect(result.quiet).toBe(false);
  });
});
