/**
 * CircularDependencyDetector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../../../src/analyzers/dependency/dependency-graph.js';
import { CircularDependencyDetector } from '../../../src/analyzers/dependency/circular-detector.js';
import type { DependencyNode } from '../../../src/analyzers/dependency/types.js';

describe('CircularDependencyDetector', () => {
  let detector: CircularDependencyDetector;
  let graph: DependencyGraph;

  beforeEach(() => {
    detector = new CircularDependencyDetector();
    graph = new DependencyGraph();
  });

  describe('detectCycles', () => {
    it('should return empty array for acyclic graph', () => {
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

      const cycles = detector.detectCycles(graph);
      expect(cycles).toEqual([]);
    });

    it('should detect simple 2-node cycle', () => {
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

      const cycles = detector.detectCycles(graph);
      expect(cycles).toHaveLength(1);
      expect(cycles[0].length).toBe(2);
      expect(cycles[0].severity).toBe('medium');
    });

    it('should detect 3-node cycle', () => {
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

      const cycles = detector.detectCycles(graph);
      expect(cycles).toHaveLength(1);
      expect(cycles[0].length).toBe(3);
      expect(cycles[0].severity).toBe('high');
    });

    it('should detect large cycle as critical', () => {
      const nodes = ['/test/a.ts', '/test/b.ts', '/test/c.ts', '/test/d.ts', '/test/e.ts', '/test/f.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/b.ts', '/test/c.ts');
      graph.addEdge('/test/c.ts', '/test/d.ts');
      graph.addEdge('/test/d.ts', '/test/e.ts');
      graph.addEdge('/test/e.ts', '/test/f.ts');
      graph.addEdge('/test/f.ts', '/test/a.ts');

      const cycles = detector.detectCycles(graph);
      expect(cycles).toHaveLength(1);
      expect(cycles[0].length).toBe(6);
      expect(cycles[0].severity).toBe('critical');
    });

    it('should calculate impact score', () => {
      const nodes = ['/test/a.ts', '/test/b.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 100,
      }));

      nodes.forEach(n => graph.addNode(n));
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/b.ts', '/test/a.ts');

      const cycles = detector.detectCycles(graph);
      expect(cycles[0].impact).toBeGreaterThan(0);
      expect(cycles[0].impact).toBeLessThanOrEqual(100);
    });

    it('should generate description', () => {
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

      const cycles = detector.detectCycles(graph);
      expect(cycles[0].description).toContain('Circular dependency detected');
      expect(cycles[0].description).toContain('a.ts');
      expect(cycles[0].description).toContain('b.ts');
    });

    it('should sort cycles by severity and impact', () => {
      // Create multiple cycles with different severities
      const nodes = [
        '/test/a.ts', '/test/b.ts',
        '/test/c.ts', '/test/d.ts', '/test/e.ts',
      ].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));

      // Simple 2-node cycle (medium)
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/b.ts', '/test/a.ts');

      // 3-node cycle (high)
      graph.addEdge('/test/c.ts', '/test/d.ts');
      graph.addEdge('/test/d.ts', '/test/e.ts');
      graph.addEdge('/test/e.ts', '/test/c.ts');

      const cycles = detector.detectCycles(graph);
      expect(cycles).toHaveLength(2);

      // High severity should come before medium
      expect(cycles[0].severity).toBe('high');
      expect(cycles[1].severity).toBe('medium');
    });

    it('should handle multiple independent cycles', () => {
      const nodes = [
        '/test/a.ts', '/test/b.ts',
        '/test/c.ts', '/test/d.ts',
      ].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => graph.addNode(n));

      // Cycle 1
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/b.ts', '/test/a.ts');

      // Cycle 2
      graph.addEdge('/test/c.ts', '/test/d.ts');
      graph.addEdge('/test/d.ts', '/test/c.ts');

      const cycles = detector.detectCycles(graph);
      expect(cycles).toHaveLength(2);
    });

    it('should handle graph with no nodes', () => {
      const cycles = detector.detectCycles(graph);
      expect(cycles).toEqual([]);
    });

    it('should include cycle information in result', () => {
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

      const cycles = detector.detectCycles(graph);
      const cycle = cycles[0];

      expect(cycle.cycle).toContain('/test/a.ts');
      expect(cycle.cycle).toContain('/test/b.ts');
      expect(cycle.length).toBe(2);
      expect(cycle.severity).toBeDefined();
      expect(cycle.impact).toBeDefined();
      expect(cycle.description).toBeDefined();
    });
  });
});
