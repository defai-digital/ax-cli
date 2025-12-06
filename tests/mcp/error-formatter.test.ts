/**
 * Tests for MCP Error Formatter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import {
  formatMCPConfigError,
  formatConnectionError,
  formatValidationError,
  formatWarning,
  formatSuccess,
  formatInfo,
} from "../../src/mcp/error-formatter.js";

// Strip ANSI codes for easier assertions
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, "");
}

describe("MCP Error Formatter", () => {
  describe("formatMCPConfigError", () => {
    it("should format a simple Zod error", () => {
      const schema = z.object({
        transport: z.object({
          type: z.string(),
          command: z.string(),
        }),
      });

      const result = schema.safeParse({ transport: {} });
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("test-server", result.error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("MCP Configuration Error");
      expect(plain).toContain("Server: test-server");
      expect(plain).toContain("Errors:");
      expect(plain).toContain("transport.type");
      expect(plain).toContain("transport.command");
    });

    it("should handle errors at root level", () => {
      const schema = z.object({
        name: z.string(),
      });

      const result = schema.safeParse({});
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("my-server", result.error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Server: my-server");
      expect(plain).toContain("name");
    });

    it("should provide hints for transport field", () => {
      const schema = z.object({
        transport: z.object({
          type: z.string(),
        }),
      });

      const result = schema.safeParse({});
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("server", result.error, {
        command: "node",
      });
      const plain = stripAnsi(formatted);

      expect(plain).toContain("transport");
      // Should detect legacy format
      expect(plain).toContain("Hint:");
    });

    it("should provide hints for transport.type field", () => {
      const schema = z.object({
        transport: z.object({
          type: z.enum(["stdio", "http"]),
        }),
      });

      const result = schema.safeParse({ transport: { type: "invalid" } });
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("server", result.error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("transport.type");
    });

    it("should provide hints for transport.command field", () => {
      const schema = z.object({
        transport: z.object({
          type: z.literal("stdio"),
          command: z.string().min(1),
        }),
      });

      const result = schema.safeParse({ transport: { type: "stdio", command: "" } });
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("server", result.error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("transport.command");
      expect(plain).toContain("Hint:");
    });

    it("should provide hints for transport.url field", () => {
      const schema = z.object({
        transport: z.object({
          type: z.literal("http"),
          url: z.string().url(),
        }),
      });

      const result = schema.safeParse({ transport: { type: "http", url: "" } });
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("server", result.error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("transport.url");
    });

    it("should provide hints for transport.args field", () => {
      const schema = z.object({
        transport: z.object({
          args: z.array(z.string()),
        }),
      });

      const result = schema.safeParse({ transport: { args: "not-array" } });
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("server", result.error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("transport.args");
    });

    it("should provide hints for name field", () => {
      const schema = z.object({
        name: z.string().min(1),
      });

      const result = schema.safeParse({ name: "" });
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("server", result.error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("name");
    });

    it("should provide hints for generic transport sub-fields", () => {
      const schema = z.object({
        transport: z.object({
          headers: z.record(z.string()),
        }),
      });

      const result = schema.safeParse({ transport: { headers: "invalid" } });
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("server", result.error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("transport.headers");
      expect(plain).toContain("Hint:");
    });

    it("should generate stdio example config when appropriate", () => {
      const schema = z.object({
        transport: z.object({
          command: z.string(),
        }),
      });

      const result = schema.safeParse({ transport: {} });
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("server", result.error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Example correct config:");
      expect(plain).toContain('"type": "stdio"');
      expect(plain).toContain('"command"');
    });

    it("should generate http example config when not stdio", () => {
      const schema = z.object({
        transport: z.object({
          url: z.string(),
        }),
      });

      const result = schema.safeParse({ transport: {} });
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("server", result.error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Example correct config:");
      expect(plain).toContain('"type": "http"');
      expect(plain).toContain('"url"');
    });

    it("should not generate example for non-transport errors", () => {
      const schema = z.object({
        enabled: z.boolean(),
      });

      const result = schema.safeParse({ enabled: "yes" });
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("server", result.error);
      const plain = stripAnsi(formatted);

      expect(plain).not.toContain("Example correct config:");
    });

    it("should include documentation link", () => {
      const schema = z.object({ name: z.string() });
      const result = schema.safeParse({});
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("server", result.error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Documentation:");
      expect(plain).toContain("https://docs.ax-cli.dev/mcp/configuration");
    });

    it("should handle multiple errors on same field", () => {
      const schema = z.object({
        name: z.string().min(3).max(10),
      });

      const result = schema.safeParse({ name: "" });
      if (result.success) throw new Error("Expected validation to fail");

      const formatted = formatMCPConfigError("server", result.error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("name");
    });

    it("should detect legacy config format and provide transport hint", () => {
      const schema = z.object({
        transport: z.object({
          type: z.string(),
        }),
      });

      const result = schema.safeParse({});
      if (result.success) throw new Error("Expected validation to fail");

      // Pass legacy config with command at root
      const formatted = formatMCPConfigError("server", result.error, {
        command: "node",
        args: ["server.js"],
      });
      const plain = stripAnsi(formatted);

      // The hint shown is always the first hint (Add "transport"...)
      // The legacy detection adds a second hint but only first is displayed
      expect(plain).toContain("transport");
      expect(plain).toContain("Hint:");
    });
  });

  describe("formatConnectionError", () => {
    it("should format basic connection error", () => {
      const error = new Error("Connection failed");
      const formatted = formatConnectionError("test-server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("MCP Connection Error");
      expect(plain).toContain("Server: test-server");
      expect(plain).toContain("Error: Connection failed");
    });

    it("should include transport type when provided", () => {
      const error = new Error("Failed");
      const formatted = formatConnectionError("server", error, "stdio");
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Transport: stdio");
    });

    it("should provide hints for ENOENT error", () => {
      const error = new Error("spawn npx ENOENT") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Troubleshooting:");
      expect(plain).toContain("Command not found");
    });

    it("should provide hints for EACCES error", () => {
      const error = new Error("EACCES permission denied") as NodeJS.ErrnoException;
      error.code = "EACCES";
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Troubleshooting:");
      expect(plain).toContain("Permission denied");
    });

    it("should provide hints for ECONNREFUSED error", () => {
      const error = new Error("connect ECONNREFUSED 127.0.0.1:3000") as NodeJS.ErrnoException;
      error.code = "ECONNREFUSED";
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Troubleshooting:");
      expect(plain).toContain("Connection refused");
    });

    it("should provide hints for ENOTFOUND error", () => {
      const error = new Error("getaddrinfo ENOTFOUND invalid.host") as NodeJS.ErrnoException;
      error.code = "ENOTFOUND";
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Troubleshooting:");
      expect(plain).toContain("Host not found");
    });

    it("should provide hints for ECONNRESET error", () => {
      const error = new Error("socket hang up") as NodeJS.ErrnoException;
      error.code = "ECONNRESET";
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Connection reset");
    });

    it("should provide hints for ETIMEDOUT error", () => {
      const error = new Error("connect ETIMEDOUT") as NodeJS.ErrnoException;
      error.code = "ETIMEDOUT";
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Connection timed out");
    });

    it("should provide hints for socket timeout error", () => {
      const error = new Error("ESOCKETTIMEDOUT");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Socket timed out");
    });

    it("should provide hints for SSL certificate error", () => {
      const error = new Error("CERT_HAS_EXPIRED");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("SSL Certificate error");
    });

    it("should provide hints for SSL verification error", () => {
      const error = new Error("unable_to_verify_leaf_signature");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("SSL verification failed");
    });

    it("should provide hints for 401 authentication error", () => {
      const error = new Error("Request failed with status 401");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Authentication failed");
    });

    it("should provide hints for 403 forbidden error", () => {
      const error = new Error("Request failed with status 403");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Access forbidden");
    });

    it("should provide hints for 500 server error", () => {
      const error = new Error("Request failed with status 500");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Server error");
    });

    it("should provide hints for 502 bad gateway error", () => {
      const error = new Error("Request failed with status 502");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Bad gateway");
    });

    it("should provide hints for 503 service unavailable error", () => {
      const error = new Error("Request failed with status 503");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Service unavailable");
    });

    it("should provide hints for spawn error", () => {
      const error = new Error("spawn failed: No such file or directory");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Failed to spawn process");
    });

    it("should provide hints for initialization failed error", () => {
      const error = new Error("MCP server initialization failed");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("MCP initialization failed");
    });

    it("should provide hints for protocol error", () => {
      const error = new Error("protocol error: invalid message format");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("MCP protocol error");
    });

    it("should provide hints for tool not found error", () => {
      const error = new Error("tool not found: unknown_tool");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("MCP tool not found");
    });

    it("should provide hints for Figma token error", () => {
      const error = new Error("FIGMA_ACCESS_TOKEN is not set");
      const formatted = formatConnectionError("figma", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Figma access token");
    });

    it("should provide hints for generic Figma error", () => {
      const error = new Error("figma API error: rate limit exceeded");
      const formatted = formatConnectionError("figma", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Figma");
    });

    it("should provide hints for GitHub token error", () => {
      const error = new Error("GITHUB_TOKEN is not set");
      const formatted = formatConnectionError("github", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("GitHub token");
    });

    it("should provide stdio transport hints for unknown errors", () => {
      const error = new Error("Unknown error");
      const formatted = formatConnectionError("server", error, "stdio");
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Troubleshooting:");
      expect(plain).toContain("stdio transport");
    });

    it("should provide http transport hints for unknown errors", () => {
      const error = new Error("Unknown error");
      const formatted = formatConnectionError("server", error, "http");
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Troubleshooting:");
      expect(plain).toContain("HTTP/SSE transport");
    });

    it("should provide sse transport hints for unknown errors", () => {
      const error = new Error("Unknown error");
      const formatted = formatConnectionError("server", error, "sse");
      const plain = stripAnsi(formatted);

      expect(plain).toContain("HTTP/SSE transport");
    });

    it("should provide general hints for unknown transport", () => {
      const error = new Error("Unknown error");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("General troubleshooting");
    });

    it("should include environment variable hints for token errors", () => {
      const error = new Error("Invalid API_KEY");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Environment variable tips");
    });

    it("should include environment variable hints for secret errors", () => {
      const error = new Error("Missing secret configuration");
      const formatted = formatConnectionError("server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Environment variable tips");
    });

    it("should include diagnostics command suggestion", () => {
      const error = new Error("Some error");
      const formatted = formatConnectionError("my-server", error);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Diagnostics:");
      expect(plain).toContain("ax-cli mcp test my-server");
    });
  });

  describe("formatValidationError", () => {
    it("should format validation error with context", () => {
      const formatted = formatValidationError("Server configuration", [
        { field: "name", message: "Name is required" },
      ]);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Validation Error");
      expect(plain).toContain("Context: Server configuration");
      expect(plain).toContain("Issues:");
      expect(plain).toContain("name: Name is required");
    });

    it("should format multiple issues", () => {
      const formatted = formatValidationError("Form validation", [
        { field: "email", message: "Invalid email format" },
        { field: "password", message: "Must be at least 8 characters" },
        { field: "username", message: "Username already taken" },
      ]);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("email: Invalid email format");
      expect(plain).toContain("password: Must be at least 8 characters");
      expect(plain).toContain("username: Username already taken");
    });

    it("should handle empty issues array", () => {
      const formatted = formatValidationError("Empty validation", []);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Validation Error");
      expect(plain).toContain("Context: Empty validation");
      expect(plain).toContain("Issues:");
    });
  });

  describe("formatWarning", () => {
    it("should format warning message", () => {
      const formatted = formatWarning("This is a warning");
      const plain = stripAnsi(formatted);

      expect(plain).toContain("This is a warning");
    });

    it("should include details when provided", () => {
      const formatted = formatWarning("Warning message", [
        "Detail 1",
        "Detail 2",
      ]);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Warning message");
      expect(plain).toContain("Detail 1");
      expect(plain).toContain("Detail 2");
    });

    it("should handle empty details array", () => {
      const formatted = formatWarning("Warning message", []);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Warning message");
    });
  });

  describe("formatSuccess", () => {
    it("should format success message", () => {
      const formatted = formatSuccess("Operation completed");
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Operation completed");
    });

    it("should include details when provided", () => {
      const formatted = formatSuccess("Success!", ["Created 3 files"]);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Success!");
      expect(plain).toContain("Created 3 files");
    });
  });

  describe("formatInfo", () => {
    it("should format info message", () => {
      const formatted = formatInfo("Information message");
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Information message");
    });

    it("should include details when provided", () => {
      const formatted = formatInfo("Info", ["Additional info here"]);
      const plain = stripAnsi(formatted);

      expect(plain).toContain("Info");
      expect(plain).toContain("Additional info here");
    });
  });
});
