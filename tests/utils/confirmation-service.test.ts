/**
 * Tests for ConfirmationService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConfirmationService, type ConfirmationOptions } from "../../packages/core/src/utils/confirmation-service.js";
import { TIMEOUT_CONFIG } from "../../packages/core/src/constants.js";

// Mock the IPC module
vi.mock("../../packages/core/src/ipc/index.js", () => ({
  getVSCodeIPCClient: vi.fn().mockReturnValue({
    isConnected: vi.fn().mockReturnValue(false),
    requestDiffApproval: vi.fn(),
  }),
}));

// Mock child_process exec
vi.mock("child_process", () => ({
  exec: vi.fn((cmd, callback) => {
    // Default to failing (VS Code not found)
    const error = new Error("Command not found");
    if (callback) callback(error, "", "");
    return { on: vi.fn(), stdout: { on: vi.fn() }, stderr: { on: vi.fn() } };
  }),
}));

describe("ConfirmationService", () => {
  let service: ConfirmationService;

  beforeEach(() => {
    // Create a fresh instance for each test
    service = new ConfirmationService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("singleton pattern", () => {
    it("should return same instance from getInstance", () => {
      const instance1 = ConfirmationService.getInstance();
      const instance2 = ConfirmationService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("constructor", () => {
    it("should initialize with default session flags", () => {
      const flags = service.getSessionFlags();

      expect(flags.fileOperations).toBe(false);
      expect(flags.bashCommands).toBe(false);
      expect(flags.allOperations).toBe(true); // Default to true
    });
  });

  describe("shouldProceed", () => {
    it("should return true when allOperations flag is set", async () => {
      service.setSessionFlag("allOperations", true);

      const result = await service.shouldProceed("file", {
        operation: "write",
        filename: "/test/file.txt",
      });

      expect(result).toBe(true);
    });

    it("should return true when fileOperations flag is set for file operations", async () => {
      service.setSessionFlag("allOperations", false);
      service.setSessionFlag("fileOperations", true);

      const result = await service.shouldProceed("file", {
        operation: "write",
        filename: "/test/file.txt",
      });

      expect(result).toBe(true);
    });

    it("should return true when bashCommands flag is set for bash operations", async () => {
      service.setSessionFlag("allOperations", false);
      service.setSessionFlag("bashCommands", true);

      const result = await service.shouldProceed("bash", {
        operation: "execute",
        filename: "ls -la",
      });

      expect(result).toBe(true);
    });

    it("should request confirmation when alwaysConfirm is true", async () => {
      service.setSessionFlag("allOperations", true);

      const options: ConfirmationOptions = {
        operation: "delete",
        filename: "/test/file.txt",
        alwaysConfirm: true,
      };

      // Start the confirmation request (doesn't await)
      const resultPromise = service.shouldProceed("file", options);

      // Simulate user confirming
      setTimeout(() => {
        service.confirmOperation(true);
      }, 10);

      const result = await resultPromise;
      expect(result).toBe(true);
    });

    it("should request confirmation when no auto-approve flags are set", async () => {
      service.setSessionFlag("allOperations", false);

      const options: ConfirmationOptions = {
        operation: "write",
        filename: "/test/file.txt",
      };

      const resultPromise = service.shouldProceed("file", options);

      setTimeout(() => {
        service.confirmOperation(true);
      }, 10);

      const result = await resultPromise;
      expect(result).toBe(true);
    });
  });

  describe("requestConfirmation", () => {
    it("should return confirmed true when allOperations flag is set", async () => {
      service.setSessionFlag("allOperations", true);

      const result = await service.requestConfirmation({
        operation: "write",
        filename: "/test/file.txt",
      });

      expect(result.confirmed).toBe(true);
    });

    it("should return confirmed true when fileOperations flag is set for file type", async () => {
      service.setSessionFlag("allOperations", false);
      service.setSessionFlag("fileOperations", true);

      const result = await service.requestConfirmation(
        { operation: "write", filename: "/test/file.txt" },
        "file"
      );

      expect(result.confirmed).toBe(true);
    });

    it("should return confirmed true when bashCommands flag is set for bash type", async () => {
      service.setSessionFlag("allOperations", false);
      service.setSessionFlag("bashCommands", true);

      const result = await service.requestConfirmation(
        { operation: "execute", filename: "ls" },
        "bash"
      );

      expect(result.confirmed).toBe(true);
    });

    it("should reject when another confirmation is pending", async () => {
      service.setSessionFlag("allOperations", false);

      // Start first confirmation
      const promise1 = service.requestConfirmation({
        operation: "write",
        filename: "/test/file1.txt",
      });

      // Try to start second confirmation
      const result2 = await service.requestConfirmation({
        operation: "write",
        filename: "/test/file2.txt",
      });

      expect(result2.confirmed).toBe(false);
      expect(result2.feedback).toContain("Another confirmation is already pending");

      // Cleanup first promise
      service.confirmOperation(true);
      await promise1;
    });

    it("should emit confirmation-requested event", async () => {
      service.setSessionFlag("allOperations", false);

      const options: ConfirmationOptions = {
        operation: "write",
        filename: "/test/file.txt",
      };

      const eventHandler = vi.fn();
      service.on("confirmation-requested", eventHandler);

      const promise = service.requestConfirmation(options);

      // Wait for setImmediate to fire
      await new Promise((resolve) => setImmediate(resolve));

      expect(eventHandler).toHaveBeenCalledWith(options);

      service.confirmOperation(true);
      await promise;
    });

    it("should set session flag when dontAskAgain is true", async () => {
      service.setSessionFlag("allOperations", false);
      service.setSessionFlag("fileOperations", false);

      const options: ConfirmationOptions = {
        operation: "write",
        filename: "/test/file.txt",
      };

      const promise = service.requestConfirmation(options, "file");

      setTimeout(() => {
        service.confirmOperation(true, true); // dontAskAgain = true
      }, 10);

      await promise;

      expect(service.getSessionFlags().fileOperations).toBe(true);
    });

    it("should set bash session flag when dontAskAgain is true for bash", async () => {
      service.setSessionFlag("allOperations", false);
      service.setSessionFlag("bashCommands", false);

      const promise = service.requestConfirmation(
        { operation: "execute", filename: "ls" },
        "bash"
      );

      setTimeout(() => {
        service.confirmOperation(true, true);
      }, 10);

      await promise;

      expect(service.getSessionFlags().bashCommands).toBe(true);
    });

    it("should timeout and auto-reject after configured timeout", async () => {
      vi.useFakeTimers();
      service.setSessionFlag("allOperations", false);

      const options: ConfirmationOptions = {
        operation: "write",
        filename: "/test/file.txt",
      };

      const promise = service.requestConfirmation(options);

      // Fast-forward past the timeout
      vi.advanceTimersByTime(TIMEOUT_CONFIG.CONFIRMATION_TIMEOUT + 100);

      const result = await promise;

      expect(result.confirmed).toBe(false);
      expect(result.feedback).toContain("timeout");
    });

    it("should require confirmation when alwaysConfirm is true despite auto-approve", async () => {
      service.setSessionFlag("allOperations", true);

      const options: ConfirmationOptions = {
        operation: "delete",
        filename: "/test/file.txt",
        alwaysConfirm: true,
      };

      const promise = service.requestConfirmation(options, "file");

      setTimeout(() => {
        service.confirmOperation(false);
      }, 10);

      const result = await promise;
      expect(result.confirmed).toBe(false);
    });
  });

  describe("confirmOperation", () => {
    it("should resolve pending confirmation with confirmed true", async () => {
      service.setSessionFlag("allOperations", false);

      const promise = service.requestConfirmation({
        operation: "write",
        filename: "/test/file.txt",
      });

      service.confirmOperation(true);

      const result = await promise;
      expect(result.confirmed).toBe(true);
    });

    it("should resolve pending confirmation with confirmed false", async () => {
      service.setSessionFlag("allOperations", false);

      const promise = service.requestConfirmation({
        operation: "write",
        filename: "/test/file.txt",
      });

      service.confirmOperation(false);

      const result = await promise;
      expect(result.confirmed).toBe(false);
    });

    it("should include dontAskAgain in result", async () => {
      service.setSessionFlag("allOperations", false);

      const promise = service.requestConfirmation({
        operation: "write",
        filename: "/test/file.txt",
      });

      service.confirmOperation(true, true);

      const result = await promise;
      expect(result.dontAskAgain).toBe(true);
    });

    it("should do nothing if no pending confirmation", () => {
      // Should not throw
      expect(() => service.confirmOperation(true)).not.toThrow();
    });

    it("should clear timeout when confirming", async () => {
      vi.useFakeTimers();
      service.setSessionFlag("allOperations", false);

      const promise = service.requestConfirmation({
        operation: "write",
        filename: "/test/file.txt",
      });

      // Confirm immediately
      service.confirmOperation(true);

      const result = await promise;
      expect(result.confirmed).toBe(true);

      // Advance time past timeout - should not affect result
      vi.advanceTimersByTime(TIMEOUT_CONFIG.CONFIRMATION_TIMEOUT + 100);

      // Result should still be confirmed (not timed out)
      expect(result.confirmed).toBe(true);
    });
  });

  describe("rejectOperation", () => {
    it("should resolve pending confirmation as rejected", async () => {
      service.setSessionFlag("allOperations", false);

      const promise = service.requestConfirmation({
        operation: "write",
        filename: "/test/file.txt",
      });

      service.rejectOperation();

      const result = await promise;
      expect(result.confirmed).toBe(false);
    });

    it("should include feedback in result", async () => {
      service.setSessionFlag("allOperations", false);

      const promise = service.requestConfirmation({
        operation: "write",
        filename: "/test/file.txt",
      });

      service.rejectOperation("User cancelled");

      const result = await promise;
      expect(result.confirmed).toBe(false);
      expect(result.feedback).toBe("User cancelled");
    });

    it("should do nothing if no pending confirmation", () => {
      expect(() => service.rejectOperation()).not.toThrow();
    });

    it("should clear timeout when rejecting", async () => {
      vi.useFakeTimers();
      service.setSessionFlag("allOperations", false);

      const promise = service.requestConfirmation({
        operation: "write",
        filename: "/test/file.txt",
      });

      service.rejectOperation("Cancelled");

      const result = await promise;
      expect(result.confirmed).toBe(false);
      expect(result.feedback).toBe("Cancelled");
    });
  });

  describe("isPending", () => {
    it("should return false when no confirmation is pending", () => {
      expect(service.isPending()).toBe(false);
    });

    it("should return true when confirmation is pending", async () => {
      service.setSessionFlag("allOperations", false);

      const promise = service.requestConfirmation({
        operation: "write",
        filename: "/test/file.txt",
      });

      expect(service.isPending()).toBe(true);

      service.confirmOperation(true);
      await promise;

      expect(service.isPending()).toBe(false);
    });
  });

  describe("resetSession", () => {
    it("should reset all session flags to false", () => {
      service.setSessionFlag("allOperations", true);
      service.setSessionFlag("fileOperations", true);
      service.setSessionFlag("bashCommands", true);

      service.resetSession();

      const flags = service.getSessionFlags();
      expect(flags.allOperations).toBe(false);
      expect(flags.fileOperations).toBe(false);
      expect(flags.bashCommands).toBe(false);
    });
  });

  describe("getSessionFlags", () => {
    it("should return a copy of session flags", () => {
      const flags1 = service.getSessionFlags();
      const flags2 = service.getSessionFlags();

      expect(flags1).toEqual(flags2);
      expect(flags1).not.toBe(flags2); // Different objects
    });
  });

  describe("setSessionFlag", () => {
    it("should set fileOperations flag", () => {
      service.setSessionFlag("fileOperations", true);
      expect(service.getSessionFlags().fileOperations).toBe(true);
    });

    it("should set bashCommands flag", () => {
      service.setSessionFlag("bashCommands", true);
      expect(service.getSessionFlags().bashCommands).toBe(true);
    });

    it("should set allOperations flag", () => {
      service.setSessionFlag("allOperations", false);
      expect(service.getSessionFlags().allOperations).toBe(false);
    });
  });

  describe("VS Code IPC integration", () => {
    it("should use IPC for diff approval when connected", async () => {
      const { getVSCodeIPCClient } = await import("../../packages/core/src/ipc/index.js");

      const mockClient = {
        isConnected: vi.fn().mockReturnValue(true),
        requestDiffApproval: vi.fn().mockResolvedValue(true),
      };
      vi.mocked(getVSCodeIPCClient).mockReturnValue(mockClient as any);

      service.setSessionFlag("allOperations", false);

      const result = await service.requestConfirmation(
        {
          operation: "edit",
          filename: "/test/file.txt",
          oldContent: "old",
          newContent: "new",
          content: "diff content",
          diffOperation: "edit",
        },
        "file"
      );

      expect(mockClient.requestDiffApproval).toHaveBeenCalled();
      expect(result.confirmed).toBe(true);
    });

    it("should fall through to terminal on IPC failure", async () => {
      const { getVSCodeIPCClient } = await import("../../packages/core/src/ipc/index.js");

      const mockClient = {
        isConnected: vi.fn().mockReturnValue(true),
        requestDiffApproval: vi.fn().mockRejectedValue(new Error("IPC error")),
      };
      vi.mocked(getVSCodeIPCClient).mockReturnValue(mockClient as any);

      service.setSessionFlag("allOperations", false);

      const promise = service.requestConfirmation(
        {
          operation: "edit",
          filename: "/test/file.txt",
          oldContent: "old",
          newContent: "new",
        },
        "file"
      );

      // Should fall through to terminal confirmation
      setTimeout(() => service.confirmOperation(true), 50);

      const result = await promise;
      expect(result.confirmed).toBe(true);
    });

    it("should not use IPC when not connected", async () => {
      const { getVSCodeIPCClient } = await import("../../packages/core/src/ipc/index.js");

      const mockClient = {
        isConnected: vi.fn().mockReturnValue(false),
        requestDiffApproval: vi.fn(),
      };
      vi.mocked(getVSCodeIPCClient).mockReturnValue(mockClient as any);

      service.setSessionFlag("allOperations", false);

      const promise = service.requestConfirmation(
        {
          operation: "edit",
          filename: "/test/file.txt",
          oldContent: "old",
          newContent: "new",
        },
        "file"
      );

      setTimeout(() => service.confirmOperation(true), 10);

      await promise;

      expect(mockClient.requestDiffApproval).not.toHaveBeenCalled();
    });
  });

  describe("openInVSCode", () => {
    it("should continue without VS Code when showVSCodeOpen fails", async () => {
      service.setSessionFlag("allOperations", false);

      const options: ConfirmationOptions = {
        operation: "write",
        filename: "/test/file.txt",
        showVSCodeOpen: true,
      };

      const promise = service.requestConfirmation(options, "file");

      setTimeout(() => service.confirmOperation(true), 50);

      const result = await promise;
      expect(result.confirmed).toBe(true);
      // showVSCodeOpen should be set to false after failure
    });
  });

  describe("race condition handling", () => {
    it("should prevent double resolution", async () => {
      vi.useFakeTimers();
      service.setSessionFlag("allOperations", false);

      const promise = service.requestConfirmation({
        operation: "write",
        filename: "/test/file.txt",
      });

      // Confirm immediately
      service.confirmOperation(true);

      // Try to confirm again (should be ignored)
      service.confirmOperation(false);

      const result = await promise;
      expect(result.confirmed).toBe(true); // First confirmation should win
    });

    it("should handle timeout after manual confirmation", async () => {
      vi.useFakeTimers();
      service.setSessionFlag("allOperations", false);

      const promise = service.requestConfirmation({
        operation: "write",
        filename: "/test/file.txt",
      });

      // Confirm immediately
      service.confirmOperation(true);

      const result = await promise;

      // Now advance timers past timeout
      vi.advanceTimersByTime(TIMEOUT_CONFIG.CONFIRMATION_TIMEOUT + 100);

      // Should still be the confirmed result
      expect(result.confirmed).toBe(true);
    });
  });

  describe("timeout cleanup", () => {
    it("should clear existing timeout when requesting new confirmation", async () => {
      vi.useFakeTimers();
      service.setSessionFlag("allOperations", false);

      const promise1 = service.requestConfirmation({
        operation: "write",
        filename: "/test/file1.txt",
      });

      // Confirm first request
      service.confirmOperation(true);
      await promise1;

      // Request again - should clear any lingering timeout
      const promise2 = service.requestConfirmation({
        operation: "write",
        filename: "/test/file2.txt",
      });

      service.confirmOperation(true);
      const result = await promise2;

      expect(result.confirmed).toBe(true);
    });
  });
});
