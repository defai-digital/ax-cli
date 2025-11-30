/**
 * Tool Grouping Utilities
 * Groups consecutive tool operations for cleaner UX in quiet mode
 *
 * Supports two grouping modes:
 * 1. Resource-based: Groups operations on the same file/resource (original)
 * 2. Semantic: Groups operations by intent (Claude Code-style "Exploring codebase (12 reads)")
 */

import type { ChatEntry } from '../../agent/llm-agent.js';
import { UI_CONFIG, CACHE_CONFIG } from '../../constants.js';
import {
  SemanticAction,
  detectSingleAction,
  detectSemanticAction,
  isCompatibleTransition,
  formatActionWithCounts,
} from './semantic-action-detector.js';

// Re-export SemanticAction for consumers
export { SemanticAction } from './semantic-action-detector.js';

/**
 * Simple hash function for cache key fallback
 * Uses djb2 algorithm - fast and produces reasonable distribution
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return (hash >>> 0).toString(16); // Convert to unsigned and hex
}

/**
 * Cache for parsed tool arguments to avoid redundant JSON.parse calls
 * Key: toolCall.id (unique per tool call)
 * Value: Parsed arguments object
 */
const parsedArgsCache = new Map<string, Record<string, unknown>>();

/**
 * Clear the parsed arguments cache
 * Useful when chat history is cleared to prevent memory leaks
 */
export function clearToolGroupCache(): void {
  parsedArgsCache.clear();
}

/**
 * Parse tool arguments with caching
 * Uses tool call ID as cache key to avoid redundant JSON.parse
 *
 * @param toolCallId - Unique identifier for this tool call
 * @param argsStr - JSON string of arguments
 * @returns Parsed arguments object
 */
function parseToolArguments(toolCallId: string, argsStr: string): Record<string, unknown> {
  // Check cache first
  const cached = parsedArgsCache.get(toolCallId);
  if (cached !== undefined) {
    return cached;
  }

  // Limit cache size BEFORE adding new entry
  if (parsedArgsCache.size >= CACHE_CONFIG.TOOL_ARGS_CACHE_MAX_SIZE) {
    // Collect oldest entries first (Map maintains insertion order)
    const keysToDelete: string[] = [];
    for (const key of parsedArgsCache.keys()) {
      keysToDelete.push(key);
      if (keysToDelete.length >= CACHE_CONFIG.TOOL_ARGS_CACHE_PRUNE_COUNT) break;
    }

    // Delete collected keys (avoid iterator invalidation)
    for (const key of keysToDelete) {
      parsedArgsCache.delete(key);
    }
  }

  // Parse and cache
  try {
    const args = JSON.parse(argsStr);
    parsedArgsCache.set(toolCallId, args);
    return args;
  } catch {
    // Return empty object on parse error (don't cache failures)
    return {};
  }
}

/**
 * Represents a group of consecutive tool operations
 */
export interface ToolGroup {
  /** Primary file/resource being operated on */
  resource: string;
  /** All operations in this group */
  operations: ChatEntry[];
  /** When the first operation started */
  startTime: Date;
  /** When the last operation completed */
  endTime: Date;
  /** Whether any operation in the group failed */
  hasError: boolean;
  /** Brief error summary for display in quiet mode (first error encountered) */
  errorSummary?: string;
  /** Type of group (file-based, bash, search, etc) */
  groupType: 'file' | 'bash' | 'search' | 'todo' | 'analysis' | 'mixed';
  /** Semantic action for Claude Code-style grouping */
  semanticAction?: SemanticAction;
  /** Human-readable action description for semantic groups */
  actionDescription?: string;
  /** All unique resources touched (for semantic groups) */
  resources?: string[];
  /** Whether this is a semantic group (vs resource-based) */
  isSemanticGroup?: boolean;
  /** Whether all operations in the group have completed (have tool_result) */
  isComplete?: boolean;
}

/**
 * Union type for grouped or individual entries
 */
export type GroupedEntry = ChatEntry | ToolGroup;

/**
 * Check if an entry is a ToolGroup
 */
export function isToolGroup(entry: GroupedEntry): entry is ToolGroup {
  return 'operations' in entry && Array.isArray((entry as any).operations);
}

/**
 * Extract a brief error summary from a tool result error message
 * Limits to first line and max 80 characters for display
 */
function extractErrorSummary(error: string | undefined): string | undefined {
  if (!error) return undefined;

  // Get first line only
  const firstLine = error.split('\n')[0].trim();

  // BUG FIX: Return undefined if first line is empty after trim
  if (!firstLine) return undefined;

  // Truncate if too long (80 chars max for display)
  if (firstLine.length > 80) {
    return firstLine.substring(0, 77) + '...';
  }

  return firstLine;
}

/**
 * Extract file path from tool call arguments
 */
function getResourceFromToolCall(entry: ChatEntry): string {
  if (entry.type !== 'tool_call' && entry.type !== 'tool_result') {
    return '';
  }

  const toolName = entry.toolCall?.function?.name;
  if (!toolName) return '';

  const argsStr = entry.toolCall?.function?.arguments;
  if (!argsStr) return '';

  // Use toolCall.id for caching (unique per call)
  // BUG FIX: Improved fallback key to use tool name + args length + hash of full args
  // to reduce collision risk (previously only used first 50 chars)
  const toolCallId = entry.toolCall?.id ||
    `fallback:${toolName}:${argsStr.length}:${simpleHash(argsStr)}`;
  const args = parseToolArguments(toolCallId, argsStr);

  // File operations
  // BUG FIX: Added multi_edit and read_file tool support
  if (toolName === 'view_file' || toolName === 'read_file' || toolName === 'str_replace_editor' || toolName === 'create_file' || toolName === 'multi_edit') {
    return (args.path as string) || (args.file_path as string) || '';
  }

  // Search operations
  if (toolName === 'search') {
    return `search:${(args.query as string) || ''}`;
  }

  // Bash operations
  // BUG FIX: Handle both 'bash' and 'execute_bash' tool names
  if (toolName === 'bash' || toolName === 'execute_bash') {
    const cmd = (args.command as string) || '';
    // Group by command type (git, npm, etc)
    // Handle empty/whitespace commands by trimming first
    const trimmedCmd = cmd.trim();
    if (!trimmedCmd) {
      // Empty command - use generic bash identifier
      return 'bash:empty';
    }
    const cmdType = trimmedCmd.split(/\s+/)[0]; // Use \s+ to handle multiple spaces
    return `bash:${cmdType}`;
  }

  // Bash output operations (checking background tasks)
  if (toolName === 'bash_output') {
    const taskId = (args.task_id as string) || '';
    return taskId ? `task:${taskId}` : 'task:unknown';
  }

  // Todo operations
  if (toolName === 'create_todo_list' || toolName === 'update_todo_list') {
    return 'todo';
  }

  // Analysis operations
  if (toolName === 'analyze_architecture') {
    const projectPath = (args.projectPath as string) || (args.project_path as string) || '';
    return projectPath ? `analysis:${projectPath}` : 'analysis:project';
  }

  if (toolName === 'validate_best_practices') {
    const path = (args.path as string) || '';
    return path ? `validation:${path}` : 'validation:project';
  }

  // BUG FIX: Handle MCP tools (mcp__servername__toolname format)
  if (toolName.startsWith('mcp__')) {
    // Extract server name for grouping MCP operations by server
    const parts = toolName.split('__');
    const serverName = parts.length >= 2 ? parts[1] : 'unknown';
    // Try to extract a resource from common argument patterns
    const resource = (args.path as string) || (args.file_path as string) ||
                     (args.query as string) || (args.uri as string) ||
                     (args.url as string) || '';
    return resource ? `mcp:${serverName}:${resource}` : `mcp:${serverName}`;
  }

  return '';
}

/**
 * Determine group type based on tool name
 */
function getGroupType(toolName: string): ToolGroup['groupType'] {
  // BUG FIX: Handle both 'bash' and 'execute_bash' tool names
  if (toolName === 'bash' || toolName === 'execute_bash' || toolName === 'bash_output') return 'bash';
  if (toolName === 'search') return 'search';
  if (toolName === 'create_todo_list' || toolName === 'update_todo_list') return 'todo';
  // BUG FIX: Added multi_edit and read_file tool support
  if (toolName === 'view_file' || toolName === 'read_file' || toolName === 'str_replace_editor' || toolName === 'create_file' || toolName === 'multi_edit') return 'file';
  if (toolName === 'analyze_architecture' || toolName === 'validate_best_practices') return 'analysis';
  // BUG FIX: Handle MCP tools - group as 'mixed' but allow proper resource-based grouping
  // MCP tools have varied purposes so we can't assign a specific type, but they will still
  // group by server+resource via getResourceFromToolCall
  if (toolName.startsWith('mcp__')) return 'mixed';
  return 'mixed';
}

/**
 * Check if two entries should be grouped together (resource-based)
 */
function shouldGroupByResource(
  current: ChatEntry,
  previous: ChatEntry,
  groupSize: number,
  maxGroupSize: number,
  timeWindow: number
): boolean {
  // Don't group if we've hit the max size
  if (groupSize >= maxGroupSize) {
    return false;
  }

  // Only group tool operations
  if ((current.type !== 'tool_call' && current.type !== 'tool_result') ||
      (previous.type !== 'tool_call' && previous.type !== 'tool_result')) {
    return false;
  }

  // Check time window
  // Safely handle timestamps - could be Date objects or strings from deserialization
  const currentTime = current.timestamp instanceof Date
    ? current.timestamp.getTime()
    : new Date(current.timestamp).getTime();
  const previousTime = previous.timestamp instanceof Date
    ? previous.timestamp.getTime()
    : new Date(previous.timestamp).getTime();

  // Reject if timestamps are invalid (NaN)
  if (Number.isNaN(currentTime) || Number.isNaN(previousTime)) {
    return false;
  }

  const timeDiff = currentTime - previousTime;

  // BUG FIX: Allow zero time difference (same timestamp) and use absolute value
  // for time window check. Tool operations can have identical timestamps when
  // batched together, and order in the entries array matters more than timestamp.
  if (Math.abs(timeDiff) > timeWindow) {
    return false;
  }

  // Must operate on the same resource
  const currentResource = getResourceFromToolCall(current);
  const previousResource = getResourceFromToolCall(previous);

  if (!currentResource || !previousResource) {
    return false;
  }

  return currentResource === previousResource;
}

/**
 * Check if two entries should be grouped semantically (Claude Code-style)
 */
function shouldGroupSemantically(
  current: ChatEntry,
  previous: ChatEntry,
  groupSize: number,
  maxGroupSize: number,
  timeWindow: number
): boolean {
  // Don't group if we've hit the max size
  if (groupSize >= maxGroupSize) {
    return false;
  }

  // Only group tool operations
  if ((current.type !== 'tool_call' && current.type !== 'tool_result') ||
      (previous.type !== 'tool_call' && previous.type !== 'tool_result')) {
    return false;
  }

  // Check time window (more lenient for semantic grouping)
  const currentTime = current.timestamp instanceof Date
    ? current.timestamp.getTime()
    : new Date(current.timestamp).getTime();
  const previousTime = previous.timestamp instanceof Date
    ? previous.timestamp.getTime()
    : new Date(previous.timestamp).getTime();

  if (Number.isNaN(currentTime) || Number.isNaN(previousTime)) {
    return false;
  }

  const timeDiff = currentTime - previousTime;
  // BUG FIX: Use absolute value for time window check (consistent with resource-based grouping)
  // Semantic grouping uses a larger time window (2x)
  if (Math.abs(timeDiff) > timeWindow * 2) {
    return false;
  }

  // Check semantic compatibility
  const currentAction = detectSingleAction(current);
  const previousAction = detectSingleAction(previous);

  // Same action type = group
  if (currentAction === previousAction && currentAction !== SemanticAction.Unknown) {
    return true;
  }

  // Compatible transition = group
  if (isCompatibleTransition(previousAction, currentAction)) {
    return true;
  }

  // Fallback to resource-based grouping for unknown actions
  if (currentAction === SemanticAction.Unknown || previousAction === SemanticAction.Unknown) {
    const currentResource = getResourceFromToolCall(current);
    const previousResource = getResourceFromToolCall(previous);
    return currentResource === previousResource && !!currentResource;
  }

  return false;
}

/**
 * Group consecutive tool operations
 *
 * @param entries - Chat history entries
 * @param options - Grouping configuration
 * @returns Array of grouped or individual entries
 */
export function groupConsecutiveTools(
  entries: ChatEntry[],
  options: {
    enabled?: boolean;
    maxGroupSize?: number;
    timeWindow?: number;
    semanticGrouping?: boolean;
    maxSemanticGroupSize?: number;
  } = {}
): GroupedEntry[] {
  const {
    enabled = UI_CONFIG.GROUP_TOOL_CALLS,
    maxGroupSize = UI_CONFIG.MAX_GROUP_SIZE,
    timeWindow = UI_CONFIG.GROUP_TIME_WINDOW,
    semanticGrouping = UI_CONFIG.SEMANTIC_GROUPING,
    maxSemanticGroupSize = UI_CONFIG.MAX_SEMANTIC_GROUP_SIZE,
  } = options;

  // If grouping disabled, return entries as-is
  if (!enabled) {
    return entries;
  }

  // Choose grouping function based on mode
  const shouldGroup = semanticGrouping ? shouldGroupSemantically : shouldGroupByResource;
  const effectiveMaxGroupSize = semanticGrouping ? maxSemanticGroupSize : maxGroupSize;

  const result: GroupedEntry[] = [];
  let currentGroup: ToolGroup | null = null;

  // Track tool call IDs we've already seen to avoid duplicating tool_call/tool_result pairs
  const seenToolCallIds = new Set<string>();

  for (const entry of entries) {
    // Non-tool entries always break the group
    if (entry.type !== 'tool_call' && entry.type !== 'tool_result') {
      if (currentGroup) {
        finalizeGroup(currentGroup);
        // BUG FIX: Don't wrap single-item groups - return the entry directly
        if (currentGroup.operations.length === 1) {
          result.push(currentGroup.operations[0]);
        } else {
          result.push(currentGroup);
        }
        currentGroup = null;
      }
      result.push(entry);
      continue;
    }

    const toolCallId = entry.toolCall?.id;

    // BUG FIX: Skip deduplication logic if no toolCallId - can't match pairs without ID
    if (!toolCallId) {
      // No ID means we can't dedupe, just add to group normally
      // Fall through to normal grouping logic below
    } else if (seenToolCallIds.has(toolCallId)) {
    // BUG FIX: Handle tool_call/tool_result pairs
    // If this is a tool_result for a tool_call we've already processed,
    // replace the tool_call entry with the tool_result (which has more complete info)
      // This is a tool_result for a previously seen tool_call
      let replaced = false;

      // First, try to find and replace in the current group
      if (currentGroup) {
        const existingIndex = currentGroup.operations.findIndex(
          (op) => op.toolCall?.id === toolCallId && op.type === 'tool_call'
        );
        if (existingIndex !== -1) {
          // Replace tool_call with tool_result (has complete info including result)
          currentGroup.operations[existingIndex] = entry;
          currentGroup.endTime = entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp);
          // Update error state from the result
          if (entry.toolResult && !entry.toolResult.success) {
            currentGroup.hasError = true;
            if (!currentGroup.errorSummary) {
              currentGroup.errorSummary = extractErrorSummary(entry.toolResult?.error);
            }
          }
          // BUG FIX: Recompute isComplete after replacement in currentGroup too
          currentGroup.isComplete = checkGroupComplete(currentGroup);
          replaced = true;
        }
      }

      // BUG FIX: If not in current group, search in already-flushed result entries
      // This handles the case where a group was flushed before its tool_result arrived
      if (!replaced) {
        // BUG FIX: Limit backward search to avoid O(n²) performance on large histories
        // Only search last 100 entries - tool_results should arrive shortly after tool_calls
        const searchLimit = Math.max(0, result.length - 100);
        for (let i = result.length - 1; i >= searchLimit; i--) {
          const resultEntry = result[i];

          // Check if it's a ToolGroup containing the tool_call
          if (isToolGroup(resultEntry)) {
            const existingIndex = resultEntry.operations.findIndex(
              (op) => op.toolCall?.id === toolCallId && op.type === 'tool_call'
            );
            if (existingIndex !== -1) {
              // Replace tool_call with tool_result in the flushed group
              resultEntry.operations[existingIndex] = entry;
              resultEntry.endTime = entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp);
              // BUG FIX: Update error state for flushed groups too
              if (entry.toolResult && !entry.toolResult.success) {
                resultEntry.hasError = true;
                if (!resultEntry.errorSummary) {
                  resultEntry.errorSummary = extractErrorSummary(entry.toolResult?.error);
                }
              }
              // BUG FIX: Recompute isComplete after replacement
              resultEntry.isComplete = checkGroupComplete(resultEntry);
              replaced = true;
              break;
            }
          } else {
            // Check if it's an individual ChatEntry that matches
            const chatEntry = resultEntry as ChatEntry;
            if (chatEntry.toolCall?.id === toolCallId && chatEntry.type === 'tool_call') {
              // Replace the individual entry with the tool_result
              result[i] = entry;
              replaced = true;
              break;
            }
          }
        }
      }

      // Skip adding as new entry (whether replaced or not - avoid duplicates)
      continue;
    }

    // Mark this tool call ID as seen
    if (toolCallId) {
      seenToolCallIds.add(toolCallId);
    }

    const resource = getResourceFromToolCall(entry);
    const toolName = entry.toolCall?.function?.name || 'unknown';
    const groupType = getGroupType(toolName);

    // Determine if this entry has an error and extract summary
    const entryHasError = entry.toolResult ? !entry.toolResult.success : false;
    const entryErrorSummary = entryHasError ? extractErrorSummary(entry.toolResult?.error) : undefined;

    // Start new group or continue existing
    if (!currentGroup) {
      // Start new group
      currentGroup = {
        resource,
        operations: [entry],
        startTime: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
        endTime: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
        hasError: entryHasError,
        errorSummary: entryErrorSummary,
        groupType,
        isSemanticGroup: semanticGrouping,
        resources: resource ? [resource] : [],
      };
    } else if (currentGroup.operations.length > 0 && shouldGroup(entry, currentGroup.operations[currentGroup.operations.length - 1], currentGroup.operations.length, effectiveMaxGroupSize, timeWindow)) {
      // Add to existing group
      currentGroup.operations.push(entry);
      currentGroup.endTime = entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp);
      if (entryHasError) {
        currentGroup.hasError = true;
        // Only capture first error summary (don't overwrite)
        if (!currentGroup.errorSummary && entryErrorSummary) {
          currentGroup.errorSummary = entryErrorSummary;
        }
      }
      // Track unique resources for semantic groups
      if (resource && currentGroup.resources && !currentGroup.resources.includes(resource)) {
        currentGroup.resources.push(resource);
      }
      // BUG FIX: Update groupType to 'mixed' if new entry has different type
      if (groupType !== currentGroup.groupType && currentGroup.groupType !== 'mixed') {
        currentGroup.groupType = 'mixed';
      }
    } else {
      // Can't group, flush current and start new
      finalizeGroup(currentGroup);
      // BUG FIX: Don't wrap single-item groups - return the entry directly
      if (currentGroup.operations.length === 1) {
        result.push(currentGroup.operations[0]);
      } else {
        result.push(currentGroup);
      }
      currentGroup = {
        resource,
        operations: [entry],
        startTime: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
        endTime: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
        hasError: entryHasError,
        errorSummary: entryErrorSummary,
        groupType,
        isSemanticGroup: semanticGrouping,
        resources: resource ? [resource] : [],
      };
    }
  }

  // Flush final group
  if (currentGroup) {
    finalizeGroup(currentGroup);
    // BUG FIX: Don't wrap single-item groups - return the entry directly
    // This prevents unnecessary group wrapper for standalone tool operations
    if (currentGroup.operations.length === 1) {
      result.push(currentGroup.operations[0]);
    } else if (currentGroup.operations.length > 1) {
      // BUG FIX: Only push groups with 2+ operations
      result.push(currentGroup);
    }
    // Note: Empty groups (0 operations) are silently dropped
  }

  return result;
}

/**
 * Check if all operations in a group have completed (have tool_result)
 */
function checkGroupComplete(group: ToolGroup): boolean {
  // BUG FIX: Handle empty operations array edge case
  if (group.operations.length === 0) {
    return true; // Empty group is considered complete
  }
  return group.operations.every(
    (op) => op.type === 'tool_result' || (op.toolResult !== undefined)
  );
}

/**
 * Finalize a group by computing semantic action and description
 */
function finalizeGroup(group: ToolGroup): void {
  // BUG FIX: Always compute isComplete to show proper status indicator
  group.isComplete = checkGroupComplete(group);

  if (!group.isSemanticGroup) return;

  // Detect semantic action from all operations
  group.semanticAction = detectSemanticAction(group.operations);

  // Count operations for description
  const counts = getOperationCounts(group);

  // Generate action description
  group.actionDescription = formatActionWithCounts(group.semanticAction, {
    reads: counts.reads,
    edits: counts.updates,
    creates: counts.creates,
    searches: counts.searches,
    commands: counts.bash,
    files: group.resources?.length || 0,
  });
}

/**
 * Get operation counts by type from a group
 */
export function getOperationCounts(group: ToolGroup): {
  reads: number;
  updates: number;
  creates: number;
  searches: number;
  bash: number;
  todos: number;
  analysis: number;
  other: number;
} {
  const counts = {
    reads: 0,
    updates: 0,
    creates: 0,
    searches: 0,
    bash: 0,
    todos: 0,
    analysis: 0,
    other: 0,
  };

  for (const op of group.operations) {
    const toolName = op.toolCall?.function?.name;
    if (!toolName) continue;

    switch (toolName) {
      case 'view_file':
      case 'read_file':  // BUG FIX: Count read_file as reads
        counts.reads++;
        break;
      case 'str_replace_editor':
      case 'multi_edit':  // BUG FIX: Count multi_edit as file updates
        counts.updates++;
        break;
      case 'create_file':
        counts.creates++;
        break;
      case 'search':
        counts.searches++;
        break;
      case 'bash':
      case 'execute_bash':  // BUG FIX: Handle execute_bash tool
      case 'bash_output':
        counts.bash++;
        break;
      case 'create_todo_list':
      case 'update_todo_list':
        counts.todos++;
        break;
      case 'analyze_architecture':
      case 'validate_best_practices':
        counts.analysis++;
        break;
      default:
        counts.other++;
    }
  }

  return counts;
}

/**
 * Get execution duration for a group in milliseconds
 * Returns 0 if timestamps are invalid
 */
export function getGroupDuration(group: ToolGroup): number {
  const startMs = group.startTime.getTime();
  const endMs = group.endTime.getTime();

  // Handle Invalid Date objects (getTime() returns NaN)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 0;
  }

  // BUG FIX: Return 0 for negative durations (out-of-order timestamps)
  const duration = endMs - startMs;
  return duration < 0 ? 0 : duration;
}

/**
 * Format duration in human-readable form
 * Returns "0ms" for invalid durations (NaN, negative, etc.)
 */
export function formatDuration(ms: number): string {
  // Handle invalid durations
  if (!Number.isFinite(ms) || ms < 0) {
    return '0ms';
  }

  // BUG FIX: Round to integer to avoid "123.456ms" display
  const roundedMs = Math.round(ms);

  if (roundedMs < 1000) {
    return `${roundedMs}ms`;
  } else if (roundedMs < 60000) {
    return `${(roundedMs / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(roundedMs / 60000);
    const seconds = Math.floor((roundedMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
