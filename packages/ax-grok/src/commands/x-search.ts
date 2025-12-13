/**
 * X Search Command
 *
 * CLI command for searching X (Twitter) posts using Grok's x_search server tool.
 * Leverages xAI Agent Tools API for server-side search execution.
 *
 * Usage:
 *   ax-grok x-search "query"                    # Basic keyword search
 *   ax-grok x-search "query" --semantic         # AI-powered semantic search
 *   ax-grok x-search "query" --time-range 24h   # Filter by time range
 *   ax-grok x-search "query" --limit 20         # Limit results
 *   ax-grok x-search "query" --json             # Output as JSON
 *
 * @see https://docs.x.ai/docs/guides/tools/overview
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getUsageTracker } from '@defai.digital/ax-core';

/**
 * X Search options from CLI
 */
export interface XSearchOptions {
  /** Search query */
  query: string;
  /**
   * Search type:
   * - 'keyword': Exact keyword matching (default)
   * - 'semantic': AI-powered semantic search
   */
  searchType: 'keyword' | 'semantic';
  /** Time range filter (e.g., '1h', '24h', '7d', '30d') */
  timeRange?: string;
  /** Maximum number of results (default: 10) */
  limit: number;
  /** Output format */
  outputFormat: 'text' | 'json';
}

/**
 * X Search result from xAI API
 */
export interface XSearchResult {
  /** Tweet ID */
  id: string;
  /** Tweet text content */
  text: string;
  /** Author username */
  author: string;
  /** Author display name */
  authorName?: string;
  /** Tweet timestamp (ISO format) */
  timestamp: string;
  /** Engagement metrics */
  engagement: {
    likes: number;
    retweets: number;
    replies: number;
  };
  /** Direct link to tweet */
  url?: string;
}

/**
 * X Search response
 */
export interface XSearchResponse {
  /** Whether the search was successful */
  success: boolean;
  /** Search results */
  results: XSearchResult[];
  /** Total results found (may be more than returned) */
  totalFound?: number;
  /** Error message if failed */
  error?: string;
  /** Search metadata */
  metadata?: {
    query: string;
    searchType: string;
    timeRange?: string;
    executionTimeMs: number;
  };
}

/**
 * Execute X search using Grok's x_search server tool
 *
 * @param query - Search query
 * @param options - Search options
 * @param apiKey - xAI API key
 * @param baseUrl - API base URL
 * @returns Search response with results
 */
export async function executeXSearch(
  query: string,
  options: Partial<XSearchOptions>,
  apiKey: string,
  baseUrl: string = 'https://api.x.ai/v1'
): Promise<XSearchResponse> {
  const startTime = Date.now();
  const searchType = options.searchType ?? 'keyword';
  const limit = options.limit ?? 10;

  try {
    // Build the request to use x_search server tool
    const requestBody = {
      model: 'grok-4.1-fast-reasoning', // Best for tool use
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that searches X (Twitter) for relevant posts.
When using the x_search tool, return the results in a structured format.
For each result, include: id, text, author, timestamp, and engagement metrics (likes, retweets, replies).
Format your response as a JSON array of results.`,
        },
        {
          role: 'user',
          content: `Search X for: "${query}"${options.timeRange ? ` (from the last ${options.timeRange})` : ''}. Return up to ${limit} results.`,
        },
      ],
      // Enable x_search server tool
      server_tools: ['x_search'],
      server_tool_config: {
        x_search: {
          search_type: searchType,
          ...(options.timeRange && { time_range: options.timeRange }),
          max_results: limit,
        },
      },
      // Ensure we get structured output
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent results
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use default error message
      }
      return {
        success: false,
        results: [],
        error: errorMessage,
      };
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    // Extract results from the response
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        results: [],
        error: 'No response content from API',
      };
    }

    // Parse the JSON response
    let results: XSearchResult[] = [];
    try {
      const parsed = JSON.parse(content) as { results?: XSearchResult[] } | XSearchResult[];
      if (Array.isArray(parsed)) {
        results = parsed;
      } else if (parsed.results && Array.isArray(parsed.results)) {
        results = parsed.results;
      }
    } catch {
      // If parsing fails, the model might have returned text instead of JSON
      return {
        success: true,
        results: [],
        error: 'Could not parse search results as JSON',
        metadata: {
          query,
          searchType,
          timeRange: options.timeRange,
          executionTimeMs: Date.now() - startTime,
        },
      };
    }

    // Track x_search usage for performance metrics
    getUsageTracker().trackXSearch(results.length, searchType);

    return {
      success: true,
      results,
      totalFound: results.length,
      metadata: {
        query,
        searchType,
        timeRange: options.timeRange,
        executionTimeMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Format search results for terminal output
 */
function formatResults(response: XSearchResponse): string {
  if (!response.success) {
    return chalk.red(`Error: ${response.error}`);
  }

  if (response.results.length === 0) {
    return chalk.yellow('No results found.');
  }

  const lines: string[] = [
    chalk.bold.cyan(`\n📱 X Search Results (${response.results.length} found)\n`),
    chalk.dim(`Query: "${response.metadata?.query}" | Type: ${response.metadata?.searchType}`),
    chalk.dim(`─`.repeat(60)),
  ];

  for (const result of response.results) {
    lines.push('');
    lines.push(chalk.bold(`@${result.author}`) + (result.authorName ? chalk.dim(` (${result.authorName})`) : ''));
    lines.push(result.text);
    lines.push(
      chalk.dim(
        `❤️ ${result.engagement.likes}  🔄 ${result.engagement.retweets}  💬 ${result.engagement.replies}` +
        (result.timestamp ? `  📅 ${new Date(result.timestamp).toLocaleDateString()}` : '')
      )
    );
    if (result.url) {
      lines.push(chalk.blue(result.url));
    }
    lines.push(chalk.dim(`─`.repeat(60)));
  }

  if (response.metadata?.executionTimeMs) {
    lines.push(chalk.dim(`\nCompleted in ${response.metadata.executionTimeMs}ms`));
  }

  return lines.join('\n');
}

/**
 * Create the x-search CLI command
 */
export function createXSearchCommand(
  getApiKey: () => string | undefined,
  getBaseUrl: () => string
): Command {
  const cmd = new Command('x-search')
    .description('Search X (Twitter) posts using Grok\'s x_search server tool')
    .argument('<query>', 'Search query')
    .option('-s, --semantic', 'Use semantic search (AI-powered) instead of keyword search')
    .option('-t, --time-range <range>', 'Time range filter (e.g., 1h, 24h, 7d, 30d)')
    .option('-l, --limit <number>', 'Maximum number of results', '10')
    .option('--json', 'Output results as JSON')
    .action(async (query: string, options: {
      semantic?: boolean;
      timeRange?: string;
      limit?: string;
      json?: boolean;
    }) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        console.error(chalk.red('Error: No API key configured.'));
        console.error(chalk.yellow('Run: ax-grok setup'));
        process.exit(1);
      }

      const baseUrl = getBaseUrl();
      const searchOptions: Partial<XSearchOptions> = {
        searchType: options.semantic ? 'semantic' : 'keyword',
        timeRange: options.timeRange,
        limit: parseInt(options.limit ?? '10', 10),
      };

      console.log(chalk.dim(`Searching X for "${query}"...`));

      const response = await executeXSearch(query, searchOptions, apiKey, baseUrl);

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
      } else {
        console.log(formatResults(response));
      }

      process.exit(response.success ? 0 : 1);
    });

  return cmd;
}
