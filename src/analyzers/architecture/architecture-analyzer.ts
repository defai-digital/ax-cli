/**
 * Architecture Analyzer
 *
 * Main orchestrator for architecture analysis.
 * Coordinates pattern detection, anti-pattern detection, and generates recommendations.
 */

import crypto from 'crypto';
import type {
  ArchitectureAnalysis,
  AnalysisDepth,
  DetectedPattern,
  AntiPattern,
  ArchitectureRecommendation,
  ProjectStructure,
} from '../../types/analysis.js';
import { ProjectStructureScanner } from './project-structure-scanner.js';
import { AnalysisCache } from '../cache/analysis-cache.js';
import type { Logger } from '../../utils/analysis-logger.js';
import { createLogger } from '../../utils/analysis-logger.js';

// Pattern Detectors
import { MVCDetector } from './pattern-detectors/mvc-detector.js';
import { CleanArchitectureDetector } from './pattern-detectors/clean-architecture-detector.js';
import { RepositoryDetector } from './pattern-detectors/repository-detector.js';
import type { PatternDetector } from './pattern-detectors/base-detector.js';

// Anti-Pattern Detectors
import { GodObjectDetector } from './anti-pattern-detectors/god-object-detector.js';

export class ArchitectureAnalyzer {
  private readonly scanner = new ProjectStructureScanner();
  private readonly cache = new AnalysisCache<ArchitectureAnalysis>();
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || createLogger();
  }

  /**
   * Analyze project architecture
   */
  async analyzeProject(
    projectPath: string,
    depth: AnalysisDepth = 'quick'
  ): Promise<ArchitectureAnalysis> {
    const startTime = Date.now();

    this.logger.info('Starting architecture analysis', { projectPath, depth });

    try {
      // Check cache
      const hash = await this.calculateProjectHash(projectPath);
      const cached = await this.cache.get(projectPath, hash);
      if (cached) {
        this.logger.info('Returning cached analysis', { projectPath });
        return cached;
      }

      // Scan project structure
      const structure = await this.scanner.scan(projectPath);
      this.logger.debug('Project structure scanned', {
        files: structure.totalFiles,
        lines: structure.totalLines,
      });

      // Detect patterns in parallel
      const patterns = await this.detectPatterns(structure);
      this.logger.debug('Patterns detected', { count: patterns.length });

      // Detect anti-patterns in parallel (only in deep mode)
      const antiPatterns =
        depth === 'deep' ? await this.detectAntiPatterns(structure) : [];
      this.logger.debug('Anti-patterns detected', { count: antiPatterns.length });

      // Generate recommendations
      const recommendations = this.generateRecommendations(patterns, antiPatterns);

      // Calculate score
      const score = this.calculateArchitectureScore(patterns, antiPatterns);

      // Build result
      const result: ArchitectureAnalysis = Object.freeze({
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        projectPath,
        detectedPatterns: Object.freeze(patterns),
        antiPatterns: Object.freeze(antiPatterns),
        recommendations: Object.freeze(recommendations),
        architectureScore: score,
        summary: this.generateSummary(patterns, antiPatterns, score),
      });

      // Cache result
      this.cache.set(projectPath, result, hash);

      this.logger.info('Architecture analysis completed', {
        projectPath,
        duration: result.durationMs,
        patterns: patterns.length,
        antiPatterns: antiPatterns.length,
        score,
      });

      return result;
    } catch (error) {
      this.logger.error('Architecture analysis failed', error as Error, {
        projectPath,
      });
      throw error;
    }
  }

  /**
   * Detect architectural patterns
   */
  private async detectPatterns(
    structure: ProjectStructure
  ): Promise<DetectedPattern[]> {
    const detectors: PatternDetector[] = [
      new MVCDetector(),
      new CleanArchitectureDetector(),
      new RepositoryDetector(),
    ];

    // Execute all detectors in parallel
    const results = await Promise.all(
      detectors.map(async (detector) => {
        try {
          return detector.detect(structure);
        } catch (error) {
          this.logger.warn(
            `Pattern detector ${detector.constructor.name} failed`,
            { error: (error as Error).message }
          );
          return null;
        }
      })
    );

    return results.filter((p): p is DetectedPattern => p !== null);
  }

  /**
   * Detect anti-patterns
   */
  private async detectAntiPatterns(
    structure: ProjectStructure
  ): Promise<AntiPattern[]> {
    const detectors = [new GodObjectDetector()];

    // Execute in parallel and flatten results
    const results = await Promise.all(
      detectors.map(async (detector) => {
        try {
          return await detector.detect(structure);
        } catch (error) {
          this.logger.warn(
            `Anti-pattern detector ${detector.constructor.name} failed`,
            { error: (error as Error).message }
          );
          return [];
        }
      })
    );

    return results.flat();
  }

  /**
   * Generate architecture recommendations
   */
  private generateRecommendations(
    patterns: DetectedPattern[],
    antiPatterns: AntiPattern[]
  ): ArchitectureRecommendation[] {
    const recommendations: ArchitectureRecommendation[] = [];

    // If no patterns detected, suggest adopting one
    if (patterns.length === 0) {
      recommendations.push(
        Object.freeze({
          title: 'Adopt an architectural pattern',
          priority: 'medium',
          description:
            'No clear architectural pattern detected. Consider adopting one for better code organization.',
          rationale:
            'Architectural patterns improve maintainability, testability, and team collaboration',
          estimatedEffort: 'high',
          benefits: Object.freeze([
            'Improved code organization',
            'Better separation of concerns',
            'Easier onboarding for new developers',
            'Reduced coupling between components',
          ]),
          tradeoffs: Object.freeze([
            'Initial learning curve',
            'Refactoring required',
            'More boilerplate code initially',
          ]),
          relatedPatterns: Object.freeze([
            'MVC',
            'Clean Architecture',
            'Layered Architecture',
          ]),
        })
      );
    }

    // For each anti-pattern, create a recommendation
    for (const antiPattern of antiPatterns) {
      recommendations.push(
        Object.freeze({
          title: `Fix ${antiPattern.name}`,
          priority: antiPattern.severity,
          description: antiPattern.suggestion,
          rationale: antiPattern.impact,
          estimatedEffort: this.estimateEffort(antiPattern),
          benefits: Object.freeze([
            'Improved maintainability',
            'Better testability',
            'Reduced coupling',
            'Easier to understand and modify',
          ]),
          tradeoffs: Object.freeze(['Requires refactoring time']),
          relatedPatterns: Object.freeze(this.getRelatedPatterns(antiPattern)),
        })
      );
    }

    return recommendations;
  }

  /**
   * Calculate overall architecture score (0-100)
   */
  private calculateArchitectureScore(
    patterns: DetectedPattern[],
    antiPatterns: AntiPattern[]
  ): number {
    let score = 50; // Base score

    // Bonus for detected patterns
    score += patterns.length * 10;
    score += patterns.reduce((sum, p) => sum + p.confidence * 10, 0);

    // Penalty for anti-patterns
    const severityPenalty: Record<string, number> = {
      critical: 25,
      high: 15,
      medium: 10,
      low: 5,
      info: 0,
    };

    for (const antiPattern of antiPatterns) {
      score -= severityPenalty[antiPattern.severity] || 0;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate analysis summary
   */
  private generateSummary(
    patterns: DetectedPattern[],
    antiPatterns: AntiPattern[],
    score: number
  ): string {
    const parts: string[] = [];

    if (patterns.length > 0) {
      const patternNames = patterns.map((p) => p.name).join(', ');
      parts.push(
        `Detected ${patterns.length} architectural pattern${patterns.length === 1 ? '' : 's'}: ${patternNames}`
      );
    } else {
      parts.push('No clear architectural patterns detected');
    }

    if (antiPatterns.length > 0) {
      const antiPatternNames = antiPatterns.map((ap) => ap.name).join(', ');
      parts.push(
        `Found ${antiPatterns.length} anti-pattern${antiPatterns.length === 1 ? '' : 's'}: ${antiPatternNames}`
      );
    }

    const grade = this.getGrade(score);
    parts.push(`Overall architecture score: ${score}/100 (Grade: ${grade})`);

    return parts.join('. ');
  }

  /**
   * Calculate project hash for cache validation
   */
  private async calculateProjectHash(projectPath: string): Promise<string> {
    try {
      const structure = await this.scanner.scan(projectPath);
      // Simple hash based on file count and total lines
      const hashInput = `${structure.totalFiles}-${structure.totalLines}`;
      return crypto.createHash('sha256').update(hashInput).digest('hex');
    } catch {
      // Fallback to path-based hash
      return crypto.createHash('sha256').update(projectPath).digest('hex');
    }
  }

  /**
   * Estimate effort required to fix anti-pattern
   */
  private estimateEffort(antiPattern: AntiPattern): 'low' | 'medium' | 'high' {
    switch (antiPattern.severity) {
      case 'critical':
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Get related patterns for anti-pattern remediation
   */
  private getRelatedPatterns(antiPattern: AntiPattern): string[] {
    const patternMap: Record<string, string[]> = {
      'God Object': ['Single Responsibility', 'Extract Class', 'Facade'],
      'Circular Dependencies': [
        'Dependency Injection',
        'Interface Segregation',
      ],
    };

    return patternMap[antiPattern.name] || [];
  }

  /**
   * Get letter grade from score
   */
  private getGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
