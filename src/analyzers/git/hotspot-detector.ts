/**
 * Hotspot Detector
 *
 * Identifies code hotspots using churn × complexity formula
 */

import { getMultiLanguageParser, type MultiLanguageParser } from '../ast/multi-language-parser.js';
import type { FileChurn, CodeHotspot, GitAnalysisOptions } from './types.js';

export class HotspotDetector {
  private astParser: MultiLanguageParser;

  constructor() {
    this.astParser = getMultiLanguageParser();
  }

  /**
   * Detect hotspots from churn metrics
   */
  async detectHotspots(
    churnMetrics: readonly FileChurn[],
    options: GitAnalysisOptions = {}
  ): Promise<CodeHotspot[]> {
    const threshold = options.hotspotThreshold ?? 70;
    const hotspots: CodeHotspot[] = [];

    // Calculate max values for normalization
    // BUG FIX: Handle empty arrays safely to avoid -Infinity from Math.max
    const churnValues = churnMetrics.map(c => c.totalChurn);
    const commitValues = churnMetrics.map(c => c.commitCount);
    const maxChurn = churnValues.length > 0 ? Math.max(...churnValues) : 1;
    const maxCommits = commitValues.length > 0 ? Math.max(...commitValues) : 1;

    for (const churn of churnMetrics) {
      try {
        // Get complexity metrics from AST
        const complexity = await this.getComplexityMetrics(churn.filePath);

        if (!complexity) continue;

        // Normalize churn (0-100)
        const normalizedChurn = (churn.totalChurn / maxChurn) * 100;
        const normalizedCommits = (churn.commitCount / maxCommits) * 100;
        const churnScore = (normalizedChurn * 0.6 + normalizedCommits * 0.4);

        // Normalize complexity (0-100)
        const complexityScore = this.normalizeComplexity(
          complexity.average,
          complexity.max
        );

        // Calculate hotspot score using weighted formula
        // Churn: 40%, Complexity: 30%, Commit Frequency: 30%
        const hotspotScore = Math.round(
          churnScore * 0.4 +
          complexityScore * 0.3 +
          normalizedCommits * 0.3
        );

        // Only include if above threshold
        if (hotspotScore >= threshold) {
          const severity = this.calculateSeverity(hotspotScore);
          const reason = this.generateReason(churn, complexity, hotspotScore);
          const recommendation = this.generateRecommendation(churn, complexity, severity);

          hotspots.push(
            Object.freeze({
              filePath: churn.filePath,
              hotspotScore,
              churnScore: Math.round(churnScore),
              complexityScore: Math.round(complexityScore),
              commitCount: churn.commitCount,
              totalChurn: churn.totalChurn,
              averageComplexity: complexity.average,
              maxComplexity: complexity.max,
              severity,
              reason,
              recommendation,
            })
          );
        }
      } catch {
        // Skip files that can't be analyzed
        continue;
      }
    }

    // Sort by hotspot score (descending)
    return hotspots.sort((a, b) => b.hotspotScore - a.hotspotScore);
  }

  /**
   * Get complexity metrics from file
   */
  private async getComplexityMetrics(
    filePath: string
  ): Promise<{ average: number; max: number } | null> {
    try {
      const ast = await this.astParser.parseFile(filePath);

      const complexities: number[] = [];

      // Collect function complexities
      for (const func of ast.functions) {
        complexities.push(func.complexity);
      }

      // Collect method complexities
      for (const cls of ast.classes) {
        for (const method of cls.methods) {
          complexities.push(method.complexity);
        }
      }

      if (complexities.length === 0) {
        return null;
      }

      const average = complexities.reduce((sum, c) => sum + c, 0) / complexities.length;
      const max = Math.max(...complexities);

      return { average, max };
    } catch {
      return null;
    }
  }

  /**
   * Normalize complexity to 0-100 scale
   */
  private normalizeComplexity(average: number, max: number): number {
    // McCabe complexity thresholds:
    // 1-10: Simple
    // 11-20: Moderate
    // 21-50: Complex
    // 50+: Very complex

    const avgScore = Math.min(100, (average / 20) * 100);
    const maxScore = Math.min(100, (max / 50) * 100);

    // Weight average more than max
    return avgScore * 0.7 + maxScore * 0.3;
  }

  /**
   * Calculate severity based on hotspot score
   */
  private calculateSeverity(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 90) return 'CRITICAL';
    if (score >= 80) return 'HIGH';
    if (score >= 70) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate reason for hotspot
   */
  private generateReason(
    churn: FileChurn,
    complexity: { average: number; max: number },
    score: number
  ): string {
    const reasons: string[] = [];

    if (churn.commitCount > 20) {
      reasons.push(`high change frequency (${churn.commitCount} commits)`);
    }

    if (churn.totalChurn > 500) {
      reasons.push(`high churn (${churn.totalChurn} lines changed)`);
    }

    if (complexity.average > 10) {
      reasons.push(`high average complexity (${complexity.average.toFixed(1)})`);
    }

    if (complexity.max > 20) {
      reasons.push(`very complex functions (max: ${complexity.max})`);
    }

    if (churn.authors.length > 5) {
      reasons.push(`many contributors (${churn.authors.length})`);
    }

    return `Hotspot (score: ${score}/100): ${reasons.join(', ')}`;
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(
    churn: FileChurn,
    complexity: { average: number; max: number },
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): string {
    const recommendations: string[] = [];

    if (complexity.max > 20) {
      recommendations.push('Reduce complexity by breaking down complex functions');
    }

    if (churn.commitCount > 30) {
      recommendations.push('Stabilize this file - consider refactoring to reduce change frequency');
    }

    if (churn.authors.length > 8) {
      recommendations.push('Establish clear ownership and coding standards');
    }

    if (complexity.average > 15) {
      recommendations.push('Simplify logic and improve code structure');
    }

    if (recommendations.length === 0) {
      recommendations.push('Monitor this file for further changes and consider refactoring');
    }

    const prefix = severity === 'CRITICAL' || severity === 'HIGH'
      ? 'URGENT: '
      : severity === 'MEDIUM'
      ? 'Important: '
      : '';

    return prefix + recommendations.join('. ') + '.';
  }
}
