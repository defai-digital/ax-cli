/**
 * Z.AI Official MCP Server Templates
 *
 * Pre-configured templates for Z.AI's official MCP servers:
 * - Web Reader: Extract content from web pages
 * - Web Search: Real-time web search
 * - Vision: Image and video analysis via GLM-4.5V
 *
 * These templates enable seamless integration for GLM users.
 */

import type { MCPServerConfig } from '../schemas/settings-schemas.js';

/**
 * Z.AI MCP server identifiers
 */
export const ZAI_SERVER_NAMES = {
  WEB_READER: 'zai-web-reader',
  WEB_SEARCH: 'zai-web-search',
  VISION: 'zai-vision',
} as const;

export type ZAIServerName = typeof ZAI_SERVER_NAMES[keyof typeof ZAI_SERVER_NAMES];

/**
 * Z.AI API endpoints for MCP servers
 */
export const ZAI_ENDPOINTS = {
  WEB_READER: 'https://api.z.ai/api/mcp/web_reader/mcp',
  WEB_SEARCH: 'https://api.z.ai/api/mcp/web_search_prime/mcp',
} as const;

/**
 * Z.AI Vision MCP package info
 */
export const ZAI_VISION_PACKAGE = {
  name: '@z_ai/mcp-server',
  minNodeVersion: '22.0.0',
} as const;

/**
 * Z.AI MCP server template definition
 */
export interface ZAIMCPTemplate {
  name: ZAIServerName;
  displayName: string;
  description: string;
  tools: string[];
  transport: 'http' | 'stdio';
  quotaType: 'web' | 'vision';
  requirements?: {
    nodeVersion?: string;
  };
}

/**
 * Z.AI MCP server templates
 */
export const ZAI_MCP_TEMPLATES: Record<ZAIServerName, ZAIMCPTemplate> = {
  [ZAI_SERVER_NAMES.WEB_READER]: {
    name: ZAI_SERVER_NAMES.WEB_READER,
    displayName: 'Z.AI Web Reader',
    description: 'Extract content, titles, and metadata from web pages',
    tools: ['webReader'],
    transport: 'http',
    quotaType: 'web',
  },
  [ZAI_SERVER_NAMES.WEB_SEARCH]: {
    name: ZAI_SERVER_NAMES.WEB_SEARCH,
    displayName: 'Z.AI Web Search',
    description: 'Real-time web search with rich results',
    tools: ['webSearchPrime'],
    transport: 'http',
    quotaType: 'web',
  },
  [ZAI_SERVER_NAMES.VISION]: {
    name: ZAI_SERVER_NAMES.VISION,
    displayName: 'Z.AI Vision',
    description: 'Image and video analysis via GLM-4.5V',
    tools: ['image_analysis', 'video_analysis'],
    transport: 'stdio',
    quotaType: 'vision',
    requirements: {
      nodeVersion: ZAI_VISION_PACKAGE.minNodeVersion,
    },
  },
} as const;

/**
 * Create HTTP transport config with Z.AI authorization
 * Note: Z.AI MCP servers require Accept header with both application/json and text/event-stream
 */
function createHttpTransport(url: string, apiKey: string) {
  return {
    type: 'http' as const,
    url,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Generate MCP server config for a Z.AI server
 *
 * @param serverName - The Z.AI server name
 * @param apiKey - Z.AI API key for authentication
 * @returns MCPServerConfig ready for use
 */
export function generateZAIServerConfig(
  serverName: ZAIServerName,
  apiKey: string
): MCPServerConfig {
  switch (serverName) {
    case ZAI_SERVER_NAMES.WEB_READER:
      return {
        name: ZAI_SERVER_NAMES.WEB_READER,
        transport: createHttpTransport(ZAI_ENDPOINTS.WEB_READER, apiKey),
      };

    case ZAI_SERVER_NAMES.WEB_SEARCH:
      return {
        name: ZAI_SERVER_NAMES.WEB_SEARCH,
        transport: createHttpTransport(ZAI_ENDPOINTS.WEB_SEARCH, apiKey),
      };

    case ZAI_SERVER_NAMES.VISION:
      return {
        name: ZAI_SERVER_NAMES.VISION,
        transport: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', ZAI_VISION_PACKAGE.name],
          env: {
            'Z_AI_API_KEY': apiKey,
            'Z_AI_MODE': 'ZAI',
          },
          // @z_ai/mcp-server uses NDJSON framing (MCP SDK default), not Content-Length
          framing: 'ndjson',
        },
        // Higher init timeout for npx (needs to download package if not cached)
        initTimeout: 120000, // 2 minutes
        // Suppress INFO/DEBUG logs from the MCP server
        quiet: true,
      };

    default:
      throw new Error(`Unknown Z.AI server: ${serverName}`);
  }
}

/**
 * Get all Z.AI server names
 */
export function getAllZAIServerNames(): ZAIServerName[] {
  return Object.values(ZAI_SERVER_NAMES);
}

/**
 * Check if a server name is a Z.AI server
 */
export function isZAIServer(serverName: string): serverName is ZAIServerName {
  return Object.values(ZAI_SERVER_NAMES).includes(serverName as ZAIServerName);
}

/**
 * Get template by server name
 */
export function getZAITemplate(serverName: ZAIServerName): ZAIMCPTemplate {
  return ZAI_MCP_TEMPLATES[serverName];
}

/**
 * Quota limits by plan tier
 */
export const ZAI_QUOTA_LIMITS = {
  lite: {
    webRequests: 100,
    visionHours: 5,
  },
  pro: {
    webRequests: 1000,
    visionHours: 5,
  },
  max: {
    webRequests: 4000,
    visionHours: 5,
  },
} as const;

export type ZAIPlanTier = keyof typeof ZAI_QUOTA_LIMITS;
