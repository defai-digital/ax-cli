/**
 * Tests for planner type definitions and factory functions
 */

import { describe, it, expect } from "vitest";
import {
  RiskLevel,
  FallbackStrategy,
  PhaseStatus,
  PlanStatus,
  TaskPhaseSchema,
  TaskPlanSchema,
  PhaseResultSchema,
  LLMPhaseResponseSchema,
  LLMPlanResponseSchema,
  createPhase,
  createPlan,
  createDefaultExecutionOptions,
  createDefaultPlannerOptions,
} from "../../src/planner/types.js";

describe("planner/types", () => {
  describe("Enums", () => {
    it("should have correct RiskLevel values", () => {
      expect(RiskLevel.LOW).toBe("low");
      expect(RiskLevel.MEDIUM).toBe("medium");
      expect(RiskLevel.HIGH).toBe("high");
    });

    it("should have correct FallbackStrategy values", () => {
      expect(FallbackStrategy.RETRY).toBe("retry");
      expect(FallbackStrategy.SKIP).toBe("skip");
      expect(FallbackStrategy.ABORT).toBe("abort");
    });

    it("should have correct PhaseStatus values", () => {
      expect(PhaseStatus.PENDING).toBe("pending");
      expect(PhaseStatus.APPROVED).toBe("approved");
      expect(PhaseStatus.QUEUED).toBe("queued");
      expect(PhaseStatus.EXECUTING).toBe("executing");
      expect(PhaseStatus.COMPLETED).toBe("completed");
      expect(PhaseStatus.FAILED).toBe("failed");
      expect(PhaseStatus.SKIPPED).toBe("skipped");
      expect(PhaseStatus.CANCELLED).toBe("cancelled");
    });

    it("should have correct PlanStatus values", () => {
      expect(PlanStatus.CREATED).toBe("created");
      expect(PlanStatus.APPROVED).toBe("approved");
      expect(PlanStatus.EXECUTING).toBe("executing");
      expect(PlanStatus.PAUSED).toBe("paused");
      expect(PlanStatus.COMPLETED).toBe("completed");
      expect(PlanStatus.FAILED).toBe("failed");
      expect(PlanStatus.ABANDONED).toBe("abandoned");
    });
  });

  describe("createPhase", () => {
    it("should create a phase with required fields and defaults", () => {
      const phase = createPhase({
        id: "phase_1",
        index: 0,
        name: "Test Phase",
        description: "A test phase",
      });

      expect(phase.id).toBe("phase_1");
      expect(phase.index).toBe(0);
      expect(phase.name).toBe("Test Phase");
      expect(phase.description).toBe("A test phase");

      // Check defaults
      expect(phase.objectives).toEqual([]);
      expect(phase.toolsRequired).toEqual([]);
      expect(phase.dependencies).toEqual([]);
      expect(phase.canRunInParallel).toBe(false);
      expect(phase.riskLevel).toBe(RiskLevel.LOW);
      expect(phase.requiresApproval).toBe(false);
      expect(phase.fallbackStrategy).toBe(FallbackStrategy.ABORT);
      expect(phase.maxRetries).toBe(3);
      expect(phase.status).toBe(PhaseStatus.PENDING);
      expect(phase.retryCount).toBe(0);
    });

    it("should allow overriding defaults", () => {
      const phase = createPhase({
        id: "phase_2",
        index: 1,
        name: "High Risk Phase",
        description: "A high risk phase",
        riskLevel: RiskLevel.HIGH,
        requiresApproval: true,
        fallbackStrategy: FallbackStrategy.RETRY,
        maxRetries: 5,
        canRunInParallel: true,
        objectives: ["obj1", "obj2"],
        toolsRequired: ["bash", "search"],
        dependencies: ["phase_1"],
      });

      expect(phase.riskLevel).toBe(RiskLevel.HIGH);
      expect(phase.requiresApproval).toBe(true);
      expect(phase.fallbackStrategy).toBe(FallbackStrategy.RETRY);
      expect(phase.maxRetries).toBe(5);
      expect(phase.canRunInParallel).toBe(true);
      expect(phase.objectives).toEqual(["obj1", "obj2"]);
      expect(phase.toolsRequired).toEqual(["bash", "search"]);
      expect(phase.dependencies).toEqual(["phase_1"]);
    });
  });

  describe("createPlan", () => {
    it("should create a plan with required fields and defaults", () => {
      const phase = createPhase({
        id: "phase_1",
        index: 0,
        name: "Test",
        description: "Test phase",
      });

      const plan = createPlan({
        id: "plan_123",
        originalPrompt: "Create a test",
        phases: [phase],
      });

      expect(plan.id).toBe("plan_123");
      expect(plan.originalPrompt).toBe("Create a test");
      expect(plan.phases).toHaveLength(1);

      // Check defaults
      expect(plan.version).toBe(1);
      expect(plan.reasoning).toBe("");
      expect(plan.complexity).toBe("moderate");
      expect(plan.currentPhaseIndex).toBe(-1);
      expect(plan.status).toBe(PlanStatus.CREATED);
      expect(plan.estimatedTotalTokens).toBe(0);
      expect(plan.estimatedDuration).toBe(0);
      expect(plan.totalTokensUsed).toBe(0);
      expect(plan.actualDuration).toBe(0);
      expect(plan.phasesCompleted).toBe(0);
      expect(plan.phasesFailed).toBe(0);
      expect(plan.phasesSkipped).toBe(0);
      expect(plan.createdAt).toBeInstanceOf(Date);
      expect(plan.updatedAt).toBeInstanceOf(Date);
    });

    it("should allow overriding defaults", () => {
      const phase = createPhase({
        id: "phase_1",
        index: 0,
        name: "Test",
        description: "Test phase",
      });

      const plan = createPlan({
        id: "plan_456",
        originalPrompt: "Complex task",
        phases: [phase],
        complexity: "complex",
        reasoning: "This is complex because...",
        estimatedTotalTokens: 5000,
        estimatedDuration: 60000,
      });

      expect(plan.complexity).toBe("complex");
      expect(plan.reasoning).toBe("This is complex because...");
      expect(plan.estimatedTotalTokens).toBe(5000);
      expect(plan.estimatedDuration).toBe(60000);
    });
  });

  describe("createDefaultExecutionOptions", () => {
    it("should return valid default options", () => {
      const options = createDefaultExecutionOptions();

      expect(options.autoApprove).toBe(false);
      expect(options.autoApproveLowRisk).toBe(false);
      expect(options.createCheckpoints).toBe(true);
      expect(options.pruneContextBetweenPhases).toBe(true);
      expect(options.targetContextPercentage).toBe(50);
      expect(options.maxParallelPhases).toBe(5);
      expect(options.phaseTimeoutMs).toBe(600000);
    });
  });

  describe("createDefaultPlannerOptions", () => {
    it("should return valid default options", () => {
      const options = createDefaultPlannerOptions();

      expect(options.maxPhases).toBe(10);
      expect(options.autoPlanThreshold).toBe(3);
      expect(options.requirePlanApproval).toBe(true);
      expect(options.requireHighRiskApproval).toBe(true);
      expect(options.defaultExecutionOptions).toBeDefined();
    });
  });

  describe("Zod Schemas", () => {
    describe("TaskPhaseSchema", () => {
      it("should validate a valid phase", () => {
        const phase = {
          id: "phase_1",
          index: 0,
          name: "Test Phase",
          description: "A test phase",
          objectives: ["obj1"],
          toolsRequired: ["bash"],
          dependencies: [],
          canRunInParallel: false,
          riskLevel: "low",
          requiresApproval: false,
          fallbackStrategy: "retry",
          maxRetries: 3,
          status: "pending",
          retryCount: 0,
        };

        const result = TaskPhaseSchema.safeParse(phase);
        expect(result.success).toBe(true);
      });

      it("should reject invalid risk level", () => {
        const phase = {
          id: "phase_1",
          index: 0,
          name: "Test",
          description: "Test",
          objectives: [],
          toolsRequired: [],
          dependencies: [],
          canRunInParallel: false,
          riskLevel: "extreme", // Invalid
          requiresApproval: false,
          fallbackStrategy: "retry",
          maxRetries: 3,
          status: "pending",
          retryCount: 0,
        };

        const result = TaskPhaseSchema.safeParse(phase);
        expect(result.success).toBe(false);
      });
    });

    describe("TaskPlanSchema", () => {
      it("should validate a valid plan", () => {
        const plan = {
          id: "plan_123",
          version: 1,
          originalPrompt: "Test",
          reasoning: "Test reasoning",
          complexity: "moderate",
          phases: [],
          currentPhaseIndex: -1,
          status: "created",
          createdAt: new Date(),
          updatedAt: new Date(),
          estimatedTotalTokens: 1000,
          estimatedDuration: 60000,
          totalTokensUsed: 0,
          actualDuration: 0,
          phasesCompleted: 0,
          phasesFailed: 0,
          phasesSkipped: 0,
        };

        const result = TaskPlanSchema.safeParse(plan);
        expect(result.success).toBe(true);
      });

      it("should reject invalid complexity", () => {
        const plan = {
          id: "plan_123",
          version: 1,
          originalPrompt: "Test",
          reasoning: "",
          complexity: "extreme", // Invalid
          phases: [],
          currentPhaseIndex: -1,
          status: "created",
          createdAt: new Date(),
          updatedAt: new Date(),
          estimatedTotalTokens: 0,
          estimatedDuration: 0,
        };

        const result = TaskPlanSchema.safeParse(plan);
        expect(result.success).toBe(false);
      });
    });

    describe("PhaseResultSchema", () => {
      it("should validate a valid phase result", () => {
        const result = {
          phaseId: "phase_1",
          success: true,
          output: "Done",
          duration: 1000,
          tokensUsed: 500,
          filesModified: ["src/test.ts"],
          wasRetry: false,
          retryAttempt: 0,
        };

        const parsed = PhaseResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
      });

      it("should validate a failed phase result", () => {
        const result = {
          phaseId: "phase_1",
          success: false,
          error: "Something went wrong",
          duration: 500,
          tokensUsed: 100,
          filesModified: [],
          wasRetry: true,
          retryAttempt: 2,
        };

        const parsed = PhaseResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
      });
    });

    describe("LLMPhaseResponseSchema", () => {
      it("should validate a valid LLM phase response", () => {
        const response = {
          name: "Implementation",
          description: "Implement the feature",
          objectives: ["Create component", "Add tests"],
          toolsRequired: ["str_replace_editor", "bash"],
          dependencies: ["phase_1"],
          canRunInParallel: false,
          riskLevel: "medium",
          requiresApproval: true,
        };

        const result = LLMPhaseResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it("should apply defaults for optional fields", () => {
        const response = {
          name: "Simple Phase",
          description: "A simple phase",
          objectives: ["Do something"],
        };

        const result = LLMPhaseResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.toolsRequired).toEqual([]);
          expect(result.data.dependencies).toEqual([]);
          expect(result.data.canRunInParallel).toBe(false);
          expect(result.data.riskLevel).toBe("low");
          expect(result.data.requiresApproval).toBe(false);
        }
      });
    });

    describe("LLMPlanResponseSchema", () => {
      it("should validate a valid LLM plan response", () => {
        const response = {
          reasoning: "This task requires multiple phases because...",
          complexity: "moderate",
          phases: [
            {
              name: "Phase 1",
              description: "First phase",
              objectives: ["objective 1"],
            },
            {
              name: "Phase 2",
              description: "Second phase",
              objectives: ["objective 2"],
              dependencies: ["phase_1"],
            },
          ],
        };

        const result = LLMPlanResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      });

      it("should reject missing required fields", () => {
        const response = {
          phases: [],
        };

        const result = LLMPlanResponseSchema.safeParse(response);
        expect(result.success).toBe(false);
      });
    });
  });
});
