/**
 * ReAct Loop Module - Type Definitions
 *
 * Types for the Reason-Act (ReAct) reasoning pattern.
 * Implements explicit Thought → Action → Observation cycles.
 *
 * @module agent/react/types
 */

import type { LLMToolCall } from '../../llm/client.js';
import type { ToolResult } from '../../types/index.js';

// ============================================================================
// Core ReAct Types
// ============================================================================

/**
 * Status of a ReAct reasoning step
 */
export type ReActStepStatus =
  | 'thinking'      // LLM is generating thought
  | 'acting'        // Executing tool action
  | 'observing'     // Processing observation
  | 'completed'     // Step completed
  | 'failed';       // Step failed

/**
 * The type of action in a ReAct step
 */
export type ReActActionType =
  | 'tool_call'     // Call a tool
  | 'respond'       // Final response to user
  | 'ask'           // Ask clarifying question
  | 'abort';        // Abort the task

/**
 * Represents a single Thought → Action → Observation cycle
 */
export interface ReActStep {
  /** Step number in the current task (1-indexed) */
  stepNumber: number;

  /** Timestamp when step started */
  startedAt: Date;

  /** Timestamp when step completed */
  completedAt?: Date;

  /** Current status of the step */
  status: ReActStepStatus;

  /** The reasoning/thought before taking action */
  thought: string;

  /** The action decided upon */
  action?: {
    /** Type of action */
    type: ReActActionType;
    /** Tool name (for tool_call) */
    tool?: string;
    /** Tool arguments (for tool_call) */
    arguments?: Record<string, unknown>;
    /** Response content (for respond/ask) */
    content?: string;
  };

  /** The observation from the action (tool result or response) */
  observation?: string;

  /** Whether this step achieved progress toward the goal */
  madeProgress?: boolean;

  /** Token count for this step */
  tokenCount?: number;

  /** Duration of the step in milliseconds */
  durationMs?: number;
}

// ============================================================================
// Scratchpad Types
// ============================================================================

/**
 * State of the ReAct scratchpad (accumulated reasoning)
 */
export interface ReActScratchpadState {
  /** All steps taken so far */
  steps: ReActStep[];

  /** Current step being executed */
  currentStep: number;

  /** Total tokens used in scratchpad */
  totalTokens: number;

  /** The original goal/task */
  goal: string;

  /** Summary of progress (updated periodically) */
  progressSummary?: string;

  /** Whether the task is complete */
  isComplete: boolean;

  /** Final result if complete */
  finalResult?: string;
}

/**
 * Options for formatting the scratchpad
 */
export interface ScratchpadFormatOptions {
  /** Maximum tokens to include */
  maxTokens: number;

  /** Include full observations or summarize */
  summarizeObservations: boolean;

  /** Number of recent steps to keep in full detail */
  recentStepsToKeep: number;

  /** Include step timing information */
  includeTiming: boolean;
}

// ============================================================================
// Loop Control Types
// ============================================================================

/**
 * Reason for stopping the ReAct loop
 */
export type ReActStopReason =
  | 'goal_achieved'   // Task completed successfully
  | 'max_steps'       // Hit maximum step limit
  | 'no_progress'     // Stuck without progress
  | 'user_abort'      // User cancelled
  | 'error'           // Unrecoverable error
  | 'exhausted';      // All approaches tried

/**
 * Result of the ReAct loop execution
 */
export interface ReActLoopResult {
  /** Whether the goal was achieved */
  success: boolean;

  /** Reason for stopping */
  stopReason: ReActStopReason;

  /** All steps executed */
  steps: ReActStep[];

  /** Total steps executed */
  totalSteps: number;

  /** Final response to user */
  finalResponse?: string;

  /** Total tokens consumed */
  totalTokens: number;

  /** Total duration in milliseconds */
  totalDurationMs: number;

  /** Error if failed */
  error?: string;
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Streaming chunk types for ReAct loop
 */
export type ReActStreamChunkType =
  | 'react_start'       // Loop started
  | 'react_thought'     // Thought being generated
  | 'react_action'      // Action being taken
  | 'react_observation' // Observation received
  | 'react_step'        // Step completed
  | 'react_complete';   // Loop completed

/**
 * Streaming chunk from ReAct loop
 */
export interface ReActStreamChunk {
  /** Type of the chunk */
  type: ReActStreamChunkType;

  /** Step number (if applicable) */
  stepNumber?: number;

  /** Total steps allowed */
  maxSteps?: number;

  /** The step data (for react_step) */
  step?: ReActStep;

  /** Content being streamed (for thought/observation) */
  content?: string;

  /** Tool call being executed (for react_action) */
  toolCall?: LLMToolCall;

  /** Tool result (for react_observation) */
  toolResult?: ToolResult;

  /** Final result (for react_complete) */
  result?: ReActLoopResult;
}

// ============================================================================
// Prompt Templates
// ============================================================================

/**
 * System prompt additions for ReAct mode
 */
export const REACT_SYSTEM_PROMPT = `
You are operating in ReAct (Reason + Act) mode. For each step:

1. **THOUGHT**: First, think step-by-step about:
   - What is the current goal?
   - What information do I have?
   - What is the best next action?

2. **ACTION**: Then, take ONE action:
   - Call a tool to gather information or make changes
   - Respond to the user if the task is complete
   - Ask for clarification if needed

3. **OBSERVATION**: You will receive the result of your action.

Continue this cycle until the task is complete. Be methodical and thorough.
`;

/**
 * Prompt for the thought phase
 */
export const THOUGHT_PROMPT_TEMPLATE = `
Based on the current state:

## Goal
{goal}

## Progress So Far
{scratchpad}

## Your Turn
Think step-by-step about what to do next. Consider:
1. What progress has been made?
2. What obstacles have been encountered?
3. What is the best next action?

After thinking, decide on ONE action to take.
`;

/**
 * Prompt when no progress is being made
 */
export const NO_PROGRESS_PROMPT = `
You have not made meaningful progress in the last few steps.

Please:
1. Re-examine your approach
2. Consider if you're missing something
3. Try a fundamentally different strategy

What new approach will you try?
`;

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event emitted when a ReAct step starts
 */
export interface ReActStepStartEvent {
  type: 'react_step_start';
  stepNumber: number;
  maxSteps: number;
}

/**
 * Event emitted when a ReAct step completes
 */
export interface ReActStepCompleteEvent {
  type: 'react_step_complete';
  step: ReActStep;
}

/**
 * Event emitted when the ReAct loop completes
 */
export interface ReActLoopCompleteEvent {
  type: 'react_loop_complete';
  result: ReActLoopResult;
}

/**
 * All ReAct-related events
 */
export type ReActEvent =
  | ReActStepStartEvent
  | ReActStepCompleteEvent
  | ReActLoopCompleteEvent;
