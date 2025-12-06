/**
 * Internal Types for Design Module
 *
 * Re-exports from @defai.digital/ax-schemas plus internal types.
 *
 * @module design/types
 */

// Re-export all design types from schemas package
export type {
  // Figma types
  FigmaFileKey,
  FigmaNodeId,
  FigmaColor,
  FigmaRect,
  FigmaNode,
  FigmaNodeType,
  FigmaFileResponse,
  FigmaNodesResponse,
  FigmaVariablesResponse,
  FigmaVariable,
  FigmaVariableCollection,
  GetFileOptions,
  GetImagesOptions,

  // Token types
  DesignToken,
  TokenType,
  TokenFile,
  TokenGroup,
  TokenOutputFormat,
  TokenExtractionOptions,
  TailwindConfig,
  TokenComparisonResult,
  TokenDiffEntry,

  // Alias types
  DesignAlias,
  AliasTarget,
  DesignConfig,
  AddAliasInput,
  AliasOperationResult,
  ResolvedAlias,
  AliasListEntry,
  AliasListResponse,

  // Audit types
  AuditSeverity,
  AuditRuleId,
  AuditRule,
  AuditIssue,
  AuditResult,
  AuditConfig,
  AuditSummary,
} from '@defai.digital/ax-schemas';

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Simplified node for tree display
 */
export interface SimplifiedNode {
  id: string;
  name: string;
  type: string;
  children?: SimplifiedNode[];
  // Optional metadata
  componentKey?: string;
  characters?: string;
  hasAutoLayout?: boolean;
  fillCount?: number;
}

/**
 * Tree display options
 */
export interface TreeDisplayOptions {
  /** Maximum depth to display (undefined = unlimited) */
  maxDepth?: number;
  /** Include node IDs in output */
  showIds?: boolean;
  /** Include node types in output */
  showTypes?: boolean;
  /** Filter to specific node types */
  filterTypes?: string[];
  /** Show only frames and components */
  framesOnly?: boolean;
}

/**
 * Map output format
 */
export type MapOutputFormat = 'tree' | 'json' | 'flat';

/**
 * Result of a map operation
 */
export interface MapResult {
  fileKey: string;
  fileName: string;
  lastModified: string;
  pageCount: number;
  nodeCount: number;
  componentCount: number;
  styleCount: number;
  root: SimplifiedNode;
}

/**
 * Select query options
 */
export interface SelectQueryOptions {
  /** Search by name (partial match) */
  name?: string;
  /** Search by text content */
  text?: string;
  /** Filter by node type */
  type?: string;
  /** Search within a specific alias */
  withinAlias?: string;
  /** Search within a specific node ID */
  withinNodeId?: string;
  /** Maximum results to return */
  limit?: number;
}

/**
 * Select result entry
 */
export interface SelectResult {
  nodeId: string;
  name: string;
  type: string;
  path: string;
  characters?: string;
}

/**
 * Auth status
 */
export interface AuthStatus {
  authenticated: boolean;
  tokenType: 'personal' | 'oauth' | 'unknown';
  tokenPreview?: string; // First few chars of token
  error?: string;
}
