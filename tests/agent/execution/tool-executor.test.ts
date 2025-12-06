/**
 * Tests for Tool Executor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ToolExecutor, type ToolExecutorConfig } from "../../../src/agent/execution/tool-executor.js";
import type { LLMToolCall } from "../../../src/llm/client.js";

// Mock dependencies
vi.mock("../../../src/llm/tools.js", () => ({
  getMCPManager: vi.fn().mockReturnValue({
    callTool: vi.fn().mockResolvedValue({
      isError: false,
      content: [{ type: "text", text: "MCP result" }],
    }),
  }),
}));

vi.mock("../../../src/hooks/index.js", () => ({
  getHooksManager: vi.fn().mockReturnValue({
    shouldBlockTool: vi.fn().mockResolvedValue({ blocked: false }),
    executePostToolHooks: vi.fn(),
  }),
}));

vi.mock("../../../src/tools/ask-user.js", () => ({
  getAskUserTool: vi.fn().mockReturnValue({
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: "User answered: Option 1",
    }),
  }),
}));

vi.mock("../../../src/tools/ax-agent.js", () => ({
  executeAxAgent: vi.fn().mockResolvedValue({
    success: true,
    output: "Agent result",
  }),
  executeAxAgentsParallel: vi.fn().mockResolvedValue({
    success: true,
    output: "Parallel results",
  }),
}));

describe("ToolExecutor", () => {
  let executor: ToolExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new ToolExecutor();
  });

  afterEach(() => {
    executor.dispose();
  });

  describe("constructor", () => {
    it("should create instance with default config", () => {
      expect(executor).toBeDefined();
    });

    it("should accept checkpoint callback", () => {
      const callback = vi.fn();
      const exec = new ToolExecutor({ checkpointCallback: callback });
      expect(exec).toBeDefined();
      exec.dispose();
    });

    it("should accept ax_agent callbacks", () => {
      const onStart = vi.fn();
      const onEnd = vi.fn();
      const exec = new ToolExecutor({
        onAxAgentStart: onStart,
        onAxAgentEnd: onEnd,
      });
      expect(exec).toBeDefined();
      exec.dispose();
    });
  });

  describe("parseToolArguments", () => {
    it("should parse valid JSON arguments", () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "test_tool",
          arguments: '{"key": "value"}',
        },
      };

      const result = executor.parseToolArguments(toolCall);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.args.key).toBe("value");
      }
    });

    it("should return error for empty arguments", () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "test_tool",
          arguments: "",
        },
      };

      const result = executor.parseToolArguments(toolCall);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("empty arguments");
      }
    });

    it("should return error for whitespace-only arguments", () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "test_tool",
          arguments: "   ",
        },
      };

      const result = executor.parseToolArguments(toolCall);

      expect(result.success).toBe(false);
    });

    it("should return error for invalid JSON", () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "test_tool",
          arguments: "not json",
        },
      };

      const result = executor.parseToolArguments(toolCall);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not valid JSON");
      }
    });

    it("should return error for array arguments", () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "test_tool",
          arguments: "[1, 2, 3]",
        },
      };

      const result = executor.parseToolArguments(toolCall);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("must be a JSON object");
      }
    });

    it("should return error for null arguments", () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "test_tool",
          arguments: "null",
        },
      };

      const result = executor.parseToolArguments(toolCall);

      expect(result.success).toBe(false);
    });

    it("should return error for primitive arguments", () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "test_tool",
          arguments: '"string value"',
        },
      };

      const result = executor.parseToolArguments(toolCall);

      expect(result.success).toBe(false);
    });

    it("should include custom tool type in error", () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "test_tool",
          arguments: "",
        },
      };

      const result = executor.parseToolArguments(toolCall, "Custom");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Custom");
      }
    });
  });

  describe("execute - view_file", () => {
    it("should execute view_file without range", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "view_file",
          arguments: JSON.stringify({ path: "/tmp/test.txt" }),
        },
      };

      // Will fail because file doesn't exist, but validates execution path
      const result = await executor.execute(toolCall);

      // Expecting failure because file doesn't exist
      expect(result).toBeDefined();
    });

    it("should return error when only start_line provided", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "view_file",
          arguments: JSON.stringify({ path: "/tmp/test.txt", start_line: 1 }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain("both start_line and end_line");
    });

    it("should return error when only end_line provided", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "view_file",
          arguments: JSON.stringify({ path: "/tmp/test.txt", end_line: 10 }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain("both start_line and end_line");
    });
  });

  describe("execute - bash", () => {
    it("should execute bash command", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "echo hello" }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(true);
      expect(result.output).toContain("hello");
    });

    it("should pass timeout option", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "echo test", timeout: 5000 }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(true);
    });

    it("should pass background option", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "sleep 1", background: true }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(true);
      expect(result.output).toContain("Background");
    });
  });

  describe("execute - create_todo_list", () => {
    it("should create todo list", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "create_todo_list",
          arguments: JSON.stringify({
            todos: [
              { id: "1", content: "Task 1", status: "pending", priority: "high" },
            ],
          }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(true);
    });

    it("should handle empty todos", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "create_todo_list",
          arguments: JSON.stringify({ todos: [] }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(true);
    });

    it("should handle non-array todos", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "create_todo_list",
          arguments: JSON.stringify({ todos: "not an array" }),
        },
      };

      const result = await executor.execute(toolCall);

      // Should handle gracefully by using empty array
      expect(result.success).toBe(true);
    });
  });

  describe("execute - update_todo_list", () => {
    it("should update todo list", async () => {
      // First create a todo
      await executor.execute({
        id: "create-1",
        type: "function",
        function: {
          name: "create_todo_list",
          arguments: JSON.stringify({
            todos: [
              { id: "1", content: "Task 1", status: "pending", priority: "high" },
            ],
          }),
        },
      });

      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "update_todo_list",
          arguments: JSON.stringify({
            updates: [{ id: "1", status: "completed" }],
          }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(true);
    });
  });

  describe("execute - search", () => {
    it("should execute search with query", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "search",
          arguments: JSON.stringify({ query: "test" }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result).toBeDefined();
    });

    it("should pass search options", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "search",
          arguments: JSON.stringify({
            query: "test",
            search_type: "text",
            case_sensitive: true,
            max_results: 10,
          }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result).toBeDefined();
    });
  });

  describe("execute - ask_user", () => {
    it("should execute ask_user with valid questions", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "ask_user",
          arguments: JSON.stringify({
            questions: [
              {
                question: "Which option?",
                header: "Choice",
                options: [
                  { label: "Option 1", description: "First option" },
                  { label: "Option 2", description: "Second option" },
                ],
              },
            ],
          }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(true);
    });

    it("should return error when questions is not an array", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "ask_user",
          arguments: JSON.stringify({ questions: "not an array" }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain("'questions' array");
    });

    it("should return error when no valid questions", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "ask_user",
          arguments: JSON.stringify({
            questions: [{ question: "Test" }], // Missing options
          }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No valid questions");
    });

    it("should skip questions with fewer than 2 options", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "ask_user",
          arguments: JSON.stringify({
            questions: [
              {
                question: "Single option?",
                options: [{ label: "Only one" }],
              },
            ],
          }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No valid questions");
    });
  });

  describe("execute - multi_edit", () => {
    it("should return error for invalid edit structure", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "multi_edit",
          arguments: JSON.stringify({
            path: "/tmp/test.txt",
            edits: [{ old_str: "test" }], // Missing new_str
          }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain("invalid structure");
    });
  });

  describe("execute - ax_agents_parallel", () => {
    it("should return error when agents is empty", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "ax_agents_parallel",
          arguments: JSON.stringify({ agents: [] }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain("non-empty array");
    });

    it("should return error when agents is not an array", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "ax_agents_parallel",
          arguments: JSON.stringify({ agents: "not array" }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
    });

    it("should return error for invalid agent entry", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "ax_agents_parallel",
          arguments: JSON.stringify({
            agents: [{ agent: "test" }], // Missing task
          }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain("'agent' and 'task'");
    });
  });

  describe("execute - unknown tool", () => {
    it("should return error for unknown tool", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "unknown_tool",
          arguments: JSON.stringify({}),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown tool");
    });
  });

  describe("execute - hook blocking", () => {
    it("should return error when hook blocks tool", async () => {
      const { getHooksManager } = await import("../../../src/hooks/index.js");
      vi.mocked(getHooksManager).mockReturnValue({
        shouldBlockTool: vi.fn().mockResolvedValue({
          blocked: true,
          reason: "Test block reason",
        }),
        executePostToolHooks: vi.fn(),
      } as any);

      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "echo test" }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain("blocked by hook");
      expect(result.error).toContain("Test block reason");
    });
  });

  describe("tool getters", () => {
    it("should return bash tool", () => {
      const bash = executor.getBashTool();
      expect(bash).toBeDefined();
    });

    it("should return todo tool", () => {
      const todo = executor.getTodoTool();
      expect(todo).toBeDefined();
    });

    it("should return text editor tool", () => {
      const editor = executor.getTextEditorTool();
      expect(editor).toBeDefined();
    });
  });

  describe("dispose", () => {
    it("should dispose without error", () => {
      expect(() => executor.dispose()).not.toThrow();
    });

    it("should be safe to call multiple times", () => {
      executor.dispose();
      expect(() => executor.dispose()).not.toThrow();
    });
  });
});

describe("ToolExecutor static helpers", () => {
  it("getString should return string value", () => {
    const args = { key: "value" };
    const result = (ToolExecutor as any).getString(args, "key");
    expect(result).toBe("value");
  });

  it("getString should throw for non-string when required", () => {
    const args = { key: 123 };
    expect(() => (ToolExecutor as any).getString(args, "key", true)).toThrow();
  });

  it("getString should return empty string for non-string when not required", () => {
    const args = { key: 123 };
    const result = (ToolExecutor as any).getString(args, "key", false);
    expect(result).toBe("");
  });

  it("getNumber should return number value", () => {
    const args = { key: 42 };
    const result = (ToolExecutor as any).getNumber(args, "key");
    expect(result).toBe(42);
  });

  it("getNumber should return undefined for non-number", () => {
    const args = { key: "not a number" };
    const result = (ToolExecutor as any).getNumber(args, "key");
    expect(result).toBeUndefined();
  });

  it("getNumber should return undefined for null/undefined", () => {
    expect((ToolExecutor as any).getNumber({ key: null }, "key")).toBeUndefined();
    expect((ToolExecutor as any).getNumber({ key: undefined }, "key")).toBeUndefined();
    expect((ToolExecutor as any).getNumber({}, "key")).toBeUndefined();
  });

  it("getBoolean should return boolean value", () => {
    const args = { key: true };
    const result = (ToolExecutor as any).getBoolean(args, "key");
    expect(result).toBe(true);
  });

  it("getBoolean should return undefined for non-boolean", () => {
    const args = { key: "true" };
    const result = (ToolExecutor as any).getBoolean(args, "key");
    expect(result).toBeUndefined();
  });

  it("getEnum should return valid enum value", () => {
    const args = { key: "text" };
    const result = (ToolExecutor as any).getEnum(args, "key", ["text", "files", "both"]);
    expect(result).toBe("text");
  });

  it("getEnum should return undefined for invalid enum value", () => {
    const args = { key: "invalid" };
    const result = (ToolExecutor as any).getEnum(args, "key", ["text", "files", "both"]);
    expect(result).toBeUndefined();
  });
});
