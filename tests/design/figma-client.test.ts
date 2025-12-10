/**
 * Tests for Figma REST API Client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FigmaClient, type FigmaClientConfig, type FigmaApiError } from "../../packages/core/src/design/figma-client.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("FigmaClient", () => {
  let client: FigmaClient;
  const defaultConfig: FigmaClientConfig = {
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new FigmaClient(defaultConfig);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("constructor", () => {
    it("should create client with required config", () => {
      const c = new FigmaClient({ accessToken: "test" });
      expect(c).toBeDefined();
    });

    it("should use default base URL", () => {
      const c = new FigmaClient({ accessToken: "test" });
      expect(c["baseUrl"]).toBe("https://api.figma.com");
    });

    it("should use custom base URL", () => {
      const c = new FigmaClient({
        accessToken: "test",
        baseUrl: "https://custom.figma.com",
      });
      expect(c["baseUrl"]).toBe("https://custom.figma.com");
    });

    it("should use default timeout", () => {
      const c = new FigmaClient({ accessToken: "test" });
      expect(c["timeout"]).toBe(30000);
    });

    it("should use custom timeout", () => {
      const c = new FigmaClient({ accessToken: "test", timeout: 60000 });
      expect(c["timeout"]).toBe(60000);
    });

    it("should enable cache by default", () => {
      const c = new FigmaClient({ accessToken: "test" });
      expect(c["cacheEnabled"]).toBe(true);
    });

    it("should disable cache when configured", () => {
      const c = new FigmaClient({ accessToken: "test", cacheEnabled: false });
      expect(c["cacheEnabled"]).toBe(false);
    });
  });

  describe("getFile", () => {
    it("should fetch file with correct endpoint", async () => {
      const mockResponse = {
        name: "Test File",
        lastModified: "2024-01-01T00:00:00.000Z",
        version: "1",
        document: { id: "0:0", name: "Document", type: "DOCUMENT", children: [] },
        components: {},
        componentSets: {},
        schemaVersion: 0,
        styles: {},
        thumbnailUrl: "https://example.com/thumb.png",
        role: "owner",
        editorType: "figma",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getFile("test-file-key");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/files/test-file-key"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Figma-Token": "test-token",
          }),
        })
      );
      expect(result.name).toBe("Test File");
    });

    it("should pass depth parameter", async () => {
      const mockResponse = {
        name: "Test File",
        lastModified: "2024-01-01T00:00:00.000Z",
        version: "1",
        document: { id: "0:0", name: "Document", type: "DOCUMENT", children: [] },
        components: {},
        componentSets: {},
        schemaVersion: 0,
        styles: {},
        role: "owner",
        editorType: "figma",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await client.getFile("test-file-key", { depth: 2 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("depth=2"),
        expect.anything()
      );
    });

    it("should throw on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("File not found"),
      });

      await expect(client.getFile("invalid-key")).rejects.toThrow("Figma API error");
    });
  });

  describe("getFileNodes", () => {
    it("should fetch specific nodes", async () => {
      const mockResponse = {
        name: "Test File",
        lastModified: "2024-01-01T00:00:00.000Z",
        version: "1",
        nodes: {
          "1:2": { document: { id: "1:2", name: "Node", type: "FRAME" } },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getFileNodes("test-file", ["1:2", "3:4"]);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("ids=1%3A2%2C3%3A4"),
        expect.anything()
      );
      expect(result.nodes).toBeDefined();
    });
  });

  describe("getLocalVariables", () => {
    it("should fetch local variables", async () => {
      const mockResponse = {
        status: 200,
        error: false,
        meta: {
          variables: {},
          variableCollections: {},
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getLocalVariables("test-file");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/variables/local"),
        expect.anything()
      );
      expect(result.meta).toBeDefined();
    });
  });

  describe("getImages", () => {
    it("should fetch images for nodes", async () => {
      const mockResponse = {
        images: {
          "1:2": "https://example.com/image.png",
        },
        err: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getImages("test-file", ["1:2"], {
        format: "png",
        scale: 2,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/images/test-file"),
        expect.anything()
      );
      expect(result.images).toBeDefined();
    });

    it("should pass format and scale parameters", async () => {
      const mockResponse = {
        images: {},
        err: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await client.getImages("test-file", ["1:2"], { format: "svg", scale: 3 });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("format=svg");
      expect(callUrl).toContain("scale=3");
    });
  });

  describe("caching", () => {
    it("should cache responses", async () => {
      const mockResponse = {
        name: "Cached File",
        lastModified: "2024-01-01T00:00:00.000Z",
        version: "1",
        document: { id: "0:0", name: "Document", type: "DOCUMENT", children: [] },
        components: {},
        componentSets: {},
        schemaVersion: 0,
        styles: {},
        role: "owner",
        editorType: "figma",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      // First call
      await client.getFile("cached-file");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call (should use cache)
      await client.getFile("cached-file");
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should not cache when disabled", async () => {
      const clientNoCache = new FigmaClient({
        accessToken: "test",
        cacheEnabled: false,
      });

      const mockResponse = {
        name: "File",
        lastModified: "2024-01-01T00:00:00.000Z",
        version: "1",
        document: { id: "0:0", name: "Document", type: "DOCUMENT", children: [] },
        components: {},
        componentSets: {},
        schemaVersion: 0,
        styles: {},
        role: "owner",
        editorType: "figma",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await clientNoCache.getFile("file1");
      await clientNoCache.getFile("file1");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("should include status in error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve("Access denied"),
      });

      try {
        await client.getFile("forbidden-file");
        expect.fail("Should have thrown");
      } catch (error) {
        const apiError = error as FigmaApiError;
        expect(apiError.status).toBe(403);
        expect(apiError.endpoint).toBe("/v1/files/forbidden-file");
      }
    });

    it("should handle timeout", async () => {
      const clientWithShortTimeout = new FigmaClient({
        accessToken: "test",
        timeout: 100,
      });

      // Mock fetch that properly handles AbortSignal
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({}),
            });
          }, 200);

          // Handle abort signal
          if (options?.signal) {
            options.signal.addEventListener("abort", () => {
              clearTimeout(timeout);
              const abortError = new Error("Aborted");
              abortError.name = "AbortError";
              reject(abortError);
            });
          }
        });
      });

      try {
        await clientWithShortTimeout.getFile("slow-file");
        expect.fail("Should have thrown");
      } catch (error) {
        const apiError = error as FigmaApiError;
        expect(apiError.status).toBe(408);
        expect(apiError.message).toContain("timed out");
      }
    });

    it("should include figma error body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve('{"message": "Invalid file key"}'),
      });

      try {
        await client.getFile("bad-file");
        expect.fail("Should have thrown");
      } catch (error) {
        const apiError = error as FigmaApiError;
        expect(apiError.figmaError).toContain("Invalid file key");
      }
    });
  });

  describe("rate limiting", () => {
    it("should wait for rate limit slot", async () => {
      const mockResponse = {
        name: "File",
        lastModified: "2024-01-01T00:00:00.000Z",
        version: "1",
        document: { id: "0:0", name: "Document", type: "DOCUMENT", children: [] },
        components: {},
        componentSets: {},
        schemaVersion: 0,
        styles: {},
        role: "owner",
        editorType: "figma",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      // Make multiple requests (should all go through with rate limiting)
      const promises = Array(3)
        .fill(null)
        .map((_, i) => client.getFile(`file-${i}`));

      await Promise.all(promises);

      // All requests should complete
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});

describe("ResponseCache", () => {
  it("should store and retrieve values", () => {
    // Access internal cache for testing
    const client = new FigmaClient({ accessToken: "test" });
    const cache = client["cache"];

    cache.set("key1", { data: "value1" });
    expect(cache.get("key1")).toEqual({ data: "value1" });
  });

  it("should return undefined for expired entries", async () => {
    const client = new FigmaClient({ accessToken: "test", cacheTtl: 50 });
    const cache = client["cache"];

    cache.set("key2", { data: "value2" }, 50);

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(cache.get("key2")).toBeUndefined();
  });

  it("should delete entries", () => {
    const client = new FigmaClient({ accessToken: "test" });
    const cache = client["cache"];

    cache.set("key3", { data: "value3" });
    cache.delete("key3");

    expect(cache.get("key3")).toBeUndefined();
  });

  it("should clear all entries", () => {
    const client = new FigmaClient({ accessToken: "test" });
    const cache = client["cache"];

    cache.set("key4", { data: "value4" });
    cache.set("key5", { data: "value5" });
    cache.clear();

    expect(cache.get("key4")).toBeUndefined();
    expect(cache.get("key5")).toBeUndefined();
  });

  it("should delete entries by prefix", () => {
    const client = new FigmaClient({ accessToken: "test" });
    const cache = client["cache"];

    cache.set("/v1/files/abc", { data: "file" });
    cache.set("/v1/files/abc:params", { data: "file-params" });
    cache.set("/v1/images/abc", { data: "images" });

    const deleted = cache.deleteByPrefix("/v1/files/abc");

    expect(deleted).toBe(2);
    expect(cache.get("/v1/files/abc")).toBeUndefined();
    expect(cache.get("/v1/files/abc:params")).toBeUndefined();
    expect(cache.get("/v1/images/abc")).toEqual({ data: "images" });
  });
});

describe("RateLimiter", () => {
  it("should allow requests within limit", async () => {
    const client = new FigmaClient({ accessToken: "test" });
    const rateLimiter = client["rateLimiter"];

    // Should complete quickly
    const start = Date.now();
    await rateLimiter.waitForSlot();
    await rateLimiter.waitForSlot();
    await rateLimiter.waitForSlot();
    const elapsed = Date.now() - start;

    // Should be nearly instant (less than 100ms)
    expect(elapsed).toBeLessThan(100);
  });
});
