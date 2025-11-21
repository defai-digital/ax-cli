import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat.js";
import { safeValidateGrokResponse } from "../schemas/api-schemas.js";
import { ErrorCategory, createErrorMessage } from "../utils/error-handler.js";
import { extractAndTranslateError } from "../utils/error-translator.js";
import { GLM_MODELS, type SupportedModel } from "../constants.js";
import { getUsageTracker } from "../utils/usage-tracker.js";
import type {
  ChatOptions,
  ThinkingConfig,
  SamplingConfig,
  GLM46StreamChunk,
} from "./types.js";
import { validateSampling } from "./types.js";

export type LLMMessage = ChatCompletionMessageParam;

export interface LLMTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface LLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface SearchParameters {
  mode?: "auto" | "on" | "off";
  // sources removed - let API use default sources to avoid format issues
}

export interface SearchOptions {
  search_parameters?: SearchParameters;
}

export interface LLMResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      reasoning_content?: string;  // GLM-4.6 support
      tool_calls?: LLMToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number;  // GLM-4.6 support
  };
}

/**
 * LLMClient - Enhanced client for GLM-4.6 API
 *
 * Supports advanced features including:
 * - Thinking/reasoning mode
 * - Configurable temperature (0.6-1.0 for GLM-4.6)
 * - Extended context windows (up to 200K tokens)
 * - Multiple model support
 */
export class LLMClient {
  private client: OpenAI;
  private currentModel: string; // Can be SupportedModel or custom model name (e.g., Ollama)
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(apiKey: string, model?: string, baseURL?: string) {
    if (!model) {
      throw new Error('No model specified. Please run "ax-cli setup" to configure your AI provider and model.');
    }

    const finalBaseURL = baseURL || process.env.AI_BASE_URL;
    if (!finalBaseURL) {
      throw new Error('No base URL configured. Please run "ax-cli setup" to configure your AI provider.');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: finalBaseURL,
      timeout: 600000, // Increased to 10 minutes for long contexts
    });

    // Set model with validation
    this.currentModel = this.validateModel(model);

    // Get model configuration (with fallback for custom models)
    const modelConfig = GLM_MODELS[this.currentModel as SupportedModel] || {
      maxOutputTokens: 128000, // Generous default for custom models
      defaultMaxTokens: 4096,
      temperatureRange: { min: 0.0, max: 2.0 },
      defaultTemperature: 0.7,
    };

    // Set defaults from environment or model config
    const envMax = Number(process.env.AI_MAX_TOKENS);
    this.defaultMaxTokens = Number.isFinite(envMax) && envMax > 0
      ? Math.min(envMax, modelConfig.maxOutputTokens)
      : modelConfig.defaultMaxTokens;

    const envTemp = Number(process.env.AI_TEMPERATURE);
    this.defaultTemperature = Number.isFinite(envTemp) &&
      envTemp >= modelConfig.temperatureRange.min &&
      envTemp <= modelConfig.temperatureRange.max
      ? envTemp
      : modelConfig.defaultTemperature;
  }

  /**
   * Validate and normalize model name
   * For known models, validate against GLM_MODELS
   * For unknown models (e.g., Ollama), pass through without validation
   */
  private validateModel(model: string): string {
    if (model in GLM_MODELS) {
      return model as SupportedModel;
    }

    // Allow arbitrary model names for providers like Ollama
    // Don't fall back to DEFAULT_MODEL - respect user's choice
    console.warn(`Using custom model "${model}" (not in predefined list)`);
    return model;
  }

  /**
   * Validate temperature for current model
   */
  private validateTemperature(temperature: number, model: string): void {
    const config = GLM_MODELS[model as SupportedModel];
    if (!config) {
      // Custom model - allow any temperature between 0 and 2
      if (temperature < 0 || temperature > 2) {
        throw new Error(`Temperature ${temperature} is out of range. Valid range: 0.0 - 2.0`);
      }
      return;
    }

    const { min, max } = config.temperatureRange;
    if (temperature < min || temperature > max) {
      throw new Error(
        `Temperature ${temperature} is out of range for model ${model}. ` +
        `Valid range: ${min} - ${max}`
      );
    }
  }

  /**
   * Validate max tokens for current model
   */
  private validateMaxTokens(maxTokens: number, model: string): void {
    const config = GLM_MODELS[model as SupportedModel];

    if (maxTokens < 1) {
      throw new Error(`Max tokens must be at least 1, got ${maxTokens}`);
    }

    if (!config) {
      // Custom model - allow up to 128K tokens
      if (maxTokens > 128000) {
        throw new Error(`Max tokens ${maxTokens} exceeds reasonable limit. Maximum: 128000`);
      }
      return;
    }

    if (maxTokens > config.maxOutputTokens) {
      throw new Error(
        `Max tokens ${maxTokens} exceeds limit for model ${model}. ` +
        `Maximum: ${config.maxOutputTokens}`
      );
    }
  }

  /**
   * Validate thinking configuration for current model
   */
  private validateThinking(thinking: ThinkingConfig | undefined, model: string): void {
    if (thinking && thinking.type === "enabled") {
      const config = GLM_MODELS[model as SupportedModel];
      if (config && !config.supportsThinking) {
        throw new Error(
          `Thinking mode is not supported by model ${model}. ` +
          `Use glm-4.6 for thinking capabilities.`
        );
      }
    }
  }

  /**
   * Build request payload for chat completions
   * Consolidates duplicate payload building logic
   */
  private buildRequestPayload(
    model: string, // Accept string to support custom models (e.g., Ollama)
    messages: LLMMessage[],
    tools: LLMTool[] | undefined,
    temperature: number,
    maxTokens: number,
    thinking: ThinkingConfig | undefined,
    searchOptions: SearchOptions | undefined,
    stream: boolean = false,
    responseFormat?: { type: "text" | "json_object" },
    sampling?: SamplingConfig
  ): any {
    const payload: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    // Only include tools if there are any - some APIs reject empty tools array
    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = "auto";
    }

    if (stream) {
      payload.stream = true;
      // Note: tool_stream is NOT a valid z.ai parameter - removed to prevent API errors
    }

    // Add GLM-4.6 thinking parameter if specified
    if (thinking) {
      payload.thinking = thinking;
    }

    // Add search parameters if specified
    if (searchOptions?.search_parameters) {
      payload.search_parameters = searchOptions.search_parameters;
    }

    // Add structured output format if specified
    // When using json_object, the model will return valid JSON
    if (responseFormat) {
      payload.response_format = responseFormat;
    }

    // Add sampling parameters for deterministic/reproducible mode
    // do_sample=false enables greedy decoding for consistent outputs
    // Note: seed is NOT a valid z.ai parameter - only do_sample and top_p are supported
    if (sampling) {
      if (sampling.doSample !== undefined) {
        payload.do_sample = sampling.doSample;
      }
      // seed is not supported by z.ai API - omitted to prevent "Invalid API parameter" error
      if (sampling.topP !== undefined) {
        payload.top_p = sampling.topP;
      }
    }

    return payload;
  }

  setModel(model: string): void {
    this.currentModel = this.validateModel(model);
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  getModelConfig() {
    return GLM_MODELS[this.currentModel as SupportedModel] || null;
  }

  /**
   * Chat completion with GLM-4.6 support
   *
   * @param messages - Conversation messages
   * @param tools - Available tools/functions
   * @param options - Chat options including temperature, thinking mode, etc.
   * @returns Promise<LLMResponse>
   *
   * @example
   * ```typescript
   * const response = await client.chat(messages, tools, {
   *   model: 'glm-4.6',
   *   temperature: 0.7,
   *   thinking: { type: 'enabled' },
   *   maxTokens: 8192
   * });
   * ```
   */
  async chat(
    messages: LLMMessage[],
    tools?: LLMTool[],
    options?: ChatOptions
  ): Promise<LLMResponse> {
    try {
      // Merge options with defaults
      const model = this.validateModel(options?.model || this.currentModel);
      const temperature = options?.temperature ?? this.defaultTemperature;
      const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;
      const thinking = options?.thinking;
      const searchOptions = options?.searchOptions;
      const responseFormat = options?.responseFormat;
      const sampling = options?.sampling;

      // Validate parameters
      this.validateTemperature(temperature, model);
      this.validateMaxTokens(maxTokens, model);
      this.validateThinking(thinking, model);
      validateSampling(sampling, temperature);

      // Build request payload using consolidated helper
      const requestPayload = this.buildRequestPayload(
        model,
        messages,
        tools,
        temperature,
        maxTokens,
        thinking,
        searchOptions,
        false, // not streaming
        responseFormat,
        sampling
      );

      const response =
        await this.client.chat.completions.create(requestPayload);

      // Validate response structure
      const validationResult = safeValidateGrokResponse(response);
      if (!validationResult.success) {
        console.warn(
          createErrorMessage(
            ErrorCategory.VALIDATION,
            'LLM API response validation',
            validationResult.error || 'Invalid response structure'
          )
        );
        // Return response anyway for backward compatibility, but log warning
      }

      // Track usage
      const llmResponse = response as LLMResponse;
      if (llmResponse.usage) {
        const tracker = getUsageTracker();
        tracker.trackUsage(model, llmResponse.usage);

        // Track memory cache stats if cached_tokens available
        const cachedTokens = (llmResponse.usage as any).prompt_tokens_details?.cached_tokens;
        if (cachedTokens !== undefined && cachedTokens > 0 && llmResponse.usage) {
          // Lazy import to avoid circular dependencies - fire and forget but safe
          const promptTokens = llmResponse.usage.prompt_tokens;
          import('../memory/index.js')
            .then(({ getStatsCollector }) => {
              try {
                const statsCollector = getStatsCollector();
                statsCollector.recordResponse(promptTokens, cachedTokens);
              } catch {
                // Silently ignore stats recording errors
              }
            })
            .catch(() => {
              // Silently ignore if memory module not available
            });
        }
      }

      return llmResponse;
    } catch (error: any) {
      // Enhance error message with context and translate if needed
      const modelInfo = options?.model || this.currentModel;
      throw new Error(`LLM API error (model: ${modelInfo}): ${extractAndTranslateError(error)}`);
    }
  }

  /**
   * Streaming chat completion with GLM-4.6 support
   *
   * Yields chunks including reasoning_content when thinking is enabled
   *
   * @param messages - Conversation messages
   * @param tools - Available tools/functions
   * @param options - Chat options including temperature, thinking mode, etc.
   * @returns AsyncGenerator yielding GLM46StreamChunk
   *
   * @example
   * ```typescript
   * const stream = client.chatStream(messages, tools, {
   *   thinking: { type: 'enabled' }
   * });
   *
   * for await (const chunk of stream) {
   *   if (chunk.choices[0]?.delta?.reasoning_content) {
   *     console.log('Reasoning:', chunk.choices[0].delta.reasoning_content);
   *   }
   *   if (chunk.choices[0]?.delta?.content) {
   *     console.log('Content:', chunk.choices[0].delta.content);
   *   }
   * }
   * ```
   */
  async *chatStream(
    messages: LLMMessage[],
    tools?: LLMTool[],
    options?: ChatOptions
  ): AsyncGenerator<GLM46StreamChunk, void, unknown> {
    try {
      // Merge options with defaults
      const model = this.validateModel(options?.model || this.currentModel);
      const temperature = options?.temperature ?? this.defaultTemperature;
      const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;
      const thinking = options?.thinking;
      const searchOptions = options?.searchOptions;
      const responseFormat = options?.responseFormat;
      const sampling = options?.sampling;

      // Validate parameters
      this.validateTemperature(temperature, model);
      this.validateMaxTokens(maxTokens, model);
      this.validateThinking(thinking, model);
      validateSampling(sampling, temperature);

      // Build request payload using consolidated helper
      const requestPayload = this.buildRequestPayload(
        model,
        messages,
        tools,
        temperature,
        maxTokens,
        thinking,
        searchOptions,
        true, // streaming
        responseFormat,
        sampling
      );

      const stream = (await this.client.chat.completions.create(
        requestPayload
      )) as any;

      for await (const chunk of stream) {
        yield chunk as GLM46StreamChunk;
      }
    } catch (error: any) {
      const modelInfo = options?.model || this.currentModel;
      throw new Error(`LLM API streaming error (model: ${modelInfo}): ${extractAndTranslateError(error)}`);
    }
  }

  /**
   * Search with web context (deprecated - use chat with searchOptions)
   * @deprecated Use chat() with searchOptions parameter instead
   */
  async search(
    query: string,
    searchParameters?: SearchParameters
  ): Promise<LLMResponse> {
    const searchMessage: LLMMessage = {
      role: "user",
      content: query,
    };

    const searchOptions: SearchOptions = {
      search_parameters: searchParameters || { mode: "on" },
    };

    return this.chat([searchMessage], [], { searchOptions });
  }
}
