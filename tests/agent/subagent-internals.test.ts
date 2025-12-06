/**
 * Tests for Subagent internal methods and execution paths
 *
 * These tests use a testable subclass to access protected/private methods
 * and inject mock dependencies for comprehensive coverage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { Subagent } from '../../src/agent/subagent.js';
import { SubagentRole, SubagentState } from '../../src/agent/subagent-types.js';
import type { SubagentTask, SubagentConfig } from '../../src/agent/subagent-types.js';
import type { LLMMessage, LLMTool } from '../../src/llm/client.js';

// Create a testable subclass that exposes protected members
class TestableSubagent extends Subagent {
  // Expose protected members for testing
  public get testMessages(): LLMMessage[] {
    return this.messages;
  }

  public get testChatHistory() {
    return this.chatHistory;
  }

  public get testTools() {
    return this.tools;
  }

  public get testIsActive(): boolean {
    return this.isActive;
  }

  public set testIsActive(value: boolean) {
    this.isActive = value;
  }

  public get testCurrentTaskId(): string | null {
    return this.currentTaskId;
  }

  public set testCurrentTaskId(value: string | null) {
    this.currentTaskId = value;
  }

  // Method to inject a mock LLM client
  public setMockLLMClient(mockClient: { chat: ReturnType<typeof vi.fn> }): void {
    (this as unknown as { llmClient: typeof mockClient }).llmClient = mockClient;
  }

  // Method to add tools for testing
  public addTestTool(
    name: string,
    tool: { execute: ReturnType<typeof vi.fn>; getToolDefinition?: () => LLMTool }
  ): void {
    this.tools.set(name, tool);
  }

  // Expose buildSystemPrompt for testing
  public testBuildSystemPrompt(): string {
    return this.buildSystemPrompt();
  }
}

describe('Subagent Internals', () => {
  let subagent: TestableSubagent;

  beforeEach(() => {
    process.env.GROK_API_KEY = 'test-api-key';
    process.env.GROK_MODEL = 'test-model';
    process.env.AI_BASE_URL = 'http://localhost:11434/v1';
  });

  afterEach(() => {
    if (subagent) {
      subagent.abort();
    }
  });

  describe('System Prompt Building', () => {
    it('should use default system prompt when none provided', () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const prompt = subagent.testBuildSystemPrompt();

      expect(prompt).toContain('testing');
      expect(prompt).toContain('agent');
    });

    it('should use custom system prompt when provided', () => {
      subagent = new TestableSubagent(SubagentRole.TESTING, {
        customSystemPrompt: 'Custom prompt for testing',
      });

      const prompt = subagent.testBuildSystemPrompt();

      expect(prompt).toBe('Custom prompt for testing');
    });

    it('should include role name in default prompt', () => {
      subagent = new TestableSubagent(SubagentRole.DOCUMENTATION);

      const prompt = subagent.testBuildSystemPrompt();

      expect(prompt).toContain('documentation');
    });
  });

  describe('Message Management', () => {
    it('should initialize with system message', () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const messages = subagent.testMessages;

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].role).toBe('system');
    });

    it('should have empty chat history initially', () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      expect(subagent.testChatHistory).toEqual([]);
    });
  });

  describe('Tool Management', () => {
    it('should initialize tools based on role', () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      // TESTING role should have bash tool
      expect(subagent.testTools.has('bash')).toBe(true);
    });

    it('should not have tools not in allowedTools', () => {
      subagent = new TestableSubagent(SubagentRole.TESTING, {
        allowedTools: ['bash'],
      });

      // Only bash should be present
      expect(subagent.testTools.has('bash')).toBe(true);
      expect(subagent.testTools.has('search')).toBe(false);
    });

    it('should initialize all allowed tools', () => {
      subagent = new TestableSubagent(SubagentRole.TESTING, {
        allowedTools: ['bash', 'text_editor', 'search'],
      });

      expect(subagent.testTools.has('bash')).toBe(true);
      expect(subagent.testTools.has('text_editor')).toBe(true);
      expect(subagent.testTools.has('search')).toBe(true);
    });
  });

  describe('Active State Management', () => {
    it('should start inactive', () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      expect(subagent.testIsActive).toBe(false);
    });

    it('should have no current task initially', () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      expect(subagent.testCurrentTaskId).toBeNull();
    });
  });

  describe('Execute Task with Mock LLM', () => {
    it('should complete successfully with simple response', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockChat = vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Task completed successfully',
              tool_calls: null,
            },
          },
        ],
      });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'mock-task-1',
        description: 'Test task',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Task completed successfully');
      expect(result.taskId).toBe('mock-task-1');
      expect(mockChat).toHaveBeenCalled();
    });

    it('should accumulate output from multiple rounds', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      // Add a mock tool
      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'Tool output' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      let callCount = 0;
      const mockChat = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            choices: [
              {
                message: {
                  content: 'First response',
                  tool_calls: [
                    {
                      id: 'call1',
                      type: 'function',
                      function: { name: 'test_tool', arguments: '{}' },
                    },
                  ],
                },
              },
            ],
          });
        }
        return Promise.resolve({
          choices: [
            {
              message: {
                content: 'Second response - done',
                tool_calls: null,
              },
            },
          ],
        });
      });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'multi-round-task',
        description: 'Multi-round test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('First response');
      expect(result.output).toContain('Second response');
      expect(mockTool.execute).toHaveBeenCalled();
    });

    it('should handle empty LLM response', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockChat = vi.fn().mockResolvedValue({
        choices: [],
      });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'empty-response-task',
        description: 'Test empty response',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No response from LLM');
    });

    it('should handle tool round limit', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING, { maxToolRounds: 2 });

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'output' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      // Always return tool calls to exhaust the limit
      const mockChat = vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Using tool',
              tool_calls: [
                {
                  id: 'call',
                  type: 'function',
                  function: { name: 'test_tool', arguments: '{}' },
                },
              ],
            },
          },
        ],
      });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'tool-limit-task',
        description: 'Test tool limit',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool round limit');
    });

    it('should handle timeout', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING, { timeout: 50 });

      // Mock a slow LLM response
      const mockChat = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  choices: [{ message: { content: 'Done', tool_calls: null } }],
                }),
              100
            )
          )
      );

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'timeout-task',
        description: 'Test timeout',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle unavailable tool gracefully', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Calling unavailable tool',
                tool_calls: [
                  {
                    id: 'bad-call',
                    type: 'function',
                    function: { name: 'nonexistent_tool', arguments: '{}' },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'bad-tool-task',
        description: 'Test bad tool',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      // Should complete even with unavailable tool
      expect(result.success).toBe(true);
    });

    it('should handle empty tool arguments', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'output' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Empty args',
                tool_calls: [
                  {
                    id: 'empty-args',
                    type: 'function',
                    function: { name: 'test_tool', arguments: '' },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'empty-args-task',
        description: 'Test empty args',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(true);
    });

    it('should track tool usage', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'output' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Using tool',
                tool_calls: [
                  {
                    id: 'track1',
                    type: 'function',
                    function: { name: 'test_tool', arguments: '{}' },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'track-tool-task',
        description: 'Track tool usage',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.status.toolsUsed).toContain('test_tool');
      expect(result.status.toolRoundsUsed).toBe(1);
    });

    it('should track file creation with text_editor', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'File created' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'text_editor', description: 'Edit', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('text_editor', mockTool);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Creating file',
                tool_calls: [
                  {
                    id: 'create1',
                    type: 'function',
                    function: {
                      name: 'text_editor',
                      arguments: JSON.stringify({ command: 'create', path: '/test/file.ts' }),
                    },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'file-create-task',
        description: 'Create file',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('/test/file.ts');
    });

    it('should track file modification with text_editor', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'File modified' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'text_editor', description: 'Edit', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('text_editor', mockTool);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Editing file',
                tool_calls: [
                  {
                    id: 'edit1',
                    type: 'function',
                    function: {
                      name: 'text_editor',
                      arguments: JSON.stringify({ command: 'edit', path: '/test/existing.ts' }),
                    },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'file-edit-task',
        description: 'Edit file',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.filesModified).toContain('/test/existing.ts');
    });
  });

  describe('Event Emission During Execution', () => {
    it('should emit progress events', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'output' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Progress 1',
                tool_calls: [
                  {
                    id: 'p1',
                    type: 'function',
                    function: { name: 'test_tool', arguments: '{}' },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const progressEvents: unknown[] = [];
      subagent.on('progress', (data) => progressEvents.push(data));

      const task: SubagentTask = {
        id: 'progress-task',
        description: 'Progress test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      await subagent.executeTask(task);

      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it('should emit tool-call and tool-result events', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'tool output' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Calling tool',
                tool_calls: [
                  {
                    id: 'tc1',
                    type: 'function',
                    function: { name: 'test_tool', arguments: '{}' },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const toolCalls: unknown[] = [];
      const toolResults: unknown[] = [];
      subagent.on('tool-call', (data) => toolCalls.push(data));
      subagent.on('tool-result', (data) => toolResults.push(data));

      const task: SubagentTask = {
        id: 'tool-events-task',
        description: 'Tool events test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      await subagent.executeTask(task);

      expect(toolCalls).toHaveLength(1);
      expect(toolResults).toHaveLength(1);
    });

    it('should emit task-completed on success', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockChat = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Done', tool_calls: null } }],
      });

      subagent.setMockLLMClient({ chat: mockChat });

      let completedEvent: unknown = null;
      subagent.on('task-completed', (data) => {
        completedEvent = data;
      });

      const task: SubagentTask = {
        id: 'complete-event-task',
        description: 'Complete event test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      await subagent.executeTask(task);

      expect(completedEvent).not.toBeNull();
    });

    it('should emit task-failed on error', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockChat = vi.fn().mockRejectedValue(new Error('LLM Error'));

      subagent.setMockLLMClient({ chat: mockChat });

      let failedEvent: { error?: string } | null = null;
      subagent.on('task-failed', (data) => {
        failedEvent = data;
      });

      const task: SubagentTask = {
        id: 'fail-event-task',
        description: 'Fail event test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(false);
      expect(failedEvent).not.toBeNull();
      expect(failedEvent?.error).toContain('LLM Error');
    });
  });

  describe('Abort During Execution', () => {
    it('should abort between tool calls', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'output' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      const mockChat = vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Using tools',
              tool_calls: [
                { id: 'c1', type: 'function', function: { name: 'test_tool', arguments: '{}' } },
                { id: 'c2', type: 'function', function: { name: 'test_tool', arguments: '{}' } },
              ],
            },
          },
        ],
      });

      subagent.setMockLLMClient({ chat: mockChat });

      // Abort after first tool result
      subagent.on('tool-result', () => {
        subagent.abort();
      });

      const task: SubagentTask = {
        id: 'abort-between-task',
        description: 'Abort between tools',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('aborted');
    });
  });

  describe('Context Handling', () => {
    it('should include working directory in context prompt', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      let capturedMessages: LLMMessage[] = [];
      const mockChat = vi.fn().mockImplementation((messages) => {
        capturedMessages = messages;
        return Promise.resolve({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });
      });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'wd-context-task',
        description: 'Test with working directory',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {
          metadata: {
            workingDirectory: '/test/path',
          },
        },
      };

      await subagent.executeTask(task);

      const userMessage = capturedMessages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('/test/path');
    });

    it('should include conversation history in context', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      let capturedMessages: LLMMessage[] = [];
      const mockChat = vi.fn().mockImplementation((messages) => {
        capturedMessages = messages;
        return Promise.resolve({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });
      });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'history-context-task',
        description: 'Test with history',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {
          conversationHistory: [
            { type: 'user', content: 'Previous user message', timestamp: new Date() },
            { type: 'assistant', content: 'Previous assistant response', timestamp: new Date() },
          ],
        },
      };

      await subagent.executeTask(task);

      const userMessage = capturedMessages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('Previous user message');
    });
  });

  describe('Tool Execution Error Handling', () => {
    it('should handle tool execution errors', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockRejectedValue(new Error('Tool execution failed')),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Calling tool',
                tool_calls: [
                  {
                    id: 'err1',
                    type: 'function',
                    function: { name: 'test_tool', arguments: '{}' },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'tool-error-task',
        description: 'Tool error test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      // Should still complete (tool error is handled, not fatal)
      expect(result.success).toBe(true);
    });

    it('should handle invalid JSON in tool arguments', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'output' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Invalid JSON',
                tool_calls: [
                  {
                    id: 'badjson',
                    type: 'function',
                    function: { name: 'test_tool', arguments: '{invalid json}' },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'invalid-json-task',
        description: 'Invalid JSON test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      // Should complete - invalid JSON results in empty args
      expect(result.success).toBe(true);
    });
  });

  describe('Unicode Handling in Tool Output', () => {
    it('should truncate unicode strings safely', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const longUnicode = '日本語テスト'.repeat(50);
      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: longUnicode }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Unicode test',
                tool_calls: [
                  {
                    id: 'unicode1',
                    type: 'function',
                    function: { name: 'test_tool', arguments: '{}' },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      let toolResultOutput: string | undefined;
      subagent.on('tool-result', (data: { output?: string }) => {
        toolResultOutput = data.output;
      });

      const task: SubagentTask = {
        id: 'unicode-task',
        description: 'Unicode test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      await subagent.executeTask(task);

      // Output should be truncated with '...'
      expect(toolResultOutput).toBeDefined();
      expect(toolResultOutput!.endsWith('...')).toBe(true);
    });
  });

  describe('Multiple Tool Calls Per Round', () => {
    it('should handle multiple tool calls in same round', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'output' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Multiple tools',
                tool_calls: [
                  { id: 'm1', type: 'function', function: { name: 'test_tool', arguments: '{}' } },
                  { id: 'm2', type: 'function', function: { name: 'test_tool', arguments: '{}' } },
                  { id: 'm3', type: 'function', function: { name: 'test_tool', arguments: '{}' } },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'multi-tool-task',
        description: 'Multiple tools test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.toolCalls).toHaveLength(3);
      expect(mockTool.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('State Reset Between Tasks', () => {
    it('should reset state between tasks', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockChat = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Done', tool_calls: null } }],
      });

      subagent.setMockLLMClient({ chat: mockChat });

      // First task
      const task1: SubagentTask = {
        id: 'task-1',
        description: 'First task',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result1 = await subagent.executeTask(task1);
      expect(result1.taskId).toBe('task-1');

      // Second task
      const task2: SubagentTask = {
        id: 'task-2',
        description: 'Second task',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result2 = await subagent.executeTask(task2);
      expect(result2.taskId).toBe('task-2');

      // Output should only contain second task
      expect(result2.output).not.toContain('First task');
    });
  });

  describe('Cache Eviction', () => {
    it('should evict old cache entries when limit exceeded', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'output' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      // Create many tool calls to trigger cache eviction
      const toolCalls = Array.from({ length: 150 }, (_, i) => ({
        id: `call-${i}`,
        type: 'function' as const,
        function: { name: 'test_tool', arguments: JSON.stringify({ index: i }) },
      }));

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Many tool calls',
                tool_calls: toolCalls,
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'cache-eviction-task',
        description: 'Cache eviction test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      // Task should complete successfully even with many tool calls
      expect(result.success).toBe(true);
      expect(mockTool.execute).toHaveBeenCalledTimes(150);
    });
  });

  describe('Abort in Loop', () => {
    it('should abort during LLM call loop', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      let callCount = 0;
      const mockChat = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount >= 2) {
          // Abort during second call
          subagent.abort();
        }
        return Promise.resolve({
          choices: [
            {
              message: {
                content: `Response ${callCount}`,
                tool_calls: callCount < 3
                  ? [{ id: `tc${callCount}`, type: 'function', function: { name: 'test_tool', arguments: '{}' } }]
                  : null,
              },
            },
          ],
        });
      });

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'output' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);
      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'abort-loop-task',
        description: 'Abort loop test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('abort');
    });
  });

  describe('File Tracking Edge Cases', () => {
    it('should not duplicate file paths in tracking', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'File edited' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'text_editor', description: 'Edit', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('text_editor', mockTool);

      // Same file edited multiple times
      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Editing same file twice',
                tool_calls: [
                  {
                    id: 'edit1',
                    type: 'function',
                    function: {
                      name: 'text_editor',
                      arguments: JSON.stringify({ command: 'edit', path: '/test/file.ts' }),
                    },
                  },
                  {
                    id: 'edit2',
                    type: 'function',
                    function: {
                      name: 'text_editor',
                      arguments: JSON.stringify({ command: 'edit', path: '/test/file.ts' }),
                    },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'duplicate-file-task',
        description: 'Duplicate file test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(true);
      // Should only contain the path once, not twice
      expect(result.filesModified.filter((f) => f === '/test/file.ts')).toHaveLength(1);
    });

    it('should not track files when text_editor fails', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: false, output: '', error: 'Failed to edit' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'text_editor', description: 'Edit', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('text_editor', mockTool);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Trying to edit',
                tool_calls: [
                  {
                    id: 'fail-edit',
                    type: 'function',
                    function: {
                      name: 'text_editor',
                      arguments: JSON.stringify({ command: 'create', path: '/test/failed.ts' }),
                    },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'failed-edit-task',
        description: 'Failed edit test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(true);
      // Failed edits should not be tracked
      expect(result.filesCreated).not.toContain('/test/failed.ts');
      expect(result.filesModified).not.toContain('/test/failed.ts');
    });

    it('should handle text_editor without path argument', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'Done' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'text_editor', description: 'Edit', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('text_editor', mockTool);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Edit without path',
                tool_calls: [
                  {
                    id: 'no-path',
                    type: 'function',
                    function: {
                      name: 'text_editor',
                      arguments: JSON.stringify({ command: 'view' }), // No path
                    },
                  },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'no-path-task',
        description: 'No path test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.filesCreated).toHaveLength(0);
      expect(result.filesModified).toHaveLength(0);
    });
  });

  describe('Tool Output Without Content', () => {
    it('should handle null output in tool result', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: null }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Null output test',
                tool_calls: [
                  { id: 'null-out', type: 'function', function: { name: 'test_tool', arguments: '{}' } },
                ],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'null-output-task',
        description: 'Null output test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(true);
    });
  });

  describe('Context with Null Content', () => {
    it('should handle null content in conversation history', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      let capturedMessages: LLMMessage[] = [];
      const mockChat = vi.fn().mockImplementation((messages) => {
        capturedMessages = messages;
        return Promise.resolve({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });
      });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'null-content-task',
        description: 'Null content test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {
          conversationHistory: [
            { type: 'user', content: null as unknown as string, timestamp: new Date() },
            { type: 'assistant', content: undefined as unknown as string, timestamp: new Date() },
          ],
        },
      };

      await subagent.executeTask(task);

      // Should not throw and should complete
      expect(capturedMessages.length).toBeGreaterThan(0);
    });
  });

  describe('LLM Response Edge Cases', () => {
    it('should handle undefined choices', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockChat = vi.fn().mockResolvedValue({
        choices: undefined,
      });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'undefined-choices-task',
        description: 'Undefined choices test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No response');
    });

    it('should handle message without content', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockChat = vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
              tool_calls: null,
            },
          },
        ],
      });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'null-content-response-task',
        description: 'Null content response test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      // Should complete successfully even without content
      expect(result.success).toBe(true);
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress based on tool rounds', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING, { maxToolRounds: 10 });

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'output' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      let progressValues: number[] = [];
      subagent.on('progress', (data: { progress: number }) => {
        progressValues.push(data.progress);
      });

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Round 1',
                tool_calls: [{ id: 'r1', type: 'function', function: { name: 'test_tool', arguments: '{}' } }],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Round 2',
                tool_calls: [{ id: 'r2', type: 'function', function: { name: 'test_tool', arguments: '{}' } }],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'progress-calc-task',
        description: 'Progress calculation test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      const result = await subagent.executeTask(task);

      expect(result.success).toBe(true);
      // Progress should increase with each round
      expect(progressValues.length).toBeGreaterThan(0);
    });
  });

  describe('Tool Executed Event', () => {
    it('should emit tool-executed event with result', async () => {
      subagent = new TestableSubagent(SubagentRole.TESTING);

      const mockTool = {
        execute: vi.fn().mockResolvedValue({ success: true, output: 'Tool executed output' }),
        getToolDefinition: () => ({
          type: 'function' as const,
          function: { name: 'test_tool', description: 'Test', parameters: { type: 'object', properties: {} } },
        }),
      };
      subagent.addTestTool('test_tool', mockTool);

      const toolExecutedEvents: unknown[] = [];
      subagent.on('tool-executed', (data) => {
        toolExecutedEvents.push(data);
      });

      const mockChat = vi.fn()
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Executing',
                tool_calls: [{ id: 'te1', type: 'function', function: { name: 'test_tool', arguments: '{}' } }],
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Done', tool_calls: null } }],
        });

      subagent.setMockLLMClient({ chat: mockChat });

      const task: SubagentTask = {
        id: 'tool-executed-task',
        description: 'Tool executed test',
        role: SubagentRole.TESTING,
        priority: 1,
        context: {},
      };

      await subagent.executeTask(task);

      expect(toolExecutedEvents).toHaveLength(1);
      expect((toolExecutedEvents[0] as { result: { success: boolean } }).result.success).toBe(true);
    });
  });
});
