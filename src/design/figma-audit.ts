/**
 * Figma Design Audit
 *
 * Rule-based audit system for checking design consistency,
 * accessibility, and best practices.
 *
 * @module design/figma-audit
 */

import type {
  AuditRule,
  AuditRuleId,
  AuditResult,
  AuditSummary,
  AuditIssue,
  AuditSeverity,
} from '@ax-cli/schemas';

import type { SimplifiedNode, MapResult } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Audit configuration options (input type with optional fields)
 */
interface AuditConfigInput {
  rules?: AuditRuleId[];
  excludeRules?: AuditRuleId[];
  ruleConfig?: Record<AuditRuleId, { enabled?: boolean; severity?: AuditSeverity; options?: Record<string, unknown> }>;
  maxDepth?: number;
  failOnError?: boolean;
  failOnWarning?: boolean;
  includeHidden?: boolean;
  tokensPath?: string;
}

interface AuditContext {
  fileKey: string;
  fileName?: string;
  config: AuditConfigInput;
  rules: AuditRule[];
  issues: AuditIssue[];
  nodesAudited: number;
  startTime: number;
}

type RuleChecker = (
  node: SimplifiedNode,
  context: AuditContext,
  path: string[]
) => AuditIssue[];

// =============================================================================
// Generic Layer Naming Patterns
// =============================================================================

const GENERIC_NAMES = [
  /^Frame \d+$/i,
  /^Rectangle \d+$/i,
  /^Ellipse \d+$/i,
  /^Line \d+$/i,
  /^Group \d+$/i,
  /^Vector \d+$/i,
  /^Text$/i,
  /^Image \d*$/i,
  /^Component \d+$/i,
  /^Instance$/i,
  /^Polygon \d+$/i,
  /^Star \d+$/i,
  /^Boolean \d+$/i,
];

// =============================================================================
// Rule Implementations
// =============================================================================

/**
 * Check for generic layer names
 *
 * BUG FIX: Reset lastIndex before each regex test to handle global regexes safely.
 * Global regexes maintain lastIndex state between test() calls which can cause
 * flaky results when patterns are reused across multiple nodes.
 */
function checkLayerNaming(
  node: SimplifiedNode,
  _context: AuditContext,
  path: string[]
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // BUG FIX: Reset lastIndex to avoid stateful behavior with global regexes
  const isGeneric = GENERIC_NAMES.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(node.name);
  });

  if (isGeneric) {
    issues.push(createIssue(
      'layer-naming',
      'info',
      `Generic layer name "${node.name}" - consider using a descriptive name`,
      node,
      path,
      { suggestion: 'Rename to describe the layer\'s purpose (e.g., "Hero Section", "Primary Button")' }
    ));
  }

  return issues;
}

/**
 * Check for missing auto-layout on frames with multiple children
 */
function checkMissingAutoLayout(
  node: SimplifiedNode,
  _context: AuditContext,
  path: string[]
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // Only check frames
  if (node.type !== 'FRAME' && node.type !== 'COMPONENT') {
    return issues;
  }

  // Check if it has children but no auto-layout
  const childCount = node.children?.length ?? 0;
  if (childCount >= 2 && !node.hasAutoLayout) {
    issues.push(createIssue(
      'missing-autolayout',
      'info',
      `Frame "${node.name}" has ${childCount} children but no auto-layout`,
      node,
      path,
      { suggestion: 'Consider adding auto-layout for responsive design' }
    ));
  }

  return issues;
}

/**
 * Check naming conventions
 */
function checkNamingConvention(
  node: SimplifiedNode,
  _context: AuditContext,
  path: string[]
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // Check components follow PascalCase
  if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
    const isPascalCase = /^[A-Z][a-zA-Z0-9]*(\s[A-Z][a-zA-Z0-9]*)*$/.test(node.name);
    if (!isPascalCase && !node.name.includes('/')) {
      issues.push(createIssue(
        'naming-convention',
        'info',
        `Component "${node.name}" doesn't follow PascalCase naming`,
        node,
        path,
        { suggestion: 'Use PascalCase for components (e.g., "PrimaryButton", "Card Header")' }
      ));
    }
  }

  // Check for very short names (likely meaningless)
  if (node.name.length === 1 && node.type !== 'TEXT') {
    issues.push(createIssue(
      'naming-convention',
      'info',
      `Very short layer name "${node.name}" - likely needs more context`,
      node,
      path,
      { suggestion: 'Use descriptive names that explain the layer\'s purpose' }
    ));
  }

  return issues;
}

/**
 * Check for potential text overflow issues
 */
function checkTextOverflow(
  node: SimplifiedNode,
  _context: AuditContext,
  path: string[]
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // Only check text nodes
  if (node.type !== 'TEXT') {
    return issues;
  }

  // Check for truncated text (indicated by ...)
  if (node.characters && node.characters.endsWith('...')) {
    issues.push(createIssue(
      'text-overflow',
      'warning',
      `Text "${node.name}" may be truncated`,
      node,
      path,
      {
        suggestion: 'Check if text overflow is intentional or if container needs resizing',
        actual: node.characters,
      }
    ));
  }

  return issues;
}

/**
 * Check component usage (prefer instances over detached)
 */
function checkComponentUsage(
  node: SimplifiedNode,
  _context: AuditContext,
  path: string[]
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // Check for frames that might be better as component instances
  if (node.type === 'FRAME' && node.children) {
    // Look for patterns that suggest this should be a component
    const childNames = node.children.map((c) => c.name);
    const hasButtonPattern = childNames.some((n) =>
      /button|btn|cta/i.test(n)
    );
    const hasCardPattern = childNames.some((n) =>
      /title|description|image|content/i.test(n)
    );

    if (hasButtonPattern || hasCardPattern) {
      // Check if parent path suggests this is already a component
      const isComponent = path.some((p) =>
        /component|instance/i.test(p)
      );

      if (!isComponent && !node.componentKey) {
        issues.push(createIssue(
          'component-usage',
          'info',
          `Frame "${node.name}" has common component patterns - consider making it a component`,
          node,
          path,
          { suggestion: 'Convert to component for reusability and consistency' }
        ));
      }
    }
  }

  return issues;
}

/**
 * Check spacing consistency (basic check for common values)
 */
function checkSpacingConsistency(
  _node: SimplifiedNode,
  _context: AuditContext,
  _path: string[]
): AuditIssue[] {
  // This is a simplified check - full implementation would need
  // actual spacing values from the Figma API
  // For MVP, we just note frames without auto-layout padding
  return [];
}

/**
 * Check font consistency
 */
function checkFontConsistency(
  _node: SimplifiedNode,
  _context: AuditContext,
  _path: string[]
): AuditIssue[] {
  // Font consistency requires style information from the API
  // For MVP, this is a placeholder
  return [];
}

/**
 * Check token usage
 */
function checkTokenUsage(
  _node: SimplifiedNode,
  _context: AuditContext,
  _path: string[]
): AuditIssue[] {
  // Token usage requires variable bindings from the API
  // For MVP, this is a placeholder
  return [];
}

/**
 * Check color contrast
 */
function checkColorContrast(
  _node: SimplifiedNode,
  _context: AuditContext,
  _path: string[]
): AuditIssue[] {
  // Color contrast requires color values from the API
  // For MVP, this is a placeholder
  return [];
}

/**
 * Check image resolution
 */
function checkImageResolution(
  _node: SimplifiedNode,
  _context: AuditContext,
  _path: string[]
): AuditIssue[] {
  // Image resolution requires image API calls
  // Disabled by default
  return [];
}

// =============================================================================
// Rule Registry
// =============================================================================

const RULE_CHECKERS: Record<AuditRuleId, RuleChecker> = {
  'layer-naming': checkLayerNaming,
  'missing-autolayout': checkMissingAutoLayout,
  'naming-convention': checkNamingConvention,
  'text-overflow': checkTextOverflow,
  'component-usage': checkComponentUsage,
  'spacing-consistency': checkSpacingConsistency,
  'font-consistency': checkFontConsistency,
  'token-usage': checkTokenUsage,
  'color-contrast': checkColorContrast,
  'image-resolution': checkImageResolution,
};

// =============================================================================
// Helper Functions
// =============================================================================

function createIssue(
  ruleId: AuditRuleId,
  severity: AuditSeverity,
  message: string,
  node: SimplifiedNode,
  path: string[],
  extras: Partial<AuditIssue> = {}
): AuditIssue {
  return {
    ruleId,
    severity,
    message,
    location: {
      nodeId: node.id,
      nodeName: node.name,
      nodePath: path.join(' > '),
      nodeType: node.type,
    },
    ...extras,
  };
}

function getEnabledRules(config: AuditConfigInput): AuditRule[] {
  // Import DEFAULT_AUDIT_RULES at runtime to avoid circular deps
  const defaultRules: AuditRule[] = [
    { id: 'layer-naming', name: 'Layer Naming', description: 'Check for generic layer names', severity: 'info', category: 'naming', enabled: true },
    { id: 'missing-autolayout', name: 'Missing Auto-Layout', description: 'Identify frames without auto-layout', severity: 'info', category: 'best-practices', enabled: true },
    { id: 'naming-convention', name: 'Naming Convention', description: 'Check naming conventions', severity: 'info', category: 'naming', enabled: true },
    { id: 'text-overflow', name: 'Text Overflow', description: 'Detect text overflow issues', severity: 'warning', category: 'best-practices', enabled: true },
    { id: 'component-usage', name: 'Component Usage', description: 'Check component usage patterns', severity: 'info', category: 'best-practices', enabled: true },
    { id: 'spacing-consistency', name: 'Spacing Consistency', description: 'Check spacing values', severity: 'warning', category: 'consistency', enabled: true },
    { id: 'font-consistency', name: 'Font Consistency', description: 'Check font consistency', severity: 'warning', category: 'consistency', enabled: true },
    { id: 'token-usage', name: 'Token Usage', description: 'Check token usage', severity: 'warning', category: 'consistency', enabled: true },
    { id: 'color-contrast', name: 'Color Contrast', description: 'Check color contrast', severity: 'error', category: 'accessibility', enabled: true },
    { id: 'image-resolution', name: 'Image Resolution', description: 'Check image resolution', severity: 'warning', category: 'performance', enabled: false },
  ];

  let rules = [...defaultRules];

  // Filter to only requested rules
  if (config.rules && config.rules.length > 0) {
    rules = rules.filter((r) => config.rules!.includes(r.id));
  }

  // Exclude specified rules
  if (config.excludeRules && config.excludeRules.length > 0) {
    rules = rules.filter((r) => !config.excludeRules!.includes(r.id));
  }

  // Apply rule overrides
  if (config.ruleConfig) {
    rules = rules.map((rule) => {
      const override = config.ruleConfig?.[rule.id];
      if (override) {
        return {
          ...rule,
          enabled: override.enabled ?? rule.enabled,
          severity: override.severity ?? rule.severity,
        };
      }
      return rule;
    });
  }

  // Return only enabled rules
  return rules.filter((r) => r.enabled);
}

// =============================================================================
// Main Audit Function
// =============================================================================

/**
 * Audit a Figma file/node for design issues
 */
export function auditDesign(
  mapResult: MapResult,
  config: AuditConfigInput = {}
): AuditResult {
  const startTime = Date.now();
  const enabledRules = getEnabledRules(config);

  const context: AuditContext = {
    fileKey: mapResult.fileKey,
    fileName: mapResult.fileName,
    config,
    rules: enabledRules,
    issues: [],
    nodesAudited: 0,
    startTime,
  };

  // Traverse and audit
  auditNode(mapResult.root, context, [], 0);

  // Build summary
  const issueCount = {
    error: context.issues.filter((i) => i.severity === 'error').length,
    warning: context.issues.filter((i) => i.severity === 'warning').length,
    info: context.issues.filter((i) => i.severity === 'info').length,
    total: context.issues.length,
  };

  const summary: AuditSummary = {
    totalNodes: mapResult.nodeCount,
    nodesAudited: context.nodesAudited,
    issueCount,
    passRate: context.nodesAudited > 0
      ? Math.round(((context.nodesAudited - issueCount.total) / context.nodesAudited) * 100 * 100) / 100
      : 100,
    rulesRun: enabledRules.map((r) => r.id),
    duration: Date.now() - startTime,
  };

  return {
    fileKey: mapResult.fileKey,
    fileName: mapResult.fileName,
    timestamp: new Date().toISOString(),
    summary,
    issues: context.issues,
  };
}

/**
 * Recursively audit a node and its children
 */
function auditNode(
  node: SimplifiedNode,
  context: AuditContext,
  path: string[],
  depth: number
): void {
  // Check depth limit
  if (context.config.maxDepth !== undefined && depth > context.config.maxDepth) {
    return;
  }

  context.nodesAudited++;
  const currentPath = [...path, node.name];

  // Run each enabled rule
  for (const rule of context.rules) {
    const checker = RULE_CHECKERS[rule.id];
    if (checker) {
      const issues = checker(node, context, currentPath);
      // Apply rule severity override
      const processedIssues = issues.map((issue) => ({
        ...issue,
        severity: rule.severity, // Use rule's severity (may be overridden)
      }));
      context.issues.push(...processedIssues);
    }
  }

  // Recurse into children
  if (node.children) {
    for (const child of node.children) {
      auditNode(child, context, currentPath, depth + 1);
    }
  }
}

// =============================================================================
// Output Formatting
// =============================================================================

/**
 * Format audit result for terminal display
 */
export function formatAuditResult(result: AuditResult): string {
  const lines: string[] = [];

  // Header
  lines.push('Design Audit Report');
  lines.push('===================');
  lines.push(`File: ${result.fileName ?? result.fileKey}`);
  lines.push(`Timestamp: ${result.timestamp}`);
  lines.push('');

  // Summary
  lines.push('Summary');
  lines.push('-------');
  lines.push(`Nodes audited: ${result.summary.nodesAudited}/${result.summary.totalNodes}`);
  lines.push(`Rules run: ${result.summary.rulesRun.length}`);
  lines.push(`Duration: ${result.summary.duration}ms`);
  lines.push('');
  lines.push(`Issues: ${result.summary.issueCount.total}`);
  lines.push(`  Errors: ${result.summary.issueCount.error}`);
  lines.push(`  Warnings: ${result.summary.issueCount.warning}`);
  lines.push(`  Info: ${result.summary.issueCount.info}`);
  lines.push('');
  lines.push(`Pass Rate: ${result.summary.passRate}%`);
  lines.push('');

  // Issues by severity
  if (result.issues.length > 0) {
    lines.push('Issues');
    lines.push('------');

    // Group by severity
    const byRule = new Map<string, AuditIssue[]>();
    for (const issue of result.issues) {
      const existing = byRule.get(issue.ruleId) ?? [];
      existing.push(issue);
      byRule.set(issue.ruleId, existing);
    }

    for (const [ruleId, issues] of byRule) {
      lines.push('');
      lines.push(`[${ruleId}] (${issues.length} issue${issues.length === 1 ? '' : 's'})`);

      for (const issue of issues.slice(0, 10)) {
        const severityIcon = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '!' : '•';
        lines.push(`  ${severityIcon} ${issue.message}`);
        lines.push(`    Path: ${issue.location.nodePath}`);
        lines.push(`    Node ID: ${issue.location.nodeId}`);
        if (issue.suggestion) {
          lines.push(`    Suggestion: ${issue.suggestion}`);
        }
      }

      if (issues.length > 10) {
        lines.push(`  ... and ${issues.length - 10} more`);
      }
    }
  } else {
    lines.push('No issues found!');
  }

  return lines.join('\n');
}

/**
 * Format audit result as compact summary
 */
export function formatAuditSummary(result: AuditResult): string {
  const { summary } = result;
  const status = summary.issueCount.error > 0
    ? 'FAILED'
    : summary.issueCount.warning > 0
      ? 'WARNINGS'
      : 'PASSED';

  return `[${status}] ${summary.nodesAudited} nodes, ${summary.issueCount.total} issues (${summary.issueCount.error} errors, ${summary.issueCount.warning} warnings, ${summary.issueCount.info} info) - ${summary.passRate}% pass rate`;
}
