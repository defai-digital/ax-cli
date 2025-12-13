/**
 * Inline Styles Detection Rule
 * Detects inline style props that should use CSS classes or styled components
 */

import type { FileContent, Violation } from '../types.js';
import { getLocationFromIndex } from '../scanner.js';

/**
 * Rule ID
 */
export const RULE_ID = 'no-inline-styles';

/**
 * Regex to find inline style props in JSX
 * Matches: style={{ ... }} or style={someVariable}
 */
const JSX_STYLE_PROP_REGEX = /\bstyle\s*=\s*\{/g;

/**
 * Regex to find HTML inline styles
 * Matches: style="..."
 */
const HTML_STYLE_ATTR_REGEX = /\bstyle\s*=\s*["'][^"']+["']/gi;

/**
 * Extract a snippet around the style prop
 */
function extractStyleSnippet(
  content: string,
  startIndex: number,
  maxLength: number = 60
): string {
  // Find the end of the style prop (matching brace or quote)
  let endIndex = startIndex + 10;
  const startChar = content[startIndex + content.substring(startIndex).indexOf('=') + 1]?.trim()[0];

  if (startChar === '{') {
    // JSX style - find matching closing brace
    let braceCount = 0;
    for (let i = startIndex; i < content.length && i < startIndex + 200; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
  } else if (startChar === '"' || startChar === "'") {
    // HTML style - find closing quote
    const quoteChar = startChar;
    const searchStart = startIndex + content.substring(startIndex).indexOf(quoteChar) + 1;
    const closeIndex = content.indexOf(quoteChar, searchStart);
    if (closeIndex > 0) {
      endIndex = closeIndex + 1;
    }
  }

  const snippet = content.substring(startIndex, Math.min(endIndex, startIndex + maxLength));
  if (endIndex > startIndex + maxLength) {
    return snippet + '...';
  }
  return snippet;
}

/**
 * Check for inline styles in a file
 */
export function checkInlineStyles(file: FileContent): Violation[] {
  const violations: Violation[] = [];

  // Only check JSX/TSX/HTML files
  if (!file.path.match(/\.[jt]sx?$|\.html?$/i)) {
    return violations;
  }

  // Check JSX style props
  let match: RegExpExecArray | null;

  if (file.path.match(/\.[jt]sx?$/)) {
    const jsxRegex = new RegExp(JSX_STYLE_PROP_REGEX.source, 'g');
    while ((match = jsxRegex.exec(file.content)) !== null) {
      const location = getLocationFromIndex(file.content, match.index);
      const snippet = extractStyleSnippet(file.content, match.index);

      violations.push({
        rule: RULE_ID,
        severity: 'warning',
        message: 'Inline style detected',
        file: file.path,
        line: location.line,
        column: location.column,
        found: snippet,
        suggestion: 'Consider using CSS classes, Tailwind, or styled-components',
        fixable: false,
      });
    }
  }

  // Check HTML style attributes
  if (file.path.match(/\.html?$/i)) {
    const htmlRegex = new RegExp(HTML_STYLE_ATTR_REGEX.source, 'gi');
    while ((match = htmlRegex.exec(file.content)) !== null) {
      const location = getLocationFromIndex(file.content, match.index);

      violations.push({
        rule: RULE_ID,
        severity: 'warning',
        message: 'Inline style detected',
        file: file.path,
        line: location.line,
        column: location.column,
        found: match[0],
        suggestion: 'Consider using CSS classes',
        fixable: false,
      });
    }
  }

  return violations;
}
