/**
 * Tests for agent/status-reporter module
 * Tests status reporting and context summary generation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  StatusReporter,
  getStatusReporter,
  resetStatusReporter,
  type ContextSummary,
} from '../../packages/core/src/agent/status-reporter.js';
import type { ChatEntry } from '../../packages/core/src/agent/llm-agent.js';
import type { LLMMessage } from '../../packages/core/src/llm/client.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import * as fs from 'fs/promises';

describe('StatusReporter', () => {
  let reporter: StatusReporter;

  beforeEach(() => {
    vi.clearAllMocks();
    resetStatusReporter();
    reporter = new StatusReporter('/tmp/test-output');
  });

  describe('constructor', () => {
    it('should create reporter with custom output directory', () => {
      const customReporter = new StatusReporter('/custom/path');
      expect(customReporter).toBeInstanceOf(StatusReporter);
    });

    it('should create reporter with default output directory', () => {
      const defaultReporter = new StatusReporter();
      expect(defaultReporter).toBeInstanceOf(StatusReporter);
    });
  });

  describe('generateContextSummary', () => {
    const mockMessages: LLMMessage[] = [
      { role: 'user', content: 'Please fix the bug' },
      { role: 'assistant', content: 'I will fix it now' },
    ];

    const mockChatHistory: ChatEntry[] = [
      { type: 'user', content: 'Please fix the bug', timestamp: new Date() },
      { type: 'assistant', content: 'I will fix it now', timestamp: new Date() },
    ];

    it('should generate context summary', async () => {
      const summary = await reporter.generateContextSummary(
        mockMessages,
        mockChatHistory,
        'user_request',
        5000
      );

      expect(summary.reason).toBe('user_request');
      expect(summary.messageCount).toBe(2);
      expect(summary.tokenCount).toBe(5000);
      expect(summary.timestamp).toBeInstanceOf(Date);
    });

    it('should save summary to disk', async () => {
      const summary = await reporter.generateContextSummary(
        mockMessages,
        mockChatHistory,
        'context_overflow',
        10000
      );

      expect(fs.mkdir).toHaveBeenCalledWith('/tmp/test-output', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalled();
      expect(summary.path).toBeDefined();
    });

    it('should extract current task from last user message', async () => {
      const summary = await reporter.generateContextSummary(
        mockMessages,
        mockChatHistory,
        'user_request',
        5000
      );

      expect(summary.currentTask).toBe('Please fix the bug');
    });

    it('should handle empty chat history', async () => {
      const summary = await reporter.generateContextSummary(
        [],
        [],
        'user_request',
        0
      );

      expect(summary.currentTask).toBe('Unknown');
      expect(summary.shortSummary).toBe('');
      expect(summary.keyActions).toEqual([]);
      expect(summary.filesModified).toEqual([]);
      expect(summary.nextSteps).toEqual([]);
    });
  });

  describe('generateStatusReport', () => {
    const mockMessages: LLMMessage[] = [
      { role: 'user', content: 'Run the tests' },
      { role: 'assistant', content: 'Tests completed successfully' },
    ];

    const mockChatHistory: ChatEntry[] = [
      { type: 'user', content: 'Run the tests', timestamp: new Date() },
      { type: 'assistant', content: 'Tests completed successfully', timestamp: new Date() },
    ];

    it('should generate status report without plan', async () => {
      const report = await reporter.generateStatusReport({
        messages: mockMessages,
        chatHistory: mockChatHistory,
        tokenCount: 5000,
      });

      expect(report.session).toBeDefined();
      expect(report.session.messageCount).toBe(2);
      expect(report.session.tokenUsage).toBe(5000);
      expect(report.session.duration).toBeGreaterThanOrEqual(0);
      expect(report.plan).toBeUndefined();
    });

    it('should generate status report with plan', async () => {
      const mockPlan = {
        id: 'plan-123',
        originalPrompt: 'Implement new feature',
        status: 'completed',
        phasesCompleted: 2,
        phasesFailed: 0,
        phases: [
          { name: 'Phase 1', status: 'completed', duration: 1000, tokensUsed: 500, filesModified: ['file1.ts'] },
          { name: 'Phase 2', status: 'completed', duration: 2000, tokensUsed: 800, filesModified: [] },
        ],
      };

      const report = await reporter.generateStatusReport({
        messages: mockMessages,
        chatHistory: mockChatHistory,
        tokenCount: 5000,
        plan: mockPlan as any,
      });

      expect(report.plan).toBeDefined();
      expect(report.plan?.id).toBe('plan-123');
      expect(report.plan?.progress.completed).toBe(2);
      expect(report.plan?.progress.total).toBe(2);
      expect(report.plan?.progress.percentage).toBe(100);
    });

    it('should calculate progress percentage correctly', async () => {
      const mockPlan = {
        id: 'plan-456',
        originalPrompt: 'Test plan',
        status: 'in_progress',
        phasesCompleted: 1,
        phasesFailed: 1,
        phases: [
          { name: 'Phase 1', status: 'completed', filesModified: [] },
          { name: 'Phase 2', status: 'failed', filesModified: [] },
          { name: 'Phase 3', status: 'pending', filesModified: [] },
          { name: 'Phase 4', status: 'pending', filesModified: [] },
        ],
      };

      const report = await reporter.generateStatusReport({
        messages: mockMessages,
        chatHistory: mockChatHistory,
        tokenCount: 5000,
        plan: mockPlan as any,
      });

      expect(report.plan?.progress.percentage).toBe(25); // 1/4 = 25%
    });
  });

  describe('extractShortSummary', () => {
    it('should extract summary from assistant messages', async () => {
      const chatHistory: ChatEntry[] = [
        { type: 'assistant', content: 'First assistant message', timestamp: new Date() },
        { type: 'assistant', content: 'Second assistant message', timestamp: new Date() },
      ];

      const summary = await reporter.generateContextSummary([], chatHistory, 'user_request', 0);

      expect(summary.shortSummary).toContain('First assistant message');
      expect(summary.shortSummary).toContain('Second assistant message');
    });

    it('should truncate long summaries', async () => {
      const longContent = 'A'.repeat(300);
      const chatHistory: ChatEntry[] = [
        { type: 'assistant', content: longContent, timestamp: new Date() },
      ];

      const summary = await reporter.generateContextSummary([], chatHistory, 'user_request', 0);

      expect(summary.shortSummary.length).toBeLessThanOrEqual(203); // 200 + '...'
      expect(summary.shortSummary.endsWith('...')).toBe(true);
    });
  });

  describe('extractKeyActions', () => {
    it('should extract text_editor create actions', async () => {
      const chatHistory: ChatEntry[] = [
        {
          type: 'tool_result',
          content: 'File created',
          timestamp: new Date(),
          toolResult: { success: true },
          toolCall: {
            id: '1',
            type: 'function',
            function: {
              name: 'text_editor',
              arguments: JSON.stringify({ command: 'create', path: '/path/to/file.ts' }),
            },
          },
        },
      ];

      const summary = await reporter.generateContextSummary([], chatHistory, 'user_request', 0);

      expect(summary.keyActions).toContain('Created /path/to/file.ts');
    });

    it('should extract text_editor str_replace actions', async () => {
      const chatHistory: ChatEntry[] = [
        {
          type: 'tool_result',
          content: 'File modified',
          timestamp: new Date(),
          toolResult: { success: true },
          toolCall: {
            id: '1',
            type: 'function',
            function: {
              name: 'text_editor_20241022',
              arguments: JSON.stringify({ command: 'str_replace', path: '/path/to/file.ts' }),
            },
          },
        },
      ];

      const summary = await reporter.generateContextSummary([], chatHistory, 'user_request', 0);

      expect(summary.keyActions).toContain('Modified /path/to/file.ts');
    });

    it('should extract bash commands', async () => {
      const chatHistory: ChatEntry[] = [
        {
          type: 'tool_result',
          content: 'Command ran',
          timestamp: new Date(),
          toolResult: { success: true },
          toolCall: {
            id: '1',
            type: 'function',
            function: {
              name: 'bash',
              arguments: JSON.stringify({ command: 'npm test' }),
            },
          },
        },
      ];

      const summary = await reporter.generateContextSummary([], chatHistory, 'user_request', 0);

      expect(summary.keyActions).toContain('Ran: npm test');
    });

    it('should not extract view or search operations', async () => {
      const chatHistory: ChatEntry[] = [
        {
          type: 'tool_result',
          content: 'File viewed',
          timestamp: new Date(),
          toolResult: { success: true },
          toolCall: {
            id: '1',
            type: 'function',
            function: {
              name: 'text_editor',
              arguments: JSON.stringify({ command: 'view', path: '/path/to/file.ts' }),
            },
          },
        },
        {
          type: 'tool_result',
          content: 'Search result',
          timestamp: new Date(),
          toolResult: { success: true },
          toolCall: {
            id: '2',
            type: 'function',
            function: {
              name: 'search',
              arguments: JSON.stringify({ query: 'test' }),
            },
          },
        },
      ];

      const summary = await reporter.generateContextSummary([], chatHistory, 'user_request', 0);

      expect(summary.keyActions).toEqual([]);
    });

    it('should skip cat and ls commands', async () => {
      const chatHistory: ChatEntry[] = [
        {
          type: 'tool_result',
          content: 'Command ran',
          timestamp: new Date(),
          toolResult: { success: true },
          toolCall: {
            id: '1',
            type: 'function',
            function: {
              name: 'bash',
              arguments: JSON.stringify({ command: 'cat file.txt' }),
            },
          },
        },
      ];

      const summary = await reporter.generateContextSummary([], chatHistory, 'user_request', 0);

      expect(summary.keyActions).not.toContain('Ran: cat file.txt');
    });

    it('should limit to last 10 actions', async () => {
      const chatHistory: ChatEntry[] = [];
      for (let i = 0; i < 15; i++) {
        chatHistory.push({
          type: 'tool_result',
          content: 'File created',
          timestamp: new Date(),
          toolResult: { success: true },
          toolCall: {
            id: `${i}`,
            type: 'function',
            function: {
              name: 'text_editor',
              arguments: JSON.stringify({ command: 'create', path: `/path/to/file${i}.ts` }),
            },
          },
        });
      }

      const summary = await reporter.generateContextSummary([], chatHistory, 'user_request', 0);

      expect(summary.keyActions.length).toBe(10);
    });
  });

  describe('extractFilesModified', () => {
    it('should extract created files', async () => {
      const chatHistory: ChatEntry[] = [
        {
          type: 'tool_result',
          content: 'Created',
          timestamp: new Date(),
          toolResult: { success: true },
          toolCall: {
            id: '1',
            type: 'function',
            function: {
              name: 'text_editor',
              arguments: JSON.stringify({ command: 'create', path: '/path/new-file.ts' }),
            },
          },
        },
      ];

      const summary = await reporter.generateContextSummary([], chatHistory, 'user_request', 0);

      expect(summary.filesModified).toEqual([{ path: '/path/new-file.ts', type: 'created' }]);
    });

    it('should extract modified files', async () => {
      const chatHistory: ChatEntry[] = [
        {
          type: 'tool_result',
          content: 'Modified',
          timestamp: new Date(),
          toolResult: { success: true },
          toolCall: {
            id: '1',
            type: 'function',
            function: {
              name: 'text_editor_20241022',
              arguments: JSON.stringify({ command: 'str_replace', path: '/path/existing.ts' }),
            },
          },
        },
      ];

      const summary = await reporter.generateContextSummary([], chatHistory, 'user_request', 0);

      expect(summary.filesModified).toEqual([{ path: '/path/existing.ts', type: 'modified' }]);
    });

    it('should not override created status with modified', async () => {
      const chatHistory: ChatEntry[] = [
        {
          type: 'tool_result',
          content: 'Created',
          timestamp: new Date(),
          toolResult: { success: true },
          toolCall: {
            id: '1',
            type: 'function',
            function: {
              name: 'text_editor',
              arguments: JSON.stringify({ command: 'create', path: '/path/file.ts' }),
            },
          },
        },
        {
          type: 'tool_result',
          content: 'Modified',
          timestamp: new Date(),
          toolResult: { success: true },
          toolCall: {
            id: '2',
            type: 'function',
            function: {
              name: 'text_editor',
              arguments: JSON.stringify({ command: 'str_replace', path: '/path/file.ts' }),
            },
          },
        },
      ];

      const summary = await reporter.generateContextSummary([], chatHistory, 'user_request', 0);

      // Should still show as 'created' not 'modified'
      expect(summary.filesModified).toEqual([{ path: '/path/file.ts', type: 'created' }]);
    });
  });

  describe('extractNextSteps', () => {
    it('should extract sentences with future action keywords', async () => {
      const chatHistory: ChatEntry[] = [
        {
          type: 'assistant',
          content: 'I completed the first step. Now I will implement the tests. Next, we should deploy.',
          timestamp: new Date(),
        },
      ];

      const summary = await reporter.generateContextSummary([], chatHistory, 'user_request', 0);

      expect(summary.nextSteps.some(s => s.includes('will implement'))).toBe(true);
      expect(summary.nextSteps.some(s => s.includes('Next') || s.includes('should'))).toBe(true);
    });

    it('should limit to 3 next steps', async () => {
      const chatHistory: ChatEntry[] = [
        {
          type: 'assistant',
          content: 'Now I will do step 1. Then I will do step 2. After that I will do step 3. Next I will do step 4. Finally I will do step 5.',
          timestamp: new Date(),
        },
      ];

      const summary = await reporter.generateContextSummary([], chatHistory, 'user_request', 0);

      expect(summary.nextSteps.length).toBeLessThanOrEqual(3);
    });
  });
});

describe('getStatusReporter', () => {
  beforeEach(() => {
    resetStatusReporter();
  });

  it('should return singleton instance', () => {
    const reporter1 = getStatusReporter();
    const reporter2 = getStatusReporter();

    expect(reporter1).toBe(reporter2);
  });

  it('should return StatusReporter instance', () => {
    const reporter = getStatusReporter();
    expect(reporter).toBeInstanceOf(StatusReporter);
  });
});

describe('resetStatusReporter', () => {
  it('should reset singleton instance', () => {
    const reporter1 = getStatusReporter();
    resetStatusReporter();
    const reporter2 = getStatusReporter();

    expect(reporter1).not.toBe(reporter2);
  });
});
