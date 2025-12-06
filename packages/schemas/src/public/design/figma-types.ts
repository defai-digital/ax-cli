/**
 * Figma API Response Schemas
 *
 * Zod schemas for Figma REST API responses.
 * These schemas validate API responses at system boundaries.
 *
 * @see https://www.figma.com/developers/api
 * @module design/figma-types
 */

import { z } from 'zod';
import { brand, type Brand } from '../core/brand-types.js';

// =============================================================================
// Brand Types
// =============================================================================

/**
 * Figma File Key - unique identifier for a Figma file
 * Format: alphanumeric string, typically 22 characters
 */
export type FigmaFileKey = Brand<string, 'FigmaFileKey'>;

/**
 * Figma Node ID - unique identifier for a node within a file
 * Format: "number:number" (e.g., "123:456")
 */
export type FigmaNodeId = Brand<string, 'FigmaNodeId'>;

// =============================================================================
// Validation Schemas
// =============================================================================

/**
 * Schema for Figma file key validation
 */
export const FigmaFileKeySchema = z
  .string()
  .min(1, 'File key cannot be empty')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid Figma file key format')
  .transform((val) => brand<string, 'FigmaFileKey'>(val));

/**
 * Schema for Figma node ID validation
 */
export const FigmaNodeIdSchema = z
  .string()
  .regex(/^\d+:\d+$/, 'Invalid node ID format (expected "number:number")')
  .transform((val) => brand<string, 'FigmaNodeId'>(val));

// =============================================================================
// Figma API Response Types
// =============================================================================

/**
 * Color in RGBA format (0-1 range)
 */
export const FigmaColorSchema = z.object({
  r: z.number().min(0).max(1),
  g: z.number().min(0).max(1),
  b: z.number().min(0).max(1),
  a: z.number().min(0).max(1),
});
export type FigmaColor = z.infer<typeof FigmaColorSchema>;

/**
 * Rectangle bounds
 */
export const FigmaRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type FigmaRect = z.infer<typeof FigmaRectSchema>;

/**
 * Constraint for resizing behavior
 */
export const FigmaConstraintSchema = z.object({
  type: z.enum(['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']),
  value: z.number().optional(),
});
export type FigmaConstraint = z.infer<typeof FigmaConstraintSchema>;

/**
 * Layout constraint pair (horizontal, vertical)
 */
export const FigmaConstraintsSchema = z.object({
  horizontal: FigmaConstraintSchema,
  vertical: FigmaConstraintSchema,
});
export type FigmaConstraints = z.infer<typeof FigmaConstraintsSchema>;

/**
 * Auto-layout properties
 */
export const FigmaAutoLayoutSchema = z.object({
  layoutMode: z.enum(['NONE', 'HORIZONTAL', 'VERTICAL']).optional(),
  primaryAxisSizingMode: z.enum(['FIXED', 'AUTO']).optional(),
  counterAxisSizingMode: z.enum(['FIXED', 'AUTO']).optional(),
  primaryAxisAlignItems: z.enum(['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']).optional(),
  counterAxisAlignItems: z.enum(['MIN', 'CENTER', 'MAX', 'BASELINE']).optional(),
  paddingLeft: z.number().optional(),
  paddingRight: z.number().optional(),
  paddingTop: z.number().optional(),
  paddingBottom: z.number().optional(),
  itemSpacing: z.number().optional(),
  counterAxisSpacing: z.number().optional(),
  layoutWrap: z.enum(['NO_WRAP', 'WRAP']).optional(),
});
export type FigmaAutoLayout = z.infer<typeof FigmaAutoLayoutSchema>;

/**
 * Paint fill/stroke
 */
export const FigmaPaintSchema = z.object({
  type: z.enum(['SOLID', 'GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND', 'IMAGE', 'EMOJI', 'VIDEO']),
  visible: z.boolean().optional().default(true),
  opacity: z.number().min(0).max(1).optional().default(1),
  color: FigmaColorSchema.optional(),
  blendMode: z.string().optional(),
  gradientStops: z.array(z.object({
    position: z.number(),
    color: FigmaColorSchema,
  })).optional(),
  scaleMode: z.enum(['FILL', 'FIT', 'TILE', 'STRETCH']).optional(),
  imageRef: z.string().optional(),
});
export type FigmaPaint = z.infer<typeof FigmaPaintSchema>;

/**
 * Text style properties
 */
export const FigmaTextStyleSchema = z.object({
  fontFamily: z.string().optional(),
  fontPostScriptName: z.string().optional(),
  fontWeight: z.number().optional(),
  fontSize: z.number().optional(),
  textAlignHorizontal: z.enum(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED']).optional(),
  textAlignVertical: z.enum(['TOP', 'CENTER', 'BOTTOM']).optional(),
  letterSpacing: z.number().optional(),
  lineHeightPx: z.number().optional(),
  lineHeightPercent: z.number().optional(),
  lineHeightUnit: z.enum(['PIXELS', 'FONT_SIZE_%', 'INTRINSIC_%']).optional(),
  textCase: z.enum(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE', 'SMALL_CAPS', 'SMALL_CAPS_FORCED']).optional(),
  textDecoration: z.enum(['NONE', 'STRIKETHROUGH', 'UNDERLINE']).optional(),
  paragraphSpacing: z.number().optional(),
  paragraphIndent: z.number().optional(),
});
export type FigmaTextStyle = z.infer<typeof FigmaTextStyleSchema>;

/**
 * Effect (shadow, blur, etc.)
 */
export const FigmaEffectSchema = z.object({
  type: z.enum(['INNER_SHADOW', 'DROP_SHADOW', 'LAYER_BLUR', 'BACKGROUND_BLUR']),
  visible: z.boolean().optional().default(true),
  radius: z.number().optional(),
  color: FigmaColorSchema.optional(),
  blendMode: z.string().optional(),
  offset: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  spread: z.number().optional(),
  showShadowBehindNode: z.boolean().optional(),
});
export type FigmaEffect = z.infer<typeof FigmaEffectSchema>;

/**
 * Component property definition
 */
export const FigmaComponentPropertyDefinitionSchema = z.object({
  type: z.enum(['BOOLEAN', 'TEXT', 'INSTANCE_SWAP', 'VARIANT']),
  defaultValue: z.union([z.string(), z.boolean()]).optional(),
  variantOptions: z.array(z.string()).optional(),
  preferredValues: z.array(z.object({
    type: z.enum(['COMPONENT', 'COMPONENT_SET']),
    key: z.string(),
  })).optional(),
});
export type FigmaComponentPropertyDefinition = z.infer<typeof FigmaComponentPropertyDefinitionSchema>;

// =============================================================================
// Node Type Definitions (Manual types to avoid circular inference)
// =============================================================================

/**
 * All possible Figma node types
 */
export const FigmaNodeTypeSchema = z.enum([
  'DOCUMENT',
  'CANVAS',
  'FRAME',
  'GROUP',
  'SECTION',
  'VECTOR',
  'LINE',
  'ELLIPSE',
  'REGULAR_POLYGON',
  'STAR',
  'BOOLEAN_OPERATION',
  'RECTANGLE',
  'TEXT',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
  'SLICE',
  'STICKY',
  'SHAPE_WITH_TEXT',
  'CONNECTOR',
  'STAMP',
  'WIDGET',
  'EMBED',
  'LINK_UNFURL',
  'MEDIA',
  'TABLE',
  'TABLE_CELL',
  'WASHI_TAPE',
]);
export type FigmaNodeType = z.infer<typeof FigmaNodeTypeSchema>;

/**
 * Base node interface - manually defined to avoid circular inference
 */
export interface FigmaBaseNode {
  id: string;
  name: string;
  type: FigmaNodeType;
  visible?: boolean;
  locked?: boolean;
  pluginData?: Record<string, unknown>;
  sharedPluginData?: Record<string, Record<string, unknown>>;
  componentPropertyReferences?: Record<string, string>;
}

/**
 * Frame-like node interface (FRAME, GROUP, SECTION, COMPONENT, etc.)
 */
export interface FigmaFrameLikeNode extends FigmaBaseNode {
  type: 'FRAME' | 'GROUP' | 'SECTION' | 'COMPONENT' | 'COMPONENT_SET' | 'INSTANCE';
  absoluteBoundingBox?: FigmaRect;
  absoluteRenderBounds?: FigmaRect | null;
  constraints?: FigmaConstraints;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
  cornerRadius?: number;
  rectangleCornerRadii?: [number, number, number, number];
  effects?: FigmaEffect[];
  blendMode?: string;
  opacity?: number;
  clipsContent?: boolean;
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  children?: FigmaNode[];
  // Component-specific
  componentPropertyDefinitions?: Record<string, FigmaComponentPropertyDefinition>;
  // Instance-specific
  componentId?: string;
  componentProperties?: Record<string, { value: string | boolean; type: string }>;
}

/**
 * Text node interface
 */
export interface FigmaTextNode extends FigmaBaseNode {
  type: 'TEXT';
  absoluteBoundingBox?: FigmaRect;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  effects?: FigmaEffect[];
  characters?: string;
  style?: FigmaTextStyle;
  characterStyleOverrides?: number[];
  styleOverrideTable?: Record<string, FigmaTextStyle>;
}

/**
 * Vector-like node interface
 */
export interface FigmaVectorLikeNode extends FigmaBaseNode {
  type: 'VECTOR' | 'LINE' | 'ELLIPSE' | 'REGULAR_POLYGON' | 'STAR' | 'BOOLEAN_OPERATION' | 'RECTANGLE';
  absoluteBoundingBox?: FigmaRect;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  effects?: FigmaEffect[];
  cornerRadius?: number;
  rectangleCornerRadii?: [number, number, number, number];
}

/**
 * Document node interface
 */
export interface FigmaDocumentNode extends FigmaBaseNode {
  type: 'DOCUMENT';
  children: FigmaNode[];
}

/**
 * Canvas (page) node interface
 */
export interface FigmaCanvasNode extends FigmaBaseNode {
  type: 'CANVAS';
  backgroundColor?: FigmaColor;
  prototypeStartNodeID?: string | null;
  flowStartingPoints?: Array<{ nodeId: string; name: string }>;
  children: FigmaNode[];
}

/**
 * Union type for all Figma nodes
 */
export type FigmaNode =
  | FigmaDocumentNode
  | FigmaCanvasNode
  | FigmaFrameLikeNode
  | FigmaTextNode
  | FigmaVectorLikeNode
  | (FigmaBaseNode & { children?: FigmaNode[] }); // Fallback for unknown types

// =============================================================================
// Node Schema (Permissive for API responses)
// =============================================================================

/**
 * Base node schema for validation
 */
const FigmaBaseNodeSchemaObj = z.object({
  id: z.string(),
  name: z.string(),
  type: FigmaNodeTypeSchema.or(z.string()), // Allow unknown types
  visible: z.boolean().optional().default(true),
  locked: z.boolean().optional().default(false),
  pluginData: z.record(z.string(), z.unknown()).optional(),
  sharedPluginData: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  componentPropertyReferences: z.record(z.string(), z.string()).optional(),
});

/**
 * Permissive node schema that handles recursive children
 * Uses passthrough to preserve all properties from API
 */
export const FigmaNodeSchema: z.ZodType<FigmaNode> = FigmaBaseNodeSchemaObj
  .extend({
    // Common optional properties
    absoluteBoundingBox: FigmaRectSchema.optional(),
    absoluteRenderBounds: FigmaRectSchema.nullable().optional(),
    constraints: FigmaConstraintsSchema.optional(),
    fills: z.array(FigmaPaintSchema).optional(),
    strokes: z.array(FigmaPaintSchema).optional(),
    strokeWeight: z.number().optional(),
    strokeAlign: z.enum(['INSIDE', 'OUTSIDE', 'CENTER']).optional(),
    cornerRadius: z.number().optional(),
    rectangleCornerRadii: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    effects: z.array(FigmaEffectSchema).optional(),
    blendMode: z.string().optional(),
    opacity: z.number().optional(),
    clipsContent: z.boolean().optional(),
    layoutMode: z.enum(['NONE', 'HORIZONTAL', 'VERTICAL']).optional(),
    primaryAxisSizingMode: z.enum(['FIXED', 'AUTO']).optional(),
    counterAxisSizingMode: z.enum(['FIXED', 'AUTO']).optional(),
    primaryAxisAlignItems: z.enum(['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']).optional(),
    counterAxisAlignItems: z.enum(['MIN', 'CENTER', 'MAX', 'BASELINE']).optional(),
    paddingLeft: z.number().optional(),
    paddingRight: z.number().optional(),
    paddingTop: z.number().optional(),
    paddingBottom: z.number().optional(),
    itemSpacing: z.number().optional(),
    backgroundColor: FigmaColorSchema.optional(),
    prototypeStartNodeID: z.string().nullable().optional(),
    flowStartingPoints: z.array(z.object({ nodeId: z.string(), name: z.string() })).optional(),
    // Text-specific
    characters: z.string().optional(),
    style: FigmaTextStyleSchema.optional(),
    characterStyleOverrides: z.array(z.number()).optional(),
    styleOverrideTable: z.record(z.string(), FigmaTextStyleSchema).optional(),
    // Component-specific
    componentPropertyDefinitions: z.record(z.string(), FigmaComponentPropertyDefinitionSchema).optional(),
    componentId: z.string().optional(),
    componentProperties: z.record(z.string(), z.object({
      value: z.union([z.string(), z.boolean()]),
      type: z.string(),
    })).optional(),
    // Children - use lazy to handle recursion
    children: z.lazy(() => z.array(FigmaNodeSchema)).optional(),
  })
  .passthrough() as z.ZodType<FigmaNode>;

// =============================================================================
// File Response Schema
// =============================================================================

/**
 * Component metadata
 */
export const FigmaComponentMetaSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().optional(),
  documentationLinks: z.array(z.object({
    uri: z.string(),
  })).optional(),
});
export type FigmaComponentMeta = z.infer<typeof FigmaComponentMetaSchema>;

/**
 * Style metadata
 */
export const FigmaStyleMetaSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().optional(),
  styleType: z.enum(['FILL', 'TEXT', 'EFFECT', 'GRID']),
});
export type FigmaStyleMeta = z.infer<typeof FigmaStyleMetaSchema>;

/**
 * Full file response from GET /v1/files/:key
 */
export const FigmaFileResponseSchema = z.object({
  name: z.string(),
  lastModified: z.string(),
  thumbnailUrl: z.string().optional(),
  version: z.string(),
  role: z.enum(['owner', 'editor', 'viewer']).optional(),
  editorType: z.enum(['figma', 'figjam']).optional(),
  document: FigmaNodeSchema,
  components: z.record(z.string(), FigmaComponentMetaSchema).optional(),
  componentSets: z.record(z.string(), FigmaComponentMetaSchema).optional(),
  styles: z.record(z.string(), FigmaStyleMetaSchema).optional(),
  schemaVersion: z.number().optional(),
  mainFileKey: z.string().optional(),
});
export type FigmaFileResponse = z.infer<typeof FigmaFileResponseSchema>;

/**
 * Partial file response for nodes endpoint GET /v1/files/:key/nodes
 */
export const FigmaNodesResponseSchema = z.object({
  name: z.string(),
  lastModified: z.string(),
  thumbnailUrl: z.string().optional(),
  version: z.string(),
  nodes: z.record(z.string(), z.object({
    document: FigmaNodeSchema,
    components: z.record(z.string(), FigmaComponentMetaSchema).optional(),
    styles: z.record(z.string(), FigmaStyleMetaSchema).optional(),
  })),
});
export type FigmaNodesResponse = z.infer<typeof FigmaNodesResponseSchema>;

// =============================================================================
// Variables/Tokens Response Schema
// =============================================================================

/**
 * Variable value types
 */
export const FigmaVariableValueSchema = z.union([
  z.object({
    type: z.literal('COLOR'),
    value: FigmaColorSchema,
  }),
  z.object({
    type: z.literal('FLOAT'),
    value: z.number(),
  }),
  z.object({
    type: z.literal('STRING'),
    value: z.string(),
  }),
  z.object({
    type: z.literal('BOOLEAN'),
    value: z.boolean(),
  }),
  z.object({
    type: z.literal('VARIABLE_ALIAS'),
    value: z.object({
      id: z.string(),
    }),
  }),
]);
export type FigmaVariableValue = z.infer<typeof FigmaVariableValueSchema>;

/**
 * Variable definition
 */
export const FigmaVariableSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  variableCollectionId: z.string(),
  resolvedType: z.enum(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']),
  description: z.string().optional(),
  hiddenFromPublishing: z.boolean().optional(),
  scopes: z.array(z.enum([
    'ALL_SCOPES',
    'TEXT_CONTENT',
    'CORNER_RADIUS',
    'WIDTH_HEIGHT',
    'GAP',
    'ALL_FILLS',
    'FRAME_FILL',
    'SHAPE_FILL',
    'TEXT_FILL',
    'STROKE_COLOR',
    'STROKE_FLOAT',
    'EFFECT_COLOR',
    'EFFECT_FLOAT',
    'OPACITY',
    'FONT_FAMILY',
    'FONT_STYLE',
    'FONT_WEIGHT',
    'FONT_SIZE',
    'LINE_HEIGHT',
    'LETTER_SPACING',
    'PARAGRAPH_SPACING',
    'PARAGRAPH_INDENT',
  ])).optional(),
  codeSyntax: z.record(z.string(), z.string()).optional(),
  valuesByMode: z.record(z.string(), z.unknown()),
});
export type FigmaVariable = z.infer<typeof FigmaVariableSchema>;

/**
 * Variable collection
 */
export const FigmaVariableCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  modes: z.array(z.object({
    modeId: z.string(),
    name: z.string(),
  })),
  defaultModeId: z.string(),
  remote: z.boolean().optional(),
  hiddenFromPublishing: z.boolean().optional(),
  variableIds: z.array(z.string()),
});
export type FigmaVariableCollection = z.infer<typeof FigmaVariableCollectionSchema>;

/**
 * Variables response from GET /v1/files/:key/variables/local
 */
export const FigmaVariablesResponseSchema = z.object({
  status: z.number().optional(),
  error: z.boolean().optional(),
  meta: z.object({
    variables: z.record(z.string(), FigmaVariableSchema),
    variableCollections: z.record(z.string(), FigmaVariableCollectionSchema),
  }),
});
export type FigmaVariablesResponse = z.infer<typeof FigmaVariablesResponseSchema>;

// =============================================================================
// Images Response Schema
// =============================================================================

/**
 * Images response from GET /v1/images/:key
 */
export const FigmaImagesResponseSchema = z.object({
  err: z.string().nullable().optional(),
  images: z.record(z.string(), z.string().nullable()),
});
export type FigmaImagesResponse = z.infer<typeof FigmaImagesResponseSchema>;

// =============================================================================
// API Options
// =============================================================================

/**
 * Options for GET /v1/files/:key
 */
export const GetFileOptionsSchema = z.object({
  version: z.string().optional(),
  depth: z.number().int().positive().optional(),
  geometry: z.enum(['paths', 'bounds']).optional(),
  plugin_data: z.string().optional(),
  branch_data: z.boolean().optional(),
});
export type GetFileOptions = z.infer<typeof GetFileOptionsSchema>;

/**
 * Options for GET /v1/images/:key
 */
export const GetImagesOptionsSchema = z.object({
  scale: z.number().min(0.01).max(4).optional(),
  format: z.enum(['jpg', 'png', 'svg', 'pdf']).optional(),
  svg_include_id: z.boolean().optional(),
  svg_simplify_stroke: z.boolean().optional(),
  use_absolute_bounds: z.boolean().optional(),
});
export type GetImagesOptions = z.infer<typeof GetImagesOptionsSchema>;
