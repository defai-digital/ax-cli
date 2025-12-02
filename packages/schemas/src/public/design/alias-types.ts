/**
 * Design Alias Schemas
 *
 * Zod schemas for the alias system that maps human-readable names
 * to Figma file keys and node IDs.
 *
 * @module design/alias-types
 */

import { z } from 'zod';
import { brand, type Brand } from '../core/brand-types.js';

// =============================================================================
// Brand Types
// =============================================================================

/**
 * Design alias name - dot-separated path (e.g., "landing.hero", "ds.colors.primary")
 */
export type DesignAlias = Brand<string, 'DesignAlias'>;

/**
 * Alias format pattern
 */
const ALIAS_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*(-[a-z0-9]+)*$/;

/**
 * Validate alias format: lowercase letters, numbers, dots, hyphens
 * Examples: "landing.hero", "ds.colors.primary", "button-primary"
 *
 * Note: This schema validates but does NOT transform to branded type
 * to avoid TypeScript declaration emit issues with __brand symbol.
 * Use `createDesignAlias()` to create branded values.
 */
export const DesignAliasSchema = z
  .string()
  .min(1, 'Alias cannot be empty')
  .max(100, 'Alias too long (max 100 characters)')
  .regex(
    ALIAS_PATTERN,
    'Alias must start with lowercase letter, use dots for hierarchy (e.g., "landing.hero")'
  );

/**
 * Create a branded DesignAlias from a validated string
 */
export function createDesignAlias(value: string): DesignAlias {
  const validated = DesignAliasSchema.parse(value);
  return brand<string, 'DesignAlias'>(validated);
}

/**
 * Safely parse and create a DesignAlias
 */
export function parseDesignAlias(value: unknown): { success: true; data: DesignAlias } | { success: false; error: z.ZodError } {
  const result = DesignAliasSchema.safeParse(value);
  if (result.success) {
    return { success: true, data: brand<string, 'DesignAlias'>(result.data) };
  }
  return { success: false, error: result.error };
}

// =============================================================================
// Alias Target Schema
// =============================================================================

/**
 * Target reference for an alias
 */
export const AliasTargetSchema = z.object({
  /** Figma file key */
  fileKey: z.string().min(1, 'File key required'),
  /** Node ID within the file */
  nodeId: z.string().regex(/^\d+:\d+$/, 'Invalid node ID format'),
  /** Optional description of this alias */
  description: z.string().optional(),
  /** When this alias was created/updated */
  updatedAt: z.string().datetime().optional(),
});
export type AliasTarget = z.infer<typeof AliasTargetSchema>;

// =============================================================================
// Alias Configuration File Schema
// =============================================================================

/**
 * Complete alias configuration stored in .ax-cli/design.json
 */
export const DesignConfigSchema = z.object({
  /** Schema version for future migrations */
  version: z.literal(1),

  /** Default file key when not specified in alias */
  defaultFile: z.string().min(1).optional(),

  /** Optional design system file key (for DS-specific operations) */
  dsFile: z.string().min(1).optional(),

  /** Map of alias names to targets */
  aliases: z.record(
    z.string(), // Key is the alias name (validated separately)
    AliasTargetSchema
  ),

  /** Metadata about the configuration */
  meta: z.object({
    /** When config was last modified */
    lastModified: z.string().datetime().optional(),
    /** Figma file names for display */
    fileNames: z.record(z.string(), z.string()).optional(),
  }).optional(),
});
export type DesignConfig = z.infer<typeof DesignConfigSchema>;

/**
 * Create empty design config
 */
export function createEmptyDesignConfig(): DesignConfig {
  return {
    version: 1,
    aliases: {},
  };
}

// =============================================================================
// Alias Operation Schemas
// =============================================================================

/**
 * Input for adding a new alias
 */
export const AddAliasInputSchema = z.object({
  alias: DesignAliasSchema,
  fileKey: z.string().min(1, 'File key required'),
  nodeId: z.string().regex(/^\d+:\d+$/, 'Invalid node ID format'),
  description: z.string().optional(),
});
export type AddAliasInput = z.infer<typeof AddAliasInputSchema>;

/**
 * Result of alias operations
 */
export const AliasOperationResultSchema = z.object({
  success: z.boolean(),
  alias: z.string(),
  message: z.string(),
  target: AliasTargetSchema.optional(),
});
export type AliasOperationResult = z.infer<typeof AliasOperationResultSchema>;

// =============================================================================
// Alias Resolution Schema
// =============================================================================

/**
 * Resolved alias with all information
 */
export const ResolvedAliasSchema = z.object({
  /** Original alias name */
  alias: z.string(),
  /** Resolved file key */
  fileKey: z.string(),
  /** Resolved node ID */
  nodeId: z.string(),
  /** Whether this was explicitly defined or derived */
  source: z.enum(['explicit', 'default-file', 'ds-file']),
  /** Description if available */
  description: z.string().optional(),
});
export type ResolvedAlias = z.infer<typeof ResolvedAliasSchema>;

/**
 * Alias resolution error
 */
export const AliasResolutionErrorSchema = z.object({
  alias: z.string(),
  error: z.enum([
    'not_found',
    'no_default_file',
    'invalid_format',
    'ambiguous',
  ]),
  message: z.string(),
  suggestions: z.array(z.string()).optional(),
});
export type AliasResolutionError = z.infer<typeof AliasResolutionErrorSchema>;

// =============================================================================
// Alias List Display Schema
// =============================================================================

/**
 * Alias entry for display in list command
 */
export const AliasListEntrySchema = z.object({
  alias: z.string(),
  fileKey: z.string(),
  nodeId: z.string(),
  fileName: z.string().optional(),
  nodeName: z.string().optional(),
  description: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type AliasListEntry = z.infer<typeof AliasListEntrySchema>;

/**
 * Full alias list response
 */
export const AliasListResponseSchema = z.object({
  defaultFile: z.string().optional(),
  dsFile: z.string().optional(),
  aliases: z.array(AliasListEntrySchema),
  total: z.number(),
});
export type AliasListResponse = z.infer<typeof AliasListResponseSchema>;
