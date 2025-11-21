/**
 * Subagent Orchestrator
 *
 * Manages the lifecycle of subagents and coordinates parallel task execution.
 * Handles spawning, delegation, dependency resolution, and result aggregation.
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { Subagent } from './subagent.js';
import type {
  SubagentConfig,
  SubagentTask,
  SubagentResult,
} from './subagent-types.js';
import { SubagentRole, SubagentState, DEFAULT_SUBAGENT_CONFIG } from './subagent-types.js';
import { DependencyResolver } from './dependency-resolver.js';

// Import specialized agents
import { TestingAgent } from './specialized/testing-agent.js';
import { DocumentationAgent } from './specialized/documentation-agent.js';
import { RefactoringAgent } from './specialized/refactoring-agent.js';
import { AnalysisAgent } from './specialized/analysis-agent.js';
import { DebugAgent } from './specialized/debug-agent.js';
import { PerformanceAgent } from './specialized/performance-agent.js';

/**
 * SubagentOrchestrator manages multiple subagents
 */
export class SubagentOrchestrator extends EventEmitter {
  private subagents: Map<string, Subagent>;
  private taskQueue: SubagentTask[];
  private results: Map<string, SubagentResult>;
  private dependencyResolver: DependencyResolver;
  private activeCount: number;

  constructor(_maxConcurrent: number = 5) {
    super();

    this.subagents = new Map();
    this.taskQueue = [];
    this.results = new Map();
    this.dependencyResolver = new DependencyResolver();
    this.activeCount = 0;
  }

  /**
   * Spawn a new subagent with the specified role
   */
  async spawnSubagent(
    role: SubagentRole,
    config?: Partial<SubagentConfig>
  ): Promise<Subagent> {
    const subagentId = `${role}-${crypto.randomUUID()}`;

    let subagent: Subagent;

    // Create specialized subagent based on role
    switch (role) {
      case SubagentRole.TESTING:
        subagent = new TestingAgent();
        break;
      case SubagentRole.DOCUMENTATION:
        subagent = new DocumentationAgent();
        break;
      case SubagentRole.REFACTORING:
        subagent = new RefactoringAgent();
        break;
      case SubagentRole.ANALYSIS:
        subagent = new AnalysisAgent();
        break;
      case SubagentRole.DEBUG:
        subagent = new DebugAgent();
        break;
      case SubagentRole.PERFORMANCE:
        subagent = new PerformanceAgent();
        break;
      case SubagentRole.GENERAL:
      default:
        // Create general subagent with merged config
        const baseConfig = DEFAULT_SUBAGENT_CONFIG[SubagentRole.GENERAL];
        const fullConfig: SubagentConfig = {
          role: SubagentRole.GENERAL,
          allowedTools: config?.allowedTools || baseConfig.allowedTools || [],
          maxToolRounds: config?.maxToolRounds || baseConfig.maxToolRounds || 30,
          contextDepth: config?.contextDepth || baseConfig.contextDepth || 20,
          timeout: config?.timeout || 300000,
          priority: config?.priority || baseConfig.priority || 1,
        };
        subagent = new Subagent(fullConfig);
        break;
    }

    // Register subagent
    this.subagents.set(subagentId, subagent);

    // Forward subagent events
    this.forwardSubagentEvents(subagentId, subagent);

    this.emit('subagent-spawned', { id: subagentId, role });

    return subagent;
  }

  /**
   * Forward events from subagent to orchestrator
   */
  private forwardSubagentEvents(id: string, subagent: Subagent): void {
    subagent.on('task-started', (data) => {
      this.activeCount++;
      this.emit('task-started', { subagentId: id, ...data });
    });

    subagent.on('task-completed', (data) => {
      this.activeCount--;
      this.results.set(data.taskId, data.result);
      this.emit('task-completed', { subagentId: id, ...data });
    });

    subagent.on('task-failed', (data) => {
      this.activeCount--;
      this.emit('task-failed', { subagentId: id, ...data });
    });

    subagent.on('progress', (data) => {
      this.emit('progress', { subagentId: id, ...data });
    });

    subagent.on('tool-executed', (data) => {
      this.emit('tool-executed', { subagentId: id, ...data });
    });
  }

  /**
   * Delegate a task to a subagent with the specified role
   */
  async delegateTask(
    task: SubagentTask,
    role?: SubagentRole
  ): Promise<SubagentResult> {
    // Determine role from task if not specified
    const taskRole = role || this.inferRoleFromTask(task);

    // Spawn subagent
    const subagent = await this.spawnSubagent(taskRole);

    try {
      // Execute task
      const result = await subagent.executeTask(task);

      // Store result
      this.results.set(task.id, result);

      return result;
    } finally {
      // Clean up subagent after task completion
      await this.terminateSubagent(subagent);
    }
  }

  /**
   * Execute multiple tasks in parallel
   */
  async executeParallel(tasks: SubagentTask[]): Promise<SubagentResult[]> {
    // Validate dependencies
    if (!this.dependencyResolver.validateDependencies(tasks)) {
      throw new Error('Circular dependencies detected in tasks');
    }

    // Resolve dependencies and get execution batches
    const batches = this.dependencyResolver.resolveDependencies(tasks);

    const allResults: SubagentResult[] = [];

    // Execute batches sequentially, but tasks within each batch in parallel
    for (const batch of batches) {
      const batchTasks = batch.map(taskId =>
        tasks.find(t => t.id === taskId)!
      );

      // Execute batch in parallel
      const batchResults = await this.executeBatch(batchTasks);
      allResults.push(...batchResults);
    }

    return allResults;
  }

  /**
   * Execute a batch of tasks in parallel
   */
  private async executeBatch(tasks: SubagentTask[]): Promise<SubagentResult[]> {
    const promises = tasks.map(async (task) => {
      // Infer role from task
      const role = this.inferRoleFromTask(task);

      // Spawn and execute
      const subagent = await this.spawnSubagent(role);

      try {
        const result = await subagent.executeTask(task);
        this.results.set(task.id, result);
        return result;
      } finally {
        await this.terminateSubagent(subagent);
      }
    });

    // Execute all in parallel with fail-safe
    const results = await Promise.allSettled(promises);

    return results.map((r, i) => {
      if (r.status === 'fulfilled') {
        return r.value;
      } else {
        // Task failed - create a proper SubagentResult
        const task = tasks[i];
        const failedResult: SubagentResult = {
          id: `failed-${task.id}`,
          taskId: task.id,
          role: task.role,
          success: false,
          output: '',
          error: r.reason?.message || 'Unknown error',
          executionTime: 0,
          status: {
            id: `status-${task.id}`,
            taskId: task.id,
            role: task.role,
            state: SubagentState.FAILED,
            progress: 0,
            startTime: new Date(),
            endTime: new Date(),
            error: r.reason?.message || 'Unknown error',
          },
        };
        return failedResult;
      }
    });
  }

  /**
   * Infer subagent role from task description
   */
  private inferRoleFromTask(task: SubagentTask): SubagentRole {
    const desc = task.description.toLowerCase();

    if (desc.includes('test') || desc.includes('testing')) {
      return SubagentRole.TESTING;
    }
    if (desc.includes('document') || desc.includes('readme') || desc.includes('docs')) {
      return SubagentRole.DOCUMENTATION;
    }
    if (desc.includes('refactor') || desc.includes('restructure')) {
      return SubagentRole.REFACTORING;
    }
    if (desc.includes('analyze') || desc.includes('review') || desc.includes('audit')) {
      return SubagentRole.ANALYSIS;
    }
    if (desc.includes('debug') || desc.includes('fix') || desc.includes('bug')) {
      return SubagentRole.DEBUG;
    }
    if (desc.includes('performance') || desc.includes('optimize') || desc.includes('speed')) {
      return SubagentRole.PERFORMANCE;
    }

    return SubagentRole.GENERAL;
  }

  /**
   * Terminate a specific subagent
   */
  private async terminateSubagent(subagent: Subagent): Promise<void> {
    await subagent.terminate();

    // Remove from registry
    for (const [id, agent] of this.subagents) {
      if (agent === subagent) {
        this.subagents.delete(id);
        this.emit('subagent-terminated', { id });
        break;
      }
    }
  }

  /**
   * Terminate all subagents
   */
  async terminateAll(): Promise<void> {
    const terminatePromises = Array.from(this.subagents.values()).map(
      (subagent) => subagent.terminate()
    );

    await Promise.all(terminatePromises);

    this.subagents.clear();
    this.activeCount = 0;
    this.emit('all-terminated');
  }

  /**
   * Get result for a specific task
   */
  getResult(taskId: string): SubagentResult | undefined {
    return this.results.get(taskId);
  }

  /**
   * Get all results
   */
  getAllResults(): Map<string, SubagentResult> {
    return new Map(this.results);
  }

  /**
   * Get orchestrator status
   */
  getStatus(): {
    totalSubagents: number;
    activeSubagents: number;
    completedTasks: number;
    queuedTasks: number;
  } {
    return {
      totalSubagents: this.subagents.size,
      activeSubagents: this.activeCount,
      completedTasks: this.results.size,
      queuedTasks: this.taskQueue.length,
    };
  }

  /**
   * Get list of active subagents
   */
  getActiveSubagents(): Array<{
    id: string;
    role: SubagentRole;
    status: any;
  }> {
    const active: Array<{ id: string; role: SubagentRole; status: any }> = [];

    for (const [id, subagent] of this.subagents) {
      if (subagent.getStatus().isActive) {
        active.push({
          id,
          role: subagent.getStatus().role,
          status: subagent.getStatus(),
        });
      }
    }

    return active;
  }

  /**
   * Clear all results
   */
  clearResults(): void {
    this.results.clear();
  }
}
