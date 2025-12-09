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
  subagent: z.object({
    general_max_tool_rounds: z.number().positive().int().optional(),
    testing_max_tool_rounds: z.number().positive().int().optional(),
    documentation_max_tool_rounds: z.number().positive().int().optional(),
    refactoring_max_tool_rounds: z.number().positive().int().optional(),
    analysis_max_tool_rounds: z.number().positive().int().optional(),
    debug_max_tool_rounds: z.number().positive().int().optional(),
    performance_max_tool_rounds: z.number().positive().int().optional(),
    default_context_depth: z.number().positive().int().optional(),
    deep_context_depth: z.number().positive().int().optional(),
    shallow_context_depth: z.number().positive().int().optional(),
    max_concurrent_agents: z.number().positive().int().optional(),
    max_concurrent_tools: z.number().positive().int().optional(),
  }).optional(),
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
  timeouts: z.object({
    bash_default: z.number().positive().int().optional(),
    search_default: z.number().positive().int().optional(),
    hook_default: z.number().positive().int().optional(),
    streaming_first_chunk: z.number().positive().int().optional(),
    streaming_idle: z.number().positive().int().optional(),
    cache_ttl: z.number().positive().int().optional(),
    settings_cache_ttl: z.number().positive().int().optional(),
    api_health_check: z.number().positive().int().optional(),
    command_check: z.number().positive().int().optional(),
    mcp_init: z.number().positive().int().optional(),
    shutdown: z.number().positive().int().optional(),
    npm_list: z.number().positive().int().optional(),
    npm_view: z.number().positive().int().optional(),
    update_install: z.number().positive().int().optional(),
    notification_display: z.number().positive().int().optional(),
    tool_approval: z.number().positive().int().optional(),
    context_cleanup_interval: z.number().positive().int().optional(),
    confirmation_timeout: z.number().positive().int().optional(),
  }).optional(),
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

export const PromptsYamlSchema = z.object({
  system_prompt: z.object({
    identity: z.string().min(1),
    professional_objectivity: PromptSectionSchema.optional(),
    core_principles: PromptSectionSchema.optional(),
    tools_header: z.string().min(1),
    tools: z.array(ToolDefinitionSchema),
    sections: z.record(z.string(), PromptSectionSchema),
    closing: z.string().min(1),
  }),
  custom_instructions_prefix: z.string(),
  custom_instructions_suffix: z.string(),
});

export type PromptsYaml = z.infer<typeof PromptsYamlSchema>;
export type PromptSection = z.infer<typeof PromptSectionSchema>;

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
