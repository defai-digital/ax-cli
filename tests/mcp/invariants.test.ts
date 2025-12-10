/**
 * Tests for MCP Runtime Invariants
 */

import { describe, it, expect, vi } from "vitest";
import {
  invariant,
  InvariantViolationError,
  assertNonEmpty,
  assertDefined,
  assertPositive,
  assertNonNegative,
  assertNonEmptyString,
  assertInRange,
  assertHasKey,
  assertHasProperty,
  assertValidConnectionState,
  assertValidServerName,
  assertMigrationSuccess,
  assertNoDuplicates,
  assertMutexLocked,
  assertMutexUnlocked,
  assertNotDisposed,
  assertExactlyOne,
  assertAtLeastOne,
  assertConfigFormat,
  assertConfigHasFields,
  guardedConnect,
  validateConnectionState,
  criticalOperation,
  processServers,
  Resource,
} from "../../packages/core/src/mcp/invariants.js";

describe("MCP Invariants", () => {
  describe("invariant", () => {
    it("should not throw when condition is true", () => {
      expect(() => invariant(true, "test")).not.toThrow();
    });

    it("should throw InvariantViolationError when condition is false", () => {
      expect(() => invariant(false, "test message")).toThrow(InvariantViolationError);
    });

    it("should include message in error", () => {
      expect(() => invariant(false, "specific error")).toThrow("specific error");
    });

    it("should include context in error when provided", () => {
      expect(() => invariant(false, "error", { foo: "bar" })).toThrow("Context");
      expect(() => invariant(false, "error", { foo: "bar" })).toThrow("foo");
    });

    it("should format context as JSON", () => {
      try {
        invariant(false, "error", { key: "value" });
      } catch (e) {
        expect((e as Error).message).toContain('"key": "value"');
      }
    });
  });

  describe("InvariantViolationError", () => {
    it("should have correct name", () => {
      const error = new InvariantViolationError("test");
      expect(error.name).toBe("InvariantViolationError");
    });

    it("should have correct message", () => {
      const error = new InvariantViolationError("test message");
      expect(error.message).toBe("test message");
    });

    it("should be instance of Error", () => {
      const error = new InvariantViolationError("test");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("assertNonEmpty", () => {
    it("should not throw for non-empty array", () => {
      expect(() => assertNonEmpty([1, 2, 3])).not.toThrow();
    });

    it("should throw for empty array", () => {
      expect(() => assertNonEmpty([])).toThrow("must not be empty");
    });

    it("should use custom message", () => {
      expect(() => assertNonEmpty([], "Custom message")).toThrow("Custom message");
    });
  });

  describe("assertDefined", () => {
    it("should not throw for defined values", () => {
      expect(() => assertDefined("value")).not.toThrow();
      expect(() => assertDefined(0)).not.toThrow();
      expect(() => assertDefined(false)).not.toThrow();
      expect(() => assertDefined("")).not.toThrow();
    });

    it("should throw for null", () => {
      expect(() => assertDefined(null)).toThrow("must be defined");
    });

    it("should throw for undefined", () => {
      expect(() => assertDefined(undefined)).toThrow("must be defined");
    });

    it("should use custom message", () => {
      expect(() => assertDefined(null, "Custom")).toThrow("Custom");
    });
  });

  describe("assertPositive", () => {
    it("should not throw for positive numbers", () => {
      expect(() => assertPositive(1)).not.toThrow();
      expect(() => assertPositive(100)).not.toThrow();
      expect(() => assertPositive(0.1)).not.toThrow();
    });

    it("should throw for zero", () => {
      expect(() => assertPositive(0)).toThrow("must be positive");
    });

    it("should throw for negative numbers", () => {
      expect(() => assertPositive(-1)).toThrow("must be positive");
    });
  });

  describe("assertNonNegative", () => {
    it("should not throw for positive numbers", () => {
      expect(() => assertNonNegative(1)).not.toThrow();
    });

    it("should not throw for zero", () => {
      expect(() => assertNonNegative(0)).not.toThrow();
    });

    it("should throw for negative numbers", () => {
      expect(() => assertNonNegative(-1)).toThrow("must be non-negative");
    });
  });

  describe("assertNonEmptyString", () => {
    it("should not throw for non-empty strings", () => {
      expect(() => assertNonEmptyString("hello")).not.toThrow();
      expect(() => assertNonEmptyString("  content  ")).not.toThrow();
    });

    it("should throw for empty string", () => {
      expect(() => assertNonEmptyString("")).toThrow("must not be empty");
    });

    it("should throw for whitespace-only string", () => {
      expect(() => assertNonEmptyString("   ")).toThrow("must not be empty");
    });
  });

  describe("assertInRange", () => {
    it("should not throw for values in range", () => {
      expect(() => assertInRange(5, 0, 10)).not.toThrow();
      expect(() => assertInRange(0, 0, 10)).not.toThrow();
      expect(() => assertInRange(10, 0, 10)).not.toThrow();
    });

    it("should throw for values below range", () => {
      expect(() => assertInRange(-1, 0, 10)).toThrow("between 0 and 10");
    });

    it("should throw for values above range", () => {
      expect(() => assertInRange(11, 0, 10)).toThrow("between 0 and 10");
    });

    it("should use custom message", () => {
      expect(() => assertInRange(100, 0, 10, "Out of bounds")).toThrow("Out of bounds");
    });
  });

  describe("assertHasKey", () => {
    it("should not throw when map has key", () => {
      const map = new Map([["key", "value"]]);
      expect(() => assertHasKey(map, "key")).not.toThrow();
    });

    it("should throw when map lacks key", () => {
      const map = new Map();
      expect(() => assertHasKey(map, "missing")).toThrow("must contain key");
    });

    it("should use custom message", () => {
      const map = new Map();
      expect(() => assertHasKey(map, "key", "Custom")).toThrow("Custom");
    });
  });

  describe("assertHasProperty", () => {
    it("should not throw when object has property", () => {
      const obj = { foo: "bar" };
      expect(() => assertHasProperty(obj, "foo")).not.toThrow();
    });

    it("should throw when object lacks property", () => {
      const obj = { foo: "bar" };
      expect(() => assertHasProperty(obj, "baz")).toThrow('must have property "baz"');
    });

    it("should use custom message", () => {
      const obj = {};
      expect(() => assertHasProperty(obj, "key", "Custom")).toThrow("Custom");
    });
  });

  describe("assertValidConnectionState", () => {
    const validStates = ["connected", "disconnected", "connecting"] as const;

    it("should not throw for valid states", () => {
      expect(() => assertValidConnectionState("connected", validStates)).not.toThrow();
      expect(() => assertValidConnectionState("disconnected", validStates)).not.toThrow();
    });

    it("should throw for invalid states", () => {
      expect(() => assertValidConnectionState("invalid", validStates)).toThrow("Invalid connection state");
    });
  });

  describe("assertValidServerName", () => {
    it("should not throw for valid server names", () => {
      expect(() => assertValidServerName("my-server")).not.toThrow();
      expect(() => assertValidServerName("server_1")).not.toThrow();
      expect(() => assertValidServerName("MixedCase")).not.toThrow();
      expect(() => assertValidServerName("server123")).not.toThrow();
    });

    it("should throw for invalid characters", () => {
      expect(() => assertValidServerName("server name")).toThrow("Invalid server name format");
      expect(() => assertValidServerName("server@name")).toThrow("Invalid server name format");
      expect(() => assertValidServerName("server.name")).toThrow("Invalid server name format");
    });

    it("should throw for empty name", () => {
      expect(() => assertValidServerName("")).toThrow("Invalid server name format");
    });

    it("should throw for name too long", () => {
      const longName = "a".repeat(65);
      expect(() => assertValidServerName(longName)).toThrow("length must be between");
    });

    it("should allow max length name", () => {
      const maxName = "a".repeat(64);
      expect(() => assertValidServerName(maxName)).not.toThrow();
    });
  });

  describe("assertMigrationSuccess", () => {
    it("should not throw for successful migration", () => {
      const result = { success: true, value: { data: "test" } };
      expect(() => assertMigrationSuccess(result)).not.toThrow();
    });

    it("should throw for failed migration", () => {
      const result = { success: false, error: "Migration failed" };
      expect(() => assertMigrationSuccess(result)).toThrow("Migration must succeed");
    });

    it("should include context in error message", () => {
      const result = { success: false, error: "error" };
      expect(() => assertMigrationSuccess(result, "v2 migration")).toThrow("v2 migration");
    });
  });

  describe("assertNoDuplicates", () => {
    it("should not throw for unique names", () => {
      const servers = [{ name: "a" }, { name: "b" }, { name: "c" }];
      expect(() => assertNoDuplicates(servers)).not.toThrow();
    });

    it("should throw for duplicate names", () => {
      const servers = [{ name: "a" }, { name: "b" }, { name: "a" }];
      expect(() => assertNoDuplicates(servers)).toThrow("must be unique");
    });

    it("should identify duplicates in context", () => {
      const servers = [{ name: "dup" }, { name: "unique" }, { name: "dup" }];
      try {
        assertNoDuplicates(servers);
      } catch (e) {
        expect((e as Error).message).toContain("dup");
      }
    });
  });

  describe("assertMutexLocked", () => {
    it("should not throw when mutex is locked", () => {
      expect(() => assertMutexLocked(true, "resource")).not.toThrow();
    });

    it("should throw when mutex is not locked", () => {
      expect(() => assertMutexLocked(false, "resource")).toThrow("must be locked");
    });
  });

  describe("assertMutexUnlocked", () => {
    it("should not throw when mutex is unlocked", () => {
      expect(() => assertMutexUnlocked(false, "resource")).not.toThrow();
    });

    it("should throw when mutex is locked", () => {
      expect(() => assertMutexUnlocked(true, "resource")).toThrow("must be unlocked");
    });
  });

  describe("assertNotDisposed", () => {
    it("should not throw when not disposed", () => {
      expect(() => assertNotDisposed(false, "Resource")).not.toThrow();
    });

    it("should throw when disposed", () => {
      expect(() => assertNotDisposed(true, "Resource")).toThrow("must not be disposed");
    });

    it("should include resource name in message", () => {
      expect(() => assertNotDisposed(true, "MyResource")).toThrow("MyResource");
    });
  });

  describe("assertExactlyOne", () => {
    it("should not throw when exactly one is true", () => {
      expect(() => assertExactlyOne([true, false, false], ["a", "b", "c"])).not.toThrow();
      expect(() => assertExactlyOne([false, true, false], ["a", "b", "c"])).not.toThrow();
    });

    it("should throw when none are true", () => {
      expect(() => assertExactlyOne([false, false], ["a", "b"])).toThrow("Exactly one");
    });

    it("should throw when multiple are true", () => {
      expect(() => assertExactlyOne([true, true], ["a", "b"])).toThrow("Exactly one");
    });
  });

  describe("assertAtLeastOne", () => {
    it("should not throw when at least one is true", () => {
      expect(() => assertAtLeastOne([true, false], ["a", "b"])).not.toThrow();
      expect(() => assertAtLeastOne([true, true], ["a", "b"])).not.toThrow();
    });

    it("should throw when none are true", () => {
      expect(() => assertAtLeastOne([false, false], ["a", "b"])).toThrow("At least one");
    });
  });

  describe("assertConfigFormat", () => {
    it("should accept legacy config format", () => {
      const config = { command: "node", args: [] };
      expect(() => assertConfigFormat(config, "legacy", "server")).not.toThrow();
    });

    it("should accept modern config format", () => {
      const config = { transport: { type: "stdio" } };
      expect(() => assertConfigFormat(config, "modern", "server")).not.toThrow();
    });

    it("should reject modern when expecting legacy", () => {
      const config = { transport: { type: "stdio" } };
      expect(() => assertConfigFormat(config, "legacy", "server")).toThrow("legacy format");
    });

    it("should reject legacy when expecting modern", () => {
      const config = { command: "node" };
      expect(() => assertConfigFormat(config, "modern", "server")).toThrow("modern format");
    });
  });

  describe("assertConfigHasFields", () => {
    it("should not throw when all fields present", () => {
      const config = { name: "test", transport: {} };
      expect(() => assertConfigHasFields(config, ["name", "transport"], "server")).not.toThrow();
    });

    it("should throw when field is missing", () => {
      const config = { name: "test" };
      expect(() => assertConfigHasFields(config, ["name", "transport"], "server")).toThrow("missing required field");
    });

    it("should throw when field is undefined", () => {
      const config = { name: "test", transport: undefined };
      expect(() => assertConfigHasFields(config, ["name", "transport"], "server")).toThrow("transport");
    });
  });

  describe("guardedConnect", () => {
    it("should succeed with valid config", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const config = { name: "test", transport: { type: "stdio" } };

      expect(() => guardedConnect("my-server", config)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("my-server"));

      consoleSpy.mockRestore();
    });

    it("should throw for invalid server name", () => {
      const config = { name: "test", transport: {} };
      expect(() => guardedConnect("invalid name", config)).toThrow("Invalid server name");
    });

    it("should throw for undefined config", () => {
      expect(() => guardedConnect("server", undefined)).toThrow("must be defined");
    });

    it("should throw for missing required fields", () => {
      const config = { name: "test" };
      expect(() => guardedConnect("server", config)).toThrow("missing required field");
    });
  });

  describe("validateConnectionState", () => {
    it("should not throw for valid state", () => {
      expect(() => validateConnectionState("active", ["active", "inactive"])).not.toThrow();
    });

    it("should throw for invalid state", () => {
      expect(() => validateConnectionState("unknown", ["active", "inactive"])).toThrow("Invalid connection state");
    });
  });

  describe("criticalOperation", () => {
    it("should return doubled positive value", () => {
      expect(criticalOperation(5)).toBe(10);
      expect(criticalOperation(1)).toBe(2);
    });

    it("should throw for zero input", () => {
      expect(() => criticalOperation(0)).toThrow("must be positive");
    });

    it("should throw for negative input", () => {
      expect(() => criticalOperation(-5)).toThrow("must be positive");
    });
  });

  describe("processServers", () => {
    it("should process valid servers", () => {
      const servers = [{ name: "server1" }, { name: "server2" }];
      expect(() => processServers(servers)).not.toThrow();
    });

    it("should throw for empty array", () => {
      expect(() => processServers([])).toThrow("at least one server");
    });

    it("should throw for invalid server name", () => {
      const servers = [{ name: "valid" }, { name: "invalid name" }];
      expect(() => processServers(servers)).toThrow("Invalid server name");
    });
  });

  describe("Resource", () => {
    it("should allow use when not disposed", () => {
      const resource = new Resource();
      expect(() => resource.use()).not.toThrow();
    });

    it("should allow dispose when not disposed", () => {
      const resource = new Resource();
      expect(() => resource.dispose()).not.toThrow();
    });

    it("should throw on use after dispose", () => {
      const resource = new Resource();
      resource.dispose();
      expect(() => resource.use()).toThrow("must not be disposed");
    });

    it("should throw on double dispose", () => {
      const resource = new Resource();
      resource.dispose();
      expect(() => resource.dispose()).toThrow("must not be disposed");
    });
  });
});
