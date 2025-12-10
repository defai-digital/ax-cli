/**
 * Tests for TaskPlanner
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  TaskPlanner,
  getTaskPlanner,
  resetTaskPlanner,
} from "../../packages/core/src/planner/task-planner.js";
import {
  createPhase,
  createPlan,
  RiskLevel,
  FallbackStrategy,
  PhaseStatus,
  PlanStatus,
  TaskPhase,
  TaskPlan,
  PhaseResult,
} from "../../packages/core/src/planner/types.js";

// Mock the storage module
vi.mock("../../src/planner/plan-storage.js", () => ({
  getPlanStorage: vi.fn(() => ({
    savePlan: vi.fn().mockResolvedValue(undefined),
    loadPlan: vi.fn().mockResolvedValue(null),
    saveState: vi.fn().mockResolvedValue(undefined),
    loadState: vi.fn().mockResolvedValue(null),
    listPlans: vi.fn().mockResolvedValue([]),
    listResumablePlans: vi.fn().mockResolvedValue([]),
  })),
  PlanStorage: vi.fn(),
}));

describe("TaskPlanner", () => {
  let planner: TaskPlanner;

  beforeEach(() => {
    resetTaskPlanner();
    planner = new TaskPlanner();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create planner with default options", () => {
      const p = new TaskPlanner();
      expect(p).toBeDefined();
      expect(p.isCurrentlyExecuting()).toBe(false);
      expect(p.isCurrentlyPaused()).toBe(false);
    });

    it("should accept custom options", () => {
      const p = new TaskPlanner({
        maxPhases: 5,
        autoPlanThreshold: 10,
      });
      expect(p).toBeDefined();
    });
  });

  describe("shouldCreatePlan", () => {
    it("should delegate to generator", () => {
      // Simple requests should not trigger planning
      expect(planner.shouldCreatePlan("read a file")).toBe(false);
      // Complex requests should trigger planning
      expect(
        planner.shouldCreatePlan(
          "implement a complete authentication system with OAuth"
        )
      ).toBe(true);
    });
  });

  describe("createPlan", () => {
    it("should save and emit plan:created event", async () => {
      const eventSpy = vi.fn();
      planner.on("plan:created", eventSpy);

      const phase = createPhase({
        id: "phase_1",
        index: 0,
        name: "Test Phase",
        description: "Test",
      });

      const plan = createPlan({
        id: "plan_test",
        originalPrompt: "Test",
        phases: [phase],
      });

      const result = await planner.createPlan(plan);

      expect(result).toBe(plan);
      expect(eventSpy).toHaveBeenCalledWith(plan);
      expect(planner.getCurrentPlan()).toBe(plan);
    });
  });

  describe("executePlan", () => {
    const createTestPlan = (): TaskPlan => {
      const phases = [
        createPhase({
          id: "phase_1",
          index: 0,
          name: "Phase 1",
          description: "First phase",
        }),
        createPhase({
          id: "phase_2",
          index: 1,
          name: "Phase 2",
          description: "Second phase",
          dependencies: ["phase_1"],
        }),
      ];

      return createPlan({
        id: "plan_test",
        originalPrompt: "Test execution",
        phases,
      });
    };

    it("should execute all phases successfully", async () => {
      const plan = createTestPlan();

      const phaseExecutor = vi.fn().mockImplementation(
        async (phase: TaskPhase): Promise<PhaseResult> => ({
          phaseId: phase.id,
          success: true,
          output: `Completed ${phase.name}`,
          duration: 100,
          tokensUsed: 500,
          filesModified: [],
          wasRetry: false,
          retryAttempt: 0,
        })
      );

      const result = await planner.executePlan(plan, phaseExecutor);

      expect(result.success).toBe(true);
      expect(result.phaseResults).toHaveLength(2);
      expect(phaseExecutor).toHaveBeenCalledTimes(2);
    });

    it("should emit events during execution", async () => {
      const plan = createTestPlan();

      const events: string[] = [];
      planner.on("plan:started", () => events.push("plan:started"));
      planner.on("plan:completed", () => events.push("plan:completed"));
      planner.on("phase:started", () => events.push("phase:started"));
      planner.on("phase:completed", () => events.push("phase:completed"));
      planner.on("batch:started", () => events.push("batch:started"));
      planner.on("batch:completed", () => events.push("batch:completed"));

      const phaseExecutor = vi.fn().mockResolvedValue({
        phaseId: "test",
        success: true,
        duration: 100,
        tokensUsed: 500,
        filesModified: [],
        wasRetry: false,
        retryAttempt: 0,
      });

      await planner.executePlan(plan, phaseExecutor);

      expect(events).toContain("plan:started");
      expect(events).toContain("plan:completed");
      expect(events).toContain("phase:started");
      expect(events).toContain("phase:completed");
    });

    it("should handle phase failures", async () => {
      const plan = createTestPlan();

      const phaseExecutor = vi.fn().mockImplementation(
        async (phase: TaskPhase): Promise<PhaseResult> => {
          if (phase.id === "phase_1") {
            return {
              phaseId: phase.id,
              success: false,
              error: "Phase failed",
              duration: 100,
              tokensUsed: 100,
              filesModified: [],
              wasRetry: false,
              retryAttempt: 0,
            };
          }
          return {
            phaseId: phase.id,
            success: true,
            duration: 100,
            tokensUsed: 500,
            filesModified: [],
            wasRetry: false,
            retryAttempt: 0,
          };
        }
      );

      // Change fallback strategy to skip to avoid throwing
      plan.phases[0].fallbackStrategy = FallbackStrategy.SKIP;

      const result = await planner.executePlan(plan, phaseExecutor);

      expect(result.success).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should abort on high risk phase failure", async () => {
      const phases = [
        createPhase({
          id: "phase_1",
          index: 0,
          name: "Critical Phase",
          description: "Critical",
          riskLevel: RiskLevel.HIGH,
          fallbackStrategy: FallbackStrategy.ABORT,
        }),
      ];

      const plan = createPlan({
        id: "plan_test",
        originalPrompt: "Test",
        phases,
      });

      const phaseExecutor = vi.fn().mockResolvedValue({
        phaseId: "phase_1",
        success: false,
        error: "Critical failure",
        duration: 100,
        tokensUsed: 100,
        filesModified: [],
        wasRetry: false,
        retryAttempt: 0,
      });

      await expect(planner.executePlan(plan, phaseExecutor)).rejects.toThrow(
        "Critical failure"
      );
    });

    it("should call execution callbacks", async () => {
      const plan = createTestPlan();

      const onPhaseStart = vi.fn();
      const onPhaseComplete = vi.fn();

      const phaseExecutor = vi.fn().mockResolvedValue({
        phaseId: "test",
        success: true,
        duration: 100,
        tokensUsed: 500,
        filesModified: [],
        wasRetry: false,
        retryAttempt: 0,
      });

      await planner.executePlan(plan, phaseExecutor, {
        onPhaseStart,
        onPhaseComplete,
      });

      expect(onPhaseStart).toHaveBeenCalledTimes(2);
      expect(onPhaseComplete).toHaveBeenCalledTimes(2);
    });

    it("should handle approval requests", async () => {
      const phase = createPhase({
        id: "phase_1",
        index: 0,
        name: "Approval Required",
        description: "Needs approval",
        requiresApproval: true,
        riskLevel: RiskLevel.HIGH,
      });

      const plan = createPlan({
        id: "plan_test",
        originalPrompt: "Test",
        phases: [phase],
      });

      const onApprovalRequest = vi.fn().mockResolvedValue(true);

      const phaseExecutor = vi.fn().mockResolvedValue({
        phaseId: "phase_1",
        success: true,
        duration: 100,
        tokensUsed: 500,
        filesModified: [],
        wasRetry: false,
        retryAttempt: 0,
      });

      await planner.executePlan(plan, phaseExecutor, {
        onApprovalRequest,
      });

      expect(onApprovalRequest).toHaveBeenCalled();
    });

    it("should skip phase when approval denied", async () => {
      const phase = createPhase({
        id: "phase_1",
        index: 0,
        name: "Approval Required",
        description: "Needs approval",
        requiresApproval: true,
        riskLevel: RiskLevel.HIGH,
        fallbackStrategy: FallbackStrategy.SKIP, // Use SKIP to avoid abort
      });

      const plan = createPlan({
        id: "plan_test",
        originalPrompt: "Test",
        phases: [phase],
      });

      const onApprovalRequest = vi.fn().mockResolvedValue(false); // Deny

      const phaseExecutor = vi.fn().mockResolvedValue({
        phaseId: "phase_1",
        success: true,
        duration: 100,
        tokensUsed: 500,
        filesModified: [],
        wasRetry: false,
        retryAttempt: 0,
      });

      const result = await planner.executePlan(plan, phaseExecutor, {
        onApprovalRequest,
      });

      // Executor should not be called for skipped phase
      expect(phaseExecutor).not.toHaveBeenCalled();
      expect(result.phaseResults[0].error).toBe("User declined approval");
    });

    it("should auto-approve low risk phases when configured", async () => {
      const phase = createPhase({
        id: "phase_1",
        index: 0,
        name: "Low Risk",
        description: "Low risk phase",
        requiresApproval: true,
        riskLevel: RiskLevel.LOW,
      });

      const plan = createPlan({
        id: "plan_test",
        originalPrompt: "Test",
        phases: [phase],
      });

      const onApprovalRequest = vi.fn();

      const phaseExecutor = vi.fn().mockResolvedValue({
        phaseId: "phase_1",
        success: true,
        duration: 100,
        tokensUsed: 500,
        filesModified: [],
        wasRetry: false,
        retryAttempt: 0,
      });

      await planner.executePlan(plan, phaseExecutor, {
        autoApproveLowRisk: true,
        onApprovalRequest,
      });

      // Should not ask for approval
      expect(onApprovalRequest).not.toHaveBeenCalled();
      expect(phaseExecutor).toHaveBeenCalled();
    });
  });

  describe("parallel execution", () => {
    it("should execute independent phases in parallel", async () => {
      const phases = [
        createPhase({
          id: "phase_1",
          index: 0,
          name: "Phase 1",
          description: "Independent",
          canRunInParallel: true,
        }),
        createPhase({
          id: "phase_2",
          index: 1,
          name: "Phase 2",
          description: "Independent",
          canRunInParallel: true,
        }),
      ];

      const plan = createPlan({
        id: "plan_test",
        originalPrompt: "Test",
        phases,
      });

      const executionOrder: string[] = [];

      const phaseExecutor = vi.fn().mockImplementation(
        async (phase: TaskPhase): Promise<PhaseResult> => {
          executionOrder.push(`start-${phase.id}`);
          await new Promise((r) => setTimeout(r, 10));
          executionOrder.push(`end-${phase.id}`);
          return {
            phaseId: phase.id,
            success: true,
            duration: 100,
            tokensUsed: 500,
            filesModified: [],
            wasRetry: false,
            retryAttempt: 0,
          };
        }
      );

      await planner.executePlan(plan, phaseExecutor);

      // Both should start before either ends (parallel)
      expect(executionOrder[0]).toMatch(/^start-/);
      expect(executionOrder[1]).toMatch(/^start-/);
    });
  });

  describe("pausePlan", () => {
    it("should pause execution", async () => {
      const phases = Array.from({ length: 5 }, (_, i) =>
        createPhase({
          id: `phase_${i + 1}`,
          index: i,
          name: `Phase ${i + 1}`,
          description: `Phase ${i + 1}`,
          dependencies: i > 0 ? [`phase_${i}`] : [],
        })
      );

      const plan = createPlan({
        id: "plan_test",
        originalPrompt: "Long task",
        phases,
      });

      let phaseCount = 0;
      const phaseExecutor = vi.fn().mockImplementation(
        async (phase: TaskPhase): Promise<PhaseResult> => {
          phaseCount++;
          if (phaseCount === 2) {
            // Pause after 2nd phase
            await planner.pausePlan();
          }
          return {
            phaseId: phase.id,
            success: true,
            duration: 100,
            tokensUsed: 500,
            filesModified: [],
            wasRetry: false,
            retryAttempt: 0,
          };
        }
      );

      const pausedSpy = vi.fn();
      planner.on("plan:paused", pausedSpy);

      const result = await planner.executePlan(plan, phaseExecutor);

      expect(result.phaseResults.length).toBeLessThan(5);
      expect(planner.isCurrentlyPaused()).toBe(true);
    });
  });

  describe("skipPhase", () => {
    it("should return false for non-existent plan (loadPlan returns null)", async () => {
      // Mock returns null by default
      const result = await planner.skipPhase("non_existent", "phase_1");
      expect(result).toBe(false);
    });
  });

  describe("abandonPlan", () => {
    it("should return false for non-existent plan (loadPlan returns null)", async () => {
      // Mock returns null by default
      const result = await planner.abandonPlan("non_existent");
      expect(result).toBe(false);
    });
  });

  describe("getExecutionBatches", () => {
    it("should return batches for a plan", () => {
      const phases = [
        createPhase({
          id: "phase_1",
          index: 0,
          name: "Phase 1",
          description: "First",
        }),
        createPhase({
          id: "phase_2",
          index: 1,
          name: "Phase 2",
          description: "Second",
          dependencies: ["phase_1"],
        }),
      ];

      const plan = createPlan({
        id: "plan_test",
        originalPrompt: "Test",
        phases,
      });

      const batches = planner.getExecutionBatches(plan);

      expect(batches.length).toBeGreaterThan(0);
    });
  });

  describe("getCurrentPlan", () => {
    it("should return null initially", () => {
      expect(planner.getCurrentPlan()).toBeNull();
    });

    it("should return current plan after creation", async () => {
      const plan = createPlan({
        id: "plan_test",
        originalPrompt: "Test",
        phases: [],
      });

      await planner.createPlan(plan);

      expect(planner.getCurrentPlan()).toBe(plan);
    });
  });

  describe("isCurrentlyExecuting", () => {
    it("should return false when not executing", () => {
      expect(planner.isCurrentlyExecuting()).toBe(false);
    });
  });

  describe("isCurrentlyPaused", () => {
    it("should return false when not paused", () => {
      expect(planner.isCurrentlyPaused()).toBe(false);
    });
  });

  describe("getTaskPlanner (singleton)", () => {
    it("should return same instance", () => {
      resetTaskPlanner();
      const p1 = getTaskPlanner();
      const p2 = getTaskPlanner();
      expect(p1).toBe(p2);
    });
  });

  describe("resetTaskPlanner", () => {
    it("should reset the singleton", () => {
      const p1 = getTaskPlanner();
      resetTaskPlanner();
      const p2 = getTaskPlanner();
      expect(p1).not.toBe(p2);
    });
  });
});
