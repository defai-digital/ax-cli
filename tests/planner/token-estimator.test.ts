/**
 * Tests for TokenEstimator
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TokenEstimator,
  getTokenEstimator,
} from "../../src/planner/token-estimator.js";
import {
  createPhase,
  createPlan,
  RiskLevel,
  TaskPhase,
} from "../../src/planner/types.js";
import type { ExecutionBatch } from "../../src/planner/dependency-resolver.js";

describe("TokenEstimator", () => {
  let estimator: TokenEstimator;

  beforeEach(() => {
    estimator = new TokenEstimator();
  });

  describe("constructor", () => {
    it("should use default values", () => {
      const est = new TokenEstimator();
      // Test by estimating a minimal phase
      const phase = createPhase({
        id: "test",
        index: 0,
        name: "Test",
        description: "Test",
      });
      const estimate = est.estimatePhase(phase);
      expect(estimate).toBeGreaterThan(0);
    });

    it("should accept custom options", () => {
      const est = new TokenEstimator({
        baseTokensPerPhase: 1000,
        tokensPerObjective: 200,
      });
      const phase = createPhase({
        id: "test",
        index: 0,
        name: "Test",
        description: "Test",
        objectives: ["objective1"],
      });
      const estimate = est.estimatePhase(phase);
      // Should be baseTokensPerPhase + tokensPerObjective = 1200
      expect(estimate).toBe(1200);
    });
  });

  describe("estimatePhase", () => {
    it("should estimate base tokens for minimal phase", () => {
      const phase = createPhase({
        id: "phase_1",
        index: 0,
        name: "Simple Phase",
        description: "A simple phase",
      });

      const estimate = estimator.estimatePhase(phase);
      expect(estimate).toBe(2000); // Base tokens
    });

    it("should add tokens for each objective", () => {
      const phase = createPhase({
        id: "phase_1",
        index: 0,
        name: "Multi-objective Phase",
        description: "A phase with objectives",
        objectives: ["obj1", "obj2", "obj3"],
      });

      const estimate = estimator.estimatePhase(phase);
      expect(estimate).toBe(2000 + 3 * 500); // Base + 3 objectives
    });

    it("should increase tokens for complex objectives", () => {
      const simplePhase = createPhase({
        id: "simple",
        index: 0,
        name: "Simple",
        description: "Simple",
        objectives: ["check something"],
      });

      const complexPhase = createPhase({
        id: "complex",
        index: 0,
        name: "Complex",
        description: "Complex",
        objectives: ["refactor the entire codebase"],
      });

      const simpleEstimate = estimator.estimatePhase(simplePhase);
      const complexEstimate = estimator.estimatePhase(complexPhase);

      // Complex keywords should increase estimate
      expect(complexEstimate).toBeGreaterThan(simpleEstimate);
    });

    it("should decrease tokens for simple objectives", () => {
      const readPhase = createPhase({
        id: "read",
        index: 0,
        name: "Read",
        description: "Read",
        objectives: ["read the file contents"],
      });

      const implementPhase = createPhase({
        id: "implement",
        index: 0,
        name: "Implement",
        description: "Implement",
        objectives: ["implement new feature"],
      });

      const readEstimate = estimator.estimatePhase(readPhase);
      const implementEstimate = estimator.estimatePhase(implementPhase);

      expect(readEstimate).toBeLessThan(implementEstimate);
    });

    it("should add tokens for required tools", () => {
      const phaseWithTools = createPhase({
        id: "phase_1",
        index: 0,
        name: "Phase with Tools",
        description: "Uses tools",
        toolsRequired: ["bash", "search", "view_file"],
      });

      const phaseWithoutTools = createPhase({
        id: "phase_2",
        index: 0,
        name: "Phase without Tools",
        description: "No tools",
      });

      const withToolsEstimate = estimator.estimatePhase(phaseWithTools);
      const withoutToolsEstimate = estimator.estimatePhase(phaseWithoutTools);

      expect(withToolsEstimate).toBeGreaterThan(withoutToolsEstimate);
    });

    it("should use default cost for unknown tools", () => {
      const phase = createPhase({
        id: "phase_1",
        index: 0,
        name: "Unknown Tool Phase",
        description: "Uses unknown tool",
        toolsRequired: ["unknown_tool_xyz"],
      });

      const estimate = estimator.estimatePhase(phase);
      // Base (2000) + default tool cost (500) = 2500
      expect(estimate).toBe(2500);
    });

    it("should multiply by risk level", () => {
      const lowRiskPhase = createPhase({
        id: "low",
        index: 0,
        name: "Low Risk",
        description: "Low risk phase",
        riskLevel: RiskLevel.LOW,
      });

      const mediumRiskPhase = createPhase({
        id: "medium",
        index: 0,
        name: "Medium Risk",
        description: "Medium risk phase",
        riskLevel: RiskLevel.MEDIUM,
      });

      const highRiskPhase = createPhase({
        id: "high",
        index: 0,
        name: "High Risk",
        description: "High risk phase",
        riskLevel: RiskLevel.HIGH,
      });

      const lowEstimate = estimator.estimatePhase(lowRiskPhase);
      const mediumEstimate = estimator.estimatePhase(mediumRiskPhase);
      const highEstimate = estimator.estimatePhase(highRiskPhase);

      expect(lowEstimate).toBe(2000);
      expect(mediumEstimate).toBe(2200); // 2000 * 1.1
      expect(highEstimate).toBe(2600); // 2000 * 1.3
    });
  });

  describe("estimatePlan", () => {
    it("should sum all phase estimates", () => {
      const phases = [
        createPhase({ id: "p1", index: 0, name: "P1", description: "Phase 1" }),
        createPhase({ id: "p2", index: 1, name: "P2", description: "Phase 2" }),
      ];

      const plan = createPlan({
        id: "plan_1",
        originalPrompt: "Test",
        phases,
        complexity: "simple",
      });

      const estimate = estimator.estimatePlan(plan);
      // 2 phases * 2000 base * 1.0 complexity + 2 * 200 coordination = 4400
      expect(estimate).toBe(4400);
    });

    it("should apply complexity multiplier", () => {
      const phases = [
        createPhase({ id: "p1", index: 0, name: "P1", description: "Phase 1" }),
      ];

      const simplePlan = createPlan({
        id: "simple",
        originalPrompt: "Simple",
        phases,
        complexity: "simple",
      });

      const complexPlan = createPlan({
        id: "complex",
        originalPrompt: "Complex",
        phases,
        complexity: "complex",
      });

      const simpleEstimate = estimator.estimatePlan(simplePlan);
      const complexEstimate = estimator.estimatePlan(complexPlan);

      // Complex should be 2.5x more than simple (before coordination overhead)
      expect(complexEstimate).toBeGreaterThan(simpleEstimate * 2);
    });

    it("should add coordination overhead", () => {
      const manyPhases = Array.from({ length: 5 }, (_, i) =>
        createPhase({
          id: `p${i}`,
          index: i,
          name: `Phase ${i}`,
          description: `Phase ${i}`,
        })
      );

      const plan = createPlan({
        id: "plan_1",
        originalPrompt: "Multi-phase",
        phases: manyPhases,
        complexity: "simple",
      });

      const estimate = estimator.estimatePlan(plan);
      // 5 phases * 2000 + 5 * 200 coordination = 11000
      expect(estimate).toBe(11000);
    });
  });

  describe("estimateBatch", () => {
    it("should sum phase estimates in batch", () => {
      const phases: TaskPhase[] = [
        createPhase({ id: "p1", index: 0, name: "P1", description: "Phase 1" }),
        createPhase({ id: "p2", index: 1, name: "P2", description: "Phase 2" }),
      ];

      const batch: ExecutionBatch = {
        level: 0,
        phases,
        canRunInParallel: false,
      };

      const estimate = estimator.estimateBatch(batch);
      expect(estimate).toBe(4000); // 2 phases * 2000
    });

    it("should add overhead for parallel batches", () => {
      const phases: TaskPhase[] = [
        createPhase({ id: "p1", index: 0, name: "P1", description: "Phase 1" }),
        createPhase({ id: "p2", index: 1, name: "P2", description: "Phase 2" }),
      ];

      const sequentialBatch: ExecutionBatch = {
        level: 0,
        phases,
        canRunInParallel: false,
      };

      const parallelBatch: ExecutionBatch = {
        level: 0,
        phases,
        canRunInParallel: true,
      };

      const sequentialEstimate = estimator.estimateBatch(sequentialBatch);
      const parallelEstimate = estimator.estimateBatch(parallelBatch);

      expect(parallelEstimate).toBe(4400); // 4000 * 1.1
      expect(parallelEstimate).toBeGreaterThan(sequentialEstimate);
    });

    it("should not add overhead for single-phase parallel batch", () => {
      const phases: TaskPhase[] = [
        createPhase({ id: "p1", index: 0, name: "P1", description: "Phase 1" }),
      ];

      const batch: ExecutionBatch = {
        level: 0,
        phases,
        canRunInParallel: true,
      };

      const estimate = estimator.estimateBatch(batch);
      expect(estimate).toBe(2000); // No overhead for single phase
    });
  });

  describe("estimatePhaseDuration", () => {
    it("should estimate duration based on tokens", () => {
      const phase = createPhase({
        id: "p1",
        index: 0,
        name: "Simple",
        description: "Simple phase",
      });

      const duration = estimator.estimatePhaseDuration(phase);
      // 2000 tokens / 50 tokens per second * 1000 = 40000ms
      expect(duration).toBe(40000);
    });

    it("should add time for bash commands", () => {
      const phaseWithBash = createPhase({
        id: "p1",
        index: 0,
        name: "With Bash",
        description: "Phase with bash",
        toolsRequired: ["bash"],
      });

      const phaseWithoutBash = createPhase({
        id: "p2",
        index: 0,
        name: "Without Bash",
        description: "Phase without bash",
      });

      const withBashDuration = estimator.estimatePhaseDuration(phaseWithBash);
      const withoutBashDuration =
        estimator.estimatePhaseDuration(phaseWithoutBash);

      // Bash adds 5000ms + tool cost affects token estimate
      expect(withBashDuration).toBeGreaterThan(withoutBashDuration);
    });

    it("should add significant time for tests", () => {
      const phase = createPhase({
        id: "p1",
        index: 0,
        name: "Testing",
        description: "Run tests",
        toolsRequired: ["run_tests"],
      });

      const duration = estimator.estimatePhaseDuration(phase);
      // Should include 30000ms for tests
      expect(duration).toBeGreaterThanOrEqual(30000);
    });
  });

  describe("estimatePlanDuration", () => {
    it("should sum sequential batch durations", () => {
      const phases: TaskPhase[] = [
        createPhase({ id: "p1", index: 0, name: "P1", description: "Phase 1" }),
        createPhase({ id: "p2", index: 1, name: "P2", description: "Phase 2" }),
      ];

      const plan = createPlan({
        id: "plan_1",
        originalPrompt: "Test",
        phases,
      });

      const batches: ExecutionBatch[] = [
        { level: 0, phases: [phases[0]], canRunInParallel: false },
        { level: 1, phases: [phases[1]], canRunInParallel: false },
      ];

      const duration = estimator.estimatePlanDuration(plan, batches);
      // Each phase ~40000ms
      expect(duration).toBe(80000);
    });

    it("should take max duration for parallel batches", () => {
      const shortPhase = createPhase({
        id: "short",
        index: 0,
        name: "Short",
        description: "Short phase",
      });

      const longPhase = createPhase({
        id: "long",
        index: 1,
        name: "Long",
        description: "Long phase",
        toolsRequired: ["run_tests"],
      });

      const plan = createPlan({
        id: "plan_1",
        originalPrompt: "Test",
        phases: [shortPhase, longPhase],
      });

      const batches: ExecutionBatch[] = [
        {
          level: 0,
          phases: [shortPhase, longPhase],
          canRunInParallel: true,
        },
      ];

      const duration = estimator.estimatePlanDuration(plan, batches);
      const longDuration = estimator.estimatePhaseDuration(longPhase);

      // Should be max of the two, not sum
      expect(duration).toBe(longDuration);
    });
  });

  describe("willFitInContext", () => {
    it("should return true when plan fits", () => {
      const phase = createPhase({
        id: "p1",
        index: 0,
        name: "Small",
        description: "Small phase",
      });

      const plan = createPlan({
        id: "plan_1",
        originalPrompt: "Test",
        phases: [phase],
        complexity: "simple",
      });

      const result = estimator.willFitInContext(plan, 100000);

      expect(result.fits).toBe(true);
      expect(result.estimatedTokens).toBeLessThan(100000);
      expect(result.remainingTokens).toBeGreaterThan(0);
    });

    it("should return false when plan exceeds limit", () => {
      const phases = Array.from({ length: 10 }, (_, i) =>
        createPhase({
          id: `p${i}`,
          index: i,
          name: `Phase ${i}`,
          description: `Phase ${i}`,
          objectives: ["implement", "test", "refactor"],
          toolsRequired: ["bash", "search", "str_replace_editor"],
        })
      );

      const plan = createPlan({
        id: "plan_1",
        originalPrompt: "Large task",
        phases,
        complexity: "complex",
      });

      const result = estimator.willFitInContext(plan, 5000);

      expect(result.fits).toBe(false);
      expect(result.estimatedTokens).toBeGreaterThan(5000);
      expect(result.remainingTokens).toBeLessThan(0);
    });
  });

  describe("suggestSplits", () => {
    it("should not suggest splits for small plans", () => {
      const phase = createPhase({
        id: "p1",
        index: 0,
        name: "Small",
        description: "Small phase",
      });

      const plan = createPlan({
        id: "plan_1",
        originalPrompt: "Test",
        phases: [phase],
      });

      const result = estimator.suggestSplits(plan, 100000);

      expect(result.shouldSplit).toBe(false);
      expect(result.suggestions).toHaveLength(0);
    });

    it("should suggest splits for large phases", () => {
      const largePhase = createPhase({
        id: "p1",
        index: 0,
        name: "Large Phase",
        description: "Very large phase",
        objectives: [
          "implement feature A",
          "implement feature B",
          "implement feature C",
          "refactor entire codebase",
          "write comprehensive tests",
        ],
        toolsRequired: ["bash", "search", "str_replace_editor", "test"],
      });

      const plan = createPlan({
        id: "plan_1",
        originalPrompt: "Large task",
        phases: [largePhase],
        complexity: "complex",
      });

      const result = estimator.suggestSplits(plan, 5000);

      expect(result.shouldSplit).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("should suggest reducing scope for many objectives", () => {
      const phases = Array.from({ length: 5 }, (_, i) =>
        createPhase({
          id: `p${i}`,
          index: i,
          name: `Phase ${i}`,
          description: `Phase ${i}`,
          objectives: ["obj1", "obj2", "obj3", "obj4"],
        })
      );

      const plan = createPlan({
        id: "plan_1",
        originalPrompt: "Many objectives",
        phases,
        complexity: "complex",
      });

      const result = estimator.suggestSplits(plan, 5000);

      expect(result.shouldSplit).toBe(true);
      expect(
        result.suggestions.some((s) => s.includes("objectives"))
      ).toBe(true);
    });
  });

  describe("formatEstimate", () => {
    it("should format small numbers as-is", () => {
      expect(estimator.formatEstimate(500)).toBe("500");
      expect(estimator.formatEstimate(999)).toBe("999");
    });

    it("should format thousands with k suffix", () => {
      expect(estimator.formatEstimate(1000)).toBe("1.0k");
      expect(estimator.formatEstimate(5500)).toBe("5.5k");
      expect(estimator.formatEstimate(99999)).toBe("100.0k");
    });

    it("should format millions with M suffix", () => {
      expect(estimator.formatEstimate(1000000)).toBe("1.0M");
      expect(estimator.formatEstimate(2500000)).toBe("2.5M");
    });
  });

  describe("formatDuration", () => {
    it("should format milliseconds", () => {
      expect(estimator.formatDuration(500)).toBe("500ms");
      expect(estimator.formatDuration(999)).toBe("999ms");
    });

    it("should format seconds", () => {
      expect(estimator.formatDuration(1000)).toBe("1s");
      expect(estimator.formatDuration(30000)).toBe("30s");
      expect(estimator.formatDuration(59000)).toBe("59s");
    });

    it("should format minutes and seconds", () => {
      expect(estimator.formatDuration(60000)).toBe("1m");
      expect(estimator.formatDuration(90000)).toBe("1m 30s");
      expect(estimator.formatDuration(300000)).toBe("5m");
    });

    it("should format hours and minutes", () => {
      expect(estimator.formatDuration(3600000)).toBe("1h 0m");
      expect(estimator.formatDuration(5400000)).toBe("1h 30m");
      expect(estimator.formatDuration(7200000)).toBe("2h 0m");
    });
  });

  describe("getTokenEstimator (singleton)", () => {
    it("should return same instance", () => {
      const est1 = getTokenEstimator();
      const est2 = getTokenEstimator();
      expect(est1).toBe(est2);
    });
  });
});
