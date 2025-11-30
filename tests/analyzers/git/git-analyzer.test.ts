/**
 * Git Analyzer Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GitAnalyzer } from '../../../src/analyzers/git/git-analyzer.js';
import { ChurnCalculator } from '../../../src/analyzers/git/churn-calculator.js';
import { HotspotDetector } from '../../../src/analyzers/git/hotspot-detector.js';
import { execSync } from 'child_process';
import path from 'path';

// Use current repository for tests
const REPO_PATH = process.cwd();

describe('GitAnalyzer', () => {
  let analyzer: GitAnalyzer;

  beforeAll(() => {
    // Verify we're in a git repository
    try {
      execSync('git rev-parse --git-dir', { cwd: REPO_PATH });
    } catch (error) {
      throw new Error('Tests must be run in a git repository');
    }

    analyzer = new GitAnalyzer(REPO_PATH);
  });

  describe('analyze', () => {
    it('should perform complete analysis', async () => {
      const result = await analyzer.analyze({
        since: '1 month ago',
        includePatterns: ['*.ts', '*.tsx'],
        excludePatterns: ['**/node_modules/**', '**/dist/**'],
      });

      expect(result).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.churnMetrics).toBeDefined();
      expect(result.hotspots).toBeDefined();
      expect(result.contributors).toBeDefined();
      expect(result.summary).toBeDefined();
    }, 300000); // 5 minute timeout for git analysis (slow on Windows)

    it('should include summary statistics', async () => {
      const result = await analyzer.analyze({ since: '1 month ago' });

      expect(result.summary.totalCommits).toBeGreaterThanOrEqual(0);
      expect(result.summary.filesAnalyzed).toBeGreaterThanOrEqual(0);
      expect(result.summary.hotspotCount).toBeGreaterThanOrEqual(0);
      expect(result.summary.averageChurn).toBeGreaterThanOrEqual(0);
      expect(result.summary.topContributor).toBeDefined();
      expect(result.summary.dateRange.from).toBeInstanceOf(Date);
      expect(result.summary.dateRange.to).toBeInstanceOf(Date);
    }, 300000); // 5 minute timeout for git analysis (slow on Windows)

    it('should handle date range options', async () => {
      const result = await analyzer.analyze({
        since: '6 months ago',
        until: '1 month ago',
      });

      expect(result).toBeDefined();
      expect(result.summary.totalCommits).toBeGreaterThanOrEqual(0);
    }, 300000); // 5 minute timeout for git analysis (slow on Windows)

    it('should respect hotspot threshold', async () => {
      const result = await analyzer.analyze({
        since: '1 month ago',
        hotspotThreshold: 90, // Very high threshold
      });

      // With high threshold, fewer hotspots should be detected
      expect(result.hotspots).toBeDefined();
      expect(Array.isArray(result.hotspots)).toBe(true);
    }, 300000); // 5 minute timeout for git analysis (slow on Windows)
  });

  describe('ChurnCalculator', () => {
    let calculator: ChurnCalculator;

    beforeAll(() => {
      calculator = new ChurnCalculator(REPO_PATH);
    });

    it('should calculate file churn', async () => {
      const churn = await calculator.calculateChurn({ since: '1 month ago' });

      expect(Array.isArray(churn)).toBe(true);

      if (churn.length > 0) {
        const firstFile = churn[0];
        expect(firstFile.filePath).toBeDefined();
        expect(firstFile.commitCount).toBeGreaterThan(0);
        expect(firstFile.additions).toBeGreaterThanOrEqual(0);
        expect(firstFile.deletions).toBeGreaterThanOrEqual(0);
        expect(firstFile.totalChurn).toBe(firstFile.additions + firstFile.deletions);
        expect(firstFile.lastModified).toBeInstanceOf(Date);
        expect(Array.isArray(firstFile.authors)).toBe(true);
      }
    });

    it('should sort by total churn descending', async () => {
      const churn = await calculator.calculateChurn({ since: '1 month ago' });

      if (churn.length > 1) {
        for (let i = 0; i < churn.length - 1; i++) {
          expect(churn[i].totalChurn).toBeGreaterThanOrEqual(churn[i + 1].totalChurn);
        }
      }
    });

    it('should calculate contributor stats', async () => {
      const contributors = await calculator.calculateContributorStats({ since: '1 month ago' });

      expect(Array.isArray(contributors)).toBe(true);

      if (contributors.length > 0) {
        const topContributor = contributors[0];
        expect(topContributor.author).toBeDefined();
        expect(topContributor.commitCount).toBeGreaterThan(0);
        expect(topContributor.filesChanged).toBeGreaterThan(0);
        expect(topContributor.linesAdded).toBeGreaterThanOrEqual(0);
        expect(topContributor.linesDeleted).toBeGreaterThanOrEqual(0);
        expect(topContributor.firstCommit).toBeInstanceOf(Date);
        expect(topContributor.lastCommit).toBeInstanceOf(Date);
      }
    });

    it('should sort contributors by commit count', async () => {
      const contributors = await calculator.calculateContributorStats({ since: '1 month ago' });

      if (contributors.length > 1) {
        for (let i = 0; i < contributors.length - 1; i++) {
          expect(contributors[i].commitCount).toBeGreaterThanOrEqual(contributors[i + 1].commitCount);
        }
      }
    });

    it('should respect include patterns', async () => {
      const churn = await calculator.calculateChurn({
        since: '1 month ago',
        includePatterns: ['*.ts'],
      });

      for (const file of churn) {
        expect(file.filePath.endsWith('.ts')).toBe(true);
      }
    });

    it('should respect exclude patterns', async () => {
      const churn = await calculator.calculateChurn({
        since: '1 month ago',
        excludePatterns: ['**/node_modules/**', '**/dist/**'],
      });

      for (const file of churn) {
        expect(file.filePath).not.toContain('node_modules');
        expect(file.filePath).not.toContain('/dist/');
      }
    });
  });

  describe('HotspotDetector', () => {
    let detector: HotspotDetector;

    beforeAll(() => {
      detector = new HotspotDetector();
    });

    it('should detect hotspots from churn metrics', async () => {
      const calculator = new ChurnCalculator(REPO_PATH);
      const churn = await calculator.calculateChurn({ since: '6 months ago' });

      const hotspots = await detector.detectHotspots(churn, { hotspotThreshold: 70 });

      expect(Array.isArray(hotspots)).toBe(true);

      if (hotspots.length > 0) {
        const hotspot = hotspots[0];
        expect(hotspot.filePath).toBeDefined();
        expect(hotspot.hotspotScore).toBeGreaterThanOrEqual(70);
        expect(hotspot.hotspotScore).toBeLessThanOrEqual(100);
        expect(hotspot.churnScore).toBeGreaterThanOrEqual(0);
        expect(hotspot.complexityScore).toBeGreaterThanOrEqual(0);
        expect(hotspot.commitCount).toBeGreaterThan(0);
        expect(hotspot.severity).toMatch(/LOW|MEDIUM|HIGH|CRITICAL/);
        expect(hotspot.reason).toBeDefined();
        expect(hotspot.recommendation).toBeDefined();
      }
    }, 300000); // 5 minute timeout for git analysis (slow on Windows)

    it('should sort hotspots by score descending', async () => {
      const calculator = new ChurnCalculator(REPO_PATH);
      const churn = await calculator.calculateChurn({ since: '6 months ago' });

      const hotspots = await detector.detectHotspots(churn, { hotspotThreshold: 60 });

      if (hotspots.length > 1) {
        for (let i = 0; i < hotspots.length - 1; i++) {
          expect(hotspots[i].hotspotScore).toBeGreaterThanOrEqual(hotspots[i + 1].hotspotScore);
        }
      }
    }, 300000); // 5 minute timeout for git analysis (slow on Windows)

    it('should assign appropriate severity levels', async () => {
      const calculator = new ChurnCalculator(REPO_PATH);
      const churn = await calculator.calculateChurn({ since: '6 months ago' });

      const hotspots = await detector.detectHotspots(churn);

      for (const hotspot of hotspots) {
        if (hotspot.hotspotScore >= 90) {
          expect(hotspot.severity).toBe('CRITICAL');
        } else if (hotspot.hotspotScore >= 80) {
          expect(hotspot.severity).toBe('HIGH');
        } else if (hotspot.hotspotScore >= 70) {
          expect(hotspot.severity).toBe('MEDIUM');
        } else {
          expect(hotspot.severity).toBe('LOW');
        }
      }
    }, 300000); // 5 minute timeout for git analysis (slow on Windows)

    it('should generate meaningful reasons', async () => {
      const calculator = new ChurnCalculator(REPO_PATH);
      const churn = await calculator.calculateChurn({ since: '6 months ago' });

      const hotspots = await detector.detectHotspots(churn);

      for (const hotspot of hotspots) {
        expect(hotspot.reason).toContain('Hotspot');
        expect(hotspot.reason).toContain('score:');
        expect(hotspot.reason.length).toBeGreaterThan(20);
      }
    }, 300000); // 5 minute timeout for git analysis (slow on Windows)

    it('should generate actionable recommendations', async () => {
      const calculator = new ChurnCalculator(REPO_PATH);
      const churn = await calculator.calculateChurn({ since: '6 months ago' });

      const hotspots = await detector.detectHotspots(churn);

      for (const hotspot of hotspots) {
        expect(hotspot.recommendation).toBeDefined();
        expect(hotspot.recommendation.length).toBeGreaterThan(10);

        if (hotspot.severity === 'CRITICAL' || hotspot.severity === 'HIGH') {
          expect(hotspot.recommendation).toMatch(/URGENT|Important/i);
        }
      }
    }, 300000); // 5 minute timeout for git analysis (slow on Windows)
  });

  describe('Integration', () => {
    it('should handle empty git history gracefully', async () => {
      const result = await analyzer.analyze({
        since: '1 day ago',
        until: '1 day ago', // Empty range
      });

      expect(result).toBeDefined();
      expect(result.summary.totalCommits).toBe(0);
      expect(result.churnMetrics).toEqual([]);
      expect(result.hotspots).toEqual([]);
    });

    it('should handle non-existent file patterns', async () => {
      const result = await analyzer.analyze({
        since: '1 month ago',
        includePatterns: ['*.nonexistent'],
      });

      expect(result).toBeDefined();
      expect(result.churnMetrics.length).toBe(0);
    });
  });
});
