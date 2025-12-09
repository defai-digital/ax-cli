/**
 * MCP Server Registry Integration (Phase 5)
 *
 * Enables discovery and installation of MCP servers from the GitHub MCP Registry
 * Provides one-command install and browsing capabilities
 */

import axios from 'axios';
import type { MCPServerConfig } from '../schemas/settings-schemas.js';
import { extractErrorMessage } from '../utils/error-handler.js';

export interface RegistryServer {
  /** Server name/identifier */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Server description */
  description: string;
  /** GitHub repository URL */
  repository: string;
  /** GitHub stars count */
  stars: number;
  /** Server category (design, deployment, database, etc.) */
  category: string;
  /** Transport type */
  transport: 'stdio' | 'http' | 'sse';
  /** NPM package name (for stdio servers) */
  packageName?: string;
  /** Install command */
  installCommand: string;
  /** Whether this is an official/verified server */
  verified: boolean;
  /** Author/organization */
  author: string;
  /** Latest version */
  version?: string;
  /** Homepage URL */
  homepage?: string;
}

export interface RegistrySearchOptions {
  /** Search query */
  query?: string;
  /** Filter by category */
  category?: string;
  /** Filter by transport type */
  transport?: 'stdio' | 'http' | 'sse';
  /** Sort by (stars, name, updated) */
  sortBy?: 'stars' | 'name' | 'updated';
  /** Max results to return */
  limit?: number;
}

/**
 * Search the MCP server registry
 */
export async function searchRegistry(options: RegistrySearchOptions = {}): Promise<RegistryServer[]> {
  const {
    query = '',
    category,
    transport,
    sortBy = 'stars',
    limit = 20
  } = options;

  try {
    // Search GitHub for MCP servers
    const searchQuery = buildGitHubSearchQuery(query, category, transport);
    const sort = sortBy === 'stars' ? 'stars' : sortBy === 'updated' ? 'updated' : undefined;

    const response = await axios.get('https://api.github.com/search/repositories', {
      params: {
        q: searchQuery,
        sort,
        order: 'desc',
        per_page: Math.min(limit, 100)
      },
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ax-cli-mcp-registry'
      }
    });

    // Parse and filter results
    const servers = response.data.items
      .map(parseGitHubRepo)
      .filter((server: RegistryServer | null): server is RegistryServer => server !== null);

    return servers;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please try again later or set GITHUB_TOKEN env var.');
    }
    throw new Error(`Failed to search registry: ${extractErrorMessage(error)}`);
  }
}

/**
 * Get details for a specific server from the registry
 */
export async function getRegistryServer(nameOrPackage: string): Promise<RegistryServer | null> {
  try {
    // Try to find by package name first
    if (nameOrPackage.startsWith('@')) {
      const results = await searchRegistry({ query: nameOrPackage, limit: 5 });
      const match = results.find(s => s.packageName === nameOrPackage);
      if (match) return match;
    }

    // Try to find by repository name
    const results = await searchRegistry({ query: nameOrPackage, limit: 10 });
    const match = results.find(s =>
      s.name.toLowerCase() === nameOrPackage.toLowerCase() ||
      s.displayName.toLowerCase() === nameOrPackage.toLowerCase()
    );

    return match || null;
  } catch (error) {
    throw new Error(`Failed to fetch server details: ${extractErrorMessage(error)}`);
  }
}

/**
 * Get popular/featured MCP servers
 */
export async function getPopularServers(): Promise<RegistryServer[]> {
  return searchRegistry({
    sortBy: 'stars',
    limit: 20
  });
}

/**
 * Get servers by category
 */
export async function getServersByCategory(category: string): Promise<RegistryServer[]> {
  return searchRegistry({
    category,
    sortBy: 'stars',
    limit: 20
  });
}

/**
 * Generate MCP server configuration from registry entry
 *
 * BUG FIX: Properly handle all transport types including stdio without packageName.
 * Previously, stdio transport without packageName would return incomplete config
 * missing required 'command' and 'args' fields.
 */
export function generateConfigFromRegistry(server: RegistryServer): MCPServerConfig | null {
  // Configure based on transport type
  if (server.transport === 'stdio') {
    if (server.packageName) {
      return {
        name: server.name,
        transport: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', server.packageName]
        }
      };
    } else {
      // BUG FIX: Cannot generate valid stdio config without packageName
      // Return null to indicate configuration cannot be auto-generated
      // The caller should check repository README for manual installation
      return null;
    }
  } else if (server.transport === 'http' || server.transport === 'sse') {
    // For HTTP/SSE servers, we need a URL
    const url = server.homepage;
    if (!url || url === server.repository) {
      // Homepage is just the repo URL, not an actual server endpoint
      // Return null as we can't auto-generate a valid config
      return null;
    }
    return {
      name: server.name,
      transport: {
        type: server.transport,
        url
      }
    };
  }

  // Unknown transport type
  return null;
}

/**
 * Build GitHub search query
 */
function buildGitHubSearchQuery(query: string, category?: string, transport?: string): string {
  const parts: string[] = [];

  // Base search terms
  parts.push('mcp-server');
  parts.push('OR');
  parts.push('model-context-protocol');

  // Add custom query
  if (query) {
    parts.push(query);
  }

  // Add topic filter
  parts.push('topic:mcp');

  // Add category filter
  if (category) {
    parts.push(`topic:${category}`);
  }

  // Add transport filter
  if (transport) {
    parts.push(`topic:${transport}`);
  }

  return parts.join(' ');
}

/**
 * Parse GitHub repository into RegistryServer
 */
interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  topics: string[];
  owner: {
    login: string;
  };
  homepage: string | null;
}

/**
 * Parse GitHub repository into RegistryServer
 */
function parseGitHubRepo(repo: GitHubRepo): RegistryServer | null {
  try {
    // Extract package name from description or README
    const packageName = extractPackageName(repo);

    // Determine transport type from topics
    const transport = determineTransport(repo.topics || []);

    // Determine category from topics
    const category = determineCategory(repo.topics || []);

    // Check if verified (official modelcontextprotocol org)
    const verified = repo.owner.login === 'modelcontextprotocol';

    return {
      name: extractServerName(repo.name),
      displayName: repo.name.replace(/-/g, ' ').replace(/\bmcp\b/gi, 'MCP'),
      description: repo.description || 'No description available',
      repository: repo.html_url,
      stars: repo.stargazers_count,
      category,
      transport,
      packageName,
      installCommand: packageName ? `npx ${packageName}` : 'See repository for installation',
      verified,
      author: repo.owner.login,
      version: undefined, // Would need to query npm or GitHub releases
      homepage: repo.homepage || repo.html_url
    };
  } catch (error) {
    console.warn(`Failed to parse repository: ${repo.name}`, error);
    return null;
  }
}

/**
 * Extract NPM package name from repo metadata
 */
function extractPackageName(repo: GitHubRepo): string | undefined {
  // Check if description mentions package name
  const description = repo.description || '';
  const packageMatch = description.match(/@[\w-]+\/[\w-]+/);
  if (packageMatch) {
    return packageMatch[0];
  }

  // For official servers, construct package name
  if (repo.owner.login === 'modelcontextprotocol' && repo.name.startsWith('server-')) {
    return `@modelcontextprotocol/${repo.name}`;
  }

  return undefined;
}

/**
 * Determine transport type from topics
 */
function determineTransport(topics: string[]): 'stdio' | 'http' | 'sse' {
  if (topics.includes('http') || topics.includes('rest')) return 'http';
  if (topics.includes('sse') || topics.includes('server-sent-events')) return 'sse';
  return 'stdio'; // Default
}

/**
 * Determine category from topics
 */
function determineCategory(topics: string[]): string {
  const categoryMap: Record<string, string> = {
    'design': 'design',
    'figma': 'design',
    'deployment': 'deployment',
    'vercel': 'deployment',
    'database': 'database',
    'postgres': 'database',
    'mysql': 'database',
    'testing': 'testing',
    'api': 'api',
    'file-system': 'filesystem',
    'project-management': 'project-management',
    'linear': 'project-management',
    'github': 'version-control',
    'git': 'version-control'
  };

  for (const topic of topics) {
    if (categoryMap[topic]) {
      return categoryMap[topic];
    }
  }

  return 'other';
}

/**
 * Extract clean server name from repository name
 */
function extractServerName(repoName: string): string {
  // Remove common prefixes
  let name = repoName
    .replace(/^mcp-server-/i, '')
    .replace(/^server-/i, '')
    .replace(/^mcp-/i, '');

  // Convert to lowercase with hyphens
  name = name.toLowerCase();

  return name;
}

/**
 * Format registry server for display
 */
export function formatRegistryServer(server: RegistryServer, compact: boolean = false): string {
  if (compact) {
    const badge = server.verified ? '✓' : '';
    return `${server.displayName} ${badge} ⭐ ${server.stars} - ${server.description}`;
  }

  const lines: string[] = [];
  lines.push(`${server.displayName} ${server.verified ? '(verified)' : ''}`);
  lines.push(`  Description: ${server.description}`);
  lines.push(`  Category: ${server.category}`);
  lines.push(`  Transport: ${server.transport}`);
  lines.push(`  Stars: ${server.stars}`);
  lines.push(`  Repository: ${server.repository}`);
  if (server.packageName) {
    lines.push(`  Package: ${server.packageName}`);
  }
  lines.push(`  Install: ax-cli mcp install ${server.name}`);

  return lines.join('\n');
}
