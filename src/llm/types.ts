/**
 * GLM-4.6 API Type Definitions
 *
 * This file contains comprehensive type definitions for GLM-4.6 API features,
 * including advanced reasoning mode, configurable parameters, and enhanced
 * response structures.
 *
 * @see https://docs.z.ai/guides/llm/glm-4.6
 */

import type { LLMTool, LLMToolCall, SearchOptions } from "./client.js";
import { DEFAULT_MODEL } from "../constants.js";

/**
 * Thinking/Reasoning configuration for models with extended thinking support
 *
 * Supports two styles of thinking mode:
 * - GLM (Z.AI): Uses `thinking_mode` parameter with type "enabled"/"disabled"
 * - Grok 3 (xAI): Uses `reasoning_effort` parameter with "low"/"high" values
 *
 * When enabled, the model will include reasoning_content in responses,
 * showing the step-by-step thought process before generating the final answer.
 *
 * @example
 * ```typescript
 * // GLM style (default)
 * const thinking: ThinkingConfig = { type: "enabled" };
 *
 * // Grok 3 style with reasoning effort
 * const thinking: ThinkingConfig = { type: "enabled", reasoningEffort: "high" };
 * const response = await client.chat(messages, [], { thinking });
 * ```
 */
export interface ThinkingConfig {
  /**
   * Enable or disable thinking mode
   * - "enabled": Include reasoning process in responses
   * - "disabled": Standard response without reasoning
   */
  type: "enabled" | "disabled";

  /**
   * Reasoning effort level for Grok 3 models (xAI)
   * Only used when the provider uses 'reasoning_effort' style
   * - "low": Light reasoning for simpler tasks
   * - "high": Deep reasoning for complex tasks (default when enabled)
   */
  reasoningEffort?: "low" | "high";
}

/**
 * Sampling configuration for controlling output diversity and reproducibility
 *
 * Provider-specific behaviors:
 * - GLM (Z.AI): Uses `do_sample` parameter. Set to `false` for deterministic output.
 *   Seed is NOT supported by z.ai.
 * - Grok (xAI): Uses `seed` parameter for reproducible outputs.
 *   do_sample is NOT used by Grok.
 *
 * @example
 * ```typescript
 * // GLM: Deterministic mode for reproducible outputs
 * const sampling: SamplingConfig = { doSample: false };
 *
 * // Grok: Seed-based reproducible outputs
 * const sampling: SamplingConfig = { seed: 42 };
 *
 * const response = await client.chat(messages, [], { sampling });
 * ```
 */
export interface SamplingConfig {
  /**
   * Whether to sample the output to increase diversity (GLM only)
   * - true (default): Use random sampling based on temperature for creative outputs
   * - false: Use greedy decoding for deterministic, reproducible results
   *
   * When set to false, the model will always select the most probable token,
   * making outputs reproducible.
   *
   * Note: Only supported by GLM (z.ai). Ignored for Grok models.
   */
  doSample?: boolean;

  /**
   * Random seed for reproducible sampling (Grok only)
   *
   * Use the same seed value to get reproducible outputs from Grok models.
   *
   * Note: Only supported by Grok (xAI). For GLM models, use doSample: false instead.
   *
   * @example 42, 12345, Date.now()
   */
  seed?: number;

  /**
   * Nucleus sampling parameter (alternative to temperature)
   *
   * Controls diversity by limiting token selection to the smallest set
   * whose cumulative probability exceeds top_p.
   *
   * Recommended range: 0.8-0.95
   * Note: It's generally not advised to use both temperature and top_p simultaneously.
   *
   * @minimum 0.0
   * @maximum 1.0
   */
  topP?: number;
}

/**
 * Comprehensive options for GLM-4.6 chat requests
 *
 * Consolidates all available parameters for chat completions,
 * providing type-safe configuration for GLM-4.6 features.
 */
export interface ChatOptions {
  /**
   * Model identifier
   * @default "glm-4.6"
   * @example "glm-4.6"
   */
  model?: string;

  /**
   * Temperature controls randomness in responses
   *
   * - Lower values (0.6): More focused and deterministic
   * - Higher values (1.0): More creative and diverse
   *
   * @default 0.7
   * @minimum 0.6
   * @maximum 1.0
   */
  temperature?: number;

  /**
   * Maximum number of tokens to generate
   *
   * GLM-4.6 supports up to 128,000 output tokens
   *
   * @default 8192
   * @maximum 128000
   */
  maxTokens?: number;

  /**
   * Enable/disable advanced reasoning mode
   *
   * When enabled, responses include reasoning_content showing
   * the model's step-by-step thought process.
   */
  thinking?: ThinkingConfig;

  /**
   * Search parameters for web-enabled queries
   */
  searchOptions?: SearchOptions;

  /**
   * Tools/functions available for the model to call
   */
  tools?: LLMTool[];

  /**
   * Enable streaming responses
   * @default false
   */
  stream?: boolean;

  /**
   * Response format for structured output
   *
   * When set to { type: "json_object" }, the model will return valid JSON.
   * Use this for plan generation and other structured responses.
   *
   * @example { type: "json_object" }
   */
  responseFormat?: {
    type: "text" | "json_object";
  };

  /**
   * Sampling configuration for controlling output diversity and reproducibility
   *
   * Use this to enable deterministic mode or fine-tune sampling behavior.
   *
   * @example
   * ```typescript
   * // Deterministic mode
   * { sampling: { doSample: false, seed: 42 } }
   *
   * // Fine-tuned sampling with top_p
   * { sampling: { doSample: true, topP: 0.9 } }
   * ```
   */
  sampling?: SamplingConfig;

  /**
   * AbortSignal for cancelling the request
   *
   * Allows the caller to cancel in-progress requests when needed.
   */
  signal?: AbortSignal;
}

/**
 * GLM-4.6 enhanced response structure
 *
 * Extends the standard response with reasoning content and
 * enhanced usage metrics.
 */
export interface GLM46Response {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      /**
       * Reasoning process (only present when thinking is enabled)
       * Contains the step-by-step thought process before the final answer
       */
      reasoning_content?: string;
      tool_calls?: LLMToolCall[];
    };
    finish_reason: string;
  }>;
  /**
   * Token usage statistics
   */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    /**
     * Tokens used for reasoning (only when thinking is enabled)
     */
    reasoning_tokens?: number;
  };
}

/**
 * GLM-4.6 streaming response chunk
 *
 * Individual chunks received during streaming responses,
 * including support for reasoning content.
 */
export interface GLM46StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      /**
       * Incremental content from the final response
       */
      content?: string;
      /**
       * Incremental reasoning content (when thinking is enabled)
       * Shows the model's thought process as it develops
       */
      reasoning_content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
  /**
   * Token usage statistics (usually in the final chunk)
   */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number;
  };
}

/**
 * Type guard to check if a response is a GLM-4.6 response
 */
export function isGLM46Response(response: unknown): response is GLM46Response {
  if (typeof response !== 'object' || response === null) {
    return false;
  }
  const candidate = response as Partial<GLM46Response>;
  return 'choices' in response && Array.isArray(candidate.choices);
}

/**
 * Type guard to check if a chunk has reasoning content
 */
export function hasReasoningContent(
  chunk: GLM46StreamChunk
): chunk is GLM46StreamChunk & {
  choices: Array<{ delta: { reasoning_content: string } }>;
} {
  return (
    chunk.choices.length > 0 &&
    typeof chunk.choices[0]?.delta?.reasoning_content === 'string' &&
    chunk.choices[0].delta.reasoning_content.length > 0
  );
}

/**
 * Message content part for multimodal messages
 */
export type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/**
 * Message with multimodal content support
 */
export interface MultimodalMessage {
  role: "user" | "assistant" | "system";
  content: string | MessageContentPart[];
}

/**
 * GLM-4.6 model configurations
 *
 * Defines capabilities and limits for supported models
 */
export const GLM_MODELS = {
  "glm-4.6": {
    contextWindow: 200000,      // 200K tokens
    maxOutputTokens: 128000,    // 128K max output
    supportsThinking: true,
    supportsVision: false,
    defaultTemperature: 0.7,
    temperatureRange: { min: 0.6, max: 1.0 },
    tokenEfficiency: 1.3,       // 30% more efficient
  },
  "glm-4.5v": {
    contextWindow: 64000,       // 64K multimodal context
    maxOutputTokens: 16000,     // 16K max output
    supportsThinking: true,
    supportsVision: true,       // Vision capabilities
    defaultTemperature: 0.7,
    temperatureRange: { min: 0.6, max: 1.0 },
    tokenEfficiency: 1.2,
  },
} as const;

export type SupportedModel = keyof typeof GLM_MODELS;

/**
 * Get model configuration by name
 */
export function getModelConfig(model: string) {
  // Use the configured default model as fallback, not hardcoded "glm-4.6"
  return GLM_MODELS[model as SupportedModel] || GLM_MODELS[DEFAULT_MODEL as SupportedModel];
}

/**
 * Validate temperature for a given model
 *
 * @throws Error if temperature is out of valid range
 */
export function validateTemperature(temperature: number, model: string): void {
  const config = getModelConfig(model);
  const { min, max } = config.temperatureRange;

  if (temperature < min || temperature > max) {
    throw new Error(
      `Temperature ${temperature} is out of range for model ${model}. ` +
      `Valid range: ${min} - ${max}`
    );
  }
}

/**
 * Validate max tokens for a given model
 *
 * @throws Error if maxTokens exceeds model limit
 */
export function validateMaxTokens(maxTokens: number, model: string): void {
  const config = getModelConfig(model);

  if (maxTokens > config.maxOutputTokens) {
    throw new Error(
      `Max tokens ${maxTokens} exceeds model limit for ${model}. ` +
      `Maximum: ${config.maxOutputTokens}`
    );
  }

  if (maxTokens < 1) {
    throw new Error(`Max tokens must be at least 1, got ${maxTokens}`);
  }
}

/**
 * Validate thinking configuration for a given model
 * Supports both GLM models (glm-4.6) and Grok 3 models
 *
 * @throws Error if thinking is not supported by the model
 */
export function validateThinking(
  thinking: ThinkingConfig | undefined,
  model: string
): void {
  if (thinking && thinking.type === "enabled") {
    const modelLower = model.toLowerCase();

    // Grok 3 models support thinking via reasoning_effort
    if (modelLower.includes("grok-3")) {
      return; // Valid for Grok 3
    }

    // Check GLM model configuration
    const config = getModelConfig(model);
    if (!config.supportsThinking) {
      throw new Error(
        `Thinking mode is not supported by model ${model}. ` +
        `Use glm-4.6 for thinking capabilities, or grok-3 for Grok models.`
      );
    }
  }
}

/**
 * Create default chat options with sensible defaults
 */
export function createDefaultChatOptions(model?: string): Required<Omit<ChatOptions, 'thinking' | 'searchOptions' | 'tools' | 'responseFormat' | 'sampling' | 'signal'>> {
  // Use the configured default model as fallback, not hardcoded "glm-4.6"
  const modelName = model || DEFAULT_MODEL;
  const config = getModelConfig(modelName);

  return {
    model: modelName,
    temperature: config.defaultTemperature,
    maxTokens: Math.min(8192, config.maxOutputTokens), // Conservative default
    stream: false,
  };
}

/**
 * Validate sampling configuration
 *
 * @throws Error if sampling parameters are invalid or conflicting
 */
export function validateSampling(
  sampling: SamplingConfig | undefined,
  temperature?: number
): void {
  if (!sampling) return;

  // Validate top_p range
  if (sampling.topP !== undefined) {
    if (sampling.topP < 0 || sampling.topP > 1) {
      throw new Error(
        `top_p ${sampling.topP} is out of range. Valid range: 0.0 - 1.0`
      );
    }

    // Warn about using both temperature and top_p (not recommended)
    if (temperature !== undefined && temperature !== 1.0) {
      console.warn(
        "Warning: Using both temperature and top_p simultaneously is not recommended. " +
        "Consider using only one for controlling diversity."
      );
    }
  }

  // Validate seed is a positive integer
  if (sampling.seed !== undefined) {
    if (!Number.isInteger(sampling.seed) || sampling.seed < 0) {
      throw new Error(
        `seed must be a non-negative integer, got ${sampling.seed}`
      );
    }
  }

  // Log info about deterministic mode
  if (sampling.doSample === false) {
    if (sampling.seed !== undefined) {
      // Fully deterministic mode enabled
    } else {
      console.warn(
        "Note: doSample=false without a seed will produce deterministic output, " +
        "but results may vary between API calls. Add a seed for full reproducibility."
      );
    }
  }
}

/**
 * Create sampling config for deterministic/reproducible mode
 *
 * @param seed Optional seed for reproducibility
 * @returns SamplingConfig configured for deterministic output
 */
export function createDeterministicSampling(seed?: number): SamplingConfig {
  return {
    doSample: false,
    seed: seed ?? Math.floor(Math.random() * 2147483647), // Generate random seed if not provided
  };
}

/**
 * Create sampling config for creative/diverse output
 *
 * @param topP Optional nucleus sampling parameter (default: 0.9)
 * @returns SamplingConfig configured for diverse output
 */
export function createCreativeSampling(topP: number = 0.9): SamplingConfig {
  return {
    doSample: true,
    topP,
  };
}
