/**
 * Form Labels Detection Rule
 * Detects form inputs without proper labels for accessibility
 */

import type { FileContent, Violation } from '../types.js';
import { getLocationFromIndex } from '../scanner.js';

/**
 * Rule ID
 */
export const RULE_ID = 'missing-form-labels';

/**
 * Input types that don't require visible labels
 */
const NON_LABELABLE_TYPES = ['hidden', 'submit', 'reset', 'button', 'image'];

/**
 * Regex to find input elements
 */
const INPUT_REGEX = /<input\s+([^>]*?)\s*\/?>/gi;

/**
 * Regex to find textarea elements
 */
const TEXTAREA_REGEX = /<textarea\s*([^>]*?)(?:\s*\/>|>[\s\S]*?<\/textarea>)/gi;

/**
 * Regex to find select elements
 */
const SELECT_REGEX = /<select\s*([^>]*?)(?:\s*\/>|>[\s\S]*?<\/select>)/gi;

/**
 * Check for aria-label attribute
 */
const ARIA_LABEL_REGEX = /\b(aria-label|aria-labelledby)\s*=\s*["'][^"']+["']/i;

/**
 * Check for id attribute (for associated label)
 */
const ID_ATTR_REGEX = /\bid\s*=\s*["']([^"']+)["']/i;

/**
 * Check for type attribute
 */
const TYPE_ATTR_REGEX = /\btype\s*=\s*["']([^"']+)["']/i;

/**
 * Check for placeholder (not a proper label, but we note it)
 */
const PLACEHOLDER_REGEX = /\bplaceholder\s*=\s*["'][^"']+["']/i;

/**
 * Check for title attribute
 */
const TITLE_REGEX = /\btitle\s*=\s*["'][^"']+["']/i;

/**
 * Extract element snippet for display
 */
function extractElementSnippet(fullMatch: string, maxLength: number = 60): string {
  if (fullMatch.length <= maxLength) {
    return fullMatch;
  }
  return fullMatch.substring(0, maxLength - 3) + '...';
}

/**
 * Check if an input has proper labeling
 */
function hasProperLabel(attributes: string, content: string, elementIndex: number): boolean {
  // Check for aria-label/aria-labelledby
  if (ARIA_LABEL_REGEX.test(attributes)) {
    return true;
  }

  // Check for title (acceptable but not ideal)
  if (TITLE_REGEX.test(attributes)) {
    return true;
  }

  // Check for id attribute and look for associated label
  const idMatch = attributes.match(ID_ATTR_REGEX);
  if (idMatch) {
    const id = idMatch[1];
    // Look for <label for="id"> or <label htmlFor="id"> in the content
    const labelForRegex = new RegExp(`<label[^>]*(?:for|htmlFor)\\s*=\\s*["']${id}["'][^>]*>`, 'i');
    if (labelForRegex.test(content)) {
      return true;
    }
  }

  // Check if input is wrapped in a label
  // Look backwards for <label> and forwards for </label>
  const beforeContent = content.substring(Math.max(0, elementIndex - 200), elementIndex);
  const afterContent = content.substring(elementIndex, Math.min(content.length, elementIndex + 200));

  // Simple check: is there a <label> before and </label> after?
  const hasLabelBefore = /<label[^>]*>\s*$/.test(beforeContent) || /<label[^>]*>[^<]*$/.test(beforeContent);
  const hasLabelAfter = /^\s*<\/label>/.test(afterContent) || /^[^<]*<\/label>/.test(afterContent);

  if (hasLabelBefore || hasLabelAfter) {
    return true;
  }

  return false;
}

/**
 * Check if input type requires a label
 */
function requiresLabel(attributes: string): boolean {
  const typeMatch = attributes.match(TYPE_ATTR_REGEX);
  const inputType = typeMatch ? typeMatch[1].toLowerCase() : 'text';

  // Hidden, submit, reset, button, image don't need labels
  if (NON_LABELABLE_TYPES.includes(inputType)) {
    return false;
  }

  return true;
}

/**
 * Check for missing form labels
 */
export function checkFormLabels(file: FileContent): Violation[] {
  const violations: Violation[] = [];

  // Only check JSX/TSX/HTML files
  if (!file.path.match(/\.[jt]sx?$|\.html?$/i)) {
    return violations;
  }

  // Check inputs
  let match: RegExpExecArray | null;
  const inputRegex = new RegExp(INPUT_REGEX.source, 'gi');

  while ((match = inputRegex.exec(file.content)) !== null) {
    const fullMatch = match[0];
    const attributes = match[1];

    if (requiresLabel(attributes) && !hasProperLabel(attributes, file.content, match.index)) {
      const location = getLocationFromIndex(file.content, match.index);
      const snippet = extractElementSnippet(fullMatch);
      const hasPlaceholder = PLACEHOLDER_REGEX.test(attributes);

      violations.push({
        rule: RULE_ID,
        severity: 'error',
        message: hasPlaceholder
          ? 'Input has placeholder but missing label (placeholder is not a label)'
          : 'Input missing associated label',
        file: file.path,
        line: location.line,
        column: location.column,
        found: snippet,
        suggestion: 'Add aria-label="..." or associate with <label>',
        fixable: false,
      });
    }
  }

  // Check textareas
  const textareaRegex = new RegExp(TEXTAREA_REGEX.source, 'gi');
  while ((match = textareaRegex.exec(file.content)) !== null) {
    const fullMatch = match[0];
    const attributes = match[1];

    if (!hasProperLabel(attributes, file.content, match.index)) {
      const location = getLocationFromIndex(file.content, match.index);
      const snippet = extractElementSnippet(fullMatch);

      violations.push({
        rule: RULE_ID,
        severity: 'error',
        message: 'Textarea missing associated label',
        file: file.path,
        line: location.line,
        column: location.column,
        found: snippet,
        suggestion: 'Add aria-label="..." or associate with <label>',
        fixable: false,
      });
    }
  }

  // Check selects
  const selectRegex = new RegExp(SELECT_REGEX.source, 'gi');
  while ((match = selectRegex.exec(file.content)) !== null) {
    const fullMatch = match[0];
    const attributes = match[1];

    if (!hasProperLabel(attributes, file.content, match.index)) {
      const location = getLocationFromIndex(file.content, match.index);
      const snippet = extractElementSnippet(fullMatch);

      violations.push({
        rule: RULE_ID,
        severity: 'error',
        message: 'Select missing associated label',
        file: file.path,
        line: location.line,
        column: location.column,
        found: snippet,
        suggestion: 'Add aria-label="..." or associate with <label>',
        fixable: false,
      });
    }
  }

  return violations;
}
