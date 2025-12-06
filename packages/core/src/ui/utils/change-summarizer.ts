/**
 * Change Summarizer
 * Extracts meaningful summaries from tool operations
 */

import type { ToolGroup } from './tool-grouper.js';

// Precompiled regexes for performance (avoid recompilation on each call)
const TYPE_ADDED_REGEX = /\+\s*type\b/;
const TYPE_UPDATED_REGEX = /\btype\s+\w/;
const API_REGEX = /\bapi\b/;
const MODEL_REGEX = /\bmodel\b/;
const HANDLER_REGEX = /\bhandler\b/;
const RENDER_REGEX = /\brender\b/;
const TODO_BRACKETS_REGEX = /\[.*?\]/g;

// Precompiled regexes for getBriefToolSummary (avoid recompilation on each call)
const REPLACED_REGEX = /replaced/gi;
const EDIT_COUNT_REGEX = /(\d+)\s*edit/i;
const EDIT_KEYWORDS_REGEX = /edit|applied|replaced|updated/gi;
const FOUND_MATCH_REGEX = /Found (\d+) match/;
const UPDATED_PREFIX_REGEX = /^Updated\s+/;

/**
 * Extract a human-readable summary from a group of tool operations
 *
 * @param group - Tool group to summarize
 * @returns Summary string or null if no meaningful summary
 */
export function summarizeChanges(group: ToolGroup): string | null {
  // Only summarize file operations with updates
  if (group.groupType !== 'file') {
    return null;
  }

  // BUG FIX: Include multi_edit tool in change summarization
  const updates = group.operations.filter(
    (op) => (op.toolCall?.function?.name === 'str_replace_editor' || op.toolCall?.function?.name === 'multi_edit') && op.toolResult?.success
  );

  if (updates.length === 0) {
    return null;
  }

  // Collect all change patterns
  const patterns: Set<string> = new Set();

  for (const update of updates) {
    const content = update.content || update.toolResult?.output || '';
    const detectedPatterns = detectChangePatterns(content);
    detectedPatterns.forEach((p) => patterns.add(p));
  }

  // If no patterns detected, return generic summary
  if (patterns.size === 0) {
    return updates.length === 1 ? 'modified' : `${updates.length} changes`;
  }

  // Format patterns into readable summary
  const patternArray = Array.from(patterns);

  // Limit to 3 most significant patterns
  const topPatterns = patternArray.slice(0, 3);

  return topPatterns.join(', ');
}

/**
 * Detect change patterns from diff content
 *
 * @param content - Tool result content (usually a diff)
 * @returns Array of detected change descriptions
 */
function detectChangePatterns(content: string): string[] {
  const patterns: string[] = [];

  if (!content) return patterns;

  const lower = content.toLowerCase();

  // Function/method changes - check all patterns independently to catch combined changes
  const hasAddedFunctions = lower.includes('+function') || lower.includes('+const ') || lower.includes('+export function');
  const hasRemovedFunctions = lower.includes('-function') || lower.includes('-const ') || lower.includes('-export function');

  if (hasAddedFunctions && hasRemovedFunctions) {
    patterns.push('modified functions');
  } else if (hasAddedFunctions) {
    patterns.push('added functions');
  } else if (hasRemovedFunctions) {
    patterns.push('removed functions');
  } else if (lower.includes('function') || lower.includes('const ')) {
    patterns.push('updated functions');
  }

  // Import changes - check independently
  const hasAddedImports = lower.includes('+import') || lower.includes('+require');
  const hasRemovedImports = lower.includes('-import') || lower.includes('-require');

  if (hasAddedImports && hasRemovedImports) {
    patterns.push('reorganized imports');
  } else if (hasAddedImports) {
    patterns.push('added imports');
  } else if (hasRemovedImports) {
    patterns.push('removed imports');
  }

  // Type/interface changes
  // BUG FIX: Use word boundary for 'type' to avoid matching 'prototype', 'typeof', etc.
  if (lower.includes('+interface') || TYPE_ADDED_REGEX.test(lower) || lower.includes('+class ')) {
    patterns.push('added types');
  } else if (lower.includes('interface') || TYPE_UPDATED_REGEX.test(lower)) {
    patterns.push('updated types');
  }

  // Error handling
  if (lower.includes('+try') || lower.includes('+catch') || lower.includes('+throw')) {
    patterns.push('improved error handling');
  } else if (lower.includes('error') || lower.includes('catch')) {
    patterns.push('updated error handling');
  }

  // Documentation
  if (lower.includes('+//') || lower.includes('+/*') || lower.includes('+*')) {
    patterns.push('added documentation');
  }

  // Tests
  if (lower.includes('+test(') || lower.includes('+it(') || lower.includes('+describe(')) {
    patterns.push('added tests');
  } else if (lower.includes('test(') || lower.includes('it(') || lower.includes('describe(')) {
    patterns.push('updated tests');
  }

  // Configuration
  // BUG FIX: Be more specific about config files - .json is too broad (matches data.json, etc.)
  if (lower.includes('package.json') || lower.includes('tsconfig') || lower.includes('.eslintrc') ||
      lower.includes('.prettierrc') || lower.includes('config.json') || lower.includes('.env')) {
    patterns.push('updated configuration');
  }

  // API/endpoints - BUG FIX: Use word boundary regex to avoid false positives like "capacity"
  if (API_REGEX.test(lower) || lower.includes('endpoint') || lower.includes('router') || HANDLER_REGEX.test(lower)) {
    patterns.push('modified API');
  }

  // Database/models - BUG FIX: Use word boundary regex to avoid false positives like "remodel"
  if (lower.includes('schema') || MODEL_REGEX.test(lower) || lower.includes('migration') || lower.includes('database')) {
    patterns.push('updated database schema');
  }

  // UI/components - BUG FIX: Use word boundary regex to avoid false positives like "surrender"
  if (lower.includes('component') || RENDER_REGEX.test(lower) || lower.includes('jsx') || lower.includes('tsx')) {
    patterns.push('updated UI components');
  }

  // Security
  if (lower.includes('auth') || lower.includes('permission') || lower.includes('token') || lower.includes('security')) {
    patterns.push('updated security');
  }

  // Performance
  if (lower.includes('cache') || lower.includes('optimize') || lower.includes('performance')) {
    patterns.push('improved performance');
  }

  // Refactoring
  // BUG FIX: Use proper diff line marker patterns (line starts with - or +) instead of
  // just checking for any hyphen/plus which matches things like "UTF-8", "log+error"
  const hasDiffRemovals = /^-[^-]/m.test(content) || lower.includes('\n-');
  const hasDiffAdditions = /^\+[^+]/m.test(content) || lower.includes('\n+');
  if (lower.includes('refactor') || (hasDiffRemovals && hasDiffAdditions && patterns.length === 0)) {
    patterns.push('refactored code');
  }

  return patterns;
}

/**
 * Get a brief summary for individual tool results (used in concise mode)
 *
 * @param content - Tool result content
 * @param toolName - Name of the tool that was executed
 * @returns Brief summary string
 */
export function getBriefToolSummary(content: string, toolName: string): string {
  if (!content) return '';

  // BUG FIX: Empty string split returns [""] with length 1, check for empty first
  const lineCount = content.trim() ? content.split('\n').length : 0;

  switch (toolName) {
    case 'view_file':
    case 'read_file':  // BUG FIX: Handle read_file same as view_file
      if (lineCount === 1) return '1 line';
      // BUG FIX: Removed redundant lineCount < 100 check (same output as < 10)
      // Files with 500+ lines are considered large
      if (lineCount < 500) return `${lineCount} lines`;
      return `${lineCount} lines (large)`;

    case 'create_file':
      // BUG FIX: Handle empty file case
      if (lineCount === 0) return 'empty file';
      if (lineCount === 1) return '1 line written';
      return `${lineCount} lines written`;

    case 'str_replace_editor':
      // Extract first line summary
      // BUG FIX: Find first non-empty line instead of assuming [0] is meaningful
      const firstLine = content.split('\n').find(line => line.trim()) || '';
      if (firstLine.includes('Updated')) {
        return firstLine.replace(UPDATED_PREFIX_REGEX, '').trim();
      }
      // Count replacements
      const replacements = (content.match(REPLACED_REGEX) || []).length;
      if (replacements > 0) {
        return `${replacements} change${replacements > 1 ? 's' : ''}`;
      }
      return 'updated';

    case 'multi_edit':
      // BUG FIX: Added multi_edit tool summary handling
      // Try to extract edit count from output like "3 edits applied" or "Applied 3 edits"
      const countMatch = content.match(EDIT_COUNT_REGEX);
      if (countMatch) {
        const count = parseInt(countMatch[1], 10);
        if (!Number.isNaN(count) && count > 0) {
          return `${count} edit${count > 1 ? 's' : ''}`;
        }
      }
      // Fallback: count occurrences of edit-related keywords
      const editMatches = content.match(EDIT_KEYWORDS_REGEX) || [];
      if (editMatches.length > 0) {
        return 'multi-edit applied';
      }
      return 'applied';

    case 'bash':
    case 'execute_bash':  // BUG FIX: Handle execute_bash same as bash
      if (content.includes('Background task started')) {
        return '→ background';
      }
      // Detect common patterns
      if (content.includes('npm install') || content.includes('added ')) {
        return 'installed';
      }
      if (content.includes('git commit')) {
        return 'committed';
      }
      if (content.includes('git push')) {
        return 'pushed';
      }
      if (content.includes('Test passed') || content.includes('✓')) {
        return 'passed';
      }
      if (lineCount <= 1) {
        // BUG FIX: Compare trimmed length with sliced length for consistent ellipsis
        const trimmed = content.trim();
        return trimmed.slice(0, 40) + (trimmed.length > 40 ? '...' : '');
      }
      return `${lineCount} lines`;

    case 'search':
      const matches = content.match(FOUND_MATCH_REGEX);
      if (matches) {
        const count = parseInt(matches[1], 10);
        // BUG FIX: Handle NaN from invalid parse
        if (!Number.isNaN(count)) {
          return `${count} match${count !== 1 ? 'es' : ''}`;
        }
      }
      return `${lineCount} result${lineCount !== 1 ? 's' : ''}`;

    case 'create_todo_list':
    case 'update_todo_list':
      const todos = (content.match(TODO_BRACKETS_REGEX) || []).length;
      return `${todos} task${todos !== 1 ? 's' : ''}`;

    default:
      // BUG FIX: Handle MCP tools with informative summaries
      if (toolName.startsWith('mcp__')) {
        // Extract server and tool name for context
        const parts = toolName.split('__');
        const serverName = parts[1] || 'mcp';

        // Try to provide meaningful summary based on content
        if (lineCount === 1) {
          const trimmedContent = content.trim();
          if (trimmedContent.length <= 50) {
            return trimmedContent || 'completed';
          }
          return trimmedContent.slice(0, 47) + '...';
        }
        if (lineCount <= 5) {
          return `${lineCount} lines`;
        }
        return `${serverName}: ${lineCount} lines`;
      }
      if (lineCount <= 1 && content.length < 60) {
        // BUG FIX: Check if trimmed result is non-empty to avoid returning ""
        // for whitespace-only content which would display nothing
        const trimmed = content.trim();
        if (trimmed) {
          return trimmed;
        }
      }
      // BUG FIX: Handle 0 lines case more gracefully
      if (lineCount === 0) {
        return 'completed';
      }
      return `${lineCount} lines`;
  }
}
