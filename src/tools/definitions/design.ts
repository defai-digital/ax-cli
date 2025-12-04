/**
 * Design Tools Definitions - Claude Code Quality
 *
 * Figma integration tools for design-to-code workflows.
 */

import type { ToolDefinition } from '../types.js';

export const figmaMapTool: ToolDefinition = {
  name: 'figma_map',
  displayName: 'Figma Map',

  description: `Map a Figma file structure to see its pages, frames, and components.

Use this to explore the structure of a Figma design file. Returns a hierarchical view of the file's organization including pages, frames, components, and their relationships.

Requires FIGMA_ACCESS_TOKEN environment variable to be set.`,

  parameters: {
    type: 'object',
    properties: {
      file_key: {
        type: 'string',
        description:
          'Figma file key (from the URL: figma.com/file/FILE_KEY/...)',
        examples: ['abc123xyz', 'FigmaFileKey123'],
      },
      depth: {
        type: 'number',
        description: 'Maximum depth to traverse (optional)',
        default: 3,
      },
      format: {
        type: 'string',
        enum: ['tree', 'json', 'flat'],
        description: 'Output format (default: tree)',
        default: 'tree',
      },
      show_ids: {
        type: 'boolean',
        description: 'Include node IDs in output',
        default: false,
      },
      show_types: {
        type: 'boolean',
        description: 'Include node types in output',
        default: true,
      },
      frames_only: {
        type: 'boolean',
        description: 'Show only frames and components',
        default: false,
      },
    },
    required: ['file_key'],
  },

  usageNotes: [
    'Get file_key from Figma URL: figma.com/file/FILE_KEY/...',
    'Use tree format for visual hierarchy overview',
    'Use json format for programmatic processing',
    'Set frames_only: true to focus on main containers',
    'Increase depth for detailed component inspection',
  ],

  constraints: [
    'Requires FIGMA_ACCESS_TOKEN environment variable',
    'Large files may take longer to process',
    'Deep traversal may hit API rate limits',
  ],

  antiPatterns: [
    'Not setting FIGMA_ACCESS_TOKEN before use',
    'Setting very high depth for large files',
  ],

  examples: [
    {
      description: 'Map file structure',
      scenario: 'Explore a design file organization',
      input: { file_key: 'abc123xyz', format: 'tree', depth: 2 },
      expectedBehavior: 'Returns tree view of pages and frames',
    },
  ],

  tokenCost: 350,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['design'],
  alternatives: [],
  relatedTools: ['figma_tokens', 'figma_search', 'figma_audit'],
};

export const figmaTokensTool: ToolDefinition = {
  name: 'figma_tokens',
  displayName: 'Figma Tokens',

  description: `Extract design tokens (colors, spacing, radii) from a Figma file's variables.

Use this to generate design tokens from Figma variables in various formats for use in code. Supports CSS, SCSS, Tailwind, and JSON output formats.

Requires FIGMA_ACCESS_TOKEN environment variable to be set.`,

  parameters: {
    type: 'object',
    properties: {
      file_key: {
        type: 'string',
        description: 'Figma file key containing design tokens/variables',
      },
      format: {
        type: 'string',
        enum: ['json', 'tailwind', 'css', 'scss'],
        description: 'Output format (default: json)',
        default: 'json',
      },
      color_format: {
        type: 'string',
        enum: ['hex', 'rgb', 'hsl'],
        description: 'Color output format (default: hex)',
        default: 'hex',
      },
      dimension_unit: {
        type: 'string',
        enum: ['px', 'rem'],
        description: 'Dimension unit (default: px)',
        default: 'px',
      },
      rem_base: {
        type: 'number',
        description: 'Base value for rem conversion (default: 16)',
        default: 16,
      },
    },
    required: ['file_key'],
  },

  usageNotes: [
    'Use tailwind format for Tailwind CSS configuration',
    'Use css format for CSS custom properties',
    'Use scss format for SCSS variables',
    'Set rem for dimension_unit for responsive designs',
    'Adjust rem_base to match your project settings',
  ],

  constraints: [
    'Requires FIGMA_ACCESS_TOKEN environment variable',
    'Only extracts published variables',
    'Complex variable modes may not be fully supported',
  ],

  antiPatterns: [
    'Using px units when rem is more appropriate',
    'Not matching color_format to project standards',
  ],

  examples: [
    {
      description: 'Extract tokens for Tailwind',
      scenario: 'Generate Tailwind config from Figma',
      input: { file_key: 'abc123xyz', format: 'tailwind', dimension_unit: 'rem' },
      expectedBehavior: 'Returns Tailwind-compatible token configuration',
    },
  ],

  tokenCost: 350,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['design'],
  alternatives: [],
  relatedTools: ['figma_map', 'figma_audit'],
};

export const figmaAuditTool: ToolDefinition = {
  name: 'figma_audit',
  displayName: 'Figma Audit',

  description: `Run a design audit on a Figma file to check for naming conventions, missing auto-layout, and other best practices.

Use this to analyze a Figma file for design system compliance and best practices. Returns a list of issues with severity and recommendations.

Requires FIGMA_ACCESS_TOKEN environment variable to be set.`,

  parameters: {
    type: 'object',
    properties: {
      file_key: {
        type: 'string',
        description: 'Figma file key to audit',
      },
      depth: {
        type: 'number',
        description: 'Maximum depth to traverse (optional)',
      },
      rules: {
        type: 'array',
        description:
          "Specific rules to run (e.g., ['layer-naming', 'missing-autolayout']). Runs all by default.",
        items: { type: 'string' },
      },
      exclude_rules: {
        type: 'array',
        description: 'Rules to exclude from the audit',
        items: { type: 'string' },
      },
    },
    required: ['file_key'],
  },

  usageNotes: [
    'Run without rules parameter to check all rules',
    'Use exclude_rules to skip known intentional violations',
    'Focus on high-severity issues first',
    'Common rules: layer-naming, missing-autolayout, color-consistency',
  ],

  constraints: [
    'Requires FIGMA_ACCESS_TOKEN environment variable',
    'Large files may take longer to audit',
    'Custom rules are not supported',
  ],

  antiPatterns: [
    'Ignoring all audit results without review',
    'Running on very large files without depth limit',
  ],

  examples: [
    {
      description: 'Full design audit',
      scenario: 'Check file for all best practices',
      input: { file_key: 'abc123xyz' },
      expectedBehavior: 'Returns list of issues with severity levels',
    },
    {
      description: 'Focused audit',
      scenario: 'Check only naming conventions',
      input: { file_key: 'abc123xyz', rules: ['layer-naming'] },
      expectedBehavior: 'Returns only naming convention issues',
    },
  ],

  tokenCost: 350,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['design'],
  alternatives: [],
  relatedTools: ['figma_map', 'figma_tokens'],
};

export const figmaSearchTool: ToolDefinition = {
  name: 'figma_search',
  displayName: 'Figma Search',

  description: `Search for nodes in a Figma file by name, type, or text content.

Use this to find specific elements within a Figma design file. Can search by node name, node type, or text content.

Requires FIGMA_ACCESS_TOKEN environment variable to be set.`,

  parameters: {
    type: 'object',
    properties: {
      file_key: {
        type: 'string',
        description: 'Figma file key to search in',
      },
      name: {
        type: 'string',
        description: 'Search by node name (partial match)',
      },
      type: {
        type: 'string',
        description: 'Filter by node type (e.g., FRAME, TEXT, COMPONENT)',
      },
      text: {
        type: 'string',
        description: 'Search text nodes by content',
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return (default: 10)',
        default: 10,
      },
    },
    required: ['file_key'],
  },

  usageNotes: [
    'At least one search parameter (name, type, or text) is recommended',
    'Combine parameters to narrow results',
    'Common types: FRAME, TEXT, COMPONENT, INSTANCE, GROUP',
    'Name search is case-insensitive partial match',
  ],

  constraints: [
    'Requires FIGMA_ACCESS_TOKEN environment variable',
    'Large files may have many matches',
    'Limit results for faster response',
  ],

  antiPatterns: [
    'Searching without any filter parameters',
    'Setting very high limit on large files',
  ],

  examples: [
    {
      description: 'Find buttons',
      scenario: 'Search for all button components',
      input: { file_key: 'abc123xyz', name: 'button', type: 'COMPONENT' },
      expectedBehavior: 'Returns button components matching the name',
    },
    {
      description: 'Find specific text',
      scenario: 'Find nodes containing specific copy',
      input: { file_key: 'abc123xyz', text: 'Sign up' },
      expectedBehavior: 'Returns text nodes containing "Sign up"',
    },
  ],

  tokenCost: 300,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['design'],
  alternatives: [],
  relatedTools: ['figma_map'],
};

export const figmaAliasListTool: ToolDefinition = {
  name: 'figma_alias_list',
  displayName: 'Figma Alias List',

  description: `List all saved Figma design aliases (shortcuts to specific files/nodes).

Aliases are saved shortcuts that map a friendly name to a Figma file key and optional node ID. Use this to see all configured aliases.`,

  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },

  usageNotes: [
    'Returns all configured Figma aliases',
    'Aliases simplify referencing frequently used designs',
    'Use figma_alias_resolve to get the actual file key from an alias',
  ],

  constraints: ['Aliases must be configured in project settings'],

  antiPatterns: [],

  examples: [
    {
      description: 'List all aliases',
      scenario: 'See available design shortcuts',
      input: {},
      expectedBehavior: 'Returns list of alias names and descriptions',
    },
  ],

  tokenCost: 150,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['design'],
  alternatives: [],
  relatedTools: ['figma_alias_resolve', 'figma_map'],
};

export const figmaAliasResolveTool: ToolDefinition = {
  name: 'figma_alias_resolve',
  displayName: 'Figma Alias Resolve',

  description: `Resolve a design alias to its Figma file key and node ID.

Use this to convert a friendly alias name into the actual Figma file key and optional node ID for use with other Figma tools.`,

  parameters: {
    type: 'object',
    properties: {
      alias: {
        type: 'string',
        description: 'Alias name to resolve',
        examples: ['main-design', 'component-library', 'icons'],
      },
    },
    required: ['alias'],
  },

  usageNotes: [
    'Use figma_alias_list first to see available aliases',
    'Resolved file_key can be used with other figma_* tools',
    'Node ID is optional and points to a specific element',
  ],

  constraints: [
    'Alias must exist in project configuration',
    'Returns error for unknown aliases',
  ],

  antiPatterns: ['Guessing alias names without checking figma_alias_list'],

  examples: [
    {
      description: 'Resolve an alias',
      scenario: 'Get file key for the main design',
      input: { alias: 'main-design' },
      expectedBehavior: 'Returns file_key and optional node_id',
    },
  ],

  tokenCost: 150,
  safetyLevel: 'safe',
  requiresConfirmation: false,

  categories: ['design'],
  alternatives: [],
  relatedTools: ['figma_alias_list', 'figma_map'],
};
