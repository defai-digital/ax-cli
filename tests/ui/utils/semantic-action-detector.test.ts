/**
 * Tests for Semantic Action Detector
 */

import { describe, it, expect } from 'vitest';
import {
  SemanticAction,
  detectSingleAction,
  detectSemanticAction,
  isCompatibleTransition,
  getActionDescription,
  formatActionWithCounts,
} from '../../../src/ui/utils/semantic-action-detector.js';
import type { ChatEntry } from '../../../src/agent/llm-agent.js';

// Helper to create mock ChatEntry
function createToolCallEntry(toolName: string, args: Record<string, unknown>): ChatEntry {
  return {
    type: 'tool_call',
    toolCall: {
      id: `call_${Date.now()}`,
      type: 'function',
      function: {
        name: toolName,
        arguments: JSON.stringify(args),
      },
    },
    timestamp: new Date(),
  };
}

describe('SemanticActionDetector', () => {
  describe('detectSingleAction', () => {
    it('should detect view_file as Exploring', () => {
      const entry = createToolCallEntry('view_file', { path: '/src/index.ts' });
      expect(detectSingleAction(entry)).toBe(SemanticAction.Exploring);
    });

    it('should detect view_file on config as Configuring', () => {
      const entry = createToolCallEntry('view_file', { path: '/tsconfig.json' });
      expect(detectSingleAction(entry)).toBe(SemanticAction.Configuring);
    });

    it('should detect search as Searching', () => {
      const entry = createToolCallEntry('search', { query: 'function' });
      expect(detectSingleAction(entry)).toBe(SemanticAction.Searching);
    });

    it('should detect str_replace_editor as Implementing', () => {
      const entry = createToolCallEntry('str_replace_editor', { path: '/src/app.ts' });
      expect(detectSingleAction(entry)).toBe(SemanticAction.Implementing);
    });

    it('should detect str_replace_editor on config as Configuring', () => {
      const entry = createToolCallEntry('str_replace_editor', { path: '/package.json' });
      expect(detectSingleAction(entry)).toBe(SemanticAction.Configuring);
    });

    it('should detect create_file as Implementing', () => {
      const entry = createToolCallEntry('create_file', { path: '/src/new-file.ts' });
      expect(detectSingleAction(entry)).toBe(SemanticAction.Implementing);
    });

    it('should detect bash with test command as Testing', () => {
      const entry = createToolCallEntry('bash', { command: 'npm test' });
      expect(detectSingleAction(entry)).toBe(SemanticAction.Testing);
    });

    it('should detect bash with vitest as Testing', () => {
      const entry = createToolCallEntry('bash', { command: 'npx vitest run' });
      expect(detectSingleAction(entry)).toBe(SemanticAction.Testing);
    });

    it('should detect bash with build command as Building', () => {
      const entry = createToolCallEntry('bash', { command: 'npm run build' });
      expect(detectSingleAction(entry)).toBe(SemanticAction.Building);
    });

    it('should detect bash with tsc as Building', () => {
      const entry = createToolCallEntry('bash', { command: 'tsc --noEmit' });
      expect(detectSingleAction(entry)).toBe(SemanticAction.Building);
    });

    it('should detect analyze_architecture as Analyzing', () => {
      const entry = createToolCallEntry('analyze_architecture', { projectPath: '/src' });
      expect(detectSingleAction(entry)).toBe(SemanticAction.Analyzing);
    });

    it('should return Unknown for unrecognized tools', () => {
      const entry = createToolCallEntry('unknown_tool', {});
      expect(detectSingleAction(entry)).toBe(SemanticAction.Unknown);
    });

    it('should return Unknown for non-tool entries', () => {
      const entry: ChatEntry = {
        type: 'assistant',
        content: 'Hello',
        timestamp: new Date(),
      };
      expect(detectSingleAction(entry)).toBe(SemanticAction.Unknown);
    });
  });

  describe('detectSemanticAction', () => {
    it('should detect multiple reads as Exploring', () => {
      const entries = [
        createToolCallEntry('view_file', { path: '/src/index.ts' }),
        createToolCallEntry('view_file', { path: '/src/app.ts' }),
        createToolCallEntry('view_file', { path: '/src/utils.ts' }),
      ];
      expect(detectSemanticAction(entries)).toBe(SemanticAction.Exploring);
    });

    it('should detect search + reads as Searching', () => {
      const entries = [
        createToolCallEntry('search', { query: 'function' }),
        createToolCallEntry('view_file', { path: '/src/index.ts' }),
      ];
      expect(detectSemanticAction(entries)).toBe(SemanticAction.Searching);
    });

    it('should detect multiple edits across files as Refactoring', () => {
      const entries = [
        createToolCallEntry('str_replace_editor', { path: '/src/index.ts' }),
        createToolCallEntry('str_replace_editor', { path: '/src/app.ts' }),
      ];
      expect(detectSemanticAction(entries)).toBe(SemanticAction.Refactoring);
    });

    it('should detect create + edit as Implementing', () => {
      const entries = [
        createToolCallEntry('create_file', { path: '/src/new.ts' }),
        createToolCallEntry('str_replace_editor', { path: '/src/new.ts' }),
      ];
      expect(detectSemanticAction(entries)).toBe(SemanticAction.Implementing);
    });

    it('should prioritize Testing over other actions', () => {
      const entries = [
        createToolCallEntry('view_file', { path: '/src/index.ts' }),
        createToolCallEntry('bash', { command: 'npm test' }),
      ];
      expect(detectSemanticAction(entries)).toBe(SemanticAction.Testing);
    });

    it('should return Unknown for empty entries', () => {
      expect(detectSemanticAction([])).toBe(SemanticAction.Unknown);
    });

    it('should handle single entry', () => {
      const entries = [createToolCallEntry('view_file', { path: '/src/index.ts' })];
      expect(detectSemanticAction(entries)).toBe(SemanticAction.Exploring);
    });
  });

  describe('isCompatibleTransition', () => {
    it('should return true for same action', () => {
      expect(isCompatibleTransition(SemanticAction.Exploring, SemanticAction.Exploring)).toBe(true);
    });

    it('should allow Searching -> Exploring transition', () => {
      expect(isCompatibleTransition(SemanticAction.Searching, SemanticAction.Exploring)).toBe(true);
    });

    it('should allow Exploring -> Implementing transition', () => {
      expect(isCompatibleTransition(SemanticAction.Exploring, SemanticAction.Implementing)).toBe(true);
    });

    it('should allow Implementing -> Testing transition', () => {
      expect(isCompatibleTransition(SemanticAction.Implementing, SemanticAction.Testing)).toBe(true);
    });

    it('should allow Testing -> Implementing transition', () => {
      expect(isCompatibleTransition(SemanticAction.Testing, SemanticAction.Implementing)).toBe(true);
    });

    it('should not allow Testing -> Searching transition', () => {
      expect(isCompatibleTransition(SemanticAction.Testing, SemanticAction.Searching)).toBe(false);
    });

    it('should return false for Unknown actions', () => {
      expect(isCompatibleTransition(SemanticAction.Unknown, SemanticAction.Exploring)).toBe(false);
      expect(isCompatibleTransition(SemanticAction.Exploring, SemanticAction.Unknown)).toBe(false);
    });
  });

  describe('getActionDescription', () => {
    it('should return correct descriptions', () => {
      expect(getActionDescription(SemanticAction.Exploring)).toBe('Exploring codebase');
      expect(getActionDescription(SemanticAction.Searching)).toBe('Searching');
      expect(getActionDescription(SemanticAction.Implementing)).toBe('Implementing changes');
      expect(getActionDescription(SemanticAction.Testing)).toBe('Running tests');
      expect(getActionDescription(SemanticAction.Building)).toBe('Building project');
      expect(getActionDescription(SemanticAction.Analyzing)).toBe('Analyzing codebase');
      expect(getActionDescription(SemanticAction.Refactoring)).toBe('Refactoring code');
      expect(getActionDescription(SemanticAction.Configuring)).toBe('Updating configuration');
      expect(getActionDescription(SemanticAction.Unknown)).toBe('Working');
    });
  });

  describe('formatActionWithCounts', () => {
    it('should format Exploring with read count', () => {
      const result = formatActionWithCounts(SemanticAction.Exploring, {
        reads: 5,
        edits: 0,
        creates: 0,
        searches: 0,
        commands: 0,
        files: 5,
      });
      expect(result).toBe('Exploring codebase (5 reads)');
    });

    it('should format Implementing with edit and create counts', () => {
      const result = formatActionWithCounts(SemanticAction.Implementing, {
        reads: 2,
        edits: 3,
        creates: 1,
        searches: 0,
        commands: 0,
        files: 4,
      });
      expect(result).toBe('Implementing changes (3 edits, 1 create)');
    });

    it('should format Testing with command count', () => {
      const result = formatActionWithCounts(SemanticAction.Testing, {
        reads: 0,
        edits: 0,
        creates: 0,
        searches: 0,
        commands: 2,
        files: 0,
      });
      expect(result).toBe('Running tests (2 commands)');
    });

    it('should handle singular forms', () => {
      const result = formatActionWithCounts(SemanticAction.Exploring, {
        reads: 1,
        edits: 0,
        creates: 0,
        searches: 0,
        commands: 0,
        files: 1,
      });
      expect(result).toBe('Exploring codebase (1 read)');
    });

    it('should handle zero counts gracefully', () => {
      const result = formatActionWithCounts(SemanticAction.Exploring, {
        reads: 0,
        edits: 0,
        creates: 0,
        searches: 0,
        commands: 0,
        files: 0,
      });
      expect(result).toBe('Exploring codebase');
    });
  });
});
