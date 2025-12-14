import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createXSearchCommand,
  executeXSearch,
  type XSearchResponse,
} from '../../packages/ax-grok/src/commands/x-search.js';

const trackXSearch = vi.fn();

vi.mock('@defai.digital/ax-core', () => ({
  getUsageTracker: () => ({ trackXSearch }),
}));

const mockFetch = vi.fn();

describe('ax-grok x-search command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('executes a keyword search and returns structured results', async () => {
    const now = new Date('2024-01-01T00:00:00Z').toISOString();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  id: '1',
                  text: 'hello world',
                  author: 'tester',
                  authorName: 'Tester',
                  timestamp: now,
                  engagement: { likes: 1, retweets: 2, replies: 3 },
                  url: 'https://x.com/1',
                },
              ]),
            },
          },
        ],
      }),
    });

    const result = await executeXSearch(
      'hello world',
      { searchType: 'semantic', limit: 5, timeRange: '24h' },
      'api-key',
      'https://api.test'
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test/chat/completions',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(result.success).toBe(true);
    expect(result.results[0]).toMatchObject({
      id: '1',
      author: 'tester',
      engagement: { likes: 1, retweets: 2, replies: 3 },
    });
    expect(result.metadata?.timeRange).toBe('24h');
    expect(trackXSearch).toHaveBeenCalledWith(1, 'semantic');
  });

  it('handles API errors with descriptive messaging', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'server error',
    });

    const result = await executeXSearch('fail query', {}, 'api-key', 'https://api.test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
    expect(result.results).toHaveLength(0);
  });

  it('surfaces parse errors when the model does not return JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'not-json',
            },
          },
        ],
      }),
    });

    const result = await executeXSearch('parse', {}, 'api-key', 'https://api.test');

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(0);
    expect(result.error).toMatch(/Could not parse/i);
  });

  it('formats terminal output and exits with CLI-friendly codes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                results: [
                  {
                    id: '42',
                    text: 'formatted',
                    author: 'ax',
                    authorName: 'AX Bot',
                    timestamp: new Date('2024-05-01T00:00:00Z').toISOString(),
                    engagement: { likes: 2, retweets: 1, replies: 0 },
                    url: 'https://x.com/42',
                  },
                ],
              }),
            },
          },
        ],
      }),
    });

    let exitCode = -1;
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      exitCode = code ?? 0;
      return undefined as never;
    }) as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const cmd = createXSearchCommand(() => 'api-key', () => 'https://api.test');
    await cmd.parseAsync(['formatted'], { from: 'user' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, requestInit] = mockFetch.mock.calls[0] as [string, { body?: unknown }];
    const requestBody = JSON.parse(requestInit.body as string);
    expect(requestBody.server_tool_config.x_search.max_results).toBe(10);
    expect(requestBody.server_tool_config.x_search.search_type).toBe('keyword');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('X Search Results'));
    expect(exitCode).toBe(0);

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('prints helpful errors when no API key is configured', async () => {
    let exitCode = 0;
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      exitCode = code ?? 0;
      throw new Error('exit');
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const cmd = createXSearchCommand(() => undefined, () => 'https://api.test');
    await expect(cmd.parseAsync(['missing'], { from: 'user' })).rejects.toThrow('exit');

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: No API key configured.'));

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
