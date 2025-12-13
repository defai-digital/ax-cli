/**
 * Tests for use-chat-reducer.ts
 * Tests the chat state reducer for batched state updates
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatReducer, ChatState, ChatAction } from '../../../packages/core/src/ui/hooks/use-chat-reducer.js';
import type { ChatEntry } from '../../../packages/core/src/agent/llm-agent.js';

describe('useChatReducer', () => {
  const createMockEntry = (overrides: Partial<ChatEntry> = {}): ChatEntry => ({
    type: 'assistant',
    content: 'Test content',
    timestamp: new Date(),
    ...overrides,
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useChatReducer());

      expect(result.current.state).toEqual({
        history: [],
        isProcessing: false,
        isStreaming: false,
        tokenCount: 0,
        processingTime: 0,
        contextPercentage: 0,
        showAutoPrune: false,
      });
    });

    it('should initialize with provided initial history', () => {
      const initialEntry = createMockEntry({ content: 'Initial message' });
      const { result } = renderHook(() =>
        useChatReducer({ initialHistory: [initialEntry] })
      );

      expect(result.current.state.history).toHaveLength(1);
      expect(result.current.state.history[0].content).toBe('Initial message');
    });
  });

  describe('ADD_ENTRY action', () => {
    it('should add a new entry to history', () => {
      const { result } = renderHook(() => useChatReducer());
      const newEntry = createMockEntry({ content: 'New message' });

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: newEntry });
      });

      expect(result.current.state.history).toHaveLength(1);
      expect(result.current.state.history[0].content).toBe('New message');
    });

    it('should append entries in order', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: createMockEntry({ content: 'First' }) });
        result.current.dispatch({ type: 'ADD_ENTRY', entry: createMockEntry({ content: 'Second' }) });
        result.current.dispatch({ type: 'ADD_ENTRY', entry: createMockEntry({ content: 'Third' }) });
      });

      expect(result.current.state.history).toHaveLength(3);
      expect(result.current.state.history[0].content).toBe('First');
      expect(result.current.state.history[1].content).toBe('Second');
      expect(result.current.state.history[2].content).toBe('Third');
    });
  });

  describe('UPDATE_STREAMING_CONTENT action', () => {
    it('should append content to last streaming entry', () => {
      const { result } = renderHook(() => useChatReducer());
      const streamingEntry = createMockEntry({ content: 'Hello', isStreaming: true });

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: streamingEntry });
        result.current.dispatch({ type: 'UPDATE_STREAMING_CONTENT', content: ' World' });
      });

      expect(result.current.state.history[0].content).toBe('Hello World');
    });

    it('should not update non-streaming entry', () => {
      const { result } = renderHook(() => useChatReducer());
      const normalEntry = createMockEntry({ content: 'Hello', isStreaming: false });

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: normalEntry });
        result.current.dispatch({ type: 'UPDATE_STREAMING_CONTENT', content: ' World' });
      });

      expect(result.current.state.history[0].content).toBe('Hello');
    });

    it('should only update the last entry when streaming', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: createMockEntry({ content: 'First', isStreaming: false }) });
        result.current.dispatch({ type: 'ADD_ENTRY', entry: createMockEntry({ content: 'Second', isStreaming: true }) });
        result.current.dispatch({ type: 'UPDATE_STREAMING_CONTENT', content: ' updated' });
      });

      expect(result.current.state.history[0].content).toBe('First');
      expect(result.current.state.history[1].content).toBe('Second updated');
    });
  });

  describe('UPDATE_LAST_ENTRY action', () => {
    it('should update fields of the last entry', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: createMockEntry({ content: 'Test', isStreaming: true }) });
        result.current.dispatch({ type: 'UPDATE_LAST_ENTRY', updates: { isStreaming: false, content: 'Updated' } });
      });

      expect(result.current.state.history[0].content).toBe('Updated');
      expect(result.current.state.history[0].isStreaming).toBe(false);
    });

    it('should not affect other entries', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: createMockEntry({ content: 'First' }) });
        result.current.dispatch({ type: 'ADD_ENTRY', entry: createMockEntry({ content: 'Second' }) });
        result.current.dispatch({ type: 'UPDATE_LAST_ENTRY', updates: { content: 'Modified' } });
      });

      expect(result.current.state.history[0].content).toBe('First');
      expect(result.current.state.history[1].content).toBe('Modified');
    });
  });

  describe('BATCH_UPDATE action', () => {
    it('should update multiple state fields at once', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({
          type: 'BATCH_UPDATE',
          updates: {
            isProcessing: true,
            isStreaming: true,
            tokenCount: 500,
            processingTime: 1000,
          },
        });
      });

      expect(result.current.state.isProcessing).toBe(true);
      expect(result.current.state.isStreaming).toBe(true);
      expect(result.current.state.tokenCount).toBe(500);
      expect(result.current.state.processingTime).toBe(1000);
    });

    it('should preserve non-updated fields', () => {
      const { result } = renderHook(() => useChatReducer());
      const entry = createMockEntry();

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry });
        result.current.dispatch({ type: 'BATCH_UPDATE', updates: { tokenCount: 100 } });
      });

      expect(result.current.state.history).toHaveLength(1);
      expect(result.current.state.tokenCount).toBe(100);
    });
  });

  describe('processing state actions', () => {
    it('START_PROCESSING should set isProcessing to true', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'START_PROCESSING' });
      });

      expect(result.current.state.isProcessing).toBe(true);
    });

    it('STOP_PROCESSING should reset isProcessing and processingTime', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'START_PROCESSING' });
        result.current.dispatch({ type: 'BATCH_UPDATE', updates: { processingTime: 5000 } });
        result.current.dispatch({ type: 'STOP_PROCESSING' });
      });

      expect(result.current.state.isProcessing).toBe(false);
      expect(result.current.state.processingTime).toBe(0);
    });
  });

  describe('streaming state actions', () => {
    it('START_STREAMING should set isStreaming to true', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'START_STREAMING' });
      });

      expect(result.current.state.isStreaming).toBe(true);
    });

    it('STOP_STREAMING should set isStreaming to false', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'START_STREAMING' });
        result.current.dispatch({ type: 'STOP_STREAMING' });
      });

      expect(result.current.state.isStreaming).toBe(false);
    });
  });

  describe('UPDATE_TOKEN_COUNT action', () => {
    it('should update token count', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'UPDATE_TOKEN_COUNT', count: 1500 });
      });

      expect(result.current.state.tokenCount).toBe(1500);
    });
  });

  describe('UPDATE_PROCESSING_TIME action', () => {
    it('should update processing time', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'UPDATE_PROCESSING_TIME', time: 3500 });
      });

      expect(result.current.state.processingTime).toBe(3500);
    });
  });

  describe('UPDATE_CONTEXT_PERCENTAGE action', () => {
    it('should update context percentage', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'UPDATE_CONTEXT_PERCENTAGE', percentage: 75.5 });
      });

      expect(result.current.state.contextPercentage).toBe(75.5);
    });

    it('should update showAutoPrune when provided', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'UPDATE_CONTEXT_PERCENTAGE', percentage: 90, showAutoPrune: true });
      });

      expect(result.current.state.contextPercentage).toBe(90);
      expect(result.current.state.showAutoPrune).toBe(true);
    });

    it('should preserve showAutoPrune when not provided', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'UPDATE_CONTEXT_PERCENTAGE', percentage: 50, showAutoPrune: true });
        result.current.dispatch({ type: 'UPDATE_CONTEXT_PERCENTAGE', percentage: 60 });
      });

      expect(result.current.state.contextPercentage).toBe(60);
      expect(result.current.state.showAutoPrune).toBe(true);
    });
  });

  describe('CLEAR_HISTORY action', () => {
    it('should clear history and reset processing state', () => {
      const { result } = renderHook(() => useChatReducer());

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: createMockEntry() });
        result.current.dispatch({ type: 'START_PROCESSING' });
        result.current.dispatch({ type: 'START_STREAMING' });
        result.current.dispatch({ type: 'UPDATE_TOKEN_COUNT', count: 1000 });
        result.current.dispatch({ type: 'UPDATE_PROCESSING_TIME', time: 500 });
        result.current.dispatch({ type: 'CLEAR_HISTORY' });
      });

      expect(result.current.state.history).toEqual([]);
      expect(result.current.state.isProcessing).toBe(false);
      expect(result.current.state.isStreaming).toBe(false);
      expect(result.current.state.tokenCount).toBe(0);
      expect(result.current.state.processingTime).toBe(0);
    });
  });

  describe('REPLACE_HISTORY action', () => {
    it('should replace entire history', () => {
      const { result } = renderHook(() => useChatReducer());
      const newHistory = [
        createMockEntry({ content: 'Replaced 1' }),
        createMockEntry({ content: 'Replaced 2' }),
      ];

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: createMockEntry({ content: 'Original' }) });
        result.current.dispatch({ type: 'REPLACE_HISTORY', history: newHistory });
      });

      expect(result.current.state.history).toHaveLength(2);
      expect(result.current.state.history[0].content).toBe('Replaced 1');
      expect(result.current.state.history[1].content).toBe('Replaced 2');
    });
  });

  describe('UPDATE_TOOL_RESULT action', () => {
    it('should update tool call entry with result', () => {
      const { result } = renderHook(() => useChatReducer());
      const toolCallEntry: ChatEntry = {
        type: 'tool_call',
        content: 'Executing...',
        timestamp: new Date(),
        toolCall: { id: 'tool-123', function: { name: 'bash', arguments: '{}' }, type: 'function' },
      };

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: toolCallEntry });
        result.current.dispatch({
          type: 'UPDATE_TOOL_RESULT',
          toolCallId: 'tool-123',
          result: { success: true, output: 'Command completed' },
        });
      });

      expect(result.current.state.history[0].type).toBe('tool_result');
      expect(result.current.state.history[0].content).toBe('Command completed');
      expect(result.current.state.history[0].toolResult?.success).toBe(true);
    });

    it('should handle error results', () => {
      const { result } = renderHook(() => useChatReducer());
      const toolCallEntry: ChatEntry = {
        type: 'tool_call',
        content: 'Executing...',
        timestamp: new Date(),
        toolCall: { id: 'tool-456', function: { name: 'bash', arguments: '{}' }, type: 'function' },
      };

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: toolCallEntry });
        result.current.dispatch({
          type: 'UPDATE_TOOL_RESULT',
          toolCallId: 'tool-456',
          result: { success: false, error: 'Command failed' },
        });
      });

      expect(result.current.state.history[0].type).toBe('tool_result');
      expect(result.current.state.history[0].content).toBe('Command failed');
      expect(result.current.state.history[0].toolResult?.success).toBe(false);
    });

    it('should not update entries with different tool call id', () => {
      const { result } = renderHook(() => useChatReducer());
      const toolCallEntry: ChatEntry = {
        type: 'tool_call',
        content: 'Executing...',
        timestamp: new Date(),
        toolCall: { id: 'tool-789', function: { name: 'bash', arguments: '{}' }, type: 'function' },
      };

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: toolCallEntry });
        result.current.dispatch({
          type: 'UPDATE_TOOL_RESULT',
          toolCallId: 'different-id',
          result: { success: true, output: 'Should not appear' },
        });
      });

      expect(result.current.state.history[0].type).toBe('tool_call');
      expect(result.current.state.history[0].content).toBe('Executing...');
    });

    it('should use fallback content for empty success output', () => {
      const { result } = renderHook(() => useChatReducer());
      const toolCallEntry: ChatEntry = {
        type: 'tool_call',
        content: 'Executing...',
        timestamp: new Date(),
        toolCall: { id: 'tool-empty', function: { name: 'bash', arguments: '{}' }, type: 'function' },
      };

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: toolCallEntry });
        result.current.dispatch({
          type: 'UPDATE_TOOL_RESULT',
          toolCallId: 'tool-empty',
          result: { success: true },
        });
      });

      expect(result.current.state.history[0].content).toBe('Success');
    });

    it('should use fallback content for empty error output', () => {
      const { result } = renderHook(() => useChatReducer());
      const toolCallEntry: ChatEntry = {
        type: 'tool_call',
        content: 'Executing...',
        timestamp: new Date(),
        toolCall: { id: 'tool-err', function: { name: 'bash', arguments: '{}' }, type: 'function' },
      };

      act(() => {
        result.current.dispatch({ type: 'ADD_ENTRY', entry: toolCallEntry });
        result.current.dispatch({
          type: 'UPDATE_TOOL_RESULT',
          toolCallId: 'tool-err',
          result: { success: false },
        });
      });

      expect(result.current.state.history[0].content).toBe('Error occurred');
    });
  });

  describe('unknown action', () => {
    it('should return current state for unknown action types', () => {
      const { result } = renderHook(() => useChatReducer());
      const initialState = { ...result.current.state };

      act(() => {
        // @ts-expect-error - Testing unknown action type
        result.current.dispatch({ type: 'UNKNOWN_ACTION' });
      });

      expect(result.current.state).toEqual(initialState);
    });
  });
});
