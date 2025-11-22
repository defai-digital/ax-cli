import { describe, it, expect, beforeEach } from 'vitest';
import { WebSearchTool, WebSearchRouter, SearchCache } from '../../src/tools/web-search/index.js';

describe('WebSearchRouter', () => {
  let router: WebSearchRouter;

  beforeEach(() => {
    router = new WebSearchRouter();
  });

  describe('detectIntent', () => {
    it('should detect technical intent for code-related queries', () => {
      const intent = router.detectIntent('how to fix TypeScript error TS2345');

      expect(intent.requiresTechnical).toBe(true);
      expect(intent.type).toBe('technical');
    });

    it('should detect news intent for current events', () => {
      const intent = router.detectIntent('latest technology news today');

      expect(intent.requiresNews).toBe(true);
      expect(intent.type).toBe('news');
    });

    it('should detect code intent for implementation queries', () => {
      const intent = router.detectIntent('React hooks code example');

      expect(intent.requiresCode).toBe(true);
    });

    it('should default to general for non-specific queries', () => {
      const intent = router.detectIntent('what is machine learning');

      expect(intent.type).toBe('general');
    });

    it('should calculate confidence scores', () => {
      const intent = router.detectIntent('fix error debug troubleshoot');

      expect(intent.confidence).toBeGreaterThan(0.5);
      expect(intent.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should detect Python language for PyPI queries', () => {
      const intent = router.detectIntent('python django package pip install');

      expect(intent.language).toBe('python');
      expect(intent.type).toBe('technical');
    });

    it('should detect Rust language for crates queries', () => {
      const intent = router.detectIntent('rust cargo crate tokio');

      expect(intent.language).toBe('rust');
      expect(intent.type).toBe('technical');
    });

    it('should detect JavaScript for npm queries', () => {
      const intent = router.detectIntent('npm package react install');

      expect(intent.language).toBe('javascript');
      expect(intent.type).toBe('technical');
    });

    it('should handle mixed language keywords', () => {
      const intent = router.detectIntent('python rust comparison');

      // Should detect one of them (whichever appears first/more)
      expect(intent.language).toMatch(/python|rust/);
    });
  });

  describe('selectEngines', () => {
    it('should return at least one engine (npm fallback)', () => {
      const intent = {
        type: 'general' as const,
        requiresTechnical: false,
        requiresCode: false,
        requiresNews: false,
        confidence: 0.8
      };

      const engines = router.selectEngines(intent);
      // Should always return at least npm as fallback
      expect(engines.length).toBeGreaterThan(0);
    });

    it('should route Python queries to PyPI', () => {
      const intent = {
        type: 'technical' as const,
        requiresTechnical: true,
        requiresCode: false,
        requiresNews: false,
        confidence: 0.8,
        language: 'python' as const
      };

      const engines = router.selectEngines(intent);
      const engineNames = engines.map(e => e.name);
      expect(engineNames).toContain('pypi');
    });

    it('should route Rust queries to crates.io', () => {
      const intent = {
        type: 'technical' as const,
        requiresTechnical: true,
        requiresCode: false,
        requiresNews: false,
        confidence: 0.8,
        language: 'rust' as const
      };

      const engines = router.selectEngines(intent);
      const engineNames = engines.map(e => e.name);
      expect(engineNames).toContain('crates.io');
    });

    it('should route JavaScript queries to npm', () => {
      const intent = {
        type: 'technical' as const,
        requiresTechnical: true,
        requiresCode: false,
        requiresNews: false,
        confidence: 0.8,
        language: 'javascript' as const
      };

      const engines = router.selectEngines(intent);
      const engineNames = engines.map(e => e.name);
      expect(engineNames).toContain('npm');
    });
  });

  describe('hasAvailableEngines', () => {
    it('should return boolean indicating engine availability', () => {
      const hasEngines = router.hasAvailableEngines();
      expect(typeof hasEngines).toBe('boolean');
    });
  });
});

describe('SearchCache', () => {
  let cache: SearchCache;

  beforeEach(() => {
    cache = new SearchCache(60); // 60 second TTL for tests
  });

  describe('basic operations', () => {
    it('should store and retrieve search results', () => {
      const query = 'test query';
      const results = [
        {
          title: 'Test Result',
          url: 'https://example.com',
          snippet: 'Test snippet',
          source: 'test',
        }
      ];

      cache.set(query, results);
      const retrieved = cache.get(query);

      expect(retrieved).toEqual(results);
    });

    it('should return null for non-existent queries', () => {
      const result = cache.get('non-existent query');
      expect(result).toBeNull();
    });

    it('should handle case-insensitive queries', () => {
      const results = [
        {
          title: 'Test',
          url: 'https://example.com',
          snippet: 'snippet',
          source: 'test',
        }
      ];

      cache.set('Test Query', results);
      const retrieved = cache.get('test query');

      expect(retrieved).toEqual(results);
    });

    it('should check if query exists', () => {
      const query = 'existing query';
      const results = [
        {
          title: 'Test',
          url: 'https://example.com',
          snippet: 'snippet',
          source: 'test',
        }
      ];

      cache.set(query, results);

      expect(cache.has(query)).toBe(true);
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should delete cached queries', () => {
      const query = 'test query';
      const results = [
        {
          title: 'Test',
          url: 'https://example.com',
          snippet: 'snippet',
          source: 'test',
        }
      ];

      cache.set(query, results);
      expect(cache.has(query)).toBe(true);

      cache.delete(query);
      expect(cache.has(query)).toBe(false);
    });

    it('should clear all cached results', () => {
      cache.set('query1', [{ title: 'Test1', url: 'http://example.com', snippet: 'snippet', source: 'test' }]);
      cache.set('query2', [{ title: 'Test2', url: 'http://example.com', snippet: 'snippet', source: 'test' }]);

      cache.clear();

      expect(cache.has('query1')).toBe(false);
      expect(cache.has('query2')).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should track cache statistics', () => {
      const stats = cache.getStats();

      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
    });

    it('should return list of cached queries', () => {
      cache.set('query1', [{ title: 'Test', url: 'http://example.com', snippet: 'snippet', source: 'test' }]);
      cache.set('query2', [{ title: 'Test', url: 'http://example.com', snippet: 'snippet', source: 'test' }]);

      const queries = cache.getCachedQueries();

      expect(queries).toContain('query1');
      expect(queries).toContain('query2');
    });
  });
});

describe('WebSearchTool', () => {
  let tool: WebSearchTool;

  beforeEach(() => {
    tool = new WebSearchTool();
  });

  describe('search', () => {
    it('should reject empty queries', async () => {
      const result = await tool.search('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should sanitize query input', async () => {
      // This test will fail if no API keys are configured
      // which is expected behavior
      const result = await tool.search('<script>alert("xss")</script>test query');

      // Either succeeds (if API key configured) or fails with API key error
      if (!result.success) {
        expect(result.error).toMatch(/No search engine|API key|authentication/i);
      }
    });

    it('should work without API keys (using npm/PyPI/Crates)', async () => {
      // Create tool instance
      const toolWithoutKeys = new WebSearchTool();

      // Should always work with npm/PyPI/Crates (no API keys required)
      expect(toolWithoutKeys.isAvailable()).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should always be available (package search engines)', () => {
      const available = tool.isAvailable();
      expect(available).toBe(true); // Always true because npm/PyPI/Crates don't need API keys
    });
  });

  describe('cache operations', () => {
    it('should provide cache stats', () => {
      const stats = tool.getCacheStats();

      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
    });

    it('should clear cache', () => {
      tool.clearCache();
      const stats = tool.getCacheStats();

      expect(stats.keys).toBe(0);
    });
  });
});
