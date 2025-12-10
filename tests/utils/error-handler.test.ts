/**
 * Tests for Error Handler utilities
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ErrorCategory,
  createErrorMessage,
  createToolError,
  createToolSuccess,
  extractErrorMessage,
  safeJsonParse,
  wrapToolOperation,
} from "../../packages/core/src/utils/error-handler.js";

// Mock enhanced-error-messages
vi.mock("../../packages/core/src/utils/enhanced-error-messages.js", () => ({
  createFriendlyError: vi.fn().mockImplementation(
    (category: string, operation: string, error: unknown, options?: { filePath?: string; details?: string }) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      let result = `[${category}] ${operation}: ${errorMsg}`;
      if (options?.filePath) {
        result += ` (file: ${options.filePath})`;
      }
      if (options?.details) {
        result += ` - ${options.details}`;
      }
      return result;
    }
  ),
}));

describe("ErrorCategory enum", () => {
  it("should have FILE_OPERATION category", () => {
    expect(ErrorCategory.FILE_OPERATION).toBe("File Operation");
  });

  it("should have BASH_COMMAND category", () => {
    expect(ErrorCategory.BASH_COMMAND).toBe("Bash Command");
  });

  it("should have MCP_CONNECTION category", () => {
    expect(ErrorCategory.MCP_CONNECTION).toBe("MCP Connection");
  });

  it("should have TOOL_EXECUTION category", () => {
    expect(ErrorCategory.TOOL_EXECUTION).toBe("Tool Execution");
  });

  it("should have VALIDATION category", () => {
    expect(ErrorCategory.VALIDATION).toBe("Validation");
  });

  it("should have NETWORK category", () => {
    expect(ErrorCategory.NETWORK).toBe("Network");
  });

  it("should have CONFIGURATION category", () => {
    expect(ErrorCategory.CONFIGURATION).toBe("Configuration");
  });

  it("should have API_ERROR category", () => {
    expect(ErrorCategory.API_ERROR).toBe("API Error");
  });

  it("should have AUTHENTICATION category", () => {
    expect(ErrorCategory.AUTHENTICATION).toBe("Authentication");
  });

  it("should have RATE_LIMIT category", () => {
    expect(ErrorCategory.RATE_LIMIT).toBe("Rate Limit");
  });

  it("should have MODEL_UNAVAILABLE category", () => {
    expect(ErrorCategory.MODEL_UNAVAILABLE).toBe("Model Unavailable");
  });

  it("should have PARSING category", () => {
    expect(ErrorCategory.PARSING).toBe("Parsing");
  });

  it("should have TIMEOUT category", () => {
    expect(ErrorCategory.TIMEOUT).toBe("Timeout");
  });
});

describe("extractErrorMessage", () => {
  it("should extract message from Error instance", () => {
    const error = new Error("Test error message");
    const message = extractErrorMessage(error);
    expect(message).toBe("Test error message");
  });

  it("should convert string to string", () => {
    const error = "String error";
    const message = extractErrorMessage(error);
    expect(message).toBe("String error");
  });

  it("should convert number to string", () => {
    const error = 42;
    const message = extractErrorMessage(error);
    expect(message).toBe("42");
  });

  it("should convert null to string", () => {
    const error = null;
    const message = extractErrorMessage(error);
    expect(message).toBe("null");
  });

  it("should convert undefined to string", () => {
    const error = undefined;
    const message = extractErrorMessage(error);
    expect(message).toBe("undefined");
  });

  it("should convert object to string", () => {
    const error = { message: "object error" };
    const message = extractErrorMessage(error);
    expect(message).toBe("[object Object]");
  });
});

describe("createErrorMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create error message with enhanced format by default", () => {
    const message = createErrorMessage(
      ErrorCategory.FILE_OPERATION,
      "Read file",
      new Error("File not found")
    );

    expect(message).toContain("File Operation");
    expect(message).toContain("Read file");
    expect(message).toContain("File not found");
  });

  it("should include file path when provided", () => {
    const message = createErrorMessage(
      ErrorCategory.FILE_OPERATION,
      "Read file",
      new Error("ENOENT"),
      { filePath: "/path/to/file.txt" }
    );

    expect(message).toContain("/path/to/file.txt");
  });

  it("should include details when provided", () => {
    const message = createErrorMessage(
      ErrorCategory.API_ERROR,
      "API call",
      new Error("Network error"),
      { details: "Check your connection" }
    );

    expect(message).toContain("Check your connection");
  });

  it("should use legacy format when useEnhancedFormat is false", () => {
    const message = createErrorMessage(
      ErrorCategory.FILE_OPERATION,
      "Read file",
      new Error("ENOENT: no such file"),
      { useEnhancedFormat: false }
    );

    expect(message).toContain("[File Operation]");
    expect(message).toContain("Read file failed");
  });

  it("should add suggestion for file not found errors", () => {
    const message = createErrorMessage(
      ErrorCategory.FILE_OPERATION,
      "Read file",
      new Error("ENOENT: no such file"),
      { useEnhancedFormat: false }
    );

    expect(message).toContain("Suggestion");
    expect(message).toContain("file path");
  });

  it("should add suggestion for permission errors", () => {
    const message = createErrorMessage(
      ErrorCategory.FILE_OPERATION,
      "Write file",
      new Error("EACCES: permission denied"),
      { useEnhancedFormat: false }
    );

    expect(message).toContain("Suggestion");
    expect(message).toContain("permission");
  });

  it("should add suggestion for directory errors", () => {
    const message = createErrorMessage(
      ErrorCategory.FILE_OPERATION,
      "Read file",
      new Error("EISDIR: is a directory"),
      { useEnhancedFormat: false }
    );

    expect(message).toContain("Suggestion");
    expect(message).toContain("directory");
  });

  it("should add suggestion for API key errors", () => {
    const message = createErrorMessage(
      ErrorCategory.API_ERROR,
      "API request",
      new Error("Invalid API key"),
      { useEnhancedFormat: false }
    );

    expect(message).toContain("Suggestion");
    expect(message).toContain("API key");
  });

  it("should add suggestion for unauthorized errors", () => {
    const message = createErrorMessage(
      ErrorCategory.AUTHENTICATION,
      "Auth",
      new Error("Unauthorized access"),
      { useEnhancedFormat: false }
    );

    expect(message).toContain("Suggestion");
  });

  it("should add suggestion for rate limit errors", () => {
    const message = createErrorMessage(
      ErrorCategory.RATE_LIMIT,
      "Request",
      new Error("Too many requests"),
      { useEnhancedFormat: false }
    );

    expect(message).toContain("Suggestion");
    expect(message).toContain("Wait");
  });

  it("should add suggestion for MCP connection errors", () => {
    const message = createErrorMessage(
      ErrorCategory.MCP_CONNECTION,
      "Connect",
      new Error("Connection failed"),
      { useEnhancedFormat: false }
    );

    expect(message).toContain("Suggestion");
    expect(message).toContain("MCP server");
  });

  it("should add suggestion for command not found errors", () => {
    const message = createErrorMessage(
      ErrorCategory.BASH_COMMAND,
      "Execute",
      new Error("command not found: foo"),
      { useEnhancedFormat: false }
    );

    expect(message).toContain("Suggestion");
    expect(message).toContain("Install");
  });

  it("should add suggestion for exit code errors", () => {
    const message = createErrorMessage(
      ErrorCategory.BASH_COMMAND,
      "Execute",
      new Error("Process exited with exit code 1"),
      { useEnhancedFormat: false }
    );

    expect(message).toContain("Suggestion");
  });
});

describe("createToolError", () => {
  it("should return ToolResult with success false", () => {
    const result = createToolError(
      ErrorCategory.FILE_OPERATION,
      "Read file",
      new Error("File not found")
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should include error message", () => {
    const result = createToolError(
      ErrorCategory.VALIDATION,
      "Validate input",
      new Error("Invalid format")
    );

    expect(result.error).toContain("Invalid format");
  });

  it("should pass through options", () => {
    const result = createToolError(
      ErrorCategory.FILE_OPERATION,
      "Read file",
      new Error("Not found"),
      { filePath: "/test/file.txt" }
    );

    expect(result.error).toContain("/test/file.txt");
  });
});

describe("createToolSuccess", () => {
  it("should return ToolResult with success true", () => {
    const result = createToolSuccess("Operation completed");

    expect(result.success).toBe(true);
    expect(result.output).toBe("Operation completed");
  });

  it("should handle empty string output", () => {
    const result = createToolSuccess("");

    expect(result.success).toBe(true);
    expect(result.output).toBe("");
  });

  it("should handle multiline output", () => {
    const output = "Line 1\nLine 2\nLine 3";
    const result = createToolSuccess(output);

    expect(result.success).toBe(true);
    expect(result.output).toBe(output);
  });
});

describe("safeJsonParse", () => {
  it("should parse valid JSON", () => {
    const result = safeJsonParse<{ foo: string }>('{"foo": "bar"}');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.foo).toBe("bar");
    }
  });

  it("should handle arrays", () => {
    const result = safeJsonParse<number[]>("[1, 2, 3]");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([1, 2, 3]);
    }
  });

  it("should handle nested objects", () => {
    const result = safeJsonParse<{ a: { b: number } }>('{"a": {"b": 42}}');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.a.b).toBe(42);
    }
  });

  it("should return error for invalid JSON", () => {
    const result = safeJsonParse("not valid json");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it("should return error for incomplete JSON", () => {
    const result = safeJsonParse('{"foo": ');

    expect(result.success).toBe(false);
  });

  it("should handle empty string", () => {
    const result = safeJsonParse("");

    expect(result.success).toBe(false);
  });
});

describe("wrapToolOperation", () => {
  it("should return success for successful operation", async () => {
    const result = await wrapToolOperation(
      ErrorCategory.FILE_OPERATION,
      "Read file",
      async () => "File content"
    );

    expect(result.success).toBe(true);
    expect(result.output).toBe("File content");
  });

  it("should stringify non-string results", async () => {
    const result = await wrapToolOperation(
      ErrorCategory.TOOL_EXECUTION,
      "Get data",
      async () => ({ foo: "bar" })
    );

    expect(result.success).toBe(true);
    expect(result.output).toBe('{"foo":"bar"}');
  });

  it("should return error for failed operation", async () => {
    const result = await wrapToolOperation(
      ErrorCategory.FILE_OPERATION,
      "Read file",
      async () => {
        throw new Error("File not found");
      }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("File not found");
  });

  it("should handle sync errors", async () => {
    const result = await wrapToolOperation(
      ErrorCategory.VALIDATION,
      "Validate",
      async () => {
        throw new Error("Validation failed");
      }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Validation failed");
  });

  it("should handle returning arrays", async () => {
    const result = await wrapToolOperation(
      ErrorCategory.TOOL_EXECUTION,
      "List items",
      async () => [1, 2, 3]
    );

    expect(result.success).toBe(true);
    expect(result.output).toBe("[1,2,3]");
  });

  it("should handle null return value", async () => {
    const result = await wrapToolOperation(
      ErrorCategory.TOOL_EXECUTION,
      "Get nullable",
      async () => null
    );

    expect(result.success).toBe(true);
    expect(result.output).toBe("null");
  });
});
