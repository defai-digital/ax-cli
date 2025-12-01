/**
 * Base Pattern Detector
 *
 * Abstract base class for all pattern detectors.
 * Provides common utilities and enforces interface contract.
 */

import type { DetectedPattern, ProjectStructure } from '../../../types/analysis.js';
import { ProjectStructureScanner } from '../project-structure-scanner.js';

export interface PatternDetector {
  /**
   * Detect pattern in project structure
   * Returns null if pattern is not detected
   */
  detect(structure: ProjectStructure): DetectedPattern | null;
}

export abstract class BasePatternDetector implements PatternDetector {
  protected readonly scanner = new ProjectStructureScanner();

  abstract detect(structure: ProjectStructure): DetectedPattern | null;

  /**
   * Create a detected pattern with proper typing and immutability
   */
  protected createPattern(
    name: string,
    category: DetectedPattern['category'],
    confidence: number,
    locations: string[],
    description: string,
    metadata?: Record<string, unknown>
  ): DetectedPattern {
    return Object.freeze({
      name,
      category,
      confidence: Math.max(0, Math.min(1, confidence)),
      locations: Object.freeze(locations),
      description,
      metadata: metadata ? Object.freeze(metadata) : undefined,
    });
  }

  /**
   * Calculate confidence based on number of matches vs expected
   */
  protected calculateConfidence(
    matched: number,
    expected: number,
    baseConfidence = 0.5
  ): number {
    const ratio = matched / expected;
    return Math.min(1.0, baseConfidence + ratio * (1.0 - baseConfidence));
  }
}
