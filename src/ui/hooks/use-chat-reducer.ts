/**
 * Unified chat state reducer for batched state updates
 * Reduces re-renders by combining multiple state changes into single update
 */

import { useReducer, Reducer } from 'react';
import type { ChatEntry } from '../../agent/llm-agent.js';

export interface ChatState {
  history: ChatEntry[];
  isProcessing: boolean;
  isStreaming: boolean;
  tokenCount: number;
  processingTime: number;
  contextPercentage: number;
  showAutoPrune: boolean;
}

export type ChatAction =
  | { type: 'ADD_ENTRY'; entry: ChatEntry }
  | { type: 'UPDATE_STREAMING_CONTENT'; content: string }
  | { type: 'UPDATE_LAST_ENTRY'; updates: Partial<ChatEntry> }
  | { type: 'BATCH_UPDATE'; updates: Partial<ChatState> }
  | { type: 'START_PROCESSING' }
  | { type: 'STOP_PROCESSING' }
  | { type: 'START_STREAMING' }
  | { type: 'STOP_STREAMING' }
  | { type: 'UPDATE_TOKEN_COUNT'; count: number }
  | { type: 'UPDATE_PROCESSING_TIME'; time: number }
  | { type: 'UPDATE_CONTEXT_PERCENTAGE'; percentage: number; showAutoPrune?: boolean }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'REPLACE_HISTORY'; history: ChatEntry[] }
  | { type: 'UPDATE_TOOL_RESULT'; toolCallId: string; result: any };

const chatReducer: Reducer<ChatState, ChatAction> = (state, action) => {
  switch (action.type) {
    case 'BATCH_UPDATE':
      // Most efficient: update multiple fields in one re-render
      return { ...state, ...action.updates };

    case 'ADD_ENTRY':
      // Add new chat entry
      return {
        ...state,
        history: [...state.history, action.entry],
      };

    case 'UPDATE_STREAMING_CONTENT':
      // Update content of the last streaming entry
      return {
        ...state,
        history: state.history.map((entry, idx) =>
          idx === state.history.length - 1 && entry.isStreaming
            ? { ...entry, content: entry.content + action.content }
            : entry
        ),
      };

    case 'UPDATE_LAST_ENTRY':
      // Update specific fields of the last entry
      return {
        ...state,
        history: state.history.map((entry, idx) =>
          idx === state.history.length - 1
            ? { ...entry, ...action.updates }
            : entry
        ),
      };

    case 'START_PROCESSING':
      return {
        ...state,
        isProcessing: true,
      };

    case 'STOP_PROCESSING':
      return {
        ...state,
        isProcessing: false,
        processingTime: 0,
      };

    case 'START_STREAMING':
      return {
        ...state,
        isStreaming: true,
      };

    case 'STOP_STREAMING':
      return {
        ...state,
        isStreaming: false,
      };

    case 'UPDATE_TOKEN_COUNT':
      return {
        ...state,
        tokenCount: action.count,
      };

    case 'UPDATE_PROCESSING_TIME':
      return {
        ...state,
        processingTime: action.time,
      };

    case 'UPDATE_CONTEXT_PERCENTAGE':
      return {
        ...state,
        contextPercentage: action.percentage,
        showAutoPrune: action.showAutoPrune ?? state.showAutoPrune,
      };

    case 'CLEAR_HISTORY':
      return {
        ...state,
        history: [],
        tokenCount: 0,
        processingTime: 0,
        isProcessing: false,
        isStreaming: false,
      };

    case 'REPLACE_HISTORY':
      return {
        ...state,
        history: action.history,
      };

    case 'UPDATE_TOOL_RESULT':
      // Update a specific tool call entry with results
      return {
        ...state,
        history: state.history.map((entry) => {
          if (entry.type === 'tool_call' && entry.toolCall?.id === action.toolCallId) {
            return {
              ...entry,
              type: 'tool_result',
              content: action.result.success
                ? action.result.output || 'Success'
                : action.result.error || 'Error occurred',
              toolResult: action.result,
            };
          }
          return entry;
        }),
      };

    default:
      return state;
  }
};

export interface UseChatReducerOptions {
  initialHistory?: ChatEntry[];
}

export const useChatReducer = (options: UseChatReducerOptions = {}) => {
  const [state, dispatch] = useReducer(chatReducer, {
    history: options.initialHistory || [],
    isProcessing: false,
    isStreaming: false,
    tokenCount: 0,
    processingTime: 0,
    contextPercentage: 0,
    showAutoPrune: false,
  });

  return { state, dispatch };
};
