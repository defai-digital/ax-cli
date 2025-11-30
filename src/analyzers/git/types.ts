/**
 * Git Integration Types
 */

/**
 * Git commit information
 */
export interface GitCommit {
  readonly hash: string;
  readonly author: string;
  readonly date: Date;
  readonly message: string;
  readonly filesChanged: ReadonlyArray<string>;
}

/**
 * File churn metrics
 */
export interface FileChurn {
  readonly filePath: string;
  readonly commitCount: number; // Number of commits affecting this file
  readonly additions: number; // Total lines added
  readonly deletions: number; // Total lines deleted
  readonly totalChurn: number; // additions + deletions
  readonly lastModified: Date;
  readonly authors: ReadonlyArray<string>; // Unique authors
}

/**
 * Code hotspot (high churn + high complexity)
 */
export interface CodeHotspot {
  readonly filePath: string;
  readonly hotspotScore: number; // 0-100, higher = more problematic
  readonly churnScore: number; // 0-100, normalized churn
  readonly complexityScore: number; // 0-100, normalized complexity
  readonly commitCount: number;
  readonly totalChurn: number;
  readonly averageComplexity: number;
  readonly maxComplexity: number;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly reason: string;
  readonly recommendation: string;
}

/**
 * Contributor statistics
 */
export interface ContributorStats {
  readonly author: string;
  readonly commitCount: number;
  readonly filesChanged: number;
  readonly linesAdded: number;
  readonly linesDeleted: number;
  readonly firstCommit: Date;
  readonly lastCommit: Date;
}

/**
 * Git analysis result
 */
export interface GitAnalysisResult {
  readonly hotspots: ReadonlyArray<CodeHotspot>;
  readonly churnMetrics: ReadonlyArray<FileChurn>;
  readonly contributors: ReadonlyArray<ContributorStats>;
  readonly summary: GitAnalysisSummary;
  readonly timestamp: Date;
}

/**
 * Analysis summary
 */
export interface GitAnalysisSummary {
  readonly totalCommits: number;
  readonly filesAnalyzed: number;
  readonly hotspotCount: number;
  readonly averageChurn: number;
  readonly topContributor: string;
  readonly dateRange: {
    readonly from: Date;
    readonly to: Date;
  };
}

/**
 * Analysis options
 */
export interface GitAnalysisOptions {
  readonly since?: string; // Date string (e.g., '6 months ago', '2024-01-01')
  readonly until?: string;
  readonly branch?: string; // Default: current branch
  readonly includePatterns?: readonly string[]; // File patterns to include
  readonly excludePatterns?: readonly string[]; // File patterns to exclude
  readonly hotspotThreshold?: number; // Minimum score to be considered hotspot (default: 70)
}
