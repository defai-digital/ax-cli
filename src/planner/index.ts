/**
 * Multi-Phase Task Planning System
 *
 * Exports all planner components for use in ax-cli.
 */

// Types
export {
  // Enums
  RiskLevel,
  FallbackStrategy,
  PhaseStatus,
  PlanStatus,

  // Interfaces
  type TaskPhase,
  type TaskPlan,
  type PhaseResult,
  type PlanResult,
  type ExecutionOptions,
  type PlannerOptions,
  type SavedPlanState,
  type PhaseDisplayInfo,
  type PlanSummary,
  type RecoveryAction,
  type LLMPhaseResponse,
  type LLMPlanResponse,

  // Schemas
  TaskPhaseSchema,
  TaskPlanSchema,
  PhaseResultSchema,
  LLMPhaseResponseSchema,
  LLMPlanResponseSchema,

  // Factory functions
  createPhase,
  createPlan,
  createDefaultExecutionOptions,
  createDefaultPlannerOptions,
} from "./types.js";

// Plan Storage
export {
  PlanStorage,
  getPlanStorage,
  resetPlanStorage,
} from "./plan-storage.js";

// Dependency Resolver
export {
  DependencyResolver,
  getDependencyResolver,
  type ExecutionBatch,
  type DependencyResolutionResult,
} from "./dependency-resolver.js";

// Token Estimator
export {
  TokenEstimator,
  getTokenEstimator,
} from "./token-estimator.js";

// Plan Generator
export {
  PlanGenerator,
  getPlanGenerator,
  type PlanGeneratorOptions,
  type GenerationContext,
} from "./plan-generator.js";

// Task Planner (main orchestrator)
export {
  TaskPlanner,
  getTaskPlanner,
  resetTaskPlanner,
  type TaskPlannerEvents,
} from "./task-planner.js";

// Prompts
export {
  PLANNING_SYSTEM_PROMPT,
  buildPlanningPrompt,
  buildPhaseExecutionPrompt,
  buildPlanSummaryPrompt,
  isComplexRequest,
  estimateMinPhases,
  // GLM-4.6 Optimizations
  shouldUseThinkingMode,
  getComplexityScore,
  THINKING_MODE_KEYWORDS,
  COMPLEX_KEYWORDS,
  SIMPLE_KEYWORDS,
} from "./prompts/planning-prompt.js";
