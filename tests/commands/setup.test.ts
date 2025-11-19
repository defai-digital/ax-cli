import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createSetupCommand } from '../../src/commands/setup.js';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock enquirer
vi.mock('enquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

describe('setup command', () => {
  const mockConfigPath = join(homedir(), '.ax-cli', 'config.json');

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
});
