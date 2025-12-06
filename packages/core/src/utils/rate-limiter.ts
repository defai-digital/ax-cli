/**
 * Basic Rate Limiting Utilities (Free Tier) - REQ-SEC-006
 *
 * Implements token bucket algorithm for rate limiting API calls and user actions
 * Prevents API abuse and ensures fair resource usage
 *
 * Free Tier Features:
 * ✅ Token bucket rate limiting
 * ✅ Multi-tier limits (per-second, per-minute)
 * ✅ Per-key limits (per-user, per-IP)
 * ✅ In-memory state (lightweight)
 *
 * Enterprise features (requires @ax-cli/enterprise):
 * - Custom quotas per user/team/project
 * - Cost analytics & forecasting
 * - Budget alerts ($X/day threshold)
 * - Persistent state (survives restarts)
 * - Multi-tenant quota management
 * - Usage optimization tips
 *
 * @module rate-limiter
 * Security: Protects against:
 * - API abuse (excessive requests)
 * - Resource exhaustion
 * - Denial of service (unintentional)
 */

import { TIMEOUT_CONFIG } from '../constants.js';

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Optional: burst allowance (can exceed limit briefly)
   */
  burstAllowance?: number;
}

export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Tokens remaining in the current window
   */
  remaining: number;

  /**
   * Time until the rate limit resets (in milliseconds)
   */
  resetIn: number;

  /**
   * Total limit for this rate limiter
   */
  limit: number;
}

/**
 * Token Bucket Rate Limiter
 *
 * Uses the token bucket algorithm which allows bursts while maintaining
 * a steady average rate. Tokens are added at a constant rate, and requests
 * consume tokens.
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({
 *   maxRequests: 60,
 *   windowMs: 60000, // 60 requests per minute
 * });
 *
 * const result = limiter.tryAcquire();
 * if (result.allowed) {
 *   // Make API call
 * } else {
 *   console.log(`Rate limit exceeded. Try again in ${result.resetIn}ms`);
 * }
 * ```
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond
  private lastRefill: number;
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    // INPUT VALIDATION FIX: Prevent division by zero and invalid configurations
    if (config.windowMs <= 0) {
      throw new Error(`windowMs must be positive, got ${config.windowMs}`);
    }
    if (config.maxRequests <= 0) {
      throw new Error(`maxRequests must be positive, got ${config.maxRequests}`);
    }
    // CRITICAL FIX: Prevent extreme values that cause floating point precision loss
    if (config.windowMs > Number.MAX_SAFE_INTEGER / 1000) {
      throw new Error(`windowMs too large: ${config.windowMs} (max: ${Number.MAX_SAFE_INTEGER / 1000})`);
    }
    if (config.maxRequests > Number.MAX_SAFE_INTEGER / 2) {
      throw new Error(`maxRequests too large: ${config.maxRequests} (max: ${Number.MAX_SAFE_INTEGER / 2})`);
    }

    this.config = config;
    this.maxTokens = config.maxRequests + (config.burstAllowance || 0);
    this.tokens = this.maxTokens;

    // CRITICAL FIX: Calculate refill rate with precision check
    const rate = config.maxRequests / config.windowMs;
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Invalid refill rate: ${rate} (requests: ${config.maxRequests}, window: ${config.windowMs})`);
    }
    this.refillRate = rate;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    // Calculate tokens to add
    const tokensToAdd = elapsed * this.refillRate;

    // Add tokens, capped at max
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Try to acquire a token (allow a request)
   *
   * @param cost - Number of tokens to consume (default: 1)
   * @returns Rate limit result indicating if request is allowed
   */
  tryAcquire(cost: number = 1): RateLimitResult {
    this.refill();

    const allowed = this.tokens >= cost;

    if (allowed) {
      this.tokens -= cost;
    }

    // Calculate reset time (time until 1 token is available)
    const resetIn = allowed ? 0 : Math.ceil((cost - this.tokens) / this.refillRate);

    return {
      allowed,
      remaining: Math.floor(this.tokens),
      resetIn,
      limit: this.config.maxRequests,
    };
  }

  /**
   * Get current state without consuming a token
   */
  getState(): RateLimitResult {
    this.refill();

    return {
      allowed: this.tokens >= 1,
      remaining: Math.floor(this.tokens),
      resetIn: this.tokens < 1 ? Math.ceil((1 - this.tokens) / this.refillRate) : 0,
      limit: this.config.maxRequests,
    };
  }

  /**
   * Reset the rate limiter (clear all tokens)
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}

/**
 * Multi-tier Rate Limiter
 *
 * Enforces multiple rate limits simultaneously (e.g., per-second, per-minute, per-hour)
 * Request is only allowed if ALL tiers allow it
 *
 * @example
 * ```typescript
 * const limiter = new MultiTierRateLimiter([
 *   { maxRequests: 10, windowMs: 1000 },   // 10/second
 *   { maxRequests: 100, windowMs: 60000 }, // 100/minute
 * ]);
 * ```
 */
export class MultiTierRateLimiter {
  private limiters: RateLimiter[];

  constructor(configs: RateLimitConfig[]) {
    this.limiters = configs.map(config => new RateLimiter(config));
  }

  /**
   * Try to acquire across all tiers
   * Request is only allowed if ALL tiers allow it
   */
  tryAcquire(cost: number = 1): RateLimitResult {
    // Check all tiers first (dry run)
    const results = this.limiters.map(limiter => limiter.getState());

    // If any tier would block, return the most restrictive result
    const blocked = results.find(r => !r.allowed || r.remaining < cost);
    if (blocked) {
      return {
        allowed: false,
        remaining: blocked.remaining,
        resetIn: blocked.resetIn,
        limit: blocked.limit,
      };
    }

    // All tiers allow it - actually consume tokens
    const actualResults = this.limiters.map(limiter => limiter.tryAcquire(cost));

    // Return the most restrictive successful result
    return actualResults.reduce((mostRestrictive, current) => {
      return current.remaining < mostRestrictive.remaining ? current : mostRestrictive;
    });
  }

  /**
   * Get current state (most restrictive tier)
   */
  getState(): RateLimitResult {
    const results = this.limiters.map(limiter => limiter.getState());

    // Return the most restrictive state
    return results.reduce((mostRestrictive, current) => {
      if (!current.allowed) return current;
      if (!mostRestrictive.allowed) return mostRestrictive;
      return current.remaining < mostRestrictive.remaining ? current : mostRestrictive;
    });
  }

  /**
   * Reset all tiers
   */
  reset(): void {
    this.limiters.forEach(limiter => limiter.reset());
  }
}

/**
 * Keyed Rate Limiter
 *
 * Maintains separate rate limits for different keys (e.g., per-user, per-IP)
 * Automatically cleans up old entries to prevent memory leaks
 *
 * @example
 * ```typescript
 * const limiter = new KeyedRateLimiter({
 *   maxRequests: 100,
 *   windowMs: 60000,
 * });
 *
 * // Different limits for different users
 * const result = limiter.tryAcquire('user-123');
 * ```
 */
export class KeyedRateLimiter {
  private limiters: Map<string, RateLimiter>;
  private readonly config: RateLimitConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly maxKeys: number;

  constructor(config: RateLimitConfig, maxKeys: number = 10000) {
    this.config = config;
    this.limiters = new Map();
    this.maxKeys = maxKeys;

    // Cleanup old entries periodically to prevent memory leaks
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, TIMEOUT_CONFIG.CONTEXT_CLEANUP_INTERVAL);

    // Don't keep process alive
    this.cleanupTimer.unref();
  }

  /**
   * Get or create a rate limiter for the given key
   */
  private getLimiter(key: string): RateLimiter {
    let limiter = this.limiters.get(key);

    if (!limiter) {
      limiter = new RateLimiter(this.config);
      this.limiters.set(key, limiter);

      // Enforce max keys limit
      if (this.limiters.size > this.maxKeys) {
        // Remove the oldest entry (first in Map)
        const firstKey = this.limiters.keys().next().value;
        if (firstKey) {
          this.limiters.delete(firstKey);
        }
      }
    }

    return limiter;
  }

  /**
   * Try to acquire for a specific key
   */
  tryAcquire(key: string, cost: number = 1): RateLimitResult {
    const limiter = this.getLimiter(key);
    return limiter.tryAcquire(cost);
  }

  /**
   * Get state for a specific key
   */
  getState(key: string): RateLimitResult {
    const limiter = this.getLimiter(key);
    return limiter.getState();
  }

  /**
   * Reset a specific key
   */
  reset(key: string): void {
    const limiter = this.limiters.get(key);
    if (limiter) {
      limiter.reset();
    }
  }

  /**
   * Clean up inactive limiters
   */
  private cleanup(): void {
    // Remove limiters that have full tokens (haven't been used recently)
    const toDelete: string[] = [];

    for (const [key, limiter] of this.limiters.entries()) {
      const state = limiter.getState();
      // If tokens are at max, this limiter hasn't been used recently
      if (state.remaining >= this.config.maxRequests) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.limiters.delete(key);
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.limiters.clear();
  }
}

/**
 * Default rate limit configurations for common use cases
 */
export const DEFAULT_RATE_LIMITS = {
  /**
   * API calls - 60 requests per minute
   */
  API: {
    maxRequests: 60,
    windowMs: 60 * 1000,
    burstAllowance: 10,
  },

  /**
   * LLM API calls - 20 requests per minute (more expensive)
   */
  LLM_API: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    burstAllowance: 5,
  },

  /**
   * User actions - 100 requests per minute
   */
  USER_ACTIONS: {
    maxRequests: 100,
    windowMs: 60 * 1000,
    burstAllowance: 20,
  },

  /**
   * File operations - 50 per minute
   */
  FILE_OPS: {
    maxRequests: 50,
    windowMs: 60 * 1000,
  },
} as const;
