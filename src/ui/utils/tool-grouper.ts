/**
 * Tool Grouping Utilities
 * Groups consecutive tool operations for cleaner UX in quiet mode
 */

import type { ChatEntry } from '../../agent/llm-agent.js';
import { UI_CONFIG } from '../../constants.js';

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
  /** Type of group (file-based, bash, search, etc) */
  groupType: 'file' | 'bash' | 'search' | 'todo' | 'mixed';
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
 * Extract file path from tool call arguments
 */
function getResourceFromToolCall(entry: ChatEntry): string {
  if (entry.type !== 'tool_call' && entry.type !== 'tool_result') {
    return '';
  }

  const toolName = entry.toolCall?.function?.name;
  if (!toolName) return '';

  try {
    const argsStr = entry.toolCall?.function?.arguments;
    if (!argsStr) return '';

    const args = JSON.parse(argsStr);

    // File operations
    if (toolName === 'view_file' || toolName === 'str_replace_editor' || toolName === 'create_file') {
      return args.path || args.file_path || '';
    }

    // Search operations
    if (toolName === 'search') {
      return `search:${args.query || ''}`;
    }

    // Bash operations
    if (toolName === 'bash') {
      const cmd = args.command || '';
      // Group by command type (git, npm, etc)
      const cmdType = cmd.split(' ')[0];
      return `bash:${cmdType}`;
    }

    // Todo operations
    if (toolName === 'create_todo_list' || toolName === 'update_todo_list') {
      return 'todo';
    }

    return '';
  } catch {
    return '';
  }
}

/**
 * Determine group type based on tool name
 */
function getGroupType(toolName: string): ToolGroup['groupType'] {
  if (toolName === 'bash') return 'bash';
  if (toolName === 'search') return 'search';
  if (toolName === 'create_todo_list' || toolName === 'update_todo_list') return 'todo';
  if (toolName === 'view_file' || toolName === 'str_replace_editor' || toolName === 'create_file') return 'file';
  return 'mixed';
}

/**
 * Check if two entries should be grouped together
 */
function shouldGroup(
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
  const timeDiff = current.timestamp.getTime() - previous.timestamp.getTime();
  if (timeDiff > timeWindow) {
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
  } = {}
): GroupedEntry[] {
  const {
    enabled = UI_CONFIG.GROUP_TOOL_CALLS,
    maxGroupSize = UI_CONFIG.MAX_GROUP_SIZE,
    timeWindow = UI_CONFIG.GROUP_TIME_WINDOW,
  } = options;

  // If grouping disabled, return entries as-is
  if (!enabled) {
    return entries;
  }

  const result: GroupedEntry[] = [];
  let currentGroup: ToolGroup | null = null;

  for (const entry of entries) {
    // Non-tool entries always break the group
    if (entry.type !== 'tool_call' && entry.type !== 'tool_result') {
      if (currentGroup) {
        result.push(currentGroup);
        currentGroup = null;
      }
      result.push(entry);
      continue;
    }

    const resource = getResourceFromToolCall(entry);
    const toolName = entry.toolCall?.function?.name || 'unknown';
    const groupType = getGroupType(toolName);

    // Start new group or continue existing
    if (!currentGroup) {
      // Start new group
      currentGroup = {
        resource,
        operations: [entry],
        startTime: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
        endTime: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
        hasError: entry.toolResult ? !entry.toolResult.success : false,
        groupType,
      };
    } else if (shouldGroup(entry, currentGroup.operations[currentGroup.operations.length - 1], currentGroup.operations.length, maxGroupSize, timeWindow)) {
      // Add to existing group
      currentGroup.operations.push(entry);
      currentGroup.endTime = entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp);
      if (entry.toolResult && !entry.toolResult.success) {
        currentGroup.hasError = true;
      }
    } else {
      // Can't group, flush current and start new
      result.push(currentGroup);
      currentGroup = {
        resource,
        operations: [entry],
        startTime: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
        endTime: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
        hasError: entry.toolResult ? !entry.toolResult.success : false,
        groupType,
      };
    }
  }

  // Flush final group
  if (currentGroup) {
    result.push(currentGroup);
  }

  return result;
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
  other: number;
} {
  const counts = {
    reads: 0,
    updates: 0,
    creates: 0,
    searches: 0,
    bash: 0,
    todos: 0,
    other: 0,
  };

  for (const op of group.operations) {
    const toolName = op.toolCall?.function?.name;
    if (!toolName) continue;

    switch (toolName) {
      case 'view_file':
        counts.reads++;
        break;
      case 'str_replace_editor':
        counts.updates++;
        break;
      case 'create_file':
        counts.creates++;
        break;
      case 'search':
        counts.searches++;
        break;
      case 'bash':
        counts.bash++;
        break;
      case 'create_todo_list':
      case 'update_todo_list':
        counts.todos++;
        break;
      default:
        counts.other++;
    }
  }

  return counts;
}

/**
 * Get execution duration for a group in milliseconds
 */
export function getGroupDuration(group: ToolGroup): number {
  return group.endTime.getTime() - group.startTime.getTime();
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
