/**
 * @defai.digital/ax-core - Provider Abstraction Interfaces
 *
 * These interfaces define the contract that all LLM providers must implement.
 * This allows ax-glm and ax-grok to share the same core infrastructure while
 * providing provider-specific optimizations.
 */

/**
 * Provider capabilities - what each LLM supports
 */
export interface ProviderCapabilities {
  /** Whether the provider supports thinking/reasoning mode (e.g., GLM-4.6) */
  supportsThinking: boolean;
  /** Whether the provider supports vision/image understanding */
  supportsVision: boolean;
  /** Whether the provider supports streaming responses */
  supportsStreaming: boolean;
  /** Whether the provider supports function/tool calling */
  supportsTools: boolean;
  /** Supported sampling methods */
  supportedSamplingMethods: ('temperature' | 'top_p' | 'seed')[];
  /** Maximum context window in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
}

/**
 * Content part for multimodal messages
 */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

/**
 * Normalized message format (provider-agnostic)
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  /** Tool calls made by the assistant */
  toolCalls?: ToolCall[];
  /** ID of the tool call this message is responding to */
  toolCallId?: string;
  /** Optional name for the message sender */
  name?: string;
}

/**
 * Tool call structure
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Tool call delta for streaming
 */
export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Reasoning/thinking tokens (GLM-4.6 specific) */
  reasoningTokens?: number;
}

/**
 * Normalized stream chunk (provider-agnostic)
 */
export interface StreamChunk {
  type: 'content' | 'reasoning' | 'tool_call' | 'usage' | 'done' | 'error';
  /** Text content delta */
  content?: string;
  /** Reasoning/thinking content delta (for providers that support it) */
  reasoning?: string;
  /** Tool call delta */
  toolCall?: ToolCallDelta;
  /** Token usage (typically in final chunk) */
  usage?: TokenUsage;
  /** Error message if type is 'error' */
  error?: string;
  /** Finish reason */
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
}

/**
 * Thinking/reasoning mode configuration
 */
export interface ThinkingConfig {
  /** Whether thinking mode is enabled */
  enabled: boolean;
  /** Budget for thinking tokens */
  budgetTokens?: number;
}

/**
 * Sampling configuration
 */
export interface SamplingConfig {
  /** Whether to use sampling (vs greedy decoding) */
  doSample?: boolean;
  /** Temperature for sampling */
  temperature?: number;
  /** Top-p (nucleus) sampling */
  topP?: number;
  /** Random seed for reproducibility (not supported by all providers) */
  seed?: number;
}

/**
 * Chat options (provider-agnostic)
 */
export interface ChatOptions {
  /** Model to use */
  model: string;
  /** Temperature for sampling (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Thinking mode configuration (only used if provider supports it) */
  thinking?: ThinkingConfig;
  /** Sampling configuration */
  sampling?: SamplingConfig;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Response format */
  responseFormat?: { type: 'text' | 'json_object' };
}

/**
 * Tool definition for LLM
 */
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * LLM response (non-streaming)
 */
export interface LLMResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      toolCalls?: ToolCall[];
      reasoningContent?: string;
    };
    finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
  }>;
  usage?: TokenUsage;
}

/**
 * Provider interface - implemented by ax-glm and ax-grok
 *
 * This is the main abstraction that allows different LLM providers
 * to be used interchangeably with the shared core infrastructure.
 */
export interface ILLMProvider {
  /** Provider name (e.g., 'glm', 'grok') */
  readonly name: string;

  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;

  /**
   * Send a chat completion request (non-streaming)
   */
  chat(
    messages: Message[],
    tools: Tool[],
    options: ChatOptions
  ): Promise<LLMResponse>;

  /**
   * Send a streaming chat completion request
   * Yields normalized StreamChunk objects
   */
  chatStream(
    messages: Message[],
    tools: Tool[],
    options: ChatOptions
  ): AsyncIterable<StreamChunk>;

  /**
   * Count tokens in messages
   */
  countTokens(messages: Message[]): number;

  /**
   * Validate that a model is supported
   */
  validateModel(model: string): boolean;

  /**
   * Get the default model for this provider
   */
  getDefaultModel(): string;

  /**
   * Convert normalized messages to provider-specific format
   */
  toProviderFormat(messages: Message[]): unknown;

  /**
   * Convert normalized tools to provider-specific format
   */
  toProviderToolFormat(tools: Tool[]): unknown;
}

/**
 * Provider factory function type
 */
export type ProviderFactory = (config: ProviderConfig) => ILLMProvider;

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** API key */
  apiKey: string;
  /** Base URL for API */
  baseURL?: string;
  /** Default model */
  model?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Tool result from execution
 */
export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Accumulated message from streaming
 */
export interface AccumulatedMessage {
  role: 'assistant';
  content: string;
  reasoningContent?: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
}
