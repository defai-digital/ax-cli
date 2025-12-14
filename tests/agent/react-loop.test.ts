import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  ReActLoop,
  createReActLoop,
} from '../../packages/core/src/agent/react/react-loop.js';
import {
  ReActScratchpad,
  createScratchpad,
} from '../../packages/core/src/agent/react/scratchpad.js';
import { NO_PROGRESS_PROMPT } from '../../packages/core/src/agent/react/types.js';
import type {
  LLMClient,
  LLMMessage,
  LLMResponse,
  LLMTool,
} from '../../packages/core/src/llm/client.js';

const baseMessages: LLMMessage[] = [{ role: 'user', content: 'Help me test' }];

function createMockLLM(responses: LLMResponse[]): LLMClient {
  return {
    chat: vi.fn(async () => {
      const next = responses.shift();
      if (!next) {
        throw new Error('No more mock responses');
      }
      return next;
    }),
  } as unknown as LLMClient;
}

const tool: LLMTool = {
  type: 'function',
  function: {
    name: 'testTool',
    description: 'Test tool',
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

describe('ReActScratchpad', () => {
  it('tracks steps, formatting, and failure states', () => {
    const scratchpad = new ReActScratchpad('Ship feature');

    const stepNumber = scratchpad.startStep();
    scratchpad.setThought('Detailed reasoning about the task');
    scratchpad.setAction({ type: 'tool_call', tool: 'testTool', arguments: { flag: true } });
    scratchpad.setObservation('Tool output', true);
    const completed = scratchpad.completeStep();

    expect(completed?.status).toBe('completed');
    expect(completed?.durationMs).toBeGreaterThanOrEqual(0);
    expect(scratchpad.currentStepNumber).toBe(stepNumber);
    expect(scratchpad.format()).toContain('Tool output');
    expect(scratchpad.formatCompact()).toBe('1. testTool ✓');
    expect(scratchpad.isComplete).toBe(false);

    scratchpad.startStep();
    const failed = scratchpad.failStep('boom');
    expect(failed?.status).toBe('failed');
    expect(failed?.observation).toContain('Error: boom');
  });

  it('detects stalling, prunes history, and summarizes observations', () => {
    const scratchpad = new ReActScratchpad('Improve coverage', 10);

    for (let i = 0; i < 6; i++) {
      scratchpad.startStep();
      scratchpad.setThought(`Thought ${i} ${'x'.repeat(50)}`);
      scratchpad.setObservation(`Observation ${i} ${'y'.repeat(120)}`, false);
      scratchpad.completeStep();
    }

    expect(scratchpad.steps.length).toBe(5); // pruned to keep recent steps
    expect(scratchpad.isStalled(3)).toBe(true);
    expect(scratchpad.format()).toContain('Previous 1 steps:');
    expect(scratchpad.format()).toContain('Observation 5'); // keeps recent detail
    expect(scratchpad.format()).toContain('...'); // summarized long observation

    const exported = scratchpad.exportState();
    const restored = createScratchpad('Placeholder');
    restored.importState(exported);

    expect(restored.steps.length).toBe(scratchpad.steps.length);

    restored.reset('New goal');
    expect(restored.goal).toBe('New goal');
    expect(restored.steps.length).toBe(0);
  });
});

describe('ReActLoop', () => {
  it('executes a tool call step and emits events', async () => {
    const llm = createMockLLM([{
      choices: [{
        message: {
          role: 'assistant',
          reasoning_content: 'Looking up info',
          content: null,
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'testTool', arguments: '{"query":"docs"}' },
          }],
        },
        finish_reason: 'tool_calls',
      }],
    }]);

    const executeToolCall = vi.fn(async () => ({ success: true, output: 'ok' }));
    const emitter = new EventEmitter();
    const stepEvents: unknown[] = [];
    emitter.on('react_step_start', event => stepEvents.push(event));
    emitter.on('react_step_complete', event => stepEvents.push(event));

    const loop = new ReActLoop({
      llmClient: llm,
      tools: [tool],
      executeToolCall,
      emitter,
      config: { maxSteps: 1, useThinkingMode: false },
      systemPrompt: 'System context',
    });

    const chunks: unknown[] = [];
    for await (const chunk of loop.execute({ goal: 'Fetch docs', messages: baseMessages })) {
      chunks.push(chunk);
    }

    const complete = chunks.find((c: any) => c.type === 'react_complete');
    const stepChunk = chunks.find((c: any) => c.type === 'react_step');

    expect(stepChunk?.step?.action?.tool).toBe('testTool');
    expect(complete?.result?.stopReason).toBe('max_steps');
    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(stepEvents.length).toBeGreaterThanOrEqual(2);
    expect(loop.getScratchpad()?.steps.length).toBe(1);
  });

  it('stops when the model returns a completion response', async () => {
    const llm = createMockLLM([{
      choices: [{
        message: {
          role: 'assistant',
          content: 'Task complete: all changes applied.',
        },
        finish_reason: 'stop',
      }],
    }]);

    const loop = createReActLoop({
      llmClient: llm,
      tools: [],
      executeToolCall: vi.fn(),
      config: { maxSteps: 3, useThinkingMode: false },
    });

    const chunks: any[] = [];
    for await (const chunk of loop.execute({ goal: 'Finish task', messages: baseMessages })) {
      chunks.push(chunk);
    }

    const complete = chunks.find(c => c.type === 'react_complete');
    expect(complete?.result?.success).toBe(true);
    expect(complete?.result?.stopReason).toBe('goal_achieved');
    expect(complete?.result?.finalResponse).toContain('Task complete');
    expect(loop.getScratchpad()?.steps[0].action?.type).toBe('respond');
  });

  it('builds stall prompts and safely parses JSON', () => {
    const loop = new ReActLoop({
      llmClient: createMockLLM([]),
      tools: [],
      executeToolCall: vi.fn(),
    });

    const scratchpad = createScratchpad('Investigate stalling');
    for (let i = 0; i < 3; i++) {
      scratchpad.startStep();
      scratchpad.setObservation('No action', false);
      scratchpad.completeStep();
    }

    (loop as any).scratchpad = scratchpad;
    const prompt = (loop as any).buildThoughtPrompt() as string;

    expect(prompt).toContain(NO_PROGRESS_PROMPT.trim());
    expect((loop as any).safeParseJSON('{"ok":true}')).toEqual({ ok: true });
    expect((loop as any).safeParseJSON('not-json')).toEqual({});
    expect((loop as any).isCompletionIndicator('I will do that next', 'stop')).toBe(false);
    expect((loop as any).isCompletionIndicator('Task complete', 'stop')).toBe(true);
  });
});
