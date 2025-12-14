import { describe, it, expect, beforeEach } from 'vitest';
import { FailureDetector } from '../../packages/core/src/agent/correction/failure-detector.js';
import type { LLMToolCall } from '../../packages/core/src/llm/client.js';
import type { ToolResult } from '../../packages/core/src/types/index.js';

const makeToolCall = (args: Record<string, unknown> = {}): LLMToolCall => ({
  id: 'call-1',
  type: 'function',
  function: {
    name: 'edit_file',
    arguments: JSON.stringify(args),
  },
});

const success: ToolResult = { success: true, output: 'ok' };
const failure = (message: string): ToolResult => ({ success: false, error: message });

describe('FailureDetector', () => {
  let detector: FailureDetector;

  beforeEach(() => {
    detector = new FailureDetector({ customPatterns: ['ALERT'] });
    detector.reset();
  });

  it('detects tool errors and provides actionable suggestions', () => {
    const signal = detector.detectFailure(makeToolCall({ path: 'file.txt' }), failure('ENOENT: file not found'));
    expect(signal?.type).toBe('tool_error');
    expect(signal?.context.attemptCount).toBe(1);
    expect(signal?.suggestion).toContain('path');
    expect(detector.shouldAttemptCorrection(signal!)).toBe(true);
  });

  it('integrates loop detection when enabled', () => {
    const loopSignal = detector.detectFailure(
      makeToolCall(),
      success,
      { isLoop: true, reason: 'stuck', evidence: [] } as any
    );

    expect(loopSignal?.type).toBe('loop_detected');
    expect(loopSignal?.context.loopResult?.reason).toBe('stuck');
  });

  it('escalates severity for repeated failures and stops when not recoverable', () => {
    // Record a couple of hard failures first
    detector.detectFailure(makeToolCall({ filename: 'a.ts' }), failure('permission denied'));
    detector.detectFailure(makeToolCall({ filename: 'a.ts' }), failure('permission denied'));
    detector.detectFailure(makeToolCall({ filename: 'a.ts' }), failure('permission denied'));
    detector.detectFailure(makeToolCall({ filename: 'a.ts' }), failure('permission denied'));

    // Next call succeeds but should be treated as repeated failure due to history
    const last = detector.detectFailure(
      makeToolCall({ filename: 'a.ts' }),
      { success: true, output: 'still failing silently' }
    );

    expect(last?.type).toBe('repeated_failure');
    expect(last?.context.attemptCount).toBe(5);
    expect(last?.severity).toBe('critical');
    expect(last?.recoverable).toBe(false);
  });

  it('matches custom and built-in error patterns on successful outputs', () => {
    const custom = detector.detectFailure(makeToolCall(), { success: true, output: 'ALERT: investigate' });
    expect(custom?.type).toBe('custom');
    expect(custom?.context.matchedPattern).toContain('ALERT');

    const pattern = detector.detectFailure(makeToolCall(), { success: true, output: 'syntax error near token' });
    expect(pattern?.type).toBe('validation_error');
    expect(detector.shouldAttemptCorrection(pattern!)).toBe(false);
  });

  it('tracks stats, correction attempts, and cleans up stale entries', () => {
    const signal = detector.detectFailure(makeToolCall({ path: 'stale.txt' }), failure('timeout'));
    detector.recordCorrectionAttempt(signal!, true);

    const stats = detector.getStats();
    expect(stats.totalFailures).toBe(1);
    expect(stats.totalCorrections).toBe(1);
    expect(stats.successRate).toBe(1);

    // Force record to age out
    const state = (detector as any).state;
    const key = state.records.keys().next().value;
    state.records.get(key).lastFailureAt = new Date(Date.now() - 10 * 60 * 1000);

    detector.cleanup();
    expect(detector.getStats().activeRecords).toBe(0);
  });
});
