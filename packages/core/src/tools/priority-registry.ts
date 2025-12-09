/**
 * Priority Registry - Tool Selection Engine
 *
 * Manages priority-based tool selection to ensure the right tool is used for each task.
 * Prevents AutomatosX MCP from overshadowing native capabilities or provider-specific MCPs.
 *
 * Key behaviors:
 * - Grok web search → Uses native API (not AutomatosX MCP)
 * - GLM web search → Uses Z.AI MCP (not AutomatosX MCP)
 * - Figma tasks → Uses Figma MCP regardless of provider
 * - Memory/agent delegation → Uses AutomatosX MCP (its primary purpose)
 */

import { LLMTool } from '../llm/client.js';
import { getActiveProvider, type ProviderDefinition } from '../provider/config.js';
import {
  ToolCapability,
  ToolPriority,
  SUPERSEDE_THRESHOLD,
  NATIVE_CAPABILITY_PREFIX,
  isVariantOf,
  hasNativeCapability,
  getServerCapabilityMapping,
  getServerPriority,
  providerMatches,
} from './priority.js';

/**
 * Prefix for MCP tool names.
 * e.g., 'mcp__automatosx__run_agent' starts with 'mcp__'
 */
const MCP_TOOL_PREFIX = 'mcp__';

/**
 * Separator used in MCP tool names between prefix, server name, and tool name.
 */
const MCP_NAME_SEPARATOR = '__';

/**
 * Well-known MCP server names used in capability guidance.
 * These are referenced when providing context-aware tool recommendations.
 */
const KNOWN_SERVERS = {
  ZAI_WEB_SEARCH: 'zai-web-search',
  AUTOMATOSX: 'automatosx',
  FIGMA: 'figma',
  GITHUB: 'github',
} as const;

/**
 * Tool metadata for priority-based selection
 */
export interface ToolMetadata {
  /** Tool name (e.g., 'mcp__automatosx__run_agent') */
  name: string;
  /** Capabilities this tool provides */
  capabilities: ToolCapability[];
  /** Priority level */
  priority: number;
  /** Server name if this is an MCP tool */
  serverName?: string;
  /** Whether this tool should be hidden from the LLM */
  isHidden?: boolean;
  /** Reason for hiding (for debugging) */
  hiddenReason?: string;
}

/**
 * Extract server name from MCP tool name
 * e.g., 'mcp__automatosx__run_agent' → 'automatosx'
 *
 * ASSUMPTION: Server names do NOT contain "__" (double underscore).
 * This is enforced by MCPServerIdSchema in @defai.digital/ax-schemas.
 * If server names could contain "__", this parsing would fail.
 *
 * Returns undefined for:
 * - Non-MCP tools (don't start with MCP_TOOL_PREFIX)
 * - Malformed MCP tools with empty server name (e.g., 'mcp__' or 'mcp____tool')
 */
export function extractServerNameFromTool(toolName: string): string | undefined {
  if (!toolName.startsWith(MCP_TOOL_PREFIX)) {
    return undefined;
  }
  // Format: mcp__serverName__toolName - server name is at index 1
  // Note: This assumes server names don't contain "__" (enforced by MCPServerIdSchema)
  const parts = toolName.split(MCP_NAME_SEPARATOR);
  // BUG FIX: Validate that tool name has correct format (at least 3 parts: 'mcp', serverName, toolName)
  // Malformed names like 'mcp__' or 'mcp____tool' would return empty/undefined server names
  if (parts.length < 3 || !parts[1]) {
    // Only log in debug mode to avoid console spam
    if (process.env.DEBUG || process.env.AX_DEBUG) {
      console.warn(`Malformed MCP tool name: "${toolName}". Expected format: mcp__serverName__toolName`);
    }
    return undefined;
  }
  return parts[1];
}

/**
 * Helper to check if any phrase is found in text
 */
function containsAny(text: string, phrases: string[]): boolean {
  return phrases.some(phrase => text.includes(phrase));
}

/**
 * Check if a server name matches a target (case-insensitive, supports variants)
 */
function serverNameMatches(serverName: string, target: string): boolean {
  const normalizedServer = serverName.toLowerCase();
  const normalizedTarget = target.toLowerCase();
  return normalizedServer === normalizedTarget || isVariantOf(normalizedServer, normalizedTarget);
}

/**
 * Capability detection rule configuration
 */
interface CapabilityRule {
  capability: ToolCapability;
  namePatterns?: RegExp;
  descPatterns?: RegExp;
  nameIncludes?: string[];
  descIncludes?: string[];
  excludeNamePattern?: RegExp;
  excludeDescIncludes?: string[];
}

/**
 * Capability detection rules - defines how to detect each capability
 */
const CAPABILITY_RULES: CapabilityRule[] = [
  // Web search - exclude file search tools
  {
    capability: 'web-search',
    nameIncludes: ['websearch', 'web_search'],
    descIncludes: ['search the web', 'on the web', 'web search', 'internet search'],
    excludeNamePattern: /\bfile\b|_file\b|\bfile_|\bgrep\b|_grep\b|\bgrep_|\bglob\b|_glob\b|\bglob_/,
    excludeDescIncludes: ['search files', 'file search'],
  },
  // Web fetch - exclude file readers
  {
    capability: 'web-fetch',
    nameIncludes: ['webfetch', 'web_fetch', 'url_fetch', 'web-reader', 'web_reader'],
    descIncludes: ['fetch url', 'fetch content from url', 'fetch web', 'http request'],
    excludeNamePattern: /\bpdf\b|_pdf\b|\bpdf_|\bcsv\b|_csv\b|\bcsv_|\bfile\b|_file\b|\bfile_/,
    excludeDescIncludes: ['read file', 'parse file'],
  },
  // Vision - exclude image manipulation tools
  {
    capability: 'vision',
    namePatterns: /\bvision\b|\bcomputer vision\b|\bmachine vision\b/,
    descPatterns: /\bvision\b|\bcomputer vision\b|\bmachine vision\b/,
    descIncludes: ['image analysis', 'image understanding', 'analyze image', 'visual understanding'],
    excludeNamePattern: /\bresize_image\b|\bget_image_dimensions\b|\bcompress_image\b|\bconvert_image_format\b|\bimage_resize\b|\bimage_compress\b|\bimage_convert\b/,
    excludeDescIncludes: ['resize image', 'image dimensions', 'compress image', 'convert image format'],
  },
  // Memory - exclude system memory tools
  {
    capability: 'memory',
    namePatterns: /\bmemory_add\b|\bmemory_search\b|\bmemory_list\b|\bmemory_delete\b|\bsave_memory\b|\bget_memory\b|\bcontext_store\b/,
    descIncludes: ['context store', 'conversation memory', 'persist memory', 'retrieve memory', 'memory entries'],
    excludeDescIncludes: ['memory usage', 'memory leak', 'low memory', 'memory limit', 'in-memory'],
  },
  // Agent delegation
  {
    capability: 'agent-delegation',
    namePatterns: /\brun_agent\b|\bspawn_agent\b|\bcreate_agent\b|\bagent_task\b/,
    descIncludes: ['delegate to agent', 'spawn agent', 'run agent', 'execute agent', 'multi-agent'],
  },
  // Git operations
  {
    capability: 'git-operations',
    namePatterns: /\bgit\b|\bgit_|github|gitlab|gitea/,
    descPatterns: /\bgit\b|\bgit_|github|gitlab|gitea/,
    descIncludes: ['git repository', 'version control'],
  },
  // Database
  {
    capability: 'database',
    namePatterns: /\bpostgres\b|\bpostgres_|\bsqlite\b|\bsqlite_|\bmysql\b|\bmysql_|\bmongodb\b|\bmongodb_|\bsupabase\b|\bsupabase_|\bfirebase\b|\bfirebase_|\bdynamodb\b|\bdynamodb_|\bredis\b|\bredis_|\bcassandra\b|\bcassandra_|\bsql_query\b|\bdb_query\b|\bexecute_sql\b|\brun_sql\b|\bdb_execute\b|\bdb_insert\b|\bdb_select\b|\bdb_update\b|\bdb_delete\b/,
    descIncludes: ['execute sql', 'database query', 'run sql', 'database operations', 'sql statement'],
  },
  // Deployment
  {
    capability: 'deployment',
    namePatterns: /\bvercel\b|\bvercel_|\bnetlify\b|\bnetlify_|\bheroku\b|\bheroku_|\baws_deploy\b|\bcloud_run\b|\bflyio\b|\brailway\b|\bdeploy_app\b|\bdeploy_site\b|\bdeploy_function\b|\bcreate_deployment\b|\btrigger_deploy\b/,
    descIncludes: ['deploy to production', 'deploy application', 'deployment platform', 'deploy website'],
  },
  // File operations
  {
    capability: 'file-operations',
    namePatterns: /\bfile\b|\bread_file\b|\bwrite_file\b|\bedit_file\b|\bview_file\b|\bcreate_file\b|\bdelete_file\b|\bstr_replace\b|\btext_editor\b/,
    descIncludes: ['read file', 'write file', 'edit file', 'file system', 'file operations'],
  },
  // Testing
  {
    capability: 'testing',
    namePatterns: /\btest\b|_test\b|\btest_|\btesting\b|puppeteer|playwright|cypress|selenium|\bjest\b|_jest_|_jest$|^jest_|vitest|mocha/,
    descIncludes: ['run test', 'execute test', 'browser automation', 'e2e test', 'unit test', 'integration test'],
  },
  // Monitoring
  {
    capability: 'monitoring',
    namePatterns: /sentry|datadog|newrelic|pagerduty|grafana|prometheus|error_track|log_event|alert_/,
    descIncludes: ['error tracking', 'error monitoring', 'application monitoring', 'observability', 'apm', 'alert management'],
  },
];

/**
 * Check if a capability rule matches the tool name and description.
 * Checks exclusions first, then inclusions with short-circuit evaluation.
 */
function matchesCapabilityRule(
  rule: CapabilityRule,
  toolName: string,
  toolDescription: string
): boolean {
  // Check exclusions first (short-circuit on any match)
  if (rule.excludeNamePattern?.test(toolName) ||
      (rule.excludeDescIncludes && containsAny(toolDescription, rule.excludeDescIncludes))) {
    return false;
  }

  // Check inclusions (short-circuit on first match)
  return !!(
    rule.namePatterns?.test(toolName) ||
    rule.descPatterns?.test(toolDescription) ||
    (rule.nameIncludes && containsAny(toolName, rule.nameIncludes)) ||
    (rule.descIncludes && containsAny(toolDescription, rule.descIncludes))
  );
}

/**
 * Infer capability from tool name and description.
 * Uses heuristics to determine what a tool does.
 *
 * @param tool - The LLM tool to analyze
 * @returns Array of inferred capabilities
 */
export function inferToolCapability(tool: LLMTool): ToolCapability[] {
  const toolName = tool.function.name.toLowerCase();
  const toolDescription = (tool.function.description || '').toLowerCase();
  const capabilities: ToolCapability[] = [];

  // Apply standard rules
  for (const rule of CAPABILITY_RULES) {
    if (matchesCapabilityRule(rule, toolName, toolDescription)) {
      capabilities.push(rule.capability);
    }
  }

  // Design detection: Figma-specific vs general design tools
  const hasFigma = toolName.includes('figma') || toolDescription.includes('figma');
  if (hasFigma) {
    capabilities.push('design-figma');
  } else if (
    /\bdesign_system\b|\bdesign_token\b|\bui_design\b|\bget_design\b|\bcreate_design\b/.test(toolName) ||
    containsAny(toolDescription, ['design system', 'design tokens'])
  ) {
    capabilities.push('design-general');
  }

  return capabilities;
}

/**
 * Registry for managing tool priorities and selection
 */
export class PriorityRegistry {
  private provider: ProviderDefinition;
  private toolMetadata: Map<string, ToolMetadata> = new Map();

  constructor(provider?: ProviderDefinition) {
    this.provider = provider || getActiveProvider();
  }

  /**
   * Analyze a tool and determine its metadata
   */
  analyzeToolMetadata(tool: LLMTool): ToolMetadata {
    const toolName = tool.function.name;

    // Check cache first (most common path)
    const cached = this.toolMetadata.get(toolName);
    if (cached) {
      return cached;
    }

    const serverName = extractServerNameFromTool(toolName);
    const mapping = serverName ? getServerCapabilityMapping(serverName) : undefined;

    // Determine priority: known MCP > unknown MCP > built-in
    const priority = mapping
      ? getServerPriority(serverName!, this.provider.name)
      : toolName.startsWith(MCP_TOOL_PREFIX)
        ? ToolPriority.COMMUNITY_MCP
        : ToolPriority.BUILTIN_TOOL;

    // Merge registered capabilities with inferred ones
    const baseCapabilities = mapping?.capabilities ?? [];
    const inferredCapabilities = inferToolCapability(tool);
    const capabilities = baseCapabilities.length > 0
      ? [...baseCapabilities, ...inferredCapabilities.filter(c => !baseCapabilities.includes(c))]
      : inferredCapabilities;

    const metadata: ToolMetadata = { name: toolName, capabilities, priority, serverName };
    this.toolMetadata.set(toolName, metadata);
    return metadata;
  }

  /**
   * Check if a tool should be hidden based on capability conflicts
   * Returns reason if hidden, undefined if should be shown
   *
   * IMPORTANT: A tool is only hidden if ALL of its capabilities are superseded
   * by higher-priority alternatives. If a tool provides unique capabilities
   * (e.g., AutomatosX's memory/agent-delegation), it should NOT be hidden
   * even if some of its capabilities (e.g., web-search) are better served elsewhere.
   */
  shouldHideTool(
    tool: LLMTool,
    allTools: LLMTool[]
  ): string | undefined {
    const metadata = this.analyzeToolMetadata(tool);
    const { capabilities, name: toolName, priority: toolPriority } = metadata;

    // If tool has no capabilities detected, don't hide it
    if (capabilities.length === 0) {
      return undefined;
    }

    // Track superseded capabilities - only collect details if all are superseded
    const supersededCapabilities: string[] = [];

    for (const capability of capabilities) {
      // Find the highest priority tool for this capability
      // This includes native API capabilities (priority 100) as virtual tools
      const highestPriorityTool = this.findHighestPriorityTool(allTools, capability);

      // Check if this capability is NOT superseded (early exit optimization)
      const isSuperseded = highestPriorityTool &&
        highestPriorityTool.name !== toolName &&
        (highestPriorityTool.priority - toolPriority) >= SUPERSEDE_THRESHOLD;

      if (!isSuperseded) {
        // Found a unique capability - tool should not be hidden
        return undefined;
      }

      supersededCapabilities.push(`${capability} (by ${highestPriorityTool!.name})`);
    }

    // All capabilities are superseded - hide this tool
    return `All capabilities superseded: ${supersededCapabilities.join(', ')}`;
  }

  /**
   * Find the highest priority tool for a given capability
   * Also considers native API capabilities which have priority NATIVE_API (100)
   */
  findHighestPriorityTool(
    tools: LLMTool[],
    capability: ToolCapability
  ): ToolMetadata | undefined {
    // Native capabilities have highest priority (100) - early return optimization
    if (hasNativeCapability(this.provider.name, capability)) {
      return {
        name: `${NATIVE_CAPABILITY_PREFIX}${capability}`,
        capabilities: [capability],
        priority: ToolPriority.NATIVE_API,
      };
    }

    // Find highest priority tool for this capability
    let highest: ToolMetadata | undefined;
    for (const tool of tools) {
      const metadata = this.analyzeToolMetadata(tool);
      if (metadata.capabilities.includes(capability) && (!highest || metadata.priority > highest.priority)) {
        highest = metadata;
      }
    }

    return highest;
  }

  /**
   * Filter tools based on priority, removing lower-priority duplicates
   * Returns filtered tools and a list of hidden tools (for debugging)
   */
  filterTools(tools: LLMTool[]): {
    filtered: LLMTool[];
    hidden: Array<{ tool: LLMTool; reason: string }>;
  } {
    const filtered: LLMTool[] = [];
    const hidden: Array<{ tool: LLMTool; reason: string }> = [];

    // Single pass: analyze and filter in one loop
    for (const tool of tools) {
      // analyzeToolMetadata caches results, so shouldHideTool benefits from this
      const hideReason = this.shouldHideTool(tool, tools);

      if (hideReason) {
        hidden.push({ tool, reason: hideReason });
      } else {
        filtered.push(tool);
      }
    }

    return { filtered, hidden };
  }

  /**
   * Get capability-based guidance for the system prompt
   * Helps the LLM understand which tools to prefer
   * Uses flexible provider matching to handle variants like 'grok-beta', 'glm-4'
   *
   * @param connectedServers - Optional list of currently connected MCP server names.
   *                           If provided, guidance is only given for connected servers.
   */
  getCapabilityGuidance(connectedServers?: string[]): string[] {
    const guidance: string[] = [];
    const providerName = this.provider.name;

    // Check if a server is connected (or if we don't have connection info)
    const isConnected = (target: string): boolean =>
      !connectedServers || connectedServers.some(s => serverNameMatches(s, target));

    // Add provider-specific guidance
    if (providerMatches(providerName, 'grok') || providerMatches(providerName, 'gemini')) {
      guidance.push(
        'For web searches, use NATIVE search capabilities (simply ask questions that require current information).',
        'Do NOT use MCP web search tools when native search is available.'
      );
    } else if (providerMatches(providerName, 'glm') && isConnected(KNOWN_SERVERS.ZAI_WEB_SEARCH)) {
      guidance.push(
        `For web searches, use Z.AI MCP tools (${KNOWN_SERVERS.ZAI_WEB_SEARCH}) for best results.`,
        'Z.AI tools are optimized for GLM integration.'
      );
    }

    // Add MCP guidance only for servers that are actually connected
    if (isConnected(KNOWN_SERVERS.AUTOMATOSX)) {
      guidance.push('For memory and context management, use AutomatosX MCP tools.');
    }
    if (isConnected(KNOWN_SERVERS.FIGMA)) {
      guidance.push('For design tasks involving Figma, use Figma MCP tools.');
    }
    if (isConnected(KNOWN_SERVERS.GITHUB)) {
      guidance.push('For GitHub operations, use GitHub MCP tools.');
    }

    return guidance;
  }

  /**
   * Get tools sorted by priority for a given capability
   */
  getToolsForCapability(
    tools: LLMTool[],
    capability: ToolCapability
  ): LLMTool[] {
    // Collect matching tools with their priorities in single pass
    const matching: Array<{ tool: LLMTool; priority: number }> = [];

    for (const tool of tools) {
      const metadata = this.analyzeToolMetadata(tool);
      if (metadata.capabilities.includes(capability)) {
        matching.push({ tool, priority: metadata.priority });
      }
    }

    // Sort and extract tools
    return matching
      .sort((a, b) => b.priority - a.priority)
      .map(({ tool }) => tool);
  }

  /**
   * Clear the metadata cache (useful for testing or provider changes)
   */
  clearCache(): void {
    this.toolMetadata.clear();
  }

  /**
   * Set provider (useful when provider changes mid-session)
   */
  setProvider(provider: ProviderDefinition): void {
    this.provider = provider;
    this.clearCache();
  }
}

// Singleton instance
let registryInstance: PriorityRegistry | null = null;

/**
 * Get the priority registry singleton
 */
export function getPriorityRegistry(): PriorityRegistry {
  return registryInstance ??= new PriorityRegistry();
}

/**
 * Reset the priority registry (for testing or provider changes)
 */
export function resetPriorityRegistry(): void {
  registryInstance?.clearCache();
  registryInstance = null;
}

/**
 * Update the registry when provider changes
 */
export function updatePriorityRegistryProvider(provider: ProviderDefinition): void {
  getPriorityRegistry().setProvider(provider);
}
