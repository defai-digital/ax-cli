/**
 * Tests for parallel tool execution
 */

import { describe, it, expect } from "vitest";
import {
  isParallelSafe,
  partitionToolCalls,
  executeToolsInParallel,
  TOOL_CLASSIFICATION,
} from "../../packages/core/src/agent/parallel-tools.js";
import type { LLMToolCall } from "../../packages/core/src/llm/client.js";

// Helper to create mock tool calls
function createToolCall(name: string, id?: string): LLMToolCall {
  return {
    id: id || `call_${name}_${Math.random().toString(36).slice(2)}`,
    type: "function",
    function: {
      name,
      arguments: "{}",
    },
  };
}

describe("parallel-tools", () => {
  describe("isParallelSafe", () => {
    it("should classify read-only tools as parallel-safe", () => {
      expect(isParallelSafe("view_file")).toBe(true);
      expect(isParallelSafe("search")).toBe(true);
      expect(isParallelSafe("bash_output")).toBe(true);
    });

    it("should classify ax_agent as parallel-safe", () => {
      expect(isParallelSafe("ax_agent")).toBe(true);
    });

    it("should classify write tools as sequential", () => {
      expect(isParallelSafe("create_file")).toBe(false);
      expect(isParallelSafe("str_replace_editor")).toBe(false);
      expect(isParallelSafe("multi_edit")).toBe(false);
    });

    it("should classify bash as sequential (may have side effects)", () => {
      expect(isParallelSafe("bash")).toBe(false);
    });

    it("should classify MCP tools as sequential by default", () => {
      expect(isParallelSafe("mcp__server__tool")).toBe(false);
      expect(isParallelSafe("mcp__another__tool")).toBe(false);
    });

    it("should classify unknown tools as sequential for safety", () => {
      expect(isParallelSafe("unknown_tool")).toBe(false);
      expect(isParallelSafe("some_new_tool")).toBe(false);
    });
  });

  describe("partitionToolCalls", () => {
    it("should partition tools into parallel and sequential groups", () => {
      const toolCalls = [
        createToolCall("view_file"),
        createToolCall("str_replace_editor"),
        createToolCall("ax_agent"),
        createToolCall("bash"),
        createToolCall("search"),
      ];

      const { parallel, sequential } = partitionToolCalls(toolCalls);

      expect(parallel).toHaveLength(3);
      expect(parallel.map((t) => t.function.name)).toEqual([
        "view_file",
        "ax_agent",
        "search",
      ]);

      expect(sequential).toHaveLength(2);
      expect(sequential.map((t) => t.function.name)).toEqual([
        "str_replace_editor",
        "bash",
      ]);
    });

    it("should return empty arrays for empty input", () => {
      const { parallel, sequential } = partitionToolCalls([]);

      expect(parallel).toEqual([]);
      expect(sequential).toEqual([]);
    });

    it("should handle all parallel tools", () => {
      const toolCalls = [
        createToolCall("view_file"),
        createToolCall("search"),
        createToolCall("ax_agent"),
      ];

      const { parallel, sequential } = partitionToolCalls(toolCalls);

      expect(parallel).toHaveLength(3);
      expect(sequential).toHaveLength(0);
    });

    it("should handle all sequential tools", () => {
      const toolCalls = [
        createToolCall("str_replace_editor"),
        createToolCall("bash"),
        createToolCall("create_file"),
      ];

      const { parallel, sequential } = partitionToolCalls(toolCalls);

      expect(parallel).toHaveLength(0);
      expect(sequential).toHaveLength(3);
    });
  });

  describe("executeToolsInParallel", () => {
    it("should execute tools in parallel and return results in order", async () => {
      const toolCalls = [
        createToolCall("tool1", "id1"),
        createToolCall("tool2", "id2"),
        createToolCall("tool3", "id3"),
      ];

      const executionOrder: string[] = [];

      const executor = async (toolCall: LLMToolCall) => {
        executionOrder.push(toolCall.id);
        // Simulate async work with varying delays
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 10)
        );
        return { success: true, output: `Result for ${toolCall.id}` };
      };

      const results = await executeToolsInParallel(toolCalls, executor);

      // Results should be in the same order as input
      expect(results).toHaveLength(3);
      expect(results[0].toolCall.id).toBe("id1");
      expect(results[1].toolCall.id).toBe("id2");
      expect(results[2].toolCall.id).toBe("id3");

      // All results should be successful
      expect(results.every((r) => r.result.success)).toBe(true);
    });

    it("should handle errors gracefully", async () => {
      const toolCalls = [
        createToolCall("tool1", "id1"),
        createToolCall("tool2", "id2"),
      ];

      const executor = async (toolCall: LLMToolCall) => {
        if (toolCall.id === "id2") {
          throw new Error("Tool failed");
        }
        return { success: true, output: "OK" };
      };

      const results = await executeToolsInParallel(toolCalls, executor);

      expect(results).toHaveLength(2);
      expect(results[0].result.success).toBe(true);
      expect(results[1].error).toBeDefined();
      expect(results[1].error?.message).toBe("Tool failed");
    });

    it("should return empty array for empty input", async () => {
      const results = await executeToolsInParallel([], async () => ({
        success: true,
        output: "",
      }));

      expect(results).toEqual([]);
    });

    it("should execute single tool without parallel overhead", async () => {
      const toolCalls = [createToolCall("tool1", "id1")];

      const executor = async () => ({ success: true, output: "OK" });

      const results = await executeToolsInParallel(toolCalls, executor);

      expect(results).toHaveLength(1);
      expect(results[0].result.success).toBe(true);
    });

    it("should respect maxConcurrency setting", async () => {
      const toolCalls = Array.from({ length: 10 }, (_, i) =>
        createToolCall(`tool${i}`, `id${i}`)
      );

      let currentConcurrency = 0;
      let maxObservedConcurrency = 0;

      const executor = async (toolCall: LLMToolCall) => {
        currentConcurrency++;
        maxObservedConcurrency = Math.max(
          maxObservedConcurrency,
          currentConcurrency
        );
        await new Promise((resolve) => setTimeout(resolve, 50));
        currentConcurrency--;
        return { success: true, output: toolCall.id };
      };

      await executeToolsInParallel(toolCalls, executor, { maxConcurrency: 2 });

      // Max observed concurrency should not exceed the limit
      expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
    });

    it("should execute sequentially when enabled is false", async () => {
      const toolCalls = [
        createToolCall("tool1", "id1"),
        createToolCall("tool2", "id2"),
        createToolCall("tool3", "id3"),
      ];

      const executionOrder: string[] = [];

      const executor = async (toolCall: LLMToolCall) => {
        executionOrder.push(`start-${toolCall.id}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push(`end-${toolCall.id}`);
        return { success: true, output: toolCall.id };
      };

      const results = await executeToolsInParallel(toolCalls, executor, {
        enabled: false,
      });

      expect(results).toHaveLength(3);
      // When disabled, execution should be strictly sequential
      expect(executionOrder).toEqual([
        "start-id1",
        "end-id1",
        "start-id2",
        "end-id2",
        "start-id3",
        "end-id3",
      ]);
    });

    it("should handle errors when enabled is false", async () => {
      const toolCalls = [
        createToolCall("tool1", "id1"),
        createToolCall("tool2", "id2"),
      ];

      const executor = async (toolCall: LLMToolCall) => {
        if (toolCall.id === "id1") {
          throw new Error("First tool failed");
        }
        return { success: true, output: "OK" };
      };

      const results = await executeToolsInParallel(toolCalls, executor, {
        enabled: false,
      });

      expect(results).toHaveLength(2);
      expect(results[0].error).toBeDefined();
      expect(results[0].error?.message).toBe("First tool failed");
      expect(results[1].result.success).toBe(true);
    });

    it("should handle non-Error throws", async () => {
      const toolCalls = [createToolCall("tool1", "id1")];

      const executor = async () => {
        throw "string error";
      };

      const results = await executeToolsInParallel(toolCalls, executor);

      expect(results).toHaveLength(1);
      expect(results[0].error).toBeDefined();
      expect(results[0].error?.message).toBe("string error");
    });

    it("should use default config values", async () => {
      const toolCalls = [createToolCall("tool1", "id1")];

      const executor = async () => ({ success: true, output: "OK" });

      // Call without config - should use defaults
      const results = await executeToolsInParallel(toolCalls, executor);

      expect(results).toHaveLength(1);
      expect(results[0].result.success).toBe(true);
    });

    it("should handle maxConcurrency of 1", async () => {
      const toolCalls = [
        createToolCall("tool1", "id1"),
        createToolCall("tool2", "id2"),
      ];

      const executionOrder: string[] = [];

      const executor = async (toolCall: LLMToolCall) => {
        executionOrder.push(`start-${toolCall.id}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        executionOrder.push(`end-${toolCall.id}`);
        return { success: true, output: toolCall.id };
      };

      await executeToolsInParallel(toolCalls, executor, { maxConcurrency: 1 });

      // With maxConcurrency 1, should be sequential
      expect(executionOrder).toEqual([
        "start-id1",
        "end-id1",
        "start-id2",
        "end-id2",
      ]);
    });
  });

  describe("TOOL_CLASSIFICATION", () => {
    it("should have explicit classification for common tools", () => {
      // Verify all expected tools are classified
      const expectedTools = [
        "view_file",
        "create_file",
        "str_replace_editor",
        "multi_edit",
        "bash",
        "bash_output",
        "search",
        "ax_agent",
        "todo",
        "ask_user",
      ];

      for (const tool of expectedTools) {
        expect(TOOL_CLASSIFICATION).toHaveProperty(tool);
      }
    });
  });
});
