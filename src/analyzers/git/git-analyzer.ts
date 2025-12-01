/**
 * Git Analyzer
 *
 * Main orchestrator for Git history analysis
 */

import { ChurnCalculator } from './churn-calculator.js';
import { HotspotDetector } from './hotspot-detector.js';
import type { GitAnalysisResult, GitAnalysisOptions, GitAnalysisSummary } from './types.js';

export class GitAnalyzer {
  private churnCalculator: ChurnCalculator;
  private hotspotDetector: HotspotDetector;

  constructor(repositoryPath: string) {
    this.churnCalculator = new ChurnCalculator(repositoryPath);
    this.hotspotDetector = new HotspotDetector();
  }

  /**
   * Perform complete Git analysis
   */
  async analyze(options: GitAnalysisOptions = {}): Promise<GitAnalysisResult> {
    const timestamp = new Date();

    // Calculate churn metrics
    const churnMetrics = await this.churnCalculator.calculateChurn(options);

    // Calculate contributor statistics
    const contributors = await this.churnCalculator.calculateContributorStats(options);

    // Detect hotspots
    const hotspots = await this.hotspotDetector.detectHotspots(churnMetrics, options);

    // Calculate summary
    const summary = this.calculateSummary(churnMetrics, hotspots, contributors);

    return Object.freeze({
      hotspots: Object.freeze(hotspots),
      churnMetrics: Object.freeze(churnMetrics),
      contributors: Object.freeze(contributors),
      summary: Object.freeze(summary),
      timestamp,
    });
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    churnMetrics: readonly any[],
    hotspots: readonly any[],
    contributors: readonly any[]
  ): GitAnalysisSummary {
    const totalCommits = contributors.reduce((sum, c) => sum + c.commitCount, 0);
    const averageChurn = churnMetrics.length > 0
      ? churnMetrics.reduce((sum, c) => sum + c.totalChurn, 0) / churnMetrics.length
      : 0;

    const topContributor = contributors.length > 0
      ? contributors[0].author
      : 'Unknown';

    // Determine date range
    let earliestDate = new Date();
    let latestDate = new Date(0);

    for (const contributor of contributors) {
      if (contributor.firstCommit < earliestDate) {
        earliestDate = contributor.firstCommit;
      }
      if (contributor.lastCommit > latestDate) {
        latestDate = contributor.lastCommit;
      }
    }

    return {
      totalCommits,
      filesAnalyzed: churnMetrics.length,
      hotspotCount: hotspots.length,
      averageChurn: Math.round(averageChurn),
      topContributor,
      dateRange: {
        from: earliestDate,
        to: latestDate,
      },
    };
  }
}
