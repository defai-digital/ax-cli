import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../../src/agent/context-manager.js';
import { createTokenCounter } from '../../src/utils/token-counter.js';
import type { LLMMessage } from '../../src/llm/client.js';

describe('ContextManager', () => {
  let contextManager: ContextManager;
  let tokenCounter: ReturnType<typeof createTokenCounter>;

  beforeEach(() => {
    contextManager = new ContextManager({
      model: 'grok-code-fast-1',
      pruneThreshold: 0.75,
      hardLimit: 0.95,
      keepRecentToolRounds: 3,
      keepFirstMessages: 2,
    });
    tokenCounter = createTokenCounter('grok-code-fast-1');
  });

  describe('shouldPrune', () => {
    it('should return false for small message arrays', () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are an assistant.' },
        { role: 'user', content: 'Hello' },
      ];

      expect(contextManager.shouldPrune(messages, tokenCounter)).toBe(false);
    });

    it('should return true when approaching threshold', () => {
      // Create a large number of messages to exceed threshold
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are an assistant.' },
      ];

      // Add many messages to simulate high token usage
      const largeContent = 'x'.repeat(10000); // ~10k tokens worth
      for (let i = 0; i < 100; i++) {
        messages.push({ role: 'user', content: largeContent });
        messages.push({ role: 'assistant', content: largeContent });
      }

      expect(contextManager.shouldPrune(messages, tokenCounter)).toBe(true);
    });
  });

  describe('isNearHardLimit', () => {
    it('should return false for normal usage', () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are an assistant.' },
        { role: 'user', content: 'Hello' },
      ];

      expect(contextManager.isNearHardLimit(messages, tokenCounter)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should calculate statistics correctly', () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are an assistant.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const stats = contextManager.getStats(messages, tokenCounter);

      expect(stats.currentTokens).toBeGreaterThan(0);
      expect(stats.contextWindow).toBe(128000); // grok-code-fast-1 context
      expect(stats.percentage).toBeGreaterThan(0);
      expect(stats.percentage).toBeLessThan(100);
      expect(stats.available).toBeGreaterThan(0);
      expect(stats.shouldPrune).toBe(false);
      expect(stats.isNearLimit).toBe(false);
    });
  });

  describe('pruneMessages', () => {
    it('should keep system message', () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are an assistant.' },
        { role: 'user', content: 'Test' },
      ];

      const pruned = contextManager.pruneMessages(messages, tokenCounter);

      expect(pruned[0].role).toBe('system');
      expect(pruned[0].content).toBe('You are an assistant.');
    });

    it('should keep first user messages', () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Second message' },
        { role: 'assistant', content: 'Response 2' },
      ];

      // Force pruning by setting low threshold
      const smallContextManager = new ContextManager({
        model: 'grok-code-fast-1',
        pruneThreshold: 0.0001, // Very low to force pruning
        keepFirstMessages: 2,
      });

      const pruned = smallContextManager.pruneMessages(messages, tokenCounter);

      // Should keep system + at least some messages
      expect(pruned.length).toBeGreaterThan(1);
      expect(pruned[0].role).toBe('system');
    });

    it('should preserve tool execution rounds', () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Execute tool' },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'bash', arguments: '{"command":"ls"}' },
            },
          ],
        },
        { role: 'tool', content: 'file1.txt file2.txt', tool_call_id: 'call_1' },
        { role: 'assistant', content: 'Found 2 files' },
      ];

      const pruned = contextManager.pruneMessages(messages, tokenCounter);

      // Should keep the complete tool round
      expect(pruned.length).toBeGreaterThan(1);
      expect(pruned[0].role).toBe('system');
    });

    it('should not prune if under threshold', () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];

      const pruned = contextManager.pruneMessages(messages, tokenCounter);

      // Should return same messages
      expect(pruned.length).toBe(messages.length);
    });

    it('should handle gracefully if first message is not system', () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      // Should return original messages instead of throwing
      const result = contextManager.pruneMessages(messages, tokenCounter);
      expect(result).toEqual(messages);
    });
  });

  describe('createWarningMessage', () => {
    it('should create warning for near limit', () => {
      const stats = {
        currentTokens: 122000,
        contextWindow: 128000,
        percentage: 95.3,
        available: 6000,
        shouldPrune: true,
        isNearLimit: true,
      };

      const warning = contextManager.createWarningMessage(stats);

      expect(warning).toContain('⚠️');
      expect(warning).toContain('Near context limit');
      expect(warning).toContain('122,000');
    });

    it('should create info message for pruning', () => {
      const stats = {
        currentTokens: 100000,
        contextWindow: 128000,
        percentage: 78.1,
        available: 28000,
        shouldPrune: true,
        isNearLimit: false,
      };

      const warning = contextManager.createWarningMessage(stats);

      expect(warning).toContain('ℹ️');
      expect(warning).toContain('pruning active');
    });

    it('should create normal message for healthy usage', () => {
      const stats = {
        currentTokens: 5000,
        contextWindow: 128000,
        percentage: 3.9,
        available: 123000,
        shouldPrune: false,
        isNearLimit: false,
      };

      const warning = contextManager.createWarningMessage(stats);

      expect(warning).toContain('📊');
      expect(warning).toContain('5,000');
    });
  });
});
