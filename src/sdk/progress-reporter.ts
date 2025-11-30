/**
 * Progress Reporter - Shared event system for AX <-> ax-cli integration
 *
 * Allows AutomatosX agents to report progress to ax-cli UI in real-time.
 * This creates a unified progress visibility system across both applications.
 */

import { EventEmitter } from 'events';

/**
 * Progress event types
 */
export enum ProgressEventType {
  /** Agent started a new task */
  TASK_START = 'task_start',
  /** Agent made progress on current task */
  TASK_PROGRESS = 'task_progress',
  /** Agent completed a task */
  TASK_COMPLETE = 'task_complete',
  /** Agent encountered an error */
  TASK_ERROR = 'task_error',
  /** Tool execution started */
  TOOL_START = 'tool_start',
  /** Tool execution completed */
  TOOL_COMPLETE = 'tool_complete',
  /** General status update */
  STATUS_UPDATE = 'status_update',
}

/**
 * Progress event data
 */
export interface ProgressEvent {
  /** Event type */
  type: ProgressEventType;
  /** Agent identifier (e.g., "ax-agent-1", "ax-cli-main") */
  agentId: string;
  /** Task or tool name */
  name: string;
  /** Optional message */
  message?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

/**
 * Progress Reporter - Singleton event emitter for progress tracking
 */
export class ProgressReporter extends EventEmitter {
  private static instance: ProgressReporter | null = null;

  private constructor() {
    super();
    // Allow more listeners (multiple agents can subscribe)
    this.setMaxListeners(50);
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ProgressReporter {
    if (!ProgressReporter.instance) {
      ProgressReporter.instance = new ProgressReporter();
    }
    return ProgressReporter.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static reset(): void {
    if (ProgressReporter.instance) {
      ProgressReporter.instance.removeAllListeners();
      ProgressReporter.instance = null;
    }
  }

  /**
   * Report a progress event
   */
  report(event: Omit<ProgressEvent, 'timestamp'>): void {
    const fullEvent: ProgressEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.emit('progress', fullEvent);
    this.emit(event.type, fullEvent);
  }

  /**
   * Report task start
   */
  taskStart(agentId: string, name: string, message?: string): void {
    this.report({
      type: ProgressEventType.TASK_START,
      agentId,
      name,
      message,
      progress: 0,
    });
  }

  /**
   * Report task progress
   */
  taskProgress(agentId: string, name: string, progress: number, message?: string): void {
    this.report({
      type: ProgressEventType.TASK_PROGRESS,
      agentId,
      name,
      progress: Math.max(0, Math.min(100, progress)),
      message,
    });
  }

  /**
   * Report task completion
   */
  taskComplete(agentId: string, name: string, message?: string): void {
    this.report({
      type: ProgressEventType.TASK_COMPLETE,
      agentId,
      name,
      message,
      progress: 100,
    });
  }

  /**
   * Report task error
   */
  taskError(agentId: string, name: string, error: string): void {
    this.report({
      type: ProgressEventType.TASK_ERROR,
      agentId,
      name,
      message: error,
    });
  }

  /**
   * Report tool execution start
   */
  toolStart(agentId: string, toolName: string, message?: string): void {
    this.report({
      type: ProgressEventType.TOOL_START,
      agentId,
      name: toolName,
      message,
    });
  }

  /**
   * Report tool execution completion
   */
  toolComplete(agentId: string, toolName: string, message?: string): void {
    this.report({
      type: ProgressEventType.TOOL_COMPLETE,
      agentId,
      name: toolName,
      message,
    });
  }

  /**
   * Report general status update
   */
  statusUpdate(agentId: string, message: string, metadata?: Record<string, unknown>): void {
    this.report({
      type: ProgressEventType.STATUS_UPDATE,
      agentId,
      name: 'status',
      message,
      metadata,
    });
  }

  /**
   * Subscribe to all progress events
   */
  onProgress(callback: (event: ProgressEvent) => void): () => void {
    this.on('progress', callback);
    return () => this.off('progress', callback);
  }

  /**
   * Subscribe to specific event type
   */
  onEvent(type: ProgressEventType, callback: (event: ProgressEvent) => void): () => void {
    this.on(type, callback);
    return () => this.off(type, callback);
  }

  /**
   * Get statistics about event emission
   */
  getStats(): {
    listenerCount: number;
    maxListeners: number;
  } {
    return {
      listenerCount: this.listenerCount('progress'),
      maxListeners: this.getMaxListeners(),
    };
  }
}

/**
 * Get the global progress reporter instance
 */
export function getProgressReporter(): ProgressReporter {
  return ProgressReporter.getInstance();
}
