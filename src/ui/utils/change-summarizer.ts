/**
 * Change Summarizer
 * Extracts meaningful summaries from tool operations
 */

import type { ToolGroup } from './tool-grouper.js';

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

  const updates = group.operations.filter(
    (op) => op.toolCall?.function?.name === 'str_replace_editor' && op.toolResult?.success
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

  // Function/method changes
  if (lower.includes('+function') || lower.includes('+const ') || lower.includes('+export function')) {
    patterns.push('added functions');
  } else if (lower.includes('-function') || lower.includes('-const ') || lower.includes('-export function')) {
    patterns.push('removed functions');
  } else if (lower.includes('function') || lower.includes('const ')) {
    patterns.push('updated functions');
  }

  // Import changes
  if (lower.includes('+import') || lower.includes('+require')) {
    patterns.push('added imports');
  } else if (lower.includes('-import') || lower.includes('-require')) {
    patterns.push('removed imports');
  }

  // Type/interface changes
  if (lower.includes('+interface') || lower.includes('+type ') || lower.includes('+class ')) {
    patterns.push('added types');
  } else if (lower.includes('interface') || lower.includes('type ')) {
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
  if (lower.includes('package.json') || lower.includes('tsconfig') || lower.includes('.json')) {
    patterns.push('updated configuration');
  }

  // API/endpoints
  if (lower.includes('api') || lower.includes('endpoint') || lower.includes('router') || lower.includes('handler')) {
    patterns.push('modified API');
  }

  // Database/models
  if (lower.includes('schema') || lower.includes('model') || lower.includes('migration') || lower.includes('database')) {
    patterns.push('updated database schema');
  }

  // UI/components
  if (lower.includes('component') || lower.includes('render') || lower.includes('jsx') || lower.includes('tsx')) {
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
  if (lower.includes('refactor') || (lower.includes('-') && lower.includes('+') && patterns.length === 0)) {
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

  const lineCount = content.split('\n').length;

  switch (toolName) {
    case 'view_file':
      if (lineCount === 1) return '1 line';
      if (lineCount < 10) return `${lineCount} lines`;
      if (lineCount < 100) return `${lineCount} lines`;
      return `${lineCount} lines (large)`;

    case 'create_file':
      return `${lineCount} lines written`;

    case 'str_replace_editor':
      // Extract first line summary
      const firstLine = content.split('\n')[0];
      if (firstLine.includes('Updated')) {
        return firstLine.replace(/^Updated\s+/, '').trim();
      }
      // Count replacements
      const replacements = (content.match(/replaced/gi) || []).length;
      if (replacements > 0) {
        return `${replacements} change${replacements > 1 ? 's' : ''}`;
      }
      return 'updated';

    case 'bash':
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
        return content.trim().slice(0, 40) + (content.length > 40 ? '...' : '');
      }
      return `${lineCount} lines`;

    case 'search':
      const matches = content.match(/Found (\d+) match/);
      if (matches) {
        const count = parseInt(matches[1], 10);
        return `${count} match${count !== 1 ? 'es' : ''}`;
      }
      return `${lineCount} result${lineCount !== 1 ? 's' : ''}`;

    case 'create_todo_list':
    case 'update_todo_list':
      const todos = (content.match(/\[.*?\]/g) || []).length;
      return `${todos} task${todos !== 1 ? 's' : ''}`;

    default:
      if (lineCount <= 1 && content.length < 60) {
        return content.trim();
      }
      return `${lineCount} lines`;
  }
}
