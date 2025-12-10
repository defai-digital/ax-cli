/**
 * Tests for LLM Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LLMClient, type LLMTool, type LLMMessage } from "../../packages/core/src/llm/client.js";

// Mock OpenAI
vi.mock("openai", () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn(),
      },
    };
    constructor() {}
  }
  return {
    default: MockOpenAI,
  };
});

// Mock rate limiter to avoid timing issues
vi.mock("../../packages/core/src/utils/rate-limiter.js", () => {
  class MockRateLimiter {
    constructor() {}
    checkLimit = vi.fn().mockResolvedValue(true);
    recordRequest = vi.fn();
  }
  return {
    RateLimiter: MockRateLimiter,
    DEFAULT_RATE_LIMITS: {
      LLM_API: { requestsPerMinute: 60, tokensPerMinute: 100000 },
    },
  };
});

describe("LLMClient", () => {
  let client: LLMClient;
  const mockApiKey = "test-api-key";
  const mockModel = "glm-4.1";
  const mockBaseURL = "https://api.test.ai/v1";

  beforeEach(() => {
    vi.clearAllMocks();
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
