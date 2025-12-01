/**
 * Dependency Analyzer Types
 */

/**
 * Dependency node representing a file
 */
export interface DependencyNode {
  readonly filePath: string;
  readonly imports: ReadonlyArray<ImportEdge>;
  readonly exports: ReadonlyArray<ExportEdge>;
  readonly size: number; // File size in bytes
  readonly loc: number; // Lines of code
}

/**
 * Import edge in dependency graph
 */
export interface ImportEdge {
  readonly from: string; // Importing file (absolute path)
  readonly to: string; // Imported file (absolute path)
  readonly importedSymbols: ReadonlyArray<string>;
  readonly isDynamic: boolean; // import() vs static import
  readonly isTypeOnly: boolean; // import type
}

/**
 * Export edge
 */
export interface ExportEdge {
  readonly from: string;
  readonly symbols: ReadonlyArray<string>;
  readonly isDefault: boolean;
  readonly isReExport: boolean; // export { x } from './y'
}

/**
 * Circular dependency cycle
 */
export interface CircularDependency {
  readonly cycle: ReadonlyArray<string>; // File paths forming cycle
  readonly length: number; // Number of files in cycle
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly impact: number; // 0-100 score
  readonly description: string;
}

/**
 * Coupling metrics for a file
 */
export interface CouplingMetrics {
  readonly file: string;
  readonly afferentCoupling: number; // Ca: Files depending on this
  readonly efferentCoupling: number; // Ce: Files this depends on
  readonly instability: number; // I = Ce / (Ce + Ca), 0 = stable, 1 = unstable
  readonly abstractness: number; // A = abstract/total (0-1)
  readonly distanceFromMainSequence: number; // D = |A + I - 1|
  readonly zone: 'useless' | 'painful' | 'balanced'; // Based on A-I diagram
}

/**
 * Dependency analysis result
 */
export interface DependencyAnalysisResult {
  readonly graph: DependencyGraph;
  readonly circularDependencies: ReadonlyArray<CircularDependency>;
  readonly couplingMetrics: ReadonlyArray<CouplingMetrics>;
  readonly orphanedFiles: ReadonlyArray<string>; // No imports/exports
  readonly hubFiles: ReadonlyArray<string>; // High coupling
  readonly summary: DependencySummary;
  readonly timestamp: Date;
}

/**
 * Summary statistics
 */
export interface DependencySummary {
  readonly totalFiles: number;
  readonly totalDependencies: number;
  readonly averageAfferentCoupling: number;
  readonly averageEfferentCoupling: number;
  readonly averageInstability: number;
  readonly circularDependencyCount: number;
  readonly maxCycleLength: number;
  readonly healthScore: number; // 0-100
}

/**
 * Dependency graph interface
 */
export interface DependencyGraph {
  addNode(node: DependencyNode): void;
  addEdge(from: string, to: string): void;
  getNode(file: string): DependencyNode | undefined;
  getNodes(): DependencyNode[];
  getAfferentDependencies(file: string): string[];
  getEfferentDependencies(file: string): string[];
  getTotalEdges(): number;
  hasPath(from: string, to: string): boolean;
  topologicalSort(): { sorted: string[]; hasCycle: boolean };
  getStronglyConnectedComponents(): string[][];
}

/**
 * Analysis options
 */
export interface DependencyAnalysisOptions {
  readonly includeNodeModules?: boolean;
  readonly maxDepth?: number;
  readonly ignorePatterns?: readonly string[];
}
