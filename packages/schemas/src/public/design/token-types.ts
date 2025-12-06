/**
 * Design Token Schemas
 *
 * Zod schemas for design tokens extracted from Figma.
 * Supports JSON and Tailwind output formats.
 *
 * @module design/token-types
 */

import { z } from 'zod';

// =============================================================================
// Token Value Types
// =============================================================================

/**
 * Token type enumeration
 */
export const TokenTypeSchema = z.enum([
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'paragraphSpacing',
  'textCase',
  'textDecoration',
  'duration',
  'cubicBezier',
  'shadow',
  'gradient',
  'border',
  'opacity',
  'number',
  'string',
  'boolean',
  'composite',
]);
export type TokenType = z.infer<typeof TokenTypeSchema>;

/**
 * Base token schema
 */
export const BaseTokenSchema = z.object({
  value: z.unknown(),
  type: TokenTypeSchema,
  description: z.string().optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Color token value (hex format)
 */
export const ColorTokenSchema = BaseTokenSchema.extend({
  type: z.literal('color'),
  value: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Invalid hex color'),
});
export type ColorToken = z.infer<typeof ColorTokenSchema>;

/**
 * Dimension token value (px, rem, em, %, etc.)
 */
export const DimensionTokenSchema = BaseTokenSchema.extend({
  type: z.literal('dimension'),
  value: z.string().regex(/^-?\d+(\.\d+)?(px|rem|em|%|vw|vh|vmin|vmax)$/, 'Invalid dimension format'),
});
export type DimensionToken = z.infer<typeof DimensionTokenSchema>;

/**
 * Font family token
 */
export const FontFamilyTokenSchema = BaseTokenSchema.extend({
  type: z.literal('fontFamily'),
  value: z.union([z.string(), z.array(z.string())]),
});
export type FontFamilyToken = z.infer<typeof FontFamilyTokenSchema>;

/**
 * Font weight token
 */
export const FontWeightTokenSchema = BaseTokenSchema.extend({
  type: z.literal('fontWeight'),
  value: z.union([
    z.number().int().min(100).max(900),
    z.enum(['thin', 'hairline', 'extralight', 'ultralight', 'light', 'normal', 'regular', 'medium', 'semibold', 'demibold', 'bold', 'extrabold', 'ultrabold', 'black', 'heavy']),
  ]),
});
export type FontWeightToken = z.infer<typeof FontWeightTokenSchema>;

/**
 * Font size token
 */
export const FontSizeTokenSchema = BaseTokenSchema.extend({
  type: z.literal('fontSize'),
  value: z.string().regex(/^-?\d+(\.\d+)?(px|rem|em)$/, 'Invalid font size format'),
});
export type FontSizeToken = z.infer<typeof FontSizeTokenSchema>;

/**
 * Line height token
 */
export const LineHeightTokenSchema = BaseTokenSchema.extend({
  type: z.literal('lineHeight'),
  value: z.union([
    z.number(),
    z.string().regex(/^-?\d+(\.\d+)?(px|rem|em|%)?$/, 'Invalid line height format'),
  ]),
});
export type LineHeightToken = z.infer<typeof LineHeightTokenSchema>;

/**
 * Letter spacing token
 */
export const LetterSpacingTokenSchema = BaseTokenSchema.extend({
  type: z.literal('letterSpacing'),
  value: z.string().regex(/^-?\d+(\.\d+)?(px|rem|em|%)$/, 'Invalid letter spacing format'),
});
export type LetterSpacingToken = z.infer<typeof LetterSpacingTokenSchema>;

/**
 * Shadow token value
 */
export const ShadowValueSchema = z.object({
  color: z.string(),
  offsetX: z.string(),
  offsetY: z.string(),
  blur: z.string(),
  spread: z.string().optional(),
  inset: z.boolean().optional(),
});
export type ShadowValue = z.infer<typeof ShadowValueSchema>;

export const ShadowTokenSchema = BaseTokenSchema.extend({
  type: z.literal('shadow'),
  value: z.union([ShadowValueSchema, z.array(ShadowValueSchema)]),
});
export type ShadowToken = z.infer<typeof ShadowTokenSchema>;

/**
 * Gradient stop
 */
export const GradientStopSchema = z.object({
  color: z.string(),
  position: z.number().min(0).max(1),
});
export type GradientStop = z.infer<typeof GradientStopSchema>;

/**
 * Gradient token value
 */
export const GradientValueSchema = z.object({
  type: z.enum(['linear', 'radial', 'angular', 'diamond']),
  angle: z.number().optional(),
  stops: z.array(GradientStopSchema),
});
export type GradientValue = z.infer<typeof GradientValueSchema>;

export const GradientTokenSchema = BaseTokenSchema.extend({
  type: z.literal('gradient'),
  value: GradientValueSchema,
});
export type GradientToken = z.infer<typeof GradientTokenSchema>;

/**
 * Border token value
 */
export const BorderValueSchema = z.object({
  color: z.string(),
  width: z.string(),
  style: z.enum(['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'none']).optional(),
});
export type BorderValue = z.infer<typeof BorderValueSchema>;

export const BorderTokenSchema = BaseTokenSchema.extend({
  type: z.literal('border'),
  value: BorderValueSchema,
});
export type BorderToken = z.infer<typeof BorderTokenSchema>;

/**
 * Number token
 */
export const NumberTokenSchema = BaseTokenSchema.extend({
  type: z.literal('number'),
  value: z.number(),
});
export type NumberToken = z.infer<typeof NumberTokenSchema>;

/**
 * Opacity token
 */
export const OpacityTokenSchema = BaseTokenSchema.extend({
  type: z.literal('opacity'),
  value: z.number().min(0).max(1),
});
export type OpacityToken = z.infer<typeof OpacityTokenSchema>;

/**
 * Union of all token types
 */
export const DesignTokenSchema = z.union([
  ColorTokenSchema,
  DimensionTokenSchema,
  FontFamilyTokenSchema,
  FontWeightTokenSchema,
  FontSizeTokenSchema,
  LineHeightTokenSchema,
  LetterSpacingTokenSchema,
  ShadowTokenSchema,
  GradientTokenSchema,
  BorderTokenSchema,
  NumberTokenSchema,
  OpacityTokenSchema,
  BaseTokenSchema, // Fallback for other types
]);
export type DesignToken = z.infer<typeof DesignTokenSchema>;

// =============================================================================
// Token Collection (File Structure)
// =============================================================================

/**
 * Recursive token group (can contain tokens or nested groups)
 */
export interface TokenGroup {
  [key: string]: DesignToken | TokenGroup;
}

export const TokenGroupSchema: z.ZodType<TokenGroup> = z.lazy(() =>
  z.record(z.string(), z.union([DesignTokenSchema, TokenGroupSchema]))
);

/**
 * Root token file structure
 */
export const TokenFileSchema = z.object({
  $schema: z.string().optional(),
  $description: z.string().optional(),
  $version: z.string().optional(),
  // Top-level token categories
  colors: TokenGroupSchema.optional(),
  spacing: TokenGroupSchema.optional(),
  sizing: TokenGroupSchema.optional(),
  typography: TokenGroupSchema.optional(),
  shadows: TokenGroupSchema.optional(),
  borders: TokenGroupSchema.optional(),
  radii: TokenGroupSchema.optional(),
  opacity: TokenGroupSchema.optional(),
  zIndex: TokenGroupSchema.optional(),
  transitions: TokenGroupSchema.optional(),
  // Allow additional top-level categories
}).catchall(TokenGroupSchema);
export type TokenFile = z.infer<typeof TokenFileSchema>;

// =============================================================================
// Token Output Formats
// =============================================================================

/**
 * Supported output formats
 */
export const TokenOutputFormatSchema = z.enum(['json', 'tailwind', 'css', 'scss']);
export type TokenOutputFormat = z.infer<typeof TokenOutputFormatSchema>;

/**
 * Token extraction options
 */
export const TokenExtractionOptionsSchema = z.object({
  format: TokenOutputFormatSchema.default('json'),
  includeDescription: z.boolean().default(true),
  flattenGroups: z.boolean().default(false),
  prefix: z.string().optional(),
  colorFormat: z.enum(['hex', 'rgb', 'hsl']).default('hex'),
  dimensionUnit: z.enum(['px', 'rem']).default('px'),
  remBase: z.number().default(16),
});
export type TokenExtractionOptions = z.infer<typeof TokenExtractionOptionsSchema>;

// =============================================================================
// Tailwind Config Types
// =============================================================================

/**
 * Tailwind theme configuration (partial)
 */
export const TailwindThemeSchema = z.object({
  colors: z.record(z.string(), z.union([z.string(), z.record(z.string(), z.string())])).optional(),
  spacing: z.record(z.string(), z.string()).optional(),
  fontSize: z.record(z.string(), z.union([
    z.string(),
    z.tuple([z.string(), z.object({ lineHeight: z.string().optional(), letterSpacing: z.string().optional() })]),
  ])).optional(),
  fontFamily: z.record(z.string(), z.array(z.string())).optional(),
  fontWeight: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  lineHeight: z.record(z.string(), z.string()).optional(),
  letterSpacing: z.record(z.string(), z.string()).optional(),
  borderRadius: z.record(z.string(), z.string()).optional(),
  borderWidth: z.record(z.string(), z.string()).optional(),
  boxShadow: z.record(z.string(), z.string()).optional(),
  opacity: z.record(z.string(), z.string()).optional(),
  zIndex: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});
export type TailwindTheme = z.infer<typeof TailwindThemeSchema>;

/**
 * Tailwind config output
 */
export const TailwindConfigSchema = z.object({
  theme: z.object({
    extend: TailwindThemeSchema,
  }),
});
export type TailwindConfig = z.infer<typeof TailwindConfigSchema>;

// =============================================================================
// Token Comparison Types
// =============================================================================

/**
 * Token difference entry
 */
export const TokenDiffEntrySchema = z.object({
  path: z.string(),
  type: z.enum(['added', 'removed', 'modified']),
  figmaValue: z.unknown().optional(),
  localValue: z.unknown().optional(),
  figmaType: TokenTypeSchema.optional(),
  localType: TokenTypeSchema.optional(),
});
export type TokenDiffEntry = z.infer<typeof TokenDiffEntrySchema>;

/**
 * Token comparison result
 */
export const TokenComparisonResultSchema = z.object({
  summary: z.object({
    totalFigma: z.number(),
    totalLocal: z.number(),
    added: z.number(),
    removed: z.number(),
    modified: z.number(),
    unchanged: z.number(),
  }),
  differences: z.array(TokenDiffEntrySchema),
  timestamp: z.string(),
  figmaFileKey: z.string().optional(),
  localFilePath: z.string().optional(),
});
export type TokenComparisonResult = z.infer<typeof TokenComparisonResultSchema>;
