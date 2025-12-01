import { describe, it, expect } from 'vitest';
import { MessageOptimizer, getMessageOptimizer } from '../../src/utils/message-optimizer.js';

describe('MessageOptimizer', () => {
  describe('TypeScript Build Error Extraction', () => {
    it('should extract TypeScript errors from build output', () => {
      const optimizer = new MessageOptimizer();
      const buildOutput = `
> @defai.digital/ax-cli@2.6.1 build
> npm run build:schemas && tsc

src/agent/llm-agent.ts(492,34): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Record<string, unknown>'.
src/agent/llm-agent.ts(496,32): error TS2345: Argument of type 'object' is not assignable to parameter of type 'Record<string, unknown>'.
  Index signature for type 'string' is missing in type '{}'.
src/agent/llm-agent.ts(536,49): error TS2345: Argument of type 'ChatCompletionMessageParam' is not assignable to parameter of type 'ChatCompletionMessageParam[]'.
`.trim();

      const result = optimizer.optimizeToolOutput(buildOutput, 'bash');

      expect(result.truncated).toBe(true);
      expect(result.content).toContain('TypeScript Build:');
      expect(result.content).toContain('error TS2345');
      expect(result.reduction).toBeGreaterThan(0);
    });

    it('should limit number of errors shown', () => {
      const optimizer = new MessageOptimizer();
      const manyErrors = Array.from({ length: 20 }, (_, i) =>
        `src/file.ts(${i},1): error TS2345: Some error message ${i}`
      ).join('\n');

      const result = optimizer.optimizeToolOutput(manyErrors, 'bash');

      expect(result.content).toContain('20 errors found');
      expect(result.content).toContain('... and 15 more errors');
    });
  });

  describe('Generic Truncation', () => {
    it('should not truncate short outputs', () => {
      const optimizer = new MessageOptimizer();
      const shortOutput = 'This is a short message';

      const result = optimizer.optimizeToolOutput(shortOutput);

      expect(result.truncated).toBe(false);
      expect(result.content).toBe(shortOutput);
      expect(result.reduction).toBe(0);
    });

    it('should truncate long outputs with head/tail', () => {
      const optimizer = new MessageOptimizer({ maxLength: 100, headLines: 2, tailLines: 2 });
      const longOutput = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');

      const result = optimizer.optimizeToolOutput(longOutput);

      expect(result.truncated).toBe(true);
      expect(result.content).toContain('Line 1');
      expect(result.content).toContain('Line 2');
      expect(result.content).toContain('Line 99');
      expect(result.content).toContain('Line 100');
      expect(result.content).toContain('lines omitted');
      expect(result.reduction).toBeGreaterThan(80); // Should reduce by >80%
    });
  });

  describe('File Content Truncation', () => {
    it('should truncate large file content', () => {
      const optimizer = new MessageOptimizer({ maxFileLines: 10 });
      const fileContent = Array.from({ length: 200 }, (_, i) => `${i + 1}: Some code here`).join('\n');

      const result = optimizer.optimizeToolOutput(fileContent, 'read_file');

      expect(result.truncated).toBe(true);
      expect(result.content).toContain('1: Some code here');
      expect(result.content).toContain('lines omitted');
    });
  });

  describe('Test Output Extraction', () => {
    it('should extract test summary', () => {
      const optimizer = new MessageOptimizer();
      const testOutput = `
Test Files  3 passed (3)
     Tests  22 passed (22)
  Start at  10:30:00
   Duration  1.2s
`.trim();

      const result = optimizer.optimizeToolOutput(testOutput, 'bash');

      expect(result.content).toContain('Test Files');
      expect(result.content).toContain('22 passed');
    });
  });

  describe('Git Output Truncation', () => {
    it('should not truncate git status', () => {
      const optimizer = new MessageOptimizer();
      const gitStatus = 'On branch main\nChanges not staged for commit:\n  modified: file.ts';

      const result = optimizer.optimizeToolOutput(gitStatus, 'bash');

      expect(result.content).toBe(gitStatus);
    });

    it('should truncate git diff', () => {
      const optimizer = new MessageOptimizer();
      const gitDiff = Array.from({ length: 100 }, (_, i) =>
        `diff --git a/file${i}.ts b/file${i}.ts\n--- a/file${i}.ts\n+++ b/file${i}.ts`
      ).join('\n');

      const result = optimizer.optimizeToolOutput(gitDiff, 'bash');

      expect(result.truncated).toBe(true);
      expect(result.content).toContain('diff truncated');
    });
  });

  describe('Statistics', () => {
    it('should calculate optimization statistics', () => {
      const optimizer = new MessageOptimizer();
      const results = [
        optimizer.optimizeToolOutput('short'),
        optimizer.optimizeToolOutput(Array.from({ length: 100 }, (_, i) => `Line ${i}`).join('\n')),
        optimizer.optimizeToolOutput(Array.from({ length: 50 }, (_, i) => `Line ${i}`).join('\n')),
      ];

      const stats = optimizer.getStats(results);

      expect(stats.count).toBe(3);
      expect(stats.totalOriginal).toBe(stats.totalNew);
      expect(stats.totalReduction).toBe(0);
      expect(stats.avgReduction).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty results array', () => {
      const optimizer = new MessageOptimizer();
      const stats = optimizer.getStats([]);

      expect(stats.count).toBe(0);
      expect(stats.totalOriginal).toBe(0);
      expect(stats.totalNew).toBe(0);
      expect(stats.totalReduction).toBe(0);
      expect(stats.avgReduction).toBe(0);
    });

    it('should handle all empty strings', () => {
      const optimizer = new MessageOptimizer();
      const results = [
        optimizer.optimizeToolOutput(''),
        optimizer.optimizeToolOutput(''),
        optimizer.optimizeToolOutput(''),
      ];

      const stats = optimizer.getStats(results);

      expect(stats.count).toBe(3);
      expect(stats.totalOriginal).toBe(0);
      expect(stats.totalNew).toBe(0);
      expect(stats.totalReduction).toBe(0);
      expect(stats.avgReduction).toBe(0);
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const optimizer1 = getMessageOptimizer();
      const optimizer2 = getMessageOptimizer();

      expect(optimizer1).toBe(optimizer2);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const optimizer = new MessageOptimizer({
        maxLength: 500,
        headLines: 10,
        tailLines: 5,
        maxFileLines: 50,
      });

      const longOutput = Array.from({ length: 100 }, (_, i) => `Line ${i}`).join('\n');
      const result = optimizer.optimizeToolOutput(longOutput);

      expect(result.content).toContain('Line 0');
      expect(result.content).toContain('Line 9'); // 10 head lines
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const optimizer = new MessageOptimizer();
      const result = optimizer.optimizeToolOutput('');

      expect(result.truncated).toBe(false);
      expect(result.content).toBe('');
    });

    it('should handle single line', () => {
      const optimizer = new MessageOptimizer();
      const result = optimizer.optimizeToolOutput('Single line');

      expect(result.truncated).toBe(false);
      expect(result.content).toBe('Single line');
    });

    it('should handle exact boundary length', () => {
      const optimizer = new MessageOptimizer({ maxLength: 100 });
      const boundary = 'x'.repeat(100);

      const result = optimizer.optimizeToolOutput(boundary);

      expect(result.truncated).toBe(false);
    });

    it('should handle just over boundary', () => {
      const optimizer = new MessageOptimizer({ maxLength: 100 });
      const overBoundary = 'x'.repeat(101);

      const result = optimizer.optimizeToolOutput(overBoundary);

      expect(result.truncated).toBe(true);
    });
  });

  describe('Excerpt Creation', () => {
    it('should create excerpt with context', () => {
      const optimizer = new MessageOptimizer();
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
      const importantIndices = [10, 50, 90];

      const excerpt = optimizer.createExcerpt(lines, importantIndices, 2);

      expect(excerpt).toContain('Line 11'); // Important line (index 10)
      expect(excerpt).toContain('Line 51'); // Important line (index 50)
      expect(excerpt).toContain('Line 91'); // Important line (index 90)
      expect(excerpt).toContain('lines omitted');
    });

    it('should merge overlapping ranges', () => {
      const optimizer = new MessageOptimizer();
      const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
      const importantIndices = [5, 6, 7]; // Close together

      const excerpt = optimizer.createExcerpt(lines, importantIndices, 2);

      // Should not have multiple "omitted" messages for adjacent lines
      const omittedCount = (excerpt.match(/omitted/g) || []).length;
      expect(omittedCount).toBeLessThanOrEqual(2); // At most before and after
    });
  });
});
