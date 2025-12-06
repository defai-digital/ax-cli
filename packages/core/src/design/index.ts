/**
 * Design Module
 *
 * Provides Figma integration for design-to-code workflows.
 *
 * @module design
 */

// Client
export {
  FigmaClient,
  createFigmaClient,
  getFigmaClient,
  resetFigmaClient,
  type FigmaClientConfig,
  type FigmaApiError,
} from './figma-client.js';

// Mapping
export {
  mapFigmaFile,
  formatMapResult,
  findNodeById,
  findNodes,
  getNodePath,
} from './figma-map.js';

// Aliases
export {
  getDesignConfigPath,
  loadDesignConfig,
  saveDesignConfig,
  addAlias,
  removeAlias,
  listAliases,
  resolveAlias,
  setDefaultFile,
  setDsFile,
  getAlias,
  hasAlias,
  getAliasesForFile,
  importAliases,
} from './figma-alias.js';

// Tokens
export {
  extractTokensFromVariables,
  tokensToTailwind,
  formatTokens,
  compareTokens,
  formatComparison,
} from './figma-tokens.js';

// Audit
export {
  auditDesign,
  formatAuditResult,
  formatAuditSummary,
} from './figma-audit.js';

// Types
export type {
  SimplifiedNode,
  TreeDisplayOptions,
  MapOutputFormat,
  MapResult,
  SelectQueryOptions,
  SelectResult,
  AuthStatus,
} from './types.js';
