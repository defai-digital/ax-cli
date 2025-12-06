/**
 * Tests for BashTool
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BashTool, BashExecuteOptions } from "../../src/tools/bash.js";
import { EventEmitter } from "events";
import * as os from "os";

// Mock dependencies
vi.mock("../../src/utils/confirmation-service.js", () => ({
  ConfirmationService: {
    getInstance: () => ({
      shouldProceed: vi.fn().mockResolvedValue(true),
      getSessionFlags: vi.fn().mockReturnValue({ allOperations: false }),
    }),
  },
}));

vi.mock("../../src/utils/background-task-manager.js", () => ({
  getBackgroundTaskManager: () => ({
    spawn: vi.fn().mockReturnValue("task_123"),
    adoptProcess: vi.fn().mockReturnValue("task_456"),
  }),
}));

vi.mock("../../src/utils/settings-manager.js", () => ({
  getSettingsManager: () => ({
    getAutoAcceptConfig: vi.fn().mockReturnValue(null),
    loadUserSettings: vi.fn().mockReturnValue({ security: {} }),
  }),
}));

vi.mock("../../src/utils/message-optimizer.js", () => ({
  getMessageOptimizer: () => ({
    optimizeToolOutput: vi.fn().mockImplementation((content: string) => ({ content })),
  }),
}));

vi.mock("../../src/utils/safety-rules.js", () => ({
  isDestructiveCommand: vi.fn().mockReturnValue({ isDestructive: false, matchedOperations: [] }),
}));

vi.mock("../../src/utils/auto-accept-logger.js", () => ({
  getAutoAcceptLogger: () => ({
    logBashCommand: vi.fn(),
  }),
}));

describe("BashTool", () => {
  let bashTool: BashTool;

  beforeEach(() => {
    vi.clearAllMocks();
    bashTool = new BashTool();
  });

  afterEach(() => {
    bashTool.dispose();
  });

  describe("constructor", () => {
    it("should create a BashTool instance", () => {
      expect(bashTool).toBeDefined();
      expect(bashTool).toBeInstanceOf(EventEmitter);
    });
  });

  describe("isExecuting", () => {
    it("should return false when no command is running", () => {
      expect(bashTool.isExecuting()).toBe(false);
    });
  });

  describe("getCurrentDirectory", () => {
    it("should return current working directory", () => {
      expect(bashTool.getCurrentDirectory()).toBe(process.cwd());
    });
  });

  describe("execute", () => {
    it("should execute simple command successfully", async () => {
      const result = await bashTool.execute("echo hello");

      expect(result.success).toBe(true);
      expect(result.output).toContain("hello");
    });

    it("should return error for invalid timeout", async () => {
      const result = await bashTool.execute("echo test", { timeout: -1 });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid timeout");
    });

    it("should return error for NaN timeout", async () => {
      const result = await bashTool.execute("echo test", { timeout: NaN });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid timeout");
    });

    it("should accept legacy timeout number parameter", async () => {
      const result = await bashTool.execute("echo test", 5000);

      expect(result.success).toBe(true);
    });

    it("should handle failed commands", async () => {
      const result = await bashTool.execute("exit 1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("exit code 1");
    });

    it("should handle commands with stderr", async () => {
      const result = await bashTool.execute("echo error >&2");

      // Command succeeds even with stderr output
      expect(result.success).toBe(true);
      expect(result.output).toContain("error");
    });
  });

  describe("cd command handling", () => {
    it("should change directory with cd", async () => {
      const originalDir = bashTool.getCurrentDirectory();
      const tmpDir = os.tmpdir();
      const result = await bashTool.execute(`cd ${tmpDir}`);

      expect(result.success).toBe(true);
      // On macOS: /private/var/folders/.../T, on Windows: D:\Temp, on Linux: /tmp
      // Just check it contains part of the tmpDir path (the base name or last component)
      const tmpDirBase = tmpDir.split(/[/\\]/).filter(Boolean).pop() || "tmp";
      expect(result.output).toContain(tmpDirBase);

      // Change back
      await bashTool.execute(`cd ${originalDir}`);
    });

    it("should reject cd without directory", async () => {
      const result = await bashTool.execute("cd ");

      expect(result.success).toBe(false);
      expect(result.error).toContain("no directory specified");
    });

    it("should reject cd with compound commands", async () => {
      const result = await bashTool.execute("cd /tmp && ls");

      expect(result.success).toBe(false);
      expect(result.error).toContain("compound commands not supported");
    });

    it("should reject cd with pipe commands", async () => {
      const result = await bashTool.execute("cd /tmp | cat");

      expect(result.success).toBe(false);
      expect(result.error).toContain("compound commands not supported");
    });

    it("should reject cd with semicolon commands", async () => {
      const result = await bashTool.execute("cd /tmp; ls");

      expect(result.success).toBe(false);
      expect(result.error).toContain("compound commands not supported");
    });

    it("should handle non-existent directory", async () => {
      const result = await bashTool.execute("cd /nonexistent/path/12345");

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should expand tilde to home directory", async () => {
      const originalDir = bashTool.getCurrentDirectory();
      const result = await bashTool.execute("cd ~");

      expect(result.success).toBe(true);

      // Change back
      await bashTool.execute(`cd ${originalDir}`);
    });

    it("should handle quoted directory paths", async () => {
      const originalDir = bashTool.getCurrentDirectory();
      const tmpDir = os.tmpdir();
      const result = await bashTool.execute(`cd "${tmpDir}"`);

      expect(result.success).toBe(true);
      // On macOS: /private/var/folders/.../T, on Windows: D:\Temp, on Linux: /tmp
      // Just check it contains part of the tmpDir path (the base name or last component)
      const tmpDirBase = tmpDir.split(/[/\\]/).filter(Boolean).pop() || "tmp";
      expect(result.output).toContain(tmpDirBase);

      // Change back
      await bashTool.execute(`cd ${originalDir}`);
    });
  });

  describe("background execution", () => {
    it("should handle background command with trailing &", async () => {
      const result = await bashTool.execute("sleep 1 &");

      expect(result.success).toBe(true);
      expect(result.output).toContain("Background task started");
      expect(result.output).toContain("task_123");
    });

    it("should handle explicit background option", async () => {
      const result = await bashTool.execute("sleep 1", { background: true });

      expect(result.success).toBe(true);
      expect(result.output).toContain("Background task started");
    });
  });

  describe("moveToBackground", () => {
    it("should return null when no command is running", () => {
      const result = bashTool.moveToBackground();
      expect(result).toBeNull();
    });
  });

  describe("dispose", () => {
    it("should cleanup resources", () => {
      bashTool.dispose();

      // Should be able to call dispose multiple times
      expect(() => bashTool.dispose()).not.toThrow();
    });
  });

  describe("events", () => {
    it("should emit executionStarted event", async () => {
      const startedSpy = vi.fn();
      bashTool.on("executionStarted", startedSpy);

      await bashTool.execute("echo test");

      expect(startedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: "echo test",
          pid: expect.any(Number),
        })
      );
    });

    it("should emit executionCompleted event", async () => {
      const completedSpy = vi.fn();
      bashTool.on("executionCompleted", completedSpy);

      await bashTool.execute("echo test");

      expect(completedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: "echo test",
          exitCode: 0,
        })
      );
    });

    it("should emit stdout event for output", async () => {
      const stdoutSpy = vi.fn();
      bashTool.on("stdout", stdoutSpy);

      await bashTool.execute("echo hello");

      expect(stdoutSpy).toHaveBeenCalled();
    });

    it("should emit stderr event for error output", async () => {
      const stderrSpy = vi.fn();
      bashTool.on("stderr", stderrSpy);

      await bashTool.execute("echo error >&2");

      expect(stderrSpy).toHaveBeenCalled();
    });
  });
});
