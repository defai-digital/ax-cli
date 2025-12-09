/**
 * Task Planner
 *
 * Main orchestrator for multi-phase task planning and execution.
 * Coordinates plan generation, storage, and phase execution.
 */

import { EventEmitter } from "events";
import {
  TaskPlan,
  TaskPhase,
  PhaseStatus,
  PlanStatus,
  PhaseResult,
  PlanResult,
  ExecutionOptions,
  PlannerOptions,
  createDefaultExecutionOptions,
  createDefaultPlannerOptions,
} from "./types.js";
import { extractErrorMessage } from "../utils/error-handler.js";
import { PlanStorage, getPlanStorage } from "./plan-storage.js";
import { PlanGenerator, getPlanGenerator } from "./plan-generator.js";
import {
  DependencyResolver,
  getDependencyResolver,
  ExecutionBatch,
} from "./dependency-resolver.js";
import { TokenEstimator, getTokenEstimator } from "./token-estimator.js";
import { TIMEOUT_CONFIG, MCP_CONFIG } from "../constants.js";
import { sleep, calculateExponentialBackoff } from "../utils/retry-helper.js";

// ============================================================================
// Events
// ============================================================================

export interface TaskPlannerEvents {
  "plan:created": (plan: TaskPlan) => void;
  "plan:approved": (plan: TaskPlan) => void;
  "plan:started": (plan: TaskPlan) => void;
  "plan:paused": (plan: TaskPlan) => void;
  "plan:completed": (plan: TaskPlan, result: PlanResult) => void;
  "plan:failed": (plan: TaskPlan, error: Error) => void;

  "phase:started": (plan: TaskPlan, phase: TaskPhase) => void;
  "phase:completed": (plan: TaskPlan, phase: TaskPhase, result: PhaseResult) => void;
  "phase:failed": (plan: TaskPlan, phase: TaskPhase, error: Error) => void;
  "phase:skipped": (plan: TaskPlan, phase: TaskPhase) => void;
  "phase:approval-required": (plan: TaskPlan, phase: TaskPhase) => void;

  "batch:started": (plan: TaskPlan, batch: ExecutionBatch) => void;
  "batch:completed": (plan: TaskPlan, batch: ExecutionBatch) => void;
}

// ============================================================================
// Task Planner Class
// ============================================================================

export class TaskPlanner extends EventEmitter {
  private options: PlannerOptions;
  private storage: PlanStorage;
  private generator: PlanGenerator;
  private resolver: DependencyResolver;
  private estimator: TokenEstimator;

  private currentPlan: TaskPlan | null = null;
  private isPaused: boolean = false;
  private isExecuting: boolean = false;

  constructor(options?: Partial<PlannerOptions>) {
    super();
    this.options = {
      ...createDefaultPlannerOptions(),
      ...options,
    };

    this.storage = getPlanStorage();
    this.generator = getPlanGenerator();
    this.resolver = getDependencyResolver();
    this.estimator = getTokenEstimator();
  }

  // ============================================================================
  // Plan Generation
  // ============================================================================

  /**
   * Check if a request should trigger multi-phase planning
   */
  shouldCreatePlan(request: string): boolean {
    return this.generator.shouldCreatePlan(request);
  }

  /**
   * Generate a plan from user request using LLM
   *
   * @param request - User's request
   * @param llmCaller - Function to call LLM with prompts
   * @param context - Additional context
   */
  async generatePlan(
    request: string,
    llmCaller: (systemPrompt: string, userPrompt: string) => Promise<string>,
    context?: {
      projectType?: string;
      files?: string[];
      recentHistory?: string[];
    }
  ): Promise<TaskPlan | null> {
    // Check if simple request
    if (!this.shouldCreatePlan(request)) {
      const plan = this.generator.createSimplePlan(request);
      this.currentPlan = plan;
      await this.storage.savePlan(plan);
      this.emit("plan:created", plan);
      return plan;
    }

    // Generate complex plan using LLM
    const systemPrompt = this.generator.getSystemPrompt();
    const userPrompt = this.generator.buildUserPrompt(request, context);

    try {
      const llmResponse = await llmCaller(systemPrompt, userPrompt);
      const plan = this.generator.generateFromLLMResponse(
        request,
        llmResponse,
        context
      );

      if (!plan) {
        // Fallback to simple plan
        const simplePlan = this.generator.createSimplePlan(request);
        this.currentPlan = simplePlan;
        await this.storage.savePlan(simplePlan);
        this.emit("plan:created", simplePlan);
        return simplePlan;
      }

      this.currentPlan = plan;
      await this.storage.savePlan(plan);
      this.emit("plan:created", plan);
      return plan;
    } catch (error) {
      console.error("Failed to generate plan:", error);
      return null;
    }
  }

  /**
   * Create a plan directly (without LLM, for testing or manual creation)
   */
  async createPlan(plan: TaskPlan): Promise<TaskPlan> {
    this.currentPlan = plan;
    await this.storage.savePlan(plan);
    this.emit("plan:created", plan);
    return plan;
  }

  // ============================================================================
  // Plan Execution
  // ============================================================================

  /**
   * Execute a plan
   *
   * @param plan - Plan to execute
   * @param phaseExecutor - Function to execute a single phase
   * @param options - Execution options
   */
  async executePlan(
    plan: TaskPlan,
    phaseExecutor: (phase: TaskPhase, planContext: {
      planId: string;
      originalRequest: string;
      completedPhases: string[];
    }) => Promise<PhaseResult>,
    options?: Partial<ExecutionOptions>
  ): Promise<PlanResult> {
    const execOptions = {
      ...createDefaultExecutionOptions(),
      ...this.options.defaultExecutionOptions,
      ...options,
    };

    this.currentPlan = plan;
    this.isExecuting = true;
    this.isPaused = false;

    const startTime = Date.now();
    const phaseResults: PhaseResult[] = [];
    const completedPhaseIds = new Set<string>();
    const warnings: string[] = [];

    // Update plan status
    plan.status = PlanStatus.EXECUTING;
    plan.updatedAt = new Date();
    await this.storage.savePlan(plan);
    this.emit("plan:started", plan);

    // Resolve dependencies into execution batches
    const resolution = this.resolver.resolve(plan.phases);
    if (!resolution.isValid) {
      plan.status = PlanStatus.FAILED;
      await this.storage.savePlan(plan);
      const error = new Error(resolution.error || "Invalid dependency graph");
      this.emit("plan:failed", plan, error);
      throw error;
    }

    try {
      // Execute batches in order
      for (const batch of resolution.batches) {
        if (this.isPaused) {
          plan.status = PlanStatus.PAUSED;
          await this.storage.saveState(plan, "paused");
          this.emit("plan:paused", plan);
          break;
        }

        this.emit("batch:started", plan, batch);

        const batchResults = await this.executeBatch(
          plan,
          batch,
          phaseExecutor,
          completedPhaseIds,
          execOptions
        );

        phaseResults.push(...batchResults);

        // Update completed phases
        for (const result of batchResults) {
          if (result.success) {
            completedPhaseIds.add(result.phaseId);
          }
        }

        // Check for failures
        const failedResults = batchResults.filter((r) => !r.success);
        if (failedResults.length > 0) {
          // Check fallback strategies
          for (const failed of failedResults) {
            const phase = plan.phases.find((p) => p.id === failed.phaseId);
            if (phase?.fallbackStrategy === "abort") {
              throw new Error(
                `Phase "${phase.name}" failed: ${failed.error}`
              );
            }
            if (phase?.fallbackStrategy === "skip") {
              warnings.push(`Skipped phase "${phase.name}" due to failure`);
            }
          }
        }

        this.emit("batch:completed", plan, batch);
      }

      // Calculate final stats
      const totalDuration = Date.now() - startTime;
      const totalTokensUsed = phaseResults.reduce(
        (sum, r) => sum + r.tokensUsed,
        0
      );

      // Update plan
      plan.status = this.isPaused ? PlanStatus.PAUSED : PlanStatus.COMPLETED;
      plan.actualDuration = totalDuration;
      plan.totalTokensUsed = totalTokensUsed;
      plan.phasesCompleted = phaseResults.filter((r) => r.success).length;
      plan.phasesFailed = phaseResults.filter((r) => !r.success).length;
      plan.updatedAt = new Date();
      await this.storage.savePlan(plan);

      const result: PlanResult = {
        planId: plan.id,
        success: plan.phasesFailed === 0,
        phaseResults,
        totalDuration,
        totalTokensUsed,
        summary: this.generateSummary(plan, phaseResults),
        warnings,
      };

      this.emit("plan:completed", plan, result);
      return result;
    } catch (error) {
      plan.status = PlanStatus.FAILED;
      plan.updatedAt = new Date();
      await this.storage.savePlan(plan);

      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("plan:failed", plan, err);
      throw err;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Execute a batch of phases
   */
  private async executeBatch(
    plan: TaskPlan,
    batch: ExecutionBatch,
    phaseExecutor: (phase: TaskPhase, context: {
      planId: string;
      originalRequest: string;
      completedPhases: string[];
    }) => Promise<PhaseResult>,
    completedPhaseIds: Set<string>,
    options: ExecutionOptions
  ): Promise<PhaseResult[]> {
    // Early return for empty batch
    if (!batch.phases || batch.phases.length === 0) {
      return [];
    }

    const context = {
      planId: plan.id,
      originalRequest: plan.originalPrompt,
      completedPhases: Array.from(completedPhaseIds),
    };

    if (batch.canRunInParallel && batch.phases.length > 1) {
      // Execute in parallel using allSettled to allow all phases to complete
      const promises = batch.phases.map((phase) =>
        this.executePhase(plan, phase, phaseExecutor, context, options)
      );

      const settled = await Promise.allSettled(promises);
      return settled.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        // Create failed result for rejected promises
        const phase = batch.phases[index];
        return {
          phaseId: phase.id,
          success: false,
          error: extractErrorMessage(result.reason),
          duration: 0,
          tokensUsed: 0,
          filesModified: [],
          wasRetry: false,
          retryAttempt: 0,
        };
      });
    } else {
      // Execute sequentially
      const results: PhaseResult[] = [];

      for (const phase of batch.phases) {
        if (this.isPaused) break;

        const result = await this.executePhase(
          plan,
          phase,
          phaseExecutor,
          context,
          options
        );
        results.push(result);

        // Update context with completed phase
        if (result.success) {
          context.completedPhases.push(phase.id);
        }
      }

      return results;
    }
  }

  /**
   * Execute a single phase
   */
  private async executePhase(
    plan: TaskPlan,
    phase: TaskPhase,
    phaseExecutor: (phase: TaskPhase, context: {
      planId: string;
      originalRequest: string;
      completedPhases: string[];
    }) => Promise<PhaseResult>,
    context: {
      planId: string;
      originalRequest: string;
      completedPhases: string[];
    },
    options: ExecutionOptions
  ): Promise<PhaseResult> {
    // Check for approval
    if (phase.requiresApproval && !options.autoApprove) {
      const shouldAutoApprove =
        options.autoApproveLowRisk && phase.riskLevel === "low";

      if (!shouldAutoApprove) {
        this.emit("phase:approval-required", plan, phase);

        if (options.onApprovalRequest) {
          const approved = await options.onApprovalRequest(phase);
          if (!approved) {
            phase.status = PhaseStatus.SKIPPED;
            plan.phasesSkipped++;
            this.emit("phase:skipped", plan, phase);
            return {
              phaseId: phase.id,
              success: false,
              error: "User declined approval",
              duration: 0,
              tokensUsed: 0,
              filesModified: [],
              wasRetry: false,
              retryAttempt: 0,
            };
          }
        }
      }

      phase.status = PhaseStatus.APPROVED;
    }

    // Update phase status
    phase.status = PhaseStatus.EXECUTING;
    phase.startedAt = new Date();
    plan.currentPhaseIndex = phase.index;
    await this.storage.savePlan(plan);

    options.onPhaseStart?.(phase);
    this.emit("phase:started", plan, phase);

    const startTime = Date.now();

    try {
      // Execute with retry support
      let result: PhaseResult | undefined;
      let attempt = 0;

      // Use centralized backoff constants
      const BASE_DELAY_MS = TIMEOUT_CONFIG.MS_PER_SECOND;
      const MAX_DELAY_MS = MCP_CONFIG.RECONNECT_MAX_DELAY;

      while (attempt <= phase.maxRetries) {
        try {
          result = await phaseExecutor(phase, context);
          result.wasRetry = attempt > 0;
          result.retryAttempt = attempt;

          if (result.success) {
            break;
          }

          // Check if should retry
          if (
            phase.fallbackStrategy === "retry" &&
            attempt < phase.maxRetries
          ) {
            attempt++;
            phase.retryCount = attempt;

            // Use centralized backoff helper (handles overflow and jitter)
            const backoffDelay = calculateExponentialBackoff(
              attempt - 1,
              BASE_DELAY_MS,
              MAX_DELAY_MS,
              true
            );
            await sleep(backoffDelay);

            continue;
          }

          break;
        } catch (error) {
          if (attempt < phase.maxRetries) {
            attempt++;
            phase.retryCount = attempt;

            // Use centralized backoff helper (no jitter for errors)
            const backoffDelay = calculateExponentialBackoff(
              attempt - 1,
              BASE_DELAY_MS,
              MAX_DELAY_MS,
              false
            );
            await sleep(backoffDelay);

            continue;
          }

          throw error;
        }
      }

      // Ensure result was assigned (defensive check)
      if (!result) {
        throw new Error("Phase execution failed: no result returned");
      }

      // Update phase
      phase.completedAt = new Date();
      phase.duration = Date.now() - startTime;
      phase.status = result.success
        ? PhaseStatus.COMPLETED
        : PhaseStatus.FAILED;
      phase.output = result.output;
      phase.error = result.error;
      phase.tokensUsed = result.tokensUsed;
      phase.filesModified = result.filesModified;

      await this.storage.savePlan(plan);

      if (result.success) {
        plan.phasesCompleted++;
        options.onPhaseComplete?.(phase, result);
        this.emit("phase:completed", plan, phase, result);
      } else {
        plan.phasesFailed++;
        options.onPhaseFailed?.(phase, new Error(result.error || "Unknown error"));
        this.emit("phase:failed", plan, phase, new Error(result.error));
      }

      return result;
    } catch (error) {
      phase.completedAt = new Date();
      phase.duration = Date.now() - startTime;
      phase.status = PhaseStatus.FAILED;
      phase.error = extractErrorMessage(error);

      plan.phasesFailed++;
      await this.storage.savePlan(plan);

      const err = error instanceof Error ? error : new Error(String(error));
      options.onPhaseFailed?.(phase, err);
      this.emit("phase:failed", plan, phase, err);

      return {
        phaseId: phase.id,
        success: false,
        error: phase.error,
        duration: phase.duration,
        tokensUsed: 0,
        filesModified: [],
        wasRetry: phase.retryCount > 0,
        retryAttempt: phase.retryCount,
      };
    }
  }

  /**
   * Generate summary from results
   */
  private generateSummary(
    plan: TaskPlan,
    results: PhaseResult[]
  ): string {
    const completed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const total = results.length;

    let summary = `Plan "${plan.id}" completed: ${completed}/${total} phases succeeded`;

    if (failed > 0) {
      summary += `, ${failed} failed`;
    }

    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
    summary += `. Total tokens: ${this.estimator.formatEstimate(totalTokens)}`;

    return summary;
  }

  // ============================================================================
  // Plan Control
  // ============================================================================

  /**
   * Pause plan execution
   */
  async pausePlan(): Promise<void> {
    if (!this.isExecuting) return;
    this.isPaused = true;

    if (this.currentPlan) {
      this.currentPlan.status = PlanStatus.PAUSED;
      await this.storage.saveState(this.currentPlan, "paused");
    }
  }

  /**
   * Resume a paused plan
   */
  async resumePlan(
    planId: string,
    phaseExecutor: (phase: TaskPhase, context: {
      planId: string;
      originalRequest: string;
      completedPhases: string[];
    }) => Promise<PhaseResult>,
    options?: Partial<ExecutionOptions>
  ): Promise<PlanResult | null> {
    const state = await this.storage.loadState(planId);
    if (!state) return null;

    const plan = state.plan;
    if (plan.status !== PlanStatus.PAUSED) {
      throw new Error(`Plan ${planId} is not paused (status: ${plan.status})`);
    }

    // Reset paused status
    plan.status = PlanStatus.EXECUTING;

    return this.executePlan(plan, phaseExecutor, options);
  }

  /**
   * Skip a specific phase
   */
  async skipPhase(planId: string, phaseId: string): Promise<boolean> {
    const plan = await this.storage.loadPlan(planId);
    if (!plan) return false;

    const phase = plan.phases.find((p) => p.id === phaseId);
    if (!phase) return false;

    if (phase.status !== PhaseStatus.PENDING) {
      return false;
    }

    phase.status = PhaseStatus.SKIPPED;
    plan.phasesSkipped++;
    plan.updatedAt = new Date();
    await this.storage.savePlan(plan);

    return true;
  }

  /**
   * Abandon a plan
   */
  async abandonPlan(planId: string): Promise<boolean> {
    const plan = await this.storage.loadPlan(planId);
    if (!plan) return false;

    plan.status = PlanStatus.ABANDONED;
    plan.updatedAt = new Date();
    await this.storage.savePlan(plan);

    if (this.currentPlan?.id === planId) {
      this.currentPlan = null;
      this.isPaused = true;
    }

    return true;
  }

  // ============================================================================
  // Plan Queries
  // ============================================================================

  /**
   * Get current plan
   */
  getCurrentPlan(): TaskPlan | null {
    return this.currentPlan;
  }

  /**
   * Load a plan from storage
   */
  async loadPlan(planId: string): Promise<TaskPlan | null> {
    return this.storage.loadPlan(planId);
  }

  /**
   * List all plans
   */
  async listPlans() {
    return this.storage.listPlans();
  }

  /**
   * List resumable plans
   */
  async listResumablePlans() {
    return this.storage.listResumablePlans();
  }

  /**
   * Get execution batches for a plan
   */
  getExecutionBatches(plan: TaskPlan): ExecutionBatch[] {
    const result = this.resolver.resolve(plan.phases);
    return result.isValid ? result.batches : [];
  }

  /**
   * Check if currently executing
   */
  isCurrentlyExecuting(): boolean {
    return this.isExecuting;
  }

  /**
   * Check if paused
   */
  isCurrentlyPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let plannerInstance: TaskPlanner | null = null;

/**
 * Get the singleton TaskPlanner instance
 */
export function getTaskPlanner(): TaskPlanner {
  if (!plannerInstance) {
    plannerInstance = new TaskPlanner();
  }
  return plannerInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetTaskPlanner(): void {
  plannerInstance = null;
}
