/**
 * Spacing Detection Rule
 * Detects raw pixel values that should use design tokens
 */

import type { FileContent, Violation, DesignCheckConfig, RegexMatch } from '../types.js';
import { getLocationFromIndex } from '../scanner.js';

/**
 * Rule ID
 */
export const RULE_ID = 'no-raw-spacing';

/**
 * Pixel values that are always allowed (borders, etc.)
 */
const ALLOWED_PX_VALUES = ['0', '1px', '0px'];

/**
 * CSS properties that use spacing
 */
const SPACING_PROPERTIES = [
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'gap',
  'row-gap',
  'column-gap',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
];

/**
 * Regex for CSS/JSX spacing values
 * Matches: margin: 16px, padding: 24px, etc.
 */
const CSS_PX_REGEX = new RegExp(
  `(${SPACING_PROPERTIES.join('|')})\\s*:\\s*['"]?(\\d+)px['"]?`,
  'gi'
);

/**
 * Regex for JSX style object spacing
 * Matches: marginTop: 16, padding: '16px', etc.
 */
const JSX_STYLE_REGEX = /(\w+):\s*['"]?(\d+)(?:px)?['"]?/g;

/**
 * JSX style properties (camelCase versions)
 */
const JSX_SPACING_PROPERTIES = [
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginBlock',
  'marginInline',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingBlock',
  'paddingInline',
  'gap',
  'rowGap',
  'columnGap',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
];

/**
 * Tailwind arbitrary spacing pattern
 * Matches: p-[16px], m-[24px], w-[100px], etc.
 */
const TAILWIND_ARBITRARY_SPACING_REGEX = /(?:p|m|w|h|gap|top|right|bottom|left|inset)(?:[trblxy])?-\[(\d+)px\]/g;

/**
 * Find spacing matches in CSS/SCSS files
 */
function findCssSpacingMatches(content: string): RegexMatch[] {
  const matches: RegexMatch[] = [];
  let match: RegExpExecArray | null;

  const regex = new RegExp(CSS_PX_REGEX.source, 'gi');
  while ((match = regex.exec(content)) !== null) {
    const pxValue = `${match[2]}px`;

    // Skip allowed values
    if (ALLOWED_PX_VALUES.includes(pxValue) || ALLOWED_PX_VALUES.includes(match[2])) {
      continue;
    }

    const location = getLocationFromIndex(content, match.index);
    matches.push({
      value: pxValue,
      index: match.index,
      ...location,
    });
  }

  return matches;
}

/**
 * Find spacing matches in JSX style objects
 */
function findJsxSpacingMatches(content: string): RegexMatch[] {
  const matches: RegexMatch[] = [];

  // Find style={{ ... }} blocks
  const styleBlockRegex = /style\s*=\s*\{\{([^}]+)\}\}/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = styleBlockRegex.exec(content)) !== null) {
    const blockContent = blockMatch[1];
    const blockStart = blockMatch.index + blockMatch[0].indexOf(blockContent);

    // Find spacing properties in the block
    let propMatch: RegExpExecArray | null;
    const propRegex = new RegExp(JSX_STYLE_REGEX.source, 'g');

    while ((propMatch = propRegex.exec(blockContent)) !== null) {
      const propName = propMatch[1];
      const pxValue = propMatch[2];

      // Check if this is a spacing property
      if (!JSX_SPACING_PROPERTIES.includes(propName)) {
        continue;
      }

      // Skip allowed values
      if (ALLOWED_PX_VALUES.includes(`${pxValue}px`) || pxValue === '0') {
        continue;
      }

      const absoluteIndex = blockStart + propMatch.index;
      const location = getLocationFromIndex(content, absoluteIndex);

      matches.push({
        value: `${pxValue}px`,
        index: absoluteIndex,
        ...location,
      });
    }
  }

  return matches;
}

/**
 * Find Tailwind arbitrary spacing matches
 */
function findTailwindSpacingMatches(content: string): RegexMatch[] {
  const matches: RegexMatch[] = [];
  let match: RegExpExecArray | null;

  const regex = new RegExp(TAILWIND_ARBITRARY_SPACING_REGEX.source, 'g');
  while ((match = regex.exec(content)) !== null) {
    const pxValue = `${match[1]}px`;

    // Skip allowed values
    if (ALLOWED_PX_VALUES.includes(pxValue)) {
      continue;
    }

    const location = getLocationFromIndex(content, match.index);
    matches.push({
      value: pxValue,
      index: match.index,
      ...location,
    });
  }

  return matches;
}

/**
 * Find the matching token for a pixel value
 */
function findMatchingToken(
  pxValue: string,
  tokens: Record<string, string>
): string | null {
  const normalized = pxValue.toLowerCase();

  for (const [name, value] of Object.entries(tokens)) {
    if (value.toLowerCase() === normalized) {
      return name;
    }
  }

  return null;
}

/**
 * Find the nearest token for a pixel value
 */
function findNearestToken(
  pxValue: string,
  tokens: Record<string, string>
): string | null {
  const targetPx = parseInt(pxValue.replace('px', ''), 10);
  if (isNaN(targetPx)) {
    return null;
  }

  let nearestToken: string | null = null;
  let nearestDistance = Infinity;

  for (const [name, value] of Object.entries(tokens)) {
    const tokenPx = parseInt(value.replace('px', ''), 10);
    if (isNaN(tokenPx)) {
      continue;
    }

    const distance = Math.abs(targetPx - tokenPx);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestToken = name;
    }
  }

  // Return nearest token with its value for context
  if (nearestToken) {
    const nearestValue = tokens[nearestToken];
    return `${nearestToken} (${nearestValue})`;
  }

  return null;
}

/**
 * Check for raw spacing values in a file
 */
export function checkSpacing(
  file: FileContent,
  config: DesignCheckConfig
): Violation[] {
  const violations: Violation[] = [];
  const spacingTokens = config.tokens.spacing;

  // Collect all matches
  const matches: RegexMatch[] = [];

  // CSS/SCSS files
  if (file.path.endsWith('.css') || file.path.endsWith('.scss')) {
    matches.push(...findCssSpacingMatches(file.content));
  }

  // JSX/TSX files
  if (file.path.match(/\.[jt]sx?$/)) {
    matches.push(...findJsxSpacingMatches(file.content));
    matches.push(...findTailwindSpacingMatches(file.content));
  }

  for (const match of matches) {
    // Check if this value matches a token
    const matchingToken = findMatchingToken(match.value, spacingTokens);

    if (!matchingToken) {
      // Find nearest token for suggestion
      const suggestion = findNearestToken(match.value, spacingTokens);

      violations.push({
        rule: RULE_ID,
        severity: 'warning', // Default to warning, adjusted by rule runner
        message: suggestion
          ? `Raw spacing '${match.value}' → use '${suggestion}'`
          : `Raw spacing '${match.value}'`,
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
