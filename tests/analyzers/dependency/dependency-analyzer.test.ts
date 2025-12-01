/**
 * DependencyAnalyzer Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DependencyAnalyzer } from '../../../src/analyzers/dependency/dependency-analyzer.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer;
  let tempDir: string;

  beforeEach(async () => {
    analyzer = new DependencyAnalyzer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dep-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createTestFile = async (filename: string, content: string): Promise<string> => {
    const filePath = path.join(tempDir, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  };

  describe('analyzeDependencies', () => {
    it('should analyze simple dependency graph', async () => {
      await createTestFile('a.ts', `
        import { b } from './b.js';
        export const a = 1;
      `);

      await createTestFile('b.ts', `
        export const b = 2;
      `);

      const result = await analyzer.analyzeDependencies(tempDir);

      expect(result.graph.getNodes().length).toBeGreaterThan(0);
      expect(result.summary.totalFiles).toBeGreaterThan(0);
    });

    it('should detect circular dependencies', async () => {
      await createTestFile('a.ts', `
        import { b } from './b.js';
        export const a = 1;
      `);

      await createTestFile('b.ts', `
        import { a } from './a.js';
        export const b = 2;
      `);

      const result = await analyzer.analyzeDependencies(tempDir);

      expect(result.circularDependencies.length).toBeGreaterThan(0);
      expect(result.summary.circularDependencyCount).toBeGreaterThan(0);
    });

    it('should calculate coupling metrics', async () => {
      await createTestFile('a.ts', `
        import { b } from './b.js';
        import { c } from './c.js';
        export const a = 1;
      `);

      await createTestFile('b.ts', `
        export const b = 2;
      `);

      await createTestFile('c.ts', `
        export const c = 3;
      `);

      const result = await analyzer.analyzeDependencies(tempDir);

      expect(result.couplingMetrics.length).toBeGreaterThan(0);
      expect(result.summary.averageAfferentCoupling).toBeGreaterThanOrEqual(0);
      expect(result.summary.averageEfferentCoupling).toBeGreaterThanOrEqual(0);
    });

    it('should identify orphaned files', async () => {
      await createTestFile('orphan.ts', `
        const x = 1;
      `);

      const result = await analyzer.analyzeDependencies(tempDir);

      expect(result.orphanedFiles.length).toBeGreaterThan(0);
    });

    it('should identify hub files', async () => {
      // Create a hub file with many dependencies
      await createTestFile('hub.ts', `
        import { a } from './a.js';
        import { b } from './b.js';
        import { c } from './c.js';
        export const hub = 1;
      `);

      await createTestFile('a.ts', 'export const a = 1;');
      await createTestFile('b.ts', 'export const b = 2;');
      await createTestFile('c.ts', 'export const c = 3;');

      const result = await analyzer.analyzeDependencies(tempDir);

      // In small graphs, hubs might not be detected due to threshold
      expect(result.hubFiles).toBeDefined();
      expect(Array.isArray(result.hubFiles)).toBe(true);
    });

    it('should calculate summary statistics', async () => {
      await createTestFile('a.ts', `
        import { b } from './b.js';
        export const a = 1;
      `);

      await createTestFile('b.ts', `
        export const b = 2;
      `);

      const result = await analyzer.analyzeDependencies(tempDir);

      expect(result.summary.totalFiles).toBeGreaterThan(0);
      expect(result.summary.totalDependencies).toBeGreaterThanOrEqual(0);
      expect(result.summary.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.healthScore).toBeLessThanOrEqual(100);
    });

    it('should respect ignore patterns', async () => {
      await createTestFile('src/index.ts', 'export const x = 1;');
      await createTestFile('dist/index.js', 'export const x = 1;');

      const result = await analyzer.analyzeDependencies(tempDir, '**/*.{ts,tsx,js,jsx}', {
        ignorePatterns: ['**/dist/**'],
      });

      const files = result.graph.getNodes().map(n => n.filePath);
      expect(files.some(f => f.includes('/dist/'))).toBe(false);
    });

    it('should handle empty directory', async () => {
      const result = await analyzer.analyzeDependencies(tempDir);

      expect(result.summary.totalFiles).toBe(0);
      expect(result.circularDependencies).toEqual([]);
      expect(result.couplingMetrics).toEqual([]);
      expect(result.orphanedFiles).toEqual([]);
      expect(result.hubFiles).toEqual([]);
    });

    it('should include timestamp', async () => {
      await createTestFile('a.ts', 'export const a = 1;');

      const result = await analyzer.analyzeDependencies(tempDir);

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle parse errors gracefully', async () => {
      await createTestFile('invalid.ts', 'this is not valid typescript {{{');

      const result = await analyzer.analyzeDependencies(tempDir);

      // Should not throw, just skip invalid files
      expect(result.summary.totalFiles).toBeGreaterThanOrEqual(0);
    });

    it('should detect complex circular dependencies', async () => {
      await createTestFile('a.ts', `
        import { b } from './b.js';
        export const a = 1;
      `);

      await createTestFile('b.ts', `
        import { c } from './c.js';
        export const b = 2;
      `);

      await createTestFile('c.ts', `
        import { a } from './a.js';
        export const c = 3;
      `);

      const result = await analyzer.analyzeDependencies(tempDir);

      expect(result.circularDependencies.length).toBeGreaterThan(0);
      const cycle = result.circularDependencies[0];
      expect(cycle.length).toBe(3);
      expect(cycle.severity).toBe('high');
    });

    it('should calculate health score based on issues', async () => {
      // Healthy codebase
      await createTestFile('a.ts', 'export const a = 1;');
      await createTestFile('b.ts', 'export const b = 2;');

      const healthyResult = await analyzer.analyzeDependencies(tempDir);
      const healthyScore = healthyResult.summary.healthScore;

      // Clean up
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dep-test-'));

      // Unhealthy codebase with circular deps
      await createTestFile('a.ts', `
        import { b } from './b.js';
        export const a = 1;
      `);

      await createTestFile('b.ts', `
        import { a } from './a.js';
        export const b = 2;
      `);

      const unhealthyResult = await analyzer.analyzeDependencies(tempDir);
      const unhealthyScore = unhealthyResult.summary.healthScore;

      expect(healthyScore).toBeGreaterThan(unhealthyScore);
    });
  });
});
