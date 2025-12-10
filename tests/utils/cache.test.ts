import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LRUCache, memoize, memoizeAsync } from '../../packages/core/src/utils/cache.js';

describe('cache', () => {
  describe('LRUCache', () => {
    describe('basic operations', () => {
      it('should set and get values', () => {
        const cache = new LRUCache<string, number>();
        cache.set('key1', 100);
        expect(cache.get('key1')).toBe(100);
      });

      it('should return undefined for non-existent keys', () => {
        const cache = new LRUCache<string, number>();
        expect(cache.get('nonexistent')).toBeUndefined();
      });

      it('should check if key exists', () => {
        const cache = new LRUCache<string, number>();
        cache.set('key1', 100);
        expect(cache.has('key1')).toBe(true);
        expect(cache.has('key2')).toBe(false);
      });

      it('should delete entries', () => {
        const cache = new LRUCache<string, number>();
        cache.set('key1', 100);
        expect(cache.delete('key1')).toBe(true);
        expect(cache.get('key1')).toBeUndefined();
        expect(cache.delete('key1')).toBe(false);
      });

      it('should clear all entries', () => {
        const cache = new LRUCache<string, number>();
        cache.set('key1', 100);
        cache.set('key2', 200);
        cache.clear();
        expect(cache.size()).toBe(0);
        expect(cache.get('key1')).toBeUndefined();
      });

      it('should return cache size', () => {
        const cache = new LRUCache<string, number>();
        expect(cache.size()).toBe(0);
        cache.set('key1', 100);
        expect(cache.size()).toBe(1);
        cache.set('key2', 200);
        expect(cache.size()).toBe(2);
      });

      it('should return all keys', () => {
        const cache = new LRUCache<string, number>();
        cache.set('key1', 100);
        cache.set('key2', 200);
        cache.set('key3', 300);
        const keys = cache.keys();
        expect(keys).toEqual(['key1', 'key2', 'key3']);
      });

      it('should return cache statistics', () => {
        const cache = new LRUCache<string, number>({ maxSize: 100, ttl: 5000 });
        cache.set('key1', 100);
        const stats = cache.stats();
        expect(stats.size).toBe(1);
        expect(stats.maxSize).toBe(100);
        expect(stats.ttl).toBe(5000);
      });
    });

    describe('LRU eviction', () => {
      it('should evict oldest entry when maxSize is reached', () => {
        const cache = new LRUCache<string, number>({ maxSize: 3 });
        cache.set('key1', 100);
        cache.set('key2', 200);
        cache.set('key3', 300);
        cache.set('key4', 400); // Should evict key1

        expect(cache.get('key1')).toBeUndefined();
        expect(cache.get('key2')).toBe(200);
        expect(cache.get('key3')).toBe(300);
        expect(cache.get('key4')).toBe(400);
      });

      it('should update LRU order on get', () => {
        const cache = new LRUCache<string, number>({ maxSize: 3 });
        cache.set('key1', 100);
        cache.set('key2', 200);
        cache.set('key3', 300);

        // Access key1 to make it most recently used
        cache.get('key1');

        // Add key4, should evict key2 (oldest)
        cache.set('key4', 400);

        expect(cache.get('key1')).toBe(100);
        expect(cache.get('key2')).toBeUndefined();
        expect(cache.get('key3')).toBe(300);
        expect(cache.get('key4')).toBe(400);
      });

      it('should update LRU order on set', () => {
        const cache = new LRUCache<string, number>({ maxSize: 3 });
        cache.set('key1', 100);
        cache.set('key2', 200);
        cache.set('key3', 300);

        // Update key1 to make it most recently used
        cache.set('key1', 150);

        // Add key4, should evict key2 (oldest)
        cache.set('key4', 400);

        expect(cache.get('key1')).toBe(150);
        expect(cache.get('key2')).toBeUndefined();
        expect(cache.get('key3')).toBe(300);
        expect(cache.get('key4')).toBe(400);
      });

      it('should handle maxSize of 1', () => {
        const cache = new LRUCache<string, number>({ maxSize: 1 });
        cache.set('key1', 100);
        cache.set('key2', 200);
        expect(cache.get('key1')).toBeUndefined();
        expect(cache.get('key2')).toBe(200);
        expect(cache.size()).toBe(1);
      });

      it('should use default maxSize of 1000', () => {
        const cache = new LRUCache<string, number>();
        const stats = cache.stats();
        expect(stats.maxSize).toBe(1000);
      });
    });

    describe('TTL (Time To Live)', () => {
      it('should expire entries after TTL', async () => {
        const cache = new LRUCache<string, number>({ ttl: 100 }); // 100ms
        cache.set('key1', 100);

        expect(cache.get('key1')).toBe(100);

        // Wait for TTL to expire
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(cache.get('key1')).toBeUndefined();
      });

      it('should not expire entries without TTL', async () => {
        const cache = new LRUCache<string, number>();
        cache.set('key1', 100);

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(cache.get('key1')).toBe(100);
      });

      it('should remove expired entries from cache', async () => {
        const cache = new LRUCache<string, number>({ ttl: 100 });
        cache.set('key1', 100);

        expect(cache.size()).toBe(1);

        await new Promise(resolve => setTimeout(resolve, 150));

        // Access should remove expired entry
        cache.get('key1');
        expect(cache.size()).toBe(0);
      });

      it('should handle has() with expired entries', async () => {
        const cache = new LRUCache<string, number>({ ttl: 100 });
        cache.set('key1', 100);

        expect(cache.has('key1')).toBe(true);

        await new Promise(resolve => setTimeout(resolve, 150));

        expect(cache.has('key1')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle different types of keys', () => {
        const cache = new LRUCache<number, string>();
        cache.set(1, 'one');
        cache.set(2, 'two');
        expect(cache.get(1)).toBe('one');
        expect(cache.get(2)).toBe('two');
      });

      it('should handle different types of values', () => {
        const cache = new LRUCache<string, any>();
        cache.set('string', 'value');
        cache.set('number', 123);
        cache.set('object', { key: 'value' });
        cache.set('array', [1, 2, 3]);
        cache.set('null', null);
        cache.set('undefined', undefined);

        expect(cache.get('string')).toBe('value');
        expect(cache.get('number')).toBe(123);
        expect(cache.get('object')).toEqual({ key: 'value' });
        expect(cache.get('array')).toEqual([1, 2, 3]);
        expect(cache.get('null')).toBeNull();
        expect(cache.get('undefined')).toBeUndefined();
      });

      it('should handle empty cache operations', () => {
        const cache = new LRUCache<string, number>();
        expect(cache.size()).toBe(0);
        expect(cache.keys()).toEqual([]);
        cache.clear();
        expect(cache.size()).toBe(0);
      });
    });
  });

  describe('memoize', () => {
    it('should cache function results', () => {
      const fn = vi.fn((x: number) => x * 2);
      const memoized = memoize(fn);

      expect(memoized(5)).toBe(10);
      expect(memoized(5)).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle different arguments', () => {
      const fn = vi.fn((x: number) => x * 2);
      const memoized = memoize(fn);

      expect(memoized(5)).toBe(10);
      expect(memoized(10)).toBe(20);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use custom key function', () => {
      const fn = vi.fn((obj: { id: number }) => obj.id * 2);
      const memoized = memoize(fn, {
        keyFn: (obj) => obj.id.toString(),
      });

      expect(memoized({ id: 5 })).toBe(10);
      expect(memoized({ id: 5 })).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should respect maxSize', () => {
      const fn = vi.fn((x: number) => x * 2);
      const memoized = memoize(fn, { maxSize: 2 });

      memoized(1);
      memoized(2);
      memoized(3); // Should evict result for 1

      memoized(1); // Should call fn again
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('should respect TTL', async () => {
      const fn = vi.fn((x: number) => x * 2);
      const memoized = memoize(fn, { ttl: 100 });

      memoized(5);
      expect(fn).toHaveBeenCalledTimes(1);

      await new Promise(resolve => setTimeout(resolve, 150));

      memoized(5); // Should call fn again after TTL
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('memoizeAsync', () => {
    it('should cache async function results', async () => {
      const fn = vi.fn(async (x: number) => x * 2);
      const memoized = memoizeAsync(fn);

      expect(await memoized(5)).toBe(10);
      expect(await memoized(5)).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle different arguments', async () => {
      const fn = vi.fn(async (x: number) => x * 2);
      const memoized = memoizeAsync(fn);

      expect(await memoized(5)).toBe(10);
      expect(await memoized(10)).toBe(20);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use custom key function', async () => {
      const fn = vi.fn(async (obj: { id: number }) => obj.id * 2);
      const memoized = memoizeAsync(fn, {
        keyFn: (obj) => obj.id.toString(),
      });

      expect(await memoized({ id: 5 })).toBe(10);
      expect(await memoized({ id: 5 })).toBe(10);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should respect maxSize', async () => {
      const fn = vi.fn(async (x: number) => x * 2);
      const memoized = memoizeAsync(fn, { maxSize: 2 });

      await memoized(1);
      await memoized(2);
      await memoized(3); // Should evict result for 1

      await memoized(1); // Should call fn again
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('should respect TTL', async () => {
      const fn = vi.fn(async (x: number) => x * 2);
      const memoized = memoizeAsync(fn, { ttl: 100 });

      await memoized(5);
      expect(fn).toHaveBeenCalledTimes(1);

      await new Promise(resolve => setTimeout(resolve, 150));

      await memoized(5); // Should call fn again after TTL
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle async errors', async () => {
      const fn = vi.fn(async (x: number) => {
        if (x < 0) throw new Error('Negative number');
        return x * 2;
      });
      const memoized = memoizeAsync(fn);

      await expect(memoized(-1)).rejects.toThrow('Negative number');
      expect(await memoized(5)).toBe(10);
    });
  });
});
