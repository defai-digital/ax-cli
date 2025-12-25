/**
 * Zod validation schemas for YAML configuration files
 * Ensures configuration integrity at load time
 */

import { z } from 'zod';

/**
 * Schema for model configuration in models.yaml
 */
export const ModelConfigSchema = z.object({
  name: z.string().min(1),
  context_window: z.number().positive().int(),
  max_output_tokens: z.number().positive().int(),
  default_max_tokens: z.number().positive().int(),
  supports_thinking: z.boolean(),
  default_temperature: z.number().min(0).max(2),
  temperature_range: z.object({
    min: z.number().min(0).max(2),
    max: z.number().min(0).max(2),
  }).refine(data => data.min <= data.max, {
    message: "temperature_range.min must be <= max",
  }),
  token_efficiency: z.number().positive(),
});

export const ModelsYamlSchema = z.object({
  default_model: z.string().min(1),
  models: z.record(z.string(), ModelConfigSchema),
}).refine(data => data.models[data.default_model] !== undefined, {
  message: "default_model must exist in models dictionary",
});

export type ModelsYaml = z.infer<typeof ModelsYamlSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

/**
 * Schema for application settings in settings.yaml
 */
/**
 * Schema for timeout configuration
 * All timeouts are optional with sensible defaults in constants.ts
 */
export const TimeoutsSchema = z.object({
  bash_default: z.number().positive().int().optional(),
  search_default: z.number().positive().int().optional(),
  hook_default: z.number().positive().int().optional(),
  streaming_first_chunk: z.number().positive().int().optional(),
  streaming_idle: z.number().positive().int().optional(),
  process_execution: z.number().positive().int().optional(),
  process_idle: z.number().positive().int().optional(),
  paste_timeout: z.number().positive().int().optional(),
  cache_ttl: z.number().positive().int().optional(),
  settings_cache_ttl: z.number().positive().int().optional(),
  api_request: z.number().positive().int().optional(),
  api_health_check: z.number().positive().int().optional(),
  command_check: z.number().positive().int().optional(),
  mcp_init: z.number().positive().int().optional(),
  shutdown: z.number().positive().int().optional(),
  notification_display: z.number().positive().int().optional(),
  tool_approval: z.number().positive().int().optional(),
  context_cleanup_interval: z.number().positive().int().optional(),
  confirmation_timeout: z.number().positive().int().optional(),
  validator_short: z.number().positive().int().optional(),
  validator_long: z.number().positive().int().optional(),
  connection: z.number().positive().int().optional(),
  git_operation: z.number().positive().int().optional(),
  doctor_command: z.number().positive().int().optional(),
}).optional();

export const SettingsYamlSchema = z.object({
  agent: z.object({
    max_tool_rounds: z.number().positive().int(),
    default_timeout: z.number().positive().int(),
    default_max_tokens: z.number().positive().int(),
    max_recent_tool_calls: z.number().positive().int(),
    max_messages: z.number().positive().int().optional(),
    loop_detection_threshold: z.number().nonnegative().int(),
    enable_loop_detection: z.boolean(),
  }),
  file: z.object({
    max_file_size: z.number().positive().int(),
    max_buffer_size: z.number().positive().int(),
    diff_context_lines: z.number().nonnegative().int(),
  }),
  history: z.object({
    max_history_size: z.number().positive().int(),
  }),
  mcp: z.object({
    client_name: z.string().min(1),
    client_version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver format"),
    default_timeout: z.number().positive().int(),
    token_warning_threshold: z.number().positive().int(),
    token_hard_limit: z.number().positive().int(),
    truncation_enabled: z.boolean(),
  }),
  timeouts: TimeoutsSchema,
  ui: z.object({
    status_update_interval: z.number().positive().int(),
    processing_timer_interval: z.number().positive().int(),
    verbosity_level: z.string().optional(),
    group_tool_calls: z.boolean().optional(),
    max_group_size: z.number().positive().int().optional(),
    group_time_window: z.number().positive().int().optional(),
    /** Enable semantic grouping (Claude Code-style) */
    semantic_grouping: z.boolean().optional(),
    /** Max operations in a semantic group */
    max_semantic_group_size: z.number().positive().int().optional(),
    /** Max visible tool lines for rolling display (Claude Code-style) */
    max_visible_tool_lines: z.number().positive().int().optional(),
  }),
  token: z.object({
    tokens_per_message: z.number().nonnegative().int(),
    tokens_for_reply_priming: z.number().nonnegative().int(),
    default_model: z.string().min(1),
    default_encoding: z.string().min(1),
    cache_max_size: z.number().positive().int(),
    chars_per_token_estimate: z.number().positive().int(),
  }),
  cache: z.object({
    default_max_size: z.number().positive().int(),
    default_ttl: z.number().positive().int(),
    tool_args_cache_max_size: z.number().positive().int().optional(),
    tool_args_cache_prune_count: z.number().positive().int().optional(),
  }),
  performance: z.object({
    debounce_delay: z.number().nonnegative().int(),
    throttle_limit: z.number().positive().int(),
    slow_operation_threshold: z.number().positive().int(),
  }),
  tool_names: z.record(z.string(), z.string()),
});

export type SettingsYaml = z.infer<typeof SettingsYamlSchema>;

/**
 * Schema for message templates in messages.yaml
 */
export const MessagesYamlSchema = z.object({
  errors: z.record(z.string(), z.string()),
  warnings: z.record(z.string(), z.string()),
  success: z.record(z.string(), z.string()),
  info: z.record(z.string(), z.string()),
  ui: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  mcp_commands: z.record(z.string(), z.string()).optional(),
  migration: z.record(z.string(), z.string()).optional(),
});

export type MessagesYaml = z.infer<typeof MessagesYamlSchema>;

/**
 * Schema for prompt section
 */
export const PromptSectionSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  rules: z.array(z.string()).optional(),
  steps: z.array(z.string()).optional(),
  guidelines: z.array(z.string()).optional(),
});

export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  optional: z.boolean().optional(),
});

/**
 * New simplified prompts.yaml schema
 * Supports the Claude Code-style prompt structure with named sections
 */
export const PromptsYamlSchema = z.object({
  system_prompt: z.object({
    identity: z.string().min(1),
    // Named sections with title + content
    thinking: PromptSectionSchema.optional(),
    autonomy: PromptSectionSchema.optional(),
    context: PromptSectionSchema.optional(),
    tools: PromptSectionSchema.optional(),
    verification: PromptSectionSchema.optional(),
    safety: PromptSectionSchema.optional(),
    code_quality: PromptSectionSchema.optional(),
    scenarios: PromptSectionSchema.optional(),
    communication: PromptSectionSchema.optional(),
    agents: PromptSectionSchema.optional(),
    uncertainty: PromptSectionSchema.optional(),
    // Legacy fields (optional for backward compatibility)
    professional_objectivity: PromptSectionSchema.optional(),
    core_principles: PromptSectionSchema.optional(),
    tools_header: z.string().optional(),
    sections: z.record(z.string(), PromptSectionSchema).optional(),
    closing: z.string().min(1),
  }),
  custom_instructions_prefix: z.string(),
  custom_instructions_suffix: z.string(),
});

export type PromptsYaml = z.infer<typeof PromptsYamlSchema>;
export type PromptSection = z.infer<typeof PromptSectionSchema>;

/**
 * Schema for provider-specific model configuration
 * Used by grok-models.yaml, glm-models.yaml, ax-cli-models.yaml
 */
export const ProviderModelConfigSchema = z.object({
  name: z.string().min(1),
  context_window: z.number().positive().int(),
  max_output_tokens: z.number().positive().int(),
  supports_thinking: z.boolean(),
  supports_vision: z.boolean(),
  supports_search: z.boolean(),
  supports_seed: z.boolean(),
  default_temperature: z.number().min(0).max(2),
  description: z.string().min(1),
  tier: z.string().optional(), // recommended, fast, flagship, legacy, etc.
});

export const ProviderModelsYamlSchema = z.object({
  provider: z.string().min(1),
  display_name: z.string().min(1),
  default_model: z.string().min(1),
  fast_model: z.string().optional(),
  default_vision_model: z.string().optional(),
  models: z.record(z.string(), ProviderModelConfigSchema),
  aliases: z.record(z.string(), z.string()).optional(),
}).refine(data => data.models[data.default_model] !== undefined, {
  message: "default_model must exist in models dictionary",
}).refine(data => !data.fast_model || data.models[data.fast_model] !== undefined, {
  message: "fast_model must exist in models dictionary if specified",
});

export type ProviderModelsYaml = z.infer<typeof ProviderModelsYamlSchema>;
export type ProviderModelYamlConfig = z.infer<typeof ProviderModelConfigSchema>;

/**
 * Validation helpers
 */
export function validateModelsYaml(data: unknown): { success: true; data: ModelsYaml } | { success: false; error: string } {
  const result = ModelsYamlSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}

export function validateSettingsYaml(data: unknown): { success: true; data: SettingsYaml } | { success: false; error: string } {
  const result = SettingsYamlSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}

export function validateMessagesYaml(data: unknown): { success: true; data: MessagesYaml } | { success: false; error: string } {
  const result = MessagesYamlSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}

export function validatePromptsYaml(data: unknown): { success: true; data: PromptsYaml } | { success: false; error: string } {
  const result = PromptsYamlSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}

export function validateProviderModelsYaml(data: unknown): { success: true; data: ProviderModelsYaml } | { success: false; error: string } {
  const result = ProviderModelsYamlSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}
