/**
 * Code Smell Analyzer
 *
 * Main orchestrator for code smell detection
 */

import { glob } from 'glob';
import { SmellType, SmellSeverity, type CodeSmell, type CodeSmellAnalysisResult, type CodeSmellAnalysisOptions, type DetectorConfig } from './types.js';
import { LongMethodDetector } from './detectors/long-method-detector.js';
import { LargeClassDetector } from './detectors/large-class-detector.js';
import { LongParameterListDetector } from './detectors/long-parameter-list-detector.js';
import { MagicNumbersDetector } from './detectors/magic-numbers-detector.js';
import { NestedConditionalsDetector } from './detectors/nested-conditionals-detector.js';
import { DeadCodeDetector } from './detectors/dead-code-detector.js';
import { DuplicateCodeDetector } from './detectors/duplicate-code-detector.js';
import { FeatureEnvyDetector } from './detectors/feature-envy-detector.js';
import { DataClumpsDetector } from './detectors/data-clumps-detector.js';
import { InappropriateIntimacyDetector } from './detectors/inappropriate-intimacy-detector.js';
import type { SmellDetector } from './types.js';

export class CodeSmellAnalyzer {
  private detectors: Map<SmellType, SmellDetector>;

  constructor(options: CodeSmellAnalysisOptions = {}) {
    this.detectors = new Map();
    this.initializeDetectors(options);
  }

  /**
   * Initialize all detectors with configuration
   */
  private initializeDetectors(options: CodeSmellAnalysisOptions): void {
    const defaultConfig: DetectorConfig = { enabled: true };

    const detectorClasses = [
      LongMethodDetector,
      LargeClassDetector,
      LongParameterListDetector,
      MagicNumbersDetector,
      NestedConditionalsDetector,
      DeadCodeDetector,
      DuplicateCodeDetector,
      FeatureEnvyDetector,
      DataClumpsDetector,
      InappropriateIntimacyDetector,
    ];

    for (const DetectorClass of detectorClasses) {
      const detector = new DetectorClass(defaultConfig);
      const config = options.detectorConfigs?.[detector.type] ?? defaultConfig;
      const configuredDetector = new DetectorClass(config);
      this.detectors.set(configuredDetector.type, configuredDetector);
    }
  }

  /**
   * Analyze directory for code smells
   */
  async analyzeDirectory(
    directory: string,
    pattern: string = '**/*.{ts,tsx,js,jsx}',
    options: CodeSmellAnalysisOptions = {}
  ): Promise<CodeSmellAnalysisResult> {
    const timestamp = new Date();

    // Find all files
    const ignorePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      ...(options.ignorePatterns || []),
    ];

    const files = await glob(pattern, {
      cwd: directory,
      absolute: true,
      nodir: true,
      ignore: ignorePatterns,
    });

    // Analyze all files
    const allSmells: CodeSmell[] = [];
    const filesWithSmells = new Set<string>();

    for (const file of files) {
      for (const detector of this.detectors.values()) {
        try {
          const smells = await detector.detect(file);
          if (smells.length > 0) {
            allSmells.push(...smells);
            filesWithSmells.add(file);
          }
        } catch (error) {
          // Skip detector errors
          console.error(`Error running ${detector.type} on ${file}:`, error);
        }
      }
    }

    // Calculate summary
    const summary = this.calculateSummary(allSmells, files.length, filesWithSmells.size);

    return Object.freeze({
      smells: Object.freeze(allSmells),
      summary: Object.freeze(summary),
      timestamp,
    });
  }

  /**
   * Analyze single file
   */
  async analyzeFile(filePath: string): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];

    for (const detector of this.detectors.values()) {
      try {
        const detectedSmells = await detector.detect(filePath);
        smells.push(...detectedSmells);
      } catch (error) {
        console.error(`Error running ${detector.type} on ${filePath}:`, error);
      }
    }

    return smells;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    smells: readonly CodeSmell[],
    totalFiles: number,
    filesWithSmells: number
  ): CodeSmellAnalysisResult['summary'] {
    // Count by type
    const smellsByType = {} as Record<SmellType, number>;
    for (const type of Object.values(SmellType)) {
      smellsByType[type] = 0;
    }
    for (const smell of smells) {
      smellsByType[smell.type]++;
    }

    // Count by severity
    const smellsBySeverity = {} as Record<SmellSeverity, number>;
    for (const severity of Object.values(SmellSeverity)) {
      smellsBySeverity[severity] = 0;
    }
    for (const smell of smells) {
      smellsBySeverity[smell.severity]++;
    }

    // Calculate health score
    const codeHealthScore = this.calculateHealthScore(smells, totalFiles);

    return {
      totalSmells: smells.length,
      smellsByType: Object.freeze(smellsByType),
      smellsBySeverity: Object.freeze(smellsBySeverity),
      filesAnalyzed: totalFiles,
      filesWithSmells,
      averageSmellsPerFile: totalFiles > 0 ? smells.length / totalFiles : 0,
      codeHealthScore,
    };
  }

  /**
   * Calculate code health score (0-100)
   */
  private calculateHealthScore(smells: readonly CodeSmell[], totalFiles: number): number {
    if (totalFiles === 0) return 100;

    // Weighted penalties by severity
    const severityWeights = {
      [SmellSeverity.LOW]: 1,
      [SmellSeverity.MEDIUM]: 3,
      [SmellSeverity.HIGH]: 7,
      [SmellSeverity.CRITICAL]: 15,
    };

    let totalPenalty = 0;
    for (const smell of smells) {
      totalPenalty += severityWeights[smell.severity];
    }

    // Normalize penalty per file (penalty per file should reduce score)
    const penaltyPerFile = totalPenalty / totalFiles;

    // Score calculation: 100 - (penalty per file, capped at 100)
    const score = Math.max(0, 100 - Math.min(100, penaltyPerFile * 2));

    return Math.round(score);
  }
}
