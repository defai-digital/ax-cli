/**
 * Advanced Metrics Types
 */

/**
 * Halstead complexity metrics
 */
export interface HalsteadMetrics {
  readonly n1: number; // Number of distinct operators
  readonly n2: number; // Number of distinct operands
  readonly N1: number; // Total number of operators
  readonly N2: number; // Total number of operands
  readonly vocabulary: number; // n = n1 + n2
  readonly length: number; // N = N1 + N2
  readonly calculatedLength: number; // n1 * log2(n1) + n2 * log2(n2)
  readonly volume: number; // V = N * log2(n)
  readonly difficulty: number; // D = (n1/2) * (N2/n2)
  readonly effort: number; // E = D * V
  readonly time: number; // T = E / 18 (seconds)
  readonly bugs: number; // B = V / 3000 (estimated bugs)
}

/**
 * Maintainability Index
 */
export interface MaintainabilityIndex {
  readonly score: number; // 0-100, higher is better
  readonly rating: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly halsteadVolume: number;
  readonly cyclomaticComplexity: number;
  readonly linesOfCode: number;
}

/**
 * File metrics
 */
export interface FileMetrics {
  readonly filePath: string;
  readonly halstead: HalsteadMetrics;
  readonly maintainability: MaintainabilityIndex;
  readonly averageComplexity: number;
  readonly maxComplexity: number;
  readonly totalFunctions: number;
}

/**
 * Metrics analysis result
 */
export interface MetricsAnalysisResult {
  readonly fileMetrics: ReadonlyArray<FileMetrics>;
  readonly summary: MetricsSummary;
  readonly timestamp: Date;
}

/**
 * Summary statistics
 */
export interface MetricsSummary {
  readonly filesAnalyzed: number;
  readonly averageMaintainability: number;
  readonly averageHalsteadVolume: number;
  readonly averageComplexity: number;
  readonly lowMaintainabilityCount: number; // MI < 65
  readonly highComplexityCount: number; // Complexity > 10
}

/**
 * Analysis options
 */
export interface MetricsAnalysisOptions {
  readonly includePatterns?: readonly string[];
  readonly excludePatterns?: readonly string[];
}
