/**
 * Tests for DependencyResolver
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyResolver, createDependencyResolver } from '../../src/agent/dependency-resolver.js';
import type { SubagentTask } from '../../src/agent/subagent-types.js';
import { SubagentRole } from '../../src/agent/subagent-types.js';

// Helper to create mock tasks
function createTask(
  id: string,
  dependencies?: string[],
  priority?: number
): SubagentTask {
  return {
    id,
    description: `Task ${id}`,
    role: SubagentRole.GENERAL,
    priority: priority ?? 1,
    context: {},
    dependencies,
  };
}

describe('DependencyResolver', () => {
  let resolver: DependencyResolver;

  beforeEach(() => {
    resolver = new DependencyResolver();
  });

  describe('createDependencyResolver', () => {
    it('should create a new resolver instance', () => {
      const newResolver = createDependencyResolver();
      expect(newResolver).toBeInstanceOf(DependencyResolver);
    });
  });

  describe('resolveDependencies', () => {
    it('should return empty array for empty tasks', () => {
      const batches = resolver.resolveDependencies([]);
      expect(batches).toEqual([]);
    });

    it('should return single batch for tasks without dependencies', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2'),
        createTask('task-3'),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(3);
      expect(batches[0]).toContain('task-1');
      expect(batches[0]).toContain('task-2');
      expect(batches[0]).toContain('task-3');
    });

    it('should resolve linear dependencies into sequential batches', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
        createTask('task-3', ['task-2']),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toEqual(['task-1']);
      expect(batches[1]).toEqual(['task-2']);
      expect(batches[2]).toEqual(['task-3']);
    });

    it('should group parallel tasks in same batch', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
        createTask('task-3', ['task-1']),
        createTask('task-4', ['task-2', 'task-3']),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toEqual(['task-1']);
      expect(batches[1]).toHaveLength(2);
      expect(batches[1]).toContain('task-2');
      expect(batches[1]).toContain('task-3');
      expect(batches[2]).toEqual(['task-4']);
    });

    it('should sort by priority within batches', () => {
      const tasks = [
        createTask('task-1', undefined, 1),
        createTask('task-2', undefined, 5),
        createTask('task-3', undefined, 3),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(1);
      // Higher priority first
      expect(batches[0][0]).toBe('task-2');
      expect(batches[0][1]).toBe('task-3');
      expect(batches[0][2]).toBe('task-1');
    });

    it('should throw on circular dependencies', () => {
      const tasks = [
        createTask('task-1', ['task-3']),
        createTask('task-2', ['task-1']),
        createTask('task-3', ['task-2']),
      ];

      expect(() => resolver.resolveDependencies(tasks)).toThrow('Circular dependency');
    });

    it('should throw on non-existent dependency', () => {
      const tasks = [
        createTask('task-1', ['non-existent']),
      ];

      expect(() => resolver.resolveDependencies(tasks)).toThrow('non-existent');
    });

    it('should handle complex diamond dependencies', () => {
      //     task-1
      //    /      \
      // task-2  task-3
      //    \      /
      //     task-4
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
        createTask('task-3', ['task-1']),
        createTask('task-4', ['task-2', 'task-3']),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toContain('task-1');
      expect(batches[1]).toContain('task-2');
      expect(batches[1]).toContain('task-3');
      expect(batches[2]).toContain('task-4');
    });
  });

  describe('validateDependencies', () => {
    it('should return true for valid dependencies', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
      ];

      expect(resolver.validateDependencies(tasks)).toBe(true);
    });

    it('should return true for empty tasks', () => {
      expect(resolver.validateDependencies([])).toBe(true);
    });

    it('should return false for circular dependencies', () => {
      const tasks = [
        createTask('task-1', ['task-2']),
        createTask('task-2', ['task-1']),
      ];

      expect(resolver.validateDependencies(tasks)).toBe(false);
    });

    it('should return false for self-referencing dependency', () => {
      const tasks = [
        createTask('task-1', ['task-1']),
      ];

      expect(resolver.validateDependencies(tasks)).toBe(false);
    });

    it('should return false for non-existent dependencies', () => {
      const tasks = [
        createTask('task-1', ['missing']),
      ];

      expect(resolver.validateDependencies(tasks)).toBe(false);
    });
  });

  describe('getDependencyGraph', () => {
    it('should return graph with nodes and execution order', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
      ];

      const graph = resolver.getDependencyGraph(tasks);

      expect(graph.nodes).toBeDefined();
      expect(graph.nodes.size).toBe(2);
      expect(graph.executionOrder).toHaveLength(2);
      expect(graph.hasCycles).toBe(false);
    });

    it('should detect cycles and return empty execution order', () => {
      const tasks = [
        createTask('task-1', ['task-2']),
        createTask('task-2', ['task-1']),
      ];

      const graph = resolver.getDependencyGraph(tasks);

      expect(graph.hasCycles).toBe(true);
      expect(graph.executionOrder).toEqual([]);
      expect(graph.cycles).toBeDefined();
      expect(graph.cycles!.length).toBeGreaterThan(0);
    });

    it('should correctly build node relationships', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
      ];

      const graph = resolver.getDependencyGraph(tasks);

      const node1 = graph.nodes.get('task-1');
      const node2 = graph.nodes.get('task-2');

      expect(node1?.dependents).toContain('task-2');
      expect(node2?.dependencies).toContain('task-1');
    });

    it('should assign correct levels to nodes', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
        createTask('task-3', ['task-2']),
      ];

      const graph = resolver.getDependencyGraph(tasks);

      expect(graph.nodes.get('task-1')?.level).toBe(0);
      expect(graph.nodes.get('task-2')?.level).toBe(1);
      expect(graph.nodes.get('task-3')?.level).toBe(2);
    });
  });

  describe('getTaskLevel', () => {
    it('should return 0 for task without dependencies', () => {
      const tasks = [createTask('task-1')];

      const level = resolver.getTaskLevel('task-1', tasks);

      expect(level).toBe(0);
    });

    it('should return correct level for dependent task', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
        createTask('task-3', ['task-2']),
      ];

      expect(resolver.getTaskLevel('task-1', tasks)).toBe(0);
      expect(resolver.getTaskLevel('task-2', tasks)).toBe(1);
      expect(resolver.getTaskLevel('task-3', tasks)).toBe(2);
    });

    it('should throw for non-existent task', () => {
      const tasks = [createTask('task-1')];

      expect(() => resolver.getTaskLevel('non-existent', tasks)).toThrow('not found');
    });
  });

  describe('getParallelTasks', () => {
    it('should return same result as resolveDependencies', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
      ];

      const parallelTasks = resolver.getParallelTasks(tasks);
      const resolved = resolver.resolveDependencies(tasks);

      expect(parallelTasks).toEqual(resolved);
    });
  });

  describe('canExecuteTask', () => {
    it('should return true for task with no dependencies', () => {
      const tasks = [createTask('task-1')];
      const completed = new Set<string>();

      expect(resolver.canExecuteTask('task-1', completed, tasks)).toBe(true);
    });

    it('should return true when all dependencies are completed', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
      ];
      const completed = new Set(['task-1']);

      expect(resolver.canExecuteTask('task-2', completed, tasks)).toBe(true);
    });

    it('should return false when dependencies are not completed', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
      ];
      const completed = new Set<string>();

      expect(resolver.canExecuteTask('task-2', completed, tasks)).toBe(false);
    });

    it('should return false for non-existent task', () => {
      const tasks = [createTask('task-1')];
      const completed = new Set<string>();

      expect(resolver.canExecuteTask('non-existent', completed, tasks)).toBe(false);
    });

    it('should work with Map overload for O(1) lookup', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
      ];
      const taskMap = new Map(tasks.map(t => [t.id, t]));
      const completed = new Set(['task-1']);

      expect(resolver.canExecuteTask('task-2', completed, taskMap)).toBe(true);
    });

    it('should return false with Map overload for non-existent task', () => {
      const tasks = [createTask('task-1')];
      const taskMap = new Map(tasks.map(t => [t.id, t]));
      const completed = new Set<string>();

      expect(resolver.canExecuteTask('non-existent', completed, taskMap)).toBe(false);
    });
  });

  describe('getReadyTasks', () => {
    it('should return all tasks when none have dependencies', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2'),
      ];
      const completed = new Set<string>();

      const ready = resolver.getReadyTasks(tasks, completed);

      expect(ready).toHaveLength(2);
    });

    it('should not return completed tasks', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2'),
      ];
      const completed = new Set(['task-1']);

      const ready = resolver.getReadyTasks(tasks, completed);

      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe('task-2');
    });

    it('should return tasks with all dependencies met', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
        createTask('task-3', ['task-1']),
      ];
      const completed = new Set(['task-1']);

      const ready = resolver.getReadyTasks(tasks, completed);

      expect(ready).toHaveLength(2);
      expect(ready.map(t => t.id)).toContain('task-2');
      expect(ready.map(t => t.id)).toContain('task-3');
    });

    it('should not return tasks with unmet dependencies', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
      ];
      const completed = new Set<string>();

      const ready = resolver.getReadyTasks(tasks, completed);

      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe('task-1');
    });

    it('should return empty array when all tasks completed', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2'),
      ];
      const completed = new Set(['task-1', 'task-2']);

      const ready = resolver.getReadyTasks(tasks, completed);

      expect(ready).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single task', () => {
      const tasks = [createTask('task-1')];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toEqual(['task-1']);
    });

    it('should handle tasks with empty dependencies array', () => {
      const tasks = [
        createTask('task-1', []),
        createTask('task-2', []),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(2);
    });

    it('should handle deeply nested dependencies', () => {
      const tasks = [
        createTask('task-1'),
        createTask('task-2', ['task-1']),
        createTask('task-3', ['task-2']),
        createTask('task-4', ['task-3']),
        createTask('task-5', ['task-4']),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        expect(batches[i]).toEqual([`task-${i + 1}`]);
      }
    });

    it('should handle multiple root tasks with shared descendants', () => {
      const tasks = [
        createTask('root-1'),
        createTask('root-2'),
        createTask('child', ['root-1', 'root-2']),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(2);
      expect(batches[0]).toContain('root-1');
      expect(batches[0]).toContain('root-2');
      expect(batches[1]).toEqual(['child']);
    });

    it('should maintain priority ordering across multiple batches', () => {
      const tasks = [
        createTask('low-1', undefined, 1),
        createTask('high-1', undefined, 10),
        createTask('low-2', ['low-1', 'high-1'], 1),
        createTask('high-2', ['low-1', 'high-1'], 10),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(2);
      // First batch: high priority first
      expect(batches[0][0]).toBe('high-1');
      expect(batches[0][1]).toBe('low-1');
      // Second batch: high priority first
      expect(batches[1][0]).toBe('high-2');
      expect(batches[1][1]).toBe('low-2');
    });
  });

  describe('Cycle Detection', () => {
    it('should detect simple two-node cycle', () => {
      const tasks = [
        createTask('a', ['b']),
        createTask('b', ['a']),
      ];

      const graph = resolver.getDependencyGraph(tasks);

      expect(graph.hasCycles).toBe(true);
      expect(graph.cycles).toBeDefined();
    });

    it('should detect three-node cycle', () => {
      const tasks = [
        createTask('a', ['c']),
        createTask('b', ['a']),
        createTask('c', ['b']),
      ];

      const graph = resolver.getDependencyGraph(tasks);

      expect(graph.hasCycles).toBe(true);
    });

    it('should detect cycle in larger graph with non-cyclic parts', () => {
      const tasks = [
        createTask('ok-1'),
        createTask('ok-2', ['ok-1']),
        createTask('cycle-a', ['cycle-c']),
        createTask('cycle-b', ['cycle-a']),
        createTask('cycle-c', ['cycle-b']),
      ];

      expect(resolver.validateDependencies(tasks)).toBe(false);
    });
  });

  describe('Priority Handling', () => {
    it('should handle zero priority', () => {
      const tasks = [
        createTask('task-1', undefined, 0),
        createTask('task-2', undefined, 0),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(2);
    });

    it('should handle negative priority', () => {
      const tasks = [
        createTask('low', undefined, -5),
        createTask('high', undefined, 5),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(1);
      // Higher priority first
      expect(batches[0][0]).toBe('high');
      expect(batches[0][1]).toBe('low');
    });

    it('should handle undefined priority (default to 1)', () => {
      const task1 = createTask('task-1');
      delete (task1 as Record<string, unknown>).priority;
      const task2 = createTask('task-2', undefined, 5);

      const tasks = [task1, task2];
      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(1);
      expect(batches[0][0]).toBe('task-2'); // Higher priority first
    });
  });

  describe('Complex Dependency Patterns', () => {
    it('should handle wide fan-out pattern', () => {
      // One task with many dependents
      const tasks = [
        createTask('root'),
        createTask('child-1', ['root']),
        createTask('child-2', ['root']),
        createTask('child-3', ['root']),
        createTask('child-4', ['root']),
        createTask('child-5', ['root']),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(2);
      expect(batches[0]).toEqual(['root']);
      expect(batches[1]).toHaveLength(5);
    });

    it('should handle wide fan-in pattern', () => {
      // Many tasks converging to one
      const tasks = [
        createTask('source-1'),
        createTask('source-2'),
        createTask('source-3'),
        createTask('sink', ['source-1', 'source-2', 'source-3']),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(3);
      expect(batches[1]).toEqual(['sink']);
    });

    it('should handle mixed patterns', () => {
      // Complex graph with multiple paths
      const tasks = [
        createTask('a'),
        createTask('b'),
        createTask('c', ['a']),
        createTask('d', ['a', 'b']),
        createTask('e', ['c', 'd']),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toContain('a');
      expect(batches[0]).toContain('b');
      expect(batches[1]).toContain('c');
      expect(batches[1]).toContain('d');
      expect(batches[2]).toContain('e');
    });
  });

  describe('Validation Edge Cases', () => {
    it('should handle special characters in task ID', () => {
      const tasks = [
        createTask('task-with-special-!@#$%'),
        createTask('unicode-日本語'),
      ];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(2);
    });

    it('should handle very long task IDs', () => {
      const longId = 'a'.repeat(1000);
      const tasks = [createTask(longId)];

      const batches = resolver.resolveDependencies(tasks);

      expect(batches).toHaveLength(1);
      expect(batches[0]).toEqual([longId]);
    });
  });

  describe('getReadyTasks Edge Cases', () => {
    it('should handle all tasks having dependencies', () => {
      const tasks = [
        createTask('task-1', ['task-0']), // depends on non-existent
      ];

      // This should throw during resolution, not getReadyTasks
      expect(() => resolver.resolveDependencies(tasks)).toThrow();
    });

    it('should handle partial dependency completion', () => {
      const tasks = [
        createTask('a'),
        createTask('b'),
        createTask('c', ['a', 'b']),
      ];
      const completed = new Set(['a']); // Only 'a' completed

      const ready = resolver.getReadyTasks(tasks, completed);

      // 'b' is ready (no deps), 'c' is not (needs 'b')
      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe('b');
    });
  });

  describe('Graph Structure Verification', () => {
    it('should correctly populate dependents list', () => {
      const tasks = [
        createTask('parent'),
        createTask('child-1', ['parent']),
        createTask('child-2', ['parent']),
      ];

      const graph = resolver.getDependencyGraph(tasks);
      const parentNode = graph.nodes.get('parent');

      expect(parentNode?.dependents).toContain('child-1');
      expect(parentNode?.dependents).toContain('child-2');
      expect(parentNode?.dependents).toHaveLength(2);
    });

    it('should correctly populate dependencies list', () => {
      const tasks = [
        createTask('dep-1'),
        createTask('dep-2'),
        createTask('main', ['dep-1', 'dep-2']),
      ];

      const graph = resolver.getDependencyGraph(tasks);
      const mainNode = graph.nodes.get('main');

      expect(mainNode?.dependencies).toContain('dep-1');
      expect(mainNode?.dependencies).toContain('dep-2');
      expect(mainNode?.dependencies).toHaveLength(2);
    });
  });

  describe('Execution Order Determinism', () => {
    it('should produce consistent batches for same input', () => {
      const tasks = [
        createTask('a'),
        createTask('b', ['a']),
        createTask('c', ['a']),
      ];

      const batches1 = resolver.resolveDependencies(tasks);
      const batches2 = resolver.resolveDependencies(tasks);

      expect(batches1).toEqual(batches2);
    });
  });
});
