/**
 * Security Analyzer
 *
 * Main orchestrator for security vulnerability detection
 */

import type {
  SecurityDetector,
  FileSecurityResult,
  BatchSecurityResult,
  SecurityScanOptions,
  SecuritySeverity,
  SecurityVulnerability,
} from './types.js';
import { promises as fs } from 'fs';
import { glob } from 'glob';

// Import all detectors
import { SQLInjectionDetector } from './detectors/sql-injection-detector.js';
import { XSSDetector } from './detectors/xss-detector.js';
import { HardcodedSecretsDetector } from './detectors/hardcoded-secrets-detector.js';
import { InsecureRandomDetector } from './detectors/insecure-random-detector.js';
import { PathTraversalDetector } from './detectors/path-traversal-detector.js';
import { CommandInjectionDetector } from './detectors/command-injection-detector.js';
import { WeakCryptoDetector } from './detectors/weak-crypto-detector.js';
import { InsecureDeserializationDetector } from './detectors/insecure-deserialization-detector.js';

export class SecurityAnalyzer {
  private detectors: Map<string, SecurityDetector>;

  constructor() {
    this.detectors = new Map();
    this.registerDefaultDetectors();
  }

  /**
   * Register all default security detectors
   */
  private registerDefaultDetectors(): void {
    const detectors = [
      new SQLInjectionDetector(),
      new XSSDetector(),
      new HardcodedSecretsDetector(),
      new InsecureRandomDetector(),
      new PathTraversalDetector(),
      new CommandInjectionDetector(),
      new WeakCryptoDetector(),
      new InsecureDeserializationDetector(),
    ];

    for (const detector of detectors) {
      this.detectors.set(detector.id, detector);
    }
  }

  /**
   * Scan a single file for security vulnerabilities
   */
  async scanFile(filePath: string, options: SecurityScanOptions = {}): Promise<FileSecurityResult> {
    const startTime = Date.now();

    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');

      // Check file size limit
      const maxFileSize = options.maxFileSize || 1024 * 1024; // 1MB default
      if (content.length > maxFileSize) {
        return Object.freeze({
          file: filePath,
          vulnerabilities: Object.freeze([]),
          riskScore: 0,
          timestamp: new Date(),
          durationMs: Date.now() - startTime,
        });
      }

      // Run all applicable detectors in parallel
      const detectorPromises: Promise<SecurityVulnerability[]>[] = [];

      for (const detector of this.detectors.values()) {
        // Check if detector is enabled
        const detectorConfig = options.detectors?.[detector.id];
        if (detectorConfig && !detectorConfig.enabled) {
          continue;
        }

        // Check if detector applies to this file
        if (!detector.appliesTo(filePath)) {
          continue;
        }

        // Run detector
        detectorPromises.push(detector.scan(content, filePath));
      }

      // Wait for all detectors to complete
      const results = await Promise.all(detectorPromises);

      // Flatten vulnerabilities
      let vulnerabilities = results.flat();

      // Filter out info-level findings if not requested
      if (!options.includeInfo) {
        vulnerabilities = vulnerabilities.filter(v => v.severity !== 'info');
      }

      // Calculate risk score
      const riskScore = this.calculateRiskScore(vulnerabilities);

      return Object.freeze({
        file: filePath,
        vulnerabilities: Object.freeze(vulnerabilities),
        riskScore,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      });
    } catch {
      // Return empty result on error
      return Object.freeze({
        file: filePath,
        vulnerabilities: Object.freeze([]),
        riskScore: 0,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      });
    }
  }

  /**
   * Scan multiple files in batch
   */
  async scanBatch(
    files: string[],
    options: SecurityScanOptions = {}
  ): Promise<BatchSecurityResult> {
    const timestamp = new Date();

    // Scan files with concurrency control
    const maxConcurrent = 5;
    const fileResults: FileSecurityResult[] = [];

    for (let i = 0; i < files.length; i += maxConcurrent) {
      const batch = files.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map(file => this.scanFile(file, options))
      );
      fileResults.push(...batchResults);
    }

    // Calculate summary statistics
    const totalVulnerabilities = fileResults.reduce(
      (sum, result) => sum + result.vulnerabilities.length,
      0
    );

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let infoCount = 0;

    for (const result of fileResults) {
      for (const vuln of result.vulnerabilities) {
        switch (vuln.severity) {
          case 'critical':
            criticalCount++;
            break;
          case 'high':
            highCount++;
            break;
          case 'medium':
            mediumCount++;
            break;
          case 'low':
            lowCount++;
            break;
          case 'info':
            infoCount++;
            break;
        }
      }
    }

    // Calculate average risk score
    const averageRiskScore =
      fileResults.length > 0
        ? fileResults.reduce((sum, r) => sum + r.riskScore, 0) / fileResults.length
        : 0;

    // Find highest risk files
    const highestRiskFiles = fileResults
      .filter(r => r.riskScore > 0)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10)
      .map(r => ({ file: r.file, score: r.riskScore }));

    return Object.freeze({
      files: Object.freeze(fileResults),
      totalVulnerabilities,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      infoCount,
      averageRiskScore,
      highestRiskFiles: Object.freeze(highestRiskFiles),
      timestamp,
    });
  }

  /**
   * Scan directory with pattern
   */
  async scanDirectory(
    directory: string,
    pattern: string = '**/*.{ts,tsx,js,jsx}',
    options: SecurityScanOptions = {}
  ): Promise<BatchSecurityResult> {
    // Find all matching files
    const files = await glob(pattern, {
      cwd: directory,
      absolute: true,
      nodir: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    });

    return this.scanBatch(files, options);
  }

  /**
   * Calculate risk score for a file based on vulnerabilities
   */
  private calculateRiskScore(vulnerabilities: readonly SecurityVulnerability[]): number {
    if (vulnerabilities.length === 0) return 0;

    const severityWeights: Record<SecuritySeverity, number> = {
      critical: 10,
      high: 7,
      medium: 4,
      low: 2,
      info: 1,
    };

    let totalScore = 0;
    for (const vuln of vulnerabilities) {
      totalScore += severityWeights[vuln.severity];
    }

    // Normalize to 0-100 scale
    const maxScore = vulnerabilities.length * 10; // Assume all critical
    return Math.min(100, Math.round((totalScore / maxScore) * 100));
  }

  /**
   * Get list of all registered detectors
   */
  getDetectors(): SecurityDetector[] {
    return Array.from(this.detectors.values());
  }

  /**
   * Get detector by ID
   */
  getDetector(id: string): SecurityDetector | undefined {
    return this.detectors.get(id);
  }
}
