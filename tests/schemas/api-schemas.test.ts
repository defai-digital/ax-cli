/**
 * Tests for schemas/api-schemas module
 * Tests Zod schemas for API request/response validation
 */
import { describe, it, expect } from 'vitest';
import {
  LLMToolCallSchema,
  LLMMessageSchema,
  LLMResponseSchema,
  SearchParametersSchema,
  StreamingChunkSchema,
  ChatEntrySchema,
  validateLLMResponse,
  safeValidateLLMResponse,
  validateToolCall,
  validateChatEntry,
  safeValidateGrokResponse,
} from '../../packages/core/src/schemas/api-schemas.js';

describe('LLMToolCallSchema', () => {
  it('should validate valid tool call', () => {
    const toolCall = {
      id: 'call_123',
      type: 'function',
      function: {
        name: 'test_tool',
        arguments: '{"arg": "value"}',
      },
    };

    const result = LLMToolCallSchema.safeParse(toolCall);
    expect(result.success).toBe(true);
  });

  it('should reject tool call with wrong type', () => {
    const toolCall = {
      id: 'call_123',
      type: 'invalid',
      function: {
        name: 'test_tool',
        arguments: '{}',
      },
    };

    const result = LLMToolCallSchema.safeParse(toolCall);
    expect(result.success).toBe(false);
  });

  it('should reject tool call without function', () => {
    const toolCall = {
      id: 'call_123',
      type: 'function',
    };

    const result = LLMToolCallSchema.safeParse(toolCall);
    expect(result.success).toBe(false);
  });
});

describe('LLMMessageSchema', () => {
  it('should validate user message', () => {
    const message = {
      role: 'user',
      content: 'Hello world',
    };

    const result = LLMMessageSchema.safeParse(message);
    expect(result.success).toBe(true);
  });

  it('should validate assistant message with null content', () => {
    const message = {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_123',
          type: 'function',
          function: { name: 'test', arguments: '{}' },
        },
      ],
    };

    const result = LLMMessageSchema.safeParse(message);
    expect(result.success).toBe(true);
  });

  it('should validate tool message', () => {
    const message = {
      role: 'tool',
      content: 'Tool result',
      tool_call_id: 'call_123',
    };

    const result = LLMMessageSchema.safeParse(message);
    expect(result.success).toBe(true);
  });

  it('should reject invalid role', () => {
    const message = {
      role: 'invalid',
      content: 'Hello',
    };

    const result = LLMMessageSchema.safeParse(message);
    expect(result.success).toBe(false);
  });
});

describe('LLMResponseSchema', () => {
  it('should validate minimal response', () => {
    const response = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Hello!',
          },
          finish_reason: 'stop',
        },
      ],
    };

    const result = LLMResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate full response with usage', () => {
    const response = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1700000000,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello!',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    };

    const result = LLMResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate response with reasoning tokens', () => {
    const response = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Hello!',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        reasoning_tokens: 5,
      },
    };

    const result = LLMResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should validate response with tool calls', () => {
    const response = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_123',
                type: 'function',
                function: { name: 'test', arguments: '{}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    };

    const result = LLMResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });
});

describe('SearchParametersSchema', () => {
  it('should validate search parameters', () => {
    const params = { mode: 'auto' };
    const result = SearchParametersSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should validate all mode values', () => {
    for (const mode of ['auto', 'on', 'off']) {
      const result = SearchParametersSchema.safeParse({ mode });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid mode', () => {
    const result = SearchParametersSchema.safeParse({ mode: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('should allow empty object', () => {
    const result = SearchParametersSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('StreamingChunkSchema', () => {
  it('should validate content chunk', () => {
    const chunk = { type: 'content', content: 'Hello' };
    const result = StreamingChunkSchema.safeParse(chunk);
    expect(result.success).toBe(true);
  });

  it('should validate reasoning chunk', () => {
    const chunk = { type: 'reasoning', reasoningContent: 'Thinking...' };
    const result = StreamingChunkSchema.safeParse(chunk);
    expect(result.success).toBe(true);
  });

  it('should validate tool_calls chunk', () => {
    const chunk = {
      type: 'tool_calls',
      toolCalls: [
        {
          id: 'call_123',
          type: 'function',
          function: { name: 'test', arguments: '{}' },
        },
      ],
    };
    const result = StreamingChunkSchema.safeParse(chunk);
    expect(result.success).toBe(true);
  });

  it('should validate tool_result chunk', () => {
    const chunk = {
      type: 'tool_result',
      toolCall: {
        id: 'call_123',
        type: 'function',
        function: { name: 'test', arguments: '{}' },
      },
      toolResult: {
        success: true,
        output: 'Result',
      },
    };
    const result = StreamingChunkSchema.safeParse(chunk);
    expect(result.success).toBe(true);
  });

  it('should validate token_count chunk', () => {
    const chunk = { type: 'token_count', tokenCount: 100 };
    const result = StreamingChunkSchema.safeParse(chunk);
    expect(result.success).toBe(true);
  });

  it('should validate done chunk', () => {
    const chunk = { type: 'done' };
    const result = StreamingChunkSchema.safeParse(chunk);
    expect(result.success).toBe(true);
  });

  it('should reject invalid chunk type', () => {
    const chunk = { type: 'invalid' };
    const result = StreamingChunkSchema.safeParse(chunk);
    expect(result.success).toBe(false);
  });
});

describe('ChatEntrySchema', () => {
  it('should validate user entry', () => {
    const entry = {
      type: 'user',
      content: 'Hello',
      timestamp: new Date().toISOString(),
    };
    const result = ChatEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('should validate assistant entry', () => {
    const entry = {
      type: 'assistant',
      content: 'Hello!',
      timestamp: new Date().toISOString(),
    };
    const result = ChatEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('should validate tool_call entry', () => {
    const entry = {
      type: 'tool_call',
      content: 'Calling tool...',
      timestamp: new Date().toISOString(),
      toolCall: {
        id: 'call_123',
        type: 'function',
        function: { name: 'test', arguments: '{}' },
      },
    };
    const result = ChatEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('should validate tool_result entry', () => {
    const entry = {
      type: 'tool_result',
      content: 'Result',
      timestamp: new Date().toISOString(),
      toolResult: {
        success: true,
        output: 'Output',
      },
    };
    const result = ChatEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('should validate tool_result with error', () => {
    const entry = {
      type: 'tool_result',
      content: 'Error',
      timestamp: new Date().toISOString(),
      toolResult: {
        success: false,
        error: 'Something went wrong',
      },
    };
    const result = ChatEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('should coerce string timestamp to Date', () => {
    const entry = {
      type: 'user',
      content: 'Hello',
      timestamp: '2024-01-01T00:00:00Z',
    };
    const result = ChatEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timestamp).toBeInstanceOf(Date);
    }
  });

  it('should reject invalid timestamp', () => {
    const entry = {
      type: 'user',
      content: 'Hello',
      timestamp: 'not-a-date',
    };
    const result = ChatEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it('should validate entry with isStreaming', () => {
    const entry = {
      type: 'assistant',
      content: 'Hello',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };
    const result = ChatEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('should validate entry with toolCalls array', () => {
    const entry = {
      type: 'assistant',
      content: 'Using tools',
      timestamp: new Date().toISOString(),
      toolCalls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'tool1', arguments: '{}' },
        },
        {
          id: 'call_2',
          type: 'function',
          function: { name: 'tool2', arguments: '{}' },
        },
      ],
    };
    const result = ChatEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });
});

describe('validateLLMResponse', () => {
  it('should return validated response for valid data', () => {
    const response = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Hello!',
          },
          finish_reason: 'stop',
        },
      ],
    };

    const result = validateLLMResponse(response);
    expect(result.choices[0].message.content).toBe('Hello!');
  });

  it('should throw for invalid data', () => {
    const invalidResponse = { invalid: 'data' };
    expect(() => validateLLMResponse(invalidResponse)).toThrow();
  });
});

describe('safeValidateLLMResponse', () => {
  it('should return success for valid data', () => {
    const response = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Hello!',
          },
          finish_reason: 'stop',
        },
      ],
    };

    const result = safeValidateLLMResponse(response);
    expect(result.success).toBe(true);
    expect(result.data?.choices[0].message.content).toBe('Hello!');
  });

  it('should return error for invalid data', () => {
    const invalidResponse = { invalid: 'data' };
    const result = safeValidateLLMResponse(invalidResponse);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('safeValidateGrokResponse (deprecated alias)', () => {
  it('should be same function as safeValidateLLMResponse', () => {
    expect(safeValidateGrokResponse).toBe(safeValidateLLMResponse);
  });
});

describe('validateToolCall', () => {
  it('should return validated tool call for valid data', () => {
    const toolCall = {
      id: 'call_123',
      type: 'function',
      function: {
        name: 'test_tool',
        arguments: '{"arg": "value"}',
      },
    };

    const result = validateToolCall(toolCall);
    expect(result.id).toBe('call_123');
    expect(result.function.name).toBe('test_tool');
  });

  it('should throw for invalid data', () => {
    const invalidToolCall = { id: 'call_123' };
    expect(() => validateToolCall(invalidToolCall)).toThrow();
  });
});

describe('validateChatEntry', () => {
  it('should return validated chat entry for valid data', () => {
    const entry = {
      type: 'user',
      content: 'Hello',
      timestamp: new Date().toISOString(),
    };

    const result = validateChatEntry(entry);
    expect(result.type).toBe('user');
    expect(result.content).toBe('Hello');
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('should throw for invalid data', () => {
    const invalidEntry = { type: 'invalid' };
    expect(() => validateChatEntry(invalidEntry)).toThrow();
  });

  it('should coerce timestamp and validate date', () => {
    const entry = {
      type: 'assistant',
      content: 'Response',
      timestamp: '2024-06-15T10:30:00.000Z',
    };

    const result = validateChatEntry(entry);
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.timestamp.toISOString()).toBe('2024-06-15T10:30:00.000Z');
  });
});
