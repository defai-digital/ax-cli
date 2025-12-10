import { describe, it, expect, beforeEach } from 'vitest';
import { UsageTracker, getUsageTracker } from '../../packages/core/src/utils/usage-tracker.js';

describe('UsageTracker', () => {
  let tracker: UsageTracker;

  beforeEach(() => {
    tracker = UsageTracker.getInstance();
    tracker.resetSession();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = UsageTracker.getInstance();
      const instance2 = UsageTracker.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return same instance from getUsageTracker', () => {
      const instance1 = getUsageTracker();
      const instance2 = UsageTracker.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('trackUsage', () => {
    it('should track basic usage', () => {
      tracker.trackUsage('glm-4.6', {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      });

      const stats = tracker.getSessionStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalPromptTokens).toBe(100);
      expect(stats.totalCompletionTokens).toBe(50);
      expect(stats.totalTokens).toBe(150);
      expect(stats.totalReasoningTokens).toBe(0);
    });

    it('should track usage with reasoning tokens', () => {
      tracker.trackUsage('glm-4.6', {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        reasoning_tokens: 20
      });

      const stats = tracker.getSessionStats();
      expect(stats.totalReasoningTokens).toBe(20);
    });

    it('should handle missing optional fields', () => {
      tracker.trackUsage('glm-4.6', {});

      const stats = tracker.getSessionStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalPromptTokens).toBe(0);
      expect(stats.totalCompletionTokens).toBe(0);
      expect(stats.totalTokens).toBe(0);
    });

    it('should calculate total_tokens from prompt + completion if missing', () => {
      tracker.trackUsage('glm-4.6', {
        prompt_tokens: 100,
        completion_tokens: 50
      });

      const stats = tracker.getSessionStats();
      expect(stats.totalTokens).toBe(150);
    });

    it('should accumulate multiple requests', () => {
      tracker.trackUsage('glm-4.6', {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      });

      tracker.trackUsage('glm-4.6', {
        prompt_tokens: 200,
        completion_tokens: 75,
        total_tokens: 275
      });

      const stats = tracker.getSessionStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalPromptTokens).toBe(300);
      expect(stats.totalCompletionTokens).toBe(125);
      expect(stats.totalTokens).toBe(425);
    });

    it('should track usage per model', () => {
      tracker.trackUsage('glm-4.6', {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      });

      tracker.trackUsage('grok-code-fast-1', {
        prompt_tokens: 200,
        completion_tokens: 75,
        total_tokens: 275
      });

      const stats = tracker.getSessionStats();
      expect(stats.byModel.size).toBe(2);

      const glm46Stats = stats.byModel.get('glm-4.6');
      expect(glm46Stats).toBeDefined();
      expect(glm46Stats?.requests).toBe(1);
      expect(glm46Stats?.totalTokens).toBe(150);

      const grokStats = stats.byModel.get('grok-code-fast-1');
      expect(grokStats).toBeDefined();
      expect(grokStats?.requests).toBe(1);
      expect(grokStats?.totalTokens).toBe(275);
    });

    it('should accumulate usage for same model', () => {
      tracker.trackUsage('glm-4.6', {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      });

      tracker.trackUsage('glm-4.6', {
        prompt_tokens: 200,
        completion_tokens: 75,
        total_tokens: 275
      });

      const modelStats = tracker.getModelStats('glm-4.6');
      expect(modelStats).toBeDefined();
      expect(modelStats?.requests).toBe(2);
      expect(modelStats?.promptTokens).toBe(300);
      expect(modelStats?.completionTokens).toBe(125);
      expect(modelStats?.totalTokens).toBe(425);
    });
  });

  describe('getSessionStats', () => {
    it('should return initial empty stats', () => {
      const stats = tracker.getSessionStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalPromptTokens).toBe(0);
      expect(stats.totalCompletionTokens).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalReasoningTokens).toBe(0);
      expect(stats.byModel).toBeInstanceOf(Map);
      expect(stats.byModel.size).toBe(0);
    });

    it('should return copy of stats (not reference)', () => {
      tracker.trackUsage('glm-4.6', {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      });

      const stats1 = tracker.getSessionStats();
      const stats2 = tracker.getSessionStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1.byModel).not.toBe(stats2.byModel);
    });
  });

  describe('resetSession', () => {
    it('should reset all stats to zero', () => {
      tracker.trackUsage('glm-4.6', {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      });

      tracker.resetSession();

      const stats = tracker.getSessionStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalPromptTokens).toBe(0);
      expect(stats.totalCompletionTokens).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalReasoningTokens).toBe(0);
      expect(stats.byModel.size).toBe(0);
    });
  });

  describe('getModelStats', () => {
    it('should return null for unknown model', () => {
      const stats = tracker.getModelStats('unknown-model');
      expect(stats).toBeNull();
    });

    it('should return stats for tracked model', () => {
      tracker.trackUsage('glm-4.6', {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        reasoning_tokens: 20
      });

      const stats = tracker.getModelStats('glm-4.6');
      expect(stats).toBeDefined();
      expect(stats?.requests).toBe(1);
      expect(stats?.promptTokens).toBe(100);
      expect(stats?.completionTokens).toBe(50);
      expect(stats?.totalTokens).toBe(150);
      expect(stats?.reasoningTokens).toBe(20);
    });
  });

  describe('edge cases', () => {
    it('should handle zero token counts', () => {
      tracker.trackUsage('glm-4.6', {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      });

      const stats = tracker.getSessionStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalTokens).toBe(0);
    });

    it('should handle very large token counts', () => {
      tracker.trackUsage('glm-4.6', {
        prompt_tokens: 100000,
        completion_tokens: 50000,
        total_tokens: 150000
      });

      const stats = tracker.getSessionStats();
      expect(stats.totalTokens).toBe(150000);
    });

    it('should handle multiple models in one session', () => {
      const models = ['glm-4.6', 'grok-code-fast-1', 'glm-4.6v', 'custom-model'];

      models.forEach((model, index) => {
        tracker.trackUsage(model, {
          prompt_tokens: (index + 1) * 100,
          completion_tokens: (index + 1) * 50,
          total_tokens: (index + 1) * 150
        });
      });

      const stats = tracker.getSessionStats();
      expect(stats.totalRequests).toBe(4);
      expect(stats.byModel.size).toBe(4);
    });
  });
});
