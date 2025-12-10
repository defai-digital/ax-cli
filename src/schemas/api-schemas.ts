/**
 * Zod schemas for API request/response validation
 * Ensures type safety for external API interactions
 */

import { z } from 'zod';
import { ToolCallIdSchema, ModelIdSchema } from '@defai.digital/ax-schemas';

// Local schemas to avoid __brand symbol export issues
const MessageRoleEnum = z.enum(['system', 'user', 'assistant', 'tool']);

// LLM Tool Call Schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LLMToolCallSchema: z.ZodType<any> = z.object({
  id: ToolCallIdSchema,
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

export type LLMToolCall = z.infer<typeof LLMToolCallSchema>;

// LLM Message Schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LLMMessageSchema: z.ZodType<any> = z.object({
  role: MessageRoleEnum,
  content: z.string().nullable(),
  tool_calls: z.array(LLMToolCallSchema).optional(),
  tool_call_id: ToolCallIdSchema.optional(),
  name: z.string().optional(),
});

export type LLMMessage = z.infer<typeof LLMMessageSchema>;

// LLM Response Schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LLMResponseSchema: z.ZodType<any> = z.object({
  id: z.string().optional(),
  object: z.string().optional(),
  created: z.number().optional(),
  model: ModelIdSchema.optional(),
  choices: z.array(
    z.object({
      index: z.number().optional(),
      message: z.object({
        role: z.string(),
        content: z.string().nullable(),
        tool_calls: z.array(LLMToolCallSchema).optional(),
      }),
      finish_reason: z.string().nullable(),
    })
  ),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
      reasoning_tokens: z.number().optional(), // GLM-4.6 thinking mode support
    })
    .optional(),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;

// Search Parameters Schema
export const SearchParametersSchema = z.object({
  mode: z.enum(['auto', 'on', 'off']).optional(),
});

export type SearchParameters = z.infer<typeof SearchParametersSchema>;

// Search Options Schema
export const SearchOptionsSchema = z.object({
  search_parameters: SearchParametersSchema.optional(),
});

export type SearchOptions = z.infer<typeof SearchOptionsSchema>;

// Streaming Chunk Schema
export const StreamingChunkSchema: z.ZodType<any> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('content'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('reasoning'),
    reasoningContent: z.string(),
  }),
  z.object({
    type: z.literal('tool_calls'),
    toolCalls: z.array(LLMToolCallSchema),
  }),
  z.object({
    type: z.literal('tool_result'),
    toolCall: LLMToolCallSchema,
    toolResult: z.object({
      success: z.boolean(),
      output: z.string().optional(),
      error: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('token_count'),
    tokenCount: z.number(),
  }),
  z.object({
    type: z.literal('done'),
  }),
]);

export type StreamingChunk = z.infer<typeof StreamingChunkSchema>;

// Chat Entry Schema
export const ChatEntrySchema: z.ZodType<any> = z.object({
  type: z.enum(['user', 'assistant', 'tool_result', 'tool_call']),
  content: z.string(),
  timestamp: z.coerce.date().refine(d => !isNaN(d.getTime()), { message: "Invalid date" }),
  toolCalls: z.array(LLMToolCallSchema).optional(),
  toolCall: LLMToolCallSchema.optional(),
  toolResult: z
    .object({
      success: z.boolean(),
      output: z.string().optional(),
      error: z.string().optional(),
    })
    .optional(),
  isStreaming: z.boolean().optional(),
});

export type ChatEntry = z.infer<typeof ChatEntrySchema>;

/**
 * Validation helper functions
 */

export function validateLLMResponse(data: unknown): LLMResponse {
  return LLMResponseSchema.parse(data);
}

export function safeValidateLLMResponse(data: unknown): {
  success: boolean;
  data?: LLMResponse;
  error?: z.ZodError;
} {
  const result = LLMResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// Deprecated alias for backward compatibility
export const safeValidateGrokResponse = safeValidateLLMResponse;

export function validateToolCall(data: unknown): LLMToolCall {
  return LLMToolCallSchema.parse(data);
}

export function validateChatEntry(data: unknown): ChatEntry {
  return ChatEntrySchema.parse(data);
}
