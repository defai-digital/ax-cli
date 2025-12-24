/**
 * Schema Violation Gate
 *
 * Validates tool arguments against expected schemas.
 *
 * @invariant INV-SCHEMA-001: Each tool must have a defined schema
 * @invariant INV-SCHEMA-002: Validation runs before tool execution
 * @invariant INV-SCHEMA-003: Report specific validation errors
 *
 * @packageDocumentation
 */

import type {
  GateContext,
  GuardCheckResult,
  SchemaViolationConfig,
} from '@defai.digital/ax-schemas';
import { z } from 'zod';

import type { GateImplementation } from '../types.js';
import { pass, warn, fail } from './base.js';

/**
 * Tool schema registry
 * Maps tool names to their Zod schemas
 */
const toolSchemas = new Map<string, z.ZodSchema>();

/**
 * Register a tool schema
 */
export function registerToolSchema(toolName: string, schema: z.ZodSchema): void {
  toolSchemas.set(toolName, schema);
}

/**
 * Get a registered tool schema
 */
export function getToolSchema(toolName: string): z.ZodSchema | undefined {
  return toolSchemas.get(toolName);
}

/**
 * Clear all registered tool schemas (for testing)
 */
export function clearToolSchemas(): void {
  toolSchemas.clear();
}

/**
 * Schema Violation Gate Implementation
 */
export class SchemaViolationGate implements GateImplementation {
  check(
    context: Readonly<GateContext>,
    config?: SchemaViolationConfig
  ): GuardCheckResult {
    const startTime = Date.now();

    // No tool name - nothing to check
    if (!context.toolName) {
      return pass('schema_violation', 'No tool to validate', startTime);
    }

    // Get the schema for this tool
    const schema = toolSchemas.get(context.toolName);

    // INV-SCHEMA-001: Check if schema exists
    if (!schema) {
      if (config?.allowUnknownTools !== false) {
        return warn(
          'schema_violation',
          `No schema registered for tool '${context.toolName}'`,
          startTime,
          {
            toolName: context.toolName,
            reason: 'unknown_tool',
          }
        );
      } else {
        return fail(
          'schema_violation',
          `Tool '${context.toolName}' has no registered schema`,
          startTime,
          {
            toolName: context.toolName,
            reason: 'no_schema',
          }
        );
      }
    }

    // No arguments provided
    if (!context.toolArguments) {
      // Try to validate empty object
      const result = schema.safeParse({});

      if (!result.success) {
        return fail(
          'schema_violation',
          `Tool '${context.toolName}' requires arguments`,
          startTime,
          {
            toolName: context.toolName,
            errors: formatZodErrors(result.error),
            reason: 'missing_arguments',
          }
        );
      }

      return pass('schema_violation', 'Tool arguments valid (empty)', startTime, {
        toolName: context.toolName,
      });
    }

    // INV-SCHEMA-002 & INV-SCHEMA-003: Validate arguments
    const result = schema.safeParse(context.toolArguments);

    if (!result.success) {
      return fail(
        'schema_violation',
        `Tool '${context.toolName}' arguments are invalid`,
        startTime,
        {
          toolName: context.toolName,
          errors: formatZodErrors(result.error),
          reason: 'validation_failed',
        }
      );
    }

    return pass('schema_violation', 'Tool arguments valid', startTime, {
      toolName: context.toolName,
    });
  }
}

/**
 * Format Zod errors for human-readable output
 */
function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
