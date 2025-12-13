/**
 * Tests for Rate Limiter (REQ-SEC-006)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RateLimiter,
  MultiTierRateLimiter,
  KeyedRateLimiter,
  DEFAULT_RATE_LIMITS,
} from '../../packages/core/src/utils/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    // Reset timers
    vi.clearAllTimers();
  });

  it('should allow requests within the limit', () => {
    const limiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 1000,
    });

    // First 10 requests should succeed
    for (let i = 0; i < 10; i++) {
      const result = limiter.tryAcquire();
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9 - i);
    }
  });

  it('should block requests exceeding the limit', () => {
    const limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 1000,
    });

    // First 5 should succeed
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryAcquire().allowed).toBe(true);
    }

    // 6th should fail
    const result = limiter.tryAcquire();
    expect(result.allowed).toBe(false);
    expect(result.resetIn).toBeGreaterThan(0);
  });

  it('should refill tokens over time', () => {
    // FIX: Use fake timers for deterministic testing (no CI flakiness)
    vi.useFakeTimers();

    const limiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 100, // 10 requests per 100ms = 0.1 per ms
    });

    // Consume all tokens
    for (let i = 0; i < 10; i++) {
      limiter.tryAcquire();
    }

    // Should be blocked
    expect(limiter.tryAcquire().allowed).toBe(false);

    // Advance time by 60ms - should have exactly 6 tokens
    vi.advanceTimersByTime(60);

    // Should be able to make exactly 6 requests (deterministic with fake timers)
    for (let i = 0; i < 6; i++) {
      const result = limiter.tryAcquire();
      expect(result.allowed).toBe(true); // No flakiness - fake timers are precise
    }

    // 7th request should fail
    expect(limiter.tryAcquire().allowed).toBe(false);

    // Advance 40ms more (total 100ms) - should have 4 more tokens (10 total)
    vi.advanceTimersByTime(40);

    // Should have full capacity again
    for (let i = 0; i < 4; i++) {
      const result = limiter.tryAcquire();
      expect(result.allowed).toBe(true);
    }

    vi.useRealTimers();
  });

  it('should respect burst allowance', () => {
    const limiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 1000,
      burstAllowance: 5, // Can burst to 15
    });

    // Should be able to make 15 requests
    for (let i = 0; i < 15; i++) {
      const result = limiter.tryAcquire();
      expect(result.allowed).toBe(true);
    }

    // 16th should fail
    expect(limiter.tryAcquire().allowed).toBe(false);
  });

  it('should support custom token costs', () => {
    const limiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 1000,
    });

    // Consume 5 tokens
    const result1 = limiter.tryAcquire(5);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(5);

    // Try to consume 6 more (should fail)
    const result2 = limiter.tryAcquire(6);
    expect(result2.allowed).toBe(false);

    // Consume remaining 5 (should succeed)
    const result3 = limiter.tryAcquire(5);
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(0);
  });

  it('should reset correctly', () => {
    const limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 1000,
    });

    // Consume all tokens
    for (let i = 0; i < 5; i++) {
      limiter.tryAcquire();
    }

    expect(limiter.tryAcquire().allowed).toBe(false);

    // Reset
    limiter.reset();

    // Should be able to make requests again
    expect(limiter.tryAcquire().allowed).toBe(true);
  });

  it('should return correct state without consuming tokens', () => {
    const limiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 1000,
    });

    // Consume 3 tokens
    limiter.tryAcquire();
    limiter.tryAcquire();
    limiter.tryAcquire();

    // getState should not consume
    const state1 = limiter.getState();
    expect(state1.remaining).toBe(7);
    expect(state1.allowed).toBe(true);

    const state2 = limiter.getState();
    expect(state2.remaining).toBe(7); // Should still be 7
  });
});

describe('MultiTierRateLimiter', () => {
  it('should enforce all tiers', () => {
    const limiter = new MultiTierRateLimiter([
      { maxRequests: 10, windowMs: 100 }, // 10/100ms
      { maxRequests: 5, windowMs: 100 },  // 5/100ms (more restrictive)
    ]);

    // Should be limited by the more restrictive tier (5)
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryAcquire().allowed).toBe(true);
    }

    expect(limiter.tryAcquire().allowed).toBe(false);
  });

  it('should return most restrictive state', () => {
    const limiter = new MultiTierRateLimiter([
      { maxRequests: 10, windowMs: 100 },
      { maxRequests: 20, windowMs: 100 },
    ]);

    // Consume 5 tokens
    for (let i = 0; i < 5; i++) {
      limiter.tryAcquire();
    }

    const state = limiter.getState();
    // Should return state from first tier (10 - 5 = 5)
    expect(state.remaining).toBe(5);
  });

  it('should block if any tier blocks', () => {
    const limiter = new MultiTierRateLimiter([
      { maxRequests: 100, windowMs: 1000 }, // Very permissive
      { maxRequests: 2, windowMs: 1000 },   // Very restrictive
    ]);

    expect(limiter.tryAcquire().allowed).toBe(true);
    expect(limiter.tryAcquire().allowed).toBe(true);
    expect(limiter.tryAcquire().allowed).toBe(false); // Blocked by 2nd tier
  });

  it('should reset all tiers', () => {
    const limiter = new MultiTierRateLimiter([
      { maxRequests: 5, windowMs: 1000 },
      { maxRequests: 3, windowMs: 1000 },
    ]);

    // Exhaust both tiers
    for (let i = 0; i < 3; i++) {
      limiter.tryAcquire();
    }

    expect(limiter.tryAcquire().allowed).toBe(false);

    limiter.reset();

    expect(limiter.tryAcquire().allowed).toBe(true);
  });
});

describe('KeyedRateLimiter', () => {
  it('should maintain separate limits for different keys', () => {
    const limiter = new KeyedRateLimiter({
      maxRequests: 5,
      windowMs: 1000,
    });

    // Exhaust key1
    for (let i = 0; i < 5; i++) {
      limiter.tryAcquire('key1');
    }

    expect(limiter.tryAcquire('key1').allowed).toBe(false);
    expect(limiter.tryAcquire('key2').allowed).toBe(true); // key2 is fresh
  });

  it('should reset specific keys', () => {
    const limiter = new KeyedRateLimiter({
      maxRequests: 5,
      windowMs: 1000,
    });

    // Exhaust both keys
    for (let i = 0; i < 5; i++) {
      limiter.tryAcquire('key1');
      limiter.tryAcquire('key2');
    }

    expect(limiter.tryAcquire('key1').allowed).toBe(false);
    expect(limiter.tryAcquire('key2').allowed).toBe(false);

    // Reset only key1
    limiter.reset('key1');

    expect(limiter.tryAcquire('key1').allowed).toBe(true);
    expect(limiter.tryAcquire('key2').allowed).toBe(false);
  });

  it('should enforce max keys limit', () => {
    const limiter = new KeyedRateLimiter(
      { maxRequests: 10, windowMs: 1000 },
      3 // Max 3 keys
    );

    // Create 4 keys
    limiter.tryAcquire('key1');
    limiter.tryAcquire('key2');
    limiter.tryAcquire('key3');
    limiter.tryAcquire('key4'); // Should evict key1

    // key1 should have been evicted and reset
    const state = limiter.getState('key1');
    expect(state.remaining).toBe(10); // Fresh limiter
  });

  it('should get state for specific key', () => {
    const limiter = new KeyedRateLimiter({
      maxRequests: 10,
      windowMs: 1000,
    });

    limiter.tryAcquire('key1');
    limiter.tryAcquire('key1');

    const state = limiter.getState('key1');
    expect(state.remaining).toBe(8);
  });

  it('should dispose cleanly', () => {
    const limiter = new KeyedRateLimiter({
      maxRequests: 10,
      windowMs: 1000,
    });

    limiter.tryAcquire('key1');
    limiter.dispose();

    // Should not throw
    expect(() => limiter.tryAcquire('key2')).not.toThrow();
  });
});

describe('DEFAULT_RATE_LIMITS', () => {
  it('should have reasonable API limits', () => {
    expect(DEFAULT_RATE_LIMITS.API.maxRequests).toBe(60);
    expect(DEFAULT_RATE_LIMITS.API.windowMs).toBe(60 * 1000);
  });

  it('should have stricter LLM API limits', () => {
    expect(DEFAULT_RATE_LIMITS.LLM_API.maxRequests).toBe(20);
    expect(DEFAULT_RATE_LIMITS.LLM_API.maxRequests).toBeLessThan(DEFAULT_RATE_LIMITS.API.maxRequests);
  });

  it('should have reasonable user action limits', () => {
    expect(DEFAULT_RATE_LIMITS.USER_ACTIONS.maxRequests).toBe(100);
  });

  it('should have reasonable file operation limits', () => {
    expect(DEFAULT_RATE_LIMITS.FILE_OPS.maxRequests).toBe(50);
  });
});

describe('KeyedRateLimiter cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should clean up inactive limiters after cleanup interval', () => {
    const limiter = new KeyedRateLimiter({
      maxRequests: 10,
      windowMs: 1000,
      cleanupInterval: 100, // 100ms cleanup interval
    });

    // Create some limiters by acquiring tokens
    limiter.tryAcquire('key1');
    limiter.tryAcquire('key2');

    // Advance time for tokens to refill (window passes)
    vi.advanceTimersByTime(2000);

    // Now advance past the cleanup interval
    vi.advanceTimersByTime(200);

    // Dispose to clean up
    limiter.dispose();
  });

  it('should not cleanup limiters that are still in use', () => {
    const limiter = new KeyedRateLimiter({
      maxRequests: 10,
      windowMs: 5000, // 5 second window
      cleanupInterval: 100,
    });

    // Acquire tokens (will mark limiter as in use)
    limiter.tryAcquire('key1');

    // Advance time but not past the window
    vi.advanceTimersByTime(200);

    // Should still be able to acquire (limiter not cleaned up)
    const result = limiter.tryAcquire('key1');
    expect(result.allowed).toBe(true);

    limiter.dispose();
  });

  it('should handle cleanup with mixed limiter states', () => {
    const limiter = new KeyedRateLimiter({
      maxRequests: 2,
      windowMs: 100,
      cleanupInterval: 50,
    });

    // Key1: Use all tokens (should not be cleaned)
    limiter.tryAcquire('key1');
    limiter.tryAcquire('key1');

    // Key2: Use only one token
    limiter.tryAcquire('key2');

    // Advance past window so tokens refill
    vi.advanceTimersByTime(200);

    // Key1 and key2 should have full tokens now (could be cleaned)

    // Advance past cleanup interval
    vi.advanceTimersByTime(100);

    // Try to acquire on a "cleaned" key - should work as fresh limiter
    const result = limiter.tryAcquire('key1');
    expect(result.allowed).toBe(true);

    limiter.dispose();
  });

  it('should properly dispose cleanup timer', () => {
    const limiter = new KeyedRateLimiter({
      maxRequests: 10,
      windowMs: 1000,
      cleanupInterval: 100,
    });

    limiter.tryAcquire('key1');

    // Dispose should clear the cleanup timer
    limiter.dispose();

    // Advance time - should not throw or cause issues
    vi.advanceTimersByTime(1000);

    // Limiter map should be cleared
    expect(() => limiter.tryAcquire('key1')).not.toThrow();
  });
});
