/**
 * Subagent Base Class
 *
 * Base class for all specialized subagents. Subagents are lightweight AI agents
 * that focus on specific tasks (testing, documentation, refactoring, etc.) with
 * limited tool access and shallow conversation history.
 */

import { EventEmitter } from 'events';
import { LLMClient } from '../llm/client.js';
import type { LLMMessage, LLMToolCall } from '../llm/client.js';
import type { ChatEntry } from './llm-agent.js';
import type {
  SubagentConfig,
  SubagentTask,
  SubagentResult,
  SubagentRole,
  SubagentStatus,
} from './subagent-types.js';
import { SubagentState } from './subagent-types.js';

// Import tools
import { BashTool } from '../tools/bash.js';
import { TextEditorTool } from '../tools/text-editor.js';
import { SearchTool } from '../tools/search.js';

/**
 * Base Subagent class
 */
export class Subagent extends EventEmitter {
  protected role: SubagentRole;
  protected config: SubagentConfig;
  protected llmClient: LLMClient;
  protected chatHistory: ChatEntry[];
  protected messages: LLMMessage[];
  protected tools: Map<string, any>;
  protected isActive: boolean;
  protected currentTaskId: string | null;

  constructor(config: SubagentConfig) {
    super();

    this.role = config.role;
    this.config = config;
    this.chatHistory = [];
    this.messages = [];
    this.tools = new Map();
    this.isActive = false;
    this.currentTaskId = null;

    // Initialize LLM client with same settings as main agent
    this.llmClient = new LLMClient(
      process.env.YOUR_API_KEY || '',
      process.env.GROK_MODEL || 'glm-4.6',
      process.env.GROK_BASE_URL
    );

    // Initialize allowed tools
    this.initializeTools();

    // Set system prompt
    this.messages.push({
      role: 'system',
      content: this.buildSystemPrompt(),
    });
  }

  /**
   * Initialize tools based on allowed tools in config
   */
  private initializeTools(): void {
    const allowedTools = this.config.allowedTools;

    if (allowedTools.includes('bash')) {
      this.tools.set('bash', new BashTool());
    }

    if (allowedTools.includes('text_editor')) {
      // TextEditorTool doesn't need parameters
      this.tools.set('text_editor', new TextEditorTool());
    }

    if (allowedTools.includes('search')) {
      this.tools.set('search', new SearchTool());
    }
  }

  /**
   * Build system prompt for this subagent role
   * Override in specialized subagent classes
   */
  protected buildSystemPrompt(): string {
    return this.config.customSystemPrompt || `You are a specialized ${this.role} agent.`;
  }

  /**
   * Execute a task
   */
  async executeTask(task: SubagentTask): Promise<SubagentResult> {
    this.isActive = true;
    this.currentTaskId = task.id;

    const startTime = Date.now();

    // Initialize status
    const status: SubagentStatus = {
      id: `subagent-${Date.now()}`,
      taskId: task.id,
      role: this.role,
      state: SubagentState.RUNNING,
      progress: 0,
      startTime: new Date(),
      toolsUsed: [],
      toolRoundsUsed: 0,
    };

    const result: SubagentResult = {
      id: status.id,
      taskId: task.id,
      role: this.role,
      success: false,
      output: '',
      executionTime: 0,
      status: status,
      filesModified: [],
      filesCreated: [],
      toolCalls: [],
    };

    try {
      this.emit('task-started', { taskId: task.id, role: this.role });

      // Add task context to messages
      const contextPrompt = this.buildContextPrompt(task);
      this.messages.push({
        role: 'user',
        content: contextPrompt,
      });

      // Add to chat history
      this.chatHistory.push({
        type: 'user',
        content: contextPrompt,
        timestamp: new Date(),
      });

      // Execute with tool rounds limit
      let toolRounds = 0;
      let isComplete = false;

      while (toolRounds < this.config.maxToolRounds && !isComplete) {
        const response = await this.llmClient.chat(
          this.messages,
          this.getToolDefinitions(),
          { stream: false }
        );

        if (!response.choices || response.choices.length === 0) {
          throw new Error('No response from LLM');
        }

        const choice = response.choices[0];
        const message = choice.message;

        // Handle content
        if (message.content) {
          this.chatHistory.push({
            type: 'assistant',
            content: message.content,
            timestamp: new Date(),
          });

          result.output = message.content;
          this.emit('progress', {
            taskId: task.id,
            content: message.content,
          });
        }

        // Handle tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          this.messages.push({
            role: 'assistant',
            content: message.content || '',
            tool_calls: message.tool_calls,
          });

          for (const toolCall of message.tool_calls) {
            const toolResult = await this.executeToolCall(toolCall);

            // Track tool usage in status
            if (!status.toolsUsed!.includes(toolCall.function.name)) {
              status.toolsUsed!.push(toolCall.function.name);
            }

            // Track tool calls
            if (!result.toolCalls) {
              result.toolCalls = [];
            }
            result.toolCalls.push(toolCall);

            // Track files created/modified
            if (toolCall.function.name === 'text_editor' && toolResult.success) {
              const args = JSON.parse(toolCall.function.arguments);
              if (args.path) {
                if (args.command === 'create') {
                  if (!result.filesCreated!.includes(args.path)) {
                    result.filesCreated!.push(args.path);
                  }
                } else {
                  if (!result.filesModified!.includes(args.path)) {
                    result.filesModified!.push(args.path);
                  }
                }
              }
            }

            // Add tool result to messages
            this.messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResult.output || toolResult.error || '',
            });

            this.chatHistory.push({
              type: 'tool_result',
              content: toolResult.output || toolResult.error || '',
              timestamp: new Date(),
              toolCall: toolCall,
              toolResult: toolResult,
            });

            this.emit('tool-executed', {
              taskId: task.id,
              toolName: toolCall.function.name,
              result: toolResult,
            });
          }

          toolRounds++;
          status.toolRoundsUsed = toolRounds;
        } else {
          // No more tool calls, task complete
          isComplete = true;
        }

        // Check timeout
        const elapsed = Date.now() - startTime;
        if (this.config.timeout && elapsed > this.config.timeout) {
          throw new Error(`Task timeout after ${elapsed}ms`);
        }
      }

      result.success = true;
      result.executionTime = Date.now() - startTime;
      result.status.state = SubagentState.COMPLETED;
      result.status.endTime = new Date();
      result.status.progress = 100;
      this.emit('task-completed', { taskId: task.id, result });

    } catch (error: any) {
      result.success = false;
      result.error = error.message;
      result.executionTime = Date.now() - startTime;
      result.status.state = SubagentState.FAILED;
      result.status.endTime = new Date();
      result.status.error = error.message;
      this.emit('task-failed', { taskId: task.id, error: error.message });
    } finally {
      this.isActive = false;
      this.currentTaskId = null;
    }

    return result;
  }

  /**
   * Build context prompt from task
   */
  private buildContextPrompt(task: SubagentTask): string {
    let prompt = `Task: ${task.description}\n\n`;

    if (task.context) {
      prompt += `Context:\n`;
      if (task.context.metadata?.workingDirectory) {
        prompt += `- Working Directory: ${task.context.metadata.workingDirectory}\n`;
      }
      if (task.context.conversationHistory && task.context.conversationHistory.length > 0) {
        prompt += `\nRecent conversation:\n`;
        task.context.conversationHistory.slice(-5).forEach((entry: ChatEntry) => {
          prompt += `${entry.type}: ${entry.content.substring(0, 200)}\n`;
        });
      }
    }

    return prompt;
  }

  /**
   * Execute a tool call
   */
  private async executeToolCall(toolCall: LLMToolCall): Promise<any> {
    const toolName = toolCall.function.name;
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolName}' not available for ${this.role} agent`,
      };
    }

    try {
      const args = JSON.parse(toolCall.function.arguments);
      const result = await tool.execute(args);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: `Tool execution error: ${error.message}`,
      };
    }
  }

  /**
   * Get tool definitions for LLM
   */
  private getToolDefinitions(): any[] {
    const definitions: any[] = [];

    for (const [, tool] of this.tools) {
      if (typeof tool.getToolDefinition === 'function') {
        definitions.push(tool.getToolDefinition());
      }
    }

    return definitions;
  }

  /**
   * Get current status
   */
  getStatus(): {
    role: SubagentRole;
    isActive: boolean;
    currentTaskId: string | null;
    messageCount: number;
  } {
    return {
      role: this.role,
      isActive: this.isActive,
      currentTaskId: this.currentTaskId,
      messageCount: this.messages.length,
    };
  }

  /**
   * Terminate subagent
   */
  async terminate(): Promise<void> {
    this.isActive = false;
    this.currentTaskId = null;
    this.removeAllListeners();
    this.emit('terminated', { role: this.role });
  }

  /**
   * Get chat history (for debugging/monitoring)
   */
  getChatHistory(): ChatEntry[] {
    return [...this.chatHistory];
  }
}
