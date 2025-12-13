/**
 * Grok Server Tools Configuration
 *
 * Defines types and utilities for xAI Agent Tools API integration.
 * Server-side tools run entirely on xAI infrastructure for improved performance.
 *
 * Available server tools:
 * - web_search: Real-time web search for current information
 * - x_search: X (Twitter) posts search with keyword/semantic modes
 * - code_execution: Server-side Python execution sandbox
 *
 * @see https://docs.x.ai/docs/guides/tools/overview
 */

/**
 * Web search configuration for Grok's server-side web_search tool
 */
export interface WebSearchConfig {
  /** Enable web search (default: true) */
  enabled: boolean;
  /** Maximum number of search results (default: 10) */
  maxResults?: number;
}

/**
 * X (Twitter) search configuration for Grok's server-side x_search tool
 */
export interface XSearchConfig {
  /** Enable X search (default: true) */
  enabled: boolean;
  /**
   * Search type:
   * - 'keyword': Exact keyword matching
   * - 'semantic': AI-powered semantic search (default)
   */
  searchType?: 'keyword' | 'semantic';
  /**
   * Time range for posts (e.g., '24h', '7d', '30d')
   */
  timeRange?: string;
  /** Maximum number of results */
  maxResults?: number;
}

/**
 * Code execution configuration for Grok's server-side code_execution tool
 */
export interface CodeExecutionConfig {
  /** Enable code execution (default: true) */
  enabled: boolean;
  /** Execution timeout in milliseconds (default: 30000, max: 30000) */
  timeout?: number;
}

/**
 * Complete configuration for Grok server-side tools
 */
export interface GrokServerToolsConfig {
  /** Web search tool configuration */
  webSearch?: WebSearchConfig;
  /** X/Twitter search tool configuration */
  xSearch?: XSearchConfig;
  /** Code execution tool configuration */
  codeExecution?: CodeExecutionConfig;
}

/**
 * Default server tools configuration
 * All tools enabled with sensible defaults
 */
export const DEFAULT_GROK_SERVER_TOOLS: GrokServerToolsConfig = {
  webSearch: { enabled: true, maxResults: 10 },
  xSearch: { enabled: true, searchType: 'semantic' },
  codeExecution: { enabled: true, timeout: 30000 },
};

/**
 * Build the server_tools array for xAI API request
 *
 * @param config - Server tools configuration
 * @returns Array of enabled server tool names
 */
export function buildServerToolsArray(config: GrokServerToolsConfig = DEFAULT_GROK_SERVER_TOOLS): string[] {
  const tools: string[] = [];

  if (config.webSearch?.enabled) {
    tools.push('web_search');
  }
  if (config.xSearch?.enabled) {
    tools.push('x_search');
  }
  if (config.codeExecution?.enabled) {
    tools.push('code_execution');
  }

  return tools;
}

/**
 * Build the server_tool_config object for xAI API request
 *
 * @param config - Server tools configuration
 * @returns Server tool configuration object for API request
 */
export function buildServerToolConfig(config: GrokServerToolsConfig = DEFAULT_GROK_SERVER_TOOLS): Record<string, unknown> {
  const toolConfig: Record<string, unknown> = {};

  if (config.webSearch?.enabled) {
    toolConfig.web_search = {
      max_results: config.webSearch.maxResults ?? 10,
    };
  }

  if (config.xSearch?.enabled) {
    toolConfig.x_search = {
      search_type: config.xSearch.searchType ?? 'semantic',
      ...(config.xSearch.timeRange && { time_range: config.xSearch.timeRange }),
      ...(config.xSearch.maxResults && { max_results: config.xSearch.maxResults }),
    };
  }

  if (config.codeExecution?.enabled) {
    toolConfig.code_execution = {
      timeout: Math.min(config.codeExecution.timeout ?? 30000, 30000), // Max 30s
    };
  }

  return toolConfig;
}

/**
 * Check if any server tools are enabled
 */
export function hasEnabledServerTools(config: GrokServerToolsConfig): boolean {
  return (
    config.webSearch?.enabled === true ||
    config.xSearch?.enabled === true ||
    config.codeExecution?.enabled === true
  );
}

/**
 * Merge user config with defaults
 */
export function mergeServerToolsConfig(
  userConfig?: Partial<GrokServerToolsConfig>
): GrokServerToolsConfig {
  if (!userConfig) {
    return DEFAULT_GROK_SERVER_TOOLS;
  }

  return {
    webSearch: userConfig.webSearch ?? DEFAULT_GROK_SERVER_TOOLS.webSearch,
    xSearch: userConfig.xSearch ?? DEFAULT_GROK_SERVER_TOOLS.xSearch,
    codeExecution: userConfig.codeExecution ?? DEFAULT_GROK_SERVER_TOOLS.codeExecution,
  };
}
