/**
 * ReAct Loop Module
 *
 * Implements the Reason-Act (ReAct) pattern for explicit
 * Thought → Action → Observation reasoning cycles.
 *
 * @module agent/react
 *
 * @example
 * ```typescript
 * import {
 *   ReActLoop,
 *   createReActLoop,
 *   ReActScratchpad,
 * } from './react';
 *
 * // Create ReAct loop
 * const loop = createReActLoop({
 *   llmClient,
 *   tools,
 *   executeToolCall,
 *   config: { useThinkingMode: true },
 * });
 *
 * // Execute with streaming
 * for await (const chunk of loop.execute({ goal, messages })) {
 *   if (chunk.type === 'react_step') {
 *     console.log(`Step ${chunk.stepNumber}:`, chunk.step);
 *   }
 * }
 * ```
 */

// Types
export type {
  ReActStepStatus,
  ReActActionType,
  ReActStep,
  ReActScratchpadState,
  ScratchpadFormatOptions,
  ReActStopReason,
  ReActLoopResult,
  ReActStreamChunkType,
  ReActStreamChunk,
  ReActStepStartEvent,
  ReActStepCompleteEvent,
  ReActLoopCompleteEvent,
  ReActEvent,
} from './types.js';

export {
  REACT_SYSTEM_PROMPT,
  THOUGHT_PROMPT_TEMPLATE,
  NO_PROGRESS_PROMPT,
} from './types.js';

// Scratchpad
export {
  ReActScratchpad,
  createScratchpad,
} from './scratchpad.js';

// ReAct Loop
export {
  ReActLoop,
  createReActLoop,
} from './react-loop.js';

export type {
  ToolExecutor,
  ReActLoopOptions,
  ReActExecutionContext,
} from './react-loop.js';
