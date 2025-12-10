/**
 * Dependency Resolver
 *
 * Resolves task dependencies and determines execution order for subagents.
 * Implements topological sorting with cycle detection.
 */

import type { SubagentTask, DependencyGraph, DependencyNode } from './subagent-types.js';

/**
 * DependencyResolver class for managing task dependencies
 */
export class DependencyResolver {
  /**
   * Resolve task dependencies and return execution batches
   * Tasks in the same batch can be executed in parallel
   *
   * @param tasks Array of tasks to resolve
   * @returns Array of batches, where each batch is an array of task IDs
   */
  resolveDependencies(tasks: SubagentTask[]): string[][] {
    // Build dependency graph
    const graph = this.buildDependencyGraph(tasks);

    // Check for cycles
    if (this.hasCycle(graph)) {
      throw new Error('Circular dependency detected in task graph');
    }

    // Perform topological sort
    const sorted = this.topologicalSort(graph, tasks);

    // Group into parallel batches
    return this.groupIntoBatches(sorted, graph, tasks);
  }

  /**
   * Validate that there are no circular dependencies
   *
   * @param tasks Array of tasks to validate
   * @returns true if valid, false if circular dependencies exist
   */
  validateDependencies(tasks: SubagentTask[]): boolean {
    try {
      const graph = this.buildDependencyGraph(tasks);
      return !this.hasCycle(graph);
    } catch {
      // Validation failed - treat as invalid dependencies
      return false;
    }
  }

  /**
   * Get dependency graph structure
   *
   * @param tasks Array of tasks
   * @returns DependencyGraph object with nodes and execution order
   */
  getDependencyGraph(tasks: SubagentTask[]): DependencyGraph {
    const graph = this.buildDependencyGraph(tasks);
    const hasCycles = this.hasCycle(graph);

    if (hasCycles) {
      const cycles = this.findCycles(graph, tasks);
      return {
        nodes: graph,
        executionOrder: [],
        hasCycles: true,
        cycles,
      };
    }

    const sorted = this.topologicalSort(graph, tasks);
    const executionOrder = this.groupIntoBatches(sorted, graph, tasks);

    return {
      nodes: graph,
      executionOrder,
      hasCycles: false,
    };
  }

  // ==================== Private Methods ====================

  /**
   * Build dependency graph from tasks
   */
  private buildDependencyGraph(tasks: SubagentTask[]): Map<string, DependencyNode> {
    const graph = new Map<string, DependencyNode>();

    // Initialize all nodes
    for (const task of tasks) {
      graph.set(task.id, {
        taskId: task.id,
        dependencies: task.dependencies || [],
        dependents: [],
        level: 0,
      });
    }

    // Build dependent relationships
    for (const task of tasks) {
      if (task.dependencies) {
        for (const depId of task.dependencies) {
          const depNode = graph.get(depId);
          if (depNode) {
            depNode.dependents.push(task.id);
          } else {
            throw new Error(`Task ${task.id} depends on non-existent task ${depId}`);
          }
        }
      }
    }

    return graph;
  }

  /**
   * Perform topological sort using Kahn's algorithm
   */
  private topologicalSort(
    graph: Map<string, DependencyNode>,
    tasks: SubagentTask[]
  ): string[] {
    // Calculate in-degrees
    const inDegree = new Map<string, number>();
    for (const [nodeId, node] of graph) {
      inDegree.set(nodeId, node.dependencies.length);
    }

    // Find nodes with in-degree 0
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    // Process queue
    const result: string[] = [];
    // Create task lookup map for O(1) access
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    let needsResorting = true; // PERFORMANCE FIX: Only resort when new nodes added

    while (queue.length > 0) {
      // PERFORMANCE FIX: Only sort when new elements were added, not every iteration
      // This reduces complexity from O(n²log n) to O(n log n)
      if (needsResorting) {
        queue.sort((a, b) => {
          const taskA = taskMap.get(a);
          const taskB = taskMap.get(b);
          // Default to 0 priority if task not found (shouldn't happen in valid input)
          return (taskB?.priority ?? 0) - (taskA?.priority ?? 0);
        });
        needsResorting = false;
      }

      const nodeId = queue.shift();
      if (!nodeId) {
        throw new Error("Queue is empty but expected nodes");
      }
      result.push(nodeId);

      const node = graph.get(nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found in graph`);
      }
      for (const dependentId of node.dependents) {
        const currentDegree = inDegree.get(dependentId);
        if (currentDegree === undefined) {
          throw new Error(`In-degree not found for dependent node ${dependentId}`);
        }
        const newDegree = currentDegree - 1;
        inDegree.set(dependentId, newDegree);

        if (newDegree === 0) {
          queue.push(dependentId);
          needsResorting = true; // PERFORMANCE FIX: Mark for resorting after adding elements
        }
      }
    }

    return result;
  }

  /**
   * Group sorted tasks into parallel execution batches
   */
  private groupIntoBatches(
    sorted: string[],
    graph: Map<string, DependencyNode>,
    tasks: SubagentTask[]
  ): string[][] {
    const batches: string[][] = [];

    // Assign levels to each node
    const levels = new Map<string, number>();
    for (const nodeId of sorted) {
      const node = graph.get(nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found in graph during level assignment`);
      }
      let maxDepLevel = -1;

      for (const depId of node.dependencies) {
        const depLevel = levels.get(depId) || 0;
        maxDepLevel = Math.max(maxDepLevel, depLevel);
      }

      const level = maxDepLevel + 1;
      levels.set(nodeId, level);
      node.level = level;
    }

    // Group by level
    // Handle empty levels case to prevent -Infinity from Math.max
    if (levels.size === 0) {
      return batches; // Return empty batches for empty task set
    }
    const maxLevel = Math.max(...Array.from(levels.values()));
    for (let level = 0; level <= maxLevel; level++) {
      const batch: string[] = [];

      for (const [nodeId, nodeLevel] of levels) {
        if (nodeLevel === level) {
          batch.push(nodeId);
        }
      }

      if (batch.length > 0) {
        // Sort by priority within batch
        batch.sort((a, b) => {
          const taskA = tasks.find(t => t.id === a);
          const taskB = tasks.find(t => t.id === b);
          return (taskB?.priority || 0) - (taskA?.priority || 0);
        });

        batches.push(batch);
      }
    }

    return batches;
  }

  /**
   * Check if graph has cycles using DFS
   */
  private hasCycle(graph: Map<string, DependencyNode>): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const nodeId of graph.keys()) {
      if (this.hasCycleUtil(nodeId, graph, visited, recursionStack)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Utility function for cycle detection
   */
  private hasCycleUtil(
    nodeId: string,
    graph: Map<string, DependencyNode>,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    if (recursionStack.has(nodeId)) {
      return true; // Cycle detected
    }

    if (visited.has(nodeId)) {
      return false; // Already processed
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = graph.get(nodeId);
    if (!node) {
      recursionStack.delete(nodeId);
      return false; // Node not found, no cycle from this node
    }
    
    for (const dependentId of node.dependents) {
      if (this.hasCycleUtil(dependentId, graph, visited, recursionStack)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  /**
   * Find all cycles in the graph
   */
  private findCycles(
    graph: Map<string, DependencyNode>,
    _tasks: SubagentTask[]
  ): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack: string[] = [];

    for (const nodeId of graph.keys()) {
      if (!visited.has(nodeId)) {
        this.findCyclesUtil(nodeId, graph, visited, recursionStack, cycles);
      }
    }

    return cycles;
  }

  /**
   * Utility function for finding cycles
   */
  private findCyclesUtil(
    nodeId: string,
    graph: Map<string, DependencyNode>,
    visited: Set<string>,
    recursionStack: string[],
    cycles: string[][]
  ): void {
    visited.add(nodeId);
    recursionStack.push(nodeId);

    const node = graph.get(nodeId);
    if (!node) {
      recursionStack.pop();
      return; // Node not found, skip
    }
    
    for (const dependentId of node.dependents) {
      if (!visited.has(dependentId)) {
        this.findCyclesUtil(dependentId, graph, visited, recursionStack, cycles);
      } else {
        // Found a cycle
        const cycleStart = recursionStack.indexOf(dependentId);
        if (cycleStart !== -1) {
          const cycle = recursionStack.slice(cycleStart);
          cycle.push(dependentId); // Complete the cycle
          cycles.push(cycle);
        }
      }
    }

    recursionStack.pop();
  }

  /**
   * Get execution level for a task
   * Level 0 = no dependencies, Level N = depends on tasks at level N-1
   */
  getTaskLevel(taskId: string, tasks: SubagentTask[]): number {
    // Use getDependencyGraph to get properly calculated levels
    const { nodes } = this.getDependencyGraph(tasks);
    const node = nodes.get(taskId);

    if (!node) {
      throw new Error(`Task ${taskId} not found`);
    }

    return node.level;
  }

  /**
   * Get all tasks that can be executed in parallel
   */
  getParallelTasks(tasks: SubagentTask[]): string[][] {
    return this.resolveDependencies(tasks);
  }

  /**
   * Check if a task can be executed given completed tasks
   * Supports both array and Map for task lookup (Map provides O(1) lookup)
   */
  canExecuteTask(
    taskId: string,
    completedTaskIds: Set<string>,
    tasks: SubagentTask[] | Map<string, SubagentTask>
  ): boolean {
    // Support both array and Map for O(1) lookup when using Map
    const task = tasks instanceof Map
      ? tasks.get(taskId)
      : tasks.find(t => t.id === taskId);

    if (!task) {
      return false;
    }

    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    // All dependencies must be completed
    return task.dependencies.every(depId => completedTaskIds.has(depId));
  }

  /**
   * Get tasks that are ready to execute
   */
  getReadyTasks(tasks: SubagentTask[], completedTaskIds: Set<string>): SubagentTask[] {
    return tasks.filter(task => {
      // Skip if already completed
      if (completedTaskIds.has(task.id)) {
        return false;
      }

      // Check if dependencies are met
      return this.canExecuteTask(task.id, completedTaskIds, tasks);
    });
  }
}

/**
 * Create a new dependency resolver instance
 */
export function createDependencyResolver(): DependencyResolver {
  return new DependencyResolver();
}
