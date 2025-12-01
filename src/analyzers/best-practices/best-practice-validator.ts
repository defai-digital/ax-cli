/**
 * Best Practice Validator
 *
 * Main orchestrator for validation operations
 */

import type {
  ValidationResult,
  BatchValidationResult,
  Violation,
  ValidationOptions,
} from '../../types/analysis.js';
import { getRuleRegistry } from './rules/index.js';
import type { Logger } from '../../utils/analysis-logger.js';
import { createLogger } from '../../utils/analysis-logger.js';
import { promises as fs } from 'fs';
import path from 'path';

export class BestPracticeValidator {
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || createLogger();
  }

  /**
   * Validate a single file
   */
  async validateFile(
    filePath: string,
    options?: ValidationOptions
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Read file
      const content = await fs.readFile(filePath, 'utf-8');

      // Detect language from extension
      const language = this.detectLanguage(filePath);

      // Get applicable rules
      const registry = getRuleRegistry();
      const allRules = registry.getAll();
      const enabledRules = allRules.filter(rule => {
        const config = options?.rules?.[rule.id];
        return config?.enabled !== false; // Enabled by default
      });

      this.logger.debug('Validating file', {
        file: filePath,
        language,
        ruleCount: enabledRules.length,
      });

      // Run all rules in parallel
      const violationArrays = await Promise.all(
        enabledRules.map(async rule => {
          try {
            const violations = await rule.check(filePath, content);
            return violations;
          } catch (error) {
            this.logger.warn(`Rule ${rule.id} failed`, {
              error: (error as Error).message,
            });
            return [];
          }
        })
      );

      // Flatten violations
      const violations = violationArrays.flat();

      // Calculate score (0-100)
      const score = this.calculateScore(violations);

      const result: ValidationResult = Object.freeze({
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        projectPath: path.dirname(filePath),
        file: filePath,
        language,
        violations: Object.freeze(violations),
        score,
        summary: this.generateSummary(violations, score),
      });

      return result;
    } catch (error) {
      throw new Error(
        `Failed to validate file ${filePath}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Validate multiple files in batch
   */
  async validateBatch(
    filePaths: string[],
    options?: ValidationOptions
  ): Promise<BatchValidationResult> {
    const startTime = Date.now();

    this.logger.info('Starting batch validation', { fileCount: filePaths.length });

    // Validate all files in parallel (with concurrency limit)
    const CONCURRENCY = 5;
    const results: ValidationResult[] = [];

    for (let i = 0; i < filePaths.length; i += CONCURRENCY) {
      const batch = filePaths.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async filePath => {
          try {
            return await this.validateFile(filePath, options);
          } catch (error) {
            this.logger.warn(`Failed to validate ${filePath}`, {
              error: (error as Error).message,
            });
            return null;
          }
        })
      );
      results.push(...batchResults.filter((r): r is ValidationResult => r !== null));
    }

    // Calculate aggregate metrics
    const allViolations = results.flatMap(r => Array.from(r.violations));
    const criticalCount = allViolations.filter(v => v.severity === 'critical').length;
    const highCount = allViolations.filter(v => v.severity === 'high').length;
    const averageScore =
      results.reduce((sum, r) => sum + r.score, 0) / (results.length || 1);

    const result: BatchValidationResult = Object.freeze({
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
      projectPath: path.dirname(filePaths[0] || process.cwd()),
      files: Object.freeze(results),
      totalViolations: allViolations.length,
      criticalCount,
      highCount,
      averageScore: Math.round(averageScore),
      summary: this.generateBatchSummary(results, allViolations.length),
    });

    this.logger.info('Batch validation completed', {
      fileCount: results.length,
      violations: allViolations.length,
      averageScore: result.averageScore,
    });

    return result;
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): 'typescript' | 'javascript' {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.ts' || ext === '.tsx') {
      return 'typescript';
    }
    return 'javascript';
  }

  /**
   * Calculate quality score (0-100)
   */
  private calculateScore(violations: readonly Violation[]): number {
    let score = 100;

    const severityPenalty: Record<string, number> = {
      critical: 10,
      high: 5,
      medium: 2,
      low: 1,
      info: 0,
    };

    for (const violation of violations) {
      score -= severityPenalty[violation.severity] || 0;
    }

    // Bonus for clean code
    if (violations.length === 0) {
      score = 100;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate summary text
   */
  private generateSummary(violations: readonly Violation[], score: number): string {
    if (violations.length === 0) {
      return `Perfect score! No violations found. (Score: ${score}/100)`;
    }

    const bySeverity = {
      critical: violations.filter(v => v.severity === 'critical').length,
      high: violations.filter(v => v.severity === 'high').length,
      medium: violations.filter(v => v.severity === 'medium').length,
      low: violations.filter(v => v.severity === 'low').length,
    };

    const parts: string[] = [`Found ${violations.length} violation(s)`];

    if (bySeverity.critical > 0) parts.push(`${bySeverity.critical} critical`);
    if (bySeverity.high > 0) parts.push(`${bySeverity.high} high`);
    if (bySeverity.medium > 0) parts.push(`${bySeverity.medium} medium`);
    if (bySeverity.low > 0) parts.push(`${bySeverity.low} low`);

    parts.push(`Score: ${score}/100`);

    return parts.join(', ');
  }

  /**
   * Generate batch summary
   */
  private generateBatchSummary(
    results: readonly ValidationResult[],
    totalViolations: number
  ): string {
    const avgScore =
      results.reduce((sum, r) => sum + r.score, 0) / (results.length || 1);

    return `Validated ${results.length} file(s). Found ${totalViolations} violation(s). Average score: ${Math.round(avgScore)}/100`;
  }
}
