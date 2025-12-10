/**
 * Tests for PlanGenerator
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PlanGenerator,
  getPlanGenerator,
} from "../../packages/core/src/planner/plan-generator.js";
import {
  RiskLevel,
  FallbackStrategy,
  PhaseStatus,
  PlanStatus,
} from "../../packages/core/src/planner/types.js";

describe("PlanGenerator", () => {
  let generator: PlanGenerator;

  beforeEach(() => {
    generator = new PlanGenerator();
  });

  describe("constructor", () => {
    it("should use default options", () => {
      const gen = new PlanGenerator();
      // Test by creating a simple plan
      const plan = gen.createSimplePlan("test request");
      expect(plan).toBeDefined();
    });

    it("should accept custom options", () => {
      const gen = new PlanGenerator({
        maxPhases: 5,
        defaultRiskLevel: RiskLevel.MEDIUM,
        requireApprovalForHighRisk: false,
      });

      // Generate a plan with high risk phase
      const llmResponse = JSON.stringify({
        reasoning: "Test",
        complexity: "moderate",
        phases: [
          {
            name: "High Risk Phase",
            description: "A risky phase",
            objectives: ["Do something risky"],
            riskLevel: "high",
          },
        ],
      });

      const plan = gen.generateFromLLMResponse("test", llmResponse);
      expect(plan).toBeDefined();
      // With requireApprovalForHighRisk: false, high risk phases shouldn't auto-require approval
      expect(plan?.phases[0].requiresApproval).toBe(false);
    });
  });

  describe("shouldCreatePlan", () => {
    it("should return false for simple requests", () => {
      expect(generator.shouldCreatePlan("read file.ts")).toBe(false);
      expect(generator.shouldCreatePlan("what is this?")).toBe(false);
      expect(generator.shouldCreatePlan("explain the code")).toBe(false);
    });

    it("should return true for complex requests", () => {
      expect(
        generator.shouldCreatePlan(
          "implement a new authentication system with OAuth support"
        )
      ).toBe(true);
      expect(
        generator.shouldCreatePlan(
          "refactor the entire codebase to use TypeScript"
        )
      ).toBe(true);
      expect(
        generator.shouldCreatePlan(
          "build a REST API with authentication, database, and tests"
        )
      ).toBe(true);
    });
  });

  describe("createSimplePlan", () => {
    it("should create a single-phase plan", () => {
      const plan = generator.createSimplePlan("Fix the bug in auth.ts");

      expect(plan.id).toMatch(/^plan_/);
      expect(plan.originalPrompt).toBe("Fix the bug in auth.ts");
      expect(plan.phases).toHaveLength(1);
      expect(plan.complexity).toBe("simple");
      expect(plan.status).toBe(PlanStatus.CREATED);
    });

    it("should set correct phase properties", () => {
      const plan = generator.createSimplePlan("Update the config");

      const phase = plan.phases[0];
      expect(phase.id).toBe("phase_1");
      expect(phase.index).toBe(0);
      expect(phase.name).toBe("Execute Request");
      expect(phase.description).toBe("Update the config");
      expect(phase.objectives).toContain("Update the config");
      expect(phase.dependencies).toEqual([]);
      expect(phase.canRunInParallel).toBe(false);
      expect(phase.riskLevel).toBe(RiskLevel.LOW);
      expect(phase.requiresApproval).toBe(false);
      expect(phase.fallbackStrategy).toBe(FallbackStrategy.RETRY);
      expect(phase.maxRetries).toBe(3);
      expect(phase.status).toBe(PhaseStatus.PENDING);
    });

    it("should estimate tokens and duration", () => {
      const plan = generator.createSimplePlan("Test request");

      expect(plan.estimatedTotalTokens).toBeGreaterThan(0);
      expect(plan.estimatedDuration).toBeGreaterThan(0);
    });
  });

  describe("generateFromLLMResponse", () => {
    it("should parse valid LLM response", () => {
      const llmResponse = JSON.stringify({
        reasoning: "This task requires multiple steps",
        complexity: "moderate",
        phases: [
          {
            name: "Phase 1",
            description: "First phase",
            objectives: ["obj1", "obj2"],
            toolsRequired: ["bash", "search"],
            dependencies: [],
            canRunInParallel: false,
            riskLevel: "low",
            requiresApproval: false,
          },
          {
            name: "Phase 2",
            description: "Second phase",
            objectives: ["obj3"],
            dependencies: ["phase_1"],
            canRunInParallel: false,
            riskLevel: "medium",
          },
        ],
      });

      const plan = generator.generateFromLLMResponse(
        "Test request",
        llmResponse
      );

      expect(plan).not.toBeNull();
      expect(plan?.reasoning).toBe("This task requires multiple steps");
      expect(plan?.complexity).toBe("moderate");
      expect(plan?.phases).toHaveLength(2);
    });

    it("should handle phase dependencies correctly", () => {
      const llmResponse = JSON.stringify({
        reasoning: "Test",
        complexity: "moderate",
        phases: [
          {
            name: "Phase 1",
            description: "First",
            objectives: ["obj1"],
          },
          {
            name: "Phase 2",
            description: "Second",
            objectives: ["obj2"],
            dependencies: ["phase_1"],
          },
          {
            name: "Phase 3",
            description: "Third",
            objectives: ["obj3"],
            dependencies: ["phase_1", "phase_2"],
          },
        ],
      });

      const plan = generator.generateFromLLMResponse("Test", llmResponse);

      expect(plan?.phases[0].dependencies).toEqual([]);
      expect(plan?.phases[1].dependencies).toEqual(["phase_1"]);
      expect(plan?.phases[2].dependencies).toContain("phase_1");
      expect(plan?.phases[2].dependencies).toContain("phase_2");
    });

    it("should resolve numeric dependencies", () => {
      const llmResponse = JSON.stringify({
        reasoning: "Test",
        complexity: "simple",
        phases: [
          {
            name: "Phase 1",
            description: "First",
            objectives: ["obj1"],
          },
          {
            name: "Phase 2",
            description: "Second",
            objectives: ["obj2"],
            dependencies: ["1"], // Numeric reference
          },
        ],
      });

      const plan = generator.generateFromLLMResponse("Test", llmResponse);

      expect(plan?.phases[1].dependencies).toEqual(["phase_1"]);
    });

    it("should resolve 'previous' dependency", () => {
      const llmResponse = JSON.stringify({
        reasoning: "Test",
        complexity: "simple",
        phases: [
          {
            name: "Phase 1",
            description: "First",
            objectives: ["obj1"],
          },
          {
            name: "Phase 2",
            description: "Second",
            objectives: ["obj2"],
            dependencies: ["previous"],
          },
        ],
      });

      const plan = generator.generateFromLLMResponse("Test", llmResponse);

      expect(plan?.phases[1].dependencies).toEqual(["phase_1"]);
    });

    it("should auto-set approval for high risk phases", () => {
      const gen = new PlanGenerator({
        requireApprovalForHighRisk: true,
      });

      const llmResponse = JSON.stringify({
        reasoning: "Test",
        complexity: "moderate",
        phases: [
          {
            name: "Risky Phase",
            description: "High risk operation",
            objectives: ["delete production data"],
            riskLevel: "high",
            requiresApproval: false, // Even if LLM says no
          },
        ],
      });

      const plan = gen.generateFromLLMResponse("Test", llmResponse);

      expect(plan?.phases[0].requiresApproval).toBe(true);
    });

    it("should set abort strategy for high risk phases", () => {
      const llmResponse = JSON.stringify({
        reasoning: "Test",
        complexity: "moderate",
        phases: [
          {
            name: "High Risk",
            description: "Risky",
            objectives: ["obj"],
            riskLevel: "high",
          },
        ],
      });

      const plan = generator.generateFromLLMResponse("Test", llmResponse);

      expect(plan?.phases[0].fallbackStrategy).toBe(FallbackStrategy.ABORT);
      expect(plan?.phases[0].maxRetries).toBe(1);
    });

    it("should set retry strategy for non-high risk phases", () => {
      const llmResponse = JSON.stringify({
        reasoning: "Test",
        complexity: "simple",
        phases: [
          {
            name: "Low Risk",
            description: "Safe",
            objectives: ["obj"],
            riskLevel: "low",
          },
        ],
      });

      const plan = generator.generateFromLLMResponse("Test", llmResponse);

      expect(plan?.phases[0].fallbackStrategy).toBe(FallbackStrategy.RETRY);
      expect(plan?.phases[0].maxRetries).toBe(3);
    });

    it("should limit phases to maxPhases", () => {
      const gen = new PlanGenerator({ maxPhases: 2 });

      const llmResponse = JSON.stringify({
        reasoning: "Test",
        complexity: "complex",
        phases: Array.from({ length: 10 }, (_, i) => ({
          name: `Phase ${i + 1}`,
          description: `Phase ${i + 1}`,
          objectives: [`obj${i + 1}`],
        })),
      });

      const plan = gen.generateFromLLMResponse("Test", llmResponse);

      expect(plan?.phases).toHaveLength(2);
    });

    it("should return null for invalid JSON", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const plan = generator.generateFromLLMResponse("Test", "invalid json");

      expect(plan).toBeNull();
      consoleSpy.mockRestore();
    });

    it("should return null for invalid schema", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const invalidResponse = JSON.stringify({
        reasoning: "Test",
        // Missing complexity and phases
      });

      const plan = generator.generateFromLLMResponse("Test", invalidResponse);

      expect(plan).toBeNull();
      consoleSpy.mockRestore();
    });

    it("should filter invalid dependencies", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const llmResponse = JSON.stringify({
        reasoning: "Test",
        complexity: "moderate",
        phases: [
          {
            name: "Phase 1",
            description: "First",
            objectives: ["obj1"],
            dependencies: ["non_existent_phase"], // Invalid
          },
        ],
      });

      const plan = generator.generateFromLLMResponse("Test", llmResponse);

      expect(plan?.phases[0].dependencies).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe("getSystemPrompt", () => {
    it("should return a non-empty system prompt", () => {
      const prompt = generator.getSystemPrompt();

      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe("buildUserPrompt", () => {
    it("should include the request", () => {
      const prompt = generator.buildUserPrompt("Create a new feature");

      expect(prompt).toContain("Create a new feature");
    });

    it("should include context when provided", () => {
      const prompt = generator.buildUserPrompt("Create a new feature", {
        projectType: "typescript",
        files: ["src/index.ts", "src/utils.ts"],
        recentHistory: ["Previous task was completed"],
      });

      expect(prompt).toContain("typescript");
    });
  });

  describe("updatePlanEstimates", () => {
    it("should update token and duration estimates", () => {
      const originalPlan = generator.createSimplePlan("Test");
      const originalTokens = originalPlan.estimatedTotalTokens;

      // Manually modify to test update
      originalPlan.phases[0].objectives = ["obj1", "obj2", "obj3"];

      const updatedPlan = generator.updatePlanEstimates(originalPlan);

      expect(updatedPlan.estimatedTotalTokens).toBeGreaterThan(originalTokens);
      expect(updatedPlan.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalPlan.createdAt.getTime()
      );
    });
  });

  describe("getPlanGenerator (singleton)", () => {
    it("should return same instance", () => {
      const gen1 = getPlanGenerator();
      const gen2 = getPlanGenerator();
      expect(gen1).toBe(gen2);
    });
  });
});
