/**
 * Tests for memory/context-injector module
 * Tests context injection, caching, and memory management
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock functions that can be controlled in tests
const mockLoad = vi.fn();
const mockExists = vi.fn();
const mockGetMetadata = vi.fn();

// Mock ContextStore with proper class syntax
vi.mock('../../packages/core/src/memory/context-store.js', () => {
  return {
    ContextStore: class MockContextStore {
      load = mockLoad;
      exists = mockExists;
      getMetadata = mockGetMetadata;
      constructor(_projectRoot?: string) {}
    },
  };
});

import {
  ContextInjector,
  getContextInjector,
  resetDefaultInjector,
} from '../../packages/core/src/memory/context-injector.js';

describe('ContextInjector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDefaultInjector();
    // Default mock behavior
    mockLoad.mockReturnValue({ success: false });
    mockExists.mockReturnValue(false);
    mockGetMetadata.mockReturnValue({ exists: false });
  });

  describe('constructor', () => {
    it('should create injector with custom project root', () => {
      const injector = new ContextInjector('/custom/path');
      expect(injector).toBeInstanceOf(ContextInjector);
    });

    it('should create injector with default project root', () => {
      const injector = new ContextInjector();
      expect(injector).toBeInstanceOf(ContextInjector);
    });
  });

  describe('setEnabled / isEnabled', () => {
    it('should be enabled by default', () => {
      const injector = new ContextInjector();
      expect(injector.isEnabled()).toBe(true);
    });

    it('should allow enabling/disabling', () => {
      const injector = new ContextInjector();

      injector.setEnabled(false);
      expect(injector.isEnabled()).toBe(false);

      injector.setEnabled(true);
      expect(injector.isEnabled()).toBe(true);
    });
  });

  describe('getContext', () => {
    it('should return null when disabled', () => {
      const injector = new ContextInjector();
      injector.setEnabled(false);

      const context = injector.getContext();

      expect(context).toBeNull();
    });

    it('should return null when load fails', () => {
      mockLoad.mockReturnValue({ success: false });

      const injector = new ContextInjector();
      const context = injector.getContext();

      expect(context).toBeNull();
    });

    it('should return formatted context when load succeeds', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          context: {
            formatted: 'Memory context content',
            token_estimate: 100,
          },
        },
      });

      const injector = new ContextInjector();
      const context = injector.getContext();

      expect(context).toBe('Memory context content');
    });

    it('should cache memory after first load', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          context: { formatted: 'Cached content', token_estimate: 50 },
        },
      });

      const injector = new ContextInjector();

      // First call loads from store
      injector.getContext();
      expect(mockLoad).toHaveBeenCalledTimes(1);

      // Second call uses cache
      injector.getContext();
      expect(mockLoad).toHaveBeenCalledTimes(1);
    });
  });

  describe('injectIntoPrompt', () => {
    it('should return base prompt when no memory', () => {
      mockLoad.mockReturnValue({ success: false });

      const injector = new ContextInjector();
      const result = injector.injectIntoPrompt('Base prompt here');

      expect(result).toBe('Base prompt here');
    });

    it('should prepend memory context with separator', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: {
          context: { formatted: 'Memory context', token_estimate: 50 },
        },
      });

      const injector = new ContextInjector();
      const result = injector.injectIntoPrompt('Base prompt');

      expect(result).toContain('Memory context');
      expect(result).toContain('---');
      expect(result).toContain('Base prompt');
      expect(result.indexOf('Memory context')).toBeLessThan(result.indexOf('Base prompt'));
    });
  });

  describe('hasMemory', () => {
    it('should return false when no memory exists', () => {
      mockExists.mockReturnValue(false);

      const injector = new ContextInjector();
      expect(injector.hasMemory()).toBe(false);
    });

    it('should return true when memory exists', () => {
      mockExists.mockReturnValue(true);

      const injector = new ContextInjector();
      expect(injector.hasMemory()).toBe(true);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata from store', () => {
      const mockMetadata = {
        exists: true,
        tokenEstimate: 500,
        updatedAt: '2024-01-01',
      };
      mockGetMetadata.mockReturnValue(mockMetadata);

      const injector = new ContextInjector();
      const metadata = injector.getMetadata();

      expect(metadata).toEqual(mockMetadata);
    });
  });

  describe('getMemory', () => {
    it('should return null when load fails', () => {
      mockLoad.mockReturnValue({ success: false });

      const injector = new ContextInjector();
      expect(injector.getMemory()).toBeNull();
    });

    it('should return memory data when load succeeds', () => {
      const mockMemory = {
        context: { formatted: 'Content', token_estimate: 100 },
      };
      mockLoad.mockReturnValue({ success: true, data: mockMemory });

      const injector = new ContextInjector();
      const memory = injector.getMemory();

      expect(memory).toEqual(mockMemory);
    });

    it('should use cached memory on subsequent calls', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: { context: { formatted: 'Content', token_estimate: 100 } },
      });

      const injector = new ContextInjector();
      injector.getMemory();
      injector.getMemory();

      expect(mockLoad).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearCache', () => {
    it('should clear cached memory', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: { context: { formatted: 'Content', token_estimate: 100 } },
      });

      const injector = new ContextInjector();

      // Load and cache
      injector.getMemory();
      expect(mockLoad).toHaveBeenCalledTimes(1);

      // Clear cache
      injector.clearCache();

      // Should load again
      injector.getMemory();
      expect(mockLoad).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTokenEstimate', () => {
    it('should return 0 when no memory', () => {
      mockLoad.mockReturnValue({ success: false });

      const injector = new ContextInjector();
      expect(injector.getTokenEstimate()).toBe(0);
    });

    it('should return token estimate from memory', () => {
      mockLoad.mockReturnValue({
        success: true,
        data: { context: { formatted: 'Content', token_estimate: 500 } },
      });

      const injector = new ContextInjector();
      expect(injector.getTokenEstimate()).toBe(500);
    });
  });

  describe('getMissingMemoryHint', () => {
    it('should return hint when no memory exists', () => {
      mockExists.mockReturnValue(false);

      const injector = new ContextInjector();
      const hint = injector.getMissingMemoryHint();

      expect(hint).toContain('ax memory warmup');
    });

    it('should return null when memory exists', () => {
      mockExists.mockReturnValue(true);

      const injector = new ContextInjector();
      const hint = injector.getMissingMemoryHint();

      expect(hint).toBeNull();
    });
  });
});

describe('getContextInjector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDefaultInjector();
    mockLoad.mockReturnValue({ success: false });
    mockExists.mockReturnValue(false);
    mockGetMetadata.mockReturnValue({ exists: false });
  });

  it('should return singleton instance without projectRoot', () => {
    const injector1 = getContextInjector();
    const injector2 = getContextInjector();

    expect(injector1).toBe(injector2);
  });

  it('should return new instance with custom projectRoot', () => {
    const defaultInjector = getContextInjector();
    const customInjector = getContextInjector('/custom/path');

    expect(defaultInjector).not.toBe(customInjector);
  });

  it('should create new instances for different projectRoots', () => {
    const injector1 = getContextInjector('/path1');
    const injector2 = getContextInjector('/path2');

    expect(injector1).not.toBe(injector2);
  });
});

describe('resetDefaultInjector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockReturnValue({ success: false });
    mockExists.mockReturnValue(false);
    mockGetMetadata.mockReturnValue({ exists: false });
  });

  it('should reset singleton so new instance is created', () => {
    const injector1 = getContextInjector();

    resetDefaultInjector();

    const injector2 = getContextInjector();

    expect(injector1).not.toBe(injector2);
  });
});
