import { describe, it, expect, beforeEach } from 'vitest';
import { ContextProvider } from '../context-provider.js';

describe('ContextProvider', () => {
  let contextProvider: ContextProvider;

  beforeEach(() => {
    contextProvider = new ContextProvider();
  });

  describe('formatContextForDisplay', () => {
    it('should format file context', () => {
      const context = {
        file: '/path/to/file.ts',
      };
      const result = contextProvider.formatContextForDisplay(context);
      expect(result).toContain('📄 File: /path/to/file.ts');
    });

    it('should format selection context', () => {
      const context = {
        file: '/path/to/file.ts',
        selection: 'const foo = "bar";',
        lineRange: '10-15',
      };
      const result = contextProvider.formatContextForDisplay(context);
      expect(result).toContain('📝 Selection: 18 characters');
      expect(result).toContain('📏 Lines: 10-15');
    });

    it('should format git diff context', () => {
      const context = {
        gitDiff: true,
      };
      const result = contextProvider.formatContextForDisplay(context);
      expect(result).toContain('🔄 Git: Uncommitted changes');
    });

    it('should format empty context', () => {
      const context = {};
      const result = contextProvider.formatContextForDisplay(context);
      expect(result).toBe('');
    });

    it('should format multiple context types', () => {
      const context = {
        file: '/path/to/file.ts',
        selection: 'code',
        lineRange: '1-10',
        gitDiff: true,
      };
      const result = contextProvider.formatContextForDisplay(context);
      expect(result).toContain('📄 File');
      expect(result).toContain('📝 Selection');
      expect(result).toContain('📏 Lines');
      expect(result).toContain('🔄 Git');
    });
  });
});

describe('Extension Package', () => {
  it('should have valid package.json structure', () => {
    const pkg = require('../../package.json');

    expect(pkg.name).toBe('ax-cli-vscode');
    expect(pkg.displayName).toBe('AX CLI');
    expect(pkg.version).toBeDefined();
    expect(pkg.publisher).toBe('defai-digital');
    expect(pkg.engines.vscode).toBeDefined();
  });

  it('should define all required commands', () => {
    const pkg = require('../../package.json');
    const commands = pkg.contributes.commands;

    const requiredCommands = [
      'ax-cli.openChat',
      'ax-cli.analyzeFile',
      'ax-cli.explainSelection',
      'ax-cli.generateTests',
      'ax-cli.refactorSelection',
      'ax-cli.documentCode',
      'ax-cli.findBugs',
      'ax-cli.reviewChanges',
      'ax-cli.selectModel',
      'ax-cli.configure',
    ];

    const commandIds = commands.map((cmd: any) => cmd.command);
    requiredCommands.forEach(cmd => {
      expect(commandIds).toContain(cmd);
    });
  });

  it('should define keybindings', () => {
    const pkg = require('../../package.json');
    const keybindings = pkg.contributes.keybindings;

    expect(keybindings).toBeDefined();
    expect(keybindings.length).toBeGreaterThan(0);
  });

  it('should define configuration settings', () => {
    const pkg = require('../../package.json');
    const config = pkg.contributes.configuration;

    // Note: API key is now stored in SecretStorage, not in configuration
    expect(config.properties['ax-cli.apiKey']).toBeUndefined();
    expect(config.properties['ax-cli.model']).toBeDefined();
    expect(config.properties['ax-cli.baseURL']).toBeDefined();
  });
});

describe('CLIBridge', () => {
  // Note: These tests would require mocking VSCode APIs and child processes
  // For now, we'll add placeholder tests

  it.skip('should send request to CLI', async () => {
    // TODO: Implement with proper mocking
  });

  it.skip('should handle CLI errors', async () => {
    // TODO: Implement with proper mocking
  });

  it.skip('should timeout long-running requests', async () => {
    // TODO: Implement with proper mocking
  });
});

describe('ChatViewProvider', () => {
  it.skip('should create webview with correct HTML', () => {
    // TODO: Implement with proper mocking
  });

  it.skip('should handle user messages', async () => {
    // TODO: Implement with proper mocking
  });

  it.skip('should apply code changes', async () => {
    // TODO: Implement with proper mocking
  });
});
