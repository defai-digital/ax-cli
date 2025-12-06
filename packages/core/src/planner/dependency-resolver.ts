/**
 * Dependency Resolver
 *
 * Resolves phase dependencies using topological sort.
 * Groups phases into execution batches that can run in parallel.
 */

import { TaskPhase } from "./types.js";

// ============================================================================
// Types
// ============================================================================

/**
 * A batch of phases that can execute together
 */
export interface ExecutionBatch {
  /** Batch index (0-based) */
  index: number;

  /** Phases in this batch */
  phases: TaskPhase[];

  /** Whether phases in this batch can run in parallel */
  canRunInParallel: boolean;

  /** Estimated tokens for this batch */
  estimatedTokens: number;
}

/**
 * Result of dependency resolution
 */
export interface DependencyResolutionResult {
  /** Ordered batches of phases */
  batches: ExecutionBatch[];

  /** Whether the dependency graph is valid (no cycles) */
  isValid: boolean;

  /** Error message if invalid */
  error?: string;

  /** Phases that form a cycle (if any) */
  cyclicPhases?: string[];
}

// ============================================================================
// Dependency Resolver Class
// ============================================================================

export class DependencyResolver {
  /**
   * Resolve dependencies and create execution batches
   *
   * Uses Kahn's algorithm for topological sorting.
   * Groups phases that have no dependencies between them into batches.
   */
  resolve(phases: TaskPhase[]): DependencyResolutionResult {
    // Validate phase IDs are unique
    const ids = new Set<string>();
    for (const phase of phases) {
      if (ids.has(phase.id)) {
        return {
          batches: [],
          isValid: false,
          error: `Duplicate phase ID: ${phase.id}`,
        };
      }
      ids.add(phase.id);
    }

    // Create adjacency list and in-degree map
    const phaseMap = new Map<string, TaskPhase>();
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const phase of phases) {
      phaseMap.set(phase.id, phase);
      inDegree.set(phase.id, 0);
      dependents.set(phase.id, []);
    }

    // Build dependency graph
    for (const phase of phases) {
      for (const depId of phase.dependencies) {
        // Validate dependency exists
        if (!phaseMap.has(depId)) {
          return {
            batches: [],
            isValid: false,
            error: `Phase "${phase.id}" depends on non-existent phase "${depId}"`,
          };
        }

        // Increment in-degree
        inDegree.set(phase.id, (inDegree.get(phase.id) || 0) + 1);

        // Add to dependents list
        const deps = dependents.get(depId) || [];
        deps.push(phase.id);
        dependents.set(depId, deps);
      }
    }

    // Kahn's algorithm with batching
    const batches: ExecutionBatch[] = [];
    const processed = new Set<string>();

    while (processed.size < phases.length) {
      // Find all phases with in-degree 0 (no unprocessed dependencies)
      const ready: TaskPhase[] = [];

      for (const phase of phases) {
        if (processed.has(phase.id)) continue;

        const degree = inDegree.get(phase.id) || 0;
        if (degree === 0) {
          ready.push(phase);
        }
      }

      // No phases ready = cycle detected
      if (ready.length === 0) {
        const remaining = phases
          .filter((p) => !processed.has(p.id))
          .map((p) => p.id);

        return {
          batches: [],
          isValid: false,
          error: `Cyclic dependency detected among phases: ${remaining.join(", ")}`,
          cyclicPhases: remaining,
        };
      }

      // Determine if this batch can run in parallel
      // Phases can run in parallel if:
      // 1. All phases in the batch have canRunInParallel: true
      // 2. No phase in the batch depends on another phase in the same batch
      const canRunInParallel =
        ready.length > 1 && ready.every((p) => p.canRunInParallel);

      // Create batch
      const batch: ExecutionBatch = {
        index: batches.length,
        phases: ready,
        canRunInParallel,
        estimatedTokens: 0, // Will be filled by TokenEstimator
      };

      batches.push(batch);

      // Mark as processed and update in-degrees
      for (const phase of ready) {
        processed.add(phase.id);

        // Decrease in-degree for all dependents
        const deps = dependents.get(phase.id) || [];
        for (const depId of deps) {
          const current = inDegree.get(depId) || 0;
          inDegree.set(depId, current - 1);
        }
      }
    }

    return {
      batches,
      isValid: true,
    };
  }

  /**
   * Get phases that can execute immediately (no pending dependencies)
   */
  getReadyPhases(
    phases: TaskPhase[],
    completedPhaseIds: Set<string>
  ): TaskPhase[] {
    return phases.filter((phase) => {
      // Already completed
      if (completedPhaseIds.has(phase.id)) return false;

      // Check all dependencies are completed
      return phase.dependencies.every((depId) => completedPhaseIds.has(depId));
    });
  }

  /**
   * Check if a phase can be executed given current state
   */
  canExecutePhase(
    phase: TaskPhase,
    completedPhaseIds: Set<string>
  ): { canExecute: boolean; blockedBy: string[] } {
    const blockedBy: string[] = [];

    for (const depId of phase.dependencies) {
      if (!completedPhaseIds.has(depId)) {
        blockedBy.push(depId);
      }
    }

    return {
      canExecute: blockedBy.length === 0,
      blockedBy,
    };
  }

  /**
   * Get the critical path (longest dependency chain)
   */
  getCriticalPath(phases: TaskPhase[]): TaskPhase[] {
    const phaseMap = new Map<string, TaskPhase>();
    for (const phase of phases) {
      phaseMap.set(phase.id, phase);
    }

    // Calculate longest path to each phase using dynamic programming
    const longestPath = new Map<string, number>();
    const predecessor = new Map<string, string | null>();

    // Initialize
    for (const phase of phases) {
      longestPath.set(phase.id, 0);
      predecessor.set(phase.id, null);
    }

    // Process in topological order
    const result = this.resolve(phases);
    if (!result.isValid) return [];

    for (const batch of result.batches) {
      for (const phase of batch.phases) {
        const currentLength = longestPath.get(phase.id) || 0;

        for (const depId of phase.dependencies) {
          const depLength = longestPath.get(depId) || 0;
          if (depLength + 1 > currentLength) {
            longestPath.set(phase.id, depLength + 1);
            predecessor.set(phase.id, depId);
          }
        }
      }
    }

    // Find the phase with the longest path
    let maxLength = -1;
    let maxPhaseId: string | null = null;

    for (const [id, length] of longestPath.entries()) {
      if (length > maxLength) {
        maxLength = length;
        maxPhaseId = id;
      }
    }

    // Reconstruct the critical path
    const criticalPath: TaskPhase[] = [];
    let currentId = maxPhaseId;

    while (currentId) {
      const phase = phaseMap.get(currentId);
      if (phase) {
        criticalPath.unshift(phase);
      }
      currentId = predecessor.get(currentId) || null;
    }

    return criticalPath;
  }

  /**
   * Validate dependency graph
   */
  validate(phases: TaskPhase[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const ids = new Set<string>();

    // Check for duplicate IDs
    for (const phase of phases) {
      if (ids.has(phase.id)) {
        errors.push(`Duplicate phase ID: ${phase.id}`);
      }
      ids.add(phase.id);
    }

    // Check for invalid dependencies
    for (const phase of phases) {
      for (const depId of phase.dependencies) {
        if (!ids.has(depId)) {
          errors.push(
            `Phase "${phase.id}" depends on non-existent phase "${depId}"`
          );
        }

        // Check for self-dependency
        if (depId === phase.id) {
          errors.push(`Phase "${phase.id}" cannot depend on itself`);
        }
      }
    }

    // Check for cycles
    const result = this.resolve(phases);
    if (!result.isValid && result.cyclicPhases) {
      errors.push(
        `Cyclic dependency detected: ${result.cyclicPhases.join(" -> ")}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get a visualization of the dependency graph (ASCII)
   */
  visualize(phases: TaskPhase[]): string {
    const result = this.resolve(phases);
    if (!result.isValid) {
      return `Invalid dependency graph: ${result.error}`;
    }

    const lines: string[] = [];
    lines.push("Execution Order:");
    lines.push("================");

    for (const batch of result.batches) {
      const phaseNames = batch.phases.map((p) => p.name).join(", ");
      const parallel = batch.canRunInParallel ? " [parallel]" : "";
      lines.push(`Batch ${batch.index + 1}: ${phaseNames}${parallel}`);
    }

    lines.push("");
    lines.push("Dependencies:");
    lines.push("=============");

    for (const phase of phases) {
      if (phase.dependencies.length > 0) {
        const deps = phase.dependencies.join(", ");
        lines.push(`${phase.name} <- [${deps}]`);
      } else {
        lines.push(`${phase.name} (no dependencies)`);
      }
    }

    return lines.join("\n");
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let resolverInstance: DependencyResolver | null = null;

/**
 * Get the singleton DependencyResolver instance
 */
export function getDependencyResolver(): DependencyResolver {
  if (!resolverInstance) {
    resolverInstance = new DependencyResolver();
  }
  return resolverInstance;
}
