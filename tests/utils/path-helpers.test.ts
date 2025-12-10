/**
 * Tests for Path Helpers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as os from "os";

// Mock fs module
vi.mock("fs", () => ({
  accessSync: vi.fn(),
  mkdirSync: vi.fn(),
  constants: {
    W_OK: 2,
  },
}));

// Mock provider config module - uses .ax-glm as the default provider directory
vi.mock("../../packages/core/src/provider/config.js", () => ({
  getActiveConfigPaths: vi.fn(() => ({
    USER_DIR: path.join(os.homedir(), ".ax-glm"),
    PROJECT_DIR: path.join(process.cwd(), ".ax-glm"),
    CONFIG_FILE: path.join(os.homedir(), ".ax-glm", "config.json"),
    PROJECT_CONFIG_FILE: path.join(process.cwd(), ".ax-glm", "config.json"),
    CUSTOM_INSTRUCTIONS: path.join(os.homedir(), ".ax-glm", "CUSTOM.md"),
    PROJECT_CUSTOM_INSTRUCTIONS: path.join(process.cwd(), ".ax-glm", "CUSTOM.md"),
    MCP_CONFIG: path.join(os.homedir(), ".ax-glm", "mcp.json"),
    PROJECT_MCP_CONFIG: path.join(process.cwd(), ".ax-glm", "mcp.json"),
    CHECKPOINT_DIR: path.join(os.homedir(), ".ax-glm", "checkpoints"),
    PROJECT_CHECKPOINT_DIR: path.join(process.cwd(), ".ax-glm", "checkpoints"),
  })),
}));

// Import after mocks
import { getAxBaseDir } from "../../packages/core/src/utils/path-helpers.js";
import * as fs from "fs";

describe("Path Helpers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.AX_CLI_HOME;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("getAxBaseDir", () => {
    describe("when AX_CLI_HOME is set", () => {
      it("should return resolved AX_CLI_HOME path", () => {
        process.env.AX_CLI_HOME = "/custom/ax-cli";
        const result = getAxBaseDir();
        expect(result).toBe(path.resolve("/custom/ax-cli"));
      });

      it("should resolve relative AX_CLI_HOME path", () => {
        process.env.AX_CLI_HOME = "./custom-dir";
        const result = getAxBaseDir();
        expect(result).toBe(path.resolve("./custom-dir"));
      });

      it("should handle AX_CLI_HOME with tilde", () => {
        process.env.AX_CLI_HOME = "~/my-ax-cli";
        const result = getAxBaseDir();
        // path.resolve won't expand tilde, but it will resolve it
        expect(result).toBe(path.resolve("~/my-ax-cli"));
      });

      it("should ignore empty AX_CLI_HOME", () => {
        process.env.AX_CLI_HOME = "";
        vi.mocked(fs.accessSync).mockImplementation(() => undefined);
        const result = getAxBaseDir();
        expect(result).toBe(path.join(os.homedir(), ".ax-glm"));
      });

      it("should ignore whitespace-only AX_CLI_HOME", () => {
        process.env.AX_CLI_HOME = "   ";
        vi.mocked(fs.accessSync).mockImplementation(() => undefined);
        const result = getAxBaseDir();
        expect(result).toBe(path.join(os.homedir(), ".ax-glm"));
      });

      it("should trim whitespace from AX_CLI_HOME", () => {
        process.env.AX_CLI_HOME = "  /custom/path  ";
        const result = getAxBaseDir();
        // The trim is only for checking if empty, path.resolve handles the actual value
        expect(result).toBe(path.resolve("  /custom/path  "));
      });
    });

    describe("when AX_CLI_HOME is not set", () => {
      describe("and default directory is writable", () => {
        it("should return default directory", () => {
          vi.mocked(fs.accessSync).mockImplementation(() => undefined);
          const result = getAxBaseDir();
          expect(result).toBe(path.join(os.homedir(), ".ax-glm"));
        });

        it("should check write permission on default directory", () => {
          vi.mocked(fs.accessSync).mockImplementation(() => undefined);
          getAxBaseDir();
          expect(fs.accessSync).toHaveBeenCalledWith(
            path.join(os.homedir(), ".ax-glm"),
            fs.constants.W_OK
          );
        });
      });

      describe("and default directory is not writable", () => {
        beforeEach(() => {
          vi.mocked(fs.accessSync).mockImplementation(() => {
            throw new Error("EACCES: permission denied");
          });
        });

        it("should fall back to project directory", () => {
          const result = getAxBaseDir();
          expect(result).toBe(path.join(process.cwd(), ".ax-glm"));
        });

        it("should attempt to create fallback directory", () => {
          getAxBaseDir();
          expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(process.cwd(), ".ax-glm"), {
            recursive: true,
          });
        });

        it("should handle mkdir failure gracefully", () => {
          vi.mocked(fs.mkdirSync).mockImplementation(() => {
            throw new Error("EPERM: operation not permitted");
          });
          // Should not throw, should still return fallback path
          const result = getAxBaseDir();
          expect(result).toBe(path.join(process.cwd(), ".ax-glm"));
        });

        it("should return fallback even when mkdir throws EEXIST", () => {
          vi.mocked(fs.mkdirSync).mockImplementation(() => {
            const error = new Error("EEXIST: file already exists") as NodeJS.ErrnoException;
            error.code = "EEXIST";
            throw error;
          });
          const result = getAxBaseDir();
          expect(result).toBe(path.join(process.cwd(), ".ax-glm"));
        });
      });
    });

    describe("edge cases", () => {
      it("should handle undefined AX_CLI_HOME", () => {
        process.env.AX_CLI_HOME = undefined;
        vi.mocked(fs.accessSync).mockImplementation(() => undefined);
        const result = getAxBaseDir();
        expect(result).toBe(path.join(os.homedir(), ".ax-glm"));
      });

      it("should handle ENOENT when checking default directory", () => {
        vi.mocked(fs.accessSync).mockImplementation(() => {
          const error = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
          error.code = "ENOENT";
          throw error;
        });
        const result = getAxBaseDir();
        expect(result).toBe(path.join(process.cwd(), ".ax-glm"));
      });

      it("should handle EPERM when checking default directory", () => {
        vi.mocked(fs.accessSync).mockImplementation(() => {
          const error = new Error("EPERM: operation not permitted") as NodeJS.ErrnoException;
          error.code = "EPERM";
          throw error;
        });
        const result = getAxBaseDir();
        expect(result).toBe(path.join(process.cwd(), ".ax-glm"));
      });
    });
  });
});
