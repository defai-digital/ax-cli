/**
 * DependencyGraph Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../../../src/analyzers/dependency/dependency-graph.js';
import type { DependencyNode } from '../../../src/analyzers/dependency/types.js';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('addNode', () => {
    it('should add a node to the graph', () => {
      const node: DependencyNode = {
        filePath: '/test/file.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node);
      expect(graph.getNode('/test/file.ts')).toEqual(node);
    });

    it('should handle multiple nodes', () => {
      const node1: DependencyNode = {
        filePath: '/test/file1.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      const node2: DependencyNode = {
        filePath: '/test/file2.ts',
        imports: [],
        exports: [],
        size: 200,
        loc: 20,
      };

      graph.addNode(node1);
      graph.addNode(node2);

      expect(graph.getNodes()).toHaveLength(2);
      expect(graph.getNode('/test/file1.ts')).toEqual(node1);
      expect(graph.getNode('/test/file2.ts')).toEqual(node2);
    });
  });

  describe('addEdge', () => {
    it('should add an edge between nodes', () => {
      const node1: DependencyNode = {
        filePath: '/test/a.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      const node2: DependencyNode = {
        filePath: '/test/b.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node1);
      graph.addNode(node2);
      graph.addEdge('/test/a.ts', '/test/b.ts');

      expect(graph.getEfferentDependencies('/test/a.ts')).toContain('/test/b.ts');
      expect(graph.getAfferentDependencies('/test/b.ts')).toContain('/test/a.ts');
    });

    it('should handle multiple edges', () => {
      const nodes = ['/test/a.ts', '/test/b.ts', '/test/c.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/a.ts', '/test/c.ts');

      expect(graph.getEfferentDependencies('/test/a.ts')).toHaveLength(2);
      expect(graph.getTotalEdges()).toBe(2);
    });
  });

  describe('getAfferentDependencies', () => {
    it('should return files that depend on this file', () => {
      const nodes = ['/test/a.ts', '/test/b.ts', '/test/c.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));
      graph.addEdge('/test/a.ts', '/test/c.ts');
      graph.addEdge('/test/b.ts', '/test/c.ts');

      const afferent = graph.getAfferentDependencies('/test/c.ts');
      expect(afferent).toHaveLength(2);
      expect(afferent).toContain('/test/a.ts');
      expect(afferent).toContain('/test/b.ts');
    });

    it('should return empty array for file with no dependents', () => {
      const node: DependencyNode = {
        filePath: '/test/a.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node);
      expect(graph.getAfferentDependencies('/test/a.ts')).toEqual([]);
    });
  });

  describe('getEfferentDependencies', () => {
    it('should return files this file depends on', () => {
      const nodes = ['/test/a.ts', '/test/b.ts', '/test/c.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/a.ts', '/test/c.ts');

      const efferent = graph.getEfferentDependencies('/test/a.ts');
      expect(efferent).toHaveLength(2);
      expect(efferent).toContain('/test/b.ts');
      expect(efferent).toContain('/test/c.ts');
    });
  });

  describe('hasPath', () => {
    it('should detect direct path', () => {
      const nodes = ['/test/a.ts', '/test/b.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));
      graph.addEdge('/test/a.ts', '/test/b.ts');

      expect(graph.hasPath('/test/a.ts', '/test/b.ts')).toBe(true);
      expect(graph.hasPath('/test/b.ts', '/test/a.ts')).toBe(false);
    });

    it('should detect transitive path', () => {
      const nodes = ['/test/a.ts', '/test/b.ts', '/test/c.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/b.ts', '/test/c.ts');

      expect(graph.hasPath('/test/a.ts', '/test/c.ts')).toBe(true);
      expect(graph.hasPath('/test/c.ts', '/test/a.ts')).toBe(false);
    });

    it('should return true for same node', () => {
      const node: DependencyNode = {
        filePath: '/test/a.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node);
      expect(graph.hasPath('/test/a.ts', '/test/a.ts')).toBe(true);
    });
  });

  describe('topologicalSort', () => {
    it('should sort acyclic graph', () => {
      const nodes = ['/test/a.ts', '/test/b.ts', '/test/c.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/b.ts', '/test/c.ts');

      const { sorted, hasCycle } = graph.topologicalSort();
      expect(hasCycle).toBe(false);
      expect(sorted).toHaveLength(3);

      // a should come before b, b before c
      const aIdx = sorted.indexOf('/test/a.ts');
      const bIdx = sorted.indexOf('/test/b.ts');
      const cIdx = sorted.indexOf('/test/c.ts');
      expect(aIdx).toBeLessThan(bIdx);
      expect(bIdx).toBeLessThan(cIdx);
    });

    it('should detect cycle', () => {
      const nodes = ['/test/a.ts', '/test/b.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/b.ts', '/test/a.ts');

      const { hasCycle } = graph.topologicalSort();
      expect(hasCycle).toBe(true);
    });
  });

  describe('getStronglyConnectedComponents', () => {
    it('should return empty for acyclic graph', () => {
      const nodes = ['/test/a.ts', '/test/b.ts', '/test/c.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/b.ts', '/test/c.ts');

      const sccs = graph.getStronglyConnectedComponents();
      expect(sccs).toEqual([]);
    });

    it('should detect simple cycle', () => {
      const nodes = ['/test/a.ts', '/test/b.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/b.ts', '/test/a.ts');

      const sccs = graph.getStronglyConnectedComponents();
      expect(sccs).toHaveLength(1);
      expect(sccs[0]).toHaveLength(2);
      expect(sccs[0]).toContain('/test/a.ts');
      expect(sccs[0]).toContain('/test/b.ts');
    });

    it('should detect complex cycle', () => {
      const nodes = ['/test/a.ts', '/test/b.ts', '/test/c.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/b.ts', '/test/c.ts');
      graph.addEdge('/test/c.ts', '/test/a.ts');

      const sccs = graph.getStronglyConnectedComponents();
      expect(sccs).toHaveLength(1);
      expect(sccs[0]).toHaveLength(3);
    });

    it('should detect multiple cycles', () => {
      const nodes = ['/test/a.ts', '/test/b.ts', '/test/c.ts', '/test/d.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));
      // Cycle 1: a <-> b
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/b.ts', '/test/a.ts');
      // Cycle 2: c <-> d
      graph.addEdge('/test/c.ts', '/test/d.ts');
      graph.addEdge('/test/d.ts', '/test/c.ts');

      const sccs = graph.getStronglyConnectedComponents();
      expect(sccs).toHaveLength(2);
      expect(sccs.every(scc => scc.length === 2)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty graph', () => {
      expect(graph.getNodes()).toEqual([]);
      expect(graph.getTotalEdges()).toBe(0);
    });

    it('should handle single node', () => {
      const node: DependencyNode = {
        filePath: '/test/a.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node);
      expect(graph.getNodes()).toHaveLength(1);
      expect(graph.getTotalEdges()).toBe(0);
    });

    it('should handle self-loop', () => {
      const node: DependencyNode = {
        filePath: '/test/a.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node);
      graph.addEdge('/test/a.ts', '/test/a.ts');

      expect(graph.getEfferentDependencies('/test/a.ts')).toContain('/test/a.ts');
      expect(graph.getAfferentDependencies('/test/a.ts')).toContain('/test/a.ts');
    });
  });
});
