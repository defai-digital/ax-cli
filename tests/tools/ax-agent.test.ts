/**
 * Tests for AX Agent Tool
 *
 * @module tests/tools/ax-agent.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import {
  executeAxAgent,
  executeAxAgentsParallel,
  listAgents,
  AGENT_REGISTRY,
  clearAxCommandCache,
  type AxAgentOptions,
  type AxAgentsParallelOptions,
} from '../../packages/core/src/tools/ax-agent.js';

// Mock child_process spawn and spawnSync
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(() => ({ status: 0 })), // Mock ax --version check
}));

const mockSpawn = vi.mocked(spawn);

function createMockChildProcess() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

describe('AX Agent Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearAxCommandCache(); // Reset cached ax command path between tests
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('AGENT_REGISTRY', () => {
    it('should contain all expected agents', () => {
      const expectedAgents = [
        'tony', 'bob', 'avery', 'stan', 'steve', 'felix', 'frank',
        'queenie', 'wendy', 'oliver', 'paris', 'maya', 'dana',
        'daisy', 'debbee', 'eric', 'rodman', 'candy', 'quinn', 'astrid'
      ];

      for (const agent of expectedAgents) {
        expect(AGENT_REGISTRY[agent]).toBeDefined();
        expect(AGENT_REGISTRY[agent].persona).toBeDefined();
        expect(AGENT_REGISTRY[agent].expertise).toBeDefined();
      }
    });

    it('should have persona and expertise for each agent', () => {
      for (const [name, info] of Object.entries(AGENT_REGISTRY)) {
        expect(info.persona).toBeTruthy();
        expect(info.expertise).toBeTruthy();
        expect(typeof info.persona).toBe('string');
        expect(typeof info.expertise).toBe('string');
      }
    });

    it('should have Tony as CTO', () => {
      expect(AGENT_REGISTRY.tony.persona).toBe('Tony');
      expect(AGENT_REGISTRY.tony.expertise).toContain('CTO');
    });

    it('should have Bob for backend', () => {
      expect(AGENT_REGISTRY.bob.persona).toBe('Bob');
      expect(AGENT_REGISTRY.bob.expertise.toLowerCase()).toContain('backend');
    });

    it('should have Queenie for QA', () => {
      expect(AGENT_REGISTRY.queenie.persona).toBe('Queenie');
      expect(AGENT_REGISTRY.queenie.expertise.toLowerCase()).toContain('qa');
    });
  });

  describe('listAgents', () => {
    it('should return formatted list of agents', () => {
      const list = listAgents();

      expect(list).toContain('Available AutomatosX Agents:');

      // Should contain all agents
      for (const [name, info] of Object.entries(AGENT_REGISTRY)) {
        expect(list).toContain(name);
        expect(list).toContain(info.persona);
      }
    });

    it('should format each agent on its own line', () => {
      const list = listAgents();
      const lines = list.split('\n');

      // Header + empty line + agents
      expect(lines.length).toBeGreaterThan(Object.keys(AGENT_REGISTRY).length);
    });
  });

  describe('executeAxAgent', () => {
    it('should return error for unknown agent', async () => {
      const result = await executeAxAgent({
        agent: 'unknown_agent',
        task: 'test task',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown agent');
      expect(result.error).toContain('unknown_agent');
      expect(result.error).toContain('Available agents');
    });

    it('should accept valid agent names case-insensitively', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgent({
        agent: 'BOB',
        task: 'test task',
      });

      // Simulate successful execution
      child.stdout.emit('data', 'Agent output');
      child.emit('close', 0);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        'ax',
        expect.arrayContaining(['run', 'bob']),
        expect.any(Object)
      );
    });

    it('should pass task and format arguments', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgent({
        agent: 'bob',
        task: 'create an API endpoint',
        format: 'text',
      });

      child.stdout.emit('data', 'Done');
      child.emit('close', 0);

      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'ax',
        ['run', 'bob', 'create an API endpoint', '--format', 'text'],
        expect.any(Object)
      );
    });

    it('should pass save argument when provided', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgent({
        agent: 'bob',
        task: 'test task',
        save: 'output.md',
      });

      child.stdout.emit('data', 'Saved');
      child.emit('close', 0);

      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'ax',
        ['run', 'bob', 'test task', '--format', 'markdown', '--save', 'output.md'],
        expect.any(Object)
      );
    });

    it('should return success with agent output', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgent({
        agent: 'bob',
        task: 'test task',
      });

      child.stdout.emit('data', 'Agent completed successfully');
      child.emit('close', 0);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.output).toContain('Bob');
      expect(result.output).toContain('Agent completed successfully');
    });

    it('should include agent persona and expertise in header', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgent({
        agent: 'bob',
        task: 'test task',
      });

      child.stdout.emit('data', 'Output');
      child.emit('close', 0);

      const result = await promise;

      expect(result.output).toContain('## Bob');
      expect(result.output).toContain(AGENT_REGISTRY.bob.expertise);
    });

    it('should handle command not found error', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgent({
        agent: 'bob',
        task: 'test task',
      });

      child.emit('error', new Error('spawn ax ENOENT'));

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('AutomatosX command not found');
      expect(result.error).toContain('npm install -g');
    });

    it('should handle non-zero exit code', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgent({
        agent: 'bob',
        task: 'test task',
      });

      child.stderr.emit('data', 'Error: Something went wrong');
      child.emit('close', 1);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Something went wrong');
    });

    it('should handle timeout', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgent({
        agent: 'bob',
        task: 'test task',
      });

      // Advance time by 5 minutes (timeout duration)
      vi.advanceTimersByTime(5 * 60 * 1000);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should default format to markdown', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgent({
        agent: 'bob',
        task: 'test task',
      });

      child.stdout.emit('data', 'Done');
      child.emit('close', 0);

      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'ax',
        expect.arrayContaining(['--format', 'markdown']),
        expect.any(Object)
      );
    });

    it('should handle stderr output for command not found', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgent({
        agent: 'bob',
        task: 'test task',
      });

      child.stderr.emit('data', 'command not found: ax');
      child.emit('close', 127);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('AutomatosX command not found');
    });
  });

  describe('executeAxAgentsParallel', () => {
    it('should return error for empty agents array', async () => {
      const result = await executeAxAgentsParallel({ agents: [] });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No agents specified');
    });

    it('should validate all agent names upfront', async () => {
      const result = await executeAxAgentsParallel({
        agents: [
          { agent: 'bob', task: 'task 1' },
          { agent: 'unknown1', task: 'task 2' },
          { agent: 'unknown2', task: 'task 3' },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown agent(s)');
      expect(result.error).toContain('unknown1');
      expect(result.error).toContain('unknown2');
    });

    it('should execute multiple agents in parallel', async () => {
      const child1 = createMockChildProcess();
      const child2 = createMockChildProcess();

      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? child1 : child2;
      });

      const promise = executeAxAgentsParallel({
        agents: [
          { agent: 'bob', task: 'task 1' },
          { agent: 'frank', task: 'task 2' },
        ],
      });

      // Simulate both completing
      child1.stdout.emit('data', 'Bob output');
      child1.emit('close', 0);
      child2.stdout.emit('data', 'Frank output');
      child2.emit('close', 0);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.output).toContain('Bob');
      expect(result.output).toContain('Frank');
      expect(result.output).toContain('2/2 agents completed successfully');
    });

    it('should report partial failures', async () => {
      const child1 = createMockChildProcess();
      const child2 = createMockChildProcess();

      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? child1 : child2;
      });

      const promise = executeAxAgentsParallel({
        agents: [
          { agent: 'bob', task: 'task 1' },
          { agent: 'frank', task: 'task 2' },
        ],
      });

      // Bob succeeds, Frank fails
      child1.stdout.emit('data', 'Bob output');
      child1.emit('close', 0);
      child2.stderr.emit('data', 'Frank error');
      child2.emit('close', 1);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('1 agent(s) failed');
      expect(result.output).toContain('1/2 agents completed successfully');
    });

    it('should include execution times in output', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgentsParallel({
        agents: [{ agent: 'bob', task: 'task 1' }],
      });

      child.stdout.emit('data', 'Output');
      child.emit('close', 0);

      const result = await promise;

      expect(result.output).toContain('s)'); // Time in seconds
      expect(result.output).toContain('Total Time');
    });

    it('should handle agent-specific options', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgentsParallel({
        agents: [
          { agent: 'bob', task: 'task 1', format: 'text', save: 'out.md' },
        ],
      });

      child.stdout.emit('data', 'Output');
      child.emit('close', 0);

      await promise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'ax',
        ['run', 'bob', 'task 1', '--format', 'text', '--save', 'out.md'],
        expect.any(Object)
      );
    });

    it('should handle Promise.allSettled rejections', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgentsParallel({
        agents: [{ agent: 'bob', task: 'task 1' }],
      });

      // Emit error to cause rejection
      child.emit('error', new Error('Unexpected error'));

      const result = await promise;

      // Should still return a result (from allSettled)
      expect(result).toBeDefined();
    });

    it('should show success/failure indicators in output', async () => {
      const child1 = createMockChildProcess();
      const child2 = createMockChildProcess();

      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? child1 : child2;
      });

      const promise = executeAxAgentsParallel({
        agents: [
          { agent: 'bob', task: 'task 1' },
          { agent: 'frank', task: 'task 2' },
        ],
      });

      child1.stdout.emit('data', 'Success');
      child1.emit('close', 0);
      child2.stderr.emit('data', 'Failed');
      child2.emit('close', 1);

      const result = await promise;

      expect(result.output).toContain('✓'); // Success indicator
      expect(result.output).toContain('✗'); // Failure indicator
    });
  });

  describe('edge cases', () => {
    it('should handle empty stdout', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgent({
        agent: 'bob',
        task: 'test task',
      });

      // No stdout data, just close
      child.emit('close', 0);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.output).toContain('Agent completed successfully');
    });

    it('should handle chunked stdout data', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgent({
        agent: 'bob',
        task: 'test task',
      });

      child.stdout.emit('data', 'Part 1 ');
      child.stdout.emit('data', 'Part 2 ');
      child.stdout.emit('data', 'Part 3');
      child.emit('close', 0);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.output).toContain('Part 1 Part 2 Part 3');
    });

    it('should trim whitespace from output', async () => {
      const child = createMockChildProcess();
      mockSpawn.mockReturnValue(child as any);

      const promise = executeAxAgent({
        agent: 'bob',
        task: 'test task',
      });

      child.stdout.emit('data', '  Output with whitespace  \n\n');
      child.emit('close', 0);

      const result = await promise;

      expect(result.output).toContain('Output with whitespace');
    });
  });
});
