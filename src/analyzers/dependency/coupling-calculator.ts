/**
 * Coupling Metrics Calculator
 *
 * Calculates:
 * - Afferent Coupling (Ca): How many files depend on this
 * - Efferent Coupling (Ce): How many files this depends on
 * - Instability (I): Ce / (Ce + Ca)
 * - Abstractness (A): Abstract elements / Total elements
 * - Distance from Main Sequence (D): |A + I - 1|
 */

import type { DependencyGraph } from './dependency-graph.js';
import type { CouplingMetrics } from './types.js';
import type { FileASTInfo } from '../ast/types.js';

export class CouplingCalculator {
  /**
   * Calculate coupling metrics for all files
   */
  calculateMetrics(
    graph: DependencyGraph,
    astMap: Map<string, FileASTInfo>
  ): CouplingMetrics[] {
    const metrics: CouplingMetrics[] = [];

    for (const node of graph.getNodes()) {
      const file = node.filePath;

      const ca = graph.getAfferentDependencies(file).length;
      const ce = graph.getEfferentDependencies(file).length;

      // Instability: I = Ce / (Ce + Ca)
      // I = 0: Maximally stable (many dependents, few dependencies)
      // I = 1: Maximally unstable (few dependents, many dependencies)
      const instability = (ce + ca) === 0 ? 0 : ce / (ce + ca);

      // Abstractness: A = abstract elements / total elements
      const ast = astMap.get(file);
      const abstractness = ast ? this.calculateAbstractness(ast) : 0;

      // Distance from Main Sequence: D = |A + I - 1|
      // D = 0: On the main sequence (ideal)
      // D > 0.5: In "zone of pain" (concrete + unstable) or "zone of uselessness" (abstract + stable)
      const distance = Math.abs(abstractness + instability - 1);

      // Determine zone
      let zone: 'useless' | 'painful' | 'balanced';
      if (abstractness > 0.7 && instability < 0.3) {
        zone = 'useless'; // Abstract but no dependents
      } else if (abstractness < 0.3 && instability > 0.7) {
        zone = 'painful'; // Concrete and many dependencies
      } else {
        zone = 'balanced';
      }

      metrics.push(
        Object.freeze({
          file,
          afferentCoupling: ca,
          efferentCoupling: ce,
          instability,
          abstractness,
          distanceFromMainSequence: distance,
          zone,
        })
      );
    }

    return metrics;
  }

  /**
   * Calculate abstractness of a file
   * A = abstract classes + interfaces / total classes + functions
   */
  private calculateAbstractness(ast: FileASTInfo): number {
    let abstractCount = 0;
    let totalCount = 0;

    // Count classes
    for (const cls of ast.classes) {
      totalCount++;

      // Heuristic: Consider class abstract if:
      // 1. Name starts with 'Abstract' or 'Base' or 'I'
      // 2. Implements interfaces (likely an abstraction)
      const isAbstract =
        cls.name.startsWith('Abstract') ||
        cls.name.startsWith('Base') ||
        cls.name.startsWith('I') ||
        cls.implementsInterfaces.length > 0;

      if (isAbstract) {
        abstractCount++;
      }
    }

    // Count type exports as abstract
    // (interfaces, type aliases)
    const typeExports = ast.exports.filter(exp => exp.type === 'type');
    abstractCount += typeExports.length;
    totalCount += typeExports.length;

    // Functions are always concrete
    totalCount += ast.functions.length;

    return totalCount === 0 ? 0 : abstractCount / totalCount;
  }
}
