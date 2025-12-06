/**
 * Figma File Mapping
 *
 * Converts Figma file structure to a human-readable/machine-readable format.
 *
 * @module design/figma-map
 */

import type {
  FigmaNode,
  FigmaFileResponse,
} from '@defai.digital/ax-schemas';

import type {
  SimplifiedNode,
  MapResult,
  TreeDisplayOptions,
  MapOutputFormat,
} from './types.js';

// =============================================================================
// Node Simplification
// =============================================================================

/**
 * Simplify a Figma node to essential properties
 */
function simplifyNode(node: FigmaNode, options: TreeDisplayOptions, depth = 0): SimplifiedNode | null {
  // Check depth limit
  if (options.maxDepth !== undefined && depth > options.maxDepth) {
    return null;
  }

  // Filter by type
  if (options.filterTypes && !options.filterTypes.includes(node.type)) {
    // Still process children to find matching nodes
    if ('children' in node && node.children) {
      const children = node.children
        .map((child) => simplifyNode(child as FigmaNode, options, depth + 1))
        .filter((n): n is SimplifiedNode => n !== null);

      if (children.length > 0) {
        return {
          id: node.id,
          name: node.name,
          type: node.type,
          children,
        };
      }
    }
    return null;
  }

  // Frames only filter
  if (options.framesOnly) {
    const frameTypes = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'SECTION', 'CANVAS'];
    if (!frameTypes.includes(node.type)) {
      // Still process children
      if ('children' in node && node.children) {
        const children = node.children
          .map((child) => simplifyNode(child as FigmaNode, options, depth + 1))
          .filter((n): n is SimplifiedNode => n !== null);

        if (children.length > 0) {
          return {
            id: node.id,
            name: node.name,
            type: node.type,
            children,
          };
        }
      }
      return null;
    }
  }

  const simplified: SimplifiedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  // Add optional metadata based on node type
  if ('componentId' in node && node.componentId) {
    simplified.componentKey = node.componentId;
  }

  if ('characters' in node && node.characters) {
    // Truncate long text
    simplified.characters = node.characters.length > 50
      ? node.characters.slice(0, 50) + '...'
      : node.characters;
  }

  if ('layoutMode' in node && node.layoutMode && node.layoutMode !== 'NONE') {
    simplified.hasAutoLayout = true;
  }

  if ('fills' in node && Array.isArray(node.fills)) {
    simplified.fillCount = node.fills.length;
  }

  // Process children
  if ('children' in node && node.children) {
    const children = node.children
      .map((child) => simplifyNode(child as FigmaNode, options, depth + 1))
      .filter((n): n is SimplifiedNode => n !== null);

    if (children.length > 0) {
      simplified.children = children;
    }
  }

  return simplified;
}

/**
 * Count nodes recursively
 */
function countNodes(node: SimplifiedNode): number {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

// =============================================================================
// Tree Formatting
// =============================================================================

/**
 * Format node as tree string with box-drawing characters
 */
function formatNodeAsTree(
  node: SimplifiedNode,
  options: TreeDisplayOptions,
  prefix = '',
  isLast = true,
  depth = 0
): string[] {
  const lines: string[] = [];

  // Build the connector
  const connector = isLast ? '└─' : '├─';
  const nodePrefix = depth === 0 ? '' : prefix + connector;

  // Build node label
  let label = node.name;
  if (options.showTypes) {
    label = `[${node.type}] ${label}`;
  }
  if (options.showIds) {
    label = `${label} (${node.id})`;
  }

  // Add metadata hints
  const hints: string[] = [];
  if (node.hasAutoLayout) hints.push('auto-layout');
  if (node.componentKey) hints.push('instance');
  if (node.characters) hints.push(`"${node.characters}"`);

  if (hints.length > 0) {
    label += ` ${hints.join(', ')}`;
  }

  lines.push(nodePrefix + label);

  // Process children
  if (node.children && node.children.length > 0) {
    const childPrefix = depth === 0 ? '' : prefix + (isLast ? '  ' : '│ ');
    const childCount = node.children.length;

    node.children.forEach((child, index) => {
      const isChildLast = index === childCount - 1;
      lines.push(...formatNodeAsTree(child, options, childPrefix, isChildLast, depth + 1));
    });
  }

  return lines;
}

// =============================================================================
// Flat List Formatting
// =============================================================================

/**
 * Flatten node tree to a list with paths
 */
function flattenNodes(
  node: SimplifiedNode,
  path: string[] = [],
  results: Array<{ path: string; id: string; type: string; name: string }> = []
): Array<{ path: string; id: string; type: string; name: string }> {
  const currentPath = [...path, node.name];

  results.push({
    path: currentPath.join(' > '),
    id: node.id,
    type: node.type,
    name: node.name,
  });

  if (node.children) {
    for (const child of node.children) {
      flattenNodes(child, currentPath, results);
    }
  }

  return results;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Map a Figma file to a simplified structure
 */
export function mapFigmaFile(
  response: FigmaFileResponse,
  fileKey: string,
  options: TreeDisplayOptions = {}
): MapResult {
  const rootNode = simplifyNode(response.document as FigmaNode, options);

  if (!rootNode) {
    throw new Error('Failed to simplify document node');
  }

  const nodeCount = countNodes(rootNode);
  const pageCount = rootNode.children?.length ?? 0;
  const componentCount = response.components ? Object.keys(response.components).length : 0;
  const styleCount = response.styles ? Object.keys(response.styles).length : 0;

  return {
    fileKey,
    fileName: response.name,
    lastModified: response.lastModified,
    pageCount,
    nodeCount,
    componentCount,
    styleCount,
    root: rootNode,
  };
}

/**
 * Format map result as string
 */
export function formatMapResult(
  result: MapResult,
  format: MapOutputFormat,
  options: TreeDisplayOptions = {}
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(result, null, 2);

    case 'flat': {
      const flat = flattenNodes(result.root);
      return flat.map((n) => `${n.path} [${n.type}] (${n.id})`).join('\n');
    }

    case 'tree':
    default: {
      const header = [
        `File: ${result.fileName}`,
        `Last Modified: ${result.lastModified}`,
        `Pages: ${result.pageCount} | Nodes: ${result.nodeCount} | Components: ${result.componentCount} | Styles: ${result.styleCount}`,
        '',
      ];

      const tree = formatNodeAsTree(result.root, options);
      return [...header, ...tree].join('\n');
    }
  }
}

/**
 * Find a node by ID in the simplified tree
 */
export function findNodeById(root: SimplifiedNode, nodeId: string): SimplifiedNode | null {
  if (root.id === nodeId) {
    return root;
  }

  if (root.children) {
    for (const child of root.children) {
      const found = findNodeById(child, nodeId);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Find nodes matching a predicate
 */
export function findNodes(
  root: SimplifiedNode,
  predicate: (node: SimplifiedNode) => boolean,
  limit?: number
): SimplifiedNode[] {
  const results: SimplifiedNode[] = [];

  function search(node: SimplifiedNode): boolean {
    if (limit !== undefined && results.length >= limit) {
      return true; // Stop searching
    }

    if (predicate(node)) {
      results.push(node);
    }

    if (node.children) {
      for (const child of node.children) {
        if (search(child)) return true;
      }
    }

    return false;
  }

  search(root);
  return results;
}

/**
 * Get path to a node
 */
export function getNodePath(root: SimplifiedNode, nodeId: string): string[] | null {
  function findPath(node: SimplifiedNode, path: string[]): string[] | null {
    const currentPath = [...path, node.name];

    if (node.id === nodeId) {
      return currentPath;
    }

    if (node.children) {
      for (const child of node.children) {
        const found = findPath(child, currentPath);
        if (found) return found;
      }
    }

    return null;
  }

  return findPath(root, []);
}
