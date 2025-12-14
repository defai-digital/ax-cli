import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const { mockRunCLI, mockGLMProvider } = vi.hoisted(() => ({
  mockRunCLI: vi.fn(),
  mockGLMProvider: { name: 'glm', defaultBaseURL: 'https://api.z.ai' },
}));

vi.mock('@defai.digital/ax-core', () => ({
  runCLI: mockRunCLI,
  GLM_PROVIDER: mockGLMProvider,
}));

describe('ax-glm entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
    mockRunCLI.mockClear();
  });

  it('delegates to the core CLI with GLM defaults', async () => {
    const pkg = require('../../packages/ax-glm/package.json') as { version: string };

    await import('../../packages/ax-glm/src/index.js');

    expect(mockRunCLI).toHaveBeenCalledWith({
      provider: mockGLMProvider,
      version: pkg.version,
    });
  });

  it('re-exports SDK symbols for programmatic usage', async () => {
    const sdk = await import('../../packages/ax-glm/src/sdk.js');
    expect(typeof sdk.SDKError).toBe('function');
  });
});
