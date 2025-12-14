import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const {
  mockCreateCLI,
  mockGetSettingsManager,
  mockGetApiKeyFromEnv,
  mockGrokProvider,
  mockCreateXSearchCommand,
  mockAddCommand,
  mockParse,
} = vi.hoisted(() => {
  const mockAddCommand = vi.fn();
  const mockParse = vi.fn();
  const cliInstance = { addCommand: mockAddCommand, parse: mockParse };

  return {
    mockCreateCLI: vi.fn(() => cliInstance),
    mockGetSettingsManager: vi.fn(() => ({
      getApiKey: vi.fn().mockReturnValue('manager-key'),
      getBaseURL: vi.fn().mockReturnValue('https://manager.base'),
    })),
    mockGetApiKeyFromEnv: vi.fn(() => 'env-key'),
    mockGrokProvider: { name: 'grok', defaultBaseURL: 'https://api.grok' },
    mockCreateXSearchCommand: vi.fn(() => ({ name: 'x-search' })),
    mockAddCommand,
    mockParse,
  };
});

vi.mock('@defai.digital/ax-core', () => ({
  createCLI: mockCreateCLI,
  GROK_PROVIDER: mockGrokProvider,
  getSettingsManager: mockGetSettingsManager,
  getApiKeyFromEnv: mockGetApiKeyFromEnv,
}));

vi.mock('../../packages/ax-grok/src/commands/x-search.js', () => ({
  createXSearchCommand: mockCreateXSearchCommand,
}));

describe('ax-grok entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateCLI.mockClear();
    mockGetSettingsManager.mockClear();
    mockGetApiKeyFromEnv.mockClear();
    mockCreateXSearchCommand.mockClear();
    mockAddCommand.mockClear();
    mockParse.mockClear();
  });

  it('wires the CLI with Grok defaults and helpers', async () => {
    const pkg = require('../../packages/ax-grok/package.json') as { version: string };

    await import('../../packages/ax-grok/src/index.js');

    expect(mockCreateCLI).toHaveBeenCalledWith({
      provider: mockGrokProvider,
      version: pkg.version,
    });
    expect(mockCreateXSearchCommand).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
    expect(mockAddCommand).toHaveBeenCalledWith(expect.anything());
    expect(mockParse).toHaveBeenCalled();

    const [getApiKeyFn, getBaseUrlFn] = mockCreateXSearchCommand.mock.calls[0] as [
      () => string | undefined,
      () => string
    ];

    mockGetApiKeyFromEnv.mockReturnValueOnce('env-key');
    expect(getApiKeyFn()).toBe('env-key');

    const settings = { getApiKey: vi.fn().mockReturnValue('manager-key'), getBaseURL: vi.fn().mockReturnValue('https://manager.base') };
    mockGetApiKeyFromEnv.mockReturnValueOnce(undefined);
    mockGetSettingsManager.mockReturnValue(settings);
    expect(getApiKeyFn()).toBe('manager-key');
    expect(getBaseUrlFn()).toBe('https://manager.base');

    mockGetSettingsManager.mockReturnValue({
      getApiKey: vi.fn(),
      getBaseURL: vi.fn().mockReturnValue(undefined),
    });
    expect(getBaseUrlFn()).toBe(mockGrokProvider.defaultBaseURL);
  });

  it('re-exports SDK helpers for programmatic usage', async () => {
    const sdk = await import('../../packages/ax-grok/src/sdk.js');
    expect(typeof sdk.SDKError).toBe('function');
  });
});
