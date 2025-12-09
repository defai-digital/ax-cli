/**
 * Tool Priority System
 *
 * Defines priority levels and capability types for intelligent tool selection.
 * When multiple tools can handle the same task, the system prefers higher-priority tools.
 *
 * Priority Order:
 * 1. Native API capabilities (e.g., Grok's built-in search)
 * 2. Provider-specific MCP (e.g., Z.AI MCP for GLM)
 * 3. Domain-specific MCP (e.g., Figma MCP for design)
 * 4. Official MCP servers
 * 5. Community MCP servers
 * 6. General-purpose MCP (e.g., AutomatosX)
 * 7. Built-in tools (fallback)
 */

/**
 * Capability types that tools can provide
 */
export type ToolCapability =
  | 'web-search'        // Search the web for information
  | 'web-fetch'         // Fetch content from URLs
  | 'vision'            // Image/video analysis
  | 'code-generation'   // Generate code
  | 'file-operations'   // Read/write/edit files
  | 'git-operations'    // Git/GitHub operations
  | 'design-figma'      // Figma design operations
  | 'design-general'    // General design tools
  | 'database'          // Database operations
  | 'deployment'        // Deploy to platforms
  | 'memory'            // Context/memory operations
  | 'agent-delegation'  // Delegate to other agents
  | 'testing'           // Testing and QA
  | 'monitoring';       // Error tracking and monitoring

/**
 * Priority levels for tool selection
 * Higher values = higher priority = preferred tool
 */
export enum ToolPriority {
  /** Built into provider API (highest priority) */
  NATIVE_API = 100,
  /** Provider-specific MCP (e.g., Z.AI for GLM) */
  PROVIDER_MCP = 80,
  /** Domain-specific MCP (e.g., Figma for design) */
  DOMAIN_SPECIFIC = 60,
  /** Official MCP servers (e.g., @modelcontextprotocol/*) */
  OFFICIAL_MCP = 40,
  /** Community MCP servers */
  COMMUNITY_MCP = 20,
  /** General-purpose MCP (e.g., AutomatosX) */
  GENERAL_MCP = 10,
  /** Built-in ax-cli tools (fallback) */
  BUILTIN_TOOL = 5,
}

/**
 * Priority boost applied when a server has affinity for the current provider.
 * This ensures provider-affinity servers beat same-level servers without affinity.
 */
export const PROVIDER_AFFINITY_BOOST = 10;

/**
 * Minimum priority difference required to consider a capability superseded.
 * Prevents minor priority differences from hiding useful tools.
 */
export const SUPERSEDE_THRESHOLD = 15;

/**
 * Delimiters used to separate base names from variant suffixes.
 * e.g., 'grok-beta' uses '-', 'automatosx_glm' uses '_'
 */
export const VARIANT_DELIMITERS = ['-', '_'] as const;

/**
 * Prefix used for virtual native capability tool names.
 * e.g., 'native_web-search' represents Grok's native search capability
 */
export const NATIVE_CAPABILITY_PREFIX = 'native_';

/**
 * Check if a name starts with a base name followed by a variant delimiter.
 * Used to match variant names like 'grok-beta' to base name 'grok'.
 *
 * @param fullName - The full name to check (e.g., 'grok-beta')
 * @param baseName - The base name to match against (e.g., 'grok')
 * @returns True if fullName is a variant of baseName
 */
export function isVariantOf(fullName: string, baseName: string): boolean {
  return VARIANT_DELIMITERS.some(
    delimiter => fullName.startsWith(baseName + delimiter)
  );
}

/**
 * Provider names for capability mapping
 */
export type ProviderName = 'grok' | 'glm' | 'claude' | 'openai' | 'gemini';

/**
 * Native capabilities built into provider APIs
 * These don't require MCP - they're part of the API itself
 */
export const PROVIDER_NATIVE_CAPABILITIES: Record<ProviderName, ToolCapability[]> = {
  grok: ['web-search'],    // Grok has native live search via API
  glm: [],                 // GLM uses Z.AI MCP for web search
  claude: [],              // Claude has no native search in API
  openai: [],              // OpenAI standard API has no search
  gemini: ['web-search'],  // Gemini has grounding/search
};

/**
 * MCP server capability mapping
 * Defines which capabilities each MCP server provides and its priority
 */
export interface MCPCapabilityMapping {
  /** MCP server name (e.g., 'figma', 'github', 'automatosx') */
  serverName: string;
  /** Capabilities this server provides */
  capabilities: ToolCapability[];
  /** Priority level for this server */
  priority: ToolPriority;
  /** Preferred providers for this server (if any) */
  providerAffinity?: ProviderName[];
  /** Whether this is an official MCP server */
  isOfficial?: boolean;
}

/**
 * Known MCP server capability registry
 * Add new servers here as they become available
 */
export const MCP_CAPABILITY_REGISTRY: MCPCapabilityMapping[] = [
  // ========================================
  // Z.AI MCP Servers (Provider-specific for GLM)
  // ========================================
  {
    serverName: 'zai-web-search',
    capabilities: ['web-search'],
    priority: ToolPriority.PROVIDER_MCP,
    providerAffinity: ['glm'],
  },
  {
    serverName: 'zai-web-reader',
    capabilities: ['web-fetch'],
    priority: ToolPriority.PROVIDER_MCP,
    providerAffinity: ['glm'],
  },
  {
    serverName: 'zai-vision',
    capabilities: ['vision'],
    priority: ToolPriority.PROVIDER_MCP,
    providerAffinity: ['glm'],
  },

  // ========================================
  // Domain-Specific MCPs
  // ========================================
  {
    serverName: 'figma',
    capabilities: ['design-figma', 'design-general'],
    priority: ToolPriority.DOMAIN_SPECIFIC,
  },

  // ========================================
  // Official MCP Servers
  // ========================================
  {
    serverName: 'github',
    capabilities: ['git-operations'],
    priority: ToolPriority.OFFICIAL_MCP,
    isOfficial: true,
  },
  {
    serverName: 'postgres',
    capabilities: ['database'],
    priority: ToolPriority.OFFICIAL_MCP,
    isOfficial: true,
  },
  {
    serverName: 'sqlite',
    capabilities: ['database'],
    priority: ToolPriority.OFFICIAL_MCP,
    isOfficial: true,
  },
  {
    serverName: 'puppeteer',
    // Note: Puppeteer is primarily for browser automation and testing.
    // It can fetch web content but via a full browser, which is heavyweight.
    // Don't mark as 'web-fetch' to avoid superseding lightweight HTTP fetchers.
    capabilities: ['testing'],
    priority: ToolPriority.OFFICIAL_MCP,
    isOfficial: true,
  },

  // ========================================
  // Community MCPs
  // ========================================
  {
    serverName: 'vercel',
    capabilities: ['deployment'],
    priority: ToolPriority.COMMUNITY_MCP,
  },
  {
    serverName: 'netlify',
    capabilities: ['deployment'],
    priority: ToolPriority.COMMUNITY_MCP,
  },
  {
    serverName: 'supabase',
    capabilities: ['database'],
    priority: ToolPriority.COMMUNITY_MCP,
  },
  {
    serverName: 'firebase',
    capabilities: ['database', 'deployment'],
    priority: ToolPriority.COMMUNITY_MCP,
  },
  {
    serverName: 'sentry',
    capabilities: ['monitoring'],
    priority: ToolPriority.COMMUNITY_MCP,
  },

  // ========================================
  // General-Purpose MCPs (lowest priority)
  // ========================================
  {
    serverName: 'automatosx',
    capabilities: ['web-search', 'web-fetch', 'memory', 'agent-delegation'],
    priority: ToolPriority.GENERAL_MCP,
  },
];

/**
 * Cached lowercase server name index for O(1) exact lookups.
 * Maps lowercase server name to its MCPCapabilityMapping.
 */
const serverNameIndex = new Map<string, MCPCapabilityMapping>(
  MCP_CAPABILITY_REGISTRY.map(mapping => [mapping.serverName.toLowerCase(), mapping])
);

/**
 * Pre-computed lowercase server names sorted by length (longest first).
 * Used for efficient variant matching.
 */
const sortedServerNames = MCP_CAPABILITY_REGISTRY
  .map(mapping => mapping.serverName.toLowerCase())
  .sort((a, b) => b.length - a.length);

/**
 * Pre-computed capability to servers index for O(1) capability lookups.
 * Maps capability to array of servers that provide it.
 */
const capabilityIndex = new Map<ToolCapability, MCPCapabilityMapping[]>();
for (const mapping of MCP_CAPABILITY_REGISTRY) {
  for (const capability of mapping.capabilities) {
    let servers = capabilityIndex.get(capability);
    if (!servers) {
      servers = [];
      capabilityIndex.set(capability, servers);
    }
    servers.push(mapping);
  }
}

/**
 * Get capability mapping for a server by name.
 * Supports exact matches and variant matches (e.g., 'automatosx-glm' matches 'automatosx').
 * Case-insensitive matching for robustness.
 *
 * @param serverName - The server name to look up (may include variant suffix)
 * @returns The capability mapping, or undefined if not found
 */
export function getServerCapabilityMapping(serverName: string): MCPCapabilityMapping | undefined {
  const normalizedName = serverName.toLowerCase();

  // O(1) exact match lookup
  const exactMatch = serverNameIndex.get(normalizedName);
  if (exactMatch) {
    return exactMatch;
  }

  // Variant match - find longest matching base name
  for (const baseName of sortedServerNames) {
    if (isVariantOf(normalizedName, baseName)) {
      return serverNameIndex.get(baseName);
    }
  }

  return undefined;
}

/**
 * List of known provider names derived from PROVIDER_NATIVE_CAPABILITIES.
 * Used for flexible provider name matching.
 */
const KNOWN_PROVIDERS = Object.keys(PROVIDER_NATIVE_CAPABILITIES) as ProviderName[];

/**
 * Get the base provider name from a potentially variant provider string.
 * e.g., 'grok-beta' -> 'grok', 'glm-4' -> 'glm', 'openai' -> 'openai'
 *
 * @param providerName - The provider name (may include variant suffix)
 * @returns The base provider name, or undefined if not recognized
 */
function getBaseProviderName(providerName: string): ProviderName | undefined {
  const normalizedName = providerName.toLowerCase();

  for (const knownProvider of KNOWN_PROVIDERS) {
    if (normalizedName === knownProvider || isVariantOf(normalizedName, knownProvider)) {
      return knownProvider;
    }
  }

  return undefined;
}

/**
 * Check if a provider has native support for a capability.
 * Supports provider variants (e.g., 'grok-beta' matches 'grok' native capabilities)
 *
 * @param providerName - The provider name (may include variant suffix)
 * @param capability - The capability to check
 * @returns True if the provider natively supports the capability
 */
export function hasNativeCapability(providerName: string, capability: ToolCapability): boolean {
  const baseProvider = getBaseProviderName(providerName);
  if (!baseProvider) {
    return false;
  }
  return PROVIDER_NATIVE_CAPABILITIES[baseProvider].includes(capability);
}

/**
 * Check if a provider matches a base provider name.
 * e.g., 'grok-beta' matches 'grok', 'glm-4' matches 'glm'
 *
 * @param providerName - The provider name to check (may include variant suffix)
 * @param baseProvider - The base provider to match against
 * @returns True if the provider matches the base provider
 */
export function providerMatches(providerName: string, baseProvider: ProviderName): boolean {
  return getBaseProviderName(providerName) === baseProvider;
}

/**
 * Get the priority for a server, considering provider affinity.
 *
 * @param serverName - The MCP server name
 * @param providerName - Optional provider name for affinity boosting
 * @returns The priority value (higher = more preferred)
 */
export function getServerPriority(
  serverName: string,
  providerName?: string
): number {
  const mapping = getServerCapabilityMapping(serverName);
  if (!mapping) {
    // Unknown server - assign community priority
    return ToolPriority.COMMUNITY_MCP;
  }

  // Boost priority if this server has affinity for the current provider
  if (providerName && mapping.providerAffinity?.some(affinity => providerMatches(providerName, affinity))) {
    return mapping.priority + PROVIDER_AFFINITY_BOOST;
  }

  return mapping.priority;
}

/**
 * Check if a server should be preferred for a given capability and provider.
 *
 * A server is preferred if:
 * 1. The provider does NOT have native support for this capability, AND
 * 2. Either:
 *    a. It has provider affinity for the current provider, OR
 *    b. It has the highest priority among all servers providing this capability
 *
 * Note: If the provider has native capability support, NO MCP server should be preferred.
 *
 * @param serverName - The MCP server name
 * @param capability - The capability to check
 * @param providerName - The current provider name
 * @returns True if the server should be preferred for this capability
 */
export function shouldPreferServer(
  serverName: string,
  capability: ToolCapability,
  providerName: string
): boolean {
  const mapping = getServerCapabilityMapping(serverName);
  if (!mapping) return false;

  // Check if server provides this capability
  if (!mapping.capabilities.includes(capability)) return false;

  // If the provider has native support for this capability, no MCP server should be preferred
  if (hasNativeCapability(providerName, capability)) {
    return false;
  }

  // Check if server has affinity for this provider
  if (mapping.providerAffinity?.some(affinity => providerMatches(providerName, affinity))) {
    return true;
  }

  // Even without affinity, check if this server has the highest priority for this capability
  const serversForCapability = getServersForCapability(capability, providerName);
  const topServer = serversForCapability[0];
  if (topServer && topServer.serverName.toLowerCase() === serverName.toLowerCase()) {
    return true;
  }

  return false;
}

/**
 * Get all servers that provide a given capability, sorted by priority.
 *
 * @param capability - The capability to search for
 * @param providerName - Optional provider name for affinity-based priority boosting
 * @returns Array of server mappings sorted by priority (highest first)
 */
export function getServersForCapability(
  capability: ToolCapability,
  providerName?: string
): MCPCapabilityMapping[] {
  const servers = capabilityIndex.get(capability);
  if (!servers?.length) {
    return [];
  }
  // Clone and sort to avoid mutating the cached array
  return [...servers].sort((a, b) =>
    getServerPriority(b.serverName, providerName) - getServerPriority(a.serverName, providerName)
  );
}
