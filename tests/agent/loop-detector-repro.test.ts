
import { LoopDetector, getLoopDetector, resetLoopDetector } from '../../packages/core/src/agent/loop-detector';
import { LLMToolCall } from '../../packages/core/src/llm/client';
import { describe, it, expect, beforeEach } from 'vitest';

describe('LoopDetector Bug Repro', () => {
  let detector: LoopDetector;

  beforeEach(() => {
    resetLoopDetector();
    detector = getLoopDetector();
  });

  it('should detect false positive loop when str_replace_editor old_str differs only after 200 chars', () => {
    const longStringBase = 'a'.repeat(200);
    const oldStr1 = longStringBase + '1';
    const oldStr2 = longStringBase + '2';
    const oldStr3 = longStringBase + '3';
    const oldStr4 = longStringBase + '4';
    const oldStr5 = longStringBase + '5';

    const createToolCall = (oldStr: string): LLMToolCall => ({
      id: 'call_1',
      type: 'function',
      function: {
        name: 'str_replace_editor',
        arguments: JSON.stringify({
          path: 'test.txt',
          old_str: oldStr,
          new_str: 'something'
        })
      }
    });

    // Simulate sequence of distinct edits
    // Call 1
    let call = createToolCall(oldStr1);
    detector.recordToolCall(call, false); // Fail

    // Call 2
    call = createToolCall(oldStr2);
    let result = detector.checkForLoop(call);
    expect(result.isLoop).toBe(false);
    detector.recordToolCall(call, false);

    // Call 3
    call = createToolCall(oldStr3);
    result = detector.checkForLoop(call);
    expect(result.isLoop).toBe(false);
    detector.recordToolCall(call, false);

    // Call 4
    call = createToolCall(oldStr4);
    result = detector.checkForLoop(call);
    expect(result.isLoop).toBe(false); // Should be false as strings are different
    detector.recordToolCall(call, false);

    // Call 5 - Threshold for str_replace_editor is 4.
    // If signatures match, this will trigger loop detection.
    call = createToolCall(oldStr5);
    result = detector.checkForLoop(call);
    
    // After fix: should not detect loop since old_str values are different
    // Assert that no loop is detected (fixed behavior)
    expect(result.isLoop).toBe(false);
  });
});
