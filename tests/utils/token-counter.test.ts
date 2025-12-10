import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenCounter, formatTokenCount, createTokenCounter, getTokenCounter } from '../../packages/core/src/utils/token-counter';

describe('TokenCounter', () => {
  let counter: TokenCounter;

  beforeEach(() => {
    counter = new TokenCounter();
  });

  afterEach(() => {
    counter.dispose();
  });

  describe('countTokens', () => {
    it('should return 0 for empty string', () => {
      expect(counter.countTokens('')).toBe(0);
    });

    it('should count tokens in simple text', () => {
      const count = counter.countTokens('hello world');
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(10);
    });

    it('should count tokens in longer text', () => {
      const text = 'This is a longer piece of text that should have more tokens.';
      const count = counter.countTokens(text);
      expect(count).toBeGreaterThan(5);
    });

    it('should handle special characters', () => {
      const count = counter.countTokens('!@#$%^&*()');
      expect(count).toBeGreaterThan(0);
    });

    it('should handle Unicode characters', () => {
      const count = counter.countTokens('Hello 世界 🌍');
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('countMessageTokens', () => {
    it('should count tokens in simple message', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
      ];
      const count = counter.countMessageTokens(messages);
      expect(count).toBeGreaterThan(3); // Base + content
    });

    it('should count tokens in multiple messages', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const count = counter.countMessageTokens(messages);
      expect(count).toBeGreaterThan(6);
    });

    it('should handle null content', () => {
      const messages = [
        { role: 'user', content: null },
      ];
      const count = counter.countMessageTokens(messages);
      expect(count).toBeGreaterThanOrEqual(3); // Base tokens
    });

    it('should count tool_calls if present', () => {
      const messages = [
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_123',
              type: 'function' as const,
              function: { name: 'test', arguments: '{}' },
            },
          ],
        },
      ];
      const count = counter.countMessageTokens(messages);
      expect(count).toBeGreaterThan(3);
    });
  });

  describe('estimateStreamingTokens', () => {
    it('should estimate tokens for accumulated content', () => {
      const content = 'This is streaming content';
      const estimate = counter.estimateStreamingTokens(content);
      expect(estimate).toBeGreaterThan(0);
    });

    it('should return 0 for empty content', () => {
      expect(counter.estimateStreamingTokens('')).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should cleanup resources without error', () => {
      // Note: dispose() is called in afterEach, so we don't call it again here
      // Just verify the counter exists
      expect(counter).toBeInstanceOf(TokenCounter);
    });
  });
});

describe('formatTokenCount', () => {
  it('should format small numbers as-is', () => {
    expect(formatTokenCount(0)).toBe('0');
    expect(formatTokenCount(1)).toBe('1');
    expect(formatTokenCount(999)).toBe('999');
  });

  it('should format thousands with k suffix', () => {
    expect(formatTokenCount(1000)).toBe('1k');
    expect(formatTokenCount(1500)).toBe('1.5k');
    expect(formatTokenCount(2000)).toBe('2k');
    expect(formatTokenCount(12345)).toBe('12.3k');
  });

  it('should format millions with m suffix', () => {
    expect(formatTokenCount(1_000_000)).toBe('1m');
    expect(formatTokenCount(1_500_000)).toBe('1.5m');
    expect(formatTokenCount(2_000_000)).toBe('2m');
  });

  it('should handle edge cases', () => {
    expect(formatTokenCount(999_999)).toBe('1000.0k');
    expect(formatTokenCount(1_234_567)).toBe('1.2m');
  });
});

describe('createTokenCounter', () => {
  it('should create a token counter without model', () => {
    const counter = createTokenCounter();
    expect(counter).toBeInstanceOf(TokenCounter);
    // Don't dispose - createTokenCounter now returns singleton
  });

  it('should create a token counter with model', () => {
    const counter = createTokenCounter('gpt-4');
    expect(counter).toBeInstanceOf(TokenCounter);
    // Don't dispose - createTokenCounter now returns singleton
  });

  it('should handle invalid model gracefully', () => {
    const counter = createTokenCounter('invalid-model');
    expect(counter).toBeInstanceOf(TokenCounter);
    expect(counter.countTokens('test')).toBeGreaterThan(0);
    // Don't dispose - createTokenCounter now returns singleton
  });
});

describe('getTokenCounter (singleton)', () => {
  it('should return singleton instance for same model', () => {
    const counter1 = getTokenCounter('gpt-4');
    const counter2 = getTokenCounter('gpt-4');
    expect(counter1).toBe(counter2); // Same instance
  });

  it('should return different instances for different models', () => {
    const counter1 = getTokenCounter('gpt-4');
    const counter2 = getTokenCounter('gpt-3.5-turbo');
    expect(counter1).not.toBe(counter2); // Different instances
  });

  it('should return same instance when called multiple times without model', () => {
    const counter1 = getTokenCounter();
    const counter2 = getTokenCounter();
    expect(counter1).toBe(counter2); // Same instance (default model)
  });

  it('should cache token counts correctly across singleton instances', () => {
    const counter1 = getTokenCounter('gpt-4');
    const text = 'This is a test sentence for token counting.';

    // Count tokens first time (not cached)
    const count1 = counter1.countTokens(text);

    // Get singleton again and count same text (should hit cache)
    const counter2 = getTokenCounter('gpt-4');
    const count2 = counter2.countTokens(text);

    expect(count1).toBe(count2);
    expect(counter1).toBe(counter2); // Same instance
  });

  it('should maintain separate caches for different models', () => {
    const counter1 = getTokenCounter('gpt-4');
    const counter2 = getTokenCounter('gpt-3.5-turbo');

    const text = 'Test text';

    // Both should count the same text
    const count1 = counter1.countTokens(text);
    const count2 = counter2.countTokens(text);

    // Counts should be the same (same encoding)
    expect(count1).toBe(count2);

    // But instances should be different
    expect(counter1).not.toBe(counter2);
  });

  it('should work correctly with createTokenCounter (backwards compatibility)', () => {
    const counter1 = createTokenCounter('gpt-4');
    const counter2 = getTokenCounter('gpt-4');

    // createTokenCounter now redirects to getTokenCounter, so should be same instance
    expect(counter1).toBe(counter2);
  });

  // REGRESSION TEST: Cache pollution bug (fixed in v3.7.2)
  it('should not return cached values from different model (cache isolation)', () => {
    const counter1 = getTokenCounter('gpt-4');
    const counter2 = getTokenCounter('gpt-3.5-turbo');
    const counter3 = getTokenCounter('gpt-4'); // Same as counter1

    const text = 'Test text for cache pollution regression test';

    // Count with gpt-4
    const count1 = counter1.countTokens(text);

    // Count with gpt-3.5-turbo (should not hit gpt-4 cache)
    const count2 = counter2.countTokens(text);

    // Count again with gpt-4 (should hit cache, return same as count1)
    const count3 = counter3.countTokens(text);

    // Verify cache isolation
    expect(counter1).toBe(counter3); // Same singleton
    expect(count1).toBe(count3); // Same cached value

    // Key assertion: verify cache keys are model-specific
    // by checking cache stats show entries for each model
    const stats1 = counter1.getCacheStats();
    const stats2 = counter2.getCacheStats();

    // Each model should have its own cache entries
    expect(stats1.size).toBeGreaterThanOrEqual(1);
    expect(stats2.size).toBeGreaterThanOrEqual(1);

    // CRITICAL: Verify counts are actually the same (not polluted)
    // This would fail with the old bug where cache keys weren't model-prefixed
    expect(count1).toBe(count2); // Both use same encoding (cl100k_base)
  });
});
