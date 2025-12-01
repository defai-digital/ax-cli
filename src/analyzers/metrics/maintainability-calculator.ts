/**
 * Maintainability Index Calculator
 *
 * Calculates MI = 171 - 5.2*ln(V) - 0.23*CC - 16.2*ln(LOC)
 * Normalized to 0-100 scale
 */

import type { MaintainabilityIndex } from './types.js';

export class MaintainabilityCalculator {
  /**
   * Calculate Maintainability Index
   */
  calculateIndex(
    halsteadVolume: number,
    cyclomaticComplexity: number,
    linesOfCode: number
  ): MaintainabilityIndex {
    // Original formula: MI = 171 - 5.2*ln(V) - 0.23*CC - 16.2*ln(LOC)
    // Clamp values to avoid invalid log
    const V = Math.max(1, halsteadVolume);
    const CC = Math.max(1, cyclomaticComplexity);
    const LOC = Math.max(1, linesOfCode);

    const rawMI = 171 - 5.2 * Math.log(V) - 0.23 * CC - 16.2 * Math.log(LOC);

    // Normalize to 0-100 scale
    // Original MI can range from negative to ~171
    // We'll use: MI_normalized = max(0, (rawMI / 171) * 100)
    const score = Math.max(0, Math.min(100, (rawMI / 171) * 100));

    const rating = this.getRating(score);

    return Object.freeze({
      score: Math.round(score * 100) / 100,
      rating,
      halsteadVolume: V,
      cyclomaticComplexity: CC,
      linesOfCode: LOC,
    });
  }

  /**
   * Get letter rating from MI score
   */
  private getRating(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 80) return 'A'; // Highly maintainable
    if (score >= 65) return 'B'; // Moderately maintainable
    if (score >= 50) return 'C'; // Somewhat maintainable
    if (score >= 35) return 'D'; // Difficult to maintain
    return 'F'; // Very difficult to maintain
  }
}
