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
  SubagentStatus,
} from './subagent-types.js';
import { SubagentRole, SubagentState } from './subagent-types.js';

// Import tools
import { BashTool } from '../tools/bash.js';
import { TextEditorTool } from '../tools/text-editor.js';
import { SearchTool } from '../tools/search.js';

/**
 * Base Subagent class
 */
export class Subagent extends EventEmitter {
  public readonly id: string;
  public readonly role: SubagentRole;
  public readonly config: SubagentConfig;
  protected llmClient: LLMClient;
  protected chatHistory: ChatEntry[];
  protected messages: LLMMessage[];
  protected tools: Map<string, any>;
  protected isActive: boolean;
  protected currentTaskId: string | null;
  protected status: SubagentStatus;

  constructor(role: SubagentRole, configOverrides?: Partial<SubagentConfig>) {
    super();

    this.id = `${role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.role = role;

    // Merge with default config for this role
    const defaultConfig = this.getDefaultConfig(role);
    this.config = { ...defaultConfig, ...configOverrides, role };

    this.chatHistory = [];
    this.messages = [];
    this.tools = new Map();
    this.isActive = false;
    this.currentTaskId = null;

    // Initialize status
    this.status = {
      id: this.id,
      taskId: '',
      role: this.role,
      state: SubagentState.PENDING,
      progress: 0,
      startTime: new Date(),
    };

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
   * Get default configuration for a role
   */
  private getDefaultConfig(role: SubagentRole): SubagentConfig {
    // Default tools and settings based on role
    const roleDefaults: Record<SubagentRole, Partial<SubagentConfig>> = {
      [SubagentRole.GENERAL]: {
        allowedTools: ['bash', 'text_editor', 'search'],
        maxToolRounds: 30,
        contextDepth: 20,
        priority: 1,
      },
      [SubagentRole.TESTING]: {
        allowedTools: ['bash', 'text_editor', 'search'],
        maxToolRounds: 20,
        contextDepth: 10,
        priority: 2,
      },
      [SubagentRole.DOCUMENTATION]: {
        allowedTools: ['text_editor', 'search'],
        maxToolRounds: 15,
        contextDepth: 20,
        priority: 1,
      },
      [SubagentRole.REFACTORING]: {
        allowedTools: ['bash', 'text_editor', 'search'],
        maxToolRounds: 25,
        contextDepth: 20,
        priority: 2,
      },
      [SubagentRole.ANALYSIS]: {
        allowedTools: ['bash', 'text_editor', 'search'],
        maxToolRounds: 15,
        contextDepth: 15,
        priority: 3,
      },
      [SubagentRole.DEBUG]: {
        allowedTools: ['bash', 'text_editor', 'search'],
        maxToolRounds: 30,
        contextDepth: 15,
        priority: 3,
      },
      [SubagentRole.PERFORMANCE]: {
        allowedTools: ['bash', 'search'],
        maxToolRounds: 25,
        contextDepth: 10,
        priority: 2,
      },
    };

    return {
      role,
      allowedTools: [],
      maxToolRounds: 20,
      contextDepth: 10,
      priority: 1,
      ...roleDefaults[role],
    } as SubagentConfig;
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

    // Update status
    this.status = {
      id: this.id,
      taskId: task.id,
      role: this.role,
      state: SubagentState.RUNNING,
      progress: 0,
      startTime: new Date(),
      toolsUsed: [],
      toolRoundsUsed: 0,
    };

    const result: SubagentResult = {
      id: this.id,
      taskId: task.id,
      role: this.role,
      success: false,
      output: '',
      executionTime: 0,
      status: this.status,
      filesModified: [],
      filesCreated: [],
      toolCalls: [],
    };

    try {
      // Emit both 'start' and 'task-started' for compatibility
      this.emit('start', { taskId: task.id, role: this.role });
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
            if (!this.status.toolsUsed!.includes(toolCall.function.name)) {
              this.status.toolsUsed!.push(toolCall.function.name);
            }

            // Track tool calls
            if (!result.toolCalls) {
              result.toolCalls = [];
            }
            result.toolCalls.push(toolCall);

            // Track files created/modified
            if (toolCall.function.name === 'text_editor' && toolResult.success) {
              try {
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
              } catch {
                // Ignore JSON parse errors for file tracking - non-critical
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
          this.status.toolRoundsUsed = toolRounds;
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
      this.status.state = SubagentState.COMPLETED;
      this.status.endTime = new Date();
      this.status.progress = 100;
      result.status = { ...this.status };
      this.emit('task-completed', { taskId: task.id, result });

    } catch (error: any) {
      result.success = false;
      result.error = error.message;
      result.executionTime = Date.now() - startTime;
      this.status.state = SubagentState.FAILED;
      this.status.endTime = new Date();
      this.status.error = error.message;
      result.status = { ...this.status };
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

    // Validate arguments exist before parsing
    if (!toolCall.function.arguments || toolCall.function.arguments.trim() === '') {
      return {
        success: false,
        error: `Tool '${toolName}' called with empty arguments`,
      };
    }

    let args: any;
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (parseError: any) {
      return {
        success: false,
        error: `Failed to parse ${toolName} arguments: ${parseError.message}`,
      };
    }

    try {
      const result = await tool.execute(args);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: `Tool execution error in ${toolName}: ${error.message}`,
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
  getStatus(): SubagentStatus {
    return { ...this.status };
  }

  /**
   * Abort execution
   */
  abort(): void {
    this.isActive = false;
    this.status.state = SubagentState.CANCELLED;
    this.status.endTime = new Date();
    this.emit('cancel', { role: this.role });
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

  /**
   * Get logs (alias for getChatHistory for test compatibility)
   */
  getLogs(): ChatEntry[] {
    return [...this.chatHistory];
  }

  /**
   * Receive a message from parent/orchestrator
   */
  async receiveMessage(message: {
    from: 'parent' | 'orchestrator';
    to: 'subagent';
    type: 'instruction' | 'cancellation' | 'query';
    content: string;
    timestamp: Date;
  }): Promise<void> {
    this.emit('message', message);

    // Handle cancellation messages
    if (message.type === 'cancellation') {
      this.abort();
    }
  }
}
