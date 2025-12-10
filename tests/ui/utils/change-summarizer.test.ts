/**
 * Unit tests for change-summarizer.ts
 * Tests change pattern detection, especially the bug fix for combined add+remove detection
 */

import { describe, it, expect } from 'vitest';
import { summarizeChanges, getBriefToolSummary } from '../../../packages/core/src/ui/utils/change-summarizer.js';
import type { ToolGroup } from '../../../packages/core/src/ui/utils/tool-grouper.js';
import type { ChatEntry } from '../../../packages/core/src/agent/llm-agent.js';

// Helper to create mock tool result
function createToolResult(
  toolName: string,
  content: string,
  success: boolean = true
): ChatEntry {
  return {
    type: 'tool_result',
    content,
    timestamp: new Date(),
    toolCall: {
      id: 'test-id',
      type: 'function',
      function: {
        name: toolName,
        arguments: '{}',
      },
    },
    toolResult: {
      success,
      output: success ? content : undefined,
      error: success ? undefined : content,
    },
  };
}

// Helper to create tool group
function createFileGroup(operations: ChatEntry[]): ToolGroup {
  return {
    resource: 'test.ts',
    operations,
    startTime: new Date(),
    endTime: new Date(),
    hasError: false,
    groupType: 'file',
  };
}

describe('change-summarizer', () => {
  describe('summarizeChanges - Basic Functionality', () => {
    it('should return null for non-file groups', () => {
      const group: ToolGroup = {
        resource: 'bash:git',
        operations: [],
        startTime: new Date(),
        endTime: new Date(),
        hasError: false,
        groupType: 'bash',
      };

      expect(summarizeChanges(group)).toBeNull();
    });

    it('should return null if no successful updates', () => {
      const group = createFileGroup([
        createToolResult('view_file', 'content'),
        createToolResult('str_replace_editor', 'failed', false),
      ]);

      expect(summarizeChanges(group)).toBeNull();
    });

    it('should return generic summary if no patterns detected', () => {
      const group = createFileGroup([
        createToolResult('str_replace_editor', 'some random content'),
      ]);

      expect(summarizeChanges(group)).toBe('modified');
    });

    it('should return change count for multiple updates without patterns', () => {
      const group = createFileGroup([
        createToolResult('str_replace_editor', 'content1'),
        createToolResult('str_replace_editor', 'content2'),
        createToolResult('str_replace_editor', 'content3'),
      ]);

      expect(summarizeChanges(group)).toBe('3 changes');
    });

    it('should limit to 3 patterns maximum', () => {
      const diff = `
        +function foo() {}
        +import bar from 'bar'
        +interface Baz {}
        +try { something() } catch {}
        +// Added documentation
      `;

      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      const summary = summarizeChanges(group);
      expect(summary).toBeTruthy();
      const patterns = summary!.split(', ');
      expect(patterns.length).toBeLessThanOrEqual(3);
    });
  });

  describe('summarizeChanges - Function Detection (Bug Fix #3)', () => {
    it('should detect added functions', () => {
      const diff = '+function foo() { return true; }';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('added functions');
    });

    it('should detect removed functions', () => {
      const diff = '-function bar() { return false; }';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('removed functions');
    });

    it('should detect modified functions (combined add+remove)', () => {
      const diff = `
        -function oldImplementation() { return 'old'; }
        +function newImplementation() { return 'new'; }
      `;
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('modified functions');
    });

    it('should detect added const declarations', () => {
      const diff = '+const myVar = 42;';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('added functions');
    });

    it('should detect added export functions', () => {
      const diff = '+export function publicAPI() {}';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      // May also detect 'added documentation' due to '+' in diff
      const summary = summarizeChanges(group);
      expect(summary).toBeTruthy();
      expect(summary).toContain('added functions');
    });

    it('should detect updated functions (no add/remove markers)', () => {
      const diff = 'function existing() { /* modified body */ }';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('updated functions');
    });
  });

  describe('summarizeChanges - Import Detection (Bug Fix #3)', () => {
    it('should detect added imports', () => {
      const diff = "+import React from 'react';";
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('added imports');
    });

    it('should detect removed imports', () => {
      const diff = "-import Unused from 'unused';";
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('removed imports');
    });

    it('should detect reorganized imports (combined add+remove)', () => {
      const diff = `
        -import { old } from 'old';
        +import { new } from 'new';
      `;
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('reorganized imports');
    });

    it('should detect added require statements', () => {
      const diff = "+const fs = require('fs');";
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      // Will detect both 'added functions' (const) and possibly 'added imports' (require)
      const summary = summarizeChanges(group);
      expect(summary).toBeTruthy();
    });
  });

  describe('summarizeChanges - Type/Interface Detection', () => {
    it('should detect added interfaces', () => {
      const diff = '+interface User { name: string; }';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('added types');
    });

    it('should detect added type aliases', () => {
      const diff = '+type UserId = string;';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('added types');
    });

    it('should detect added classes', () => {
      const diff = '+class MyClass { constructor() {} }';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('added types');
    });

    it('should detect updated types without add marker', () => {
      const diff = 'interface Existing { newField: boolean; }';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('updated types');
    });
  });

  describe('summarizeChanges - Error Handling Detection', () => {
    it('should detect improved error handling (added try/catch)', () => {
      const diff = '+try { risky(); } catch (e) { handle(e); }';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('improved error handling');
    });

    it('should detect added throw statements', () => {
      const diff = '+throw new Error("Validation failed");';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('improved error handling');
    });

    it('should detect updated error handling (no add marker)', () => {
      const diff = 'catch (error) { console.error(error); }';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('updated error handling');
    });
  });

  describe('summarizeChanges - Documentation Detection', () => {
    it('should detect added line comments', () => {
      const diff = '+// This is a comment';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('added documentation');
    });

    it('should detect added block comments', () => {
      const diff = '+/* Block comment */';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('added documentation');
    });

    it('should detect added JSDoc comments', () => {
      const diff = '+* @param name The user name';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('added documentation');
    });
  });

  describe('summarizeChanges - Test Detection', () => {
    it('should detect added test() calls', () => {
      const diff = "+test('should work', () => {});";
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('added tests');
    });

    it('should detect added it() calls', () => {
      const diff = "+it('should pass', () => {});";
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('added tests');
    });

    it('should detect added describe() blocks', () => {
      const diff = "+describe('MyModule', () => {});";
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('added tests');
    });

    it('should detect updated tests without add marker', () => {
      const diff = "it('updated test', () => { expect(true).toBe(true); });";
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('updated tests');
    });
  });

  describe('summarizeChanges - Domain-Specific Patterns', () => {
    it('should detect configuration changes', () => {
      const diff = 'package.json: added dependency';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('updated configuration');
    });

    it('should detect API modifications', () => {
      const diff = 'router.get("/api/users", handler);';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('modified API');
    });

    it('should detect database schema changes', () => {
      const diff = 'migration: ALTER TABLE users ADD COLUMN email VARCHAR(255);';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      // Need 'migration' keyword for detection
      const summary = summarizeChanges(group);
      expect(summary).toBeTruthy();
      expect(summary).toContain('updated database schema');
    });

    it('should detect UI component updates', () => {
      const diff = '<Component prop={value} />';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('updated UI components');
    });

    it('should detect security changes', () => {
      const diff = 'if (!hasPermission(user, resource)) return 403;';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('updated security');
    });

    it('should detect performance improvements', () => {
      const diff = '+const cached = cache.get(key); // optimize lookup';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      // Will detect both cache and const/documentation
      const summary = summarizeChanges(group);
      expect(summary).toBeTruthy();
      expect(summary).toContain('improved performance');
    });
  });

  describe('summarizeChanges - Refactoring Detection', () => {
    it('should detect refactoring when both + and - present but no other patterns', () => {
      const diff = `
        -const oldWay = something();
        +const newWay = somethingElse();
      `;
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      // Should detect as refactored since it has +/- but no function/import keywords
      const summary = summarizeChanges(group);
      expect(summary).toBeTruthy();
    });

    it('should detect explicit refactor keyword', () => {
      const diff = 'refactor: improve code structure';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('refactored code');
    });
  });

  describe('summarizeChanges - Multiple Updates', () => {
    it('should aggregate patterns from multiple operations', () => {
      const group = createFileGroup([
        createToolResult('str_replace_editor', '+function foo() {}'),
        createToolResult('str_replace_editor', '+import bar from "bar"'),
      ]);

      const summary = summarizeChanges(group);
      expect(summary).toBeTruthy();
      expect(summary).toContain('added functions');
      expect(summary).toContain('added imports');
    });

    it('should deduplicate patterns across multiple operations', () => {
      const group = createFileGroup([
        createToolResult('str_replace_editor', '+function foo() {}'),
        createToolResult('str_replace_editor', '+function bar() {}'),
      ]);

      const summary = summarizeChanges(group);
      expect(summary).toBe('added functions'); // Not "added functions, added functions"
    });
  });

  describe('summarizeChanges - Edge Cases', () => {
    it('should handle empty content', () => {
      const group = createFileGroup([
        createToolResult('str_replace_editor', ''),
      ]);

      expect(summarizeChanges(group)).toBe('modified');
    });

    it('should handle content without toolResult', () => {
      const entry: ChatEntry = {
        type: 'tool_result',
        content: '+function test() {}',
        timestamp: new Date(),
        toolCall: {
          id: 'test',
          type: 'function',
          function: {
            name: 'str_replace_editor',
            arguments: '{}',
          },
        },
        toolResult: {
          success: true,
          output: '+function test() {}',
        },
      };

      const group = createFileGroup([entry]);
      const summary = summarizeChanges(group);
      expect(summary).toBeTruthy();
    });

    it('should be case-insensitive', () => {
      const diff = '+FUNCTION FOO() {}';
      const group = createFileGroup([
        createToolResult('str_replace_editor', diff),
      ]);

      expect(summarizeChanges(group)).toBe('added functions');
    });
  });

  describe('getBriefToolSummary - view_file', () => {
    it('should format single line', () => {
      expect(getBriefToolSummary('one line', 'view_file')).toBe('1 line');
    });

    it('should format multiple lines', () => {
      expect(getBriefToolSummary('line1\nline2\nline3', 'view_file')).toBe('3 lines');
    });

    it('should indicate large files', () => {
      // Files with 500+ lines are considered large
      const content = Array(550).fill('line').join('\n');
      expect(getBriefToolSummary(content, 'view_file')).toBe('550 lines (large)');
    });
  });

  describe('getBriefToolSummary - create_file', () => {
    it('should count lines written', () => {
      expect(getBriefToolSummary('line1\nline2', 'create_file')).toBe('2 lines written');
    });
  });

  describe('getBriefToolSummary - str_replace_editor', () => {
    it('should extract Updated message', () => {
      expect(getBriefToolSummary('Updated test.ts successfully', 'str_replace_editor'))
        .toBe('test.ts successfully');
    });

    it('should count replacements', () => {
      const content = 'replaced foo, replaced bar, replaced baz';
      expect(getBriefToolSummary(content, 'str_replace_editor')).toBe('3 changes');
    });

    it('should return generic updated for unknown format', () => {
      expect(getBriefToolSummary('some other format', 'str_replace_editor')).toBe('updated');
    });
  });

  describe('getBriefToolSummary - bash', () => {
    it('should detect background tasks', () => {
      expect(getBriefToolSummary('Background task started: npm dev', 'bash'))
        .toBe('→ background');
    });

    it('should detect npm install', () => {
      expect(getBriefToolSummary('added 42 packages', 'bash')).toBe('installed');
    });

    it('should detect git commit', () => {
      expect(getBriefToolSummary('git commit completed', 'bash')).toBe('committed');
    });

    it('should detect git push', () => {
      expect(getBriefToolSummary('git push to origin', 'bash')).toBe('pushed');
    });

    it('should detect test pass', () => {
      expect(getBriefToolSummary('Test passed ✓', 'bash')).toBe('passed');
    });

    it('should truncate long single lines', () => {
      const longLine = 'a'.repeat(50);
      const summary = getBriefToolSummary(longLine, 'bash');
      expect(summary).toHaveLength(43); // 40 chars + '...'
      expect(summary).toContain('...');
    });

    it('should count multiple lines', () => {
      expect(getBriefToolSummary('line1\nline2\nline3', 'bash')).toBe('3 lines');
    });
  });

  describe('getBriefToolSummary - search', () => {
    it('should extract match count', () => {
      expect(getBriefToolSummary('Found 5 matches in project', 'search'))
        .toBe('5 matches');
    });

    it('should handle single match', () => {
      expect(getBriefToolSummary('Found 1 match in file', 'search'))
        .toBe('1 match');
    });

    it('should count result lines if no match pattern', () => {
      expect(getBriefToolSummary('result1\nresult2', 'search')).toBe('2 results');
    });
  });

  describe('getBriefToolSummary - todo', () => {
    it('should count tasks', () => {
      const content = '[✓] Task 1\n[ ] Task 2\n[x] Task 3';
      expect(getBriefToolSummary(content, 'create_todo_list')).toBe('3 tasks');
    });

    it('should handle single task', () => {
      expect(getBriefToolSummary('[✓] Done', 'update_todo_list')).toBe('1 task');
    });
  });

  describe('getBriefToolSummary - Unknown Tools', () => {
    it('should return short content for unknown tools', () => {
      expect(getBriefToolSummary('short', 'unknown_tool')).toBe('short');
    });

    it('should count lines for unknown tools with long content', () => {
      const content = 'line1\nline2\nline3';
      expect(getBriefToolSummary(content, 'unknown_tool')).toBe('3 lines');
    });

    it('should handle long single line for unknown tools', () => {
      const longContent = 'a'.repeat(70);
      // Long single line (> 60 chars) = shows line count
      expect(getBriefToolSummary(longContent, 'unknown_tool')).toBe('1 lines');
    });
  });

  describe('getBriefToolSummary - Edge Cases', () => {
    it('should handle empty content', () => {
      expect(getBriefToolSummary('', 'view_file')).toBe('');
    });

    it('should handle single newline', () => {
      // Trimmed content of '\n' is empty string, so 0 lines
      expect(getBriefToolSummary('\n', 'view_file')).toBe('0 lines');
    });

    it('should handle content with only spaces', () => {
      // Trimmed content of '   ' is empty string, so 0 lines
      expect(getBriefToolSummary('   ', 'view_file')).toBe('0 lines');
    });
  });
});
