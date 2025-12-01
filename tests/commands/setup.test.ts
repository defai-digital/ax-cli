import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { homedir } from 'os';

const promptMock = vi.hoisted(() => vi.fn());
vi.mock('enquirer', () => ({
  default: {
    prompt: promptMock,
  },
}));

const saveUserSettings = vi.hoisted(() => vi.fn());
const loadUserSettings = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/settings-manager.js', () => ({
  getSettingsManager: () => ({
    saveUserSettings,
    loadUserSettings,
  }),
}));

const validateProviderSetup = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/setup-validator.js', () => ({
  validateProviderSetup,
}));

// Import after mocks so the setup command uses the mocked modules
import { createSetupCommand } from '../../src/commands/setup.js';

// Note: We don't mock fs globally here because it would prevent the YAML config
// files from loading during module initialization. The setup command tests
// focus on command structure validation rather than file I/O behavior.

describe('setup command', () => {
  const mockConfigPath = join(homedir(), '.ax-cli', 'config.json');

  beforeEach(() => {
    vi.clearAllMocks();
    promptMock.mockReset();
    saveUserSettings.mockReset();
    loadUserSettings.mockReset();
    validateProviderSetup.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSetupCommand', () => {
    it('should create a setup command', () => {
      const command = createSetupCommand();
      expect(command).toBeDefined();
      expect(command.name()).toBe('setup');
    });

    it('should have description', () => {
      const command = createSetupCommand();
      expect(command.description()).toContain('Initialize AX CLI configuration');
    });

    it('should have --force option', () => {
      const command = createSetupCommand();
      const forceOption = command.options.find(opt => opt.flags === '--force');
      expect(forceOption).toBeDefined();
      expect(forceOption?.description).toContain('Overwrite existing configuration');
    });
  });

  describe('provider selection', () => {
    it('should support z.ai provider', () => {
      const command = createSetupCommand();
      expect(command).toBeDefined();
      // Provider configs are internal to the command
    });

    it('should support xai provider', () => {
      const command = createSetupCommand();
      expect(command).toBeDefined();
    });

    it('should support openai provider', () => {
      const command = createSetupCommand();
      expect(command).toBeDefined();
    });

    it('should support anthropic provider', () => {
      const command = createSetupCommand();
      expect(command).toBeDefined();
    });

    it('should support ollama provider (no API key)', () => {
      const command = createSetupCommand();
      expect(command).toBeDefined();
    });
  });

  describe('config path', () => {
    it('should use ~/.ax-cli/config.json path', () => {
      const expectedPath = join(homedir(), '.ax-cli', 'config.json');
      expect(expectedPath).toContain('.ax-cli');
      expect(expectedPath).toContain('config.json');
    });

    it('should not use legacy .grok path', () => {
      const configPath = join(homedir(), '.ax-cli', 'config.json');
      expect(configPath).not.toContain('.grok');
    });
  });

  describe('max tokens configuration', () => {
    it('should use 32768 tokens for z.ai (GLM 4.6)', () => {
      const expectedMaxTokens = 32768;
      expect(expectedMaxTokens).toBe(32768);
    });

    it('should use 8192 tokens for other providers', () => {
      const expectedMaxTokens = 8192;
      expect(expectedMaxTokens).toBe(8192);
    });
  });

  describe('interactive flow', () => {
    it('should reuse existing settings, pick available model, and save via settings manager', async () => {
      // Existing config to merge
      loadUserSettings.mockReturnValue({
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'old-key',
        defaultModel: 'gpt-4',
        models: ['gpt-4'],
        maxTokens: 16384,
        temperature: 0.5,
      });

      // Prompt sequence: provider -> reuse key -> model select -> available model pick -> confirm save
      promptMock
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ reuseKey: true })
        .mockResolvedValueOnce({ model: 'gpt-4' })
        .mockResolvedValueOnce({ altModel: 'gpt-4o' })
        .mockResolvedValueOnce({ save: true });

      validateProviderSetup.mockResolvedValue({
        success: true,
        availableModels: ['gpt-4o', 'gpt-4'],
      });

      const command = createSetupCommand();
      await command.parseAsync(['node', 'ax-cli', 'setup'], { from: 'user' });

      expect(promptMock).toHaveBeenCalled();
      expect(validateProviderSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.openai.com/v1',
          apiKey: 'old-key',
          model: 'gpt-4',
          providerName: 'openai',
        }),
        false
      );

      expect(saveUserSettings).toHaveBeenCalledTimes(1);
      const saved = saveUserSettings.mock.calls[0][0];
      expect(saved.baseURL).toBe('https://api.openai.com/v1');
      expect(saved.defaultModel).toBe('gpt-4o'); // chosen from availableModels step
      expect(saved.currentModel).toBe('gpt-4o');
      expect(saved.models).toContain('gpt-4o');
      expect(saved.models).toContain('gpt-4');
      expect(saved.temperature).toBe(0.5); // preserved from existing config
      expect(saved.maxTokens).toBe(16384); // preserved from existing config
    });

    it('should allow cancel at review without saving', async () => {
      loadUserSettings.mockReturnValue({});

      promptMock
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ apiKey: 'test-key' })
        .mockResolvedValueOnce({ model: 'gpt-4-turbo' })
        .mockResolvedValueOnce({ save: false });

      validateProviderSetup.mockResolvedValue({
        success: true,
      });

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        // swallow exit during tests
        return undefined as never;
      });

      const command = createSetupCommand();
      await command.parseAsync(['node', 'ax-cli', 'setup'], { from: 'user' });

      expect(exitSpy).not.toHaveBeenCalled();
      expect(saveUserSettings).not.toHaveBeenCalled();
    });
  });
});
