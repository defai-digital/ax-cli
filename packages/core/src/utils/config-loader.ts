/**
 * YAML Configuration Loader
 * Loads and caches configuration from YAML files with Zod validation
 */

import { readFileSync } from 'fs';
import { basename, extname, isAbsolute, join, normalize, relative, resolve } from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { z } from 'zod';
import { ModelsYamlSchema, SettingsYamlSchema, PromptsYamlSchema, MessagesYamlSchema, ProviderModelsYamlSchema } from '../schemas/yaml-schemas.js';
import type { ProviderModelsYaml, ProviderModelYamlConfig } from '../schemas/yaml-schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for loaded configurations
const configCache = new Map<string, any>();

/**
 * Get the config directory path
 */
function getConfigDir(): string {
  // In development: src/utils -> ../../config-defaults
  // In production: dist/utils -> ../../config-defaults
  return join(__dirname, '../../config-defaults');
}

function validateConfigFilename(filename: string, configDir: string): string {
  const normalized = normalize(filename);

  // Reject absolute paths or attempts to traverse outside the config directory
  if (isAbsolute(normalized) || /(^|[\\/])\.\.(?:[\\/]|$)/.test(normalized)) {
    throw new Error(`Invalid config filename: ${filename}. Path traversal is not allowed.`);
  }

  // Ensure the filename does not contain path separators
  if (normalized !== basename(normalized)) {
    throw new Error(`Invalid config filename: ${filename}. Directory components are not allowed.`);
  }

  // Only allow YAML files to be loaded
  const ext = extname(normalized).toLowerCase();
  if (ext !== '.yaml' && ext !== '.yml') {
    throw new Error(`Invalid config filename: ${filename}. Only .yaml/.yml files are allowed.`);
  }

  const configPath = resolve(configDir, normalized);
  const resolvedConfigDir = resolve(configDir);
  const relativePath = relative(resolvedConfigDir, configPath);

  // Final guard: ensure the resolved path is still within the expected config directory
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(`Invalid config path resolved for ${filename}.`);
  }

  return configPath;
}

/**
 * Load a YAML configuration file with optional schema validation
 */
export function loadYamlConfig<T = any>(filename: string, schema?: z.ZodSchema<T>): T {
  // Check cache first
  if (configCache.has(filename)) {
    return configCache.get(filename) as T;
  }

  try {
    const configDir = getConfigDir();
    const configPath = validateConfigFilename(filename, configDir);
    const fileContents = readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents);

    // Validate with schema if provided
    if (schema) {
      // Schema validation will catch undefined/null values
      const result = schema.safeParse(config);
      if (!result.success) {
        throw new Error(`Validation failed for ${filename}: ${result.error.message}`);
      }
      configCache.set(filename, result.data);
      return result.data;
    }

    // Cache the result (may be undefined for empty files)
    configCache.set(filename, config);
    return config as T;
  } catch (error) {
    throw new Error(`Failed to load config file ${filename}: ${(error as Error).message}`);
  }
}

/**
 * Clear the configuration cache
 * Useful for testing or reloading configs
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Load model configurations
 */
export interface ModelConfig {
  name: string;
  context_window: number;
  max_output_tokens: number;
  default_max_tokens: number;
  supports_thinking: boolean;
  supports_vision?: boolean;
  default_temperature: number;
  temperature_range: {
    min: number;
    max: number;
  };
  token_efficiency: number;
}

export interface ModelsYaml {
  default_model: string;
  models: Record<string, ModelConfig>;
}

export function loadModelsConfig(): ModelsYaml {
  return loadYamlConfig<ModelsYaml>('models.yaml', ModelsYamlSchema);
}

/**
 * Load application settings
 */
export interface SettingsYaml {
  agent: {
    max_tool_rounds: number;
    default_timeout: number;
    default_max_tokens: number;
    max_recent_tool_calls: number;
    max_messages?: number;
    loop_detection_threshold: number;
    enable_loop_detection: boolean;
  };
  file: {
    max_file_size: number;
    max_buffer_size: number;
    diff_context_lines: number;
  };
  history: {
    max_history_size: number;
  };
  mcp: {
    client_name: string;
    client_version: string;
    default_timeout: number;
    health_check_interval?: number;
    reconnect_max_delay?: number;
    token_warning_threshold: number;
    token_hard_limit: number;
    truncation_enabled: boolean;
  };
  timeouts?: {
    bash_default?: number;
    search_default?: number;
    hook_default?: number;
    streaming_first_chunk?: number;
    streaming_idle?: number;
    process_execution?: number;
    process_idle?: number;
    paste_timeout?: number;
    cache_ttl?: number;
    settings_cache_ttl?: number;
    /** LLM API request timeout (10 minutes for long contexts) */
    api_request?: number;
    api_health_check?: number;
    command_check?: number;
    mcp_init?: number;
    shutdown?: number;
    notification_display?: number;
    tool_approval?: number;
    context_cleanup_interval?: number;
    confirmation_timeout?: number;
    /** Quick validation checks (e.g., Ollama ping) */
    validator_short?: number;
    /** Longer validation checks (e.g., API endpoint tests) */
    validator_long?: number;
    /** IPC/socket connection timeout */
    connection?: number;
    /** Git operation timeout (diff, status) */
    git_operation?: number;
    /** Doctor diagnostic command timeout */
    doctor_command?: number;
  };
  ui: {
    status_update_interval: number;
    processing_timer_interval: number;
    verbosity_level?: string;
    group_tool_calls?: boolean;
    max_group_size?: number;
    group_time_window?: number;
    /** Enable semantic grouping (Claude Code-style) */
    semantic_grouping?: boolean;
    /** Max operations in a semantic group */
    max_semantic_group_size?: number;
    /** Max visible tool lines for rolling display (Claude Code-style) */
    max_visible_tool_lines?: number;
  };
  token: {
    tokens_per_message: number;
    tokens_for_reply_priming: number;
    default_model: string;
    default_encoding: string;
    cache_max_size: number;
    chars_per_token_estimate: number;
  };
  cache: {
    default_max_size: number;
    default_ttl: number;
    tool_args_cache_max_size?: number;
    tool_args_cache_prune_count?: number;
  };
  performance: {
    debounce_delay: number;
    throttle_limit: number;
    slow_operation_threshold: number;
  };
  tool_names: Record<string, string>;
}

export function loadSettingsConfig(): SettingsYaml {
  return loadYamlConfig<SettingsYaml>('settings.yaml', SettingsYamlSchema);
}

/**
 * Load prompt configurations
 */
export interface PromptSection {
  title?: string;
  content?: string;
  rules?: string[];
  steps?: string[];
  guidelines?: string[];
}

export interface PromptsYaml {
  system_prompt: {
    identity: string;
    // New Claude Code-style named sections
    thinking?: PromptSection;
    autonomy?: PromptSection;
    context?: PromptSection;
    tools?: PromptSection;
    verification?: PromptSection;
    safety?: PromptSection;
    code_quality?: PromptSection;
    scenarios?: PromptSection;
    communication?: PromptSection;
    agents?: PromptSection;
    uncertainty?: PromptSection;
    // Legacy fields (for backward compatibility)
    professional_objectivity?: PromptSection;
    core_principles?: PromptSection;
    tools_header?: string;
    sections?: Record<string, PromptSection>;
    closing: string;
  };
  custom_instructions_prefix: string;
  custom_instructions_suffix: string;
}

export function loadPromptsConfig(): PromptsYaml {
  return loadYamlConfig<PromptsYaml>('prompts.yaml', PromptsYamlSchema);
}

/**
 * Load message templates
 */
export interface MessagesYaml {
  errors: Record<string, string>;
  warnings: Record<string, string>;
  success: Record<string, string>;
  info: Record<string, string>;
  ui?: {
    api_key_input?: Record<string, string>;
    [key: string]: Record<string, string> | undefined;
  };
  mcp_commands?: Record<string, string>;
  migration?: Record<string, string>;
}

export function loadMessagesConfig(): MessagesYaml {
  return loadYamlConfig<MessagesYaml>('messages.yaml', MessagesYamlSchema);
}

/**
 * Format a message template with variables
 * Supports alphanumeric keys with hyphens and underscores
 * Example: formatMessage("Tool {tool-name} not found", { "tool-name": "bash" })
 */
export function formatMessage(template: string, variables: Record<string, string | number>): string {
  // Match {key} where key can contain letters, numbers, hyphens, and underscores
  return template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (match, key) => {
    return variables[key]?.toString() ?? match;
  });
}

/**
 * Load provider-specific model configurations from YAML
 * Files: grok-models.yaml, glm-models.yaml, ax-cli-models.yaml
 *
 * @param providerName - Provider name (e.g., 'grok', 'glm', 'ax-cli')
 * @returns Provider models configuration or null if not found
 */
export function loadProviderModelsConfig(providerName: string): ProviderModelsYaml | null {
  const filename = `${providerName}-models.yaml`;
  try {
    return loadYamlConfig<ProviderModelsYaml>(filename, ProviderModelsYamlSchema);
  } catch {
    // Return null if provider-specific YAML doesn't exist (fall back to hardcoded)
    return null;
  }
}

/**
 * Convert YAML model config to provider model config format
 * This bridges the YAML format to the TypeScript ProviderModelConfig interface
 */
export function convertYamlModelToProviderConfig(yamlModel: ProviderModelYamlConfig): {
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsThinking: boolean;
  supportsVision: boolean;
  supportsSearch: boolean;
  supportsSeed: boolean;
  defaultTemperature: number;
  description: string;
} {
  return {
    name: yamlModel.name,
    contextWindow: yamlModel.context_window,
    maxOutputTokens: yamlModel.max_output_tokens,
    supportsThinking: yamlModel.supports_thinking,
    supportsVision: yamlModel.supports_vision,
    supportsSearch: yamlModel.supports_search,
    supportsSeed: yamlModel.supports_seed,
    defaultTemperature: yamlModel.default_temperature,
    description: yamlModel.description,
  };
}

/**
 * Load and convert all provider models from YAML to provider format
 *
 * @param providerName - Provider name (e.g., 'grok', 'glm', 'ax-cli')
 * @returns Object with models, defaultModel, fastModel, aliases, or null if not found
 */
export function loadProviderModelsFromYaml(providerName: string): {
  models: Record<string, ReturnType<typeof convertYamlModelToProviderConfig>>;
  defaultModel: string;
  fastModel?: string;
  defaultVisionModel?: string;
  aliases?: Record<string, string>;
} | null {
  const yamlConfig = loadProviderModelsConfig(providerName);
  if (!yamlConfig) return null;

  const models: Record<string, ReturnType<typeof convertYamlModelToProviderConfig>> = {};
  for (const [modelId, yamlModel] of Object.entries(yamlConfig.models)) {
    models[modelId] = convertYamlModelToProviderConfig(yamlModel);
  }

  return {
    models,
    defaultModel: yamlConfig.default_model,
    fastModel: yamlConfig.fast_model,
    defaultVisionModel: yamlConfig.default_vision_model,
    aliases: yamlConfig.aliases,
  };
}
