/**
 * AX CLI SDK - Type Definitions
 *
 * Consolidated type definitions for SDK consumers.
 * All types are re-exported from core modules for convenience.
 */

// ============================================================================
// Agent Types
// ============================================================================

export type { ChatEntry, StreamingChunk } from '../agent/llm-agent.js';
export type { AgentState } from '../types/index.js';

export {
  SubagentRole,
  SubagentState,
  type SubagentConfig,
  type SubagentTask,
  type SubagentResult,
  type SubagentStatus,
} from '../agent/subagent-types.js';

// ============================================================================
// LLM Types
// ============================================================================

export type {
  LLMMessage,
  LLMTool,
  LLMToolCall,
  LLMResponse,
  SearchParameters,
  SearchOptions,
} from '../llm/client.js';

export type {
  ChatOptions,
  ThinkingConfig,
  SamplingConfig,
  GLM46StreamChunk,
} from '../llm/types.js';

// ============================================================================
// Tool Types
// ============================================================================

export type { ToolResult, Tool, EditorCommand } from '../types/index.js';

// ============================================================================
// Settings Types
// ============================================================================

export type {
  UserSettings,
  ProjectSettings,
} from '../schemas/settings-schemas.js';

// ============================================================================
// MCP Types
// ============================================================================

export type { MCPConfig } from '../mcp/config.js';
export type { MCPServerConfig } from '../mcp/client.js';

// ============================================================================
// Planning Types
// ============================================================================

export type {
  TaskPlan,
  TaskPhase,
  PhaseResult,
  PlanResult,
  PhaseStatus,
} from '../planner/types.js';

// ============================================================================
// Checkpoint Types
// ============================================================================

export type {
  Checkpoint,
  CheckpointMetadata,
  CheckpointFilter,
} from '../checkpoint/types.js';

// ============================================================================
// Event Types
// ============================================================================

import type { StreamingChunk } from '../agent/llm-agent.js';
import type { LLMToolCall } from '../llm/client.js';
import type { ToolResult } from '../types/index.js';
import type { SubagentState, SubagentResult } from '../agent/subagent-types.js';

/**
 * Events emitted by LLMAgent
 */
export interface AgentEvents {
  /** Streaming content chunk */
  stream: (chunk: StreamingChunk) => void;
  /** Tool execution started */
  tool_start: (toolCall: LLMToolCall) => void;
  /** Tool execution completed */
  tool_complete: (toolCall: LLMToolCall, result: ToolResult) => void;
  /** Token count updated */
  token_count: (count: number) => void;
  /** Error occurred */
  error: (error: Error) => void;
  /** Agent status changed */
  status: (status: 'idle' | 'processing' | 'waiting' | 'error') => void;
}

/**
 * Events emitted by Subagent
 */
export interface SubagentEvents {
  /** Subagent state changed */
  state_change: (state: SubagentState) => void;
  /** Progress updated (0-100) */
  progress: (progress: number) => void;
  /** Task started */
  task_start: (taskId: string) => void;
  /** Task completed */
  task_complete: (result: SubagentResult) => void;
  /** Subagent error */
  error: (error: Error) => void;
}
