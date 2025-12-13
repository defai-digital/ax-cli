/**
 * Alt Text Detection Rule
 * Detects images without alt attributes for accessibility
 */

import type { FileContent, Violation } from '../types.js';
import { getLocationFromIndex } from '../scanner.js';

/**
 * Rule ID
 */
export const RULE_ID = 'missing-alt-text';

/**
 * Regex to find img tags (both HTML and JSX self-closing)
 */
const IMG_TAG_REGEX = /<img\s+([^>]*?)\s*\/?>/gi;

/**
 * Regex to check for alt attribute presence
 */
const ALT_ATTR_REGEX = /\balt\s*=/i;

/**
 * Regex to check for aria-label/aria-labelledby (alternative to alt)
 */
const ARIA_LABEL_REGEX = /\b(aria-label|aria-labelledby)\s*=/i;

/**
 * Regex to check for role="presentation" or role="none" (decorative images)
 */
const DECORATIVE_ROLE_REGEX = /\brole\s*=\s*["'](presentation|none)["']/i;

/**
 * Extract a snippet of the img tag for display
 */
function extractImgSnippet(fullMatch: string, maxLength: number = 60): string {
  if (fullMatch.length <= maxLength) {
    return fullMatch;
  }
  return fullMatch.substring(0, maxLength - 3) + '...';
}

/**
 * Check if an img tag has proper alt text or is marked as decorative
 */
function hasProperAltText(attributes: string): boolean {
  // Check for alt attribute
  if (ALT_ATTR_REGEX.test(attributes)) {
    return true;
  }

  // Check for aria-label/aria-labelledby
  if (ARIA_LABEL_REGEX.test(attributes)) {
    return true;
  }

  // Check if marked as decorative
  if (DECORATIVE_ROLE_REGEX.test(attributes)) {
    return true;
  }

  return false;
}

/**
 * Check for missing alt text on images
 */
export function checkAltText(file: FileContent): Violation[] {
  const violations: Violation[] = [];

  // Only check JSX/TSX/HTML files
  if (!file.path.match(/\.[jt]sx?$|\.html?$/i)) {
    return violations;
  }

  let match: RegExpExecArray | null;
  const regex = new RegExp(IMG_TAG_REGEX.source, 'gi');

  while ((match = regex.exec(file.content)) !== null) {
    const fullMatch = match[0];
    const attributes = match[1];

    if (!hasProperAltText(attributes)) {
      const location = getLocationFromIndex(file.content, match.index);
      const snippet = extractImgSnippet(fullMatch);

      violations.push({
        rule: RULE_ID,
        severity: 'error',
        message: 'Image missing alt attribute',
        file: file.path,
        line: location.line,
        column: location.column,
        found: snippet,
        suggestion: 'Add alt="description" or alt="" for decorative images',
        fixable: false,
      });
    }
  }

  return violations;
}
