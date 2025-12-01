/**
 * Dependency Analyzer
 *
 * Main orchestrator for dependency analysis
 */

import { DependencyGraph } from './dependency-graph.js';
import { CircularDependencyDetector } from './circular-detector.js';
import { CouplingCalculator } from './coupling-calculator.js';
import { getMultiLanguageParser, type MultiLanguageParser } from '../ast/multi-language-parser.js';
import type {
  DependencyAnalysisResult,
  DependencyNode,
  ImportEdge,
  ExportEdge,
  DependencyAnalysisOptions,
  DependencySummary,
  CircularDependency,
  CouplingMetrics,
} from './types.js';
import type { FileASTInfo, ImportInfo, ExportInfo } from '../ast/types.js';
import { existsSync, promises as fs } from 'fs';
import { glob } from 'glob';
import path from 'path';

/**
 * Default file patterns for multi-language support
 */
export const DEFAULT_ANALYSIS_PATTERN = '**/*.{ts,tsx,js,jsx,py,rs,go,c,cpp,cc,cxx,h,hpp,swift}';

export class DependencyAnalyzer {
  private astParser: MultiLanguageParser;
  private circularDetector: CircularDependencyDetector;
  private couplingCalculator: CouplingCalculator;

  constructor() {
    this.astParser = getMultiLanguageParser();
    this.circularDetector = new CircularDependencyDetector();
    this.couplingCalculator = new CouplingCalculator();
  }

  /**
   * Analyze dependencies in a directory
   */
  async analyzeDependencies(
    directory: string,
    pattern: string = '**/*.{ts,tsx,js,jsx}',
    options: DependencyAnalysisOptions = {}
  ): Promise<DependencyAnalysisResult> {
    const timestamp = new Date();

    // Find all files
    const ignorePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      ...(options.ignorePatterns || []),
    ];

    const files = await glob(pattern, {
      cwd: directory,
      absolute: true,
      nodir: true,
      ignore: ignorePatterns,
    });

    // Build dependency graph
    const graph = new DependencyGraph();
    const astMap = new Map<string, FileASTInfo>();

    // Parse all files
    for (const file of files) {
      try {
        const ast = await this.astParser.parseFile(file);
        astMap.set(file, ast);

        // Get file stats
        const stats = await fs.stat(file);

        // Create dependency node
        const node: DependencyNode = {
          filePath: file,
          imports: this.createImportEdges(file, ast.imports, directory),
          exports: this.createExportEdges(file, ast.exports),
          size: stats.size,
          loc: ast.totalLines,
        };

        graph.addNode(node);

        // Add edges for internal imports
        for (const imp of node.imports) {
          if (!options.includeNodeModules && imp.to.includes('node_modules')) {
            continue;
          }
          graph.addEdge(imp.from, imp.to);
        }
      } catch (error) {
        // Skip files that can't be parsed
        console.error(`Error parsing ${file}:`, error);
      }
    }

    // Detect circular dependencies
    const circularDependencies = this.circularDetector.detectCycles(graph);

    // Calculate coupling metrics
    const couplingMetrics = this.couplingCalculator.calculateMetrics(graph, astMap);

    // Find orphaned files (no imports/exports or isolated)
    const orphanedFiles = this.findOrphanedFiles(graph);

    // Find hub files (high coupling)
    const hubFiles = this.findHubFiles(couplingMetrics);

    // Calculate summary
    const summary = this.calculateSummary(graph, circularDependencies, couplingMetrics);

    return Object.freeze({
      graph,
      circularDependencies: Object.freeze(circularDependencies),
      couplingMetrics: Object.freeze(couplingMetrics),
      orphanedFiles: Object.freeze(orphanedFiles),
      hubFiles: Object.freeze(hubFiles),
      summary: Object.freeze(summary),
      timestamp,
    });
  }

  /**
   * Create import edges from AST imports
   */
  private createImportEdges(
    file: string,
    imports: readonly ImportInfo[],
    baseDir: string
  ): ImportEdge[] {
    return imports.map(imp => {
      const resolvedPath = this.resolveImportPath(file, imp.moduleSpecifier, baseDir);

      return Object.freeze({
        from: file,
        to: resolvedPath,
        importedSymbols: Object.freeze([
          ...imp.namedImports,
          ...(imp.defaultImport ? [imp.defaultImport] : []),
          ...(imp.namespaceImport ? [imp.namespaceImport] : []),
        ]),
        isDynamic: false,
        isTypeOnly: imp.isTypeOnly || false,
      });
    });
  }

  /**
   * Create export edges from AST exports
   */
  private createExportEdges(file: string, exports: readonly ExportInfo[]): ExportEdge[] {
    return exports.map(exp =>
      Object.freeze({
        from: file,
        symbols: Object.freeze([exp.name]),
        isDefault: exp.isDefault,
        isReExport: false, // Simplified for now
      })
    );
  }

  /**
   * Resolve import specifier to absolute file path
   */
  private resolveImportPath(fromFile: string, specifier: string, baseDir: string): string {
    if (specifier.startsWith('.')) {
      // Relative import
      const fromDir = path.dirname(fromFile);
      let resolved = path.resolve(fromDir, specifier);

      // Remove .js extension if present (TypeScript uses .js in imports)
      if (resolved.endsWith('.js')) {
        resolved = resolved.slice(0, -3);
      }

      // Try extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
      for (const ext of extensions) {
        const testPath = resolved.endsWith('.ts') || resolved.endsWith('.tsx')
          ? resolved
          : resolved + ext;
        try {
          if (existsSync(testPath)) {
            return testPath;
          }
        } catch {
          // Continue to next extension
        }
      }

      // Return resolved path even if file doesn't exist
      return resolved + '.ts'; // Default to .ts
    }

    // External module
    return path.join(baseDir, 'node_modules', specifier);
  }

  /**
   * Find orphaned files (no dependencies)
   */
  private findOrphanedFiles(graph: DependencyGraph): string[] {
    const orphaned: string[] = [];

    for (const node of graph.getNodes()) {
      const afferent = graph.getAfferentDependencies(node.filePath);
      const efferent = graph.getEfferentDependencies(node.filePath);

      if (afferent.length === 0 && efferent.length === 0) {
        orphaned.push(node.filePath);
      }
    }

    return orphaned;
  }

  /**
   * Find hub files (high coupling)
   */
  private findHubFiles(metrics: readonly CouplingMetrics[]): string[] {
    if (metrics.length === 0) return [];

    // Hub = high afferent OR efferent coupling (top 10%)
    const sorted = [...metrics].sort(
      (a, b) =>
        (b.afferentCoupling + b.efferentCoupling) -
        (a.afferentCoupling + a.efferentCoupling)
    );

    const threshold = Math.max(1, Math.ceil(sorted.length * 0.1));
    return sorted.slice(0, threshold).map(m => m.file);
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    graph: DependencyGraph,
    circularDeps: readonly CircularDependency[],
    metrics: readonly CouplingMetrics[]
  ): DependencySummary {
    const totalFiles = graph.getNodes().length;
    const totalDependencies = graph.getTotalEdges();

    const avgCa = totalFiles > 0
      ? metrics.reduce((sum, m) => sum + m.afferentCoupling, 0) / totalFiles
      : 0;
    const avgCe = totalFiles > 0
      ? metrics.reduce((sum, m) => sum + m.efferentCoupling, 0) / totalFiles
      : 0;
    const avgInstability = totalFiles > 0
      ? metrics.reduce((sum, m) => sum + m.instability, 0) / totalFiles
      : 0;

    const maxCycleLength = circularDeps.reduce(
      (max, dep) => Math.max(max, dep.length),
      0
    );

    // Health score (0-100)
    const circularPenalty = Math.min(50, circularDeps.length * 5);
    const instabilityPenalty = avgInstability * 20;
    const healthScore = Math.max(0, 100 - circularPenalty - instabilityPenalty);

    return Object.freeze({
      totalFiles,
      totalDependencies,
      averageAfferentCoupling: avgCa,
      averageEfferentCoupling: avgCe,
      averageInstability: avgInstability,
      circularDependencyCount: circularDeps.length,
      maxCycleLength,
      healthScore: Math.round(healthScore),
    });
  }
}
