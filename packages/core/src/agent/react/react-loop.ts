/**
 * ReAct Loop
 *
 * Implements the Reason-Act (ReAct) pattern for explicit
 * Thought → Action → Observation reasoning cycles.
 *
 * Optimized for GLM-4.6 with thinking mode support.
 *
 * @module agent/react/react-loop
 */

import type { EventEmitter } from 'events';
import type { LLMClient, LLMMessage, LLMTool, LLMToolCall } from '../../llm/client.js';
import type { ToolResult } from '../../types/index.js';
import type { ThinkingConfig } from '../../llm/types.js';
import type { ReActConfig } from '../config/agentic-config.js';
import { DEFAULT_REACT_CONFIG } from '../config/agentic-config.js';
import { ReActScratchpad, createScratchpad } from './scratchpad.js';
import type {
  ReActLoopResult,
  ReActStopReason,
  ReActStreamChunk,
} from './types.js';
import {
  REACT_SYSTEM_PROMPT,
  THOUGHT_PROMPT_TEMPLATE,
  NO_PROGRESS_PROMPT,
} from './types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Tool executor function type
 */
export type ToolExecutor = (toolCall: LLMToolCall) => Promise<ToolResult>;

/**
 * Options for creating a ReAct loop
 */
export interface ReActLoopOptions {
  /** LLM client for API calls */
  llmClient: LLMClient;

  /** Available tools */
  tools: LLMTool[];

  /** Function to execute tool calls */
  executeToolCall: ToolExecutor;

  /** ReAct configuration */
  config?: Partial<ReActConfig>;

  /** Event emitter for step events */
  emitter?: EventEmitter;

  /** System prompt to include */
  systemPrompt?: string;
}

/**
 * Context for a ReAct execution
 */
export interface ReActExecutionContext {
  /** The user's goal/task */
  goal: string;

  /** Initial conversation messages */
  messages: LLMMessage[];

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

// ============================================================================
// ReActLoop Class
// ============================================================================

/**
 * ReActLoop - Orchestrates Thought → Action → Observation cycles
 */
export class ReActLoop {
  private llmClient: LLMClient;
  private tools: LLMTool[];
  private executeToolCall: ToolExecutor;
  private config: ReActConfig;
  private emitter?: EventEmitter;
  private systemPrompt?: string;
  private scratchpad: ReActScratchpad | null = null;

  constructor(options: ReActLoopOptions) {
    this.llmClient = options.llmClient;
    this.tools = options.tools;
    this.executeToolCall = options.executeToolCall;
    this.config = { ...DEFAULT_REACT_CONFIG, ...options.config };
    this.emitter = options.emitter;
    this.systemPrompt = options.systemPrompt;
  }

  /**
   * Execute the ReAct loop
   *
   * This is an async generator that yields streaming chunks during execution.
   */
  async *execute(
    context: ReActExecutionContext
  ): AsyncGenerator<ReActStreamChunk> {
    const startTime = Date.now();

    // Initialize scratchpad
    this.scratchpad = createScratchpad(context.goal, this.config.maxScratchpadTokens);

    // Yield start event
    yield {
      type: 'react_start',
      maxSteps: this.config.maxSteps,
    };

    this.emitEvent('react_loop_start', {
      goal: context.goal,
      maxSteps: this.config.maxSteps,
    });

    let stopReason: ReActStopReason = 'goal_achieved';
    let finalResponse: string | undefined;
    let consecutiveNoProgress = 0; // BUG FIX: Track consecutive no-progress steps
    const MAX_NO_PROGRESS = 3; // Maximum consecutive no-progress steps before stopping

    try {
      // Main ReAct loop
      for (let stepNumber = 1; stepNumber <= this.config.maxSteps; stepNumber++) {
        // Check for cancellation
        if (context.abortSignal?.aborted) {
          stopReason = 'user_abort';
          break;
        }

        // Execute one step
        const stepResult = await this.executeStep(
          stepNumber,
          context.messages,
          context.abortSignal
        );

        // Yield step streaming chunks
        yield* stepResult.chunks;

        // Check step outcome
        if (stepResult.shouldStop) {
          stopReason = stepResult.stopReason || 'goal_achieved';
          finalResponse = stepResult.finalResponse;
          break;
        }

        // BUG FIX: Track consecutive no-progress steps and stop if too many
        if (stepResult.stopReason === 'no_progress' || stepResult.stopReason === 'error') {
          consecutiveNoProgress++;
          if (consecutiveNoProgress >= MAX_NO_PROGRESS) {
            yield {
              type: 'react_thought',
              stepNumber,
              content: '\n⚠️ *Unable to make progress after multiple attempts. Stopping ReAct loop.*\n',
            };
            stopReason = 'no_progress';
            break;
          }
        } else {
          consecutiveNoProgress = 0; // Reset on successful progress
        }

        // Check for stalling
        if (this.scratchpad.isStalled(3)) {
          // Inject no-progress prompt
          yield {
            type: 'react_thought',
            stepNumber,
            content: '\n*Detecting stall - reconsidering approach...*\n',
          };

          // Will be handled in next iteration with adjusted prompt
        }
      }

      // Check if we hit max steps
      if (!finalResponse && stopReason === 'goal_achieved') {
        stopReason = 'max_steps';
      }

    } catch (error) {
      stopReason = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);

      yield {
        type: 'react_complete',
        result: {
          success: false,
          stopReason: 'error',
          steps: this.scratchpad?.steps || [],
          totalSteps: this.scratchpad?.currentStepNumber || 0,
          totalTokens: this.scratchpad?.totalTokens || 0,
          totalDurationMs: Date.now() - startTime,
          error: errorMessage,
        },
      };

      return;
    }

    // Build final result
    const result: ReActLoopResult = {
      success: stopReason === 'goal_achieved',
      stopReason,
      steps: this.scratchpad.steps,
      totalSteps: this.scratchpad.currentStepNumber,
      finalResponse,
      totalTokens: this.scratchpad.totalTokens,
      totalDurationMs: Date.now() - startTime,
    };

    this.emitEvent('react_loop_complete', { result });

    yield {
      type: 'react_complete',
      result,
    };
  }

  /**
   * Execute a single ReAct step
   */
  private async executeStep(
    stepNumber: number,
    baseMessages: LLMMessage[],
    _abortSignal?: AbortSignal
  ): Promise<{
    chunks: AsyncGenerator<ReActStreamChunk>;
    shouldStop: boolean;
    stopReason?: ReActStopReason;
    finalResponse?: string;
  }> {
    type StepResult = {
      shouldStop: boolean;
      stopReason?: ReActStopReason;
      finalResponse?: string;
    };
    const self = this;

    async function* stepGenerator(): AsyncGenerator<ReActStreamChunk, StepResult | undefined> {
      if (!self.scratchpad) {
        return;
      }

      // Start step
      self.scratchpad.startStep();

      yield {
        type: 'react_thought',
        stepNumber,
        content: `\n### Step ${stepNumber}\n`,
      };

      self.emitEvent('react_step_start', {
        stepNumber,
        maxSteps: self.config.maxSteps,
      });

      // Build thought prompt
      const thoughtPrompt = self.buildThoughtPrompt();

      // Prepare messages for LLM
      const messages = self.buildMessagesWithContext(baseMessages, thoughtPrompt);

      // Configure thinking mode if enabled
      const thinkingConfig: ThinkingConfig | undefined = self.config.useThinkingMode
        ? { type: 'enabled' }
        : undefined;

      // Call LLM
      const response = await self.llmClient.chat(
        messages,
        self.tools,
        { thinking: thinkingConfig }
      );

      const choice = response.choices[0];
      if (!choice) {
        yield {
          type: 'react_thought',
          stepNumber,
          content: '*Error: No response from LLM*\n',
        };
        return { shouldStop: true, stopReason: 'error' as ReActStopReason };
      }

      const message = choice.message;

      // Extract thought (reasoning_content or content without tool calls)
      const thought = message.reasoning_content || message.content || '';
      self.scratchpad.setThought(thought);

      yield {
        type: 'react_thought',
        stepNumber,
        content: `**Thought**: ${self.truncate(thought, 500)}\n`,
      };

      // Check for tool calls (Action)
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0]; // Execute one action per step

        self.scratchpad.setAction({
          type: 'tool_call',
          tool: toolCall.function.name,
          arguments: self.safeParseJSON(toolCall.function.arguments),
        });

        yield {
          type: 'react_action',
          stepNumber,
          toolCall,
        };

        // Execute tool
        const toolResult = await self.executeToolCall(toolCall);

        // Record observation
        const observation = toolResult.success
          ? toolResult.output || 'Success'
          : `Error: ${toolResult.error}`;

        self.scratchpad.setObservation(observation, toolResult.success);

        yield {
          type: 'react_observation',
          stepNumber,
          toolResult,
          content: `**Observation**: ${self.truncate(observation, 500)}\n`,
        };

        // Complete step
        const step = self.scratchpad.completeStep();

        if (step) {
          yield {
            type: 'react_step',
            stepNumber,
            step,
          };

          self.emitEvent('react_step_complete', { step });
        }

        // Continue loop
        return { shouldStop: false };
      }

      // No tool calls - check if this is a final response
      const content = message.content || '';

      // Check if the model indicates completion
      if (self.isCompletionIndicator(content, choice.finish_reason)) {
        self.scratchpad.setAction({
          type: 'respond',
          content,
        });

        self.scratchpad.setObservation('Task completed', true);
        self.scratchpad.completeStep();
        self.scratchpad.complete(content, 'goal_achieved');

        yield {
          type: 'react_thought',
          stepNumber,
          content: `**Final Response**: ${content}\n`,
        };

        return {
          shouldStop: true,
          stopReason: 'goal_achieved',
          finalResponse: content,
        };
      }

      // Model is still thinking but didn't take action - treat as no progress
      self.scratchpad.setObservation('No action taken', false);
      self.scratchpad.completeStep();

      yield {
        type: 'react_thought',
        stepNumber,
        content: '*No action taken in this step*\n',
      };

      return { shouldStop: false };
    }

    // Execute the generator and collect results
    const chunks = stepGenerator();
    const collectedChunks: ReActStreamChunk[] = [];
    let shouldStop = false;
    let stopReason: ReActStopReason | undefined;
    let finalResponse: string | undefined;

    while (true) {
      const { value, done } = await chunks.next();
      if (done) {
        if (value) {
          shouldStop = value.shouldStop;
          stopReason = value.stopReason;
          finalResponse = value.finalResponse;
        }
        break;
      }
      collectedChunks.push(value);
    }

    // Return async generator for collected chunks
    async function* yieldChunks(): AsyncGenerator<ReActStreamChunk> {
      for (const chunk of collectedChunks) {
        yield chunk;
      }
    }

    return {
      chunks: yieldChunks(),
      shouldStop,
      stopReason,
      finalResponse,
    };
  }

  /**
   * Build the thought prompt with scratchpad context
   */
  private buildThoughtPrompt(): string {
    if (!this.scratchpad) {
      return '';
    }

    let prompt = THOUGHT_PROMPT_TEMPLATE
      .replace('{goal}', this.scratchpad.goal)
      .replace('{scratchpad}', this.scratchpad.format());

    // Add no-progress nudge if stalled
    if (this.scratchpad.isStalled(3)) {
      prompt += '\n\n' + NO_PROGRESS_PROMPT;
    }

    return prompt;
  }

  /**
   * Build messages with ReAct context
   */
  private buildMessagesWithContext(
    baseMessages: LLMMessage[],
    thoughtPrompt: string
  ): LLMMessage[] {
    const messages: LLMMessage[] = [];

    // Add system prompt with ReAct instructions
    if (this.systemPrompt) {
      messages.push({
        role: 'system',
        content: this.systemPrompt + '\n\n' + REACT_SYSTEM_PROMPT,
      });
    } else {
      messages.push({
        role: 'system',
        content: REACT_SYSTEM_PROMPT,
      });
    }

    // Add base messages (user conversation)
    messages.push(...baseMessages.filter(m => m.role !== 'system'));

    // Add thought prompt
    messages.push({
      role: 'user',
      content: thoughtPrompt,
    });

    return messages;
  }

  /**
   * Check if content indicates task completion
   */
  private isCompletionIndicator(content: string, finishReason: string): boolean {
    // Check finish reason
    if (finishReason === 'stop') {
      // Look for completion indicators in content
      const completionPatterns = [
        /task.*complete/i,
        /successfully.*done/i,
        /here.*(?:is|are).*(?:result|answer|solution)/i,
        /i'?ve.*(?:completed|finished|done)/i,
        /the.*(?:changes|updates|modifications).*(?:have been|are).*made/i,
      ];

      // If content has tool call indicators, it's not complete
      if (content.includes('I will') || content.includes('Let me')) {
        return false;
      }

      // Check for completion patterns
      for (const pattern of completionPatterns) {
        if (pattern.test(content)) {
          return true;
        }
      }

      // If finish_reason is stop and there's substantial content, likely complete
      if (content.length > 100) {
        return true;
      }
    }

    return false;
  }

  /**
   * Safely parse JSON
   */
  private safeParseJSON(json: string): Record<string, unknown> {
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  }

  /**
   * Truncate text for display
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Emit event to emitter if available
   */
  private emitEvent(event: string, data: unknown): void {
    if (this.emitter && this.config.emitStepEvents) {
      this.emitter.emit(event, data);
    }
  }

  /**
   * Get the current scratchpad
   */
  getScratchpad(): ReActScratchpad | null {
    return this.scratchpad;
  }

  /**
   * Reset the loop state
   */
  reset(): void {
    this.scratchpad = null;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ReActConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new ReAct loop
 */
export function createReActLoop(options: ReActLoopOptions): ReActLoop {
  return new ReActLoop(options);
}
