/**
 * Tests for Subagent base class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Subagent } from '../../src/agent/subagent.js';
import { SubagentRole, SubagentTask, SubagentState } from '../../src/agent/subagent-types.js';

describe('Subagent', () => {
  let subagent: Subagent;

  beforeEach(() => {
    // Mock environment variables for testing
    process.env.GROK_API_KEY = 'test-api-key';
    process.env.GROK_MODEL = 'glm-4.6';
    process.env.AI_BASE_URL = 'http://localhost:11434/v1';
  });

  afterEach(() => {
    if (subagent) {
      subagent.abort();
    }
  });

  describe('Initialization', () => {
    it('should initialize with correct role and configuration', () => {
      subagent = new Subagent(SubagentRole.TESTING);

      expect(subagent.role).toBe(SubagentRole.TESTING);
      expect(subagent.id).toBeDefined();
      expect(subagent.config).toBeDefined();
      expect(subagent.config.role).toBe(SubagentRole.TESTING);
    });

    it('should merge default config with provided config', () => {
      subagent = new Subagent(SubagentRole.TESTING, {
        maxToolRounds: 50,
        contextDepth: 25,
      });

      expect(subagent.config.maxToolRounds).toBe(50);
      expect(subagent.config.contextDepth).toBe(25);
      expect(subagent.config.allowedTools).toBeDefined(); // From defaults
    });

    it('should use custom system prompt if provided', () => {
      const customPrompt = 'Custom test prompt';
      subagent = new Subagent(SubagentRole.TESTING, {
        customSystemPrompt: customPrompt,
      });

      expect(subagent.config.customSystemPrompt).toBe(customPrompt);
    });
  });

  describe('Status Management', () => {
    beforeEach(() => {
      subagent = new Subagent(SubagentRole.TESTING);
    });

    it('should start with pending state', () => {
      const status = subagent.getStatus();

      expect(status.state).toBe(SubagentState.PENDING);
      expect(status.progress).toBe(0);
      expect(status.role).toBe(SubagentRole.TESTING);
    });

    it('should update state when task starts', async () => {
      const task: SubagentTask = {
        id: 'test-task-1',
        description: 'Test task',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      // Start task execution (will fail due to mock, but status should update)
      const promise = subagent.executeTask(task).catch(() => {});

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      const status = subagent.getStatus();
      expect(status.taskId).toBe('test-task-1');
    });

    it('should track tool usage', () => {
      const status = subagent.getStatus();
      expect(status.toolsUsed).toBeUndefined();
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      subagent = new Subagent(SubagentRole.TESTING);
    });

    it('should emit start event when task begins', async () => {
      const task: SubagentTask = {
        id: 'test-task-2',
        description: 'Test task',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      let startEmitted = false;
      subagent.once('start', () => {
        startEmitted = true;
      });

      // Execute task (will fail, but should emit start)
      subagent.executeTask(task).catch(() => {});

      // Wait a bit for event
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(startEmitted).toBe(true);
    });

    it('should emit progress events during execution', () => {
      let progressCount = 0;
      subagent.on('progress', () => {
        progressCount++;
      });

      // Progress will be emitted during actual execution
      // This is a placeholder test - real test would need mocked LLM
      expect(progressCount).toBe(0); // Not yet executed
    });
  });

  describe('Abortion', () => {
    beforeEach(() => {
      subagent = new Subagent(SubagentRole.TESTING);
    });

    it('should abort execution when requested', () => {
      subagent.abort();

      const status = subagent.getStatus();
      expect(status.state).toBe(SubagentState.CANCELLED);
      expect(status.endTime).toBeDefined();
    });

    it('should emit cancel event on abort', () => {
      let cancelEmitted = false;
      subagent.once('cancel', () => {
        cancelEmitted = true;
      });

      subagent.abort();

      expect(cancelEmitted).toBe(true);
    });
  });

  describe('Tool Access', () => {
    it('should initialize with correct allowed tools', () => {
      subagent = new Subagent(SubagentRole.TESTING, {
        allowedTools: ['bash', 'text_editor'],
      });

      expect(subagent.config.allowedTools).toContain('bash');
      expect(subagent.config.allowedTools).toContain('text_editor');
      expect(subagent.config.allowedTools).not.toContain('search');
    });

    it('should respect tool restrictions per role', () => {
      const testingAgent = new Subagent(SubagentRole.TESTING);
      const analysisAgent = new Subagent(SubagentRole.ANALYSIS);

      expect(testingAgent.config.allowedTools).toBeDefined();
      expect(analysisAgent.config.allowedTools).toBeDefined();
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      subagent = new Subagent(SubagentRole.TESTING);
    });

    it('should handle cancellation messages', async () => {
      const message = {
        from: 'parent' as const,
        to: 'subagent' as const,
        type: 'cancellation' as const,
        content: 'Cancel execution',
        timestamp: new Date(),
      };

      await subagent.receiveMessage(message);

      const status = subagent.getStatus();
      expect(status.state).toBe(SubagentState.CANCELLED);
    });

    it('should emit message events', async () => {
      let messageEmitted = false;
      subagent.once('message', () => {
        messageEmitted = true;
      });

      const message = {
        from: 'parent' as const,
        to: 'subagent' as const,
        type: 'instruction' as const,
        content: 'Test message',
        timestamp: new Date(),
      };

      await subagent.receiveMessage(message);

      expect(messageEmitted).toBe(true);
    });
  });

  describe('Logs', () => {
    beforeEach(() => {
      subagent = new Subagent(SubagentRole.TESTING);
    });

    it('should return empty logs initially', () => {
      const logs = subagent.getLogs();
      expect(logs).toEqual([]);
    });

    it('should not mutate logs when returned', () => {
      const logs1 = subagent.getLogs();
      logs1.push({
        type: 'user',
        content: 'test',
        timestamp: new Date(),
      });

      const logs2 = subagent.getLogs();
      expect(logs2).toEqual([]);
    });
  });

  describe('Role-Specific Behavior', () => {
    it('should configure testing agent correctly', () => {
      subagent = new Subagent(SubagentRole.TESTING);

      expect(subagent.config.allowedTools).toContain('bash');
      expect(subagent.config.maxToolRounds).toBeDefined();
    });

    it('should configure documentation agent correctly', () => {
      subagent = new Subagent(SubagentRole.DOCUMENTATION);

      expect(subagent.config.allowedTools).toContain('text_editor');
      expect(subagent.config.maxToolRounds).toBeDefined();
    });

    it('should configure debug agent correctly', () => {
      subagent = new Subagent(SubagentRole.DEBUG);

      expect(subagent.config.allowedTools).toBeDefined();
      expect(subagent.config.maxToolRounds).toBeGreaterThan(20); // Debug needs more rounds
    });

    it('should configure performance agent correctly', () => {
      subagent = new Subagent(SubagentRole.PERFORMANCE);

      expect(subagent.config.allowedTools).toContain('bash');
    });
  });

  describe('Timeout Handling', () => {
    it('should respect timeout configuration', () => {
      const timeout = 1000; // 1 second
      subagent = new Subagent(SubagentRole.TESTING, {
        timeout,
      });

      expect(subagent.config.timeout).toBe(timeout);
    });

    it('should use default timeout if not provided', () => {
      subagent = new Subagent(SubagentRole.TESTING);

      expect(subagent.config.timeout).toBeUndefined(); // Uses orchestrator default
    });
  });

  describe('Priority', () => {
    it('should set priority from config', () => {
      subagent = new Subagent(SubagentRole.TESTING, {
        priority: 5,
      });

      expect(subagent.config.priority).toBe(5);
    });

    it('should use default priority if not provided', () => {
      subagent = new Subagent(SubagentRole.TESTING);

      expect(subagent.config.priority).toBeDefined();
    });
  });
});
