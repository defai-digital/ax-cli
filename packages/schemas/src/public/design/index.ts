/**
 * Design Module Schemas
 *
 * Centralized exports for all design-related Zod schemas.
 *
 * @module design
 */

// Re-export brand symbol for TypeScript type inference
export { type __brand, type Brand } from '../core/brand-types.js';

// =============================================================================
// Figma API Types
// =============================================================================

export {
  // Brand types
  type FigmaFileKey,
  type FigmaNodeId,

  // Validation schemas
  FigmaFileKeySchema,
  FigmaNodeIdSchema,

  // Color and basic types
  FigmaColorSchema,
  type FigmaColor,
  FigmaRectSchema,
  type FigmaRect,

  // Layout types
  FigmaConstraintSchema,
  type FigmaConstraint,
  FigmaConstraintsSchema,
  type FigmaConstraints,
  FigmaAutoLayoutSchema,
  type FigmaAutoLayout,

  // Style types
  FigmaPaintSchema,
  type FigmaPaint,
  FigmaTextStyleSchema,
  type FigmaTextStyle,
  FigmaEffectSchema,
  type FigmaEffect,

  // Node type enum
  FigmaNodeTypeSchema,
  type FigmaNodeType,

  // Node interfaces
  type FigmaBaseNode,
  type FigmaFrameLikeNode,
  type FigmaTextNode,
  type FigmaVectorLikeNode,
  type FigmaDocumentNode,
  type FigmaCanvasNode,
  type FigmaNode,

  // Node schema
  FigmaNodeSchema,

  // Component metadata
  FigmaComponentMetaSchema,
  type FigmaComponentMeta,
  FigmaStyleMetaSchema,
  type FigmaStyleMeta,
  FigmaComponentPropertyDefinitionSchema,
  type FigmaComponentPropertyDefinition,

  // API responses
  FigmaFileResponseSchema,
  type FigmaFileResponse,
  FigmaNodesResponseSchema,
  type FigmaNodesResponse,
  FigmaVariablesResponseSchema,
  type FigmaVariablesResponse,
  FigmaImagesResponseSchema,
  type FigmaImagesResponse,

  // Variables/tokens
  FigmaVariableValueSchema,
  type FigmaVariableValue,
  FigmaVariableSchema,
  type FigmaVariable,
  FigmaVariableCollectionSchema,
  type FigmaVariableCollection,

  // API options
  GetFileOptionsSchema,
  type GetFileOptions,
  GetImagesOptionsSchema,
  type GetImagesOptions,
} from './figma-types.js';

// =============================================================================
// Design Token Types
// =============================================================================

export {
  // Token type enum
  TokenTypeSchema,
  type TokenType,

  // Individual token schemas
  BaseTokenSchema,
  ColorTokenSchema,
  type ColorToken,
  DimensionTokenSchema,
  type DimensionToken,
  FontFamilyTokenSchema,
  type FontFamilyToken,
  FontWeightTokenSchema,
  type FontWeightToken,
  FontSizeTokenSchema,
  type FontSizeToken,
  LineHeightTokenSchema,
  type LineHeightToken,
  LetterSpacingTokenSchema,
  type LetterSpacingToken,
  ShadowTokenSchema,
  type ShadowToken,
  ShadowValueSchema,
  type ShadowValue,
  GradientTokenSchema,
  type GradientToken,
  GradientValueSchema,
  type GradientValue,
  GradientStopSchema,
  type GradientStop,
  BorderTokenSchema,
  type BorderToken,
  BorderValueSchema,
  type BorderValue,
  NumberTokenSchema,
  type NumberToken,
  OpacityTokenSchema,
  type OpacityToken,

  // Union token type
  DesignTokenSchema,
  type DesignToken,

  // Token collections
  TokenGroupSchema,
  type TokenGroup,
  TokenFileSchema,
  type TokenFile,

  // Output formats
  TokenOutputFormatSchema,
  type TokenOutputFormat,
  TokenExtractionOptionsSchema,
  type TokenExtractionOptions,

  // Tailwind types
  TailwindThemeSchema,
  type TailwindTheme,
  TailwindConfigSchema,
  type TailwindConfig,

  // Comparison types
  TokenDiffEntrySchema,
  type TokenDiffEntry,
  TokenComparisonResultSchema,
  type TokenComparisonResult,
} from './token-types.js';

// =============================================================================
// Alias Types
// =============================================================================

export {
  // Brand type
  type DesignAlias,
  DesignAliasSchema,
  createDesignAlias,
  parseDesignAlias,

  // Target types
  AliasTargetSchema,
  type AliasTarget,

  // Configuration
  DesignConfigSchema,
  type DesignConfig,
  createEmptyDesignConfig,

  // Operations
  AddAliasInputSchema,
  type AddAliasInput,
  AliasOperationResultSchema,
  type AliasOperationResult,

  // Resolution
  ResolvedAliasSchema,
  type ResolvedAlias,
  AliasResolutionErrorSchema,
  type AliasResolutionError,

  // List display
  AliasListEntrySchema,
  type AliasListEntry,
  AliasListResponseSchema,
  type AliasListResponse,
} from './alias-types.js';

// =============================================================================
// Audit Types
// =============================================================================

export {
  // Severity and rule ID
  AuditSeveritySchema,
  type AuditSeverity,
  AuditRuleIdSchema,
  type AuditRuleId,
  AuditRuleSchema,
  type AuditRule,

  // Issue types
  AuditIssueLocationSchema,
  type AuditIssueLocation,
  AuditIssueSchema,
  type AuditIssue,

  // Result types
  AuditSummarySchema,
  type AuditSummary,
  AuditResultSchema,
  type AuditResult,

  // Configuration
  RuleConfigOverrideSchema,
  type RuleConfigOverride,
  AuditConfigSchema,
  type AuditConfig,

  // Rule-specific options
  ColorContrastOptionsSchema,
  type ColorContrastOptions,
  SpacingConsistencyOptionsSchema,
  type SpacingConsistencyOptions,
  NamingConventionOptionsSchema,
  type NamingConventionOptions,

  // CI/CD
  AuditExitCodeSchema,
  type AuditExitCode,
  computeAuditExitCode,

  // Default rules
  DEFAULT_AUDIT_RULES,
} from './audit-types.js';
