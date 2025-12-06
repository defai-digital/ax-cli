/**
 * Tests for TodoTool
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TodoTool } from "../../src/tools/todo-tool.js";

describe("TodoTool", () => {
  let todoTool: TodoTool;

  beforeEach(() => {
    todoTool = new TodoTool();
  });

  describe("formatTodoList", () => {
    it("should return message when no todos", () => {
      const output = todoTool.formatTodoList();
      expect(output).toBe("No todos created yet");
    });
  });

  describe("createTodoList", () => {
    it("should create a valid todo list", async () => {
      const todos = [
        { id: "1", content: "Task 1", status: "pending" as const, priority: "high" as const },
        { id: "2", content: "Task 2", status: "in_progress" as const, priority: "medium" as const },
        { id: "3", content: "Task 3", status: "completed" as const, priority: "low" as const },
      ];

      const result = await todoTool.createTodoList(todos);

      expect(result.success).toBe(true);
      expect(result.output).toContain("Task 1");
      expect(result.output).toContain("Task 2");
      expect(result.output).toContain("Task 3");
    });

    it("should reject non-array input", async () => {
      const result = await todoTool.createTodoList("not an array" as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("must be an array");
    });

    it("should reject todos without required fields", async () => {
      const todos = [
        { id: "1", content: "Task 1" }, // Missing status and priority
      ];

      const result = await todoTool.createTodoList(todos as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("must have id, content, status, and priority");
    });

    it("should reject invalid status", async () => {
      const todos = [
        { id: "1", content: "Task 1", status: "invalid", priority: "high" },
      ];

      const result = await todoTool.createTodoList(todos as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid status");
    });

    it("should reject invalid priority", async () => {
      const todos = [
        { id: "1", content: "Task 1", status: "pending", priority: "invalid" },
      ];

      const result = await todoTool.createTodoList(todos as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid priority");
    });

    it("should handle empty array", async () => {
      const result = await todoTool.createTodoList([]);

      expect(result.success).toBe(true);
      expect(result.output).toBe("No todos created yet");
    });
  });

  describe("updateTodoList", () => {
    beforeEach(async () => {
      // Create initial todos
      await todoTool.createTodoList([
        { id: "1", content: "Task 1", status: "pending" as const, priority: "high" as const },
        { id: "2", content: "Task 2", status: "pending" as const, priority: "medium" as const },
      ]);
    });

    it("should update todo status", async () => {
      const result = await todoTool.updateTodoList([
        { id: "1", status: "completed" },
      ]);

      expect(result.success).toBe(true);
    });

    it("should update todo content", async () => {
      const result = await todoTool.updateTodoList([
        { id: "1", content: "Updated Task 1" },
      ]);

      expect(result.success).toBe(true);
      expect(result.output).toContain("Updated Task 1");
    });

    it("should update todo priority", async () => {
      const result = await todoTool.updateTodoList([
        { id: "1", priority: "low" },
      ]);

      expect(result.success).toBe(true);
    });

    it("should reject non-array updates", async () => {
      const result = await todoTool.updateTodoList("not an array" as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("must be an array");
    });

    it("should reject updates without id", async () => {
      const result = await todoTool.updateTodoList([
        { status: "completed" } as any,
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing required 'id' field");
    });

    it("should reject updates with empty id", async () => {
      const result = await todoTool.updateTodoList([
        { id: "", status: "completed" },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing required 'id' field");
    });

    it("should handle non-existent todo id", async () => {
      const result = await todoTool.updateTodoList([
        { id: "non-existent", status: "completed" },
      ]);

      // Returns false when todo not found
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should reject invalid status in updates", async () => {
      const result = await todoTool.updateTodoList([
        { id: "1", status: "invalid" },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid status");
    });

    it("should reject invalid priority in updates", async () => {
      const result = await todoTool.updateTodoList([
        { id: "1", priority: "invalid" },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid priority");
    });

    it("should handle multiple updates", async () => {
      const result = await todoTool.updateTodoList([
        { id: "1", status: "completed" },
        { id: "2", status: "in_progress", content: "Updated Task 2" },
      ]);

      expect(result.success).toBe(true);
    });
  });

  describe("viewTodoList", () => {
    it("should view empty todo list", async () => {
      const result = await todoTool.viewTodoList();

      expect(result.success).toBe(true);
      expect(result.output).toBe("No todos created yet");
    });

    it("should view todo list after creation", async () => {
      await todoTool.createTodoList([
        { id: "1", content: "Task 1", status: "pending" as const, priority: "high" as const },
        { id: "2", content: "Task 2", status: "completed" as const, priority: "medium" as const },
      ]);

      const result = await todoTool.viewTodoList();

      expect(result.success).toBe(true);
      expect(result.output).toContain("Task 1");
      expect(result.output).toContain("Task 2");
    });
  });
});
