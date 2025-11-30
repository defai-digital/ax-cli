/**
 * Git Integration Module
 */

export { GitAnalyzer } from './git-analyzer.js';
export { ChurnCalculator } from './churn-calculator.js';
export { HotspotDetector } from './hotspot-detector.js';

export type {
  GitCommit,
  FileChurn,
  CodeHotspot,
  ContributorStats,
  GitAnalysisResult,
  GitAnalysisSummary,
  GitAnalysisOptions,
} from './types.js';
