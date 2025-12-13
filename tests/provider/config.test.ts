/**
 * Tests for provider/config.ts
 * Tests provider configurations and helper functions
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GLM_PROVIDER,
  GROK_PROVIDER,
  AX_CLI_PROVIDER,
  DEFAULT_PROVIDER,
  getProviderDefinition,
  getAvailableProviders,
  getProviderModelConfig,
  getApiKeyFromEnv,
  CONFIG_FILE_NAMES,
  getProviderConfigPaths,
  getConfigPathsByProviderName,
  setActiveProviderConfigPaths,
  getActiveProvider,
  getActiveConfigPaths,
  MODEL_ALIASES,
  resolveModelAlias,
  getProviderModelAliases,
  isModelAlias,
  getAvailableModelsWithAliases,
  type ProviderDefinition,
  type ProviderModelConfig,
  type ProviderConfigPaths,
} from '../../packages/core/src/provider/config.js';

describe('Provider Definitions', () => {
  describe('GLM_PROVIDER', () => {
    it('should have required fields', () => {
      expect(GLM_PROVIDER.name).toBe('glm');
      expect(GLM_PROVIDER.displayName).toBe('GLM (Z.AI)');
      expect(GLM_PROVIDER.apiKeyEnvVar).toBe('ZAI_API_KEY');
      expect(GLM_PROVIDER.defaultBaseURL).toBeDefined();
      expect(GLM_PROVIDER.defaultModel).toBeDefined();
      expect(GLM_PROVIDER.configDirName).toBe('.ax-glm');
    });

    it('should have valid models', () => {
      expect(Object.keys(GLM_PROVIDER.models).length).toBeGreaterThan(0);
      expect(GLM_PROVIDER.models[GLM_PROVIDER.defaultModel]).toBeDefined();
    });

    it('should have valid model configs', () => {
      for (const [_modelId, config] of Object.entries(GLM_PROVIDER.models)) {
        expect(config.name).toBeDefined();
        expect(config.contextWindow).toBeGreaterThan(0);
        expect(config.maxOutputTokens).toBeGreaterThan(0);
        expect(typeof config.supportsThinking).toBe('boolean');
        expect(typeof config.supportsVision).toBe('boolean');
        expect(config.defaultTemperature).toBeGreaterThanOrEqual(0);
        expect(config.defaultTemperature).toBeLessThanOrEqual(2);
      }
    });

    it('should have branding info', () => {
      expect(GLM_PROVIDER.branding.cliName).toBeDefined();
      expect(GLM_PROVIDER.branding.description).toBeDefined();
      expect(GLM_PROVIDER.branding.welcomeMessage).toBeDefined();
      expect(GLM_PROVIDER.branding.primaryColor).toBeDefined();
    });

    it('should have feature flags', () => {
      expect(typeof GLM_PROVIDER.features.supportsThinking).toBe('boolean');
      expect(typeof GLM_PROVIDER.features.supportsVision).toBe('boolean');
    });

    it('should have vision model defined', () => {
      expect(GLM_PROVIDER.defaultVisionModel).toBeDefined();
      expect(GLM_PROVIDER.models[GLM_PROVIDER.defaultVisionModel!]).toBeDefined();
    });

    it('should have API key aliases', () => {
      expect(GLM_PROVIDER.apiKeyEnvVarAliases).toBeDefined();
      expect(Array.isArray(GLM_PROVIDER.apiKeyEnvVarAliases)).toBe(true);
    });
  });

  describe('GROK_PROVIDER', () => {
    it('should have required fields', () => {
      expect(GROK_PROVIDER.name).toBe('grok');
      expect(GROK_PROVIDER.displayName).toBeDefined();
      expect(GROK_PROVIDER.apiKeyEnvVar).toBe('XAI_API_KEY');
      expect(GROK_PROVIDER.defaultBaseURL).toBeDefined();
      expect(GROK_PROVIDER.defaultModel).toBeDefined();
      expect(GROK_PROVIDER.configDirName).toBe('.ax-grok');
    });

    it('should have valid models', () => {
      expect(Object.keys(GROK_PROVIDER.models).length).toBeGreaterThan(0);
      expect(GROK_PROVIDER.models[GROK_PROVIDER.defaultModel]).toBeDefined();
    });

    it('should have branding info', () => {
      expect(GROK_PROVIDER.branding.cliName).toBeDefined();
      expect(GROK_PROVIDER.branding.primaryColor).toBeDefined();
    });
  });

  describe('AX_CLI_PROVIDER', () => {
    it('should have required fields', () => {
      expect(AX_CLI_PROVIDER.name).toBe('ax-cli');
      expect(AX_CLI_PROVIDER.displayName).toBeDefined();
      expect(AX_CLI_PROVIDER.defaultModel).toBeDefined();
      expect(AX_CLI_PROVIDER.configDirName).toBe('.ax-cli');
    });
  });

  describe('DEFAULT_PROVIDER', () => {
    it('should be a valid provider', () => {
      expect(DEFAULT_PROVIDER).toBeDefined();
      expect(DEFAULT_PROVIDER.name).toBeDefined();
      expect(DEFAULT_PROVIDER.models).toBeDefined();
    });
  });
});

describe('getProviderDefinition', () => {
  it('should return GLM provider', () => {
    const provider = getProviderDefinition('glm');
    expect(provider).toBe(GLM_PROVIDER);
  });

  it('should return Grok provider', () => {
    const provider = getProviderDefinition('grok');
    expect(provider).toBe(GROK_PROVIDER);
  });

  it('should return ax-cli provider', () => {
    const provider = getProviderDefinition('ax-cli');
    expect(provider).toBe(AX_CLI_PROVIDER);
  });

  it('should return undefined for unknown provider', () => {
    const provider = getProviderDefinition('unknown');
    expect(provider).toBeUndefined();
  });
});

describe('getAvailableProviders', () => {
  it('should return array of providers', () => {
    const providers = getAvailableProviders();
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThan(0);
  });

  it('should include GLM and Grok', () => {
    const providers = getAvailableProviders();
    const names = providers.map(p => p.name);
    expect(names).toContain('glm');
    expect(names).toContain('grok');
  });
});

describe('getProviderModelConfig', () => {
  it('should return model config for valid model', () => {
    const config = getProviderModelConfig(GLM_PROVIDER, 'glm-4.6');
    expect(config).toBeDefined();
    expect(config?.name).toBe('GLM-4.6');
  });

  it('should return undefined for invalid model', () => {
    const config = getProviderModelConfig(GLM_PROVIDER, 'invalid-model');
    expect(config).toBeUndefined();
  });

  it('should return config for Grok models', () => {
    const defaultModel = GROK_PROVIDER.defaultModel;
    const config = getProviderModelConfig(GROK_PROVIDER, defaultModel);
    expect(config).toBeDefined();
  });
});

describe('getApiKeyFromEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars
    delete process.env.ZAI_API_KEY;
    delete process.env.GLM_API_KEY;
    delete process.env.YOUR_API_KEY;
    delete process.env.XAI_API_KEY;
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('should return API key from primary env var', () => {
    process.env.ZAI_API_KEY = 'test-key';
    const key = getApiKeyFromEnv(GLM_PROVIDER);
    expect(key).toBe('test-key');
  });

  it('should return API key from alias env var', () => {
    process.env.GLM_API_KEY = 'alias-key';
    const key = getApiKeyFromEnv(GLM_PROVIDER);
    expect(key).toBe('alias-key');
  });

  it('should return undefined if no env var set', () => {
    const key = getApiKeyFromEnv(GLM_PROVIDER);
    expect(key).toBeUndefined();
  });

  it('should work for Grok provider', () => {
    process.env.XAI_API_KEY = 'grok-key';
    const key = getApiKeyFromEnv(GROK_PROVIDER);
    expect(key).toBe('grok-key');
  });
});

describe('CONFIG_FILE_NAMES', () => {
  it('should have config filename', () => {
    expect(CONFIG_FILE_NAMES.USER_CONFIG).toBeDefined();
    expect(CONFIG_FILE_NAMES.USER_CONFIG).toBe('config.json');
  });

  it('should have custom instructions filename', () => {
    expect(CONFIG_FILE_NAMES.CUSTOM_MD).toBeDefined();
    expect(CONFIG_FILE_NAMES.CUSTOM_MD).toBe('CUSTOM.md');
  });

  it('should have all expected file names', () => {
    expect(CONFIG_FILE_NAMES.PROJECT_SETTINGS).toBeDefined();
    expect(CONFIG_FILE_NAMES.AX_MD).toBeDefined();
    expect(CONFIG_FILE_NAMES.INDEX_JSON).toBeDefined();
    expect(CONFIG_FILE_NAMES.MEMORY_JSON).toBeDefined();
  });
});

describe('getProviderConfigPaths', () => {
  it('should return config paths for GLM', () => {
    const paths = getProviderConfigPaths(GLM_PROVIDER);
    expect(paths.DIR_NAME).toBe('.ax-glm');
    expect(paths.USER_CONFIG).toContain('config.json');
    expect(paths.CUSTOM_MD).toContain('CUSTOM.md');
  });

  it('should return config paths for Grok', () => {
    const paths = getProviderConfigPaths(GROK_PROVIDER);
    expect(paths.DIR_NAME).toBe('.ax-grok');
  });

  it('should return both user and project paths', () => {
    const paths = getProviderConfigPaths(GLM_PROVIDER);
    expect(paths.USER_DIR).toBeDefined();
    expect(paths.PROJECT_DIR).toBeDefined();
  });
});

describe('getConfigPathsByProviderName', () => {
  it('should return paths for valid provider', () => {
    const paths = getConfigPathsByProviderName('glm');
    expect(paths).toBeDefined();
    expect(paths?.DIR_NAME).toBe('.ax-glm');
  });

  it('should return undefined for invalid provider', () => {
    const paths = getConfigPathsByProviderName('invalid');
    expect(paths).toBeUndefined();
  });
});

describe('setActiveProviderConfigPaths and getActiveProvider', () => {
  it('should set and get active provider', () => {
    setActiveProviderConfigPaths(GLM_PROVIDER);
    const active = getActiveProvider();
    expect(active.name).toBe('glm');
  });

  it('should change active provider', () => {
    setActiveProviderConfigPaths(GLM_PROVIDER);
    expect(getActiveProvider().name).toBe('glm');

    setActiveProviderConfigPaths(GROK_PROVIDER);
    expect(getActiveProvider().name).toBe('grok');
  });
});

describe('getActiveConfigPaths', () => {
  it('should return current active config paths', () => {
    setActiveProviderConfigPaths(GLM_PROVIDER);
    const paths = getActiveConfigPaths();
    expect(paths).toBeDefined();
    expect(paths.USER_DIR).toBeDefined();
    expect(paths.PROJECT_DIR).toBeDefined();
  });
});

describe('MODEL_ALIASES', () => {
  it('should have aliases defined', () => {
    expect(typeof MODEL_ALIASES).toBe('object');
  });
});

describe('resolveModelAlias', () => {
  it('should resolve alias to model name', () => {
    // Get an alias from MODEL_ALIASES
    const aliases = Object.keys(MODEL_ALIASES);
    if (aliases.length > 0) {
      const alias = aliases[0];
      const resolved = resolveModelAlias(alias);
      expect(resolved).toBe(MODEL_ALIASES[alias]);
    }
  });

  it('should return original if not an alias', () => {
    const result = resolveModelAlias('glm-4.6');
    expect(result).toBe('glm-4.6');
  });

  it('should return original for unknown alias', () => {
    const result = resolveModelAlias('unknown-alias');
    expect(result).toBe('unknown-alias');
  });
});

describe('getProviderModelAliases', () => {
  it('should return aliases for provider models', () => {
    const aliases = getProviderModelAliases(GLM_PROVIDER);
    expect(typeof aliases).toBe('object');
  });
});

describe('isModelAlias', () => {
  it('should return true for known aliases', () => {
    const aliases = Object.keys(MODEL_ALIASES);
    if (aliases.length > 0) {
      expect(isModelAlias(aliases[0])).toBe(true);
    }
  });

  it('should return false for non-aliases', () => {
    expect(isModelAlias('glm-4.6')).toBe(false);
    expect(isModelAlias('not-an-alias')).toBe(false);
  });
});

describe('getAvailableModelsWithAliases', () => {
  it('should return models with aliases for GLM', () => {
    const models = getAvailableModelsWithAliases(GLM_PROVIDER);
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  it('should include model ids', () => {
    const models = getAvailableModelsWithAliases(GLM_PROVIDER);
    const modelIds = models.map(m => m.model);
    expect(modelIds).toContain('glm-4.6');
  });

  it('should mark default model', () => {
    const models = getAvailableModelsWithAliases(GLM_PROVIDER);
    const defaultModel = models.find(m => m.isDefault);
    expect(defaultModel).toBeDefined();
    expect(defaultModel?.model).toBe(GLM_PROVIDER.defaultModel);
  });

  it('should include aliases where available', () => {
    const models = getAvailableModelsWithAliases(GLM_PROVIDER);
    const modelsWithAliases = models.filter(m => m.alias);
    // GLM should have some models with aliases
    expect(modelsWithAliases.length).toBeGreaterThan(0);
  });
});
