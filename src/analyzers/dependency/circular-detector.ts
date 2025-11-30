/**
 * Circular Dependency Detector
 *
 * Uses Tarjan's Strongly Connected Components algorithm
 */

import type { DependencyGraph } from './dependency-graph.js';
import type { CircularDependency } from './types.js';

export class CircularDependencyDetector {
  /**
   * Detect all circular dependencies
   */
  detectCycles(graph: DependencyGraph): CircularDependency[] {
    const sccs = graph.getStronglyConnectedComponents();
    const cycles: CircularDependency[] = [];

    for (const scc of sccs) {
      if (scc.length > 1) {
        cycles.push(this.createCircularDependency(scc, graph));
      }
    }

    // Sort by severity and impact
    return cycles.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      return severityDiff !== 0 ? severityDiff : b.impact - a.impact;
    });
  }

  /**
   * Create circular dependency object from SCC
   */
  private createCircularDependency(
    cycle: string[],
    graph: DependencyGraph
  ): CircularDependency {
    const length = cycle.length;

    // Determine severity based on cycle length
    let severity: 'critical' | 'high' | 'medium' | 'low';
    if (length === 2) {
      severity = 'medium'; // Simple A->B->A cycle
    } else if (length <= 4) {
      severity = 'high'; // Complex but manageable
    } else {
      severity = 'critical'; // Very complex, hard to refactor
    }

    // Calculate impact based on:
    // 1. Number of files in cycle
    // 2. Total LOC in cycle
    // 3. Coupling of files in cycle
    let totalLOC = 0;
    let totalCoupling = 0;

    for (const file of cycle) {
      const node = graph.getNode(file);
      if (node) {
        totalLOC += node.loc;
        totalCoupling += node.imports.length + node.exports.length;
      }
    }

    // BUG FIX: Safe impact formula with individual component capping to prevent overflow
    // Each component is capped individually before summing to prevent precision loss
    // with very large codebases (1M+ LOC)
    const lengthFactor = Math.min(30, (length / 10) * 30);
    const locFactor = Math.min(40, (totalLOC / 500) * 40);
    const couplingFactor = Math.min(30, (totalCoupling / 20) * 30);

    const impact = Math.min(
      100,
      Math.round(lengthFactor + locFactor + couplingFactor)
    );

    // Generate description
    const fileNames = cycle.map(f => f.split('/').pop() || f);
    const description = `Circular dependency detected: ${fileNames.join(' → ')} → ${fileNames[0]}`;

    return Object.freeze({
      cycle: Object.freeze(cycle),
      length,
      severity,
      impact,
      description,
    });
  }
}
