/**
 * MCP Resource Management (Phase 4)
 *
 * Enables users to reference MCP-exposed resources using @mcp: syntax
 * Similar to file references, but for database tables, API endpoints, etc.
 *
 * BUG FIX: Updated to use v2 manager's connection state instead of legacy clients Map.
 * The v1 MCPManager now wraps v2 internally, so we access the v2 instance.
 */

import type { MCPManager } from './client.js';
import { MCPManagerV2, createServerName } from './client-v2.js';
import { extractErrorMessage } from '../utils/error-handler.js';

export interface MCPResource {
  /** Resource URI (e.g., database://users, api://endpoints/get-user) */
  uri: string;
  /** Human-readable name */
  name: string;
  /** Resource description */
  description?: string;
  /** MIME type if applicable */
  mimeType?: string;
  /** Server that provides this resource */
  serverName: string;
  /** Full reference string for user input: @mcp:server/uri */
  reference: string;
}

/**
 * Get the v2 manager from either v1 or v2 instance
 */
function getV2Manager(mcpManager: MCPManager | MCPManagerV2): MCPManagerV2 {
  // If it's already v2, return it directly
  if (mcpManager instanceof MCPManagerV2) {
    return mcpManager;
  }
  // Otherwise, it's v1 wrapper - access the internal v2 instance
  return (mcpManager as any).v2 as MCPManagerV2;
}

/**
 * List all resources from MCP servers
 */
export async function listAllResources(mcpManager: MCPManager | MCPManagerV2): Promise<MCPResource[]> {
  const resources: MCPResource[] = [];
  const v2 = getV2Manager(mcpManager);
  const servers = v2.getServers();

  for (const serverName of servers) {
    try {
      const serverResources = await listServerResources(mcpManager, String(serverName));
      resources.push(...serverResources);
    } catch {
      // Silently skip servers that don't support resources
      console.warn(`Server "${serverName}" does not support resources or failed to list them`);
    }
  }

  return resources;
}

/**
 * List resources from a specific MCP server
 */
export async function listServerResources(
  mcpManager: MCPManager | MCPManagerV2,
  serverName: string
): Promise<MCPResource[]> {
  const v2 = getV2Manager(mcpManager);
  const brandedServerName = createServerName(serverName);

  if (!brandedServerName) {
    return [];
  }

  // Use the v2 manager's listResources method
  const result = await v2.listResources(brandedServerName);

  if (!result.success) {
    return [];
  }

  // Convert to our resource format
  return result.value.map(resource => ({
    uri: resource.uri,
    name: resource.name || resource.uri,
    description: resource.description,
    mimeType: resource.mimeType,
    serverName,
    reference: `@mcp:${serverName}/${resource.uri}`
  }));
}

/**
 * Get resource content from MCP server
 */
export async function getResourceContent(
  mcpManager: MCPManager | MCPManagerV2,
  serverName: string,
  uri: string
): Promise<string> {
  const v2 = getV2Manager(mcpManager);
  const brandedServerName = createServerName(serverName);

  if (!brandedServerName) {
    throw new Error(`Invalid server name: "${serverName}"`);
  }

  const result = await v2.readResource(brandedServerName, uri);

  if (!result.success) {
    throw new Error(`Failed to read resource ${uri}: ${extractErrorMessage(result.error)}`);
  }

  return result.value;
}

/**
 * Parse @mcp: reference
 * Format: @mcp:server/uri
 */
export function parseMCPReference(reference: string): { serverName: string; uri: string } | null {
  if (!reference.startsWith('@mcp:')) {
    return null;
  }

  const withoutPrefix = reference.substring(5); // Remove '@mcp:'
  const slashIndex = withoutPrefix.indexOf('/');

  if (slashIndex === -1) {
    return null;
  }

  const serverName = withoutPrefix.substring(0, slashIndex);
  const uri = withoutPrefix.substring(slashIndex + 1);

  // BUG FIX: Validate that both serverName and uri are non-empty
  if (!serverName || !uri) {
    return null;
  }

  return { serverName, uri };
}

/**
 * Extract all MCP references from text
 * BUG FIX: Exclude trailing punctuation that could be captured accidentally
 */
export function extractMCPReferences(text: string): string[] {
  // Pattern captures @mcp:server/uri but excludes trailing punctuation
  // [^\s.,;:!?)\]}>] ensures we don't capture sentence-ending punctuation
  const pattern = /@mcp:[a-z0-9_-]+\/[^\s.,;:!?)\]}>]+/gi;
  const matches = text.match(pattern);
  return matches || [];
}

/**
 * Replace MCP references in text with actual content
 */
export async function resolveMCPReferences(
  text: string,
  mcpManager: MCPManager | MCPManagerV2
): Promise<string> {
  const references = extractMCPReferences(text);
  let result = text;

  for (const reference of references) {
    const parsed = parseMCPReference(reference);
    if (!parsed) continue;

    try {
      const content = await getResourceContent(mcpManager, parsed.serverName, parsed.uri);
      // Replace reference with content (with context)
      result = result.replace(
        reference,
        `\n--- Resource: ${reference} ---\n${content}\n--- End Resource ---\n`
      );
    } catch {
      // Replace with error message
      result = result.replace(
        reference,
        `[Error: Could not load resource ${reference}]`
      );
    }
  }

  return result;
}

/**
 * Search resources by name or URI
 */
export function searchResources(resources: MCPResource[], query: string): MCPResource[] {
  const lowerQuery = query.toLowerCase();
  return resources.filter(resource =>
    resource.name.toLowerCase().includes(lowerQuery) ||
    resource.uri.toLowerCase().includes(lowerQuery) ||
    (resource.description && resource.description.toLowerCase().includes(lowerQuery))
  );
}
