/**
 * MCP Tool Output Schema Validation
 *
 * Validates tool outputs against their declared JSON schemas using Ajv.
 * Uses the MCP SDK's AjvJsonSchemaValidator for consistency.
 *
 * MCP Specification: Tool Output Schemas (2025-06-18)
 *
 * @module mcp/schema-validator
 */

import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import type { JsonSchemaType } from '@modelcontextprotocol/sdk/validation/types.js';

/**
 * Schema validation result status
 */
export type SchemaValidationStatus = 'valid' | 'invalid' | 'no-schema';

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  /** Validation status */
  status: SchemaValidationStatus;
  /** Validation errors (if status is 'invalid') */
  errors?: string[];
  /** The schema that was used for validation */
  schema?: unknown;
}

/**
 * Tool Output Schema Validator
 *
 * Validates MCP tool outputs against their declared JSON schemas.
 *
 * @example
 * ```typescript
 * const validator = new ToolOutputValidator();
 *
 * // Validate tool output
 * const result = validator.validate(outputSchema, toolOutput);
 *
 * if (result.status === 'invalid') {
 *   console.warn('Tool output validation failed:', result.errors);
 * }
 * ```
 */
export class ToolOutputValidator {
  private validator: AjvJsonSchemaValidator;

  constructor() {
    this.validator = new AjvJsonSchemaValidator();
  }

  /**
   * Validate tool output against schema
   *
   * @param schema - JSON schema to validate against (or undefined if no schema)
   * @param output - Tool output to validate
   * @returns Validation result
   */
  validate(schema: unknown, output: unknown): SchemaValidationResult {
    // No schema defined
    if (schema === undefined || schema === null) {
      return { status: 'no-schema' };
    }

    // Empty schema (matches anything)
    if (typeof schema === 'object' && Object.keys(schema as object).length === 0) {
      return { status: 'valid', schema };
    }

    try {
      // Use the SDK's validator - getValidator returns a function
      const validateFn = this.validator.getValidator(schema as JsonSchemaType);
      const result = validateFn(output);

      if (result.valid) {
        return { status: 'valid', schema };
      }

      // Extract error message
      return {
        status: 'invalid',
        errors: result.errorMessage ? [result.errorMessage] : ['Validation failed'],
        schema,
      };
    } catch (error) {
      // Schema compilation error
      return {
        status: 'invalid',
        errors: [`Schema compilation error: ${error instanceof Error ? error.message : String(error)}`],
        schema,
      };
    }
  }

  /**
   * Validate tool output content array
   *
   * MCP tool results return an array of content items.
   * This method validates the extracted content.
   *
   * BUG FIX: Handles multiple text content items correctly by:
   * 1. First trying direct concatenation (for chunked JSON from streaming)
   * 2. If that fails, try parsing each item individually
   * 3. If all items are valid JSON, validate as array of JSON objects
   *
   * @param schema - JSON schema
   * @param content - MCP tool result content array
   * @returns Validation result
   */
  validateContent(
    schema: unknown,
    content: Array<{ type: string; text?: string; [key: string]: unknown }>
  ): SchemaValidationResult {
    if (schema === undefined || schema === null) {
      return { status: 'no-schema' };
    }

    // Extract text content items
    const textItems = content
      .filter((item) => item.type === 'text' && item.text)
      .map((item) => item.text as string);

    if (textItems.length === 0) {
      // No text content to validate
      return { status: 'valid', schema };
    }

    // Single item - simple case
    if (textItems.length === 1) {
      let parsedOutput: unknown;
      try {
        parsedOutput = JSON.parse(textItems[0]);
      } catch {
        // Not JSON - validate as string if schema allows
        parsedOutput = textItems[0];
      }
      return this.validate(schema, parsedOutput);
    }

    // Multiple text items - try direct concatenation first
    // This handles streaming chunked JSON like {"com" + "plete":true}
    const directConcat = textItems.join('');
    try {
      const parsedOutput = JSON.parse(directConcat);
      return this.validate(schema, parsedOutput);
    } catch {
      // Direct concatenation didn't produce valid JSON
    }

    // BUG FIX: Try parsing each item individually
    // If all parse successfully, validate as array of JSON objects
    const parsedItems: unknown[] = [];
    let allJson = true;

    for (const text of textItems) {
      try {
        parsedItems.push(JSON.parse(text));
      } catch {
        allJson = false;
        break;
      }
    }

    if (allJson) {
      // All items are valid JSON - validate as array (or single if only one)
      return this.validate(schema, parsedItems.length === 1 ? parsedItems[0] : parsedItems);
    }

    // Not JSON - validate the concatenated text as string
    return this.validate(schema, directConcat);
  }
}

// Singleton instance
let validatorInstance: ToolOutputValidator | null = null;

/**
 * Get the singleton validator instance
 */
export function getToolOutputValidator(): ToolOutputValidator {
  if (!validatorInstance) {
    validatorInstance = new ToolOutputValidator();
  }
  return validatorInstance;
}

/**
 * Reset the validator (for testing)
 */
export function resetToolOutputValidator(): void {
  validatorInstance = null;
}
