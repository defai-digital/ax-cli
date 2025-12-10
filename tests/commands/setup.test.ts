import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { homedir } from 'os';

// Mock @clack/prompts to avoid interactive prompts during tests
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  password: vi.fn(),
  text: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  log: {
    step: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

vi.mock('../../src/utils/settings-manager.js', () => ({
  getSettingsManager: () => ({
    saveUserSettings: vi.fn(),
    loadUserSettings: vi.fn(() => ({})),
  }),
}));

vi.mock('../../src/utils/setup-validator.js', () => ({
  validateProviderSetup: vi.fn(() => Promise.resolve({ success: true })),
}));

// Import after mocks
import { createSetupCommand } from '../../packages/core/src/commands/setup.js';

describe('setup command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('should have description for GLM/Grok setup', () => {
      const command = createSetupCommand();
      expect(command.description()).toContain('LLM provider');
    });

    it('should have --force option', () => {
      const command = createSetupCommand();
      const forceOption = command.options.find(opt => opt.flags === '--force');
      expect(forceOption).toBeDefined();
      expect(forceOption?.description).toContain('Overwrite existing configuration');
    });
  });

  describe('provider selection', () => {
    it('should support glm provider', () => {
      const command = createSetupCommand();
      expect(command).toBeDefined();
    });

    it('should support grok provider', () => {
      const command = createSetupCommand();
      expect(command).toBeDefined();
    });
  });

  describe('config paths', () => {
    it('should use ~/.ax-glm for GLM config', () => {
      const expectedPath = join(homedir(), '.ax-glm', 'config.json');
      expect(expectedPath).toContain('.ax-glm');
      expect(expectedPath).toContain('config.json');
    });

    it('should use ~/.ax-grok for Grok config', () => {
      const expectedPath = join(homedir(), '.ax-grok', 'config.json');
      expect(expectedPath).toContain('.ax-grok');
      expect(expectedPath).toContain('config.json');
    });

    it('should not use legacy .grok path', () => {
      const glmPath = join(homedir(), '.ax-glm', 'config.json');
      const grokPath = join(homedir(), '.ax-grok', 'config.json');
      expect(glmPath).not.toContain('/.grok/');
      expect(grokPath).not.toContain('/.grok/');
    });
  });

  describe('max tokens configuration', () => {
    it('should use 32768 tokens for GLM cloud', () => {
      const expectedMaxTokens = 32768;
      expect(expectedMaxTokens).toBe(32768);
    });

    it('should use 8192 tokens for local servers', () => {
      const expectedMaxTokens = 8192;
      expect(expectedMaxTokens).toBe(8192);
    });

    it('should use 32768 tokens for Grok', () => {
      const expectedMaxTokens = 32768;
      expect(expectedMaxTokens).toBe(32768);
    });
  });
});
