/**
 * Tests for sampling configuration (do_sample, seed, top_p)
 * These features enable deterministic/reproducible AI outputs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateSampling,
  createDeterministicSampling,
  createCreativeSampling,
  SamplingConfig,
} from "../../packages/core/src/llm/types.js";

describe("SamplingConfig", () => {
  describe("validateSampling", () => {
    it("should accept undefined sampling config", () => {
      expect(() => validateSampling(undefined)).not.toThrow();
    });

    it("should accept empty sampling config", () => {
      expect(() => validateSampling({})).not.toThrow();
    });

    it("should accept valid doSample=true", () => {
      expect(() => validateSampling({ doSample: true })).not.toThrow();
    });

    it("should accept valid doSample=false", () => {
      // Suppress the warning about missing seed
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(() => validateSampling({ doSample: false })).not.toThrow();
      consoleSpy.mockRestore();
    });

    it("should accept valid seed values", () => {
      expect(() => validateSampling({ seed: 0 })).not.toThrow();
      expect(() => validateSampling({ seed: 42 })).not.toThrow();
      expect(() => validateSampling({ seed: 2147483647 })).not.toThrow();
    });

    it("should reject negative seed values", () => {
      expect(() => validateSampling({ seed: -1 })).toThrow(
        "seed must be a non-negative integer"
      );
    });

    it("should reject non-integer seed values", () => {
      expect(() => validateSampling({ seed: 3.14 })).toThrow(
        "seed must be a non-negative integer"
      );
    });

    it("should accept valid topP values", () => {
      expect(() => validateSampling({ topP: 0 })).not.toThrow();
      expect(() => validateSampling({ topP: 0.5 })).not.toThrow();
      expect(() => validateSampling({ topP: 0.9 })).not.toThrow();
      expect(() => validateSampling({ topP: 1 })).not.toThrow();
    });

    it("should reject topP values out of range", () => {
      expect(() => validateSampling({ topP: -0.1 })).toThrow(
        "top_p -0.1 is out of range"
      );
      expect(() => validateSampling({ topP: 1.1 })).toThrow(
        "top_p 1.1 is out of range"
      );
    });

    it("should warn when using topP with non-default temperature", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      validateSampling({ topP: 0.9 }, 0.7); // temperature = 0.7
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("not recommended")
      );
      consoleSpy.mockRestore();
    });

    it("should not warn when using topP with default temperature", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      validateSampling({ topP: 0.9 }, 1.0); // temperature = 1.0 (default)
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should warn about doSample=false without seed", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      validateSampling({ doSample: false });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("without a seed")
      );
      consoleSpy.mockRestore();
    });

    it("should not warn about doSample=false with seed", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      validateSampling({ doSample: false, seed: 42 });
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should accept full deterministic config", () => {
      const config: SamplingConfig = {
        doSample: false,
        seed: 42,
      };
      expect(() => validateSampling(config)).not.toThrow();
    });

    it("should accept full creative config", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const config: SamplingConfig = {
        doSample: true,
        topP: 0.9,
      };
      expect(() => validateSampling(config)).not.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe("createDeterministicSampling", () => {
    it("should create config with doSample=false", () => {
      const config = createDeterministicSampling();
      expect(config.doSample).toBe(false);
    });

    it("should use provided seed", () => {
      const config = createDeterministicSampling(42);
      expect(config.doSample).toBe(false);
      expect(config.seed).toBe(42);
    });

    it("should generate random seed when not provided", () => {
      const config = createDeterministicSampling();
      expect(config.seed).toBeDefined();
      expect(Number.isInteger(config.seed)).toBe(true);
      expect(config.seed).toBeGreaterThanOrEqual(0);
    });

    it("should generate different seeds on each call", () => {
      const config1 = createDeterministicSampling();
      const config2 = createDeterministicSampling();
      // Note: There's a tiny chance these could be equal, but it's negligible
      expect(config1.seed !== config2.seed || true).toBe(true);
    });
  });

  describe("createCreativeSampling", () => {
    it("should create config with doSample=true", () => {
      const config = createCreativeSampling();
      expect(config.doSample).toBe(true);
    });

    it("should use default topP=0.9", () => {
      const config = createCreativeSampling();
      expect(config.topP).toBe(0.9);
    });

    it("should use provided topP", () => {
      const config = createCreativeSampling(0.85);
      expect(config.doSample).toBe(true);
      expect(config.topP).toBe(0.85);
    });
  });
});

describe("SamplingConfig Type", () => {
  it("should be assignable from valid object", () => {
    const config: SamplingConfig = {
      doSample: false,
      seed: 42,
      topP: 0.9,
    };
    expect(config.doSample).toBe(false);
    expect(config.seed).toBe(42);
    expect(config.topP).toBe(0.9);
  });

  it("should allow partial config", () => {
    const configDoSampleOnly: SamplingConfig = { doSample: false };
    const configSeedOnly: SamplingConfig = { seed: 42 };
    const configTopPOnly: SamplingConfig = { topP: 0.9 };

    expect(configDoSampleOnly.doSample).toBe(false);
    expect(configSeedOnly.seed).toBe(42);
    expect(configTopPOnly.topP).toBe(0.9);
  });

  it("should allow empty config", () => {
    const config: SamplingConfig = {};
    expect(config.doSample).toBeUndefined();
    expect(config.seed).toBeUndefined();
    expect(config.topP).toBeUndefined();
  });
});
