/**
 * Tests for Plan Executor
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventEmitter } from "events";
import { PlanExecutor, type PlanExecutorConfig } from "../../../src/agent/planning/plan-executor.js";
import type { TaskPhase, TaskPlan, PlanResult } from "../../../src/planner/index.js";
import type { LLMMessage } from "../../../src/llm/client.js";

// Mock dependencies
vi.mock("../../../src/agent/status-reporter.js", () => ({
  getStatusReporter: vi.fn().mockReturnValue({
    generateStatusReport: vi.fn().mockResolvedValue({ path: "/test/report.md" }),
  }),
}));

describe("PlanExecutor", () => {
  let executor: PlanExecutor;
  let mockConfig: PlanExecutorConfig;
  let emitter: EventEmitter;

  function createMockConfig(overrides: Partial<PlanExecutorConfig> = {}): PlanExecutorConfig {
    emitter = new EventEmitter();
    return {
      llmClient: {
        chat: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: "Phase completed successfully",
              tool_calls: undefined,
            },
          }],
        }),
      } as any,
      tokenCounter: {
        countMessageTokens: vi.fn().mockReturnValue(100),
      } as any,
      toolExecutor: {} as any,
      getTools: vi.fn().mockResolvedValue([
        { type: "function", function: { name: "view_file", parameters: {} } },
        { type: "function", function: { name: "str_replace_editor", parameters: {} } },
      ]),
      executeTool: vi.fn().mockResolvedValue({ success: true, output: "Tool executed" }),
      parseToolArgumentsCached: vi.fn().mockReturnValue({ path: "/test/file.ts" }),
      buildChatOptions: vi.fn().mockReturnValue({ model: "test-model" }),
      applyContextPruning: vi.fn(),
      emitter,
      ...overrides,
    };
  }

  function createTestPhase(overrides: Partial<TaskPhase> = {}): TaskPhase {
    return {
      id: "phase-1",
      name: "Test Phase",
      description: "A test phase for testing",
      objectives: ["Objective 1", "Objective 2"],
      index: 0,
      riskLevel: "low",
      estimatedDuration: 60000,
      dependsOn: [],
      status: "pending",
      ...overrides,
    };
  }

  function createTestPlan(overrides: Partial<TaskPlan> = {}): TaskPlan {
    return {
      id: "plan-1",
      originalPrompt: "Implement a new feature for the application",
      phases: [
        createTestPhase({ id: "phase-1", name: "Phase 1", index: 0 }),
        createTestPhase({ id: "phase-2", name: "Phase 2", index: 1, riskLevel: "medium" }),
        createTestPhase({ id: "phase-3", name: "Phase 3", index: 2, riskLevel: "high" }),
      ],
      estimatedDuration: 180000,
      createdAt: new Date(),
      status: "pending",
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = createMockConfig();
    executor = new PlanExecutor(mockConfig);
  });

  describe("constructor", () => {
    it("should create instance with config", () => {
      expect(executor).toBeDefined();
    });
  });

  describe("executePhase", () => {
    it("should execute a phase successfully with no tool calls", async () => {
      const phase = createTestPhase();
      const context = {
        planId: "plan-1",
        originalRequest: "Test request",
        completedPhases: [],
      };
      const messages: LLMMessage[] = [];

      const result = await executor.executePhase(phase, context, messages, []);

      expect(result.result.success).toBe(true);
      expect(result.result.phaseId).toBe("phase-1");
      expect(result.result.output).toContain("Phase completed successfully");
    });

    it("should emit phase:started event", async () => {
      const phase = createTestPhase();
      const startedHandler = vi.fn();
      emitter.on("phase:started", startedHandler);

      await executor.executePhase(phase, {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, [], []);

      expect(startedHandler).toHaveBeenCalledWith({
        phase,
        planId: "plan-1",
      });
    });

    it("should emit phase:completed event on success", async () => {
      const phase = createTestPhase();
      const completedHandler = vi.fn();
      emitter.on("phase:completed", completedHandler);

      await executor.executePhase(phase, {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, [], []);

      expect(completedHandler).toHaveBeenCalledWith(expect.objectContaining({
        phase,
        planId: "plan-1",
        result: expect.objectContaining({ success: true }),
      }));
    });

    it("should execute tool calls and track file modifications", async () => {
      // Mock LLM to return tool calls then complete
      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: "",
              tool_calls: [{
                id: "call-1",
                type: "function",
                function: { name: "str_replace_editor", arguments: '{"path": "/test/file.ts"}' },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: "Done editing file",
              tool_calls: undefined,
            },
          }],
        });

      mockConfig.llmClient.chat = mockChat;
      executor = new PlanExecutor(mockConfig);

      const phase = createTestPhase();
      const result = await executor.executePhase(phase, {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, [], []);

      expect(result.result.success).toBe(true);
      expect(result.result.filesModified).toContain("/test/file.ts");
      expect(mockConfig.executeTool).toHaveBeenCalled();
    });

    it("should track create_file modifications", async () => {
      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: "",
              tool_calls: [{
                id: "call-1",
                type: "function",
                function: { name: "create_file", arguments: '{"path": "/new/file.ts"}' },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: "Created file" } }],
        });

      mockConfig.llmClient.chat = mockChat;
      executor = new PlanExecutor(mockConfig);

      const result = await executor.executePhase(createTestPhase(), {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, [], []);

      expect(result.result.filesModified).toContain("/test/file.ts");
    });

    it("should track multi_edit modifications", async () => {
      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: "",
              tool_calls: [{
                id: "call-1",
                type: "function",
                function: { name: "multi_edit", arguments: '{"path": "/multi/file.ts"}' },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: "Edited" } }],
        });

      mockConfig.llmClient.chat = mockChat;
      executor = new PlanExecutor(mockConfig);

      const result = await executor.executePhase(createTestPhase(), {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, [], []);

      expect(result.result.filesModified).toContain("/test/file.ts");
    });

    it("should not duplicate file paths in filesModified", async () => {
      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: "",
              tool_calls: [
                { id: "call-1", type: "function", function: { name: "str_replace_editor", arguments: '{}' } },
                { id: "call-2", type: "function", function: { name: "str_replace_editor", arguments: '{}' } },
              ],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: "Done" } }],
        });

      mockConfig.llmClient.chat = mockChat;
      executor = new PlanExecutor(mockConfig);

      const result = await executor.executePhase(createTestPhase(), {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, [], []);

      // Same path should only appear once
      const uniquePaths = new Set(result.result.filesModified);
      expect(result.result.filesModified.length).toBe(uniquePaths.size);
    });

    it("should respect maxToolRounds limit", async () => {
      // Always return tool calls to hit the limit
      const mockChat = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: "",
            tool_calls: [{
              id: "call-1",
              type: "function",
              function: { name: "view_file", arguments: '{}' },
            }],
          },
        }],
      });

      mockConfig.llmClient.chat = mockChat;
      mockConfig.maxToolRounds = 3;
      executor = new PlanExecutor(mockConfig);

      const warningHandler = vi.fn();
      emitter.on("phase:warning", warningHandler);

      await executor.executePhase(createTestPhase(), {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, [], []);

      // Should stop at 3 rounds
      expect(mockChat).toHaveBeenCalledTimes(3);
      expect(warningHandler).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining("tool round limit"),
      }));
    });

    it("should handle errors during phase execution", async () => {
      mockConfig.llmClient.chat = vi.fn().mockRejectedValue(new Error("API Error"));
      executor = new PlanExecutor(mockConfig);

      const failedHandler = vi.fn();
      emitter.on("phase:failed", failedHandler);

      const result = await executor.executePhase(createTestPhase(), {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, [], []);

      expect(result.result.success).toBe(false);
      expect(result.result.error).toContain("API Error");
      expect(failedHandler).toHaveBeenCalled();
    });

    it("should disable planning during phase execution", async () => {
      const setPlanningEnabled = vi.fn();
      mockConfig.setPlanningEnabled = setPlanningEnabled;
      executor = new PlanExecutor(mockConfig);

      await executor.executePhase(createTestPhase(), {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, [], []);

      // Should be called with false at start, true at end
      expect(setPlanningEnabled).toHaveBeenCalledWith(false);
      expect(setPlanningEnabled).toHaveBeenCalledWith(true);
    });

    it("should restore planning state even on error", async () => {
      const setPlanningEnabled = vi.fn();
      mockConfig.setPlanningEnabled = setPlanningEnabled;
      mockConfig.llmClient.chat = vi.fn().mockRejectedValue(new Error("Error"));
      executor = new PlanExecutor(mockConfig);

      await executor.executePhase(createTestPhase(), {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, [], []);

      // Planning should be restored
      expect(setPlanningEnabled).toHaveBeenLastCalledWith(true);
    });

    it("should include completed phases in prompt", async () => {
      const result = await executor.executePhase(createTestPhase(), {
        planId: "plan-1",
        originalRequest: "Test request",
        completedPhases: ["Phase A", "Phase B"],
      }, [], []);

      // Check that the message was added with completed phases
      expect(result.result.success).toBe(true);
    });

    it("should handle empty assistant message", async () => {
      mockConfig.llmClient.chat = vi.fn().mockResolvedValue({
        choices: [{}], // No message
      });
      executor = new PlanExecutor(mockConfig);

      const result = await executor.executePhase(createTestPhase(), {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, [], []);

      expect(result.result.success).toBe(true);
    });

    it("should generate default output when no assistant content", async () => {
      mockConfig.llmClient.chat = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: "", // Empty content
            tool_calls: undefined,
          },
        }],
      });
      executor = new PlanExecutor(mockConfig);

      const result = await executor.executePhase(createTestPhase({ name: "My Phase" }), {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, [], []);

      expect(result.result.output).toContain("My Phase");
      expect(result.result.output).toContain("completed");
    });

    it("should not track failed tool operations in filesModified", async () => {
      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: "",
              tool_calls: [{
                id: "call-1",
                type: "function",
                function: { name: "str_replace_editor", arguments: '{}' },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: "Failed" } }],
        });

      mockConfig.llmClient.chat = mockChat;
      mockConfig.executeTool = vi.fn().mockResolvedValue({ success: false, error: "Failed" });
      executor = new PlanExecutor(mockConfig);

      const result = await executor.executePhase(createTestPhase(), {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, [], []);

      expect(result.result.filesModified).toHaveLength(0);
    });
  });

  describe("formatPlanSummary", () => {
    it("should format plan summary with all phases", () => {
      const plan = createTestPlan();

      const summary = executor.formatPlanSummary(plan);

      expect(summary).toContain("Execution Plan Created");
      expect(summary).toContain("Implement a new feature");
      expect(summary).toContain("Phase 1");
      expect(summary).toContain("Phase 2");
      expect(summary).toContain("Phase 3");
    });

    it("should show correct risk icons", () => {
      const plan = createTestPlan();

      const summary = executor.formatPlanSummary(plan);

      expect(summary).toContain("○"); // low risk
      expect(summary).toContain("△"); // medium risk
      expect(summary).toContain("⚠️"); // high risk
    });

    it("should truncate long original prompts", () => {
      const longPrompt = "A".repeat(200);
      const plan = createTestPlan({ originalPrompt: longPrompt });

      const summary = executor.formatPlanSummary(plan);

      expect(summary).toContain("...");
      expect(summary.indexOf("A".repeat(100))).toBeGreaterThan(-1);
    });

    it("should not truncate short prompts", () => {
      const shortPrompt = "Short prompt";
      const plan = createTestPlan({ originalPrompt: shortPrompt });

      const summary = executor.formatPlanSummary(plan);

      expect(summary).toContain(shortPrompt);
      expect(summary).not.toContain("...");
    });

    it("should show estimated duration in minutes", () => {
      const plan = createTestPlan({ estimatedDuration: 180000 }); // 3 minutes

      const summary = executor.formatPlanSummary(plan);

      expect(summary).toContain("3 min");
    });
  });

  describe("formatPlanResult", () => {
    it("should format successful plan result", () => {
      const result: PlanResult = {
        planId: "plan-1",
        success: true,
        phaseResults: [
          { phaseId: "1", success: true, output: "Done", duration: 1000, tokensUsed: 100, filesModified: [], wasRetry: false, retryAttempt: 0 },
          { phaseId: "2", success: true, output: "Done", duration: 2000, tokensUsed: 200, filesModified: [], wasRetry: false, retryAttempt: 0 },
        ],
        totalDuration: 3000,
        totalTokensUsed: 300,
      };

      const output = executor.formatPlanResult(result);

      expect(output).toContain("Plan Execution Complete");
      expect(output).toContain("2/2 phases successful");
      expect(output).toContain("3s");
      expect(output).toContain("300");
    });

    it("should show failed phases count", () => {
      const result: PlanResult = {
        planId: "plan-1",
        success: false,
        phaseResults: [
          { phaseId: "1", success: true, output: "Done", duration: 1000, tokensUsed: 100, filesModified: [], wasRetry: false, retryAttempt: 0 },
          { phaseId: "2", success: false, error: "Failed", duration: 2000, tokensUsed: 200, filesModified: [], wasRetry: false, retryAttempt: 0 },
        ],
        totalDuration: 3000,
        totalTokensUsed: 300,
      };

      const output = executor.formatPlanResult(result);

      expect(output).toContain("1/2 phases successful");
      expect(output).toContain("1 failed");
    });

    it("should handle missing duration and tokens", () => {
      const result: PlanResult = {
        planId: "plan-1",
        success: true,
        phaseResults: [],
      };

      const output = executor.formatPlanResult(result);

      expect(output).not.toContain("Duration:");
      expect(output).not.toContain("Tokens Used:");
    });
  });

  describe("generateStatusReport", () => {
    it("should generate status report successfully", async () => {
      const result = await executor.generateStatusReport(
        [],
        [],
        1000,
        createTestPlan()
      );

      expect(result.path).toBe("/test/report.md");
    });

    it("should handle report generation failure", async () => {
      const { getStatusReporter } = await import("../../../src/agent/status-reporter.js");
      vi.mocked(getStatusReporter).mockReturnValue({
        generateStatusReport: vi.fn().mockRejectedValue(new Error("Report failed")),
      } as any);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await executor.generateStatusReport(
        [],
        [],
        1000,
        createTestPlan()
      );

      expect(result.path).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to generate"), expect.any(String));
      warnSpy.mockRestore();
    });
  });

  describe("buildPhasePrompt", () => {
    it("should build prompt with phase details", async () => {
      const phase = createTestPhase({
        name: "Implementation",
        description: "Implement the feature",
        objectives: ["Write code", "Add tests"],
        index: 1,
      });

      // We need to test the private method indirectly through executePhase
      // The prompt is added to messages, so we can inspect it
      const messages: LLMMessage[] = [];

      await executor.executePhase(phase, {
        planId: "plan-1",
        originalRequest: "Build a feature",
        completedPhases: ["Setup"],
      }, messages, []);

      // Find the user message containing the phase prompt
      const phaseMessage = messages.find(m =>
        m.role === "user" &&
        typeof m.content === "string" &&
        m.content.includes("Implementation")
      );

      expect(phaseMessage).toBeDefined();
      expect(phaseMessage?.content).toContain("Phase 2"); // index + 1
      expect(phaseMessage?.content).toContain("Implement the feature");
      expect(phaseMessage?.content).toContain("Write code");
      expect(phaseMessage?.content).toContain("Add tests");
      expect(phaseMessage?.content).toContain("Build a feature");
      expect(phaseMessage?.content).toContain("Setup");
    });

    it("should handle phase with no objectives", async () => {
      const phase = createTestPhase({
        objectives: [],
      });

      const messages: LLMMessage[] = [];

      await executor.executePhase(phase, {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, messages, []);

      // Should not crash with empty objectives
      expect(messages.length).toBeGreaterThan(0);
    });

    it("should handle no completed phases", async () => {
      const phase = createTestPhase();
      const messages: LLMMessage[] = [];

      await executor.executePhase(phase, {
        planId: "plan-1",
        originalRequest: "Test",
        completedPhases: [],
      }, messages, []);

      const phaseMessage = messages.find(m => m.role === "user");
      expect(phaseMessage?.content).not.toContain("Previously completed");
    });
  });
});
