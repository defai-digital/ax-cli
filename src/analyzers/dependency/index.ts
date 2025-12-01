/**
 * Dependency Analyzer Module
 */

export { DependencyAnalyzer } from './dependency-analyzer.js';
export { DependencyGraph } from './dependency-graph.js';
export { CircularDependencyDetector } from './circular-detector.js';
export { CouplingCalculator } from './coupling-calculator.js';
export type {
  DependencyNode,
  ImportEdge,
  ExportEdge,
  CircularDependency,
  CouplingMetrics,
  DependencyAnalysisResult,
  DependencySummary,
  DependencyAnalysisOptions,
} from './types.js';
