import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetApiKeyFromEnv = vi.fn();
const mockLoadUserSettings = vi.fn();
const mockGetApiKey = vi.fn();
const mockGetBaseURL = vi.fn();
const mockGetCurrentModel = vi.fn();

class MockLLMAgent {
  static lastInstance: MockLLMAgent | null = null;
  constructor(
    public readonly apiKey: string,
    public readonly baseURL: string,
    public readonly model: string,
    public readonly maxToolRounds?: number
  ) {
    MockLLMAgent.lastInstance = this;
  }
  on() {}
  off() {}
  dispose() {}
  processUserMessage = vi.fn();
}

vi.mock('../../packages/core/src/provider/config.js', () => ({
  GLM_PROVIDER: {
    name: 'glm',
    displayName: 'GLM',
    branding: { cliName: 'ax-glm' },
    apiKeyEnvVar: 'ZAI_API_KEY',
    defaultBaseURL: 'https://glm.default',
    defaultModel: 'glm-4.6',
    models: {},
    configDirName: '.ax-glm',
    features: {
      supportsThinking: true,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      supportsDoSample: false,
    },
  },
  GROK_PROVIDER: {
    name: 'grok',
    displayName: 'Grok',
    branding: { cliName: 'ax-grok' },
    apiKeyEnvVar: 'XAI_API_KEY',
    defaultBaseURL: 'https://grok.default',
    defaultModel: 'grok-4.1',
    models: {},
    configDirName: '.ax-grok',
    features: {
      supportsThinking: true,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      supportsDoSample: false,
    },
  },
  getActiveProvider: () => ({
    name: 'glm',
    displayName: 'GLM',
    branding: { cliName: 'ax-glm' },
    apiKeyEnvVar: 'ZAI_API_KEY',
    defaultBaseURL: 'https://glm.default',
    defaultModel: 'glm-4.6',
    models: {},
    configDirName: '.ax-glm',
    features: {
      supportsThinking: true,
      supportsVision: false,
      supportsSearch: false,
      supportsSeed: false,
      supportsDoSample: false,
    },
  }),
  getApiKeyFromEnv: mockGetApiKeyFromEnv,
}));

vi.mock('../../packages/core/src/utils/settings-manager.js', () => ({
  getSettingsManager: () => ({
    loadUserSettings: mockLoadUserSettings,
    loadProjectSettings: vi.fn().mockReturnValue({}),
    getApiKey: mockGetApiKey,
    getBaseURL: mockGetBaseURL,
    getCurrentModel: mockGetCurrentModel,
  }),
}));

vi.mock('../../packages/core/src/agent/llm-agent.js', () => ({
  LLMAgent: MockLLMAgent,
}));

vi.mock('../../packages/core/src/mcp/config.js', () => ({
  loadMCPConfig: () => ({ servers: [] }),
}));

describe('createAgent env-first resolution', () => {
  beforeEach(() => {
    mockGetApiKeyFromEnv.mockReset();
    mockLoadUserSettings.mockReset();
    mockGetApiKey.mockReset();
    mockGetBaseURL.mockReset();
    mockGetCurrentModel.mockReset();
    MockLLMAgent.lastInstance = null;
  });

  it('uses env API key and provider defaults without loading settings', async () => {
    mockGetApiKeyFromEnv.mockReturnValue('env-key');

    const { createAgent } = await import('../../packages/core/src/sdk/index.js');
    const agent = await createAgent();

    expect(agent).toBeInstanceOf(MockLLMAgent);
    expect(MockLLMAgent.lastInstance?.apiKey).toBe('env-key');
    expect(MockLLMAgent.lastInstance?.baseURL).toBe('https://glm.default');
    expect(MockLLMAgent.lastInstance?.model).toBe('glm-4.6');
  });
});
