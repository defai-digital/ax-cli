/**
 * MCP Resource Management (Phase 4)
 *
 * Enables users to reference MCP-exposed resources using @mcp: syntax
 * Similar to file references, but for database tables, API endpoints, etc.
 */

import type { MCPManager } from './client.js';
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
 * List all resources from MCP servers
 */
export async function listAllResources(mcpManager: MCPManager): Promise<MCPResource[]> {
  const resources: MCPResource[] = [];
  const servers = mcpManager.getServers();

  for (const serverName of servers) {
    try {
      const serverResources = await listServerResources(mcpManager, serverName);
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
  mcpManager: MCPManager,
  serverName: string
): Promise<MCPResource[]> {
  try {
    // Get the client for this server
    const client = (mcpManager as any).clients.get(serverName);
    if (!client) {
      return [];
    }

    // Try to list resources
    const result = await client.listResources();

    // Convert to our resource format
    return result.resources.map((resource: any) => ({
      uri: resource.uri,
      name: resource.name || resource.uri,
      description: resource.description,
      mimeType: resource.mimeType,
      serverName,
      reference: `@mcp:${serverName}/${resource.uri}`
    }));
  } catch (error) {
    // Server doesn't support resources
    return [];
  }
}

/**
 * Get resource content from MCP server
 */
export async function getResourceContent(
  mcpManager: MCPManager,
  serverName: string,
  uri: string
): Promise<string> {
  try {
    const client = (mcpManager as any).clients.get(serverName);
    if (!client) {
      throw new Error(`Server "${serverName}" not connected`);
    }

    const result = await client.readResource({ uri });

    // Extract text content
    if (result.contents && result.contents.length > 0) {
      const content = result.contents[0];
      if (content.text) {
        return content.text;
      }
      if (content.blob) {
        // Handle base64 encoded content
        return Buffer.from(content.blob, 'base64').toString('utf-8');
      }
    }

    return '';
  } catch (error) {
    throw new Error(`Failed to read resource ${uri}: ${extractErrorMessage(error)}`);
  }
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
  mcpManager: MCPManager
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
    } catch (error) {
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
