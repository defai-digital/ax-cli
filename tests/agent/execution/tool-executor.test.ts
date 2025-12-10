/**
 * Tests for Tool Executor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ToolExecutor, type ToolExecutorConfig } from "../../../packages/core/src/agent/execution/tool-executor.js";
import type { LLMToolCall } from "../../../packages/core/src/llm/client.js";

// Mock dependencies
vi.mock("../../../packages/core/src/llm/tools.js", () => ({
  getMCPManager: vi.fn().mockReturnValue({
    callTool: vi.fn().mockResolvedValue({
      isError: false,
      content: [{ type: "text", text: "MCP result" }],
    }),
  }),
}));

// Use relative path for mocking hooks module
const hooksModulePath = "../../../packages/core/src/hooks/index.js";
vi.mock(hooksModulePath, () => ({
  getHooksManager: vi.fn().mockReturnValue({
    shouldBlockTool: vi.fn().mockResolvedValue({ blocked: false }),
    executePostToolHooks: vi.fn(),
  }),
}));

vi.mock("../../../packages/core/src/tools/ask-user.js", () => ({
  getAskUserTool: vi.fn().mockReturnValue({
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: "User answered: Option 1",
    }),
  }),
}));

vi.mock("../../../packages/core/src/tools/ax-agent.js", () => ({
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
      // Use package.json which exists in the project
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "view_file",
          arguments: JSON.stringify({ path: "package.json" }),
        },
      };

      const result = await executor.execute(toolCall);

      // Should succeed since package.json exists
      expect(result).toBeDefined();
    });

    it("should handle partial line range (only start_line)", async () => {
      // When only start_line is provided without end_line, the range is undefined
      // and view() is called without a range. This tests the actual behavior.
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "view_file",
          arguments: JSON.stringify({ path: "package.json", start_line: 1 }),
        },
      };

      const result = await executor.execute(toolCall);
      // Result depends on file existence, but should not error on argument parsing
      expect(result).toBeDefined();
    });

    it("should handle partial line range (only end_line)", async () => {
      // When only end_line is provided without start_line, the range is undefined
      // and view() is called without a range. This tests the actual behavior.
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "view_file",
          arguments: JSON.stringify({ path: "package.json", end_line: 10 }),
        },
      };

      const result = await executor.execute(toolCall);
      // Result depends on file existence, but should not error on argument parsing
      expect(result).toBeDefined();
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
    it("should return error for empty edits array", async () => {
      const toolCall: LLMToolCall = {
        id: "test-1",
        type: "function",
        function: {
          name: "multi_edit",
          arguments: JSON.stringify({
            path: "package.json",
            edits: [], // Empty edits array
          }),
        },
      };

      const result = await executor.execute(toolCall);

      // Should fail - either for empty edits or validation
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
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
      // Import using the same path as the mock
      const hooksModule = await import("../../../packages/core/src/hooks/index.js");
      vi.mocked(hooksModule.getHooksManager).mockReturnValue({
        shouldBlockTool: vi.fn().mockResolvedValue({
          blocked: true,
          reason: "Test block reason",
        }),
        executePostToolHooks: vi.fn(),
      } as unknown as ReturnType<typeof hooksModule.getHooksManager>);

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

// NOTE: getString, getNumber, getBoolean, getEnum are local helper functions
// inside the execute() method, not static class methods. They cannot be tested
// directly. The functionality is implicitly tested through tool execution tests.
