/**
 * Color Detection Rule
 * Detects hardcoded color values that should use design tokens
 */

import type { FileContent, Violation, DesignCheckConfig, RegexMatch } from '../types.js';
import { getLocationFromIndex } from '../scanner.js';

/**
 * Rule ID
 */
export const RULE_ID = 'no-hardcoded-colors';

/**
 * Regex patterns for color detection
 */
const HEX_COLOR_REGEX = /#([0-9a-fA-F]{3,8})\b/g;
const RGB_REGEX = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)/g;
const HSL_REGEX = /hsla?\(\s*(\d{1,3})\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*[\d.]+)?\s*\)/g;

/**
 * Tailwind arbitrary color pattern: text-[#fff], bg-[#1e90ff], etc.
 */
const TAILWIND_ARBITRARY_COLOR_REGEX = /(?:text|bg|border|ring|fill|stroke)-\[(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))\]/g;

/**
 * Patterns to exclude (e.g., in comments, strings that aren't styles)
 */
const EXCLUDE_PATTERNS = [
  /\/\/.*$/gm,  // Single-line comments
  /\/\*[\s\S]*?\*\//g,  // Multi-line comments
];

/**
 * Find all color matches in content
 */
function findColorMatches(content: string): RegexMatch[] {
  const matches: RegexMatch[] = [];
  const seenPositions = new Set<string>();

  // Remove comments to avoid false positives
  let cleanContent = content;
  for (const pattern of EXCLUDE_PATTERNS) {
    cleanContent = cleanContent.replace(pattern, (match) => ' '.repeat(match.length));
  }

  // Helper to add match if not duplicate
  const addMatch = (value: string, index: number) => {
    const location = getLocationFromIndex(content, index);
    const key = `${location.line}:${location.column}:${value}`;
    if (!seenPositions.has(key)) {
      seenPositions.add(key);
      matches.push({
        value,
        index,
        ...location,
      });
    }
  };

  // Find hex colors
  let match: RegExpExecArray | null;
  const hexRegex = new RegExp(HEX_COLOR_REGEX.source, 'g');
  while ((match = hexRegex.exec(cleanContent)) !== null) {
    addMatch(match[0], match.index);
  }

  // Find RGB colors
  const rgbRegex = new RegExp(RGB_REGEX.source, 'g');
  while ((match = rgbRegex.exec(cleanContent)) !== null) {
    addMatch(match[0], match.index);
  }

  // Find HSL colors
  const hslRegex = new RegExp(HSL_REGEX.source, 'g');
  while ((match = hslRegex.exec(cleanContent)) !== null) {
    addMatch(match[0], match.index);
  }

  // Find Tailwind arbitrary colors
  const tailwindRegex = new RegExp(TAILWIND_ARBITRARY_COLOR_REGEX.source, 'g');
  while ((match = tailwindRegex.exec(cleanContent)) !== null) {
    // Extract just the color value from the match
    const colorMatch = match[1];
    // Calculate actual position of the color value within the match
    const colorIndex = match.index + match[0].indexOf(colorMatch);
    addMatch(colorMatch, colorIndex);
  }

  return matches;
}

/**
 * Normalize a color to a consistent format for comparison
 * Returns lowercase hex without alpha for simple comparison
 */
function normalizeColor(color: string): string {
  const trimmed = color.trim().toLowerCase();

  // Already hex
  if (trimmed.startsWith('#')) {
    // Expand shorthand: #fff -> #ffffff
    if (trimmed.length === 4) {
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
    }
    // Strip alpha if present: #ffffffff -> #ffffff
    if (trimmed.length === 9) {
      return trimmed.substring(0, 7);
    }
    return trimmed.substring(0, 7);
  }

  // Convert RGB to hex
  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // HSL is more complex, return as-is for now
  return trimmed;
}

/**
 * Check if a color matches any token in the config
 */
function findMatchingToken(
  color: string,
  tokens: Record<string, string>
): string | null {
  const normalizedColor = normalizeColor(color);

  for (const [name, value] of Object.entries(tokens)) {
    const normalizedToken = normalizeColor(value);
    if (normalizedColor === normalizedToken) {
      return name;
    }
  }

  return null;
}

/**
 * Find the nearest token to a color (by simple hex distance)
 */
function findNearestToken(
  color: string,
  tokens: Record<string, string>
): string | null {
  if (Object.keys(tokens).length === 0) {
    return null;
  }

  const normalizedColor = normalizeColor(color);
  if (!normalizedColor.startsWith('#')) {
    return null;
  }

  let nearestToken: string | null = null;
  let nearestDistance = Infinity;

  const targetRgb = hexToRgb(normalizedColor);
  if (!targetRgb) {
    return null;
  }

  for (const [name, value] of Object.entries(tokens)) {
    const normalizedToken = normalizeColor(value);
    if (!normalizedToken.startsWith('#')) {
      continue;
    }

    const tokenRgb = hexToRgb(normalizedToken);
    if (!tokenRgb) {
      continue;
    }

    // Calculate color distance (simple Euclidean in RGB space)
    const distance = Math.sqrt(
      Math.pow(targetRgb.r - tokenRgb.r, 2) +
      Math.pow(targetRgb.g - tokenRgb.g, 2) +
      Math.pow(targetRgb.b - tokenRgb.b, 2)
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestToken = name;
    }
  }

  // Only suggest if reasonably close (distance < 50)
  if (nearestDistance < 50 && nearestToken) {
    return nearestToken;
  }

  return null;
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) {
    return null;
  }
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

/**
 * Check for hardcoded colors in a file
 */
export function checkColors(
  file: FileContent,
  config: DesignCheckConfig
): Violation[] {
  const violations: Violation[] = [];
  const colorTokens = config.tokens.colors;

  // If no color tokens defined, report all hardcoded colors
  const matches = findColorMatches(file.content);

  for (const match of matches) {
    // Check if this color matches a token
    const matchingToken = findMatchingToken(match.value, colorTokens);

    if (!matchingToken) {
      // Find nearest token for suggestion
      const suggestion = findNearestToken(match.value, colorTokens);

      violations.push({
        rule: RULE_ID,
        severity: 'error', // Will be adjusted by rule runner based on config
        message: suggestion
          ? `Hardcoded color '${match.value}' → use '${suggestion}'`
          : `Hardcoded color '${match.value}'`,
        file: file.path,
        line: match.line,
        column: match.column,
        found: match.value,
        suggestion: suggestion ?? undefined,
        fixable: true,
      });
    }
  }

  return violations;
}
