/**
 * Figma Token Extraction
 *
 * Extracts design tokens from Figma variables and converts
 * to JSON or Tailwind format.
 *
 * @module design/figma-tokens
 */

import type {
  FigmaVariablesResponse,
  FigmaColor,
  TokenOutputFormat,
} from '@ax-cli/schemas';

// =============================================================================
// Internal Types (simpler than schema types for implementation)
// =============================================================================

interface SimpleToken {
  value: string | number | boolean;
  type: string;
  description?: string;
}

interface TokenCollection {
  [key: string]: SimpleToken | TokenCollection;
}

interface ExtractedTokens {
  colors?: TokenCollection;
  spacing?: TokenCollection;
  radii?: TokenCollection;
  opacity?: TokenCollection;
  typography?: TokenCollection;
  shadows?: TokenCollection;
  [key: string]: TokenCollection | undefined;
}

interface ExtractOptions {
  colorFormat?: 'hex' | 'rgb' | 'hsl';
  dimensionUnit?: 'px' | 'rem';
  remBase?: number;
  includeDescription?: boolean;
}

interface TokenDiff {
  path: string;
  type: 'added' | 'removed' | 'modified';
  figmaValue?: unknown;
  localValue?: unknown;
}

interface ComparisonResult {
  summary: {
    totalFigma: number;
    totalLocal: number;
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
  differences: TokenDiff[];
  timestamp: string;
  figmaFileKey?: string;
  localFilePath?: string;
}

// =============================================================================
// Color Conversion
// =============================================================================

/**
 * Convert Figma RGBA (0-1) to hex
 */
function figmaColorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);

  if (color.a < 1) {
    const a = Math.round(color.a * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${a.toString(16).padStart(2, '0')}`;
  }

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Convert Figma RGBA to RGB string
 */
function figmaColorToRgb(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);

  if (color.a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${color.a.toFixed(2)})`;
  }

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Convert Figma RGBA to HSL string
 */
function figmaColorToHsl(color: FigmaColor): string {
  const r = color.r;
  const g = color.g;
  const b = color.b;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  if (color.a < 1) {
    return `hsla(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${color.a.toFixed(2)})`;
  }

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

// =============================================================================
// Token Name Conversion
// =============================================================================

/**
 * Convert Figma variable name to token path
 * E.g., "Color/Primary/500" → ["colors", "primary", "500"]
 */
function variableNameToPath(name: string): string[] {
  return name
    .split('/')
    .map((part) => part.toLowerCase().replace(/\s+/g, '-'));
}

// =============================================================================
// Token Extraction
// =============================================================================

/**
 * Extract tokens from Figma variables response
 */
export function extractTokensFromVariables(
  response: FigmaVariablesResponse,
  options: ExtractOptions = {}
): ExtractedTokens {
  const {
    colorFormat = 'hex',
    dimensionUnit = 'px',
    remBase = 16,
    includeDescription = true,
  } = options;

  const tokens: ExtractedTokens = {};
  const variables = response.meta.variables;
  const collections = response.meta.variableCollections;

  // Process each variable
  for (const variable of Object.values(variables)) {
    // Skip hidden variables
    if (variable.hiddenFromPublishing) continue;

    // Get collection
    const collection = collections[variable.variableCollectionId];
    if (!collection) continue;

    // Get default mode value
    const defaultModeId = collection.defaultModeId;
    const modeValue = variable.valuesByMode[defaultModeId];

    if (modeValue === undefined) continue;

    // Determine token type and value
    let tokenType: string;
    let tokenValue: string | number | boolean;

    // Handle resolved types
    switch (variable.resolvedType) {
      case 'COLOR': {
        tokenType = 'color';
        const colorValue = modeValue as FigmaColor;
        switch (colorFormat) {
          case 'rgb':
            tokenValue = figmaColorToRgb(colorValue);
            break;
          case 'hsl':
            tokenValue = figmaColorToHsl(colorValue);
            break;
          default:
            tokenValue = figmaColorToHex(colorValue);
        }
        break;
      }
      case 'FLOAT': {
        const numValue = modeValue as number;
        // Detect if this is likely a spacing/sizing value
        const isSpacing = variable.scopes?.some((s) =>
          ['GAP', 'WIDTH_HEIGHT', 'CORNER_RADIUS'].includes(s)
        );
        if (isSpacing) {
          tokenType = 'dimension';
          if (dimensionUnit === 'rem') {
            tokenValue = `${(numValue / remBase).toFixed(4).replace(/\.?0+$/, '')}rem`;
          } else {
            tokenValue = `${numValue}px`;
          }
        } else if (variable.scopes?.includes('OPACITY')) {
          tokenType = 'opacity';
          tokenValue = numValue;
        } else {
          tokenType = 'number';
          tokenValue = numValue;
        }
        break;
      }
      case 'STRING':
        tokenType = 'string';
        tokenValue = modeValue as string;
        break;
      case 'BOOLEAN':
        tokenType = 'boolean';
        tokenValue = modeValue as boolean;
        break;
      default:
        continue; // Skip unknown types
    }

    // Build token
    const token: SimpleToken = {
      value: tokenValue,
      type: tokenType,
    };

    if (includeDescription && variable.description) {
      token.description = variable.description;
    }

    // Determine category from path or scopes
    const path = variableNameToPath(variable.name);
    let category = path[0];

    // Normalize category names
    if (variable.resolvedType === 'COLOR' || variable.scopes?.some((s) => s.includes('FILL') || s.includes('STROKE'))) {
      category = 'colors';
    } else if (variable.scopes?.some((s) => ['GAP', 'WIDTH_HEIGHT'].includes(s))) {
      category = 'spacing';
    } else if (variable.scopes?.some((s) => s.includes('CORNER_RADIUS'))) {
      category = 'radii';
    } else if (variable.scopes?.some((s) => s.includes('OPACITY'))) {
      category = 'opacity';
    }

    // Ensure category exists
    if (!tokens[category]) {
      tokens[category] = {};
    }

    // Build nested path
    let current = tokens[category]!;
    const tokenPath = path.slice(1); // Remove category

    for (let i = 0; i < tokenPath.length - 1; i++) {
      const key = tokenPath[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key] as TokenCollection;
    }

    // Set the token value
    const tokenName = tokenPath[tokenPath.length - 1] || variable.name;
    current[tokenName] = token;
  }

  return tokens;
}

// =============================================================================
// Output Formatters
// =============================================================================

/**
 * Convert tokens to Tailwind config format
 */
export function tokensToTailwind(tokens: ExtractedTokens): object {
  const theme: Record<string, Record<string, string | number | string[]>> = {};

  // Colors
  if (tokens.colors) {
    theme.colors = flattenTokenGroup(tokens.colors);
  }

  // Spacing
  if (tokens.spacing) {
    theme.spacing = flattenTokenGroup(tokens.spacing);
  }

  // Radii
  if (tokens.radii) {
    theme.borderRadius = flattenTokenGroup(tokens.radii);
  }

  // Opacity
  if (tokens.opacity) {
    theme.opacity = flattenTokenGroup(tokens.opacity);
  }

  // Typography
  if (tokens.typography) {
    const typography = tokens.typography;

    if (typography.fontSize) {
      theme.fontSize = flattenTokenGroup(typography.fontSize as TokenCollection);
    }
    if (typography.fontFamily) {
      theme.fontFamily = flattenTokenGroup(typography.fontFamily as TokenCollection);
    }
    if (typography.fontWeight) {
      theme.fontWeight = flattenTokenGroup(typography.fontWeight as TokenCollection);
    }
    if (typography.lineHeight) {
      theme.lineHeight = flattenTokenGroup(typography.lineHeight as TokenCollection);
    }
    if (typography.letterSpacing) {
      theme.letterSpacing = flattenTokenGroup(typography.letterSpacing as TokenCollection);
    }
  }

  // Shadows
  if (tokens.shadows) {
    theme.boxShadow = flattenTokenGroup(tokens.shadows);
  }

  return {
    theme: {
      extend: theme,
    },
  };
}

/**
 * Flatten a token group to Tailwind format
 */
function flattenTokenGroup(
  group: TokenCollection,
  prefix = ''
): Record<string, string | number | string[]> {
  const result: Record<string, string | number | string[]> = {};

  for (const [key, value] of Object.entries(group)) {
    const fullKey = prefix ? `${prefix}-${key}` : key;

    if (value && typeof value === 'object' && 'type' in value && 'value' in value) {
      // It's a token
      const token = value as SimpleToken;
      if (typeof token.value === 'string' || typeof token.value === 'number') {
        result[fullKey] = token.value;
      }
    } else if (value && typeof value === 'object') {
      // It's a nested group
      const nested = flattenTokenGroup(value as TokenCollection, fullKey);
      Object.assign(result, nested);
    }
  }

  return result;
}

/**
 * Format tokens to specified output format
 */
export function formatTokens(
  tokens: ExtractedTokens,
  format: TokenOutputFormat
): string {
  switch (format) {
    case 'tailwind': {
      const config = tokensToTailwind(tokens);
      return `/** @type {import('tailwindcss').Config} */
module.exports = ${JSON.stringify(config, null, 2)};`;
    }

    case 'css': {
      const lines = [':root {'];
      const flatTokens = flattenAllTokens(tokens);
      for (const [name, value] of Object.entries(flatTokens)) {
        lines.push(`  --${name}: ${value};`);
      }
      lines.push('}');
      return lines.join('\n');
    }

    case 'scss': {
      const lines: string[] = [];
      const flatTokens = flattenAllTokens(tokens);
      for (const [name, value] of Object.entries(flatTokens)) {
        lines.push(`$${name}: ${value};`);
      }
      return lines.join('\n');
    }

    case 'json':
    default:
      return JSON.stringify(tokens, null, 2);
  }
}

/**
 * Flatten all tokens to a flat map
 */
function flattenAllTokens(
  tokens: ExtractedTokens | TokenCollection,
  prefix = ''
): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(tokens)) {
    if (value === undefined) continue;

    const fullKey = prefix ? `${prefix}-${key}` : key;

    if (value && typeof value === 'object' && 'type' in value && 'value' in value) {
      const token = value as SimpleToken;
      if (typeof token.value === 'string' || typeof token.value === 'number') {
        result[fullKey] = token.value;
      }
    } else if (value && typeof value === 'object') {
      Object.assign(result, flattenAllTokens(value as TokenCollection, fullKey));
    }
  }

  return result;
}

// =============================================================================
// Token Comparison
// =============================================================================

/**
 * Compare Figma tokens with local tokens file
 */
export function compareTokens(
  figmaTokens: ExtractedTokens,
  localTokens: Record<string, unknown>,
  fileKey?: string,
  localPath?: string
): ComparisonResult {
  const differences: TokenDiff[] = [];
  const figmaFlat = flattenAllTokens(figmaTokens);
  const localFlat = flattenAllTokens(localTokens as ExtractedTokens);

  const allPaths = new Set([...Object.keys(figmaFlat), ...Object.keys(localFlat)]);

  let added = 0;
  let removed = 0;
  let modified = 0;
  let unchanged = 0;

  for (const path of allPaths) {
    const figmaValue = figmaFlat[path];
    const localValue = localFlat[path];

    if (figmaValue !== undefined && localValue === undefined) {
      differences.push({
        path,
        type: 'added',
        figmaValue,
      });
      added++;
    } else if (figmaValue === undefined && localValue !== undefined) {
      differences.push({
        path,
        type: 'removed',
        localValue,
      });
      removed++;
    } else if (figmaValue !== localValue) {
      differences.push({
        path,
        type: 'modified',
        figmaValue,
        localValue,
      });
      modified++;
    } else {
      unchanged++;
    }
  }

  return {
    summary: {
      totalFigma: Object.keys(figmaFlat).length,
      totalLocal: Object.keys(localFlat).length,
      added,
      removed,
      modified,
      unchanged,
    },
    differences,
    timestamp: new Date().toISOString(),
    figmaFileKey: fileKey,
    localFilePath: localPath,
  };
}

/**
 * Format comparison result for display
 */
export function formatComparison(result: ComparisonResult): string {
  const lines: string[] = [
    'Token Comparison Summary',
    '========================',
    `Figma tokens: ${result.summary.totalFigma}`,
    `Local tokens: ${result.summary.totalLocal}`,
    '',
    `Added (in Figma, not local): ${result.summary.added}`,
    `Removed (in local, not Figma): ${result.summary.removed}`,
    `Modified: ${result.summary.modified}`,
    `Unchanged: ${result.summary.unchanged}`,
    '',
  ];

  if (result.differences.length > 0) {
    lines.push('Differences:');
    lines.push('------------');

    for (const diff of result.differences) {
      switch (diff.type) {
        case 'added':
          lines.push(`+ ${diff.path}: ${diff.figmaValue}`);
          break;
        case 'removed':
          lines.push(`- ${diff.path}: ${diff.localValue}`);
          break;
        case 'modified':
          lines.push(`~ ${diff.path}:`);
          lines.push(`  Figma: ${diff.figmaValue}`);
          lines.push(`  Local: ${diff.localValue}`);
          break;
      }
    }
  }

  return lines.join('\n');
}
