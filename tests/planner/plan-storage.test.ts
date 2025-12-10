/**
 * Tests for Plan Storage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  PlanStorage,
  getPlanStorage,
  resetPlanStorage,
} from "../../packages/core/src/planner/plan-storage.js";
import {
  type TaskPlan,
  type TaskPhase,
  RiskLevel,
  FallbackStrategy,
  PhaseStatus,
  PlanStatus,
} from "../../packages/core/src/planner/types.js";

describe("PlanStorage", () => {
  let testDir: string;
  let storage: PlanStorage;

  function createTestPhase(overrides: Partial<TaskPhase> = {}): TaskPhase {
    return {
      id: `phase-${Date.now()}`,
      index: 0,
      name: "Test Phase",
      description: "A test phase",
      objectives: ["Objective 1"],
      toolsRequired: ["bash"],
      dependencies: [],
      canRunInParallel: false,
      riskLevel: RiskLevel.LOW,
      requiresApproval: false,
      fallbackStrategy: FallbackStrategy.ABORT,
      maxRetries: 3,
      status: PhaseStatus.PENDING,
      retryCount: 0,
      ...overrides,
    };
  }

  function createTestPlan(overrides: Partial<TaskPlan> = {}): TaskPlan {
    return {
      id: `plan-${Date.now()}`,
      version: 1,
      originalPrompt: "Test task",
      reasoning: "Test reasoning",
      complexity: "moderate" as const,
      phases: [createTestPhase()],
      currentPhaseIndex: -1,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: PlanStatus.CREATED,
      estimatedTotalTokens: 1000,
      estimatedDuration: 120000,
      totalTokensUsed: 0,
      actualDuration: 0,
      phasesCompleted: 0,
      phasesFailed: 0,
      phasesSkipped: 0,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetPlanStorage();
    testDir = path.join(process.cwd(), `.test-plan-storage-${Date.now()}`);
    storage = new PlanStorage(testDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    resetPlanStorage();
  });

  describe("constructor", () => {
    it("should create storage with custom directory", () => {
      expect(fs.existsSync(testDir)).toBe(true);
    });

    it("should create default directory if none provided", () => {
      const defaultStorage = new PlanStorage();
      expect(defaultStorage).toBeDefined();
    });
  });

  describe("savePlan", () => {
    it("should save a plan to disk", async () => {
      const plan = createTestPlan();

      const planDir = await storage.savePlan(plan);

      expect(fs.existsSync(planDir)).toBe(true);
      expect(fs.existsSync(path.join(planDir, "plan.json"))).toBe(true);
    });

    it("should update the updatedAt timestamp", async () => {
      const plan = createTestPlan();
      const originalUpdatedAt = plan.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      await storage.savePlan(plan);

      expect(plan.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it("should serialize dates as ISO strings", async () => {
      const plan = createTestPlan();

      const planDir = await storage.savePlan(plan);

      const content = fs.readFileSync(path.join(planDir, "plan.json"), "utf-8");
      const parsed = JSON.parse(content);

      expect(typeof parsed.createdAt).toBe("string");
      expect(typeof parsed.updatedAt).toBe("string");
    });
  });

  describe("loadPlan", () => {
    it("should load a saved plan", async () => {
      const plan = createTestPlan();
      await storage.savePlan(plan);

      const loaded = await storage.loadPlan(plan.id);

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(plan.id);
      expect(loaded?.originalPrompt).toBe(plan.originalPrompt);
    });

    it("should return null for non-existent plan", async () => {
      const loaded = await storage.loadPlan("non-existent-id");
      expect(loaded).toBeNull();
    });

    it("should deserialize dates correctly", async () => {
      const plan = createTestPlan();
      await storage.savePlan(plan);

      const loaded = await storage.loadPlan(plan.id);

      expect(loaded?.createdAt).toBeInstanceOf(Date);
      expect(loaded?.updatedAt).toBeInstanceOf(Date);
    });

    it("should handle invalid JSON gracefully", async () => {
      const planId = "invalid-plan";
      const planDir = path.join(testDir, planId);
      fs.mkdirSync(planDir, { recursive: true });
      fs.writeFileSync(path.join(planDir, "plan.json"), "invalid json");

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const loaded = await storage.loadPlan(planId);

      expect(loaded).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("should handle invalid plan schema gracefully", async () => {
      const planId = "invalid-schema";
      const planDir = path.join(testDir, planId);
      fs.mkdirSync(planDir, { recursive: true });
      fs.writeFileSync(path.join(planDir, "plan.json"), JSON.stringify({ invalid: true }));

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const loaded = await storage.loadPlan(planId);

      expect(loaded).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("should handle invalid date strings with fallback", async () => {
      const planId = "invalid-dates";
      const planDir = path.join(testDir, planId);
      fs.mkdirSync(planDir, { recursive: true });

      const invalidPlan = {
        id: planId,
        version: 1,
        originalPrompt: "Test",
        reasoning: "Test reasoning",
        complexity: "moderate",
        phases: [],
        currentPhaseIndex: -1,
        status: PlanStatus.CREATED,
        createdAt: "not-a-date",
        updatedAt: "also-not-a-date",
        estimatedTotalTokens: 1000,
        estimatedDuration: 1000,
        totalTokensUsed: 0,
        actualDuration: 0,
        phasesCompleted: 0,
        phasesFailed: 0,
        phasesSkipped: 0,
      };

      fs.writeFileSync(path.join(planDir, "plan.json"), JSON.stringify(invalidPlan));

      const loaded = await storage.loadPlan(planId);

      // Should use fallback dates
      expect(loaded?.createdAt).toBeInstanceOf(Date);
      expect(loaded?.createdAt.getTime()).not.toBeNaN();
    });
  });

  describe("saveState", () => {
    it("should save plan state", async () => {
      const plan = createTestPlan();

      await storage.saveState(plan, "paused");

      const stateFile = path.join(testDir, plan.id, "state.json");
      expect(fs.existsSync(stateFile)).toBe(true);
    });

    it("should save state with context", async () => {
      const plan = createTestPlan();

      await storage.saveState(plan, "checkpoint", {
        conversationContext: [{ role: "user", content: "test" }],
        trackedFiles: [{ path: "/test.ts", hash: "abc123" }],
      });

      const stateFile = path.join(testDir, plan.id, "state.json");
      const content = JSON.parse(fs.readFileSync(stateFile, "utf-8"));

      expect(content.conversationContext).toHaveLength(1);
      expect(content.trackedFiles).toHaveLength(1);
    });

    it("should also update the plan file", async () => {
      const plan = createTestPlan();

      await storage.saveState(plan, "paused");

      const planFile = path.join(testDir, plan.id, "plan.json");
      expect(fs.existsSync(planFile)).toBe(true);
    });
  });

  describe("loadState", () => {
    it("should load saved state", async () => {
      const plan = createTestPlan();
      await storage.saveState(plan, "paused");

      const loaded = await storage.loadState(plan.id);

      expect(loaded).not.toBeNull();
      expect(loaded?.saveReason).toBe("paused");
      expect(loaded?.plan.id).toBe(plan.id);
    });

    it("should return null for non-existent state", async () => {
      const loaded = await storage.loadState("non-existent");
      expect(loaded).toBeNull();
    });

    it("should handle invalid state JSON gracefully", async () => {
      const planId = "invalid-state";
      const planDir = path.join(testDir, planId);
      fs.mkdirSync(planDir, { recursive: true });
      fs.writeFileSync(path.join(planDir, "state.json"), "invalid");

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const loaded = await storage.loadState(planId);

      expect(loaded).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("should deserialize savedAt date correctly", async () => {
      const plan = createTestPlan();
      await storage.saveState(plan, "paused");

      const loaded = await storage.loadState(plan.id);

      expect(loaded?.savedAt).toBeInstanceOf(Date);
    });
  });

  describe("listPlans", () => {
    it("should return empty array when no plans", async () => {
      const plans = await storage.listPlans();
      expect(plans).toEqual([]);
    });

    it("should list all saved plans", async () => {
      const plan1 = createTestPlan({ id: "plan-1", originalPrompt: "Task 1" });
      const plan2 = createTestPlan({ id: "plan-2", originalPrompt: "Task 2" });

      await storage.savePlan(plan1);
      await storage.savePlan(plan2);

      const plans = await storage.listPlans();

      expect(plans).toHaveLength(2);
    });

    it("should sort by updatedAt descending", async () => {
      const plan1 = createTestPlan({ id: "plan-old" });
      const plan2 = createTestPlan({ id: "plan-new" });

      await storage.savePlan(plan1);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await storage.savePlan(plan2);

      const plans = await storage.listPlans();

      expect(plans[0].id).toBe("plan-new");
      expect(plans[1].id).toBe("plan-old");
    });

    it("should include correct summary information", async () => {
      const plan = createTestPlan({
        id: "summary-test",
        originalPrompt: "Test prompt",
        status: PlanStatus.EXECUTING,
        phases: [createTestPhase(), createTestPhase({ index: 1 })],
        phasesCompleted: 1,
      });

      await storage.savePlan(plan);

      const plans = await storage.listPlans();
      const summary = plans[0];

      expect(summary.originalPrompt).toBe("Test prompt");
      expect(summary.status).toBe(PlanStatus.EXECUTING);
      expect(summary.totalPhases).toBe(2);
      expect(summary.completedPhases).toBe(1);
    });

    it("should skip non-directory entries", async () => {
      const plan = createTestPlan();
      await storage.savePlan(plan);

      // Create a file in the plans directory
      fs.writeFileSync(path.join(testDir, "some-file.txt"), "content");

      const plans = await storage.listPlans();

      expect(plans).toHaveLength(1);
    });
  });

  describe("listResumablePlans", () => {
    it("should only return resumable plans", async () => {
      const pausedPlan = createTestPlan({ id: "paused", status: PlanStatus.PAUSED });
      const failedPlan = createTestPlan({ id: "failed", status: PlanStatus.FAILED });
      const completedPlan = createTestPlan({ id: "completed", status: PlanStatus.COMPLETED });
      const createdPlan = createTestPlan({ id: "created", status: PlanStatus.CREATED });
      const approvedPlan = createTestPlan({ id: "approved", status: PlanStatus.APPROVED });

      await storage.savePlan(pausedPlan);
      await storage.savePlan(failedPlan);
      await storage.savePlan(completedPlan);
      await storage.savePlan(createdPlan);
      await storage.savePlan(approvedPlan);

      const resumable = await storage.listResumablePlans();

      expect(resumable).toHaveLength(4);
      expect(resumable.find((p) => p.id === "completed")).toBeUndefined();
    });
  });

  describe("deletePlan", () => {
    it("should delete a plan", async () => {
      const plan = createTestPlan();
      await storage.savePlan(plan);

      const deleted = await storage.deletePlan(plan.id);

      expect(deleted).toBe(true);
      expect(storage.planExists(plan.id)).toBe(false);
    });

    it("should return false for non-existent plan", async () => {
      const deleted = await storage.deletePlan("non-existent");
      expect(deleted).toBe(false);
    });

    it("should handle delete errors gracefully", async () => {
      const plan = createTestPlan();
      await storage.savePlan(plan);

      // Make directory read-only to cause error (skip on Windows)
      if (process.platform !== "win32") {
        const planDir = path.join(testDir, plan.id);
        fs.chmodSync(planDir, 0o444);

        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const deleted = await storage.deletePlan(plan.id);

        // Restore permissions
        fs.chmodSync(planDir, 0o755);

        expect(deleted).toBe(false);
        errorSpy.mockRestore();
      }
    });
  });

  describe("cleanupOldPlans", () => {
    it("should delete old completed plans", async () => {
      const oldPlan = createTestPlan({
        id: "old-completed",
        status: PlanStatus.COMPLETED,
      });

      await storage.savePlan(oldPlan);

      // Manually set old date
      const planFile = path.join(testDir, oldPlan.id, "plan.json");
      const content = JSON.parse(fs.readFileSync(planFile, "utf-8"));
      content.updatedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(); // 40 days ago
      fs.writeFileSync(planFile, JSON.stringify(content));

      const deleted = await storage.cleanupOldPlans(30);

      expect(deleted).toBe(1);
    });

    it("should delete old abandoned plans", async () => {
      const oldPlan = createTestPlan({
        id: "old-abandoned",
        status: PlanStatus.ABANDONED,
      });

      await storage.savePlan(oldPlan);

      // Manually set old date
      const planFile = path.join(testDir, oldPlan.id, "plan.json");
      const content = JSON.parse(fs.readFileSync(planFile, "utf-8"));
      content.updatedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(planFile, JSON.stringify(content));

      const deleted = await storage.cleanupOldPlans(30);

      expect(deleted).toBe(1);
    });

    it("should not delete recent plans", async () => {
      const recentPlan = createTestPlan({
        id: "recent-completed",
        status: PlanStatus.COMPLETED,
      });

      await storage.savePlan(recentPlan);

      const deleted = await storage.cleanupOldPlans(30);

      expect(deleted).toBe(0);
    });

    it("should not delete non-completed/abandoned plans", async () => {
      const pausedPlan = createTestPlan({
        id: "old-paused",
        status: PlanStatus.PAUSED,
      });

      await storage.savePlan(pausedPlan);

      // Manually set old date
      const planFile = path.join(testDir, pausedPlan.id, "plan.json");
      const content = JSON.parse(fs.readFileSync(planFile, "utf-8"));
      content.updatedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(planFile, JSON.stringify(content));

      const deleted = await storage.cleanupOldPlans(30);

      expect(deleted).toBe(0);
    });
  });

  describe("cleanupStalePlans", () => {
    it("should mark stale non-terminal plans as abandoned", async () => {
      const stalePlan = createTestPlan({
        id: "stale-paused",
        status: PlanStatus.PAUSED,
      });

      await storage.savePlan(stalePlan);

      // Manually set old date (2 days ago)
      const planFile = path.join(testDir, stalePlan.id, "plan.json");
      const content = JSON.parse(fs.readFileSync(planFile, "utf-8"));
      content.updatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(planFile, JSON.stringify(content));

      const cleaned = await storage.cleanupStalePlans(1, false);

      expect(cleaned).toBe(1);

      // Verify plan was marked as abandoned
      const loaded = await storage.loadPlan(stalePlan.id);
      expect(loaded?.status).toBe(PlanStatus.ABANDONED);
    });

    it("should delete stale plans when force is true", async () => {
      const stalePlan = createTestPlan({
        id: "stale-created",
        status: PlanStatus.CREATED,
      });

      await storage.savePlan(stalePlan);

      // Manually set old date (2 days ago)
      const planFile = path.join(testDir, stalePlan.id, "plan.json");
      const content = JSON.parse(fs.readFileSync(planFile, "utf-8"));
      content.updatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(planFile, JSON.stringify(content));

      const cleaned = await storage.cleanupStalePlans(1, true);

      expect(cleaned).toBe(1);
      expect(storage.planExists(stalePlan.id)).toBe(false);
    });

    it("should not cleanup completed plans", async () => {
      const completedPlan = createTestPlan({
        id: "old-completed",
        status: PlanStatus.COMPLETED,
      });

      await storage.savePlan(completedPlan);

      // Manually set old date
      const planFile = path.join(testDir, completedPlan.id, "plan.json");
      const content = JSON.parse(fs.readFileSync(planFile, "utf-8"));
      content.updatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(planFile, JSON.stringify(content));

      const cleaned = await storage.cleanupStalePlans(1, true);

      expect(cleaned).toBe(0);
    });

    it("should not cleanup abandoned plans", async () => {
      const abandonedPlan = createTestPlan({
        id: "old-abandoned",
        status: PlanStatus.ABANDONED,
      });

      await storage.savePlan(abandonedPlan);

      // Manually set old date
      const planFile = path.join(testDir, abandonedPlan.id, "plan.json");
      const content = JSON.parse(fs.readFileSync(planFile, "utf-8"));
      content.updatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(planFile, JSON.stringify(content));

      const cleaned = await storage.cleanupStalePlans(1, true);

      expect(cleaned).toBe(0);
    });

    it("should not cleanup recent non-terminal plans", async () => {
      const recentPlan = createTestPlan({
        id: "recent-paused",
        status: PlanStatus.PAUSED,
      });

      await storage.savePlan(recentPlan);

      const cleaned = await storage.cleanupStalePlans(1, true);

      expect(cleaned).toBe(0);
    });

    it("should cleanup all stale statuses", async () => {
      const statuses = [
        { id: "stale-created", status: PlanStatus.CREATED },
        { id: "stale-approved", status: PlanStatus.APPROVED },
        { id: "stale-executing", status: PlanStatus.EXECUTING },
        { id: "stale-paused", status: PlanStatus.PAUSED },
        { id: "stale-failed", status: PlanStatus.FAILED },
      ];

      for (const { id, status } of statuses) {
        const plan = createTestPlan({ id, status });
        await storage.savePlan(plan);

        // Manually set old date (2 days ago)
        const planFile = path.join(testDir, id, "plan.json");
        const content = JSON.parse(fs.readFileSync(planFile, "utf-8"));
        content.updatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        fs.writeFileSync(planFile, JSON.stringify(content));
      }

      const cleaned = await storage.cleanupStalePlans(1, true);

      expect(cleaned).toBe(5);
    });
  });

  describe("listStalePlans", () => {
    it("should list stale non-terminal plans", async () => {
      const stalePlan = createTestPlan({
        id: "stale-plan",
        status: PlanStatus.PAUSED,
      });

      await storage.savePlan(stalePlan);

      // Manually set old date (2 days ago)
      const planFile = path.join(testDir, stalePlan.id, "plan.json");
      const content = JSON.parse(fs.readFileSync(planFile, "utf-8"));
      content.updatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(planFile, JSON.stringify(content));

      const stale = await storage.listStalePlans(1);

      expect(stale).toHaveLength(1);
      expect(stale[0].id).toBe("stale-plan");
    });

    it("should not list recent plans", async () => {
      const recentPlan = createTestPlan({
        id: "recent-plan",
        status: PlanStatus.PAUSED,
      });

      await storage.savePlan(recentPlan);

      const stale = await storage.listStalePlans(1);

      expect(stale).toHaveLength(0);
    });

    it("should not list completed plans", async () => {
      const completedPlan = createTestPlan({
        id: "completed-plan",
        status: PlanStatus.COMPLETED,
      });

      await storage.savePlan(completedPlan);

      // Manually set old date
      const planFile = path.join(testDir, completedPlan.id, "plan.json");
      const content = JSON.parse(fs.readFileSync(planFile, "utf-8"));
      content.updatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(planFile, JSON.stringify(content));

      const stale = await storage.listStalePlans(1);

      expect(stale).toHaveLength(0);
    });

    it("should respect custom staleDays parameter", async () => {
      const stalePlan = createTestPlan({
        id: "medium-stale",
        status: PlanStatus.PAUSED,
      });

      await storage.savePlan(stalePlan);

      // Set date to 3 days ago
      const planFile = path.join(testDir, stalePlan.id, "plan.json");
      const content = JSON.parse(fs.readFileSync(planFile, "utf-8"));
      content.updatedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(planFile, JSON.stringify(content));

      // With 7 days threshold, should not be stale
      const notStale = await storage.listStalePlans(7);
      expect(notStale).toHaveLength(0);

      // With 1 day threshold, should be stale
      const isStale = await storage.listStalePlans(1);
      expect(isStale).toHaveLength(1);
    });
  });

  describe("planExists", () => {
    it("should return true for existing plan", async () => {
      const plan = createTestPlan();
      await storage.savePlan(plan);

      expect(storage.planExists(plan.id)).toBe(true);
    });

    it("should return false for non-existent plan", () => {
      expect(storage.planExists("non-existent")).toBe(false);
    });
  });

  describe("getStorageStats", () => {
    it("should return correct stats", async () => {
      const plan1 = createTestPlan({ id: "p1", status: PlanStatus.COMPLETED });
      const plan2 = createTestPlan({ id: "p2", status: PlanStatus.PAUSED });
      const plan3 = createTestPlan({ id: "p3", status: PlanStatus.CREATED });

      await storage.savePlan(plan1);
      await storage.savePlan(plan2);
      await storage.savePlan(plan3);

      const stats = await storage.getStorageStats();

      expect(stats.totalPlans).toBe(3);
      expect(stats.completedPlans).toBe(1);
      expect(stats.resumablePlans).toBe(2);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });

    it("should return zero for empty storage", async () => {
      const stats = await storage.getStorageStats();

      expect(stats.totalPlans).toBe(0);
      expect(stats.completedPlans).toBe(0);
      expect(stats.resumablePlans).toBe(0);
    });
  });

  describe("singleton pattern", () => {
    it("should return same instance from getPlanStorage", () => {
      const instance1 = getPlanStorage();
      const instance2 = getPlanStorage();

      expect(instance1).toBe(instance2);
    });

    it("should reset singleton with resetPlanStorage", () => {
      const instance1 = getPlanStorage();
      resetPlanStorage();
      const instance2 = getPlanStorage();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("phase serialization", () => {
    it("should serialize and deserialize phase dates", async () => {
      const phase = createTestPhase({
        startedAt: new Date(),
        completedAt: new Date(),
      });
      const plan = createTestPlan({ phases: [phase] });

      await storage.savePlan(plan);
      const loaded = await storage.loadPlan(plan.id);

      expect(loaded?.phases[0].startedAt).toBeInstanceOf(Date);
      expect(loaded?.phases[0].completedAt).toBeInstanceOf(Date);
    });

    it("should handle undefined phase dates", async () => {
      const phase = createTestPhase({
        startedAt: undefined,
        completedAt: undefined,
      });
      const plan = createTestPlan({ phases: [phase] });

      await storage.savePlan(plan);
      const loaded = await storage.loadPlan(plan.id);

      expect(loaded?.phases[0].startedAt).toBeUndefined();
      expect(loaded?.phases[0].completedAt).toBeUndefined();
    });
  });
});
