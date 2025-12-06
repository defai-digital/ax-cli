/**
 * Figma REST API Client
 *
 * Provides a type-safe interface to the Figma REST API.
 * Includes caching, rate limiting, and error handling.
 *
 * @module design/figma-client
 */

import {
  FigmaFileResponseSchema,
  FigmaNodesResponseSchema,
  FigmaVariablesResponseSchema,
  FigmaImagesResponseSchema,
  type FigmaFileResponse,
  type FigmaNodesResponse,
  type FigmaVariablesResponse,
  type FigmaImagesResponse,
  type GetFileOptions,
  type GetImagesOptions,
} from '@defai.digital/ax-schemas';

// =============================================================================
// Types
// =============================================================================

export interface FigmaClientConfig {
  /** Figma API access token */
  accessToken: string;
  /** Base URL for Figma API (default: https://api.figma.com) */
  baseUrl?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Enable response caching (default: true) */
  cacheEnabled?: boolean;
  /** Cache TTL in ms (default: 60000) */
  cacheTtl?: number;
}

export interface FigmaApiError extends Error {
  status: number;
  endpoint: string;
  figmaError?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// =============================================================================
// Rate Limiter
// =============================================================================

/**
 * Simple rate limiter for Figma API (60 req/min for Professional)
 *
 * BUG FIX: Converted from recursive to iterative approach to prevent stack overflow
 * when rate limit is hit repeatedly. Also handles edge cases like clock skew.
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxWaitIterations: number;

  constructor(maxRequests = 60, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    // BUG FIX: Limit iterations to prevent infinite loops
    this.maxWaitIterations = 100;
  }

  async waitForSlot(): Promise<void> {
    let iterations = 0;

    // BUG FIX: Use iterative approach instead of recursion to prevent stack overflow
    while (iterations < this.maxWaitIterations) {
      iterations++;
      const now = Date.now();

      // Remove old requests outside the window
      this.requests = this.requests.filter((t) => now - t < this.windowMs);

      if (this.requests.length < this.maxRequests) {
        // Slot available
        this.requests.push(now);
        return;
      }

      // Wait until oldest request expires
      const oldestRequest = this.requests[0];
      // BUG FIX: Handle edge case where oldest request is in the future (clock skew)
      // or wait time would be negative
      const waitTime = Math.max(0, this.windowMs - (now - oldestRequest)) + 100;

      // BUG FIX: Cap wait time to prevent extremely long waits
      const cappedWaitTime = Math.min(waitTime, this.windowMs);

      await new Promise((resolve) => setTimeout(resolve, cappedWaitTime));
    }

    // BUG FIX: If max iterations reached, proceed anyway to avoid deadlock
    // This shouldn't happen in normal operation but prevents infinite loops
    console.warn('RateLimiter: Max wait iterations reached, proceeding anyway');
    this.requests.push(Date.now());
  }
}

// =============================================================================
// Response Cache
// =============================================================================

class ResponseCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtl: number;

  constructor(defaultTtl = 60000) {
    this.defaultTtl = defaultTtl;
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTtl,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete all cache entries that start with the given prefix
   *
   * BUG FIX: This properly clears all parameterized cache entries for a file.
   * Before, invalidateFile only deleted exact key matches, missing entries
   * like `/v1/files/abc:{"depth":2}` when trying to clear `/v1/files/abc`.
   */
  deleteByPrefix(prefix: string): number {
    let deleted = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
  }

  /** Get cache key for a request */
  static makeKey(endpoint: string, params?: Record<string, unknown>): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${endpoint}:${paramStr}`;
  }
}

// =============================================================================
// Figma Client
// =============================================================================

export class FigmaClient {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly cache: ResponseCache;
  private readonly cacheEnabled: boolean;
  private readonly rateLimiter: RateLimiter;

  constructor(config: FigmaClientConfig) {
    this.accessToken = config.accessToken;
    this.baseUrl = config.baseUrl ?? 'https://api.figma.com';
    this.timeout = config.timeout ?? 30000;
    this.cacheEnabled = config.cacheEnabled ?? true;
    this.cache = new ResponseCache(config.cacheTtl ?? 60000);
    this.rateLimiter = new RateLimiter();
  }

  // ===========================================================================
  // Core Request Method
  // ===========================================================================

  private async request<T>(
    endpoint: string,
    options?: {
      params?: Record<string, string | number | boolean | undefined>;
      skipCache?: boolean;
      cacheTtl?: number;
    }
  ): Promise<T> {
    const { params, skipCache, cacheTtl } = options ?? {};

    // Build URL with query params
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    // Check cache
    const cacheKey = ResponseCache.makeKey(endpoint, params);
    if (this.cacheEnabled && !skipCache) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Rate limit
    await this.rateLimiter.waitForSlot();

    // Make request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-Figma-Token': this.accessToken,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const error = new Error(`Figma API error: ${response.statusText}`) as FigmaApiError;
        error.status = response.status;
        error.endpoint = endpoint;
        error.figmaError = errorBody;
        throw error;
      }

      const data = await response.json();

      // Cache response
      if (this.cacheEnabled) {
        this.cache.set(cacheKey, data, cacheTtl);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`Figma API request timed out after ${this.timeout}ms`) as FigmaApiError;
        timeoutError.status = 408;
        timeoutError.endpoint = endpoint;
        throw timeoutError;
      }
      throw error;
    }
  }

  // ===========================================================================
  // Public API Methods
  // ===========================================================================

  /**
   * Get a Figma file
   *
   * @param fileKey - The file key from the Figma URL
   * @param options - Optional parameters (depth, geometry, etc.)
   * @returns Validated FigmaFileResponse
   *
   * @example
   * ```typescript
   * const file = await client.getFile('abc123xyz', { depth: 2 });
   * console.log(file.name);
   * ```
   */
  async getFile(fileKey: string, options?: GetFileOptions): Promise<FigmaFileResponse> {
    const params: Record<string, string | number | boolean | undefined> = {
      depth: options?.depth,
      geometry: options?.geometry,
      plugin_data: options?.plugin_data,
      branch_data: options?.branch_data,
    };

    if (options?.version) {
      params.version = options.version;
    }

    const response = await this.request<unknown>(`/v1/files/${fileKey}`, { params });
    return FigmaFileResponseSchema.parse(response);
  }

  /**
   * Get specific nodes from a Figma file
   *
   * @param fileKey - The file key from the Figma URL
   * @param nodeIds - Array of node IDs to fetch
   * @returns Validated FigmaNodesResponse
   *
   * @example
   * ```typescript
   * const nodes = await client.getFileNodes('abc123xyz', ['1:2', '3:4']);
   * ```
   */
  async getFileNodes(fileKey: string, nodeIds: string[]): Promise<FigmaNodesResponse> {
    const params = {
      ids: nodeIds.join(','),
    };

    const response = await this.request<unknown>(`/v1/files/${fileKey}/nodes`, { params });
    return FigmaNodesResponseSchema.parse(response);
  }

  /**
   * Get local variables (design tokens) from a Figma file
   *
   * @param fileKey - The file key from the Figma URL
   * @returns Validated FigmaVariablesResponse
   *
   * @example
   * ```typescript
   * const variables = await client.getLocalVariables('abc123xyz');
   * ```
   */
  async getLocalVariables(fileKey: string): Promise<FigmaVariablesResponse> {
    const response = await this.request<unknown>(`/v1/files/${fileKey}/variables/local`);
    return FigmaVariablesResponseSchema.parse(response);
  }

  /**
   * Get images for specific nodes
   *
   * @param fileKey - The file key from the Figma URL
   * @param nodeIds - Array of node IDs to export
   * @param options - Export options (scale, format)
   * @returns Validated FigmaImagesResponse with URLs
   *
   * @example
   * ```typescript
   * const images = await client.getImages('abc123xyz', ['1:2'], { format: 'png', scale: 2 });
   * ```
   */
  async getImages(
    fileKey: string,
    nodeIds: string[],
    options?: GetImagesOptions
  ): Promise<FigmaImagesResponse> {
    const params: Record<string, string | number | boolean | undefined> = {
      ids: nodeIds.join(','),
      scale: options?.scale,
      format: options?.format,
      svg_include_id: options?.svg_include_id,
      svg_simplify_stroke: options?.svg_simplify_stroke,
      use_absolute_bounds: options?.use_absolute_bounds,
    };

    const response = await this.request<unknown>(`/v1/images/${fileKey}`, {
      params,
      skipCache: true, // Image URLs are time-limited
    });
    return FigmaImagesResponseSchema.parse(response);
  }

  /**
   * Get file metadata without the full document tree
   *
   * @param fileKey - The file key from the Figma URL
   * @returns Basic file info (name, lastModified, etc.)
   */
  async getFileMetadata(fileKey: string): Promise<{
    name: string;
    lastModified: string;
    version: string;
    thumbnailUrl?: string;
  }> {
    // Use depth=0 to get minimal data
    const response = await this.getFile(fileKey, { depth: 1 });
    return {
      name: response.name,
      lastModified: response.lastModified,
      version: response.version,
      thumbnailUrl: response.thumbnailUrl,
    };
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  /**
   * Clear the response cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache for a specific file
   *
   * BUG FIX: Now uses prefix-based deletion to clear all parameterized entries.
   * Before, this only deleted exact key matches, missing entries with query params
   * like `getFile(key, {depth: 2})` which produces keys like `/v1/files/abc:{"depth":2}`.
   */
  invalidateFile(fileKey: string): void {
    // Clear all cached entries for this file (including parameterized variants)
    this.cache.deleteByPrefix(`/v1/files/${fileKey}`);
    this.cache.deleteByPrefix(`/v1/images/${fileKey}`);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let defaultClient: FigmaClient | null = null;
let lastTokenUsed: string | null = null;

/**
 * Create a new Figma client instance
 */
export function createFigmaClient(config: FigmaClientConfig): FigmaClient {
  return new FigmaClient(config);
}

/**
 * Get the default Figma client (creates one if needed)
 *
 * Uses FIGMA_ACCESS_TOKEN environment variable if no token provided.
 *
 * BUG FIX: The singleton now re-initializes if the access token changes.
 * This fixes unreliable behavior in interactive mode where the token might
 * be set after the initial client creation, or changed during the session.
 */
export function getFigmaClient(accessToken?: string): FigmaClient {
  const token = accessToken ?? process.env.FIGMA_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      'Figma access token required. Set FIGMA_ACCESS_TOKEN environment variable or pass token to createFigmaClient().'
    );
  }

  // BUG FIX: Re-create client if token has changed
  // This handles cases where:
  // 1. Client was created with no token (would have thrown, but checking for completeness)
  // 2. Environment variable was updated during the session
  // 3. A different token is explicitly passed
  if (defaultClient && lastTokenUsed === token) {
    return defaultClient;
  }

  // Create new client with current token
  defaultClient = createFigmaClient({ accessToken: token });
  lastTokenUsed = token;
  return defaultClient;
}

/**
 * Reset the default client (useful for testing)
 */
export function resetFigmaClient(): void {
  defaultClient = null;
  lastTokenUsed = null;
}
