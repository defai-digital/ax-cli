/**
 * Subagent Base Class
 *
 * Base class for all specialized subagents. Subagents are lightweight AI agents
 * that focus on specific tasks (testing, documentation, refactoring, etc.) with
 * limited tool access and shallow conversation history.
 */

import { EventEmitter } from 'events';
import { LLMClient } from '../llm/client.js';
import type { LLMMessage, LLMToolCall, LLMTool } from '../llm/client.js';
import type { ChatEntry } from './llm-agent.js';
import type {
  SubagentConfig,
  SubagentTask,
  SubagentResult,
  SubagentStatus,
} from './subagent-types.js';
import { SubagentRole, SubagentState } from './subagent-types.js';
import type { ToolResult } from '../types/index.js';
import { extractErrorMessage } from '../utils/error-handler.js';

// Import tools
import { BashTool } from '../tools/bash.js';
import { TextEditorTool } from '../tools/text-editor.js';
import { SearchTool } from '../tools/search.js';
import { getSettingsManager } from '../utils/settings-manager.js';
import { DEFAULT_MODEL, CACHE_CONFIG } from '../constants.js';

/**
 * Type for tools used by subagents
 * Note: Different tools have different method signatures (execute, search, view, etc.)
 * so we use a flexible type that allows any tool implementation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SubagentTool = any;

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
  protected tools: Map<string, SubagentTool>;
  protected isActive: boolean;
  protected currentTaskId: string | null;
  protected status: SubagentStatus;
  private toolCallArgsCache: Map<string, Record<string, unknown>> = new Map();

  constructor(role: SubagentRole, configOverrides?: Partial<SubagentConfig>) {
    super();

    this.id = `${role}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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
    // Use SettingsManager for proper model/baseURL resolution with user preferences
    const settingsManager = getSettingsManager();
    const apiKey = settingsManager.getApiKey() || '';
    const model = settingsManager.getCurrentModel() || DEFAULT_MODEL;
    const baseURL = settingsManager.getBaseURL();

    this.llmClient = new LLMClient(apiKey, model, baseURL);

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
   * Parse tool call arguments with caching for performance
   * Returns cached result if available, otherwise parses and caches
   */
  private parseToolArgumentsCached(toolCall: LLMToolCall): Record<string, unknown> {
    const cached = this.toolCallArgsCache.get(toolCall.id);
    if (cached) {
      return cached;
    }

    try {
      const args = JSON.parse(toolCall.function.arguments || '{}');
      this.toolCallArgsCache.set(toolCall.id, args);

      // Prevent unbounded memory growth with proper cache eviction
      // When cache exceeds limit, reduce to 80% capacity
      if (this.toolCallArgsCache.size > CACHE_CONFIG.TOOL_ARGS_CACHE_MAX_SIZE) {
        const targetSize = Math.floor(CACHE_CONFIG.TOOL_ARGS_CACHE_MAX_SIZE * 0.8);
        const toRemove = this.toolCallArgsCache.size - targetSize;
        // Don't modify Map while iterating - create array of keys first
        const keysToDelete = Array.from(this.toolCallArgsCache.keys()).slice(0, toRemove);
        for (const key of keysToDelete) {
          this.toolCallArgsCache.delete(key);
        }
      }

      return args;
    } catch {
      // Return empty object on parse error (don't cache failures)
      return {};
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
            // Emit tool call event for real-time UI updates
            this.emit('tool-call', {
              taskId: task.id,
              toolCall: {
                name: toolCall.function.name,
                id: toolCall.id,
              },
            });

            const toolResult = await this.executeToolCall(toolCall);

            // Emit tool result event
            this.emit('tool-result', {
              taskId: task.id,
              toolCall: {
                name: toolCall.function.name,
                id: toolCall.id,
              },
              success: toolResult.success,
              output: toolResult.output?.slice(0, 100), // Truncate for UI
            });

            // Track tool usage in status
            if (!this.status.toolsUsed) {
              this.status.toolsUsed = [];
            }
            if (!this.status.toolsUsed.includes(toolCall.function.name)) {
              this.status.toolsUsed.push(toolCall.function.name);
            }

            // Track tool calls
            if (!result.toolCalls) {
              result.toolCalls = [];
            }
            result.toolCalls.push(toolCall);

            // Track files created/modified
            if (toolCall.function.name === 'text_editor' && toolResult.success) {
              const args = this.parseToolArgumentsCached(toolCall);
              if (args.path) {
                const filePath = args.path as string;
                if (args.command === 'create') {
                  // Ensure array exists and avoid duplicates
                  result.filesCreated = result.filesCreated ?? [];
                  if (!result.filesCreated.includes(filePath)) {
                    result.filesCreated.push(filePath);
                  }
                } else {
                  // Ensure array exists and avoid duplicates
                  result.filesModified = result.filesModified ?? [];
                  if (!result.filesModified.includes(filePath)) {
                    result.filesModified.push(filePath);
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

      // If we exited the loop without completion, treat as failure instead of silently succeeding
      if (!isComplete) {
        throw new Error(
          `Tool round limit (${this.config.maxToolRounds}) reached before task completion`
        );
      }

      result.success = true;
      result.executionTime = Date.now() - startTime;
      this.status.state = SubagentState.COMPLETED;
      this.status.endTime = new Date();
      this.status.progress = 100;
      result.status = { ...this.status };
      this.emit('task-completed', { taskId: task.id, result });

    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error);
      result.success = false;
      result.error = errorMessage;
      result.executionTime = Date.now() - startTime;
      this.status.state = SubagentState.FAILED;
      this.status.endTime = new Date();
      this.status.error = errorMessage;
      result.status = { ...this.status };
      this.emit('task-failed', { taskId: task.id, error: errorMessage });
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
  private async executeToolCall(toolCall: LLMToolCall): Promise<ToolResult> {
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

    // Use cached parsing for performance
    const args = this.parseToolArgumentsCached(toolCall);

    try {
      const result = await tool.execute(args);
      return result;
    } catch (error: unknown) {
      return {
        success: false,
        error: `Tool execution error in ${toolName}: ${extractErrorMessage(error)}`,
      };
    }
  }

  /**
   * Get tool definitions for LLM
   */
  private getToolDefinitions(): LLMTool[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    this.emit('cancel', { role: this.role, taskId: this.currentTaskId });
  }

  /**
   * Terminate subagent
   */
  async terminate(): Promise<void> {
    this.isActive = false;
    this.currentTaskId = null;
    // Emit terminated event BEFORE removing listeners so they can receive it
    this.emit('terminated', { role: this.role });
    this.removeAllListeners();
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

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}
