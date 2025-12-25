import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat.js";
import { safeValidateGrokResponse } from "../schemas/api-schemas.js";
import { ErrorCategory, createErrorMessage } from "../utils/error-handler.js";
import { extractAndTranslateError } from "../utils/error-translator.js";
import { GLM_MODELS, type SupportedModel, TIMEOUT_CONFIG } from "../constants.js";
import { GLM_PROVIDER, GROK_PROVIDER, resolveModelAlias } from "../provider/config.js";
import { getUsageTracker } from "../utils/usage-tracker.js";
import { RateLimiter, DEFAULT_RATE_LIMITS } from "../utils/rate-limiter.js";
import { getAuditLogger, AuditCategory } from "../utils/audit-logger.js";
import { retryStreamWithBackoff, retryWithBackoff } from "../utils/retry-helper.js";
import { LLMAPIError } from "../utils/api-error.js";
import type {
  ChatOptions,
  ThinkingConfig,
  SamplingConfig,
  GLM46StreamChunk,
} from "./types.js";
import { validateSampling } from "./types.js";

/** Streaming configuration constants */
const STREAMING_CONFIG = {
  /** Timeout waiting for first chunk (ms) - increased for complex operations with large context */
  FIRST_CHUNK_TIMEOUT_MS: TIMEOUT_CONFIG.STREAMING_FIRST_CHUNK,
  /** Timeout for idle periods between chunks (ms) */
  IDLE_TIMEOUT_MS: TIMEOUT_CONFIG.STREAMING_IDLE,
  /** Yield to event loop every N chunks */
  YIELD_INTERVAL: 20,
  /** Max time before yielding to event loop (ms) */
  MAX_TIME_BEFORE_YIELD_MS: 100,
} as const;

export type LLMMessage = ChatCompletionMessageParam;

/** JSON Schema property types for tool parameters */
export type JSONSchemaValue =
  | { type: "string"; description?: string; enum?: string[] }
  | { type: "number"; description?: string; minimum?: number; maximum?: number }
  | { type: "integer"; description?: string; minimum?: number; maximum?: number }
  | { type: "boolean"; description?: string }
  | { type: "array"; items?: JSONSchemaValue; description?: string }
  | { type: "object"; properties?: Record<string, JSONSchemaValue>; required?: string[]; description?: string }
  | { type: string; description?: string; [key: string]: unknown }; // Fallback for other schema types

export interface LLMTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, JSONSchemaValue>;
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
  /** Search mode: "auto" (AI decides), "on" (always search), "off" (no search) */
  mode?: "auto" | "on" | "off";
  /** Return citations in the response (default: true) */
  return_citations?: boolean;
  /** Maximum number of search results (1-50) */
  max_search_results?: number;
  /** Restrict search to results from this date (ISO8601 format) */
  from_date?: string;
  /** Restrict search to results until this date (ISO8601 format) */
  to_date?: string;
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

interface StreamUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens?: number;
  /** xAI API returns cached token info for GLM 4.6 cache savings tracking */
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
}

/** Raw API response structure for type-safe coercion */
interface RawAPIResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      reasoning_content?: string;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
  };
}

/** Raw API streaming chunk structure */
interface RawStreamChunk {
  choices?: Array<{
    delta?: {
      role?: string;
      content?: string | null;
      reasoning_content?: string;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: StreamUsage;
}

/**
 * GLM API thinking parameter format
 * Different from ThinkingConfig - this is the actual API format
 */
interface GLMThinkingParam {
  type: "enabled" | "disabled";
  /** Preserve reasoning from previous turns (recommended for coding) */
  clear_thinking: boolean;
}

/** API request payload structure */
interface APIRequestPayload {
  model: string;
  messages: LLMMessage[];
  temperature: number;
  max_tokens: number;
  tools?: LLMTool[];
  tool_choice?: "auto";
  stream?: boolean;
  // GLM-style thinking mode (API format with clear_thinking)
  thinking?: GLMThinkingParam;
  // Grok-style reasoning effort (alternative to thinking)
  reasoning_effort?: "low" | "high";
  // Web search parameters
  search_parameters?: SearchParameters;
  response_format?: { type: "text" | "json_object" };
  do_sample?: boolean;
  top_p?: number;
  // Grok seed for reproducibility
  seed?: number;
  // Grok parallel function calling (xAI Agent Tools API)
  // When true, Grok will execute multiple tool calls in parallel server-side
  parallel_function_calling?: boolean;
  // Grok server-side tools (xAI Agent Tools API)
  // Array of server tool names: 'web_search', 'x_search', 'code_execution'
  server_tools?: string[];
  // Grok server tool configuration
  server_tool_config?: Record<string, unknown>;
}

/** API error structure for type-safe error handling */
interface APIError extends Error {
  status?: number;
  response?: {
    status?: number;
    headers?: Record<string, string>;
  };
  headers?: Record<string, string>;
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
  private rateLimiter: RateLimiter; // REQ-SEC-006: Rate limiting to prevent API abuse

  constructor(apiKey: string, model?: string, baseURL?: string) {
    if (!model) {
      throw new Error('No model specified. Please run "ax-cli setup" to configure your AI provider and model.');
    }

    if (!baseURL) {
      throw new Error('No base URL specified. Please run "ax-cli setup" to configure your AI provider base URL.');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
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

    // Initialize rate limiter for API abuse prevention (REQ-SEC-006)
    this.rateLimiter = new RateLimiter(DEFAULT_RATE_LIMITS.LLM_API);
  }

  /**
   * Validate and normalize model name
   * For known models, validate against GLM_MODELS and provider models
   * For unknown models (e.g., Ollama), pass through without validation
   * Also resolves model aliases (e.g., 'grok-latest' -> 'grok-4-0709')
   */
  private validateModel(model: string): string {
    // First, resolve any alias to the actual model name
    const resolvedModel = resolveModelAlias(model);

    // Check GLM models (legacy constant)
    if (resolvedModel in GLM_MODELS) {
      return resolvedModel as SupportedModel;
    }

    // Check provider-specific models (GLM and Grok)
    if (resolvedModel in GLM_PROVIDER.models || resolvedModel in GROK_PROVIDER.models) {
      return resolvedModel;
    }

    // Allow arbitrary model names for providers like Ollama
    // Don't fall back to DEFAULT_MODEL - respect user's choice
    console.warn(`Using custom model "${resolvedModel}" (not in predefined list)`);
    return resolvedModel;
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
   * Validate and clamp max tokens for current model
   * Returns the clamped value (clamps to model limit if exceeded)
   */
  private validateAndClampMaxTokens(maxTokens: number, model: string): number {
    const config = GLM_MODELS[model as SupportedModel];

    if (maxTokens < 1) {
      throw new Error(`Max tokens must be at least 1, got ${maxTokens}`);
    }

    if (!config) {
      // Custom model - allow up to 128K tokens
      if (maxTokens > 128000) {
        return 128000; // Clamp to reasonable limit
      }
      return maxTokens;
    }

    // Clamp to model's max output tokens (e.g., when auto-switching to vision model)
    if (maxTokens > config.maxOutputTokens) {
      return config.maxOutputTokens;
    }

    return maxTokens;
  }

  /**
   * Safely extract usage from unknown response payloads
   * Ensures we only rely on numeric token counts to avoid runtime errors
   */
  private safeExtractUsage(raw: unknown): StreamUsage | undefined {
    if (!raw || typeof raw !== 'object') {
      return undefined;
    }

    const usage = raw as Partial<StreamUsage> & {
      prompt_tokens_details?: { cached_tokens?: unknown };
    };
    if (
      typeof usage.prompt_tokens === 'number' &&
      typeof usage.completion_tokens === 'number' &&
      typeof usage.total_tokens === 'number'
    ) {
      const normalized: StreamUsage = {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      };

      if (typeof usage.reasoning_tokens === 'number') {
        normalized.reasoning_tokens = usage.reasoning_tokens;
      }

      // BUG FIX: Extract cached tokens for GLM 4.6 cache savings tracking
      // Without this, streaming responses wouldn't track cache hits
      if (
        usage.prompt_tokens_details &&
        typeof usage.prompt_tokens_details.cached_tokens === 'number'
      ) {
        normalized.prompt_tokens_details = {
          cached_tokens: usage.prompt_tokens_details.cached_tokens,
        };
      }

      return normalized;
    }

    return undefined;
  }

  /**
   * Coerce a loosely-typed response into an LLMResponse shape, dropping invalid choices
   */
  private coerceLLMResponse(raw: unknown): LLMResponse | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const obj = raw as RawAPIResponse;
    if (!Array.isArray(obj.choices)) {
      return null;
    }

    const choices = obj.choices
      .filter((choice): choice is typeof choice & { message: { role: string } } =>
        choice &&
        typeof choice === 'object' &&
        typeof choice.message?.role === 'string'
      )
      .map((choice) => {
        const message = choice.message;
        const toolCalls = Array.isArray(message?.tool_calls)
          ? message.tool_calls
              .filter((call): call is typeof call & { id: string; function: { name: string; arguments: string } } =>
                call &&
                typeof call === 'object' &&
                typeof call.id === 'string' &&
                typeof call.function?.name === 'string' &&
                typeof call.function?.arguments === 'string'
              )
              .map((call) => ({
                id: call.id,
                type: 'function' as const,
                function: {
                  name: call.function.name,
                  arguments: call.function.arguments,
                },
              }))
          : undefined;

        return {
          message: {
            role: message.role,
            content:
              typeof message.content === 'string' || message.content === null
                ? message.content
                : null,
            reasoning_content:
              typeof message.reasoning_content === 'string'
                ? message.reasoning_content
                : undefined,
            tool_calls: toolCalls,
          },
          finish_reason:
            typeof choice.finish_reason === 'string'
              ? choice.finish_reason
              : 'unknown',
        };
      })
      .filter((choice) => Boolean(choice));

    if (choices.length === 0) {
      return null;
    }

    return {
      choices,
      usage: this.safeExtractUsage(obj.usage),
    };
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
    sampling?: SamplingConfig,
    serverTools?: string[],
    serverToolConfig?: Record<string, unknown>
  ): APIRequestPayload {
    const payload: APIRequestPayload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    // Detect if this is a Grok model (xAI)
    const isGrokModel = model.toLowerCase().includes('grok');

    // Only include tools if there are any - some APIs reject empty tools array
    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = "auto";

      // Enable parallel function calling for Grok models (xAI Agent Tools API)
      // This allows Grok to execute multiple tool calls in parallel server-side
      // significantly improving performance for multi-tool operations
      if (isGrokModel) {
        payload.parallel_function_calling = true;
      }
    }

    if (stream) {
      payload.stream = true;
      // Note: tool_stream is NOT a valid z.ai parameter - removed to prevent API errors
    }

    // Add thinking/reasoning parameters based on provider
    if (thinking && thinking.type === 'enabled') {
      if (isGrokModel) {
        // Grok uses reasoning_effort parameter for models that support thinking
        // Grok 4 models support reasoning_effort (low/high) - Grok 4 is now the default
        const modelLower = model.toLowerCase();
        const supportsReasoning = modelLower.includes('grok-4');
        if (supportsReasoning) {
          payload.reasoning_effort = thinking.reasoningEffort || 'high';
        }
      } else {
        // GLM uses thinking parameter with specific format
        // GLM-4.7 expects: { type: "enabled", clear_thinking: false }
        // clear_thinking: false preserves reasoning from previous turns (recommended for coding)
        payload.thinking = {
          type: thinking.type,
          clear_thinking: false,
        };
      }
    }

    // Add search parameters if specified
    // Works for both Grok (live search) and potentially other providers
    if (searchOptions?.search_parameters) {
      payload.search_parameters = searchOptions.search_parameters;
    }

    // Add structured output format if specified
    // When using json_object, the model will return valid JSON
    if (responseFormat) {
      payload.response_format = responseFormat;
    }

    // Add sampling parameters - provider-specific handling
    if (sampling) {
      if (isGrokModel) {
        // Grok uses seed for reproducibility (not do_sample)
        if (sampling.seed !== undefined) {
          payload.seed = sampling.seed;
        }
        if (sampling.topP !== undefined) {
          payload.top_p = sampling.topP;
        }
      } else {
        // GLM uses do_sample for deterministic mode
        if (sampling.doSample !== undefined) {
          payload.do_sample = sampling.doSample;
        }
        // seed is not supported by z.ai API - omitted
        if (sampling.topP !== undefined) {
          payload.top_p = sampling.topP;
        }
      }
    }

    // Add Grok server-side tools (xAI Agent Tools API)
    // These tools run on xAI infrastructure: web_search, x_search, code_execution
    if (isGrokModel && serverTools && serverTools.length > 0) {
      payload.server_tools = serverTools;
      if (serverToolConfig) {
        payload.server_tool_config = serverToolConfig;
      }
    }

    return payload;
  }

  setModel(model: string): void {
    this.currentModel = this.validateModel(model);

    const modelConfig = GLM_MODELS[this.currentModel as SupportedModel] || {
      maxOutputTokens: 128000,
      defaultMaxTokens: 4096,
      temperatureRange: { min: 0.0, max: 2.0 },
      defaultTemperature: 0.7,
    };

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
    const auditLogger = getAuditLogger();
    const requestController = new AbortController();
    const upstreamSignal = options?.signal;
    const handleUpstreamAbort = () => requestController.abort(upstreamSignal?.reason);

    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        requestController.abort(upstreamSignal.reason);
      } else {
        upstreamSignal.addEventListener('abort', handleUpstreamAbort, { once: true });
      }
    }

    const timeoutId = setTimeout(
      () => requestController.abort(new Error('LLM chat request timed out after 600000ms')),
      600000
    );

    try {
      // REQ-SEC-006: Check rate limit before making API call
      const rateLimitResult = this.rateLimiter.tryAcquire();
      if (!rateLimitResult.allowed) {
        const waitSeconds = Math.ceil(rateLimitResult.resetIn / 1000);

        // REQ-SEC-008: Audit log rate limit exceeded
        auditLogger.logWarning({
          category: AuditCategory.RATE_LIMIT,
          action: 'rate_limit_exceeded',
          resource: 'llm_api',
          outcome: 'failure',
          details: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetIn: rateLimitResult.resetIn,
          },
        });

        throw new Error(
          `Rate limit exceeded. ${rateLimitResult.remaining}/${rateLimitResult.limit} requests remaining. ` +
          `Please wait ${waitSeconds} seconds before trying again.`
        );
      }

      // Merge options with defaults
      const model = this.validateModel(options?.model || this.currentModel);
      const temperature = options?.temperature ?? this.defaultTemperature;
      const rawMaxTokens = options?.maxTokens ?? this.defaultMaxTokens;
      const thinking = options?.thinking;
      const searchOptions = options?.searchOptions;
      const responseFormat = options?.responseFormat;
      const sampling = options?.sampling;
      // Grok-specific options (xAI Agent Tools API)
      const serverTools = options?.serverTools;
      const serverToolConfig = options?.serverToolConfig;

      // Validate parameters (clamp maxTokens to model limit)
      this.validateTemperature(temperature, model);
      const maxTokens = this.validateAndClampMaxTokens(rawMaxTokens, model);
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
        sampling,
        serverTools,
        serverToolConfig
      );

      // Track response time for performance metrics
      const requestStartTime = Date.now();

      const response = await retryWithBackoff(
        () => this.client.chat.completions.create(requestPayload, {
          signal: requestController.signal,
        }),
        {
          onRetry: (attempt, error, delayMs) => {
            auditLogger.logWarning({
              category: AuditCategory.API_CALL,
              action: 'llm_api_call_retry',
              resource: model,
              outcome: 'failure',
              details: {
                attempt,
                delayMs,
                status: error?.status,
              },
              error: extractAndTranslateError(error),
            });
          },
        }
      );

      // Track response time
      const responseTimeMs = Date.now() - requestStartTime;
      getUsageTracker().trackResponseTime(responseTimeMs);

      // REQ-SEC-008: Audit log successful API call
      auditLogger.logInfo({
        category: AuditCategory.API_CALL,
        action: 'llm_api_call',
        resource: model,
        outcome: 'success',
        details: {
          hasTools: tools && tools.length > 0,
          messageCount: messages.length,
        },
      });

      // Validate response structure
      const validationResult = safeValidateGrokResponse(response);
      if (!validationResult.success) {
        console.warn(
          createErrorMessage(
            ErrorCategory.VALIDATION,
            'LLM API response validation',
            validationResult.error?.message || 'Invalid response structure'
          )
        );
      }

      const llmResponse = validationResult.data ?? this.coerceLLMResponse(response);
      if (!llmResponse) {
        throw new Error('LLM API response validation failed: missing choices or invalid message structure');
      }

      const usage = llmResponse.usage ? this.safeExtractUsage(llmResponse.usage) : undefined;
      if (usage) {
        const tracker = getUsageTracker();
        tracker.trackUsage(model, usage);

        // Track memory cache stats if cached_tokens available
        const rawResponse = response as RawAPIResponse;
        const cachedTokens = rawResponse?.usage?.prompt_tokens_details?.cached_tokens;
        if (typeof cachedTokens === 'number' && cachedTokens > 0) {
          // Lazy import to avoid circular dependencies - fire and forget but safe
          const promptTokens = usage.prompt_tokens;
          import('../memory/index.js')
            .then(({ getStatsCollector }) => {
              try {
                const statsCollector = getStatsCollector();
                statsCollector.recordResponse(promptTokens, cachedTokens);
              } catch (err) {
                // BUG FIX: Log error instead of silently ignoring for debuggability
                if (process.env.DEBUG) {
                  console.warn('Failed to record memory stats:', err);
                }
              }
            })
            .catch((err) => {
              // BUG FIX: Log error instead of silently ignoring for debuggability
              if (process.env.DEBUG) {
                console.warn('Memory module not available:', err);
              }
            });
        }
      }

      return llmResponse;
    } catch (error: unknown) {
      // Enhance error message with context and translate if needed
      const modelInfo = options?.model || this.currentModel;
      const apiError = error as APIError;
      const llmError = new LLMAPIError(
        `LLM API error (model: ${modelInfo}): ${extractAndTranslateError(error)}`,
        error,
        modelInfo,
        apiError?.status ?? apiError?.response?.status,
        apiError?.headers ?? apiError?.response?.headers,
        apiError?.response?.headers?.['x-request-id'] ?? apiError?.headers?.['x-request-id']
      );

      auditLogger.logError({
        category: AuditCategory.API_CALL,
        action: 'llm_api_call',
        resource: modelInfo,
        outcome: 'failure',
        error: llmError.message,
        details: {
          statusCode: llmError.statusCode,
          isRetryable: llmError.isRetryable,
        },
      });

      throw llmError;
    } finally {
      clearTimeout(timeoutId);
      if (upstreamSignal) {
        upstreamSignal.removeEventListener('abort', handleUpstreamAbort);
      }
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
    const auditLogger = getAuditLogger();
    const masterController = new AbortController();
    const upstreamSignal = options?.signal;
    const handleUpstreamAbort = () => masterController.abort(upstreamSignal?.reason);

    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        masterController.abort(upstreamSignal.reason);
      } else {
        upstreamSignal.addEventListener('abort', handleUpstreamAbort, { once: true });
      }
    }

    const masterTimeoutId = setTimeout(
      () => masterController.abort(new Error('LLM streaming request timed out after 600000ms')),
      600000
    );

    let finalUsage: StreamUsage | null = null;
    let totalChunks = 0;

    try {
      // REQ-SEC-006: Check rate limit before making streaming API call
      const rateLimitResult = this.rateLimiter.tryAcquire();
      if (!rateLimitResult.allowed) {
        const waitSeconds = Math.ceil(rateLimitResult.resetIn / 1000);
        auditLogger.logWarning({
          category: AuditCategory.RATE_LIMIT,
          action: 'rate_limit_exceeded',
          resource: 'llm_api',
          outcome: 'failure',
          details: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetIn: rateLimitResult.resetIn,
          },
        });
        throw new Error(
          `Rate limit exceeded. ${rateLimitResult.remaining}/${rateLimitResult.limit} requests remaining. ` +
          `Please wait ${waitSeconds} seconds before trying again.`
        );
      }

      // Merge options with defaults
      const model = this.validateModel(options?.model || this.currentModel);
      const temperature = options?.temperature ?? this.defaultTemperature;
      const rawMaxTokens = options?.maxTokens ?? this.defaultMaxTokens;
      const thinking = options?.thinking;
      const searchOptions = options?.searchOptions;
      const responseFormat = options?.responseFormat;
      const sampling = options?.sampling;
      // Grok-specific options (xAI Agent Tools API)
      const serverTools = options?.serverTools;
      const serverToolConfig = options?.serverToolConfig;

      // Validate parameters (clamp maxTokens to model limit)
      this.validateTemperature(temperature, model);
      const maxTokens = this.validateAndClampMaxTokens(rawMaxTokens, model);
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
        sampling,
        serverTools,
        serverToolConfig
      );

      // Track response time for streaming (time to first chunk + total stream time)
      const streamStartTime = Date.now();

      const client = this.client;
      const extractUsage = this.safeExtractUsage.bind(this);
      const streamGenerator = () => {
        const attemptController = new AbortController();
        const onMasterAbort = () => attemptController.abort(masterController.signal.reason);

        // BUG FIX: Track listener state to ensure cleanup even if generator is never consumed
        let listenerAttached = false;

        if (masterController.signal.aborted) {
          attemptController.abort(masterController.signal.reason);
        } else {
          masterController.signal.addEventListener('abort', onMasterAbort, { once: true });
          listenerAttached = true;
        }

        // BUG FIX: Helper to safely remove listener
        const cleanupListener = () => {
          if (listenerAttached) {
            masterController.signal.removeEventListener('abort', onMasterAbort);
            listenerAttached = false;
          }
        };

        const generator = (async function* (): AsyncGenerator<GLM46StreamChunk> {
          let firstChunkTimer: NodeJS.Timeout | undefined;
          let idleTimer: NodeJS.Timeout | undefined;
          let chunksProcessed = 0;
          let lastYieldTime = Date.now();

          try {
            firstChunkTimer = setTimeout(
              () => attemptController.abort(new Error('Streaming first chunk timeout')),
              STREAMING_CONFIG.FIRST_CHUNK_TIMEOUT_MS
            );

            const stream = (await client.chat.completions.create(requestPayload, {
              signal: attemptController.signal,
            })) as AsyncIterable<RawStreamChunk>;

            for await (const chunk of stream) {
              if (attemptController.signal.aborted) {
                throw attemptController.signal.reason || new Error('Streaming aborted');
              }

              if (firstChunkTimer) {
                clearTimeout(firstChunkTimer);
                firstChunkTimer = undefined;
              }

              if (idleTimer) {
                clearTimeout(idleTimer);
              }
              idleTimer = setTimeout(
                () => attemptController.abort(new Error('Streaming idle timeout')),
                STREAMING_CONFIG.IDLE_TIMEOUT_MS
              );

              const isValidChunk = chunk && typeof chunk === 'object' && Array.isArray(chunk.choices);
              if (!isValidChunk) {
                console.warn(
                  createErrorMessage(
                    ErrorCategory.VALIDATION,
                    'LLM streaming response validation',
                    'Invalid stream chunk structure'
                  )
                );
              }

              const usage = extractUsage(chunk.usage);
              if (usage) {
                finalUsage = usage;
              }

              totalChunks++;

              yield chunk as unknown as GLM46StreamChunk;

              chunksProcessed++;
              const timeSinceYield = Date.now() - lastYieldTime;

              if (chunksProcessed % STREAMING_CONFIG.YIELD_INTERVAL === 0 || timeSinceYield > STREAMING_CONFIG.MAX_TIME_BEFORE_YIELD_MS) {
                await new Promise(resolve => setImmediate(resolve));
                lastYieldTime = Date.now();

                if (timeSinceYield > STREAMING_CONFIG.MAX_TIME_BEFORE_YIELD_MS) {
                  chunksProcessed = 0;
                }
              }
            }
          } finally {
            if (firstChunkTimer) {
              clearTimeout(firstChunkTimer);
            }
            if (idleTimer) {
              clearTimeout(idleTimer);
            }
            cleanupListener();
          }
        })();

        // BUG FIX: Use FinalizationRegistry to clean up listener if generator is GC'd without being consumed
        // This is a safety net - proper usage should always iterate the generator
        if (typeof FinalizationRegistry !== 'undefined') {
          const registry = new FinalizationRegistry(cleanupListener);
          registry.register(generator, undefined);
        }

        return generator;
      };

      for await (const chunk of retryStreamWithBackoff(streamGenerator, {
        onRetry: (attempt, error, delayMs) => {
          auditLogger.logWarning({
            category: AuditCategory.API_CALL,
            action: 'llm_api_stream_retry',
            resource: model,
            outcome: 'failure',
            details: {
              attempt,
              delayMs,
              status: error?.status,
            },
            error: extractAndTranslateError(error),
          });
        },
      })) {
        yield chunk;
      }

      // Note: finalUsage is mutated inside the inner async generator
      // so we cast it to help TypeScript understand it may have been set
      const usageForTracking = finalUsage as StreamUsage | null;
      if (usageForTracking) {
        const tracker = getUsageTracker();
        tracker.trackUsage(model, usageForTracking);
      }

      // Track total stream response time
      const streamResponseTimeMs = Date.now() - streamStartTime;
      getUsageTracker().trackResponseTime(streamResponseTimeMs);

      const totalTokens = usageForTracking?.total_tokens;

      auditLogger.logInfo({
        category: AuditCategory.API_CALL,
        action: 'llm_api_stream',
        resource: model,
        outcome: 'success',
        details: {
          chunks: totalChunks,
          totalTokens,
          responseTimeMs: streamResponseTimeMs,
        },
      });
    } catch (error: unknown) {
      const modelInfo = options?.model || this.currentModel;
      const apiError = error as APIError;
      const llmError = new LLMAPIError(
        `LLM API streaming error (model: ${modelInfo}): ${extractAndTranslateError(error)}`,
        error,
        modelInfo,
        apiError?.status ?? apiError?.response?.status,
        apiError?.headers ?? apiError?.response?.headers,
        apiError?.response?.headers?.['x-request-id'] ?? apiError?.headers?.['x-request-id']
      );

      auditLogger.logError({
        category: AuditCategory.API_CALL,
        action: 'llm_api_stream',
        resource: modelInfo,
        outcome: 'failure',
        error: llmError.message,
        details: {
          statusCode: llmError.statusCode,
          isRetryable: llmError.isRetryable,
        },
      });

      throw llmError;
    } finally {
      clearTimeout(masterTimeoutId);
      if (upstreamSignal) {
        upstreamSignal.removeEventListener('abort', handleUpstreamAbort);
      }
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
