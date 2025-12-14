import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { JSDOM } from 'jsdom';
import {
  useStreamingHandler,
  shouldIgnoreContentChunk,
  processStream,
} from '../../../packages/core/src/ui/hooks/use-streaming-handler.js';
import type { StreamingChunk, ChatEntry } from '../../../packages/core/src/agent/llm-agent.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});

describe('useStreamingHandler', () => {
  const setup = () => renderHook(() => {
    const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [tokenCount, setTokenCount] = useState(0);

    const handler = useStreamingHandler({ setChatHistory, setIsStreaming, setTokenCount });
    return { handler, chatHistory, isStreaming, tokenCount };
  });

  it('streams content, tool calls, results, and token counts', () => {
    const { result } = setup();

    act(() => {
      result.current.handler.resetStream();
      result.current.handler.handleChunk({ type: 'content', content: 'Hello' });
      result.current.handler.handleChunk({ type: 'token_count', tokenCount: 10 });
      result.current.handler.handleChunk({ type: 'content', content: ' world' });
      result.current.handler.handleChunk({
        type: 'tool_calls',
        toolCalls: [{
          id: 'tool-1',
          type: 'function',
          function: { name: 'do', arguments: '{}' },
        }],
      });
      result.current.handler.handleChunk({
        type: 'tool_result',
        toolCall: { id: 'tool-1', type: 'function', function: { name: 'do', arguments: '{}' } },
        toolResult: { success: true, output: 'ok' },
        executionDurationMs: 5,
      });
      result.current.handler.handleChunk({ type: 'done' });
    });

    expect(result.current.tokenCount).toBe(10);
    expect(result.current.chatHistory[0].content).toBe('Hello world');
    expect(result.current.chatHistory.find(entry => entry.type === 'tool_result')?.toolResult?.success).toBe(true);
    expect(result.current.isStreaming).toBe(false);
  });

  it('processes async streams and surfaces errors', async () => {
    const { result } = setup();

    const okStream = async function* () {
      yield { type: 'content', content: 'chunk' } as StreamingChunk;
      yield { type: 'done' } as StreamingChunk;
    };

    await act(async () => {
      await processStream(okStream(), result.current.handler);
    });
    expect(result.current.chatHistory[0].content).toContain('chunk');

    const errorStream = async function* () {
      throw new Error('stream boom');
    };

    let caught: unknown;
    await act(async () => {
      try {
        await processStream(errorStream(), result.current.handler);
      } catch (err) {
        caught = err;
      }
    });

    expect((caught as Error).message).toBe('stream boom');
    expect(result.current.chatHistory.find(entry => entry.content?.includes('Error: stream boom'))).toBeTruthy();
  });

  it('handles reasoning chunks and finalizes active streams', () => {
    const { result } = setup();

    act(() => {
      result.current.handler.resetStream();
      result.current.handler.handleChunk({ type: 'reasoning', reasoningContent: 'thinking...' } as StreamingChunk);
    });

    expect(result.current.handler.hasActiveStream()).toBe(true);
    expect(result.current.chatHistory.at(-1)?.reasoningContent).toContain('thinking...');

    act(() => {
      result.current.handler.finalizeStream();
    });

    expect(result.current.handler.hasActiveStream()).toBe(false);
    expect(result.current.chatHistory.at(-1)?.isStreaming).toBe(false);
  });

  it('ignores empty content chunks until streaming has begun', () => {
    expect(shouldIgnoreContentChunk('   ', false)).toBe(true);
    expect(shouldIgnoreContentChunk(undefined, false)).toBe(true);
    expect(shouldIgnoreContentChunk('', true)).toBe(false);
  });
});
