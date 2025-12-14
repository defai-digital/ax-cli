import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommandSuggestions } from '../../../packages/core/src/ui/hooks/use-command-suggestions.js';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});

const mockCustomCommandsManager = {
  getAllCommands: vi.fn(() => [{ name: 'custom', description: 'Custom command' }]),
};

vi.mock('../../../packages/core/src/llm/tools.js', () => ({
  getMCPResources: vi.fn(),
  getMCPPrompts: vi.fn(() => [{ name: 'docs', description: 'Docs prompt' }]),
}));

vi.mock('../../../packages/core/src/provider/config.js', () => ({
  getActiveProvider: vi.fn(() => ({
    displayName: 'TestAI',
    models: { 'glm-4.6': {} },
  })),
}));

vi.mock('../../../packages/core/src/commands/custom-commands.js', () => ({
  getCustomCommandsManager: () => mockCustomCommandsManager,
}));

vi.mock('../../../packages/core/src/mcp/prompts.js', () => ({
  promptToSlashCommand: (prompt: any) => `/prompt-${prompt.name}`,
  getPromptDescription: (prompt: any) => prompt.description ?? 'prompt',
}));

// Bring mocked functions into scope for control
import { getMCPResources } from '../../../packages/core/src/llm/tools.js';

describe('useCommandSuggestions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('builds command suggestions and toggles visibility based on input', () => {
    const { result } = renderHook(() => useCommandSuggestions());

    // Slash input shows suggestions
    act(() => result.current.handleInputChange('/he'));
    expect(result.current.showCommandSuggestions).toBe(true);

    // Plain input hides suggestions
    act(() => result.current.handleInputChange('hello'));
    expect(result.current.showCommandSuggestions).toBe(false);

    // Provider models surface /model command and model options
    const commands = result.current.getCurrentSuggestions('/model');
    expect(commands.find(c => c.command === '/model')).toBeTruthy();
    expect(result.current.availableModels).toEqual([{ model: 'glm-4.6' }]);
  });

  it('loads MCP resources and switches to resource mode', async () => {
    (getMCPResources as unknown as vi.Mock).mockResolvedValue([
      { reference: '@mcp:db/users', name: 'Users', description: 'User table' },
      { reference: '@mcp:db/logs', name: 'Logs', description: 'Log data' },
    ]);

    const { result } = renderHook(() => useCommandSuggestions());

    await act(async () => {
      result.current.handleInputChange('@mcp:db');
      // flush promise resolution
      await Promise.resolve();
    });

    expect(result.current.suggestionMode).toBe('resource');
    expect(result.current.resourceSuggestions).toHaveLength(2);
    const current = result.current.getCurrentSuggestions('@mcp:db');
    expect(current[0].command).toBe('@mcp:db/users');
  });

  it('ignores stale MCP results when query changes', async () => {
    let resolveFirst: (value: any) => void;
    let resolveSecond: (value: any) => void;

    (getMCPResources as unknown as vi.Mock)
      .mockImplementationOnce(() => new Promise(res => { resolveFirst = res; }))
      .mockImplementationOnce(() => new Promise(res => { resolveSecond = res; }));

    const { result } = renderHook(() => useCommandSuggestions());

    act(() => result.current.handleInputChange('@mcp:first'));
    act(() => result.current.handleInputChange('@mcp:second'));

    await act(async () => {
      resolveFirst?.([{ reference: '@mcp:first', name: 'first' }]);
      await Promise.resolve();
    });

    // Stale result should be ignored
    expect(result.current.resourceSuggestions).toEqual([]);
    expect(result.current.suggestionMode).toBe('command');

    await act(async () => {
      resolveSecond?.([{ reference: '@mcp:second', name: 'second' }]);
      await Promise.resolve();
    });

    expect(result.current.suggestionMode).toBe('resource');
    expect(result.current.resourceSuggestions[0].reference).toBe('@mcp:second');
  });
});
