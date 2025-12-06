/**
 * Multi-Phase Task Planning System - Type Definitions
 *
 * Defines the core data structures for task decomposition,
 * phase execution, and plan persistence.
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

/**
 * Risk level for a phase - determines approval requirements
 */
export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

/**
 * Fallback strategy when a phase fails
 */
export enum FallbackStrategy {
  RETRY = "retry", // Retry the phase (up to max attempts)
  SKIP = "skip", // Skip and continue to next phase
  ABORT = "abort", // Stop entire plan execution
}

/**
 * Status of an individual phase
 */
export enum PhaseStatus {
  PENDING = "pending", // Not started yet
  APPROVED = "approved", // User approved (if required)
  QUEUED = "queued", // Ready to execute
  EXECUTING = "executing", // Currently running
  COMPLETED = "completed", // Successfully finished
  FAILED = "failed", // Execution failed
  SKIPPED = "skipped", // User skipped
  CANCELLED = "cancelled", // Cancelled mid-execution
}

/**
 * Status of the overall plan
 */
export enum PlanStatus {
  CREATED = "created", // Plan generated, not approved
  APPROVED = "approved", // User approved, ready to execute
  EXECUTING = "executing", // Currently running phases
  PAUSED = "paused", // User paused execution
  COMPLETED = "completed", // All phases done
  FAILED = "failed", // A phase failed, awaiting action
  ABANDONED = "abandoned", // User cancelled the plan
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Represents a single phase in the execution plan
 */
export interface TaskPhase {
  /** Unique identifier for this phase */
  id: string;

  /** Order in the plan (0-indexed) */
  index: number;

  /** Short descriptive name */
  name: string;

  /** Detailed description of what this phase accomplishes */
  description: string;

  /** Specific objectives/goals for this phase */
  objectives: string[];

  /** Tools that this phase is expected to use */
  toolsRequired: string[];

  /** Phase IDs that must complete before this one */
  dependencies: string[];

  /** Whether this phase can run in parallel with others */
  canRunInParallel: boolean;

  /** Risk assessment for this phase */
  riskLevel: RiskLevel;

  /** Whether user approval is required before execution */
  requiresApproval: boolean;

  /** What to do if this phase fails */
  fallbackStrategy: FallbackStrategy;

  /** Maximum retry attempts (if fallbackStrategy is RETRY) */
  maxRetries: number;

  // Execution State
  /** Current status of this phase */
  status: PhaseStatus;

  /** When execution started */
  startedAt?: Date;

  /** When execution completed */
  completedAt?: Date;

  /** Duration in milliseconds */
  duration?: number;

  /** Checkpoint ID created before this phase */
  checkpointId?: string;

  /** Number of retry attempts made */
  retryCount: number;

  // Results
  /** Summary of phase output/results */
  output?: string;

  /** Error message if failed */
  error?: string;

  /** Tokens consumed by this phase */
  tokensUsed?: number;

  /** Files modified during this phase */
  filesModified?: string[];
}

/**
 * Represents a complete execution plan
 */
export interface TaskPlan {
  /** Unique identifier for this plan */
  id: string;

  /** Schema version for migrations */
  version: number;

  /** Original user request that triggered planning */
  originalPrompt: string;

  /** LLM's reasoning for this decomposition */
  reasoning: string;

  /** Overall complexity assessment */
  complexity: "simple" | "moderate" | "complex";

  /** Ordered list of phases */
  phases: TaskPhase[];

  /** Index of currently executing phase (-1 if not started) */
  currentPhaseIndex: number;

  /** Overall plan status */
  status: PlanStatus;

  // Metadata
  /** When the plan was created */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Estimated total tokens for all phases */
  estimatedTotalTokens: number;

  /** Estimated total duration in milliseconds */
  estimatedDuration: number;

  /** Checkpoint ID for plan start state */
  initialCheckpointId?: string;

  // Execution tracking
  /** Total tokens actually used */
  totalTokensUsed: number;

  /** Actual total duration */
  actualDuration: number;

  /** Number of phases completed */
  phasesCompleted: number;

  /** Number of phases failed */
  phasesFailed: number;

  /** Number of phases skipped */
  phasesSkipped: number;
}

/**
 * Result of executing a single phase
 */
export interface PhaseResult {
  /** Phase ID */
  phaseId: string;

  /** Whether execution succeeded */
  success: boolean;

  /** Output/summary from the phase */
  output?: string;

  /** Error message if failed */
  error?: string;

  /** Duration in milliseconds */
  duration: number;

  /** Tokens consumed */
  tokensUsed: number;

  /** Files that were modified */
  filesModified: string[];

  /** Checkpoint ID after this phase */
  checkpointId?: string;

  /** Whether this was a retry */
  wasRetry: boolean;

  /** Retry attempt number (0 for first attempt) */
  retryAttempt: number;
}

/**
 * Result of executing an entire plan
 */
export interface PlanResult {
  /** Plan ID */
  planId: string;

  /** Overall success (all phases completed) */
  success: boolean;

  /** Results for each phase */
  phaseResults: PhaseResult[];

  /** Total duration */
  totalDuration: number;

  /** Total tokens used */
  totalTokensUsed: number;

  /** Summary of what was accomplished */
  summary: string;

  /** Any warnings or notes */
  warnings: string[];
}

/**
 * Options for plan execution
 */
export interface ExecutionOptions {
  /** Auto-approve all phases (bypass approval gates) */
  autoApprove: boolean;

  /** Auto-approve only low-risk phases */
  autoApproveLowRisk: boolean;

  /** Create checkpoints before each phase */
  createCheckpoints: boolean;

  /** Prune context between phases */
  pruneContextBetweenPhases: boolean;

  /** Target context percentage after pruning */
  targetContextPercentage: number;

  /** Maximum parallel phases */
  maxParallelPhases: number;

  /** Phase timeout in milliseconds */
  phaseTimeoutMs: number;

  /** Callback when phase starts */
  onPhaseStart?: (phase: TaskPhase) => void;

  /** Callback when phase completes */
  onPhaseComplete?: (phase: TaskPhase, result: PhaseResult) => void;

  /** Callback when phase fails */
  onPhaseFailed?: (phase: TaskPhase, error: Error) => void;

  /** Callback for approval request */
  onApprovalRequest?: (phase: TaskPhase) => Promise<boolean>;

  /** Callback when plan is paused */
  onPlanPaused?: (plan: TaskPlan) => void;
}

/**
 * Options for the TaskPlanner
 */
export interface PlannerOptions {
  /** Maximum phases to generate */
  maxPhases: number;

  /** Minimum tool calls to trigger auto-planning */
  autoPlanThreshold: number;

  /** Whether to require plan approval before execution */
  requirePlanApproval: boolean;

  /** Whether to require approval for high-risk phases */
  requireHighRiskApproval: boolean;

  /** Default execution options */
  defaultExecutionOptions: Partial<ExecutionOptions>;
}

/**
 * Saved plan state for persistence
 */
export interface SavedPlanState {
  /** The plan definition */
  plan: TaskPlan;

  /** When the state was saved */
  savedAt: Date;

  /** Reason for saving (paused, checkpoint, etc.) */
  saveReason: "paused" | "checkpoint" | "completed" | "failed";

  /** Conversation context at save time */
  conversationContext?: unknown[];

  /** Files that were tracked */
  trackedFiles?: Array<{ path: string; hash: string }>;
}

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

export const RiskLevelSchema = z.nativeEnum(RiskLevel);
export const FallbackStrategySchema = z.nativeEnum(FallbackStrategy);
export const PhaseStatusSchema = z.nativeEnum(PhaseStatus);
export const PlanStatusSchema = z.nativeEnum(PlanStatus);

export const TaskPhaseSchema = z.object({
  id: z.string(),
  index: z.number(),
  name: z.string(),
  description: z.string(),
  objectives: z.array(z.string()),
  toolsRequired: z.array(z.string()),
  dependencies: z.array(z.string()),
  canRunInParallel: z.boolean(),
  riskLevel: RiskLevelSchema,
  requiresApproval: z.boolean(),
  fallbackStrategy: FallbackStrategySchema,
  maxRetries: z.number().default(3),
  status: PhaseStatusSchema,
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  duration: z.number().optional(),
  checkpointId: z.string().optional(),
  retryCount: z.number().default(0),
  output: z.string().optional(),
  error: z.string().optional(),
  tokensUsed: z.number().optional(),
  filesModified: z.array(z.string()).optional(),
});

export const TaskPlanSchema = z.object({
  id: z.string(),
  version: z.number(),
  originalPrompt: z.string(),
  reasoning: z.string(),
  complexity: z.enum(["simple", "moderate", "complex"]),
  phases: z.array(TaskPhaseSchema),
  currentPhaseIndex: z.number(),
  status: PlanStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  estimatedTotalTokens: z.number(),
  estimatedDuration: z.number(),
  initialCheckpointId: z.string().optional(),
  totalTokensUsed: z.number().default(0),
  actualDuration: z.number().default(0),
  phasesCompleted: z.number().default(0),
  phasesFailed: z.number().default(0),
  phasesSkipped: z.number().default(0),
});

export const PhaseResultSchema = z.object({
  phaseId: z.string(),
  success: z.boolean(),
  output: z.string().optional(),
  error: z.string().optional(),
  duration: z.number(),
  tokensUsed: z.number(),
  filesModified: z.array(z.string()),
  checkpointId: z.string().optional(),
  wasRetry: z.boolean(),
  retryAttempt: z.number(),
});

// ============================================================================
// LLM Response Schemas (for parsing plan generation)
// ============================================================================

/**
 * Schema for LLM-generated phase (before adding execution state)
 */
export const LLMPhaseResponseSchema = z.object({
  name: z.string(),
  description: z.string(),
  objectives: z.array(z.string()),
  toolsRequired: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  canRunInParallel: z.boolean().default(false),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
  requiresApproval: z.boolean().default(false),
});

/**
 * Schema for LLM-generated plan response
 */
export const LLMPlanResponseSchema = z.object({
  reasoning: z.string(),
  complexity: z.enum(["simple", "moderate", "complex"]),
  phases: z.array(LLMPhaseResponseSchema),
});

export type LLMPhaseResponse = z.infer<typeof LLMPhaseResponseSchema>;
export type LLMPlanResponse = z.infer<typeof LLMPlanResponseSchema>;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Phase with minimal info for display
 */
export interface PhaseDisplayInfo {
  id: string;
  index: number;
  name: string;
  status: PhaseStatus;
  riskLevel: RiskLevel;
  duration?: number;
  isCurrentPhase: boolean;
}

/**
 * Plan summary for listing
 */
export interface PlanSummary {
  id: string;
  originalPrompt: string;
  status: PlanStatus;
  totalPhases: number;
  completedPhases: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Recovery action after phase failure
 */
export interface RecoveryAction {
  action: "retry" | "skip" | "abort" | "rewind";
  phaseId?: string;
  reason?: string;
  attempts?: number;
  delay?: number;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new TaskPhase with defaults
 */
export function createPhase(
  partial: Partial<TaskPhase> & Pick<TaskPhase, "id" | "index" | "name" | "description">
): TaskPhase {
  return {
    objectives: [],
    toolsRequired: [],
    dependencies: [],
    canRunInParallel: false,
    riskLevel: RiskLevel.LOW,
    requiresApproval: false,
    fallbackStrategy: FallbackStrategy.ABORT,
    maxRetries: 3,
    status: PhaseStatus.PENDING,
    retryCount: 0,
    ...partial,
  };
}

/**
 * Create a new TaskPlan with defaults
 */
export function createPlan(
  partial: Partial<TaskPlan> & Pick<TaskPlan, "id" | "originalPrompt" | "phases">
): TaskPlan {
  const now = new Date();
  return {
    version: 1,
    reasoning: "",
    complexity: "moderate",
    currentPhaseIndex: -1,
    status: PlanStatus.CREATED,
    createdAt: now,
    updatedAt: now,
    estimatedTotalTokens: 0,
    estimatedDuration: 0,
    totalTokensUsed: 0,
    actualDuration: 0,
    phasesCompleted: 0,
    phasesFailed: 0,
    phasesSkipped: 0,
    ...partial,
  };
}

/**
 * Create default execution options
 */
export function createDefaultExecutionOptions(): ExecutionOptions {
  return {
    autoApprove: false,
    autoApproveLowRisk: false,
    createCheckpoints: true,
    pruneContextBetweenPhases: true,
    targetContextPercentage: 50,
    maxParallelPhases: 5,
    phaseTimeoutMs: 600000, // 10 minutes
  };
}

/**
 * Create default planner options
 */
export function createDefaultPlannerOptions(): PlannerOptions {
  return {
    maxPhases: 10,
    autoPlanThreshold: 3,
    requirePlanApproval: true,
    requireHighRiskApproval: true,
    defaultExecutionOptions: createDefaultExecutionOptions(),
  };
}
