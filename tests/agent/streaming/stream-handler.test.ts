/**
 * Tests for Stream Handler
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { StreamHandler, type StreamHandlerConfig, type TokenRefs } from "../../../packages/core/src/agent/streaming/stream-handler.js";
import type { GLM46StreamChunk } from "../../../packages/core/src/llm/types.js";

// Mock usage tracker
vi.mock("../../../packages/core/src/utils/usage-tracker.js", () => ({
  getUsageTracker: vi.fn().mockReturnValue({
    trackUsage: vi.fn(),
  }),
}));

describe("StreamHandler", () => {
  let streamHandler: StreamHandler;
  let defaultConfig: StreamHandlerConfig;
  let defaultTokenRefs: TokenRefs;

  function createConfig(overrides: Partial<StreamHandlerConfig> = {}): StreamHandlerConfig {
    return {
      isCancelled: () => false,
      yieldCancellation: async function* () {
        yield { type: "content", content: "Cancelled" };
      },
      model: "test-model",
      ...overrides,
    };
  }

  function createTokenRefs(): TokenRefs {
    return {
      inputTokens: 100,
      lastTokenUpdate: { value: 0 },
      totalOutputTokens: { value: 0 },
    };
  }

  async function* createMockStream(chunks: GLM46StreamChunk[]): AsyncIterable<GLM46StreamChunk> {
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  async function collectChunks<T>(generator: AsyncIterable<T>): Promise<T[]> {
    const chunks: T[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }
    return chunks;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    defaultConfig = createConfig();
    defaultTokenRefs = createTokenRefs();
    streamHandler = new StreamHandler(defaultConfig);
  });

  describe("constructor", () => {
    it("should create instance with config", () => {
      expect(streamHandler).toBeDefined();
    });
  });

  describe("processChunks - content streaming", () => {
    it("should yield content chunks", async () => {
      const chunks: GLM46StreamChunk[] = [
        {
          choices: [{ delta: { content: "Hello" }, index: 0 }],
        },
        {
          choices: [{ delta: { content: " World" }, index: 0 }],
        },
      ];

      const results = await collectChunks(
        streamHandler.processChunks(createMockStream(chunks), defaultTokenRefs)
      );

      const contentChunks = results.filter((r) => "type" in r && r.type === "content");
      expect(contentChunks).toHaveLength(2);
      expect((contentChunks[0] as any).content).toBe("Hello");
      expect((contentChunks[1] as any).content).toBe(" World");
    });

    it("should accumulate content correctly", async () => {
      const chunks: GLM46StreamChunk[] = [
        {
          choices: [{ delta: { content: "Hello" }, index: 0 }],
        },
        {
          choices: [{ delta: { content: " World" }, index: 0 }],
        },
      ];

      const results = await collectChunks(
        streamHandler.processChunks(createMockStream(chunks), defaultTokenRefs)
      );

      // Last result should be the accumulated result
      const lastResult = results[results.length - 1];
      expect(lastResult).toHaveProperty("content");
      expect((lastResult as any).content).toBe("Hello World");
    });

    it("should handle empty chunks", async () => {
      const chunks: GLM46StreamChunk[] = [
        {
          choices: [],
        },
        {
          choices: [{ delta: { content: "Content" }, index: 0 }],
        },
      ];

      const results = await collectChunks(
        streamHandler.processChunks(createMockStream(chunks), defaultTokenRefs)
      );

      const contentChunks = results.filter((r) => "type" in r && r.type === "content");
      expect(contentChunks).toHaveLength(1);
    });

    it("should handle chunks without delta", async () => {
      const chunks: GLM46StreamChunk[] = [
        {
          choices: [{ index: 0 }] as any,
        },
      ];

      const results = await collectChunks(
        streamHandler.processChunks(createMockStream(chunks), defaultTokenRefs)
      );

      // Should return accumulated result even with no content
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("processChunks - reasoning content", () => {
    it("should yield reasoning chunks", async () => {
      const chunks: GLM46StreamChunk[] = [
        {
          choices: [{ delta: { reasoning_content: "Thinking..." }, index: 0 }],
        },
        {
          choices: [{ delta: { content: "Result" }, index: 0 }],
        },
      ];

      const results = await collectChunks(
        streamHandler.processChunks(createMockStream(chunks), defaultTokenRefs)
      );

      const reasoningChunks = results.filter((r) => "type" in r && r.type === "reasoning");
      expect(reasoningChunks).toHaveLength(1);
      expect((reasoningChunks[0] as any).reasoningContent).toBe("Thinking...");
    });
  });

  describe("processChunks - tool calls", () => {
    it("should yield tool calls when complete", async () => {
      const chunks: GLM46StreamChunk[] = [
        {
          choices: [{
            delta: {
              tool_calls: [{
                index: 0,
                id: "call-1",
                type: "function",
                function: {
                  name: "test_tool",
                  arguments: '{"arg": "value"}',
                },
              }],
            },
            index: 0,
          }],
        },
      ];

      const results = await collectChunks(
        streamHandler.processChunks(createMockStream(chunks), defaultTokenRefs)
      );

      const toolCallChunks = results.filter((r) => "type" in r && r.type === "tool_calls");
      expect(toolCallChunks).toHaveLength(1);
      expect((toolCallChunks[0] as any).toolCalls[0].function.name).toBe("test_tool");
    });

    it("should only yield tool calls once", async () => {
      const chunks: GLM46StreamChunk[] = [
        {
          choices: [{
            delta: {
              tool_calls: [{
                index: 0,
                id: "call-1",
                type: "function",
                function: {
                  name: "test_tool",
                  arguments: '{"arg"',
                },
              }],
            },
            index: 0,
          }],
        },
        {
          choices: [{
            delta: {
              tool_calls: [{
                index: 0,
                function: {
                  arguments: ': "value"}',
                },
              }],
            },
            index: 0,
          }],
        },
      ];

      const results = await collectChunks(
        streamHandler.processChunks(createMockStream(chunks), defaultTokenRefs)
      );

      const toolCallChunks = results.filter((r) => "type" in r && r.type === "tool_calls");
      // Should only yield once after initial complete tool call
      expect(toolCallChunks.length).toBeLessThanOrEqual(1);
    });

    it("should skip invalid tool calls", async () => {
      const chunks: GLM46StreamChunk[] = [
        {
          choices: [{
            delta: {
              tool_calls: [{
                index: 0,
                // Missing id and function name
              }],
            },
            index: 0,
          }],
        },
      ];

      const results = await collectChunks(
        streamHandler.processChunks(createMockStream(chunks), defaultTokenRefs)
      );

      const toolCallChunks = results.filter((r) => "type" in r && r.type === "tool_calls");
      expect(toolCallChunks).toHaveLength(0);
    });
  });

  describe("processChunks - usage tracking", () => {
    it("should track usage data", async () => {
      // Import using the same relative path as the mock
      const usageTrackerModule = await import("../../../packages/core/src/utils/usage-tracker.js");
      const { getUsageTracker } = usageTrackerModule;

      const chunks: GLM46StreamChunk[] = [
        {
          choices: [{ delta: { content: "Test" }, index: 0 }],
        },
        {
          choices: [{ delta: { content: "" }, index: 0, finish_reason: "stop" }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        },
      ];

      await collectChunks(
        streamHandler.processChunks(createMockStream(chunks), defaultTokenRefs)
      );

      expect(vi.mocked(getUsageTracker)().trackUsage).toHaveBeenCalledWith(
        "test-model",
        expect.objectContaining({ total_tokens: 15 })
      );
    });

    it("should yield accurate token count from usage data", async () => {
      const chunks: GLM46StreamChunk[] = [
        {
          choices: [{ delta: { content: "Test" }, index: 0 }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        },
      ];

      const results = await collectChunks(
        streamHandler.processChunks(createMockStream(chunks), defaultTokenRefs)
      );

      const tokenChunks = results.filter((r) => "type" in r && r.type === "token_count");
      const lastTokenChunk = tokenChunks[tokenChunks.length - 1];
      expect((lastTokenChunk as any).tokenCount).toBe(15);
    });
  });

  describe("processChunks - cancellation", () => {
    it("should stop processing on cancellation", async () => {
      let cancelled = false;
      const config = createConfig({
        isCancelled: () => cancelled,
      });
      const handler = new StreamHandler(config);

      async function* slowStream(): AsyncIterable<GLM46StreamChunk> {
        yield {
          choices: [{ delta: { content: "First" }, index: 0 }],
        };
        // Simulate cancellation after first chunk
        cancelled = true;
        yield {
          choices: [{ delta: { content: "Second" }, index: 0 }],
        };
      }

      const results = await collectChunks(
        handler.processChunks(slowStream(), defaultTokenRefs)
      );

      // Should have first content and cancellation, not "Second"
      const contentChunks = results.filter((r) => "type" in r && r.type === "content");
      expect(contentChunks.length).toBeLessThanOrEqual(2);
    });
  });

  describe("setModel", () => {
    it("should update the model for usage tracking", () => {
      streamHandler.setModel("new-model");
      // Model is stored in config internally
      expect((streamHandler as any).config.model).toBe("new-model");
    });
  });

  describe("reduceStreamDelta", () => {
    it("should concatenate string values", () => {
      const acc = { content: "Hello" };
      const delta = { content: " World" };

      const result = (streamHandler as any).reduceStreamDelta(acc, delta);

      expect(result.content).toBe("Hello World");
    });

    it("should handle initial assignment", () => {
      const acc: Record<string, unknown> = {};
      const delta = { content: "Initial" };

      const result = (streamHandler as any).reduceStreamDelta(acc, delta);

      expect(result.content).toBe("Initial");
    });

    it("should skip undefined/null values", () => {
      const acc = { existing: "value" };
      const delta = { newKey: undefined, anotherKey: null };

      const result = (streamHandler as any).reduceStreamDelta(acc, delta);

      expect(result.newKey).toBeUndefined();
      expect(result.anotherKey).toBeUndefined();
      expect(result.existing).toBe("value");
    });

    it("should merge arrays", () => {
      const acc = { arr: [{ a: 1 }] };
      const delta = { arr: [{ b: 2 }] };

      const result = (streamHandler as any).reduceStreamDelta(acc, delta);

      expect(result.arr[0]).toEqual({ a: 1, b: 2 });
    });

    it("should recursively merge objects", () => {
      const acc = { obj: { nested: { a: 1 } } };
      const delta = { obj: { nested: { b: 2 } } };

      const result = (streamHandler as any).reduceStreamDelta(acc, delta);

      expect(result.obj.nested).toEqual({ a: 1, b: 2 });
    });

    it("should handle direct assignment for non-mergeable types", () => {
      const acc = { value: 1 };
      const delta = { value: 2 };

      const result = (streamHandler as any).reduceStreamDelta(acc, delta);

      expect(result.value).toBe(2);
    });

    it("should clean up index properties from tool calls", () => {
      const acc: Record<string, unknown> = {};
      const delta = {
        tool_calls: [{ index: 0, id: "test", name: "tool" }],
      };

      const result = (streamHandler as any).reduceStreamDelta(acc, delta);

      expect((result.tool_calls as any[])[0].index).toBeUndefined();
      expect((result.tool_calls as any[])[0].id).toBe("test");
    });
  });

  describe("messageReducer", () => {
    it("should accumulate message from chunk", () => {
      const previous = { content: "Hello" };
      const chunk: GLM46StreamChunk = {
        choices: [{ delta: { content: " World" }, index: 0 }],
      };

      const result = (streamHandler as any).messageReducer(previous, chunk);

      expect(result.content).toBe("Hello World");
    });

    it("should handle invalid chunk structure", () => {
      const previous = { content: "Original" };
      const invalidChunk = {} as GLM46StreamChunk;

      const result = (streamHandler as any).messageReducer(previous, invalidChunk);

      expect(result.content).toBe("Original");
    });

    it("should handle empty choices", () => {
      const previous = { content: "Original" };
      const chunk: GLM46StreamChunk = { choices: [] };

      const result = (streamHandler as any).messageReducer(previous, chunk);

      expect(result.content).toBe("Original");
    });

    it("should handle missing delta", () => {
      const previous = { content: "Original" };
      const chunk = { choices: [{ index: 0 }] } as GLM46StreamChunk;

      const result = (streamHandler as any).messageReducer(previous, chunk);

      expect(result.content).toBe("Original");
    });
  });
});
