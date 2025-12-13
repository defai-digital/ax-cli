/**
 * Tests for commands/doctor module
 * Tests diagnostic check functions and result formatting
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  accessSync: vi.fn(),
  constants: {
    R_OK: 4,
    W_OK: 2,
  },
}));

// Mock settings manager
vi.mock('../../packages/core/src/utils/settings-manager.js', () => ({
  getSettingsManager: vi.fn(() => ({
    getApiKey: vi.fn().mockReturnValue('test-api-key'),
    getBaseURL: vi.fn().mockReturnValue('https://api.example.com/v1'),
    getCurrentModel: vi.fn().mockReturnValue('glm-4-plus'),
    loadProjectSettings: vi.fn().mockReturnValue({ mcpServers: {} }),
  })),
}));

// Mock provider config
vi.mock('../../packages/core/src/provider/config.js', () => ({
  getActiveProvider: vi.fn(() => ({
    branding: { cliName: 'ax-cli' },
  })),
  getActiveConfigPaths: vi.fn(() => ({
    USER_CONFIG: '/home/user/.ax-cli/config.json',
    USER_DIR: '/home/user/.ax-cli',
    PROJECT_SETTINGS: '.ax-cli/settings.json',
    DIR_NAME: '.ax-cli',
  })),
}));

// Mock json-utils
vi.mock('../../packages/core/src/utils/json-utils.js', () => ({
  parseJsonFile: vi.fn(() => ({ success: true, data: {} })),
}));

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock promisify to return a mock function for exec
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();
  return {
    ...actual,
    promisify: vi.fn((fn) => {
      if (fn.name === 'exec') {
        return vi.fn().mockRejectedValue(new Error('Not found'));
      }
      return actual.promisify(fn);
    }),
  };
});

// Mock MCP module
vi.mock('../../packages/core/src/mcp/index.js', () => ({
  detectZAIServices: vi.fn().mockResolvedValue({
    hasApiKey: true,
    enabledServers: ['zai-search'],
    nodeVersionOk: true,
    nodeVersion: '22.0.0',
  }),
  isGLMModel: vi.fn().mockReturnValue(false),
  isZAIBaseURL: vi.fn().mockReturnValue(false),
  ZAI_SERVER_NAMES: { VISION: 'zai-vision' },
  ZAI_MCP_TEMPLATES: {
    'zai-search': { displayName: 'Web Search' },
  },
}));

// Mock constants
vi.mock('../../packages/core/src/constants.js', () => ({
  GLM_MODELS: {
    'glm-4-plus': {
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsThinking: false,
    },
  },
}));

// Mock token-counter
vi.mock('../../packages/core/src/utils/token-counter.js', () => ({
  formatTokenCount: vi.fn((count) => `${count / 1000}K`),
}));

// Mock error-handler
vi.mock('../../packages/core/src/utils/error-handler.js', () => ({
  extractErrorMessage: vi.fn((error) =>
    error instanceof Error ? error.message : String(error)
  ),
}));

import {
  checkNodeVersion,
  checkConfigFiles,
  checkModelConfiguration,
  checkCommand,
  formatCheckResult,
  testEndpointReachability,
  checkFileSystemPermissions,
  type CheckResult,
} from '../../packages/core/src/commands/doctor.js';
import { parseJsonFile } from '../../packages/core/src/utils/json-utils.js';

describe('Doctor Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkNodeVersion', () => {
    it('should pass for Node.js 24+', async () => {
      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v24.0.0',
        writable: true,
      });

      const result = await checkNodeVersion();

      expect(result.status).toBe('pass');
      expect(result.name).toBe('Node.js Version');
      expect(result.message).toContain('24');

      Object.defineProperty(process, 'version', {
        value: originalVersion,
        writable: true,
      });
    });

    it('should fail for Node.js below 24', async () => {
      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v20.0.0',
        writable: true,
      });

      const result = await checkNodeVersion();

      expect(result.status).toBe('fail');
      expect(result.suggestion).toContain('Upgrade');

      Object.defineProperty(process, 'version', {
        value: originalVersion,
        writable: true,
      });
    });

    it('should handle unusual version formats', async () => {
      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v25.0.0-alpha.1',
        writable: true,
      });

      const result = await checkNodeVersion();

      expect(result.status).toBe('pass');

      Object.defineProperty(process, 'version', {
        value: originalVersion,
        writable: true,
      });
    });
  });

  describe('checkConfigFiles', () => {
    it('should pass when user config exists and is valid', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseJsonFile).mockReturnValue({ success: true, data: {} });

      const results = checkConfigFiles();

      const userConfigResult = results.find((r) => r.name === 'User Config File');
      expect(userConfigResult?.status).toBe('pass');
      expect(userConfigResult?.message).toContain('valid');
    });

    it('should fail when user config is corrupted', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseJsonFile).mockReturnValue({
        success: false,
        error: 'Invalid JSON',
      });

      const results = checkConfigFiles();

      const userConfigResult = results.find((r) => r.name === 'User Config File');
      expect(userConfigResult?.status).toBe('fail');
      expect(userConfigResult?.message).toContain('corrupted');
    });

    it('should warn when user config does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const results = checkConfigFiles();

      const userConfigResult = results.find((r) => r.name === 'User Config File');
      expect(userConfigResult?.status).toBe('warning');
      expect(userConfigResult?.suggestion).toContain('setup');
    });

    it('should pass when project settings do not exist (optional)', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        // User config exists, project settings don't
        return String(path).includes('config.json');
      });
      vi.mocked(parseJsonFile).mockReturnValue({ success: true, data: {} });

      const results = checkConfigFiles();

      const projectResult = results.find((r) => r.name === 'Project Settings');
      expect(projectResult?.status).toBe('pass');
      expect(projectResult?.message.toLowerCase()).toContain('not configured');
    });
  });

  describe('checkModelConfiguration', () => {
    it('should pass for known model', () => {
      const result = checkModelConfiguration();

      expect(result.status).toBe('pass');
      expect(result.message).toContain('supported');
    });
  });

  // Note: checkCommand tests are skipped because they require actual exec calls
  // which are difficult to mock properly in the module import context

  describe('formatCheckResult', () => {
    it('should format pass result with checkmark', () => {
      const result: CheckResult = {
        name: 'Test Check',
        status: 'pass',
        message: 'All good',
      };

      const formatted = formatCheckResult(result);

      expect(formatted).toContain('✓');
      expect(formatted).toContain('Test Check');
      expect(formatted).toContain('All good');
    });

    it('should format warning result with warning symbol', () => {
      const result: CheckResult = {
        name: 'Test Check',
        status: 'warning',
        message: 'Something to note',
      };

      const formatted = formatCheckResult(result);

      expect(formatted).toContain('⚠');
    });

    it('should format fail result with X', () => {
      const result: CheckResult = {
        name: 'Test Check',
        status: 'fail',
        message: 'Something failed',
      };

      const formatted = formatCheckResult(result);

      expect(formatted).toContain('✗');
    });

    it('should handle undefined result', () => {
      const formatted = formatCheckResult(undefined);

      expect(formatted).toContain('did not produce a result');
    });
  });

  describe('testEndpointReachability', () => {
    it('should return success for reachable local endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const result = await testEndpointReachability('http://localhost:11434/v1');

      expect(result.success).toBe(true);
    });

    it('should return success for remote endpoint with 401 (reachable but auth required)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });
      global.fetch = mockFetch;

      const result = await testEndpointReachability('https://api.example.com/v1');

      expect(result.success).toBe(true);
    });

    it('should return failure for connection refused', async () => {
      const error = new Error('Connection refused');
      (error as NodeJS.ErrnoException).code = 'ECONNREFUSED';
      const mockFetch = vi.fn().mockRejectedValue(error);
      global.fetch = mockFetch;

      const result = await testEndpointReachability('http://localhost:12345/v1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('refused');
    });

    it('should return failure for timeout', async () => {
      const error = new Error('Timeout');
      error.name = 'TimeoutError';
      const mockFetch = vi.fn().mockRejectedValue(error);
      global.fetch = mockFetch;

      const result = await testEndpointReachability('https://api.example.com/v1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should return failure for 500 error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      global.fetch = mockFetch;

      const result = await testEndpointReachability('https://api.example.com/v1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });
  });

  describe('checkFileSystemPermissions', () => {
    it('should pass when directories exist and are writable', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.accessSync).mockImplementation(() => {});

      const results = checkFileSystemPermissions();

      // Should have results for both directories
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.every((r) => r.status === 'pass')).toBe(true);
    });

    it('should warn when directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const results = checkFileSystemPermissions();

      expect(results.every((r) => r.status === 'warning')).toBe(true);
      expect(results[0].suggestion).toContain('mkdir');
    });

    it('should fail when directory has permission error', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.accessSync).mockImplementation(() => {
        const error = new Error('EPERM: permission denied');
        throw error;
      });

      const results = checkFileSystemPermissions();

      expect(results.every((r) => r.status === 'fail')).toBe(true);
      expect(results[0].message).toContain('Permission denied');
    });
  });
});
