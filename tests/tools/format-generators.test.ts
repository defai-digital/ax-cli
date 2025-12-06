/**
 * Tests for Tool Format Generators
 */

import { describe, it, expect } from "vitest";
import {
  toOpenAIFormat,
  toAnthropicFormat,
  toSystemPromptSection,
  generateToolInstructions,
  generateCompactDescription,
  calculateTotalTokenCost,
  filterByCategory,
  filterBySafetyLevel,
  getToolsRequiringConfirmation,
} from "../../src/tools/format-generators.js";
import type { ToolDefinition } from "../../src/tools/types.js";

// Create test tool definition
const createTestTool = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: "test_tool",
  displayName: "Test Tool",
  version: "1.0.0",
  description:
    "This is a test tool for unit testing.\n\nIt has multiple paragraphs.",
  categories: ["test"],
  safetyLevel: "safe",
  requiresConfirmation: false,
  parameters: {
    properties: {
      input: {
        type: "string",
        description: "The input value",
        required: true,
      },
      optional: {
        type: "number",
        description: "An optional number",
        required: false,
        default: 10,
      },
    },
    required: ["input"],
  },
  usageNotes: ["Use for testing", "Check the results"],
  constraints: ["Input must be non-empty"],
  antiPatterns: ["Do not use in production"],
  examples: [
    {
      description: "Basic usage",
      scenario: "Testing the tool",
      input: { input: "test" },
      expectedBehavior: "Returns success",
      notes: "Simple test case",
    },
  ],
  relatedTools: ["other_tool"],
  alternatives: ["alternative_tool"],
  tokenCost: 100,
  ...overrides,
});

describe("generateCompactDescription", () => {
  it("should return first paragraph", () => {
    const tool = createTestTool();
    const compact = generateCompactDescription(tool);

    expect(compact).toBe("This is a test tool for unit testing.");
  });

  it("should add constraint for dangerous tools", () => {
    const tool = createTestTool({
      safetyLevel: "dangerous",
      constraints: ["Must verify before use"],
    });

    const compact = generateCompactDescription(tool);

    expect(compact).toContain("IMPORTANT: Must verify before use");
  });

  it("should truncate long descriptions", () => {
    const tool = createTestTool({
      description: "A".repeat(600) + "\n\nSecond paragraph",
    });

    const compact = generateCompactDescription(tool);

    expect(compact.length).toBeLessThanOrEqual(600);
  });
});

describe("toOpenAIFormat", () => {
  it("should convert to OpenAI function format", () => {
    const tool = createTestTool();
    const openai = toOpenAIFormat(tool);

    expect(openai.type).toBe("function");
    expect(openai.function.name).toBe("test_tool");
    expect(openai.function.description).toBeDefined();
    expect(openai.function.parameters.type).toBe("object");
    expect(openai.function.parameters.properties).toHaveProperty("input");
    expect(openai.function.parameters.required).toContain("input");
  });

  it("should include parameter defaults", () => {
    const tool = createTestTool();
    const openai = toOpenAIFormat(tool);

    const optionalParam = openai.function.parameters.properties.optional as any;
    expect(optionalParam.default).toBe(10);
  });

  it("should include enum values", () => {
    const tool = createTestTool({
      parameters: {
        properties: {
          mode: {
            type: "string",
            description: "Mode selection",
            required: true,
            enum: ["fast", "slow", "balanced"],
          },
        },
        required: ["mode"],
      },
    });

    const openai = toOpenAIFormat(tool);
    const modeParam = openai.function.parameters.properties.mode as any;

    expect(modeParam.enum).toEqual(["fast", "slow", "balanced"]);
  });

  it("should handle array parameters with object items", () => {
    const tool = createTestTool({
      parameters: {
        properties: {
          items: {
            type: "array",
            description: "List of items",
            required: true,
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Item name",
                  required: true,
                },
                value: {
                  type: "number",
                  description: "Item value",
                  required: false,
                },
              },
              required: ["name"],
            },
          },
        },
        required: ["items"],
      },
    });

    const openai = toOpenAIFormat(tool);
    const itemsParam = openai.function.parameters.properties.items as any;

    expect(itemsParam.type).toBe("array");
    expect(itemsParam.items.type).toBe("object");
    expect(itemsParam.items.properties.name).toBeDefined();
  });

  it("should handle array parameters with primitive items", () => {
    const tool = createTestTool({
      parameters: {
        properties: {
          tags: {
            type: "array",
            description: "List of tags",
            required: false,
            items: { type: "string" },
          },
        },
        required: [],
      },
    });

    const openai = toOpenAIFormat(tool);
    const tagsParam = openai.function.parameters.properties.tags as any;

    expect(tagsParam.type).toBe("array");
    expect(tagsParam.items.type).toBe("string");
  });
});

describe("toAnthropicFormat", () => {
  it("should convert to Anthropic tool format", () => {
    const tool = createTestTool();
    const anthropic = toAnthropicFormat(tool);

    expect(anthropic.name).toBe("test_tool");
    expect(anthropic.description).toBeDefined();
    expect(anthropic.input_schema.type).toBe("object");
    expect(anthropic.input_schema.properties).toHaveProperty("input");
    expect(anthropic.input_schema.required).toContain("input");
  });
});

describe("toSystemPromptSection", () => {
  it("should generate markdown section", () => {
    const tool = createTestTool();
    const section = toSystemPromptSection(tool);

    expect(section).toContain("## Test Tool");
    expect(section).toContain("### Parameters");
    expect(section).toContain("`input` (required)");
    expect(section).toContain("`optional` (optional)");
    expect(section).toContain("Default: `10`");
  });

  it("should include usage notes", () => {
    const tool = createTestTool();
    const section = toSystemPromptSection(tool);

    expect(section).toContain("### Usage Notes");
    expect(section).toContain("Use for testing");
  });

  it("should include constraints", () => {
    const tool = createTestTool();
    const section = toSystemPromptSection(tool);

    expect(section).toContain("### Constraints");
    expect(section).toContain("Input must be non-empty");
  });

  it("should include anti-patterns", () => {
    const tool = createTestTool();
    const section = toSystemPromptSection(tool);

    expect(section).toContain("### Do NOT Use When");
    expect(section).toContain("Do not use in production");
  });

  it("should include examples", () => {
    const tool = createTestTool();
    const section = toSystemPromptSection(tool);

    expect(section).toContain("### Examples");
    expect(section).toContain("**Basic usage**");
    expect(section).toContain("Testing the tool");
  });

  it("should include related tools", () => {
    const tool = createTestTool();
    const section = toSystemPromptSection(tool);

    expect(section).toContain("**Related tools:**");
    expect(section).toContain("other_tool");
  });

  it("should include alternatives", () => {
    const tool = createTestTool();
    const section = toSystemPromptSection(tool);

    expect(section).toContain("**Alternatives:**");
    expect(section).toContain("alternative_tool");
  });

  it("should include enum values in parameters", () => {
    const tool = createTestTool({
      parameters: {
        properties: {
          mode: {
            type: "string",
            description: "Mode",
            required: true,
            enum: ["a", "b"],
          },
        },
        required: ["mode"],
      },
    });

    const section = toSystemPromptSection(tool);

    expect(section).toContain("Options:");
    expect(section).toContain("`a`");
    expect(section).toContain("`b`");
  });

  it("should include parameter examples", () => {
    const tool = createTestTool({
      parameters: {
        properties: {
          path: {
            type: "string",
            description: "File path",
            required: true,
            examples: ["/tmp/file.txt", "/home/user/doc.md"],
          },
        },
        required: ["path"],
      },
    });

    const section = toSystemPromptSection(tool);

    expect(section).toContain("Examples:");
    expect(section).toContain("/tmp/file.txt");
  });

  it("should include parameter constraints", () => {
    const tool = createTestTool({
      parameters: {
        properties: {
          count: {
            type: "number",
            description: "Count value",
            required: true,
            constraints: ["Must be positive", "Max 100"],
          },
        },
        required: ["count"],
      },
    });

    const section = toSystemPromptSection(tool);

    expect(section).toContain("Must be positive");
    expect(section).toContain("Max 100");
  });
});

describe("generateToolInstructions", () => {
  it("should generate complete tool documentation", () => {
    const tools = [
      createTestTool({ categories: ["file-operations"] }),
      createTestTool({
        name: "search_tool",
        displayName: "Search Tool",
        categories: ["search"],
      }),
    ];

    const instructions = generateToolInstructions(tools);

    expect(instructions).toContain("# Available Tools");
    expect(instructions).toContain("# File Operations");
    expect(instructions).toContain("# Search");
    expect(instructions).toContain("# Tool Usage Principles");
  });

  it("should deduplicate tools in multiple categories", () => {
    const tools = [
      createTestTool({
        name: "multi_cat",
        displayName: "Multi Cat",
        categories: ["file-operations", "search"],
      }),
    ];

    const instructions = generateToolInstructions(tools);

    // Count occurrences of the tool name - should only appear once per category section
    const matches = instructions.match(/## Multi Cat/g);
    expect(matches?.length).toBeLessThanOrEqual(2); // Once per category max
  });
});

describe("calculateTotalTokenCost", () => {
  it("should sum token costs", () => {
    const tools = [
      createTestTool({ tokenCost: 100 }),
      createTestTool({ tokenCost: 200 }),
      createTestTool({ tokenCost: 50 }),
    ];

    const total = calculateTotalTokenCost(tools);

    expect(total).toBe(350);
  });

  it("should return 0 for empty array", () => {
    const total = calculateTotalTokenCost([]);

    expect(total).toBe(0);
  });
});

describe("filterByCategory", () => {
  it("should filter by single category", () => {
    const tools = [
      createTestTool({ name: "file_tool", categories: ["file-operations"] }),
      createTestTool({ name: "search_tool", categories: ["search"] }),
      createTestTool({ name: "command_tool", categories: ["command-execution"] }),
    ];

    const filtered = filterByCategory(tools, ["file-operations"]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("file_tool");
  });

  it("should filter by multiple categories", () => {
    const tools = [
      createTestTool({ name: "file_tool", categories: ["file-operations"] }),
      createTestTool({ name: "search_tool", categories: ["search"] }),
      createTestTool({ name: "command_tool", categories: ["command-execution"] }),
    ];

    const filtered = filterByCategory(tools, ["file-operations", "search"]);

    expect(filtered).toHaveLength(2);
  });

  it("should include tools with matching category", () => {
    const tools = [
      createTestTool({ categories: ["file-operations", "search"] }),
    ];

    const filtered = filterByCategory(tools, ["search"]);

    expect(filtered).toHaveLength(1);
  });
});

describe("filterBySafetyLevel", () => {
  it("should filter by safety level", () => {
    const tools = [
      createTestTool({ name: "safe_tool", safetyLevel: "safe" }),
      createTestTool({ name: "moderate_tool", safetyLevel: "moderate" }),
      createTestTool({ name: "dangerous_tool", safetyLevel: "dangerous" }),
    ];

    const filtered = filterBySafetyLevel(tools, ["safe"]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("safe_tool");
  });

  it("should filter by multiple safety levels", () => {
    const tools = [
      createTestTool({ name: "safe_tool", safetyLevel: "safe" }),
      createTestTool({ name: "moderate_tool", safetyLevel: "moderate" }),
      createTestTool({ name: "dangerous_tool", safetyLevel: "dangerous" }),
    ];

    const filtered = filterBySafetyLevel(tools, ["safe", "moderate"]);

    expect(filtered).toHaveLength(2);
  });
});

describe("getToolsRequiringConfirmation", () => {
  it("should return tools that require confirmation", () => {
    const tools = [
      createTestTool({ name: "auto_tool", requiresConfirmation: false }),
      createTestTool({ name: "confirm_tool", requiresConfirmation: true }),
      createTestTool({ name: "another_auto", requiresConfirmation: false }),
    ];

    const filtered = getToolsRequiringConfirmation(tools);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("confirm_tool");
  });

  it("should return empty array when no tools require confirmation", () => {
    const tools = [
      createTestTool({ requiresConfirmation: false }),
      createTestTool({ requiresConfirmation: false }),
    ];

    const filtered = getToolsRequiringConfirmation(tools);

    expect(filtered).toHaveLength(0);
  });
});
