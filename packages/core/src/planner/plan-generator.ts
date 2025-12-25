/**
 * Plan Generator
 *
 * Generates execution plans from user requests using LLM.
 */

import { randomUUID } from "crypto";
import {
  TaskPlan,
  TaskPhase,
  PhaseStatus,
  PlanStatus,
  RiskLevel,
  FallbackStrategy,
  LLMPlanResponseSchema,
  LLMPlanResponse,
  createPlan,
  createPhase,
} from "./types.js";
import {
  PLANNING_SYSTEM_PROMPT,
  buildPlanningPrompt,
  isComplexRequest,
} from "./prompts/planning-prompt.js";
import { getDependencyResolver } from "./dependency-resolver.js";
import { getTokenEstimator } from "./token-estimator.js";

// ============================================================================
// Types
// ============================================================================

export interface PlanGeneratorOptions {
  /** Maximum phases to generate */
  maxPhases: number;

  /** Default risk level for unspecified phases */
  defaultRiskLevel: RiskLevel;

  /** Whether to auto-require approval for high-risk phases */
  requireApprovalForHighRisk: boolean;
}

export interface GenerationContext {
  /** Project type (e.g., "typescript", "react") */
  projectType?: string;

  /** Relevant files for context */
  files?: string[];

  /** Recent conversation history */
  recentHistory?: string[];

  /** Custom instructions */
  customInstructions?: string;
}

// ============================================================================
// Plan Generator Class
// ============================================================================

export class PlanGenerator {
  private options: PlanGeneratorOptions;

  constructor(options?: Partial<PlanGeneratorOptions>) {
    this.options = {
      maxPhases: 10,
      defaultRiskLevel: RiskLevel.LOW,
      requireApprovalForHighRisk: true,
      ...options,
    };
  }

  /**
   * Check if a request should trigger multi-phase planning
   */
  shouldCreatePlan(request: string): boolean {
    return isComplexRequest(request);
  }

  /**
   * Generate a plan from LLM response
   *
   * @param request - User's original request
   * @param llmResponse - Raw JSON response from LLM
   * @param context - Additional context
   */
  generateFromLLMResponse(
    request: string,
    llmResponse: string,
    _context?: GenerationContext
  ): TaskPlan | null {
    try {
      // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
      let cleanedResponse = llmResponse.trim();
      if (cleanedResponse.startsWith("```")) {
        // Remove opening ``` or ```json
        cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/, "");
        // Remove closing ```
        cleanedResponse = cleanedResponse.replace(/\n?```\s*$/, "");
      }

      // Parse JSON response
      const parsed = JSON.parse(cleanedResponse);

      // Validate against schema
      const result = LLMPlanResponseSchema.safeParse(parsed);
      if (!result.success) {
        console.error("Invalid LLM response format:", result.error);
        return null;
      }

      return this.buildPlanFromResponse(request, result.data);
    } catch (error) {
      console.error("Failed to parse LLM response:", error);
      return null;
    }
  }

  /**
   * Build a TaskPlan from validated LLM response
   */
  private buildPlanFromResponse(
    request: string,
    response: LLMPlanResponse
  ): TaskPlan {
    const planId = `plan_${randomUUID().slice(0, 8)}`;
    const now = new Date();

    // Convert LLM phases to TaskPhases
    const phases: TaskPhase[] = response.phases
      .slice(0, this.options.maxPhases)
      .map((llmPhase, index) => {
        const phaseId = `phase_${index + 1}`;

        // Convert risk level string to enum
        const riskLevel = this.parseRiskLevel(llmPhase.riskLevel);

        // Auto-set approval for high-risk phases
        const requiresApproval =
          llmPhase.requiresApproval ||
          (this.options.requireApprovalForHighRisk &&
            riskLevel === RiskLevel.HIGH);

        // Determine fallback strategy based on risk
        const fallbackStrategy =
          riskLevel === RiskLevel.HIGH
            ? FallbackStrategy.ABORT
            : FallbackStrategy.RETRY;

        return createPhase({
          id: phaseId,
          index,
          name: llmPhase.name,
          description: llmPhase.description,
          objectives: llmPhase.objectives,
          toolsRequired: llmPhase.toolsRequired,
          dependencies: this.resolveDependencies(llmPhase.dependencies, index),
          canRunInParallel: llmPhase.canRunInParallel,
          riskLevel,
          requiresApproval,
          fallbackStrategy,
          maxRetries: riskLevel === RiskLevel.HIGH ? 1 : 3,
          status: PhaseStatus.PENDING,
          retryCount: 0,
        });
      });

    // Validate dependencies
    const resolver = getDependencyResolver();
    const validation = resolver.validate(phases);
    if (!validation.isValid) {
      console.warn("Plan has dependency issues:", validation.errors);
      // Fix dependencies by removing invalid ones
      for (const phase of phases) {
        phase.dependencies = phase.dependencies.filter((depId) =>
          phases.some((p) => p.id === depId)
        );
      }
    }

    // Estimate tokens and duration
    const estimator = getTokenEstimator();
    const batches = resolver.resolve(phases);
    const estimatedTokens = phases.reduce(
      (sum, p) => sum + estimator.estimatePhase(p),
      0
    );
    const estimatedDuration = batches.isValid
      ? estimator.estimatePlanDuration(
          { phases } as TaskPlan,
          batches.batches
        )
      : estimatedTokens * 20; // Fallback estimate

    return createPlan({
      id: planId,
      originalPrompt: request,
      reasoning: response.reasoning,
      complexity: response.complexity,
      phases,
      status: PlanStatus.CREATED,
      createdAt: now,
      updatedAt: now,
      estimatedTotalTokens: estimatedTokens,
      estimatedDuration,
    });
  }

  /**
   * Parse risk level string to enum
   */
  private parseRiskLevel(level: string): RiskLevel {
    switch (level.toLowerCase()) {
      case "high":
        return RiskLevel.HIGH;
      case "medium":
        return RiskLevel.MEDIUM;
      case "low":
      default:
        return RiskLevel.LOW;
    }
  }

  /**
   * Resolve dependency references to phase IDs
   *
   * LLM might return dependencies as names or indices
   */
  private resolveDependencies(
    deps: string[],
    currentIndex: number
  ): string[] {
    return deps
      .map((dep) => {
        // If it looks like a phase ID, use as-is
        if (dep.startsWith("phase_")) {
          return dep;
        }

        // If it's a number, convert to phase ID
        const num = parseInt(dep, 10);
        if (!isNaN(num) && num > 0 && num < currentIndex + 1) {
          return `phase_${num}`;
        }

        // If it's "previous", reference the previous phase
        if (dep.toLowerCase() === "previous" && currentIndex > 0) {
          return `phase_${currentIndex}`;
        }

        // Can't resolve - skip
        return null;
      })
      .filter((dep): dep is string => dep !== null);
  }

  /**
   * Create a simple single-phase plan for non-complex requests
   */
  createSimplePlan(request: string): TaskPlan {
    const planId = `plan_${randomUUID().slice(0, 8)}`;
    const now = new Date();

    const phase = createPhase({
      id: "phase_1",
      index: 0,
      name: "Execute Request",
      description: request,
      objectives: [request],
      toolsRequired: [],
      dependencies: [],
      canRunInParallel: false,
      riskLevel: RiskLevel.LOW,
      requiresApproval: false,
      fallbackStrategy: FallbackStrategy.RETRY,
      maxRetries: 3,
      status: PhaseStatus.PENDING,
      retryCount: 0,
    });

    const estimator = getTokenEstimator();

    return createPlan({
      id: planId,
      originalPrompt: request,
      reasoning: "Simple request - single phase execution",
      complexity: "simple",
      phases: [phase],
      status: PlanStatus.CREATED,
      createdAt: now,
      updatedAt: now,
      estimatedTotalTokens: estimator.estimatePhase(phase),
      estimatedDuration: estimator.estimatePhaseDuration(phase),
    });
  }

  /**
   * Get the system prompt for planning
   */
  getSystemPrompt(): string {
    return PLANNING_SYSTEM_PROMPT;
  }

  /**
   * Build the user prompt for planning
   */
  buildUserPrompt(request: string, context?: GenerationContext): string {
    return buildPlanningPrompt(request, {
      projectType: context?.projectType,
      files: context?.files,
      recentHistory: context?.recentHistory,
    });
  }

  /**
   * Update plan with estimates after creation
   */
  updatePlanEstimates(plan: TaskPlan): TaskPlan {
    const estimator = getTokenEstimator();
    const resolver = getDependencyResolver();

    const batches = resolver.resolve(plan.phases);

    return {
      ...plan,
      estimatedTotalTokens: estimator.estimatePlan(plan),
      estimatedDuration: batches.isValid
        ? estimator.estimatePlanDuration(plan, batches.batches)
        : plan.estimatedDuration,
      updatedAt: new Date(),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let generatorInstance: PlanGenerator | null = null;

/**
 * Get the singleton PlanGenerator instance
 */
export function getPlanGenerator(): PlanGenerator {
  if (!generatorInstance) {
    generatorInstance = new PlanGenerator();
  }
  return generatorInstance;
}
