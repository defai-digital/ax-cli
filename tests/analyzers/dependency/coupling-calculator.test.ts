/**
 * CouplingCalculator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../../../src/analyzers/dependency/dependency-graph.js';
import { CouplingCalculator } from '../../../src/analyzers/dependency/coupling-calculator.js';
import type { DependencyNode } from '../../../src/analyzers/dependency/types.js';
import type { FileASTInfo, ClassInfo, ExportInfo } from '../../../src/analyzers/ast/types.js';

describe('CouplingCalculator', () => {
  let calculator: CouplingCalculator;
  let graph: DependencyGraph;
  let astMap: Map<string, FileASTInfo>;

  beforeEach(() => {
    calculator = new CouplingCalculator();
    graph = new DependencyGraph();
    astMap = new Map();
  });

  const createASTInfo = (classes: ClassInfo[] = [], exports: ExportInfo[] = [], functionCount: number = 0): FileASTInfo => {
    const functions = Array.from({ length: functionCount }, (_, i) => ({
      name: `func${i}`,
      parameters: [],
      returnType: 'void',
      isAsync: false,
      isExported: true,
      complexity: 1,
      startLine: 1,
      endLine: 2,
      length: 1,
    }));

    return {
      filePath: '/test/file.ts',
      imports: [],
      exports,
      classes,
      functions,
      totalLines: 10,
    };
  };

  describe('calculateMetrics', () => {
    it('should calculate afferent and efferent coupling', () => {
      const nodes = ['/test/a.ts', '/test/b.ts', '/test/c.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => {
        graph.addNode(n);
        astMap.set(n.filePath, createASTInfo());
      });

      // a depends on b and c (Ce = 2)
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/a.ts', '/test/c.ts');

      // b and c depend on nothing (Ce = 0)
      // b has 1 dependent (Ca = 1)
      // c has 1 dependent (Ca = 1)

      const metrics = calculator.calculateMetrics(graph, astMap);

      const aMetrics = metrics.find(m => m.file === '/test/a.ts');
      const bMetrics = metrics.find(m => m.file === '/test/b.ts');

      expect(aMetrics?.afferentCoupling).toBe(0);
      expect(aMetrics?.efferentCoupling).toBe(2);
      expect(bMetrics?.afferentCoupling).toBe(1);
      expect(bMetrics?.efferentCoupling).toBe(0);
    });

    it('should calculate instability correctly', () => {
      const nodes = ['/test/a.ts', '/test/b.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => {
        graph.addNode(n);
        astMap.set(n.filePath, createASTInfo());
      });

      graph.addEdge('/test/a.ts', '/test/b.ts');

      const metrics = calculator.calculateMetrics(graph, astMap);

      const aMetrics = metrics.find(m => m.file === '/test/a.ts');
      const bMetrics = metrics.find(m => m.file === '/test/b.ts');

      // a: Ce=1, Ca=0, I = 1/(1+0) = 1 (unstable)
      expect(aMetrics?.instability).toBe(1);

      // b: Ce=0, Ca=1, I = 0/(0+1) = 0 (stable)
      expect(bMetrics?.instability).toBe(0);
    });

    it('should handle zero coupling', () => {
      const node: DependencyNode = {
        filePath: '/test/a.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node);
      astMap.set('/test/a.ts', createASTInfo());

      const metrics = calculator.calculateMetrics(graph, astMap);

      expect(metrics[0].afferentCoupling).toBe(0);
      expect(metrics[0].efferentCoupling).toBe(0);
      expect(metrics[0].instability).toBe(0);
    });

    it('should calculate abstractness for classes', () => {
      const node: DependencyNode = {
        filePath: '/test/a.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node);

      const classes: ClassInfo[] = [
        {
          name: 'AbstractBase',
          isExported: true,
          methods: [],
          properties: [],
          extendsClass: undefined,
          implementsInterfaces: [],
          startLine: 1,
          endLine: 5,
          length: 5,
        },
        {
          name: 'Concrete',
          isExported: true,
          methods: [],
          properties: [],
          extendsClass: undefined,
          implementsInterfaces: [],
          startLine: 6,
          endLine: 10,
          length: 5,
        },
      ];

      astMap.set('/test/a.ts', createASTInfo(classes, [], 0));

      const metrics = calculator.calculateMetrics(graph, astMap);

      // 1 abstract class, 1 concrete class = 0.5
      expect(metrics[0].abstractness).toBe(0.5);
    });

    it('should calculate abstractness for type exports', () => {
      const node: DependencyNode = {
        filePath: '/test/a.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node);

      const typeExports: ExportInfo[] = [
        {
          name: 'IFoo',
          isDefault: false,
          type: 'type',
        },
      ];

      astMap.set('/test/a.ts', createASTInfo([], typeExports, 1));

      const metrics = calculator.calculateMetrics(graph, astMap);

      // 1 type export (abstract), 1 function (concrete) = 0.5
      expect(metrics[0].abstractness).toBe(0.5);
    });

    it('should calculate distance from main sequence', () => {
      const node: DependencyNode = {
        filePath: '/test/a.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node);
      astMap.set('/test/a.ts', createASTInfo([], [], 1));

      const metrics = calculator.calculateMetrics(graph, astMap);

      // A = 0 (no abstract elements)
      // I = 0 (no coupling)
      // D = |0 + 0 - 1| = 1
      expect(metrics[0].distanceFromMainSequence).toBe(1);
    });

    it('should identify painful zone', () => {
      const node: DependencyNode = {
        filePath: '/test/a.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node);
      graph.addEdge('/test/a.ts', '/test/b.ts');
      graph.addEdge('/test/a.ts', '/test/c.ts');

      // Concrete (A < 0.3) and unstable (I > 0.7)
      astMap.set('/test/a.ts', createASTInfo([], [], 5));

      const metrics = calculator.calculateMetrics(graph, astMap);

      expect(metrics[0].zone).toBe('painful');
    });

    it('should identify useless zone', () => {
      const node: DependencyNode = {
        filePath: '/test/a.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node);

      // Abstract (A > 0.7) and stable (I < 0.3)
      const typeExports: ExportInfo[] = [
        { name: 'I1', isDefault: false, type: 'type' },
        { name: 'I2', isDefault: false, type: 'type' },
        { name: 'I3', isDefault: false, type: 'type' },
      ];

      astMap.set('/test/a.ts', createASTInfo([], typeExports, 1));

      const metrics = calculator.calculateMetrics(graph, astMap);

      // 3 type exports (abstract), 1 function (concrete) = 0.75 abstractness
      // No dependencies = 0 instability (stable)
      expect(metrics[0].zone).toBe('useless');
    });

    it('should identify balanced zone', () => {
      const node: DependencyNode = {
        filePath: '/test/a.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node);
      graph.addEdge('/test/a.ts', '/test/b.ts');

      // Moderate abstractness and instability
      const classes: ClassInfo[] = [
        {
          name: 'AbstractBase',
          isExported: true,
          methods: [],
          properties: [],
          extendsClass: undefined,
          implementsInterfaces: [],
          startLine: 1,
          endLine: 5,
          length: 5,
        },
      ];

      astMap.set('/test/a.ts', createASTInfo(classes, [], 1));

      const metrics = calculator.calculateMetrics(graph, astMap);

      expect(metrics[0].zone).toBe('balanced');
    });

    it('should handle missing AST info', () => {
      const node: DependencyNode = {
        filePath: '/test/a.ts',
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      };

      graph.addNode(node);
      // Don't add to astMap

      const metrics = calculator.calculateMetrics(graph, astMap);

      expect(metrics[0].abstractness).toBe(0);
    });

    it('should handle multiple files', () => {
      const nodes = ['/test/a.ts', '/test/b.ts', '/test/c.ts'].map(path => ({
        filePath: path,
        imports: [],
        exports: [],
        size: 100,
        loc: 10,
      }));

      nodes.forEach(n => {
        graph.addNode(n);
        astMap.set(n.filePath, createASTInfo([], [], 1));
      });

      const metrics = calculator.calculateMetrics(graph, astMap);

      expect(metrics).toHaveLength(3);
    });
  });
});
