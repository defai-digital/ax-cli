/**
 * YAML Configuration Loader
 * Loads and caches configuration from YAML files with Zod validation
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { z } from 'zod';
import { ModelsYamlSchema, SettingsYamlSchema, PromptsYamlSchema, MessagesYamlSchema } from '../schemas/yaml-schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for loaded configurations
const configCache = new Map<string, any>();

/**
 * Get the config directory path
 */
function getConfigDir(): string {
  // In development: src/utils -> ../../config
  // In production: dist/utils -> ../../config
  return path.join(__dirname, '../../config');
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
    const configPath = path.join(getConfigDir(), filename);
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents);

    // Validate with schema if provided
    if (schema) {
      const result = schema.safeParse(config);
      if (!result.success) {
        throw new Error(`Validation failed for ${filename}: ${result.error.message}`);
      }
      configCache.set(filename, result.data);
      return result.data;
    }

    // Cache the result
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
  };
  ui: {
    status_update_interval: number;
    processing_timer_interval: number;
  };
  token: {
    tokens_per_message: number;
    tokens_for_reply_priming: number;
    default_model: string;
    default_encoding: string;
    cache_max_size: number;
  };
  cache: {
    default_max_size: number;
    default_ttl: number;
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
    core_principles?: PromptSection;
    tools_header: string;
    tools: Array<{
      name: string;
      description: string;
      optional?: boolean;
    }>;
    sections: Record<string, PromptSection>;
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
 * Example: formatMessage("Tool {toolName} not found", { toolName: "bash" })
 */
export function formatMessage(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key]?.toString() ?? match;
  });
}
