/**
 * Metrics Analyzer
 *
 * Main orchestrator for advanced code metrics analysis
 */

import { HalsteadCalculator } from './halstead-calculator.js';
import { MaintainabilityCalculator } from './maintainability-calculator.js';
import { getMultiLanguageParser, type MultiLanguageParser } from '../ast/multi-language-parser.js';
import type {
  MetricsAnalysisResult,
  MetricsAnalysisOptions,
  FileMetrics,
  MetricsSummary,
} from './types.js';
import { glob } from 'glob';

export class MetricsAnalyzer {
  private halsteadCalculator: HalsteadCalculator;
  private maintainabilityCalculator: MaintainabilityCalculator;
  private astParser: MultiLanguageParser;

  constructor() {
    this.halsteadCalculator = new HalsteadCalculator();
    this.maintainabilityCalculator = new MaintainabilityCalculator();
    this.astParser = getMultiLanguageParser();
  }

  /**
   * Analyze metrics for files matching patterns
   */
  async analyze(
    directory: string,
    options: MetricsAnalysisOptions = {}
  ): Promise<MetricsAnalysisResult> {
    const files = await this.getFilesToAnalyze(directory, options);
    const fileMetrics: FileMetrics[] = [];

    for (const filePath of files) {
      try {
        const metrics = await this.analyzeFile(filePath);
        fileMetrics.push(metrics);
      } catch {
        // Skip files that fail to parse
        continue;
      }
    }

    const summary = this.calculateSummary(fileMetrics);

    return Object.freeze({
      fileMetrics: Object.freeze(fileMetrics),
      summary,
      timestamp: new Date(),
    });
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(filePath: string): Promise<FileMetrics> {
    // Calculate Halstead metrics
    const halstead = this.halsteadCalculator.calculateMetrics(filePath);

    // Get AST info for complexity and LOC
    const ast = await this.astParser.parseFile(filePath);

    // Calculate average and max complexity
    const complexities = ast.functions.map((f) => f.complexity);
    const averageComplexity =
      complexities.length > 0
        ? complexities.reduce((a, b) => a + b, 0) / complexities.length
        : 0;
    const maxComplexity =
      complexities.length > 0 ? Math.max(...complexities) : 0;

    // Calculate total lines of code (excluding blank lines and comments)
    const linesOfCode = this.calculateLinesOfCode(filePath);

    // Calculate Maintainability Index
    const maintainability = this.maintainabilityCalculator.calculateIndex(
      halstead.volume,
      averageComplexity,
      linesOfCode
    );

    return Object.freeze({
      filePath,
      halstead,
      maintainability,
      averageComplexity: Math.round(averageComplexity * 100) / 100,
      maxComplexity,
      totalFunctions: ast.functions.length,
    });
  }

  /**
   * Calculate lines of code (excluding blank lines)
   */
  private calculateLinesOfCode(filePath: string): number {
    const sourceFile = this.astParser.getSourceFile(filePath);
    if (!sourceFile) {
      // For non-TS/JS files, return 0 (Halstead metrics will still work)
      return 0;
    }
    const text = sourceFile.getFullText();
    const lines = text.split('\n');

    // Count non-blank lines
    let loc = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        loc++;
      }
    }

    return loc;
  }

  /**
   * Get files to analyze based on patterns
   */
  private async getFilesToAnalyze(
    directory: string,
    options: MetricsAnalysisOptions
  ): Promise<string[]> {
    const includePatterns = options.includePatterns || ['**/*.ts', '**/*.tsx'];
    const excludePatterns = options.excludePatterns || [
      '**/node_modules/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/dist/**',
      '**/build/**',
    ];

    const allFiles = new Set<string>();

    for (const pattern of includePatterns) {
      const matches = await glob(pattern, {
        cwd: directory,
        absolute: true,
        ignore: excludePatterns ? [...excludePatterns] : [],
      });
      for (const match of matches) {
        allFiles.add(match);
      }
    }

    return Array.from(allFiles).sort();
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(fileMetrics: FileMetrics[]): MetricsSummary {
    if (fileMetrics.length === 0) {
      return Object.freeze({
        filesAnalyzed: 0,
        averageMaintainability: 0,
        averageHalsteadVolume: 0,
        averageComplexity: 0,
        lowMaintainabilityCount: 0,
        highComplexityCount: 0,
      });
    }

    const totalMaintainability = fileMetrics.reduce(
      (sum, m) => sum + m.maintainability.score,
      0
    );
    const totalHalsteadVolume = fileMetrics.reduce(
      (sum, m) => sum + m.halstead.volume,
      0
    );
    const totalComplexity = fileMetrics.reduce(
      (sum, m) => sum + m.averageComplexity,
      0
    );

    const lowMaintainabilityCount = fileMetrics.filter(
      (m) => m.maintainability.score < 65
    ).length;

    const highComplexityCount = fileMetrics.filter(
      (m) => m.maxComplexity > 10
    ).length;

    return Object.freeze({
      filesAnalyzed: fileMetrics.length,
      averageMaintainability:
        Math.round((totalMaintainability / fileMetrics.length) * 100) / 100,
      averageHalsteadVolume:
        Math.round((totalHalsteadVolume / fileMetrics.length) * 100) / 100,
      averageComplexity:
        Math.round((totalComplexity / fileMetrics.length) * 100) / 100,
      lowMaintainabilityCount,
      highComplexityCount,
    });
  }
}
