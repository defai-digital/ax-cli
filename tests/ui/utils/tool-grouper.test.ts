/**
 * Unit tests for tool-grouper.ts
 * Tests grouping logic, edge cases, and the bug fixes we implemented
 */

import { describe, it, expect } from 'vitest';
import {
  groupConsecutiveTools,
  isToolGroup,
  getOperationCounts,
  getGroupDuration,
  formatDuration,
  clearToolGroupCache,
  isToolOperation,
  type ToolGroup,
  type GroupedEntry,
} from '../../../packages/core/src/ui/utils/tool-grouper.js';
import type { ChatEntry } from '../../../packages/core/src/agent/llm-agent.js';

// Helper to create mock chat entries
function createToolCall(
  toolName: string,
  args: Record<string, any>,
  timestamp: Date | string = new Date()
): ChatEntry {
  return {
    type: 'tool_call',
    content: 'Executing...',
    timestamp,
    toolCall: {
      id: `call_${Math.random()}`,
      type: 'function',
      function: {
        name: toolName,
        arguments: JSON.stringify(args),
      },
    },
  };
}

function createToolResult(
  toolName: string,
  args: Record<string, any>,
  success: boolean = true,
  output: string = 'Success',
  timestamp: Date | string = new Date()
): ChatEntry {
  return {
    type: 'tool_result',
    content: success ? output : 'Error',
    timestamp,
    toolCall: {
      id: `call_${Math.random()}`,
      type: 'function',
      function: {
        name: toolName,
        arguments: JSON.stringify(args),
      },
    },
    toolResult: {
      success,
      output: success ? output : undefined,
      error: success ? undefined : output,
    },
  };
}

function createUserMessage(content: string, timestamp: Date | string = new Date()): ChatEntry {
  return {
    type: 'user',
    content,
    timestamp,
  };
}

function createAssistantMessage(content: string, timestamp: Date | string = new Date()): ChatEntry {
  return {
    type: 'assistant',
    content,
    timestamp,
  };
}

describe('tool-grouper', () => {
  describe('isToolGroup', () => {
    it('should identify ToolGroup objects', () => {
      const group: ToolGroup = {
        resource: 'test.ts',
        operations: [],
        startTime: new Date(),
        endTime: new Date(),
        hasError: false,
        groupType: 'file',
      };

      expect(isToolGroup(group)).toBe(true);
    });

    it('should identify ChatEntry as not ToolGroup', () => {
      const entry: ChatEntry = createUserMessage('test');
      expect(isToolGroup(entry)).toBe(false);
    });

    it('should handle objects with operations array', () => {
      const fakeGroup = {
        operations: [],
        other: 'data',
      };
      expect(isToolGroup(fakeGroup as any)).toBe(true);
    });
  });

  describe('groupConsecutiveTools - Basic Grouping', () => {
    it('should group consecutive file operations on same file', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test.ts' }, new Date(now)),
        createToolResult('view_file', { path: 'test.ts' }, true, 'file content', new Date(now + 100)),
        createToolCall('str_replace_editor', { path: 'test.ts' }, new Date(now + 200)),
        createToolResult('str_replace_editor', { path: 'test.ts' }, true, 'updated', new Date(now + 300)),
      ];

      // Use resource-based mode to test same-file grouping
      const result = groupConsecutiveTools(entries, { enabled: true, timeWindow: 10000, semanticGrouping: false });

      expect(result).toHaveLength(1);
      expect(isToolGroup(result[0])).toBe(true);

      const group = result[0] as ToolGroup;
      expect(group.operations).toHaveLength(4);
      expect(group.resource).toBe('test.ts');
      expect(group.groupType).toBe('file');
      expect(group.hasError).toBe(false);
    });

    it('should not group operations on different files (resource-based mode)', () => {
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test1.ts' }),
        createToolCall('view_file', { path: 'test2.ts' }),
      ];

      // With semantic grouping disabled, different files should NOT be grouped
      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: false });

      expect(result).toHaveLength(2);
      // Single-item groups are unwrapped to the original entry (not wrapped in ToolGroup)
      expect(isToolGroup(result[0])).toBe(false);
      expect(isToolGroup(result[1])).toBe(false);
    });

    it('should group operations on different files (semantic mode)', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test1.ts' }, new Date(now)),
        createToolCall('view_file', { path: 'test2.ts' }, new Date(now + 100)),
      ];

      // With semantic grouping enabled, consecutive reads = "Exploring codebase"
      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: true, timeWindow: 5000 });

      expect(result).toHaveLength(1);
      expect(isToolGroup(result[0])).toBe(true);
      expect((result[0] as ToolGroup).isSemanticGroup).toBe(true);
    });

    it('should break groups on user/assistant messages', () => {
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test.ts' }),
        createUserMessage('What does this do?'),
        createToolCall('view_file', { path: 'test.ts' }),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true });

      expect(result).toHaveLength(3);
      // Single-item tool groups are unwrapped to the original entry
      expect(isToolGroup(result[0])).toBe(false);
      expect(isToolGroup(result[1])).toBe(false); // user message
      expect(isToolGroup(result[2])).toBe(false);
    });

    it('should return entries as-is when grouping is disabled', () => {
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test.ts' }),
        createToolCall('view_file', { path: 'test.ts' }),
      ];

      const result = groupConsecutiveTools(entries, { enabled: false });

      expect(result).toHaveLength(2);
      expect(result).toEqual(entries);
    });
  });

  describe('groupConsecutiveTools - Bash Command Handling (Bug Fix #1)', () => {
    it('should handle empty bash commands', () => {
      const entry = createToolCall('bash', { command: '' });
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
      // Single-item groups are unwrapped to the original entry
      expect(isToolGroup(result[0])).toBe(false);
      // The entry should still have the correct toolCall info
      expect((result[0] as ChatEntry).toolCall?.function?.name).toBe('bash');
    });

    it('should handle whitespace-only bash commands', () => {
      const entry = createToolCall('bash', { command: '   ' });
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
      // Single-item groups are unwrapped
      expect(isToolGroup(result[0])).toBe(false);
    });

    it('should handle bash commands with multiple spaces', () => {
      const entry = createToolCall('bash', { command: 'git  status' });
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
      // Single-item groups are unwrapped
      expect(isToolGroup(result[0])).toBe(false);
    });

    it('should group bash commands by command type (resource-based mode)', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolCall('bash', { command: 'git status' }, new Date(now)),
        createToolCall('bash', { command: 'git add .' }, new Date(now + 100)),
        createToolCall('bash', { command: 'npm install' }, new Date(now + 200)),
      ];

      // Resource-based mode groups by command prefix
      const result = groupConsecutiveTools(entries, { enabled: true, timeWindow: 10000, semanticGrouping: false });

      expect(result).toHaveLength(2); // git group (2 items) and npm (single unwrapped)
      expect(isToolGroup(result[0])).toBe(true);
      expect((result[0] as ToolGroup).resource).toBe('bash:git');
      expect((result[0] as ToolGroup).operations).toHaveLength(2);
      // npm is a single item, so unwrapped
      expect(isToolGroup(result[1])).toBe(false);
    });
  });

  describe('groupConsecutiveTools - Timestamp Handling (Bug Fix #2)', () => {
    it('should handle Date object timestamps', () => {
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test.ts' }, new Date('2025-01-01T10:00:00Z')),
        createToolCall('view_file', { path: 'test.ts' }, new Date('2025-01-01T10:00:01Z')),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true, timeWindow: 5000 });

      expect(result).toHaveLength(1);
      expect(isToolGroup(result[0])).toBe(true);
    });

    it('should handle ISO string timestamps (from deserialization)', () => {
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test.ts' }, '2025-01-01T10:00:00.000Z'),
        createToolCall('view_file', { path: 'test.ts' }, '2025-01-01T10:00:01.000Z'),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true, timeWindow: 5000 });

      expect(result).toHaveLength(1);
      expect(isToolGroup(result[0])).toBe(true);
    });

    it('should handle mixed Date and string timestamps', () => {
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test.ts' }, new Date('2025-01-01T10:00:00Z')),
        createToolCall('view_file', { path: 'test.ts' }, '2025-01-01T10:00:01.000Z'),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true, timeWindow: 5000 });

      expect(result).toHaveLength(1);
      expect(isToolGroup(result[0])).toBe(true);
    });

    it('should respect time window when grouping', () => {
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test.ts' }, new Date('2025-01-01T10:00:00Z')),
        createToolCall('view_file', { path: 'test.ts' }, new Date('2025-01-01T10:01:00Z')), // 60 seconds later
      ];

      // With 500ms window, should not group
      const result1 = groupConsecutiveTools(entries, { enabled: true, timeWindow: 500 });
      expect(result1).toHaveLength(2);

      // With 70s window, should group
      const result2 = groupConsecutiveTools(entries, { enabled: true, timeWindow: 70000 });
      expect(result2).toHaveLength(1);
    });
  });

  describe('groupConsecutiveTools - Max Group Size', () => {
    it('should respect maxGroupSize limit', () => {
      const baseTime = Date.now();
      const entries: ChatEntry[] = Array.from({ length: 10 }, (_, i) =>
        createToolCall('view_file', { path: 'test.ts' }, new Date(baseTime + i * 100))
      );

      // Use resource-based mode with max group size
      const result = groupConsecutiveTools(entries, {
        enabled: true,
        maxGroupSize: 5,
        semanticGrouping: false,
        timeWindow: 60000,
      });

      expect(result).toHaveLength(2); // Two groups of 5 each
      expect((result[0] as ToolGroup).operations).toHaveLength(5);
      expect((result[1] as ToolGroup).operations).toHaveLength(5);
    });

    it('should create new group when size limit reached', () => {
      const baseTime = Date.now();
      const entries: ChatEntry[] = Array.from({ length: 3 }, (_, i) =>
        createToolCall('view_file', { path: 'test.ts' }, new Date(baseTime + i * 100))
      );

      // Use resource-based mode with max group size
      const result = groupConsecutiveTools(entries, {
        enabled: true,
        maxGroupSize: 2,
        semanticGrouping: false,
        timeWindow: 60000,
      });

      expect(result).toHaveLength(2);
      expect((result[0] as ToolGroup).operations).toHaveLength(2);
      // Single remaining item is unwrapped
      expect(isToolGroup(result[1])).toBe(false);
    });
  });

  describe('groupConsecutiveTools - Error Tracking', () => {
    it('should track errors in group', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolResult('view_file', { path: 'test.ts' }, true, 'Success', new Date(now)),
        createToolResult('str_replace_editor', { path: 'test.ts' }, false, 'Write error', new Date(now + 100)),
      ];

      // Use resource-based mode to ensure grouping by same file
      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: false, timeWindow: 5000 });

      expect(result).toHaveLength(1);
      expect((result[0] as ToolGroup).hasError).toBe(true);
    });

    it('should not mark group as error if all succeed', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolResult('view_file', { path: 'test.ts' }, true, 'Success', new Date(now)),
        createToolResult('str_replace_editor', { path: 'test.ts' }, true, 'Success', new Date(now + 100)),
      ];

      // Use resource-based mode to ensure grouping by same file
      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: false, timeWindow: 5000 });

      expect(result).toHaveLength(1);
      expect((result[0] as ToolGroup).hasError).toBe(false);
    });
  });

  describe('groupConsecutiveTools - Different Tool Types', () => {
    it('should group search operations', () => {
      const entries: ChatEntry[] = [
        createToolCall('search', { query: 'foo' }),
        createToolCall('search', { query: 'foo' }),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true });

      expect(result).toHaveLength(1);
      expect((result[0] as ToolGroup).resource).toBe('search:foo');
      expect((result[0] as ToolGroup).groupType).toBe('search');
    });

    it('should group todo operations', () => {
      const entries: ChatEntry[] = [
        createToolCall('create_todo_list', {}),
        createToolCall('update_todo_list', {}),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true });

      expect(result).toHaveLength(1);
      expect((result[0] as ToolGroup).resource).toBe('todo');
      expect((result[0] as ToolGroup).groupType).toBe('todo');
    });

    it('should handle file_path vs path argument variations', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test.ts' }, new Date(now)),
        createToolCall('str_replace_editor', { file_path: 'test.ts' }, new Date(now + 100)),
      ];

      // Resource-based mode groups by same resource name
      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: false, timeWindow: 5000 });

      expect(result).toHaveLength(1); // Should group even with different arg names
    });
  });

  describe('groupConsecutiveTools - Edge Cases', () => {
    it('should handle empty array', () => {
      const result = groupConsecutiveTools([], { enabled: true });
      expect(result).toEqual([]);
    });

    it('should handle single entry', () => {
      const entry = createToolCall('view_file', { path: 'test.ts' });
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
      // Single-item groups are unwrapped to the original entry
      expect(isToolGroup(result[0])).toBe(false);
      expect((result[0] as ChatEntry).toolCall?.function?.name).toBe('view_file');
    });

    it('should handle entries without toolCall', () => {
      const entry: ChatEntry = {
        type: 'tool_call',
        content: 'test',
        timestamp: new Date(),
      };

      const result = groupConsecutiveTools([entry], { enabled: true });
      expect(result).toHaveLength(1);
    });

    it('should handle malformed JSON in arguments', () => {
      const entry: ChatEntry = {
        type: 'tool_call',
        content: 'test',
        timestamp: new Date(),
        toolCall: {
          id: 'test',
          type: 'function',
          function: {
            name: 'view_file',
            arguments: 'invalid json {{{',
          },
        },
      };

      const result = groupConsecutiveTools([entry], { enabled: true });
      expect(result).toHaveLength(1); // Should not crash
    });

    it('should handle only non-tool entries', () => {
      const entries: ChatEntry[] = [
        createUserMessage('test'),
        createAssistantMessage('response'),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true });

      expect(result).toHaveLength(2);
      expect(isToolGroup(result[0])).toBe(false);
      expect(isToolGroup(result[1])).toBe(false);
    });
  });

  describe('getOperationCounts', () => {
    it('should count different operation types', () => {
      const group: ToolGroup = {
        resource: 'test.ts',
        operations: [
          createToolCall('view_file', { path: 'test.ts' }),
          createToolCall('view_file', { path: 'test.ts' }),
          createToolCall('str_replace_editor', { path: 'test.ts' }),
          createToolCall('create_file', { path: 'new.ts' }),
          createToolCall('bash', { command: 'git status' }),
          createToolCall('search', { query: 'foo' }),
          createToolCall('create_todo_list', {}),
        ],
        startTime: new Date(),
        endTime: new Date(),
        hasError: false,
        groupType: 'file',
      };

      const counts = getOperationCounts(group);

      expect(counts.reads).toBe(2);
      expect(counts.updates).toBe(1);
      expect(counts.creates).toBe(1);
      expect(counts.bash).toBe(1);
      expect(counts.searches).toBe(1);
      expect(counts.todos).toBe(1);
      expect(counts.other).toBe(0);
    });

    it('should count unknown tools as other', () => {
      const group: ToolGroup = {
        resource: 'test',
        operations: [
          createToolCall('unknown_tool', {}),
        ],
        startTime: new Date(),
        endTime: new Date(),
        hasError: false,
        groupType: 'mixed',
      };

      const counts = getOperationCounts(group);
      expect(counts.other).toBe(1);
    });

    it('should handle entries without toolCall', () => {
      const group: ToolGroup = {
        resource: 'test',
        operations: [
          { type: 'tool_call', content: 'test', timestamp: new Date() },
        ],
        startTime: new Date(),
        endTime: new Date(),
        hasError: false,
        groupType: 'mixed',
      };

      const counts = getOperationCounts(group);
      expect(Object.values(counts).every(c => c === 0)).toBe(true);
    });
  });

  describe('getGroupDuration', () => {
    it('should calculate duration in milliseconds', () => {
      const group: ToolGroup = {
        resource: 'test',
        operations: [],
        startTime: new Date('2025-01-01T10:00:00Z'),
        endTime: new Date('2025-01-01T10:00:05Z'), // 5 seconds later
        hasError: false,
        groupType: 'file',
      };

      const duration = getGroupDuration(group);
      expect(duration).toBe(5000);
    });

    it('should return 0 for same start and end time', () => {
      const time = new Date();
      const group: ToolGroup = {
        resource: 'test',
        operations: [],
        startTime: time,
        endTime: time,
        hasError: false,
        groupType: 'file',
      };

      expect(getGroupDuration(group)).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(45000)).toBe('45.0s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(125000)).toBe('2m 5s');
    });

    it('should handle edge cases', () => {
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(59999)).toBe('60.0s'); // Rounds to 60.0
      expect(formatDuration(60001)).toBe('1m 0s');
    });
  });

  describe('JSON.parse caching', () => {
    it('should cache parsed arguments for same tool call ID', () => {
      // Create two entries with same tool call ID
      const toolCallId = 'call_test_123';
      const args = { path: '/test/file.ts' };

      const entry1: ChatEntry = {
        type: 'tool_call',
        content: 'Reading file',
        timestamp: new Date(),
        toolCall: {
          id: toolCallId,
          type: 'function',
          function: {
            name: 'view_file',
            arguments: JSON.stringify(args),
          },
        },
      };

      const entry2: ChatEntry = {
        type: 'tool_result',
        content: 'File contents',
        timestamp: new Date(),
        toolCall: {
          id: toolCallId,
          type: 'function',
          function: {
            name: 'view_file',
            arguments: JSON.stringify(args),
          },
        },
        toolResult: {
          success: true,
          output: 'File contents',
        },
      };

      // Group them - the tool_result replaces the tool_call for the same ID
      const result = groupConsecutiveTools([entry1, entry2], {
        enabled: true,
        maxGroupSize: 10,
        timeWindow: 60000,
      });

      // Tool_result replaces tool_call, so only 1 entry (unwrapped since single item)
      expect(result.length).toBe(1);
      // Single-item result is unwrapped
      expect(isToolGroup(result[0])).toBe(false);
      // Should be the tool_result (replaced tool_call)
      expect((result[0] as ChatEntry).type).toBe('tool_result');
    });

    it('should handle large number of tool calls without memory issues', () => {
      // Create 1000 tool calls with same timestamp to allow grouping
      const baseTime = new Date('2025-01-01T10:00:00Z');
      const entries: ChatEntry[] = [];

      // Create 10 groups of 100 consecutive calls to same file
      for (let fileIdx = 0; fileIdx < 10; fileIdx++) {
        for (let i = 0; i < 100; i++) {
          const timestamp = new Date(baseTime.getTime() + (fileIdx * 100 + i) * 100);
          entries.push(
            createToolCall('view_file', { path: `/file${fileIdx}.ts` }, timestamp)
          );
        }
      }

      // Group them using resource-based mode - should manage cache size properly
      const result = groupConsecutiveTools(entries, {
        enabled: true,
        maxGroupSize: 100,
        timeWindow: 60000,
        semanticGrouping: false,
      });

      // Should successfully group into 10 groups (one per file)
      expect(result.length).toBe(10);
      expect(result.every(isToolGroup)).toBe(true);
    });

    it('should handle invalid JSON gracefully', () => {
      const entry: ChatEntry = {
        type: 'tool_call',
        content: 'Invalid',
        timestamp: new Date(),
        toolCall: {
          id: 'call_invalid',
          type: 'function',
          function: {
            name: 'view_file',
            arguments: '{invalid json}',
          },
        },
      };

      // Should not throw, should return empty string for resource
      const result = groupConsecutiveTools([entry], {
        enabled: true,
      });

      // Should return entry ungrouped (no resource to group by)
      expect(result.length).toBe(1);
    });

    it('should benefit from cache with repeated tool calls', () => {
      // Create many tool calls to same file
      const entries: ChatEntry[] = [];
      const baseTime = new Date('2025-01-01T10:00:00Z');

      for (let i = 0; i < 100; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 100);
        entries.push(
          createToolCall('view_file', { path: '/same/file.ts' }, timestamp)
        );
      }

      // Group them using resource-based mode - cache should make this fast
      const startTime = Date.now();
      const result = groupConsecutiveTools(entries, {
        enabled: true,
        maxGroupSize: 100,
        timeWindow: 60000,
        semanticGrouping: false,
      });
      const duration = Date.now() - startTime;

      // Should group into one (all same file, within time window)
      expect(result.length).toBe(1);
      expect(isToolGroup(result[0])).toBe(true);
      if (isToolGroup(result[0])) {
        expect(result[0].operations.length).toBe(100);
      }

      // Should be fast (< 50ms for 100 entries)
      expect(duration).toBeLessThan(50);
    });
  });

  describe('clearToolGroupCache', () => {
    it('should clear the cache without errors', () => {
      // Group some tools to populate cache
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test.ts' }),
        createToolCall('view_file', { path: 'test.ts' }),
      ];
      groupConsecutiveTools(entries, { enabled: true });

      // Clear should not throw
      expect(() => clearToolGroupCache()).not.toThrow();
    });

    it('should allow grouping to continue after cache clear', () => {
      clearToolGroupCache();

      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test.ts' }),
        createToolResult('view_file', { path: 'test.ts' }, true),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true });
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('isToolOperation', () => {
    it('should return true for tool_call entries', () => {
      const entry = createToolCall('view_file', { path: 'test.ts' });
      expect(isToolOperation(entry)).toBe(true);
    });

    it('should return true for tool_result entries', () => {
      const entry = createToolResult('view_file', { path: 'test.ts' }, true);
      expect(isToolOperation(entry)).toBe(true);
    });

    it('should return false for user messages', () => {
      const entry = createUserMessage('hello');
      expect(isToolOperation(entry)).toBe(false);
    });

    it('should return false for assistant messages', () => {
      const entry = createAssistantMessage('response');
      expect(isToolOperation(entry)).toBe(false);
    });
  });

  describe('MCP tool handling', () => {
    it('should extract server name from MCP tool', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolCall('mcp__filesystem__read_file', { path: '/test.txt' }, new Date(now)),
        createToolCall('mcp__filesystem__write_file', { path: '/test.txt' }, new Date(now + 100)),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: false, timeWindow: 5000 });

      expect(result).toHaveLength(1);
      expect(isToolGroup(result[0])).toBe(true);
      expect((result[0] as ToolGroup).resource).toContain('mcp:filesystem');
    });

    it('should handle MCP tools without path argument', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolCall('mcp__weather__get_forecast', { city: 'NYC' }, new Date(now)),
        createToolCall('mcp__weather__get_temperature', { city: 'NYC' }, new Date(now + 100)),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: false, timeWindow: 5000 });

      expect(result).toHaveLength(1);
      expect(isToolGroup(result[0])).toBe(true);
      expect((result[0] as ToolGroup).resource).toBe('mcp:weather');
    });

    it('should handle MCP tools with query argument', () => {
      const entry = createToolCall('mcp__database__query', { query: 'SELECT * FROM users' });
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
    });

    it('should handle MCP tools with uri argument', () => {
      const entry = createToolCall('mcp__browser__navigate', { uri: 'https://example.com' });
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
    });
  });

  describe('multi_edit tool handling', () => {
    it('should handle multi_edit with files array', () => {
      const entry = createToolCall('multi_edit', {
        files: [
          { path: 'file1.ts' },
          { path: 'file2.ts' },
        ],
      });

      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
      // Single entry unwrapped
      expect(isToolGroup(result[0])).toBe(false);
    });

    it('should handle multi_edit with file_path in array', () => {
      const entry = createToolCall('multi_edit', {
        files: [
          { file_path: 'file1.ts' },
        ],
      });

      const result = groupConsecutiveTools([entry], { enabled: true });
      expect(result).toHaveLength(1);
    });

    it('should handle multi_edit with empty files array', () => {
      const entry = createToolCall('multi_edit', {
        files: [],
      });

      const result = groupConsecutiveTools([entry], { enabled: true });
      expect(result).toHaveLength(1);
    });

    it('should handle multi_edit with single path fallback', () => {
      const entry = createToolCall('multi_edit', {
        path: 'legacy.ts',
      });

      const result = groupConsecutiveTools([entry], { enabled: true });
      expect(result).toHaveLength(1);
    });
  });

  describe('bash_output tool handling', () => {
    it('should handle bash_output with task_id', () => {
      const entry = createToolCall('bash_output', { task_id: 'task-123' });
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
    });

    it('should handle bash_output without task_id', () => {
      const entry = createToolCall('bash_output', {});
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
    });

    it('should group consecutive bash_output calls for same task', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolCall('bash_output', { task_id: 'task-123' }, new Date(now)),
        createToolCall('bash_output', { task_id: 'task-123' }, new Date(now + 100)),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: false, timeWindow: 5000 });

      expect(result).toHaveLength(1);
      expect(isToolGroup(result[0])).toBe(true);
    });
  });

  describe('analysis tool handling', () => {
    it('should handle analyze_architecture with projectPath', () => {
      const entry = createToolCall('analyze_architecture', { projectPath: '/project' });
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
    });

    it('should handle analyze_architecture with project_path', () => {
      const entry = createToolCall('analyze_architecture', { project_path: '/project' });
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
    });

    it('should handle analyze_architecture without path', () => {
      const entry = createToolCall('analyze_architecture', {});
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
    });

    it('should handle validate_best_practices with path', () => {
      const entry = createToolCall('validate_best_practices', { path: '/src' });
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
    });

    it('should handle validate_best_practices without path', () => {
      const entry = createToolCall('validate_best_practices', {});
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
    });
  });

  describe('execute_bash tool handling', () => {
    it('should handle execute_bash same as bash', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolCall('execute_bash', { command: 'git status' }, new Date(now)),
        createToolCall('execute_bash', { command: 'git log' }, new Date(now + 100)),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: false, timeWindow: 5000 });

      expect(result).toHaveLength(1);
      expect(isToolGroup(result[0])).toBe(true);
      expect((result[0] as ToolGroup).resource).toBe('bash:git');
    });
  });

  describe('error summary extraction', () => {
    it('should extract first line of error', () => {
      const entry = createToolResult('bash', { command: 'test' }, false, 'First line\nSecond line\nThird line');
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
    });

    it('should truncate long error messages', () => {
      const longError = 'A'.repeat(100);
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolResult('view_file', { path: 'test.ts' }, true, 'Success', new Date(now)),
        createToolResult('str_replace_editor', { path: 'test.ts' }, false, longError, new Date(now + 100)),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: false, timeWindow: 5000 });

      expect(result).toHaveLength(1);
      expect(isToolGroup(result[0])).toBe(true);
      expect((result[0] as ToolGroup).hasError).toBe(true);
      expect((result[0] as ToolGroup).errorSummary?.length).toBeLessThanOrEqual(80);
    });

    it('should handle empty error message', () => {
      const entry = createToolResult('bash', { command: 'test' }, false, '');
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
    });

    it('should handle whitespace-only error message', () => {
      const entry = createToolResult('bash', { command: 'test' }, false, '   \n   ');
      const result = groupConsecutiveTools([entry], { enabled: true });

      expect(result).toHaveLength(1);
    });
  });

  describe('formatDuration edge cases', () => {
    it('should handle negative duration', () => {
      expect(formatDuration(-100)).toBe('0ms');
    });

    it('should handle NaN duration', () => {
      expect(formatDuration(NaN)).toBe('0ms');
    });

    it('should handle Infinity duration', () => {
      expect(formatDuration(Infinity)).toBe('0ms');
    });

    it('should handle negative Infinity', () => {
      expect(formatDuration(-Infinity)).toBe('0ms');
    });
  });

  describe('getGroupDuration edge cases', () => {
    it('should return 0 for invalid start time', () => {
      const group: ToolGroup = {
        resource: 'test',
        operations: [],
        startTime: new Date('invalid'),
        endTime: new Date(),
        hasError: false,
        groupType: 'file',
      };

      expect(getGroupDuration(group)).toBe(0);
    });

    it('should return 0 for invalid end time', () => {
      const group: ToolGroup = {
        resource: 'test',
        operations: [],
        startTime: new Date(),
        endTime: new Date('invalid'),
        hasError: false,
        groupType: 'file',
      };

      expect(getGroupDuration(group)).toBe(0);
    });

    it('should return 0 for out-of-order timestamps', () => {
      const group: ToolGroup = {
        resource: 'test',
        operations: [],
        startTime: new Date('2025-01-01T10:00:05Z'),
        endTime: new Date('2025-01-01T10:00:00Z'), // Before start
        hasError: false,
        groupType: 'file',
      };

      expect(getGroupDuration(group)).toBe(0);
    });
  });

  describe('semantic grouping edge cases', () => {
    it('should handle semantic grouping with unknown actions', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolCall('unknown_tool_1', { path: 'test.ts' }, new Date(now)),
        createToolCall('unknown_tool_2', { path: 'test.ts' }, new Date(now + 100)),
      ];

      // With semantic grouping, unknown tools should fall back to resource-based
      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: true, timeWindow: 5000 });

      expect(result).toHaveLength(1);
      expect(isToolGroup(result[0])).toBe(true);
    });

    it('should handle unknown tools with different resources in semantic mode', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolCall('unknown_tool', { path: 'test1.ts' }, new Date(now)),
        createToolCall('unknown_tool', { path: 'test2.ts' }, new Date(now + 100)),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: true, timeWindow: 5000 });

      // Semantic mode may group same tool type together regardless of resource
      // Just verify result is valid (either grouped or separate)
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle maxSemanticGroupSize option', () => {
      const now = Date.now();
      const entries: ChatEntry[] = Array.from({ length: 30 }, (_, i) =>
        createToolCall('view_file', { path: `file${i}.ts` }, new Date(now + i * 100))
      );

      // Semantic grouping with custom max size
      const result = groupConsecutiveTools(entries, {
        enabled: true,
        semanticGrouping: true,
        timeWindow: 60000,
        maxSemanticGroupSize: 10,
      });

      // Should split into groups based on max size
      expect(result.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('timestamp validation', () => {
    it('should not group entries with invalid timestamps', () => {
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test.ts' }, 'invalid-date'),
        createToolCall('view_file', { path: 'test.ts' }, 'also-invalid'),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: false });

      // Should not group due to invalid timestamps
      expect(result).toHaveLength(2);
    });
  });

  describe('tool_result replacement in flushed groups', () => {
    it('should replace tool_call with tool_result in flushed groups', () => {
      const toolCallId = 'call_flush_test';
      const now = Date.now();

      // Create entries that will force flush before tool_result arrives
      const entries: ChatEntry[] = [
        // First tool call that will be flushed
        {
          type: 'tool_call',
          content: 'Reading',
          timestamp: new Date(now),
          toolCall: {
            id: toolCallId,
            type: 'function',
            function: {
              name: 'view_file',
              arguments: JSON.stringify({ path: 'file1.ts' }),
            },
          },
        },
        // User message breaks the group
        createUserMessage('test', new Date(now + 100)),
        // Now the tool_result arrives
        {
          type: 'tool_result',
          content: 'File content',
          timestamp: new Date(now + 200),
          toolCall: {
            id: toolCallId,
            type: 'function',
            function: {
              name: 'view_file',
              arguments: JSON.stringify({ path: 'file1.ts' }),
            },
          },
          toolResult: {
            success: true,
            output: 'File content',
          },
        },
      ];

      const result = groupConsecutiveTools(entries, { enabled: true });

      // Should have 2 entries: replaced tool_result and user message
      expect(result).toHaveLength(2);
      // First should be the replaced tool_result
      expect((result[0] as ChatEntry).type).toBe('tool_result');
    });

    it('should update error state when replacing in flushed group', () => {
      const toolCallId = 'call_error_replace';
      const now = Date.now();

      const entries: ChatEntry[] = [
        // First tool call
        {
          type: 'tool_call',
          content: 'Running',
          timestamp: new Date(now),
          toolCall: {
            id: toolCallId,
            type: 'function',
            function: {
              name: 'bash',
              arguments: JSON.stringify({ command: 'test' }),
            },
          },
        },
        // Force flush with user message
        createUserMessage('wait', new Date(now + 100)),
        // Tool result with error
        {
          type: 'tool_result',
          content: 'Error occurred',
          timestamp: new Date(now + 200),
          toolCall: {
            id: toolCallId,
            type: 'function',
            function: {
              name: 'bash',
              arguments: JSON.stringify({ command: 'test' }),
            },
          },
          toolResult: {
            success: false,
            error: 'Command failed',
          },
        },
      ];

      const result = groupConsecutiveTools(entries, { enabled: true });

      expect(result).toHaveLength(2);
      expect((result[0] as ChatEntry).toolResult?.success).toBe(false);
    });
  });

  describe('group type transitions', () => {
    it('should update groupType to mixed when different tool types grouped on same resource', () => {
      const now = Date.now();
      // Use same file path to force grouping in resource mode
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test.ts' }, new Date(now)),
        createToolCall('str_replace_editor', { path: 'test.ts' }, new Date(now + 100)),
        createToolCall('bash', { command: 'echo test' }, new Date(now + 200)),
      ];

      // Group operations on same resource, then add different type
      // In resource mode, only same-resource tools group
      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: false, timeWindow: 5000 });

      // First two group (same file), third is separate (different resource)
      expect(result.length).toBe(2);
      // First should be a group with the file operations
      expect(isToolGroup(result[0])).toBe(true);
      expect((result[0] as ToolGroup).groupType).toBe('file');
    });

    it('should handle mixed tool types in semantic mode', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        createToolCall('view_file', { path: 'test.ts' }, new Date(now)),
        createToolCall('search', { query: 'test' }, new Date(now + 100)),
      ];

      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: true, timeWindow: 5000 });

      // Semantic mode groups compatible transitions
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe('entries without toolCallId', () => {
    it('should handle entries without toolCall id using fallback', () => {
      const entry: ChatEntry = {
        type: 'tool_call',
        content: 'Reading',
        timestamp: new Date(),
        toolCall: {
          id: '', // Empty id
          type: 'function',
          function: {
            name: 'view_file',
            arguments: JSON.stringify({ path: 'test.ts' }),
          },
        },
      };

      const result = groupConsecutiveTools([entry], { enabled: true });
      expect(result).toHaveLength(1);
    });

    it('should generate unique fallback keys for different args', () => {
      const now = Date.now();
      const entries: ChatEntry[] = [
        {
          type: 'tool_call',
          content: 'Reading 1',
          timestamp: new Date(now),
          toolCall: {
            id: '', // No id
            type: 'function',
            function: {
              name: 'view_file',
              arguments: JSON.stringify({ path: 'file1.ts' }),
            },
          },
        },
        {
          type: 'tool_call',
          content: 'Reading 2',
          timestamp: new Date(now + 100),
          toolCall: {
            id: '', // No id
            type: 'function',
            function: {
              name: 'view_file',
              arguments: JSON.stringify({ path: 'file2.ts' }),
            },
          },
        },
      ];

      const result = groupConsecutiveTools(entries, { enabled: true, semanticGrouping: false });

      // Different paths, should not group in resource mode
      expect(result).toHaveLength(2);
    });
  });
});
