/**
 * Agent Core Types
 *
 * Type definitions for the LLM Agent system.
 * These types extend @defai.digital/ax-schemas with concrete implementations
 * for OpenAI SDK compatibility.
 *
 * @packageDocumentation
 */

import type { LLMToolCall } from "../../llm/client.js";
import type { ToolResult } from "../../types/index.js";
import type {
  ChatEntry as SchemaChatEntry,
  StreamingChunk as SchemaStreamingChunk,
  AccumulatedMessage as SchemaAccumulatedMessage,
} from "@defai.digital/ax-schemas";

/**
 * Chat Entry - extends schema type with LLMToolCall for OpenAI SDK compatibility
 *
 * @remarks
 * The canonical type definition is in @defai.digital/ax-schemas.
 * This interface extends it to use the concrete LLMToolCall type from the LLM client.
 *
 * @see {@link SchemaChatEntry} for the canonical type definition
 */
export interface ChatEntry extends Omit<SchemaChatEntry, 'toolCalls' | 'toolCall'> {
  /** Tool calls made by assistant (uses LLMToolCall for OpenAI SDK compatibility) */
  toolCalls?: LLMToolCall[];
  /** Single tool call (uses LLMToolCall for OpenAI SDK compatibility) */
  toolCall?: LLMToolCall;
}

/**
 * Streaming Chunk - extends schema type with LLMToolCall for OpenAI SDK compatibility
 *
 * @remarks
 * The canonical type definition is in @defai.digital/ax-schemas.
 * This interface extends it to use concrete types from the LLM client and tools.
 *
 * @see {@link SchemaStreamingChunk} for the canonical type definition
 */
export interface StreamingChunk extends Omit<SchemaStreamingChunk, 'toolCalls' | 'toolCall' | 'toolResult'> {
  /** Tool calls from LLM (uses LLMToolCall for OpenAI SDK compatibility) */
  toolCalls?: LLMToolCall[];
  /** Single tool call (uses LLMToolCall for OpenAI SDK compatibility) */
  toolCall?: LLMToolCall;
  /** Tool execution result (uses ToolResult from types) */
  toolResult?: ToolResult;
}

/**
 * Accumulated message from streaming response - extends schema type
 *
 * @remarks
 * The canonical type definition is in @defai.digital/ax-schemas.
 * This interface extends it to use the concrete LLMToolCall type.
 *
 * @see {@link SchemaAccumulatedMessage} for the canonical type definition
 */
export interface AccumulatedMessage extends Omit<SchemaAccumulatedMessage, 'tool_calls'> {
  /** Tool calls accumulated from the response */
  tool_calls?: LLMToolCall[];
}

/**
 * Agent configuration options
 */
export interface AgentConfig {
  /** API key for LLM provider */
  apiKey: string;
  /** Base URL for API (optional) */
  baseURL?: string;
  /** Model to use */
  model?: string;
  /** Maximum tool execution rounds */
  maxToolRounds?: number;
}

/**
 * Agent events that can be emitted
 */
export type AgentEventType =
  | 'system'
  | 'error'
  | 'context:summary'
  | 'tool:approval_required'
  | 'tool:approved'
  | 'tool:rejected'
  | 'phase:started'
  | 'phase:completed'
  | 'phase:failed'
  | 'plan:created'
  | 'plan:completed'
  | 'plan:failed'
  | 'plan:report';

/**
 * Streaming result from processing chunks
 */
export interface StreamResult {
  accumulated: AccumulatedMessage;
  content: string;
  yielded: boolean;
}

/**
 * Tool parse result
 */
export type ToolParseResult =
  | { success: true; args: Record<string, unknown> }
  | { success: false; error: string };
