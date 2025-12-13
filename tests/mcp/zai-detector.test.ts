/**
 * Tests for mcp/zai-detector module
 * Tests Z.AI service detection, API key validation, and status formatting
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock settings manager
vi.mock('../../packages/core/src/utils/settings-manager.js', () => ({
  getSettingsManager: vi.fn().mockReturnValue({
    getApiKey: vi.fn().mockReturnValue(null),
    getCurrentModel: vi.fn().mockReturnValue(null),
    getBaseURL: vi.fn().mockReturnValue(null),
  }),
}));

// Mock MCP config
vi.mock('../../packages/core/src/mcp/config.js', () => ({
  loadMCPConfig: vi.fn().mockReturnValue(null),
}));

// Mock zai-templates with actual server names
vi.mock('../../packages/core/src/mcp/zai-templates.js', () => ({
  ZAI_SERVER_NAMES: {
    WEB_SEARCH: 'zai-websearch',
    WEB_READER: 'zai-webreader',
    VISION: 'zai-vision',
  },
  ZAI_VISION_PACKAGE: {
    minNodeVersion: '18.0.0',
  },
}));

import {
  isGLMModel,
  isZAIBaseURL,
  detectZAIServices,
  getEnabledZAIServers,
  validateZAIApiKey,
  getZAIApiKey,
  isZAIMCPConfigured,
  getRecommendedServers,
  formatZAIStatus,
} from '../../packages/core/src/mcp/zai-detector.js';
import { getSettingsManager } from '../../packages/core/src/utils/settings-manager.js';
import { loadMCPConfig } from '../../packages/core/src/mcp/config.js';

describe('isGLMModel', () => {
  it('should return true for GLM models', () => {
    expect(isGLMModel('glm-4-flash')).toBe(true);
    expect(isGLMModel('GLM-4')).toBe(true);
    expect(isGLMModel('chatglm-turbo')).toBe(true);
    expect(isGLMModel('ChatGLM-Pro')).toBe(true);
    expect(isGLMModel('codegeex-4')).toBe(true);
    expect(isGLMModel('cogview-3')).toBe(true);
    expect(isGLMModel('cogvideo-x')).toBe(true);
  });

  it('should return false for non-GLM models', () => {
    expect(isGLMModel('gpt-4')).toBe(false);
    expect(isGLMModel('claude-3-opus')).toBe(false);
    expect(isGLMModel('gemini-pro')).toBe(false);
    expect(isGLMModel('llama-2')).toBe(false);
  });

  it('should return false for empty or null model', () => {
    expect(isGLMModel('')).toBe(false);
    expect(isGLMModel(null as unknown as string)).toBe(false);
    expect(isGLMModel(undefined as unknown as string)).toBe(false);
  });
});

describe('isZAIBaseURL', () => {
  it('should return true for Z.AI URLs', () => {
    expect(isZAIBaseURL('https://api.z.ai/v1')).toBe(true);
    expect(isZAIBaseURL('https://open.z.ai/api/v1')).toBe(true);
    expect(isZAIBaseURL('https://open.bigmodel.cn/api/paas/v4')).toBe(true);
    expect(isZAIBaseURL('https://chatglm.cn/api')).toBe(true);
  });

  it('should return false for non-Z.AI URLs', () => {
    expect(isZAIBaseURL('https://api.openai.com/v1')).toBe(false);
    expect(isZAIBaseURL('https://api.anthropic.com')).toBe(false);
    expect(isZAIBaseURL('https://generativelanguage.googleapis.com')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(isZAIBaseURL('https://API.Z.AI/v1')).toBe(true);
    expect(isZAIBaseURL('https://OPEN.BIGMODEL.CN/api')).toBe(true);
  });

  it('should return false for empty or null URL', () => {
    expect(isZAIBaseURL('')).toBe(false);
    expect(isZAIBaseURL(null as unknown as string)).toBe(false);
    expect(isZAIBaseURL(undefined as unknown as string)).toBe(false);
  });
});

describe('detectZAIServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect when API key is configured', async () => {
    vi.mocked(getSettingsManager).mockReturnValue({
      getApiKey: vi.fn().mockReturnValue('test-api-key'),
      getCurrentModel: vi.fn().mockReturnValue(null),
      getBaseURL: vi.fn().mockReturnValue(null),
    });

    const status = await detectZAIServices();

    expect(status.hasApiKey).toBe(true);
  });

  it('should detect when no API key is configured', async () => {
    vi.mocked(getSettingsManager).mockReturnValue({
      getApiKey: vi.fn().mockReturnValue(null),
      getCurrentModel: vi.fn().mockReturnValue(null),
      getBaseURL: vi.fn().mockReturnValue(null),
    });

    const status = await detectZAIServices();

    expect(status.hasApiKey).toBe(false);
  });

  it('should detect GLM model by model name', async () => {
    vi.mocked(getSettingsManager).mockReturnValue({
      getApiKey: vi.fn().mockReturnValue(null),
      getCurrentModel: vi.fn().mockReturnValue('glm-4-flash'),
      getBaseURL: vi.fn().mockReturnValue(null),
    });

    const status = await detectZAIServices();

    expect(status.isGLMModel).toBe(true);
  });

  it('should detect GLM model by base URL', async () => {
    vi.mocked(getSettingsManager).mockReturnValue({
      getApiKey: vi.fn().mockReturnValue(null),
      getCurrentModel: vi.fn().mockReturnValue('some-model'),
      getBaseURL: vi.fn().mockReturnValue('https://open.z.ai/api/v1'),
    });

    const status = await detectZAIServices();

    expect(status.isGLMModel).toBe(true);
  });

  it('should return node version info', async () => {
    vi.mocked(getSettingsManager).mockReturnValue({
      getApiKey: vi.fn().mockReturnValue(null),
      getCurrentModel: vi.fn().mockReturnValue(null),
      getBaseURL: vi.fn().mockReturnValue(null),
    });

    const status = await detectZAIServices();

    expect(status.nodeVersion).toBeDefined();
    expect(typeof status.nodeVersion).toBe('string');
    expect(status.nodeVersion).toMatch(/^\d+\.\d+/);
  });
});

describe('getEnabledZAIServers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when no MCP config', async () => {
    vi.mocked(loadMCPConfig).mockReturnValue(null);

    const servers = await getEnabledZAIServers();

    expect(servers).toEqual([]);
  });

  it('should return empty array when no servers configured', async () => {
    vi.mocked(loadMCPConfig).mockReturnValue({ servers: [] });

    const servers = await getEnabledZAIServers();

    expect(servers).toEqual([]);
  });

  it('should return Z.AI servers from config', async () => {
    vi.mocked(loadMCPConfig).mockReturnValue({
      servers: [
        { name: 'zai-websearch', command: 'node' },
        { name: 'other-server', command: 'python' },
        { name: 'zai-vision', command: 'node' },
      ],
    });

    const servers = await getEnabledZAIServers();

    expect(servers).toContain('zai-websearch');
    expect(servers).toContain('zai-vision');
    expect(servers).not.toContain('other-server');
  });

  it('should handle config load errors', async () => {
    vi.mocked(loadMCPConfig).mockImplementation(() => {
      throw new Error('Config load failed');
    });

    const servers = await getEnabledZAIServers();

    expect(servers).toEqual([]);
  });
});

describe('validateZAIApiKey', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should return false for empty API key', async () => {
    const result = await validateZAIApiKey('');
    expect(result).toBe(false);
  });

  it('should return false for whitespace-only API key', async () => {
    const result = await validateZAIApiKey('   ');
    expect(result).toBe(false);
  });

  it('should return true for valid API key', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
    });

    const result = await validateZAIApiKey('valid-api-key');

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://open.z.ai/api/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer valid-api-key',
        }),
      })
    );
  });

  it('should return false for invalid API key', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
    });

    const result = await validateZAIApiKey('invalid-api-key');

    expect(result).toBe(false);
  });

  it('should return true on network error (allow setup to continue)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await validateZAIApiKey('some-api-key');

    expect(result).toBe(true);
  });
});

describe('getZAIApiKey', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return API key from settings', () => {
    vi.mocked(getSettingsManager).mockReturnValue({
      getApiKey: vi.fn().mockReturnValue('settings-api-key'),
    } as ReturnType<typeof getSettingsManager>);

    const key = getZAIApiKey();

    expect(key).toBe('settings-api-key');
  });

  it('should return API key from environment variable', () => {
    vi.mocked(getSettingsManager).mockReturnValue({
      getApiKey: vi.fn().mockReturnValue(null),
    } as ReturnType<typeof getSettingsManager>);
    process.env.Z_AI_API_KEY = 'env-api-key';

    const key = getZAIApiKey();

    expect(key).toBe('env-api-key');
  });

  it('should return null when no API key available', () => {
    vi.mocked(getSettingsManager).mockReturnValue({
      getApiKey: vi.fn().mockReturnValue(null),
    } as ReturnType<typeof getSettingsManager>);
    delete process.env.Z_AI_API_KEY;

    const key = getZAIApiKey();

    expect(key).toBeNull();
  });

  it('should trim whitespace from API key', () => {
    vi.mocked(getSettingsManager).mockReturnValue({
      getApiKey: vi.fn().mockReturnValue('  api-key  '),
    } as ReturnType<typeof getSettingsManager>);

    const key = getZAIApiKey();

    expect(key).toBe('api-key');
  });
});

describe('isZAIMCPConfigured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when API key and servers are configured', async () => {
    vi.mocked(getSettingsManager).mockReturnValue({
      getApiKey: vi.fn().mockReturnValue('test-api-key'),
      getCurrentModel: vi.fn().mockReturnValue(null),
      getBaseURL: vi.fn().mockReturnValue(null),
    });
    vi.mocked(loadMCPConfig).mockReturnValue({
      servers: [{ name: 'zai-websearch', command: 'node' }],
    });

    const result = await isZAIMCPConfigured();

    expect(result).toBe(true);
  });

  it('should return false when no API key', async () => {
    vi.mocked(getSettingsManager).mockReturnValue({
      getApiKey: vi.fn().mockReturnValue(null),
      getCurrentModel: vi.fn().mockReturnValue(null),
      getBaseURL: vi.fn().mockReturnValue(null),
    });
    vi.mocked(loadMCPConfig).mockReturnValue({
      servers: [{ name: 'zai-websearch', command: 'node' }],
    });

    const result = await isZAIMCPConfigured();

    expect(result).toBe(false);
  });

  it('should return false when no servers', async () => {
    vi.mocked(getSettingsManager).mockReturnValue({
      getApiKey: vi.fn().mockReturnValue('test-api-key'),
      getCurrentModel: vi.fn().mockReturnValue(null),
      getBaseURL: vi.fn().mockReturnValue(null),
    });
    vi.mocked(loadMCPConfig).mockReturnValue({ servers: [] });

    const result = await isZAIMCPConfigured();

    expect(result).toBe(false);
  });
});

describe('getRecommendedServers', () => {
  it('should include web search and reader by default', () => {
    const status = {
      hasApiKey: true,
      isGLMModel: true,
      enabledServers: [],
      nodeVersionOk: false,
      nodeVersion: '16.0.0',
    };

    const recommended = getRecommendedServers(status);

    expect(recommended).toContain('zai-websearch');
    expect(recommended).toContain('zai-webreader');
  });

  it('should include vision when Node version is sufficient', () => {
    const status = {
      hasApiKey: true,
      isGLMModel: true,
      enabledServers: [],
      nodeVersionOk: true,
      nodeVersion: '20.0.0',
    };

    const recommended = getRecommendedServers(status);

    expect(recommended).toContain('zai-vision');
  });

  it('should not include vision when Node version is insufficient', () => {
    const status = {
      hasApiKey: true,
      isGLMModel: true,
      enabledServers: [],
      nodeVersionOk: false,
      nodeVersion: '16.0.0',
    };

    const recommended = getRecommendedServers(status);

    expect(recommended).not.toContain('zai-vision');
  });
});

describe('formatZAIStatus', () => {
  it('should format status with API key configured', () => {
    const status = {
      hasApiKey: true,
      isGLMModel: false,
      enabledServers: [] as string[],
      nodeVersionOk: true,
      nodeVersion: '20.0.0',
    };

    const formatted = formatZAIStatus(status);

    expect(formatted).toContain('Z.AI MCP Status');
    expect(formatted).toContain('API Key: ✓ Configured');
  });

  it('should format status without API key', () => {
    const status = {
      hasApiKey: false,
      isGLMModel: false,
      enabledServers: [] as string[],
      nodeVersionOk: true,
      nodeVersion: '20.0.0',
    };

    const formatted = formatZAIStatus(status);

    expect(formatted).toContain('API Key: ✗ Not configured');
  });

  it('should show GLM model detection', () => {
    const status = {
      hasApiKey: false,
      isGLMModel: true,
      enabledServers: [] as string[],
      nodeVersionOk: true,
      nodeVersion: '20.0.0',
    };

    const formatted = formatZAIStatus(status);

    expect(formatted).toContain('GLM Model: ✓ Detected');
  });

  it('should show Node.js version', () => {
    const status = {
      hasApiKey: false,
      isGLMModel: false,
      enabledServers: [] as string[],
      nodeVersionOk: true,
      nodeVersion: '20.10.0',
    };

    const formatted = formatZAIStatus(status);

    expect(formatted).toContain('Node.js: v20.10.0 ✓');
  });

  it('should show Node.js version warning when insufficient', () => {
    const status = {
      hasApiKey: false,
      isGLMModel: false,
      enabledServers: [] as string[],
      nodeVersionOk: false,
      nodeVersion: '16.0.0',
    };

    const formatted = formatZAIStatus(status);

    expect(formatted).toContain('Node.js: v16.0.0');
    expect(formatted).toContain('required for vision');
  });

  it('should show enabled servers', () => {
    const status = {
      hasApiKey: true,
      isGLMModel: true,
      enabledServers: ['zai-websearch', 'zai-vision'],
      nodeVersionOk: true,
      nodeVersion: '20.0.0',
    };

    const formatted = formatZAIStatus(status);

    expect(formatted).toContain('✓ zai-websearch');
    expect(formatted).toContain('✓ zai-vision');
  });

  it('should show (none) when no servers enabled', () => {
    const status = {
      hasApiKey: false,
      isGLMModel: false,
      enabledServers: [] as string[],
      nodeVersionOk: true,
      nodeVersion: '20.0.0',
    };

    const formatted = formatZAIStatus(status);

    expect(formatted).toContain('(none)');
  });
});
