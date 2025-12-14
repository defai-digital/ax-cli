import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetActiveProviderConfigPaths = vi.fn();
const mockResetSettingsManager = vi.fn();
const mockLoadUserSettings = vi.fn();
const mockGetApiKey = vi.fn();
const mockGetBaseURL = vi.fn();
const mockGetCurrentModel = vi.fn();

let activeProvider: any = null;

// Capture the last agent constructed for assertions
class MockLLMAgent {
  static lastInstance: MockLLMAgent | null = null;
  constructor(
    public readonly apiKey: string,
    public readonly baseURL: string,
    public readonly model: string,
    public readonly maxToolRounds?: number,
    public readonly mcpInfo?: unknown
  ) {
    MockLLMAgent.lastInstance = this;
  }

  on() {}
  off() {}
  dispose() {}
  processUserMessage = vi.fn();
  setThinkingConfig = vi.fn();
}

vi.mock('../../packages/core/src/provider/config.js', () => {
  const GLM_PROVIDER = {
    name: 'glm',
    displayName: 'GLM',
    branding: { cliName: 'ax-glm' },
    apiKeyEnvVar: 'ZAI_API_KEY',
    defaultBaseURL: 'https://glm.example',
    defaultModel: 'glm-default',
    models: {},
    configDirName: '.ax-glm',
    features: {
      supportsThinking: true,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      supportsDoSample: false,
    },
  };

  const GROK_PROVIDER = {
    name: 'grok',
    displayName: 'Grok',
    branding: { cliName: 'ax-grok' },
    apiKeyEnvVar: 'XAI_API_KEY',
    defaultBaseURL: 'https://grok.example',
    defaultModel: 'grok-default',
    models: {},
    configDirName: '.ax-grok',
    features: {
      supportsThinking: true,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      supportsDoSample: false,
    },
  };

  activeProvider = GLM_PROVIDER;

  return {
    GLM_PROVIDER,
    GROK_PROVIDER,
    getActiveProvider: () => activeProvider,
    setActiveProviderConfigPaths: mockSetActiveProviderConfigPaths.mockImplementation((provider) => {
      activeProvider = provider;
    }),
    getApiKeyFromEnv: vi.fn().mockReturnValue('env-key'),
  };
});

vi.mock('../../packages/core/src/utils/settings-manager.js', () => ({
  getSettingsManager: () => ({
    loadUserSettings: mockLoadUserSettings,
    getApiKey: mockGetApiKey,
    getBaseURL: mockGetBaseURL,
    getCurrentModel: mockGetCurrentModel,
  }),
  SettingsManager: { resetInstance: mockResetSettingsManager },
}));

vi.mock('../../packages/core/src/llm/tools.js', () => ({
  initializeMCPServers: vi.fn(),
}));

vi.mock('../../packages/core/src/agent/llm-agent.js', () => ({
  LLMAgent: MockLLMAgent,
}));

describe('createProviderAgent', () => {
  beforeEach(() => {
    mockSetActiveProviderConfigPaths.mockClear();
    mockResetSettingsManager.mockClear();
    mockLoadUserSettings.mockClear();
    mockGetApiKey.mockReset().mockReturnValue('settings-key');
    mockGetBaseURL.mockReset().mockReturnValue(undefined);
    mockGetCurrentModel.mockReset().mockReturnValue(undefined);
    MockLLMAgent.lastInstance = null;
  });

  it('switches active provider, clears cached settings, and uses provider defaults', async () => {
    const { createGrokAgent } = await import('../../packages/core/src/sdk/index.js');

    await createGrokAgent();

    // Active provider should switch from GLM to Grok and reset caches
    expect(mockSetActiveProviderConfigPaths).toHaveBeenCalledWith(expect.objectContaining({ name: 'grok' }));
    expect(mockResetSettingsManager).toHaveBeenCalled();

    // Settings should be loaded after switching provider
    expect(mockLoadUserSettings).toHaveBeenCalled();

    // Agent should be constructed with Grok defaults (base/model) and env API key
    expect(MockLLMAgent.lastInstance?.apiKey).toBe('env-key');
    expect(MockLLMAgent.lastInstance?.baseURL).toBe('https://grok.example');
    expect(MockLLMAgent.lastInstance?.model).toBe('grok-default');
  });

  it('accepts enableThinking without validation errors and toggles thinking config', async () => {
    const { createGLMAgent } = await import('../../packages/core/src/sdk/index.js');

    const agent = await createGLMAgent({ enableThinking: true });

    expect(agent).toBeInstanceOf(MockLLMAgent);
    expect(agent.setThinkingConfig).toHaveBeenCalledWith({ type: 'enabled' });
  });
});
