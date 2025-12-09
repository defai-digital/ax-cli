/**
 * Plan Storage Module
 *
 * Handles persistence and retrieval of execution plans.
 * Plans are stored in ~/.ax-cli/plans/{plan-id}/
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  TaskPlan,
  SavedPlanState,
  PlanSummary,
  PlanStatus,
  TaskPlanSchema,
} from "./types.js";

// ============================================================================
// Constants
// ============================================================================

const PLANS_DIR = path.join(os.homedir(), ".ax-cli", "plans");
const PLAN_FILE = "plan.json";
const STATE_FILE = "state.json";
const PLAN_RETENTION_DAYS = 30;

// ============================================================================
// Plan Storage Class
// ============================================================================

export class PlanStorage {
  private plansDir: string;

  constructor(plansDir?: string) {
    this.plansDir = plansDir || PLANS_DIR;
    this.ensureDirectory();
  }

  /**
   * Ensure the plans directory exists
   */
  private ensureDirectory(): void {
    if (!fs.existsSync(this.plansDir)) {
      fs.mkdirSync(this.plansDir, { recursive: true });
    }
  }

  /**
   * Get the directory path for a specific plan
   */
  private getPlanDir(planId: string): string {
    return path.join(this.plansDir, planId);
  }

  /**
   * Save a plan to disk
   */
  async savePlan(plan: TaskPlan): Promise<string> {
    const planDir = this.getPlanDir(plan.id);

    // Create plan directory
    if (!fs.existsSync(planDir)) {
      fs.mkdirSync(planDir, { recursive: true });
    }

    // Update timestamp
    plan.updatedAt = new Date();

    // Serialize dates properly
    const serialized = this.serializePlan(plan);

    // Write plan file
    const planPath = path.join(planDir, PLAN_FILE);
    fs.writeFileSync(planPath, JSON.stringify(serialized, null, 2), "utf-8");

    return planDir;
  }

  /**
   * Load a plan from disk
   */
  async loadPlan(planId: string): Promise<TaskPlan | null> {
    const planPath = path.join(this.getPlanDir(planId), PLAN_FILE);

    if (!fs.existsSync(planPath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(planPath, "utf-8");
      const parsed = JSON.parse(data);
      const plan = this.deserializePlan(parsed);

      // Validate with Zod schema
      const result = TaskPlanSchema.safeParse(plan);
      if (!result.success) {
        console.error(`Invalid plan format for ${planId}:`, result.error);
        return null;
      }

      return plan;
    } catch (error) {
      console.error(`Failed to load plan ${planId}:`, error);
      return null;
    }
  }

  /**
   * Save plan state (for pause/resume)
   */
  async saveState(
    plan: TaskPlan,
    reason: SavedPlanState["saveReason"],
    context?: {
      conversationContext?: unknown[];
      trackedFiles?: Array<{ path: string; hash: string }>;
    }
  ): Promise<void> {
    const planDir = this.getPlanDir(plan.id);

    // Ensure plan directory exists
    if (!fs.existsSync(planDir)) {
      fs.mkdirSync(planDir, { recursive: true });
    }

    const state: SavedPlanState = {
      plan,
      savedAt: new Date(),
      saveReason: reason,
      conversationContext: context?.conversationContext,
      trackedFiles: context?.trackedFiles,
    };

    const statePath = path.join(planDir, STATE_FILE);
    const serialized = this.serializeState(state);
    fs.writeFileSync(statePath, JSON.stringify(serialized, null, 2), "utf-8");

    // Also update the plan file
    await this.savePlan(plan);
  }

  /**
   * Load plan state
   */
  async loadState(planId: string): Promise<SavedPlanState | null> {
    const statePath = path.join(this.getPlanDir(planId), STATE_FILE);

    if (!fs.existsSync(statePath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(statePath, "utf-8");
      const parsed = JSON.parse(data);
      return this.deserializeState(parsed);
    } catch (error) {
      console.error(`Failed to load state for ${planId}:`, error);
      return null;
    }
  }

  /**
   * List all saved plans
   */
  async listPlans(): Promise<PlanSummary[]> {
    if (!fs.existsSync(this.plansDir)) {
      return [];
    }

    const entries = fs.readdirSync(this.plansDir, { withFileTypes: true });
    const summaries: PlanSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const plan = await this.loadPlan(entry.name);
      if (plan) {
        summaries.push({
          id: plan.id,
          originalPrompt: plan.originalPrompt,
          status: plan.status,
          totalPhases: plan.phases.length,
          completedPhases: plan.phasesCompleted,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
        });
      }
    }

    // Sort by updatedAt descending (most recent first)
    // Defensive: handle cases where dates might not be proper Date objects
    summaries.sort((a, b) => {
      const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
      const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
      return bTime - aTime;
    });

    return summaries;
  }

  /**
   * List resumable plans (paused or failed)
   */
  async listResumablePlans(): Promise<PlanSummary[]> {
    const allPlans = await this.listPlans();
    return allPlans.filter(
      (p) =>
        p.status === PlanStatus.PAUSED ||
        p.status === PlanStatus.FAILED ||
        p.status === PlanStatus.CREATED ||
        p.status === PlanStatus.APPROVED
    );
  }

  /**
   * Delete a plan
   */
  async deletePlan(planId: string): Promise<boolean> {
    const planDir = this.getPlanDir(planId);

    if (!fs.existsSync(planDir)) {
      return false;
    }

    try {
      fs.rmSync(planDir, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.error(`Failed to delete plan ${planId}:`, error);
      return false;
    }
  }

  /**
   * Clean up old plans (older than retention period)
   */
  async cleanupOldPlans(retentionDays: number = PLAN_RETENTION_DAYS): Promise<number> {
    const allPlans = await this.listPlans();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;

    for (const plan of allPlans) {
      // Only delete completed or abandoned plans
      if (
        (plan.status === PlanStatus.COMPLETED ||
          plan.status === PlanStatus.ABANDONED) &&
        plan.updatedAt < cutoffDate
      ) {
        const deleted = await this.deletePlan(plan.id);
        if (deleted) deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Clean up stale/interrupted plans (plans not updated within staleDays)
   * This handles plans left in CREATED, APPROVED, PAUSED, EXECUTING, or FAILED state
   * after interruption (Ctrl+C) or crash.
   *
   * @param staleDays Number of days after which a non-completed plan is considered stale (default: 1)
   * @param force If true, deletes stale plans immediately. Otherwise, marks them as ABANDONED first.
   */
  async cleanupStalePlans(staleDays: number = 1, force: boolean = false): Promise<number> {
    const allPlans = await this.listPlans();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - staleDays);

    let cleanedCount = 0;

    for (const plan of allPlans) {
      // Only process non-terminal plans (not completed/abandoned)
      const isTerminal = plan.status === PlanStatus.COMPLETED || plan.status === PlanStatus.ABANDONED;
      if (isTerminal) continue;

      // Check if plan is stale (not updated within staleDays)
      if (plan.updatedAt < cutoffDate) {
        if (force) {
          // Delete immediately
          const deleted = await this.deletePlan(plan.id);
          if (deleted) cleanedCount++;
        } else {
          // Mark as abandoned first
          const fullPlan = await this.loadPlan(plan.id);
          if (fullPlan) {
            fullPlan.status = PlanStatus.ABANDONED;
            fullPlan.updatedAt = new Date();
            await this.savePlan(fullPlan);
            cleanedCount++;
          }
        }
      }
    }

    return cleanedCount;
  }

  /**
   * List stale plans (plans not updated within staleDays that are not completed/abandoned)
   */
  async listStalePlans(staleDays: number = 1): Promise<PlanSummary[]> {
    const allPlans = await this.listPlans();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - staleDays);

    return allPlans.filter((plan) => {
      const isTerminal = plan.status === PlanStatus.COMPLETED || plan.status === PlanStatus.ABANDONED;
      return !isTerminal && plan.updatedAt < cutoffDate;
    });
  }

  /**
   * Check if a plan exists
   */
  planExists(planId: string): boolean {
    return fs.existsSync(path.join(this.getPlanDir(planId), PLAN_FILE));
  }

  /**
   * Get storage stats
   */
  async getStorageStats(): Promise<{
    totalPlans: number;
    resumablePlans: number;
    completedPlans: number;
    totalSizeBytes: number;
  }> {
    const allPlans = await this.listPlans();
    const resumable = allPlans.filter(
      (p) =>
        p.status === PlanStatus.PAUSED ||
        p.status === PlanStatus.FAILED ||
        p.status === PlanStatus.CREATED
    );
    const completed = allPlans.filter(
      (p) => p.status === PlanStatus.COMPLETED
    );

    // Calculate total size
    let totalSize = 0;
    if (fs.existsSync(this.plansDir)) {
      const entries = fs.readdirSync(this.plansDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const planDir = path.join(this.plansDir, entry.name);
          totalSize += this.getDirectorySize(planDir);
        }
      }
    }

    return {
      totalPlans: allPlans.length,
      resumablePlans: resumable.length,
      completedPlans: completed.length,
      totalSizeBytes: totalSize,
    };
  }

  /**
   * Get directory size recursively
   */
  private getDirectorySize(dirPath: string): number {
    let size = 0;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += this.getDirectorySize(entryPath);
      } else {
        size += fs.statSync(entryPath).size;
      }
    }

    return size;
  }

  // ============================================================================
  // Serialization Helpers
  // ============================================================================

  /**
   * Serialize plan for JSON storage (convert Dates to ISO strings)
   */
  private serializePlan(plan: TaskPlan): unknown {
    return {
      ...plan,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      phases: plan.phases.map((phase) => ({
        ...phase,
        startedAt: phase.startedAt?.toISOString(),
        completedAt: phase.completedAt?.toISOString(),
      })),
    };
  }

  /**
   * Deserialize plan from JSON storage (convert ISO strings to Dates)
   * Validates Date objects to prevent Invalid Date issues
   */
  private deserializePlan(data: unknown): TaskPlan {
    const obj = (data ?? {}) as Record<string, unknown>;
    const rawPhases = Array.isArray(obj.phases) ? obj.phases : [];

    // Helper to safely parse dates, returning current date as fallback for invalid strings
    const safeParseDate = (dateStr: unknown, fallback?: Date): Date => {
      if (!dateStr || typeof dateStr !== 'string') {
        return fallback || new Date();
      }
      const date = new Date(dateStr);
      // Check for Invalid Date (NaN timestamp)
      if (isNaN(date.getTime())) {
        return fallback || new Date();
      }
      return date;
    };

    return {
      ...obj,
      createdAt: safeParseDate(obj.createdAt),
      updatedAt: safeParseDate(obj.updatedAt),
      phases: rawPhases.map((phase: Record<string, unknown>) => ({
        ...phase,
        startedAt: phase.startedAt ? safeParseDate(phase.startedAt) : undefined,
        completedAt: phase.completedAt ? safeParseDate(phase.completedAt) : undefined,
      })),
    } as TaskPlan;
  }

  /**
   * Serialize state for JSON storage
   */
  private serializeState(state: SavedPlanState): unknown {
    return {
      ...state,
      plan: this.serializePlan(state.plan),
      savedAt: state.savedAt.toISOString(),
    };
  }

  /**
   * Deserialize state from JSON storage
   * Validates Date objects to prevent Invalid Date issues
   */
  private deserializeState(data: unknown): SavedPlanState {
    const obj = data as Record<string, unknown>;

    // Safely parse savedAt date
    let savedAt = new Date();
    if (obj.savedAt && typeof obj.savedAt === 'string') {
      const parsed = new Date(obj.savedAt);
      if (!isNaN(parsed.getTime())) {
        savedAt = parsed;
      }
    }

    return {
      ...obj,
      plan: this.deserializePlan(obj.plan),
      savedAt,
    } as SavedPlanState;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let planStorageInstance: PlanStorage | null = null;

/**
 * Get the singleton PlanStorage instance
 */
export function getPlanStorage(): PlanStorage {
  if (!planStorageInstance) {
    planStorageInstance = new PlanStorage();
  }
  return planStorageInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetPlanStorage(): void {
  planStorageInstance = null;
}
