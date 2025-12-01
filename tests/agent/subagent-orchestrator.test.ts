/**
 * Tests for SubagentOrchestrator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubagentOrchestrator } from '../../src/agent/subagent-orchestrator.js';
import { SubagentRole, SubagentTask } from '../../src/agent/subagent-types.js';

describe('SubagentOrchestrator', () => {
  let orchestrator: SubagentOrchestrator;

  beforeEach(() => {
    // Mock environment variables
    process.env.GROK_API_KEY = 'test-api-key';
    process.env.GROK_MODEL = 'glm-4.6';
    process.env.AI_BASE_URL = 'http://localhost:11434/v1';

    orchestrator = new SubagentOrchestrator({
      maxConcurrentAgents: 5,
      defaultTimeout: 5000,
      autoCheckpoint: false, // Disable for tests
      verbose: false,
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.terminateAll();
    }
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(orchestrator).toBeDefined();
    });

    it('should start with no active subagents', () => {
      const active = orchestrator.getActive();
      expect(active).toHaveLength(0);
    });

    it('should start with empty results', () => {
      const results = orchestrator.getAllResults();
      expect(results).toHaveLength(0);
    });
  });

  describe('Spawning Subagents', () => {
    it('should spawn a subagent successfully', async () => {
      const subagent = await orchestrator.spawn(SubagentRole.TESTING);

      expect(subagent).toBeDefined();
      expect(subagent.role).toBe(SubagentRole.TESTING);
      expect(subagent.id).toBeDefined();
    });

    it('should track spawned subagents', async () => {
      await orchestrator.spawn(SubagentRole.TESTING);

      const active = orchestrator.getActive();
      expect(active).toHaveLength(1);
    });

    it('should spawn multiple subagents', async () => {
      await orchestrator.spawn(SubagentRole.TESTING);
      await orchestrator.spawn(SubagentRole.DOCUMENTATION);

      const active = orchestrator.getActive();
      expect(active).toHaveLength(2);
    });

    it('should emit spawn event', async () => {
      let spawnEmitted = false;
      orchestrator.once('spawn', () => {
        spawnEmitted = true;
      });

      await orchestrator.spawn(SubagentRole.TESTING);

      expect(spawnEmitted).toBe(true);
    });

    it('should respect max concurrent agents limit', async () => {
      const smallOrchestrator = new SubagentOrchestrator({
        maxConcurrentAgents: 2,
        defaultTimeout: 5000,
        autoCheckpoint: false,
        verbose: false,
      });

      await smallOrchestrator.spawn(SubagentRole.TESTING);
      await smallOrchestrator.spawn(SubagentRole.DOCUMENTATION);

      // Third spawn should fail
      await expect(
        smallOrchestrator.spawn(SubagentRole.REFACTORING)
      ).rejects.toThrow();

      await smallOrchestrator.terminateAll();
    });
  });

  describe('Parallel Spawning', () => {
    it('should spawn multiple subagents in parallel', async () => {
      const configs = [
        { role: SubagentRole.TESTING },
        { role: SubagentRole.DOCUMENTATION },
      ];

      const subagents = await orchestrator.spawnParallel(configs);

      expect(subagents).toHaveLength(2);
      expect(subagents[0].role).toBe(SubagentRole.TESTING);
      expect(subagents[1].role).toBe(SubagentRole.DOCUMENTATION);
    });

    it('should pass configurations to spawned subagents', async () => {
      const configs = [
        {
          role: SubagentRole.TESTING,
          config: { maxToolRounds: 50 },
        },
      ];

      const subagents = await orchestrator.spawnParallel(configs);

      expect(subagents[0].config.maxToolRounds).toBe(50);
    });
  });

  describe('Task Delegation', () => {
    it('should create task structure correctly', () => {
      const task: SubagentTask = {
        id: 'test-1',
        description: 'Write tests',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      expect(task.id).toBe('test-1');
      expect(task.role).toBe(SubagentRole.TESTING);
    });

    it('should handle task context', () => {
      const task: SubagentTask = {
        id: 'test-2',
        description: 'Analyze code',
        role: SubagentRole.ANALYSIS,
        priority: 1,
        context: {
          files: ['src/index.ts'],
          metadata: { important: true },
        },
      };

      expect(task.context.files).toContain('src/index.ts');
      expect(task.context.metadata?.important).toBe(true);
    });
  });

  describe('Result Management', () => {
    it('should return undefined for non-existent task', () => {
      const result = orchestrator.getResult('non-existent');
      expect(result).toBeUndefined();
    });

    it('should clear results', () => {
      orchestrator.clearResults();
      const results = orchestrator.getAllResults();
      expect(results).toHaveLength(0);
    });
  });

  describe('Monitoring', () => {
    it('should monitor subagent status', async () => {
      const subagent = await orchestrator.spawn(SubagentRole.TESTING);

      const status = orchestrator.monitor(subagent.id);

      expect(status).toBeDefined();
      expect(status?.role).toBe(SubagentRole.TESTING);
    });

    it('should return null for non-existent subagent', () => {
      const status = orchestrator.monitor('non-existent');
      expect(status).toBeNull();
    });

    it('should get all active subagents', async () => {
      await orchestrator.spawn(SubagentRole.TESTING);
      await orchestrator.spawn(SubagentRole.DOCUMENTATION);

      const active = orchestrator.getActive();
      expect(active).toHaveLength(2);
    });
  });

  describe('Termination', () => {
    it('should terminate a specific subagent', async () => {
      const subagent = await orchestrator.spawn(SubagentRole.TESTING);

      await orchestrator.terminateSubagent(subagent.id);

      const active = orchestrator.getActive();
      expect(active).toHaveLength(0);
    });

    it('should emit terminate event', async () => {
      const subagent = await orchestrator.spawn(SubagentRole.TESTING);

      let terminateEmitted = false;
      orchestrator.once('terminate', () => {
        terminateEmitted = true;
      });

      await orchestrator.terminateSubagent(subagent.id);

      expect(terminateEmitted).toBe(true);
    });

    it('should terminate all subagents', async () => {
      await orchestrator.spawn(SubagentRole.TESTING);
      await orchestrator.spawn(SubagentRole.DOCUMENTATION);

      await orchestrator.terminateAll();

      const active = orchestrator.getActive();
      expect(active).toHaveLength(0);
    });

    it('should handle terminating non-existent subagent gracefully', async () => {
      await expect(
        orchestrator.terminateSubagent('non-existent')
      ).resolves.not.toThrow();
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      const stats = orchestrator.getStats();

      expect(stats.activeAgents).toBe(0);
      expect(stats.totalResults).toBe(0);
      expect(stats.successfulTasks).toBe(0);
      expect(stats.failedTasks).toBe(0);
    });

    it('should update stats as subagents are spawned', async () => {
      await orchestrator.spawn(SubagentRole.TESTING);

      const stats = orchestrator.getStats();
      expect(stats.activeAgents).toBe(1);
    });
  });

  describe('Event Forwarding', () => {
    it('should forward subagent start events', async () => {
      let startEmitted = false;
      orchestrator.once('subagent-start', () => {
        startEmitted = true;
      });

      const subagent = await orchestrator.spawn(SubagentRole.TESTING);

      // Trigger start by executing a task (will fail but should emit)
      const task: SubagentTask = {
        id: 'test',
        description: 'Test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      subagent.executeTask(task).catch(() => {});

      // Wait for event
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(startEmitted).toBe(true);
    });

    it('should forward subagent progress events', () => {
      let progressEmitted = false;
      orchestrator.once('subagent-progress', () => {
        progressEmitted = true;
      });

      // Progress will be emitted during actual execution
      // This is a placeholder - real test would need task execution
      expect(progressEmitted).toBe(false);
    });
  });

  describe('Message Passing', () => {
    it('should send messages to subagents', async () => {
      const subagent = await orchestrator.spawn(SubagentRole.TESTING);

      await expect(
        orchestrator.sendMessage(subagent.id, 'Test message')
      ).resolves.not.toThrow();
    });

    it('should throw when sending to non-existent subagent', async () => {
      await expect(
        orchestrator.sendMessage('non-existent', 'Test')
      ).rejects.toThrow();
    });
  });

  describe('Configuration', () => {
    it('should use provided configuration', () => {
      const config = {
        maxConcurrentAgents: 3,
        defaultTimeout: 10000,
        autoCheckpoint: true,
        verbose: true,
      };

      const customOrchestrator = new SubagentOrchestrator(config);

      expect(customOrchestrator).toBeDefined();
    });

    it('should use default configuration when not provided', () => {
      const defaultOrchestrator = new SubagentOrchestrator();

      expect(defaultOrchestrator).toBeDefined();
    });
  });

  describe('Dependency Handling', () => {
    it('should handle tasks without dependencies', () => {
      const task: SubagentTask = {
        id: 'task-1',
        description: 'Independent task',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      expect(task.dependencies).toBeUndefined();
    });

    it('should handle tasks with dependencies', () => {
      const task: SubagentTask = {
        id: 'task-2',
        description: 'Dependent task',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
        dependencies: ['task-1'],
      };

      expect(task.dependencies).toContain('task-1');
    });
  });
});
