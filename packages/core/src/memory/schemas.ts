/**
 * Zod schemas for Project Memory validation
 *
 * Provides runtime validation for memory.json structure
 */

import { z } from 'zod';

/**
 * Schema for directory configuration
 */
export const DirectoryConfigSchema = z.object({
  path: z.string().min(1, 'Directory path cannot be empty'),
  max_depth: z.number().int().min(1).max(10),
});

/**
 * Schema for source configuration
 */
export const SourceConfigSchema = z.object({
  directories: z.array(DirectoryConfigSchema),
  files: z.array(z.string()),
  ignore: z.array(z.string()),
});

/**
 * Schema for context sections token distribution
 */
export const ContextSectionsSchema = z.object({
  structure: z.number().int().min(0).optional(),
  readme: z.number().int().min(0).optional(),
  config: z.number().int().min(0).optional(),
  patterns: z.number().int().min(0).optional(),
});

/**
 * Schema for generated context data
 */
export const ContextDataSchema = z.object({
  formatted: z.string(),
  token_estimate: z.number().int().min(0),
  sections: ContextSectionsSchema,
});

/**
 * Schema for cache statistics
 */
export const CacheStatsSchema = z.object({
  last_cached_tokens: z.number().int().min(0).optional(),
  last_prompt_tokens: z.number().int().min(0).optional(),
  total_tokens_saved: z.number().int().min(0).optional(),
  usage_count: z.number().int().min(0).optional(),
  last_used_at: z.string().datetime().optional(),
});

/**
 * Main Project Memory schema
 */
export const ProjectMemorySchema = z.object({
  version: z.literal(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  project_root: z.string().min(1),
  content_hash: z.string().regex(
    /^sha256:[a-f0-9]{64}$/,
    'Content hash must be in format: sha256:<64 hex chars>'
  ),
  source: SourceConfigSchema,
  context: ContextDataSchema,
  stats: CacheStatsSchema.optional(),
});

/**
 * Inferred TypeScript type from schema
 */
export type ProjectMemorySchema = z.infer<typeof ProjectMemorySchema>;

/**
 * Safe validation result type
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Safely validate project memory data
 * Returns a discriminated union for easy error handling
 */
export function safeValidateProjectMemory(
  data: unknown
): ValidationResult<ProjectMemorySchema> {
  const result = ProjectMemorySchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format error message (Zod 4 uses .issues instead of .errors)
  const errors = result.error.issues
    .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
    .join('; ');

  return { success: false, error: errors };
}

/**
 * Validate partial memory update (for stats updates)
 */
export function safeValidateCacheStats(
  data: unknown
): ValidationResult<z.infer<typeof CacheStatsSchema>> {
  const result = CacheStatsSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues
    .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
    .join('; ');

  return { success: false, error: errors };
}

/**
 * Validate source configuration
 */
export function safeValidateSourceConfig(
  data: unknown
): ValidationResult<z.infer<typeof SourceConfigSchema>> {
  const result = SourceConfigSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues
    .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
    .join('; ');

  return { success: false, error: errors };
}
