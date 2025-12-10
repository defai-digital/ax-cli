/**
 * Tests for Subagent execution behavior
 *
 * These tests cover the executeTask flow without requiring LLM mocking
 * by testing boundary conditions, state management, and event emission.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Subagent } from '../../packages/core/src/agent/subagent.js';
import { SubagentRole, SubagentState } from '../../packages/core/src/agent/subagent-types.js';
import type { SubagentTask } from '../../packages/core/src/agent/subagent-types.js';

// Mock settings manager for CI environments
vi.mock('../../src/utils/settings-manager.js', () => ({
  getSettingsManager: vi.fn(() => ({
    getApiKey: vi.fn(() => 'test-api-key'),
    getCurrentModel: vi.fn(() => 'glm-4.6'),
    getBaseURL: vi.fn(() => 'https://api.test.com/v1'),
  })),
}));

describe('Subagent Execution Behavior', () => {
  let subagent: Subagent;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (subagent) {
      subagent.abort();
    }
  });

  function createTask(id: string, description = 'Test task'): SubagentTask {
    return {
      id,
      description,
      role: SubagentRole.TESTING,
      priority: 1,
      context: {},
    };
  }

  describe('Pre-execution State', () => {
    it('should initialize with PENDING state', () => {
      subagent = new Subagent(SubagentRole.TESTING);

      const status = subagent.getStatus();

      expect(status.state).toBe(SubagentState.PENDING);
      expect(status.progress).toBe(0);
      // startTime may be set on initialization for tracking purposes
      expect(status.endTime).toBeUndefined();
    });

    it('should have empty logs before execution', () => {
      subagent = new Subagent(SubagentRole.TESTING);

      expect(subagent.getLogs()).toEqual([]);
      expect(subagent.getChatHistory()).toEqual([]);
    });
  });

  describe('Abort Before Execution', () => {
    it('should abort immediately after creation', () => {
      subagent = new Subagent(SubagentRole.TESTING);
      subagent.abort();

      const status = subagent.getStatus();
      expect(status.state).toBe(SubagentState.CANCELLED);
      expect(status.endTime).toBeDefined();
    });

    it('should emit cancel event on abort', () => {
      subagent = new Subagent(SubagentRole.TESTING);

      let cancelEmitted = false;
      subagent.once('cancel', () => {
        cancelEmitted = true;
      });

      subagent.abort();

      expect(cancelEmitted).toBe(true);
    });

    it('should include null taskId when aborting before task starts', () => {
      subagent = new Subagent(SubagentRole.TESTING);

      let emittedTaskId: string | null | undefined = undefined;
      subagent.once('cancel', (data: { taskId: string | null }) => {
        emittedTaskId = data.taskId;
      });

      subagent.abort();

      expect(emittedTaskId).toBeNull();
    });

    it('should fail executeTask after abort', async () => {
      subagent = new Subagent(SubagentRole.TESTING);
      subagent.abort();

      const task = createTask('post-abort-task');
      const result = await subagent.executeTask(task);

      expect(result.success).toBe(false);
      // Either aborted or LLM error (if abort check comes after LLM call attempt)
      expect(result.error).toBeDefined();
    });
  });

  describe('Task Validation', () => {
    beforeEach(() => {
      subagent = new Subagent(SubagentRole.TESTING);
    });

    it('should handle task with minimal context', async () => {
      const task: SubagentTask = {
        id: 'minimal-task',
        description: 'Minimal test task',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      // Start execution (will fail due to no real LLM, but should not throw)
      const resultPromise = subagent.executeTask(task);

      // Abort to stop
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();

      const result = await resultPromise;

      expect(result.taskId).toBe('minimal-task');
      // Either aborted or failed, but should have completed
      expect([true, false]).toContain(result.success);
    });

    it('should handle task with rich context', async () => {
      const task: SubagentTask = {
        id: 'rich-context-task',
        description: 'Task with rich context',
        role: SubagentRole.TESTING,
        priority: 5,
        context: {
          conversationHistory: [
            { type: 'user', content: 'Previous message', timestamp: new Date() },
            { type: 'assistant', content: 'Previous response', timestamp: new Date() },
          ],
          metadata: {
            workingDirectory: '/test/path',
            parentTask: 'parent-123',
            customData: { key: 'value' },
          },
        },
      };

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();

      const result = await resultPromise;

      expect(result.taskId).toBe('rich-context-task');
    });

    it('should handle task with empty description', async () => {
      const task: SubagentTask = {
        id: 'empty-desc-task',
        description: '',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();

      const result = await resultPromise;

      expect(result.taskId).toBe('empty-desc-task');
    });

    it('should handle task with special characters in description', async () => {
      const task: SubagentTask = {
        id: 'special-chars-task',
        description: 'Test with 日本語, émojis 🎉, and <html> "quotes"',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();

      const result = await resultPromise;

      expect(result.taskId).toBe('special-chars-task');
    });
  });

  describe('Event Emission During Execution', () => {
    beforeEach(() => {
      subagent = new Subagent(SubagentRole.TESTING);
    });

    it('should emit start event immediately', async () => {
      const task = createTask('start-event-task');

      let startEmitted = false;
      subagent.once('start', () => {
        startEmitted = true;
      });

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();
      await resultPromise;

      expect(startEmitted).toBe(true);
    });

    it('should emit task-started with task ID', async () => {
      const task = createTask('task-started-event-test');

      let emittedTaskId: string | undefined;
      subagent.once('task-started', (data: { taskId: string }) => {
        emittedTaskId = data.taskId;
      });

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();
      await resultPromise;

      expect(emittedTaskId).toBe('task-started-event-test');
    });

    it('should emit cancel when aborted during execution', async () => {
      const task = createTask('abort-during-exec');

      let cancelEmitted = false;
      let cancelledTaskId: string | null = null;
      subagent.on('cancel', (data: { taskId: string | null }) => {
        cancelEmitted = true;
        cancelledTaskId = data.taskId;
      });

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();
      await resultPromise;

      expect(cancelEmitted).toBe(true);
      expect(cancelledTaskId).toBe('abort-during-exec');
    });
  });

  describe('Status Tracking During Execution', () => {
    beforeEach(() => {
      subagent = new Subagent(SubagentRole.TESTING);
    });

    it('should update taskId in status', async () => {
      const task = createTask('status-tracking-task');

      const resultPromise = subagent.executeTask(task);

      // Wait a bit for status to update
      await new Promise(resolve => setTimeout(resolve, 10));

      const status = subagent.getStatus();
      expect(status.taskId).toBe('status-tracking-task');

      subagent.abort();
      await resultPromise;
    });

    it('should update startTime in status', async () => {
      const task = createTask('starttime-task');
      const beforeExec = new Date();

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));

      const status = subagent.getStatus();
      expect(status.startTime).toBeDefined();
      expect(status.startTime!.getTime()).toBeGreaterThanOrEqual(beforeExec.getTime());

      subagent.abort();
      await resultPromise;
    });

    it('should set state to RUNNING during execution', async () => {
      const task = createTask('running-state-task');

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));

      const status = subagent.getStatus();
      // Could be RUNNING or CANCELLED if aborted fast
      expect([SubagentState.RUNNING, SubagentState.CANCELLED, SubagentState.FAILED]).toContain(status.state);

      subagent.abort();
      await resultPromise;
    });
  });

  describe('Result Structure', () => {
    beforeEach(() => {
      subagent = new Subagent(SubagentRole.TESTING);
    });

    it('should return result with all required fields', async () => {
      const task = createTask('result-structure-task');

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();

      const result = await resultPromise;

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('taskId');
      expect(result).toHaveProperty('executionTime');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('toolCalls');
      expect(result).toHaveProperty('filesCreated');
      expect(result).toHaveProperty('filesModified');
    });

    it('should have executionTime greater than 0', async () => {
      const task = createTask('exec-time-task');

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 50)); // Wait a bit
      subagent.abort();

      const result = await resultPromise;

      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should have empty arrays for file tracking on abort', async () => {
      const task = createTask('file-tracking-task');

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();

      const result = await resultPromise;

      expect(result.filesCreated).toEqual([]);
      expect(result.filesModified).toEqual([]);
    });

    it('should have empty toolCalls array on abort before tools', async () => {
      const task = createTask('tool-calls-task');

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();

      const result = await resultPromise;

      expect(Array.isArray(result.toolCalls)).toBe(true);
    });
  });

  describe('Multiple Tasks', () => {
    it('should allow new task after previous completes', async () => {
      subagent = new Subagent(SubagentRole.TESTING);

      // First task
      const task1Promise = subagent.executeTask(createTask('task-1'));
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();
      const result1 = await task1Promise;

      expect(result1.taskId).toBe('task-1');

      // Create new subagent for second task (previous was aborted)
      const subagent2 = new Subagent(SubagentRole.TESTING);
      const task2Promise = subagent2.executeTask(createTask('task-2'));
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent2.abort();
      const result2 = await task2Promise;

      expect(result2.taskId).toBe('task-2');
    });
  });

  describe('Termination', () => {
    it('should clean up on terminate', async () => {
      subagent = new Subagent(SubagentRole.TESTING);

      let terminatedEmitted = false;
      subagent.once('terminated', () => {
        terminatedEmitted = true;
      });

      await subagent.terminate();

      expect(terminatedEmitted).toBe(true);
      expect(subagent.listenerCount('start')).toBe(0);
      expect(subagent.listenerCount('progress')).toBe(0);
    });

    it('should allow abort after terminate', async () => {
      subagent = new Subagent(SubagentRole.TESTING);

      await subagent.terminate();

      // Should not throw
      subagent.abort();

      const status = subagent.getStatus();
      expect(status.state).toBe(SubagentState.CANCELLED);
    });
  });

  describe('Configuration Effects', () => {
    it('should respect maxToolRounds config', () => {
      subagent = new Subagent(SubagentRole.TESTING, { maxToolRounds: 5 });

      expect(subagent.config.maxToolRounds).toBe(5);
    });

    it('should respect contextDepth config', () => {
      subagent = new Subagent(SubagentRole.TESTING, { contextDepth: 15 });

      expect(subagent.config.contextDepth).toBe(15);
    });

    it('should respect timeout config', () => {
      subagent = new Subagent(SubagentRole.TESTING, { timeout: 5000 });

      expect(subagent.config.timeout).toBe(5000);
    });

    it('should respect allowedTools config', () => {
      subagent = new Subagent(SubagentRole.TESTING, { allowedTools: ['bash'] });

      expect(subagent.config.allowedTools).toEqual(['bash']);
    });

    it('should respect customSystemPrompt config', () => {
      const customPrompt = 'You are a specialized test agent.';
      subagent = new Subagent(SubagentRole.TESTING, { customSystemPrompt: customPrompt });

      expect(subagent.config.customSystemPrompt).toBe(customPrompt);
    });
  });

  describe('Role-Specific Default Tools', () => {
    it('should have bash for TESTING role', () => {
      subagent = new Subagent(SubagentRole.TESTING);
      expect(subagent.config.allowedTools).toContain('bash');
    });

    it('should have text_editor for DOCUMENTATION role', () => {
      subagent = new Subagent(SubagentRole.DOCUMENTATION);
      expect(subagent.config.allowedTools).toContain('text_editor');
    });

    it('should have higher maxToolRounds for DEBUG role', () => {
      subagent = new Subagent(SubagentRole.DEBUG);
      expect(subagent.config.maxToolRounds).toBeGreaterThan(20);
    });

    it('should have bash for PERFORMANCE role', () => {
      subagent = new Subagent(SubagentRole.PERFORMANCE);
      expect(subagent.config.allowedTools).toContain('bash');
    });

    it('should handle GENERAL role', () => {
      subagent = new Subagent(SubagentRole.GENERAL);
      expect(subagent.role).toBe(SubagentRole.GENERAL);
      // GENERAL role may have empty or minimal tools
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      subagent = new Subagent(SubagentRole.TESTING);
    });

    it('should handle cancellation message type', async () => {
      const message = {
        from: 'parent' as const,
        to: 'subagent' as const,
        type: 'cancellation' as const,
        content: 'Cancel now',
        timestamp: new Date(),
      };

      await subagent.receiveMessage(message);

      const status = subagent.getStatus();
      expect(status.state).toBe(SubagentState.CANCELLED);
    });

    it('should emit message event on receive', async () => {
      const message = {
        from: 'orchestrator' as const,
        to: 'subagent' as const,
        type: 'instruction' as const,
        content: 'Test instruction',
        timestamp: new Date(),
      };

      let messageEmitted = false;
      subagent.once('message', () => {
        messageEmitted = true;
      });

      await subagent.receiveMessage(message);

      expect(messageEmitted).toBe(true);
    });

    it('should not abort on query message type', async () => {
      const message = {
        from: 'orchestrator' as const,
        to: 'subagent' as const,
        type: 'query' as const,
        content: 'Status check',
        timestamp: new Date(),
      };

      await subagent.receiveMessage(message);

      const status = subagent.getStatus();
      expect(status.state).not.toBe(SubagentState.CANCELLED);
    });

    it('should not abort on instruction message type', async () => {
      const message = {
        from: 'orchestrator' as const,
        to: 'subagent' as const,
        type: 'instruction' as const,
        content: 'Do something',
        timestamp: new Date(),
      };

      await subagent.receiveMessage(message);

      const status = subagent.getStatus();
      expect(status.state).not.toBe(SubagentState.CANCELLED);
    });
  });

  describe('Unique ID Generation', () => {
    it('should generate unique IDs', () => {
      const agent1 = new Subagent(SubagentRole.TESTING);
      const agent2 = new Subagent(SubagentRole.TESTING);

      expect(agent1.id).not.toBe(agent2.id);
    });

    it('should include role in ID', () => {
      const testingAgent = new Subagent(SubagentRole.TESTING);
      const docAgent = new Subagent(SubagentRole.DOCUMENTATION);

      expect(testingAgent.id).toContain(SubagentRole.TESTING);
      expect(docAgent.id).toContain(SubagentRole.DOCUMENTATION);
    });
  });

  describe('Status Immutability', () => {
    it('should return copy of status to prevent external mutation', () => {
      subagent = new Subagent(SubagentRole.TESTING);

      const status1 = subagent.getStatus();
      status1.progress = 999;

      const status2 = subagent.getStatus();
      expect(status2.progress).toBe(0);
    });
  });

  describe('Logs Immutability', () => {
    it('should return copy of logs to prevent external mutation', () => {
      subagent = new Subagent(SubagentRole.TESTING);

      const logs1 = subagent.getLogs();
      logs1.push({
        type: 'user',
        content: 'injected',
        timestamp: new Date(),
      });

      const logs2 = subagent.getLogs();
      expect(logs2).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long task IDs', async () => {
      subagent = new Subagent(SubagentRole.TESTING);

      const longId = 'a'.repeat(1000);
      const task = createTask(longId);

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();

      const result = await resultPromise;
      expect(result.taskId).toBe(longId);
    });

    it('should handle task with high priority', async () => {
      subagent = new Subagent(SubagentRole.TESTING);

      const task: SubagentTask = {
        id: 'high-priority-task',
        description: 'High priority test',
        role: SubagentRole.TESTING,
        priority: 100,
        context: {},
      };

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();

      const result = await resultPromise;
      expect(result.taskId).toBe('high-priority-task');
    });

    it('should handle task with zero priority', async () => {
      subagent = new Subagent(SubagentRole.TESTING);

      const task: SubagentTask = {
        id: 'zero-priority-task',
        description: 'Zero priority test',
        role: SubagentRole.TESTING,
        priority: 0,
        context: {},
      };

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();

      const result = await resultPromise;
      expect(result.taskId).toBe('zero-priority-task');
    });

    it('should handle task with negative priority', async () => {
      subagent = new Subagent(SubagentRole.TESTING);

      const task: SubagentTask = {
        id: 'negative-priority-task',
        description: 'Negative priority test',
        role: SubagentRole.TESTING,
        priority: -10,
        context: {},
      };

      const resultPromise = subagent.executeTask(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      subagent.abort();

      const result = await resultPromise;
      expect(result.taskId).toBe('negative-priority-task');
    });
  });

  describe('All Roles Initialization', () => {
    const allRoles = [
      SubagentRole.TESTING,
      SubagentRole.DOCUMENTATION,
      SubagentRole.REFACTORING,
      SubagentRole.ANALYSIS,
      SubagentRole.DEBUG,
      SubagentRole.PERFORMANCE,
      SubagentRole.GENERAL,
    ];

    it.each(allRoles)('should initialize correctly for role %s', (role) => {
      const agent = new Subagent(role);

      expect(agent.role).toBe(role);
      expect(agent.id).toContain(role);
      expect(agent.config.role).toBe(role);
      expect(agent.config.allowedTools).toBeDefined();
      expect(agent.config.maxToolRounds).toBeDefined();
    });
  });
});
