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
  SubagentStatus,
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

// REFACTOR: Agent factory registry for cleaner instantiation
type AgentFactory = (config?: Partial<SubagentConfig>) => Subagent;
const AGENT_FACTORIES: ReadonlyMap<SubagentRole, AgentFactory> = new Map<SubagentRole, AgentFactory>([
  [SubagentRole.TESTING, (config) => new TestingAgent(config)],
  [SubagentRole.DOCUMENTATION, (config) => new DocumentationAgent(config)],
  [SubagentRole.REFACTORING, (config) => new RefactoringAgent(config)],
  [SubagentRole.ANALYSIS, (config) => new AnalysisAgent(config)],
  [SubagentRole.DEBUG, (config) => new DebugAgent(config)],
  [SubagentRole.PERFORMANCE, (config) => new PerformanceAgent(config)],
]);

/** Event data types for type-safe event handling */
interface TaskCompletedData {
  taskId: string;
  result: SubagentResult;
}

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
  // Using unknown[] for event handler args to maintain type safety while supporting various event signatures
  private subagentListeners: Map<string, Map<string, (...args: unknown[]) => void>>;

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
    const maxAgents = this.config.maxConcurrentAgents ?? 5;
    if (this.subagents.size >= maxAgents) {
      throw new Error(`Maximum concurrent agents limit (${maxAgents}) reached`);
    }

    // BUG FIX: Apply defaultTimeout from orchestrator config if not specified in subagent config
    const mergedConfig: Partial<SubagentConfig> = {
      timeout: this.config.defaultTimeout,
      ...config, // Allow config to override defaultTimeout
    };

    // REFACTOR: Use factory registry instead of switch statement
    const factory = AGENT_FACTORIES.get(role);
    const subagent = factory ? factory(mergedConfig) : new Subagent(SubagentRole.GENERAL, mergedConfig);

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

  // REFACTOR: Event mapping configuration for data-driven handler registration
  private static readonly EVENT_MAPPINGS: ReadonlyArray<{
    source: string;
    target: string;
    modifyActiveCount?: 'increment' | 'decrement';
    storeResult?: boolean;
  }> = [
    { source: 'task-started', target: 'subagent-start', modifyActiveCount: 'increment' },
    { source: 'task-completed', target: 'subagent-complete', modifyActiveCount: 'decrement', storeResult: true },
    { source: 'task-failed', target: 'subagent-error', modifyActiveCount: 'decrement' },
    { source: 'progress', target: 'subagent-progress' },
    { source: 'tool-executed', target: 'subagent-tool' },
    { source: 'tool-call', target: 'subagent-tool-call' },
    { source: 'tool-result', target: 'subagent-tool-result' },
  ];

  /**
   * Forward events from subagent to orchestrator
   * REFACTOR: Data-driven approach reduces repetitive handler code
   */
  private forwardSubagentEvents(id: string, subagent: Subagent): void {
    // Guard against duplicate listener registration
    if (this.subagentListeners.has(id)) {
      return;
    }

    const handlers = new Map<string, (...args: unknown[]) => void>();

    for (const mapping of SubagentOrchestrator.EVENT_MAPPINGS) {
      const handler = (data: unknown) => {
        // Handle activeCount modifications
        if (mapping.modifyActiveCount === 'increment') {
          this.activeCount++;
        } else if (mapping.modifyActiveCount === 'decrement' && this.activeCount > 0) {
          this.activeCount--;
        }

        // Store result if configured
        if (mapping.storeResult && data && typeof data === 'object' && 'taskId' in data && 'result' in data) {
          const taskData = data as TaskCompletedData;
          this.results.set(taskData.taskId, taskData.result);
        }

        // Forward event with subagentId
        // BUG FIX: Safely spread data only if it's a valid object
        const eventData = data && typeof data === 'object' ? data : {};
        this.emit(mapping.target, { subagentId: id, ...eventData });
      };

      handlers.set(mapping.source, handler as (...args: unknown[]) => void);
      subagent.on(mapping.source, handler);
    }

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

    // BUG FIX: Use Map for O(1) lookup instead of O(n) find() in loop
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // Execute batches sequentially, but tasks within each batch in parallel
    for (const batch of batches) {
      const batchTasks = batch
        .map(taskId => taskMap.get(taskId))
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
   * REFACTOR: Extract failed result creation to reduce duplication
   */
  private createFailedResult(
    taskId: string,
    role: SubagentRole,
    errorMessage: string
  ): SubagentResult {
    const now = new Date();
    return {
      id: `failed-${taskId}`,
      taskId,
      role,
      success: false,
      output: '',
      error: errorMessage,
      executionTime: 0,
      status: {
        id: `status-${taskId}`,
        taskId,
        role,
        state: SubagentState.FAILED,
        progress: 0,
        startTime: now,
        endTime: now,
        error: errorMessage,
      },
    };
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
      }

      // Task failed - use helper to create result
      const task = tasks[i];
      const errorMessage = r.reason?.message || 'Unknown error';

      if (!task) {
        // Fallback for edge case where arrays are misaligned
        return this.createFailedResult(`unknown-${i}`, SubagentRole.GENERAL, `${errorMessage} (task not found)`);
      }

      // BUG FIX: Use inferred role (same as in executeBatch) instead of task.role
      // which may be different from the actual subagent role used
      const inferredRole = this.inferRoleFromTask(task);
      return this.createFailedResult(task.id, inferredRole, errorMessage);
    });
  }

  // REFACTOR: Pre-compiled regex patterns for role inference (avoid creating on each call)
  private static readonly ROLE_PATTERNS: ReadonlyArray<{
    role: SubagentRole;
    pattern: RegExp;
  }> = [
    { role: SubagentRole.TESTING, pattern: /\b(test|testing|tests)\b/i },
    { role: SubagentRole.DOCUMENTATION, pattern: /\b(document|readme|docs|documentation)\b/i },
    { role: SubagentRole.REFACTORING, pattern: /\b(refactor|restructure|refactoring)\b/i },
    { role: SubagentRole.ANALYSIS, pattern: /\b(analyze|review|audit|analysis)\b/i },
    { role: SubagentRole.DEBUG, pattern: /\b(debug|fix|bug|debugging)\b/i },
    { role: SubagentRole.PERFORMANCE, pattern: /\b(performance|optimize|speed|optimization)\b/i },
  ];

  /**
   * Infer subagent role from task description
   * Uses pre-compiled regex patterns for performance
   */
  private inferRoleFromTask(task: SubagentTask): SubagentRole {
    const desc = task.description;

    for (const { role, pattern } of SubagentOrchestrator.ROLE_PATTERNS) {
      if (pattern.test(desc)) {
        return role;
      }
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
   * Uses Promise.allSettled to ensure all subagents are terminated even if some fail
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

    const subagentEntries = Array.from(this.subagents.entries());
    const terminatePromises = subagentEntries.map(
      ([, subagent]) => subagent.terminate()
    );

    // Use Promise.allSettled to ensure all subagents are attempted
    // even if some terminations fail
    const results = await Promise.allSettled(terminatePromises);

    // BUG FIX: Emit event for failures instead of console.warn
    // This allows the caller to handle failures appropriately
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.emit('termination-error', {
          subagentId: subagentEntries[index][0],
          error: result.reason?.message || 'Unknown error',
        });
      }
    });

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
    status: SubagentStatus;
  }> {
    const active: Array<{ id: string; role: SubagentRole; status: SubagentStatus }> = [];

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
   * Add a task to the queue for later processing
   * BUG FIX: taskQueue was declared but never used - now provides queue functionality
   */
  queueTask(task: SubagentTask): void {
    this.taskQueue.push(task);
    this.emit('task-queued', { taskId: task.id, queueLength: this.taskQueue.length });
  }

  /**
   * Add multiple tasks to the queue
   */
  queueTasks(tasks: SubagentTask[]): void {
    for (const task of tasks) {
      this.taskQueue.push(task);
    }
    this.emit('tasks-queued', { count: tasks.length, queueLength: this.taskQueue.length });
  }

  /**
   * Process all queued tasks
   * Clears the queue after processing
   */
  async processQueue(): Promise<SubagentResult[]> {
    if (this.taskQueue.length === 0) {
      return [];
    }

    // Move tasks out of queue before processing
    const tasksToProcess = [...this.taskQueue];
    this.taskQueue = [];

    this.emit('queue-processing', { count: tasksToProcess.length });

    const results = await this.executeParallel(tasksToProcess);

    this.emit('queue-processed', { count: results.length });

    return results;
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.taskQueue.length;
  }

  /**
   * Clear the task queue without processing
   */
  clearQueue(): void {
    const clearedCount = this.taskQueue.length;
    this.taskQueue = [];
    this.emit('queue-cleared', { clearedCount });
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
  monitor(subagentId: string): SubagentStatus | null {
    const subagent = this.subagents.get(subagentId);
    if (!subagent) {
      return null;
    }
    return subagent.getStatus();
  }

  /**
   * Get orchestrator statistics
   * REFACTOR: Single pass through results instead of two filter operations
   */
  getStats(): {
    activeAgents: number;
    totalResults: number;
    successfulTasks: number;
    failedTasks: number;
  } {
    let successfulTasks = 0;
    let failedTasks = 0;

    for (const result of this.results.values()) {
      if (result.success) {
        successfulTasks++;
      } else {
        failedTasks++;
      }
    }

    return {
      activeAgents: this.subagents.size,
      totalResults: this.results.size,
      successfulTasks,
      failedTasks,
    };
  }

  /**
   * Spawn multiple subagents in parallel
   * BUG FIX: Respects maxConcurrentAgents limit by spawning sequentially
   * if the total would exceed the limit
   */
  async spawnParallel(configs: Array<{ role: SubagentRole; config?: Partial<SubagentConfig> }>): Promise<Subagent[]> {
    const maxAgents = this.config.maxConcurrentAgents ?? 5;
    const availableSlots = maxAgents - this.subagents.size;

    if (configs.length > availableSlots) {
      throw new Error(
        `Cannot spawn ${configs.length} agents: only ${availableSlots} slots available (max: ${maxAgents}, current: ${this.subagents.size})`
      );
    }

    return Promise.all(configs.map(({ role, config }) => this.spawn(role, config)));
  }

  /**
   * Send a message to a subagent
   * BUG FIX: Actually call receiveMessage on the subagent instead of just emitting event
   */
  async sendMessage(
    subagentId: string,
    message: string,
    type: 'instruction' | 'cancellation' | 'query' = 'instruction'
  ): Promise<void> {
    const subagent = this.subagents.get(subagentId);
    if (!subagent) {
      throw new Error(`Subagent ${subagentId} not found`);
    }

    // Actually deliver the message to the subagent
    await subagent.receiveMessage({
      from: 'orchestrator',
      to: 'subagent',
      type,
      content: message,
      timestamp: new Date(),
    });

    this.emit('message-sent', { subagentId, message, type });
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}
