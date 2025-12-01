/**
 * Dependency Graph Implementation
 *
 * Adjacency list-based directed graph for file dependencies
 */

import type { DependencyNode, DependencyGraph as IDependencyGraph } from './types.js';

export class DependencyGraph implements IDependencyGraph {
  private nodes: Map<string, DependencyNode>;
  private adjacencyList: Map<string, Set<string>>;
  private reverseAdjacencyList: Map<string, Set<string>>; // For efficient afferent lookup

  constructor() {
    this.nodes = new Map();
    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();
  }

  /**
   * Add node to graph
   */
  addNode(node: DependencyNode): void {
    this.nodes.set(node.filePath, node);

    if (!this.adjacencyList.has(node.filePath)) {
      this.adjacencyList.set(node.filePath, new Set());
    }
    if (!this.reverseAdjacencyList.has(node.filePath)) {
      this.reverseAdjacencyList.set(node.filePath, new Set());
    }
  }

  /**
   * Add directed edge from -> to
   */
  addEdge(from: string, to: string): void {
    // Ensure nodes exist
    if (!this.adjacencyList.has(from)) {
      this.adjacencyList.set(from, new Set());
    }
    if (!this.reverseAdjacencyList.has(to)) {
      this.reverseAdjacencyList.set(to, new Set());
    }

    // Add edge (sets are guaranteed to exist after the checks above)
    const fromSet = this.adjacencyList.get(from);
    const toSet = this.reverseAdjacencyList.get(to);
    if (fromSet && toSet) {
      fromSet.add(to);
      toSet.add(from);
    }
  }

  /**
   * Get node by file path
   */
  getNode(file: string): DependencyNode | undefined {
    return this.nodes.get(file);
  }

  /**
   * Get all nodes
   */
  getNodes(): DependencyNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get afferent dependencies (files that depend on this file)
   */
  getAfferentDependencies(file: string): string[] {
    const deps = this.reverseAdjacencyList.get(file);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Get efferent dependencies (files this file depends on)
   */
  getEfferentDependencies(file: string): string[] {
    const deps = this.adjacencyList.get(file);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Get total number of edges
   */
  getTotalEdges(): number {
    let total = 0;
    for (const deps of this.adjacencyList.values()) {
      total += deps.size;
    }
    return total;
  }

  /**
   * Check if path exists from -> to using BFS
   */
  hasPath(from: string, to: string): boolean {
    if (from === to) return true;

    const visited = new Set<string>();
    const queue: string[] = [from];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;

      if (current === to) return true;
      if (visited.has(current)) continue;

      visited.add(current);

      const neighbors = this.adjacencyList.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    return false;
  }

  /**
   * Topological sort using DFS
   * Returns sorted list and whether cycle was detected
   */
  topologicalSort(): { sorted: string[]; hasCycle: boolean } {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const sorted: string[] = [];
    let hasCycle = false;

    const dfs = (node: string): void => {
      if (recursionStack.has(node)) {
        hasCycle = true;
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      recursionStack.add(node);

      const neighbors = this.adjacencyList.get(node) || new Set();
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }

      recursionStack.delete(node);
      sorted.unshift(node); // Add to front for reverse post-order
    };

    // Visit all nodes
    for (const node of this.nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return { sorted, hasCycle };
  }

  /**
   * Get strongly connected components using Tarjan's algorithm
   * (Used for circular dependency detection)
   */
  getStronglyConnectedComponents(): string[][] {
    const index = new Map<string, number>();
    const lowLink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const sccs: string[][] = [];
    let currentIndex = 0;

    const strongConnect = (node: string): void => {
      index.set(node, currentIndex);
      lowLink.set(node, currentIndex);
      currentIndex++;
      stack.push(node);
      onStack.add(node);

      const neighbors = this.adjacencyList.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!index.has(neighbor)) {
          strongConnect(neighbor);
          const nodeLow = lowLink.get(node) ?? 0;
          const neighborLow = lowLink.get(neighbor) ?? 0;
          lowLink.set(node, Math.min(nodeLow, neighborLow));
        } else if (onStack.has(neighbor)) {
          const nodeLow = lowLink.get(node) ?? 0;
          const neighborIdx = index.get(neighbor) ?? 0;
          lowLink.set(node, Math.min(nodeLow, neighborIdx));
        }
      }

      // If node is a root node, pop the stack and create SCC
      if (lowLink.get(node) === index.get(node)) {
        const scc: string[] = [];
        let w: string | undefined;
        do {
          w = stack.pop();
          if (w === undefined) break;
          onStack.delete(w);
          scc.push(w);
        } while (w !== node);

        // Only add if SCC has more than 1 node (circular dependency)
        if (scc.length > 1) {
          sccs.push(scc);
        }
      }
    };

    // Run on all nodes
    for (const node of this.nodes.keys()) {
      if (!index.has(node)) {
        strongConnect(node);
      }
    }

    return sccs;
  }
}
