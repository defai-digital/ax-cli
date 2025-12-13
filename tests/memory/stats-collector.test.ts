/**
 * Tests for memory/stats-collector module
 * Tests cache statistics collection and reporting
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock functions for ContextStore
const mockLoad = vi.fn();
const mockSave = vi.fn();
const mockRecordUsage = vi.fn();

// Mock ContextStore
vi.mock('../../packages/core/src/memory/context-store.js', () => ({
  ContextStore: class MockContextStore {
    constructor(_projectRoot?: string) {}
    load = mockLoad;
    save = mockSave;
    recordUsage = mockRecordUsage;
  },
}));

import {
  StatsCollector,
  getStatsCollector,
  resetDefaultCollector,
} from '../../packages/core/src/memory/stats-collector.js';

describe('StatsCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDefaultCollector();

    // Default mock behavior
    mockLoad.mockReturnValue({ success: false });
    mockSave.mockReturnValue({ success: true });
    mockRecordUsage.mockReturnValue({ success: true });
  });

  describe('constructor', () => {
    it('should create collector with default project root', () => {
      const collector = new StatsCollector();
      expect(collector).toBeInstanceOf(StatsCollector);
    });

    it('should create collector with custom project root', () => {
      const collector = new StatsCollector('/custom/path');
      expect(collector).toBeInstanceOf(StatsCollector);
    });
  });

  describe('recordResponse', () => {
    it('should record response statistics successfully', () => {
      mockRecordUsage.mockReturnValue({ success: true });

      const collector = new StatsCollector();
      const result = collector.recordResponse(1000, 500);

      expect(result).toBe(true);
      expect(mockRecordUsage).toHaveBeenCalledWith(1000, 500);
    });

    it('should return false when recording fails', () => {
      mockRecordUsage.mockReturnValue({ success: false, error: 'Test error' });

      const collector = new StatsCollector();
      const result = collector.recordResponse(1000, 500);

      expect(result).toBe(false);
    });

    it('should log warning in debug mode when recording fails', () => {
      const originalDebug = process.env.AX_DEBUG;
      process.env.AX_DEBUG = 'true';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockRecordUsage.mockReturnValue({ success: false, error: 'Test error' });

      const collector = new StatsCollector();
      collector.recordResponse(1000, 500);

      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to record usage stats:',
        'Test error'
      );

      warnSpy.mockRestore();
      process.env.AX_DEBUG = originalDebug;
    });
  });

  describe('getStats', () => {
    it('should return null when load fails', () => {
      mockLoad.mockReturnValue({ success: false });

      const collector = new StatsCollector();
      expect(collector.getStats()).toBeNull();
    });

    it('should return null when no stats exist', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: { context: {} },
      });

      const collector = new StatsCollector();
      expect(collector.getStats()).toBeNull();
    });

    it('should return stats when available', () => {
      const stats = {
        usage_count: 10,
        total_tokens_saved: 5000,
        last_prompt_tokens: 1000,
        last_cached_tokens: 500,
      };

      mockLoad.mockReturnValue({
        success: true,
        data: { stats },
      });

      const collector = new StatsCollector();
      expect(collector.getStats()).toEqual(stats);
    });
  });

  describe('getLastCacheRate', () => {
    it('should return 0 when no stats exist', () => {
      mockLoad.mockReturnValue({ success: false });

      const collector = new StatsCollector();
      expect(collector.getLastCacheRate()).toBe(0);
    });

    it('should return 0 when no prompt tokens', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          stats: {
            last_prompt_tokens: 0,
            last_cached_tokens: 0,
          },
        },
      });

      const collector = new StatsCollector();
      expect(collector.getLastCacheRate()).toBe(0);
    });

    it('should calculate cache rate correctly', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          stats: {
            last_prompt_tokens: 1000,
            last_cached_tokens: 750,
          },
        },
      });

      const collector = new StatsCollector();
      expect(collector.getLastCacheRate()).toBe(75);
    });

    it('should round cache rate to integer', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          stats: {
            last_prompt_tokens: 1000,
            last_cached_tokens: 333,
          },
        },
      });

      const collector = new StatsCollector();
      expect(collector.getLastCacheRate()).toBe(33);
    });
  });

  describe('getEstimatedSavings', () => {
    it('should return 0 when no stats exist', () => {
      mockLoad.mockReturnValue({ success: false });

      const collector = new StatsCollector();
      expect(collector.getEstimatedSavings()).toBe(0);
    });

    it('should return 0 when no tokens saved', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          stats: {
            total_tokens_saved: 0,
          },
        },
      });

      const collector = new StatsCollector();
      expect(collector.getEstimatedSavings()).toBe(0);
    });

    it('should calculate savings correctly', () => {
      // Pricing: INPUT=0.002/1K, CACHED=0.001/1K
      // Savings per token = (0.002 - 0.001) / 1000 = 0.000001
      // 10000 tokens saved = $0.01
      mockLoad.mockReturnValue({
        success: true,
        data: {
          stats: {
            total_tokens_saved: 10000,
          },
        },
      });

      const collector = new StatsCollector();
      expect(collector.getEstimatedSavings()).toBeCloseTo(0.01, 5);
    });
  });

  describe('getFormattedStats', () => {
    it('should return null when no stats exist', () => {
      mockLoad.mockReturnValue({ success: false });

      const collector = new StatsCollector();
      expect(collector.getFormattedStats()).toBeNull();
    });

    it('should return formatted stats object', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          stats: {
            usage_count: 5,
            total_tokens_saved: 5000,
            last_prompt_tokens: 1000,
            last_cached_tokens: 600,
          },
        },
      });

      const collector = new StatsCollector();
      const formatted = collector.getFormattedStats();

      expect(formatted).not.toBeNull();
      expect(formatted?.usageCount).toBe(5);
      expect(formatted?.tokensSaved).toBe(5000);
      expect(formatted?.cacheRate).toBe(60);
      expect(formatted?.estimatedSavings).toBeCloseTo(0.005, 5);
    });

    it('should include text representation', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          stats: {
            usage_count: 10,
            total_tokens_saved: 1000,
            last_prompt_tokens: 500,
            last_cached_tokens: 250,
          },
        },
      });

      const collector = new StatsCollector();
      const formatted = collector.getFormattedStats();

      expect(formatted?.text).toContain('Cache Statistics');
      expect(formatted?.text).toContain('Usage count');
      expect(formatted?.text).toContain('10');
      expect(formatted?.text).toContain('50%');
    });

    it('should include last used date when available', () => {
      const lastUsed = '2024-01-15T10:30:00.000Z';

      mockLoad.mockReturnValue({
        success: true,
        data: {
          stats: {
            usage_count: 5,
            total_tokens_saved: 1000,
            last_prompt_tokens: 100,
            last_cached_tokens: 50,
            last_used_at: lastUsed,
          },
        },
      });

      const collector = new StatsCollector();
      const formatted = collector.getFormattedStats();

      expect(formatted?.text).toContain('Last used');
    });
  });

  describe('formatBriefStatus', () => {
    it('should format status with cache rate', () => {
      const collector = new StatsCollector();
      const status = collector.formatBriefStatus(1000, 750);

      expect(status).toContain('750');
      expect(status).toContain('1,000');
      expect(status).toContain('75%');
      expect(status).toContain('cache hit');
    });

    it('should handle zero prompt tokens', () => {
      const collector = new StatsCollector();
      const status = collector.formatBriefStatus(0, 0);

      expect(status).toContain('0%');
    });

    it('should format large numbers with locale', () => {
      const collector = new StatsCollector();
      const status = collector.formatBriefStatus(10000, 5000);

      expect(status).toContain('10,000');
      expect(status).toContain('5,000');
    });
  });

  describe('checkCacheHealth', () => {
    it('should return null when no stats exist', () => {
      mockLoad.mockReturnValue({ success: false });

      const collector = new StatsCollector();
      expect(collector.checkCacheHealth()).toBeNull();
    });

    it('should return null when usage count is low', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          stats: {
            usage_count: 2,
            total_tokens_saved: 0,
          },
        },
      });

      const collector = new StatsCollector();
      expect(collector.checkCacheHealth()).toBeNull();
    });

    it('should warn when no cache hits after multiple uses', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          stats: {
            usage_count: 5,
            total_tokens_saved: 0,
          },
        },
      });

      const collector = new StatsCollector();
      const warning = collector.checkCacheHealth();

      expect(warning).toContain('No cache hits detected');
      expect(warning).toContain('ax memory refresh');
    });

    it('should note when cache rate is very low', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          stats: {
            usage_count: 10,
            total_tokens_saved: 50, // < 100 avg per use
          },
        },
      });

      const collector = new StatsCollector();
      const note = collector.checkCacheHealth();

      expect(note).toContain('lower than expected');
    });

    it('should return null when cache is healthy', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          stats: {
            usage_count: 10,
            total_tokens_saved: 5000, // 500 avg per use > 100
          },
        },
      });

      const collector = new StatsCollector();
      expect(collector.checkCacheHealth()).toBeNull();
    });
  });

  describe('resetStats', () => {
    it('should return false when load fails', () => {
      mockLoad.mockReturnValue({ success: false });

      const collector = new StatsCollector();
      expect(collector.resetStats()).toBe(false);
    });

    it('should reset stats and save', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          context: { formatted: 'test' },
          stats: { usage_count: 10 },
          updated_at: '2024-01-01',
        },
      });
      mockSave.mockReturnValue({ success: true });

      const collector = new StatsCollector();
      const result = collector.resetStats();

      expect(result).toBe(true);
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: undefined,
        })
      );
    });

    it('should return false when save fails', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: { context: {} },
      });
      mockSave.mockReturnValue({ success: false });

      const collector = new StatsCollector();
      expect(collector.resetStats()).toBe(false);
    });
  });
});

describe('getStatsCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDefaultCollector();
  });

  it('should return singleton instance without projectRoot', () => {
    const collector1 = getStatsCollector();
    const collector2 = getStatsCollector();

    expect(collector1).toBe(collector2);
  });

  it('should return new instance with custom projectRoot', () => {
    const defaultCollector = getStatsCollector();
    const customCollector = getStatsCollector('/custom/path');

    expect(defaultCollector).not.toBe(customCollector);
  });

  it('should create new instances for different projectRoots', () => {
    const collector1 = getStatsCollector('/path1');
    const collector2 = getStatsCollector('/path2');

    expect(collector1).not.toBe(collector2);
  });
});

describe('resetDefaultCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reset singleton so new instance is created', () => {
    const collector1 = getStatsCollector();

    resetDefaultCollector();

    const collector2 = getStatsCollector();

    expect(collector1).not.toBe(collector2);
  });
});
