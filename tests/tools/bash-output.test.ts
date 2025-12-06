/**
 * Tests for BashOutputTool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BashOutputTool } from "../../src/tools/bash-output.js";

// Mock the background task manager
const mockTasks: Map<string, any> = new Map();

vi.mock("../../src/utils/background-task-manager.js", () => ({
  getBackgroundTaskManager: () => ({
    getOutput: (taskId: string) => mockTasks.get(taskId) || null,
    waitForTask: async (taskId: string, _timeout: number) => {
      const task = mockTasks.get(taskId);
      if (!task) return null;
      // Simulate waiting by returning a completed task
      return { ...task, status: "completed" };
    },
    listTasks: () => Array.from(mockTasks.values()),
    kill: (taskId: string) => {
      if (mockTasks.has(taskId)) {
        const task = mockTasks.get(taskId);
        if (task.status === "running") {
          task.status = "killed";
          return true;
        }
      }
      return false;
    },
  }),
}));

describe("BashOutputTool", () => {
  let bashOutputTool: BashOutputTool;

  beforeEach(() => {
    mockTasks.clear();
    bashOutputTool = new BashOutputTool();
  });

  describe("execute", () => {
    it("should return error for missing task ID", async () => {
      const result = await bashOutputTool.execute("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Task ID is required");
    });

    it("should return error for non-existent task", async () => {
      const result = await bashOutputTool.execute("non_existent_task");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should return output for running task", async () => {
      mockTasks.set("task_1", {
        id: "task_1",
        status: "running",
        startTime: new Date(),
        stdout: "partial output",
        stderr: "",
      });

      const result = await bashOutputTool.execute("task_1");

      expect(result.success).toBe(true);
      expect(result.output).toContain("🔄");
      expect(result.output).toContain("task_1");
      expect(result.output).toContain("running");
      expect(result.output).toContain("partial output");
    });

    it("should return output for completed task", async () => {
      mockTasks.set("task_2", {
        id: "task_2",
        status: "completed",
        exitCode: 0,
        startTime: new Date(Date.now() - 5000),
        endTime: new Date(),
        stdout: "completed output",
        stderr: "",
      });

      const result = await bashOutputTool.execute("task_2");

      expect(result.success).toBe(true);
      expect(result.output).toContain("✅");
      expect(result.output).toContain("completed");
      expect(result.output).toContain("exit code: 0");
      expect(result.output).toContain("completed output");
    });

    it("should return output for failed task", async () => {
      mockTasks.set("task_3", {
        id: "task_3",
        status: "failed",
        exitCode: 1,
        startTime: new Date(Date.now() - 3000),
        endTime: new Date(),
        stdout: "",
        stderr: "error message",
      });

      const result = await bashOutputTool.execute("task_3");

      expect(result.success).toBe(true);
      expect(result.output).toContain("❌");
      expect(result.output).toContain("failed");
      expect(result.output).toContain("exit code: 1");
      expect(result.output).toContain("error message");
    });

    it("should return output for killed task", async () => {
      mockTasks.set("task_4", {
        id: "task_4",
        status: "killed",
        startTime: new Date(Date.now() - 2000),
        endTime: new Date(),
        stdout: "interrupted",
        stderr: "",
      });

      const result = await bashOutputTool.execute("task_4");

      expect(result.success).toBe(true);
      expect(result.output).toContain("🛑");
      expect(result.output).toContain("killed");
    });

    it("should handle task with no output", async () => {
      mockTasks.set("task_5", {
        id: "task_5",
        status: "running",
        startTime: new Date(),
        stdout: "",
        stderr: "",
      });

      const result = await bashOutputTool.execute("task_5");

      expect(result.success).toBe(true);
      expect(result.output).toContain("No output yet");
    });

    it("should wait for task when wait=true", async () => {
      mockTasks.set("task_6", {
        id: "task_6",
        status: "running",
        startTime: new Date(),
        stdout: "waiting output",
        stderr: "",
      });

      const result = await bashOutputTool.execute("task_6", true);

      expect(result.success).toBe(true);
      expect(result.output).toContain("completed");
    });

    it("should return error when waiting for non-existent task", async () => {
      const result = await bashOutputTool.execute("non_existent", true);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });
  });

  describe("listTasks", () => {
    it("should return empty message when no tasks", () => {
      const result = bashOutputTool.listTasks();

      expect(result.success).toBe(true);
      expect(result.output).toBe("No background tasks");
    });

    it("should list all tasks", () => {
      mockTasks.set("task_a", {
        id: "task_a",
        command: "sleep 10",
        status: "running",
        startTime: new Date(),
      });
      mockTasks.set("task_b", {
        id: "task_b",
        command: "echo done",
        status: "completed",
        exitCode: 0,
        startTime: new Date(Date.now() - 1000),
        endTime: new Date(),
      });

      const result = bashOutputTool.listTasks();

      expect(result.success).toBe(true);
      expect(result.output).toContain("Background Tasks (2)");
      expect(result.output).toContain("task_a");
      expect(result.output).toContain("task_b");
      expect(result.output).toContain("sleep 10");
      expect(result.output).toContain("echo done");
    });

    it("should truncate long commands", () => {
      mockTasks.set("task_long", {
        id: "task_long",
        command: "a".repeat(100),
        status: "running",
        startTime: new Date(),
      });

      const result = bashOutputTool.listTasks();

      expect(result.success).toBe(true);
      expect(result.output).toContain("...");
    });
  });

  describe("killTask", () => {
    it("should return error for missing task ID", () => {
      const result = bashOutputTool.killTask("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Task ID is required");
    });

    it("should kill running task", () => {
      mockTasks.set("task_kill", {
        id: "task_kill",
        status: "running",
        startTime: new Date(),
      });

      const result = bashOutputTool.killTask("task_kill");

      expect(result.success).toBe(true);
      expect(result.output).toContain("has been killed");
    });

    it("should return error for non-existent task", () => {
      const result = bashOutputTool.killTask("non_existent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not kill task");
    });

    it("should return error for already completed task", () => {
      mockTasks.set("task_done", {
        id: "task_done",
        status: "completed",
        startTime: new Date(),
      });

      const result = bashOutputTool.killTask("task_done");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not kill task");
    });
  });
});
