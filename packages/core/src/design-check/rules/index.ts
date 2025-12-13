/**
 * Rule Runner
 * Orchestrates running all design check rules on files
 */

import type {
  FileContent,
  Violation,
  DesignCheckConfig,
  RuleDefinition,
  Severity,
} from '../types.js';
import { filterIgnoredViolations } from '../scanner.js';
import { checkColors, RULE_ID as COLORS_RULE_ID } from './colors.js';
import { checkSpacing, RULE_ID as SPACING_RULE_ID } from './spacing.js';
import { checkAltText, RULE_ID as ALT_TEXT_RULE_ID } from './alt-text.js';
import { checkFormLabels, RULE_ID as FORM_LABELS_RULE_ID } from './form-labels.js';
import { checkInlineStyles, RULE_ID as INLINE_STYLES_RULE_ID } from './inline-styles.js';

/**
 * All available rules
 */
export const RULES: RuleDefinition[] = [
  {
    id: COLORS_RULE_ID,
    description: 'Detects hardcoded color values that should use design tokens',
    defaultSeverity: 'error',
    fixable: true,
    check: checkColors,
  },
  {
    id: SPACING_RULE_ID,
    description: 'Detects raw pixel values that should use spacing tokens',
    defaultSeverity: 'warning',
    fixable: true,
    check: checkSpacing,
  },
  {
    id: ALT_TEXT_RULE_ID,
    description: 'Detects images without alt attributes',
    defaultSeverity: 'error',
    fixable: false,
    check: (file) => checkAltText(file),
  },
  {
    id: FORM_LABELS_RULE_ID,
    description: 'Detects form inputs without associated labels',
    defaultSeverity: 'error',
    fixable: false,
    check: (file) => checkFormLabels(file),
  },
  {
    id: INLINE_STYLES_RULE_ID,
    description: 'Detects inline style props',
    defaultSeverity: 'warning',
    fixable: false,
    check: (file) => checkInlineStyles(file),
  },
];

/**
 * Get rule by ID
 */
export function getRule(ruleId: string): RuleDefinition | undefined {
  return RULES.find((r) => r.id === ruleId);
}

/**
 * Get all rule IDs
 */
export function getAllRuleIds(): string[] {
  return RULES.map((r) => r.id);
}

/**
 * Get effective severity for a rule based on config
 */
function getEffectiveSeverity(
  ruleId: string,
  config: DesignCheckConfig
): Severity | null {
  const setting = config.rules[ruleId];

  if (setting === 'off') {
    return null;
  }

  if (setting === 'warn') {
    return 'warning';
  }

  return 'error';
}

/**
 * Run all enabled rules on a file
 */
export function runRules(
  file: FileContent,
  config: DesignCheckConfig,
  specificRule?: string
): Violation[] {
  const allViolations: Violation[] = [];

  // Determine which rules to run
  const rulesToRun = specificRule
    ? RULES.filter((r) => r.id === specificRule)
    : RULES;

  for (const rule of rulesToRun) {
    // Check if rule is enabled
    const severity = getEffectiveSeverity(rule.id, config);
    if (severity === null) {
      continue;
    }

    try {
      // Run the rule
      const violations = rule.check(file, config);

      // Adjust severity based on config
      const adjustedViolations = violations.map((v) => ({
        ...v,
        severity,
      }));

      allViolations.push(...adjustedViolations);
    } catch (error) {
      // Log error but continue with other rules
      console.warn(`Error running rule ${rule.id} on ${file.path}:`, error);
    }
  }

  // Filter out violations with ignore comments
  const filteredViolations = filterIgnoredViolations(allViolations, file.lines);

  return filteredViolations;
}

/**
 * Run rules on multiple files
 */
export async function runRulesOnFiles(
  files: FileContent[],
  config: DesignCheckConfig,
  specificRule?: string
): Promise<Map<string, Violation[]>> {
  const results = new Map<string, Violation[]>();

  for (const file of files) {
    const violations = runRules(file, config, specificRule);
    results.set(file.path, violations);
  }

  return results;
}

// Re-export individual rule checkers for direct access
export { checkColors } from './colors.js';
export { checkSpacing } from './spacing.js';
export { checkAltText } from './alt-text.js';
export { checkFormLabels } from './form-labels.js';
export { checkInlineStyles } from './inline-styles.js';
