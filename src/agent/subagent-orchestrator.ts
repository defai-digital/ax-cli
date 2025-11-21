/**
 * Subagent Orchestrator
 *
 * Manages the lifecycle of subagents and coordinates parallel task execution.
 * Handles spawning, delegation, dependency resolution, and result aggregation.
 */

import { EventEmitter } from 'events';
import { Subagent } from './subagent.js';
import type {
  SubagentConfig,
  SubagentTask,
  SubagentResult,
} from './subagent-types.js';
import { SubagentRole, SubagentState } from './subagent-types.js';
import { DependencyResolver } from './dependency-resolver.js';

// Import specialized agents
import { TestingAgent } from './specialized/testing-agent.js';
import { DocumentationAgent } from './specialized/documentation-agent.js';
import { RefactoringAgent } from './specialized/refactoring-agent.js';
import { AnalysisAgent } from './specialized/analysis-agent.js';
import { DebugAgent } from './specialized/debug-agent.js';
import { PerformanceAgent } from './specialized/performance-agent.js';

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  maxConcurrentAgents?: number;
  defaultTimeout?: number;
  autoCheckpoint?: boolean;
  verbose?: boolean;
}

/**
 * SubagentOrchestrator manages multiple subagents
 */
export class SubagentOrchestrator extends EventEmitter {
  private subagents: Map<string, Subagent>;
  private taskQueue: SubagentTask[];
  private results: Map<string, SubagentResult>;
  private dependencyResolver: DependencyResolver;
  private activeCount: number;
  private config: OrchestratorConfig;
  // Track event listeners for cleanup to prevent memory leaks
  private subagentListeners: Map<string, Map<string, (...args: any[]) => void>>;

  constructor(config?: OrchestratorConfig) {
    super();

    this.config = {
      maxConcurrentAgents: 5,
      defaultTimeout: 300000,
      autoCheckpoint: false,
      verbose: false,
      ...config,
    };

    this.subagents = new Map();
    this.taskQueue = [];
    this.results = new Map();
    this.dependencyResolver = new DependencyResolver();
    this.activeCount = 0;
    this.subagentListeners = new Map();
  }

  /**
   * Spawn a new subagent with the specified role
   */
  async spawn(
    role: SubagentRole,
    config?: Partial<SubagentConfig>
  ): Promise<Subagent> {
    // Check max concurrent agents limit
    if (this.subagents.size >= this.config.maxConcurrentAgents!) {
      throw new Error(`Maximum concurrent agents limit (${this.config.maxConcurrentAgents}) reached`);
    }

    let subagent: Subagent;

    // Create specialized subagent based on role
    switch (role) {
      case SubagentRole.TESTING:
        subagent = new TestingAgent(config);
        break;
      case SubagentRole.DOCUMENTATION:
        subagent = new DocumentationAgent(config);
        break;
      case SubagentRole.REFACTORING:
        subagent = new RefactoringAgent(config);
        break;
      case SubagentRole.ANALYSIS:
        subagent = new AnalysisAgent(config);
        break;
      case SubagentRole.DEBUG:
        subagent = new DebugAgent(config);
        break;
      case SubagentRole.PERFORMANCE:
        subagent = new PerformanceAgent(config);
        break;
      case SubagentRole.GENERAL:
      default:
        subagent = new Subagent(SubagentRole.GENERAL, config);
        break;
    }

    // Register subagent using its own ID
    this.subagents.set(subagent.id, subagent);

    // Forward subagent events
    this.forwardSubagentEvents(subagent.id, subagent);

    this.emit('spawn', { id: subagent.id, role });

    return subagent;
  }

  /**
   * Alias for spawn() for backward compatibility
   */
  async spawnSubagent(
    role: SubagentRole,
    config?: Partial<SubagentConfig>
  ): Promise<Subagent> {
    return this.spawn(role, config);
  }

  /**
   * Forward events from subagent to orchestrator
   * Stores listeners for proper cleanup to prevent memory leaks
   */
  private forwardSubagentEvents(id: string, subagent: Subagent): void {
    // Create named handlers so we can remove them later
    const handlers = new Map<string, (...args: any[]) => void>();

    const taskStartedHandler = (data: any) => {
      this.activeCount++;
      this.emit('subagent-start', { subagentId: id, ...data });
    };
    handlers.set('task-started', taskStartedHandler);
    subagent.on('task-started', taskStartedHandler);

    const taskCompletedHandler = (data: any) => {
      this.activeCount--;
      this.results.set(data.taskId, data.result);
      this.emit('subagent-complete', { subagentId: id, ...data });
    };
    handlers.set('task-completed', taskCompletedHandler);
    subagent.on('task-completed', taskCompletedHandler);

    const taskFailedHandler = (data: any) => {
      this.activeCount--;
      this.emit('subagent-error', { subagentId: id, ...data });
    };
    handlers.set('task-failed', taskFailedHandler);
    subagent.on('task-failed', taskFailedHandler);

    const progressHandler = (data: any) => {
      this.emit('subagent-progress', { subagentId: id, ...data });
    };
    handlers.set('progress', progressHandler);
    subagent.on('progress', progressHandler);

    const toolExecutedHandler = (data: any) => {
      this.emit('subagent-tool', { subagentId: id, ...data });
    };
    handlers.set('tool-executed', toolExecutedHandler);
    subagent.on('tool-executed', toolExecutedHandler);

    // Store handlers for cleanup
    this.subagentListeners.set(id, handlers);
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
      await this.terminateSubagent(subagent.id);
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
      const batchTasks = batch
        .map(taskId => tasks.find(t => t.id === taskId))
        .filter((task): task is SubagentTask => task !== undefined);

      // Skip empty batches (shouldn't happen with valid dependency resolution)
      if (batchTasks.length === 0) continue;

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
        await this.terminateSubagent(subagent.id);
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
   * Terminate a specific subagent by ID
   * Properly removes event listeners to prevent memory leaks
   */
  async terminateSubagent(subagentId: string): Promise<void> {
    const subagent = this.subagents.get(subagentId);
    if (!subagent) {
      return; // Gracefully handle non-existent subagent
    }

    // Remove event listeners to prevent memory leaks
    const handlers = this.subagentListeners.get(subagentId);
    if (handlers) {
      for (const [event, handler] of handlers) {
        subagent.off(event, handler);
      }
      this.subagentListeners.delete(subagentId);
    }

    await subagent.terminate();
    this.subagents.delete(subagentId);
    this.emit('terminate', { id: subagentId });
  }

  /**
   * Terminate all subagents
   * Properly removes all event listeners to prevent memory leaks
   */
  async terminateAll(): Promise<void> {
    // Remove all event listeners before terminating
    for (const [subagentId, subagent] of this.subagents) {
      const handlers = this.subagentListeners.get(subagentId);
      if (handlers) {
        for (const [event, handler] of handlers) {
          subagent.off(event, handler);
        }
      }
    }
    this.subagentListeners.clear();

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
      const status = subagent.getStatus();
      // Check if state is RUNNING (active)
      if (status.state === SubagentState.RUNNING) {
        active.push({
          id,
          role: status.role,
          status: status,
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

  /**
   * Get all active subagents (alias for tests)
   */
  getActive(): Subagent[] {
    return Array.from(this.subagents.values());
  }

  /**
   * Monitor a specific subagent's status
   */
  monitor(subagentId: string): any {
    const subagent = this.subagents.get(subagentId);
    if (!subagent) {
      return null;
    }
    return subagent.getStatus();
  }

  /**
   * Get orchestrator statistics
   */
  getStats(): {
    activeAgents: number;
    totalResults: number;
    successfulTasks: number;
    failedTasks: number;
  } {
    const results = Array.from(this.results.values());
    return {
      activeAgents: this.subagents.size,
      totalResults: results.length,
      successfulTasks: results.filter(r => r.success).length,
      failedTasks: results.filter(r => !r.success).length,
    };
  }

  /**
   * Spawn multiple subagents in parallel
   */
  async spawnParallel(configs: Array<{ role: SubagentRole; config?: Partial<SubagentConfig> }>): Promise<Subagent[]> {
    return Promise.all(configs.map(({ role, config }) => this.spawn(role, config)));
  }

  /**
   * Send a message to a subagent
   */
  async sendMessage(subagentId: string, message: string): Promise<void> {
    const subagent = this.subagents.get(subagentId);
    if (!subagent) {
      throw new Error(`Subagent ${subagentId} not found`);
    }
    // Subagent will handle the message via receiveMessage method
    // For now, just emit an event
    this.emit('message-sent', { subagentId, message });
  }
}
