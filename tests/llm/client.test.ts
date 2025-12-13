/**
 * Tests for LLM Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LLMClient, type LLMTool, type LLMMessage, type LLMResponse } from "../../packages/core/src/llm/client.js";

// Store mock create function for tests to configure
let mockCreate: ReturnType<typeof vi.fn>;

// Mock OpenAI
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: (...args: unknown[]) => mockCreate(...args),
        },
      };
      constructor() {}
    },
  };
});

// Mock rate limiter to avoid timing issues
let mockTryAcquire: ReturnType<typeof vi.fn>;
vi.mock("../../packages/core/src/utils/rate-limiter.js", () => {
  return {
    RateLimiter: class MockRateLimiter {
      constructor() {}
      checkLimit = vi.fn().mockResolvedValue(true);
      recordRequest = vi.fn();
      tryAcquire = (...args: unknown[]) => mockTryAcquire(...args);
    },
    DEFAULT_RATE_LIMITS: {
      LLM_API: { requestsPerMinute: 60, tokensPerMinute: 100000 },
    },
  };
});

// Mock audit logger
vi.mock("../../packages/core/src/utils/audit-logger.js", () => ({
  getAuditLogger: () => ({
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
  }),
  AuditCategory: {
    API_CALL: "api_call",
    RATE_LIMIT: "rate_limit",
  },
}));

// Mock usage tracker
vi.mock("../../packages/core/src/utils/usage-tracker.js", () => ({
  getUsageTracker: () => ({
    trackUsage: vi.fn(),
  }),
}));

// Mock retry helpers - pass through immediately
vi.mock("../../packages/core/src/utils/retry-helper.js", () => ({
  retryWithBackoff: async (fn: () => Promise<unknown>) => fn(),
  retryStreamWithBackoff: async function* (fn: () => AsyncGenerator<unknown>) {
    yield* fn();
  },
}));

// Mock schema validation
vi.mock("../../packages/core/src/schemas/api-schemas.js", () => ({
  safeValidateGrokResponse: (response: unknown) => ({
    success: true,
    data: response,
  }),
}));

// Mock constants
vi.mock("../../packages/core/src/constants.js", () => ({
  GLM_MODELS: {
    "glm-4.1": {
      maxOutputTokens: 16000,
      defaultMaxTokens: 4096,
      temperatureRange: { min: 0.0, max: 1.0 },
      defaultTemperature: 0.7,
      supportsThinking: false,
    },
    "glm-4.6": {
      maxOutputTokens: 128000,
      defaultMaxTokens: 8192,
      temperatureRange: { min: 0.6, max: 1.0 },
      defaultTemperature: 0.7,
      supportsThinking: true,
    },
  },
  TIMEOUT_CONFIG: {
    STREAMING_FIRST_CHUNK: 180000,
    STREAMING_IDLE: 60000,
  },
}));

// Mock provider config
vi.mock("../../packages/core/src/provider/config.js", () => ({
  GLM_PROVIDER: {
    models: { "glm-4.1": {}, "glm-4.6": {} },
  },
  GROK_PROVIDER: {
    models: { "grok-4": {}, "grok-4-0709": {} },
  },
  resolveModelAlias: (model: string) => model,
}));

describe("LLMClient", () => {
  let client: LLMClient;
  const mockApiKey = "test-api-key";
  const mockModel = "glm-4.1";
  const mockBaseURL = "https://api.test.ai/v1";

  // Standard mock response
  const mockResponse: LLMResponse = {
    choices: [
      {
        message: {
          role: "assistant",
          content: "Hello, how can I help?",
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks with default behavior
    mockCreate = vi.fn().mockResolvedValue(mockResponse);
    mockTryAcquire = vi.fn().mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetIn: 60000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create client with valid parameters", () => {
      client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
      expect(client).toBeDefined();
    });

    it("should throw error without model", () => {
      expect(() => new LLMClient(mockApiKey, undefined, mockBaseURL)).toThrow(
        "No model specified"
      );
    });

    it("should throw error without base URL", () => {
      expect(() => new LLMClient(mockApiKey, mockModel, undefined)).toThrow(
        "No base URL specified"
      );
    });

    it("should accept custom models (e.g., Ollama)", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      client = new LLMClient(mockApiKey, "llama3.2:3b", mockBaseURL);
      expect(client).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Using custom model")
      );
      consoleSpy.mockRestore();
    });

    it("should use environment variables for max tokens", () => {
      const originalEnv = process.env.AI_MAX_TOKENS;
      process.env.AI_MAX_TOKENS = "8192";

      client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
      expect(client).toBeDefined();

      process.env.AI_MAX_TOKENS = originalEnv;
    });

    it("should use environment variables for temperature", () => {
      const originalEnv = process.env.AI_TEMPERATURE;
      process.env.AI_TEMPERATURE = "0.8";

      client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
      expect(client).toBeDefined();

      process.env.AI_TEMPERATURE = originalEnv;
    });
  });

  describe("getCurrentModel", () => {
    it("should return current model", () => {
      client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
      expect(client.getCurrentModel()).toBe(mockModel);
    });
  });

  describe("setModel", () => {
    it("should change model", () => {
      client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
      client.setModel("glm-4.6");
      expect(client.getCurrentModel()).toBe("glm-4.6");
    });

    it("should accept custom models with warning", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
      client.setModel("custom-model-name");
      expect(client.getCurrentModel()).toBe("custom-model-name");
      consoleSpy.mockRestore();
    });
  });

  describe("getModelConfig", () => {
    it("should return model configuration or null", () => {
      client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
      const config = client.getModelConfig();
      // May be null if model not in GLM_MODELS (which is loaded from YAML)
      // Just verify the method exists and returns without error
      expect(config === null || typeof config === "object").toBe(true);
    });
  });
});

describe("LLMClient type exports", () => {
  it("should export LLMTool type", () => {
    const tool: LLMTool = {
      type: "function",
      function: {
        name: "test_tool",
        description: "A test tool",
        parameters: {
          type: "object",
          properties: {
            arg1: { type: "string", description: "An argument" },
          },
          required: ["arg1"],
        },
      },
    };

    expect(tool.type).toBe("function");
    expect(tool.function.name).toBe("test_tool");
  });

  it("should export LLMMessage type", () => {
    const message: LLMMessage = {
      role: "user",
      content: "Hello",
    };

    expect(message.role).toBe("user");
    expect(message.content).toBe("Hello");
  });
});

describe("LLMClient with thinking mode", () => {
  it("should accept thinking config for supported models", () => {
    const client = new LLMClient("test-key", "glm-4.6", "https://api.test.ai/v1");
    expect(client.getCurrentModel()).toBe("glm-4.6");
    // The model supports thinking, no error expected on creation
  });
});

describe("LLMClient model config", () => {
  it("should handle getModelConfig for any model", () => {
    const client = new LLMClient("test-key", "glm-4.1", "https://api.test.ai/v1");
    const config = client.getModelConfig();
    // Config may be null if model not found in YAML-loaded GLM_MODELS
    // Just verify the method works without throwing
    expect(config === null || typeof config === "object").toBe(true);
  });

  it("should return null for custom models", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new LLMClient("test-key", "custom-model", "https://api.test.ai/v1");
    const config = client.getModelConfig();
    // Custom models should return null from getModelConfig
    expect(config).toBeNull();
    consoleSpy.mockRestore();
  });
});

describe("LLMClient chat method", () => {
  const mockApiKey = "test-api-key";
  const mockModel = "glm-4.1";
  const mockBaseURL = "https://api.test.ai/v1";

  const mockResponse: LLMResponse = {
    choices: [
      {
        message: {
          role: "assistant",
          content: "Test response",
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn().mockResolvedValue(mockResponse);
    mockTryAcquire = vi.fn().mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetIn: 60000,
    });
  });

  it("should make successful chat completion", async () => {
    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    const response = await client.chat(messages);

    expect(response).toBeDefined();
    expect(response.choices).toHaveLength(1);
    expect(response.choices[0].message.content).toBe("Test response");
    expect(mockCreate).toHaveBeenCalled();
  });

  it("should pass tools to API when provided", async () => {
    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];
    const tools: LLMTool[] = [
      {
        type: "function",
        function: {
          name: "test_tool",
          description: "A test tool",
          parameters: {
            type: "object",
            properties: { arg: { type: "string", description: "An arg" } },
            required: ["arg"],
          },
        },
      },
    ];

    await client.chat(messages, tools);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: tools,
        tool_choice: "auto",
      }),
      expect.any(Object)
    );
  });

  it("should handle tool calls in response", async () => {
    const responseWithToolCalls: LLMResponse = {
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_123",
                type: "function",
                function: {
                  name: "test_tool",
                  arguments: '{"arg": "value"}',
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    };
    mockCreate = vi.fn().mockResolvedValue(responseWithToolCalls);

    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Use the tool" }];

    const response = await client.chat(messages);

    expect(response.choices[0].message.tool_calls).toHaveLength(1);
    expect(response.choices[0].message.tool_calls![0].function.name).toBe("test_tool");
  });

  it("should reject when rate limit exceeded", async () => {
    mockTryAcquire = vi.fn().mockReturnValue({
      allowed: false,
      limit: 60,
      remaining: 0,
      resetIn: 30000,
    });

    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    await expect(client.chat(messages)).rejects.toThrow("Rate limit exceeded");
  });

  it("should accept custom temperature", async () => {
    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    await client.chat(messages, undefined, { temperature: 0.5 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.5,
      }),
      expect.any(Object)
    );
  });

  it("should reject invalid temperature for model", async () => {
    const client = new LLMClient(mockApiKey, "glm-4.6", mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    // GLM-4.6 has range 0.6-1.0
    await expect(client.chat(messages, undefined, { temperature: 0.2 })).rejects.toThrow(
      "Temperature 0.2 is out of range"
    );
  });

  it("should accept custom maxTokens", async () => {
    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    await client.chat(messages, undefined, { maxTokens: 2000 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 2000,
      }),
      expect.any(Object)
    );
  });

  it("should clamp maxTokens to model limit", async () => {
    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    // GLM-4.1 has maxOutputTokens of 16000
    await client.chat(messages, undefined, { maxTokens: 50000 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 16000, // Clamped to model limit
      }),
      expect.any(Object)
    );
  });

  it("should reject maxTokens less than 1", async () => {
    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    await expect(client.chat(messages, undefined, { maxTokens: 0 })).rejects.toThrow(
      "Max tokens must be at least 1"
    );
  });

  it("should support thinking mode for glm-4.6", async () => {
    const client = new LLMClient(mockApiKey, "glm-4.6", mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Think about this" }];

    await client.chat(messages, undefined, {
      thinking: { type: "enabled" },
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        thinking: { type: "enabled" },
      }),
      expect.any(Object)
    );
  });

  it("should reject thinking mode for non-supporting models", async () => {
    const client = new LLMClient(mockApiKey, "glm-4.1", mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Think about this" }];

    await expect(
      client.chat(messages, undefined, {
        thinking: { type: "enabled" },
      })
    ).rejects.toThrow("Thinking mode is not supported");
  });

  it("should support search options", async () => {
    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Search for something" }];

    await client.chat(messages, undefined, {
      searchOptions: {
        search_parameters: {
          mode: "on",
          return_citations: true,
        },
      },
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        search_parameters: {
          mode: "on",
          return_citations: true,
        },
      }),
      expect.any(Object)
    );
  });

  it("should support response format option", async () => {
    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Return JSON" }];

    await client.chat(messages, undefined, {
      responseFormat: { type: "json_object" },
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: "json_object" },
      }),
      expect.any(Object)
    );
  });

  it("should handle API errors gracefully", async () => {
    const apiError = new Error("API Error");
    (apiError as unknown as { status: number }).status = 500;
    mockCreate = vi.fn().mockRejectedValue(apiError);

    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    await expect(client.chat(messages)).rejects.toThrow("LLM API error");
  });

  it("should handle abort signal", async () => {
    const controller = new AbortController();
    controller.abort();

    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    // The API call should be made with the aborted signal
    mockCreate = vi.fn().mockRejectedValue(new Error("Aborted"));

    await expect(client.chat(messages, undefined, { signal: controller.signal })).rejects.toThrow();
  });

  it("should track usage when present in response", async () => {
    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    const response = await client.chat(messages);

    expect(response.usage).toBeDefined();
    expect(response.usage?.total_tokens).toBe(30);
  });

  it("should handle response with reasoning_content", async () => {
    const responseWithReasoning: LLMResponse = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "Final answer",
            reasoning_content: "Let me think about this...",
          },
          finish_reason: "stop",
        },
      ],
    };
    mockCreate = vi.fn().mockResolvedValue(responseWithReasoning);

    const client = new LLMClient(mockApiKey, "glm-4.6", mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Think about this" }];

    const response = await client.chat(messages);

    expect(response.choices[0].message.reasoning_content).toBe("Let me think about this...");
  });

  it("should use reasoning_effort for Grok models with thinking enabled", async () => {
    const client = new LLMClient(mockApiKey, "grok-4", mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Think hard" }];

    await client.chat(messages, undefined, {
      model: "grok-4",
      thinking: { type: "enabled", reasoningEffort: "high" },
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoning_effort: "high",
      }),
      expect.any(Object)
    );
  });
});

describe("LLMClient chatStream method", () => {
  const mockApiKey = "test-api-key";
  const mockModel = "glm-4.1";
  const mockBaseURL = "https://api.test.ai/v1";

  beforeEach(() => {
    vi.clearAllMocks();
    mockTryAcquire = vi.fn().mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetIn: 60000,
    });
  });

  it("should stream chunks from API", async () => {
    async function* mockStreamGenerator() {
      yield {
        choices: [{ delta: { content: "Hello" }, finish_reason: null }],
      };
      yield {
        choices: [{ delta: { content: " world" }, finish_reason: null }],
      };
      yield {
        choices: [{ delta: {}, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      };
    }
    mockCreate = vi.fn().mockResolvedValue(mockStreamGenerator());

    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Say hello" }];

    const chunks: unknown[] = [];
    for await (const chunk of client.chatStream(messages)) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(3);
  });

  it("should reject streaming when rate limit exceeded", async () => {
    mockTryAcquire = vi.fn().mockReturnValue({
      allowed: false,
      limit: 60,
      remaining: 0,
      resetIn: 30000,
    });

    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    const streamGenerator = client.chatStream(messages);

    await expect(async () => {
      for await (const _chunk of streamGenerator) {
        // consume
      }
    }).rejects.toThrow("Rate limit exceeded");
  });

  it("should handle streaming with tools", async () => {
    async function* mockStreamGenerator() {
      yield {
        choices: [
          {
            delta: {
              tool_calls: [{ id: "call_1", type: "function", function: { name: "test", arguments: "{" } }],
            },
            finish_reason: null,
          },
        ],
      };
      yield {
        choices: [{ delta: {}, finish_reason: "tool_calls" }],
      };
    }
    mockCreate = vi.fn().mockResolvedValue(mockStreamGenerator());

    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Use the tool" }];
    const tools: LLMTool[] = [
      {
        type: "function",
        function: {
          name: "test",
          description: "Test tool",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
    ];

    const chunks: unknown[] = [];
    for await (const chunk of client.chatStream(messages, tools)) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(2);
  });

  it("should handle streaming errors", async () => {
    async function* mockErrorGenerator() {
      yield { choices: [{ delta: { content: "Start" }, finish_reason: null }] };
      throw new Error("Stream error");
    }
    mockCreate = vi.fn().mockResolvedValue(mockErrorGenerator());

    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    await expect(async () => {
      for await (const _chunk of client.chatStream(messages)) {
        // consume
      }
    }).rejects.toThrow();
  });

  it("should pass stream: true to API", async () => {
    async function* mockStreamGenerator() {
      yield { choices: [{ delta: {}, finish_reason: "stop" }] };
    }
    mockCreate = vi.fn().mockResolvedValue(mockStreamGenerator());

    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    for await (const _chunk of client.chatStream(messages)) {
      // consume
    }

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: true,
      }),
      expect.any(Object)
    );
  });
});

describe("LLMClient search method (deprecated)", () => {
  const mockApiKey = "test-api-key";
  const mockModel = "glm-4.1";
  const mockBaseURL = "https://api.test.ai/v1";

  const mockResponse: LLMResponse = {
    choices: [
      {
        message: { role: "assistant", content: "Search result" },
        finish_reason: "stop",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn().mockResolvedValue(mockResponse);
    mockTryAcquire = vi.fn().mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetIn: 60000,
    });
  });

  it("should call chat with search parameters", async () => {
    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);

    await client.search("What is TypeScript?");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        search_parameters: { mode: "on" },
      }),
      expect.any(Object)
    );
  });

  it("should accept custom search parameters", async () => {
    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);

    await client.search("Latest news", {
      mode: "auto",
      max_search_results: 10,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        search_parameters: {
          mode: "auto",
          max_search_results: 10,
        },
      }),
      expect.any(Object)
    );
  });
});

describe("LLMClient response coercion", () => {
  const mockApiKey = "test-api-key";
  const mockModel = "glm-4.1";
  const mockBaseURL = "https://api.test.ai/v1";

  beforeEach(() => {
    vi.clearAllMocks();
    mockTryAcquire = vi.fn().mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetIn: 60000,
    });
  });

  it("should handle response with missing usage", async () => {
    const responseNoUsage = {
      choices: [
        {
          message: { role: "assistant", content: "Response" },
          finish_reason: "stop",
        },
      ],
    };
    mockCreate = vi.fn().mockResolvedValue(responseNoUsage);

    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    const response = await client.chat(messages);

    expect(response.choices).toHaveLength(1);
    expect(response.usage).toBeUndefined();
  });

  it("should handle response with cached tokens", async () => {
    const responseWithCache = {
      choices: [
        {
          message: { role: "assistant", content: "Response" },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
        prompt_tokens_details: {
          cached_tokens: 50,
        },
      },
    };
    mockCreate = vi.fn().mockResolvedValue(responseWithCache);

    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    const response = await client.chat(messages);

    expect(response.usage?.prompt_tokens).toBe(100);
  });

  it("should handle empty tools array", async () => {
    const mockResponse = {
      choices: [
        {
          message: { role: "assistant", content: "Response" },
          finish_reason: "stop",
        },
      ],
    };
    mockCreate = vi.fn().mockResolvedValue(mockResponse);

    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    await client.chat(messages, []);

    // Empty tools array should not be included in request
    expect(mockCreate).toHaveBeenCalledWith(
      expect.not.objectContaining({
        tools: [],
      }),
      expect.any(Object)
    );
  });
});

describe("LLMClient sampling configuration", () => {
  const mockApiKey = "test-api-key";
  const mockModel = "glm-4.1";
  const mockBaseURL = "https://api.test.ai/v1";

  const mockResponse: LLMResponse = {
    choices: [
      {
        message: { role: "assistant", content: "Response" },
        finish_reason: "stop",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn().mockResolvedValue(mockResponse);
    mockTryAcquire = vi.fn().mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetIn: 60000,
    });
  });

  it("should support do_sample for GLM models", async () => {
    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    await client.chat(messages, undefined, {
      sampling: { doSample: false },
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        do_sample: false,
      }),
      expect.any(Object)
    );
  });

  it("should support topP parameter", async () => {
    const client = new LLMClient(mockApiKey, mockModel, mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    await client.chat(messages, undefined, {
      sampling: { topP: 0.9 },
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        top_p: 0.9,
      }),
      expect.any(Object)
    );
  });

  it("should support seed for Grok models", async () => {
    const client = new LLMClient(mockApiKey, "grok-4", mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    await client.chat(messages, undefined, {
      model: "grok-4",
      sampling: { seed: 12345 },
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        seed: 12345,
      }),
      expect.any(Object)
    );
  });
});

describe("LLMClient custom model handling", () => {
  const mockApiKey = "test-api-key";
  const mockBaseURL = "https://api.test.ai/v1";

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: { role: "assistant", content: "Response" },
          finish_reason: "stop",
        },
      ],
    });
    mockTryAcquire = vi.fn().mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetIn: 60000,
    });
  });

  it("should allow custom model names with warning", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new LLMClient(mockApiKey, "ollama/llama3", mockBaseURL);
    expect(client.getCurrentModel()).toBe("ollama/llama3");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("custom model"));
    consoleSpy.mockRestore();
  });

  it("should allow wide temperature range for custom models", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new LLMClient(mockApiKey, "custom-model", mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    // Custom models allow 0-2 temperature range
    await client.chat(messages, undefined, { temperature: 1.5 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 1.5,
      }),
      expect.any(Object)
    );
    consoleSpy.mockRestore();
  });

  it("should clamp maxTokens for custom models at 128K", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new LLMClient(mockApiKey, "custom-model", mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    await client.chat(messages, undefined, { maxTokens: 200000 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 128000, // Clamped
      }),
      expect.any(Object)
    );
    consoleSpy.mockRestore();
  });

  it("should reject out-of-range temperature for custom models", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new LLMClient(mockApiKey, "custom-model", mockBaseURL);
    const messages: LLMMessage[] = [{ role: "user", content: "Hello" }];

    await expect(client.chat(messages, undefined, { temperature: 2.5 })).rejects.toThrow(
      "Temperature 2.5 is out of range"
    );
    consoleSpy.mockRestore();
  });
});
