import { describe, it, expect, beforeEach } from 'vitest';
import { LLMAgent } from '../../packages/core/src/agent/llm-agent.js';
import { getLoopDetector, resetLoopDetector } from '../../packages/core/src/agent/loop-detector.js';
import type { LLMToolCall } from '../../packages/core/src/llm/client.js';

describe('Loop Detection for str_replace_editor', () => {
  let agent: LLMAgent;
  const mockApiKey = 'test-key';
  const mockModel = 'grok-2-latest';
  const mockBaseURL = 'https://api.test.com';

  beforeEach(() => {
    // Create a fresh agent instance for each test with mock base URL
    agent = new LLMAgent(mockApiKey, mockBaseURL, mockModel);
    // Reset loop detector to ensure clean state
    resetLoopDetector();
  });

  /**
   * Helper to simulate the full tool call flow:
   * 1. Check if tool would be blocked (isRepetitiveToolCall)
   * 2. Record the tool call with success status (simulating execution)
   * Returns true if the call would be blocked
   */
  const simulateToolCall = (toolCall: LLMToolCall, success: boolean = true): boolean => {
    const isRepetitiveToolCall = (agent as any).isRepetitiveToolCall.bind(agent);
    const isBlocked = isRepetitiveToolCall(toolCall);
    if (!isBlocked) {
      // Only record if not blocked (mirrors actual behavior)
      getLoopDetector().recordToolCall(toolCall, success);
    }
    return isBlocked;
  };

  it('should distinguish different edits to the same file', async () => {
    // Create three different edit operations to the same file
    const toolCall1: LLMToolCall = {
      id: 'call_1',
      type: 'function',
      function: {
        name: 'str_replace_editor',
        arguments: JSON.stringify({
          path: '/test/file.ts',
          old_str: '    } finally {\n      cleanup();\n    }',
          new_str: '    } finally {\n      // Updated cleanup\n      cleanup();\n    }'
        })
      }
    };

    const toolCall2: LLMToolCall = {
      id: 'call_2',
      type: 'function',
      function: {
        name: 'str_replace_editor',
        arguments: JSON.stringify({
          path: '/test/file.ts',
          old_str: 'function test() {',
          new_str: 'async function test() {'
        })
      }
    };

    const toolCall3: LLMToolCall = {
      id: 'call_3',
      type: 'function',
      function: {
        name: 'str_replace_editor',
        arguments: JSON.stringify({
          path: '/test/file.ts',
          old_str: 'const x = 1;',
          new_str: 'const x = 2;'
        })
      }
    };

    // First calls to different edits should NOT be flagged as repetitive
    expect(simulateToolCall(toolCall1)).toBe(false);
    expect(simulateToolCall(toolCall2)).toBe(false);
    expect(simulateToolCall(toolCall3)).toBe(false);

    // Second calls should also not be flagged (str_replace_editor threshold is 4)
    expect(simulateToolCall(toolCall1)).toBe(false);
    expect(simulateToolCall(toolCall2)).toBe(false);

    // Third call to same edit should also not be flagged
    expect(simulateToolCall(toolCall1)).toBe(false);

    // Fourth call is at threshold (4), not yet flagged
    expect(simulateToolCall(toolCall1)).toBe(false);

    // Fifth call to same edit SHOULD be flagged (exceeds threshold of 4)
    expect(simulateToolCall(toolCall1)).toBe(true);
  });

  it('should detect repeated failed edit attempts', async () => {
    // Simulate the same failing edit being attempted multiple times
    const failedEditCall: LLMToolCall = {
      id: 'call_fail',
      type: 'function',
      function: {
        name: 'str_replace_editor',
        arguments: JSON.stringify({
          path: '/test/file.ts',
          old_str: '    } finally {\n      nonexistent();\n    }',
          new_str: '    } finally {\n      updated();\n    }'
        })
      }
    };

    // Simulate failed edit attempts (success=false)
    // With failure tracking, threshold is reduced: base(4) - failures
    // First attempt: threshold=4, count=1, not blocked
    expect(simulateToolCall(failedEditCall, false)).toBe(false);
    // Second: threshold=3 (4-1 failure), count=2, not blocked
    expect(simulateToolCall({ ...failedEditCall, id: 'call_fail_2' }, false)).toBe(false);
    // Third: threshold=2 (4-2 failures), count=3, blocked (3 > 2)
    expect(simulateToolCall({ ...failedEditCall, id: 'call_fail_3' }, false)).toBe(true);
  });

  it('should handle long old_str by truncating in signature', async () => {
    // Create an edit with a very long old_str (>100 chars)
    const longOldStr = 'a'.repeat(150);
    const toolCall: LLMToolCall = {
      id: 'call_long',
      type: 'function',
      function: {
        name: 'str_replace_editor',
        arguments: JSON.stringify({
          path: '/test/file.ts',
          old_str: longOldStr,
          new_str: 'new content'
        })
      }
    };

    // First call increments count to 1 (not repetitive, and should not throw)
    expect(simulateToolCall(toolCall)).toBe(false);

    // Verify truncation works - same long string should be detected as same signature
    // Second call increments to 2 (not repetitive)
    expect(simulateToolCall({ ...toolCall, id: 'call_long_2' })).toBe(false);

    // Third call increments to 3 (not yet repetitive)
    expect(simulateToolCall({ ...toolCall, id: 'call_long_3' })).toBe(false);

    // Fourth call increments to 4 (at threshold of 4, not yet repetitive)
    expect(simulateToolCall({ ...toolCall, id: 'call_long_4' })).toBe(false);

    // Fifth call increments to 5 (exceeds threshold of 4, now repetitive)
    expect(simulateToolCall({ ...toolCall, id: 'call_long_5' })).toBe(true);
  });

  it('should reset tracking between user messages', async () => {
    const toolCall: LLMToolCall = {
      id: 'call_reset',
      type: 'function',
      function: {
        name: 'str_replace_editor',
        arguments: JSON.stringify({
          path: '/test/file.ts',
          old_str: 'test',
          new_str: 'updated'
        })
      }
    };

    const resetToolCallTracking = (agent as any).resetToolCallTracking.bind(agent);

    // Make some calls
    expect(simulateToolCall(toolCall)).toBe(false);
    expect(simulateToolCall({ ...toolCall, id: 'call_reset_2' })).toBe(false);

    // Reset tracking (simulating new user message)
    resetToolCallTracking();

    // Should start counting from zero again
    expect(simulateToolCall({ ...toolCall, id: 'call_reset_3' })).toBe(false);
    expect(simulateToolCall({ ...toolCall, id: 'call_reset_4' })).toBe(false);
  });
});
