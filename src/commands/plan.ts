/**
 * Plan Commands
 *
 * CLI commands for multi-phase task planning system.
 */

import { getTaskPlanner, PlanStatus, PhaseStatus } from "../planner/index.js";
import { getPlanStorage } from "../planner/plan-storage.js";
import type { TaskPlan, PlanSummary } from "../planner/types.js";
import { formatDuration } from "../ui/utils/tool-grouper.js";
import { extractErrorMessage } from "../utils/error-handler.js";

// ============================================================================
// Types
// ============================================================================

export interface PlanCommandResult {
  success: boolean;
  output: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a failed result with consistent error formatting
 */
function failedResult(action: string, error: unknown): PlanCommandResult {
  return {
    success: false,
    output: `Failed to ${action}: ${extractErrorMessage(error)}`,
  };
}

function getStatusIcon(status: PhaseStatus): string {
  switch (status) {
    case PhaseStatus.COMPLETED:
      return "✓";
    case PhaseStatus.EXECUTING:
      return "⏳";
    case PhaseStatus.FAILED:
      return "✕";
    case PhaseStatus.SKIPPED:
      return "⊘";
    case PhaseStatus.APPROVED:
      return "◉";
    case PhaseStatus.QUEUED:
      return "◎";
    case PhaseStatus.CANCELLED:
      return "⊗";
    case PhaseStatus.PENDING:
    default:
      return "○";
  }
}

function getPlanStatusIcon(status: PlanStatus): string {
  switch (status) {
    case PlanStatus.COMPLETED:
      return "✓";
    case PlanStatus.EXECUTING:
      return "⏳";
    case PlanStatus.FAILED:
      return "✕";
    case PlanStatus.PAUSED:
      return "⏸";
    case PlanStatus.ABANDONED:
      return "⊗";
    case PlanStatus.APPROVED:
      return "◉";
    case PlanStatus.CREATED:
    default:
      return "○";
  }
}

function formatPlanSummaryBrief(plan: PlanSummary): string {
  let output = `**${getPlanStatusIcon(plan.status)} Plan: ${plan.id}**\n`;
  output += `  Request: ${plan.originalPrompt.slice(0, 60)}${
    plan.originalPrompt.length > 60 ? "..." : ""
  }\n`;
  output += `  Status: ${plan.status}\n`;
  output += `  Progress: ${plan.completedPhases}/${plan.totalPhases} phases\n`;
  return output;
}

function formatPlanSummary(plan: TaskPlan): string {
  const completed = plan.phases.filter(
    (p) => p.status === PhaseStatus.COMPLETED
  ).length;
  const failed = plan.phases.filter(
    (p) => p.status === PhaseStatus.FAILED
  ).length;
  const total = plan.phases.length;

  let output = `**${getPlanStatusIcon(plan.status)} Plan: ${plan.id}**\n`;
  output += `  Request: ${plan.originalPrompt.slice(0, 60)}${
    plan.originalPrompt.length > 60 ? "..." : ""
  }\n`;
  output += `  Status: ${plan.status}\n`;
  output += `  Progress: ${completed}/${total} phases`;
  if (failed > 0) {
    output += ` (${failed} failed)`;
  }
  output += "\n";

  if (plan.estimatedDuration > 0) {
    output += `  Est. Duration: ${formatDuration(plan.estimatedDuration)}`;
    if (plan.actualDuration > 0) {
      output += ` (Actual: ${formatDuration(plan.actualDuration)})`;
    }
    output += "\n";
  }

  return output;
}

function formatPlanDetails(plan: TaskPlan): string {
  let output = formatPlanSummary(plan);
  output += "\n**Phases:**\n";

  for (const phase of plan.phases) {
    const icon = getStatusIcon(phase.status);
    const isCurrent = phase.index === plan.currentPhaseIndex;
    const marker = isCurrent ? "→ " : "  ";

    output += `${marker}${icon} ${phase.index + 1}. ${phase.name}`;

    if (phase.duration) {
      output += ` (${formatDuration(phase.duration)})`;
    }

    output += "\n";

    if (phase.error) {
      output += `     Error: ${phase.error}\n`;
    }
  }

  return output;
}

// ============================================================================
// Plan Commands
// ============================================================================

/**
 * List all plans
 */
export async function handlePlansCommand(): Promise<PlanCommandResult> {
  try {
    const storage = getPlanStorage();
    const plans = await storage.listPlans();

    if (plans.length === 0) {
      return {
        success: true,
        output: "No plans found. Use AI to create a plan for complex tasks.",
      };
    }

    let output = "**📋 Task Plans**\n\n";

    // Group by status
    const activePlans = plans.filter(
      (p) =>
        p.status === PlanStatus.EXECUTING ||
        p.status === PlanStatus.PAUSED ||
        p.status === PlanStatus.APPROVED
    );
    const recentPlans = plans.filter(
      (p) =>
        p.status === PlanStatus.COMPLETED ||
        p.status === PlanStatus.FAILED ||
        p.status === PlanStatus.ABANDONED
    );

    if (activePlans.length > 0) {
      output += "**Active Plans:**\n";
      for (const plan of activePlans) {
        output += formatPlanSummaryBrief(plan);
        output += "\n";
      }
    }

    if (recentPlans.length > 0) {
      output += "**Recent Plans:**\n";
      for (const plan of recentPlans.slice(0, 5)) {
        output += formatPlanSummaryBrief(plan);
        output += "\n";
      }
    }

    return { success: true, output };
  } catch (error) {
    return failedResult("list plans", error);
  }
}

/**
 * Show details of a specific plan or current plan
 */
export async function handlePlanCommand(
  planId?: string
): Promise<PlanCommandResult> {
  try {
    const planner = getTaskPlanner();
    let plan: TaskPlan | null = null;

    if (planId) {
      const storage = getPlanStorage();
      plan = await storage.loadPlan(planId);
    } else {
      plan = planner.getCurrentPlan();
    }

    if (!plan) {
      return {
        success: false,
        output: planId
          ? `Plan not found: ${planId}`
          : "No active plan. Use /plans to see all plans.",
      };
    }

    return { success: true, output: formatPlanDetails(plan) };
  } catch (error) {
    return failedResult("load plan", error);
  }
}

/**
 * Show phases of current plan
 */
export async function handlePhasesCommand(): Promise<PlanCommandResult> {
  try {
    const planner = getTaskPlanner();
    const plan = planner.getCurrentPlan();

    if (!plan) {
      return {
        success: false,
        output: "No active plan. Ask me to help with a complex task to create one.",
      };
    }

    let output = `**📋 Phases for Plan: ${plan.id}**\n\n`;

    for (const phase of plan.phases) {
      const icon = getStatusIcon(phase.status);
      const isCurrent = phase.index === plan.currentPhaseIndex;
      const marker = isCurrent ? "→ " : "  ";

      output += `${marker}${icon} **Phase ${phase.index + 1}: ${phase.name}**\n`;
      output += `    ${phase.description}\n`;

      if (phase.objectives.length > 0) {
        output += "    Objectives:\n";
        for (const obj of phase.objectives.slice(0, 3)) {
          output += `      • ${obj}\n`;
        }
        if (phase.objectives.length > 3) {
          output += `      ...and ${phase.objectives.length - 3} more\n`;
        }
      }

      if (phase.toolsRequired.length > 0) {
        output += `    Tools: ${phase.toolsRequired.join(", ")}\n`;
      }

      if (phase.duration) {
        output += `    Duration: ${formatDuration(phase.duration)}\n`;
      }

      if (phase.error) {
        output += `    Error: ${phase.error}\n`;
      }

      output += "\n";
    }

    return { success: true, output };
  } catch (error) {
    return failedResult("show phases", error);
  }
}

/**
 * Pause current plan execution
 */
export async function handlePauseCommand(): Promise<PlanCommandResult> {
  try {
    const planner = getTaskPlanner();
    const plan = planner.getCurrentPlan();

    if (!plan) {
      return {
        success: false,
        output: "No active plan to pause.",
      };
    }

    await planner.pausePlan();

    return {
      success: true,
      output: "Plan execution paused. Use /resume to continue.",
    };
  } catch (error) {
    return failedResult("pause", error);
  }
}

/**
 * Resume paused plan
 * Note: This marks the plan as ready to resume. Actual execution
 * requires the LLMAgent to process it with a phase executor.
 */
export async function handleResumeCommand(
  planId?: string
): Promise<PlanCommandResult> {
  try {
    const planner = getTaskPlanner();
    const storage = getPlanStorage();

    // Determine which plan to resume
    let targetPlanId = planId;
    if (!targetPlanId) {
      const currentPlan = planner.getCurrentPlan();
      if (currentPlan) {
        targetPlanId = currentPlan.id;
      }
    }

    if (!targetPlanId) {
      return {
        success: false,
        output: "No plan specified and no current plan. Use /plans to see available plans.",
      };
    }

    // Load the plan to check its status
    const plan = await storage.loadPlan(targetPlanId);
    if (!plan) {
      return { success: false, output: `Plan not found: ${targetPlanId}` };
    }

    // Check if plan can be resumed
    if (plan.status !== PlanStatus.PAUSED) {
      return {
        success: false,
        output: `Plan ${targetPlanId} is not paused (status: ${plan.status})`,
      };
    }

    // Mark plan ready for resume - actual execution happens when user sends next message
    return {
      success: true,
      output: `Plan ${targetPlanId} is ready to resume from phase ${plan.currentPhaseIndex + 1}.\n\nSend your next message to continue execution.`,
    };
  } catch (error) {
    return failedResult("check plan", error);
  }
}

/**
 * Skip current phase
 */
export async function handleSkipPhaseCommand(): Promise<PlanCommandResult> {
  try {
    const planner = getTaskPlanner();
    const plan = planner.getCurrentPlan();

    if (!plan) {
      return { success: false, output: "No active plan." };
    }

    const currentPhase = plan.phases[plan.currentPhaseIndex];
    if (!currentPhase) {
      return { success: false, output: "No current phase to skip." };
    }

    await planner.skipPhase(plan.id, currentPhase.id);

    return {
      success: true,
      output: `Skipped phase: ${currentPhase.name}`,
    };
  } catch (error) {
    return failedResult("skip phase", error);
  }
}

/**
 * Abandon current plan
 */
export async function handleAbandonCommand(): Promise<PlanCommandResult> {
  try {
    const planner = getTaskPlanner();
    const plan = planner.getCurrentPlan();

    if (!plan) {
      return {
        success: false,
        output: "No active plan to abandon.",
      };
    }

    await planner.abandonPlan(plan.id);

    return {
      success: true,
      output: "Plan abandoned. All pending phases have been cancelled.",
    };
  } catch (error) {
    return failedResult("abandon plan", error);
  }
}

/**
 * List resumable plans
 */
export async function handleResumableCommand(): Promise<PlanCommandResult> {
  try {
    const storage = getPlanStorage();
    const plans = await storage.listResumablePlans();

    if (plans.length === 0) {
      return { success: true, output: "No resumable plans found." };
    }

    let output = "**Resumable Plans:**\n\n";

    for (const plan of plans) {
      output += formatPlanSummaryBrief(plan);
      output += `  Use: /resume ${plan.id}\n\n`;
    }

    return { success: true, output };
  } catch (error) {
    return failedResult("list resumable plans", error);
  }
}
