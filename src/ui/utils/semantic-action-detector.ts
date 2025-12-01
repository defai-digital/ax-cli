/**
 * Semantic Action Detector
 *
 * Detects high-level semantic actions from tool operations for compact grouping.
 * Inspired by Claude Code's approach to grouping related operations.
 */

import type { ChatEntry } from '../../agent/llm-agent.js';
import { isToolOperation } from './tool-grouper.js';

/**
 * Semantic action types that span multiple resources
 */
export enum SemanticAction {
  Exploring = 'exploring',      // Reading multiple files to understand code
  Searching = 'searching',      // Search + optional reads
  Implementing = 'implementing', // Creating/editing files
  Testing = 'testing',          // Running test commands
  Building = 'building',        // Build/compile commands
  Analyzing = 'analyzing',      // Architecture/validation analysis
  Refactoring = 'refactoring',  // Multiple edits across files
  Configuring = 'configuring',  // Config file operations
  Unknown = 'unknown',          // Fallback
}

/**
 * Action descriptions for display
 */
const ACTION_DESCRIPTIONS: Record<SemanticAction, string> = {
  [SemanticAction.Exploring]: 'Exploring codebase',
  [SemanticAction.Searching]: 'Searching',
  [SemanticAction.Implementing]: 'Implementing changes',
  [SemanticAction.Testing]: 'Running tests',
  [SemanticAction.Building]: 'Building project',
  [SemanticAction.Analyzing]: 'Analyzing codebase',
  [SemanticAction.Refactoring]: 'Refactoring code',
  [SemanticAction.Configuring]: 'Updating configuration',
  [SemanticAction.Unknown]: 'Working',
};

/**
 * Compatible action transitions that should be grouped together
 * Key = source action (from), Value = list of target actions it can transition TO
 */
const COMPATIBLE_TRANSITIONS: Record<SemanticAction, SemanticAction[]> = {
  [SemanticAction.Searching]: [SemanticAction.Exploring, SemanticAction.Searching],
  [SemanticAction.Exploring]: [SemanticAction.Exploring, SemanticAction.Implementing, SemanticAction.Refactoring, SemanticAction.Analyzing, SemanticAction.Configuring],
  [SemanticAction.Implementing]: [SemanticAction.Implementing, SemanticAction.Testing, SemanticAction.Building],
  [SemanticAction.Testing]: [SemanticAction.Testing, SemanticAction.Implementing],
  [SemanticAction.Building]: [SemanticAction.Building, SemanticAction.Implementing],
  [SemanticAction.Analyzing]: [SemanticAction.Analyzing, SemanticAction.Exploring],
  [SemanticAction.Refactoring]: [SemanticAction.Refactoring, SemanticAction.Exploring],
  [SemanticAction.Configuring]: [SemanticAction.Configuring, SemanticAction.Exploring],
  [SemanticAction.Unknown]: [],
};

/**
 * Test command patterns
 */
const TEST_PATTERNS = /\b(test|vitest|jest|mocha|pytest|cargo\s+test|go\s+test|npm\s+run\s+test|pnpm\s+test|yarn\s+test)\b/i;

/**
 * Build command patterns
 */
const BUILD_PATTERNS = /\b(build|tsc|webpack|vite\s+build|rollup|esbuild|npm\s+run\s+build|pnpm\s+build|cargo\s+build|go\s+build|make)\b/i;

/**
 * Config file patterns
 */
const CONFIG_FILE_PATTERNS = /\.(config|rc|json|yaml|yml|toml|env)$|package\.json|tsconfig|eslint|prettier/i;

/**
 * MCP tool name patterns for action inference (precompiled for performance)
 */
const MCP_EXPLORING_PATTERNS = /read|get|list|fetch/i;
const MCP_IMPLEMENTING_PATTERNS = /write|edit|update|create/i;
const MCP_SEARCHING_PATTERNS = /search|find|query/i;
const MCP_TESTING_PATTERNS = /test|check|validate/i;
const MCP_BUILDING_PATTERNS = /build|compile/i;

/**
 * Extract file path from tool arguments (handles multiple arg name conventions)
 */
function getFilePathFromArgs(args: Record<string, unknown>): string {
  return (args.path as string) || (args.file_path as string) || '';
}

/**
 * Check if file path is a config file
 */
function isConfigFile(filePath: string): boolean {
  return CONFIG_FILE_PATTERNS.test(filePath);
}

/**
 * Parse tool arguments safely with caching
 */
function parseToolArgs(entry: ChatEntry): Record<string, unknown> {
  const argsStr = entry.toolCall?.function?.arguments;
  if (!argsStr) return {};

  try {
    return JSON.parse(argsStr);
  } catch {
    return {};
  }
}

/**
 * Detect semantic action from a single tool call entry
 */
export function detectSingleAction(entry: ChatEntry): SemanticAction {
  if (!isToolOperation(entry)) {
    return SemanticAction.Unknown;
  }

  const toolName = entry.toolCall?.function?.name;
  if (!toolName) return SemanticAction.Unknown;

  const args = parseToolArgs(entry);

  // Search operations
  if (toolName === 'search') {
    return SemanticAction.Searching;
  }

  // Read operations
  if (toolName === 'view_file' || toolName === 'read_file') {
    return isConfigFile(getFilePathFromArgs(args)) ? SemanticAction.Configuring : SemanticAction.Exploring;
  }

  // Edit operations (str_replace_editor, multi_edit)
  if (toolName === 'str_replace_editor' || toolName === 'multi_edit') {
    return isConfigFile(getFilePathFromArgs(args)) ? SemanticAction.Configuring : SemanticAction.Implementing;
  }

  // Create operations
  if (toolName === 'create_file') {
    return isConfigFile(getFilePathFromArgs(args)) ? SemanticAction.Configuring : SemanticAction.Implementing;
  }

  // Bash operations - detect by command content
  if (toolName === 'bash' || toolName === 'execute_bash') {
    const command = (args.command as string) || '';

    if (TEST_PATTERNS.test(command)) {
      return SemanticAction.Testing;
    }

    if (BUILD_PATTERNS.test(command)) {
      return SemanticAction.Building;
    }

    return SemanticAction.Unknown;
  }

  // BUG FIX: Handle bash_output tool for background task monitoring
  // This tool checks output from background bash commands
  if (toolName === 'bash_output') {
    return SemanticAction.Unknown; // Will be grouped with parent bash action
  }

  // Analysis tools
  if (toolName === 'analyze_architecture' || toolName === 'validate_best_practices') {
    return SemanticAction.Analyzing;
  }

  // BUG FIX: Handle MCP tools by inferring action from tool name patterns
  if (toolName.startsWith('mcp__')) {
    // Extract the actual tool name part (mcp__server__toolname → toolname)
    const parts = toolName.split('__');
    const actualTool = parts.length >= 3 ? parts.slice(2).join('__') : '';

    // Infer action from MCP tool name patterns using precompiled regexes
    if (MCP_EXPLORING_PATTERNS.test(actualTool)) return SemanticAction.Exploring;
    if (MCP_IMPLEMENTING_PATTERNS.test(actualTool)) return SemanticAction.Implementing;
    if (MCP_SEARCHING_PATTERNS.test(actualTool)) return SemanticAction.Searching;
    if (MCP_TESTING_PATTERNS.test(actualTool)) return SemanticAction.Testing;
    if (MCP_BUILDING_PATTERNS.test(actualTool)) return SemanticAction.Building;
    // Default MCP operations to Unknown (they'll use resource-based grouping)
  }

  return SemanticAction.Unknown;
}

/**
 * Detect semantic action from a group of consecutive operations
 * Uses heuristics to determine the overall intent
 */
export function detectSemanticAction(entries: ChatEntry[]): SemanticAction {
  if (entries.length === 0) return SemanticAction.Unknown;
  if (entries.length === 1) return detectSingleAction(entries[0]);

  // Count actions
  const actionCounts = new Map<SemanticAction, number>();
  const toolNames = new Set<string>();

  for (const entry of entries) {
    const action = detectSingleAction(entry);
    actionCounts.set(action, (actionCounts.get(action) || 0) + 1);

    const toolName = entry.toolCall?.function?.name;
    if (toolName) toolNames.add(toolName);
  }

  // Check for specific patterns

  // Multiple reads without edits = Exploring
  const readCount = (actionCounts.get(SemanticAction.Exploring) || 0) +
                    (actionCounts.get(SemanticAction.Configuring) || 0);
  const editCount = actionCounts.get(SemanticAction.Implementing) || 0;
  const refactorCount = actionCounts.get(SemanticAction.Refactoring) || 0;

  if (readCount >= 2 && editCount === 0 && refactorCount === 0) {
    return SemanticAction.Exploring;
  }

  // Search followed by reads = Searching
  if (actionCounts.has(SemanticAction.Searching)) {
    return SemanticAction.Searching;
  }

  // Multiple edits across different files = Refactoring
  if (editCount >= 2) {
    // Check if edits are across different files
    const editPaths = new Set<string>();
    for (const entry of entries) {
      const toolName = entry.toolCall?.function?.name;
      // BUG FIX: Include multi_edit in refactoring detection
      if (toolName === 'str_replace_editor') {
        const args = parseToolArgs(entry);
        const filePath = (args.path as string) || (args.file_path as string) || '';
        if (filePath) editPaths.add(filePath);
      } else if (toolName === 'multi_edit') {
        // BUG FIX: multi_edit uses 'files' array, not single path
        const args = parseToolArgs(entry);
        const files = args.files as Array<{ path?: string; file_path?: string }> | undefined;
        if (Array.isArray(files)) {
          for (const file of files) {
            const filePath = file.path || file.file_path || '';
            if (filePath) editPaths.add(filePath);
          }
        } else {
          // Fallback to single path for old format
          const filePath = (args.path as string) || (args.file_path as string) || '';
          if (filePath) editPaths.add(filePath);
        }
      }
    }
    if (editPaths.size >= 2) {
      return SemanticAction.Refactoring;
    }
  }

  // Testing takes precedence
  if (actionCounts.has(SemanticAction.Testing)) {
    return SemanticAction.Testing;
  }

  // Building takes precedence
  if (actionCounts.has(SemanticAction.Building)) {
    return SemanticAction.Building;
  }

  // Implementing (edits/creates)
  if (editCount > 0 || actionCounts.has(SemanticAction.Implementing)) {
    return SemanticAction.Implementing;
  }

  // Analyzing
  if (actionCounts.has(SemanticAction.Analyzing)) {
    return SemanticAction.Analyzing;
  }

  // Configuring
  if (actionCounts.has(SemanticAction.Configuring)) {
    return SemanticAction.Configuring;
  }

  // Default to most common action
  let maxAction = SemanticAction.Unknown;
  let maxCount = 0;
  for (const [action, count] of actionCounts) {
    if (count > maxCount && action !== SemanticAction.Unknown) {
      maxCount = count;
      maxAction = action;
    }
  }

  return maxAction;
}

/**
 * Check if two actions are compatible for grouping
 */
export function isCompatibleTransition(from: SemanticAction, to: SemanticAction): boolean {
  if (from === to) return true;
  if (from === SemanticAction.Unknown || to === SemanticAction.Unknown) return false;

  // BUG FIX: Use nullish coalescing for safer fallback when action key doesn't exist
  const compatibleActions = COMPATIBLE_TRANSITIONS[from] ?? [];
  return compatibleActions.includes(to);
}

/**
 * Get human-readable description for an action
 */
export function getActionDescription(action: SemanticAction): string {
  return ACTION_DESCRIPTIONS[action] || ACTION_DESCRIPTIONS[SemanticAction.Unknown];
}

/**
 * Format action description with counts
 */
export function formatActionWithCounts(
  action: SemanticAction,
  counts: {
    reads: number;
    edits: number;
    creates: number;
    searches: number;
    commands: number;
    files: number;
  }
): string {
  const base = getActionDescription(action);
  const parts: string[] = [];

  // For exploring, show file count
  if (action === SemanticAction.Exploring || action === SemanticAction.Searching) {
    // BUG FIX: Show separate counts for reads and searches instead of mislabeling
    if (counts.reads > 0) {
      parts.push(`${counts.reads} read${counts.reads > 1 ? 's' : ''}`);
    }
    if (counts.searches > 0) {
      parts.push(`${counts.searches} search${counts.searches > 1 ? 'es' : ''}`);
    }
  }

  // For implementing/refactoring, show edits and creates
  if (action === SemanticAction.Implementing || action === SemanticAction.Refactoring) {
    if (counts.edits > 0) {
      parts.push(`${counts.edits} edit${counts.edits > 1 ? 's' : ''}`);
    }
    if (counts.creates > 0) {
      parts.push(`${counts.creates} create${counts.creates > 1 ? 's' : ''}`);
    }
  }

  // For testing/building, show command count
  if (action === SemanticAction.Testing || action === SemanticAction.Building) {
    if (counts.commands > 0) {
      parts.push(`${counts.commands} command${counts.commands > 1 ? 's' : ''}`);
    }
  }

  // For configuring, show file operations
  if (action === SemanticAction.Configuring) {
    const total = counts.reads + counts.edits + counts.creates;
    if (total > 0) {
      parts.push(`${total} file${total > 1 ? 's' : ''}`);
    }
  }

  // BUG FIX: For analyzing, show file count analyzed
  if (action === SemanticAction.Analyzing) {
    if (counts.files > 0) {
      parts.push(`${counts.files} file${counts.files > 1 ? 's' : ''}`);
    } else if (counts.reads > 0) {
      parts.push(`${counts.reads} file${counts.reads > 1 ? 's' : ''}`);
    }
  }

  // For unknown, show total operations
  if (action === SemanticAction.Unknown && parts.length === 0) {
    // BUG FIX: Include searches in total count
    const total = counts.reads + counts.edits + counts.creates + counts.commands + counts.searches;
    if (total > 0) {
      parts.push(`${total} operation${total > 1 ? 's' : ''}`);
    }
  }

  return parts.length > 0 ? `${base} (${parts.join(', ')})` : base;
}
