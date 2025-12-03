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

    // Extract text content and try to parse as JSON
    const textContent = content
      .filter((item) => item.type === 'text' && item.text)
      .map((item) => item.text)
      .join('');

    if (!textContent) {
      // No text content to validate
      return { status: 'valid', schema };
    }

    // Try to parse as JSON
    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(textContent);
    } catch {
      // Not JSON - validate as string if schema allows
      parsedOutput = textContent;
    }

    return this.validate(schema, parsedOutput);
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
